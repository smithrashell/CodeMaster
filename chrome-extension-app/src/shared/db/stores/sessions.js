import { dbHelper } from "../index.js";
import { TagService } from "../../services/attempts/tagServices.js";
import { StorageService } from "../../services/storage/storageService.js";
import FocusCoordinationService from "../../services/focus/focusCoordinationService.js";
import { InterviewService } from "../../services/session/interviewService.js";
import { getRecentSessionAnalytics } from "./sessionAnalytics.js";
import logger from "../../utils/logging/logger.js";

// Re-export helpers for backwards compatibility
export { applyEscapeHatchLogic, checkForDemotion, analyzePerformanceTrend } from "./sessionEscapeHatchHelpers.js";
export {
  applyOnboardingSettings,
  applyPostOnboardingLogic,
  applyInterviewInsightsToSessionLength,
  calculateNewProblems,
  applyInterviewInsightsToTags,
  computeSessionLength,
  normalizeSessionLengthForCalculation,
  applySessionLengthPreference
} from "./sessionAdaptiveHelpers.js";
export {
  filterSessions,
  processAttempts,
  calculateTagStrengths,
  calculateTimingFeedback,
  calculateTagIndexProgression
} from "./sessionPerformanceHelpers.js";

// Import helpers for internal use
import { applyEscapeHatchLogic, checkForDemotion, analyzePerformanceTrend } from "./sessionEscapeHatchHelpers.js";
import {
  applyOnboardingSettings,
  applyPostOnboardingLogic
} from "./sessionAdaptiveHelpers.js";
import {
  filterSessions,
  processAttempts,
  calculateTagStrengths,
  calculateTimingFeedback
} from "./sessionPerformanceHelpers.js";

const openDB = () => dbHelper.openDB();

/**
 * Retrieves a session by its ID.
 */
export const getSessionById = async (session_id) => {
  if (!session_id) {
    console.error(`getSessionById called with invalid session_id:`, session_id);
    return null;
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("sessions", "readonly");
    const store = transaction.objectStore("sessions");

    const request = store.get(session_id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Fetches the latest session by date.
 * @deprecated Use getLatestSessionByType() for better performance
 */
export const getLatestSession = async () => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("sessions", "readonly");
    const store = transaction.objectStore("sessions");

    const request = store.getAll();
    request.onsuccess = (event) => {
      const allSessions = event.target.result || [];

      if (allSessions.length === 0) {
        resolve(null);
        return;
      }

      const sortedSessions = allSessions.sort((a, b) => {
        const dateA = new Date(a.date || a.created_date || a.Date || 0);
        const dateB = new Date(b.date || b.created_date || b.Date || 0);
        return dateB - dateA;
      });
      const result = sortedSessions[0];
      resolve(result);
    };
    request.onerror = (e) => {
      logger.error("getLatestSession() error:", e.target.error);
      reject(e.target.error);
    };
  });
};

/**
 * Efficiently fetches the latest session by type and/or status using database indexes.
 */
