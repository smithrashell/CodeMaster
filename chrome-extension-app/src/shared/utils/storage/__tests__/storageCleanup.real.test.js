/**
 * Tests for storageCleanup.js (StorageCleanupManager)
 * Covers: startPeriodicCleanup, stopPeriodicCleanup,
 *   performAutomaticCleanup, getCleanupRecommendations, cleanupOldData
 */

jest.mock('../../../db/core/connectionUtils.js', () => ({
  openDatabase: jest.fn(),
}));

jest.mock('../../logging/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import StorageCleanupManager from '../storageCleanup.js';
import { openDatabase } from '../../../db/core/connectionUtils.js';
import logger from '../../logging/logger.js';

// ---------------------------------------------------------------------------
// Helper to create mock IDB
// ---------------------------------------------------------------------------
function makeMockDb(sessions = []) {
  const deleteFn = jest.fn(() => {
    return { then: jest.fn() }; // store.delete returns IDBRequest
  });

  return {
    transaction: jest.fn((_storeName, _mode) => ({
      objectStore: jest.fn(() => ({
        getAll: jest.fn(() => {
          const req = {};
          Promise.resolve().then(() => {
            req.result = [...sessions];
            if (req.onsuccess) req.onsuccess();
          });
          return req;
        }),
        delete: jest.fn((id) => {
          deleteFn(id);
          // return a promise-like for `await store.delete`
          return Promise.resolve();
        }),
      })),
    })),
    _deleteFn: deleteFn,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  StorageCleanupManager.cleanupIntervalId = null;
});

afterEach(() => {
  StorageCleanupManager.stopPeriodicCleanup();
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// performAutomaticCleanup
// ---------------------------------------------------------------------------
describe('performAutomaticCleanup', () => {
  it('throws when database cannot be opened', async () => {
    openDatabase.mockResolvedValue(null);

    await expect(StorageCleanupManager.performAutomaticCleanup()).rejects.toThrow(
      'Failed to open database for cleanup'
    );
  });

  it('preserves completed sessions', async () => {
    const sessions = [
      { id: 'session-completed-1', status: 'completed', date: '2024-01-01' },
    ];
    const mockDb = makeMockDb(sessions);
    openDatabase.mockResolvedValue(mockDb);

    const result = await StorageCleanupManager.performAutomaticCleanup();

    expect(result.deletedCount).toBe(0);
    expect(result.details.stats.completed.preserved).toBe(1);
  });

  it('deletes expired sessions', async () => {
    const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const sessions = [
      { id: 'session-expired-abcdefgh', status: 'expired', date: pastDate },
    ];
    const mockDb = makeMockDb(sessions);
    openDatabase.mockResolvedValue(mockDb);

    const result = await StorageCleanupManager.performAutomaticCleanup();

    expect(result.deletedCount).toBe(1);
    expect(result.details.stats.expired.deleted).toBe(1);
  });

  it('tracks in_progress sessions as active', async () => {
    const sessions = [
      { id: 'session-active-12345678', status: 'in_progress', date: new Date().toISOString() },
    ];
    const mockDb = makeMockDb(sessions);
    openDatabase.mockResolvedValue(mockDb);

    const result = await StorageCleanupManager.performAutomaticCleanup();

    expect(result.deletedCount).toBe(0);
    expect(result.details.stats.active).toBe(1);
  });

  it('returns correct summary message', async () => {
    const mockDb = makeMockDb([]);
    openDatabase.mockResolvedValue(mockDb);

    const result = await StorageCleanupManager.performAutomaticCleanup();

    expect(result.message).toContain('Deleted 0 old sessions');
    expect(result.details.retentionPolicy).toEqual(StorageCleanupManager.RETENTION_POLICY);
  });

  it('handles delete errors gracefully', async () => {
    const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const sessions = [
      { id: 'session-expired-failtest', status: 'expired', date: pastDate },
    ];

    const mockDb = {
      transaction: jest.fn(() => ({
        objectStore: jest.fn(() => ({
          getAll: jest.fn(() => {
            const req = {};
            Promise.resolve().then(() => {
              req.result = [...sessions];
              if (req.onsuccess) req.onsuccess();
            });
            return req;
          }),
          delete: jest.fn(() => {
            throw new Error('delete failed');
          }),
        })),
      })),
    };
    openDatabase.mockResolvedValue(mockDb);

    const result = await StorageCleanupManager.performAutomaticCleanup();
    // Session delete failed but the cleanup itself should complete
    expect(result.deletedCount).toBe(0);
    expect(logger.error).toHaveBeenCalled();
  });

  it('limits deleted sessions in output to 10', async () => {
    const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const sessions = Array.from({ length: 15 }, (_, i) => ({
      id: `session-expired-${String(i).padStart(8, '0')}`,
      status: 'expired',
      date: pastDate,
    }));

    const mockDb = makeMockDb(sessions);
    openDatabase.mockResolvedValue(mockDb);

    const result = await StorageCleanupManager.performAutomaticCleanup();

    expect(result.details.deletedSessions.length).toBeLessThanOrEqual(10);
  });
});

// ---------------------------------------------------------------------------
// getCleanupRecommendations
// ---------------------------------------------------------------------------
describe('getCleanupRecommendations', () => {
  it('returns empty array when database cannot be opened', async () => {
    openDatabase.mockResolvedValue(null);

    const recommendations = await StorageCleanupManager.getCleanupRecommendations();
    expect(recommendations).toEqual([]);
  });

  it('returns empty array when no expired sessions', async () => {
    const sessions = [
      { id: 's1', status: 'completed', date: '2024-01-01' },
    ];
    const mockDb = makeMockDb(sessions);
    openDatabase.mockResolvedValue(mockDb);

    const recommendations = await StorageCleanupManager.getCleanupRecommendations();
    expect(recommendations).toEqual([]);
  });

  it('recommends deleting old expired sessions', async () => {
    const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const sessions = [
      { id: 's1', status: 'expired', date: pastDate },
      { id: 's2', status: 'expired', date: pastDate },
    ];
    const mockDb = makeMockDb(sessions);
    openDatabase.mockResolvedValue(mockDb);

    const recommendations = await StorageCleanupManager.getCleanupRecommendations();

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].type).toBe('old_expired');
    expect(recommendations[0].count).toBe(2);
    expect(recommendations[0].action).toBe('delete');
  });

  it('handles errors gracefully', async () => {
    openDatabase.mockRejectedValue(new Error('db fail'));

    const recommendations = await StorageCleanupManager.getCleanupRecommendations();
    expect(recommendations).toEqual([]);
    expect(logger.error).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// startPeriodicCleanup / stopPeriodicCleanup
// ---------------------------------------------------------------------------
describe('startPeriodicCleanup', () => {
  it('sets up an interval and runs cleanup immediately', () => {
    const mockDb = makeMockDb([]);
    openDatabase.mockResolvedValue(mockDb);

    StorageCleanupManager.startPeriodicCleanup();

    expect(StorageCleanupManager.cleanupIntervalId).not.toBeNull();
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Periodic cleanup started')
    );
  });

  it('clears existing interval when called again', () => {
    const mockDb = makeMockDb([]);
    openDatabase.mockResolvedValue(mockDb);

    StorageCleanupManager.startPeriodicCleanup();
    const firstId = StorageCleanupManager.cleanupIntervalId;

    StorageCleanupManager.startPeriodicCleanup();
    const secondId = StorageCleanupManager.cleanupIntervalId;

    // The interval IDs should be different
    expect(secondId).not.toBe(firstId);
  });

  it('handles initial cleanup failure gracefully', () => {
    openDatabase.mockRejectedValue(new Error('initial fail'));

    // Should not throw
    StorageCleanupManager.startPeriodicCleanup();
    expect(StorageCleanupManager.cleanupIntervalId).not.toBeNull();
  });
});

describe('stopPeriodicCleanup', () => {
  it('clears the interval', () => {
    const mockDb = makeMockDb([]);
    openDatabase.mockResolvedValue(mockDb);

    StorageCleanupManager.startPeriodicCleanup();
    expect(StorageCleanupManager.cleanupIntervalId).not.toBeNull();

    StorageCleanupManager.stopPeriodicCleanup();
    expect(StorageCleanupManager.cleanupIntervalId).toBeNull();
  });

  it('does nothing if no interval is set', () => {
    StorageCleanupManager.cleanupIntervalId = null;
    StorageCleanupManager.stopPeriodicCleanup();
    expect(StorageCleanupManager.cleanupIntervalId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// cleanupOldData (alias)
// ---------------------------------------------------------------------------
describe('cleanupOldData', () => {
  it('delegates to performAutomaticCleanup', async () => {
    const mockDb = makeMockDb([]);
    openDatabase.mockResolvedValue(mockDb);

    const result = await StorageCleanupManager.cleanupOldData();
    expect(result.deletedCount).toBe(0);
    expect(result.message).toBeDefined();
  });
});

