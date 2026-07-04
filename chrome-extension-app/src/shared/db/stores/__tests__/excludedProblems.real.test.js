/**
 * Real IndexedDB tests for excludedProblems.js
 *
 * Uses fake-indexeddb via testDbHelper to exercise the exported functions
 * against a genuine (in-memory) IndexedDB with the excluded_problems store.
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

// --- Imports ---

import { dbHelper } from '../../index.js';
import { excludeProblem, isExcluded, getExcludedIds } from '../excludedProblems.js';
import { createTestDb, closeTestDb, readAll } from '../../../../../test/testDbHelper.js';

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
// excludeProblem
// ---------------------------------------------------------------------------
describe('excludeProblem', () => {
  it('stores a record with leetcode_id, excluded_at, and reason', async () => {
    await excludeProblem(42, 'not_relevant');

    const all = await readAll(testDb.db, 'excluded_problems');
    expect(all).toHaveLength(1);
    expect(all[0].leetcode_id).toBe(42);
    expect(all[0].reason).toBe('not_relevant');
    expect(typeof all[0].excluded_at).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// isExcluded
// ---------------------------------------------------------------------------
describe('isExcluded', () => {
  it('returns true for an excluded problem ID', async () => {
    await excludeProblem(100, 'not_relevant');

    const result = await isExcluded(100);
    expect(result).toBe(true);
  });

  it('returns false for a non-excluded problem ID', async () => {
    const result = await isExcluded(999);
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getExcludedIds
// ---------------------------------------------------------------------------
describe('getExcludedIds', () => {
  it('returns a Set containing all excluded IDs', async () => {
    await excludeProblem(1, 'not_relevant');
    await excludeProblem(2, 'not_relevant');
    await excludeProblem(3, 'not_relevant');

    const ids = await getExcludedIds();
    expect(ids).toBeInstanceOf(Set);
    expect(ids.size).toBe(3);
    expect(ids.has(1)).toBe(true);
    expect(ids.has(2)).toBe(true);
    expect(ids.has(3)).toBe(true);
  });

  it('returns an empty Set when no problems are excluded', async () => {
    const ids = await getExcludedIds();
    expect(ids).toBeInstanceOf(Set);
    expect(ids.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// upsert behavior
// ---------------------------------------------------------------------------
describe('excludeProblem upsert', () => {
  it('calling twice with the same ID does not create duplicates', async () => {
    await excludeProblem(55, 'not_relevant');
    await excludeProblem(55, 'not_relevant');

    const ids = await getExcludedIds();
    expect(ids.size).toBe(1);
    expect(ids.has(55)).toBe(true);
  });
});
