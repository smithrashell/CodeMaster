/**
 * Real IndexedDB tests for standard_problems.js
 *
 * Uses fake-indexeddb via testDbHelper to exercise every exported function
 * against a genuine (in-memory) IndexedDB with the full CodeMaster schema.
 */

// --- Mocks (must be declared before any imports) ---

jest.mock('../../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../index.js', () => ({
  dbHelper: { openDB: jest.fn() },
}));

// Mock the JSON data that standard_problems.js imports at module level.
// loadStandardProblems() returns this array during insertStandardProblems().
jest.mock('../../../constants/LeetCode_Tags_Combined.json', () => ([
  { id: 1, title: 'Two Sum', slug: 'two-sum', difficulty: 'Easy', tags: ['Array', 'Hash Table'] },
  { id: 2, title: 'Add Two Numbers', slug: 'add-two-numbers', difficulty: 'Medium', tags: ['Linked List'] },
  { id: 20, title: 'Valid Parentheses', slug: 'valid-parentheses', difficulty: 'Easy', tags: ['Stack'] },
]), { virtual: true });

// --- Imports ---

import { dbHelper } from '../../index.js';
import {
  getProblemFromStandardProblems,
  updateStandardProblemsFromData,
  getAllStandardProblems,
  fetchProblemById,
  insertStandardProblems,
  normalizeTagForStandardProblems,
  updateStandardProblems,
} from '../standard_problems.js';
import { createTestDb, closeTestDb, seedStore, readAll } from '../../../../../test/testDbHelper.js';

// --- Test setup ---

let testDb;

beforeEach(async () => {
  testDb = await createTestDb();
  dbHelper.openDB.mockImplementation(() => Promise.resolve(testDb.db));
});

