/**
 * Helper functions for learning efficiency calculations
 * Extracted from dashboardService.js to reduce file complexity
 */

import { getInteractionsBySession } from "../../../shared/db/stores/hint_interactions.js";
import logger from "../../../shared/utils/logging/logger.js";

/**
 * Generate learning efficiency chart data for different time periods
 */
export async function generateLearningEfficiencyChartData(sessions, attempts) {
  console.log('🔍 generateLearningEfficiencyChartData called:', {
    sessionsCount: sessions?.length || 0,
    attemptsCount: attempts?.length || 0,
    hasSessions: !!sessions,
    hasAttempts: !!attempts,
    sampleSession: sessions?.[0] ? {
      date: sessions[0].date,
      createdAt: sessions[0].createdAt,
      dateType: typeof sessions[0].date,
      createdAtType: typeof sessions[0].createdAt
    } : null
  });

  const now = new Date();
  const weekly = [];
  const monthly = [];
  const yearly = [];

  for (let i = 11; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - (i * 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const weekSessions = sessions.filter(session => {
      const sessionDate = new Date(session.date);
      return sessionDate >= weekStart && sessionDate <= weekEnd;
    });

    console.log(`🔍 Week ${12 - i}: Found ${weekSessions.length} sessions, calling calculatePeriodEfficiency`);
    const efficiency = await calculatePeriodEfficiency(weekSessions, attempts);
    console.log(`🔍 Week ${12 - i}: Efficiency = ${efficiency}`);
    weekly.push({
      name: `Week ${12 - i}`,
      efficiency: Math.round(efficiency * 10) / 10
    });
  }

  for (let i = 11; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

    const monthSessions = sessions.filter(session => {
      const sessionDate = new Date(session.date);
      return sessionDate >= monthStart && sessionDate <= monthEnd;
    });

    const efficiency = await calculatePeriodEfficiency(monthSessions, attempts);
    const monthName = monthStart.toLocaleDateString('en-US', { month: 'short' });
    monthly.push({
      name: monthName,
      efficiency: Math.round(efficiency * 10) / 10
    });
  }

  for (let i = 2; i >= 0; i--) {
    const year = now.getFullYear() - i;
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);

    const yearSessions = sessions.filter(session => {
      const sessionDate = new Date(session.date);
      return sessionDate >= yearStart && sessionDate <= yearEnd;
    });

    const efficiency = await calculatePeriodEfficiency(yearSessions, attempts);
    yearly.push({
      name: year.toString(),
      efficiency: Math.round(efficiency * 10) / 10
    });
  }

  return { weekly, monthly, yearly };
}

/**
 * Calculate learning efficiency for a period
 */
export async function calculatePeriodEfficiency(sessions, allAttempts) {
  if (sessions.length === 0) return 0;

  const sessionIds = new Set(sessions.map(s => s.id || s.sessionId || s.SessionID));

  const periodAttempts = allAttempts.filter(attempt => {
    const attemptSessionId = attempt.session_id || attempt.SessionID;
    return sessionIds.has(attemptSessionId) || sessionIds.has(attempt.sessionId);
  });

  if (periodAttempts.length === 0) return 0;

  const successfulProblems = periodAttempts.filter(attempt => (attempt.success !== undefined ? attempt.success : attempt.Success)).length;

  let totalHintsUsed = 0;
  try {
    const hintPromises = Array.from(sessionIds).map(sessionId =>
      getInteractionsBySession(sessionId).catch(() => [])
    );
    const hintResults = await Promise.all(hintPromises);

    totalHintsUsed = hintResults.flat().length;

    console.log('📊 Learning Efficiency Debug:', {
      sessionIds: Array.from(sessionIds),
      totalSessions: sessions.length,
      totalAttempts: periodAttempts.length,
      successfulProblems,
      totalHintsUsed,
      hintResultsCount: hintResults.map(r => r.length)
    });
  } catch (error) {
    logger.warn("Could not fetch hint data, using estimation:", error);
    totalHintsUsed = 0;
  }

  if (totalHintsUsed === 0) {
    const totalAttempts = periodAttempts.length;
    const failedAttempts = totalAttempts - successfulProblems;

    totalHintsUsed = successfulProblems * 1.0 + failedAttempts * 2.5;

    console.log('📊 Using estimation - totalHintsUsed:', totalHintsUsed);
  }

  const efficiency = successfulProblems > 0 ? totalHintsUsed / successfulProblems : 0;
  console.log('📊 Final efficiency:', efficiency);
  return efficiency;
}

/**
 * Calculate timer behavior based on actual session timing performance
 */
export function calculateTimerBehavior(attempts, problemDifficultyMap) {
  if (!attempts || attempts.length === 0) return "No data";

  const recentAttempts = attempts.slice(-100);
  const timelyAttempts = recentAttempts.filter(attempt => {
    const timeSpent = attempt.time_spent || attempt.TimeSpent;
    if (timeSpent === undefined || timeSpent === null || timeSpent <= 0) return false;

    const problemId = attempt.problem_id || attempt.ProblemID;
    const difficulty = problemDifficultyMap[problemId] || "Medium";

    const timeLimit = difficulty === "Easy" ? 1200 :
                     difficulty === "Hard" ? 5400 : 2700;
    return timeSpent <= timeLimit;
  });

  const timelyPercentage = (timelyAttempts.length / recentAttempts.length) * 100;

  if (timelyPercentage >= 85) return "Excellent timing";
  if (timelyPercentage >= 70) return "On time";
  if (timelyPercentage >= 50) return "Improving pace";
  return "Learning timing";
}

/**
 * Calculate learning status based on recent activity patterns
 */
export function calculateLearningStatus(attempts, sessions) {
  if (!attempts || attempts.length === 0) return "No Data";

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const recentAttempts = attempts.filter(attempt =>
    new Date(attempt.attempt_date || attempt.AttemptDate) >= sevenDaysAgo
  );

  const recentSessions = sessions.filter(session =>
    new Date(session.date) >= sevenDaysAgo
  );

  const monthlyAttempts = attempts.filter(attempt =>
    new Date(attempt.attempt_date || attempt.AttemptDate) >= thirtyDaysAgo
  );

  if (recentAttempts.length >= 3 || recentSessions.length >= 1) {
    return "Active Learning";
  } else if (monthlyAttempts.length >= 2) {
    return "Intermittent Learning";
  } else if (attempts.length > 0) {
    return "Inactive";
  } else {
    return "Getting Started";
  }
}

/**
 * Calculate percentage of attempts completed within reasonable time limits
 */
export function calculateTimerPercentage(attempts, problemDifficultyMap) {
  if (!attempts || attempts.length === 0) return 0;

  const recentAttempts = attempts.slice(-100);
  const withinLimits = recentAttempts.filter(attempt => {
    const timeSpent = attempt.time_spent || attempt.TimeSpent;
    if (timeSpent === undefined || timeSpent === null || timeSpent <= 0) return false;

    const problemId = attempt.problem_id || attempt.ProblemID;
    const difficulty = problemDifficultyMap[problemId] || "Medium";

    const timeLimit = difficulty === "Easy" ? 1200 :
                     difficulty === "Hard" ? 5400 : 2700;
    return timeSpent <= timeLimit;
  });

  return Math.round((withinLimits.length / recentAttempts.length) * 100);
}
