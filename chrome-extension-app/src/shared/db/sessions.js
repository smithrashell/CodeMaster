import { dbHelper } from "./index.js";
import { TagService } from "../services/tagServices.js";
import { StorageService } from "../services/storageService.js";
import { getMostRecentAttempt, getAttemptsBySessionId } from "./attempts.js";
import FocusCoordinationService from "../services/focusCoordinationService.js";
import SessionLimits from "../utils/sessionLimits.js";
import { InterviewService } from "../services/interviewService.js";
import { getRecentSessionAnalytics } from "./sessionAnalytics.js";
import logger from "../utils/logger.js";

const openDB = () => dbHelper.openDB();

/**
 * Retrieves a session by its ID.
 */
export const getSessionById = async (session_id) => {
  // Validate session_id before database operation
  if (!session_id) {
    console.error(`❌ getSessionById called with invalid session_id:`, session_id);
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
    
    // Use reliable getAll method to avoid index issues
    const request = store.getAll();
    request.onsuccess = (event) => {
      const allSessions = event.target.result || [];
      
      if (allSessions.length === 0) {
        resolve(null);
        return;
      }
      
      // Sort by date (newest first) - handle snake_case created_date first, then fallback to date/Date
      const sortedSessions = allSessions.sort((a, b) => {
        const dateA = new Date(a.date || a.created_date || a.Date || 0);
        const dateB = new Date(b.date || b.created_date || b.Date || 0);
        return dateB - dateA;
      });
      const result = sortedSessions[0];
      resolve(result);
    };
    request.onerror = (e) => {
      logger.error("❌ getLatestSession() error:", e.target.error);
      reject(e.target.error);
    };
  });
};

/**
 * Efficiently fetches the latest session by type and/or status using database indexes.
 * This is much more efficient than getLatestSession() as it uses cursors instead of loading all data.
 * 
 * @param {string|null} session_type - Filter by session type ('standard', 'interview-like', 'full-interview', etc.)
 * @param {string|null} status - Filter by status ('in_progress', 'completed', etc.)
 * @returns {Promise<Object|null>} Latest matching session or null if none found
 */
export const getLatestSessionByType = async (session_type = null, status = null) => {
  logger.info(`🔍 getLatestSessionByType ENTRY: session_type=${session_type}, status=${status}`);
  
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("sessions", "readonly");
    const store = transaction.objectStore("sessions");

    // Normalize session_type - treat null/undefined as 'standard'
    const normalizedSessionType = session_type || 'standard';

    // Debug: Log available indexes
    console.log(`🔍 INDEX DEBUG: Available indexes:`, {
      available: Array.from(store.indexNames),
      requestedType: normalizedSessionType,
      requestedStatus: status,
      targetIndex: status ? "by_session_type_status" : "by_session_type"
    });

    // Use appropriate index based on whether status is specified
    let index, keyRange;
    try {
      if (status) {
        // Use composite index for session_type + status queries
        index = store.index("by_session_type_status");
        keyRange = IDBKeyRange.only([normalizedSessionType, status]);
        console.log(`🔍 INDEX DEBUG: Using composite index with key:`, [normalizedSessionType, status]);
      } else {
        // Use session_type index for type-only queries
        index = store.index("by_session_type");
        keyRange = IDBKeyRange.only(normalizedSessionType);
        console.log(`🔍 INDEX DEBUG: Using session_type index with key:`, normalizedSessionType);
      }
    } catch (error) {
      console.error(`❌ INDEX ACCESS ERROR: Failed to access index, falling back to full scan:`, {
        indexName: status ? "by_session_type_status" : "by_session_type",
        error: error.message,
        availableIndexes: Array.from(store.indexNames)
      });
      logger.error(`❌ getLatestSessionByType() index error, using fallback:`, error);

      // Fallback to full table scan
      const fallbackRequest = store.getAll();
      fallbackRequest.onsuccess = () => {
        const allSessions = fallbackRequest.result || [];

        // Filter and sort manually
        const filteredSessions = allSessions
          .filter(session => {
            const matchesType = !normalizedSessionType || session.session_type === normalizedSessionType;
            const matchesStatus = !status || session.status === status;
            return matchesType && matchesStatus;
          })
          .sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date desc

        const latestSession = filteredSessions[0] || null;
        if (latestSession) {
          logger.info(`✅ Found matching ${normalizedSessionType} session via fallback: ${latestSession.id?.substring(0,8)}... status=${latestSession.status}`);
        } else {
          logger.info(`❌ No ${normalizedSessionType}/${status} sessions found via fallback`);
        }
        resolve(latestSession);
      };

      fallbackRequest.onerror = () => {
        logger.error(`❌ Fallback query also failed:`, fallbackRequest.error);
        reject(fallbackRequest.error);
      };

      return;
    }
    
    // Open cursor in reverse order (latest first) for efficiency
    const request = index.openCursor(keyRange, "prev");
    
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        const session = cursor.value;
        
        logger.info(`✅ Found matching ${normalizedSessionType} session: ${session.id?.substring(0,8)}... status=${session.status}`);
        resolve(session);
        return;
      } else {
        logger.info(`❌ No matching ${normalizedSessionType} session found with status=${status || 'any'}`);
        resolve(null);
      }
    };
    
    request.onerror = (e) => {
      logger.error("❌ getLatestSessionByType() error:", e.target.error);
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
 * Atomically gets latest session or creates new one if none exists.
 * Prevents race conditions by doing both operations in single transaction.
 * @param {string} sessionType - Type of session to get or create
 * @param {string} status - Status to check for ('in_progress')
 * @param {Object} newSessionData - Data for new session if creation needed
 * @returns {Promise<Object>} - Existing or newly created session
 */
export const getOrCreateSessionAtomic = async (sessionType = 'standard', status = 'in_progress', newSessionData = null) => {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction("sessions", "readwrite");
    const store = transaction.objectStore("sessions");

    // Check for existing session within this transaction
    let index;
    try {
      index = store.index("by_session_type_status");
    } catch (error) {
      console.error(`❌ INDEX ACCESS ERROR: by_session_type_status index not found`, {
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
        logger.info("🔍 Atomic check: Found existing session", existingSession.id);
        resolve(existingSession);
      } else if (newSessionData) {
        // Create new session within same transaction
        logger.info("🔍 Atomic check: No existing session, creating new one");
        const addRequest = store.add(newSessionData);
        addRequest.onsuccess = () => {
          logger.info("✅ Atomic creation: New session created", newSessionData.id);
          resolve(newSessionData);
        };
        addRequest.onerror = () => {
          logger.error("❌ Atomic creation failed:", addRequest.error);
          reject(addRequest.error);
        };
      } else {
        // No existing session and no data to create new one
        logger.info("🔍 Atomic check: No existing session, no creation data provided");
        resolve(null);
      }
    };

    existingCheck.onerror = () => {
      logger.error("❌ Atomic check failed:", existingCheck.error);
      reject(existingCheck.error);
    };
  });
};

/**
 * Saves session to Chrome Storage with fallback handling (optional: updates IndexedDB if needed).
 * Implements graceful degradation when Chrome APIs are unavailable.
 */
