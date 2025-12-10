/**
 * Session Interview Helpers
 * Extracted from sessionService.js - interview session management
 */

import { getLatestSession, getSessionPerformance } from "../../db/stores/sessions.js";
import { getTagMastery } from "../../db/stores/tag_mastery.js";
import logger from "../../utils/logging/logger.js";

/**
 * Check if interview session should be created based on frequency
 */
export async function shouldCreateInterviewSession(frequency, _mode) {
  if (!frequency || frequency === "manual") {
    return false;
  }

  try {
    const latestSession = await getLatestSession();

    if (frequency === "weekly") {
      if (!latestSession || !latestSession.session_type) {
        return true;
      }

      const lastInterviewDate = new Date(latestSession.date);
      const daysSinceLastInterview = (Date.now() - lastInterviewDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceLastInterview >= 7;
    }

    if (frequency === "level-up") {
      return false;
    }

    return false;
  } catch (error) {
    logger.error("Error checking interview session frequency:", error);
    return false;
  }
}

/**
 * Interview performance summary (extends standard performance analysis)
 * @param {Object} session - The interview session
 * @param {Function} summarizeSessionPerformanceFn - Reference to standard summary function
 */
export async function summarizeInterviewPerformance(session, summarizeSessionPerformanceFn) {
  try {
    const standardSummary = await summarizeSessionPerformanceFn(session);

    if (!session.interviewMetrics) {
      logger.warn("No interview metrics available for session summary");
      return standardSummary;
    }

    const interviewSummary = {
      ...standardSummary,
      interviewAnalysis: {
        mode: session.session_type,
        transferReadinessScore: session.interviewMetrics.transferReadinessScore,
        interventionNeedScore: session.interviewMetrics.interventionNeedScore,
        overallMetrics: session.interviewMetrics.overallMetrics,
        feedback: session.interviewMetrics.feedbackGenerated,
        tagPerformance: Array.from(session.interviewMetrics.tagPerformance.entries())
      }
    };

    storeInterviewAnalytics(interviewSummary);

    logger.info("📊 Interview session analysis complete:", {
      sessionId: session.id,
      mode: session.session_type,
      transferReadiness: session.interviewMetrics.transferReadinessScore,
      feedbackItems: session.interviewMetrics.feedbackGenerated
    });

    return interviewSummary;

  } catch (error) {
    logger.error("Error summarizing interview performance:", error);
    return summarizeSessionPerformanceFn(session);
  }
}

/**
 * Store interview analytics for dashboard
 */
export function storeInterviewAnalytics(interviewSummary) {
  try {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.get(["interviewAnalytics"], (result) => {
        const analytics = result.interviewAnalytics || [];

        const interviewEvent = {
          timestamp: interviewSummary.completedAt,
          type: "interview_session_completed",
          sessionId: interviewSummary.sessionId,
          mode: interviewSummary.interviewAnalysis.mode,
          transferMetrics: interviewSummary.interviewAnalysis.overallMetrics,
          readinessScore: interviewSummary.interviewAnalysis.transferReadinessScore,
          feedback: interviewSummary.interviewAnalysis.feedback
        };

        analytics.push(interviewEvent);

        const recentAnalytics = analytics.slice(-30);
        chrome.storage.local.set({ interviewAnalytics: recentAnalytics });
      });
    }
  } catch (error) {
    logger.error("Error storing interview analytics:", error);
  }
}

/**
 * Get tag performance baselines for transfer metrics
 */
export async function getTagPerformanceBaselines() {
  try {
    const _recentPerformance = await getSessionPerformance({
      recentSessionsLimit: 10
    });

    const tagMastery = await getTagMastery();
    const baselines = {};

    tagMastery.forEach(tm => {
      if (tm.totalAttempts > 0) {
        baselines[tm.tag] = {
          avgTime: tm.avgTime || 1200000,
          successRate: tm.successfulAttempts / tm.totalAttempts,
          attempts: tm.totalAttempts
        };
      }
    });

    return baselines;
  } catch (error) {
    logger.error("Error getting tag performance baselines:", error);
    return {};
  }
}
