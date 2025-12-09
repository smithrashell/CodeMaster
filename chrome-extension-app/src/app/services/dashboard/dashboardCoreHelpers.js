/**
 * Core helper functions for dashboard data fetching and processing
 * Extracted from dashboardService.js to reduce file complexity
 */

import { fetchAllProblems } from "../../../shared/db/stores/problems.js";
import { getAllAttempts } from "../../../shared/db/stores/attempts.js";
import { getAllSessions } from "../../../shared/db/stores/sessions.js";
import { TagService } from "../../../shared/services/attempts/tagServices.js";
import { ProblemService } from "../../../shared/services/problem/problemService.js";
import { getAllStandardProblems } from "../../../shared/db/stores/standard_problems.js";
import { HintInteractionService } from "../../../shared/services/hints/hintInteractionService.js";
import { getInteractionsBySession } from "../../../shared/db/stores/hint_interactions.js";
import { getLatestSession } from "../../../shared/db/stores/sessions.js";
import logger from "../../../shared/utils/logging/logger.js";

const DEFAULT_FOCUS_AREAS = [
  "array",
  "hash table",
  "string",
  "dynamic programming",
  "tree"
];

export function getInitialFocusAreas(providedFocusAreas) {
  if (providedFocusAreas && providedFocusAreas.length > 0) {
    return providedFocusAreas;
  }

  logger.warn("No focus areas provided by background script", { context: 'focus_areas_fallback' });
  return DEFAULT_FOCUS_AREAS;
}

export async function enrichSessionsWithHintCounts(sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return sessions;
  }

  const sessionsWithHints = await Promise.all(
    sessions.map(async (session) => {
      try {
        const sessionId = session.id || session.sessionId || session.SessionID;
        if (!sessionId) {
          return { ...session, hintsUsed: 0 };
        }

        const hintInteractions = await getInteractionsBySession(sessionId);
        const hintsUsed = Array.isArray(hintInteractions) ? hintInteractions.length : 0;

        return {
          ...session,
          hintsUsed
        };
      } catch (error) {
        logger.warn(`Failed to get hint count for session ${session.id}:`, error);
        return { ...session, hintsUsed: 0 };
      }
    })
  );

  return sessionsWithHints;
}

export async function fetchDashboardData() {
  const [allProblems, allAttempts, allSessions, allStandardProblems, learningState, boxLevelData] = await Promise.all([
    fetchAllProblems(),
    getAllAttempts(),
    getAllSessions(),
    getAllStandardProblems(),
    TagService.getLearningState(),
    ProblemService.getBoxLevelDistribution()
  ]);

  return { allProblems, allAttempts, allSessions, allStandardProblems, learningState, boxLevelData };
}

export function createDashboardProblemMappings(allProblems, allStandardProblems) {
  const standardProblemsMap = new Map();
  allStandardProblems.forEach((sp) => {
    standardProblemsMap.set(sp.id, sp);
  });

  const problemTagsMap = new Map();
  const problemDifficultyMap = {};

  allProblems.forEach((problem) => {
    const standardProblem = standardProblemsMap.get(problem.leetcode_id);
    if (standardProblem) {
      problemTagsMap.set(problem.problem_id, standardProblem.tags || []);
      problemDifficultyMap[problem.problem_id] = standardProblem.difficulty;
    }
  });

  return { standardProblemsMap, problemTagsMap, problemDifficultyMap };
}

export function applyFiltering({ allProblems, allAttempts, allSessions, problemTagsMap, focusAreaFilter, dateRange }) {
  let filteredProblems = allProblems;
  let filteredAttempts = allAttempts;
  let filteredSessions = allSessions;

  if (focusAreaFilter && focusAreaFilter.length > 0) {
    const focusSet = new Set(focusAreaFilter.map(tag => tag.toLowerCase()));
    const filteredProblemIds = new Set();

    problemTagsMap.forEach((tags, problemId) => {
      const hasFocusTag = tags.some(tag => focusSet.has(tag.toLowerCase()));
      if (hasFocusTag) {
        filteredProblemIds.add(problemId);
      }
    });

    filteredProblems = allProblems.filter(p => filteredProblemIds.has(p.problem_id));
    filteredAttempts = allAttempts.filter(a => filteredProblemIds.has(a.problem_id || a.ProblemID));
  }

  if (dateRange && (dateRange.startDate || dateRange.endDate)) {
    const startDate = dateRange.startDate ? new Date(dateRange.startDate) : new Date(0);
    const endDate = dateRange.endDate ? new Date(dateRange.endDate) : new Date();

    filteredAttempts = filteredAttempts.filter(attempt => {
      const attemptDate = new Date(attempt.attempt_date || attempt.AttemptDate);
      return attemptDate >= startDate && attemptDate <= endDate;
    });

    filteredSessions = filteredSessions.filter(session => {
      const sessionDate = new Date(session.date);
      return sessionDate >= startDate && sessionDate <= endDate;
    });
  }

  return { filteredProblems, filteredAttempts, filteredSessions };
}

