/**
 * Session Handler Module
 *
 * Extracted from messageRouter.js to improve maintainability
 * Handles all session-related message types
 *
 * IMPORTANT: This file was automatically extracted during refactoring
 * All handler logic preserved exactly to maintain behavioral compatibility
 */

import { StorageService } from "../../shared/services/storage/storageService.js";
import { SessionService } from "../../shared/services/session/sessionService.js";
import { getSessionMetrics } from "../../app/services/dashboard/dashboardService.js";

/**
 * Handler: getSession
 * Retrieves the current session
 */
export function handleGetSession(request, dependencies, sendResponse, finishRequest) {
  SessionService.getSession()
    .then((session) => sendResponse({ session }))
    .catch(() => sendResponse({ error: "Failed to get session" }))
    .finally(finishRequest);
  return true;
}

/**
 * Handler: getOrCreateSession
 * Gets or creates a session with interview banner logic and timeout monitoring
 *
 * CRITICAL BEHAVIORS PRESERVED:
 * - Interview banner logic: Returns null for manual interview mode
 * - Timeout monitoring: 25-30 second timeouts with cleanup
 * - Staleness detection: Classifies session state
 */
export async function handleGetOrCreateSession(request, dependencies, sendResponse, finishRequest) {
  const { withTimeout } = dependencies;
  const startTime = Date.now();

  // Check if we should show interview banner instead of auto-creating session
  if (!request.sessionType) {
    try {
      const settings = await StorageService.getSettings();
      if (settings?.interviewMode &&
          settings.interviewMode !== 'disabled' &&
          settings.interviewFrequency === 'manual') {
        // Return null to trigger banner display
        sendResponse({ session: null });
        finishRequest();
        return true;
      }
    } catch (error) {
      console.error('Error checking settings for banner logic:', error);
      // Continue with fallback behavior
    }
  }

  // Use explicit sessionType or default to standard (DO NOT auto-trigger interview sessions)
  const sessionType = request.sessionType || 'standard';

  // Add timeout monitoring
  const timeoutId = setTimeout(() => {
    const elapsed = Date.now() - startTime;
    console.error(`⏰ getOrCreateSession TIMEOUT after ${elapsed}ms for ${sessionType}`);
  }, 30000);

  withTimeout(
    SessionService.getOrCreateSession(sessionType),
    25000, // 25 second timeout for session creation
    `SessionService.getOrCreateSession(${sessionType})`
  )
    .then(async (session) => {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      // Check if session is stale
      let isSessionStale = false;
      if (session) {
        const classification = SessionService.classifySessionState(session);
        const classificationStale = !['active', 'unclear'].includes(classification);

        // Check if focus areas changed after session creation (read from settings)
        const settings = await StorageService.getSettings();
        const focusAreasChanged = settings?.focusAreasLastChanged;
        console.log('🔍 DEBUG: Raw focusAreasChanged from settings:', focusAreasChanged, 'type:', typeof focusAreasChanged);

        const sessionCreated = new Date(session.created_at || session.date);
        console.log('🔍 DEBUG: Session created timestamp:', session.created_at || session.date, 'parsed:', sessionCreated.toISOString());

        const focusAreasChangedDate = focusAreasChanged ? new Date(focusAreasChanged) : null;
        console.log('🔍 DEBUG: Focus areas changed date:', focusAreasChangedDate ? focusAreasChangedDate.toISOString() : 'null');

        const focusChangeStale = focusAreasChangedDate && focusAreasChangedDate > sessionCreated;
        console.log('🔍 DEBUG: Comparison - focusAreasChangedDate > sessionCreated:', focusChangeStale);
        console.log('🔍 DEBUG: Time difference (ms):', focusAreasChangedDate ? (focusAreasChangedDate.getTime() - sessionCreated.getTime()) : 'N/A');

        isSessionStale = classificationStale || focusChangeStale;

        console.log('🔍 Background: Session staleness check:', {
          sessionId: session.id?.substring(0, 8),
          sessionType: session.sessionType,
          classification: classification,
          classificationStale: classificationStale,
          focusChangeStale: focusChangeStale,
          isSessionStale: isSessionStale,
          lastActivityTime: session.lastActivityTime,
          sessionCreated: session.created_at || session.date,
          focusAreasLastChanged: focusAreasChanged
        });
      }

      sendResponse({
        session: session,
        isSessionStale: isSessionStale,
        backgroundScriptData: `${sessionType} session retrieved in ${duration}ms`,
      });
    })
    .catch((error) => {
      const duration = Date.now() - startTime;
      console.error(`❌ Error in getOrCreateSession after ${duration}ms:`, error);

      sendResponse({
        session: null,
        backgroundScriptData: `Failed to create session`,
        error: `Session creation failed: ${error.message}`,
        duration: duration,
        isEmergencyResponse: true
      });
    })
    .finally(() => {
      clearTimeout(timeoutId);
      finishRequest();
    });
  return true;
}

