/**
 * Comprehensive real-DB tests for problemsUpdate.js
 *
 * Uses fake-indexeddb (via testDbHelper) so that real IndexedDB transactions,
 * cursors, and index lookups execute against an in-memory database.
 *
 * Covers:
 *   - getProblemSequenceScore (relationship-based scoring with tag filtering)
 *   - addStabilityToProblems (batch stability calculation from attempts)
 *   - updateStabilityFSRS (pure function: correct/incorrect + time decay)
 *   - updateProblemsWithRating (difficulty from standard_problems)
 *   - updateProblemWithTags (tags from standard_problems)
 *   - fixCorruptedDifficultyFields (cursor-based iteration)
 */

// ---- mocks MUST come before any import that touches them ----

jest.mock('../../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    group: jest.fn(),
    groupEnd: jest.fn(),
  },
}));

jest.mock('../../index.js', () => ({
  dbHelper: { openDB: jest.fn() },
}));

jest.mock('../standard_problems.js', () => ({
  getAllStandardProblems: jest.fn().mockResolvedValue([]),
  fetchProblemById: jest.fn().mockResolvedValue(null),
}));

// ---- imports ----

import { createTestDb, closeTestDb, seedStore, readAll } from '../../../../../test/testDbHelper.js';
import { dbHelper } from '../../index.js';
import { getAllStandardProblems, fetchProblemById } from '../standard_problems.js';

import {
  getProblemSequenceScore,
  addStabilityToProblems,
  updateStabilityFSRS,
  updateProblemsWithRating,
  updateProblemWithTags,
  fixCorruptedDifficultyFields,
} from '../problemsUpdate.js';

// ---- helpers ----

function makeProblem(overrides = {}) {
  return {
    problem_id: overrides.problem_id || `p-${Math.random().toString(36).slice(2, 8)}`,
    leetcode_id: overrides.leetcode_id ?? 1,
    title: overrides.title || 'two sum',
    box_level: overrides.box_level ?? 1,
    stability: overrides.stability ?? 1.0,
    ...overrides,
  };
}

// ---- test setup ----

let testDb;

beforeEach(async () => {
  testDb = await createTestDb();
  dbHelper.openDB.mockImplementation(() => Promise.resolve(testDb.db));
});

afterEach(() => {
  closeTestDb(testDb);
  jest.clearAllMocks();
});

// =========================================================================
// updateStabilityFSRS (pure function)
// =========================================================================

describe('updateStabilityFSRS', () => {
  it('increases stability on correct answer: stability * 1.2 + 0.5', () => {
    const result = updateStabilityFSRS(1.0, true);
    expect(result).toBe(1.7);
  });

  it('decreases stability on incorrect answer: stability * 0.7', () => {
    const result = updateStabilityFSRS(1.0, false);
    expect(result).toBe(0.7);
  });

  it('handles zero stability correctly', () => {
    const correct = updateStabilityFSRS(0, true);
    expect(correct).toBe(0.5); // 0 * 1.2 + 0.5

    const incorrect = updateStabilityFSRS(0, false);
    expect(incorrect).toBe(0); // 0 * 0.7
  });

  it('handles high stability values', () => {
    const result = updateStabilityFSRS(100.0, true);
    expect(result).toBe(120.5); // 100 * 1.2 + 0.5
  });

  it('does not apply forgetting factor when lastAttemptDate is null', () => {
    const result = updateStabilityFSRS(2.0, false, null);
    expect(result).toBe(1.4); // 2.0 * 0.7
  });

  it('does not apply forgetting factor when lastAttemptDate is within 30 days', () => {
    const recentDate = new Date().toISOString();
    const result = updateStabilityFSRS(1.0, true, recentDate);
    expect(result).toBe(1.7);
  });

  it('applies forgetting factor when lastAttemptDate is > 30 days ago', () => {
    const daysAgo = 60;
    const pastDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
    const rawStability = 1.0 * 1.2 + 0.5;
    const forgettingFactor = Math.exp(-daysAgo / 90);
    const expected = parseFloat((rawStability * forgettingFactor).toFixed(2));

    const result = updateStabilityFSRS(1.0, true, pastDate);
    expect(result).toBe(expected);
  });

  it('applies stronger decay for longer time gaps', () => {
    const date60 = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const date180 = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();

    const r60 = updateStabilityFSRS(2.0, true, date60);
    const r180 = updateStabilityFSRS(2.0, true, date180);
    expect(r180).toBeLessThan(r60);
  });

  it('handles invalid date string gracefully (no extra decay)', () => {
    const result = updateStabilityFSRS(1.0, true, 'garbage');
    // Invalid date -> NaN in daysSinceLastAttempt -> condition false -> no decay
    expect(result).toBe(1.7);
  });

  it('returns a number rounded to 2 decimal places', () => {
    const result = updateStabilityFSRS(3.33333, true);
    const str = result.toString();
    const decimals = str.includes('.') ? str.split('.')[1].length : 0;
    expect(decimals).toBeLessThanOrEqual(2);
  });
});

