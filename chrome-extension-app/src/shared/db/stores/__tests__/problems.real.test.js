/**
 * Comprehensive real-DB tests for problems.js
 *
 * Uses fake-indexeddb (via testDbHelper) instead of mock objects so that
 * real IndexedDB transactions, cursors, and index lookups execute.
 * This maximizes branch/line coverage on the 336-line source file.
 */

// ---- mocks MUST come before any import that touches them ----

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

jest.mock('../problemSelectionHelpers.js', () => ({
  normalizeTags: jest.fn(t => t),
  getDifficultyScore: jest.fn(() => 1),
  getSingleLadder: jest.fn(),
  filterProblemsByDifficultyCap: jest.fn(p => p),
  loadProblemSelectionContext: jest.fn().mockResolvedValue({
    enhancedFocusTags: [],
    masteryData: {},
    tagRelationshipsRaw: [],
    availableProblems: [],
  }),
  logProblemSelectionStart: jest.fn(),
  calculateTagDifficultyAllowances: jest.fn(() => ({})),
  logSelectedProblems: jest.fn(),
  selectProblemsForTag: jest.fn().mockResolvedValue([]),
  addExpansionProblems: jest.fn(),
  selectPrimaryAndExpansionProblems: jest.fn().mockResolvedValue({
    selectedProblems: [],
    usedProblemIds: new Set(),
  }),
  expandWithRemainingFocusTags: jest.fn().mockResolvedValue(undefined),
  fillRemainingWithRandomProblems: jest.fn(),
}));

jest.mock('../problemsRetryHelpers.js', () => ({
  getProblemWithRetry: jest.fn(),
  checkDatabaseForProblemWithRetry: jest.fn(),
  addProblemWithRetry: jest.fn(),
  saveUpdatedProblemWithRetry: jest.fn(),
  countProblemsByBoxLevelWithRetry: jest.fn(),
  fetchAllProblemsWithRetry: jest.fn(),
  getProblemWithOfficialDifficultyWithRetry: jest.fn(),
}));