/**
 * Handler: refreshSession
 * Refreshes an existing session with timeout monitoring
 */
export function handleRefreshSession(request, dependencies, sendResponse, finishRequest) {
  const { withTimeout } = dependencies;
  console.log("🔄 Refreshing session:", request.sessionType || 'standard');
  const refreshStartTime = Date.now();

  withTimeout(
    SessionService.refreshSession(request.sessionType || 'standard', true), // forceNew = true
    20000, // 20 second timeout for refresh
    `SessionService.refreshSession(${request.sessionType || 'standard'})`
  )
    .then(async (session) => {
      const refreshDuration = Date.now() - refreshStartTime;
      console.log("✅ Session refreshed in", refreshDuration + "ms");

      // Clear focus area change flag since we just regenerated the session
      const settings = await StorageService.getSettings();
      await StorageService.setSettings({
        ...settings,
        focusAreasLastChanged: null
      });
      console.log("🔄 Cleared focus area change flag after regeneration");

      sendResponse({
        session: session,
        isSessionStale: false, // Fresh session is never stale
        backgroundScriptData: `Session refreshed in ${refreshDuration}ms`,
      });
    })
    .catch((error) => {
      const refreshDuration = Date.now() - refreshStartTime;
      console.error(`❌ Error refreshing session after ${refreshDuration}ms:`, error);

      sendResponse({
        session: null,
        backgroundScriptData: `Failed to refresh session`,
        error: `Session refresh failed: ${error.message}`,
      });
    })
    .finally(finishRequest);
  return true;
}

/**
 * Handler: getCurrentSession
 * DEPRECATED: Use getOrCreateSession instead
 * Kept for backward compatibility
 */
export function handleGetCurrentSession(request, dependencies, sendResponse, finishRequest) {
  console.warn("⚠️ getCurrentSession is deprecated, use getOrCreateSession instead");

  StorageService.getSettings()
    .then((settings) => {
      console.log("getCurrentSession - checking interview mode:", settings?.interviewMode, "frequency:", settings?.interviewFrequency);

      // Determine session type based on settings
      let sessionType = 'standard';
      if (settings?.interviewMode && settings.interviewMode !== "disabled") {
        sessionType = settings.interviewMode;
      }

      return SessionService.getOrCreateSession(sessionType);
    })
    .then((session) => {
      console.log("getCurrentSession - session:", session);
      sendResponse({
        session: session,
      });
    })
    .catch((error) => {
      console.error("Error retrieving session:", error);
      sendResponse({
        error: "Failed to get current session",
        session: [],
      });
    })
    .finally(finishRequest);
  return true;
}

/**
 * Handler: manualSessionCleanup
 * Triggers manual cleanup of stalled sessions
 */
export function handleManualSessionCleanup(request, dependencies, sendResponse, finishRequest) {
  const { cleanupStalledSessions } = dependencies;
  console.log("🧹 Manual session cleanup triggered");
  cleanupStalledSessions()
    .then((result) => {
      console.log("✅ Manual cleanup completed:", result);
      sendResponse({ result });
    })
    .catch((error) => {
      console.error("❌ Manual cleanup failed:", error);
      sendResponse({ error: error.message });
    })
    .finally(finishRequest);
  return true;
}

/**
 * Handler: getSessionAnalytics
 * Retrieves session analytics including stalled sessions
 */
