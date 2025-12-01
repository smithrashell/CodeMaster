import { fetchAllProblems } from "../../../shared/db/stores/problems.js";
import { getAllAttempts } from "../../../shared/db/stores/attempts.js";
import { getAllSessions } from "../../../shared/db/stores/sessions.js";
import { TagService } from "../../../shared/services/attempts/tagServices.js";
import { ProblemService } from "../../../shared/services/problem/problemService.js";
import AccurateTimer from "../../../shared/utils/timing/AccurateTimer.js";
import { getAllStandardProblems } from "../../../shared/db/stores/standard_problems.js";
import { StorageService } from "../../../shared/services/storage/storageService.js";
import { getRecentSessionAnalytics } from "../../../shared/db/stores/sessionAnalytics.js";
import { HintInteractionService } from "../../../shared/services/hints/hintInteractionService.js";
import { getInteractionsBySession } from "../../../shared/db/stores/hint_interactions.js";
import { getLatestSession } from "../../../shared/db/stores/sessions.js";
import logger from "../../../shared/utils/logging/logger.js";
import { calculateProgressPercentage, calculateSuccessRate, roundToPrecision } from "../../../shared/utils/leitner/Utils.js";
import { getTagRelationships } from "../../../shared/db/stores/tag_relationships.js";
import {
  createProblemMappings,
  getTargetFocusAreas,
  filterDataByDateRange,
  calculateFocusAreaPerformance,
  calculateFocusAreaProgress,
  calculateFocusAreaEffectiveness
} from "./focusAreaHelpers.js";
import {
  integrateFocusAreaSessionAnalytics,
  generateFocusAreaInsights,
  generateFocusAreaRecommendations,
  cleanupAnalyticsCache
} from "./focusAreaInsights.js";

// Simple in-memory cache for focus area analytics
const analyticsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get initial focus areas from provided data (no direct service calls)
 * Background script should provide focusAreas using session generation logic
 */
// Default focus areas fallback data (similar to content script pattern)
const DEFAULT_FOCUS_AREAS = [
  "array", 
  "hash table", 
  "string", 
  "dynamic programming",
  "tree"
];

function getInitialFocusAreas(providedFocusAreas) {
  // Use provided focus areas from background script
  if (providedFocusAreas && providedFocusAreas.length > 0) {
    return providedFocusAreas;
  }
  
  // Enhanced fallback with multiple common focus areas (like content script pattern)
  logger.warn("No focus areas provided by background script", { context: 'focus_areas_fallback' });
  return DEFAULT_FOCUS_AREAS;
}

/**
 * Enrich sessions with actual hint counts from hint_interactions table
 */