export const getLatestSessionByType = async (session_type = null, status = null) => {
  logger.info(`getLatestSessionByType ENTRY: session_type=${session_type}, status=${status}`);

  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction("sessions", "readonly");
    const store = transaction.objectStore("sessions");

    const normalizedSessionType = session_type || 'standard';

    console.log(`INDEX DEBUG: Available indexes:`, {
      available: Array.from(store.indexNames),
      requestedType: normalizedSessionType,
      requestedStatus: status,
      targetIndex: status ? "by_session_type_status" : "by_session_type"
    });

    let index, keyRange;
    try {
      if (status) {
        index = store.index("by_session_type_status");
        keyRange = IDBKeyRange.only([normalizedSessionType, status]);
        console.log(`INDEX DEBUG: Using composite index with key:`, [normalizedSessionType, status]);
      } else {
        index = store.index("by_session_type");
        keyRange = IDBKeyRange.only(normalizedSessionType);
        console.log(`INDEX DEBUG: Using session_type index with key:`, normalizedSessionType);
      }
    } catch (error) {
      console.error(`INDEX ACCESS ERROR: Failed to access index, falling back to full scan:`, {
        indexName: status ? "by_session_type_status" : "by_session_type",
        error: error.message,
        availableIndexes: Array.from(store.indexNames)
      });
      logger.error(`getLatestSessionByType() index error, using fallback:`, error);

      const fallbackRequest = store.getAll();
      fallbackRequest.onsuccess = () => {
        const allSessions = fallbackRequest.result || [];

        const filteredSessions = allSessions
          .filter(session => {
            const matchesType = !normalizedSessionType || session.session_type === normalizedSessionType;
            const matchesStatus = !status || session.status === status;
            return matchesType && matchesStatus;
          })
          .sort((a, b) => new Date(b.date) - new Date(a.date));

        const latestSession = filteredSessions[0] || null;
        if (latestSession) {
          logger.info(`Found matching ${normalizedSessionType} session via fallback: ${latestSession.id?.substring(0,8)}... status=${latestSession.status}`);
        } else {
          logger.info(`No ${normalizedSessionType}/${status} sessions found via fallback`);
        }
        resolve(latestSession);
      };

      fallbackRequest.onerror = () => {
        logger.error(`Fallback query also failed:`, fallbackRequest.error);
        reject(fallbackRequest.error);
      };

      return;
    }

    // Collect all matching sessions, then sort by date to get the latest
    // The index only contains [session_type, status], not date, so cursor order is arbitrary
    const matchingSessions = [];
    const request = index.openCursor(keyRange);

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        matchingSessions.push(cursor.value);
        cursor.continue();
      } else {
        // All sessions collected, now sort by date descending to get latest
        if (matchingSessions.length > 0) {
          matchingSessions.sort((a, b) => new Date(b.date) - new Date(a.date));
          const latestSession = matchingSessions[0];
          logger.info(`Found ${matchingSessions.length} matching ${normalizedSessionType} sessions, returning latest: ${latestSession.id?.substring(0,8)}... (date: ${latestSession.date})`);
          resolve(latestSession);
        } else {
          logger.info(`No matching ${normalizedSessionType} session found with status=${status || 'any'}`);
          resolve(null);
        }
      }
    };

    request.onerror = (e) => {
      logger.error("getLatestSessionByType() error:", e.target.error);
      reject(e.target.error);
    };
  });
};

/**
 * Saves a new session to IndexedDB.
 */
export const saveNewSessionToDB = async (session) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("sessions", "readwrite");
    const store = transaction.objectStore("sessions");
    logger.info("session", session);
    const request = store.add(session);
    request.onsuccess = () => resolve(session);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Updates an existing session in IndexedDB.
 */
export const updateSessionInDB = async (session) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("sessions", "readwrite");
    const store = transaction.objectStore("sessions");

    const request = store.put(session);
    request.onsuccess = () => resolve(session);
    request.onerror = (event) => reject(event.target.error);
  });
};

/**
 * Deletes a session from IndexedDB by ID.
 */
export const deleteSessionFromDB = async (sessionId) => {
  if (!sessionId) {
    throw new Error('deleteSessionFromDB requires a valid sessionId');
  }

  const db = await openDB();

  const session = await getSessionById(sessionId);
  if (session) {
    if (session.status === 'completed') {
      console.warn(`Deleting completed session ${sessionId} - verify this is intentional`);
    } else if (session.status === 'in_progress') {
      console.info(`Deleting in_progress session ${sessionId} (likely for regeneration)`);
    }
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction("sessions", "readwrite");
    const store = transaction.objectStore("sessions");

    const request = store.delete(sessionId);
    request.onsuccess = () => {
      console.info(`Successfully deleted session ${sessionId}`);
      resolve();
    };
    request.onerror = (event) => reject(event.target.error);
  });
};

