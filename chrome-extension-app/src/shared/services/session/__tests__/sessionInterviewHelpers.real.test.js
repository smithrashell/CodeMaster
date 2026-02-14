/**
 * Tests for sessionInterviewHelpers.js (45 lines, 0% coverage)
 */

jest.mock('../../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../db/stores/sessions.js', () => ({
  getLatestSession: jest.fn(),
  getSessionPerformance: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../db/stores/tag_mastery.js', () => ({
  getTagMastery: jest.fn().mockResolvedValue([]),
}));

import {
  shouldCreateInterviewSession,
  summarizeInterviewPerformance,
  storeInterviewAnalytics,
  getTagPerformanceBaselines,
} from '../sessionInterviewHelpers.js';

import { getLatestSession } from '../../../db/stores/sessions.js';
import { getTagMastery } from '../../../db/stores/tag_mastery.js';

describe('sessionInterviewHelpers', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('shouldCreateInterviewSession', () => {
    it('returns false for null frequency', async () => {
      expect(await shouldCreateInterviewSession(null)).toBe(false);
    });

    it('returns false for manual frequency', async () => {
      expect(await shouldCreateInterviewSession('manual')).toBe(false);
    });

    it('returns true for weekly when no latest session', async () => {
      getLatestSession.mockResolvedValue(null);
      expect(await shouldCreateInterviewSession('weekly')).toBe(true);
    });

    it('returns true for weekly after 7+ days', async () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      getLatestSession.mockResolvedValue({ session_type: 'interview', date: eightDaysAgo.toISOString() });
      expect(await shouldCreateInterviewSession('weekly')).toBe(true);
    });

    it('returns false for weekly within 7 days', async () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      getLatestSession.mockResolvedValue({ session_type: 'interview', date: twoDaysAgo.toISOString() });
      expect(await shouldCreateInterviewSession('weekly')).toBe(false);
    });

    it('returns false for level-up frequency', async () => {
      expect(await shouldCreateInterviewSession('level-up')).toBe(false);
    });

    it('returns false on error', async () => {
      getLatestSession.mockRejectedValue(new Error('db error'));
      expect(await shouldCreateInterviewSession('weekly')).toBe(false);
    });
  });

  describe('summarizeInterviewPerformance', () => {
    it('returns standard summary when no interview metrics', async () => {
      const summaryFn = jest.fn().mockResolvedValue({ accuracy: 0.8 });
      const session = { id: 's1', session_type: 'interview' };
      const result = await summarizeInterviewPerformance(session, summaryFn);
      expect(result.accuracy).toBe(0.8);
    });

    it('returns enriched summary with interview metrics', async () => {
      const summaryFn = jest.fn().mockResolvedValue({ accuracy: 0.8 });
      const session = {
        id: 's1',
        session_type: 'interview',
        interviewMetrics: {
          transferReadinessScore: 0.7,
          interventionNeedScore: 0.3,
          overallMetrics: {},
          feedbackGenerated: [],
          tagPerformance: new Map([['array', { score: 0.8 }]]),
        },
      };
      const result = await summarizeInterviewPerformance(session, summaryFn);
      expect(result.interviewAnalysis).toBeDefined();
      expect(result.interviewAnalysis.mode).toBe('interview');
    });

    it('falls back to standard summary on error', async () => {
      const summaryFn = jest.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce({ accuracy: 0.5 });
      const session = { id: 's1', interviewMetrics: {} };
      const result = await summarizeInterviewPerformance(session, summaryFn);
      expect(result.accuracy).toBe(0.5);
    });
  });

  describe('storeInterviewAnalytics', () => {
    it('stores analytics in chrome.storage', () => {
      chrome.storage.local.get.mockImplementation((keys, cb) => cb({ interviewAnalytics: [] }));
      storeInterviewAnalytics({
        completedAt: new Date().toISOString(),
        sessionId: 's1',
        interviewAnalysis: { mode: 'practice', overallMetrics: {}, transferReadinessScore: 0.5, feedback: [] },
      });
      expect(chrome.storage.local.get).toHaveBeenCalled();
    });
  });

  describe('getTagPerformanceBaselines', () => {
    it('returns baselines from tag mastery', async () => {
      getTagMastery.mockResolvedValue([
        { tag: 'array', totalAttempts: 10, successfulAttempts: 8, avgTime: 600000 },
        { tag: 'dp', totalAttempts: 0, successfulAttempts: 0 },
      ]);
      const result = await getTagPerformanceBaselines();
      expect(result.array).toBeDefined();
      expect(result.array.successRate).toBe(0.8);
      expect(result.dp).toBeUndefined(); // 0 attempts filtered
    });

    it('returns empty on error', async () => {
      getTagMastery.mockRejectedValue(new Error('fail'));
      expect(await getTagPerformanceBaselines()).toEqual({});
    });
  });
});
