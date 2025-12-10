/**
 * Session Analytics Helpers
 * Extracted from sessionService.js - session analytics, insights, and state updates
 */

import { evaluateDifficultyProgression } from "../../db/stores/sessions.js";
import { StorageService } from "../storage/storageService.js";
import { roundToPrecision } from "../../utils/leitner/Utils.js";
import logger from "../../utils/logging/logger.js";

/**
 * Calculates mastery deltas between pre and post session state.
 * @param {Map} preSessionMap - Tag mastery before session
 * @param {Map} postSessionMap - Tag mastery after session
 * @returns {Array} Array of mastery delta objects
 */
export function calculateMasteryDeltas(preSessionMap, postSessionMap) {
  const deltas = [];

  const allTags = new Set([
    ...preSessionMap.keys(),
    ...postSessionMap.keys(),
  ]);

  for (const tag of allTags) {
    const preData = preSessionMap.get(tag);
    const postData = postSessionMap.get(tag);

    if (!preData && postData) {
      deltas.push({
        tag,
        type: "new",
        preMastered: false,
        postMastered: postData.mastered || false,
        masteredChanged: postData.mastered || false,
        strengthDelta: postData.totalAttempts || 0,
        decayDelta: (postData.decayScore || 1) - 1,
      });
    } else if (preData && postData) {
      const masteredChanged =
        (preData.mastered || false) !== (postData.mastered || false);
      deltas.push({
        tag,
        type: "updated",
        preMastered: preData.mastered || false,
        postMastered: postData.mastered || false,
        masteredChanged,
        strengthDelta:
          (postData.totalAttempts || 0) - (preData.totalAttempts || 0),
        decayDelta: (postData.decayScore || 1) - (preData.decayScore || 1),
      });
    }
  }

  return deltas.filter((d) => d.strengthDelta > 0 || d.masteredChanged);
}

/**
 * Analyzes the difficulty distribution of problems in the session.
 * @param {Object} session - The session object
 * @returns {Object} Difficulty analysis with counts and percentages
 */
export function analyzeSessionDifficulty(session) {
  const difficultyCount = { Easy: 0, Medium: 0, Hard: 0 };
  const totalProblems = session.problems.length;

  console.log(`🔍 DIFFICULTY ANALYSIS: Starting analysis for ${totalProblems} problems`);

  for (const problem of session.problems) {
    const difficulty = problem.difficulty || "Medium";

    console.log(`🔍 DIFFICULTY ANALYSIS: Problem ${problem.title} - difficulty: ${difficulty}`);

    if (Object.prototype.hasOwnProperty.call(difficultyCount, difficulty)) {
      difficultyCount[difficulty]++;
    } else {
      console.warn(`⚠️ DIFFICULTY ANALYSIS: Unknown difficulty '${difficulty}' for problem ${problem.title}`);
      difficultyCount.Medium++;
    }
  }

  const result = {
    counts: difficultyCount,
    percentages: {
      Easy:
        totalProblems > 0 ? (difficultyCount.Easy / totalProblems) * 100 : 0,
      Medium:
        totalProblems > 0
          ? (difficultyCount.Medium / totalProblems) * 100
          : 0,
      Hard:
        totalProblems > 0 ? (difficultyCount.Hard / totalProblems) * 100 : 0,
    },
    totalProblems,
    predominantDifficulty: Object.entries(difficultyCount).reduce((a, b) =>
      difficultyCount[a[0]] > difficultyCount[b[0]] ? a : b
    )[0],
  };

  console.log(`✅ DIFFICULTY ANALYSIS: Final result:`, result);
  return result;
}

/**
 * Helper methods for generating insights
 */
export function getAccuracyInsight(accuracy) {
  if (accuracy >= 0.9)
    return "Excellent accuracy! Ready for harder challenges.";
  if (accuracy >= 0.7)
    return "Good accuracy. Keep practicing to reach mastery.";
  if (accuracy >= 0.5)
    return "Accuracy needs improvement. Focus on fundamentals.";
  return "Consider reviewing concepts before attempting new problems.";
}

