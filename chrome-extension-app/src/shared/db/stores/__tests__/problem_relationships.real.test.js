/**
 * Comprehensive real-IndexedDB tests for problem_relationships.js
 *
 * Uses fake-indexeddb via testDbHelper to exercise actual IndexedDB
 * transactions, cursors, and indexes against the full CodeMaster schema.
 */

// --- Mocks must come before imports ---

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

jest.mock('../tag_mastery.js', () => ({
  getTagMastery: jest.fn().mockResolvedValue([]),
  calculateTagSimilarity: jest.fn().mockReturnValue(0.5),
}));

jest.mock('../problems.js', () => ({
  fetchAllProblems: jest.fn().mockResolvedValue([]),
  getProblem: jest.fn(),
  getProblemsWithHighFailures: jest.fn().mockResolvedValue([]),
}));

jest.mock('../standard_problems.js', () => ({
  fetchProblemById: jest.fn().mockResolvedValue(null),
}));

jest.mock('../sessions.js', () => ({
  getSessionById: jest.fn(),
  getAllSessions: jest.fn().mockResolvedValue([]),
  getSessionPerformance: jest.fn().mockResolvedValue({ accuracy: 0.7 }),
}));

jest.mock('../../../utils/leitner/Utils.js', () => ({
  calculateSuccessRate: jest.fn().mockReturnValue(0.8),
}));

// --- Imports ---

import { createTestDb, closeTestDb, seedStore, readAll } from '../../../../../test/testDbHelper.js';
import { dbHelper } from '../../index.js';
import { getProblemsWithHighFailures } from '../problems.js';
import { fetchProblemById } from '../standard_problems.js';

import {
  addProblemRelationship,
  weakenProblemRelationship,
  clearProblemRelationships,
  storeRelationships,
  getRelationshipStrength,
  getAllRelationshipStrengths,
  updateRelationshipStrength,
  buildRelationshipMap,
  getUserRecentAttempts,
  scoreProblemsWithRelationships,
  restoreMissingProblemRelationships,
  calculateAndTrimProblemRelationships,
  weakenRelationshipsForSkip,
  getRelationshipsForProblem,
  hasRelationshipsToAttempted,
  getRecentAttempts,
  getProblemsNeedingReinforcement,
  getMasteredProblems,
  getFailureTriggeredReviews,
  findPrerequisiteProblem,
} from '../problem_relationships.js';
import { calculateTagSimilarity } from '../tag_mastery.js';

// --- Test setup ---

let testDb;

beforeEach(async () => {
  testDb = await createTestDb();
  dbHelper.openDB.mockImplementation(() => Promise.resolve(testDb.db));
  jest.clearAllMocks();
  // Re-apply after clearAllMocks
  dbHelper.openDB.mockImplementation(() => Promise.resolve(testDb.db));
});

afterEach(() => closeTestDb(testDb));

// --- Helpers ---

function makeRelationship(id, pid1, pid2, strength) {
  return { id, problem_id1: pid1, problem_id2: pid2, strength };
}

function makeAttempt(id, opts = {}) {
  const now = new Date();
  return {
    id,
    leetcode_id: opts.leetcode_id || id,
    problem_id: opts.problem_id || id,
    session_id: opts.session_id || 'session-1',
    success: opts.success !== undefined ? opts.success : true,
    time_spent: opts.time_spent || 60000,
    attempt_date: opts.attempt_date || now.toISOString(),
    date: opts.date || now.toISOString(),
    ...opts,
  };
}

function makeProblem(problemId, opts = {}) {
  return {
    problem_id: problemId,
    leetcode_id: opts.leetcode_id || problemId,
    title: opts.title || `Problem ${problemId}`,
    difficulty: opts.difficulty || 'Medium',
    tags: opts.tags || ['array'],
    box_level: opts.box_level || 1,
    session_id: opts.session_id || 'session-1',
    ...opts,
  };
}

function makeSession(id, opts = {}) {
  return {
    id,
    date: opts.date || new Date().toISOString(),
    status: opts.status || 'completed',
    session_type: opts.session_type || 'practice',
    last_activity_time: opts.last_activity_time || new Date().toISOString(),
    ...opts,
  };
}

// =====================================================================
// Tests
// =====================================================================

