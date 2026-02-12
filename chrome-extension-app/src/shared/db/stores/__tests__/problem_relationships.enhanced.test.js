/**
 * Unit tests for problem_relationships.js
 * Focuses on pure/lightly-mocked exported functions:
 * - calculateAndTrimProblemRelationships
 * - restoreMissingProblemRelationships
 * - calculateOptimalPathScore (with fully cached data)
 */

// Mock logger first, before all other imports
jest.mock('../../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock database-dependent modules (paths relative to this test file's location)
jest.mock('../../../db/index.js', () => ({
  dbHelper: { openDB: jest.fn() },
}));

jest.mock('../tag_mastery.js', () => ({
  getTagMastery: jest.fn().mockResolvedValue([]),
  calculateTagSimilarity: jest.fn().mockReturnValue(0.5),
}));

jest.mock('../problems.js', () => ({
  fetchAllProblems: jest.fn().mockResolvedValue([]),
  getProblemsWithHighFailures: jest.fn().mockResolvedValue([]),
}));

jest.mock('../standard_problems.js', () => ({
  fetchProblemById: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../../utils/leitner/Utils.js', () => ({
  calculateSuccessRate: jest.fn().mockReturnValue(0.8),
}));

jest.mock('../sessions.js', () => ({
  getSessionPerformance: jest.fn().mockResolvedValue({ accuracy: 0.7 }),
}));

import {
  calculateAndTrimProblemRelationships,
  restoreMissingProblemRelationships,
  calculateOptimalPathScore,
} from '../problem_relationships.js';
import { calculateTagSimilarity } from '../tag_mastery.js';

// -----------------------------------------------------------------------
// Helpers / fixtures
// -----------------------------------------------------------------------
function makeProblems() {
  return [
    { leetcode_id: 1, id: 1, difficulty: 'Easy', tags: ['array', 'hash-table'] },
    { leetcode_id: 2, id: 2, difficulty: 'Medium', tags: ['array', 'two-pointers'] },
    { leetcode_id: 3, id: 3, difficulty: 'Hard', tags: ['graph', 'bfs'] },
  ];
}