export function calculateCoreStatistics(filteredProblems, filteredAttempts, problemDifficultyMap) {
  const totalSolved = new Set(filteredAttempts.filter(a => (a.success !== undefined ? a.success : a.Success)).map(a => a.problem_id || a.ProblemID)).size;
  const mastered = Math.floor(totalSolved * 0.3);
  const inProgress = Math.floor(totalSolved * 0.5);
  const newProblems = totalSolved - mastered - inProgress;

  const statistics = {
    totalSolved,
    mastered,
    inProgress,
    new: newProblems
  };

  const timeByDifficulty = { Easy: [], Medium: [], Hard: [] };
  const successByDifficulty = { Easy: { total: 0, success: 0 }, Medium: { total: 0, success: 0 }, Hard: { total: 0, success: 0 } };

  filteredAttempts.forEach(attempt => {
    const problemId = attempt.problem_id || attempt.ProblemID;
    const difficulty = problemDifficultyMap[problemId] || "Medium";
    const timeSpent = attempt.time_spent || attempt.TimeSpent || 0;
    const isSuccess = attempt.success !== undefined ? attempt.success : attempt.Success;

    if (timeSpent > 0 && timeSpent < 10000) {
      timeByDifficulty[difficulty].push(timeSpent);
    }

    successByDifficulty[difficulty].total++;
    if (isSuccess) {
      successByDifficulty[difficulty].success++;
    }
  });

  const averageTime = {};
  Object.keys(timeByDifficulty).forEach(difficulty => {
    const times = timeByDifficulty[difficulty];
    if (times.length > 0) {
      averageTime[difficulty] = Math.round(times.reduce((sum, t) => sum + t, 0) / times.length);
    } else {
      averageTime[difficulty] = 0;
    }
  });

  const overallTimes = Object.values(timeByDifficulty).flat();
  averageTime.overall = overallTimes.length > 0 ?
    Math.round(overallTimes.reduce((sum, t) => sum + t, 0) / overallTimes.length) : 0;

  const successRate = {};
  Object.keys(successByDifficulty).forEach(difficulty => {
    const data = successByDifficulty[difficulty];
    successRate[difficulty] = data.total > 0 ?
      Math.round((data.success / data.total) * 100) : 0;
  });

  const totalAttempts = Object.values(successByDifficulty).reduce((sum, d) => sum + d.total, 0);
  const totalSuccess = Object.values(successByDifficulty).reduce((sum, d) => sum + d.success, 0);
  successRate.overall = totalAttempts > 0 ?
    Math.round((totalSuccess / totalAttempts) * 100) : 0;

  return { statistics, averageTime, successRate };
}

export function calculateDerivedMetrics(timeStats, successStats) {
  const { averageTime, successRate } = { averageTime: timeStats, successRate: successStats };

  const timeAccuracy = {
    averageTime: averageTime.overall,
    successRate: successRate.overall,
    efficiency: successRate.overall / Math.max(1, averageTime.overall / 60)
  };

  return { timeAccuracy };
}

export async function generateAnalyticsData(filteredSessions, filteredAttempts, learningState) {
  const sessions = await enrichSessionsWithHintCounts(filteredSessions);

  return {
    sessions: sessions,
    attempts: filteredAttempts,
    learningState: learningState
  };
}

export function calculateProgressMetrics(filteredAttempts, filteredSessions, _problemDifficultyMap) {
  return {
    totalAttempts: filteredAttempts.length,
    totalSessions: filteredSessions.length
  };
}

export function calculateStrategySuccessRate(sessions, attempts) {
  const guidedSessions = sessions.filter(s => s.session_type === 'standard' || s.session_type === 'interview-like' || s.session_type === 'full-interview');
  const trackingSessions = sessions.filter(s => s.session_type === 'tracking');

  const guidedSessionIds = new Set(guidedSessions.map(s => s.id));
  const trackingSessionIds = new Set(trackingSessions.map(s => s.id));

  const guidedAttempts = attempts.filter(a => guidedSessionIds.has(a.session_id || a.SessionID));
  const trackingAttempts = attempts.filter(a => trackingSessionIds.has(a.session_id || a.SessionID));

  const guidedSuccess = guidedAttempts.filter(a => (a.success !== undefined ? a.success : a.Success)).length;
  const trackingSuccess = trackingAttempts.filter(a => (a.success !== undefined ? a.success : a.Success)).length;

  const guidedRate = guidedAttempts.length > 0 ? Math.round((guidedSuccess / guidedAttempts.length) * 100) : 0;
  const trackingRate = trackingAttempts.length > 0 ? Math.round((trackingSuccess / trackingAttempts.length) * 100) : 0;

  return {
    guided: {
      sessions: guidedSessions.length,
      attempts: guidedAttempts.length,
      successRate: guidedRate
    },
    tracking: {
      sessions: trackingSessions.length,
      attempts: trackingAttempts.length,
      successRate: trackingRate
    }
  };
}