export const saveSessionToStorage = (session, updateDatabase = false) => {
  return new Promise((resolve, reject) => {
    try {
      // Check if Chrome API is available
      if (typeof chrome !== "undefined" && chrome?.storage?.local?.set) {
        chrome.storage.local.set({ currentSession: session }, async () => {
          if (chrome.runtime?.lastError) {
            logger.warn("Chrome storage error:", chrome.runtime.lastError);
            // Continue with IndexedDB update even if Chrome storage fails
          }

          if (updateDatabase) {
            try {
              await updateSessionInDB(session);
            } catch (error) {
              logger.warn(
                "IndexedDB update failed after Chrome storage save:",
                error
              );
              // Don't reject - Chrome storage succeeded
            }
          }
          resolve();
        });
      } else {
        // Chrome API unavailable - log warning and continue
        logger.warn(
          "Chrome storage API unavailable, skipping session storage to Chrome"
        );

        // Still update IndexedDB if requested
        if (updateDatabase) {
          updateSessionInDB(session)
            .then(() => {
              logger.info(
                "Session saved to IndexedDB (Chrome storage unavailable)"
              );
              resolve();
            })
            .catch((error) => {
              logger.error(
                "Both Chrome storage and IndexedDB unavailable:",
                error
              );
              reject(new Error("No storage mechanism available"));
            });
          return;
        }

        // Resolve even without Chrome storage - system can continue
        resolve();
      }
    } catch (error) {
      logger.error("Error in saveSessionToStorage:", error);

      // Try IndexedDB as fallback
      if (updateDatabase) {
        updateSessionInDB(session)
          .then(() => {
            logger.info("Fallback to IndexedDB successful");
            resolve();
          })
          .catch((dbError) => {
            logger.error("All storage mechanisms failed:", {
              chromeError: error,
              dbError,
            });
            reject(new Error("All storage mechanisms unavailable"));
          });
      } else {
        // No fallback requested, but don't fail the entire operation
        logger.warn("Chrome storage failed, but continuing without storage");
        resolve();
      }
    }
  });
};

// ❌ REMOVED: Legacy session reconstruction function
// This function was causing false "completed" sessions to appear in the UI
// by reconstructing sessions from raw attempt data. Modern sessions are now
// properly created through SessionService.createNewSession() with correct
// status tracking and completion flow.
//
// export const recreateSessions = async () => { ... }
//
// If you need to migrate old data, run this function once manually,
// then remove it to prevent ongoing interference with modern session tracking.

/**
 * Initialize session state with default values
 */
async function initializeSessionState(sessionStateKey) {
  console.log(`🔍 SESSION STATE DEBUG: initializeSessionState ENTRY with key: ${sessionStateKey}`);
  
  const migratedState = await StorageService.migrateSessionStateToIndexedDB();
  const storedState = await StorageService.getSessionState(sessionStateKey);
  
  console.log(`🔍 SESSION STATE DEBUG: State loading results:`, {
    hasMigratedState: !!migratedState,
    hasStoredState: !!storedState,
    migratedSessionsCompleted: migratedState?.num_sessions_completed,
    storedSessionsCompleted: storedState?.num_sessions_completed
  });

  let sessionState = migratedState || storedState || {
      id: sessionStateKey,
      num_sessions_completed: 0,
      current_difficulty_cap: "Easy", // Onboarding users start with easy-only problems
      tag_index: 0,
      difficulty_time_stats: {
        easy: { problems: 0, total_time: 0, avg_time: 0 },
        medium: { problems: 0, total_time: 0, avg_time: 0 },
        hard: { problems: 0, total_time: 0, avg_time: 0 },
      },
      last_performance: {
        accuracy: null,
        efficiency_score: null,
      },
      // 🔓 Escape hatch tracking
      escape_hatches: {
        sessions_at_current_difficulty: 0,
        last_difficulty_promotion: null,
        sessions_without_promotion: 0,
        activated_escape_hatches: [],
      },
      last_session_date: null,
    };

  console.log(`🔍 SESSION STATE DEBUG: Initial session state:`, {
    id: sessionState.id,
    num_sessions_completed: sessionState.num_sessions_completed,
    current_difficulty_cap: sessionState.current_difficulty_cap,
    hasLegacyFields: !!(sessionState.numSessionsCompleted || sessionState.currentDifficultyCap)
  });

  // 🔄 MIGRATION: Convert camelCase fields to snake_case (backwards compatibility)
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

  // ✅ CRITICAL FIX: One-time migration to correct num_sessions_completed from existing data
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
        sessionState._migrated = true; // Prevent future migrations
        await StorageService.setSessionState(sessionStateKey, sessionState);
        logger.info(`🔄 Migrated session state: found ${completedSessions.length} completed sessions`);
      }
    } catch (error) {
      logger.error("❌ Session state migration failed:", error);
    }
  }

  return sessionState;
}

/**
 * Apply onboarding mode settings with safety constraints
 */
function applyOnboardingSettings(settings, sessionState, allowedTags, focusDecision) {
  logger.info("🔰 Onboarding mode: Enforcing fixed session parameters for optimal learning");
  
  // ONBOARDING FIX: Force 4 problems for first few sessions regardless of user preference
  let sessionLength = 4;
  let numberOfNewProblems = 4;
  
  const userSessionLength = settings.sessionLength;
  logger.info(`🔰 Session length calculation debug:`, {
    onboardingSessionLength: 4,
    userSessionLength: userSessionLength,
    action: "enforcing_onboarding_length"
  });
  
  // During onboarding, we ENFORCE 4 problems regardless of user preference for optimal learning progression
  logger.info(`🔰 Onboarding session length enforced: 4 problems (user preference ${userSessionLength} will be respected after onboarding)`);
  
  // Apply user new problems cap with dynamic onboarding limit  
  const userMaxNewProblems = settings.numberofNewProblemsPerSession;
  const maxNewProblems = SessionLimits.getMaxNewProblems(sessionState);
  if (userMaxNewProblems && userMaxNewProblems > 0) {
    numberOfNewProblems = Math.min(userMaxNewProblems, maxNewProblems);
    logger.info(`🔰 User new problems preference applied: ${userMaxNewProblems} → capped at ${numberOfNewProblems} for onboarding`);
  }
  
  // Focus tags already handled by coordination service
  logger.info(`🔰 Focus tags from coordination service: [${allowedTags.join(', ')}] (${focusDecision.reasoning})`);
  
  return { sessionLength, numberOfNewProblems };
}

/**
 * Apply post-onboarding adaptive logic with performance-based adjustments
 */