/**
 * Atomically gets latest session or creates new one if none exists.
 */
export const getOrCreateSessionAtomic = async (sessionType = 'standard', status = 'in_progress', newSessionData = null) => {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction("sessions", "readwrite");
    const store = transaction.objectStore("sessions");

    let index;
    try {
      index = store.index("by_session_type_status");
    } catch (error) {
      console.error(`INDEX ACCESS ERROR: by_session_type_status index not found`, {
        error: error.message,
        availableIndexes: Array.from(store.indexNames)
      });
      reject(error);
      return;
    }

    const normalizedSessionType = sessionType || 'standard';
    const existingCheck = index.get([normalizedSessionType, status]);

    existingCheck.onsuccess = () => {
      const existingSession = existingCheck.result;

      if (existingSession) {
        logger.info("Atomic check: Found existing session", existingSession.id);
        resolve(existingSession);
      } else if (newSessionData) {
        logger.info("Atomic check: No existing session, creating new one");
        const addRequest = store.add(newSessionData);
        addRequest.onsuccess = () => {
          logger.info("Atomic creation: New session created", newSessionData.id);
          resolve(newSessionData);
        };
        addRequest.onerror = () => {
          logger.error("Atomic creation failed:", addRequest.error);
          reject(addRequest.error);
        };
      } else {
        logger.info("Atomic check: No existing session, no creation data provided");
        resolve(null);
      }
    };

    existingCheck.onerror = () => {
      logger.error("Atomic check failed:", existingCheck.error);
      reject(existingCheck.error);
    };
  });
};

/**
 * Saves session to Chrome Storage with fallback handling.
 */
export const saveSessionToStorage = (session, updateDatabase = false) => {
  return new Promise((resolve, reject) => {
    try {
      if (typeof chrome !== "undefined" && chrome?.storage?.local?.set) {
        chrome.storage.local.set({ currentSession: session }, async () => {
          if (chrome.runtime?.lastError) {
            logger.warn("Chrome storage error:", chrome.runtime.lastError);
          }

          if (updateDatabase) {
            try {
              await updateSessionInDB(session);
            } catch (error) {
              logger.warn("IndexedDB update failed after Chrome storage save:", error);
            }
          }
          resolve();
        });
      } else {
        logger.warn("Chrome storage API unavailable, skipping session storage to Chrome");

        if (updateDatabase) {
          updateSessionInDB(session)
            .then(() => {
              logger.info("Session saved to IndexedDB (Chrome storage unavailable)");
              resolve();
            })
            .catch((error) => {
              logger.error("Both Chrome storage and IndexedDB unavailable:", error);
              reject(new Error("No storage mechanism available"));
            });
          return;
        }

        resolve();
      }
    } catch (error) {
      logger.error("Error in saveSessionToStorage:", error);

      if (updateDatabase) {
        updateSessionInDB(session)
          .then(() => {
            logger.info("Fallback to IndexedDB successful");
            resolve();
          })
          .catch((dbError) => {
            logger.error("All storage mechanisms failed:", { chromeError: error, dbError });
            reject(new Error("All storage mechanisms unavailable"));
          });
      } else {
        logger.warn("Chrome storage failed, but continuing without storage");
        resolve();
      }
    }
  });
};

/**
 * Initialize session state with default values
 */