// =========================================================================
// addStabilityToProblems
// =========================================================================

describe('addStabilityToProblems', () => {
  it('resolves with no problems in the store', async () => {
    await expect(addStabilityToProblems()).resolves.toBeUndefined();
  });

  it('calculates stability from attempts for each problem', async () => {
    const prob = makeProblem({ problem_id: 'stab-1', stability: 1.0 });
    await seedStore(testDb.db, 'problems', [prob]);

    await seedStore(testDb.db, 'attempts', [
      { id: 'a1', problem_id: 'stab-1', success: true, attempt_date: '2025-01-01' },
      { id: 'a2', problem_id: 'stab-1', success: false, attempt_date: '2025-01-02' },
    ]);

    await addStabilityToProblems();

    const all = await readAll(testDb.db, 'problems');
    // After correct (1.0 * 1.2 + 0.5 = 1.7) then wrong (1.7 * 0.7 = 1.19)
    expect(all[0].stability).toBe(1.19);
  });

  it('leaves stability at 1.0 when no attempts exist for a problem', async () => {
    const prob = makeProblem({ problem_id: 'stab-no-att', stability: 1.0 });
    await seedStore(testDb.db, 'problems', [prob]);

    await addStabilityToProblems();

    const all = await readAll(testDb.db, 'problems');
    expect(all[0].stability).toBe(1.0);
  });

  it('handles multiple problems each with their own attempts', async () => {
    // The function uses problem.id (not problem_id) to query the attempts index.
    // We must set the id field on the problem objects to match attempt problem_id.
    const p1 = makeProblem({ problem_id: 'multi-p1', stability: 1.0 });
    p1.id = 'multi-p1';
    const p2 = makeProblem({ problem_id: 'multi-p2', stability: 1.0 });
    p2.id = 'multi-p2';
    await seedStore(testDb.db, 'problems', [p1, p2]);

    await seedStore(testDb.db, 'attempts', [
      { id: 'a1', problem_id: 'multi-p1', success: true, attempt_date: '2025-01-01' },
      { id: 'a2', problem_id: 'multi-p2', success: false, attempt_date: '2025-01-01' },
      { id: 'a3', problem_id: 'multi-p2', success: false, attempt_date: '2025-01-02' },
    ]);

    await addStabilityToProblems();

    const all = await readAll(testDb.db, 'problems');
    const byId = Object.fromEntries(all.map(p => [p.problem_id, p]));
    // p1: correct => 1.0 * 1.2 + 0.5 = 1.7
    expect(byId['multi-p1'].stability).toBe(1.7);
    // p2: wrong => 1.0 * 0.7 = 0.7, then wrong again => 0.7 * 0.7 = 0.49
    expect(byId['multi-p2'].stability).toBe(0.49);
  });

  it('sorts attempts by date before computing stability', async () => {
    const prob = makeProblem({ problem_id: 'sort-test', stability: 1.0 });
    await seedStore(testDb.db, 'problems', [prob]);

    // Seed out of order
    await seedStore(testDb.db, 'attempts', [
      { id: 'a2', problem_id: 'sort-test', success: false, attempt_date: '2025-02-01' },
      { id: 'a1', problem_id: 'sort-test', success: true, attempt_date: '2025-01-01' },
    ]);

    await addStabilityToProblems();

    const all = await readAll(testDb.db, 'problems');
    // Sorted: correct first (1.7), then wrong (1.7 * 0.7 = 1.19)
    expect(all[0].stability).toBe(1.19);
  });
});

// =========================================================================
// updateProblemsWithRating
// =========================================================================

