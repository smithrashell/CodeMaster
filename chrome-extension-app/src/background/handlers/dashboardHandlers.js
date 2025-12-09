/**
 * Dashboard Message Handlers
 * Extracted from messageRouter.js
 */

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
  getInterviewAnalyticsData
} from "../../app/services/dashboard/dashboardService.js";
import { StorageService } from "../../shared/services/storage/storageService.js";
import { SessionService } from "../../shared/services/session/sessionService.js";
import { TagService } from "../../shared/services/attempts/tagServices.js";
import { HintInteractionService } from "../../shared/services/hints/hintInteractionService.js";
import FocusCoordinationService from "../../shared/services/focus/focusCoordinationService.js";
import { getAllSessions } from "../../shared/db/stores/sessions.js";
import { getAllAttempts } from "../../shared/db/stores/attempts.js";

export const dashboardHandlers = {
  getDashboardStatistics: (request, _dependencies, sendResponse, finishRequest) => {
    console.log("getDashboardStatistics!!!");
    getDashboardStatistics(request.options || {})
      .then((result) => sendResponse({ result }))
      .catch((error) => sendResponse({ error: error.message }))
      .finally(finishRequest);
    return true;
  },

  getLearningProgressData: (request, _dependencies, sendResponse, finishRequest) => {
    getLearningProgressData(request.options || {})
      .then((result) => sendResponse({ result }))
      .catch((error) => sendResponse({ error: error.message }))
      .finally(finishRequest);
    return true;
  },

  getGoalsData: (request, _dependencies, sendResponse, finishRequest) => {
    (async () => {
      try {
        const focusDecision = await FocusCoordinationService.getFocusDecision("session_state");
        const settings = await StorageService.getSettings();

        const [allSessions, allAttempts, hintsUsed] = await Promise.all([
          getAllSessions(),
          getAllAttempts(),
          (async () => {
            try {
              const analytics = await HintInteractionService.getSystemAnalytics({});
              return {
                total: analytics.overview?.totalInteractions || 0,
                contextual: 0,
                general: 0,
                primer: 0
              };
            } catch (_error) {
              return { total: 0, contextual: 0, general: 0, primer: 0 };
            }
          })()
        ]);

        const focusAreas = focusDecision.activeFocusTags;
        const userFocusAreas = focusDecision.userPreferences;
        const systemFocusTags = focusDecision.systemRecommendation;

        console.log("Goals data using coordination service:", {
          focusAreas,
          userFocusAreas,
          systemFocusTags,
          reasoning: focusDecision.algorithmReasoning
        });

        const result = await getGoalsData(request.options || {}, {
          settings,
          focusAreas,
          userFocusAreas,
          systemFocusTags,
          focusDecision,
          allSessions,
          allAttempts,
          hintsUsed
        });
        sendResponse({ result });
      } catch (error) {
        console.error("Error in getGoalsData handler:", error);
        sendResponse({ error: error.message });
      }
    })()
      .finally(finishRequest);
    return true;
  },

  getStatsData: (request, _dependencies, sendResponse, finishRequest) => {
    getStatsData(request.options || {})
      .then((result) => sendResponse({ result }))
      .catch((error) => sendResponse({ error: error.message }))
      .finally(finishRequest);
    return true;
  },

  getSessionHistoryData: (request, _dependencies, sendResponse, finishRequest) => {
    getSessionHistoryData(request.options || {})
      .then((result) => sendResponse({ result }))
      .catch((error) => sendResponse({ error: error.message }))
      .finally(finishRequest);
    return true;
  },

  getProductivityInsightsData: (request, _dependencies, sendResponse, finishRequest) => {
    getProductivityInsightsData(request.options || {})
      .then((result) => sendResponse({ result }))
      .catch((error) => sendResponse({ error: error.message }))
      .finally(finishRequest);
    return true;
  },

  getTagMasteryData: (request, _dependencies, sendResponse, finishRequest) => {
    getTagMasteryData(request.options || {})
      .then((result) => sendResponse({ result }))
      .catch((error) => sendResponse({ error: error.message }))
      .finally(finishRequest);
    return true;
  },

  getLearningStatus: (_request, _dependencies, sendResponse, finishRequest) => {
    (async () => {
      try {
        const cadenceData = await SessionService.getTypicalCadence();

        sendResponse({
          totalSessions: cadenceData.totalSessions || 0,
          learningPhase: cadenceData.learningPhase || true,
          confidenceScore: cadenceData.confidenceScore || 0,
          dataSpanDays: cadenceData.dataSpanDays || 0
        });
      } catch (error) {
        console.error("Error in getLearningStatus handler:", error);
        sendResponse({
          totalSessions: 0,
          learningPhase: true,
          confidenceScore: 0,
          dataSpanDays: 0
        });
      }
    })()
      .finally(finishRequest);
    return true;
  },

  getFocusAreasData: (_request, _dependencies, sendResponse, finishRequest) => {
    (async () => {
      try {
        const sessionState = await StorageService.getSessionState();
        const focusAreas = sessionState?.current_focus_tags || [];

        console.log("Dashboard focus areas (active session only):", {
          hasSessionState: !!sessionState,
          focusAreas,
          source: focusAreas.length > 0 ? 'active_session' : 'no_active_session'
        });

        const learningState = await TagService.getCurrentLearningState();
        const graduationStatus = await TagService.checkFocusAreasGraduation();

        sendResponse({
          result: {
            focusAreas,
            masteryData: learningState.masteryData || [],
            masteredTags: learningState.masteredTags || [],
            graduationStatus
          }
        });
      } catch (error) {
        console.error("Error in getFocusAreasData handler:", error);
        sendResponse({
          result: {
            focusAreas: [],
            masteryData: [],
            masteredTags: [],
            graduationStatus: null
          }
        });
      }
    })()
      .finally(finishRequest);
    return true;
  },

  graduateFocusAreas: (_request, _dependencies, sendResponse, finishRequest) => {
    (async () => {
      try {
        const result = await TagService.graduateFocusAreas();
        sendResponse({ result });
      } catch (error) {
        console.error("Error in graduateFocusAreas handler:", error);
        sendResponse({ error: error.message });
      }
    })()
      .finally(finishRequest);
    return true;
  },

  getLearningPathData: (request, _dependencies, sendResponse, finishRequest) => {
    getLearningPathData(request.options || {})
      .then((result) => sendResponse({ result }))
      .catch((error) => sendResponse({ error: error.message }))
      .finally(finishRequest);
    return true;
  },

  getLearningEfficiencyData: (_request, _dependencies, sendResponse, finishRequest) => {
    getLearningEfficiencyData()
      .then((result) => sendResponse({ result }))
      .catch((error) => sendResponse({ error: error.message }))
      .finally(finishRequest);
    return true;
  },

  getFocusAreaAnalytics: (request, _dependencies, sendResponse, finishRequest) => {
    getFocusAreaAnalytics(request.options || {})
      .then((result) => sendResponse({ result }))
      .catch((error) => sendResponse({ error: error.message }))
      .finally(finishRequest);
    return true;
  },

  getAvailableTagsForFocus: (request, _dependencies, sendResponse, finishRequest) => {
    console.log("BACKGROUND: Starting getAvailableTagsForFocus with userId:", request.userId);
    TagService.getAvailableTagsForFocus(request.userId)
      .then((result) => {
        console.log("BACKGROUND: TagService returned result:", result);
        sendResponse({ result });
      })
      .catch((error) => {
        console.error("BACKGROUND: TagService error:", error);
        sendResponse({ error: error.message });
      })
      .finally(() => {
        finishRequest();
      });
    return true;
  },

  clearFocusAreaAnalyticsCache: (_request, _dependencies, sendResponse, finishRequest) => {
    try {
      clearFocusAreaAnalyticsCache();
      sendResponse({ result: "Cache cleared successfully" });
    } catch (error) {
      console.error("clearFocusAreaAnalyticsCache error:", error);
      sendResponse({ error: error.message });
    }
    finishRequest();
    return true;
  },

  getInterviewAnalytics: (request, _dependencies, sendResponse, finishRequest) => {
    console.log("Getting interview analytics");
    getInterviewAnalyticsData(request.filters)
      .then((analyticsData) => {
        console.log("Interview analytics retrieved:", analyticsData);
        sendResponse({
          ...analyticsData,
          backgroundScriptData: "Interview analytics retrieved from dashboard service"
        });
      })
      .catch((error) => {
        console.error("Failed to get interview analytics:", error);
        sendResponse({
          analytics: [],
          metrics: {},
          recommendations: [],
          error: "Failed to get interview analytics"
        });
      })
      .finally(finishRequest);
    return true;
  }
};
