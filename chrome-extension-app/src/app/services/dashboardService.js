import { fetchAllProblems } from "../../shared/db/problems.js";
import { getAllAttempts } from "../../shared/db/attempts.js";
import { getAllSessions } from "../../shared/db/sessions.js";
import { TagService } from "../../shared/services/tagServices.js";
import { getAllStandardProblems } from "../../shared/db/standard_problems.js";
import { getRecentSessionAnalytics } from "../../shared/db/sessionAnalytics.js";
import logger from "../../shared/utils/logger.js";
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
import { generateSessionAnalytics } from "./dashboardSessionAnalyticsHelpers.js";
import {
  generateMasteryData,
  calculateProgressTrend
} from "./dashboardMasteryHelpers.js";
import {
  generateLearningEfficiencyChartData,
  calculateTimerBehavior,
  calculateLearningStatus,
  calculateTimerPercentage
} from "./dashboardLearningEfficiencyHelpers.js";
import { getInterviewAnalyticsData } from "./dashboardInterviewAnalyticsHelpers.js";
import { getSessionMetrics } from "./dashboardSessionMetricsHelpers.js";
import { generateGoalsData, getLearningEfficiencyData } from "./dashboardGoalsHelpers.js";
import {
  getLearningProgressData as getLearningProgressDataHelper,
  getGoalsData as getGoalsDataHelper,
  getStatsData as getStatsDataHelper,
  getSessionHistoryData as getSessionHistoryDataHelper,
  getProductivityInsightsData as getProductivityInsightsDataHelper,
  getTagMasteryData as getTagMasteryDataHelper,
  getLearningPathData as getLearningPathDataHelper
} from "./dashboardPageDataHelpers.js";

// Simple in-memory cache for focus area analytics
const analyticsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Import core helpers for dashboard data processing
import {
  fetchDashboardData,
  createDashboardProblemMappings,
  applyFiltering,
  calculateCoreStatistics,
  calculateDerivedMetrics,
  calculateStrategySuccessRate,
  getHintAnalytics,
  constructDashboardData,
  calculateNextReviewData,
  enrichSessionsWithHintCounts
} from "./dashboardCoreHelpers.js";

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
    const { statistics, averageTime, successRate } = calculateCoreStatistics(filteredProblems, filteredAttempts, problemDifficultyMap);
    const { timeAccuracy } = calculateDerivedMetrics(averageTime, successRate);

    // Generate analytics and derived data
    const { sessionAnalytics, masteryData, goalsData, learningEfficiencyData } = await generateAnalyticsData(filteredSessions, filteredAttempts, learningState);

    // Calculate progress metrics
    const { timerBehavior, timerPercentage, learningStatus, progressTrend, progressPercentage } = calculateProgressMetrics(filteredAttempts, filteredSessions, problemDifficultyMap);

    // Calculate strategy success rate
    const strategySuccessRate = calculateStrategySuccessRate(filteredSessions, filteredAttempts);

    // Calculate next review data, get hint analytics, and enrich sessions with hint counts
    const [nextReviewData, hintsUsed, enrichedSessions] = await Promise.all([
      calculateNextReviewData(),
      getHintAnalytics(),
      enrichSessionsWithHintCounts(filteredSessions)
    ]);
    const nextReviewTime = nextReviewData?.nextReviewTime || "Schedule unavailable";
    const nextReviewCount = nextReviewData?.nextReviewCount || 0;

    // Construct sessions object for page data helpers
    // sessionAnalytics from generateSessionAnalytics returns { allSessions, sessionAnalytics, productivityMetrics }
    const sessions = {
      allSessions: sessionAnalytics?.allSessions || enrichedSessions,
      sessionAnalytics: sessionAnalytics?.sessionAnalytics || [],
      productivityMetrics: sessionAnalytics?.productivityMetrics || {},
      recentSessions: sessionAnalytics?.recentSessions || []
    };

    // Construct and return final dashboard data
    return constructDashboardData({
      // Core metrics
      statistics, averageTime, successRate,
      // Progress metrics
      timerBehavior, timerPercentage, learningStatus, progressTrend, progressPercentage,
      strategySuccessRate,
      nextReviewTime, nextReviewCount,
      // Analytics data
      sessions, mastery: masteryData, goals: goalsData, learningEfficiencyData, hintsUsed, timeAccuracy,
      // Original data
      allProblems, allAttempts, allSessions: enrichedSessions, learningState, boxLevelData, standardProblemsMap
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

// generateSessionAnalytics moved to dashboardSessionAnalyticsHelpers.js
export { generateSessionAnalytics };

// buildDynamicTagRelationships moved to dashboardMasteryHelpers.js
// generateMasteryData moved to dashboardMasteryHelpers.js
// calculateOutcomeTrends moved to dashboardMasteryHelpers.js
export { generateMasteryData };
// generateGoalsData moved to dashboardGoalsHelpers.js
// Re-export for backwards compatibility
export { generateGoalsData };

/**
 * Page-specific data fetching functions - delegating to helpers
 * Each function returns only the data needed for a specific page
 */

export function getLearningProgressData(options = {}) {
  return getLearningProgressDataHelper(options, getDashboardStatistics);
}

export function getGoalsData(options = {}, providedData = null) {
  return getGoalsDataHelper(options, providedData, getDashboardStatistics);
}

export function getStatsData(options = {}) {
  return getStatsDataHelper(options, getDashboardStatistics);
}

export function getSessionHistoryData(options = {}) {
  return getSessionHistoryDataHelper(options, getDashboardStatistics);
}

export function getProductivityInsightsData(options = {}) {
  return getProductivityInsightsDataHelper(options, getDashboardStatistics);
}

export function getTagMasteryData(options = {}) {
  return getTagMasteryDataHelper(options, getDashboardStatistics);
}

export function getLearningPathData(options = {}) {
  return getLearningPathDataHelper(options, getDashboardStatistics);
}

// getInterviewAnalyticsData moved to dashboardInterviewAnalyticsHelpers.js
// Re-export for backwards compatibility
export { getInterviewAnalyticsData };

// getSessionMetrics moved to dashboardSessionMetricsHelpers.js
// Re-export for backwards compatibility
export { getSessionMetrics };

// getLearningEfficiencyData moved to dashboardGoalsHelpers.js
// Re-export for backwards compatibility
export { getLearningEfficiencyData };