export async function getHintAnalytics() {
  try {
    return await HintInteractionService.getSystemAnalytics();
  } catch (error) {
    logger.warn("Could not load hint analytics:", error);
    return {
      total: 0,
      contextual: 0,
      general: 0,
      primer: 0,
      averagePerProblem: 0,
      effectiveness: 0
    };
  }
}

export function constructDashboardData({
  statistics,
  averageTime,
  successRate,
  allSessions,
  allAttempts,
  allProblems,
  sessions,
  mastery,
  goals,
  timerBehavior,
  timerPercentage,
  learningStatus,
  progressTrend,
  progressPercentage,
  nextReviewTime,
  nextReviewCount,
  learningState,
  boxLevelData,
  hintsUsed,
  timeAccuracy,
  learningEfficiencyData,
  strategySuccessRate
}) {
  return {
    statistics,
    averageTime,
    successRate,
    allSessions,
    allAttempts,
    allProblems,
    sessions,
    mastery,
    goals,
    timerBehavior,
    timerPercentage,
    learningStatus,
    progressTrend,
    progressPercentage,
    nextReviewTime,
    nextReviewCount,
    learningState,
    boxLevelData,
    hintsUsed,
    timeAccuracy,
    learningEfficiencyData,
    strategySuccessRate
  };
}

export function validateSession(session) {
  if (!session) {
    logger.info('📊 No active session found');
    return { nextReviewTime: "No active session", nextReviewCount: 0 };
  }

  if (session === null || session === undefined) {
    logger.info('📊 Session is null or undefined');
    return { nextReviewTime: "No session available", nextReviewCount: 0 };
  }

  if (typeof session !== 'object') {
    logger.warn('❌ Session is not an object:', { sessionType: typeof session, sessionValue: session });
    return { nextReviewTime: "Invalid session type", nextReviewCount: 0 };
  }

  return null;
}

export async function calculateNextReviewData() {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      const session = await getLatestSession();

      const validationError = validateSession(session);
      if (validationError) return validationError;

      logger.info('📊 Dashboard received session object:', session);

      let totalProblems = 0;
      let currentIndex = session.currentProblemIndex || 0;

      if (Array.isArray(session.problems)) {
        totalProblems = session.problems.length;
      } else if (typeof session.problemCount === 'number') {
        totalProblems = session.problemCount;
      } else {
        logger.warn('❌ Session has neither problems array nor problemCount:', {
          hasProblems: 'problems' in session,
          problemsType: typeof session.problems,
          hasProblemCount: 'problemCount' in session,
          problemCountType: typeof session.problemCount,
          sessionKeys: Object.keys(session)
        });
        return {
          nextReviewTime: "Session missing problem data",
          nextReviewCount: 0
        };
      }

      const problemsRemaining = totalProblems - currentIndex;
      logger.info('📊 Session analysis:', {
        totalProblems,
        currentIndex,
        problemsRemaining,
        sessionId: session.id,
        sessionStatus: session.status,
        hasProblemsArray: Array.isArray(session.problems),
        sessionProblemCount: session.problemCount
      });

      const now = new Date();
      const nextReview = new Date();

      if (problemsRemaining > 0) {
        nextReview.setMinutes(nextReview.getMinutes() + 5);
      } else {
        const currentHour = now.getHours();
        if (currentHour >= 20) {
          nextReview.setDate(nextReview.getDate() + 1);
          nextReview.setHours(9, 0, 0, 0);
        } else if (currentHour < 9) {
          nextReview.setHours(14, 0, 0, 0);
        } else {
          nextReview.setHours(currentHour + 2, 0, 0, 0);
        }
      }

      const formatTime = (date) => {
        const isToday = date.toDateString() === now.toDateString();
        const timeStr = date.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });

        if (isToday) {
          return `Today • ${timeStr}`;
        }

        const dayStr = date.toLocaleDateString('en-US', { weekday: 'short' });
        return `${dayStr} • ${timeStr}`;
      };

      return {
        nextReviewTime: formatTime(nextReview),
        nextReviewCount: Math.max(problemsRemaining, 0)
      };

    } else {
      return {
        nextReviewTime: "Development mode",
        nextReviewCount: 0
      };
    }
  } catch (error) {
    logger.error('Error in calculateNextReviewData:', error);
    return {
      nextReviewTime: "Schedule unavailable",
      nextReviewCount: 0
    };
  }
}
