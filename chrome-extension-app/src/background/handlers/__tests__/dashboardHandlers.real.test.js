/**
 * dashboardHandlers.real.test.js
 *
 * Comprehensive tests for all exported handler functions in dashboardHandlers.js.
 * All service/DB dependencies are mocked.
 */

// ---------------------------------------------------------------------------
// 1. Mocks (hoisted)
// ---------------------------------------------------------------------------
jest.mock('../../../app/services/dashboard/dashboardService.js', () => ({
  getDashboardStatistics: jest.fn(),
  getLearningProgressData: jest.fn(),
  getGoalsData: jest.fn(),
  getStatsData: jest.fn(),
  getSessionHistoryData: jest.fn(),
  getProductivityInsightsData: jest.fn(),
  getTagMasteryData: jest.fn(),
  getLearningPathData: jest.fn(),
  getLearningEfficiencyData: jest.fn(),
  getFocusAreaAnalytics: jest.fn(),
  clearFocusAreaAnalyticsCache: jest.fn(),
  getInterviewAnalyticsData: jest.fn(),
}));

jest.mock('../../../shared/services/storage/storageService.js', () => ({
  StorageService: {
    getSettings: jest.fn(),
    getSessionState: jest.fn(),
  },
}));

jest.mock('../../../shared/services/attempts/tagServices.js', () => ({
  TagService: {
    getCurrentLearningState: jest.fn(),
    checkFocusAreasGraduation: jest.fn(),
    graduateFocusAreas: jest.fn(),
    getAvailableTagsForFocus: jest.fn(),
  },
}));

jest.mock('../../../shared/services/session/sessionHabitLearning.js', () => ({
  HabitLearningHelpers: {
    getTypicalCadence: jest.fn(),
  },
}));

jest.mock('../../../shared/services/hints/hintInteractionService.js', () => ({
  HintInteractionService: {
    getSystemAnalytics: jest.fn(),
  },
}));

jest.mock('../../../shared/services/focus/focusCoordinationService.js', () => ({
  __esModule: true,
  default: {
    getFocusDecision: jest.fn(),
  },
}));

jest.mock('../../../shared/db/stores/sessions.js', () => ({
  getAllSessions: jest.fn(),
}));

jest.mock('../../../shared/db/stores/attempts.js', () => ({
  getAllAttempts: jest.fn(),
}));

// ---------------------------------------------------------------------------
// 2. Imports
// ---------------------------------------------------------------------------
import { dashboardHandlers } from '../dashboardHandlers.js';

import {
  getDashboardStatistics,
  getLearningProgressData,
  getGoalsData,
  getStatsData,
  getSessionHistoryData,
  getProductivityInsightsData,
  getTagMasteryData,
  getLearningPathData,
  getLearningEfficiencyData,
  getFocusAreaAnalytics,
  clearFocusAreaAnalyticsCache,
  getInterviewAnalyticsData,
} from '../../../app/services/dashboard/dashboardService.js';
import { StorageService } from '../../../shared/services/storage/storageService.js';
import { TagService } from '../../../shared/services/attempts/tagServices.js';
import { HabitLearningHelpers } from '../../../shared/services/session/sessionHabitLearning.js';
import { HintInteractionService } from '../../../shared/services/hints/hintInteractionService.js';
import FocusCoordinationService from '../../../shared/services/focus/focusCoordinationService.js';
import { getAllSessions } from '../../../shared/db/stores/sessions.js';
import { getAllAttempts } from '../../../shared/db/stores/attempts.js';

// ---------------------------------------------------------------------------
// 3. Helpers
// ---------------------------------------------------------------------------
const sr = () => jest.fn();
const fr = () => jest.fn();
const flush = () => new Promise((r) => setTimeout(r, 0));
const noDeps = {};