async function initializeSessionState(sessionStateKey) {
  console.log(`SESSION STATE DEBUG: initializeSessionState ENTRY with key: ${sessionStateKey}`);

  const migratedState = await StorageService.migrateSessionStateToIndexedDB();
  const storedState = await StorageService.getSessionState(sessionStateKey);

  console.log(`SESSION STATE DEBUG: State loading results:`, {
    hasMigratedState: !!migratedState,
    hasStoredState: !!storedState,
    migratedSessionsCompleted: migratedState?.num_sessions_completed,
    storedSessionsCompleted: storedState?.num_sessions_completed
  });

  let sessionState = migratedState || storedState || {
    id: sessionStateKey,
    num_sessions_completed: 0,
    current_difficulty_cap: "Easy",
    tag_index: 0,
    difficulty_time_stats: {
      easy: { problems: 0, total_time: 0, avg_time: 0 },
      medium: { problems: 0, total_time: 0, avg_time: 0 },
      hard: { problems: 0, total_time: 0, avg_time: 0 },
    },
    last_performance: { accuracy: null, efficiency_score: null },
    escape_hatches: {
      sessions_at_current_difficulty: 0,
      last_difficulty_promotion: null,
      sessions_without_promotion: 0,
      activated_escape_hatches: [],
    },
    last_session_date: null,
  };

  // Migration: Convert camelCase fields to snake_case
  if (sessionState.numSessionsCompleted !== undefined) {
    sessionState.num_sessions_completed = sessionState.numSessionsCompleted;
    delete sessionState.numSessionsCompleted;
  }
  if (sessionState.currentDifficultyCap !== undefined) {
    sessionState.current_difficulty_cap = sessionState.currentDifficultyCap;
    delete sessionState.currentDifficultyCap;
  }
  if (sessionState.lastPerformance !== undefined) {
    sessionState.last_performance = sessionState.lastPerformance;
    delete sessionState.lastPerformance;
  }
  if (sessionState.escapeHatches !== undefined) {
    sessionState.escape_hatches = sessionState.escapeHatches;
    delete sessionState.escapeHatches;
  }
  if (sessionState.tagIndex !== undefined) {
    sessionState.tag_index = sessionState.tagIndex;
    delete sessionState.tagIndex;
  }
  if (sessionState.difficultyTimeStats !== undefined) {
    sessionState.difficulty_time_stats = sessionState.difficultyTimeStats;
    delete sessionState.difficultyTimeStats;
  }

  // One-time migration to correct num_sessions_completed from existing data
  if (sessionState.num_sessions_completed === 0 && !sessionState._migrated) {
    try {
      const db = await openDB();
      const transaction = db.transaction("sessions", "readonly");
      const store = transaction.objectStore("sessions");
      const request = store.getAll();

      const sessions = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const completedSessions = sessions.filter(s => s.status === "completed");
      if (completedSessions.length > 0) {
        sessionState.num_sessions_completed = completedSessions.length;
        sessionState._migrated = true;
        await StorageService.setSessionState(sessionStateKey, sessionState);
        logger.info(`Migrated session state: found ${completedSessions.length} completed sessions`);
      }
    } catch (error) {
      logger.error("Session state migration failed:", error);
    }
  }

  return sessionState;
}

export async function buildAdaptiveSessionSettings() {
  const sessionStateKey = "session_state";
  const now = new Date();

  const { focusDecision, focusTags, settings, userFocusAreas, sessionState } =
    await loadSessionContext(sessionStateKey);

  logSessionStateDebug(sessionState, focusDecision);

  const performanceMetrics = await calculatePerformanceMetrics(sessionState);

  const { sessionLength, numberOfNewProblems, allowedTags, updatedSessionState } =
    await determineSessionParameters({
      focusDecision, settings, sessionState, performanceMetrics, focusTags, now
    });

  await StorageService.setSessionState(sessionStateKey, updatedSessionState);

  logAdaptiveConfig({
    sessionLength, numberOfNewProblems, allowedTags, performanceMetrics,
    onboarding: focusDecision.onboarding, sessionState: updatedSessionState
  });

  const finalDifficultyCap = focusDecision.onboarding ? "Easy" : updatedSessionState.current_difficulty_cap;

  return {
    sessionLength,
    numberOfNewProblems,
    currentAllowedTags: allowedTags,
    currentDifficultyCap: finalDifficultyCap,
    userFocusAreas,
    sessionState: updatedSessionState,
    isOnboarding: focusDecision.onboarding,
  };
}

