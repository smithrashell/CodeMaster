/**
 * Session Escape Hatch Helpers
 * Extracted from sessions.js for better organization
 * Contains functions for difficulty progression and escape hatch logic
 */

import { getRecentSessionAnalytics } from "./sessionAnalytics.js";
import logger from "../../utils/logging/logger.js";

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
  console.log('applyEscapeHatchLogic ENTRY (problem-based):', {
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
      current_promotion_type: null,  // 'standard_volume_gate' | 'stagnation_escape_hatch' | null
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
    logger.info(`Standard promotion criteria met: ${problemsAtDifficulty} problems at ${(accuracy * 100).toFixed(1)}% accuracy`);
  } else if (stagnationEscape) {
    promotionReason = "stagnation_escape_hatch";
    logger.info(`Stagnation escape hatch ACTIVATED: ${problemsAtDifficulty} problems completed (accuracy: ${(accuracy * 100).toFixed(1)}%)`);

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
  escapeHatches.current_promotion_type = promotionReason;  // Store promotion type for session composition safety
  escapeHatches.activated_escape_hatches = [];  // Clear activation history

  if (promotionReason === "stagnation_escape_hatch") {
    logger.info(`Difficulty cap upgraded via STAGNATION ESCAPE: ${oldDifficulty} → ${newDifficulty} (${problemsAtDifficulty} problems)`);
  } else {
    logger.info(`Difficulty cap upgraded: ${oldDifficulty} → ${newDifficulty} (${problemsAtDifficulty} problems at ${(accuracy * 100).toFixed(1)}%)`);
  }
}

function updatePromotionTracking(sessionState, escapeHatches, currentDifficulty, shouldPromote, problemsAtDifficulty) {
  if (!shouldPromote && problemsAtDifficulty > 0) {
    const remaining = Math.max(0, 4 - problemsAtDifficulty);
    logger.info(`Progress toward promotion: ${problemsAtDifficulty}/4 problems at ${currentDifficulty} (${remaining} more needed)`);
  }

  if (sessionState.current_difficulty_cap === currentDifficulty) {
    escapeHatches.sessions_without_promotion++;
  } else {
    escapeHatches.sessions_without_promotion = 0;
  }
}

function logEscapeHatchExit(currentDifficulty, sessionState, promoted, promotionReason) {
  console.log('applyEscapeHatchLogic EXIT:', {
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
export async function checkForDemotion(sessionState) {
  const currentCap = sessionState.current_difficulty_cap || "Easy";

  if (currentCap === "Easy") {
    return sessionState;
  }

  try {
    const recentSessions = await getRecentSessionAnalytics(3);

    if (recentSessions.length < 3) {
      logger.info(`Demotion check: Not enough history (${recentSessions.length}/3)`);
      return sessionState;
    }

    const lowAccuracyCount = recentSessions.filter(s => (s.accuracy || 0) < 0.5).length;

    if (lowAccuracyCount >= 3) {
      const targetDifficulty = currentCap === "Hard" ? "Medium" : "Easy";
      const oldDifficulty = currentCap;

      sessionState.current_difficulty_cap = targetDifficulty;

      if (sessionState.escape_hatches) {
        sessionState.escape_hatches.sessions_at_current_difficulty = 0;
      }

      logger.info(`Difficulty Demotion: ${oldDifficulty} → ${targetDifficulty}`);
      logger.info(`   Recent accuracies: ${recentSessions.map(s => `${((s.accuracy || 0) * 100).toFixed(0)}%`).join(', ')}`);
    } else {
      logger.info(`Demotion check passed: ${lowAccuracyCount}/3 low-accuracy sessions`);
    }

    return sessionState;
  } catch (error) {
    logger.error("Error in demotion check:", error);
    return sessionState;
  }
}

/**
 * Helper to analyze performance trend from recent sessions
 */
export function analyzePerformanceTrend(recentAnalytics) {
  const accuracies = recentAnalytics.map(session => session.accuracy || 0.5);
  const avgRecent = accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length;

  let consecutiveExcellent = 0;
  for (const session of recentAnalytics) {
    if ((session.accuracy || 0) >= 0.9) {
      consecutiveExcellent++;
    } else {
      break;
    }
  }

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
