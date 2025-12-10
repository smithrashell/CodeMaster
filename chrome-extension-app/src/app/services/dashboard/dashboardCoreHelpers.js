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
    TagService.getCurrentLearningState(),
    ProblemService.countProblemsByBoxLevel()
  ]);

  // Enrich sessions with actual hint counts from hint_interactions table
  const enrichedSessions = await enrichSessionsWithHintCounts(allSessions);

  return { allProblems, allAttempts, allSessions: enrichedSessions, allStandardProblems, learningState, boxLevelData };
}

export function createDashboardProblemMappings(allProblems, allStandardProblems) {
  // Use a plain object for standardProblemsMap so Object.values() works
  const standardProblemsMap = {};
  allStandardProblems.forEach((sp) => {
    standardProblemsMap[sp.id] = sp;
  });

  const problemTagsMap = new Map();
  const problemDifficultyMap = {};

  allProblems.forEach((problem) => {
    const standardProblem = standardProblemsMap[problem.leetcode_id];
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
  const statistics = {
    totalSolved: 0,
    mastered: 0,
    inProgress: 0,
    new: 0,
  };

  const timeStats = {
    overall: { totalTime: 0, count: 0 },
    Easy: { totalTime: 0, count: 0 },
    Medium: { totalTime: 0, count: 0 },
    Hard: { totalTime: 0, count: 0 },
  };

  const successStats = {
    overall: { successful: 0, total: 0 },
    Easy: { successful: 0, total: 0 },
    Medium: { successful: 0, total: 0 },
    Hard: { successful: 0, total: 0 },
  };

  // Calculate problem statistics by box level (support both snake_case and PascalCase)
  filteredProblems.forEach((problem) => {
    const boxLevel = problem.box_level || problem.BoxLevel || 1;
    switch (boxLevel) {
      case 1:
        statistics.new++;
        break;
      case 7:
        statistics.mastered++;
        break;
      default:
        if (boxLevel >= 2 && boxLevel <= 6) {
          statistics.inProgress++;
        }
        break;
    }
  });
  statistics.totalSolved = statistics.mastered + statistics.inProgress;

  // Calculate time and success statistics by difficulty (support both snake_case and PascalCase)
  filteredAttempts.forEach((attempt) => {
    const problemId = attempt.problem_id || attempt.ProblemID;
    const officialDifficulty = problemDifficultyMap[problemId];
    const timeSpent = Number(attempt.time_spent || attempt.TimeSpent) || 0;
    const success = attempt.success !== undefined ? attempt.success : attempt.Success;

    // Update overall statistics
    timeStats.overall.totalTime += timeSpent;
    timeStats.overall.count++;
    successStats.overall.total++;
    if (success) {
      successStats.overall.successful++;
    }

    // Update difficulty-specific statistics
    if (officialDifficulty && timeStats[officialDifficulty]) {
      timeStats[officialDifficulty].totalTime += timeSpent;
      timeStats[officialDifficulty].count++;
      successStats[officialDifficulty].total++;
      if (success) {
        successStats[officialDifficulty].successful++;
      }
    }
  });

  return { statistics, timeStats, successStats };
}

export function calculateDerivedMetrics(timeStats, successStats) {
  const calculateAverage = (totalTimeInSeconds, count) =>
    count > 0 ? Math.round((totalTimeInSeconds / count) / 60 * 10) / 10 : 0;

  const calculateSuccessRateValue = (successful, total) =>
    total > 0 ? parseInt((successful / total) * 100) : 0;

  const averageTime = {
    overall: calculateAverage(timeStats.overall.totalTime, timeStats.overall.count),
    Easy: calculateAverage(timeStats.Easy.totalTime, timeStats.Easy.count),
    Medium: calculateAverage(timeStats.Medium.totalTime, timeStats.Medium.count),
    Hard: calculateAverage(timeStats.Hard.totalTime, timeStats.Hard.count),
  };

  const successRate = {
    overall: calculateSuccessRateValue(successStats.overall.successful, successStats.overall.total),
    Easy: calculateSuccessRateValue(successStats.Easy.successful, successStats.Easy.total),
    Medium: calculateSuccessRateValue(successStats.Medium.successful, successStats.Medium.total),
    Hard: calculateSuccessRateValue(successStats.Hard.successful, successStats.Hard.total),
  };

  return { averageTime, successRate };
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

  const guidedSessionIds = new Set(guidedSessions.map(s => s.id));

  const guidedAttempts = attempts.filter(a => guidedSessionIds.has(a.session_id || a.SessionID));

  const guidedSuccess = guidedAttempts.filter(a => (a.success !== undefined ? a.success : a.Success)).length;

  // Return a simple number for the KPI card - overall guided session success rate
  return guidedAttempts.length > 0 ? Math.round((guidedSuccess / guidedAttempts.length) * 100) : 0;
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
  // Core metrics
  statistics, averageTime, successRate,
  // Progress metrics
  timerBehavior, timerPercentage, learningStatus, progressTrend, progressPercentage,
  strategySuccessRate,
  nextReviewTime, nextReviewCount,
  // Analytics data
  sessionAnalytics, masteryData, goalsData, learningEfficiencyData, hintsUsed,
  // Filtered data
  filteredProblems, filteredAttempts, filteredSessions,
  // Original data and state
  allProblems, allAttempts, allSessions, learningState, boxLevelData,
  // Problem mappings
  standardProblemsMap,
  // Filter options
  focusAreaFilter, dateRange
}) {
  const dashboardData = {
    // Flattened statistics properties for Overview/Stats component
    statistics,
    averageTime,
    successRate,
    allSessions: filteredSessions,
    hintsUsed,
    learningEfficiencyData,

    // Flattened progress properties for Progress component
    boxLevelData: boxLevelData || {},
    timerBehavior,
    timerPercentage,
    learningStatus,
    progressTrend,
    progressPercentage,
    strategySuccessRate,
    nextReviewTime,
    nextReviewCount,
    allAttempts: filteredAttempts || [],
    allProblems: filteredProblems || [],
    learningState: learningState || {},

    // Problem mappings for tag relationships
    standardProblemsMap: standardProblemsMap || {},

    // Keep nested structure for components that might still need it
    nested: {
      statistics: {
        statistics,
        averageTime,
        successRate,
        allSessions: filteredSessions,
        learningEfficiencyData
      },
      progress: {
        learningState: learningState || {},
        boxLevelData: boxLevelData || {},
        allAttempts: filteredAttempts || [],
        allProblems: filteredProblems || [],
        allSessions: filteredSessions || [],
        timerBehavior,
        timerPercentage,
        learningStatus,
        progressTrend,
        progressPercentage,
        strategySuccessRate,
        nextReviewTime,
        nextReviewCount,
      }
    },

    // Keep existing sections for other components
    sessions: sessionAnalytics,
    mastery: masteryData,
    goals: goalsData,
    filters: {
      focusAreaFilter,
      dateRange,
      appliedFilters: {
        hasFocusAreaFilter: focusAreaFilter && focusAreaFilter.length > 0,
        hasDateFilter: Boolean(dateRange && (dateRange.startDate || dateRange.endDate)),
      },
      originalCounts: {
        problems: allProblems.length,
        attempts: allAttempts.length,
        sessions: allSessions.length,
      },
      filteredCounts: {
        problems: filteredProblems.length,
        attempts: filteredAttempts.length,
        sessions: filteredSessions.length,
      },
    },
  };

  // Debug logging to verify data structure
  logger.info("Dashboard Service - Data Structure Verification", { context: 'data_verification' });

  return dashboardData;
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