export function handleGetSessionAnalytics(request, dependencies, sendResponse, finishRequest) {
  console.log("📊 Getting session analytics");
  (async () => {
    try {
      const stalledSessions = await SessionService.detectStalledSessions();
      const cleanupAnalytics = await new Promise(resolve => {
        chrome.storage.local.get(["sessionCleanupAnalytics"], (result) => {
          resolve(result.sessionCleanupAnalytics || []);
        });
      });

      const response = {
        stalledSessions: stalledSessions.length,
        stalledByType: stalledSessions.reduce((acc, s) => {
          acc[s.classification] = (acc[s.classification] || 0) + 1;
          return acc;
        }, {}),
        recentCleanups: cleanupAnalytics.slice(-5)
      };

      console.log("✅ Session analytics:", response);
      sendResponse(response);
    } catch (error) {
      console.error("❌ Failed to get session analytics:", error);
      sendResponse({ error: error.message });
    }
  })().finally(finishRequest);
  return true;
}

/**
 * Handler: classifyAllSessions
 * Classifies all sessions by state
 */
export function handleClassifyAllSessions(request, dependencies, sendResponse, finishRequest) {
  console.log("🔍 Classifying all sessions");
  (async () => {
    try {
      const sessions = await SessionService.getAllSessionsFromDB();
      const classifications = sessions.map(session => ({
        id: session.id.substring(0, 8),
        origin: session.origin,
        status: session.status,
        classification: SessionService.classifySessionState(session),
        lastActivity: session.lastActivityTime || session.date
      }));

      console.log(`✅ Classified ${classifications.length} sessions`);
      sendResponse({ classifications });
    } catch (error) {
      console.error("❌ Failed to classify sessions:", error);
      sendResponse({ error: error.message });
    }
  })().finally(finishRequest);
  return true;
}

/**
 * Handler: generateSessionFromTracking
 * Generates session from tracking data
 */
export function handleGenerateSessionFromTracking(request, dependencies, sendResponse, finishRequest) {
  console.log("🎯 Manual session generation from tracking triggered");
  SessionService.checkAndGenerateFromTracking()
    .then((session) => {
      console.log(session ? "✅ Session generated" : "📝 No session generated");
      sendResponse({ session });
    })
    .catch((error) => {
      console.error("❌ Failed to generate session from tracking:", error);
      sendResponse({ error: error.message });
    })
    .finally(finishRequest);
  return true;
}

/**
 * Handler: getSessionMetrics
 * Retrieves separated session metrics
 */
export function handleGetSessionMetrics(request, dependencies, sendResponse, finishRequest) {
  console.log("📊 Getting separated session metrics");
  getSessionMetrics(request.options || {})
    .then((result) => {
      console.log("✅ Session metrics retrieved");
      sendResponse({ result });
    })
    .catch((error) => {
      console.error("❌ Failed to get session metrics:", error);
      sendResponse({ error: error.message });
    })
    .finally(finishRequest);
  return true;
}

/**
 * Handler: checkInterviewFrequency
 * Checks if interview session should be created based on frequency
 */
export function handleCheckInterviewFrequency(request, dependencies, sendResponse, finishRequest) {
  console.log("🕐 Checking interview frequency requirements");
  StorageService.getSettings()
    .then(async (settings) => {
      const shouldCreate = await SessionService.shouldCreateInterviewSession(
        settings?.interviewFrequency,
        settings?.interviewMode
      );

      if (shouldCreate && settings?.interviewMode && settings?.interviewMode !== "disabled") {
        console.log(`Creating interview session based on ${settings.interviewFrequency} frequency`);
        return SessionService.createInterviewSession(settings.interviewMode);
      }

      console.log(`No interview session needed for ${settings?.interviewFrequency} frequency`);
      return null;
    })
    .then((session) => {
      sendResponse({
        session,
        backgroundScriptData: session ? "Frequency-based interview session created" : "No interview session needed"
      });
    })
    .catch((error) => {
      console.error("❌ Failed to check interview frequency:", error);
      sendResponse({
        error: "Failed to check interview frequency",
        session: null
      });
    })
    .finally(finishRequest);
  return true;
}

/**
 * Handler: completeInterviewSession
 * Completes an interview session
 */
export function handleCompleteInterviewSession(request, dependencies, sendResponse, finishRequest) {
  console.log(`🎯 Completing interview session ${request.sessionId}`);
  SessionService.checkAndCompleteInterviewSession(request.sessionId)
    .then((result) => {
      console.log("✅ Interview session completion result:", result);
      sendResponse({
        completed: result === true,
        unattemptedProblems: Array.isArray(result) ? result : [],
        backgroundScriptData: "Interview session completion handled"
      });
    })
    .catch((error) => {
      console.error("❌ Failed to complete interview session:", error);
      sendResponse({
        error: "Failed to complete interview session",
        completed: false
      });
    })
    .finally(finishRequest);
  return true;
}

