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

// Schema mirrors storeCreation.js — all 17 stores with their keyPaths and indexes.
const STORES = [
  {
    name: 'attempts',
    options: { keyPath: 'id' },
    indexes: [
      ['by_attempt_date', 'attempt_date'],
      ['by_problem_and_date', ['problem_id', 'attempt_date']],
      ['by_problem_id', 'problem_id'],
      ['by_session_id', 'session_id'],
      ['by_leetcode_id', 'leetcode_id'],
      ['by_time_spent', 'time_spent'],
      ['by_success', 'success'],
    ],
  },
  {
    name: 'problems',
    options: { keyPath: 'problem_id' },
    indexes: [
      ['by_tags', 'tags', { multiEntry: true }],
      ['by_title', 'title'],
      ['by_box_level', 'box_level'],
      ['by_review_schedule', 'review_schedule'],
      ['by_session_id', 'session_id'],
      ['by_leetcode_id', 'leetcode_id'],
      ['by_cooldown_status', 'cooldown_status'],
    ],
  },
  {
    name: 'sessions',
    options: { keyPath: 'id', autoIncrement: false },
    indexes: [
      ['by_date', 'date'],
      ['by_session_type', 'session_type'],
      ['by_session_type_status', ['session_type', 'status']],
      ['by_last_activity_time', 'last_activity_time'],
    ],
  },
  {
    name: 'settings',
    options: { keyPath: 'id' },
    indexes: [],
  },
  {
    name: 'tag_mastery',
    options: { keyPath: 'tag' },
    indexes: [['by_tag', 'tag']],
  },
  {
    name: 'standard_problems',
    options: { keyPath: 'id' },
    indexes: [['by_slug', 'slug']],
  },
  {
    name: 'strategy_data',
    options: { keyPath: 'tag' },
    indexes: [
      ['by_tag', 'tag'],
      ['by_patterns', 'patterns', { multiEntry: true }],
      ['by_related', 'related', { multiEntry: true }],
    ],
  },
  {
    name: 'tag_relationships',
    options: { keyPath: 'id' },
    indexes: [['by_classification', 'classification']],
  },
  {
    name: 'problem_relationships',
    options: { keyPath: 'id', autoIncrement: true },
    indexes: [
      ['by_problem_id1', 'problem_id1'],
      ['by_problem_id2', 'problem_id2'],
    ],
  },
  {
    name: 'pattern_ladders',
    options: { keyPath: 'tag' },
    indexes: [['by_tag', 'tag']],
  },
  {
    name: 'session_analytics',
    options: { keyPath: 'session_id' },
    indexes: [
      ['by_date', 'completed_at'],
      ['by_accuracy', 'accuracy'],
      ['by_difficulty', 'predominant_difficulty'],
    ],
  },
  {
    name: 'hint_interactions',
    options: { keyPath: 'id', autoIncrement: true },
    indexes: [
      ['by_problem_id', 'problem_id'],
      ['by_session_id', 'session_id'],
      ['by_timestamp', 'timestamp'],
      ['by_hint_type', 'hint_type'],
      ['by_user_action', 'user_action'],
      ['by_difficulty', 'problem_difficulty'],
      ['by_box_level', 'box_level'],
      ['by_problem_and_action', ['problem_id', 'user_action']],
      ['by_hint_type_and_difficulty', ['hint_type', 'problem_difficulty']],
    ],
  },
  {
    name: 'user_actions',
    options: { keyPath: 'id', autoIncrement: true },
    indexes: [
      ['by_timestamp', 'timestamp'],
      ['by_category', 'category'],
      ['by_action', 'action'],
      ['by_session', 'session_id'],
      ['by_user_agent', 'user_agent'],
      ['by_url', 'url'],
    ],
  },
  {
    name: 'error_reports',
    options: { keyPath: 'id', autoIncrement: true },
    indexes: [
      ['by_timestamp', 'timestamp'],
      ['by_section', 'section'],
      ['by_error_type', 'error_type'],
      ['by_user_agent', 'user_agent'],
    ],
  },
  {
    name: 'limits',
    options: { keyPath: 'id', autoIncrement: true },
    indexes: [['by_create_at', 'create_at']],
  },
  {
    name: 'session_state',
    options: { keyPath: 'id' },
    indexes: [],
  },
  {
    name: 'backup_storage',
    options: { keyPath: 'backupId' },
    indexes: [['by_backupId', 'backupId']],
  },
];

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
