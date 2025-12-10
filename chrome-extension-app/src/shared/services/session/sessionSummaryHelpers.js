/**
 * Session Summary Helpers
 * Extracted from sessionService.js - session summary generation utilities
 */

import { getSessionPerformance } from "../../db/stores/sessions.js";
import { updateProblemRelationships } from "../../db/stores/problem_relationships.js";
import { getTagMastery } from "../../db/stores/tag_mastery.js";
import { storeSessionAnalytics, debugGetAllSessionAnalytics } from "../../db/stores/sessionAnalytics.js";
import logger from "../../utils/logging/logger.js";

/**
 * Create empty session summary for sessions without attempts
 */
export function createEmptySessionSummary(sessionId) {
  return {
    session_id: sessionId,
    completed_at: new Date().toISOString(),
    performance: {
      accuracy: 0,
      avgTime: 0,
      strongTags: [],
      weakTags: [],
      timingFeedback: {},
      easy: { attempts: 0, correct: 0, time: 0, avgTime: 0 },
      medium: { attempts: 0, correct: 0, time: 0, avgTime: 0 },
      hard: { attempts: 0, correct: 0, time: 0, avgTime: 0 },
    },
    mastery_progression: {
      deltas: [],
      new_masteries: 0,
      decayed_masteries: 0,
    },
    difficulty_analysis: { predominantDifficulty: 'Unknown', totalProblems: 0 },
    insights: { message: 'No attempts recorded in this session' }
  };
}

/**
 * Create session summary for ad-hoc sessions
 */
export function createAdHocSessionSummary(session) {
  const totalAttempts = session.attempts.length;
  const successfulAttempts = session.attempts.filter(a => a.success).length;
  const accuracy = totalAttempts > 0 ? successfulAttempts / totalAttempts : 0;
  const avgTime = totalAttempts > 0 ?
    session.attempts.reduce((sum, a) => sum + (a.time_spent || 0), 0) / totalAttempts : 0;

  return {
    session_id: session.id,
    completed_at: new Date().toISOString(),
    performance: {
      accuracy: Math.round(accuracy * 100) / 100,
      avgTime: Math.round(avgTime),
      strongTags: [],
      weakTags: [],
      timingFeedback: {},
      easy: { attempts: 0, correct: 0, time: 0, avgTime: 0 },
      medium: { attempts: 0, correct: 0, time: 0, avgTime: 0 },
      hard: { attempts: 0, correct: 0, time: 0, avgTime: 0 },
    },
    mastery_progression: {
      deltas: [],
      new_masteries: 0,
      decayed_masteries: 0,
    },
    difficulty_analysis: {
      predominantDifficulty: 'Mixed',
      totalProblems: totalAttempts,
      percentages: {},
    },
    insights: {
      sessionType: 'ad_hoc',
      message: `Completed ${totalAttempts} ad-hoc problem${totalAttempts !== 1 ? 's' : ''} with ${Math.round(accuracy * 100)}% accuracy`
    },
  };
}

/**
 * Get pre-session mastery data for delta calculation
 */
export async function getMasteryDeltas() {
  console.log(`🔍 DEBUG: Step 1 - Getting pre-session tag mastery...`);
  const preSessionTagMastery = await getTagMastery();
  const preSessionMasteryMap = new Map(
    (preSessionTagMastery || []).map((tm) => [tm.tag, tm])
  );
  return { preSessionMasteryMap };
}

/**
 * Update problem relationships and get post-session mastery
 */
export async function updateRelationshipsAndGetPostMastery(session) {
  logger.info("🔗 Updating problem relationships...");
  await updateProblemRelationships(session);

  const postSessionTagMastery = await getTagMastery();
  const postSessionMasteryMap = new Map(
    (postSessionTagMastery || []).map((tm) => [tm.tag, tm])
  );

  return { postSessionTagMastery, postSessionMasteryMap };
}

/**
 * Get performance metrics for a session
 */
