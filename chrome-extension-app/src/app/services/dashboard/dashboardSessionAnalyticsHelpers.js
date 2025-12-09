/**
 * Helper functions for session analytics data generation
 * Extracted from dashboardService.js to reduce file complexity
 */

import { roundToPrecision } from "../../../shared/utils/leitner/Utils.js";

/**
 * Generate session analytics data structure matching mock service format
 */
export function generateSessionAnalytics(sessions, attempts) {
  const enhancedSessions = sessions.map((session, index) => {
    const sessionAttempts = attempts.filter(attempt => {
      const attemptSessionId = attempt.session_id || attempt.SessionID;
      const attemptDate = attempt.attempt_date || attempt.AttemptDate;
      return attemptSessionId === session.sessionId ||
        (session.date && Math.abs(new Date(session.date) - new Date(attemptDate)) < 60 * 60 * 1000);
    });

    const duration = session.duration ||
      (sessionAttempts.length > 0 ? sessionAttempts.reduce((sum, a) => sum + (Number(a.time_spent || a.TimeSpent) || 0), 0) / 60 : 30);

    const accuracy = session.accuracy || 0;
    const completed = session.completed !== undefined ? session.completed : true;

    return {
      ...session,
      sessionId: session.sessionId || `session_${index + 1}`,
      duration: Math.round(duration),
      accuracy: roundToPrecision(accuracy),
      completed,
      problems: session.problems || sessionAttempts.map(attempt => ({
        id: attempt.problem_id || attempt.ProblemID,
        difficulty: "Medium",
        solved: attempt.success !== undefined ? attempt.success : attempt.Success
      }))
    };
  });

  const sessionAnalytics = enhancedSessions.map(session => ({
    sessionId: session.sessionId,
    completedAt: session.date || new Date().toISOString(),
    accuracy: session.accuracy,
    avgTime: session.duration,
    totalProblems: session.problems?.length || 0,
    difficulty: session.problems?.reduce((acc, p) => {
      acc[p.difficulty] = (acc[p.difficulty] || 0) + 1;
      return acc;
    }, {}) || {},
    insights: [
      session.accuracy > 0.8 ? "Great accuracy this session!" : "Focus on accuracy improvement",
      session.duration > 45 ? "Long focused session - excellent!" : "Consider longer practice sessions"
    ]
  }));

  const completedSessions = enhancedSessions.filter(s => s.completed);
  const averageSessionLength = completedSessions.length > 0 ?
    Math.round(completedSessions.reduce((acc, s) => acc + s.duration, 0) / completedSessions.length) :
    0;

  const productivityMetrics = {
    averageSessionLength,
    completionRate: enhancedSessions.length > 0 ?
      Math.round((completedSessions.length / enhancedSessions.length) * 100) :
      0,
    streakDays: calculateStreakDays(enhancedSessions),
    bestPerformanceHour: findBestPerformanceHour(enhancedSessions)
  };

  return {
    allSessions: enhancedSessions,
    recentSessions: enhancedSessions.slice(-10),
    sessionAnalytics,
    productivityMetrics
  };
}

/**
 * Calculate current streak days from session history
 */
export function calculateStreakDays(sessions) {
  if (sessions.length === 0) return 0;

  const sortedSessions = sessions
    .filter(s => s.completed)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (sortedSessions.length === 0) return 0;

  let streak = 0;
  let currentDate = new Date();

  for (const session of sortedSessions) {
    const sessionDate = new Date(session.date);
    const daysDiff = Math.floor((currentDate - sessionDate) / (1000 * 60 * 60 * 24));

    if (daysDiff <= streak + 1) {
      if (daysDiff === streak) {
        streak++;
        currentDate = sessionDate;
      }
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Find best performance hour from session history
 */
export function findBestPerformanceHour(sessions) {
  const hourlyPerformance = {};

  sessions.forEach(session => {
    if (session.date) {
      const hour = new Date(session.date).getHours();
      const hourKey = `${hour.toString().padStart(2, '0')}:00`;

      if (!hourlyPerformance[hourKey]) {
        hourlyPerformance[hourKey] = { total: 0, accuracy: 0 };
      }

      hourlyPerformance[hourKey].total++;
      hourlyPerformance[hourKey].accuracy += session.accuracy || 0;
    }
  });

  let bestHour = "14:00";
  let bestScore = 0;

  Object.entries(hourlyPerformance).forEach(([hour, data]) => {
    const avgAccuracy = data.accuracy / data.total;
    const score = avgAccuracy * Math.min(data.total, 5);

    if (score > bestScore) {
      bestScore = score;
      bestHour = hour;
    }
  });

  return bestHour;
}
