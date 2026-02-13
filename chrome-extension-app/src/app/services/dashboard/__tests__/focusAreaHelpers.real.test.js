/**
 * Tests for focusAreaHelpers.js (118 lines, 0% coverage)
 * Pure functions for focus area analytics data transformation.
 */

jest.mock('../../../../shared/services/storage/storageService.js', () => ({
  StorageService: {
    getSettings: jest.fn(),
  },
}));

jest.mock('../../../../shared/utils/leitner/Utils.js', () => ({
  calculateSuccessRate: jest.fn((s, t) => (t > 0 ? s / t : 0)),
}));

import {
  createProblemMappings,
  getTargetFocusAreas,
  filterDataByDateRange,
  calculateFocusAreaPerformance,
  calculateFocusAreaProgress,
  calculateFocusAreaEffectiveness,
} from '../focusAreaHelpers.js';

import { StorageService } from '../../../../shared/services/storage/storageService.js';

describe('focusAreaHelpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------
  // createProblemMappings
  // -------------------------------------------------------------------
  describe('createProblemMappings', () => {
    it('creates standard problems map and problem tags map', () => {
      const allProblems = [
        { problem_id: 'p1', leetcode_id: 1 },
        { problem_id: 'p2', leetcode_id: 2 },
      ];
      const allStandardProblems = [
        { id: 1, tags: ['array', 'hash table'] },
        { id: 2, tags: ['tree'] },
      ];

      const { standardProblemsMap, problemTagsMap } = createProblemMappings(allProblems, allStandardProblems);

      expect(standardProblemsMap.get(1).tags).toEqual(['array', 'hash table']);
      expect(problemTagsMap.get('p1')).toEqual(['array', 'hash table']);
      expect(problemTagsMap.get('p2')).toEqual(['tree']);
    });

    it('handles problems without matching standard problems', () => {
      const allProblems = [{ problem_id: 'p1', leetcode_id: 999 }];
      const allStandardProblems = [{ id: 1, tags: ['array'] }];

      const { problemTagsMap } = createProblemMappings(allProblems, allStandardProblems);
      expect(problemTagsMap.has('p1')).toBe(false);
    });

    it('handles empty inputs', () => {
      const { standardProblemsMap, problemTagsMap } = createProblemMappings([], []);
      expect(standardProblemsMap.size).toBe(0);
      expect(problemTagsMap.size).toBe(0);
    });
  });

  // -------------------------------------------------------------------
  // getTargetFocusAreas
  // -------------------------------------------------------------------
  describe('getTargetFocusAreas', () => {
    it('returns provided focus areas when given', async () => {
      const result = await getTargetFocusAreas(['array', 'tree']);
      expect(result).toEqual(['array', 'tree']);
      expect(StorageService.getSettings).not.toHaveBeenCalled();
    });

    it('fetches from settings when no focus areas provided', async () => {
      StorageService.getSettings.mockResolvedValue({ focusAreas: ['sorting'] });

      const result = await getTargetFocusAreas(null);
      expect(result).toEqual(['sorting']);
    });

    it('returns empty array when no focus areas in settings', async () => {
      StorageService.getSettings.mockResolvedValue({});

      const result = await getTargetFocusAreas(null);
      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------
  // filterDataByDateRange
  // -------------------------------------------------------------------
  describe('filterDataByDateRange', () => {
    const attempts = [
      { AttemptDate: '2024-01-15T00:00:00Z' },
      { AttemptDate: '2024-06-15T00:00:00Z' },
    ];
    const sessions = [
      { date: '2024-01-20T00:00:00Z' },
      { date: '2024-06-20T00:00:00Z' },
    ];

    it('returns all data when no date range specified', () => {
      const result = filterDataByDateRange(attempts, sessions, null, null);
      expect(result.filteredAttempts).toHaveLength(2);
      expect(result.filteredSessions).toHaveLength(2);
    });

    it('filters by start date', () => {
      const result = filterDataByDateRange(attempts, sessions, '2024-03-01T00:00:00Z', null);
      expect(result.filteredAttempts).toHaveLength(1);
      expect(result.filteredAttempts[0].AttemptDate).toBe('2024-06-15T00:00:00Z');
      expect(result.filteredSessions).toHaveLength(1);
    });

    it('filters by end date', () => {
      const result = filterDataByDateRange(attempts, sessions, null, '2024-03-01T00:00:00Z');
      expect(result.filteredAttempts).toHaveLength(1);
      expect(result.filteredSessions).toHaveLength(1);
    });

    it('filters by both start and end date', () => {
      const result = filterDataByDateRange(attempts, sessions, '2024-01-10T00:00:00Z', '2024-02-01T00:00:00Z');
      expect(result.filteredAttempts).toHaveLength(1);
      expect(result.filteredSessions).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------
  // calculateFocusAreaPerformance
  // -------------------------------------------------------------------
  describe('calculateFocusAreaPerformance', () => {
    const problemTagsMap = new Map([
      ['p1', ['array', 'hash table']],
      ['p2', ['array']],
      ['p3', ['tree']],
    ]);
    const allProblems = [
      { problem_id: 'p1', leetcode_id: 1 },
      { problem_id: 'p2', leetcode_id: 2 },
      { problem_id: 'p3', leetcode_id: 3 },
    ];
    const standardProblemsMap = new Map([
      [1, { difficulty: 'Easy' }],
      [2, { difficulty: 'Medium' }],
      [3, { difficulty: 'Hard' }],
    ]);

    it('calculates performance for focus area with attempts', () => {
      const attempts = [
        { ProblemID: 'p1', Success: true, TimeSpent: 600 },
        { ProblemID: 'p2', Success: false, TimeSpent: 1200 },
      ];

      const result = calculateFocusAreaPerformance(
        ['array'],
        attempts,
        allProblems,
        problemTagsMap,
        standardProblemsMap
      );

      expect(result.array.totalAttempts).toBe(2);
      expect(result.array.successfulAttempts).toBe(1);
      expect(result.array.averageTime).toBe(900);
    });

    it('returns zero metrics for focus area with no attempts', () => {
      const result = calculateFocusAreaPerformance(
        ['graph'],
        [],
        allProblems,
        problemTagsMap,
        standardProblemsMap
      );

      expect(result.graph.totalAttempts).toBe(0);
      expect(result.graph.successRate).toBe(0);
      expect(result.graph.recentTrend).toBe('no-data');
    });

    it('calculates difficulty breakdown', () => {
      const attempts = [
        { ProblemID: 'p1', Success: true, TimeSpent: 600 },
      ];

      const result = calculateFocusAreaPerformance(
        ['array'],
        attempts,
        allProblems,
        problemTagsMap,
        standardProblemsMap
      );

      expect(result.array.difficultyBreakdown.Easy.attempts).toBe(1);
      expect(result.array.difficultyBreakdown.Easy.successes).toBe(1);
    });
  });

  // -------------------------------------------------------------------
  // calculateFocusAreaProgress
  // -------------------------------------------------------------------
  describe('calculateFocusAreaProgress', () => {
    it('calculates progress for focus areas', () => {
      const problemTagsMap = new Map([['p1', ['array']]]);
      const attempts = [
        { ProblemID: 'p1', Success: true, AttemptDate: new Date().toISOString() },
      ];
      const learningState = {
        tags: {
          array: { masteryLevel: 'intermediate', completionPercentage: 50, currentStreak: 3 },
        },
      };

      const result = calculateFocusAreaProgress({
        focusAreas: ['array'],
        attempts,
        problemTagsMap,
        learningState,
      });

      expect(result.array.masteryLevel).toBe('intermediate');
      expect(result.array.completionPercentage).toBe(50);
      expect(result.array.problemsSolved).toBe(1);
      expect(result.array.streak).toBe(3);
    });

    it('uses defaults when no learning state for tag', () => {
      const result = calculateFocusAreaProgress({
        focusAreas: ['unknown'],
        attempts: [],
        problemTagsMap: new Map(),
        learningState: {},
      });

      expect(result.unknown.masteryLevel).toBe('beginner');
      expect(result.unknown.completionPercentage).toBe(0);
    });
  });

  // -------------------------------------------------------------------
  // calculateFocusAreaEffectiveness
  // -------------------------------------------------------------------
  describe('calculateFocusAreaEffectiveness', () => {
    it('calculates effectiveness for focus areas with data', () => {
      const performance = {
        array: {
          totalAttempts: 10,
          successRate: 0.7,
          recentTrend: 'improving',
          averageTime: 900,
          difficultyBreakdown: {
            Easy: { attempts: 5, successes: 4 },
            Medium: { attempts: 3, successes: 2 },
            Hard: { attempts: 2, successes: 1 },
          },
        },
      };
      const progressTracking = {
        array: { streak: 4 },
      };

      const result = calculateFocusAreaEffectiveness(
        ['array'],
        performance,
        progressTracking,
        {}
      );

      expect(result.array.score).toBeGreaterThan(0);
      expect(result.array.trend).toBe('improving');
      expect(result.array.strengths.length).toBeGreaterThan(0);
    });

    it('returns no-data for focus areas with no attempts', () => {
      const performance = {
        graph: { totalAttempts: 0, successRate: 0, recentTrend: 'no-data', averageTime: 0 },
      };
      const progressTracking = {
        graph: { streak: 0 },
      };

      const result = calculateFocusAreaEffectiveness(
        ['graph'],
        performance,
        progressTracking,
        {}
      );

      expect(result.graph.score).toBe(0);
      expect(result.graph.trend).toBe('no-data');
      expect(result.graph.weaknesses).toContain('Insufficient practice');
    });

    it('handles missing performance data', () => {
      const result = calculateFocusAreaEffectiveness(
        ['missing'],
        {},
        {},
        {}
      );

      expect(result.missing.score).toBe(0);
      expect(result.missing.trend).toBe('no-data');
    });
  });
});