describe('updateProblemsWithRating', () => {
  it('updates problems with difficulty from standard_problems', async () => {
    getAllStandardProblems.mockResolvedValueOnce([
      { id: 10, difficulty: 'Easy' },
      { id: 20, difficulty: 'Hard' },
    ]);

    await seedStore(testDb.db, 'problems', [
      makeProblem({ problem_id: 'rp-1', leetcode_id: 10 }),
      makeProblem({ problem_id: 'rp-2', leetcode_id: 20 }),
      makeProblem({ problem_id: 'rp-3', leetcode_id: 99 }), // no match
    ]);

    await updateProblemsWithRating();
    // Wait for async getAll + transaction to complete
    await new Promise(resolve => setTimeout(resolve, 50));

    const all = await readAll(testDb.db, 'problems');
    const byId = Object.fromEntries(all.map(p => [p.problem_id, p]));
    expect(byId['rp-1'].Rating).toBe('Easy');
    expect(byId['rp-2'].Rating).toBe('Hard');
    expect(byId['rp-3'].Rating).toBeUndefined();
  });

  it('handles empty standard_problems gracefully', async () => {
    getAllStandardProblems.mockResolvedValueOnce([]);

    await seedStore(testDb.db, 'problems', [
      makeProblem({ problem_id: 'rp-empty' }),
    ]);

    await updateProblemsWithRating();
    await new Promise(resolve => setTimeout(resolve, 50));

    const all = await readAll(testDb.db, 'problems');
    expect(all[0].Rating).toBeUndefined();
  });

  it('handles empty problems store gracefully', async () => {
    getAllStandardProblems.mockResolvedValueOnce([
      { id: 1, difficulty: 'Easy' },
    ]);

    await updateProblemsWithRating();
    await new Promise(resolve => setTimeout(resolve, 50));

    const all = await readAll(testDb.db, 'problems');
    expect(all).toHaveLength(0);
  });

  it('logs error when getAllStandardProblems throws', async () => {
    getAllStandardProblems.mockRejectedValueOnce(new Error('network error'));

    // Should not throw - error is caught internally
    await updateProblemsWithRating();
  });
});

// =========================================================================
// updateProblemWithTags
// =========================================================================

describe('updateProblemWithTags', () => {
  it('merges tags from standard_problems into user problems', async () => {
    getAllStandardProblems.mockResolvedValueOnce([
      { id: 50, tags: ['array', 'hash-table'] },
    ]);

    await seedStore(testDb.db, 'problems', [
      makeProblem({ problem_id: 'tag-1', leetcode_id: 50 }),
      makeProblem({ problem_id: 'tag-2', leetcode_id: 999 }),
    ]);

    await updateProblemWithTags();
    await new Promise(resolve => setTimeout(resolve, 50));

    const all = await readAll(testDb.db, 'problems');
    const byId = Object.fromEntries(all.map(p => [p.problem_id, p]));
    expect(byId['tag-1'].tags).toEqual(['array', 'hash-table']);
  });

  it('does not modify problems that have no matching standard problem', async () => {
    getAllStandardProblems.mockResolvedValueOnce([
      { id: 100, tags: ['dp'] },
    ]);

    await seedStore(testDb.db, 'problems', [
      makeProblem({ problem_id: 'tag-no-match', leetcode_id: 999 }),
    ]);

    await updateProblemWithTags();
    await new Promise(resolve => setTimeout(resolve, 50));

    const all = await readAll(testDb.db, 'problems');
    // tags should remain whatever the default was, not ['dp']
    expect(all[0].tags).not.toEqual(['dp']);
  });

  it('handles empty problems store without errors', async () => {
    getAllStandardProblems.mockResolvedValueOnce([
      { id: 1, tags: ['greedy'] },
    ]);

    await updateProblemWithTags();
    await new Promise(resolve => setTimeout(resolve, 50));

    const all = await readAll(testDb.db, 'problems');
    expect(all).toHaveLength(0);
  });

  it('updates multiple problems that match standard problems', async () => {
    getAllStandardProblems.mockResolvedValueOnce([
      { id: 1, tags: ['array'] },
      { id: 2, tags: ['string', 'dp'] },
    ]);

    await seedStore(testDb.db, 'problems', [
      makeProblem({ problem_id: 't-1', leetcode_id: 1 }),
      makeProblem({ problem_id: 't-2', leetcode_id: 2 }),
    ]);

    await updateProblemWithTags();
    await new Promise(resolve => setTimeout(resolve, 50));

    const all = await readAll(testDb.db, 'problems');
    const byId = Object.fromEntries(all.map(p => [p.problem_id, p]));
    expect(byId['t-1'].tags).toEqual(['array']);
    expect(byId['t-2'].tags).toEqual(['string', 'dp']);
  });
});