async function applyPostOnboardingLogic({
  accuracy, efficiencyScore, settings, interviewInsights,
  allowedTags, focusTags, _sessionState, now, performanceTrend, consecutiveExcellentSessions
}) {
  // Time gap since last session (only calculate if we have real attempt data)
  let gapInDays = null; // null means no gap data available
  const lastAttempt = await getMostRecentAttempt();
  if (lastAttempt?.attempt_date) {
    const lastTime = new Date(lastAttempt.attempt_date);
    gapInDays = (now - lastTime) / (1000 * 60 * 60 * 24);
  }

  // Calculate adaptive session length with trend analysis
  const adaptiveSessionLength = computeSessionLength(accuracy, efficiencyScore, settings.sessionLength || 4, performanceTrend, consecutiveExcellentSessions);
  
  // Apply user preference blending (70% adaptive, 30% user preference)
  const userPreferredLength = settings.sessionLength;
  let sessionLength = applySessionLengthPreference(adaptiveSessionLength, userPreferredLength);

  // Apply interview insights to session parameters
  sessionLength = applyInterviewInsightsToSessionLength(
    sessionLength, interviewInsights
  );

  // Apply performance-based constraints (only when we have real attempt data)
  if ((gapInDays !== null && gapInDays > 4) || accuracy < 0.5) {
    const originalLength = sessionLength;
    sessionLength = Math.min(sessionLength, 5);
    const gapText = gapInDays !== null ? `${gapInDays.toFixed(1)} days` : 'no gap data';
    logger.info(`🛡️ Performance constraint applied: Session length capped from ${originalLength} to ${sessionLength} due to gap (${gapText}) or low accuracy (${(accuracy * 100).toFixed(1)}%)`);
  }

  // Calculate new problems based on performance and settings
  let numberOfNewProblems = calculateNewProblems(
    accuracy, sessionLength, settings, interviewInsights
  );

  // Apply interview insights to focus tag selection
  const tagResult = applyInterviewInsightsToTags(
    allowedTags, focusTags, interviewInsights, accuracy
  );
  
  return {
    sessionLength,
    numberOfNewProblems, 
    allowedTags: tagResult.allowedTags,
    tag_index: tagResult.tag_index
  };
}

/**
 * Apply interview insights to session length
 */
function applyInterviewInsightsToSessionLength(sessionLength, interviewInsights) {
  if (interviewInsights.hasInterviewData) {
    const recs = interviewInsights.recommendations;
    
    // Adjust session length based on interview transfer performance
    if (recs.sessionLengthAdjustment !== 0) {
      const originalLength = sessionLength;
      sessionLength = Math.max(3, Math.min(8, sessionLength + recs.sessionLengthAdjustment));
      logger.info(`🎯 Interview insight: Session length adjusted from ${originalLength} to ${sessionLength} (transfer accuracy: ${(interviewInsights.transferAccuracy * 100).toFixed(1)}%)`);
    }
    
    // Handle difficulty adjustment by modifying escape hatch thresholds
    if (recs.difficultyAdjustment !== 0) {
      if (recs.difficultyAdjustment < 0) {
        // Poor interview transfer - be more conservative with difficulty
        logger.info(`🎯 Interview insight: Conservative difficulty due to poor transfer (${(interviewInsights.transferAccuracy * 100).toFixed(1)}% accuracy)`);
      } else if (recs.difficultyAdjustment > 0) {
        // Excellent interview transfer - can be more aggressive
        logger.info(`🎯 Interview insight: Aggressive difficulty due to strong transfer (${(interviewInsights.transferAccuracy * 100).toFixed(1)}% accuracy)`);
      }
    }
  }
  return sessionLength;
}

/**
 * Calculate new problems based on performance and apply guardrails
 */
function calculateNewProblems(accuracy, sessionLength, settings, interviewInsights) {
  let numberOfNewProblems;
  
  // Scale new problems based on performance
  if (accuracy >= 0.85) {
    numberOfNewProblems = Math.min(5, Math.floor(sessionLength / 2));
  } else if (accuracy < 0.6) {
    numberOfNewProblems = 1;
  } else {
    numberOfNewProblems = Math.floor(sessionLength * 0.3);
  }

  // Apply user-defined cap for new problems (from Goals page guardrails)
  const userMaxNewProblems = settings.numberofNewProblemsPerSession;
  if (userMaxNewProblems && userMaxNewProblems > 0) {
    const originalNewProblems = numberOfNewProblems;
    numberOfNewProblems = Math.min(numberOfNewProblems, userMaxNewProblems);
    if (originalNewProblems !== numberOfNewProblems) {
      logger.info(`🛡️ User guardrail applied: New problems capped from ${originalNewProblems} to ${numberOfNewProblems}`);
    }
  }

  // Apply interview insights to new problems count
  if (interviewInsights.hasInterviewData && interviewInsights.recommendations.newProblemsAdjustment !== 0) {
    const originalNewProblems = numberOfNewProblems;
    numberOfNewProblems = Math.max(0, numberOfNewProblems + interviewInsights.recommendations.newProblemsAdjustment);
    logger.info(`🎯 Interview insight: New problems adjusted from ${originalNewProblems} to ${numberOfNewProblems} (transfer performance: ${(interviewInsights.transferAccuracy * 100).toFixed(1)}%)`);
  }
  
  return numberOfNewProblems;
}

/**
 * Apply interview insights to focus tag selection
 */
function applyInterviewInsightsToTags(allowedTags, focusTags, interviewInsights, accuracy) {
  // Focus tags already determined by coordination service
  // (Coordination service integrates performance-based expansion with user preferences)
  let tagCount = allowedTags.length;
  
  // Apply interview insights to focus tag selection
  if (interviewInsights.hasInterviewData) {
    const recs = interviewInsights.recommendations;
    const focusWeight = recs.focusTagsWeight;
    
    if (focusWeight < 1.0) {
      // Poor interview transfer - focus more narrowly on weak tags
      const weakTags = recs.weakTags || [];
      if (weakTags.length > 0) {
        const weakTagsInFocus = allowedTags.filter(tag => weakTags.includes(tag));
        if (weakTagsInFocus.length > 0) {
          const originalTags = [...allowedTags];
          allowedTags = weakTagsInFocus.slice(0, Math.max(2, Math.ceil(tagCount * focusWeight)));
          logger.info(`🎯 Interview insight: Focusing on weak tags [${allowedTags.join(', ')}] (was [${originalTags.join(', ')}]) due to poor transfer`);
        }
      }
    } else if (focusWeight > 1.0) {
      // Good interview transfer - can explore more tags
      const additionalTags = focusTags.filter(tag => !allowedTags.includes(tag));
      const tagsToAdd = Math.floor((focusWeight - 1.0) * tagCount);
      if (additionalTags.length > 0 && tagsToAdd > 0) {
        const originalTags = [...allowedTags];
        allowedTags = [...allowedTags, ...additionalTags.slice(0, tagsToAdd)];
        logger.info(`🎯 Interview insight: Expanding tags [${allowedTags.join(', ')}] (was [${originalTags.join(', ')}]) due to strong transfer`);
      }
    }
    
    tagCount = allowedTags.length; // Update count after interview adjustments
  }
  
  // Update tagIndex for backward compatibility with existing systems
  const tagIndex = tagCount - 1; // Convert from count to index

  logger.info(
    `🏷️ Tag exposure from coordination service: ${tagCount}/${focusTags.length} focus tags (coordinated: [${allowedTags.join(', ')}], accuracy: ${(accuracy * 100).toFixed(1)}%)`
  );
  
  return { allowedTags, tag_index: tagIndex };
}

