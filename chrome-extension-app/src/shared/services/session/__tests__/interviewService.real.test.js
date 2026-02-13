/**
 * InterviewService comprehensive tests.
 *
 * All external dependencies (StorageService, DB stores, dashboardService)
 * are mocked so we can exercise every static method in isolation.
 */

// ---------------------------------------------------------------------------
// 1. Mocks (hoisted before imports)
// ---------------------------------------------------------------------------
jest.mock('../../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
  },
}));

jest.mock('../../storage/storageService.js', () => ({
  StorageService: {
    getSettings: jest.fn().mockResolvedValue({ sessionLength: 5 }),
    setSettings: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../../db/stores/tag_mastery.js', () => ({
  getTagMastery: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../../db/stores/sessions.js', () => ({
  getSessionPerformance: jest.fn().mockResolvedValue({ accuracy: 0 }),
}));

jest.mock('../../../../app/services/dashboard/dashboardService.js', () => ({
  getInterviewAnalyticsData: jest.fn().mockResolvedValue({
    metrics: null,
    analytics: [],
  }),
}));

// ---------------------------------------------------------------------------
// 2. Imports (run after mocks are applied)
// ---------------------------------------------------------------------------
import { InterviewService } from '../interviewService.js';
import { StorageService } from '../../storage/storageService.js';
import { getTagMastery } from '../../../db/stores/tag_mastery.js';
import { getSessionPerformance } from '../../../db/stores/sessions.js';
import { getInterviewAnalyticsData } from '../../../../app/services/dashboard/dashboardService.js';

// ---------------------------------------------------------------------------
// 3. Tests
// ---------------------------------------------------------------------------
describe('InterviewService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // INTERVIEW_CONFIGS
  // =========================================================================
  describe('INTERVIEW_CONFIGS', () => {
    it('should define standard, interview-like, and full-interview modes', () => {
      expect(InterviewService.INTERVIEW_CONFIGS).toHaveProperty('standard');
      expect(InterviewService.INTERVIEW_CONFIGS).toHaveProperty('interview-like');
      expect(InterviewService.INTERVIEW_CONFIGS).toHaveProperty('full-interview');
    });

    it('standard mode should have null session length and full support', () => {
      const config = InterviewService.INTERVIEW_CONFIGS['standard'];
      expect(config.sessionLength).toBeNull();
      expect(config.hints.max).toBeNull();
      expect(config.uiMode).toBe('full-support');
    });

    it('interview-like mode should have pressure but no hard cutoff', () => {
      const config = InterviewService.INTERVIEW_CONFIGS['interview-like'];
      expect(config.timing.pressure).toBe(true);
      expect(config.timing.hardCutoff).toBe(false);
      expect(config.hints.max).toBe(2);
    });

    it('full-interview mode should have hard cutoff and no hints', () => {
      const config = InterviewService.INTERVIEW_CONFIGS['full-interview'];
      expect(config.timing.hardCutoff).toBe(true);
      expect(config.hints.max).toBe(0);
      expect(config.primers.available).toBe(false);
    });
  });

  // =========================================================================
  // getInterviewConfig
  // =========================================================================
  describe('getInterviewConfig', () => {
    it('should return config for valid mode', () => {
      const config = InterviewService.getInterviewConfig('interview-like');
      expect(config.uiMode).toBe('pressure-indicators');
    });

    it('should return standard config for unknown mode', () => {
      const config = InterviewService.getInterviewConfig('nonexistent');
      expect(config.uiMode).toBe('full-support');
    });
  });

  // =========================================================================
  // assessInterviewReadiness
  // =========================================================================
  describe('assessInterviewReadiness', () => {
    it('should unlock interview-like mode with good performance and mastered tags', async () => {
      getSessionPerformance.mockResolvedValue({ accuracy: 0.8 });
      getTagMastery.mockResolvedValue([
        { mastered: true, tag: 'arrays', totalAttempts: 20, successfulAttempts: 15 },
        { mastered: true, tag: 'strings', totalAttempts: 15, successfulAttempts: 10 },
        { mastered: true, tag: 'dp', totalAttempts: 25, successfulAttempts: 20 },
        { mastered: false, tag: 'graphs', totalAttempts: 5, successfulAttempts: 2 },
      ]);

      const result = await InterviewService.assessInterviewReadiness();

      expect(result.interviewLikeUnlocked).toBe(true);
      expect(result.metrics.accuracy).toBe(0.8);
      expect(result.metrics.masteredTagsCount).toBe(3);
      expect(result.metrics.totalTags).toBe(4);
    });

    it('should not unlock interview-like mode with low accuracy', async () => {
      getSessionPerformance.mockResolvedValue({ accuracy: 0.5 });
      getTagMastery.mockResolvedValue([
        { mastered: true, tag: 'arrays', totalAttempts: 20, successfulAttempts: 15 },
        { mastered: true, tag: 'strings', totalAttempts: 15, successfulAttempts: 10 },
        { mastered: true, tag: 'dp', totalAttempts: 10, successfulAttempts: 8 },
      ]);

      const result = await InterviewService.assessInterviewReadiness();

      expect(result.interviewLikeUnlocked).toBe(false);
      expect(result.reasoning).toContain('70%+');
    });

    it('should not unlock interview-like mode with too few mastered tags', async () => {
      getSessionPerformance.mockResolvedValue({ accuracy: 0.85 });
      getTagMastery.mockResolvedValue([
        { mastered: true, tag: 'arrays', totalAttempts: 20, successfulAttempts: 15 },
        { mastered: false, tag: 'strings', totalAttempts: 15, successfulAttempts: 10 },
      ]);

      const result = await InterviewService.assessInterviewReadiness();

      expect(result.interviewLikeUnlocked).toBe(false);
      expect(result.reasoning).toContain('mastered tags');
    });

    it('should unlock full-interview when all conditions met', async () => {
      getSessionPerformance.mockResolvedValue({ accuracy: 0.9 });
      getTagMastery.mockResolvedValue([
        { mastered: true, tag: 'arrays', totalAttempts: 30, successfulAttempts: 25 },
        { mastered: true, tag: 'strings', totalAttempts: 20, successfulAttempts: 15 },
        { mastered: true, tag: 'dp', totalAttempts: 25, successfulAttempts: 20 },
        { mastered: true, tag: 'graphs', totalAttempts: 15, successfulAttempts: 12 },
      ]);

      const result = await InterviewService.assessInterviewReadiness();

      // With high accuracy and transfer readiness, full interview should be unlocked
      expect(result.interviewLikeUnlocked).toBe(true);
      // Full interview depends on transferReadinessScore >= 0.7 && accuracy >= 0.8
      // calculateCurrentTransferReadiness with 4 mastered of 4 tags and 90 attempts
      // masteryRatio = 1.0, experienceScore = min(90/50, 1) = 1.0
      // score = 1.0 * 0.7 + 1.0 * 0.3 = 1.0
      expect(result.fullInterviewUnlocked).toBe(true);
    });

    it('should return fallback on error', async () => {
      getSessionPerformance.mockRejectedValue(new Error('DB error'));

      const result = await InterviewService.assessInterviewReadiness();

      expect(result.interviewLikeUnlocked).toBe(true);
      expect(result.fullInterviewUnlocked).toBe(true);
      expect(result.reasoning).toContain('Fallback');
    });

    it('should handle null tagMastery', async () => {
      getSessionPerformance.mockResolvedValue({ accuracy: 0.8 });
      getTagMastery.mockResolvedValue(null);

      const result = await InterviewService.assessInterviewReadiness();

      expect(result.metrics.masteredTagsCount).toBe(0);
      expect(result.metrics.totalTags).toBe(0);
    });

    it('should handle missing accuracy in performance data', async () => {
      getSessionPerformance.mockResolvedValue({});
      getTagMastery.mockResolvedValue([]);

      const result = await InterviewService.assessInterviewReadiness();

      expect(result.metrics.accuracy).toBe(0);
    });

    it('should provide correct reasoning when interview-like unlocked but full not', async () => {
      getSessionPerformance.mockResolvedValue({ accuracy: 0.75 });
      getTagMastery.mockResolvedValue([
        { mastered: true, tag: 'a', totalAttempts: 5, successfulAttempts: 4 },
        { mastered: true, tag: 'b', totalAttempts: 5, successfulAttempts: 4 },
        { mastered: true, tag: 'c', totalAttempts: 5, successfulAttempts: 4 },
      ]);

      const result = await InterviewService.assessInterviewReadiness();

      expect(result.interviewLikeUnlocked).toBe(true);
      // transferReadinessScore = (1.0*0.7) + (min(15/50,1)*0.3) = 0.7 + 0.09 = 0.79
      // But accuracy (0.75) < 0.8 so fullInterviewUnlocked = false
      expect(result.fullInterviewUnlocked).toBe(false);
    });
  });

  // =========================================================================
  // calculateCurrentTransferReadiness
  // =========================================================================
  describe('calculateCurrentTransferReadiness', () => {
    it('should return 0 with no attempts', () => {
      const result = InterviewService.calculateCurrentTransferReadiness([
        { mastered: true, totalAttempts: 0 },
      ]);
      expect(result).toBe(0);
    });

    it('should return 0 with empty array', () => {
      const result = InterviewService.calculateCurrentTransferReadiness([]);
      expect(result).toBe(0);
    });

    it('should return 0 with undefined input', () => {
      const result = InterviewService.calculateCurrentTransferReadiness();
      expect(result).toBe(0);
    });

    it('should calculate score based on mastery ratio and experience', () => {
      const tagMastery = [
        { mastered: true, totalAttempts: 25 },
        { mastered: true, totalAttempts: 25 },
        { mastered: false, totalAttempts: 10 },
      ];

      const result = InterviewService.calculateCurrentTransferReadiness(tagMastery);

      // masteryRatio = 2/3 = 0.667
      // experienceScore = min(60/50, 1) = 1.0
      // score = 0.667 * 0.7 + 1.0 * 0.3 = 0.467 + 0.3 = 0.767
      expect(result).toBeCloseTo(0.767, 2);
    });

    it('should cap experience score at 1.0', () => {
      const tagMastery = [
        { mastered: true, totalAttempts: 100 },
      ];

      const result = InterviewService.calculateCurrentTransferReadiness(tagMastery);

      // masteryRatio = 1.0, experienceScore = min(100/50, 1) = 1.0
      // score = 1.0 * 0.7 + 1.0 * 0.3 = 1.0
      expect(result).toBeCloseTo(1.0);
    });
  });

  // =========================================================================
  // createInterviewSession
  // =========================================================================
  describe('createInterviewSession', () => {
    it('should create standard session using adaptive length', async () => {
      StorageService.getSettings.mockResolvedValue({ sessionLength: 7 });
      getTagMastery.mockResolvedValue([
        { mastered: true, tag: 'arrays', totalAttempts: 10, successfulAttempts: 8 },
      ]);

      const result = await InterviewService.createInterviewSession('standard');

      expect(result.sessionType).toBe('standard');
      expect(result.sessionLength).toBe(7);
      expect(result.config).toBeDefined();
      expect(result.selectionCriteria).toBeDefined();
      expect(result.interviewMetrics).toBeDefined();
      expect(result.createdAt).toBeDefined();
    });

    it('should create interview-like session with random length in range', async () => {
      StorageService.getSettings.mockResolvedValue({});
      getTagMastery.mockResolvedValue([]);

      const result = await InterviewService.createInterviewSession('interview-like');

      expect(result.sessionType).toBe('interview-like');
      expect(result.sessionLength).toBeGreaterThanOrEqual(3);
      expect(result.sessionLength).toBeLessThanOrEqual(5);
    });

    it('should create full-interview session', async () => {
      StorageService.getSettings.mockResolvedValue({});
      getTagMastery.mockResolvedValue([]);

      const result = await InterviewService.createInterviewSession('full-interview');

      expect(result.sessionType).toBe('full-interview');
      expect(result.sessionLength).toBeGreaterThanOrEqual(3);
      expect(result.sessionLength).toBeLessThanOrEqual(4);
    });

    it('should throw on timeout error from getTagMastery', async () => {
      StorageService.getSettings.mockResolvedValue({ sessionLength: 5 });
      getTagMastery.mockRejectedValue(new Error('InterviewService.createInterviewSession timed out after 8000ms'));

      await expect(
        InterviewService.createInterviewSession('interview-like')
      ).rejects.toThrow('Interview session creation timed out');
    });

    it('should return fallback session on generic error', async () => {
      StorageService.getSettings.mockResolvedValue({ sessionLength: 5 });
      getTagMastery.mockRejectedValue(new Error('DB connection failed'));

      const result = await InterviewService.createInterviewSession('standard');

      expect(result.fallbackMode).toBe(true);
      expect(result.selectionCriteria.difficulty).toBe('adaptive');
    });

    it('should wrap timeout errors with specific message', async () => {
      StorageService.getSettings.mockResolvedValue({ sessionLength: 5 });
      getTagMastery.mockImplementation(() =>
        new Promise((_, reject) => {
          reject(new Error('InterviewService.createInterviewSession timed out after 8000ms'));
        })
      );

      await expect(
        InterviewService.createInterviewSession('standard')
      ).rejects.toThrow('Interview session creation timed out');
    });

    it('should use default sessionLength when settings lack it', async () => {
      StorageService.getSettings.mockResolvedValue({});
      getTagMastery.mockResolvedValue([]);

      const result = await InterviewService.createInterviewSession('standard');

      expect(result.sessionLength).toBe(5); // Default from || 5
    });
  });

  // =========================================================================
  // buildInterviewProblemCriteria
  // =========================================================================
  describe('buildInterviewProblemCriteria', () => {
    it('should return adaptive criteria for standard mode', () => {
      const tagMastery = [
        { mastered: true, tag: 'arrays', totalAttempts: 10, successfulAttempts: 8 },
        { mastered: false, tag: 'dp', totalAttempts: 5, successfulAttempts: 3 },
        { mastered: false, tag: 'graphs', totalAttempts: 1, successfulAttempts: 0 },
      ];
      const config = InterviewService.getInterviewConfig('standard');

      const result = InterviewService.buildInterviewProblemCriteria('standard', config, tagMastery);

      expect(result.difficulty).toBe('adaptive');
      expect(result.reviewRatio).toBe(0.4);
      expect(result.allowedTags).toContain('arrays');
      expect(result.allowedTags).toContain('dp');
      // graphs has only 1 attempt, 0 successful - not near mastery
      expect(result.allowedTags).not.toContain('graphs');
    });

    it('should return balanced criteria for interview-like mode', () => {
      const tagMastery = [
        { mastered: true, tag: 'arrays', totalAttempts: 20, successfulAttempts: 15 },
        { mastered: false, tag: 'dp', totalAttempts: 5, successfulAttempts: 3 },
      ];
      const config = InterviewService.getInterviewConfig('interview-like');

      const result = InterviewService.buildInterviewProblemCriteria('interview-like', config, tagMastery);

      expect(result.difficulty).toBe('balanced');
      expect(result.reviewRatio).toBe(0);
      expect(result.problemMix).toBeDefined();
      expect(result.masteredTags).toContain('arrays');
      expect(result.nearMasteryTags).toContain('dp');
    });

    it('should handle empty tagMastery', () => {
      const config = InterviewService.getInterviewConfig('interview-like');

      const result = InterviewService.buildInterviewProblemCriteria('interview-like', config, []);

      expect(result.masteredTags).toEqual([]);
      expect(result.nearMasteryTags).toEqual([]);
      expect(result.allowedTags).toEqual([]);
    });

    it('should handle undefined tagMastery', () => {
      const config = InterviewService.getInterviewConfig('standard');

      const result = InterviewService.buildInterviewProblemCriteria('standard', config);

      expect(result.allowedTags).toEqual([]);
    });
  });

  // =========================================================================
  // initializeInterviewMetrics
  // =========================================================================
  describe('initializeInterviewMetrics', () => {
    it('should return empty metrics structure', () => {
      const metrics = InterviewService.initializeInterviewMetrics();

      expect(metrics.transferReadinessScore).toBeNull();
      expect(metrics.interventionNeedScore).toBeNull();
      expect(metrics.tagPerformance).toBeInstanceOf(Map);
      expect(metrics.overallMetrics.transferAccuracy).toBeNull();
      expect(metrics.overallMetrics.speedDelta).toBeNull();
      expect(metrics.overallMetrics.hintPressure).toBeNull();
      expect(metrics.overallMetrics.approachLatency).toBeNull();
      expect(metrics.feedbackGenerated.strengths).toEqual([]);
      expect(metrics.feedbackGenerated.improvements).toEqual([]);
      expect(metrics.feedbackGenerated.nextActions).toEqual([]);
    });
  });

  // =========================================================================
  // calculateTransferMetrics
  // =========================================================================
  describe('calculateTransferMetrics', () => {
    it('should return initialized metrics for empty attempts', () => {
      const result = InterviewService.calculateTransferMetrics([]);
      expect(result.transferReadinessScore).toBeNull();
      expect(result.tagPerformance).toBeInstanceOf(Map);
    });

    it('should return initialized metrics for null attempts', () => {
      const result = InterviewService.calculateTransferMetrics(null);
      expect(result.transferReadinessScore).toBeNull();
    });

    it('should calculate complete transfer metrics', () => {
      const attempts = [
        {
          interviewSignals: { transferAccuracy: true, speedDelta: -0.1, hintPressure: 0.1, timeToFirstPlanMs: 60000 },
          timeSpent: 300000,
          tags: ['arrays'],
          success: true,
          hintsUsed: 0,
        },
        {
          interviewSignals: { transferAccuracy: true, speedDelta: 0.2, hintPressure: 0.3, timeToFirstPlanMs: 120000 },
          timeSpent: 450000,
          tags: ['arrays', 'dp'],
          success: true,
          hintsUsed: 1,
        },
        {
          interviewSignals: { transferAccuracy: false, speedDelta: 0.5, hintPressure: 0.8, timeToFirstPlanMs: 240000 },
          timeSpent: 600000,
          tags: ['dp'],
          success: false,
          hintsUsed: 2,
        },
      ];

      const result = InterviewService.calculateTransferMetrics(attempts, {});

      expect(result.transferReadinessScore).toBeGreaterThan(0);
      expect(result.transferReadinessScore).toBeLessThanOrEqual(1);
      expect(result.interventionNeedScore).toBeDefined();
      // TRS + INS should equal 1
      expect(result.transferReadinessScore + result.interventionNeedScore).toBeCloseTo(1);
      expect(result.tagPerformance).toBeInstanceOf(Map);
      expect(result.overallMetrics.transferAccuracy).toBeCloseTo(2 / 3);
      expect(result.feedbackGenerated).toBeDefined();
    });

    it('should return initialized metrics on error', () => {
      // Pass malformed data that might cause issues
      const result = InterviewService.calculateTransferMetrics(
        [{ interviewSignals: null }],
        {}
      );

      // The function filters by interviewSignals properties, so this should work
      expect(result).toBeDefined();
    });
  });

  // =========================================================================
  // calculateTransferAccuracy
  // =========================================================================
  describe('calculateTransferAccuracy', () => {
    it('should calculate accuracy from transfer attempts', () => {
      const attempts = [
        { interviewSignals: { transferAccuracy: true } },
        { interviewSignals: { transferAccuracy: true } },
        { interviewSignals: { transferAccuracy: false } },
      ];

      const result = InterviewService.calculateTransferAccuracy(attempts);
      expect(result).toBeCloseTo(2 / 3);
    });

    it('should return 0 with no valid transfer attempts', () => {
      const attempts = [
        { interviewSignals: { speedDelta: 0.1 } }, // No transferAccuracy boolean
        { interviewSignals: {} },
      ];

      const result = InterviewService.calculateTransferAccuracy(attempts);
      expect(result).toBe(0);
    });

    it('should return 0 with empty attempts', () => {
      expect(InterviewService.calculateTransferAccuracy([])).toBe(0);
    });
  });

  // =========================================================================
  // calculateSpeedDelta
  // =========================================================================
  describe('calculateSpeedDelta', () => {
    it('should calculate average speed delta', () => {
      const attempts = [
        { timeSpent: 100, interviewSignals: { speedDelta: 0.2 } },
        { timeSpent: 200, interviewSignals: { speedDelta: 0.4 } },
      ];

      const result = InterviewService.calculateSpeedDelta(attempts, {});
      expect(result).toBeCloseTo(0.3);
    });

    it('should return 0 with no valid attempts', () => {
      const attempts = [
        { interviewSignals: {} },
        { timeSpent: null, interviewSignals: { speedDelta: 0.1 } }, // missing timeSpent
      ];

      const result = InterviewService.calculateSpeedDelta(attempts, {});
      expect(result).toBe(0);
    });

    it('should return 0 with empty attempts', () => {
      expect(InterviewService.calculateSpeedDelta([], {})).toBe(0);
    });
  });

  // =========================================================================
  // calculateHintPressure
  // =========================================================================
  describe('calculateHintPressure', () => {
    it('should calculate average hint pressure', () => {
      const attempts = [
        { interviewSignals: { hintPressure: 0.5 } },
        { interviewSignals: { hintPressure: 1.5 } },
      ];

      const result = InterviewService.calculateHintPressure(attempts);
      expect(result).toBeCloseTo(1.0);
    });

    it('should return 0 with no valid attempts', () => {
      expect(InterviewService.calculateHintPressure([{ interviewSignals: {} }])).toBe(0);
    });

    it('should return 0 with empty attempts', () => {
      expect(InterviewService.calculateHintPressure([])).toBe(0);
    });
  });

  // =========================================================================
  // calculateApproachLatency
  // =========================================================================
  describe('calculateApproachLatency', () => {
    it('should calculate average approach latency', () => {
      const attempts = [
        { interviewSignals: { timeToFirstPlanMs: 60000 } },
        { interviewSignals: { timeToFirstPlanMs: 120000 } },
      ];

      const result = InterviewService.calculateApproachLatency(attempts);
      expect(result).toBe(90000);
    });

    it('should return 0 with no valid attempts', () => {
      expect(InterviewService.calculateApproachLatency([{ interviewSignals: {} }])).toBe(0);
    });

    it('should return 0 with empty attempts', () => {
      expect(InterviewService.calculateApproachLatency([])).toBe(0);
    });
  });

  // =========================================================================
  // calculateTransferReadinessScore
  // =========================================================================
  describe('calculateTransferReadinessScore', () => {
    it('should calculate composite TRS from metrics', () => {
      const metrics = {
        transferAccuracy: 0.8,
        speedDelta: 0.1,
        hintPressure: 0.2,
        approachLatency: 60000, // 1 minute
      };

      const result = InterviewService.calculateTransferReadinessScore(metrics);

      // TA=35%, Speed=25%, Hints=20%, Approach=20%
      // normalizedSpeed = max(0, 1-max(0, 0.1)) = 0.9
      // normalizedHints = max(0, 1-(0.2/2)) = 0.9
      // normalizedLatency = max(0, 1-(60000/(5*60000))) = 1 - 0.2 = 0.8
      // TRS = 0.8*0.35 + 0.9*0.25 + 0.9*0.20 + 0.8*0.20
      //     = 0.28 + 0.225 + 0.18 + 0.16 = 0.845
      expect(result).toBeCloseTo(0.845, 2);
    });

    it('should return high score for perfect metrics', () => {
      const metrics = {
        transferAccuracy: 1.0,
        speedDelta: -0.5, // Faster
        hintPressure: 0,
        approachLatency: 0,
      };

      const result = InterviewService.calculateTransferReadinessScore(metrics);
      expect(result).toBeCloseTo(1.0);
    });

    it('should handle poor metrics gracefully', () => {
      const metrics = {
        transferAccuracy: 0,
        speedDelta: 2.0,
        hintPressure: 5.0,
        approachLatency: 10 * 60000, // 10 minutes
      };

      const result = InterviewService.calculateTransferReadinessScore(metrics);
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  // =========================================================================
  // analyzeTagInterviewPerformance
  // =========================================================================
  describe('analyzeTagInterviewPerformance', () => {
    it('should aggregate performance by tag', () => {
      const attempts = [
        { tags: ['arrays'], success: true, timeSpent: 300, hintsUsed: 0, interviewSignals: { transferAccuracy: true } },
        { tags: ['arrays', 'dp'], success: false, timeSpent: 500, hintsUsed: 1, interviewSignals: { transferAccuracy: false } },
        { tags: ['dp'], success: true, timeSpent: 200, hintsUsed: 0 },
      ];

      const result = InterviewService.analyzeTagInterviewPerformance(attempts);

      expect(result.get('arrays').attempts).toBe(2);
      expect(result.get('arrays').successes).toBe(1);
      expect(result.get('arrays').totalTime).toBe(800);
      expect(result.get('arrays').hintUses).toBe(1);
      expect(result.get('arrays').transferAccuracies).toEqual([true, false]);

      expect(result.get('dp').attempts).toBe(2);
      expect(result.get('dp').successes).toBe(1);
      expect(result.get('dp').totalTime).toBe(700);
    });

    it('should handle attempts with no tags', () => {
      const attempts = [
        { tags: [], success: true, timeSpent: 100, hintsUsed: 0 },
      ];

      const result = InterviewService.analyzeTagInterviewPerformance(attempts);
      expect(result.size).toBe(0);
    });
  });

  // =========================================================================
  // generateInterviewFeedback
  // =========================================================================
  describe('generateInterviewFeedback', () => {
    it('should generate strengths for excellent metrics', () => {
      const metrics = {
        transferAccuracy: 0.9,
        speedDelta: -0.1,
        hintPressure: 0.1,
        approachLatency: 60000,
      };

      const feedback = InterviewService.generateInterviewFeedback(metrics, 0.9);

      expect(feedback.strengths).toContain('Excellent first-attempt accuracy under pressure');
      expect(feedback.strengths).toContain('Maintained or improved speed in interview conditions');
      expect(feedback.strengths).toContain('Low dependency on hints during problem solving');
      expect(feedback.strengths).toContain('Quick problem approach identification');
      expect(feedback.nextActions).toContain('Ready for Full Interview mode or real interviews');
    });

    it('should generate improvements for poor metrics', () => {
      const metrics = {
        transferAccuracy: 0.4,
        speedDelta: 0.5,
        hintPressure: 0.8,
        approachLatency: 4 * 60000,
      };

      const feedback = InterviewService.generateInterviewFeedback(metrics, 0.3);

      expect(feedback.improvements).toContain('Practice pattern transfer without hints');
      expect(feedback.improvements).toContain('Work on speed optimization for mastered patterns');
      expect(feedback.improvements).toContain('Build independence from hint system');
      expect(feedback.improvements).toContain('Practice quick problem categorization skills');
      expect(feedback.nextActions).toContain('Focus on mastering fundamental patterns before interview practice');
    });

    it('should suggest continuing interview-like mode for mid-range scores', () => {
      const feedback = InterviewService.generateInterviewFeedback(
        { transferAccuracy: 0.7, speedDelta: 0.1, hintPressure: 0.3, approachLatency: 150000 },
        0.6
      );

      expect(feedback.nextActions).toContain('Continue Interview-Like mode to build confidence');
    });

    it('should handle edge case metrics', () => {
      const feedback = InterviewService.generateInterviewFeedback(
        { transferAccuracy: 0.6, speedDelta: 0.3, hintPressure: 0.2, approachLatency: 2 * 60000 },
        0.5
      );

      // Should not have strengths for borderline values
      expect(feedback.strengths).not.toContain('Excellent first-attempt accuracy under pressure');
    });
  });

  // =========================================================================
  // updateAdaptiveLearning
  // =========================================================================
  describe('updateAdaptiveLearning', () => {
    it('should log interview insights without throwing', () => {
      const interviewResults = {
        interventionNeedScore: 0.6,
        tagPerformance: new Map([['arrays', { attempts: 5 }]]),
        transferReadinessScore: 0.4,
      };

      // Should not throw
      expect(() => {
        InterviewService.updateAdaptiveLearning(interviewResults);
      }).not.toThrow();
    });

    it('should handle errors gracefully', () => {
      // Pass something that will cause errors in Map.entries()
      expect(() => {
        InterviewService.updateAdaptiveLearning({
          interventionNeedScore: null,
          tagPerformance: new Map(),
          transferReadinessScore: null,
        });
      }).not.toThrow();
    });
  });

  // =========================================================================
  // getInterviewInsightsForAdaptiveLearning
  // =========================================================================
  describe('getInterviewInsightsForAdaptiveLearning', () => {
    it('should return no data when interview mode is disabled', async () => {
      StorageService.getSettings.mockResolvedValue({
        interviewMode: { enabled: false },
      });

      const result = await InterviewService.getInterviewInsightsForAdaptiveLearning();

      expect(result.hasInterviewData).toBe(false);
      expect(result.recommendations.sessionLengthAdjustment).toBe(0);
    });

    it('should return no data when interview mode is not set', async () => {
      StorageService.getSettings.mockResolvedValue({});

      const result = await InterviewService.getInterviewInsightsForAdaptiveLearning();

      expect(result.hasInterviewData).toBe(false);
    });

    it('should return insights when interview data exists', async () => {
      StorageService.getSettings.mockResolvedValue({
        interviewMode: { enabled: true },
      });
      getInterviewAnalyticsData.mockResolvedValue({
        metrics: {
          transferAccuracy: 0.7,
          avgSpeedDelta: 0.2,
          avgHintPressure: 0.5,
          tagPerformance: [
            { tagName: 'arrays', transferAccuracy: 0.8 },
            { tagName: 'dp', transferAccuracy: 0.4 },
          ],
        },
        analytics: [{ id: 1 }, { id: 2 }],
      });

      const result = await InterviewService.getInterviewInsightsForAdaptiveLearning();

      expect(result.hasInterviewData).toBe(true);
      expect(result.recentSessionCount).toBe(2);
      expect(result.transferAccuracy).toBe(0.7);
      expect(result.speedDelta).toBe(0.2);
      expect(result.recommendations).toBeDefined();
      expect(result.recommendations.weakTags).toContain('dp');
    });

    it('should return no data when no analytics sessions exist', async () => {
      StorageService.getSettings.mockResolvedValue({
        interviewMode: { enabled: true },
      });
      getInterviewAnalyticsData.mockResolvedValue({
        metrics: null,
        analytics: [],
      });

      const result = await InterviewService.getInterviewInsightsForAdaptiveLearning();

      expect(result.hasInterviewData).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      StorageService.getSettings.mockRejectedValue(new Error('Settings error'));

      const result = await InterviewService.getInterviewInsightsForAdaptiveLearning();

      expect(result.hasInterviewData).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });
  });

  // =========================================================================
  // Adjustment calculation methods
  // =========================================================================
  describe('calculateSessionLengthAdjustment', () => {
    it('should return +1 for poor transfer accuracy', () => {
      expect(InterviewService.calculateSessionLengthAdjustment(0.5, 0.1)).toBe(1);
    });

    it('should return -1 for slow speed', () => {
      expect(InterviewService.calculateSessionLengthAdjustment(0.7, 0.5)).toBe(-1);
    });

    it('should return +1 for excellent performance', () => {
      expect(InterviewService.calculateSessionLengthAdjustment(0.9, 0.1)).toBe(1);
    });

    it('should return 0 for average performance', () => {
      expect(InterviewService.calculateSessionLengthAdjustment(0.7, 0.3)).toBe(0);
    });
  });

  describe('calculateDifficultyAdjustment', () => {
    it('should return -1 for poor accuracy', () => {
      expect(InterviewService.calculateDifficultyAdjustment(0.4)).toBe(-1);
    });

    it('should return +1 for excellent accuracy', () => {
      expect(InterviewService.calculateDifficultyAdjustment(0.95)).toBe(1);
    });

    it('should return 0 for average accuracy', () => {
      expect(InterviewService.calculateDifficultyAdjustment(0.7)).toBe(0);
    });
  });

  describe('calculateNewProblemsAdjustment', () => {
    it('should return -1 for poor transfer accuracy', () => {
      expect(InterviewService.calculateNewProblemsAdjustment(0.5, 0.1)).toBe(-1);
    });

    it('should return -1 for slow speed delta', () => {
      expect(InterviewService.calculateNewProblemsAdjustment(0.7, 0.5)).toBe(-1);
    });

    it('should return 0 for good performance', () => {
      expect(InterviewService.calculateNewProblemsAdjustment(0.8, 0.2)).toBe(0);
    });
  });

  describe('calculateFocusTagsWeight', () => {
    it('should return 1.0 for empty array', () => {
      expect(InterviewService.calculateFocusTagsWeight([])).toBe(1.0);
    });

    it('should return 0.7 for poor tag transfer', () => {
      const tags = [
        { transferAccuracy: 0.4 },
        { transferAccuracy: 0.3 },
      ];
      expect(InterviewService.calculateFocusTagsWeight(tags)).toBe(0.7);
    });

    it('should return 1.3 for excellent tag transfer', () => {
      const tags = [
        { transferAccuracy: 0.9 },
        { transferAccuracy: 0.85 },
      ];
      expect(InterviewService.calculateFocusTagsWeight(tags)).toBe(1.3);
    });

    it('should return 1.0 for average transfer', () => {
      const tags = [
        { transferAccuracy: 0.7 },
        { transferAccuracy: 0.7 },
      ];
      expect(InterviewService.calculateFocusTagsWeight(tags)).toBe(1.0);
    });
  });

  describe('identifyWeakInterviewTags', () => {
    it('should identify tags with poor transfer accuracy', () => {
      const tags = [
        { tagName: 'arrays', transferAccuracy: 0.8 },
        { tagName: 'dp', transferAccuracy: 0.4 },
        { tagName: 'graphs', transferAccuracy: 0.3 },
        { tagName: 'trees', transferAccuracy: 0.9 },
      ];

      const result = InterviewService.identifyWeakInterviewTags(tags);

      expect(result).toContain('dp');
      expect(result).toContain('graphs');
      expect(result).not.toContain('arrays');
      expect(result).not.toContain('trees');
    });

    it('should return at most 3 weak tags', () => {
      const tags = [
        { tagName: 'a', transferAccuracy: 0.1 },
        { tagName: 'b', transferAccuracy: 0.2 },
        { tagName: 'c', transferAccuracy: 0.3 },
        { tagName: 'd', transferAccuracy: 0.4 },
        { tagName: 'e', transferAccuracy: 0.5 },
      ];

      const result = InterviewService.identifyWeakInterviewTags(tags);

      expect(result.length).toBeLessThanOrEqual(3);
    });

    it('should return empty array when all tags are strong', () => {
      const tags = [
        { tagName: 'arrays', transferAccuracy: 0.9 },
        { tagName: 'dp', transferAccuracy: 0.8 },
      ];

      const result = InterviewService.identifyWeakInterviewTags(tags);
      expect(result).toEqual([]);
    });

    it('should handle tags without transferAccuracy', () => {
      const tags = [
        { tagName: 'arrays' },
        { tagName: 'dp', transferAccuracy: 0.8 },
      ];

      const result = InterviewService.identifyWeakInterviewTags(tags);
      // arrays has transferAccuracy of 0 (falsy), which is < 0.6
      expect(result).toContain('arrays');
    });
  });
});