// =========================================================================
// fixCorruptedDifficultyFields
// =========================================================================

describe('fixCorruptedDifficultyFields', () => {
  it('returns 0 when store is empty', async () => {
    getAllStandardProblems.mockResolvedValueOnce([]);
    const count = await fixCorruptedDifficultyFields();
    expect(count).toBe(0);
  });

  it('iterates through all problems without error', async () => {
    getAllStandardProblems.mockResolvedValueOnce([
      { id: 1, difficulty: 'Easy' },
    ]);

    await seedStore(testDb.db, 'problems', [
      makeProblem({ problem_id: 'fix-1', leetcode_id: 1 }),
      makeProblem({ problem_id: 'fix-2', leetcode_id: 2 }),
    ]);

    const count = await fixCorruptedDifficultyFields();
    // The current implementation iterates but does not actually fix (cursor.continue only)
    expect(count).toBe(0);
  });

  it('resolves with 0 even when standard problems exist but no corruption detected', async () => {
    getAllStandardProblems.mockResolvedValueOnce([
      { id: 10, difficulty: 'Medium' },
      { id: 20, difficulty: 'Hard' },
    ]);

    await seedStore(testDb.db, 'problems', [
      makeProblem({ problem_id: 'fix-3', leetcode_id: 10 }),
    ]);

    const count = await fixCorruptedDifficultyFields();
    expect(count).toBe(0);
  });

  it('rejects when getAllStandardProblems throws', async () => {
    getAllStandardProblems.mockRejectedValueOnce(new Error('fetch failed'));

    await expect(fixCorruptedDifficultyFields()).rejects.toThrow('fetch failed');
  });
});

// =========================================================================
// getProblemSequenceScore
// =========================================================================

describe('getProblemSequenceScore', () => {
  it('returns 0 when no relationships exist for the problem', async () => {
    const score = await getProblemSequenceScore(
      'no-rel',
      new Set(['array']),
      new Set(['dp'])
    );
    expect(score).toBe(0);
  });

  it('calculates weighted score from linked problems with matching tags', async () => {
    // Seed a relationship: problem 'p1' -> 'p2' with strength 2.0
    await seedStore(testDb.db, 'problem_relationships', [
      { problem_id1: 'p1', problemId2: 'linked-1', strength: 2.0 },
    ]);

    // Seed the linked standard problem with tags
    fetchProblemById.mockResolvedValueOnce({
      id: 'linked-1',
      tags: ['array', 'hash-table'],
    });

    const unmasteredTags = new Set(['array']);
    const tierTags = new Set(['hash-table']);

    const score = await getProblemSequenceScore('p1', unmasteredTags, tierTags);
    // tagBonus = 2 (array + hash-table), tagPenalty = 0
    // totalStrength = 2.0 * (2 - 0.5 * 0) = 4.0, count = 1
    // weightedAvg = 4.0 / 1 = 4.0
    expect(score).toBe(4.0);
  });

  it('applies tag penalty for unrelated tags on linked problems', async () => {
    await seedStore(testDb.db, 'problem_relationships', [
      { problem_id1: 'p2', problemId2: 'linked-2', strength: 1.0 },
    ]);

    fetchProblemById.mockResolvedValueOnce({
      id: 'linked-2',
      tags: ['array', 'tree', 'graph'],
    });

    const unmasteredTags = new Set(['array']);
    const tierTags = new Set([]);

    const score = await getProblemSequenceScore('p2', unmasteredTags, tierTags);
    // tagBonus = 1 (array), tagPenalty = 2 (tree, graph)
    // totalStrength = 1.0 * (1 - 0.5 * 2) = 1.0 * 0 = 0.0
    expect(score).toBe(0);
  });

  it('skips linked problems that are not found by fetchProblemById', async () => {
    await seedStore(testDb.db, 'problem_relationships', [
      { problem_id1: 'p3', problemId2: 'missing-1', strength: 5.0 },
      { problem_id1: 'p3', problemId2: 'found-1', strength: 1.0 },
    ]);

    fetchProblemById
      .mockResolvedValueOnce(null) // missing-1 not found
      .mockResolvedValueOnce({ id: 'found-1', tags: ['dp'] });

    const unmasteredTags = new Set(['dp']);
    const tierTags = new Set([]);

    const score = await getProblemSequenceScore('p3', unmasteredTags, tierTags);
    // Only found-1 counted: strength=1.0 * (1 - 0) = 1.0, count=1
    expect(score).toBe(1.0);
  });

  it('averages scores across multiple relationships', async () => {
    await seedStore(testDb.db, 'problem_relationships', [
      { problem_id1: 'p4', problemId2: 'l1', strength: 2.0 },
      { problem_id1: 'p4', problemId2: 'l2', strength: 4.0 },
    ]);

    fetchProblemById
      .mockResolvedValueOnce({ id: 'l1', tags: ['dp'] })
      .mockResolvedValueOnce({ id: 'l2', tags: ['dp'] });

    const unmasteredTags = new Set(['dp']);
    const tierTags = new Set([]);

    const score = await getProblemSequenceScore('p4', unmasteredTags, tierTags);
    // l1: 2.0 * (1 - 0) = 2.0
    // l2: 4.0 * (1 - 0) = 4.0
    // avg = (2.0 + 4.0) / 2 = 3.0
    expect(score).toBe(3.0);
  });

  it('handles linked problems with empty tags array', async () => {
    await seedStore(testDb.db, 'problem_relationships', [
      { problem_id1: 'p5', problemId2: 'empty-tags', strength: 3.0 },
    ]);

    fetchProblemById.mockResolvedValueOnce({
      id: 'empty-tags',
      tags: [],
    });

    const score = await getProblemSequenceScore('p5', new Set(['dp']), new Set(['greedy']));
    // tagBonus = 0, tagPenalty = 0
    // totalStrength = 3.0 * (0 - 0) = 0
    expect(score).toBe(0);
  });

  it('handles linked problems with no tags property', async () => {
    await seedStore(testDb.db, 'problem_relationships', [
      { problem_id1: 'p6', problemId2: 'no-tags', strength: 2.0 },
    ]);

    fetchProblemById.mockResolvedValueOnce({
      id: 'no-tags',
      // no tags property
    });

    const score = await getProblemSequenceScore('p6', new Set(['dp']), new Set([]));
    // tags fallback to [] -> tagBonus = 0, tagPenalty = 0
    // totalStrength = 2.0 * (0 - 0) = 0
    expect(score).toBe(0);
  });
});