/**
 * Apply escape hatch logic for difficulty progression
 */
export function applyEscapeHatchLogic(sessionState, accuracy, settings, now) {
  const currentDifficulty = initializeDifficultyState(sessionState);
  const { problemsAtDifficulty } = getDifficultyStats(sessionState, currentDifficulty);

  logEscapeHatchEntry(currentDifficulty, problemsAtDifficulty, accuracy, sessionState);

  const escapeHatches = initializeEscapeHatches(sessionState);
  const { promotionReason, shouldPromote } = evaluatePromotion(problemsAtDifficulty, accuracy, escapeHatches);

  const promotionContext = {
    sessionState, currentDifficulty, shouldPromote, promotionReason,
    problemsAtDifficulty, accuracy, settings, now, escapeHatches
  };
  const promoted = applyDifficultyPromotion(promotionContext);

  updatePromotionTracking(sessionState, escapeHatches, currentDifficulty, shouldPromote, problemsAtDifficulty);
  logEscapeHatchExit(currentDifficulty, sessionState, promoted, promotionReason);

  return sessionState;
}

function initializeDifficultyState(sessionState) {
  const currentDifficulty = sessionState.current_difficulty_cap || "Easy";

  if (!sessionState.difficulty_time_stats) {
    sessionState.difficulty_time_stats = {
      easy: { problems: 0, total_time: 0, avg_time: 0 },
      medium: { problems: 0, total_time: 0, avg_time: 0 },
      hard: { problems: 0, total_time: 0, avg_time: 0 }
    };
  }

  if (!sessionState.current_difficulty_cap) {
    sessionState.current_difficulty_cap = "Easy";
  }

  return currentDifficulty;
}

function getDifficultyStats(sessionState, currentDifficulty) {
  const currentDifficultyKey = currentDifficulty.toLowerCase();
  const stats = sessionState.difficulty_time_stats[currentDifficultyKey];
  const problemsAtDifficulty = stats?.problems || 0;
  return { stats, problemsAtDifficulty };
}

function logEscapeHatchEntry(currentDifficulty, problemsAtDifficulty, accuracy, sessionState) {
  console.log('🔍 applyEscapeHatchLogic ENTRY (problem-based):', {
    currentDifficulty,
    problemsAtDifficulty,
    accuracy: (accuracy * 100).toFixed(1) + '%',
    numSessionsCompleted: sessionState.num_sessions_completed
  });
}

function initializeEscapeHatches(sessionState) {
  if (!sessionState.escape_hatches) {
    sessionState.escape_hatches = {
      sessions_at_current_difficulty: 0,
      last_difficulty_promotion: null,
      sessions_without_promotion: 0,
      activated_escape_hatches: [],
    };
  }

  const escapeHatches = sessionState.escape_hatches;
  escapeHatches.sessions_at_current_difficulty++;
  return escapeHatches;
}

function evaluatePromotion(problemsAtDifficulty, accuracy, escapeHatches) {
  const standardPromotion = problemsAtDifficulty >= 4 && accuracy >= 0.8;
  const stagnationEscape = problemsAtDifficulty >= 8;
  let promotionReason = null;

  if (standardPromotion) {
    promotionReason = "standard_volume_gate";
    logger.info(`✅ Standard promotion criteria met: ${problemsAtDifficulty} problems at ${(accuracy * 100).toFixed(1)}% accuracy`);
  } else if (stagnationEscape) {
    promotionReason = "stagnation_escape_hatch";
    logger.info(`🔓 Stagnation escape hatch ACTIVATED: ${problemsAtDifficulty} problems completed (accuracy: ${(accuracy * 100).toFixed(1)}%)`);

    if (!escapeHatches.activated_escape_hatches.includes("problem-based-stagnation")) {
      escapeHatches.activated_escape_hatches.push("problem-based-stagnation");
    }
  }

  const shouldPromote = standardPromotion || stagnationEscape;
  return { promotionReason, shouldPromote };
}

function applyDifficultyPromotion(context) {
  const { sessionState, currentDifficulty, shouldPromote, promotionReason,
    problemsAtDifficulty, accuracy, now, escapeHatches } = context;

  const promotionData = {
    sessionState, escapeHatches, now, promotionReason, problemsAtDifficulty, accuracy
  };

  if (shouldPromote && currentDifficulty === "Easy") {
    promoteDifficulty(promotionData, "Medium");
    return true;
  } else if (shouldPromote && currentDifficulty === "Medium") {
    promoteDifficulty(promotionData, "Hard");
    return true;
  }

  return false;
}

function promoteDifficulty(context, newDifficulty) {
  const { sessionState, escapeHatches, now, promotionReason, problemsAtDifficulty, accuracy } = context;
  const oldDifficulty = sessionState.current_difficulty_cap;

  sessionState.current_difficulty_cap = newDifficulty;
  escapeHatches.last_difficulty_promotion = now.toISOString();
  escapeHatches.sessions_at_current_difficulty = 0;
  escapeHatches.activated_escape_hatches = [];

  if (promotionReason === "stagnation_escape_hatch") {
    logger.info(`🎯 Difficulty cap upgraded via STAGNATION ESCAPE: ${oldDifficulty} → ${newDifficulty} (${problemsAtDifficulty} problems)`);
  } else {
    logger.info(`🎯 Difficulty cap upgraded: ${oldDifficulty} → ${newDifficulty} (${problemsAtDifficulty} problems at ${(accuracy * 100).toFixed(1)}%)`);
  }
}

function updatePromotionTracking(sessionState, escapeHatches, currentDifficulty, shouldPromote, problemsAtDifficulty) {
  if (!shouldPromote && problemsAtDifficulty > 0) {
    const remaining = Math.max(0, 4 - problemsAtDifficulty);
    logger.info(`📊 Progress toward promotion: ${problemsAtDifficulty}/4 problems at ${currentDifficulty} (${remaining} more needed)`);
  }

  if (sessionState.current_difficulty_cap === currentDifficulty) {
    escapeHatches.sessions_without_promotion++;
  } else {
    escapeHatches.sessions_without_promotion = 0;
  }
}

function logEscapeHatchExit(currentDifficulty, sessionState, promoted, promotionReason) {
  console.log('🔍 applyEscapeHatchLogic EXIT:', {
    previousDifficulty: currentDifficulty,
    newDifficulty: sessionState.current_difficulty_cap,
    promoted,
    promotionReason
  });
}

/**
 * Checks recent sessions for demotion based on sustained poor performance
 * @param {Object} sessionState - Current session state
 * @returns {Promise<Object>} Updated session state (may be demoted)
 */