export function getEfficiencyInsight(avgTime, difficultyMix) {
  const expectedTimes = { Easy: 750, Medium: 1350, Hard: 1950 };
  const expected = expectedTimes[difficultyMix.predominantDifficulty] || 1350;

  if (avgTime < expected * 0.8)
    return "Very efficient solving! Good time management.";
  if (avgTime < expected * 1.2)
    return "Good pacing. Well within expected time ranges.";
  if (avgTime < expected * 1.5)
    return "Taking a bit longer than expected. Practice for speed.";
  return "Focus on time management and pattern recognition for efficiency.";
}

export function getMasteryInsight(masteryDeltas) {
  const newMasteries = masteryDeltas.filter(
    (d) => d.masteredChanged && d.postMastered
  ).length;
  const decayed = masteryDeltas.filter(
    (d) => d.masteredChanged && !d.postMastered
  ).length;

  if (newMasteries > 0 && decayed === 0)
    return `Excellent! Mastered ${newMasteries} new tag(s).`;
  if (newMasteries > decayed)
    return `Net positive progress: +${newMasteries - decayed} tag masteries.`;
  if (decayed > 0)
    return `Some tags need review. ${decayed} mastery level(s) decreased.`;
  return "Maintained current mastery levels. Consistent performance.";
}

/**
 * Generates actionable insights based on session performance.
 * @param {Object} performance - Session performance metrics
 * @param {Array} masteryDeltas - Mastery progression deltas
 * @param {Object} difficultyMix - Session difficulty analysis
 * @returns {Object} Structured insights for user feedback
 */
export function generateSessionInsights(performance, masteryDeltas, difficultyMix) {
  const insights = {
    accuracy: getAccuracyInsight(performance.accuracy),
    efficiency: getEfficiencyInsight(performance.avgTime, difficultyMix),
    mastery: getMasteryInsight(masteryDeltas),
    nextActions: [],
  };

  if (performance.accuracy < 0.6) {
    insights.nextActions.push(
      "Focus on review problems to solidify fundamentals"
    );
  }

  if (performance.weakTags.length > 3) {
    insights.nextActions.push(
      `Prioritize improvement in: ${performance.weakTags
        .slice(0, 3)
        .join(", ")}`
    );
  }

  if (
    masteryDeltas.filter((d) => d.masteredChanged && d.postMastered).length >
    0
  ) {
    insights.nextActions.push(
      "Great progress! Consider exploring more advanced patterns"
    );
  }

  return insights;
}

/**
 * Logs structured session analytics for dashboard integration.
 * @param {Object} sessionSummary - Complete session summary
 */
export function logSessionAnalytics(sessionSummary) {
  const performance = sessionSummary.performance || {};
  const difficultyAnalysis = sessionSummary.difficultyAnalysis || {};
  const masteryProgression = sessionSummary.masteryProgression || {};

  const analyticsEvent = {
    timestamp: sessionSummary.completedAt || new Date().toISOString(),
    type: "session_completed",
    sessionId: sessionSummary.sessionId || sessionSummary.session_id || "unknown",
    metrics: {
      accuracy: roundToPrecision(performance.accuracy || 0),
      avgTime: Math.round(performance.avgTime || 0),
      problemsCompleted: difficultyAnalysis.totalProblems || 0,
      newMasteries: masteryProgression.newMasteries || 0,
      predominantDifficulty: difficultyAnalysis.predominantDifficulty || "Unknown",
    },
    tags: {
      strong: performance.strongTags || [],
      weak: performance.weakTags || [],
    },
  };

  logger.info(
    "📊 Session Analytics:",
    JSON.stringify(analyticsEvent, null, 2)
  );

  if (typeof chrome !== "undefined" && chrome.storage) {
    chrome.storage.local.get(["sessionAnalytics"], (result) => {
      const analytics = result.sessionAnalytics || [];
      analytics.push(analyticsEvent);

      const recentAnalytics = analytics.slice(-50);

      chrome.storage.local.set({ sessionAnalytics: recentAnalytics });
    });
  }
}