// =========================================================================
// Integration / edge cases
// =========================================================================

describe('integration and edge cases', () => {
  it('addStabilityToProblems followed by reading stability values', async () => {
    const p = makeProblem({ problem_id: 'int-1', stability: 1.0 });
    await seedStore(testDb.db, 'problems', [p]);

    await seedStore(testDb.db, 'attempts', [
      { id: 'a1', problem_id: 'int-1', success: true, attempt_date: '2025-01-01' },
      { id: 'a2', problem_id: 'int-1', success: true, attempt_date: '2025-01-02' },
      { id: 'a3', problem_id: 'int-1', success: true, attempt_date: '2025-01-03' },
    ]);

    await addStabilityToProblems();

    const all = await readAll(testDb.db, 'problems');
    // 1.0 -> correct -> 1.7 -> correct -> 2.54 -> correct -> 3.55
    expect(all[0].stability).toBe(3.55);
  });

  it('updateProblemsWithRating then updateProblemWithTags on same store', async () => {
    getAllStandardProblems
      .mockResolvedValueOnce([{ id: 5, difficulty: 'Medium' }])
      .mockResolvedValueOnce([{ id: 5, tags: ['stack', 'queue'] }]);

    await seedStore(testDb.db, 'problems', [
      makeProblem({ problem_id: 'combo-1', leetcode_id: 5 }),
    ]);

    await updateProblemsWithRating();
    await new Promise(resolve => setTimeout(resolve, 50));

    await updateProblemWithTags();
    await new Promise(resolve => setTimeout(resolve, 50));

    const all = await readAll(testDb.db, 'problems');
    expect(all[0].Rating).toBe('Medium');
    expect(all[0].tags).toEqual(['stack', 'queue']);
  });

  it('updateStabilityFSRS chain of correct then incorrect preserves precision', () => {
    let stability = 1.0;
    stability = updateStabilityFSRS(stability, true);  // 1.7
    stability = updateStabilityFSRS(stability, true);  // 2.54
    stability = updateStabilityFSRS(stability, false); // 1.78
    stability = updateStabilityFSRS(stability, true);  // 2.64
    expect(typeof stability).toBe('number');
    expect(stability).toBeGreaterThan(0);
    // Verify the chain: 1.0 -> 1.7 -> 2.54 -> 1.78 -> 2.64
    expect(stability).toBe(2.64);
  });
});
