/**
 * Smoke test: verify testDbHelper creates a working fake-indexeddb
 * with the full schema and that store operations work.
 */
import { createTestDb, closeTestDb, seedStore, readAll } from './testDbHelper.js';

describe('testDbHelper smoke test', () => {
  let testDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(() => {
    closeTestDb(testDb);
  });

  it('creates a database with all 17 stores', () => {
    const storeNames = Array.from(testDb.db.objectStoreNames);
    expect(storeNames).toContain('problems');
    expect(storeNames).toContain('sessions');
    expect(storeNames).toContain('attempts');
    expect(storeNames).toContain('tag_mastery');
    expect(storeNames).toContain('standard_problems');
    expect(storeNames).toContain('problem_relationships');
    expect(storeNames).toContain('settings');
    expect(storeNames).toContain('session_analytics');
    expect(storeNames.length).toBe(17);
  });

  it('mockDbHelper.openDB() returns the same db', async () => {
    const db = await testDb.mockDbHelper.openDB();
    expect(db).toBe(testDb.db);
  });

  it('can write and read from problems store', async () => {
    await seedStore(testDb.db, 'problems', [
      { problem_id: 'p1', title: 'two sum', box_level: 1, tags: ['array'], leetcode_id: 1 },
      { problem_id: 'p2', title: 'add two numbers', box_level: 2, tags: ['linked-list'], leetcode_id: 2 },
    ]);

    const all = await readAll(testDb.db, 'problems');
    expect(all).toHaveLength(2);
    expect(all[0].title).toBe('two sum');
  });

  it('can write and read from tag_mastery store', async () => {
    await seedStore(testDb.db, 'tag_mastery', [
      { tag: 'array', mastery_level: 3, problems_solved: 10 },
    ]);

    const all = await readAll(testDb.db, 'tag_mastery');
    expect(all).toHaveLength(1);
    expect(all[0].tag).toBe('array');
  });

  it('can write and read from sessions store', async () => {
    await seedStore(testDb.db, 'sessions', [
      { id: 's1', date: '2024-01-01', session_type: 'standard', status: 'completed' },
    ]);

    const all = await readAll(testDb.db, 'sessions');
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('s1');
  });

  it('indexes work for querying', async () => {
    await seedStore(testDb.db, 'problems', [
      { problem_id: 'p1', title: 'two sum', box_level: 1, tags: ['array'], leetcode_id: 1 },
      { problem_id: 'p2', title: 'valid parentheses', box_level: 3, tags: ['stack'], leetcode_id: 20 },
    ]);

    // Query by index
    const result = await new Promise((resolve, reject) => {
      const tx = testDb.db.transaction('problems', 'readonly');
      const store = tx.objectStore('problems');
      const index = store.index('by_leetcode_id');
      const request = index.get(20);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    expect(result.title).toBe('valid parentheses');
  });
});