async function loadSessionContext(sessionStateKey) {
  const focusDecision = await FocusCoordinationService.getFocusDecision(sessionStateKey);
  const { focusTags } = await TagService.getCurrentTier();
  const settings = await StorageService.getSettings();
  const userFocusAreas = focusDecision.userPreferences;
  const sessionState = await initializeSessionState(sessionStateKey);

  return { focusDecision, focusTags, settings, userFocusAreas, sessionState };
}

function logSessionStateDebug(sessionState, focusDecision) {
  console.log(`Session state debug:`, {
    numSessionsCompleted: sessionState.num_sessions_completed,
    focusDecisionOnboarding: focusDecision.onboarding,
    sessionStateKeys: Object.keys(sessionState)
  });
}

async function calculatePerformanceMetrics(sessionState) {
  let accuracy = 0.5;
  let efficiencyScore = 0.5;
  let performanceTrend = 'stable';
  let consecutiveExcellentSessions = 0;

  try {
    const recentAnalytics = await getRecentSessionAnalytics(5);
    if (recentAnalytics && recentAnalytics.length > 0) {
      const lastSession = recentAnalytics[0];
      const currentDifficulty = (sessionState.current_difficulty_cap || "Easy").toLowerCase();

      accuracy = calculateAccuracyFromAnalytics(lastSession, currentDifficulty);
      efficiencyScore = lastSession.avg_time ? Math.max(0.3, Math.min(1.0, 1.0 - (lastSession.avg_time / 1800))) : 0.5;

      if (recentAnalytics.length >= 2) {
        const trendAnalysis = analyzePerformanceTrend(recentAnalytics);
        performanceTrend = trendAnalysis.trend;
        consecutiveExcellentSessions = trendAnalysis.consecutiveExcellent;
        logger.info(`Performance analysis: trend=${performanceTrend}, avgAccuracy=${(trendAnalysis.avgRecent * 100).toFixed(1)}%, consecutiveExcellent=${consecutiveExcellentSessions}`);
      }
    } else {
      logger.info("No recent session analytics found, using defaults");
    }
  } catch (error) {
    logger.warn("Failed to get recent session analytics, using defaults:", error);
  }

  return { accuracy, efficiencyScore, performanceTrend, consecutiveExcellentSessions };
}

function calculateAccuracyFromAnalytics(lastSession, currentDifficulty) {
  const difficultyBreakdown = lastSession.difficulty_breakdown;
  if (difficultyBreakdown && currentDifficulty) {
    const currentDifficultyData = difficultyBreakdown[currentDifficulty];
    if (currentDifficultyData && currentDifficultyData.attempts > 0) {
      const accuracy = currentDifficultyData.correct / currentDifficultyData.attempts;
      logger.info(`Using ${currentDifficulty}-specific accuracy for difficulty progression: ${(accuracy * 100).toFixed(1)}% (${currentDifficultyData.correct}/${currentDifficultyData.attempts})`);
      return accuracy;
    } else {
      logger.info(`No ${currentDifficulty} attempts found, using overall accuracy: ${((lastSession.accuracy ?? 0.5) * 100).toFixed(1)}%`);
      return lastSession.accuracy ?? 0.5;
    }
  } else {
    logger.info(`Using overall session accuracy: ${((lastSession.accuracy ?? 0.5) * 100).toFixed(1)}%`);
    return lastSession.accuracy ?? 0.5;
  }
}