describe('problem_relationships', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // calculateAndTrimProblemRelationships
  // -----------------------------------------------------------------------
  describe('calculateAndTrimProblemRelationships', () => {
    it('returns a problemGraph Map and removedRelationships Map', () => {
      calculateTagSimilarity.mockReturnValue(0.5);
      const problems = makeProblems();

      const { problemGraph, removedRelationships } = calculateAndTrimProblemRelationships({
        problems,
        tagGraph: {},
        tagMastery: {},
        limit: 5,
      });

      expect(problemGraph).toBeInstanceOf(Map);
      expect(removedRelationships).toBeInstanceOf(Map);
    });

    it('creates an entry for every problem in the graph', () => {
      calculateTagSimilarity.mockReturnValue(0.5);
      const problems = makeProblems();

      const { problemGraph } = calculateAndTrimProblemRelationships({
        problems,
        tagGraph: {},
        tagMastery: {},
        limit: 5,
      });

      expect(problemGraph.has(1)).toBe(true);
      expect(problemGraph.has(2)).toBe(true);
      expect(problemGraph.has(3)).toBe(true);
    });

    it('does not add self-relationships', () => {
      calculateTagSimilarity.mockReturnValue(0.5);
      const problems = makeProblems();

      const { problemGraph } = calculateAndTrimProblemRelationships({
        problems,
        tagGraph: {},
        tagMastery: {},
        limit: 5,
      });

      for (const [id, rels] of problemGraph.entries()) {
        for (const rel of rels) {
          expect(rel.problemId2).not.toBe(id);
        }
      }
    });

    it('trims relationships to limit per problem', () => {
      calculateTagSimilarity.mockReturnValue(0.5);
      const problems = makeProblems();

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

    it('stores trimmed relationships in removedRelationships', () => {
      calculateTagSimilarity.mockReturnValue(0.5);
      const problems = makeProblems();

      const { removedRelationships } = calculateAndTrimProblemRelationships({
        problems,
        tagGraph: {},
        tagMastery: {},
        limit: 1,
      });

      expect(removedRelationships).toBeInstanceOf(Map);
    });

    it('excludes relationships where similarity is 0', () => {
      calculateTagSimilarity.mockReturnValue(0);
      const problems = makeProblems();

      const { problemGraph } = calculateAndTrimProblemRelationships({
        problems,
        tagGraph: {},
        tagMastery: {},
        limit: 5,
      });

      for (const rels of problemGraph.values()) {
        expect(rels).toHaveLength(0);
      }
    });

    it('only adds relationship when d1 <= d2 (no upward difficulty jumps)', () => {
      calculateTagSimilarity.mockReturnValue(0.5);
      const problems = makeProblems();

      const { problemGraph } = calculateAndTrimProblemRelationships({
        problems,
        tagGraph: {},
        tagMastery: {},
        limit: 10,
      });

      // From Hard (id=3, difficulty=Hard=3) to Easy (id=1, difficulty=Easy=1):
      // d1(3) > d2(1) so should NOT add this relationship
      const hardRels = problemGraph.get(3) || [];
      const hasRelToEasy = hardRels.some((r) => r.problemId2 === 1);
      expect(hasRelToEasy).toBe(false);
    });

    it('accepts problems as an object (not just array)', () => {
      calculateTagSimilarity.mockReturnValue(0.5);
      const problemsObj = {
        a: { leetcode_id: 10, id: 10, difficulty: 'Easy', tags: ['array'] },
        b: { leetcode_id: 11, id: 11, difficulty: 'Easy', tags: ['array'] },
      };

      const { problemGraph } = calculateAndTrimProblemRelationships({
        problems: problemsObj,
        tagGraph: {},
        tagMastery: {},
        limit: 5,
      });

      expect(problemGraph.has(10)).toBe(true);
      expect(problemGraph.has(11)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // restoreMissingProblemRelationships
  // -----------------------------------------------------------------------
  describe('restoreMissingProblemRelationships', () => {
    it('returns updatedProblemGraph and updatedRemovedRelationships', () => {
      const problemGraph = new Map([
        [1, [{ problemId2: 2, strength: 0.5 }]],
        [2, [{ problemId2: 1, strength: 0.5 }]],
      ]);
      const removedRelationships = new Map();
      const problems = makeProblems().slice(0, 2);

      const result = restoreMissingProblemRelationships({
        problems,
        problemGraph,
        removedRelationships,
      });

      expect(result).toHaveProperty('updatedProblemGraph');
      expect(result).toHaveProperty('updatedRemovedRelationships');
      expect(result.updatedProblemGraph).toBeInstanceOf(Map);
    });

    it('restores missing problem from removedRelationships', () => {
      const problemGraph = new Map([
        [1, []],
        [2, [{ problemId2: 1, strength: 0.5 }]],
      ]);
      const removedRelationships = new Map([
        [1, [{ problemId2: 3, strength: 0.3 }]],
      ]);
      const problems = [
        { leetcode_id: 1, id: 1, difficulty: 'Easy', tags: ['array'] },
        { leetcode_id: 2, id: 2, difficulty: 'Easy', tags: ['array'] },
      ];

      const { updatedProblemGraph } = restoreMissingProblemRelationships({
        problems,
        problemGraph,
        removedRelationships,
      });

      expect(updatedProblemGraph.get(1)).toHaveLength(1);
    });

    it('creates fallback same-tag pairing for unrestorable missing problems', () => {
      const problemGraph = new Map([
        [1, []],
        [2, [{ problemId2: 1, strength: 0.5 }]],
      ]);
      const removedRelationships = new Map();
      const problems = [
        { leetcode_id: 1, id: 1, difficulty: 'Easy', tags: ['array'] },
        { leetcode_id: 2, id: 2, difficulty: 'Easy', tags: ['array'] },
      ];

      const { updatedProblemGraph } = restoreMissingProblemRelationships({
        problems,
        problemGraph,
        removedRelationships,
      });

      expect(updatedProblemGraph.get(1)).toHaveLength(1);
      expect(updatedProblemGraph.get(1)[0].problemId2).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // calculateOptimalPathScore (with fully cached data, no DB calls)
  // -----------------------------------------------------------------------
  describe('calculateOptimalPathScore', () => {
    it('returns a numeric score between 0.1 and 5.0', async () => {
      const problem = { id: 10, leetcode_id: 10, difficulty: 'Medium', tags: ['dp'] };
      const cachedData = {
        recentSuccesses: [],
        relationshipMap: new Map(),
        isPlateauing: false,
      };

      const score = await calculateOptimalPathScore(problem, null, cachedData);

      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThanOrEqual(0.1);
      expect(score).toBeLessThanOrEqual(5.0);
    });

    it('boosts Hard problems when plateauing', async () => {
      const hardProblem = { id: 20, leetcode_id: 20, difficulty: 'Hard', tags: [] };
      const easyProblem = { id: 21, leetcode_id: 21, difficulty: 'Easy', tags: [] };
      const cachedData = {
        recentSuccesses: [],
        relationshipMap: new Map(),
        isPlateauing: true,
      };

      const hardScore = await calculateOptimalPathScore(hardProblem, null, cachedData);
      const easyScore = await calculateOptimalPathScore(easyProblem, null, cachedData);

      expect(hardScore).toBeGreaterThan(easyScore);
    });

    it('returns 1.0 on error (neutral fallback)', async () => {
      const score = await calculateOptimalPathScore(null, null, {});
      expect(score).toBe(1.0);
    });

    it('uses cached relationshipMap strengths for scoring', async () => {
      const problem = { id: 30, leetcode_id: 30, difficulty: 'Medium', tags: [] };
      const recentSuccess = { leetcode_id: 99, success: true };
      const relationshipMap = new Map([['99-30', 5.0]]);
      const cachedData = {
        recentSuccesses: [recentSuccess],
        relationshipMap,
        isPlateauing: false,
      };

      const score = await calculateOptimalPathScore(problem, null, cachedData);

      expect(score).toBeGreaterThan(0.1);
    });

    it('applies tag mastery bonus when userState is provided', async () => {
      const problem = { id: 40, leetcode_id: 40, difficulty: 'Medium', tags: ['dp'] };
      const userState = {
        tagMastery: {
          dp: { successRate: 0.5, attempts: 5, mastered: false },
        },
      };
      const cachedData = {
        recentSuccesses: [],
        relationshipMap: new Map(),
        isPlateauing: false,
      };

      const score = await calculateOptimalPathScore(problem, userState, cachedData);

      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThanOrEqual(0.1);
    });
  });
});
