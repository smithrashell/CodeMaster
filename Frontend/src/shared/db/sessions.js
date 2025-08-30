import { dbHelper } from "./index.js";
import { TagService } from "../services/tagServices.js";
import { StorageService } from "../services/storageService.js";
import { AttemptsService } from "../services/attemptsService.js";
import FocusCoordinationService from "../services/focusCoordinationService.js";
import SessionLimits from "../utils/sessionLimits.js";
import { InterviewService } from "../services/interviewService.js";
import logger from "../utils/logger.js";

const openDB = dbHelper.openDB;

/**
 * Retrieves a session by its ID.
 */
export const getSessionById = async (sessionId) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("sessions", "readonly");
    const store = transaction.objectStore("sessions");

    const request = store.get(sessionId);
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
      
      // Sort by date (newest first) - handle both 'date' and 'Date' properties
      const sortedSessions = allSessions.sort((a, b) => {
        const dateA = new Date(a.date || a.Date || 0);
        const dateB = new Date(b.date || b.Date || 0);
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
 * @param {string|null} sessionType - Filter by session type ('standard', 'interview-like', 'full-interview', etc.)
 * @param {string|null} status - Filter by status ('in_progress', 'completed', etc.)
 * @returns {Promise<Object|null>} Latest matching session or null if none found
 */
export const getLatestSessionByType = async (sessionType = null, status = null) => {
  logger.info(`🔍 getLatestSessionByType ENTRY: sessionType=${sessionType}, status=${status}`);
  
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("sessions", "readonly");
    const store = transaction.objectStore("sessions");
    
    // Normalize sessionType - treat null/undefined as 'standard' 
    const normalizedSessionType = sessionType || 'standard';
    
    // Use appropriate index based on whether status is specified
    let index, keyRange;
    if (status) {
      // Use composite index for sessionType + status queries
      index = store.index("by_sessionType_status");
      keyRange = IDBKeyRange.only([normalizedSessionType, status]);
    } else {
      // Use sessionType index for type-only queries  
      index = store.index("by_sessionType");
      keyRange = IDBKeyRange.only(normalizedSessionType);
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
 * Saves session to Chrome Storage with fallback handling (optional: updates IndexedDB if needed).
 * Implements graceful degradation when Chrome APIs are unavailable.
 */
export const saveSessionToStorage = async (session, updateDatabase = false) => {
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


export async function buildAdaptiveSessionSettings() {
  const sessionStateKey = "session_state";
  const now = new Date();

  // Get focus decision from coordination service (integrates all systems)
  const focusDecision = await FocusCoordinationService.getFocusDecision(sessionStateKey);
  
  // Get additional system data still needed for session building
  const { focusTags } = await TagService.getCurrentTier();
  const settings = await StorageService.getSettings();
  const userFocusAreas = focusDecision.userPreferences;

  // Try to migrate from Chrome storage first, then get from IndexedDB
  let sessionState = (await StorageService.migrateSessionStateToIndexedDB()) ||
    (await StorageService.getSessionState(sessionStateKey)) || {
      id: sessionStateKey,
      numSessionsCompleted: 0,
      currentDifficultyCap: "Easy",
      tagIndex: 0,
      difficultyTimeStats: {
        Easy: { problems: 0, totalTime: 0, avgTime: 0 },
        Medium: { problems: 0, totalTime: 0, avgTime: 0 },
        Hard: { problems: 0, totalTime: 0, avgTime: 0 },
      },
      lastPerformance: {
        accuracy: null,
        efficiencyScore: null,
      },
      // 🔓 Escape hatch tracking
      escapeHatches: {
        sessionsAtCurrentDifficulty: 0,
        lastDifficultyPromotion: null,
        sessionsWithoutPromotion: 0,
        activatedEscapeHatches: [],
      },
    };

  const performance = sessionState.lastPerformance || {};
  const accuracy = performance.accuracy ?? 0.5;
  const efficiencyScore = performance.efficiencyScore ?? 0.5;

  // Default values with onboarding-aware user preference integration
  let sessionLength = 4;
  let numberOfNewProblems = 4;
  
  // 🎯 Get interview insights for adaptive learning integration
  const interviewInsights = await InterviewService.getInterviewInsightsForAdaptiveLearning();
  logger.info(`🎯 Interview insights for adaptive learning:`, {
    hasData: interviewInsights.hasInterviewData,
    transferAccuracy: interviewInsights.transferAccuracy,
    speedDelta: interviewInsights.speedDelta,
    recommendations: interviewInsights.recommendations
  });
  
  // 🎯 Use coordinated focus decision (handles onboarding, performance, user preferences)
  let allowedTags = focusDecision.activeFocusTags;
  const onboarding = focusDecision.onboarding;
  
  logger.info(`🎯 Focus Coordination Service decision:`, {
    activeFocusTags: allowedTags,
    reasoning: focusDecision.algorithmReasoning,
    onboarding: focusDecision.onboarding,
    performanceLevel: focusDecision.performanceLevel
  });

  if (onboarding) {
    // 🔰 Onboarding mode: Apply user preferences with safety constraints
    logger.info("🔰 Onboarding mode: Applying user preferences with safety caps");
    
    // Apply user session length preference with dynamic onboarding cap
    const userSessionLength = settings.sessionLength;
    const maxSessionLength = SessionLimits.getMaxSessionLength(sessionState);
    if (userSessionLength && userSessionLength > 0) {
      sessionLength = Math.min(userSessionLength, maxSessionLength);
      logger.info(`🔰 User session length preference applied: ${userSessionLength} → capped at ${sessionLength} for onboarding`);
    }
    
    // Apply user new problems cap with dynamic onboarding limit  
    const userMaxNewProblems = settings.numberofNewProblemsPerSession;
    const maxNewProblems = SessionLimits.getMaxNewProblems(sessionState);
    if (userMaxNewProblems && userMaxNewProblems > 0) {
      numberOfNewProblems = Math.min(userMaxNewProblems, maxNewProblems);
      logger.info(`🔰 User new problems preference applied: ${userMaxNewProblems} → capped at ${numberOfNewProblems} for onboarding`);
    }
    
    // Focus tags already handled by coordination service
    logger.info(`🔰 Focus tags from coordination service: [${allowedTags.join(', ')}] (${focusDecision.reasoning})`);
  } else if (!onboarding) {
    // 🧠 Time gap since last session
    let gapInDays = 999;
    const lastAttempt = await AttemptsService.getMostRecentAttempt();
    if (lastAttempt?.AttemptDate) {
      const lastTime = new Date(lastAttempt.AttemptDate);
      gapInDays = (now - lastTime) / (1000 * 60 * 60 * 24);
    }

    // Calculate adaptive session length
    const adaptiveSessionLength = computeSessionLength(accuracy, efficiencyScore);
    
    // Apply user preference blending (70% adaptive, 30% user preference)
    const userPreferredLength = settings.sessionLength;
    sessionLength = applySessionLengthPreference(adaptiveSessionLength, userPreferredLength);

    // 🎯 Apply interview insights to session parameters
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

    // Apply performance-based constraints
    if (gapInDays > 4 || accuracy < 0.5) {
      sessionLength = Math.min(sessionLength, 5);
      logger.info(`🛡️ Performance constraint applied: Session length capped at 5 due to gap (${gapInDays.toFixed(1)} days) or low accuracy (${(accuracy * 100).toFixed(1)}%)`);
    }

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

    // 🎯 Apply interview insights to new problems count
    if (interviewInsights.hasInterviewData && interviewInsights.recommendations.newProblemsAdjustment !== 0) {
      const originalNewProblems = numberOfNewProblems;
      numberOfNewProblems = Math.max(0, numberOfNewProblems + interviewInsights.recommendations.newProblemsAdjustment);
      logger.info(`🎯 Interview insight: New problems adjusted from ${originalNewProblems} to ${numberOfNewProblems} (transfer performance: ${(interviewInsights.transferAccuracy * 100).toFixed(1)}%)`);
    }

    // 🏷️ Focus tags already determined by coordination service
    // (Coordination service integrates performance-based expansion with user preferences)
    let tagCount = allowedTags.length;
    
    // 🎯 Apply interview insights to focus tag selection
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
    sessionState.tagIndex = tagCount - 1; // Convert from count to index

    logger.info(
      `🏷️ Tag exposure from coordination service: ${tagCount}/${focusTags.length} focus tags (coordinated: [${allowedTags.join(', ')}], accuracy: ${(accuracy * 100).toFixed(1)}%)`
    );

    // 🔓 Session-based escape hatch detection and activation
    const currentDifficulty = sessionState.currentDifficultyCap;

    // Ensure escapeHatches object exists (backward compatibility)
    if (!sessionState.escapeHatches) {
      sessionState.escapeHatches = {
        sessionsAtCurrentDifficulty: 0,
        lastDifficultyPromotion: null,
        sessionsWithoutPromotion: 0,
        activatedEscapeHatches: [],
      };
    }

    const escapeHatches = sessionState.escapeHatches;

    // Track sessions at current difficulty level
    escapeHatches.sessionsAtCurrentDifficulty++;

    // Check for session-based escape hatch (10+ sessions without promotion)
    let promotionThreshold = 0.9; // Default 90% accuracy
    let escapeHatchActivated = false;

    if (escapeHatches.sessionsAtCurrentDifficulty >= 10) {
      // Apply session-based escape hatch - lower threshold from 90% to 80%
      promotionThreshold = 0.8;
      escapeHatchActivated = true;

      if (!escapeHatches.activatedEscapeHatches.includes("session-based")) {
        escapeHatches.activatedEscapeHatches.push("session-based");
        logger.info(
          "🔓 Session-based escape hatch ACTIVATED: Lowering difficulty promotion threshold from 90% to 80%"
        );
      }
    }

    // Progressive difficulty cap unlocking with escape hatch threshold
    // Apply user difficulty ceiling (from Goals page guardrails)
    const userMaxDifficulty = settings.maxDifficulty || "Hard";
    const getDifficultyOrder = (difficulty) => {
      const order = { "Easy": 1, "Medium": 2, "Hard": 3 };
      return order[difficulty] || 1;
    };
    
    if (
      accuracy >= promotionThreshold &&
      sessionState.currentDifficultyCap === "Easy" &&
      getDifficultyOrder(userMaxDifficulty) >= getDifficultyOrder("Medium")
    ) {
      sessionState.currentDifficultyCap = "Medium";
      escapeHatches.lastDifficultyPromotion = now.toISOString();
      escapeHatches.sessionsAtCurrentDifficulty = 0; // Reset counter
      escapeHatches.activatedEscapeHatches = []; // Reset escape hatches for new difficulty

      if (escapeHatchActivated) {
        logger.info(
          "🎯 Difficulty cap upgraded via ESCAPE HATCH: Easy → Medium (80% threshold)"
        );
      } else {
        logger.info("🎯 Difficulty cap upgraded: Easy → Medium");
      }
    } else if (
      accuracy >= promotionThreshold &&
      sessionState.currentDifficultyCap === "Medium" &&
      getDifficultyOrder(userMaxDifficulty) >= getDifficultyOrder("Hard")
    ) {
      sessionState.currentDifficultyCap = "Hard";
      escapeHatches.lastDifficultyPromotion = now.toISOString();
      escapeHatches.sessionsAtCurrentDifficulty = 0; // Reset counter
      escapeHatches.activatedEscapeHatches = []; // Reset escape hatches for new difficulty

      if (escapeHatchActivated) {
        logger.info(
          "🎯 Difficulty cap upgraded via ESCAPE HATCH: Medium → Hard (80% threshold)"
        );
      } else {
        logger.info("🎯 Difficulty cap upgraded: Medium → Hard");
      }
    } else if (
      accuracy >= promotionThreshold &&
      getDifficultyOrder(sessionState.currentDifficultyCap) < getDifficultyOrder(userMaxDifficulty)
    ) {
      logger.info(`🛡️ Difficulty progression blocked by user guardrail: Current ${sessionState.currentDifficultyCap}, Max allowed: ${userMaxDifficulty}`);
    }

    // Track sessions without promotion for debugging
    if (sessionState.currentDifficultyCap === currentDifficulty) {
      escapeHatches.sessionsWithoutPromotion++;
    } else {
      escapeHatches.sessionsWithoutPromotion = 0;
    }
  }

  sessionState.lastSessionDate = now.toISOString();
  
  // Update session state using coordination service to avoid conflicts
  sessionState = FocusCoordinationService.updateSessionState(sessionState, focusDecision);
  
  await StorageService.setSessionState(sessionStateKey, sessionState);

  logger.info("🧠 Adaptive Session Config:", {
    sessionLength,
    numberOfNewProblems,
    allowedTags,
    accuracy,
    efficiencyScore,
  });

  return {
    sessionLength,
    numberOfNewProblems,
    currentAllowedTags: allowedTags,
    currentDifficultyCap: sessionState.currentDifficultyCap,
    userFocusAreas,
    sessionState,
  };
}

function computeSessionLength(accuracy, efficiencyScore) {
  const accWeight = Math.min(Math.max(accuracy ?? 0.5, 0), 1);
  const effWeight = Math.min(Math.max(efficiencyScore ?? 0.5, 0), 1);

  const composite = accWeight * 0.6 + effWeight * 0.4;

  // Scale from 3 to 12 problems based on performance
  return Math.round(3 + composite * 9); // [3, 12]
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

export async function getSessionPerformance({
  recentSessionsLimit = 5,
  daysBack = null,
  unmasteredTags = [],
} = {}) {
  logger.info("🔍 getSessionPerformance", unmasteredTags);
  const db = await openDB();
  const unmasteredTagSet = new Set(unmasteredTags);

  // 1️⃣ Fetch all sessions
  const sessionStore = db
    .transaction("sessions", "readonly")
    .objectStore("sessions");
  const allSessions = await new Promise((resolve, reject) => {
    const req = sessionStore.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  // 2️⃣ Apply filtering by time or recent count
  const now = new Date();
  let sessions = allSessions;

  if (daysBack) {
    sessions = allSessions.filter((s) => {
      const date = new Date(s.Date);
      return (now - date) / (1000 * 60 * 60 * 24) <= daysBack;
    });
  } else {
    allSessions.sort((a, b) => new Date(a.Date) - new Date(b.Date));
    sessions = allSessions.slice(-recentSessionsLimit);
  }
  logger.info("🔍 sessions", sessions);
  const performance = {
    Easy: { attempts: 0, correct: 0, time: 0 },
    Medium: { attempts: 0, correct: 0, time: 0 },
    Hard: { attempts: 0, correct: 0, time: 0 },
  };

  const tagStats = {};
  let totalAttempts = 0;
  let totalCorrect = 0;
  let totalTime = 0;

  for (let session of sessions) {
    const attempts = session.attempts || [];
    const problems = session.problems || [];

    const problemMap = new Map(problems.map((p) => [p.id, p]));

    for (let attempt of attempts) {
      const problem = problemMap.get(attempt.problemId);
      if (!problem) continue;

      const rating = problem.Rating || "Medium"; // fallback
      const tags = problem.Tags || [];

      performance[rating].attempts += 1;
      performance[rating].time += attempt.timeSpent || 0;
      if (attempt.success) performance[rating].correct += 1;

      // Tag stats
      for (let tag of tags) {
        if (!tagStats[tag]) {
          tagStats[tag] = { attempts: 0, correct: 0, time: 0 };
        }
        tagStats[tag].attempts += 1;
        tagStats[tag].time += attempt.timeSpent || 0;
        if (attempt.success) tagStats[tag].correct += 1;
      }

      totalAttempts += 1;
      totalTime += attempt.timeSpent || 0;
      if (attempt.success) totalCorrect += 1;
    }
  }

  // 🧠 Derive strong + weak tags
  const strongTags = [];
  const weakTags = [];
  logger.info("unmasteredTagSet", unmasteredTagSet);
  for (let tag in tagStats) {
    if (!unmasteredTagSet.has(tag)) continue;

    const { attempts, correct } = tagStats[tag];
    const acc = correct / attempts;

    // Optional: Debug line
    logger.info(
      `🧪 Evaluating ${tag} — acc: ${acc.toFixed(
        2
      )},correct: ${correct}, attempts: ${attempts}`
    );

    if (acc >= 0.8 && attempts >= 2) {
      strongTags.push(tag);
    } else if (acc < 0.7) {
      weakTags.push(tag);
    }
  }

  // ⏱️ Expected time ranges
  const expected = {
    Easy: [600, 900],
    Medium: [1200, 1500],
    Hard: [1800, 2100],
  };

  const timingFeedback = {};
  for (let diff of ["Easy", "Medium", "Hard"]) {
    const { attempts, time } = performance[diff];
    if (attempts === 0) {
      timingFeedback[diff] = "noData";
    } else {
      const avg = time / attempts;
      const [min, max] = expected[diff];
      if (avg < min) timingFeedback[diff] = "tooFast";
      else if (avg > max) timingFeedback[diff] = "tooSlow";
      else timingFeedback[diff] = "onTarget";
    }
  }

  return {
    accuracy: totalAttempts ? totalCorrect / totalAttempts : 0,
    avgTime: totalAttempts ? totalTime / totalAttempts : 0,
    strongTags,
    weakTags,
    timingFeedback,
    Easy: {
      ...performance.Easy,
      avgTime: performance.Easy.attempts
        ? performance.Easy.time / performance.Easy.attempts
        : 0,
    },
    Medium: {
      ...performance.Medium,
      avgTime: performance.Medium.attempts
        ? performance.Medium.time / performance.Medium.attempts
        : 0,
    },
    Hard: {
      ...performance.Hard,
      avgTime: performance.Hard.attempts
        ? performance.Hard.time / performance.Hard.attempts
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