describe('problem_relationships (real IndexedDB)', () => {
  // -----------------------------------------------------------------
  // addProblemRelationship
  // -----------------------------------------------------------------
  describe('addProblemRelationship', () => {
    it('inserts a relationship with auto-increment id', async () => {
      const resultId = await addProblemRelationship(1, 2, 3.5);
      expect(resultId).toBeDefined();
      expect(typeof resultId).toBe('number');

      const all = await readAll(testDb.db, 'problem_relationships');
      expect(all).toHaveLength(1);
      expect(all[0].problem_id1).toBe(1);
      expect(all[0].problem_id2).toBe(2);
      expect(all[0].strength).toBe(3.5);
    });

    it('inserts multiple relationships with distinct auto-increment ids', async () => {
      const id1 = await addProblemRelationship(1, 2, 3);
      const id2 = await addProblemRelationship(1, 3, 5);
      const id3 = await addProblemRelationship(2, 3, 1);

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);

      const all = await readAll(testDb.db, 'problem_relationships');
      expect(all).toHaveLength(3);
    });
  });

  // -----------------------------------------------------------------
  // weakenProblemRelationship
  // -----------------------------------------------------------------
  describe('weakenProblemRelationship', () => {
    it('decrements strength by 1 for the first match on by_problem_id1 index', async () => {
      await seedStore(testDb.db, 'problem_relationships', [
        makeRelationship(1, 100, 200, 5),
      ]);

      const result = await weakenProblemRelationship(100, 200);
      expect(result.strength).toBe(4);

      const all = await readAll(testDb.db, 'problem_relationships');
      expect(all[0].strength).toBe(4);
    });

    it('does not reduce strength below 0', async () => {
      await seedStore(testDb.db, 'problem_relationships', [
        makeRelationship(1, 10, 20, 0),
      ]);

      const result = await weakenProblemRelationship(10, 20);
      expect(result.strength).toBe(0);
    });

    it('rejects when no relationship found', async () => {
      await expect(weakenProblemRelationship(999, 888)).rejects.toThrow(
        'No relationship found'
      );
    });

    it('returns null for invalid problemId1', async () => {
      const result = await weakenProblemRelationship(null, 200);
      expect(result).toBeNull();
    });

    it('returns null for undefined problemId1', async () => {
      const result = await weakenProblemRelationship(undefined, 200);
      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------------
  // clearProblemRelationships
  // -----------------------------------------------------------------
  describe('clearProblemRelationships', () => {
    it('removes all records from the store', async () => {
      await seedStore(testDb.db, 'problem_relationships', [
        makeRelationship(1, 1, 2, 3),
        makeRelationship(2, 3, 4, 5),
      ]);

      await clearProblemRelationships(testDb.db);

      const all = await readAll(testDb.db, 'problem_relationships');
      expect(all).toHaveLength(0);
    });

    it('succeeds when store is already empty', async () => {
      await clearProblemRelationships(testDb.db);
      const all = await readAll(testDb.db, 'problem_relationships');
      expect(all).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------
  // storeRelationships
  // -----------------------------------------------------------------
  describe('storeRelationships', () => {
    it('stores relationships from a Map-based problem graph', async () => {
      const graph = new Map([
        [1, [{ problemId2: 2, strength: 4 }, { problemId2: 3, strength: 2 }]],
        [2, [{ problemId2: 3, strength: 5 }]],
      ]);

      await storeRelationships(graph);

      const all = await readAll(testDb.db, 'problem_relationships');
      expect(all).toHaveLength(3);
      expect(all.map(r => r.problem_id1)).toEqual(expect.arrayContaining([1, 1, 2]));
      expect(all.map(r => r.problem_id2)).toEqual(expect.arrayContaining([2, 3, 3]));
    });

    it('stores an empty graph without errors', async () => {
      const graph = new Map();
      await storeRelationships(graph);
      const all = await readAll(testDb.db, 'problem_relationships');
      expect(all).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------
  // getRelationshipStrength
  // -----------------------------------------------------------------
  describe('getRelationshipStrength', () => {
    it('returns strength for an exact match', async () => {
      await seedStore(testDb.db, 'problem_relationships', [
        makeRelationship(1, 10, 20, 7),
        makeRelationship(2, 10, 30, 3),
      ]);

      const strength = await getRelationshipStrength(10, 20);
      expect(strength).toBe(7);
    });

    it('returns null when no match exists', async () => {
      await seedStore(testDb.db, 'problem_relationships', [
        makeRelationship(1, 10, 20, 7),
      ]);

      const strength = await getRelationshipStrength(10, 99);
      expect(strength).toBeNull();
    });

    it('returns null for falsy problemId1', async () => {
      const result = await getRelationshipStrength(null, 20);
      expect(result).toBeNull();
    });

    it('returns null for falsy problemId2', async () => {
      const result = await getRelationshipStrength(10, 0);
      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------------
  // getAllRelationshipStrengths
  // -----------------------------------------------------------------
  describe('getAllRelationshipStrengths', () => {
    it('returns a Map of "id1-id2" keys to strength values', async () => {
      await seedStore(testDb.db, 'problem_relationships', [
        makeRelationship(1, 10, 20, 5),
        makeRelationship(2, 30, 40, 8),
      ]);

      const result = await getAllRelationshipStrengths();
      expect(result).toBeInstanceOf(Map);
      expect(result.get('10-20')).toBe(5);
      expect(result.get('30-40')).toBe(8);
      expect(result.size).toBe(2);
    });

    it('returns an empty Map when no relationships exist', async () => {
      const result = await getAllRelationshipStrengths();
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });
  });

  // -----------------------------------------------------------------
  // updateRelationshipStrength
  // -----------------------------------------------------------------
  describe('updateRelationshipStrength', () => {
    it('updates an existing relationship strength', async () => {
      await seedStore(testDb.db, 'problem_relationships', [
        makeRelationship(1, 10, 20, 3),
      ]);

      await updateRelationshipStrength(10, 20, 8);

      const all = await readAll(testDb.db, 'problem_relationships');
      const updated = all.find(r => r.problem_id1 === 10 && r.problem_id2 === 20);
      expect(updated.strength).toBe(8);
    });

    it('creates a new relationship when one does not exist', async () => {
      await updateRelationshipStrength(50, 60, 4);

      const all = await readAll(testDb.db, 'problem_relationships');
      expect(all).toHaveLength(1);
      expect(all[0].problem_id1).toBe(50);
      expect(all[0].problem_id2).toBe(60);
      expect(all[0].strength).toBe(4);
    });

    it('clamps strength to 0.1 minimum', async () => {
      await updateRelationshipStrength(1, 2, -5);

      const all = await readAll(testDb.db, 'problem_relationships');
      expect(all[0].strength).toBe(0.1);
    });

    it('clamps strength to 10.0 maximum', async () => {
      await updateRelationshipStrength(1, 2, 99);

      const all = await readAll(testDb.db, 'problem_relationships');
      expect(all[0].strength).toBe(10.0);
    });

    it('does nothing for falsy problemId1', async () => {
      await updateRelationshipStrength(null, 2, 5);
      const all = await readAll(testDb.db, 'problem_relationships');
      expect(all).toHaveLength(0);
    });

    it('does nothing for non-number newStrength', async () => {
      await updateRelationshipStrength(1, 2, 'abc');
      const all = await readAll(testDb.db, 'problem_relationships');
      expect(all).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------
  // buildRelationshipMap
  // -----------------------------------------------------------------
  describe('buildRelationshipMap', () => {
    it('returns a Map of problem_id1 -> { problem_id2: strength }', async () => {
      await seedStore(testDb.db, 'problem_relationships', [
        makeRelationship(1, 10, 20, 5),
        makeRelationship(2, 10, 30, 3),
        makeRelationship(3, 20, 30, 7),
      ]);

      const graph = await buildRelationshipMap();
      expect(graph).toBeInstanceOf(Map);
      expect(graph.get(10)).toEqual({ 20: 5, 30: 3 });
      expect(graph.get(20)).toEqual({ 30: 7 });
    });

    it('returns an empty Map when store is empty', async () => {
      const graph = await buildRelationshipMap();
      expect(graph).toBeInstanceOf(Map);
      expect(graph.size).toBe(0);
    });

    it('converts problem ids to numbers in the Map keys', async () => {
      await seedStore(testDb.db, 'problem_relationships', [
        makeRelationship(1, '10', '20', 4),
      ]);

      const graph = await buildRelationshipMap();
      // Keys should be Number type
      expect(graph.has(10)).toBe(true);
      expect(graph.get(10)[20]).toBe(4);
    });
  });

  // -----------------------------------------------------------------
  // getUserRecentAttempts
  // -----------------------------------------------------------------
  describe('getUserRecentAttempts', () => {
    it('returns successful attempts from the last 7 days', async () => {
      const now = new Date();
      const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000);

      await seedStore(testDb.db, 'attempts', [
        makeAttempt(1, { success: true, attempt_date: twoDaysAgo.toISOString(), leetcode_id: 100 }),
        makeAttempt(2, { success: true, attempt_date: now.toISOString(), leetcode_id: 101 }),
      ]);

      const results = await getUserRecentAttempts(5);
      expect(results.length).toBeGreaterThanOrEqual(1);
      results.forEach(r => {
        expect(r.success).toBe(true);
        expect(r.leetcode_id).toBeDefined();
      });
    });

    it('excludes failed attempts', async () => {
      const now = new Date();
      await seedStore(testDb.db, 'attempts', [
        makeAttempt(1, { success: false, attempt_date: now.toISOString() }),
        makeAttempt(2, { success: true, attempt_date: now.toISOString() }),
      ]);

      const results = await getUserRecentAttempts(5);
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
    });

    it('excludes attempts older than 7 days', async () => {
      const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      await seedStore(testDb.db, 'attempts', [
        makeAttempt(1, { success: true, attempt_date: old.toISOString() }),
      ]);

      const results = await getUserRecentAttempts(5);
      expect(results).toHaveLength(0);
    });

    it('respects the limit parameter', async () => {
      const now = new Date();
      await seedStore(testDb.db, 'attempts', [
        makeAttempt(1, { success: true, attempt_date: now.toISOString() }),
        makeAttempt(2, { success: true, attempt_date: now.toISOString() }),
        makeAttempt(3, { success: true, attempt_date: now.toISOString() }),
      ]);

      const results = await getUserRecentAttempts(2);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('returns empty array when no attempts exist', async () => {
      const results = await getUserRecentAttempts(5);
      expect(results).toEqual([]);
    });
  });

  // -----------------------------------------------------------------
  // scoreProblemsWithRelationships
  // -----------------------------------------------------------------
  describe('scoreProblemsWithRelationships', () => {
    it('adds relationshipScore and relationshipCount to each candidate', async () => {
      await seedStore(testDb.db, 'problem_relationships', [
        makeRelationship(1, 10, 20, 5),
      ]);

      const candidates = [
        { id: 20, leetcode_id: 20, difficulty: 'Medium', tags: ['array'] },
      ];
      const recentAttempts = [{ leetcode_id: 10 }];

      const result = await scoreProblemsWithRelationships(candidates, recentAttempts);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('relationshipScore');
      expect(result[0]).toHaveProperty('relationshipCount');
    });

    it('returns score of 0 for candidates with no relationships', async () => {
      const candidates = [
        { id: 50, leetcode_id: 50, difficulty: 'Easy', tags: [] },
      ];
      const recentAttempts = [{ leetcode_id: 99 }];

      const result = await scoreProblemsWithRelationships(candidates, recentAttempts);

      expect(result[0].relationshipScore).toBe(0);
      expect(result[0].relationshipCount).toBe(0);
    });

    it('handles empty candidates array', async () => {
      const result = await scoreProblemsWithRelationships([], [{ leetcode_id: 1 }]);
      expect(result).toEqual([]);
    });

    it('handles empty recentAttempts array', async () => {
      const candidates = [{ id: 1, leetcode_id: 1 }];
      const result = await scoreProblemsWithRelationships(candidates, []);
      expect(result).toHaveLength(1);
      expect(result[0].relationshipScore).toBe(0);
    });

    it('scores using bidirectional relationships', async () => {
      // Relationship from 10->20 and also 20->10
      await seedStore(testDb.db, 'problem_relationships', [
        makeRelationship(1, 10, 20, 4),
        makeRelationship(2, 20, 10, 6),
      ]);

      const candidates = [{ id: 20, leetcode_id: 20, tags: [] }];
      const recentAttempts = [{ leetcode_id: 10 }];

      const result = await scoreProblemsWithRelationships(candidates, recentAttempts);

      // Both directions should be counted
      expect(result[0].relationshipCount).toBe(2);
      expect(result[0].relationshipScore).toBe(5); // (4+6)/2
    });
  });

  // -----------------------------------------------------------------
  // restoreMissingProblemRelationships (pure function)
  // -----------------------------------------------------------------
  describe('restoreMissingProblemRelationships', () => {
    it('restores from removedRelationships when available', () => {
      const problemGraph = new Map([[1, []], [2, [{ problemId2: 1, strength: 3 }]]]);
      const removedRelationships = new Map([[1, [{ problemId2: 3, strength: 2 }]]]);
      const problems = [
        { leetcode_id: 1, tags: ['array'] },
        { leetcode_id: 2, tags: ['array'] },
      ];

      const { updatedProblemGraph } = restoreMissingProblemRelationships({
        problems,
        problemGraph,
        removedRelationships,
      });

      expect(updatedProblemGraph.get(1)).toHaveLength(1);
      expect(updatedProblemGraph.get(1)[0].problemId2).toBe(3);
    });

    it('creates fallback same-tag pairing when no removed relationships', () => {
      const problemGraph = new Map([[1, []], [2, [{ problemId2: 1, strength: 3 }]]]);
      const removedRelationships = new Map();
      const problems = [
        { leetcode_id: 1, tags: ['dp'] },
        { leetcode_id: 2, tags: ['dp'] },
      ];

      const { updatedProblemGraph } = restoreMissingProblemRelationships({
        problems,
        problemGraph,
        removedRelationships,
      });

      expect(updatedProblemGraph.get(1)).toHaveLength(1);
      expect(updatedProblemGraph.get(1)[0].strength).toBe(1);
    });
  });

  // -----------------------------------------------------------------
  // calculateAndTrimProblemRelationships (pure function)
  // -----------------------------------------------------------------
  describe('calculateAndTrimProblemRelationships', () => {
    beforeEach(() => {
      calculateTagSimilarity.mockReturnValue(0.5);
    });

    it('builds a graph and trims to specified limit', () => {
      const problems = [
        { leetcode_id: 1, difficulty: 'Easy', tags: ['array'] },
        { leetcode_id: 2, difficulty: 'Easy', tags: ['array'] },
        { leetcode_id: 3, difficulty: 'Easy', tags: ['array'] },
      ];

      const { problemGraph } = calculateAndTrimProblemRelationships({
        problems,
        tagGraph: {},
        tagMastery: {},
        limit: 1,
      });

      for (const rels of problemGraph.values()) {
        expect(rels.length).toBeLessThanOrEqual(1);
      }
    });

    it('stores removed relationships exceeding the limit', () => {
      const problems = [
        { leetcode_id: 1, difficulty: 'Easy', tags: ['array'] },
        { leetcode_id: 2, difficulty: 'Medium', tags: ['array'] },
        { leetcode_id: 3, difficulty: 'Hard', tags: ['array'] },
      ];

      const { removedRelationships } = calculateAndTrimProblemRelationships({
        problems,
        tagGraph: {},
        tagMastery: {},
        limit: 1,
      });

      expect(removedRelationships).toBeInstanceOf(Map);
    });
  });

  // -----------------------------------------------------------------
  // weakenRelationshipsForSkip
  // -----------------------------------------------------------------
  describe('weakenRelationshipsForSkip', () => {
    it('returns { updated: 0 } when no recent attempts', async () => {
      const result = await weakenRelationshipsForSkip(100);
      expect(result).toEqual({ updated: 0 });
    });

    it('returns { updated: 0 } for null problemId', async () => {
      const result = await weakenRelationshipsForSkip(null);
      expect(result).toEqual({ updated: 0 });
    });

    it('creates weakened relationships for recent successful attempts', async () => {
      const now = new Date();
      await seedStore(testDb.db, 'attempts', [
        makeAttempt(1, {
          success: true,
          attempt_date: now.toISOString(),
          leetcode_id: 50,
        }),
      ]);

      // Seed an existing relationship
      await seedStore(testDb.db, 'problem_relationships', [
        makeRelationship(1, 100, 50, 4.0),
      ]);

      const result = await weakenRelationshipsForSkip(100);
      expect(result.updated).toBeGreaterThanOrEqual(1);
    });
  });

  // -----------------------------------------------------------------
  // getRelationshipsForProblem
  // -----------------------------------------------------------------
  describe('getRelationshipsForProblem', () => {
    it('returns relationships where problem is problem_id1', async () => {
      await seedStore(testDb.db, 'problem_relationships', [
        makeRelationship(1, 10, 20, 5),
        makeRelationship(2, 10, 30, 3),
        makeRelationship(3, 40, 50, 8),
      ]);

      const rels = await getRelationshipsForProblem(10);
      expect(rels[20]).toBe(5);
      expect(rels[30]).toBe(3);
      expect(rels[50]).toBeUndefined();
    });

    it('returns relationships where problem is problem_id2 (bidirectional)', async () => {
      await seedStore(testDb.db, 'problem_relationships', [
        makeRelationship(1, 20, 10, 6),
      ]);

      const rels = await getRelationshipsForProblem(10);
      expect(rels[20]).toBe(6);
    });

    it('returns empty object for problem with no relationships', async () => {
      const rels = await getRelationshipsForProblem(999);
      expect(Object.keys(rels)).toHaveLength(0);
    });

    it('does not overwrite problem_id1 matches with problem_id2 matches', async () => {
      await seedStore(testDb.db, 'problem_relationships', [
        makeRelationship(1, 10, 20, 5),
        makeRelationship(2, 20, 10, 9),  // reverse direction
      ]);

      const rels = await getRelationshipsForProblem(10);
      // problem_id1=10 -> {20: 5} found first
      // problem_id2=10 -> {20: 9} should NOT overwrite
      expect(rels[20]).toBe(5);
    });
  });

  // -----------------------------------------------------------------
  // hasRelationshipsToAttempted
  // -----------------------------------------------------------------
  describe('hasRelationshipsToAttempted', () => {
    it('returns true when relationships connect to attempted problems', async () => {
      await seedStore(testDb.db, 'problem_relationships', [
        makeRelationship(1, 10, 20, 5),
      ]);
      // Put problem 20 in the problems store (simulating it has been attempted)
      await seedStore(testDb.db, 'problems', [
        makeProblem(20, { leetcode_id: 20 }),
      ]);

      const result = await hasRelationshipsToAttempted(10);
      expect(result).toBe(true);
    });

    it('returns false when problem has no relationships', async () => {
      const result = await hasRelationshipsToAttempted(999);
      expect(result).toBe(false);
    });

    it('returns false for falsy problemId', async () => {
      const result = await hasRelationshipsToAttempted(null);
      expect(result).toBe(false);
    });

    it('returns false when related problems are not in attempts', async () => {
      await seedStore(testDb.db, 'problem_relationships', [
        makeRelationship(1, 10, 20, 5),
      ]);
      // problems store is empty -- problem 20 has not been attempted

      const result = await hasRelationshipsToAttempted(10);
      expect(result).toBe(false);
    });
  });

  // -----------------------------------------------------------------
  // getRecentAttempts (cross-store: sessions + attempts)
  // -----------------------------------------------------------------
  describe('getRecentAttempts', () => {
    it('returns attempts from the most recent completed sessions', async () => {
      const now = new Date();

      await seedStore(testDb.db, 'sessions', [
        makeSession('s1', { date: now.toISOString(), status: 'completed' }),
      ]);
      await seedStore(testDb.db, 'attempts', [
        makeAttempt(1, { session_id: 's1', leetcode_id: 100 }),
        makeAttempt(2, { session_id: 's1', leetcode_id: 101 }),
      ]);

      const result = await getRecentAttempts({ sessions: 2 });
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('returns empty array when no completed sessions exist', async () => {
      await seedStore(testDb.db, 'sessions', [
        makeSession('s1', { status: 'in_progress' }),
      ]);

      const result = await getRecentAttempts({ sessions: 2 });
      expect(result).toEqual([]);
    });

    it('defaults to 2 sessions when no option provided', async () => {
      const now = new Date();
      const earlier = new Date(now - 100000);

      await seedStore(testDb.db, 'sessions', [
        makeSession('s1', { date: now.toISOString(), status: 'completed' }),
        makeSession('s2', { date: earlier.toISOString(), status: 'completed' }),
        makeSession('s3', { date: new Date(now - 200000).toISOString(), status: 'completed' }),
      ]);
      await seedStore(testDb.db, 'attempts', [
        makeAttempt(1, { session_id: 's1' }),
        makeAttempt(2, { session_id: 's2' }),
        makeAttempt(3, { session_id: 's3' }),
      ]);

      const result = await getRecentAttempts();
      // Should get attempts from s1 and s2 (newest 2 completed), not s3
      const sessionIds = [...new Set(result.map(a => a.session_id))];
      expect(sessionIds.length).toBeLessThanOrEqual(2);
    });
  });

  // -----------------------------------------------------------------
  // getProblemsNeedingReinforcement
  // -----------------------------------------------------------------
  describe('getProblemsNeedingReinforcement', () => {
    it('returns recent failures from attempts', async () => {
      const recentAttempts = [
        { success: false, leetcode_id: 10 },
        { success: true, leetcode_id: 20 },
        { success: false, leetcode_id: 30 },
      ];

      getProblemsWithHighFailures.mockResolvedValue([]);

      const result = await getProblemsNeedingReinforcement(recentAttempts);
      const ids = result.map(r => r.leetcode_id);
      expect(ids).toContain(10);
      expect(ids).toContain(30);
      expect(ids).not.toContain(20);
    });

    it('includes chronic struggle problems from getProblemsWithHighFailures', async () => {
      getProblemsWithHighFailures.mockResolvedValue([
        { leetcode_id: 50, attempt_stats: { unsuccessful_attempts: 5 } },
      ]);

      const result = await getProblemsNeedingReinforcement([]);
      expect(result).toHaveLength(1);
      expect(result[0].leetcode_id).toBe(50);
      expect(result[0].reason).toBe('chronic_struggle');
    });

    it('deduplicates between recent failures and chronic struggles', async () => {
      getProblemsWithHighFailures.mockResolvedValue([
        { leetcode_id: 10, attempt_stats: { unsuccessful_attempts: 4 } },
      ]);

      const recentAttempts = [{ success: false, leetcode_id: 10 }];

      const result = await getProblemsNeedingReinforcement(recentAttempts);
      const ids = result.map(r => r.leetcode_id);
      // Should only have one entry for id 10
      expect(ids.filter(id => id === 10)).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------
  // getMasteredProblems
  // -----------------------------------------------------------------
  describe('getMasteredProblems', () => {
    it('returns problems with box_level >= 6', async () => {
      await seedStore(testDb.db, 'problems', [
        makeProblem(1, { box_level: 5 }),
        makeProblem(2, { box_level: 6 }),
        makeProblem(3, { box_level: 7 }),
        makeProblem(4, { box_level: 8 }),
      ]);

      const result = await getMasteredProblems();
      const ids = result.map(p => p.problem_id);
      expect(ids).toContain(2);
      expect(ids).toContain(3);
      expect(ids).toContain(4);
      expect(ids).not.toContain(1);
    });

    it('respects custom minBoxLevel parameter', async () => {
      await seedStore(testDb.db, 'problems', [
        makeProblem(1, { box_level: 6 }),
        makeProblem(2, { box_level: 7 }),
        makeProblem(3, { box_level: 8 }),
      ]);

      const result = await getMasteredProblems({ minBoxLevel: 7 });
      const ids = result.map(p => p.problem_id);
      expect(ids).toContain(2);
      expect(ids).toContain(3);
      expect(ids).not.toContain(1);
    });

    it('returns empty array when no mastered problems exist', async () => {
      await seedStore(testDb.db, 'problems', [
        makeProblem(1, { box_level: 2 }),
      ]);

      const result = await getMasteredProblems();
      expect(result).toEqual([]);
    });
  });

  // -----------------------------------------------------------------
  // getFailureTriggeredReviews
  // -----------------------------------------------------------------
  describe('getFailureTriggeredReviews', () => {
    it('returns empty array when no problems need reinforcement', async () => {
      getProblemsWithHighFailures.mockResolvedValue([]);
      const result = await getFailureTriggeredReviews([]);
      expect(result).toEqual([]);
    });

    it('returns empty array when no mastered problems exist', async () => {
      getProblemsWithHighFailures.mockResolvedValue([
        { leetcode_id: 10 },
      ]);
      // No mastered problems in DB

      const recentAttempts = [{ success: false, leetcode_id: 10 }];
      const result = await getFailureTriggeredReviews(recentAttempts);
      expect(result).toEqual([]);
    });

    it('finds bridge problems connecting mastered to struggling problems', async () => {
      getProblemsWithHighFailures.mockResolvedValue([]);

      // Mastered problem
      await seedStore(testDb.db, 'problems', [
        makeProblem(100, { leetcode_id: 100, box_level: 7, tags: ['array'] }),
      ]);

      // Relationship linking mastered problem to struggling problem
      await seedStore(testDb.db, 'problem_relationships', [
        makeRelationship(1, 100, 10, 3.0),
      ]);

      const recentAttempts = [{ success: false, leetcode_id: 10 }];
      const result = await getFailureTriggeredReviews(recentAttempts);

      // Should find mastered problem 100 as a bridge to struggling problem 10
      expect(result.length).toBeGreaterThanOrEqual(1);
      if (result.length > 0) {
        expect(result[0].triggerReason).toBe('prerequisite_reinforcement');
      }
    });
  });

  // -----------------------------------------------------------------
  // findPrerequisiteProblem
  // -----------------------------------------------------------------
  describe('findPrerequisiteProblem', () => {
    it('returns null when problemId is falsy', async () => {
      const result = await findPrerequisiteProblem(null);
      expect(result).toBeNull();
    });

    it('returns null when the skipped problem is not found in standard_problems', async () => {
      fetchProblemById.mockResolvedValue(null);
      const result = await findPrerequisiteProblem(10);
      expect(result).toBeNull();
    });

    it('returns a prerequisite problem that is same or easier difficulty', async () => {
      // Mock the skipped problem as Medium
      fetchProblemById.mockImplementation(async (id) => {
        if (id === 10) {
          return { id: 10, title: 'Skipped Medium', difficulty: 'Medium', tags: ['array'], Tags: ['array'] };
        }
        if (id === 20) {
          return { id: 20, title: 'Easy Prereq', difficulty: 'Easy', tags: ['array'], Tags: ['array'] };
        }
        return null;
      });

      // Relationship: problem 10 is related to problem 20
      await seedStore(testDb.db, 'problem_relationships', [
        makeRelationship(1, 10, 20, 4),
      ]);

      const result = await findPrerequisiteProblem(10);
      expect(result).not.toBeNull();
      expect(result.id).toBe(20);
      expect(result.difficulty).toBe('Easy');
    });

    it('excludes problems in excludeIds', async () => {
      fetchProblemById.mockImplementation(async (id) => {
        if (id === 10) {
          return { id: 10, title: 'Skipped', difficulty: 'Medium', tags: ['dp'], Tags: ['dp'] };
        }
        if (id === 20) {
          return { id: 20, title: 'Excluded', difficulty: 'Easy', tags: ['dp'], Tags: ['dp'] };
        }
        if (id === 30) {
          return { id: 30, title: 'Available', difficulty: 'Easy', tags: ['dp'], Tags: ['dp'] };
        }
        return null;
      });

      await seedStore(testDb.db, 'problem_relationships', [
        makeRelationship(1, 10, 20, 5),
        makeRelationship(2, 10, 30, 3),
      ]);

      const result = await findPrerequisiteProblem(10, [20]);
      if (result) {
        expect(result.id).toBe(30);
      }
    });

    it('does not return a harder problem as prerequisite', async () => {
      fetchProblemById.mockImplementation(async (id) => {
        if (id === 10) {
          return { id: 10, title: 'Easy Problem', difficulty: 'Easy', tags: ['array'], Tags: ['array'] };
        }
        if (id === 20) {
          return { id: 20, title: 'Hard Problem', difficulty: 'Hard', tags: ['array'], Tags: ['array'] };
        }
        return null;
      });

      await seedStore(testDb.db, 'problem_relationships', [
        makeRelationship(1, 10, 20, 5),
      ]);

      const result = await findPrerequisiteProblem(10);
      // Should return null because only related problem is harder
      expect(result).toBeNull();
    });
  });
});