async function enrichSessionsWithHintCounts(sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return sessions;
  }

  // Get hint counts for all sessions in parallel
  const sessionsWithHints = await Promise.all(
    sessions.map(async (session) => {
      try {
        const sessionId = session.id || session.sessionId || session.SessionID;
        if (!sessionId) {
          return { ...session, hintsUsed: 0 };
        }

        // Get hint interactions for this session
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

/**
 * Fetch all required data for dashboard statistics
 */
async function fetchDashboardData() {
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

/**
 * Create mappings from standard problems to user problems for dashboard
 */
function createDashboardProblemMappings(allProblems, allStandardProblems) {
  console.log('🏗️ createDashboardProblemMappings called:', {
    allProblemsCount: allProblems?.length || 0,
    allStandardProblemsCount: allStandardProblems?.length || 0,
    sampleStandardProblem: allStandardProblems?.[0]
  });

  const problemDifficultyMap = {};
  const problemTagsMap = new Map();
  const standardProblemsMap = {};

  allStandardProblems.forEach((standardProblem) => {
    standardProblemsMap[standardProblem.id] = standardProblem;
  });

  allProblems.forEach((problem) => {
    const standardProblem = standardProblemsMap[problem.leetcode_id];
    problemDifficultyMap[problem.problem_id] = standardProblem?.difficulty || "Medium";
    if (standardProblem) {
      problemTagsMap.set(problem.problem_id, standardProblem.tags || []);
    }
  });

  return { problemDifficultyMap, problemTagsMap, standardProblemsMap };
}

/**
 * Apply focus area and date range filtering to data
 */
function applyFiltering({ allProblems, allAttempts, allSessions, problemTagsMap, focusAreaFilter, dateRange }) {
  let filteredProblems = allProblems;
  let filteredAttempts = allAttempts;

  // Filter to only include completed sessions
  // Dashboard should not display incomplete/abandoned sessions
  let filteredSessions = allSessions.filter(session => session.status === 'completed');

  // Apply focus area filtering if specified
  if (focusAreaFilter && focusAreaFilter.length > 0) {
    const focusAreaProblemIds = new Set();
    allProblems.forEach((problem) => {
      const problemTags = problemTagsMap.get(problem.id) || [];
      const hasFocusAreaTag = focusAreaFilter.some(tag => problemTags.includes(tag));
      if (hasFocusAreaTag) {
        focusAreaProblemIds.add(problem.id);
      }
    });

    filteredProblems = allProblems.filter(problem => focusAreaProblemIds.has(problem.id));
    filteredAttempts = allAttempts.filter(attempt => focusAreaProblemIds.has(attempt.problem_id || attempt.ProblemID));
    
    // Filter sessions that contain focus area problems
    filteredSessions = allSessions.filter(session => {
      if (!session.problems) return false;
      return session.problems.some(problem => focusAreaProblemIds.has(problem.id));
    });
  }

  // Apply date range filtering if specified
  if (dateRange && (dateRange.startDate || dateRange.endDate)) {
    const startDate = dateRange.startDate ? new Date(dateRange.startDate) : new Date(0);
    const endDate = dateRange.endDate ? new Date(dateRange.endDate) : new Date();

    filteredAttempts = filteredAttempts.filter((attempt) => {
      const attemptDate = new Date(attempt.attempt_date || attempt.AttemptDate);
      return attemptDate >= startDate && attemptDate <= endDate;
    });

    filteredSessions = filteredSessions.filter((session) => {
      const sessionDate = new Date(session.date);
      return sessionDate >= startDate && sessionDate <= endDate;
    });
  }

  return { filteredProblems, filteredAttempts, filteredSessions };
}

/**
 * Calculate core problem statistics from filtered data
 */
function calculateCoreStatistics(filteredProblems, filteredAttempts, problemDifficultyMap) {
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

/**
 * Calculate derived metrics from core statistics
 */
function calculateDerivedMetrics(timeStats, successStats) {
  const calculateAverage = (totalTimeInSeconds, count) =>
    count > 0
      ? AccurateTimer.secondsToMinutes(totalTimeInSeconds / count, 1)
      : 0;

  const calculateSuccessRate = (successful, total) =>
    total > 0 ? parseInt((successful / total) * 100) : 0;

  const averageTime = {
    overall: calculateAverage(timeStats.overall.totalTime, timeStats.overall.count),
    Easy: calculateAverage(timeStats.Easy.totalTime, timeStats.Easy.count),
    Medium: calculateAverage(timeStats.Medium.totalTime, timeStats.Medium.count),
    Hard: calculateAverage(timeStats.Hard.totalTime, timeStats.Hard.count),
  };

  const successRate = {
    overall: calculateSuccessRate(successStats.overall.successful, successStats.overall.total),
    Easy: calculateSuccessRate(successStats.Easy.successful, successStats.Easy.total),
    Medium: calculateSuccessRate(successStats.Medium.successful, successStats.Medium.total),
    Hard: calculateSuccessRate(successStats.Hard.successful, successStats.Hard.total),
  };

  return { averageTime, successRate };
}

/**
 * Generate analytics and derived data
 */
async function generateAnalyticsData(filteredSessions, filteredAttempts, learningState) {
  const [sessionAnalytics, masteryData, goalsData, learningEfficiencyData] = await Promise.all([
    generateSessionAnalytics(filteredSessions, filteredAttempts),
    generateMasteryData(learningState),
    generateGoalsData(),
    generateLearningEfficiencyChartData(filteredSessions, filteredAttempts)
  ]);

  return { sessionAnalytics, masteryData, goalsData, learningEfficiencyData };
}

/**
 * Calculate derived metrics from attempts and sessions
 */
function calculateProgressMetrics(filteredAttempts, filteredSessions, problemDifficultyMap) {
  const timerBehavior = calculateTimerBehavior(filteredAttempts, problemDifficultyMap) || "No data";
  const timerPercentage = calculateTimerPercentage(filteredAttempts, problemDifficultyMap) || 0;
  const learningStatus = calculateLearningStatus(filteredAttempts, filteredSessions) || "No Data";
  const progressTrendData = calculateProgressTrend(filteredAttempts) || { trend: "No Data", percentage: 0 };

  return {
    timerBehavior,
    timerPercentage,
    learningStatus,
    progressTrend: progressTrendData.trend,
    progressPercentage: progressTrendData.percentage
  };
}

/**
 * Calculate strategy success rate - percentage of successful attempts for strategy-selected problems
 * @param {Array} sessions - All sessions with problems array
 * @param {Array} attempts - All attempts
 * @returns {number} Percentage of successful attempts for strategy-selected problems (0-100)
 */
function calculateStrategySuccessRate(sessions, attempts) {
  try {
    if (!sessions || sessions.length === 0 || !attempts || attempts.length === 0) {
      return 0;
    }

    // Create a map of problem_id to selection_reason from sessions
    const problemSelectionMap = new Map();

    sessions.forEach(session => {
      if (session.problems && Array.isArray(session.problems)) {
        session.problems.forEach(problem => {
          // Check for selection_reason field (snake_case from database)
          const selectionReason = problem.selection_reason || problem.selectionReason;
          if (selectionReason && problem.problem_id) {
            problemSelectionMap.set(problem.problem_id, selectionReason);
          }
        });
      }
    });

    // If no problems have selection reasons, return 0
    if (problemSelectionMap.size === 0) {
      logger.info("No strategy-selected problems found", { context: 'strategy_success' });
      return 0;
    }

    // Filter attempts that have a selection reason (were selected by a strategy)
    const strategyAttempts = attempts.filter(attempt => {
      const problemId = attempt.problem_id;
      return problemSelectionMap.has(problemId);
    });

    if (strategyAttempts.length === 0) {
      logger.info("No attempts for strategy-selected problems", { context: 'strategy_success' });
      return 0;
    }

    // Count successful attempts (handle both snake_case and camelCase)
    const successfulAttempts = strategyAttempts.filter(attempt => {
      const success = attempt.success !== undefined ? attempt.success : attempt.Success;
      return success === true || success === 1;
    });

    // Calculate percentage
    const successRate = Math.round((successfulAttempts.length / strategyAttempts.length) * 100);

    logger.info("Strategy success rate calculated", {
      totalStrategyAttempts: strategyAttempts.length,
      successfulAttempts: successfulAttempts.length,
      successRate,
      context: 'strategy_success'
    });

    return successRate;
  } catch (error) {
    logger.error("Error calculating strategy success rate:", error);
    return 0;
  }
}

/**
 * Get hint analytics data from service
 */
async function getHintAnalytics() {
  let hintsUsed = { total: 0, contextual: 0, general: 0, primer: 0 };
  
  try {
    logger.info("Getting hint analytics directly from service", { context: 'dashboard_hints' });
    
    const analytics = await HintInteractionService.getSystemAnalytics({});
    
    // Transform analytics data to match expected UI structure
    hintsUsed.total = analytics.overview?.totalInteractions || 0;
    
    // Extract hint type counts from analytics
    if (analytics.trends?.hintTypePopularity) {
      analytics.trends.hintTypePopularity.forEach(hint => {
        if (hintsUsed[hint.hintType] !== undefined) {
          hintsUsed[hint.hintType] = hint.count;
        }
      });
    }
    
    logger.info("Successfully retrieved hint analytics", { hintsUsed, context: 'dashboard_hints' });
  } catch (error) {
    logger.error("Failed to get hint analytics", { error, context: 'dashboard_hints' });
  }
  
  return hintsUsed;
}

/**
 * Construct final dashboard data object with all metrics
 */
function constructDashboardData({
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
  logger.info("Data verification", { totalProblems: allProblems.length, context: 'data_verification' });
  logger.info("Data verification", { totalAttempts: allAttempts.length, context: 'data_verification' });
  logger.info("Data verification", { boxLevelData, context: 'data_verification' });
  logger.info("Data verification", { timerBehavior, context: 'data_verification' });
  logger.info("Data verification", { statistics, context: 'data_verification' });
  logger.info("- Flattened Structure Keys:", Object.keys(dashboardData));

  return dashboardData;
}

export async function getDashboardStatistics(options = {}) {
  try {
    const { focusAreaFilter = null, dateRange = null } = options;
    
    const { allProblems, allAttempts, allSessions, allStandardProblems, learningState, boxLevelData } = await fetchDashboardData();
    const { problemDifficultyMap, problemTagsMap, standardProblemsMap } = createDashboardProblemMappings(allProblems, allStandardProblems);

    // Apply filtering based on focus areas and date range
    const { filteredProblems, filteredAttempts, filteredSessions } = applyFiltering({
      allProblems,
      allAttempts, 
      allSessions,
      problemTagsMap,
      focusAreaFilter,
      dateRange
    });

    // Calculate core statistics and derived metrics
    const { statistics, timeStats, successStats } = calculateCoreStatistics(filteredProblems, filteredAttempts, problemDifficultyMap);
    const { averageTime, successRate } = calculateDerivedMetrics(timeStats, successStats);

    // Generate analytics and derived data
    const { sessionAnalytics, masteryData, goalsData, learningEfficiencyData } = await generateAnalyticsData(filteredSessions, filteredAttempts, learningState);

    // Calculate progress metrics
    const { timerBehavior, timerPercentage, learningStatus, progressTrend, progressPercentage } = calculateProgressMetrics(filteredAttempts, filteredSessions, problemDifficultyMap);

    // Calculate strategy success rate
    const strategySuccessRate = calculateStrategySuccessRate(filteredSessions, filteredAttempts);

    // Calculate next review data and get hint analytics
    const [nextReviewData, hintsUsed] = await Promise.all([
      calculateNextReviewData(),
      getHintAnalytics()
    ]);
    const nextReviewTime = nextReviewData?.nextReviewTime || "Schedule unavailable";
    const nextReviewCount = nextReviewData?.nextReviewCount || 0;

    // Construct and return final dashboard data
    return constructDashboardData({
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
    });
  } catch (error) {
    logger.error("Error calculating dashboard statistics:", error);
    throw error;
  }
}

// Helper function to handle cache checking
function checkAnalyticsCache(cacheKey, useCache) {
  if (!useCache || !analyticsCache.has(cacheKey)) {
    return null;
  }
  
  const cached = analyticsCache.get(cacheKey);
  const now = Date.now();
  if (now - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  analyticsCache.delete(cacheKey);
  return null;
}

// Helper function to fetch and prepare analytics data
async function fetchAnalyticsData(startDate, endDate) {
  const [allProblems, allAttempts, allSessions, allStandardProblems, learningState, recentSessionAnalytics] = await Promise.all([
    fetchAllProblems(),
    getAllAttempts(),
    getAllSessions(),
    getAllStandardProblems(),
    TagService.getCurrentLearningState(),
    getRecentSessionAnalytics(50),
  ]);
  
  const { standardProblemsMap, problemTagsMap } = createProblemMappings(allProblems, allStandardProblems);
  const { filteredAttempts, filteredSessions } = filterDataByDateRange(allAttempts, allSessions, startDate, endDate);
  
  return {
    allProblems,
    filteredAttempts,
    filteredSessions,
    problemTagsMap,
    standardProblemsMap,
    learningState,
    recentSessionAnalytics,
  };
}

// Helper function to perform conditional analytics calculations
async function performAnalyticsCalculations(targetFocusAreas, analyticsData, includeProgressTracking, includeEffectivenessAnalysis) {
  const { filteredAttempts, allProblems, problemTagsMap, standardProblemsMap, learningState, recentSessionAnalytics } = analyticsData;
  
  // Calculate focus area performance metrics
  const focusAreaPerformance = await calculateFocusAreaPerformance(
    targetFocusAreas,
    filteredAttempts,
    allProblems,
    problemTagsMap,
    standardProblemsMap
  );
  
  // Calculate progress tracking if requested
  let progressTracking = {};
  if (includeProgressTracking) {
    progressTracking = await calculateFocusAreaProgress({
      focusAreas: targetFocusAreas,
      attempts: filteredAttempts,
      problemTagsMap,
      learningState
    });
  }
  
  // Calculate effectiveness analysis if requested
  let effectiveness = {};
  if (includeEffectivenessAnalysis) {
    effectiveness = await calculateFocusAreaEffectiveness(
      targetFocusAreas,
      focusAreaPerformance,
      progressTracking,
      learningState
    );
  }
  
  // Integrate session analytics data
  const sessionAnalyticsIntegration = integrateFocusAreaSessionAnalytics(
    targetFocusAreas,
    recentSessionAnalytics,
    problemTagsMap
  );
  
  return { focusAreaPerformance, progressTracking, effectiveness, sessionAnalyticsIntegration };
}

// Helper function to store analytics results in cache
function storeAnalyticsCache(cacheKey, result, useCache) {
  if (useCache) {
    analyticsCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    });
    cleanupAnalyticsCache(analyticsCache);
  }
}

export async function getFocusAreaAnalytics(options = {}) {
  try {
    const {
      focusAreas = null,
      startDate = null,
      endDate = null,
      includeProgressTracking = true,
      includeEffectivenessAnalysis = true,
      useCache = true,
    } = options;

    // Create cache key based on options
    const cacheKey = JSON.stringify({
      focusAreas,
      startDate,
      endDate,
      includeProgressTracking,
      includeEffectivenessAnalysis,
    });

    // Check cache if enabled
    const cachedResult = checkAnalyticsCache(cacheKey, useCache);
    if (cachedResult) {
      return cachedResult;
    }

    // Get user's focus areas if not provided
    const targetFocusAreas = await getTargetFocusAreas(focusAreas);

    if (targetFocusAreas.length === 0) {
      return {
        focusAreas: [],
        performance: {},
        progressTracking: {},
        effectiveness: {},
        recommendations: [],
        insights: ["No focus areas configured. Set focus areas in Settings to get detailed analytics."],
      };
    }

    // Fetch and prepare all analytics data
    const analyticsData = await fetchAnalyticsData(startDate, endDate);

    // Perform analytics calculations
    const { focusAreaPerformance, progressTracking, effectiveness, sessionAnalyticsIntegration } = 
      await performAnalyticsCalculations(targetFocusAreas, analyticsData, includeProgressTracking, includeEffectivenessAnalysis);

    // Generate insights and recommendations
    const insights = generateFocusAreaInsights(focusAreaPerformance, progressTracking, effectiveness);
    const recommendations = generateFocusAreaRecommendations(focusAreaPerformance, effectiveness, analyticsData.learningState);

    const result = {
      focusAreas: targetFocusAreas,
      performance: focusAreaPerformance,
      progressTracking,
      effectiveness,
      sessionAnalytics: sessionAnalyticsIntegration,
      insights,
      recommendations,
      metadata: {
        dateRange: { startDate, endDate },
        totalAttempts: analyticsData.filteredAttempts.length,
        totalSessions: analyticsData.filteredSessions.length,
        generatedAt: new Date().toISOString(),
        cacheKey,
      },
    };

    // Store result in cache
    storeAnalyticsCache(cacheKey, result, useCache);

    return result;
  } catch (error) {
    logger.error("Error calculating focus area analytics:", error);
    throw error;
  }
}

// calculateFocusAreaPerformance moved to focusAreaHelpers.js


// generateFocusAreaInsights moved to focusAreaInsights.js





// Utility function to clear analytics cache (useful for testing or data updates)
export function clearFocusAreaAnalyticsCache() {
  analyticsCache.clear();
}

// Global dashboard cache invalidation function
export function invalidateAllDashboardCaches() {
  // Clear internal service caches
  clearFocusAreaAnalyticsCache();

  // Clear Chrome message cache for all dashboard data types
  if (typeof window !== 'undefined') {
    // Clear all dashboard-related cache entries
    console.log('🔄 Dashboard caches invalidation removed');
  }
}

// Session-specific cache invalidation (called when sessions are completed)
export function invalidateDashboardOnSessionComplete() {
  console.log('📊 Session completed - invalidating dashboard caches');
  invalidateAllDashboardCaches();

  // Notify any listeners that data has been updated
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dashboardDataUpdated', {
      detail: { reason: 'sessionCompleted', timestamp: Date.now() }
    }));
  }
}

/**
 * Generate session analytics data structure matching mock service format
 */
export function generateSessionAnalytics(sessions, attempts) {
  const enhancedSessions = sessions.map((session, index) => {
    // Calculate session metrics from attempts (support both snake_case and PascalCase)
    const sessionAttempts = attempts.filter(attempt => {
      const attemptSessionId = attempt.session_id || attempt.SessionID;
      const attemptDate = attempt.attempt_date || attempt.AttemptDate;
      return attemptSessionId === session.sessionId ||
        (session.date && Math.abs(new Date(session.date) - new Date(attemptDate)) < 60 * 60 * 1000); // Within 1 hour
    });

    const duration = session.duration ||
      (sessionAttempts.length > 0 ? sessionAttempts.reduce((sum, a) => sum + (Number(a.time_spent || a.TimeSpent) || 0), 0) / 60 : 30); // Convert to minutes

    // Use accuracy stored in session (calculated during session completion)
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
        difficulty: "Medium", // Would need to look up from standard problems
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
 * Build dynamic tag relationships from actual attempt history
 * Shows which tags appear together in problems the user has attempted
 */
function buildDynamicTagRelationships(attempts, problems) {
  const tagCoOccurrence = new Map(); // Map of "tag1:tag2" -> { strength, problems, successCount }
  // Map by leetcode_id since that's what attempts use
  const problemMap = new Map(problems.map(p => [p.leetcode_id || p.id, p]));

  console.log('🔨 buildDynamicTagRelationships:', {
    attemptsCount: attempts.length,
    problemsCount: problems.length,
    sampleProblem: problems[0],
    sampleAttempt: attempts[0]
  });

  let skipped = 0;
  let processed = 0;

  attempts.forEach(attempt => {
    // Try multiple field names for problem ID
    const problemId = attempt.leetcode_id || attempt.ProblemID || attempt.problem_id;
    const problem = problemMap.get(problemId);

    if (!problem) {
      console.log('⚠️ No problem found for attempt:', { problemId, attempt });
      skipped++;
      return;
    }

    const tags = problem.tags;
    if (!tags) {
      console.log('⚠️ Problem has no tags:', problem);
      skipped++;
      return;
    }
    if (tags.length < 2) {
      console.log('⚠️ Problem has only 1 tag:', tags, 'problem:', problem.id || problem.leetcode_id);
      skipped++;
      return;
    }

    processed++;
    const success = attempt.success;

    // Create connections between all tag pairs in this problem
    for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        const tag1 = tags[i].toLowerCase();
        const tag2 = tags[j].toLowerCase();
        const key = tag1 < tag2 ? `${tag1}:${tag2}` : `${tag2}:${tag1}`;

        if (!tagCoOccurrence.has(key)) {
          tagCoOccurrence.set(key, {
            tag1: tag1 < tag2 ? tag1 : tag2,
            tag2: tag1 < tag2 ? tag2 : tag1,
            strength: 0,
            problems: [],
            successCount: 0
          });
        }

        const connection = tagCoOccurrence.get(key);
        connection.strength++;
        if (success) connection.successCount++;

        // Only keep top 3 problems for tooltip
        if (connection.problems.length < 3) {
          connection.problems.push({
            id: problem.id,
            title: problem.title || `Problem ${problem.id}`,
            success: success,
            difficulty: problem.difficulty
          });
        }
      }
    }
  });

  // Convert to object with success rates
  const relationships = {};
  tagCoOccurrence.forEach((data, key) => {
    relationships[key] = {
      ...data,
      successRate: data.strength > 0 ? Math.round((data.successCount / data.strength) * 100) : 0
    };
  });

  console.log('✅ buildDynamicTagRelationships complete:', {
    processed,
    skipped,
    relationshipsCreated: Object.keys(relationships).length,
    sampleRelationship: Object.keys(relationships)[0] ? relationships[Object.keys(relationships)[0]] : null
  });

  return relationships;
}

/**
 * Generate enhanced mastery data with focus areas integration
 */
export async function generateMasteryData(learningState) {
  try {
    const settings = await StorageService.getSettings();

    // Get user's actual active focus tags from session_state
    // This is the source of truth for what the user is currently focusing on
    const sessionState = await StorageService.getSessionState();
    const focusTags = sessionState?.current_focus_tags || settings.focusAreas || [];

    // Enhance mastery data with focus area information (support both snake_case and PascalCase)
    const enhancedMasteryData = (learningState.masteryData || []).map(mastery => {
      const totalAttempts = mastery.total_attempts ?? mastery.totalAttempts ?? 0;
      const successfulAttempts = mastery.successful_attempts ?? mastery.successfulAttempts ?? 0;

      return {
        ...mastery,
        isFocus: focusTags.includes(mastery.tag),
        progress: totalAttempts > 0 ?
          calculateProgressPercentage(successfulAttempts, totalAttempts) :
          0,
        hintHelpfulness: calculateSuccessRate(successfulAttempts, totalAttempts) > 0.8 ? "low" :
                        calculateSuccessRate(successfulAttempts, totalAttempts) > 0.5 ? "medium" : "high"
      };
    });

    // Get all tags from tag_relationships for comprehensive display
    // This runs in background context so we CAN access IndexedDB
    const allTagRelationships = await getTagRelationships();
    // getTagRelationships returns an object where keys are tag IDs
    const allKnownTags = Object.keys(allTagRelationships);

    // Create map of tags with mastery data
    const masteryMap = new Map(enhancedMasteryData.map(m => [m.tag, m]));

    // Build comprehensive tag list for "Overall Mastery" view
    // - Tags with data: use actual mastery data
    // - Tags without data: show as placeholder with 0 attempts
    const allTagsWithData = allKnownTags.map(tagName => {
      if (masteryMap.has(tagName)) {
        return masteryMap.get(tagName);
      } else {
        return {
          tag: tagName,
          total_attempts: 0,
          successful_attempts: 0,
          mastered: false,
          isFocus: focusTags.includes(tagName),
          progress: 0,
          hintHelpfulness: "low"
        };
      }
    });

    // Build current tier tag list
    // - Only include tags that are in allTagsInCurrentTier
    // - For tags with data: use actual mastery data
    // - For tags without data: show as placeholder with 0 attempts
    const tierTags = (learningState.allTagsInCurrentTier || []);
    const currentTierTagsWithData = tierTags.map(tagName => {
      if (masteryMap.has(tagName)) {
        return masteryMap.get(tagName);
      } else {
        return {
          tag: tagName,
          total_attempts: 0,
          successful_attempts: 0,
          mastered: false,
          isFocus: focusTags.includes(tagName),
          progress: 0,
          hintHelpfulness: "low"
        };
      }
    });

    return {
      currentTier: learningState.currentTier || "Core Concept",
      masteredTags: learningState.masteredTags || [],
      allTagsInCurrentTier: learningState.allTagsInCurrentTier || [],
      focusTags,
      tagsinTier: learningState.tagsinTier || learningState.allTagsInCurrentTier || [], // Use allTagsInCurrentTier as fallback
      unmasteredTags: learningState.unmasteredTags || [],
      masteryData: enhancedMasteryData, // Tags with actual attempts
      allTagsData: allTagsWithData, // All known tags (for Overall view)
      tierTagsData: currentTierTagsWithData, // Current tier tags (for Tier view)
      learningState: {
        ...learningState,
        focusTags,
        masteryData: enhancedMasteryData
      }
    };
  } catch (error) {
    logger.error("Error generating mastery data:", error.message || error.toString());
    console.error("Full error stack:", error);
    return {
      currentTier: "Core Concept",
      masteredTags: [],
      allTagsInCurrentTier: [],
      focusTags: [],
      tagsinTier: [],
      unmasteredTags: [],
      masteryData: [],
      allTagsData: [],
      tierTagsData: [],
      learningState: {}
    };
  }
}

/**
 * Calculate outcome trends metrics for Goals page
 */
function calculateOutcomeTrends(attempts, _sessions, userSettings = {}, providedHints = null) {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Calculate user's actual weekly target from their cadence settings
  const sessionsPerWeek = userSettings.sessionsPerWeek || 2;
  const sessionLength = userSettings.sessionLength;
  const maxProblemsPerSession = sessionLength === 'auto' ? 12 : (typeof sessionLength === 'number' ? sessionLength : 5);
  const userWeeklyTarget = sessionsPerWeek * maxProblemsPerSession;

  // Weekly Accuracy Target (support both snake_case and PascalCase)
  // Filter attempts from last 7 days, with validation for date field
  const weeklyAttempts = attempts.filter(attempt => {
    const attemptDateValue = attempt.attempt_date || attempt.AttemptDate;
    if (!attemptDateValue) {
      console.warn("⚠️ Attempt missing date:", attempt.id);
      return false;
    }

    const attemptDate = new Date(attemptDateValue);
    // Check if date is valid
    if (isNaN(attemptDate.getTime())) {
      console.warn("⚠️ Attempt has invalid date:", attempt.id, attemptDateValue);
      return false;
    }

    const isWithinWeek = attemptDate >= oneWeekAgo;
    return isWithinWeek;
  });

  const successfulAttempts = weeklyAttempts.filter(a => (a.success !== undefined ? a.success : a.Success));
  const weeklyAccuracy = weeklyAttempts.length > 0
    ? Math.round((successfulAttempts.length / weeklyAttempts.length) * 100)
    : 0;

  console.log("📊 Weekly Accuracy Calculation:", {
    weeklyAttemptsCount: weeklyAttempts.length,
    successfulAttemptsCount: successfulAttempts.length,
    weeklyAccuracy: `${weeklyAccuracy}%`
  });

  // Problems Per Week
  const weeklyProblems = new Set(weeklyAttempts.map(a => a.problem_id || a.ProblemID)).size;
  
  // Hint Efficiency - use provided hint analytics data from background script
  let hintEfficiency = "2.5";
  if (providedHints && providedHints.total > 0 && weeklyAttempts.length > 0) {
    // Use real hint data passed from background script
    // Use weeklyAttempts.length (not weeklyProblems) to capture review attempts
    const hintsPerAttempt = weeklyAttempts.length > 0
      ? providedHints.total / weeklyAttempts.length
      : 0;
    hintEfficiency = hintsPerAttempt > 0 ? hintsPerAttempt.toFixed(1) : "0.0";
  } else {
    // Fallback to estimate based on success patterns
    const successRate = weeklyAccuracy / 100;
    const estimatedHints = successRate > 0.8 ? 1.5 : successRate > 0.6 ? 2.0 : 3.0;
    hintEfficiency = estimatedHints.toFixed(1);
  }
  
  // Learning Velocity - based on recent trend
  const progressTrendData = calculateProgressTrend(attempts);
  let learningVelocity = "Steady";
  if (progressTrendData.trend.includes("Rapidly")) {
    learningVelocity = "Accelerating";
  } else if (progressTrendData.trend.includes("Improving")) {
    learningVelocity = "Progressive";
  } else if (progressTrendData.trend.includes("Declining")) {
    learningVelocity = "Slowing";
  }
  
  // Calculate status indicators
  const weeklyAccuracyStatus = weeklyAccuracy >= 75 ? "excellent" : weeklyAccuracy >= 65 ? "on_track" : "behind";
  // Calculate status based on percentage of user's actual target achieved
  const targetPercentage = userWeeklyTarget > 0 ? (weeklyProblems / userWeeklyTarget) * 100 : 0;
  const problemsPerWeekStatus = targetPercentage >= 100 ? "excellent" : targetPercentage >= 80 ? "on_track" : "behind";
  const hintEfficiencyStatus = parseFloat(hintEfficiency) <= 2.0 ? "excellent" : parseFloat(hintEfficiency) <= 3.0 ? "on_track" : "behind";
  const learningVelocityStatus = learningVelocity === "Accelerating" ? "excellent" : 
                                 learningVelocity === "Progressive" ? "on_track" : 
                                 learningVelocity === "Slowing" ? "behind" : "adaptive";
  
  return {
    weeklyAccuracy: {
      value: weeklyAccuracy,
      status: weeklyAccuracyStatus,
      target: 75
    },
    problemsPerWeek: {
      value: weeklyProblems,
      status: problemsPerWeekStatus,
      target: userWeeklyTarget,
      display: weeklyProblems.toString()
    },
    hintEfficiency: {
      value: parseFloat(hintEfficiency),
      status: hintEfficiencyStatus,
      display: `<${hintEfficiency} per problem`
    },
    learningVelocity: {
      value: learningVelocity,
      status: learningVelocityStatus
    }
  };
}


/**
 * Generate goals/learning plan data structure with enhanced metrics
 */
// eslint-disable-next-line require-await
export async function generateGoalsData(providedData = {}) {
  try {
    // Get consistent focus areas from background script (no direct service calls)
    const initialFocusAreas = getInitialFocusAreas(providedData.focusAreas);

    // Use provided data or fallbacks - no direct service calls
    const settings = providedData.settings || {
      sessionsPerWeek: 5,
      sessionLength: "auto",
      focusAreas: initialFocusAreas,
      difficultyDistribution: { easy: 20, medium: 60, hard: 20 },
      reviewRatio: 40,
      numberofNewProblemsPerSession: 4
    };
    
    const allAttempts = providedData.allAttempts || [];
    const allSessions = providedData.allSessions || [];
    const _learningState = providedData.learningState || null;
    const hintsUsed = providedData.hintsUsed || { total: 0, contextual: 0, general: 0, primer: 0 };
    
    // Calculate outcome trends from provided data
    const outcomeTrends = allAttempts.length > 0 && allSessions.length > 0
      ? calculateOutcomeTrends(allAttempts, allSessions, settings, hintsUsed)
      : (() => {
          // Calculate fallback target using same logic as calculateOutcomeTrends
          const fallbackSessionsPerWeek = settings.sessionsPerWeek || 2;
          const fallbackSessionLength = settings.sessionLength;
          const fallbackMaxProblems = fallbackSessionLength === 'auto'
            ? 12
            : (typeof fallbackSessionLength === 'number' ? fallbackSessionLength : 5);
          const fallbackTarget = fallbackSessionsPerWeek * fallbackMaxProblems;

          return {
            weeklyAccuracy: { value: 0, status: "behind", target: 75 },
            problemsPerWeek: { value: 0, status: "behind", target: fallbackTarget, display: "0" },
            hintEfficiency: { value: 0, status: "behind", display: "0 hints/problem" },
            learningVelocity: { value: "Steady", status: "adaptive" }
          };
        })();

    return {
      learningPlan: {
        cadence: {
          sessionsPerWeek: settings.sessionsPerWeek || 5,
          sessionLength: settings.sessionLength ?? "auto", // Use nullish coalescing - only default if null/undefined
          flexibleSchedule: settings.flexibleSchedule !== false
        },
        focus: {
          primaryTags: settings.focusAreas || [], // Match session generation default
          userFocusAreas: providedData.userFocusAreas || [], // User-selected focus areas
          systemFocusTags: providedData.systemFocusTags || [], // System-recommended focus tags
          activeFocusTags: providedData.focusDecision?.activeFocusTags || (settings.focusAreas || []), // What sessions actually use
          algorithmReasoning: providedData.focusDecision?.algorithmReasoning || null, // Why algorithm made its decision
          onboarding: providedData.focusDecision?.onboarding || false, // Whether user is in onboarding
          performanceLevel: providedData.focusDecision?.performanceLevel || null, // Current performance level
          difficultyDistribution: settings.difficultyDistribution || { easy: 20, medium: 60, hard: 20 },
          reviewRatio: settings.reviewRatio || 40
        },
        guardrails: {
          minReviewRatio: 30,
          maxNewProblems: settings.numberofNewProblemsPerSession || 4, // Match session generation default
          difficultyCapEnabled: true,
          maxDifficulty: "Medium",
          hintLimitEnabled: false,
          maxHintsPerProblem: 3
        },
        outcomeTrends
      }
    };
  } catch (error) {
    logger.error("Error generating goals data:", error);
    return {
      learningPlan: {
        cadence: { sessionsPerWeek: 5, sessionLength: "auto", flexibleSchedule: true },
        focus: { primaryTags: [], difficultyDistribution: { easy: 20, medium: 60, hard: 20 }, reviewRatio: 40 },
        guardrails: { minReviewRatio: 30, maxNewProblems: 5, difficultyCapEnabled: true, maxDifficulty: "Medium", hintLimitEnabled: false, maxHintsPerProblem: 3 },
        outcomeTrends: {
          weeklyAccuracy: { value: 0, status: "behind", target: 75 },
          problemsPerWeek: { value: 0, status: "behind", target: "25-30", display: "0" },
          hintEfficiency: { value: 0, status: "behind", display: "<0 per problem" },
          learningVelocity: { value: "Steady", status: "adaptive" }
        }
      }
    };
  }
}

/**
 * Calculate current streak days from session history
 */
function calculateStreakDays(sessions) {
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
function findBestPerformanceHour(sessions) {
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
    const score = avgAccuracy * Math.min(data.total, 5); // Weight by frequency but cap at 5
    
    if (score > bestScore) {
      bestScore = score;
      bestHour = hour;
    }
  });
  
  return bestHour;
}


/**
 * Generate learning efficiency chart data for different time periods
 * Learning efficiency = problems solved per hint used over time
 */
async function generateLearningEfficiencyChartData(sessions, attempts) {
  // Debug: Check if function is called
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

  // Group sessions by time periods
  const now = new Date();
  const weekly = [];
  const monthly = [];
  const yearly = [];

  // Generate weekly data (last 12 weeks)
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

  // Generate monthly data (last 12 months) 
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

  // Generate yearly data (last 3 years)
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
 * Efficiency = successful problems / total hints used
 */
async function calculatePeriodEfficiency(sessions, allAttempts) {
  if (sessions.length === 0) return 0;

  // Get session IDs for this period
  const sessionIds = new Set(sessions.map(s => s.id || s.sessionId || s.SessionID));

  // Find attempts from these sessions (support both snake_case and PascalCase)
  const periodAttempts = allAttempts.filter(attempt => {
    const attemptSessionId = attempt.session_id || attempt.SessionID;
    return sessionIds.has(attemptSessionId) || sessionIds.has(attempt.sessionId);
  });

  if (periodAttempts.length === 0) return 0;

  // Count successful problems
  const successfulProblems = periodAttempts.filter(attempt => (attempt.success !== undefined ? attempt.success : attempt.Success)).length;

  // Try to get actual hint usage data from hint_interactions table
  let totalHintsUsed = 0;
  try {
    // Use static import for hint functions

    // Get hint interactions for all sessions in this period
    const hintPromises = Array.from(sessionIds).map(sessionId =>
      getInteractionsBySession(sessionId).catch(() => [])
    );
    const hintResults = await Promise.all(hintPromises);

    // Count total hints used across all sessions
    totalHintsUsed = hintResults.flat().length;

    // Debug logging
    console.log('📊 Learning Efficiency Debug:', {
      sessionIds: Array.from(sessionIds),
      totalSessions: sessions.length,
      totalAttempts: periodAttempts.length,
      successfulProblems,
      totalHintsUsed,
      hintResultsCount: hintResults.map(r => r.length)
    });
  } catch (error) {
    // If hint data is not available, fall back to estimation
    logger.warn("Could not fetch hint data, using estimation:", error);
    totalHintsUsed = 0;
  }

  // If no actual hint data available, estimate based on attempts and success patterns
  if (totalHintsUsed === 0) {
    const totalAttempts = periodAttempts.length;
    const failedAttempts = totalAttempts - successfulProblems;

    // Estimation: 1 hint per successful problem on first try, 2-3 hints per failed attempt
    totalHintsUsed = successfulProblems * 1.0 + failedAttempts * 2.5;

    console.log('📊 Using estimation - totalHintsUsed:', totalHintsUsed);
  }

  // Return efficiency (hints per problem), lower is better
  const efficiency = successfulProblems > 0 ? totalHintsUsed / successfulProblems : 0;
  console.log('📊 Final efficiency:', efficiency);
  return efficiency;
}

/**
 * Calculate timer behavior based on actual session timing performance
 * Now aligned with calculateTimerPercentage to use:
 * - Last 100 attempts (not 50)
 * - All attempts (not just successful ones)
 * - Difficulty-based time limits (Easy: 20min, Medium: 45min, Hard: 90min)
 * @param {Array} attempts - Array of attempt objects
 * @param {Object} problemDifficultyMap - Map of problem_id to difficulty string
 * @returns {string} Badge label for timer behavior
 */
function calculateTimerBehavior(attempts, problemDifficultyMap) {
  if (!attempts || attempts.length === 0) return "No data";

  const recentAttempts = attempts.slice(-100); // Last 100 attempts (aligned with percentage)
  const timelyAttempts = recentAttempts.filter(attempt => {
    const timeSpent = attempt.time_spent || attempt.TimeSpent;
    // Handle edge cases: zero/negative time or missing time
    if (timeSpent === undefined || timeSpent === null || timeSpent <= 0) return false;

    // Look up difficulty from the map (support both snake_case and PascalCase)
    const problemId = attempt.problem_id || attempt.ProblemID;
    const difficulty = problemDifficultyMap[problemId] || "Medium"; // Default to Medium if not found

    // Use difficulty-based time limits (time_spent is in seconds)
    const timeLimit = difficulty === "Easy" ? 1200 :    // 20 minutes
                     difficulty === "Hard" ? 5400 : 2700; // 90 minutes (Hard), 45 minutes (Medium)
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
function calculateLearningStatus(attempts, sessions) {
  if (!attempts || attempts.length === 0) return "No Data";
  
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  // Check for recent attempts in last 7 days (support both snake_case and PascalCase)
  const recentAttempts = attempts.filter(attempt =>
    new Date(attempt.attempt_date || attempt.AttemptDate) >= sevenDaysAgo
  );
  
  // Check for recent sessions in last 7 days
  const recentSessions = sessions.filter(session =>
    new Date(session.date) >= sevenDaysAgo
  );
  
  // Check for any activity in last 30 days (support both snake_case and PascalCase)
  const monthlyAttempts = attempts.filter(attempt =>
    new Date(attempt.attempt_date || attempt.AttemptDate) >= thirtyDaysAgo
  );
  
  // Determine status based on activity patterns
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
 * Calculate progress trend based on recent performance improvement
 */
function calculateProgressTrend(attempts) {
  if (!attempts || attempts.length < 10) {
    return { trend: "Insufficient Data", percentage: 0 };
  }
  
  // Sort attempts by date (support both snake_case and PascalCase)
  const sortedAttempts = attempts.sort((a, b) =>
    new Date(a.attempt_date || a.AttemptDate) - new Date(b.attempt_date || b.AttemptDate)
  );

  // Take last 40 attempts for comparison, split into two halves
  const recentAttempts = sortedAttempts.slice(-40);
  const midpoint = Math.floor(recentAttempts.length / 2);
  const olderHalf = recentAttempts.slice(0, midpoint);
  const newerHalf = recentAttempts.slice(midpoint);

  if (olderHalf.length === 0 || newerHalf.length === 0) {
    return { trend: "Insufficient Data", percentage: 0 };
  }

  // Calculate success rates for both halves
  const olderSuccessRate = olderHalf.filter(a => (a.success !== undefined ? a.success : a.Success)).length / olderHalf.length;
  const newerSuccessRate = newerHalf.filter(a => (a.success !== undefined ? a.success : a.Success)).length / newerHalf.length;
  
  // Calculate improvement
  const improvement = newerSuccessRate - olderSuccessRate;
  
  // Determine trend
  let trend = "Stable";
  if (improvement > 0.15) {
    trend = "Rapidly Improving";
  } else if (improvement > 0.05) {
    trend = "Improving";
  } else if (improvement < -0.15) {
    trend = "Declining";
  } else if (improvement < -0.05) {
    trend = "Slightly Declining";
  }
  
  // Calculate percentage based on current success rate (newer half)
  const percentage = Math.round(newerSuccessRate * 100);
  
  return { trend, percentage };
}

/**
 * Calculate percentage of attempts completed within reasonable time limits
 * @param {Array} attempts - Array of attempt objects
 * @param {Object} problemDifficultyMap - Map of problem_id to difficulty string
 * @returns {number} Percentage of attempts within time limits
 */
function calculateTimerPercentage(attempts, problemDifficultyMap) {
  if (!attempts || attempts.length === 0) return 0;

  const recentAttempts = attempts.slice(-100); // Last 100 attempts
  const withinLimits = recentAttempts.filter(attempt => {
    const timeSpent = attempt.time_spent || attempt.TimeSpent;
    // Handle edge cases: zero/negative time or missing time
    if (timeSpent === undefined || timeSpent === null || timeSpent <= 0) return false;

    // Look up difficulty from the map (support both snake_case and PascalCase)
    const problemId = attempt.problem_id || attempt.ProblemID;
    const difficulty = problemDifficultyMap[problemId] || "Medium"; // Default to Medium if not found

    // Use difficulty-based time limits (time_spent is in seconds)
    const timeLimit = difficulty === "Easy" ? 1200 :    // 20 minutes
                     difficulty === "Hard" ? 5400 : 2700; // 90 minutes (Hard), 45 minutes (Medium)
    return timeSpent <= timeLimit;
  });

  return Math.round((withinLimits.length / recentAttempts.length) * 100);
}

/**
 * Validate session object and return error response if invalid
 */
function validateSession(session) {
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
  
  return null; // Valid session
}

/**
 * Calculate next review time and count using direct SessionService access
 * Runs directly in background context so no Chrome messaging needed
 */
async function calculateNextReviewData() {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      // Direct database access to avoid circular dependency with SessionService
      const session = await getLatestSession();
      
      // Process session data
      const validationError = validateSession(session);
      if (validationError) return validationError;
      
      logger.info('📊 Dashboard received session object:', session);

          // Handle both session.problems array and session.problemCount formats
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
          
          // Format next review time based on session state
          const now = new Date();
          const nextReview = new Date();
          
          // If problems are remaining in current session, show immediate availability
          if (problemsRemaining > 0) {
            nextReview.setMinutes(nextReview.getMinutes() + 5); // Show 5 minutes from now
          } else {
            // Schedule for later today or tomorrow based on current time
            const currentHour = now.getHours();
            if (currentHour >= 20) {
              // After 8 PM, schedule for tomorrow morning
              nextReview.setDate(nextReview.getDate() + 1);
              nextReview.setHours(9, 0, 0, 0);
            } else if (currentHour < 9) {
              // Before 9 AM, schedule for later today
              nextReview.setHours(14, 0, 0, 0);
            } else {
              // During the day, schedule for later today
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
      // No Chrome extension API available (development mode)
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

/**
 * Page-specific data fetching functions
 * Each function returns only the data needed for a specific page
 */

/**
 * Get data specifically for the Learning Progress page
 */
export async function getLearningProgressData(options = {}) {
  try {
    const fullData = await getDashboardStatistics(options);
    
    return {
      boxLevelData: fullData.boxLevelData,
      timerBehavior: fullData.timerBehavior,
      timerPercentage: fullData.timerPercentage,
      learningStatus: fullData.learningStatus,
      progressTrend: fullData.progressTrend,
      progressPercentage: fullData.progressPercentage,
      nextReviewTime: fullData.nextReviewTime,
      nextReviewCount: fullData.nextReviewCount,
      allAttempts: fullData.allAttempts,
      allProblems: fullData.allProblems,
      allSessions: fullData.allSessions,
      learningState: fullData.learningState,
      strategySuccessRate: fullData.strategySuccessRate,
      promotionData: fullData.nested?.progress?.promotionData,
    };
  } catch (error) {
    logger.error("Error getting learning progress data:", error);
    throw error;
  }
}

/**
 * Get data specifically for the Goals page
 * Can accept providedData to avoid direct service calls
 */
export async function getGoalsData(options = {}, providedData = null) {
  try {
    if (providedData) {
      // Use provided data directly
      const goalsData = await generateGoalsData(providedData);
      // Fetch sessions and attempts data for Today's Progress and onboarding detection
      const [allSessions, allAttempts] = await Promise.all([
        getAllSessions(),
        getAllAttempts()
      ]);
      const sessionAnalytics = generateSessionAnalytics(allSessions, []);
      return {
        ...goalsData,
        sessions: sessionAnalytics,
        attempts: allAttempts
      };
    } else {
      // Fallback: try existing method but catch errors gracefully
      try {
        const fullData = await getDashboardStatistics(options);
        const goalsData = fullData.goals || await generateGoalsData();
        // Include sessions and attempts data for Today's Progress and onboarding detection
        return {
          ...goalsData,
          sessions: fullData.sessions || { allSessions: [] },
          attempts: fullData.allAttempts || []
        };
      } catch (error) {
        // If getDashboardStatistics fails, use fallback
        logger.warn("getDashboardStatistics failed, using fallback goals data");
        const fallbackData = await generateGoalsData();
        return {
          ...fallbackData,
          sessions: { allSessions: [] },
          attempts: []
        };
      }
    }
  } catch (error) {
    logger.error("Error getting goals data:", error);
    // Return fallback goals data instead of throwing
    return {
      learningPlan: {
        cadence: { sessionsPerWeek: 5, sessionLength: "auto", flexibleSchedule: true },
        focus: { primaryTags: ["array"], difficultyDistribution: { easy: 20, medium: 60, hard: 20 }, reviewRatio: 40 },
        guardrails: { minReviewRatio: 30, maxNewProblems: 4, difficultyCapEnabled: true, maxDifficulty: "Medium", hintLimitEnabled: false, maxHintsPerProblem: 3 },
        outcomeTrends: {
          weeklyAccuracy: { value: 0, status: "behind", target: 75 },
          problemsPerWeek: { value: 0, status: "behind", target: "25-30", display: "0" },
          hintEfficiency: { value: 0, status: "behind", display: "<0 per problem" },
          learningVelocity: { value: "Steady", status: "adaptive" }
        }
      },
      sessions: { allSessions: [] },
      attempts: []
    };
  }
}

// Default dashboard statistics (similar to content script fallback pattern)
const DEFAULT_STATS = {
  statistics: { totalSolved: 0, mastered: 0, inProgress: 0, new: 0 },
  averageTime: { overall: 0, Easy: 0, Medium: 0, Hard: 0, timeAccuracy: 0 },
  successRate: { overall: 0, Easy: 0, Medium: 0, Hard: 0 },
  allSessions: [],
  hintsUsed: { total: 0, contextual: 0, general: 0, primer: 0 },
  timeAccuracy: 0,
  learningEfficiencyData: { weekly: [], monthly: [], yearly: [] }
};

/**
 * Get data specifically for the Stats/Overview page with fallback
 */
export async function getStatsData(options = {}) {
  try {
    const fullData = await getDashboardStatistics(options);
    
    return {
      statistics: fullData.statistics || DEFAULT_STATS.statistics,
      averageTime: fullData.averageTime || DEFAULT_STATS.averageTime,
      successRate: fullData.successRate || DEFAULT_STATS.successRate,
      allSessions: fullData.allSessions || DEFAULT_STATS.allSessions,
      hintsUsed: fullData.hintsUsed || DEFAULT_STATS.hintsUsed,
      timeAccuracy: fullData.timeAccuracy || DEFAULT_STATS.timeAccuracy,
      learningEfficiencyData: fullData.learningEfficiencyData || DEFAULT_STATS.learningEfficiencyData,
    };
  } catch (error) {
    logger.error("Error getting stats data, using fallback:", error);
    // Return fallback data instead of throwing (like content script pattern)
    return DEFAULT_STATS;
  }
}

/**
 * Get data specifically for the Session History page
 */
export async function getSessionHistoryData(options = {}) {
  try {
    const fullData = await getDashboardStatistics(options);
    
    return {
      allSessions: fullData.sessions?.allSessions || [],
      sessionAnalytics: fullData.sessions?.sessionAnalytics || [],
      productivityMetrics: fullData.sessions?.productivityMetrics || {},
      recentSessions: fullData.sessions?.recentSessions || [],
    };
  } catch (error) {
    logger.error("Error getting session history data:", error);
    throw error;
  }
}

/**
 * Get data specifically for the Productivity Insights page
 */
export async function getProductivityInsightsData(options = {}) {
  try {
    const fullData = await getDashboardStatistics(options);
    
    // Calculate reflection data
    const reflectionData = await calculateReflectionInsights(fullData);
    
    return {
      productivityMetrics: fullData.sessions?.productivityMetrics || {},
      sessionAnalytics: fullData.sessions?.sessionAnalytics || [],
      allSessions: fullData.sessions?.allSessions || [],
      learningEfficiencyData: fullData.learningEfficiencyData,
      reflectionData: reflectionData,
    };
  } catch (error) {
    logger.error("Error getting productivity insights data:", error);
    throw error;
  }
}

/**
 * Calculate reflection insights from attempt data
 */
function calculateReflectionInsights(dashboardData) {
  try {
    const allAttempts = dashboardData.allAttempts || [];

    // Count attempts with reflections (non-empty comments field)
    // Check both Comments (PascalCase) and comments (lowercase) for compatibility
    const attemptsWithReflections = allAttempts.filter(attempt => {
      const commentText = attempt.comments || attempt.Comments;
      return commentText && commentText.trim().length > 0;
    });
    
    const reflectionsCount = attemptsWithReflections.length;
    const totalAttempts = allAttempts.length;
    const reflectionRate = totalAttempts > 0 ? (reflectionsCount / totalAttempts) * 100 : 0;

    // Debug logging
    console.log('🔍 calculateReflectionInsights Debug:', {
      totalAttempts,
      reflectionsCount,
      reflectionRate,
      sampleAttemptWithComment: attemptsWithReflections[0],
      first3Attempts: allAttempts.slice(0, 3).map(a => ({
        hasComments: !!a.comments,
        hasCommentsCapital: !!a.Comments,
        commentValue: a.comments || a.Comments || 'EMPTY'
      }))
    });

    // Analyze common themes in reflections
    const commonThemes = analyzeReflectionThemes(attemptsWithReflections);
    
    // Calculate reflection quality metrics
    const avgReflectionLength = reflectionsCount > 0
      ? attemptsWithReflections.reduce((sum, attempt) => {
          const commentText = attempt.comments || attempt.Comments;
          return sum + (commentText ? commentText.length : 0);
        }, 0) / reflectionsCount
      : 0;
    
    // Correlation with performance
    const reflectionPerformanceCorrelation = calculateReflectionPerformanceCorrelation(
      attemptsWithReflections, 
      allAttempts
    );
    
    return {
      reflectionsCount,
      totalAttempts,
      reflectionRate: Math.round(reflectionRate * 10) / 10,
      commonThemes: commonThemes.slice(0, 3), // Top 3 themes
      avgReflectionLength: Math.round(avgReflectionLength),
      performanceCorrelation: reflectionPerformanceCorrelation
    };
  } catch (error) {
    logger.error("Error calculating reflection insights:", error);
    return {
      reflectionsCount: 0,
      totalAttempts: 0,
      reflectionRate: 0,
      commonThemes: [],
      avgReflectionLength: 0,
      performanceCorrelation: 0
    };
  }
}

/**
 * Analyze common themes in reflection text
 */
function analyzeReflectionThemes(attemptsWithReflections) {
  const themeKeywords = {
    'time-management': ['time', 'slow', 'fast', 'rushed', 'deadline'],
    'algorithm-understanding': ['algorithm', 'approach', 'logic', 'understand', 'concept'],
    'implementation': ['code', 'syntax', 'bug', 'error', 'implementation'],
    'problem-analysis': ['analysis', 'breakdown', 'edge case', 'constraint', 'requirement'],
    'pattern-recognition': ['pattern', 'similar', 'seen before', 'template', 'approach']
  };
  
  const themeCounts = {};
  
  attemptsWithReflections.forEach(attempt => {
    const commentText = attempt.comments || attempt.Comments;
    const reflection = (commentText || '').toLowerCase();

    Object.entries(themeKeywords).forEach(([theme, keywords]) => {
      const hasTheme = keywords.some(keyword => reflection.includes(keyword));
      if (hasTheme) {
        themeCounts[theme] = (themeCounts[theme] || 0) + 1;
      }
    });
  });
  
  return Object.entries(themeCounts)
    .sort(([,a], [,b]) => b - a)
    .map(([theme, count]) => ({
      theme: theme.replace('-', ' '),
      count,
      percentage: Math.round((count / attemptsWithReflections.length) * 100)
    }));
}

/**
 * Calculate correlation between reflection practice and performance
 */
function calculateReflectionPerformanceCorrelation(attemptsWithReflections, allAttempts) {
  if (attemptsWithReflections.length === 0) return 0;

  const reflectionSuccessRate = attemptsWithReflections.filter(a => (a.success !== undefined ? a.success : a.Success)).length / attemptsWithReflections.length;
  const overallSuccessRate = allAttempts.filter(a => (a.success !== undefined ? a.success : a.Success)).length / allAttempts.length;
  
  return Math.round((reflectionSuccessRate - overallSuccessRate) * 100);
}

/**
 * Get data specifically for the Tag Mastery page
 */
export async function getTagMasteryData(options = {}) {
  try {
    const fullData = await getDashboardStatistics(options);
    
    return fullData.mastery || {
      currentTier: "Core Concept",
      masteredTags: [],
      allTagsInCurrentTier: [],
      focusTags: [],
      tagsinTier: [],
      unmasteredTags: [],
      masteryData: [],
      learningState: {}
    };
  } catch (error) {
    logger.error("Error getting tag mastery data:", error);
    throw error;
  }
}

/**
 * Get data specifically for the Learning Path page
 */
export async function getLearningPathData(options = {}) {
  try {
    const fullData = await getDashboardStatistics(options);

    console.log('🔍 DEBUG standardProblemsMap:', {
      hasMap: !!fullData.standardProblemsMap,
      mapType: typeof fullData.standardProblemsMap,
      keys: fullData.standardProblemsMap ? Object.keys(fullData.standardProblemsMap).slice(0, 10) : [],
      firstValue: fullData.standardProblemsMap ? fullData.standardProblemsMap[Object.keys(fullData.standardProblemsMap)[0]] : null
    });

    // Convert standardProblemsMap object to array
    const standardProblemsArray = fullData.standardProblemsMap
      ? Object.values(fullData.standardProblemsMap)
      : [];

    console.log('📊 getLearningPathData - fullData:', {
      attemptsCount: fullData.allAttempts?.length || 0,
      problemsCount: fullData.allProblems?.length || 0,
      standardProblemsCount: standardProblemsArray.length
    });

    // Build dynamic tag relationships from actual attempts
    // Use standard_problems which have Tags, not user problems
    const tagRelationships = buildDynamicTagRelationships(
      fullData.allAttempts || [],
      standardProblemsArray
    );

    console.log('🔗 Dynamic tag relationships built:', {
      relationshipCount: Object.keys(tagRelationships).length,
      sampleKeys: Object.keys(tagRelationships).slice(0, 5),
      sample: Object.keys(tagRelationships).length > 0 ? tagRelationships[Object.keys(tagRelationships)[0]] : null
    });

    return {
      ...(fullData.mastery || {
        currentTier: "Core Concept",
        masteredTags: [],
        allTagsInCurrentTier: [],
        focusTags: [],
        tagsinTier: [],
        unmasteredTags: [],
        masteryData: [],
        learningState: {}
      }),
      tagRelationships // Add dynamic relationships
    };
  } catch (error) {
    logger.error("Error getting learning path data:", error);
    throw error;
  }
}

/**
 * Returns empty interview analytics data when no sessions exist
 */
function getEmptyInterviewAnalytics() {
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
function calculateSessionMetrics(interviewSessions, allAttempts) {
  const interviewModeBreakdown = {};
  let totalAccuracy = 0;
  let totalTimeSpent = 0;
  let totalProblemsAttempted = 0;
  let totalProblemsCompleted = 0;

  interviewSessions.forEach(session => {
    const mode = session.sessionType || 'interview-like';
    interviewModeBreakdown[mode] = (interviewModeBreakdown[mode] || 0) + 1;

    // Get attempts for this session
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

  // Calculate averages
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
function generateProgressTrend(interviewSessions, allAttempts) {
  // Validate inputs
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
  }).reverse(); // Show oldest to newest for trend
}

/**
 * Calculates transfer metrics comparing interview vs standard performance
 */
function calculateTransferMetrics(allSessions, allAttempts, accuracy, progressTrend) {
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
function generateRecommendations(accuracy, averageTimePerProblem, transferScore) {
  const recommendations = [];
  if (accuracy < 50) {
    recommendations.push("Focus on Interview-Like mode to build confidence with reduced pressure");
  } else if (accuracy < 70) {
    recommendations.push("Good progress! Continue practicing in Interview-Like mode");
  } else {
    recommendations.push("Excellent performance! Ready to try Full Interview mode");
  }

  if (averageTimePerProblem > 1800) { // 30 minutes
    recommendations.push("Work on time management - aim for 20-25 minutes per problem");
  }

  if (transferScore < 0.8) {
    recommendations.push("Practice more standard sessions to strengthen fundamentals");
  }

  return recommendations;
}

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

/**
 * Get separated analytics for guided vs tracking sessions
 * Provides comprehensive metrics for both session types
 */
export async function getSessionMetrics(options = {}) {
  try {
    const { range = 30 } = options;
    const cutoffDate = new Date(Date.now() - (range * 24 * 60 * 60 * 1000));
    
    const sessions = await getAllSessions();
    const attempts = await getAllAttempts();
    
    // Filter sessions by date range if specified
    const recentSessions = sessions.filter(session => 
      new Date(session.date) >= cutoffDate
    );
    
    // Separate sessions by session_type
    const guidedSessions = recentSessions.filter(s => s.session_type === 'standard' || s.session_type === 'interview-like' || s.session_type === 'full-interview');
    const trackingSessions = recentSessions.filter(s => s.session_type === 'tracking');
    
    // Get attempts for each session type
    const guidedSessionIds = new Set(guidedSessions.map(s => s.id));
    const trackingSessionIds = new Set(trackingSessions.map(s => s.id));
    
    const guidedAttempts = attempts.filter(a => guidedSessionIds.has(a.session_id || a.SessionID));
    const trackingAttempts = attempts.filter(a => trackingSessionIds.has(a.session_id || a.SessionID));
    
    // Calculate metrics for guided sessions
    const guidedMetrics = calculateSessionTypeMetrics(guidedSessions, guidedAttempts, 'guided');
    
    // Calculate metrics for tracking sessions  
    const trackingMetrics = calculateSessionTypeMetrics(trackingSessions, trackingAttempts, 'tracking');
    
    // Calculate transfer metrics (tracking → guided adoption)
    const transferMetrics = calculateTrackingAdoptionMetrics(sessions, attempts);
    
    // Calculate session health metrics
    const healthMetrics = await calculateSessionHealthMetrics(sessions);
    
    return {
      guided: guidedMetrics,
      tracking: trackingMetrics,
      transfer: transferMetrics,
      health: healthMetrics,
      overall: {
        totalSessions: recentSessions.length,
        totalAttempts: guidedAttempts.length + trackingAttempts.length,
        avgSessionLength: calculateAverageSessionLength([...guidedSessions, ...trackingSessions]),
        sessionDistribution: {
          guided: Math.round((guidedSessions.length / Math.max(1, recentSessions.length)) * 100),
          tracking: Math.round((trackingSessions.length / Math.max(1, recentSessions.length)) * 100)
        }
      }
    };
    
  } catch (error) {
    logger.error("Error in getSessionMetrics:", error);
    throw error;
  }
}

/**
 * Calculate detailed metrics for a specific session type
 */
function calculateSessionTypeMetrics(sessions, attempts, type) {
  const completedSessions = sessions.filter(s => s.status === 'completed');
  const activeSessions = sessions.filter(s => s.status === 'in_progress');

  // Success rate calculation (support both snake_case and PascalCase)
  const successfulAttempts = attempts.filter(a => {
    const success = a.success !== undefined ? a.success : a.Success;
    return success === true || success === 1;
  });
  const successRate = attempts.length > 0 ?
    Math.round((successfulAttempts.length / attempts.length) * 100) : 0;

  // Average session length
  const avgSessionLength = calculateAverageSessionLength(sessions);

  // Problems per session
  const avgProblemsPerSession = sessions.length > 0 ?
    Math.round(attempts.length / sessions.length * 10) / 10 : 0;

  // Session completion rate (for guided sessions)
  const completionRate = type === 'guided' && sessions.length > 0 ?
    Math.round((completedSessions.length / sessions.length) * 100) : null;

  // Time-based metrics
  const totalTimeSpent = attempts.reduce((sum, a) => sum + (a.time_spent || a.TimeSpent || 0), 0);
  const avgTimePerProblem = attempts.length > 0 ?
    Math.round(totalTimeSpent / attempts.length) : 0;

  return {
    totalSessions: sessions.length,
    sessionsByStatus: {
      completed: completedSessions.length,
      active: activeSessions.length
    },
    completionRate,
    totalAttempts: attempts.length,
    successRate,
    avgSessionLength,
    avgProblemsPerSession,
    avgTimePerProblem,
    totalTimeSpent: Math.round(totalTimeSpent / 60), // Convert to minutes
    recentActivity: getRecentActivity(sessions, attempts)
  };
}

/**
 * Calculate transfer metrics (tracking → guided session adoption)
 */
function calculateTrackingAdoptionMetrics(sessions, attempts) {
  // Find users who have both tracking and guided sessions
  const hasTracking = sessions.some(s => s.session_type === 'tracking');
  const hasGuided = sessions.some(s => s.session_type === 'standard' || s.session_type === 'interview-like' || s.session_type === 'full-interview');
  
  if (!hasTracking) {
    return {
      hasTrackingActivity: false,
      transferRate: 0,
      generatedFromTracking: 0,
      recommendations: ['Start solving problems independently to unlock personalized guided sessions']
    };
  }
  
  if (!hasGuided) {
    const trackingAttempts = attempts.filter(a => {
      const sessionId = a.session_id || a.SessionID;
      return sessions.find(s => s.id === sessionId && s.session_type === 'tracking');
    });
    
    return {
      hasTrackingActivity: true,
      transferRate: 0,
      trackingAttempts: trackingAttempts.length,
      recommendations: trackingAttempts.length >= 4 ? 
        ['You have enough tracking activity to generate a personalized guided session'] :
        [`Solve ${4 - trackingAttempts.length} more problems independently to unlock guided sessions`]
    };
  }
  
  // Count auto-generated sessions
  const autoGeneratedSessions = sessions.filter(s =>
    s.session_type === 'standard' || s.session_type === 'interview-like' || s.session_type === 'full-interview'
  );
  
  const transferRate = sessions.length > 0 ?
    Math.round((autoGeneratedSessions.length / sessions.length) * 100) : 0;
  
  return {
    hasTrackingActivity: true,
    hasGuidedActivity: true,
    transferRate,
    generatedFromTracking: autoGeneratedSessions.length,
    totalSessions: sessions.length,
    recommendations: transferRate > 0 ?
      ['Great! The system is learning from your independent practice'] :
      ['Try solving more problems independently to improve session personalization']
  };
}

/**
 * Calculate session health metrics using classification system
 */
function calculateSessionHealthMetrics(sessions) {
  try {
    // This would typically call the background script to classify sessions
    // For now, we'll simulate the classification
    const stalledCount = sessions.filter(session => {
      const now = Date.now();
      const lastActivity = new Date(session.last_activity_time || session.date);
      const hoursStale = (now - lastActivity.getTime()) / (1000 * 60 * 60);
      
      return hoursStale > 24 && session.status !== 'completed';
    }).length;
    
    const healthyCount = sessions.length - stalledCount;
    
    return {
      totalSessions: sessions.length,
      healthyCount,
      stalledCount,
      healthScore: sessions.length > 0 ? 
        Math.round((healthyCount / sessions.length) * 100) : 100,
      needsCleanup: stalledCount > 0
    };
    
  } catch (error) {
    logger.error("Error calculating session health:", error);
    return {
      totalSessions: sessions.length,
      healthyCount: sessions.length,
      stalledCount: 0,
      healthScore: 100,
      needsCleanup: false
    };
  }
}

/**
 * Calculate average session length in problems
 */
function calculateAverageSessionLength(sessions) {
  if (sessions.length === 0) return 0;
  
  const totalProblems = sessions.reduce((sum, session) => 
    sum + (session.problems?.length || 0), 0
  );
  
  return Math.round((totalProblems / sessions.length) * 10) / 10;
}

/**
 * Get recent activity for a session type
 */
function getRecentActivity(sessions, attempts) {
  const last7Days = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));

  const recentSessions = sessions.filter(s => new Date(s.date) >= last7Days);
  const recentAttempts = attempts.filter(a => new Date(a.date) >= last7Days);

  return {
    sessionsLast7Days: recentSessions.length,
    attemptsLast7Days: recentAttempts.length,
    avgDailyActivity: Math.round(recentAttempts.length / 7 * 10) / 10
  };
}

/**
 * Calculate learning efficiency metrics from session data
 * Returns efficiency, retention, and momentum trends over recent sessions
 */
export async function getLearningEfficiencyData() {
  try {
    const [allSessions, allAttempts] = await Promise.all([
      getAllSessions(),
      getAllAttempts()
    ]);

    // Filter to completed sessions with attempts
    const completedSessions = allSessions
      .filter(s => s.status === 'completed' && s.date)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-10); // Last 10 sessions

    if (completedSessions.length === 0) {
      return {
        chartData: [],
        hasData: false,
        message: 'Complete some sessions to see your learning efficiency trends'
      };
    }

    // Calculate metrics for each session
    const chartData = completedSessions.map((session, index) => {
      const sessionAttempts = allAttempts.filter(a => a.session_id === session.id);

      // Learning Efficiency: Based on success rate and speed
      const successfulAttempts = sessionAttempts.filter(a => a.success).length;
      const totalAttempts = sessionAttempts.length;
      const successRate = totalAttempts > 0 ? (successfulAttempts / totalAttempts) * 100 : 0;

      // Calculate average time efficiency (lower time = higher efficiency)
      const avgTime = sessionAttempts.length > 0
        ? sessionAttempts.reduce((sum, a) => sum + (a.time_spent || 0), 0) / sessionAttempts.length
        : 0;
      const timeEfficiency = avgTime > 0 ? Math.max(0, 100 - (avgTime / 60)) : 0; // Normalize to 0-100

      const efficiency = Math.round((successRate * 0.7) + (timeEfficiency * 0.3)); // Weight success more

      // Knowledge Retention: Based on review problem performance
      const reviewAttempts = sessionAttempts.filter(a => a.box_level > 0);
      const successfulReviews = reviewAttempts.filter(a => a.success).length;
      const retention = reviewAttempts.length > 0
        ? Math.round((successfulReviews / reviewAttempts.length) * 100)
        : successRate; // Fall back to success rate if no reviews

      // Learning Momentum: Based on cumulative progress and consistency
      const problemsSolved = successfulAttempts;
      const expectedProblems = session.session_length || 5;
      const completionRate = (problemsSolved / expectedProblems) * 100;

      // Check if maintaining or improving from previous session
      let momentumBonus = 0;
      if (index > 0) {
        const prevSession = completedSessions[index - 1];
        const prevAttempts = allAttempts.filter(a => a.session_id === prevSession.session_id);
        const prevSuccessRate = prevAttempts.length > 0
          ? (prevAttempts.filter(a => a.success).length / prevAttempts.length) * 100
          : 0;

        if (successRate >= prevSuccessRate) {
          momentumBonus = 10; // Bonus for maintaining/improving
        }
      }

      const momentum = Math.min(100, Math.round((completionRate * 0.6) + (successRate * 0.4) + momentumBonus));

      return {
        session: `S${index + 1}`,
        sessionId: session.id,
        date: new Date(session.date).toLocaleDateString(),
        efficiency: Math.min(100, Math.max(0, efficiency)),
        retention: Math.min(100, Math.max(0, retention)),
        momentum: Math.min(100, Math.max(0, momentum)),
        problemsSolved: problemsSolved,
        totalProblems: totalAttempts
      };
    });

    return {
      chartData,
      hasData: true,
      totalSessions: completedSessions.length,
      averages: {
        efficiency: Math.round(chartData.reduce((sum, d) => sum + d.efficiency, 0) / chartData.length),
        retention: Math.round(chartData.reduce((sum, d) => sum + d.retention, 0) / chartData.length),
        momentum: Math.round(chartData.reduce((sum, d) => sum + d.momentum, 0) / chartData.length)
      }
    };
  } catch (error) {
    logger.error('Error calculating learning efficiency data:', error);
    return {
      chartData: [],
      hasData: false,
      message: 'Error loading efficiency data'
    };
  }
}

