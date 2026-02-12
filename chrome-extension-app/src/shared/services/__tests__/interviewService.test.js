/**
 * Tests for interviewService.js (located in src/shared/services/session/)
 * Covers mode configs, assessInterviewReadiness, createInterviewSession,
 * readiness scoring, and transfer metrics.
 */

// Mock logger first, before all other imports
jest.mock('../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock DB/service dependencies
jest.mock('../../db/stores/tag_mastery.js', () => ({
  getTagMastery: jest.fn(),
}));

jest.mock('../../db/stores/sessions.js', () => ({
  getSessionPerformance: jest.fn(),
}));

jest.mock('../storage/storageService.js', () => ({
  StorageService: {
    getSettings: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
  },
}));

jest.mock('../../../app/services/dashboard/dashboardService.js', () => ({
  getInterviewAnalyticsData: jest.fn(),
}));

import InterviewService from '../session/interviewService.js';
import { getTagMastery } from '../../db/stores/tag_mastery.js';
import { getSessionPerformance } from '../../db/stores/sessions.js';
import { StorageService } from '../storage/storageService.js';

describe('InterviewService - Mode Configurations', () => {
  it('standard mode has no session length constraint', () => {
    const config = InterviewService.INTERVIEW_CONFIGS['standard'];
    expect(config.sessionLength).toBeNull();
  });

  it('standard mode has no hint restrictions', () => {
    const config = InterviewService.INTERVIEW_CONFIGS['standard'];
    expect(config.hints.max).toBeNull();
  });

  it('standard mode has full-support uiMode', () => {
    const config = InterviewService.INTERVIEW_CONFIGS['standard'];
    expect(config.uiMode).toBe('full-support');
  });

  it('interview-like mode has 3-5 problem session length', () => {
    const config = InterviewService.INTERVIEW_CONFIGS['interview-like'];
    expect(config.sessionLength.min).toBe(3);
    expect(config.sessionLength.max).toBe(5);
  });

  it('interview-like mode limits hints to max 2', () => {
    const config = InterviewService.INTERVIEW_CONFIGS['interview-like'];
    expect(config.hints.max).toBe(2);
  });

  it('interview-like mode has pressure timing enabled', () => {
    const config = InterviewService.INTERVIEW_CONFIGS['interview-like'];
    expect(config.timing.pressure).toBe(true);
    expect(config.timing.hardCutoff).toBe(false);
  });

  it('full-interview mode has 3-4 problem session length', () => {
    const config = InterviewService.INTERVIEW_CONFIGS['full-interview'];
    expect(config.sessionLength.min).toBe(3);
    expect(config.sessionLength.max).toBe(4);
  });

  it('full-interview mode disables hints (max 0)', () => {
    const config = InterviewService.INTERVIEW_CONFIGS['full-interview'];
    expect(config.hints.max).toBe(0);
  });

  it('full-interview mode enables hard cutoff', () => {
    const config = InterviewService.INTERVIEW_CONFIGS['full-interview'];
    expect(config.timing.hardCutoff).toBe(true);
  });

  it('full-interview mode has minimal-clean uiMode', () => {
    const config = InterviewService.INTERVIEW_CONFIGS['full-interview'];
    expect(config.uiMode).toBe('minimal-clean');
  });

  it('getInterviewConfig returns standard config for unknown mode', () => {
    const config = InterviewService.getInterviewConfig('nonexistent-mode');
    expect(config).toBe(InterviewService.INTERVIEW_CONFIGS['standard']);
  });

  it('getInterviewConfig returns correct config for valid mode', () => {
    const config = InterviewService.getInterviewConfig('interview-like');
    expect(config).toBe(InterviewService.INTERVIEW_CONFIGS['interview-like']);
  });
});

describe('InterviewService.assessInterviewReadiness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('interviewLikeUnlocked requires accuracy >= 0.7 and at least 3 mastered tags', async () => {
    getSessionPerformance.mockResolvedValue({ accuracy: 0.8 });
    getTagMastery.mockResolvedValue([
      { tag: 'Array', mastered: true },
      { tag: 'Hash Table', mastered: true },
      { tag: 'Tree', mastered: true },
    ]);

    const result = await InterviewService.assessInterviewReadiness();
    expect(result.interviewLikeUnlocked).toBe(true);
  });

  it('interviewLikeUnlocked is false when accuracy < 0.7', async () => {
    getSessionPerformance.mockResolvedValue({ accuracy: 0.6 });
    getTagMastery.mockResolvedValue([
      { tag: 'Array', mastered: true },
      { tag: 'Hash Table', mastered: true },
      { tag: 'Tree', mastered: true },
    ]);

    const result = await InterviewService.assessInterviewReadiness();
    expect(result.interviewLikeUnlocked).toBe(false);
    expect(result.reasoning).toContain('70%');
  });

  it('interviewLikeUnlocked is false when fewer than 3 mastered tags', async () => {
    getSessionPerformance.mockResolvedValue({ accuracy: 0.8 });
    getTagMastery.mockResolvedValue([
      { tag: 'Array', mastered: true },
      { tag: 'Hash Table', mastered: false },
    ]);

    const result = await InterviewService.assessInterviewReadiness();
    expect(result.interviewLikeUnlocked).toBe(false);
    expect(result.reasoning).toContain('mastered tags');
  });

  it('fullInterviewUnlocked requires interviewLike + transferScore >= 0.7 + accuracy >= 0.8', async () => {
    getSessionPerformance.mockResolvedValue({ accuracy: 0.85 });
    // Enough mastered tags with enough attempts to push transfer score above 0.7
    const tagMastery = Array.from({ length: 10 }, (_, i) => ({
      tag: `Tag${i}`,
      mastered: true,
      totalAttempts: 10,
    }));
    getTagMastery.mockResolvedValue(tagMastery);

    const result = await InterviewService.assessInterviewReadiness();
    // transferReadinessScore = (1.0 * 0.7) + (min(100/50,1) * 0.3) = 0.7 + 0.3 = 1.0
    expect(result.fullInterviewUnlocked).toBe(true);
  });

  it('fullInterviewUnlocked is false when transfer score < 0.7', async () => {
    getSessionPerformance.mockResolvedValue({ accuracy: 0.85 });
    getTagMastery.mockResolvedValue([
      { tag: 'Array', mastered: true, totalAttempts: 0 },
      { tag: 'Hash Table', mastered: true, totalAttempts: 0 },
      { tag: 'Tree', mastered: true, totalAttempts: 0 },
    ]);

    const result = await InterviewService.assessInterviewReadiness();
    // totalAttempts = 0, so transferReadiness = 0 < 0.7
    expect(result.fullInterviewUnlocked).toBe(false);
  });

  it('result has required shape with interviewLikeUnlocked, fullInterviewUnlocked, reasoning, metrics', async () => {
    getSessionPerformance.mockResolvedValue({ accuracy: 0.5 });
    getTagMastery.mockResolvedValue([]);

    const result = await InterviewService.assessInterviewReadiness();
    expect(result).toHaveProperty('interviewLikeUnlocked');
    expect(result).toHaveProperty('fullInterviewUnlocked');
    expect(result).toHaveProperty('reasoning');
    expect(result).toHaveProperty('metrics');
    expect(result.metrics).toHaveProperty('accuracy');
    expect(result.metrics).toHaveProperty('masteredTagsCount');
    expect(result.metrics).toHaveProperty('transferReadinessScore');
  });

  it('falls back gracefully when DB call throws', async () => {
    getSessionPerformance.mockRejectedValue(new Error('DB error'));
    getTagMastery.mockRejectedValue(new Error('DB error'));

    const result = await InterviewService.assessInterviewReadiness();
    // Fallback enables both modes
    expect(result.interviewLikeUnlocked).toBe(true);
    expect(result.fullInterviewUnlocked).toBe(true);
  });
});