/**
 * Update difficulty time stats from session summary
 */
export function updateDifficultyTimeStats(sessionState, sessionSummary) {
  console.log(`🔍 DEBUG: Updating difficulty time stats from session summary...`);
  const difficultyData = sessionSummary.difficulty_breakdown || sessionSummary.performance;

  if (difficultyData) {
    const difficultyMappings = [
      { perfKey: 'easy', stateKey: 'easy' },
      { perfKey: 'medium', stateKey: 'medium' },
      { perfKey: 'hard', stateKey: 'hard' }
    ];

    for (const { perfKey, stateKey } of difficultyMappings) {
      const perfStats = difficultyData[perfKey];
      if (perfStats && perfStats.attempts > 0) {
        console.log(`🔍 DEBUG: Processing ${perfKey} difficulty - attempts: ${perfStats.attempts}, time: ${perfStats.time}`);

        sessionState.difficulty_time_stats[stateKey].problems += perfStats.attempts;
        sessionState.difficulty_time_stats[stateKey].total_time += perfStats.time;
        sessionState.difficulty_time_stats[stateKey].avg_time =
          sessionState.difficulty_time_stats[stateKey].total_time /
          sessionState.difficulty_time_stats[stateKey].problems;

        console.log(`🔍 DEBUG: Updated ${stateKey} stats:`, sessionState.difficulty_time_stats[stateKey]);
      }
    }
  }
}

/**
 * Evaluate and update difficulty progression after session
 */
export async function evaluateDifficultyProgressionAfterSession(sessionSummary) {
  console.log(`🔍 DEBUG: Evaluating difficulty progression after session completion...`);
  try {
    const settings = await StorageService.getSettings();
    const accuracy = sessionSummary.performance?.accuracy || 0;

    if (typeof accuracy !== 'number' || isNaN(accuracy) || accuracy < 0 || accuracy > 1) {
      console.warn(`⚠️ Invalid accuracy value: ${accuracy}, skipping difficulty progression`);
      logger.warn(`⚠️ Invalid accuracy value for difficulty progression: ${accuracy}`);
      return;
    }

    console.log(`🔍 DEBUG: Calling evaluateDifficultyProgression with accuracy: ${(accuracy * 100).toFixed(1)}%`);
    const updatedSessionState = await evaluateDifficultyProgression(accuracy, settings);
    console.log(`✅ DEBUG: Difficulty progression evaluated. Current cap: ${updatedSessionState.current_difficulty_cap}`);
  } catch (difficultyError) {
    console.error(`❌ DEBUG: Difficulty progression evaluation failed (non-critical):`, difficultyError);
    logger.error("❌ Failed to evaluate difficulty progression (session completion continues):", {
      error: difficultyError.message,
      stack: difficultyError.stack,
      sessionId: sessionSummary.session_id
    });
  }
}

/**
 * Update session state with performance data from completed session
 */