export async function getPerformanceMetrics(session, postSessionTagMastery) {
  logger.info("📈 Generating session performance metrics...");
  const unmasteredTags = (postSessionTagMastery || [])
    .filter((tm) => !tm.mastered)
    .map((tm) => tm.tag);

  let performanceMetrics;
  try {
    console.log(`🔍 DEBUG: Calling getSessionPerformance for session ${session.id}...`);
    performanceMetrics = await getSessionPerformance({
      recentSessionsLimit: 1,
      unmasteredTags
    });
    console.log(`✅ DEBUG: getSessionPerformance completed successfully`);
  } catch (performanceError) {
    console.error(`❌ DEBUG: getSessionPerformance failed:`, performanceError);
    logger.warn(`⚠️ Session performance calculation failed, using fallback:`, performanceError);
    performanceMetrics = null;
  }

  performanceMetrics = performanceMetrics || {
    accuracy: 0,
    avgTime: 0,
    strongTags: [],
    weakTags: [],
    timingFeedback: {},
    easy: { attempts: 0, correct: 0, time: 0, avgTime: 0 },
    medium: { attempts: 0, correct: 0, time: 0, avgTime: 0 },
    hard: { attempts: 0, correct: 0, time: 0, avgTime: 0 },
  };

  console.log(`🔍 DEBUG: Performance metrics retrieved:`, {
    accuracy: performanceMetrics.accuracy,
    avgTime: performanceMetrics.avgTime,
    hasStrongTags: !!performanceMetrics.strongTags?.length,
    hasWeakTags: !!performanceMetrics.weakTags?.length,
    easyAttempts: performanceMetrics.easy?.attempts || 0,
    mediumAttempts: performanceMetrics.medium?.attempts || 0,
    hardAttempts: performanceMetrics.hard?.attempts || 0
  });

  return performanceMetrics;
}

/**
 * Store session summary to analytics
 */
export async function storeSessionSummary(session, sessionSummary) {
  console.log(`🔍 REAL SESSION DEBUG: About to call storeSessionAnalytics for ACTUAL session ${session.id}`);
  console.log(`🔍 REAL SESSION DEBUG: SessionSummary structure:`, {
    session_id: sessionSummary.session_id,
    completed_at: sessionSummary.completed_at,
    performance: {
      accuracy: sessionSummary.performance?.accuracy,
      avgTime: sessionSummary.performance?.avgTime,
      hasEasy: !!sessionSummary.performance?.Easy,
      hasMedium: !!sessionSummary.performance?.Medium,
      hasHard: !!sessionSummary.performance?.Hard
    },
    mastery_progression: {
      new_masteries: sessionSummary.mastery_progression?.new_masteries,
      decayed_masteries: sessionSummary.mastery_progression?.decayed_masteries,
      deltasCount: sessionSummary.mastery_progression?.deltas?.length || 0
    },
    difficulty_analysis: {
      predominantDifficulty: sessionSummary.difficulty_analysis?.predominantDifficulty,
      totalProblems: sessionSummary.difficulty_analysis?.totalProblems
    }
  });

  try {
    await storeSessionAnalytics(sessionSummary);
    console.log(`✅ REAL SESSION DEBUG: storeSessionAnalytics completed successfully for ACTUAL session ${session.id}`);
    await debugGetAllSessionAnalytics();
    console.log(`🔍 REAL SESSION DEBUG: debugGetAllSessionAnalytics completed, continuing to next step...`);
  } catch (analyticsError) {
    logger.error(`❌ Failed to store session analytics for session ${session.id}:`, analyticsError);
    logger.error(`❌ SessionSummary data:`, {
      session_id: sessionSummary?.session_id,
      completed_at: sessionSummary?.completed_at,
      hasPerformance: !!sessionSummary?.performance,
      performanceKeys: sessionSummary?.performance ? Object.keys(sessionSummary.performance) : [],
      hasDifficulty: !!sessionSummary?.difficulty_analysis,
      hasMastery: !!sessionSummary?.mastery_progression
    });
  }
}