/**
 * Handler: getSessionPatterns
 * Gets session patterns for consistency analysis
 */
export function handleGetSessionPatterns(request, dependencies, sendResponse, finishRequest) {
  console.log("🔍 Getting session patterns for consistency analysis");
  (async () => {
    try {
      const [currentStreak, cadence, weeklyProgress] = await Promise.all([
        SessionService.getCurrentStreak(),
        SessionService.getTypicalCadence(),
        SessionService.getWeeklyProgress()
      ]);

      const patterns = {
        currentStreak,
        cadence,
        weeklyProgress,
        lastUpdated: new Date().toISOString()
      };

      console.log("✅ Session patterns retrieved:", patterns);
      sendResponse({ result: patterns });
    } catch (error) {
      console.error("❌ Error getting session patterns:", error);
      sendResponse({ error: error.message });
    }
  })().finally(finishRequest);
  return true;
}

/**
 * Handler: checkConsistencyAlerts
 * Checks consistency alerts for reminders
 */
export function handleCheckConsistencyAlerts(request, dependencies, sendResponse, finishRequest) {
  console.log("🔔 Checking consistency alerts for reminders");
  (async () => {
    try {
      // Get user's reminder settings
      const settings = await StorageService.getSettings();
      const reminderSettings = settings?.reminder || { enabled: false };

      console.log("🔍 Using reminder settings:", reminderSettings);

      // Run comprehensive consistency check
      const consistencyCheck = await SessionService.checkConsistencyAlerts(reminderSettings);

      console.log(`✅ Consistency check complete: ${consistencyCheck.alerts?.length || 0} alerts`);
      sendResponse({ result: consistencyCheck });
    } catch (error) {
      console.error("❌ Error checking consistency alerts:", error);
      sendResponse({
        result: {
          hasAlerts: false,
          reason: "check_failed",
          alerts: [],
          error: error.message
        }
      });
    }
  })().finally(finishRequest);
  return true;
}

/**
 * Handler: getStreakRiskTiming
 * Gets streak risk timing analysis
 */
export function handleGetStreakRiskTiming(request, dependencies, sendResponse, finishRequest) {
  console.log("🔥 Getting streak risk timing analysis");
  (async () => {
    try {
      const streakTiming = await SessionService.getStreakRiskTiming();

      console.log("✅ Streak risk timing retrieved:", streakTiming);
      sendResponse({ result: streakTiming });
    } catch (error) {
      console.error("❌ Error getting streak risk timing:", error);
      sendResponse({ error: error.message });
    }
  })().finally(finishRequest);
  return true;
}

/**
 * Handler: getReEngagementTiming
 * Gets re-engagement timing analysis
 */
export function handleGetReEngagementTiming(request, dependencies, sendResponse, finishRequest) {
  console.log("👋 Getting re-engagement timing analysis");
  (async () => {
    try {
      const reEngagementTiming = await SessionService.getReEngagementTiming();

      console.log("✅ Re-engagement timing retrieved:", reEngagementTiming);
      sendResponse({ result: reEngagementTiming });
    } catch (error) {
      console.error("❌ Error getting re-engagement timing:", error);
      sendResponse({ error: error.message });
    }
  })().finally(finishRequest);
  return true;
}

// Export handler registry for session-related messages
export const sessionHandlers = {
  'getSession': handleGetSession,
  'getOrCreateSession': handleGetOrCreateSession,
  'refreshSession': handleRefreshSession,
  'getCurrentSession': handleGetCurrentSession,
  'manualSessionCleanup': handleManualSessionCleanup,
  'getSessionAnalytics': handleGetSessionAnalytics,
  'classifyAllSessions': handleClassifyAllSessions,
  'generateSessionFromTracking': handleGenerateSessionFromTracking,
  'getSessionMetrics': handleGetSessionMetrics,
  'checkInterviewFrequency': handleCheckInterviewFrequency,
  'completeInterviewSession': handleCompleteInterviewSession,
  'getSessionPatterns': handleGetSessionPatterns,
  'checkConsistencyAlerts': handleCheckConsistencyAlerts,
  'getStreakRiskTiming': handleGetStreakRiskTiming,
  'getReEngagementTiming': handleGetReEngagementTiming,
};
