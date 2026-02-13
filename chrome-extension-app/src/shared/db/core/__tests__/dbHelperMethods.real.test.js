/**
 * Real IndexedDB tests for dbHelperMethods.js
 *
 * Uses fake-indexeddb via testDbHelper to exercise every exported function
 * against a genuine (in-memory) IndexedDB with the full CodeMaster schema.
 *
 * The source exports functions that accept a "helper context" object as their
 * first parameter. We construct that context from the testDb's mockDbHelper
 * so each function operates against a real database.
 */

// --- Mocks (must be declared before any imports) ---

jest.mock('../accessControl.js', () => ({
  getExecutionContext: jest.fn(() => ({ contextType: 'test', isTest: true })),
  getStackTrace: jest.fn(() => 'test-stack'),
  validateDatabaseAccess: jest.fn(),
  logDatabaseAccess: jest.fn(),
  checkProductionDatabaseAccess: jest.fn(),
}));

jest.mock('../connectionUtils.js', () => ({
  createDatabaseConnection: jest.fn(),
  logCachedConnection: jest.fn(),
}));

// --- Imports ---

import { createDatabaseConnection, logCachedConnection } from '../connectionUtils.js';
import {
  openDB,
  closeDB,
  deleteDB,
  getAll,
  get,
  add,
  put,
  deleteRecord,
  clear,
  clearStoreWithLogging,
  clearConfigStores,
  handleExpensiveDerivedData,
  getInfo,
} from '../dbHelperMethods.js';
import { createTestDb, closeTestDb, seedStore, readAll } from '../../../../../test/testDbHelper.js';

// --- Test setup ---

let testDb;

beforeEach(async () => {
  testDb = await createTestDb();
  jest.clearAllMocks();
});

afterEach(() => {
  closeTestDb(testDb);
  delete globalThis._testDatabaseActive;
  delete globalThis._testDatabaseHelper;
  delete globalThis._testModifiedStores;
});

/**
 * Builds a helper context object that mirrors what dbHelperFactory creates,
 * wired to our test database.
 */