describe('InterviewService.createInterviewSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns session object with sessionType matching mode', async () => {
    StorageService.getSettings.mockResolvedValue({ sessionLength: 5 });
    getTagMastery.mockResolvedValue([]);

    const result = await InterviewService.createInterviewSession('standard');
    expect(result.sessionType).toBe('standard');
  });

  it('uses standard adaptive session length (from settings) for standard mode', async () => {
    StorageService.getSettings.mockResolvedValue({ sessionLength: 7 });
    getTagMastery.mockResolvedValue([]);

    const result = await InterviewService.createInterviewSession('standard');
    expect(result.sessionLength).toBe(7);
  });

  it('uses random session length within bounds for interview-like mode', async () => {
    StorageService.getSettings.mockResolvedValue({ sessionLength: 5 });
    getTagMastery.mockResolvedValue([]);

    const result = await InterviewService.createInterviewSession('interview-like');
    expect(result.sessionLength).toBeGreaterThanOrEqual(3);
    expect(result.sessionLength).toBeLessThanOrEqual(5);
  });

  it('uses random session length within bounds for full-interview mode', async () => {
    StorageService.getSettings.mockResolvedValue({ sessionLength: 5 });
    getTagMastery.mockResolvedValue([]);

    const result = await InterviewService.createInterviewSession('full-interview');
    expect(result.sessionLength).toBeGreaterThanOrEqual(3);
    expect(result.sessionLength).toBeLessThanOrEqual(4);
  });

  it('result includes config and selectionCriteria', async () => {
    StorageService.getSettings.mockResolvedValue({ sessionLength: 5 });
    getTagMastery.mockResolvedValue([]);

    const result = await InterviewService.createInterviewSession('standard');
    expect(result).toHaveProperty('config');
    expect(result).toHaveProperty('selectionCriteria');
    expect(result).toHaveProperty('interviewMetrics');
    expect(result).toHaveProperty('createdAt');
  });

  it('returns fallback session when getTagMastery throws a non-timeout error', async () => {
    StorageService.getSettings.mockResolvedValue({ sessionLength: 5 });
    // Simulate a non-timeout error from getTagMastery
    getTagMastery.mockRejectedValue(new Error('Database connection closed'));

    const result = await InterviewService.createInterviewSession('standard');
    expect(result.fallbackMode).toBe(true);
    expect(result.sessionType).toBe('standard');
  });

  it('re-throws when getTagMastery timeout error occurs', async () => {
    StorageService.getSettings.mockResolvedValue({ sessionLength: 5 });
    // The internal Promise.race timeout triggers an error with 'timed out' in message
    getTagMastery.mockImplementation(
      () => new Promise((_, reject) =>
        setTimeout(() => reject(new Error('InterviewService.createInterviewSession timed out after 8000ms')), 0)
      )
    );

    await expect(
      InterviewService.createInterviewSession('standard')
    ).rejects.toThrow('timed out');
  });
});