jest.mock('../standard_problems.js', () => ({
  getAllStandardProblems: jest.fn().mockResolvedValue([]),
  fetchProblemById: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../../services/attempts/attemptsService.js', () => ({
  AttemptsService: { addAttempt: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../../../services/session/sessionService.js', () => ({
  SessionService: {
    resumeSession: jest.fn().mockResolvedValue(null),
    getOrCreateSession: jest.fn().mockResolvedValue({ id: 'mock-session' }),
  },
}));

// ---- imports ----

import { createTestDb, closeTestDb, seedStore, readAll } from '../../../../../test/testDbHelper.js';
import { dbHelper } from '../../index.js';
import { getAllStandardProblems, fetchProblemById } from '../standard_problems.js';
import { AttemptsService } from '../../../services/attempts/attemptsService.js';
import { SessionService } from '../../../services/session/sessionService.js';
import {
  loadProblemSelectionContext,
  selectPrimaryAndExpansionProblems,
  expandWithRemainingFocusTags,
  fillRemainingWithRandomProblems,
} from '../problemSelectionHelpers.js';

import {
  updateProblemsWithRatings,
  getProblem,
  fetchProblemsByIdsWithTransaction,
  saveUpdatedProblem,
  getProblemByDescription,
  addProblem,
  countProblemsByBoxLevel,
  checkDatabaseForProblem,
  fetchAllProblems,
  fetchAdditionalProblems,
  addStabilityToProblems,
  updateStabilityFSRS,
  updateProblemsWithRating,
  updateProblemWithTags,
  getProblemWithOfficialDifficulty,
  getProblemsWithHighFailures,
  fixCorruptedDifficultyFields,
} from '../problems.js';

// ---- helpers ----

function makeProblem(overrides = {}) {
  return {
    problem_id: overrides.problem_id || `p-${Math.random().toString(36).slice(2, 8)}`,
    leetcode_id: overrides.leetcode_id ?? 1,
    title: overrides.title || 'two sum',
    box_level: overrides.box_level ?? 1,
    cooldown_status: overrides.cooldown_status ?? false,
    review_schedule: overrides.review_schedule || null,
    perceived_difficulty: overrides.perceived_difficulty || null,
    consecutive_failures: overrides.consecutive_failures ?? 0,
    stability: overrides.stability ?? 1.0,
    attempt_stats: overrides.attempt_stats || {
      total_attempts: 0,
      successful_attempts: 0,
      unsuccessful_attempts: 0,
    },
    ...overrides,
  };
}

// ---- test suite ----

let testDb;

beforeEach(async () => {
  testDb = await createTestDb();
  dbHelper.openDB.mockImplementation(() => Promise.resolve(testDb.db));
});

afterEach(() => {
  closeTestDb(testDb);
});

// =========================================================================
// getProblem
// =========================================================================

describe('getProblem', () => {
  it('returns the problem when it exists', async () => {
    const p = makeProblem({ problem_id: 'abc-123', title: 'two sum' });
    await seedStore(testDb.db, 'problems', [p]);

    const result = await getProblem('abc-123');
    expect(result).not.toBeNull();
    expect(result.problem_id).toBe('abc-123');
    expect(result.title).toBe('two sum');
  });

  it('returns null when the problem does not exist', async () => {
    const result = await getProblem('nonexistent');
    expect(result).toBeNull();
  });
});

// =========================================================================
// saveUpdatedProblem
// =========================================================================

describe('saveUpdatedProblem', () => {
  it('inserts a new problem via put', async () => {
    const p = makeProblem({ problem_id: 'save-1' });
    await saveUpdatedProblem(p);

    const all = await readAll(testDb.db, 'problems');
    expect(all).toHaveLength(1);
    expect(all[0].problem_id).toBe('save-1');
  });

  it('overwrites an existing problem with the same key', async () => {
    const p = makeProblem({ problem_id: 'save-2', title: 'original' });
    await seedStore(testDb.db, 'problems', [p]);

    await saveUpdatedProblem({ ...p, title: 'updated' });

    const all = await readAll(testDb.db, 'problems');
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe('updated');
  });
});

// =========================================================================
// fetchAllProblems
// =========================================================================

describe('fetchAllProblems', () => {
  it('returns an empty array when the store is empty', async () => {
    const result = await fetchAllProblems();
    expect(result).toEqual([]);
  });

  it('returns all problems from the store', async () => {
    const problems = [
      makeProblem({ problem_id: 'fa-1', title: 'p1' }),
      makeProblem({ problem_id: 'fa-2', title: 'p2' }),
      makeProblem({ problem_id: 'fa-3', title: 'p3' }),
    ];
    await seedStore(testDb.db, 'problems', problems);

    const result = await fetchAllProblems();
    expect(result).toHaveLength(3);
  });
});

// =========================================================================
// updateProblemsWithRatings
// =========================================================================

describe('updateProblemsWithRatings', () => {
  it('returns success message on empty store', async () => {
    const msg = await updateProblemsWithRatings();
    expect(msg).toBe('Problems updated with ratings');
  });

  it('increments rating for problems that already have a rating', async () => {
    await seedStore(testDb.db, 'problems', [
      makeProblem({ problem_id: 'r-1', rating: 5 }),
    ]);

    await updateProblemsWithRatings();

    const all = await readAll(testDb.db, 'problems');
    expect(all[0].rating).toBe(6);
  });

  it('sets rating to 1 for problems without a rating', async () => {
    await seedStore(testDb.db, 'problems', [
      makeProblem({ problem_id: 'r-2' }),
    ]);

    await updateProblemsWithRatings();

    const all = await readAll(testDb.db, 'problems');
    expect(all[0].rating).toBe(1);
  });

  it('updates multiple problems in one pass', async () => {
    await seedStore(testDb.db, 'problems', [
      makeProblem({ problem_id: 'r-a', rating: 2 }),
      makeProblem({ problem_id: 'r-b', rating: 10 }),
    ]);

    await updateProblemsWithRatings();

    const all = await readAll(testDb.db, 'problems');
    const byId = Object.fromEntries(all.map(p => [p.problem_id, p]));
    expect(byId['r-a'].rating).toBe(3);
    expect(byId['r-b'].rating).toBe(11);
  });
});

// =========================================================================
// countProblemsByBoxLevel
// =========================================================================

describe('countProblemsByBoxLevel', () => {
  it('returns empty object for empty store', async () => {
    const result = await countProblemsByBoxLevel();
    expect(result).toEqual({});
  });

  it('counts problems by box_level', async () => {
    await seedStore(testDb.db, 'problems', [
      makeProblem({ problem_id: 'bl-1', box_level: 1 }),
      makeProblem({ problem_id: 'bl-2', box_level: 1 }),
      makeProblem({ problem_id: 'bl-3', box_level: 3 }),
      makeProblem({ problem_id: 'bl-4', box_level: 5 }),
    ]);

    const result = await countProblemsByBoxLevel();
    expect(result).toEqual({ 1: 2, 3: 1, 5: 1 });
  });

  it('defaults box_level to 1 when missing', async () => {
    const p = makeProblem({ problem_id: 'bl-5' });
    delete p.box_level;
    await seedStore(testDb.db, 'problems', [p]);

    const result = await countProblemsByBoxLevel();
    expect(result).toEqual({ 1: 1 });
  });
});

// =========================================================================
// checkDatabaseForProblem
// =========================================================================

describe('checkDatabaseForProblem', () => {
  it('throws for null leetcodeId', async () => {
    await expect(checkDatabaseForProblem(null)).rejects.toThrow('Invalid leetcodeId');
  });

  it('throws for undefined leetcodeId', async () => {
    await expect(checkDatabaseForProblem(undefined)).rejects.toThrow('Invalid leetcodeId');
  });

  it('throws for NaN leetcodeId', async () => {
    await expect(checkDatabaseForProblem(NaN)).rejects.toThrow('Invalid leetcodeId');
  });

  it('throws for non-numeric string', async () => {
    await expect(checkDatabaseForProblem('abc')).rejects.toThrow('Invalid leetcodeId');
  });

  it('finds a problem by leetcode_id index', async () => {
    await seedStore(testDb.db, 'problems', [
      makeProblem({ problem_id: 'chk-1', leetcode_id: 42 }),
    ]);

    const result = await checkDatabaseForProblem(42);
    expect(result).toBeDefined();
    expect(result.leetcode_id).toBe(42);
  });

  it('returns undefined when no match is found', async () => {
    const result = await checkDatabaseForProblem(999);
    expect(result).toBeUndefined();
  });

  it('converts string leetcodeId to number for lookup', async () => {
    await seedStore(testDb.db, 'problems', [
      makeProblem({ problem_id: 'chk-2', leetcode_id: 7 }),
    ]);

    const result = await checkDatabaseForProblem('7');
    expect(result).toBeDefined();
    expect(result.leetcode_id).toBe(7);
  });
});

// =========================================================================
// getProblemByDescription
// =========================================================================

describe('getProblemByDescription', () => {
  it('returns null when description is empty/falsy', async () => {
    const result = await getProblemByDescription('');
    expect(result).toBeNull();
  });

  it('returns null when description is null', async () => {
    const result = await getProblemByDescription(null);
    expect(result).toBeNull();
  });

  it('finds a problem by title index (lowercased)', async () => {
    await seedStore(testDb.db, 'problems', [
      makeProblem({ problem_id: 'desc-1', title: 'two sum' }),
    ]);

    const result = await getProblemByDescription('Two Sum');
    expect(result).toBeTruthy();
    expect(result.problem_id).toBe('desc-1');
  });

  it('returns false when no match is found', async () => {
    await seedStore(testDb.db, 'problems', [
      makeProblem({ problem_id: 'desc-2', title: 'two sum' }),
    ]);

    const result = await getProblemByDescription('Three Sum');
    expect(result).toBe(false);
  });
});

// =========================================================================
// fetchProblemsByIdsWithTransaction
// =========================================================================

describe('fetchProblemsByIdsWithTransaction', () => {
  it('returns matching standard_problems by id', async () => {
    await seedStore(testDb.db, 'standard_problems', [
      { id: 1, title: 'Two Sum', difficulty: 'Easy' },
      { id: 2, title: 'Add Two Numbers', difficulty: 'Medium' },
      { id: 3, title: 'Longest Substring', difficulty: 'Medium' },
    ]);

    const result = await fetchProblemsByIdsWithTransaction(testDb.db, [1, 3]);
    expect(result).toHaveLength(2);
    expect(result.map(p => p.id).sort()).toEqual([1, 3]);
  });

  it('filters out null results for non-existent ids', async () => {
    await seedStore(testDb.db, 'standard_problems', [
      { id: 1, title: 'Two Sum', difficulty: 'Easy' },
    ]);

    const result = await fetchProblemsByIdsWithTransaction(testDb.db, [1, 999, 888]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('returns empty array when no ids match', async () => {
    const result = await fetchProblemsByIdsWithTransaction(testDb.db, [100, 200]);
    expect(result).toEqual([]);
  });

  it('returns empty array for empty input', async () => {
    const result = await fetchProblemsByIdsWithTransaction(testDb.db, []);
    expect(result).toEqual([]);
  });
});

// =========================================================================
// addProblem
// =========================================================================

describe('addProblem', () => {
  it('adds a new problem to the store and creates an attempt', async () => {
    const problemData = {
      leetcode_id: 101,
      title: 'New Problem',
      address: 'https://leetcode.com/problems/new-problem',
      success: true,
      date: new Date().toISOString(),
      timeSpent: 300,
      difficulty: 2,
      comments: 'easy one',
      reviewSchedule: null,
    };

    await addProblem(problemData);

    // Wait for the oncomplete to fire (session + attempt creation)
    await new Promise(resolve => setTimeout(resolve, 50));

    const all = await readAll(testDb.db, 'problems');
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe('new problem'); // lowercased
    expect(all[0].leetcode_id).toBe(101);
    expect(all[0].box_level).toBe(1);
    expect(all[0].stability).toBe(1.0);
    expect(all[0].consecutive_failures).toBe(0);
  });

  it('does not create a duplicate when problem with same leetcode_id exists', async () => {
    const existing = makeProblem({ problem_id: 'existing-1', leetcode_id: 200 });
    await seedStore(testDb.db, 'problems', [existing]);

    const problemData = {
      leetcode_id: 200,
      title: 'Duplicate',
      address: 'https://leetcode.com/problems/dup',
      success: true,
      date: new Date().toISOString(),
      timeSpent: 60,
    };

    const result = await addProblem(problemData);

    const all = await readAll(testDb.db, 'problems');
    expect(all).toHaveLength(1);
    // Returns existing problem
    expect(result).toBeDefined();
  });

  it('resumes an active session when available', async () => {
    SessionService.resumeSession.mockResolvedValueOnce({ id: 'active-session' });

    const problemData = {
      leetcode_id: 301,
      title: 'Session Problem',
      address: 'https://leetcode.com/problems/sp',
      success: false,
      date: new Date().toISOString(),
      timeSpent: 120,
    };

    await addProblem(problemData);
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(SessionService.resumeSession).toHaveBeenCalled();
  });

  it('creates a new session when no active session exists', async () => {
    SessionService.resumeSession.mockResolvedValueOnce(null);
    SessionService.getOrCreateSession.mockResolvedValueOnce({ id: 'new-session' });

    const problemData = {
      leetcode_id: 302,
      title: 'No Session Problem',
      address: 'https://leetcode.com/problems/nsp',
      success: true,
      date: new Date().toISOString(),
      timeSpent: 200,
    };

    await addProblem(problemData);
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(SessionService.getOrCreateSession).toHaveBeenCalled();
  });

  it('handles null leetcode_id by setting it to null', async () => {
    const problemData = {
      leetcode_id: null,
      title: 'No LC ID',
      address: 'https://example.com',
      success: true,
      date: new Date().toISOString(),
      timeSpent: 60,
    };

    await addProblem(problemData);
    await new Promise(resolve => setTimeout(resolve, 50));

    const all = await readAll(testDb.db, 'problems');
    // The function should still add the problem even with null leetcode_id
    expect(all).toHaveLength(1);
  });
});

// =========================================================================
// updateStabilityFSRS (pure function)
// =========================================================================

describe('updateStabilityFSRS', () => {
  it('increases stability on correct answer: stability * 1.2 + 0.5', () => {
    const result = updateStabilityFSRS(1.0, true);
    expect(result).toBe(1.7);
  });

  it('decreases stability on wrong answer: stability * 0.7', () => {
    const result = updateStabilityFSRS(1.0, false);
    expect(result).toBe(0.7);
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

  it('handles invalid date string gracefully (no extra decay)', () => {
    const result = updateStabilityFSRS(1.0, true, 'garbage');
    // Invalid date -> NaN in comparison -> no forgetting factor
    expect(result).toBe(1.7);
  });

  it('handles null lastAttemptDate (no decay)', () => {
    const result = updateStabilityFSRS(2.0, false, null);
    expect(result).toBe(1.4);
  });

  it('applies stronger decay for longer time gaps', () => {
    const date60 = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const date180 = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();

    const r60 = updateStabilityFSRS(2.0, true, date60);
    const r180 = updateStabilityFSRS(2.0, true, date180);
    expect(r180).toBeLessThan(r60);
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
    // The function uses problem.id (not problem_id) for attempt lookup
    prob.id = 'stab-1';
    await seedStore(testDb.db, 'problems', [prob]);

    // Seed attempts with the by_problem_id index
    await seedStore(testDb.db, 'attempts', [
      { id: 'a1', problem_id: 'stab-1', success: true, attempt_date: '2025-01-01' },
      { id: 'a2', problem_id: 'stab-1', success: false, attempt_date: '2025-01-02' },
    ]);

    await addStabilityToProblems();

    const all = await readAll(testDb.db, 'problems');
    // After correct (1.0 * 1.2 + 0.5 = 1.7) then wrong (1.7 * 0.7 = 1.19)
    expect(all[0].stability).toBe(1.19);
  });

  it('leaves stability at 1.0 when no attempts exist', async () => {
    const prob = makeProblem({ problem_id: 'stab-2', stability: 1.0 });
    prob.id = 'stab-no-attempts';
    await seedStore(testDb.db, 'problems', [prob]);

    await addStabilityToProblems();

    const all = await readAll(testDb.db, 'problems');
    expect(all[0].stability).toBe(1.0);
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
    // Wait for the async getAll + transaction to complete
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
    expect(byId['tag-2'].tags).toBeUndefined();
  });
});

// =========================================================================
// getProblemWithOfficialDifficulty
// =========================================================================

describe('getProblemWithOfficialDifficulty', () => {
  it('returns merged problem when both user and standard exist', async () => {
    await seedStore(testDb.db, 'problems', [
      makeProblem({ problem_id: 'off-1', leetcode_id: 100, title: 'user title', box_level: 3 }),
    ]);

    fetchProblemById.mockResolvedValueOnce({
      id: 100,
      title: 'Official Title',
      difficulty: 'Medium',
      tags: ['dp', 'greedy'],
    });

    const result = await getProblemWithOfficialDifficulty(100);
    expect(result).toBeDefined();
    expect(result.difficulty).toBe('Medium');
    expect(result.tags).toEqual(['dp', 'greedy']);
    expect(result.title).toBe('Official Title');
    expect(result.boxLevel).toBe(3);
    expect(result.leetcode_id).toBe(100);
  });

  it('returns user problem data when standard problem is not found', async () => {
    await seedStore(testDb.db, 'problems', [
      makeProblem({
        problem_id: 'off-2',
        leetcode_id: 200,
        title: 'user only',
        Rating: 'Hard',
        tags: ['string'],
      }),
    ]);

    fetchProblemById.mockResolvedValueOnce(null);

    const result = await getProblemWithOfficialDifficulty(200);
    expect(result).toBeDefined();
    expect(result.leetcode_id).toBe(200);
    expect(result.difficulty).toBe('Hard');
    expect(result.tags).toEqual(['string']);
  });

  it('returns data with defaults when user problem does not exist in DB', async () => {
    fetchProblemById.mockResolvedValueOnce(null);

    const result = await getProblemWithOfficialDifficulty(9999);
    expect(result).toBeDefined();
    expect(result.leetcode_id).toBe(9999);
    expect(result.difficulty).toBe('Unknown');
  });

  it('returns null on unexpected error', async () => {
    dbHelper.openDB.mockRejectedValueOnce(new Error('DB exploded'));

    const result = await getProblemWithOfficialDifficulty(1);
    expect(result).toBeNull();
  });
});

// =========================================================================
// getProblemsWithHighFailures
// =========================================================================

describe('getProblemsWithHighFailures', () => {
  it('returns empty array when store is empty', async () => {
    const result = await getProblemsWithHighFailures();
    expect(result).toEqual([]);
  });

  it('returns problems matching default thresholds (minUnsuccessful=3, maxBoxLevel=4)', async () => {
    await seedStore(testDb.db, 'problems', [
      makeProblem({
        problem_id: 'hf-1',
        box_level: 2,
        attempt_stats: { total_attempts: 5, successful_attempts: 1, unsuccessful_attempts: 4 },
      }),
      makeProblem({
        problem_id: 'hf-2',
        box_level: 1,
        attempt_stats: { total_attempts: 3, successful_attempts: 0, unsuccessful_attempts: 3 },
      }),
      makeProblem({
        problem_id: 'hf-3',
        box_level: 5, // above maxBoxLevel
        attempt_stats: { total_attempts: 10, successful_attempts: 0, unsuccessful_attempts: 10 },
      }),
      makeProblem({
        problem_id: 'hf-4',
        box_level: 1,
        attempt_stats: { total_attempts: 2, successful_attempts: 0, unsuccessful_attempts: 2 }, // below threshold
      }),
    ]);

    const result = await getProblemsWithHighFailures();
    expect(result).toHaveLength(2);
    const ids = result.map(p => p.problem_id).sort();
    expect(ids).toEqual(['hf-1', 'hf-2']);
  });

  it('respects custom thresholds', async () => {
    await seedStore(testDb.db, 'problems', [
      makeProblem({
        problem_id: 'hf-5',
        box_level: 2,
        attempt_stats: { total_attempts: 2, successful_attempts: 0, unsuccessful_attempts: 2 },
      }),
      makeProblem({
        problem_id: 'hf-6',
        box_level: 3,
        attempt_stats: { total_attempts: 1, successful_attempts: 0, unsuccessful_attempts: 1 },
      }),
    ]);

    const result = await getProblemsWithHighFailures({ minUnsuccessfulAttempts: 1, maxBoxLevel: 2 });
    expect(result).toHaveLength(1);
    expect(result[0].problem_id).toBe('hf-5');
  });

  it('handles maxBoxLevel of 0 by returning empty', async () => {
    await seedStore(testDb.db, 'problems', [
      makeProblem({
        problem_id: 'hf-7',
        box_level: 1,
        attempt_stats: { total_attempts: 5, successful_attempts: 0, unsuccessful_attempts: 5 },
      }),
    ]);

    const result = await getProblemsWithHighFailures({ maxBoxLevel: 0 });
    expect(result).toEqual([]);
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
    // The current implementation iterates but does not actually fix problems (cursor.continue only)
    expect(count).toBe(0);
  });
});

// =========================================================================
// fetchAdditionalProblems
// =========================================================================

describe('fetchAdditionalProblems', () => {
  it('returns selected problems from the selection pipeline', async () => {
    const mockProblems = [
      { id: 1, title: 'p1' },
      { id: 2, title: 'p2' },
    ];

    selectPrimaryAndExpansionProblems.mockResolvedValueOnce({
      selectedProblems: mockProblems,
      usedProblemIds: new Set([1, 2]),
    });

    const result = await fetchAdditionalProblems(5, new Set(), [], []);
    expect(result).toHaveLength(2);
    expect(loadProblemSelectionContext).toHaveBeenCalled();
  });

  it('returns empty array on error', async () => {
    loadProblemSelectionContext.mockRejectedValueOnce(new Error('context failed'));

    const result = await fetchAdditionalProblems(5);
    expect(result).toEqual([]);
  });

  it('passes options through to the selection pipeline', async () => {
    selectPrimaryAndExpansionProblems.mockResolvedValueOnce({
      selectedProblems: [],
      usedProblemIds: new Set(),
    });

    await fetchAdditionalProblems(3, new Set(), [], [], {
      currentDifficultyCap: 'Medium',
      isOnboarding: true,
    });

    expect(loadProblemSelectionContext).toHaveBeenCalledWith('Medium', expect.any(Function));
  });

  it('calls expandWithRemainingFocusTags and fillRemainingWithRandomProblems', async () => {
    selectPrimaryAndExpansionProblems.mockResolvedValueOnce({
      selectedProblems: [],
      usedProblemIds: new Set(),
    });

    await fetchAdditionalProblems(5);

    expect(expandWithRemainingFocusTags).toHaveBeenCalled();
    expect(fillRemainingWithRandomProblems).toHaveBeenCalled();
  });
});

// =========================================================================
// Edge cases and integration
// =========================================================================

describe('edge cases', () => {
  it('getProblem after saveUpdatedProblem roundtrip', async () => {
    const p = makeProblem({ problem_id: 'roundtrip-1', title: 'hello' });
    await saveUpdatedProblem(p);

    const fetched = await getProblem('roundtrip-1');
    expect(fetched).not.toBeNull();
    expect(fetched.title).toBe('hello');
  });

  it('countProblemsByBoxLevel after adding problems via addProblem', async () => {
    const problemData = {
      leetcode_id: 501,
      title: 'Count Test',
      address: 'https://leetcode.com/problems/ct',
      success: true,
      date: new Date().toISOString(),
      timeSpent: 100,
    };

    await addProblem(problemData);
    await new Promise(resolve => setTimeout(resolve, 50));

    const counts = await countProblemsByBoxLevel();
    // New problems start at box_level 1
    expect(counts[1]).toBeGreaterThanOrEqual(1);
  });

  it('checkDatabaseForProblem finds a problem added via addProblem', async () => {
    const problemData = {
      leetcode_id: 601,
      title: 'Lookup Test',
      address: 'https://leetcode.com/problems/lt',
      success: true,
      date: new Date().toISOString(),
      timeSpent: 100,
    };

    await addProblem(problemData);
    await new Promise(resolve => setTimeout(resolve, 50));

    const found = await checkDatabaseForProblem(601);
    expect(found).toBeDefined();
    expect(found.leetcode_id).toBe(601);
  });

  it('updateProblemsWithRatings handles successive calls correctly', async () => {
    await seedStore(testDb.db, 'problems', [
      makeProblem({ problem_id: 'multi-1' }),
    ]);

    await updateProblemsWithRatings();
    await updateProblemsWithRatings();

    const all = await readAll(testDb.db, 'problems');
    expect(all[0].rating).toBe(2);
  });

  it('addProblem handles error in AttemptsService.addAttempt gracefully', async () => {
    AttemptsService.addAttempt.mockRejectedValueOnce(new Error('attempt failed'));

    const problemData = {
      leetcode_id: 701,
      title: 'Error Test',
      address: 'https://leetcode.com/problems/et',
      success: true,
      date: new Date().toISOString(),
      timeSpent: 100,
    };

    // Should not throw even if addAttempt fails
    await addProblem(problemData);
    await new Promise(resolve => setTimeout(resolve, 50));

    const all = await readAll(testDb.db, 'problems');
    expect(all).toHaveLength(1);
  });
});