async function checkForDemotion(sessionState) {
  const currentCap = sessionState.current_difficulty_cap || "Easy";

  // Can't demote from Easy
  if (currentCap === "Easy") {
    return sessionState;
  }

  try {
    // Use existing getRecentSessionAnalytics (already imported line 8)
    const recentSessions = await getRecentSessionAnalytics(3);

    if (recentSessions.length < 3) {
      logger.info(`🔍 Demotion check: Not enough history (${recentSessions.length}/3)`);
      return sessionState;
    }

    // Count low-accuracy sessions
    const lowAccuracyCount = recentSessions.filter(s => (s.accuracy || 0) < 0.5).length;

    if (lowAccuracyCount >= 3) {
      const targetDifficulty = currentCap === "Hard" ? "Medium" : "Easy";
      const oldDifficulty = currentCap;

      sessionState.current_difficulty_cap = targetDifficulty;

      // Reset escape hatches
      if (sessionState.escape_hatches) {
        sessionState.escape_hatches.sessions_at_current_difficulty = 0;
      }

      logger.info(`🔽 Difficulty Demotion: ${oldDifficulty} → ${targetDifficulty}`);
      logger.info(`   Recent accuracies: ${recentSessions.map(s => `${((s.accuracy || 0) * 100).toFixed(0)}%`).join(', ')}`);
    } else {
      logger.info(`✓ Demotion check passed: ${lowAccuracyCount}/3 low-accuracy sessions`);
    }

    return sessionState;
  } catch (error) {
    logger.error("❌ Error in demotion check:", error);
    return sessionState; // Don't fail progression
  }
}

// Helper to analyze performance trend from recent sessions
function analyzePerformanceTrend(recentAnalytics) {
  const accuracies = recentAnalytics.map(session => session.accuracy || 0.5);
  const avgRecent = accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length;

  // Count consecutive excellent sessions (90%+ accuracy)
  let consecutiveExcellent = 0;
  for (const session of recentAnalytics) {
    if ((session.accuracy || 0) >= 0.9) {
      consecutiveExcellent++;
    } else {
      break;
    }
  }

  // Determine performance trend
  let trend;
  if (avgRecent >= 0.85 && consecutiveExcellent >= 2) {
    trend = 'sustained_excellence';
  } else if (avgRecent >= 0.7 && accuracies[0] > accuracies[Math.min(2, accuracies.length - 1)]) {
    trend = 'improving';
  } else if (avgRecent < 0.5) {
    trend = 'struggling';
  } else {
    trend = 'stable';
  }

  return { trend, consecutiveExcellent, avgRecent };
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
  logDifficultyCapDebug(focusDecision.onboarding, updatedSessionState, finalDifficultyCap);

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
  console.log(`🔍 Session state debug:`, {
    numSessionsCompleted: sessionState.num_sessions_completed,
    focusDecisionOnboarding: focusDecision.onboarding,
    sessionStateKeys: Object.keys(sessionState),
    sessionState: sessionState
  });
  logger.info(`🔍 Session state debug:`, {
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
        logger.info(`📈 Performance analysis: trend=${performanceTrend}, avgAccuracy=${(trendAnalysis.avgRecent * 100).toFixed(1)}%, consecutiveExcellent=${consecutiveExcellentSessions}`);
      }
    } else {
      logger.info("🔍 No recent session analytics found, using defaults");
    }
  } catch (error) {
    logger.warn("⚠️ Failed to get recent session analytics, using defaults:", error);
  }

  return { accuracy, efficiencyScore, performanceTrend, consecutiveExcellentSessions };
}

function calculateAccuracyFromAnalytics(lastSession, currentDifficulty) {
  const difficultyBreakdown = lastSession.difficulty_breakdown;
  if (difficultyBreakdown && currentDifficulty) {
    const currentDifficultyData = difficultyBreakdown[currentDifficulty];
    if (currentDifficultyData && currentDifficultyData.attempts > 0) {
      const accuracy = currentDifficultyData.correct / currentDifficultyData.attempts;
      logger.info(`🎯 Using ${currentDifficulty}-specific accuracy for difficulty progression: ${(accuracy * 100).toFixed(1)}% (${currentDifficultyData.correct}/${currentDifficultyData.attempts})`);
      return accuracy;
    } else {
      logger.info(`🔍 No ${currentDifficulty} attempts found, using overall accuracy: ${((lastSession.accuracy ?? 0.5) * 100).toFixed(1)}%`);
      return lastSession.accuracy ?? 0.5;
    }
  } else {
    logger.info(`🔍 Using overall session accuracy: ${((lastSession.accuracy ?? 0.5) * 100).toFixed(1)}%`);
    return lastSession.accuracy ?? 0.5;
  }
}

async function determineSessionParameters(context) {
  const { focusDecision, settings, sessionState, performanceMetrics, focusTags, now } = context;

  const interviewInsights = await InterviewService.getInterviewInsightsForAdaptiveLearning();
  logInterviewInsights(interviewInsights);

  let allowedTags = validateAndGetAllowedTags(focusDecision, focusTags);
  logFocusDecision(focusDecision, allowedTags, sessionState);

  const sessionLogicContext = {
    focusDecision, settings, sessionState, performanceMetrics,
    interviewInsights, allowedTags, focusTags, now
  };
  const { sessionLength, numberOfNewProblems, finalAllowedTags, tag_index } =
    await applySessionLogic(sessionLogicContext);

  const updatedSessionState = FocusCoordinationService.updateSessionState(sessionState, focusDecision);
  if (tag_index !== undefined) {
    updatedSessionState.tag_index = tag_index;
  }

  return {
    sessionLength,
    numberOfNewProblems,
    allowedTags: finalAllowedTags,
    updatedSessionState
  };
}

function logInterviewInsights(interviewInsights) {
  logger.info(`🎯 Interview insights for adaptive learning:`, {
    hasData: interviewInsights.hasInterviewData,
    transferAccuracy: interviewInsights.transferAccuracy,
    speedDelta: interviewInsights.speedDelta,
    recommendations: interviewInsights.recommendations
  });
}

function validateAndGetAllowedTags(focusDecision, focusTags) {
  let allowedTags = focusDecision.activeFocusTags;

  if (!allowedTags || allowedTags.length === 0) {
    allowedTags = focusTags && focusTags.length > 0 ? focusTags.slice(0, 1) : ["array"];
    logger.warn(`⚠️ FocusCoordinationService returned empty tags, using fallback: ${allowedTags}`);
  }

  return allowedTags;
}

function logFocusDecision(focusDecision, allowedTags, sessionState) {
  console.log(`🔍 ONBOARDING DECISION: Using FocusCoordinationService as single source of truth:`, {
    onboarding: focusDecision.onboarding,
    numSessionsCompleted: sessionState.num_sessions_completed,
    performanceLevel: focusDecision.performanceLevel,
    currentDifficultyCap: sessionState.current_difficulty_cap
  });

  logger.info(`🎯 Focus Coordination Service decision:`, {
    activeFocusTags: allowedTags,
    reasoning: focusDecision.algorithmReasoning,
    onboarding: focusDecision.onboarding,
    performanceLevel: focusDecision.performanceLevel
  });
}

