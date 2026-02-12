/**
 * Unit tests for recalibrationHelpers.js
 * Tests pure helper functions for decay processing, topic classification,
 * and diagnostic summary generation.
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

import {
  processDecayForProblem,
  classifyTopics,
  createDiagnosticSummary,
  applyBatchUpdates,
  prepareProblemsForRecalibration,
} from '../recalibrationHelpers.js';

const baseConfig = {
  MIN_GAP_DAYS: 3,
  BOX_DECAY_INTERVAL: 14,
  MIN_BOX_LEVEL: 1,
  MIN_STABILITY: 0.1,
  FORGETTING_HALF_LIFE: 30,
  RECALIBRATION_THRESHOLD: 14,
};

describe('recalibrationHelpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // processDecayForProblem
  // -----------------------------------------------------------------------
  describe('processDecayForProblem', () => {
    const getDaysSince = jest.fn();
    const getBoxLevel = jest.fn();

    beforeEach(() => {
      getDaysSince.mockReset();
      getBoxLevel.mockReset();
    });

    it('returns null when daysSinceLastAttempt is below MIN_GAP_DAYS', () => {
      getDaysSince.mockReturnValue(1);
      getBoxLevel.mockReturnValue(3);
      const problem = { id: 1, last_attempt_date: '2024-01-01', box_level: 3 };

      const result = processDecayForProblem(problem, 5, getDaysSince, getBoxLevel, baseConfig);

      expect(result).toBeNull();
    });

    it('returns null when no changes are needed', () => {
      // Days just above MIN_GAP_DAYS but below BOX_DECAY_INTERVAL
      getDaysSince.mockReturnValue(5);
      getBoxLevel.mockReturnValue(3);
      // No stability, days < recalibration threshold
      const problem = { id: 1, last_attempt_date: '2024-01-01', box_level: 3 };

      const result = processDecayForProblem(problem, 5, getDaysSince, getBoxLevel, baseConfig);

      expect(result).toBeNull();
    });

    it('applies box level decay when enough days have passed', () => {
      getDaysSince.mockReturnValue(28); // 2 * BOX_DECAY_INTERVAL = 2 box levels
      getBoxLevel.mockReturnValue(5);
      const problem = { id: 1, last_attempt_date: '2024-01-01', box_level: 5 };

      const result = processDecayForProblem(problem, 5, getDaysSince, getBoxLevel, baseConfig);

      expect(result).not.toBeNull();
      expect(result.box_level).toBe(3); // 5 - 2
      expect(result.original_box_level).toBe(5);
    });

    it('does not decay box level below MIN_BOX_LEVEL', () => {
      getDaysSince.mockReturnValue(56); // Would decay by 4
      getBoxLevel.mockReturnValue(2);
      const problem = { id: 1, last_attempt_date: '2024-01-01', box_level: 2 };

      const result = processDecayForProblem(problem, 5, getDaysSince, getBoxLevel, baseConfig);

      expect(result.box_level).toBe(1); // Clamped at MIN_BOX_LEVEL
    });

    it('applies stability decay using forgetting curve', () => {
      getDaysSince.mockReturnValue(5);
      getBoxLevel.mockReturnValue(3);
      const problem = {
        id: 1,
        last_attempt_date: '2024-01-01',
        box_level: 3,
        stability: 0.9,
      };

      const result = processDecayForProblem(problem, 5, getDaysSince, getBoxLevel, baseConfig);

      expect(result).not.toBeNull();
      expect(result.stability).toBeLessThan(0.9);
      expect(result.stability).toBeGreaterThanOrEqual(baseConfig.MIN_STABILITY);
    });

    it('marks problem for recalibration when threshold exceeded', () => {
      getDaysSince.mockReturnValue(14); // Exactly RECALIBRATION_THRESHOLD
      getBoxLevel.mockReturnValue(3);
      const problem = { id: 1, last_attempt_date: '2024-01-01', box_level: 3 };

      const result = processDecayForProblem(problem, 5, getDaysSince, getBoxLevel, baseConfig);

      expect(result).not.toBeNull();
      expect(result.needs_recalibration).toBe(true);
      expect(result.decay_applied_date).toBeDefined();
    });

    it('uses daysSinceLastUse when last_attempt_date is absent', () => {
      getBoxLevel.mockReturnValue(3);
      const problem = { id: 1, box_level: 3 }; // No last_attempt_date

      // daysSinceLastUse = 1 -> below MIN_GAP_DAYS -> null
      const result = processDecayForProblem(problem, 1, getDaysSince, getBoxLevel, baseConfig);

      expect(result).toBeNull();
      expect(getDaysSince).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // classifyTopics
  // -----------------------------------------------------------------------
  describe('classifyTopics', () => {
    it('classifies topics above threshold as retained', () => {
      const topicPerformance = new Map([['arrays', { correct: 8, total: 10 }]]);

      const { topicsRetained, topicsForgotten } = classifyTopics(topicPerformance);

      expect(topicsRetained).toHaveLength(1);
      expect(topicsRetained[0]).toMatchObject({ tag: 'arrays', accuracy: 80 });
      expect(topicsForgotten).toHaveLength(0);
    });

    it('classifies topics below threshold as forgotten', () => {
      const topicPerformance = new Map([['trees', { correct: 3, total: 10 }]]);

      const { topicsRetained, topicsForgotten } = classifyTopics(topicPerformance);

      expect(topicsForgotten).toHaveLength(1);
      expect(topicsForgotten[0]).toMatchObject({ tag: 'trees', accuracy: 30 });
      expect(topicsRetained).toHaveLength(0);
    });

    it('uses custom threshold', () => {
      const topicPerformance = new Map([
        ['graphs', { correct: 6, total: 10 }], // 60% - above 0.5
        ['dp', { correct: 4, total: 10 }],     // 40% - below 0.5
      ]);

      const { topicsRetained, topicsForgotten } = classifyTopics(topicPerformance, 0.5);

      expect(topicsRetained).toHaveLength(1);
      expect(topicsRetained[0].tag).toBe('graphs');
      expect(topicsForgotten).toHaveLength(1);
      expect(topicsForgotten[0].tag).toBe('dp');
    });

    it('returns empty arrays for empty input', () => {
      const { topicsRetained, topicsForgotten } = classifyTopics(new Map());

      expect(topicsRetained).toHaveLength(0);
      expect(topicsForgotten).toHaveLength(0);
    });

    it('rounds accuracy percentages correctly', () => {
      const topicPerformance = new Map([['sorting', { correct: 1, total: 3 }]]); // 33.33...%

      const { topicsForgotten } = classifyTopics(topicPerformance);

      expect(topicsForgotten[0].accuracy).toBe(33);
    });
  });

  // -----------------------------------------------------------------------
  // createDiagnosticSummary
  // -----------------------------------------------------------------------
  describe('createDiagnosticSummary', () => {
    it('returns correct shape', () => {
      const result = createDiagnosticSummary(0.8, 10, ['arrays'], ['trees'], 3);

      expect(result).toMatchObject({
        totalProblems: 10,
        accuracy: 80,
        topicsRetained: ['arrays'],
        topicsForgotten: ['trees'],
        problemsRecalibrated: 3,
        message: expect.any(String),
      });
    });

    it('returns positive message for high accuracy (>= 0.7)', () => {
      const { message } = createDiagnosticSummary(0.75, 5, [], [], 0);

      expect(message).toContain('Great retention');
    });

    it('returns moderate message for mid accuracy (0.4 - 0.7)', () => {
      const { message } = createDiagnosticSummary(0.5, 5, [], [], 0);

      expect(message).toContain('Some topics need refreshing');
    });

    it('returns decay message for low accuracy (< 0.4)', () => {
      const { message } = createDiagnosticSummary(0.2, 5, [], [], 0);

      expect(message).toContain('Significant decay detected');
    });

    it('rounds accuracy to nearest percent', () => {
      const { accuracy } = createDiagnosticSummary(0.666, 10, [], [], 0);

      expect(accuracy).toBe(67);
    });
  });

  // -----------------------------------------------------------------------
  // applyBatchUpdates
  // -----------------------------------------------------------------------
  describe('applyBatchUpdates', () => {
    it('resolves with total count of updated problems', async () => {
      const mockTransaction = {
        objectStore: jest.fn().mockReturnValue({ put: jest.fn() }),
        oncomplete: null,
        onerror: null,
      };
      const mockDb = {
        transaction: jest.fn().mockReturnValue(mockTransaction),
      };

      const problems = [{ id: 1 }, { id: 2 }, { id: 3 }];

      const promise = applyBatchUpdates(mockDb, problems, 100);

      // Trigger oncomplete
      mockTransaction.oncomplete();

      const result = await promise;
      expect(result).toBe(3);
    });

    it('returns 0 for empty problems array', async () => {
      const mockDb = { transaction: jest.fn() };

      const result = await applyBatchUpdates(mockDb, []);

      expect(result).toBe(0);
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // prepareProblemsForRecalibration
  // -----------------------------------------------------------------------
  describe('prepareProblemsForRecalibration', () => {
    it('returns problems with box_level decremented for failed attempts', async () => {
      const mockProblem = { leetcode_id: 1, box_level: 3 };
      const problemRequest = {
        onsuccess: null,
        onerror: null,
        result: mockProblem,
      };
      const mockStore = { get: jest.fn().mockReturnValue(problemRequest) };
      const mockTransaction = { objectStore: jest.fn().mockReturnValue(mockStore) };
      const mockDb = { transaction: jest.fn().mockReturnValue(mockTransaction) };

      const getBoxLevel = jest.fn().mockReturnValue(3);
      const problemResults = [{ problemId: 1, success: false }];

      const promise = prepareProblemsForRecalibration(mockDb, problemResults, getBoxLevel);

      // Trigger onsuccess
      problemRequest.onsuccess();

      const result = await promise;

      expect(result).toHaveLength(1);
      expect(result[0].box_level).toBe(2); // 3 - 1
      expect(result[0].diagnostic_recalibrated).toBe(true);
    });

    it('skips successful attempts', async () => {
      const mockStore = { get: jest.fn() };
      const mockTransaction = { objectStore: jest.fn().mockReturnValue(mockStore) };
      const mockDb = { transaction: jest.fn().mockReturnValue(mockTransaction) };
      const getBoxLevel = jest.fn();
      const problemResults = [{ problemId: 1, success: true }];

      const result = await prepareProblemsForRecalibration(mockDb, problemResults, getBoxLevel);

      expect(result).toHaveLength(0);
      expect(mockStore.get).not.toHaveBeenCalled();
    });
  });
});
