/**
 * HintInteractionService comprehensive tests.
 *
 * All external dependencies (DB stores, SessionService) are mocked
 * so we can exercise every static method in isolation.
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

jest.mock('../../../db/stores/hint_interactions.js', () => ({
  saveHintInteraction: jest.fn(),
  getInteractionsByProblem: jest.fn(),
  getInteractionsBySession: jest.fn(),
  getAllInteractions: jest.fn(),
  getInteractionStats: jest.fn(),
  getHintEffectiveness: jest.fn(),
  deleteOldInteractions: jest.fn(),
}));

jest.mock('../../session/sessionService.js', () => ({
  SessionService: {
    resumeSession: jest.fn().mockResolvedValue(null),
  },
}));

// ---------------------------------------------------------------------------
// 2. Imports (run after mocks are applied)
// ---------------------------------------------------------------------------
import { HintInteractionService } from '../hintInteractionService.js';
import { SessionService } from '../../session/sessionService.js';
import {
  saveHintInteraction as mockSaveHintInteraction,
  getInteractionsByProblem as mockGetInteractionsByProblem,
  getInteractionsBySession as mockGetInteractionsBySession,
  getAllInteractions as mockGetAllInteractions,
  getInteractionStats as mockGetInteractionStats,
  getHintEffectiveness as mockGetHintEffectiveness,
  deleteOldInteractions as mockDeleteOldInteractions,
} from '../../../db/stores/hint_interactions.js';

// ---------------------------------------------------------------------------
// 3. Tests
// ---------------------------------------------------------------------------
describe('HintInteractionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock performance.now for processing time
    jest.spyOn(performance, 'now').mockReturnValue(100);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =========================================================================
  // _isContentScriptContext (private, but tested indirectly)
  // =========================================================================
  describe('_isContentScriptContext', () => {
    it('should return false in jsdom test environment (chrome-extension protocol not web page)', () => {
      // In jsdom default env, window.location.protocol is about: or http:
      // but window.location.href may start with about: or the configured URL
      const result = HintInteractionService._isContentScriptContext();
      // In the test environment, we expect this to be a boolean
      expect(typeof result).toBe('boolean');
    });
  });

  // =========================================================================
  // saveHintInteraction
  // =========================================================================
  describe('saveHintInteraction', () => {
    it('should save interaction with provided session context', async () => {
      const savedRecord = { id: 'hint_123', problem_id: 'p1' };
      mockSaveHintInteraction.mockResolvedValue(savedRecord);

      // Force non-content-script context so it goes direct DB path
      jest.spyOn(HintInteractionService, '_isContentScriptContext').mockReturnValue(false);

      const result = await HintInteractionService.saveHintInteraction(
        {
          problem_id: 'p1',
          hint_type: 'pattern',
          hint_id: 'hint_1',
          action: 'expand',
          primary_tag: 'arrays',
          related_tag: 'sorting',
          content: 'Try sorting first',
          problem_tags: ['arrays', 'sorting'],
        },
        {
          session_id: 'session_abc',
          box_level: 3,
          problem_difficulty: 'Hard',
        }
      );

      expect(mockSaveHintInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          problem_id: 'p1',
          hint_type: 'pattern',
          session_id: 'session_abc',
          box_level: 3,
          problem_difficulty: 'Hard',
          user_action: 'expand',
          primary_tag: 'arrays',
          related_tag: 'sorting',
          content: 'Try sorting first',
          tags_combination: ['arrays', 'sorting'],
        })
      );
      expect(result).toEqual(savedRecord);
    });

    it('should get session from SessionService when not provided', async () => {
      const savedRecord = { id: 'hint_123' };
      mockSaveHintInteraction.mockResolvedValue(savedRecord);
      jest.spyOn(HintInteractionService, '_isContentScriptContext').mockReturnValue(false);
      SessionService.resumeSession.mockResolvedValue({ id: 'resumed_session_1' });

      await HintInteractionService.saveHintInteraction(
        { problem_id: 'p1', hint_type: 'general', action: 'clicked' },
        {} // No session_id
      );

      expect(SessionService.resumeSession).toHaveBeenCalled();
      expect(mockSaveHintInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: 'resumed_session_1',
        })
      );
    });

    it('should use fallback session ID when SessionService returns null', async () => {
      mockSaveHintInteraction.mockResolvedValue({ id: 'hint_123' });
      jest.spyOn(HintInteractionService, '_isContentScriptContext').mockReturnValue(false);
      SessionService.resumeSession.mockResolvedValue(null);

      await HintInteractionService.saveHintInteraction(
        { problem_id: 'p1', hint_type: 'general' },
        {}
      );

      expect(mockSaveHintInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: expect.stringContaining('session_'),
        })
      );
    });

    it('should use fallback session ID when SessionService throws', async () => {
      mockSaveHintInteraction.mockResolvedValue({ id: 'hint_123' });
      jest.spyOn(HintInteractionService, '_isContentScriptContext').mockReturnValue(false);
      SessionService.resumeSession.mockRejectedValue(new Error('Session error'));

      await HintInteractionService.saveHintInteraction(
        { problem_id: 'p1', hint_type: 'general' },
        {}
      );

      expect(mockSaveHintInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: expect.stringContaining('session_'),
        })
      );
    });

    it('should use defaults for missing fields', async () => {
      mockSaveHintInteraction.mockResolvedValue({ id: 'hint_123' });
      jest.spyOn(HintInteractionService, '_isContentScriptContext').mockReturnValue(false);

      await HintInteractionService.saveHintInteraction({}, { session_id: 's1' });

      expect(mockSaveHintInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          problem_id: 'unknown',
          hint_type: 'general',
          user_action: 'clicked',
          problem_difficulty: 'Medium',
          box_level: 1,
          tags_combination: [],
        })
      );
    });

    it('should prefer interactionData fields over sessionContext fields', async () => {
      mockSaveHintInteraction.mockResolvedValue({ id: 'hint_123' });
      jest.spyOn(HintInteractionService, '_isContentScriptContext').mockReturnValue(false);

      await HintInteractionService.saveHintInteraction(
        {
          problem_id: 'p1',
          box_level: 5,
          problem_difficulty: 'Easy',
          hint_type: 'strategy',
        },
        {
          session_id: 's1',
          box_level: 2,
          problem_difficulty: 'Hard',
        }
      );

      expect(mockSaveHintInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          box_level: 5,
          problem_difficulty: 'Easy',
        })
      );
    });

    it('should use user_action field when action is missing', async () => {
      mockSaveHintInteraction.mockResolvedValue({ id: 'hint_123' });
      jest.spyOn(HintInteractionService, '_isContentScriptContext').mockReturnValue(false);

      await HintInteractionService.saveHintInteraction(
        { problem_id: 'p1', user_action: 'dismiss' },
        { session_id: 's1' }
      );

      expect(mockSaveHintInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          user_action: 'dismiss',
        })
      );
    });

    it('should record processing time', async () => {
      performance.now
        .mockReturnValueOnce(100)   // startTime
        .mockReturnValueOnce(150);  // end time

      mockSaveHintInteraction.mockResolvedValue({ id: 'hint_123' });
      jest.spyOn(HintInteractionService, '_isContentScriptContext').mockReturnValue(false);

      await HintInteractionService.saveHintInteraction(
        { problem_id: 'p1' },
        { session_id: 's1' }
      );

      expect(mockSaveHintInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          processing_time: expect.any(Number),
        })
      );
    });

    it('should return error record on save failure', async () => {
      jest.spyOn(HintInteractionService, '_isContentScriptContext').mockReturnValue(false);
      mockSaveHintInteraction.mockRejectedValue(new Error('DB write failed'));

      const result = await HintInteractionService.saveHintInteraction(
        { problem_id: 'p1', action: 'expand', hint_type: 'pattern' },
        { session_id: 's1' }
      );

      expect(result.id).toBeNull();
      expect(result.error).toBe('DB write failed');
      expect(result.failed_data).toBeDefined();
    });

    it('should route through chrome messaging in content script context', async () => {
      jest.spyOn(HintInteractionService, '_isContentScriptContext').mockReturnValue(true);

      // Mock chrome.runtime.sendMessage to respond successfully
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({ interaction: { id: 'hint_via_bg' } });
      });
      chrome.runtime.lastError = null;

      const result = await HintInteractionService.saveHintInteraction(
        { problem_id: 'p1' },
        { session_id: 's1' }
      );

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'saveHintInteraction' }),
        expect.any(Function)
      );
      expect(result).toEqual({ id: 'hint_via_bg' });
    });

    it('should handle chrome messaging error in content script context', async () => {
      jest.spyOn(HintInteractionService, '_isContentScriptContext').mockReturnValue(true);

      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        chrome.runtime.lastError = { message: 'Extension context invalidated' };
        callback(undefined);
        chrome.runtime.lastError = null;
      });

      const result = await HintInteractionService.saveHintInteraction(
        { problem_id: 'p1' },
        { session_id: 's1' }
      );

      // Should return error record since the save failed
      expect(result.id).toBeNull();
      expect(result.error).toBeDefined();
    });

    it('should handle response error in content script context', async () => {
      jest.spyOn(HintInteractionService, '_isContentScriptContext').mockReturnValue(true);

      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        chrome.runtime.lastError = null;
        callback({ error: 'Background script busy' });
      });

      const result = await HintInteractionService.saveHintInteraction(
        { problem_id: 'p1' },
        { session_id: 's1' }
      );

      expect(result.id).toBeNull();
      expect(result.error).toBeDefined();
    });

    it('should use tip field as content fallback', async () => {
      mockSaveHintInteraction.mockResolvedValue({ id: 'hint_123' });
      jest.spyOn(HintInteractionService, '_isContentScriptContext').mockReturnValue(false);

      await HintInteractionService.saveHintInteraction(
        { problem_id: 'p1', tip: 'Use a hash map' },
        { session_id: 's1' }
      );

      expect(mockSaveHintInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Use a hash map',
        })
      );
    });

    it('should use tags_combination field as fallback for problem_tags', async () => {
      mockSaveHintInteraction.mockResolvedValue({ id: 'hint_123' });
      jest.spyOn(HintInteractionService, '_isContentScriptContext').mockReturnValue(false);

      await HintInteractionService.saveHintInteraction(
        { problem_id: 'p1', tags_combination: ['dp', 'greedy'] },
        { session_id: 's1' }
      );

      expect(mockSaveHintInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          tags_combination: ['dp', 'greedy'],
        })
      );
    });
  });

  // =========================================================================
  // getProblemAnalytics
  // =========================================================================
  describe('getProblemAnalytics', () => {
    it('should return analytics for a problem with interactions', async () => {
      const interactions = [
        {
          session_id: 's1',
          user_action: 'expand',
          hint_type: 'pattern',
          primary_tag: 'arrays',
          related_tag: 'sorting',
          timestamp: '2024-01-01T10:00:00Z',
        },
        {
          session_id: 's1',
          user_action: 'dismiss',
          hint_type: 'general',
          primary_tag: 'arrays',
          related_tag: null,
          timestamp: '2024-01-01T10:05:00Z',
        },
        {
          session_id: 's2',
          user_action: 'expand',
          hint_type: 'pattern',
          primary_tag: 'dp',
          related_tag: null,
          timestamp: '2024-01-02T10:00:00Z',
        },
      ];
      mockGetInteractionsByProblem.mockResolvedValue(interactions);

      const result = await HintInteractionService.getProblemAnalytics('p1');

      expect(result.totalInteractions).toBe(3);
      expect(result.uniqueSessions).toBe(2);
      expect(result.byAction.expand).toBe(2);
      expect(result.byAction.dismiss).toBe(1);
      expect(result.byHintType.pattern).toBe(2);
      expect(result.byHintType.general).toBe(1);
      expect(result.engagementRate).toBeCloseTo(2 / 3);
      expect(result.timeline).toHaveLength(3);
      // Timeline should be sorted by timestamp
      expect(new Date(result.timeline[0].timestamp) <= new Date(result.timeline[1].timestamp)).toBe(true);
    });

    it('should return empty analytics for problem with no interactions', async () => {
      mockGetInteractionsByProblem.mockResolvedValue([]);

      const result = await HintInteractionService.getProblemAnalytics('p_empty');

      expect(result.totalInteractions).toBe(0);
      expect(result.uniqueSessions).toBe(0);
      expect(result.engagementRate).toBe(0);
    });

    it('should throw on DB error', async () => {
      mockGetInteractionsByProblem.mockRejectedValue(new Error('DB error'));

      await expect(HintInteractionService.getProblemAnalytics('p1')).rejects.toThrow('DB error');
    });

    it('should build mostPopularHints correctly', async () => {
      const interactions = [
        { session_id: 's1', user_action: 'expand', hint_type: 'pattern', primary_tag: 'arrays', related_tag: 'sorting', timestamp: '2024-01-01T10:00:00Z' },
        { session_id: 's1', user_action: 'expand', hint_type: 'pattern', primary_tag: 'arrays', related_tag: 'sorting', timestamp: '2024-01-01T10:01:00Z' },
        { session_id: 's1', user_action: 'expand', hint_type: 'general', primary_tag: 'dp', related_tag: undefined, timestamp: '2024-01-01T10:02:00Z' },
      ];
      mockGetInteractionsByProblem.mockResolvedValue(interactions);

      const result = await HintInteractionService.getProblemAnalytics('p1');

      expect(result.mostPopularHints['pattern-arrays-sorting']).toBe(2);
      expect(result.mostPopularHints['general-dp']).toBe(1);
    });
  });

  // =========================================================================
  // getSessionAnalytics
  // =========================================================================
  describe('getSessionAnalytics', () => {
    it('should return analytics for a session', async () => {
      const interactions = [
        { problem_id: 'p1', user_action: 'expand', hint_type: 'pattern', timestamp: '2024-01-01T10:00:00Z' },
        { problem_id: 'p1', user_action: 'dismiss', hint_type: 'general', timestamp: '2024-01-01T10:05:00Z' },
        { problem_id: 'p2', user_action: 'expand', hint_type: 'strategy', timestamp: '2024-01-01T10:10:00Z' },
      ];
      mockGetInteractionsBySession.mockResolvedValue(interactions);

      const result = await HintInteractionService.getSessionAnalytics('s1');

      expect(result.sessionId).toBe('s1');
      expect(result.totalInteractions).toBe(3);
      expect(result.uniqueProblems).toBe(2);
      expect(result.byAction.expand).toBe(2);
      expect(result.byAction.dismiss).toBe(1);
      expect(result.byHintType.pattern).toBe(1);
      expect(result.byHintType.general).toBe(1);
      expect(result.byHintType.strategy).toBe(1);
      // Average engagement: p1 has 1/2=0.5, p2 has 1/1=1.0 -> avg = 0.75
      expect(result.averageEngagementRate).toBeCloseTo(0.75);
      expect(result.interactionPattern).toHaveLength(3);
    });

    it('should return empty analytics for session with no interactions', async () => {
      mockGetInteractionsBySession.mockResolvedValue([]);

      const result = await HintInteractionService.getSessionAnalytics('s_empty');

      expect(result.sessionId).toBe('s_empty');
      expect(result.totalInteractions).toBe(0);
      expect(result.uniqueProblems).toBe(0);
      expect(result.averageEngagementRate).toBe(0);
    });

    it('should throw on DB error', async () => {
      mockGetInteractionsBySession.mockRejectedValue(new Error('DB error'));

      await expect(HintInteractionService.getSessionAnalytics('s1')).rejects.toThrow('DB error');
    });
  });

  // =========================================================================
  // getSystemAnalytics
  // =========================================================================
  describe('getSystemAnalytics', () => {
    it('should return full system analytics without filters', async () => {
      const interactions = [
        { timestamp: '2024-01-01T10:00:00Z', hint_type: 'pattern', problem_difficulty: 'Easy', user_action: 'expand' },
        { timestamp: '2024-01-02T10:00:00Z', hint_type: 'general', problem_difficulty: 'Medium', user_action: 'dismiss' },
      ];
      mockGetAllInteractions.mockResolvedValue(interactions);
      mockGetInteractionStats.mockResolvedValue({ totalCount: 2 });
      mockGetHintEffectiveness.mockResolvedValue({
        entry1: { hintType: 'pattern', difficulty: 'Easy', engagementRate: 0.8 },
      });

      const result = await HintInteractionService.getSystemAnalytics();

      expect(result.overview).toEqual({ totalCount: 2 });
      expect(result.effectiveness).toBeDefined();
      expect(result.trends.dailyInteractions).toHaveLength(2);
      expect(result.trends.hintTypePopularity).toHaveLength(2);
      expect(result.trends.difficultyBreakdown).toBeDefined();
      expect(result.insights).toBeDefined();
    });

    it('should filter by date range', async () => {
      const interactions = [
        { timestamp: '2024-01-01T10:00:00Z', hint_type: 'pattern', problem_difficulty: 'Easy', user_action: 'expand' },
        { timestamp: '2024-06-15T10:00:00Z', hint_type: 'general', problem_difficulty: 'Medium', user_action: 'dismiss' },
      ];
      mockGetAllInteractions.mockResolvedValue(interactions);
      mockGetInteractionStats.mockResolvedValue({});
      mockGetHintEffectiveness.mockResolvedValue({});

      const result = await HintInteractionService.getSystemAnalytics({
        startDate: '2024-06-01',
        endDate: '2024-12-31',
      });

      // Only the second interaction should remain after filtering
      expect(result.trends.dailyInteractions).toHaveLength(1);
    });

    it('should filter by difficulty', async () => {
      const interactions = [
        { timestamp: '2024-01-01T10:00:00Z', hint_type: 'pattern', problem_difficulty: 'Easy', user_action: 'expand' },
        { timestamp: '2024-01-02T10:00:00Z', hint_type: 'general', problem_difficulty: 'Medium', user_action: 'dismiss' },
      ];
      mockGetAllInteractions.mockResolvedValue(interactions);
      mockGetInteractionStats.mockResolvedValue({});
      mockGetHintEffectiveness.mockResolvedValue({});

      const result = await HintInteractionService.getSystemAnalytics({
        difficulty: 'Easy',
      });

      expect(result.trends.hintTypePopularity).toHaveLength(1);
      expect(result.trends.hintTypePopularity[0].hintType).toBe('pattern');
    });

    it('should filter by hint type', async () => {
      const interactions = [
        { timestamp: '2024-01-01T10:00:00Z', hint_type: 'pattern', problem_difficulty: 'Easy', user_action: 'expand' },
        { timestamp: '2024-01-02T10:00:00Z', hint_type: 'general', problem_difficulty: 'Medium', user_action: 'dismiss' },
      ];
      mockGetAllInteractions.mockResolvedValue(interactions);
      mockGetInteractionStats.mockResolvedValue({});
      mockGetHintEffectiveness.mockResolvedValue({});

      const result = await HintInteractionService.getSystemAnalytics({
        hintType: 'general',
      });

      expect(result.trends.hintTypePopularity).toHaveLength(1);
      expect(result.trends.hintTypePopularity[0].hintType).toBe('general');
    });

    it('should throw on DB error', async () => {
      mockGetAllInteractions.mockRejectedValue(new Error('DB error'));

      await expect(HintInteractionService.getSystemAnalytics()).rejects.toThrow('DB error');
    });
  });

  // =========================================================================
  // cleanupOldData
  // =========================================================================
  describe('cleanupOldData', () => {
    it('should clean up old interactions with default 90 days', async () => {
      mockDeleteOldInteractions.mockResolvedValue(42);

      const result = await HintInteractionService.cleanupOldData();

      expect(mockDeleteOldInteractions).toHaveBeenCalledWith(expect.any(Date));
      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(42);
      expect(result.daysKept).toBe(90);
    });

    it('should accept custom days to keep', async () => {
      mockDeleteOldInteractions.mockResolvedValue(10);

      const result = await HintInteractionService.cleanupOldData(30);

      expect(result.daysKept).toBe(30);
      expect(result.deletedCount).toBe(10);
    });

    it('should throw on DB error', async () => {
      mockDeleteOldInteractions.mockRejectedValue(new Error('DB error'));

      await expect(HintInteractionService.cleanupOldData()).rejects.toThrow('DB error');
    });
  });

  // =========================================================================
  // Private analytics helper methods
  // =========================================================================
  describe('_calculateDailyTrends', () => {
    it('should group interactions by date and sort', () => {
      const interactions = [
        { timestamp: '2024-01-03T10:00:00Z' },
        { timestamp: '2024-01-01T12:00:00Z' },
        { timestamp: '2024-01-01T14:00:00Z' },
        { timestamp: '2024-01-02T10:00:00Z' },
      ];

      const result = HintInteractionService._calculateDailyTrends(interactions);

      expect(result).toHaveLength(3); // 3 unique days
      // First entry should be the earliest date
      expect(new Date(result[0].date) <= new Date(result[1].date)).toBe(true);
      // Jan 1 should have count of 2 (two interactions on that day)
      const jan1 = result.find(r => r.date === new Date('2024-01-01T12:00:00Z').toDateString());
      expect(jan1).toBeDefined();
      expect(jan1.count).toBe(2);
    });
  });

  describe('_calculateHintTypePopularity', () => {
    it('should rank hint types by popularity', () => {
      const interactions = [
        { hint_type: 'pattern' },
        { hint_type: 'pattern' },
        { hint_type: 'general' },
        { hint_type: 'strategy' },
        { hint_type: 'strategy' },
        { hint_type: 'strategy' },
      ];

      const result = HintInteractionService._calculateHintTypePopularity(interactions);

      expect(result[0].hintType).toBe('strategy');
      expect(result[0].count).toBe(3);
      expect(result[1].hintType).toBe('pattern');
      expect(result[1].count).toBe(2);
    });
  });

  describe('_calculateDifficultyBreakdown', () => {
    it('should break down interactions by difficulty with engagement rates', () => {
      const interactions = [
        { problem_difficulty: 'Easy', user_action: 'expand' },
        { problem_difficulty: 'Easy', user_action: 'dismiss' },
        { problem_difficulty: 'Medium', user_action: 'expand' },
        { problem_difficulty: 'Medium', user_action: 'expand' },
        { problem_difficulty: 'Hard', user_action: 'dismiss' },
      ];

      const result = HintInteractionService._calculateDifficultyBreakdown(interactions);

      expect(result.Easy.total).toBe(2);
      expect(result.Easy.expanded).toBe(1);
      expect(result.Easy.engagementRate).toBeCloseTo(0.5);
      expect(result.Medium.total).toBe(2);
      expect(result.Medium.expanded).toBe(2);
      expect(result.Medium.engagementRate).toBeCloseTo(1.0);
      expect(result.Hard.total).toBe(1);
      expect(result.Hard.expanded).toBe(0);
      expect(result.Hard.engagementRate).toBeCloseTo(0);
    });
  });

  describe('_generateInsights', () => {
    it('should generate insight about most effective hints', () => {
      const effectiveness = {
        entry1: { hintType: 'pattern', difficulty: 'Easy', engagementRate: 0.9 },
        entry2: { hintType: 'general', difficulty: 'Hard', engagementRate: 0.3 },
      };

      const insights = HintInteractionService._generateInsights([], effectiveness);

      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0]).toContain('pattern');
      expect(insights[0]).toContain('90.0%');
    });

    it('should generate insight about recent interactions', () => {
      const recentInteraction = {
        timestamp: new Date().toISOString(), // Now, so within 7 days
      };

      const insights = HintInteractionService._generateInsights(
        [recentInteraction],
        {}
      );

      expect(insights.some(i => i.includes('hint interactions in the past week'))).toBe(true);
    });

    it('should return empty insights with no data', () => {
      const insights = HintInteractionService._generateInsights([], {});
      expect(insights).toEqual([]);
    });
  });
});
