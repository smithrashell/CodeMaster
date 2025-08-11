import { dbHelper } from "./index.js";
import { v4 as uuidv4 } from "uuid";
import { TagService } from "../services/tagServices.js";
import { StorageService } from "../services/storageService.js";
import { AttemptsService } from "../services/attemptsService.js";

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
 */
export const getLatestSession = async () => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("sessions", "readonly");
    const store = transaction.objectStore("sessions");
    const index = store.index("by_date");

    const request = index.openCursor(null, "prev"); // Get latest session
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      resolve(cursor ? cursor.value : null);
    };
    request.onerror = (e) => reject(e.target.error);
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
    console.log("session", session);
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
  return new Promise(async (resolve, reject) => {
    try {
      // Check if Chrome API is available
      if (typeof chrome !== "undefined" && chrome?.storage?.local?.set) {
        chrome.storage.local.set({ currentSession: session }, async () => {
          if (chrome.runtime?.lastError) {
            console.warn("Chrome storage error:", chrome.runtime.lastError);
            // Continue with IndexedDB update even if Chrome storage fails
          }

          if (updateDatabase) {
            try {
              await updateSessionInDB(session);
            } catch (error) {
              console.warn(
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
        console.warn(
          "Chrome storage API unavailable, skipping session storage to Chrome"
        );

        // Still update IndexedDB if requested
        if (updateDatabase) {
          try {
            await updateSessionInDB(session);
            console.info(
              "Session saved to IndexedDB (Chrome storage unavailable)"
            );
          } catch (error) {
            console.error(
              "Both Chrome storage and IndexedDB unavailable:",
              error
            );
            reject(new Error("No storage mechanism available"));
            return;
          }
        }

        // Resolve even without Chrome storage - system can continue
        resolve();
      }
    } catch (error) {
      console.error("Error in saveSessionToStorage:", error);

      // Try IndexedDB as fallback
      if (updateDatabase) {
        try {
          await updateSessionInDB(session);
          console.info("Fallback to IndexedDB successful");
          resolve();
        } catch (dbError) {
          console.error("All storage mechanisms failed:", {
            chromeError: error,
            dbError,
          });
          reject(new Error("All storage mechanisms unavailable"));
        }
      } else {
        // No fallback requested, but don't fail the entire operation
        console.warn("Chrome storage failed, but continuing without storage");
        resolve();
      }
    }
  });
};

export const recreateSessions = async () => {
  const db = await openDB();

  const transaction = db.transaction(
    ["attempts", "problems", "sessions"],
    "readonly"
  );
  const attemptStore = transaction.objectStore("attempts");
  const problemStore = transaction.objectStore("problems");

  // Pull all attempts & problems
  const attempts = await new Promise((resolve, reject) => {
    const request = attemptStore.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const problems = await new Promise((resolve, reject) => {
    const request = problemStore.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  console.log("📥 Total Attempts:", attempts.length);
  console.log("📚 Total Problems:", problems.length);

  const sessions = [];

  /** ------------------------ **/
  /** 1. Handle attempts WITH SessionID **/
  /** ------------------------ **/

  const sessionMap = new Map();

  attempts.forEach((attempt) => {
    if (attempt.SessionID) {
      const sessionId = attempt.SessionID;
      if (!sessionMap.has(sessionId)) {
        sessionMap.set(sessionId, []);
      }
      sessionMap.get(sessionId).push(attempt);
    }
  });

  console.log(
    "📦 Found sessions to rebuild (with SessionID):",
    sessionMap.size
  );

  for (let [sessionId, sessionAttempts] of sessionMap.entries()) {
    const problemIds = [
      ...new Set(sessionAttempts.map((a) => String(a.ProblemID))),
    ];
    const sessionProblems = problems.filter((problem) =>
      problemIds.includes(String(problem.id))
    );

    const isCompleted = sessionProblems.every((problem) =>
      sessionAttempts.some((attempt) => attempt.ProblemID === problem.id)
    );

    const cleanedAttempts = sessionAttempts.map((attempt) => ({
      attemptId: attempt.AttemptID || uuidv4(),
      problemId: attempt.ProblemID,
      success: attempt.Success,
      timeSpent: attempt.TimeSpent,
      AttemptDate: attempt.AttemptDate,
    }));

    const sortedAttempts = [...cleanedAttempts].sort(
      (a, b) => new Date(a.AttemptDate) - new Date(b.AttemptDate)
    );

    const sessionDate =
      sortedAttempts[0]?.AttemptDate || new Date().toISOString();

    const session = {
      id: sessionId,
      Date: sessionDate,
      attempts: cleanedAttempts.map(({ AttemptDate, ...rest }) => rest),
      problems: sessionProblems,
      status: isCompleted ? "completed" : "in_progress",
    };

    console.log("🔁 Rebuilt session:", sessionId);
    console.log(
      "➡️ Problems in session:",
      sessionProblems.map((p) => p.id)
    );
    console.log(
      "🧪 Attempts in session:",
      cleanedAttempts.map((a) => a.problemId)
    );

    sessions.push(session);
  }

  /** ------------------------ **/
  /** 2. Handle attempts WITHOUT SessionID **/
  /** ------------------------ **/

  const attemptsWithoutSessionID = attempts.filter((a) => !a.SessionID);

  console.log(
    "🧩 Orphan attempts without SessionID:",
    attemptsWithoutSessionID.length
  );

  const dateMap = new Map();

  attemptsWithoutSessionID.forEach((attempt) => {
    let dateValue;
    if (attempt.AttemptDate && !isNaN(new Date(attempt.AttemptDate))) {
      dateValue = new Date(attempt.AttemptDate);
    } else {
      console.warn("⚠️ Missing or invalid AttemptDate:", attempt);
      dateValue = new Date();
    }

    const dateKey = dateValue.toISOString().split("T")[0];

    if (!dateMap.has(dateKey)) {
      dateMap.set(dateKey, []);
    }
    dateMap.get(dateKey).push(attempt);
  });

  for (let [dateKey, dateAttempts] of dateMap.entries()) {
    const sessionId = uuidv4();

    const problemIds = [
      ...new Set(dateAttempts.map((a) => String(a.ProblemID))),
    ];
    const sessionProblems = problems.filter((problem) =>
      problemIds.includes(String(problem.id))
    );

    const cleanedAttempts = dateAttempts.map((attempt) => ({
      attemptId: attempt.AttemptID || uuidv4(),
      problemId: attempt.ProblemID,
      success: attempt.Success,
      timeSpent: attempt.TimeSpent,
      AttemptDate: attempt.AttemptDate,
    }));

    const sortedAttempts = [...cleanedAttempts].sort(
      (a, b) => new Date(a.AttemptDate) - new Date(b.AttemptDate)
    );

    const sessionDate =
      sortedAttempts[0]?.AttemptDate || `${dateKey}T00:00:00.000Z`;

    const session = {
      id: sessionId,
      Date: sessionDate,
      attempts: cleanedAttempts.map(({ AttemptDate, ...rest }) => rest),
      problems: sessionProblems,
      status: "completed",
    };

    console.log("🆕 Created new session from orphaned attempts on", dateKey);
    console.log(
      "➡️ Problems:",
      sessionProblems.map((p) => p.id)
    );
    console.log(
      "🧪 Attempts:",
      cleanedAttempts.map((a) => a.problemId)
    );

    sessions.push(session);
  }

  /** ------------------------ **/
  /** 3. Save sessions **/
  /** ------------------------ **/

  await Promise.all(sessions.map((session) => updateSessionInDB(session)));

  console.log("✅ Rebuilt and stored all sessions:", sessions.length);
  return sessions;
};

// export async function getSessionPerformance() {
//   const db = await openDB();

//   // 1️⃣ Fetch all sessions
//   const sessionStore = db
//     .transaction("sessions", "readonly")
//     .objectStore("sessions");
//   const sessionRequest = sessionStore.getAll();
//   const sessions = await new Promise((resolve, reject) => {
//     sessionRequest.onsuccess = () => resolve(sessionRequest.result);
//     sessionRequest.onerror = () => reject(sessionRequest.error);
//   });

//   // 2️⃣ Fetch ALL problems (user-specific)
//   const problemStore = db
//     .transaction("problems", "readonly")
//     .objectStore("problems");
//   const allProblemRequest = problemStore.getAll();
//   const allProblems = await new Promise((resolve, reject) => {
//     allProblemRequest.onsuccess = () => resolve(allProblemRequest.result);
//     allProblemRequest.onerror = () => reject(allProblemRequest.error);
//   });
//   console.log("🔍 allProblems:", allProblems);
//   const problemMap = new Map(allProblems.map((p) => [p.id, p])); // User's problems

//   // 3️⃣ Fetch ALL standard problems
//   const standardProblemStore = db
//     .transaction("standard_problems", "readonly")
//     .objectStore("standard_problems");
//   const allStandardRequest = standardProblemStore.getAll();
//   const allStandardProblems = await new Promise((resolve, reject) => {
//     allStandardRequest.onsuccess = () => resolve(allStandardRequest.result);
//     allStandardRequest.onerror = () => reject(allStandardRequest.error);
//   });
//   console.log("🔍 allStandardProblems:", allStandardProblems);
//   const standardProblemMap = new Map(
//     allStandardProblems.map((p) => [p.id, p])
//   ); // leetCodeID based
// console.log("🔍 standardProblemMap Keys:", [...standardProblemMap.keys()]);
//   // 4️⃣ Initialize aggregation
//   const performance = {
//     Easy: { attempts: 0, correct: 0 },
//     Medium: { attempts: 0, correct: 0 },
//     Hard: { attempts: 0, correct: 0 },
//   };

//   // 5️⃣ Loop sessions
//   for (let session of sessions) {
//     if (!session.attempts) continue;

//     for (let attempt of session.attempts) {
//       console.log("🔍 attempt:", attempt);
//       const problemEntry = problemMap.get(attempt.problemId);
//    console.log("🔍 problemEntry:", problemEntry);
//       if (!problemEntry) {
//         console.warn(
//           `⚠️ Problem not found in problemMap: ${attempt.ProblemID}`
//         );
//         continue;
//       }

//       const standardProblem = standardProblemMap.get(problemEntry.leetCodeID);
//       console.log("🔍 standardProblem:", standardProblem);
//       if (!standardProblem) {
//         console.warn(
//           `⚠️ Standard problem not found for leetCodeID: ${problemEntry.leetCodeID}`
//         );
//         continue;
//       }

//       if (standardProblem && standardProblem.difficulty) {
//         const difficulty = standardProblem.difficulty; // "Easy", "Medium", "Hard"
//         if (performance[difficulty]) {
//           performance[difficulty].attempts += 1;
//           if (attempt.success) {
//             performance[difficulty].correct += 1;
//           }
//         }
//       }
//     }
//   }

//   console.log("📊 Aggregated Session Performance:", performance);

//   return performance;
// }

export async function buildAdaptiveSessionSettings() {
  const { focusTags } = await TagService.getCurrentTier();
  const sessionStateKey = "session_state";
  const now = new Date();

  // Get user focus areas from settings
  const settings = await StorageService.getSettings();
  const userFocusAreas = settings.focusAreas || [];

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

  const onboarding = sessionState.numSessionsCompleted < 3;
  const performance = sessionState.lastPerformance || {};
  const accuracy = performance.accuracy ?? 0.5;
  const efficiencyScore = performance.efficiencyScore ?? 0.5;

  // Default values
  let sessionLength = 4;
  let numberOfNewProblems = 4;
  let allowedTags =
    focusTags && focusTags.length > 0 ? focusTags.slice(0, 1) : ["array"];

  if (!onboarding) {
    // 🧠 Time gap since last session
    let gapInDays = 999;
    const lastAttempt = await AttemptsService.getMostRecentAttempt();
    if (lastAttempt?.AttemptDate) {
      const lastTime = new Date(lastAttempt.AttemptDate);
      gapInDays = (now - lastTime) / (1000 * 60 * 60 * 24);
    }

    sessionLength = computeSessionLength(accuracy, efficiencyScore);

    if (gapInDays > 4 || accuracy < 0.5) {
      sessionLength = Math.min(sessionLength, 5);
    }

    // Scale new problems
    if (accuracy >= 0.85) {
      numberOfNewProblems = Math.min(5, Math.floor(sessionLength / 2));
    } else if (accuracy < 0.6) {
      numberOfNewProblems = 1;
    } else {
      numberOfNewProblems = Math.floor(sessionLength * 0.3);
    }

    // 🏷️ Progressive tag exposure within focus window
    const tagCount = calculateTagIndexProgression(
      accuracy,
      efficiencyScore,
      sessionState.tagIndex,
      focusTags.length,
      sessionState
    );
    allowedTags =
      focusTags && focusTags.length > 0
        ? focusTags.slice(0, tagCount)
        : ["array", "hash table"];

    // Update tagIndex for next session
    sessionState.tagIndex = tagCount - 1; // Convert from count to index

    console.log(
      `🏷️ Tag exposure: ${tagCount}/${focusTags.length} focus tags (tagIndex: ${
        sessionState.tagIndex
      }, accuracy: ${(accuracy * 100).toFixed(1)}%)`
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
        console.log(
          "🔓 Session-based escape hatch ACTIVATED: Lowering difficulty promotion threshold from 90% to 80%"
        );
      }
    }

    // Progressive difficulty cap unlocking with escape hatch threshold
    if (
      accuracy >= promotionThreshold &&
      sessionState.currentDifficultyCap === "Easy"
    ) {
      sessionState.currentDifficultyCap = "Medium";
      escapeHatches.lastDifficultyPromotion = now.toISOString();
      escapeHatches.sessionsAtCurrentDifficulty = 0; // Reset counter
      escapeHatches.activatedEscapeHatches = []; // Reset escape hatches for new difficulty

      if (escapeHatchActivated) {
        console.log(
          "🎯 Difficulty cap upgraded via ESCAPE HATCH: Easy → Medium (80% threshold)"
        );
      } else {
        console.log("🎯 Difficulty cap upgraded: Easy → Medium");
      }
    } else if (
      accuracy >= promotionThreshold &&
      sessionState.currentDifficultyCap === "Medium"
    ) {
      sessionState.currentDifficultyCap = "Hard";
      escapeHatches.lastDifficultyPromotion = now.toISOString();
      escapeHatches.sessionsAtCurrentDifficulty = 0; // Reset counter
      escapeHatches.activatedEscapeHatches = []; // Reset escape hatches for new difficulty

      if (escapeHatchActivated) {
        console.log(
          "🎯 Difficulty cap upgraded via ESCAPE HATCH: Medium → Hard (80% threshold)"
        );
      } else {
        console.log("🎯 Difficulty cap upgraded: Medium → Hard");
      }
    }

    // Track sessions without promotion for debugging
    if (sessionState.currentDifficultyCap === currentDifficulty) {
      escapeHatches.sessionsWithoutPromotion++;
    } else {
      escapeHatches.sessionsWithoutPromotion = 0;
    }
  }

  sessionState.lastSessionDate = now.toISOString();
  await StorageService.setSessionState(sessionStateKey, sessionState);

  console.log("🧠 Adaptive Session Config:", {
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

export async function getSessionPerformance({
  recentSessionsLimit = 5,
  daysBack = null,
  unmasteredTags = [],
} = {}) {
  console.log("🔍 getSessionPerformance", unmasteredTags);
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
  console.log("🔍 sessions", sessions);
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
  console.log("unmasteredTagSet", unmasteredTagSet);
  for (let tag in tagStats) {
    if (!unmasteredTagSet.has(tag)) continue;

    const { attempts, correct } = tagStats[tag];
    const acc = correct / attempts;

    // Optional: Debug line
    console.log(
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
function calculateTagIndexProgression(
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
    console.log(
      `🏷️ Tag expansion: +2 tags (${
        canExpandQuickly ? "excellent performance" : "stagnation fallback"
      })`
    );
  } else if (canExpandToNext && tagCount < focusTagsLength) {
    tagCount = Math.min(tagCount + 1, focusTagsLength); // Add 1 tag if good performance
    console.log(
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

  console.log(
    `🏷️ Tag progression: index=${currentTagIndex} → count=${finalCount}/${focusTagsLength} (accuracy: ${(
      accuracy * 100
    ).toFixed(1)}%, efficiency: ${(efficiencyScore * 100).toFixed(1)}%)`
  );

  return finalCount;
}