async function determineSessionParameters(context) {
  const { focusDecision, settings, sessionState, performanceMetrics, focusTags, now } = context;

  const interviewInsights = await InterviewService.getInterviewInsightsForAdaptiveLearning();

  let allowedTags = focusDecision.activeFocusTags;
  if (!allowedTags || allowedTags.length === 0) {
    allowedTags = focusTags && focusTags.length > 0 ? focusTags.slice(0, 1) : ["array"];
    logger.warn(`FocusCoordinationService returned empty tags, using fallback: ${allowedTags}`);
  }

  const onboarding = focusDecision.onboarding;

  let sessionLength, numberOfNewProblems, tag_index;

  if (onboarding) {
    const limitedTags = allowedTags.slice(0, 1);
    logger.info(`Onboarding: Limited focus tags to: [${limitedTags.join(', ')}]`);

    const onboardingResult = applyOnboardingSettings(settings, sessionState, limitedTags, focusDecision);
    sessionLength = onboardingResult.sessionLength;
    numberOfNewProblems = onboardingResult.numberOfNewProblems;
    allowedTags = limitedTags;
  } else {
    const adaptiveResult = await applyPostOnboardingLogic({
      accuracy: performanceMetrics.accuracy,
      efficiencyScore: performanceMetrics.efficiencyScore,
      settings,
      interviewInsights,
      allowedTags,
      focusTags,
      sessionState,
      now,
      performanceTrend: performanceMetrics.performanceTrend,
      consecutiveExcellentSessions: performanceMetrics.consecutiveExcellentSessions
    });

    sessionLength = adaptiveResult.sessionLength;
    numberOfNewProblems = adaptiveResult.numberOfNewProblems;
    allowedTags = adaptiveResult.allowedTags;
    tag_index = adaptiveResult.tag_index;
  }

  const updatedSessionState = FocusCoordinationService.updateSessionState(sessionState, focusDecision);
  if (tag_index !== undefined) {
    updatedSessionState.tag_index = tag_index;
  }

  return { sessionLength, numberOfNewProblems, allowedTags, updatedSessionState };
}

function logAdaptiveConfig(config) {
  const { sessionLength, numberOfNewProblems, allowedTags, performanceMetrics, onboarding, sessionState } = config;
  logger.info("Adaptive Session Config:", {
    sessionLength,
    numberOfNewProblems,
    allowedTags,
    accuracy: performanceMetrics.accuracy,
    efficiencyScore: performanceMetrics.efficiencyScore,
    onboarding,
    performanceTrend: performanceMetrics.performanceTrend,
    consecutiveExcellentSessions: performanceMetrics.consecutiveExcellentSessions,
    sessionStateNumCompleted: sessionState.num_sessions_completed
  });
}

