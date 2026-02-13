/**
 * Test Database Helper for Jest
 *
 * Creates a real fake-indexeddb database with the full CodeMaster schema.
 * Store test files use this instead of mocking dbHelper with jest.fn(),
 * so real store code executes against an in-memory IndexedDB.
 *
 * Usage in test files:
 *   import { createTestDb, closeTestDb } from '../../../../test/testDbHelper.js';
 *
 *   let testDb;
 *   beforeEach(async () => { testDb = await createTestDb(); });
 *   afterEach(() => closeTestDb(testDb));
 */
// test/testDbHelper.js
import { STORES } from '../src/shared/db/core/storeCreation.js';
// Schema mirrors storeCreation.js — all 17 stores with their keyPaths and indexes.

let dbCounter = 0;

/**
 * Opens a fresh fake-indexeddb database with the full CodeMaster schema.
 * Each call creates a uniquely-named DB so tests don't share state.
 *
 * @returns {Promise<{ db: IDBDatabase, mockDbHelper: object }>}
 *   db          — the raw IDBDatabase (for direct assertions)
 *   mockDbHelper — drop-in replacement for dbHelper with a real openDB()
 */
export async function createTestDb() {
  dbCounter++;
  const dbName = `CodeMaster_jest_${dbCounter}_${Date.now()}`;

  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      for (const storeDef of STORES) {
        if (!database.objectStoreNames.contains(storeDef.name)) {
          const store = database.createObjectStore(storeDef.name, storeDef.options);
          for (const idx of storeDef.indexes) {
            const [indexName, keyPath, opts] = idx;
            store.createIndex(indexName, keyPath, opts || { unique: false });
          }
        }
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });

  const mockDbHelper = {
    dbName,
    version: 1,
    db,
    openDB: jest.fn(() => Promise.resolve(db)),
    getStore: jest.fn(async (storeName, mode = 'readonly') => {
      return db.transaction(storeName, mode).objectStore(storeName);
    }),
  };

  return { db, mockDbHelper };
}

/**
 * Closes the test database and cleans up.
 */
export function closeTestDb(testDb) {
  if (testDb && testDb.db) {
    testDb.db.close();
  }
}

/**
 * Helper: insert records into a store and wait for completion.
 */
export function seedStore(db, storeName, records) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    for (const record of records) {
      store.put(record);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Helper: read all records from a store.
 */
export function readAll(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