function makeHelper(overrides = {}) {
  return {
    dbName: testDb.mockDbHelper.dbName,
    baseDbName: 'CodeMaster',
    version: 1,
    db: testDb.db,
    isTestMode: true,
    testSession: 'jest',
    enableLogging: false,
    pendingConnection: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// openDB
// ---------------------------------------------------------------------------
describe('openDB', () => {
  it('returns the cached db when helper.db is set and name matches', async () => {
    const helper = makeHelper();

    const result = await openDB(helper);

    expect(result).toBe(testDb.db);
  });

  it('logs cached connection when enableLogging is true', async () => {
    const helper = makeHelper({ enableLogging: true });

    await openDB(helper);

    expect(logCachedConnection).toHaveBeenCalled();
  });

  it('returns pending connection when one already exists', async () => {
    const pendingPromise = Promise.resolve(testDb.db);
    const helper = makeHelper({ db: null, pendingConnection: pendingPromise });

    const result = await openDB(helper);

    expect(result).toBe(testDb.db);
  });

  it('creates a new connection when db is null and no pending connection', async () => {
    createDatabaseConnection.mockResolvedValue(testDb.db);
    const helper = makeHelper({ db: null });

    const result = await openDB(helper);

    expect(createDatabaseConnection).toHaveBeenCalledWith(
      helper.dbName,
      helper.version,
      expect.any(Object),
      expect.any(String)
    );
    expect(result).toBe(testDb.db);
    expect(helper.db).toBe(testDb.db);
    expect(helper.pendingConnection).toBeNull();
  });

  it('clears pendingConnection and rethrows on connection failure', async () => {
    createDatabaseConnection.mockRejectedValue(new Error('connection failed'));
    const helper = makeHelper({ db: null });

    await expect(openDB(helper)).rejects.toThrow('connection failed');
    expect(helper.pendingConnection).toBeNull();
  });

  it('redirects to test database when globalThis._testDatabaseActive is set', async () => {
    const fakeTestHelper = { openDB: jest.fn().mockResolvedValue('test-db-result') };
    globalThis._testDatabaseActive = true;
    globalThis._testDatabaseHelper = fakeTestHelper;

    const helper = makeHelper({ isTestMode: false });
    const result = await openDB(helper);

    expect(result).toBe('test-db-result');
    expect(fakeTestHelper.openDB).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// closeDB
// ---------------------------------------------------------------------------
describe('closeDB', () => {
  it('closes the database and sets helper.db to null', () => {
    const mockClose = jest.fn();
    const helper = makeHelper({ db: { close: mockClose } });

    closeDB(helper);

    expect(mockClose).toHaveBeenCalled();
    expect(helper.db).toBeNull();
  });

  it('does nothing when helper.db is already null', () => {
    const helper = makeHelper({ db: null });

    // Should not throw
    closeDB(helper);
    expect(helper.db).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// deleteDB
// ---------------------------------------------------------------------------
describe('deleteDB', () => {
  it('throws when helper is not in test mode', async () => {
    const helper = makeHelper({ isTestMode: false });

    await expect(deleteDB(helper)).rejects.toThrow('Cannot delete production database');
  });

  it('closes and deletes the test database successfully', async () => {
    // Create a separate db for deletion testing
    const deleteTestDb = await createTestDb();
    const helper = makeHelper({
      dbName: deleteTestDb.mockDbHelper.dbName,
      db: deleteTestDb.db,
    });

    await deleteDB(helper);

    expect(helper.db).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CRUD operations: getAll, get, add, put, deleteRecord
// ---------------------------------------------------------------------------
describe('getAll', () => {
  it('returns all records from a store', async () => {
    const helper = makeHelper();
    await seedStore(testDb.db, 'settings', [
      { id: 'a', data: 1 },
      { id: 'b', data: 2 },
    ]);

    const result = await getAll(helper, 'settings');

    expect(result).toHaveLength(2);
    expect(result.map(r => r.id).sort()).toEqual(['a', 'b']);
  });

  it('returns empty array when store has no records', async () => {
    const helper = makeHelper();

    const result = await getAll(helper, 'settings');

    expect(result).toEqual([]);
  });
});

describe('get', () => {
  it('returns a single record by key', async () => {
    const helper = makeHelper();
    await seedStore(testDb.db, 'settings', [{ id: 'theme', data: 'dark' }]);

    const result = await get(helper, 'settings', 'theme');

    expect(result).toBeDefined();
    expect(result.data).toBe('dark');
  });

  it('returns undefined when key does not exist', async () => {
    const helper = makeHelper();

    const result = await get(helper, 'settings', 'nonexistent');

    expect(result).toBeUndefined();
  });
});

describe('add', () => {
  it('inserts a new record and returns its key', async () => {
    const helper = makeHelper();

    const key = await add(helper, 'settings', { id: 'lang', data: 'en' });

    expect(key).toBe('lang');
    const all = await readAll(testDb.db, 'settings');
    expect(all).toHaveLength(1);
    expect(all[0].data).toBe('en');
  });

  it('rejects when adding a duplicate key', async () => {
    const helper = makeHelper();
    await seedStore(testDb.db, 'settings', [{ id: 'dup', data: 'first' }]);

    await expect(add(helper, 'settings', { id: 'dup', data: 'second' })).rejects.toBeDefined();
  });
});

describe('put', () => {
  it('upserts a record into the store', async () => {
    const helper = makeHelper();

    await put(helper, 'settings', { id: 'x', data: 'v1' });
    await put(helper, 'settings', { id: 'x', data: 'v2' });

    const all = await readAll(testDb.db, 'settings');
    expect(all).toHaveLength(1);
    expect(all[0].data).toBe('v2');
  });
});

describe('deleteRecord', () => {
  it('removes a record by key', async () => {
    const helper = makeHelper();
    await seedStore(testDb.db, 'settings', [{ id: 'del', data: 'bye' }]);

    await deleteRecord(helper, 'settings', 'del');

    const all = await readAll(testDb.db, 'settings');
    expect(all).toHaveLength(0);
  });

  it('succeeds silently when deleting a nonexistent key', async () => {
    const helper = makeHelper();

    // Should not throw
    await deleteRecord(helper, 'settings', 'ghost');

    const all = await readAll(testDb.db, 'settings');
    expect(all).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// clear
// ---------------------------------------------------------------------------
describe('clear', () => {
  it('throws when helper is not in test mode', async () => {
    const helper = makeHelper({ isTestMode: false });

    await expect(clear(helper, 'settings')).rejects.toThrow('Cannot clear production database');
  });

  it('clears all records from the store in test mode', async () => {
    const helper = makeHelper();
    await seedStore(testDb.db, 'settings', [
      { id: '1', data: 'a' },
      { id: '2', data: 'b' },
    ]);

    await clear(helper, 'settings');

    const all = await readAll(testDb.db, 'settings');
    expect(all).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// clearStoreWithLogging
// ---------------------------------------------------------------------------
describe('clearStoreWithLogging', () => {
  it('clears a store and pushes name to results.cleared', async () => {
    const helper = makeHelper();
    await seedStore(testDb.db, 'settings', [{ id: '1', data: 'a' }]);
    const results = { cleared: [], errors: [] };

    await clearStoreWithLogging(helper, 'settings', results);

    expect(results.cleared).toContain('settings');
    expect(results.errors).toHaveLength(0);
    const all = await readAll(testDb.db, 'settings');
    expect(all).toHaveLength(0);
  });

  it('records errors when store does not exist', async () => {
    const helper = makeHelper();
    const results = { cleared: [], errors: [] };

    await clearStoreWithLogging(helper, 'nonexistent_store', results);

    expect(results.errors).toHaveLength(1);
    expect(results.errors[0].store).toBe('nonexistent_store');
  });
});

// ---------------------------------------------------------------------------
// clearConfigStores
// ---------------------------------------------------------------------------
describe('clearConfigStores', () => {
  it('clears multiple config stores and records results', async () => {
    const helper = makeHelper();
    await seedStore(testDb.db, 'settings', [{ id: '1', data: 'a' }]);
    const results = { cleared: [], errors: [] };

    await clearConfigStores(helper, ['settings'], results);

    expect(results.cleared).toContain('settings');
  });

  it('records error for stores that do not exist with non-matching message', async () => {
    const helper = makeHelper();
    const results = { cleared: [], errors: [] };

    await clearConfigStores(helper, ['fake_store_999'], results);

    // fake-indexeddb says "No objectStore named..." which does NOT include
    // "object stores was not found", so it goes to the error branch
    expect(results.errors).toHaveLength(1);
    expect(results.errors[0].store).toBe('fake_store_999');
  });
});

// ---------------------------------------------------------------------------
// handleExpensiveDerivedData
// ---------------------------------------------------------------------------
describe('handleExpensiveDerivedData', () => {
  it('clears stores that are in _testModifiedStores', async () => {
    const helper = makeHelper();
    await seedStore(testDb.db, 'settings', [{ id: '1', data: 'a' }]);
    globalThis._testModifiedStores = new Set(['settings']);
    const results = { cleared: [], errors: [], preserved: [] };

    await handleExpensiveDerivedData(helper, ['settings'], results);

    expect(results.cleared).toContain('settings');
    expect(results.preserved).toHaveLength(0);
  });

  it('preserves stores that are not in _testModifiedStores', async () => {
    const helper = makeHelper();
    globalThis._testModifiedStores = new Set();
    const results = { cleared: [], errors: [], preserved: [] };

    await handleExpensiveDerivedData(helper, ['settings'], results);

    expect(results.preserved).toContain('settings');
    expect(results.cleared).toHaveLength(0);
  });

  it('resets _testModifiedStores after processing', async () => {
    const helper = makeHelper();
    globalThis._testModifiedStores = new Set(['settings']);
    const results = { cleared: [], errors: [], preserved: [] };

    await handleExpensiveDerivedData(helper, ['settings'], results);

    expect(globalThis._testModifiedStores.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getInfo
// ---------------------------------------------------------------------------
describe('getInfo', () => {
  it('returns correct helper state information', () => {
    const helper = makeHelper();

    const info = getInfo(helper);

    expect(info.dbName).toBe(testDb.mockDbHelper.dbName);
    expect(info.baseDbName).toBe('CodeMaster');
    expect(info.version).toBe(1);
    expect(info.isTestMode).toBe(true);
    expect(info.testSession).toBe('jest');
    expect(info.isConnected).toBe(true);
    expect(info.isPending).toBe(false);
  });

  it('reports isConnected false when db is null', () => {
    const helper = makeHelper({ db: null });

    const info = getInfo(helper);

    expect(info.isConnected).toBe(false);
  });

  it('reports isPending true when pendingConnection exists', () => {
    const helper = makeHelper({ pendingConnection: Promise.resolve() });

    const info = getInfo(helper);

    expect(info.isPending).toBe(true);
  });
});
