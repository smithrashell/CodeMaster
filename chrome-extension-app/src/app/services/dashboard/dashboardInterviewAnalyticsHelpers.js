/**
 * Helper functions for interview analytics data generation
 * Extracted from dashboardService.js to reduce file complexity
 */

import { roundToPrecision } from "../../../shared/utils/leitner/Utils.js";
import { getAllSessions } from "../../../shared/db/stores/sessions.js";
import { getAllAttempts } from "../../../shared/db/stores/attempts.js";
import logger from "../../../shared/utils/logging/logger.js";

/**
 * Returns empty interview analytics data when no sessions exist
 */
export function getEmptyInterviewAnalytics() {
  return {
    totalInterviewSessions: 0,
    interviewModeBreakdown: {
      'interview-like': 0,
      'full-interview': 0
    },
    averagePerformance: {
      accuracy: 0,
      timePerProblem: 0,
      completionRate: 0
    },
    progressTrend: [],
    transferMetrics: {
      standardToInterview: 0,
      improvementRate: 0
    },
    recentSessions: [],
    recommendations: [
      "Start with Interview-Like mode to practice with limited hints",
      "Build confidence before moving to Full Interview mode"
    ]
  };
}

/**
 * Calculates session metrics from interview sessions and attempts
 */
export function calculateSessionMetrics(interviewSessions, allAttempts) {
  const interviewModeBreakdown = {};
  let totalAccuracy = 0;
  let totalTimeSpent = 0;
  let totalProblemsAttempted = 0;
  let totalProblemsCompleted = 0;

  interviewSessions.forEach(session => {
    const mode = session.sessionType || 'interview-like';
    interviewModeBreakdown[mode] = (interviewModeBreakdown[mode] || 0) + 1;

    const sessionAttempts = allAttempts.filter(attempt =>
      attempt.sessionId === session.sessionId
    );

    sessionAttempts.forEach(attempt => {
      totalProblemsAttempted++;
      if (attempt.status === 'correct') {
        totalProblemsCompleted++;
        totalAccuracy++;
      }
      if (attempt.timeSpent) {
        totalTimeSpent += attempt.timeSpent;
      }
    });
  });

  const accuracy = totalProblemsAttempted > 0 ? (totalAccuracy / totalProblemsAttempted) * 100 : 0;
  const averageTimePerProblem = totalProblemsAttempted > 0 ? totalTimeSpent / totalProblemsAttempted : 0;
  const completionRate = totalProblemsAttempted > 0 ? (totalProblemsCompleted / totalProblemsAttempted) * 100 : 0;

  return {
    interviewModeBreakdown,
    accuracy,
    averageTimePerProblem,
    completionRate,
    totalProblemsAttempted,
    totalProblemsCompleted
  };
}

/**
 * Generates progress trend data from recent interview sessions
 */
export function generateProgressTrend(interviewSessions, allAttempts) {
  if (!Array.isArray(interviewSessions)) return [];
  if (!Array.isArray(allAttempts)) allAttempts = [];

  const recentInterviewSessions = interviewSessions
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 10);

  return recentInterviewSessions.map(session => {
    const sessionAttempts = allAttempts.filter(attempt =>
      attempt.sessionId === session.sessionId
    );

    const sessionAccuracy = sessionAttempts.length > 0 ?
      (sessionAttempts.filter(a => a.status === 'correct').length / sessionAttempts.length) * 100 : 0;

    return {
      sessionId: session.sessionId,
      date: session.timestamp,
      mode: session.sessionType,
      accuracy: sessionAccuracy,
      problemsAttempted: sessionAttempts.length,
      timeSpent: sessionAttempts.reduce((sum, a) => sum + (a.timeSpent || 0), 0)
    };
  }).reverse();
}

/**
 * Calculates transfer metrics comparing interview vs standard performance
 */
