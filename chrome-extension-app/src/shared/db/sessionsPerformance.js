/**
 * Session Performance Functions
 * Extracted from sessions.js - performance metrics and analysis
 */

import { dbHelper } from "./index.js";
import { getAttemptsBySessionId } from "./attempts.js";
import { StorageService } from "../services/storageService.js";
import { applyEscapeHatchLogic, checkForDemotion } from "./sessionsEscapeHatch.js";
import logger from "../utils/logger.js";

const openDB = () => dbHelper.openDB();

/**
 * Filter sessions by time or recent count
 */
export function filterSessions(allSessions, daysBack, recentSessionsLimit) {
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

/**
 * Process attempts and calculate statistics
 */
export async function processAttempts(sessions) {
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
    const attempts = await getAttemptsBySessionId(session.id);
    const problems = session.problems || [];

    if (attempts.length === 0) {
      console.log(`Skipping session ${session.id} - no attempts recorded yet`);
      continue;
    }

    const problemMap = new Map(problems.map((p) => [p.id, p]));

    for (let attempt of attempts) {
      const leetcodeId = attempt.leetcode_id;

      let problem = problemMap.get(leetcodeId) ||
                   problemMap.get(String(leetcodeId)) ||
                   problemMap.get(Number(leetcodeId));

      if (!problem) {
        const sessionProblem = problems.find(p => String(p.id) === String(leetcodeId));
        if (!sessionProblem) {
          throw new Error(`Attempt ${attempt.id} references leetcode_id ${leetcodeId} but no matching problem found in session ${session.id}`);
        }
        problem = sessionProblem;
      }

      if (!problem.difficulty) {
        throw new Error(`Problem ${leetcodeId} in attempt ${attempt.id} is missing difficulty field - data integrity issue`);
      }
      const rating = problem.difficulty.toLowerCase();

      const tags = problem.tags || [];
      const timeSpent = attempt.time_spent || 0;
      const success = attempt.success;

      if (typeof success !== 'boolean') {
        throw new Error(`Invalid success value in attempt ${attempt.id}: expected boolean, got ${typeof success} (${success})`);
      }

      if (typeof timeSpent !== 'number' || timeSpent < 0) {
        throw new Error(`Invalid time_spent value in attempt ${attempt.id}: expected non-negative number, got ${typeof timeSpent} (${timeSpent})`);
      }

      performance[rating].attempts += 1;
      performance[rating].time += timeSpent;
      if (success) performance[rating].correct += 1;

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

/**
 * Calculate strong and weak tags
 */
export function calculateTagStrengths(tagStats, unmasteredTagSet) {
  const strongTags = [];
  const weakTags = [];

  for (let tag in tagStats) {
    const { attempts, correct } = tagStats[tag];

    if (attempts === 0) {
      logger.warn(`Tag ${tag} has zero attempts - skipping accuracy calculation`);
      continue;
    }

    const acc = correct / attempts;

    logger.info(
      `Evaluating ${tag} — acc: ${acc.toFixed(
        2
      )},correct: ${correct}, attempts: ${attempts}, mastered: ${!unmasteredTagSet.has(tag)}`
    );

    if (acc >= 0.8 && attempts >= 1) {
      strongTags.push(tag);
    } else if (acc < 0.7 && attempts >= 1) {
      weakTags.push(tag);
    }
  }

  return { strongTags, weakTags };
}

/**
 * Calculate timing feedback
 */
export function calculateTimingFeedback(performance) {
  const expected = {
    Easy: [600, 900],
    Medium: [1200, 1500],
    Hard: [1800, 2100],
  };

  const timingFeedback = {};
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

/**
 * Get session performance metrics
 */
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

  console.log(`PERFORMANCE DEBUG: Step 1 - Getting recent completed standard sessions using combined index...`);
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

  console.log(`PERFORMANCE DEBUG: Final sessions for analysis:`, {
    sessionsCount: sessions.length,
    sessionsWithAttempts: sessions.filter(s => s.attempts?.length > 0).length,
    totalAttemptsAcrossSessions: sessions.reduce((sum, s) => sum + (s.attempts?.length || 0), 0),
    sessionIds: sessions.map(s => s.id),
    sessionTypes: [...new Set(sessions.map(s => s.session_type))],
    sessionStatuses: [...new Set(sessions.map(s => s.status))]
  });

  logger.info("sessions", sessions);

  console.log(`PERFORMANCE DEBUG: Step 3 - Processing attempts...`);
  const { performance, tagStats, totalAttempts, totalCorrect, totalTime } = await processAttempts(sessions);

  console.log(`PERFORMANCE DEBUG: Processed attempts result:`, {
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

  logger.info("unmasteredTagSet", unmasteredTagSet);
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

/**
 * Get all sessions
 */
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
