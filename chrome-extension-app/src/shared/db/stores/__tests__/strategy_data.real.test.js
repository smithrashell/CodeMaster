/**
 * Real fake-indexeddb tests for strategy_data.js
 *
 * Uses a real in-memory IndexedDB (via fake-indexeddb) so that DB-accessing
 * functions exercise actual IndexedDB transactions.
 */

// -- Mocks (before imports) --------------------------------------------------

jest.mock('../../index.js', () => ({
  dbHelper: { openDB: jest.fn() },
}));

jest.mock('../../../constants/strategy_data.json', () => [
  {
    tag: 'array',
    overview: 'Array overview',
    patterns: ['greedy', 'sorting'],
    related: ['hash table', 'two pointers'],
    strategy: 'Use index-based traversal.',
  },
  {
    tag: 'hash table',
    overview: 'Hash table overview',
    patterns: ['counting'],
    related: ['array'],
    strategy: 'Use hash maps for O(1) lookups.',
  },
]);

// -- Imports -----------------------------------------------------------------

import { dbHelper } from '../../index.js';
import {
  createTestDb,
  closeTestDb,
  seedStore,
  readAll,
} from '../../../../../test/testDbHelper.js';

import {
  getStrategyForTag,
  getAllStrategies,
  isStrategyDataLoaded,
  insertStrategyData,
  getAllStrategyTags,
} from '../strategy_data.js';

// -- Lifecycle ---------------------------------------------------------------

let testDb;

beforeEach(async () => {
  testDb = await createTestDb();
  dbHelper.openDB.mockImplementation(() => Promise.resolve(testDb.db));
});

afterEach(() => {
  closeTestDb(testDb);
});

// -- getStrategyForTag (pure, no DB) -----------------------------------------

describe('getStrategyForTag', () => {
  it('returns strategy data for a known tag (case-insensitive)', () => {
    const result = getStrategyForTag('Array');
    expect(result).toBeDefined();
    expect(result.tag).toBe('array');
    expect(result.overview).toBe('Array overview');
  });

  it('returns strategy data for lowercase input', () => {
    const result = getStrategyForTag('hash table');
    expect(result).toBeDefined();
    expect(result.tag).toBe('hash table');
  });

  it('returns null for an unknown tag', () => {
    const result = getStrategyForTag('nonexistent');
    expect(result).toBeNull();
  });

  it('is case-insensitive for lookups', () => {
    const result = getStrategyForTag('ARRAY');
    expect(result).toBeDefined();
    expect(result.tag).toBe('array');
  });
});

// -- getAllStrategies (real DB) -----------------------------------------------

describe('getAllStrategies', () => {
  it('returns all strategy records from the database', async () => {
    await seedStore(testDb.db, 'strategy_data', [
      { tag: 'array', overview: 'Array overview' },
      { tag: 'dp', overview: 'DP overview' },
    ]);

    const result = await getAllStrategies();

    expect(result).toHaveLength(2);
    expect(result.map(s => s.tag).sort()).toEqual(['array', 'dp']);
  });

  it('returns empty array when no strategies exist', async () => {
    const result = await getAllStrategies();
    expect(result).toEqual([]);
  });

  it('returns empty array when openDB throws', async () => {
    dbHelper.openDB.mockRejectedValueOnce(new Error('DB unavailable'));

    const result = await getAllStrategies();
    expect(result).toEqual([]);
  });
});

// -- isStrategyDataLoaded (real DB) ------------------------------------------

describe('isStrategyDataLoaded', () => {
  it('returns true when strategy data exists in the database', async () => {
    await seedStore(testDb.db, 'strategy_data', [
      { tag: 'array', overview: 'Array overview' },
    ]);

    const result = await isStrategyDataLoaded();
    expect(result).toBe(true);
  });

  it('returns false when strategy_data store is empty', async () => {
    const result = await isStrategyDataLoaded();
    expect(result).toBe(false);
  });

  it('returns false when openDB throws', async () => {
    dbHelper.openDB.mockRejectedValueOnce(new Error('DB unavailable'));

    const result = await isStrategyDataLoaded();
    expect(result).toBe(false);
  });

  it('returns false when openDB returns null', async () => {
    dbHelper.openDB.mockResolvedValueOnce(null);

    const result = await isStrategyDataLoaded();
    expect(result).toBe(false);
  });
});

// -- insertStrategyData (real DB) --------------------------------------------

describe('insertStrategyData', () => {
  it('inserts all strategy entries when store is empty', async () => {
    const count = await insertStrategyData();

    expect(count).toBe(2); // Two entries in mocked strategy_data.json

    const all = await readAll(testDb.db, 'strategy_data');
    expect(all).toHaveLength(2);
    expect(all.map(s => s.tag).sort()).toEqual(['array', 'hash table']);
  });

  it('skips insertion when data already exists and returns existing count', async () => {
    await seedStore(testDb.db, 'strategy_data', [
      { tag: 'array', overview: 'Existing' },
    ]);

    const count = await insertStrategyData();

    expect(count).toBe(1); // Returns existing count, not inserted count

    // Should still only have the original record
    const all = await readAll(testDb.db, 'strategy_data');
    expect(all).toHaveLength(1);
    expect(all[0].overview).toBe('Existing');
  });

  it('throws when openDB fails', async () => {
    dbHelper.openDB.mockRejectedValueOnce(new Error('DB unavailable'));

    await expect(insertStrategyData()).rejects.toThrow('DB unavailable');
  });
});

// -- getAllStrategyTags (real DB) ---------------------------------------------

describe('getAllStrategyTags', () => {
  it('returns all tag names from the database', async () => {
    await seedStore(testDb.db, 'strategy_data', [
      { tag: 'array', overview: 'Array overview' },
      { tag: 'dp', overview: 'DP overview' },
      { tag: 'graph', overview: 'Graph overview' },
    ]);

    const tags = await getAllStrategyTags();

    expect(tags).toHaveLength(3);
    expect(tags.sort()).toEqual(['array', 'dp', 'graph']);
  });

  it('returns empty array when no strategies exist', async () => {
    const tags = await getAllStrategyTags();
    expect(tags).toEqual([]);
  });

  it('returns empty array when openDB throws', async () => {
    dbHelper.openDB.mockRejectedValueOnce(new Error('DB unavailable'));

    const tags = await getAllStrategyTags();
    expect(tags).toEqual([]);
  });
});