afterEach(() => {
  closeTestDb(testDb);
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getProblemFromStandardProblems
// ---------------------------------------------------------------------------
describe('getProblemFromStandardProblems', () => {
  it('returns a problem when queried by an existing slug', async () => {
    await seedStore(testDb.db, 'standard_problems', [
      { id: 1, title: 'Two Sum', slug: 'two-sum', difficulty: 'Easy', tags: ['array'] },
    ]);

    const result = await getProblemFromStandardProblems('two-sum');

    expect(result).not.toBeNull();
    expect(result.id).toBe(1);
    expect(result.title).toBe('Two Sum');
    expect(result.slug).toBe('two-sum');
  });

  it('returns null when the slug does not exist', async () => {
    await seedStore(testDb.db, 'standard_problems', [
      { id: 1, title: 'Two Sum', slug: 'two-sum', difficulty: 'Easy', tags: ['array'] },
    ]);

    const result = await getProblemFromStandardProblems('non-existent-slug');

    expect(result).toBeNull();
  });

  it('throws when openDB returns null (db unavailable)', async () => {
    dbHelper.openDB.mockResolvedValue(null);

    await expect(getProblemFromStandardProblems('two-sum'))
      .rejects.toThrow('Failed to open IndexedDB');
  });

  it('resolves the correct problem among many records', async () => {
    await seedStore(testDb.db, 'standard_problems', [
      { id: 1, title: 'Two Sum', slug: 'two-sum', difficulty: 'Easy', tags: ['array'] },
      { id: 2, title: 'Add Two Numbers', slug: 'add-two-numbers', difficulty: 'Medium', tags: ['linked-list'] },
      { id: 20, title: 'Valid Parentheses', slug: 'valid-parentheses', difficulty: 'Easy', tags: ['stack'] },
    ]);

    const result = await getProblemFromStandardProblems('valid-parentheses');

    expect(result.id).toBe(20);
    expect(result.title).toBe('Valid Parentheses');
  });
});

// ---------------------------------------------------------------------------
// updateStandardProblemsFromData
// ---------------------------------------------------------------------------
describe('updateStandardProblemsFromData', () => {
  it('inserts all problems from the provided array and returns the count', async () => {
    const problems = [
      { id: 10, title: 'Problem A', slug: 'prob-a', difficulty: 'Easy', tags: ['array'] },
      { id: 11, title: 'Problem B', slug: 'prob-b', difficulty: 'Medium', tags: ['tree'] },
    ];

    const count = await updateStandardProblemsFromData(problems);

    expect(count).toBe(2);

    const all = await readAll(testDb.db, 'standard_problems');
    expect(all).toHaveLength(2);
  });

  it('updates existing records when called with overlapping ids', async () => {
    await seedStore(testDb.db, 'standard_problems', [
      { id: 10, title: 'Original Title', slug: 'prob-a', difficulty: 'Easy', tags: ['array'] },
    ]);

    const updated = [
      { id: 10, title: 'Updated Title', slug: 'prob-a', difficulty: 'Hard', tags: ['array', 'dp'] },
    ];

    const count = await updateStandardProblemsFromData(updated);
    expect(count).toBe(1);

    const all = await readAll(testDb.db, 'standard_problems');
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe('Updated Title');
    expect(all[0].difficulty).toBe('Hard');
  });

  it('throws when given a non-array argument', async () => {
    await expect(updateStandardProblemsFromData('not an array'))
      .rejects.toThrow('Invalid data: expected an array');
  });

  it('throws when given null', async () => {
    await expect(updateStandardProblemsFromData(null))
      .rejects.toThrow('Invalid data: expected an array');
  });

  it('returns 0 when given an empty array', async () => {
    const count = await updateStandardProblemsFromData([]);
    expect(count).toBe(0);
  });

  it('throws when openDB returns null', async () => {
    dbHelper.openDB.mockResolvedValue(null);

    await expect(updateStandardProblemsFromData([{ id: 1 }]))
      .rejects.toThrow('Failed to open IndexedDB');
  });
});

// ---------------------------------------------------------------------------
// getAllStandardProblems
// ---------------------------------------------------------------------------
describe('getAllStandardProblems', () => {
  it('returns all stored standard problems', async () => {
    await seedStore(testDb.db, 'standard_problems', [
      { id: 1, title: 'Two Sum', slug: 'two-sum', difficulty: 'Easy', tags: ['array'] },
      { id: 2, title: 'Add Two Numbers', slug: 'add-two-numbers', difficulty: 'Medium', tags: ['linked-list'] },
    ]);

    const results = await getAllStandardProblems();

    expect(results).toHaveLength(2);
    expect(results.map(p => p.id).sort()).toEqual([1, 2]);
  });

  it('returns an empty array when the store is empty', async () => {
    const results = await getAllStandardProblems();
    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// fetchProblemById
// ---------------------------------------------------------------------------
describe('fetchProblemById', () => {
  it('returns a problem when queried by its primary key (id)', async () => {
    await seedStore(testDb.db, 'standard_problems', [
      { id: 42, title: 'Trapping Rain Water', slug: 'trapping-rain-water', difficulty: 'Hard', tags: ['stack', 'two-pointers'] },
    ]);

    const result = await fetchProblemById(42);

    expect(result).not.toBeNull();
    expect(result.title).toBe('Trapping Rain Water');
  });

  it('returns null when the id does not exist', async () => {
    await seedStore(testDb.db, 'standard_problems', [
      { id: 1, title: 'Two Sum', slug: 'two-sum', difficulty: 'Easy', tags: ['array'] },
    ]);

    const result = await fetchProblemById(9999);

    expect(result).toBeNull();
  });

  it('returns null when openDB fails', async () => {
    dbHelper.openDB.mockRejectedValue(new Error('DB crash'));

    const result = await fetchProblemById(1);

    // The catch block returns null on error
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// insertStandardProblems
// ---------------------------------------------------------------------------
describe('insertStandardProblems', () => {
  it('seeds the store with data from the JSON constant when store is empty', async () => {
    await insertStandardProblems(testDb.db);

    const all = await readAll(testDb.db, 'standard_problems');
    // The mocked JSON has 3 problems
    expect(all).toHaveLength(3);
    expect(all.map(p => p.id).sort()).toEqual([1, 2, 20]);
  });

  it('skips seeding when the store already has data', async () => {
    await seedStore(testDb.db, 'standard_problems', [
      { id: 100, title: 'Existing Problem', slug: 'existing', difficulty: 'Easy', tags: ['graph'] },
    ]);

    await insertStandardProblems(testDb.db);

    const all = await readAll(testDb.db, 'standard_problems');
    // Should still be 1, not 3+1
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(100);
  });

  it('uses openDB when no db argument is passed', async () => {
    await insertStandardProblems();

    expect(dbHelper.openDB).toHaveBeenCalled();

    const all = await readAll(testDb.db, 'standard_problems');
    expect(all).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// normalizeTagForStandardProblems
// ---------------------------------------------------------------------------
describe('normalizeTagForStandardProblems', () => {
  it('lowercases and trims all tags on every problem in the store', async () => {
    await seedStore(testDb.db, 'standard_problems', [
      { id: 1, title: 'Two Sum', slug: 'two-sum', difficulty: 'Easy', tags: ['  Array  ', 'Hash Table'] },
      { id: 2, title: 'Add Two Numbers', slug: 'add-two-numbers', difficulty: 'Medium', tags: [' Linked List '] },
    ]);

    await normalizeTagForStandardProblems();

    const all = await readAll(testDb.db, 'standard_problems');
    const p1 = all.find(p => p.id === 1);
    const p2 = all.find(p => p.id === 2);

    expect(p1.tags).toEqual(['array', 'hash table']);
    expect(p2.tags).toEqual(['linked list']);
  });

  it('does nothing when the store is empty', async () => {
    // Should not throw
    await normalizeTagForStandardProblems();

    const all = await readAll(testDb.db, 'standard_problems');
    expect(all).toEqual([]);
  });

  it('handles tags that are already lowercase and trimmed', async () => {
    await seedStore(testDb.db, 'standard_problems', [
      { id: 5, title: 'Test', slug: 'test', difficulty: 'Easy', tags: ['array', 'dp'] },
    ]);

    await normalizeTagForStandardProblems();

    const all = await readAll(testDb.db, 'standard_problems');
    expect(all[0].tags).toEqual(['array', 'dp']);
  });
});

// ---------------------------------------------------------------------------
// updateStandardProblems (from response object)
// ---------------------------------------------------------------------------
describe('updateStandardProblems', () => {
  it('updates the store using data fetched from the response-like object', async () => {
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue([
        { id: 50, title: 'New Problem', slug: 'new-problem', difficulty: 'Hard', tags: ['dp'] },
        { id: 51, title: 'Another One', slug: 'another-one', difficulty: 'Medium', tags: ['greedy'] },
      ]),
    };

    const count = await updateStandardProblems(mockResponse);

    expect(count).toBe(2);

    const all = await readAll(testDb.db, 'standard_problems');
    expect(all).toHaveLength(2);
    expect(all.map(p => p.id).sort()).toEqual([50, 51]);
  });

  it('throws when the response is not ok', async () => {
    const mockResponse = {
      ok: false,
    };

    await expect(updateStandardProblems(mockResponse))
      .rejects.toThrow('Failed to fetch JSON file');
  });

  it('throws when openDB returns null', async () => {
    dbHelper.openDB.mockResolvedValue(null);

    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue([{ id: 1 }]),
    };

    await expect(updateStandardProblems(mockResponse))
      .rejects.toThrow('Failed to open IndexedDB');
  });
});

// ---------------------------------------------------------------------------
// Integration: insert then query
// ---------------------------------------------------------------------------
describe('integration: insert then query', () => {
  it('can insert standard problems then retrieve one by slug', async () => {
    await insertStandardProblems(testDb.db);

    const result = await getProblemFromStandardProblems('add-two-numbers');

    expect(result).not.toBeNull();
    expect(result.id).toBe(2);
    expect(result.title).toBe('Add Two Numbers');
    expect(result.difficulty).toBe('Medium');
  });

  it('can insert standard problems then retrieve one by id', async () => {
    await insertStandardProblems(testDb.db);

    const result = await fetchProblemById(20);

    expect(result).not.toBeNull();
    expect(result.slug).toBe('valid-parentheses');
  });

  it('can insert, normalize, then verify normalized tags', async () => {
    await insertStandardProblems(testDb.db);

    // Before normalization, the mocked JSON has mixed-case tags
    let problem = await fetchProblemById(1);
    expect(problem.tags).toEqual(['Array', 'Hash Table']);

    await normalizeTagForStandardProblems();

    // After normalization, tags should be lowercase and trimmed
    problem = await fetchProblemById(1);
    expect(problem.tags).toEqual(['array', 'hash table']);
  });

  it('updateStandardProblemsFromData adds new and updates existing simultaneously', async () => {
    await seedStore(testDb.db, 'standard_problems', [
      { id: 1, title: 'Old Title', slug: 'two-sum', difficulty: 'Easy', tags: ['array'] },
    ]);

    const problems = [
      { id: 1, title: 'New Title', slug: 'two-sum', difficulty: 'Easy', tags: ['array', 'hash-table'] },
      { id: 99, title: 'Brand New', slug: 'brand-new', difficulty: 'Hard', tags: ['dp'] },
    ];

    const count = await updateStandardProblemsFromData(problems);
    expect(count).toBe(2);

    const all = await readAll(testDb.db, 'standard_problems');
    expect(all).toHaveLength(2);

    const updated = all.find(p => p.id === 1);
    expect(updated.title).toBe('New Title');
    expect(updated.tags).toEqual(['array', 'hash-table']);

    const brandNew = all.find(p => p.id === 99);
    expect(brandNew.title).toBe('Brand New');
  });
});