export function calculateTransferMetrics(allSessions, allAttempts, accuracy, progressTrend) {
  const standardSessions = allSessions.filter(session =>
    !session.sessionType || session.sessionType === 'standard'
  );

  let standardAccuracy = 0;
  if (standardSessions.length > 0) {
    const standardAttempts = allAttempts.filter(attempt =>
      standardSessions.some(session => session.sessionId === attempt.sessionId)
    );
    standardAccuracy = standardAttempts.length > 0 ?
      (standardAttempts.filter(a => a.status === 'correct').length / standardAttempts.length) * 100 : 0;
  }

  const transferScore = standardAccuracy > 0 ? (accuracy / standardAccuracy) : 0;
  const improvementRate = progressTrend.length >= 2 ?
    Math.round(((progressTrend[progressTrend.length - 1].accuracy - progressTrend[0].accuracy) / progressTrend.length) * 10) / 10 : 0;

  return {
    standardToInterview: roundToPrecision(transferScore),
    improvementRate
  };
}

/**
 * Generates performance-based recommendations
 */
export function generateRecommendations(accuracy, averageTimePerProblem, transferScore) {
  const recommendations = [];
  if (accuracy < 50) {
    recommendations.push("Focus on Interview-Like mode to build confidence with reduced pressure");
  } else if (accuracy < 70) {
    recommendations.push("Good progress! Continue practicing in Interview-Like mode");
  } else {
    recommendations.push("Excellent performance! Ready to try Full Interview mode");
  }

  if (averageTimePerProblem > 1800) {
    recommendations.push("Work on time management - aim for 20-25 minutes per problem");
  }

  if (transferScore < 0.8) {
    recommendations.push("Practice more standard sessions to strengthen fundamentals");
  }

  return recommendations;
}

/**
 * Get data specifically for the Interview Analytics page
 */
export async function getInterviewAnalyticsData(_options = {}) {
  try {
    logger.info("🎯 Getting interview analytics data...");

    const allSessions = await getAllSessions();
    const allAttempts = await getAllAttempts();

    // Filter for interview sessions
    const interviewSessions = allSessions.filter(session =>
      session.sessionType && session.sessionType !== 'standard'
    );

    logger.info(`Found ${interviewSessions.length} interview sessions`);

    if (interviewSessions.length === 0) {
      return getEmptyInterviewAnalytics();
    }

    // Calculate all metrics using helper functions
    const sessionMetrics = calculateSessionMetrics(interviewSessions, allAttempts);
    const progressTrend = generateProgressTrend(interviewSessions, allAttempts);
    const transferMetrics = calculateTransferMetrics(allSessions, allAttempts, sessionMetrics.accuracy, progressTrend);
    const recommendations = generateRecommendations(sessionMetrics.accuracy, sessionMetrics.averageTimePerProblem, transferMetrics.standardToInterview);

    return {
      totalInterviewSessions: interviewSessions.length,
      interviewModeBreakdown: {
        'interview-like': sessionMetrics.interviewModeBreakdown['interview-like'] || 0,
        'full-interview': sessionMetrics.interviewModeBreakdown['full-interview'] || 0
      },
      averagePerformance: {
        accuracy: Math.round(sessionMetrics.accuracy * 10) / 10,
        timePerProblem: Math.round(sessionMetrics.averageTimePerProblem / 60), // Convert to minutes
        completionRate: Math.round(sessionMetrics.completionRate * 10) / 10
      },
      progressTrend,
      transferMetrics,
      recentSessions: interviewSessions
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 5)
        .map(session => ({
          sessionId: session.sessionId,
          date: session.timestamp,
          mode: session.sessionType,
          problemsAttempted: allAttempts.filter(a => a.sessionId === session.sessionId).length,
          accuracy: allAttempts.filter(a => a.sessionId === session.sessionId && a.status === 'correct').length /
                    Math.max(1, allAttempts.filter(a => a.sessionId === session.sessionId).length) * 100
        })),
      recommendations
    };

  } catch (error) {
    logger.error("Error in getInterviewAnalyticsData:", error);
    throw error;
  }
}