export async function updateSessionStateWithPerformance(session, sessionSummary) {
  try {
    console.log(`🔍 REAL SESSION DEBUG: updateSessionStateWithPerformance ENTRY for ACTUAL session ${session.id}`);
    console.log(`🔍 REAL SESSION DEBUG: Session ID is UUID? ${session.id.length === 36 && session.id.includes('-')}`);
    logger.info(`📊 Updating session state with performance data for session ${session.id}`);

    console.log(`🔍 DEBUG: Getting current session state...`);
    const sessionState = await StorageService.getSessionState("session_state") || {
      id: "session_state",
      num_sessions_completed: 0,
      difficulty_time_stats: {
        easy: { problems: 0, total_time: 0, avg_time: 0 },
        medium: { problems: 0, total_time: 0, avg_time: 0 },
        hard: { problems: 0, total_time: 0, avg_time: 0 },
      },
      last_performance: {
        accuracy: null,
        efficiency_score: null,
      }
    };

    if (!sessionState.difficulty_time_stats) {
      sessionState.difficulty_time_stats = {
        easy: { problems: 0, total_time: 0, avg_time: 0 },
        medium: { problems: 0, total_time: 0, avg_time: 0 },
        hard: { problems: 0, total_time: 0, avg_time: 0 },
      };
    }

    console.log(`🔍 DEBUG: Current session state before performance updates:`, {
      id: sessionState.id,
      num_sessions_completed: sessionState.num_sessions_completed,
      difficulty_time_stats: sessionState.difficulty_time_stats,
      last_performance: sessionState.last_performance,
      last_session_date: sessionState.last_session_date
    });

    updateDifficultyTimeStats(sessionState, sessionSummary);

    console.log(`🔍 DEBUG: Updating last performance from session summary...`);
    if (sessionSummary.performance) {
      const newAccuracy = roundToPrecision(sessionSummary.performance.accuracy || 0);
      const newEfficiency = roundToPrecision(sessionSummary.performance.avgTime ?
        Math.max(0, 1 - (sessionSummary.performance.avgTime / 1800000)) : 0);

      console.log(`🔍 DEBUG: New performance values - accuracy: ${newAccuracy}, efficiency: ${newEfficiency}`);

      sessionState.last_performance = {
        accuracy: newAccuracy,
        efficiency_score: newEfficiency
      };
    }

    sessionState.last_session_date = new Date().toISOString();
    console.log(`🔍 DEBUG: Set last_session_date to: ${sessionState.last_session_date}`);

    console.log(`🔍 DEBUG: Final session state before saving:`, {
      id: sessionState.id,
      num_sessions_completed: sessionState.num_sessions_completed,
      difficulty_time_stats: sessionState.difficulty_time_stats,
      last_performance: sessionState.last_performance,
      last_session_date: sessionState.last_session_date
    });

    console.log(`🔍 DEBUG: Calling StorageService.setSessionState...`);
    const saveResult = await StorageService.setSessionState("session_state", sessionState);
    console.log(`🔍 DEBUG: StorageService.setSessionState result:`, saveResult);

    console.log(`🔍 DEBUG: Verifying save by reading back from database...`);
    const verificationState = await StorageService.getSessionState("session_state");
    console.log(`🔍 DEBUG: Verification read result:`, {
      id: verificationState?.id,
      num_sessions_completed: verificationState?.num_sessions_completed,
      difficulty_time_stats: verificationState?.difficulty_time_stats,
      last_performance: verificationState?.last_performance,
      last_session_date: verificationState?.last_session_date
    });

    if (!verificationState || verificationState.last_session_date !== sessionState.last_session_date) {
      console.error(`❌ DEBUG: Session state verification FAILED! Data not persisted correctly`);
      logger.error(`❌ Session state update verification failed - data not persisted`);
    } else {
      console.log(`✅ DEBUG: Session state verification PASSED! Data persisted correctly`);
    }

    logger.info(`✅ Session state updated with performance data:`, {
      difficulty_problems: sessionState.difficulty_time_stats ?
        Object.entries(sessionState.difficulty_time_stats).map(([diff, stats]) =>
          `${diff}: ${stats.problems} problems`).join(', ') : 'no difficulty stats available',
      last_accuracy: sessionState.last_performance?.accuracy,
      last_efficiency: sessionState.last_performance?.efficiency_score
    });

    await evaluateDifficultyProgressionAfterSession(sessionSummary);

  } catch (error) {
    console.error(`❌ DEBUG: updateSessionStateWithPerformance ERROR:`, error);
    logger.error("❌ Failed to update session state with performance:", error);
  }
}