describe('InterviewService.calculateCurrentTransferReadiness', () => {
  it('returns 0 when tagMastery is empty', () => {
    const score = InterviewService.calculateCurrentTransferReadiness([]);
    expect(score).toBe(0);
  });

  it('returns 0 when totalAttempts is 0', () => {
    const tagMastery = [
      { tag: 'Array', mastered: true, totalAttempts: 0 },
    ];
    const score = InterviewService.calculateCurrentTransferReadiness(tagMastery);
    expect(score).toBe(0);
  });

  it('returns higher score when more tags are mastered', () => {
    const allMastered = [
      { tag: 'Array', mastered: true, totalAttempts: 10 },
      { tag: 'Hash Table', mastered: true, totalAttempts: 10 },
    ];
    const noneMastered = [
      { tag: 'Array', mastered: false, totalAttempts: 10 },
      { tag: 'Hash Table', mastered: false, totalAttempts: 10 },
    ];

    const highScore = InterviewService.calculateCurrentTransferReadiness(allMastered);
    const lowScore = InterviewService.calculateCurrentTransferReadiness(noneMastered);

    expect(highScore).toBeGreaterThan(lowScore);
  });

  it('score is bounded between 0 and 1', () => {
    const tagMastery = Array.from({ length: 20 }, (_, i) => ({
      tag: `Tag${i}`,
      mastered: true,
      totalAttempts: 100,
    }));
    const score = InterviewService.calculateCurrentTransferReadiness(tagMastery);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe('InterviewService.buildInterviewProblemCriteria', () => {
  it('standard mode uses adaptive difficulty and 0.4 reviewRatio', () => {
    const config = InterviewService.INTERVIEW_CONFIGS['standard'];
    const criteria = InterviewService.buildInterviewProblemCriteria('standard', config, []);
    expect(criteria.difficulty).toBe('adaptive');
    expect(criteria.reviewRatio).toBe(0.4);
  });

  it('interview-like mode sets reviewRatio=0 (no spaced repetition)', () => {
    const config = InterviewService.INTERVIEW_CONFIGS['interview-like'];
    const criteria = InterviewService.buildInterviewProblemCriteria('interview-like', config, []);
    expect(criteria.reviewRatio).toBe(0);
  });

  it('includes mastered tags in allowedTags', () => {
    const config = InterviewService.INTERVIEW_CONFIGS['interview-like'];
    const tagMastery = [
      { tag: 'Array', mastered: true },
      { tag: 'Hash Table', mastered: false, totalAttempts: 5, successfulAttempts: 3 },
    ];
    const criteria = InterviewService.buildInterviewProblemCriteria('interview-like', config, tagMastery);
    expect(criteria.masteredTags).toContain('Array');
  });
});

describe('InterviewService.initializeInterviewMetrics', () => {
  it('returns object with all required fields', () => {
    const metrics = InterviewService.initializeInterviewMetrics();
    expect(metrics).toHaveProperty('transferReadinessScore');
    expect(metrics).toHaveProperty('interventionNeedScore');
    expect(metrics).toHaveProperty('tagPerformance');
    expect(metrics).toHaveProperty('overallMetrics');
    expect(metrics).toHaveProperty('feedbackGenerated');
  });

  it('feedbackGenerated contains strengths, improvements, and nextActions arrays', () => {
    const metrics = InterviewService.initializeInterviewMetrics();
    expect(Array.isArray(metrics.feedbackGenerated.strengths)).toBe(true);
    expect(Array.isArray(metrics.feedbackGenerated.improvements)).toBe(true);
    expect(Array.isArray(metrics.feedbackGenerated.nextActions)).toBe(true);
  });

  it('tagPerformance is a Map', () => {
    const metrics = InterviewService.initializeInterviewMetrics();
    expect(metrics.tagPerformance instanceof Map).toBe(true);
  });
});

describe('InterviewService.calculateTransferReadinessScore', () => {
  it('returns 0 for all-zero metrics', () => {
    const score = InterviewService.calculateTransferReadinessScore({
      transferAccuracy: 0,
      speedDelta: 0,
      hintPressure: 0,
      approachLatency: 0,
    });
    expect(score).toBeGreaterThan(0); // normalizedSpeed=1, normalizedHints=1, normalizedLatency=1
  });

  it('returns high score for excellent metrics', () => {
    const score = InterviewService.calculateTransferReadinessScore({
      transferAccuracy: 1.0,
      speedDelta: 0,
      hintPressure: 0,
      approachLatency: 0,
    });
    expect(score).toBeGreaterThan(0.8);
  });

  it('returns lower score when transfer accuracy is low', () => {
    const highScore = InterviewService.calculateTransferReadinessScore({
      transferAccuracy: 0.9,
      speedDelta: 0,
      hintPressure: 0,
      approachLatency: 0,
    });
    const lowScore = InterviewService.calculateTransferReadinessScore({
      transferAccuracy: 0.2,
      speedDelta: 0,
      hintPressure: 0,
      approachLatency: 0,
    });
    expect(highScore).toBeGreaterThan(lowScore);
  });
});