export async function getSessionPerformance({
  recentSessionsLimit = 5,
  daysBack = null,
  unmasteredTags = [],
} = {}) {
  console.log(`PERFORMANCE DEBUG: getSessionPerformance ENTRY`);
  console.log(`PERFORMANCE DEBUG: Parameters:`, {
    recentSessionsLimit,
    daysBack,
    unmasteredTagsCount: unmasteredTags.length,
    unmasteredTags: unmasteredTags.slice(0, 5)
  });

  logger.info("getSessionPerformance", unmasteredTags);
  const db = await openDB();
  const unmasteredTagSet = new Set(unmasteredTags);

  const sessionStore = db
    .transaction("sessions", "readonly")
    .objectStore("sessions");

  let sessions;
  if (daysBack) {
    const allSessions = await new Promise((resolve, reject) => {
      const req = sessionStore.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    sessions = filterSessions(allSessions, daysBack, null);
  } else {
    try {
      const index = sessionStore.index("by_session_type_status");
      const keyRange = IDBKeyRange.only(["standard", "completed"]);

      sessions = await new Promise((resolve, reject) => {
        const req = index.getAll(keyRange);
        req.onsuccess = () => {
          const results = req.result
            .sort((a, b) => new Date(b.date || b.created_date) - new Date(a.date || a.created_date))
            .slice(0, recentSessionsLimit);
          resolve(results);
        };
        req.onerror = () => reject(req.error);
      });

      console.log(`PERFORMANCE DEBUG: Retrieved ${sessions.length} recent completed standard sessions using combined index`);
    } catch (error) {
      console.error(`PERFORMANCE DEBUG: Failed to use combined index, falling back to full scan:`, error);
      const allSessions = await new Promise((resolve, reject) => {
        const req = sessionStore.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      sessions = filterSessions(allSessions, daysBack, recentSessionsLimit);
    }
  }

  const { performance, tagStats, totalAttempts, totalCorrect, totalTime } = await processAttempts(sessions);

  const { strongTags, weakTags } = calculateTagStrengths(tagStats, unmasteredTagSet);
  const timingFeedback = calculateTimingFeedback(performance);

  return {
    accuracy: totalAttempts ? totalCorrect / totalAttempts : 0,
    avgTime: totalAttempts ? totalTime / totalAttempts : 0,
    strongTags,
    weakTags,
    timingFeedback,
    easy: {
      ...performance.easy,
      avgTime: performance.easy.attempts
        ? performance.easy.time / performance.easy.attempts
        : 0,
    },
    medium: {
      ...performance.medium,
      avgTime: performance.medium.attempts
        ? performance.medium.time / performance.medium.attempts
        : 0,
    },
    hard: {
      ...performance.hard,
      avgTime: performance.hard.attempts
        ? performance.hard.time / performance.hard.attempts
        : 0,
    },
  };
}

export async function getAllSessions() {
  const db = await openDB();
  const sessionStore = db
    .transaction("sessions", "readonly")
    .objectStore("sessions");
  const sessionRequest = sessionStore.getAll();
  const sessions = await new Promise((resolve, reject) => {
    sessionRequest.onsuccess = () => resolve(sessionRequest.result);
    sessionRequest.onerror = () => reject(sessionRequest.error);
  });
  return sessions;
}

/**
 * Evaluates and updates difficulty progression after session completion
 */
export async function evaluateDifficultyProgression(accuracy, settings) {
  try {
    if (accuracy === null || accuracy === undefined || isNaN(accuracy)) {
      logger.warn(`Invalid accuracy value: ${accuracy}, defaulting to 0`);
      accuracy = 0;
    }

    if (!settings) {
      logger.warn(`Missing settings object, using default`);
      settings = {};
    }

    logger.info(`Evaluating difficulty progression with accuracy: ${(accuracy * 100).toFixed(1)}%`);

    let sessionState;
    try {
      sessionState = await StorageService.getSessionState();
      if (!sessionState) {
        logger.info(`No existing session state, creating default`);
        sessionState = {
          id: "session_state",
          num_sessions_completed: 0,
          current_difficulty_cap: "Easy",
          escape_hatches: {
            sessions_at_current_difficulty: 0,
            last_difficulty_promotion: null,
            sessions_without_promotion: 0,
            activated_escape_hatches: [],
          }
        };
      }
    } catch (stateError) {
      logger.error("Failed to get session state:", stateError);
      throw new Error(`Session state retrieval failed: ${stateError.message}`);
    }

    const previousDifficulty = sessionState.current_difficulty_cap;
    const now = new Date();

    sessionState = await checkForDemotion(sessionState);

    let updatedSessionState;
    try {
      updatedSessionState = applyEscapeHatchLogic(sessionState, accuracy, settings, now);
      if (!updatedSessionState) {
        throw new Error("applyEscapeHatchLogic returned null/undefined");
      }
    } catch (logicError) {
      logger.error("Failed to apply escape hatch logic:", logicError);
      throw new Error(`Difficulty progression logic failed: ${logicError.message}`);
    }

    try {
      await StorageService.setSessionState("session_state", updatedSessionState);

      if (updatedSessionState.current_difficulty_cap !== previousDifficulty) {
        logger.info(`Difficulty progression: ${previousDifficulty} → ${updatedSessionState.current_difficulty_cap}`);
      } else {
        logger.info(`Difficulty maintained at ${updatedSessionState.current_difficulty_cap}, tracking updated`);
      }
    } catch (saveError) {
      logger.error("Failed to save session state:", saveError);
      throw new Error(`Session state save failed: ${saveError.message}`);
    }

    return updatedSessionState;
  } catch (error) {
    logger.error("Failed to evaluate difficulty progression:", error);
    throw error;
  }
}
