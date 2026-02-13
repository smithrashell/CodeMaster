/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "chrome-extension://test-extension-id/popup.html"}
 */

/**
 * StorageService real IndexedDB tests using fake-indexeddb.
 *
 * Uses testDbHelper to spin up an in-memory IndexedDB with the full
 * CodeMaster schema so every StorageService method executes real
 * transactions rather than hand-rolled mocks.
 *
 * The module-level isContentScriptContext() guard checks
 * window.location.protocol at import time.  In jsdom the default
 * protocol is 'http:' which would make the guard return true and
 * short-circuit every method.  The @jest-environment-options docblock
 * above sets the jsdom URL to a chrome-extension:// URL so the guard
 * evaluates to false and all code paths are reachable.
 */

// ---------------------------------------------------------------------------
// 1. Mocks (hoisted by Jest to run BEFORE any imports)
// ---------------------------------------------------------------------------
jest.mock('../../db/index.js', () => ({
  dbHelper: { openDB: jest.fn() },
}));

jest.mock('../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// 2. Imports (run after mocks are applied)
// ---------------------------------------------------------------------------
import { createTestDb, closeTestDb, seedStore, readAll } from '../../../../test/testDbHelper.js';
import { dbHelper } from '../../db/index.js';
import { StorageService } from '../storage/storageService.js';

// ---------------------------------------------------------------------------
// 3. Test suite
// ---------------------------------------------------------------------------
describe('StorageService (real fake-indexeddb)', () => {
  let testDb;

  beforeEach(async () => {
    testDb = await createTestDb();
    dbHelper.openDB.mockImplementation(() => Promise.resolve(testDb.db));
  });

  afterEach(() => {
    closeTestDb(testDb);
    jest.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // _createDefaultSettings
  // -----------------------------------------------------------------------
  describe('_createDefaultSettings()', () => {
    it('should return an object with all expected top-level keys', () => {
      const defaults = StorageService._createDefaultSettings();
      const expectedKeys = [
        'theme', 'sessionLength', 'limit', 'reminder',
        'numberofNewProblemsPerSession', 'adaptive', 'focusAreas',
        'systemFocusPool', 'focusAreasLastChanged', 'sessionsPerWeek',
        'reviewRatio', 'timerDisplay', 'breakReminders',
        'notifications', 'accessibility',
      ];
      expectedKeys.forEach((key) => {
        expect(defaults).toHaveProperty(key);
      });
    });

    it('should set theme to light and sessionLength to auto', () => {
      const defaults = StorageService._createDefaultSettings();
      expect(defaults.theme).toBe('light');
      expect(defaults.sessionLength).toBe('auto');
    });

    it('should default adaptive to true and focusAreas to empty array', () => {
      const defaults = StorageService._createDefaultSettings();
      expect(defaults.adaptive).toBe(true);
      expect(defaults.focusAreas).toEqual([]);
    });

    it('should provide correct accessibility sub-structures', () => {
      const defaults = StorageService._createDefaultSettings();
      expect(defaults.accessibility.screenReader.enabled).toBe(false);
      expect(defaults.accessibility.screenReader.verboseDescriptions).toBe(true);
      expect(defaults.accessibility.keyboard.enhancedFocus).toBe(false);
      expect(defaults.accessibility.motor.largerTargets).toBe(false);
      expect(defaults.accessibility.motor.reducedMotion).toBe(false);
    });

    it('should set notification defaults correctly', () => {
      const defaults = StorageService._createDefaultSettings();
      expect(defaults.notifications.sound).toBe(false);
      expect(defaults.notifications.browser).toBe(false);
      expect(defaults.notifications.visual).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // set / get / remove  (key-value storage on "settings" store)
  // -----------------------------------------------------------------------
  describe('set()', () => {
    it('should write a key-value pair and return success', async () => {
      const result = await StorageService.set('my_key', 42);
      expect(result).toEqual({ status: 'success' });

      // Verify it actually landed in the store
      const rows = await readAll(testDb.db, 'settings');
      const row = rows.find((r) => r.id === 'my_key');
      expect(row).toBeDefined();
      expect(row.data).toBe(42);
      expect(row.lastUpdated).toBeDefined();
    });

    it('should overwrite an existing key', async () => {
      await StorageService.set('color', 'red');
      await StorageService.set('color', 'blue');

      const rows = await readAll(testDb.db, 'settings');
      const row = rows.find((r) => r.id === 'color');
      expect(row.data).toBe('blue');
    });

    it('should handle object values', async () => {
      const obj = { nested: { deep: true }, arr: [1, 2, 3] };
      await StorageService.set('complex', obj);

      const val = await StorageService.get('complex');
      expect(val).toEqual(obj);
    });

    it('should return error status when DB connection fails', async () => {
      dbHelper.openDB.mockRejectedValueOnce(new Error('DB down'));
      const result = await StorageService.set('key', 'val');
      expect(result.status).toBe('error');
      expect(result.message).toBe('DB down');
    });
  });

  describe('get()', () => {
    it('should return null for a non-existent key', async () => {
      const result = await StorageService.get('does_not_exist');
      expect(result).toBeNull();
    });

    it('should retrieve the data property of a stored record', async () => {
      await seedStore(testDb.db, 'settings', [
        { id: 'greeting', data: 'hello world', lastUpdated: new Date().toISOString() },
      ]);

      const result = await StorageService.get('greeting');
      expect(result).toBe('hello world');
    });

    it('should return null on DB error', async () => {
      dbHelper.openDB.mockRejectedValueOnce(new Error('read failure'));
      const result = await StorageService.get('any');
      expect(result).toBeNull();
    });
  });

  describe('remove()', () => {
    it('should delete a previously stored key and return success', async () => {
      await StorageService.set('temp', 'value');
      const result = await StorageService.remove('temp');
      expect(result).toEqual({ status: 'success' });

      const val = await StorageService.get('temp');
      expect(val).toBeNull();
    });

    it('should return success even if key does not exist', async () => {
      const result = await StorageService.remove('phantom');
      expect(result).toEqual({ status: 'success' });
    });

    it('should return error on DB failure', async () => {
      dbHelper.openDB.mockRejectedValueOnce(new Error('delete failed'));
      const result = await StorageService.remove('any');
      expect(result.status).toBe('error');
      expect(result.message).toBe('delete failed');
    });
  });

  // -----------------------------------------------------------------------
  // getSettings / setSettings
  // -----------------------------------------------------------------------
  describe('getSettings()', () => {
    it('should return defaults with keyboard overrides when no settings exist', async () => {
      const settings = await StorageService.getSettings();

      expect(settings.theme).toBe('light');
      expect(settings.sessionLength).toBe('auto');
      // getSettings overrides some keyboard defaults
      expect(settings.accessibility.keyboard.enhancedFocus).toBe(true);
      expect(settings.accessibility.keyboard.focusTrapping).toBe(true);
      expect(settings.accessibility.keyboard.skipToContent).toBe(true);
    });

    it('should auto-persist defaults to the DB when none exist', async () => {
      await StorageService.getSettings();

      // The auto-saved record should be in the settings store
      const rows = await readAll(testDb.db, 'settings');
      const saved = rows.find((r) => r.id === 'user_settings');
      expect(saved).toBeDefined();
      expect(saved.data.theme).toBe('light');
    });

    it('should return stored settings when they exist', async () => {
      const custom = { theme: 'dark', sessionLength: 10, adaptive: false };
      await seedStore(testDb.db, 'settings', [
        { id: 'user_settings', data: custom, lastUpdated: new Date().toISOString() },
      ]);

      const settings = await StorageService.getSettings();
      expect(settings.theme).toBe('dark');
      expect(settings.sessionLength).toBe(10);
      expect(settings.adaptive).toBe(false);
    });

    it('should return defaults on DB failure', async () => {
      dbHelper.openDB.mockRejectedValueOnce(new Error('DB crash'));
      const settings = await StorageService.getSettings();
      expect(settings.theme).toBe('light');
    });
  });

  describe('setSettings()', () => {
    it('should persist settings and return success', async () => {
      const custom = { theme: 'dark', sessionLength: 15 };
      const result = await StorageService.setSettings(custom);
      expect(result).toEqual({ status: 'success' });

      const rows = await readAll(testDb.db, 'settings');
      const saved = rows.find((r) => r.id === 'user_settings');
      expect(saved.data).toEqual(custom);
    });

    it('should return error on DB failure', async () => {
      dbHelper.openDB.mockRejectedValueOnce(new Error('write crash'));
      const result = await StorageService.setSettings({ theme: 'dark' });
      expect(result.status).toBe('error');
    });
  });

  // -----------------------------------------------------------------------
  // Session state (session_state store)
  // -----------------------------------------------------------------------
  describe('getSessionState()', () => {
    it('should return null when no session state exists', async () => {
      const result = await StorageService.getSessionState();
      expect(result).toBeNull();
    });

    it('should return primitive values wrapped in value property', async () => {
      await seedStore(testDb.db, 'session_state', [
        { id: 'session_state', value: 'active' },
      ]);

      const result = await StorageService.getSessionState();
      expect(result).toBe('active');
    });

    it('should return full object for complex data', async () => {
      const complexData = { id: 'session_state', problems: [1, 2], index: 0, extra: 'data' };
      await seedStore(testDb.db, 'session_state', [complexData]);

      const result = await StorageService.getSessionState();
      expect(result).toEqual(complexData);
    });

    it('should detect malformed data with numeric keys and return null', async () => {
      // Simulates string spread as indexed object: { 0:'a', 1:'b', id:'session_state' }
      const malformed = { id: 'session_state', 0: 'a', 1: 'b', 2: 'c' };
      await seedStore(testDb.db, 'session_state', [malformed]);

      const result = await StorageService.getSessionState();
      expect(result).toBeNull();
    });

    it('should support custom keys', async () => {
      await seedStore(testDb.db, 'session_state', [
        { id: 'custom_key', value: 99 },
      ]);

      const result = await StorageService.getSessionState('custom_key');
      expect(result).toBe(99);
    });

    it('should return null on DB failure', async () => {
      dbHelper.openDB.mockRejectedValueOnce(new Error('fail'));
      const result = await StorageService.getSessionState();
      expect(result).toBeNull();
    });
  });

  describe('setSessionState()', () => {
    it('should store primitive values with value wrapper', async () => {
      await StorageService.setSessionState('my_state', 'paused');

      const rows = await readAll(testDb.db, 'session_state');
      const row = rows.find((r) => r.id === 'my_state');
      expect(row).toEqual({ id: 'my_state', value: 'paused' });
    });

    it('should spread object data with id', async () => {
      const data = { problems: [1, 2, 3], currentIndex: 1 };
      await StorageService.setSessionState('sess', data);

      const rows = await readAll(testDb.db, 'session_state');
      const row = rows.find((r) => r.id === 'sess');
      expect(row.problems).toEqual([1, 2, 3]);
      expect(row.currentIndex).toBe(1);
      expect(row.id).toBe('sess');
    });

    it('should wrap arrays in value property', async () => {
      await StorageService.setSessionState('arr_state', [10, 20]);

      const rows = await readAll(testDb.db, 'session_state');
      const row = rows.find((r) => r.id === 'arr_state');
      expect(row.value).toEqual([10, 20]);
    });

    it('should wrap null in value property', async () => {
      await StorageService.setSessionState('null_state', null);

      const rows = await readAll(testDb.db, 'session_state');
      const row = rows.find((r) => r.id === 'null_state');
      expect(row.value).toBeNull();
    });

    it('should return error on DB failure', async () => {
      dbHelper.openDB.mockRejectedValueOnce(new Error('write fail'));
      const result = await StorageService.setSessionState('key', 'val');
      expect(result.status).toBe('error');
    });
  });

  // -----------------------------------------------------------------------
  // Last Activity Date & getDaysSinceLastActivity
  // -----------------------------------------------------------------------
  describe('getLastActivityDate()', () => {
    it('should return null when no activity date is stored', async () => {
      const result = await StorageService.getLastActivityDate();
      expect(result).toBeNull();
    });

    it('should return stored activity date', async () => {
      const date = '2025-01-15T10:00:00.000Z';
      await StorageService.set('last_activity_date', date);

      const result = await StorageService.getLastActivityDate();
      expect(result).toBe(date);
    });
  });

  describe('updateLastActivityDate()', () => {
    it('should store current ISO date and return success', async () => {
      const before = new Date().toISOString();
      const result = await StorageService.updateLastActivityDate();
      const after = new Date().toISOString();

      expect(result).toEqual({ status: 'success' });

      const stored = await StorageService.get('last_activity_date');
      expect(stored >= before).toBe(true);
      expect(stored <= after).toBe(true);
    });
  });

  describe('getDaysSinceLastActivity()', () => {
    it('should return 0 and set activity date on first use', async () => {
      const days = await StorageService.getDaysSinceLastActivity();
      expect(days).toBe(0);

      // Should have auto-set the activity date
      const stored = await StorageService.getLastActivityDate();
      expect(stored).not.toBeNull();
    });

    it('should return correct number of days since last activity', async () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      await StorageService.set('last_activity_date', threeDaysAgo);

      const days = await StorageService.getDaysSinceLastActivity();
      expect(days).toBe(3);
    });

    it('should return 0 for activity earlier today', async () => {
      const earlier = new Date();
      earlier.setHours(earlier.getHours() - 2);
      await StorageService.set('last_activity_date', earlier.toISOString());

      const days = await StorageService.getDaysSinceLastActivity();
      expect(days).toBe(0);
    });

    it('should return 0 on DB failure', async () => {
      dbHelper.openDB.mockRejectedValue(new Error('total failure'));
      const days = await StorageService.getDaysSinceLastActivity();
      expect(days).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Round-trip integration
  // -----------------------------------------------------------------------
  describe('round-trip integration', () => {
    it('should set, get, remove, and verify absence of a key', async () => {
      await StorageService.set('roundtrip', { x: 1 });
      const val = await StorageService.get('roundtrip');
      expect(val).toEqual({ x: 1 });

      await StorageService.remove('roundtrip');
      const gone = await StorageService.get('roundtrip');
      expect(gone).toBeNull();
    });

    it('should store settings then retrieve them in a subsequent call', async () => {
      const custom = {
        theme: 'dark',
        sessionLength: 8,
        adaptive: true,
        focusAreas: ['dp', 'graphs'],
      };
      await StorageService.setSettings(custom);

      const retrieved = await StorageService.getSettings();
      expect(retrieved.theme).toBe('dark');
      expect(retrieved.sessionLength).toBe(8);
      expect(retrieved.focusAreas).toEqual(['dp', 'graphs']);
    });

    it('should store and retrieve session state round-trip', async () => {
      const state = { currentProblem: 5, timer: 120, isActive: true };
      await StorageService.setSessionState('session_state', state);

      const retrieved = await StorageService.getSessionState('session_state');
      expect(retrieved.currentProblem).toBe(5);
      expect(retrieved.timer).toBe(120);
      expect(retrieved.isActive).toBe(true);
    });
  });
});