// ---------------------------------------------------------------------------
// 4. Tests
// ---------------------------------------------------------------------------
describe('dashboardHandlers', () => {
  afterEach(() => jest.clearAllMocks());

  // -----------------------------------------------------------------------
  // getDashboardStatistics
  // -----------------------------------------------------------------------
  describe('getDashboardStatistics', () => {
    it('calls service and sends result', async () => {
      const stats = { totalSolved: 50 };
      getDashboardStatistics.mockResolvedValue(stats);

      const sendResponse = sr();
      const finishRequest = fr();
      const result = dashboardHandlers.getDashboardStatistics(
        { options: { period: 'week' } }, noDeps, sendResponse, finishRequest
      );
      expect(result).toBe(true);
      await flush();

      expect(getDashboardStatistics).toHaveBeenCalledWith({ period: 'week' });
      expect(sendResponse).toHaveBeenCalledWith({ result: stats });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('uses empty options when none provided', async () => {
      getDashboardStatistics.mockResolvedValue({});

      const sendResponse = sr();
      dashboardHandlers.getDashboardStatistics({}, noDeps, sendResponse, fr());
      await flush();

      expect(getDashboardStatistics).toHaveBeenCalledWith({});
    });

    it('sends error on failure', async () => {
      getDashboardStatistics.mockRejectedValue(new Error('stats fail'));

      const sendResponse = sr();
      dashboardHandlers.getDashboardStatistics({}, noDeps, sendResponse, fr());
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ error: 'stats fail' });
    });
  });

  // -----------------------------------------------------------------------
  // getLearningProgressData
  // -----------------------------------------------------------------------
  describe('getLearningProgressData', () => {
    it('returns progress data', async () => {
      getLearningProgressData.mockResolvedValue({ progress: 75 });

      const sendResponse = sr();
      const finishRequest = fr();
      dashboardHandlers.getLearningProgressData(
        { options: {} }, noDeps, sendResponse, finishRequest
      );
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ result: { progress: 75 } });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('sends error on failure', async () => {
      getLearningProgressData.mockRejectedValue(new Error('progress fail'));

      const sendResponse = sr();
      dashboardHandlers.getLearningProgressData({}, noDeps, sendResponse, fr());
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ error: 'progress fail' });
    });
  });

  // -----------------------------------------------------------------------
  // getGoalsData
  // -----------------------------------------------------------------------
  describe('getGoalsData', () => {
    it('orchestrates focus decision, settings, sessions, attempts, hints', async () => {
      FocusCoordinationService.getFocusDecision.mockResolvedValue({
        activeFocusTags: ['Array'],
        userPreferences: ['Array'],
        systemRecommendation: ['Tree'],
        algorithmReasoning: 'test',
      });
      StorageService.getSettings.mockResolvedValue({ theme: 'dark' });
      getAllSessions.mockResolvedValue([{ id: 's1' }]);
      getAllAttempts.mockResolvedValue([{ id: 'a1' }]);
      HintInteractionService.getSystemAnalytics.mockResolvedValue({
        overview: { totalInteractions: 10 },
      });
      getGoalsData.mockResolvedValue({ goals: 'data' });

      const sendResponse = sr();
      const finishRequest = fr();
      dashboardHandlers.getGoalsData({ options: { x: 1 } }, noDeps, sendResponse, finishRequest);
      await flush();

      expect(FocusCoordinationService.getFocusDecision).toHaveBeenCalledWith('session_state');
      expect(getGoalsData).toHaveBeenCalledWith(
        { x: 1 },
        expect.objectContaining({
          settings: { theme: 'dark' },
          focusAreas: ['Array'],
          userFocusAreas: ['Array'],
          systemFocusTags: ['Tree'],
          allSessions: [{ id: 's1' }],
          allAttempts: [{ id: 'a1' }],
          hintsUsed: { total: 10, contextual: 0, general: 0, primer: 0 },
        })
      );
      expect(sendResponse).toHaveBeenCalledWith({ result: { goals: 'data' } });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('provides fallback hints when analytics fails', async () => {
      FocusCoordinationService.getFocusDecision.mockResolvedValue({
        activeFocusTags: [],
        userPreferences: [],
        systemRecommendation: [],
        algorithmReasoning: '',
      });
      StorageService.getSettings.mockResolvedValue({});
      getAllSessions.mockResolvedValue([]);
      getAllAttempts.mockResolvedValue([]);
      HintInteractionService.getSystemAnalytics.mockRejectedValue(new Error('hint fail'));
      getGoalsData.mockResolvedValue({});

      const sendResponse = sr();
      dashboardHandlers.getGoalsData({}, noDeps, sendResponse, fr());
      await flush();

      expect(getGoalsData).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          hintsUsed: { total: 0, contextual: 0, general: 0, primer: 0 },
        })
      );
    });

    it('sends error when focus decision fails', async () => {
      FocusCoordinationService.getFocusDecision.mockRejectedValue(new Error('focus fail'));

      const sendResponse = sr();
      dashboardHandlers.getGoalsData({}, noDeps, sendResponse, fr());
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ error: 'focus fail' });
    });
  });

  // -----------------------------------------------------------------------
  // getStatsData
  // -----------------------------------------------------------------------
  describe('getStatsData', () => {
    it('returns stats', async () => {
      getStatsData.mockResolvedValue({ stats: 'data' });

      const sendResponse = sr();
      dashboardHandlers.getStatsData({ options: {} }, noDeps, sendResponse, fr());
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ result: { stats: 'data' } });
    });

    it('sends error on failure', async () => {
      getStatsData.mockRejectedValue(new Error('err'));

      const sendResponse = sr();
      dashboardHandlers.getStatsData({}, noDeps, sendResponse, fr());
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ error: 'err' });
    });
  });

  // -----------------------------------------------------------------------
  // getSessionHistoryData
  // -----------------------------------------------------------------------
  describe('getSessionHistoryData', () => {
    it('returns session history', async () => {
      getSessionHistoryData.mockResolvedValue([{ id: 's1' }]);

      const sendResponse = sr();
      dashboardHandlers.getSessionHistoryData({ options: {} }, noDeps, sendResponse, fr());
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ result: [{ id: 's1' }] });
    });

    it('sends error on failure', async () => {
      getSessionHistoryData.mockRejectedValue(new Error('hist'));

      const sendResponse = sr();
      dashboardHandlers.getSessionHistoryData({}, noDeps, sendResponse, fr());
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ error: 'hist' });
    });
  });

  // -----------------------------------------------------------------------
  // getProductivityInsightsData
  // -----------------------------------------------------------------------
  describe('getProductivityInsightsData', () => {
    it('returns insights', async () => {
      getProductivityInsightsData.mockResolvedValue({ insights: true });

      const sendResponse = sr();
      dashboardHandlers.getProductivityInsightsData({ options: {} }, noDeps, sendResponse, fr());
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ result: { insights: true } });
    });

    it('sends error on failure', async () => {
      getProductivityInsightsData.mockRejectedValue(new Error('prod'));

      const sendResponse = sr();
      dashboardHandlers.getProductivityInsightsData({}, noDeps, sendResponse, fr());
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ error: 'prod' });
    });
  });

  // -----------------------------------------------------------------------
  // getTagMasteryData
  // -----------------------------------------------------------------------
  describe('getTagMasteryData', () => {
    it('returns tag mastery data', async () => {
      getTagMasteryData.mockResolvedValue({ mastery: [] });

      const sendResponse = sr();
      dashboardHandlers.getTagMasteryData({ options: {} }, noDeps, sendResponse, fr());
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ result: { mastery: [] } });
    });

    it('sends error on failure', async () => {
      getTagMasteryData.mockRejectedValue(new Error('mastery'));

      const sendResponse = sr();
      dashboardHandlers.getTagMasteryData({}, noDeps, sendResponse, fr());
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ error: 'mastery' });
    });
  });

  // -----------------------------------------------------------------------
  // getLearningStatus
  // -----------------------------------------------------------------------
  describe('getLearningStatus', () => {
    it('returns learning status from cadence data', async () => {
      HabitLearningHelpers.getTypicalCadence.mockResolvedValue({
        totalSessions: 10,
        learningPhase: false,
        confidenceScore: 0.85,
        dataSpanDays: 30,
      });

      const sendResponse = sr();
      const finishRequest = fr();
      dashboardHandlers.getLearningStatus({}, noDeps, sendResponse, finishRequest);
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({
        totalSessions: 10,
        learningPhase: false,
        confidenceScore: 0.85,
        dataSpanDays: 30,
      });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('returns defaults when cadence data has missing fields', async () => {
      HabitLearningHelpers.getTypicalCadence.mockResolvedValue({});

      const sendResponse = sr();
      dashboardHandlers.getLearningStatus({}, noDeps, sendResponse, fr());
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({
        totalSessions: 0,
        learningPhase: true,
        confidenceScore: 0,
        dataSpanDays: 0,
      });
    });

    it('returns fallback values on error', async () => {
      HabitLearningHelpers.getTypicalCadence.mockRejectedValue(new Error('cadence fail'));

      const sendResponse = sr();
      dashboardHandlers.getLearningStatus({}, noDeps, sendResponse, fr());
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({
        totalSessions: 0,
        learningPhase: true,
        confidenceScore: 0,
        dataSpanDays: 0,
      });
    });
  });

  // -----------------------------------------------------------------------
  // getFocusAreasData
  // -----------------------------------------------------------------------
  describe('getFocusAreasData', () => {
    it('returns focus areas and mastery data', async () => {
      StorageService.getSessionState.mockResolvedValue({
        current_focus_tags: ['Array', 'Tree'],
      });
      TagService.getCurrentLearningState.mockResolvedValue({
        masteryData: [{ tag: 'Array', level: 3 }],
        masteredTags: ['DP'],
      });
      TagService.checkFocusAreasGraduation.mockResolvedValue({
        ready: true,
      });

      const sendResponse = sr();
      const finishRequest = fr();
      dashboardHandlers.getFocusAreasData({}, noDeps, sendResponse, finishRequest);
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({
        result: {
          focusAreas: ['Array', 'Tree'],
          masteryData: [{ tag: 'Array', level: 3 }],
          masteredTags: ['DP'],
          graduationStatus: { ready: true },
        },
      });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('returns empty focus areas when session state is null', async () => {
      StorageService.getSessionState.mockResolvedValue(null);
      TagService.getCurrentLearningState.mockResolvedValue({});
      TagService.checkFocusAreasGraduation.mockResolvedValue(null);

      const sendResponse = sr();
      dashboardHandlers.getFocusAreasData({}, noDeps, sendResponse, fr());
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({
        result: expect.objectContaining({ focusAreas: [] }),
      });
    });

    it('returns fallback on error', async () => {
      StorageService.getSessionState.mockRejectedValue(new Error('state fail'));

      const sendResponse = sr();
      dashboardHandlers.getFocusAreasData({}, noDeps, sendResponse, fr());
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({
        result: {
          focusAreas: [],
          masteryData: [],
          masteredTags: [],
          graduationStatus: null,
        },
      });
    });
  });

  // -----------------------------------------------------------------------
  // graduateFocusAreas
  // -----------------------------------------------------------------------
  describe('graduateFocusAreas', () => {
    it('graduates and returns result', async () => {
      TagService.graduateFocusAreas.mockResolvedValue({ graduated: ['Array'] });

      const sendResponse = sr();
      const finishRequest = fr();
      dashboardHandlers.graduateFocusAreas({}, noDeps, sendResponse, finishRequest);
      await flush();

      expect(TagService.graduateFocusAreas).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({ result: { graduated: ['Array'] } });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('sends error on failure', async () => {
      TagService.graduateFocusAreas.mockRejectedValue(new Error('grad fail'));

      const sendResponse = sr();
      dashboardHandlers.graduateFocusAreas({}, noDeps, sendResponse, fr());
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ error: 'grad fail' });
    });
  });

  // -----------------------------------------------------------------------
  // getLearningPathData
  // -----------------------------------------------------------------------
  describe('getLearningPathData', () => {
    it('returns learning path data', async () => {
      getLearningPathData.mockResolvedValue({ path: [] });

      const sendResponse = sr();
      dashboardHandlers.getLearningPathData({ options: {} }, noDeps, sendResponse, fr());
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ result: { path: [] } });
    });

    it('sends error on failure', async () => {
      getLearningPathData.mockRejectedValue(new Error('path'));

      const sendResponse = sr();
      dashboardHandlers.getLearningPathData({}, noDeps, sendResponse, fr());
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ error: 'path' });
    });
  });

  // -----------------------------------------------------------------------
  // getLearningEfficiencyData
  // -----------------------------------------------------------------------
  describe('getLearningEfficiencyData', () => {
    it('returns efficiency data', async () => {
      getLearningEfficiencyData.mockResolvedValue({ efficiency: 90 });

      const sendResponse = sr();
      dashboardHandlers.getLearningEfficiencyData({}, noDeps, sendResponse, fr());
      await flush();

      expect(getLearningEfficiencyData).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({ result: { efficiency: 90 } });
    });

    it('sends error on failure', async () => {
      getLearningEfficiencyData.mockRejectedValue(new Error('eff'));

      const sendResponse = sr();
      dashboardHandlers.getLearningEfficiencyData({}, noDeps, sendResponse, fr());
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ error: 'eff' });
    });
  });

  // -----------------------------------------------------------------------
  // getFocusAreaAnalytics
  // -----------------------------------------------------------------------
  describe('getFocusAreaAnalytics', () => {
    it('returns analytics data', async () => {
      getFocusAreaAnalytics.mockResolvedValue({ analytics: [] });

      const sendResponse = sr();
      dashboardHandlers.getFocusAreaAnalytics({ options: { tag: 'Array' } }, noDeps, sendResponse, fr());
      await flush();

      expect(getFocusAreaAnalytics).toHaveBeenCalledWith({ tag: 'Array' });
      expect(sendResponse).toHaveBeenCalledWith({ result: { analytics: [] } });
    });

    it('sends error on failure', async () => {
      getFocusAreaAnalytics.mockRejectedValue(new Error('analytics'));

      const sendResponse = sr();
      dashboardHandlers.getFocusAreaAnalytics({}, noDeps, sendResponse, fr());
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ error: 'analytics' });
    });
  });

  // -----------------------------------------------------------------------
  // getAvailableTagsForFocus
  // -----------------------------------------------------------------------
  describe('getAvailableTagsForFocus', () => {
    it('returns available tags', async () => {
      TagService.getAvailableTagsForFocus.mockResolvedValue(['Array', 'Tree']);

      const sendResponse = sr();
      const finishRequest = fr();
      dashboardHandlers.getAvailableTagsForFocus(
        { userId: 'u1' }, noDeps, sendResponse, finishRequest
      );
      await flush();

      expect(TagService.getAvailableTagsForFocus).toHaveBeenCalledWith('u1');
      expect(sendResponse).toHaveBeenCalledWith({ result: ['Array', 'Tree'] });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('sends error on failure', async () => {
      TagService.getAvailableTagsForFocus.mockRejectedValue(new Error('tags fail'));

      const sendResponse = sr();
      const finishRequest = fr();
      dashboardHandlers.getAvailableTagsForFocus({ userId: 'u1' }, noDeps, sendResponse, finishRequest);
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ error: 'tags fail' });
      expect(finishRequest).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // clearFocusAreaAnalyticsCache
  // -----------------------------------------------------------------------
  describe('clearFocusAreaAnalyticsCache', () => {
    it('clears cache and sends success', () => {
      const sendResponse = sr();
      const finishRequest = fr();
      const result = dashboardHandlers.clearFocusAreaAnalyticsCache(
        {}, noDeps, sendResponse, finishRequest
      );

      expect(result).toBe(true);
      expect(clearFocusAreaAnalyticsCache).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({ result: 'Cache cleared successfully' });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('sends error when clearing throws', () => {
      clearFocusAreaAnalyticsCache.mockImplementation(() => {
        throw new Error('clear fail');
      });

      const sendResponse = sr();
      const finishRequest = fr();
      dashboardHandlers.clearFocusAreaAnalyticsCache({}, noDeps, sendResponse, finishRequest);

      expect(sendResponse).toHaveBeenCalledWith({ error: 'clear fail' });
      expect(finishRequest).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // getInterviewAnalytics
  // -----------------------------------------------------------------------
  describe('getInterviewAnalytics', () => {
    it('returns interview analytics with background script data', async () => {
      const analyticsData = {
        analytics: [{ id: 1 }],
        metrics: { total: 5 },
        recommendations: ['practice more'],
      };
      getInterviewAnalyticsData.mockResolvedValue(analyticsData);

      const sendResponse = sr();
      const finishRequest = fr();
      dashboardHandlers.getInterviewAnalytics(
        { filters: { dateRange: 'week' } }, noDeps, sendResponse, finishRequest
      );
      await flush();

      expect(getInterviewAnalyticsData).toHaveBeenCalledWith({ dateRange: 'week' });
      expect(sendResponse).toHaveBeenCalledWith({
        ...analyticsData,
        backgroundScriptData: 'Interview analytics retrieved from dashboard service',
      });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('returns fallback on error', async () => {
      getInterviewAnalyticsData.mockRejectedValue(new Error('interview fail'));

      const sendResponse = sr();
      dashboardHandlers.getInterviewAnalytics({ filters: {} }, noDeps, sendResponse, fr());
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({
        analytics: [],
        metrics: {},
        recommendations: [],
        error: 'Failed to get interview analytics',
      });
    });
  });

  // -----------------------------------------------------------------------
  // Registry check
  // -----------------------------------------------------------------------
  describe('handler registry', () => {
    it('exports all expected handler names', () => {
      const expectedHandlers = [
        'getDashboardStatistics',
        'getLearningProgressData',
        'getGoalsData',
        'getStatsData',
        'getSessionHistoryData',
        'getProductivityInsightsData',
        'getTagMasteryData',
        'getLearningStatus',
        'getFocusAreasData',
        'graduateFocusAreas',
        'getLearningPathData',
        'getLearningEfficiencyData',
        'getFocusAreaAnalytics',
        'getAvailableTagsForFocus',
        'clearFocusAreaAnalyticsCache',
        'getInterviewAnalytics',
      ];

      expectedHandlers.forEach((name) => {
        expect(typeof dashboardHandlers[name]).toBe('function');
      });
    });
  });
});
