/**
 * Session Escape Hatch Logic
 * Extracted from sessions.js - difficulty progression and demotion logic
 */

import { getRecentSessionAnalytics } from "./sessionAnalytics.js";
import logger from "../utils/logger.js";

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
  escapeHatches.activated_escape_hatches = [];

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
 * Analyzes performance trend from recent analytics
 */
export function analyzePerformanceTrend(recentAnalytics) {
  if (!recentAnalytics || recentAnalytics.length < 2) {
    return 'stable';
  }

  const accuracies = recentAnalytics
    .map(session => session.accuracy || 0)
    .slice(-3);

  if (accuracies.length < 2) {
    return 'stable';
  }

  let improvingCount = 0;
  let decliningCount = 0;

  for (let i = 1; i < accuracies.length; i++) {
    const diff = accuracies[i] - accuracies[i - 1];
    if (diff > 0.05) {
      improvingCount++;
    } else if (diff < -0.05) {
      decliningCount++;
    }
  }

  if (improvingCount >= 2) {
    return 'improving';
  } else if (decliningCount >= 2) {
    return 'declining';
  }

  return 'stable';
}