async function applySessionLogic(context) {
  const { focusDecision, settings, sessionState, performanceMetrics,
    interviewInsights, allowedTags, focusTags, now } = context;

  const onboarding = focusDecision.onboarding;

  if (onboarding) {
    const limitedTags = allowedTags.slice(0, 1);
    logger.info(`🔰 Onboarding: Limited focus tags to: [${limitedTags.join(', ')}]`);

    const onboardingResult = applyOnboardingSettings(settings, sessionState, limitedTags, focusDecision);
    return {
      sessionLength: onboardingResult.sessionLength,
      numberOfNewProblems: onboardingResult.numberOfNewProblems,
      finalAllowedTags: limitedTags,
      tag_index: undefined
    };
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

    return {
      sessionLength: adaptiveResult.sessionLength,
      numberOfNewProblems: adaptiveResult.numberOfNewProblems,
      finalAllowedTags: adaptiveResult.allowedTags,
      tag_index: adaptiveResult.tag_index
    };
  }
}

function logAdaptiveConfig(config) {
  const { sessionLength, numberOfNewProblems, allowedTags, performanceMetrics, onboarding, sessionState } = config;
  logger.info("🧠 Adaptive Session Config:", {
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

function logDifficultyCapDebug(onboarding, sessionState, finalDifficultyCap) {
  console.log(`🔍 DIFFICULTY CAP DEBUG:`, {
    onboarding,
    sessionStateCurrentDifficulty: sessionState.current_difficulty_cap,
    finalDifficultyCap,
    numSessionsCompleted: sessionState.num_sessions_completed
  });
}

function computeSessionLength(accuracy, efficiencyScore, userPreferredLength = 4, performanceTrend = 'stable', consecutiveExcellentSessions = 0) {
  const accWeight = Math.min(Math.max(accuracy ?? 0.5, 0), 1);
  const effWeight = Math.min(Math.max(efficiencyScore ?? 0.5, 0), 1);

  // Start with user's preferred length as baseline
  const baseLength = Math.max(userPreferredLength || 4, 3); // Minimum 3 problems

  // Base adaptation multipliers
  let lengthMultiplier = 1.0;

  if (accWeight >= 0.9) {
    // Excellent current performance - base increase
    lengthMultiplier = 1.25;
  } else if (accWeight >= 0.7) {
    lengthMultiplier = 1.0;
  } else if (accWeight < 0.5) {
    lengthMultiplier = 0.8;
  }

  // NEW: Progressive scaling based on performance trends
  if (performanceTrend === 'sustained_excellence') {
    // Sustained excellence deserves progressive challenge growth
    const momentumBonus = Math.min(consecutiveExcellentSessions * 0.15, 0.6); // Up to 60% bonus for 4+ excellent sessions
    lengthMultiplier += momentumBonus;
    logger.info(`🚀 Sustained excellence bonus: ${(momentumBonus * 100).toFixed(0)}% (${consecutiveExcellentSessions} consecutive excellent sessions)`);
  } else if (performanceTrend === 'improving') {
    // Improving users get moderate growth encouragement
    lengthMultiplier += 0.1;
    logger.info(`📈 Improvement momentum: +10% session length`);
  } else if (performanceTrend === 'struggling') {
    // Struggling users need more support
    lengthMultiplier = Math.max(lengthMultiplier - 0.2, 0.6); // Extra reduction but not below 60%
    logger.info(`🛡️ Struggling support: Extra session length reduction`);
  } else if (performanceTrend === 'stable') {
    // Stable users get gentle scaling based on their accuracy level
    if (accWeight >= 0.8) {
      // Strong stable performance (80%+) gets gentle challenge increase
      lengthMultiplier += 0.05;
      logger.info(`📊 Stable strong performance: +5% session length (${(accWeight * 100).toFixed(1)}% accuracy)`);
    } else if (accWeight >= 0.6) {
      // Good stable performance (60-80%) gets small variation for engagement
      lengthMultiplier += 0.025;
      logger.info(`📊 Stable performance: +2.5% session length for engagement (${(accWeight * 100).toFixed(1)}% accuracy)`);
    }
    // Below 60% stable performance gets no additional scaling (already handled by base multiplier)
  }

  // Speed consideration: Very fast + accurate users might need even more challenge
  if (effWeight > 0.8 && accWeight > 0.8) {
    lengthMultiplier *= 1.1;
  }

  // Apply adaptation with expanded bounds for sustained excellent performers
  const maxLength = performanceTrend === 'sustained_excellence' ? 12 : 8;
  const adaptedLength = Math.round(baseLength * lengthMultiplier);
  const finalLength = Math.min(Math.max(adaptedLength, 3), maxLength);

  console.log(`🔍 SESSION LENGTH COMPUTATION:`, {
    accuracy: accWeight,
    performanceTrend,
    consecutiveExcellentSessions,
    baseLength,
    lengthMultiplier,
    adaptedLength,
    maxLength,
    finalLength
  });

  return finalLength;
}

/**
 * Blend user session length preference with adaptive calculation
 * Uses 70% adaptive intelligence, 30% user preference for optimal balance
 */
function applySessionLengthPreference(adaptiveLength, userPreferredLength) {
  if (!userPreferredLength || userPreferredLength <= 0) {
    return adaptiveLength; // Use pure adaptive if no valid preference
  }
  
  // Blend: 70% adaptive intelligence, 30% user preference
  const blended = Math.round(adaptiveLength * 0.7 + userPreferredLength * 0.3);
  
  // Keep within adaptive system bounds (3-12 problems)
  const result = Math.max(3, Math.min(12, blended));
  
  if (result !== adaptiveLength) {
    logger.info(`🎛️ Session length blended: Adaptive ${adaptiveLength} + User ${userPreferredLength} = ${result}`);
  }
  
  return result;
}

// Helper function to filter sessions by time or recent count
function _filterSessions(allSessions, daysBack, recentSessionsLimit) {
  const now = new Date();
  if (daysBack) {
    return allSessions.filter((s) => {
      const date = new Date(s.date || s.created_date);
      return (now - date) / (1000 * 60 * 60 * 24) <= daysBack;
    });
  } else {
    allSessions.sort((a, b) => new Date(a.date || a.created_date) - new Date(b.date || b.created_date));
    return allSessions.slice(-recentSessionsLimit);
  }
}

// Helper function to process attempts and calculate statistics
async function _processAttempts(sessions) {
  const performance = {
    easy: { attempts: 0, correct: 0, time: 0 },
    medium: { attempts: 0, correct: 0, time: 0 },
    hard: { attempts: 0, correct: 0, time: 0 },
  };
  const tagStats = {};
  let totalAttempts = 0;
  let totalCorrect = 0;
  let totalTime = 0;

  for (let session of sessions) {
    // 🎯 OPTION 2: Query attempts store directly for complete data
    const attempts = await getAttemptsBySessionId(session.id);
    const problems = session.problems || [];

    // Debug logging removed to prevent console spam

    // Skip sessions without attempts instead of throwing error
    if (attempts.length === 0) {
      console.log(`⏭️ Skipping session ${session.id} - no attempts recorded yet`);
      continue;
    }

    // Create problem mapping for tag lookup
    const problemMap = new Map(problems.map((p) => [p.id, p]));

    for (let attempt of attempts) {
      const leetcodeId = attempt.leetcode_id;

      // Debug logging removed to prevent console spam

      // Find problem for tag information
      let problem = problemMap.get(leetcodeId) ||
                   problemMap.get(String(leetcodeId)) ||
                   problemMap.get(Number(leetcodeId));

      // Strict error handling: No fallbacks that mask data issues
      if (!problem) {
        const sessionProblem = problems.find(p => String(p.id) === String(leetcodeId));
        if (!sessionProblem) {
          throw new Error(`Attempt ${attempt.id} references leetcode_id ${leetcodeId} but no matching problem found in session ${session.id}`);
        }
        problem = sessionProblem;
      }

      // Use problem difficulty for performance categorization (easy/medium/hard breakdown)
      // Note: This is only for categorizing attempts, NOT for calculating accuracy
      // Accuracy is simply: successful attempts / total attempts (calculated at line 1154)
      if (!problem.difficulty) {
        throw new Error(`Problem ${leetcodeId} in attempt ${attempt.id} is missing difficulty field - data integrity issue`);
      }
      const rating = problem.difficulty.toLowerCase();

      const tags = problem.tags || [];
      const timeSpent = attempt.time_spent || 0;
      const success = attempt.success;

      // Strict validation of attempt data
      if (typeof success !== 'boolean') {
        throw new Error(`Invalid success value in attempt ${attempt.id}: expected boolean, got ${typeof success} (${success})`);
      }

      if (typeof timeSpent !== 'number' || timeSpent < 0) {
        throw new Error(`Invalid time_spent value in attempt ${attempt.id}: expected non-negative number, got ${typeof timeSpent} (${timeSpent})`);
      }

      // Update performance metrics
      performance[rating].attempts += 1;
      performance[rating].time += timeSpent;
      if (success) performance[rating].correct += 1;

      // Update tag statistics with zero-division protection
      for (let tag of tags) {
        if (!tagStats[tag]) {
          tagStats[tag] = { attempts: 0, correct: 0, time: 0 };
        }
        tagStats[tag].attempts += 1;
        tagStats[tag].time += timeSpent;
        if (success) tagStats[tag].correct += 1;
      }

      totalAttempts += 1;
      totalTime += timeSpent;
      if (success) totalCorrect += 1;
    }
  }

  return { performance, tagStats, totalAttempts, totalCorrect, totalTime };
}

// Helper function to calculate strong and weak tags
function _calculateTagStrengths(tagStats, unmasteredTagSet) {
  const strongTags = [];
  const weakTags = [];

  for (let tag in tagStats) {
    const { attempts, correct } = tagStats[tag];

    // 🛡️ Zero-division protection
    if (attempts === 0) {
      logger.warn(`⚠️ Tag ${tag} has zero attempts - skipping accuracy calculation`);
      continue;
    }

    const acc = correct / attempts;

    logger.info(
      `🧪 Evaluating ${tag} — acc: ${acc.toFixed(
        2
      )},correct: ${correct}, attempts: ${attempts}, mastered: ${!unmasteredTagSet.has(tag)}`
    );

    // Session-based categorization: evaluate ALL tags attempted in session
    if (acc >= 0.8 && attempts >= 1) {
      strongTags.push(tag);
    } else if (acc < 0.7 && attempts >= 1) {
      weakTags.push(tag);
    }
    // Tags with 70-80% accuracy are considered neutral (not strong or weak)
  }

  return { strongTags, weakTags };
}

// Helper function to calculate timing feedback
function _calculateTimingFeedback(performance) {
  const expected = {
    Easy: [600, 900],
    Medium: [1200, 1500],
    Hard: [1800, 2100],
  };
  
  const timingFeedback = {};
  // Map snake_case performance keys to capitalized timing feedback keys for backward compatibility
  const difficultyMappings = [
    { perfKey: "easy", timingKey: "Easy" },
    { perfKey: "medium", timingKey: "Medium" },
    { perfKey: "hard", timingKey: "Hard" }
  ];

  for (let { perfKey, timingKey } of difficultyMappings) {
    const perfData = performance[perfKey];
    if (!perfData) {
      timingFeedback[timingKey] = "noData";
      continue;
    }

    const { attempts, time } = perfData;
    if (attempts === 0) {
      timingFeedback[timingKey] = "noData";
    } else {
      const avg = time / attempts;
      const [min, max] = expected[timingKey];
      if (avg < min) timingFeedback[timingKey] = "tooFast";
      else if (avg > max) timingFeedback[timingKey] = "tooSlow";
      else timingFeedback[timingKey] = "onTarget";
    }
  }
  
  return timingFeedback;
}

export async function getSessionPerformance({
  recentSessionsLimit = 5,
  daysBack = null,
  unmasteredTags = [],
} = {}) {
  console.log(`🔍 PERFORMANCE DEBUG: getSessionPerformance ENTRY`);
  console.log(`🔍 PERFORMANCE DEBUG: Parameters:`, {
    recentSessionsLimit,
    daysBack,
    unmasteredTagsCount: unmasteredTags.length,
    unmasteredTags: unmasteredTags.slice(0, 5)
  });

  logger.info("🔍 getSessionPerformance", unmasteredTags);
  const db = await openDB();
  const unmasteredTagSet = new Set(unmasteredTags);

  // 1️⃣ Use the combined index to get most recent completed standard sessions
  console.log(`🔍 PERFORMANCE DEBUG: Step 1 - Getting recent completed standard sessions using combined index...`);
  const sessionStore = db
    .transaction("sessions", "readonly")
    .objectStore("sessions");

  let sessions;
  if (daysBack) {
    // If daysBack is specified, fetch all sessions and filter by date
    const allSessions = await new Promise((resolve, reject) => {
      const req = sessionStore.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    sessions = _filterSessions(allSessions, daysBack, null);
  } else {
    // Use the combined index to get most recent completed standard sessions
    try {
      const index = sessionStore.index("by_session_type_status");
      const keyRange = IDBKeyRange.only(["standard", "completed"]);

      sessions = await new Promise((resolve, reject) => {
        const req = index.getAll(keyRange);
        req.onsuccess = () => {
          // Sort by creation date descending and take the most recent
          const results = req.result
            .sort((a, b) => new Date(b.date || b.created_date) - new Date(a.date || a.created_date))
            .slice(0, recentSessionsLimit);
          resolve(results);
        };
        req.onerror = () => reject(req.error);
      });

      console.log(`🔍 PERFORMANCE DEBUG: Retrieved ${sessions.length} recent completed standard sessions using combined index`);
    } catch (error) {
      console.error(`❌ PERFORMANCE DEBUG: Failed to use combined index, falling back to full scan:`, error);
      // Fallback to the old method if index fails
      const allSessions = await new Promise((resolve, reject) => {
        const req = sessionStore.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      sessions = _filterSessions(allSessions, daysBack, recentSessionsLimit);
    }
  }

  console.log(`🔍 PERFORMANCE DEBUG: Final sessions for analysis:`, {
    sessionsCount: sessions.length,
    sessionsWithAttempts: sessions.filter(s => s.attempts?.length > 0).length,
    totalAttemptsAcrossSessions: sessions.reduce((sum, s) => sum + (s.attempts?.length || 0), 0),
    sessionIds: sessions.map(s => s.id),
    sessionTypes: [...new Set(sessions.map(s => s.session_type))],
    sessionStatuses: [...new Set(sessions.map(s => s.status))]
  });

  logger.info("🔍 sessions", sessions);

  console.log(`🔍 PERFORMANCE DEBUG: Step 3 - Processing attempts...`);
  const { performance, tagStats, totalAttempts, totalCorrect, totalTime } = await _processAttempts(sessions);

  console.log(`🔍 PERFORMANCE DEBUG: Processed attempts result:`, {
    totalAttempts,
    totalCorrect,
    totalTime,
    accuracy: totalAttempts ? totalCorrect / totalAttempts : 0,
    avgTime: totalAttempts ? totalTime / totalAttempts : 0,
    easyAttempts: performance.Easy?.attempts || 0,
    mediumAttempts: performance.Medium?.attempts || 0,
    hardAttempts: performance.Hard?.attempts || 0,
    tagStatsKeys: Object.keys(tagStats || {}).length
  });

  // 🧠 Calculate tag strengths and timing feedback
  logger.info("unmasteredTagSet", unmasteredTagSet);
  const { strongTags, weakTags } = _calculateTagStrengths(tagStats, unmasteredTagSet);
  const timingFeedback = _calculateTimingFeedback(performance);

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
 * @param {number} accuracy - Session accuracy (0-1)
 * @param {Object} settings - User settings
 * @returns {Promise<Object>} Updated session state with difficulty progression
 */
export async function evaluateDifficultyProgression(accuracy, settings) {
  try {
    // Validate inputs
    if (accuracy === null || accuracy === undefined || isNaN(accuracy)) {
      logger.warn(`⚠️ Invalid accuracy value: ${accuracy}, defaulting to 0`);
      accuracy = 0;
    }

    if (!settings) {
      logger.warn(`⚠️ Missing settings object, using default`);
      settings = {};
    }

    logger.info(`🎯 Evaluating difficulty progression with accuracy: ${(accuracy * 100).toFixed(1)}%`);

    // Get current session state
    let sessionState;
    try {
      sessionState = await StorageService.getSessionState();
      if (!sessionState) {
        logger.info(`🔰 No existing session state, creating default`);
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
      logger.error("❌ Failed to get session state:", stateError);
      throw new Error(`Session state retrieval failed: ${stateError.message}`);
    }

    const previousDifficulty = sessionState.current_difficulty_cap;
    const now = new Date();

    // Check for demotion BEFORE promotion logic
    sessionState = await checkForDemotion(sessionState);

    // Apply difficulty progression logic
    let updatedSessionState;
    try {
      updatedSessionState = applyEscapeHatchLogic(sessionState, accuracy, settings, now);
      if (!updatedSessionState) {
        throw new Error("applyEscapeHatchLogic returned null/undefined");
      }
    } catch (logicError) {
      logger.error("❌ Failed to apply escape hatch logic:", logicError);
      throw new Error(`Difficulty progression logic failed: ${logicError.message}`);
    }

    // Save updated session state
    try {
      await StorageService.setSessionState("session_state", updatedSessionState);

      if (updatedSessionState.current_difficulty_cap !== previousDifficulty) {
        logger.info(`🎯 Difficulty progression: ${previousDifficulty} → ${updatedSessionState.current_difficulty_cap}`);
      } else {
        logger.info(`🎯 Difficulty maintained at ${updatedSessionState.current_difficulty_cap}, tracking updated`);
      }
    } catch (saveError) {
      logger.error("❌ Failed to save session state:", saveError);
      throw new Error(`Session state save failed: ${saveError.message}`);
    }

    return updatedSessionState;
  } catch (error) {
    logger.error("❌ Failed to evaluate difficulty progression:", error);
    throw error;
  }
}

/**
 * Calculates progressive tag exposure within the focus window (5 tags max)
 * @param {number} accuracy - Current accuracy (0-1)
 * @param {number} efficiencyScore - Current efficiency (0-1)
 * @param {number} currentTagIndex - Current tag index in focus window
 * @param {number} focusTagsLength - Length of current focus tags array
 * @param {object} sessionState - Session state for tracking stagnation
 * @returns {number} Number of tags to include from focus window
 */
function _calculateTagIndexProgression(
  accuracy,
  efficiencyScore,
  currentTagIndex,
  focusTagsLength,
  sessionState
) {
  // Start with current progress
  let tagCount = currentTagIndex + 1; // Convert index to count

  // 🔓 Softened tag expansion thresholds: Separate accuracy and efficiency OR-based conditions
  // Allow expansion if user meets EITHER accuracy OR efficiency threshold (not both)
  const hasGoodAccuracy = accuracy >= 0.75;
  const hasGoodEfficiency = efficiencyScore >= 0.6;
  const hasExcellentAccuracy = accuracy >= 0.9;
  const hasExcellentEfficiency = efficiencyScore >= 0.8;

  // More lenient expansion conditions
  const canExpandToNext = hasGoodAccuracy || hasGoodEfficiency; // OR instead of AND
  const canExpandQuickly =
    (hasExcellentAccuracy || hasExcellentEfficiency) &&
    (accuracy >= 0.7 || efficiencyScore >= 0.5);

  // Additional fallback: Allow expansion after 5+ sessions at same tag count (anti-stagnation)
  const sessionsAtCurrentTagCount = sessionState.sessionsAtCurrentTagCount || 0;
  const canExpandByStagnation =
    sessionsAtCurrentTagCount >= 5 &&
    (accuracy >= 0.6 || efficiencyScore >= 0.4);

  // Progressive expansion within focus window
  if (
    (canExpandQuickly || canExpandByStagnation) &&
    tagCount < focusTagsLength
  ) {
    tagCount = Math.min(tagCount + 2, focusTagsLength); // Jump 2 tags if excellent performance or stuck
    logger.info(
      `🏷️ Tag expansion: +2 tags (${
        canExpandQuickly ? "excellent performance" : "stagnation fallback"
      })`
    );
  } else if (canExpandToNext && tagCount < focusTagsLength) {
    tagCount = Math.min(tagCount + 1, focusTagsLength); // Add 1 tag if good performance
    logger.info(
      `🏷️ Tag expansion: +1 tag (good ${
        hasGoodAccuracy ? "accuracy" : "efficiency"
      })`
    );
  }

  // Track sessions at current tag count for stagnation detection
  if (!sessionState.sessionsAtCurrentTagCount) {
    sessionState.sessionsAtCurrentTagCount = 0;
  }

  const previousTagCount = sessionState.lastTagCount || 1;
  if (tagCount === previousTagCount) {
    sessionState.sessionsAtCurrentTagCount++;
  } else {
    sessionState.sessionsAtCurrentTagCount = 0; // Reset when tag count changes
  }
  sessionState.lastTagCount = tagCount;

  // Never exceed focus window size or go below 1
  const finalCount = Math.min(Math.max(1, tagCount), focusTagsLength);

  logger.info(
    `🏷️ Tag progression: index=${currentTagIndex} → count=${finalCount}/${focusTagsLength} (accuracy: ${(
      accuracy * 100
    ).toFixed(1)}%, efficiency: ${(efficiencyScore * 100).toFixed(1)}%)`
  );

  return finalCount;
}
