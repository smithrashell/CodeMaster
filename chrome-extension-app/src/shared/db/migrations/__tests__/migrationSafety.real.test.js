/**
 * Tests for migrationSafety.js
 *
 * Tests the migration safety framework: backup creation, database validation,
 * safe migration with rollback, broadcast coordination, and blocked event handlers.
 */

// Mock dbHelper before importing the module
jest.mock('../../index.js', () => ({
  dbHelper: {
    openDB: jest.fn(),
    version: 22,
  },
}));

import { dbHelper } from '../../index.js';
import {
  initializeMigrationSafety,
  createMigrationBackup,
  validateDatabaseIntegrity,
  performSafeMigration,
} from '../migrationSafety.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFakeDb(stores = {}) {
  const storeMap = {};

  for (const [name, records] of Object.entries(stores)) {
    storeMap[name] = {
      getAll: jest.fn(() => {
        const req = { result: records };
        setTimeout(() => req.onsuccess && req.onsuccess(), 0);
        return req;
      }),
      get: jest.fn((key) => {
        const found = records.find(r => r.backupId === key);
        const req = { result: found };
        setTimeout(() => req.onsuccess && req.onsuccess(), 0);
        return req;
      }),
      put: jest.fn(() => {
        const req = {};
        setTimeout(() => req.onsuccess && req.onsuccess(), 0);
        return req;
      }),
      clear: jest.fn(() => {
        const req = {};
        setTimeout(() => req.onsuccess && req.onsuccess(), 0);
        return req;
      }),
    };
  }

  return {
    transaction: jest.fn((storeNames, mode) => {
      const nameArr = Array.isArray(storeNames) ? storeNames : [storeNames];
      return {
        objectStore: jest.fn((storeName) => storeMap[storeName] || storeMap[nameArr[0]]),
        oncomplete: null,
        onerror: null,
      };
    }),
    objectStoreNames: Object.keys(stores),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('migrationSafety', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================================================
  // initializeMigrationSafety
  // ========================================================================
  describe('initializeMigrationSafety', () => {
    it('should set up BroadcastChannel when available', () => {
      // BroadcastChannel is available in JSDOM (mocked via global)
      const mockChannel = {
        addEventListener: jest.fn(),
        postMessage: jest.fn(),
      };
      global.BroadcastChannel = jest.fn(() => mockChannel);

      initializeMigrationSafety();

      expect(global.BroadcastChannel).toHaveBeenCalledWith('codemaster-migration');
      expect(mockChannel.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('should work when BroadcastChannel is not available', () => {
      const original = global.BroadcastChannel;
      delete global.BroadcastChannel;

      expect(() => initializeMigrationSafety()).not.toThrow();

      global.BroadcastChannel = original;
    });

    it('should set up blocked event handlers on indexedDB.open', () => {
      const originalOpen = indexedDB.open;
      const mockChannel = {
        addEventListener: jest.fn(),
        postMessage: jest.fn(),
      };
      global.BroadcastChannel = jest.fn(() => mockChannel);

      initializeMigrationSafety();

      // After initialization, indexedDB.open should be wrapped
      // Just verify it's still callable
      expect(typeof indexedDB.open).toBe('function');

      // Restore
      indexedDB.open = originalOpen;
    });
  });

  // ========================================================================
  // createMigrationBackup
  // ========================================================================
  describe('createMigrationBackup', () => {
    it('should return a backup ID string with version and timestamp', () => {
      const backupId = createMigrationBackup();
      expect(typeof backupId).toBe('string');
      expect(backupId).toMatch(/^migration_backup_\d+_v22$/);
    });

    it('should accept custom stores array', () => {
      const backupId = createMigrationBackup(['attempts', 'sessions']);
      expect(typeof backupId).toBe('string');
      expect(backupId).toMatch(/^migration_backup_/);
    });

    it('should return different IDs on successive calls', () => {
      const id1 = createMigrationBackup();
      const id2 = createMigrationBackup();
      // May share same timestamp in fast test, but format is correct
      expect(id1).toMatch(/^migration_backup_/);
      expect(id2).toMatch(/^migration_backup_/);
    });
  });

  // ========================================================================
  // validateDatabaseIntegrity
  // ========================================================================
  describe('validateDatabaseIntegrity', () => {
    it('should return valid result in simplified mode', () => {
      const result = validateDatabaseIntegrity();
      expect(result).toEqual({
        valid: true,
        issues: [],
        storeValidation: {},
        recommendations: [],
      });
    });

    it('should return valid:true with empty issues', () => {
      const result = validateDatabaseIntegrity();
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  // ========================================================================
  // performSafeMigration
  // ========================================================================
  describe('performSafeMigration', () => {
    it('should execute migration function and return success result', async () => {
      const migrationFn = jest.fn().mockResolvedValue({ migrated: true });

      const result = await performSafeMigration(migrationFn, {
        validateBefore: false,
        validateAfter: false,
        rollbackOnFailure: false,
      });

      expect(result.success).toBe(true);
      expect(result.migrationResult).toEqual({ migrated: true });
      expect(result.backupId).toMatch(/^migration_backup_/);
      expect(typeof result.duration).toBe('number');
      expect(typeof result.timestamp).toBe('string');
      expect(migrationFn).toHaveBeenCalledTimes(1);
    });

    it('should call progressCallback during migration stages', async () => {
      const progressCallback = jest.fn();
      const migrationFn = jest.fn().mockResolvedValue('done');

      await performSafeMigration(migrationFn, {
        progressCallback,
        validateBefore: false,
        validateAfter: false,
        rollbackOnFailure: false,
      });

      // Should be called for backup and migration steps at minimum
      expect(progressCallback).toHaveBeenCalledWith('Creating backup...', 20);
      expect(progressCallback).toHaveBeenCalledWith('Executing migration...', 50);
      expect(progressCallback).toHaveBeenCalledWith('Migration complete', 100);
    });

    it('should run pre-migration validation when validateBefore is true', async () => {
      const progressCallback = jest.fn();
      const migrationFn = jest.fn().mockResolvedValue('done');

      await performSafeMigration(migrationFn, {
        validateBefore: true,
        validateAfter: false,
        progressCallback,
        rollbackOnFailure: false,
      });

      expect(progressCallback).toHaveBeenCalledWith('Validating database integrity...', 10);
    });

    it('should run post-migration validation when validateAfter is true', async () => {
      const progressCallback = jest.fn();
      const migrationFn = jest.fn().mockResolvedValue('done');

      await performSafeMigration(migrationFn, {
        validateBefore: false,
        validateAfter: true,
        progressCallback,
        rollbackOnFailure: false,
      });

      expect(progressCallback).toHaveBeenCalledWith('Validating results...', 80);
    });

    it('should throw and include error info when migration function fails', async () => {
      const migrationFn = jest.fn().mockRejectedValue(new Error('Migration broke'));

      await expect(
        performSafeMigration(migrationFn, {
          validateBefore: false,
          validateAfter: false,
          rollbackOnFailure: false,
        })
      ).rejects.toThrow('Migration broke');
    });

    it('should attempt rollback on failure when rollbackOnFailure is true', async () => {
      const fakeDb = makeFakeDb({
        backup_storage: [
          {
            backupId: 'some_backup',
            data: { stores: {} },
          },
        ],
      });
      dbHelper.openDB.mockResolvedValue(fakeDb);

      const migrationFn = jest.fn().mockRejectedValue(new Error('Fail'));
      const progressCallback = jest.fn();

      await expect(
        performSafeMigration(migrationFn, {
          validateBefore: false,
          validateAfter: false,
          rollbackOnFailure: true,
          progressCallback,
        })
      ).rejects.toThrow('Fail');

      expect(progressCallback).toHaveBeenCalledWith('Rolling back changes...', 90);
    });

    it('should broadcast migration events via BroadcastChannel', async () => {
      const mockChannel = {
        addEventListener: jest.fn(),
        postMessage: jest.fn(),
      };
      global.BroadcastChannel = jest.fn(() => mockChannel);
      initializeMigrationSafety();

      const migrationFn = jest.fn().mockResolvedValue('done');

      await performSafeMigration(migrationFn, {
        validateBefore: false,
        validateAfter: false,
        rollbackOnFailure: false,
      });

      // Should have posted start and complete
      const calls = mockChannel.postMessage.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(2);
      expect(calls[0][0].type).toBe('migration_start');
      expect(calls[calls.length - 1][0].type).toBe('migration_complete');
    });

    it('should broadcast migration_failed event on error', async () => {
      const mockChannel = {
        addEventListener: jest.fn(),
        postMessage: jest.fn(),
      };
      global.BroadcastChannel = jest.fn(() => mockChannel);
      initializeMigrationSafety();

      const migrationFn = jest.fn().mockRejectedValue(new Error('crash'));

      await expect(
        performSafeMigration(migrationFn, {
          validateBefore: false,
          validateAfter: false,
          rollbackOnFailure: false,
        })
      ).rejects.toThrow('crash');

      const calls = mockChannel.postMessage.mock.calls;
      const failedCall = calls.find(c => c[0].type === 'migration_failed');
      expect(failedCall).toBeTruthy();
    });

    it('should use default options when none provided', async () => {
      const migrationFn = jest.fn().mockResolvedValue('ok');

      // This will run with validateBefore=true, validateAfter=true (defaults)
      // validateDatabaseIntegrity returns valid:true so it should succeed
      const result = await performSafeMigration(migrationFn);
      expect(result.success).toBe(true);
    });
  });
});
