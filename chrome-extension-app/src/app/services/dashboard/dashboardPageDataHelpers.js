/**
 * Helper functions for page-specific data fetching
 * Extracted from dashboardService.js to reduce file complexity
 *
 * @module dashboardPageDataHelpers
 *
 * DATA CONTRACT DOCUMENTATION
 * ==========================
 * This module provides page-specific data extraction from the unified dashboard statistics.
 * Each function returns a subset of data tailored for specific dashboard pages.
 *
 * IMPORTANT: Field types marked as "CRITICAL" have caused regressions when changed.
 * Always maintain the documented types for these fields.
 */

import { getAllSessions } from "../../../shared/db/stores/sessions.js";
import { getAllAttempts } from "../../../shared/db/stores/attempts.js";
import logger from "../../../shared/utils/logging/logger.js";
import { generateSessionAnalytics } from "./dashboardSessionAnalyticsHelpers.js";
import { buildDynamicTagRelationships } from "./dashboardMasteryHelpers.js";
import { calculateReflectionInsights } from "./dashboardProductivityHelpers.js";
import { generateGoalsData } from "./dashboardGoalsHelpers.js";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * @typedef {Object} BoxLevelData
 * @property {number} box1 - Count of problems in Box 1 (new/learning)
 * @property {number} box2 - Count of problems in Box 2
 * @property {number} box3 - Count of problems in Box 3
 * @property {number} box4 - Count of problems in Box 4
 * @property {number} box5 - Count of problems in Box 5 (mastered)
 */

/**
 * @typedef {Object} LearningProgressData
 * @property {BoxLevelData} boxLevelData - Required. Leitner box distribution for chart display.
 * @property {string} timerBehavior - Required. Description like "On schedule" or "No data".
 * @property {number} timerPercentage - Required. 0-100 percentage for timer accuracy.
 * @property {string} learningStatus - Required. Status like "Active Learning" or "No Data".
 * @property {string} progressTrend - Required. Trend like "Improving" or "No Data".
 * @property {number} progressPercentage - Required. 0-100 percentage for progress.
 * @property {string} nextReviewTime - Required. Time of next review or "Schedule unavailable".
 * @property {number} nextReviewCount - Required. Number of problems due for review.
 * @property {Array<Object>} allAttempts - Required. All attempt records from database.
 * @property {Array<Object>} allProblems - Required. All problems from database.
 * @property {Array<Object>} allSessions - Required. All sessions from database.
 * @property {Object} learningState - Required. Current learning state with masteredTags.
 * @property {number} strategySuccessRate - CRITICAL: Must be number 0-100, NOT an object.
 *   This field caused a regression when returned as an object. Used by ProgressKPICards.
 * @property {Object} [promotionData] - Optional. Data about Leitner box promotions.
 */

/**
 * @typedef {Object} CadenceConfig
 * @property {number} sessionsPerWeek - Required. Target sessions per week (e.g., 5).
 * @property {string|number} sessionLength - Required. "auto" or numeric minutes.
 * @property {boolean} flexibleSchedule - Required. Whether schedule is flexible.
 */

/**
 * @typedef {Object} FocusConfig
 * @property {Array<string>} primaryTags - Required. Primary focus tags (e.g., ["Array", "Hash Table"]).
 * @property {Object} difficultyDistribution - Required. Distribution percentages.
 * @property {number} difficultyDistribution.easy - Percentage for easy problems.
 * @property {number} difficultyDistribution.medium - Percentage for medium problems.
 * @property {number} difficultyDistribution.hard - Percentage for hard problems.
 * @property {number} reviewRatio - Required. Review ratio percentage (e.g., 40).
 */

/**
 * @typedef {Object} GuardrailsConfig
 * @property {number} minReviewRatio - Required. Minimum review ratio (e.g., 30).
 * @property {number} maxNewProblems - Required. Max new problems per session (e.g., 4-5).
 * @property {boolean} difficultyCapEnabled - Required. Whether difficulty cap is enabled.
 * @property {string} maxDifficulty - Required. Max difficulty level ("Easy"|"Medium"|"Hard").
 * @property {boolean} hintLimitEnabled - Required. Whether hint limit is enabled.
 * @property {number} maxHintsPerProblem - Required. Max hints per problem (e.g., 3).
 */

/**
 * @typedef {Object} OutcomeTrend
 * @property {number|string} value - Current value.
 * @property {string} status - Status ("on-track"|"behind"|"ahead"|"adaptive").
 * @property {number|string} [target] - Target value if applicable.
 * @property {string} [display] - Display string if different from value.
 */

/**
 * @typedef {Object} LearningPlan
 * @property {CadenceConfig} cadence - Required. Session cadence configuration.
 * @property {FocusConfig} focus - Required. Focus area configuration.
 * @property {GuardrailsConfig} guardrails - Required. Learning guardrails.
 * @property {Array<Object>} [missions] - Optional. Active missions/goals.
 * @property {Object} outcomeTrends - Required. Trend data for KPIs.
 * @property {OutcomeTrend} outcomeTrends.weeklyAccuracy - Weekly accuracy trend.
 * @property {OutcomeTrend} outcomeTrends.problemsPerWeek - Problems per week trend.
 * @property {OutcomeTrend} outcomeTrends.hintEfficiency - Hint efficiency trend.
 * @property {OutcomeTrend} outcomeTrends.learningVelocity - Learning velocity trend.
 */

/**
 * @typedef {Object} GoalsData
 * @property {LearningPlan} learningPlan - Required. The learning plan configuration.
 * @property {Object} sessions - Required. Session analytics data.
 * @property {Array<Object>} sessions.allSessions - All sessions for onboarding detection.
 * @property {Array<Object>} attempts - Required. All attempts for analysis.
 */

/**
 * @typedef {Object} StatisticsData
 * @property {number} totalSolved - Required. Total problems solved.
 * @property {number} mastered - Required. Count of mastered problems.
 * @property {number} inProgress - Required. Count of in-progress problems.
 * @property {number} new - Required. Count of new problems.
 */

/**
 * @typedef {Object} AverageTimeData
 * @property {number} overall - Required. Overall average time in seconds.
 * @property {number} Easy - Required. Average time for Easy problems.
 * @property {number} Medium - Required. Average time for Medium problems.
 * @property {number} Hard - Required. Average time for Hard problems.
 * @property {number} [timeAccuracy] - Optional. Time estimate accuracy 0-100.
 */

/**
 * @typedef {Object} SuccessRateData
 * @property {number} overall - Required. Overall success rate 0-100.
 * @property {number} Easy - Required. Success rate for Easy problems.
 * @property {number} Medium - Required. Success rate for Medium problems.
 * @property {number} Hard - Required. Success rate for Hard problems.
 */

/**
 * @typedef {Object} HintsUsedData
 * @property {number} total - Required. Total hints used.
 * @property {number} contextual - Required. Contextual hints used.
 * @property {number} general - Required. General hints used.
 * @property {number} primer - Required. Primer hints used.
 */

/**
 * @typedef {Object} LearningEfficiencyData
 * @property {Array<Object>} weekly - Required. Weekly efficiency data points.
 * @property {Array<Object>} monthly - Required. Monthly efficiency data points.
 * @property {Array<Object>} yearly - Required. Yearly efficiency data points.
 */

/**
 * @typedef {Object} StatsData
 * @property {StatisticsData} statistics - Required. Problem statistics.
 * @property {AverageTimeData} averageTime - Required. Average time metrics.
 * @property {SuccessRateData} successRate - Required. Success rate metrics.
 * @property {Array<Object>} allSessions - Required. All sessions (may not be used by Stats page).
 * @property {HintsUsedData} hintsUsed - Required. Hint usage statistics.
 * @property {number} timeAccuracy - Required. Overall time accuracy 0-100.
 * @property {LearningEfficiencyData} learningEfficiencyData - Required. Efficiency chart data.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

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
 * Get data specifically for the Learning Progress page.
 *
 * Used by: learning-progress.jsx via usePageData('learning-progress')
 *
 * CRITICAL FIELDS:
 * - strategySuccessRate: MUST be a number (0-100), NOT an object.
 *   This caused a React rendering error when returned as {overall: X, ...}.
 *
 * @param {Object} [options={}] - Query options (focusAreaFilter, dateRange).
 * @param {Function} getDashboardStatistics - The statistics aggregator function.
 * @returns {Promise<LearningProgressData>} Learning progress data for the page.
 * @throws {Error} If statistics retrieval fails (no fallback provided).
 *
 * @example
 * const data = await getLearningProgressData({}, getDashboardStatistics);
 * // data.strategySuccessRate === 75 (number, not object)
 * // data.boxLevelData === { box1: 10, box2: 5, ... }
 */
export async function getLearningProgressData(options = {}, getDashboardStatistics) {
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
 * Get data specifically for the Goals page.
 *
 * Used by: goals.jsx via usePageData('goals')
 *
 * This function can accept pre-fetched data via providedData parameter to avoid
 * redundant database calls when called from the background handler with context.
 *
 * KEY CONSUMERS:
 * - LearningPlanCard: Uses cadence.sessionsPerWeek, cadence.sessionLength
 * - FocusPrioritiesCard: Uses focus.primaryTags (falls back to userFocusAreas, systemFocusTags)
 * - GuardrailsCard: Uses guardrails.maxNewProblems, etc.
 * - OutcomeTrendsCard: Uses outcomeTrends.* for all KPI displays
 * - Onboarding detection: Uses sessions.allSessions.length < 1
 *
 * @param {Object} [options={}] - Query options (focusAreaFilter, dateRange).
 * @param {Object|null} [providedData=null] - Pre-fetched data to use instead of querying.
 * @param {Function} getDashboardStatistics - The statistics aggregator function.
 * @returns {Promise<GoalsData>} Goals data including learningPlan, sessions, and attempts.
 *
 * @example
 * // Without provided data (queries database)
 * const data = await getGoalsData({}, null, getDashboardStatistics);
 *
 * // With provided data (uses pre-fetched context)
 * const data = await getGoalsData({}, contextData, getDashboardStatistics);
 */
export async function getGoalsData(options = {}, providedData = null, getDashboardStatistics) {
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

/**
 * Get data specifically for the Stats/Overview page.
 *
 * Used by: overview.jsx via usePageData('stats')
 *
 * This function provides fallback to DEFAULT_STATS on error, ensuring the
 * Stats page always renders even if database queries fail.
 *
 * KEY CONSUMERS:
 * - StatsMetrics component: Uses statistics, averageTime, successRate, hintsUsed
 * - StatsCharts component: Uses learningEfficiencyData for charts
 *
 * NOTE: allSessions and timeAccuracy are returned but not currently used by
 * the Stats page. Consider removing in future cleanup.
 *
 * @param {Object} [options={}] - Query options (focusAreaFilter, dateRange).
 * @param {Function} getDashboardStatistics - The statistics aggregator function.
 * @returns {Promise<StatsData>} Stats data with guaranteed structure (uses defaults on error).
 *
 * @example
 * const data = await getStatsData({}, getDashboardStatistics);
 * // data.statistics.totalSolved === 42
 * // data.successRate.overall === 75
 * // data.hintsUsed.total === 10
 */
export async function getStatsData(options = {}, getDashboardStatistics) {
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
export async function getSessionHistoryData(options = {}, getDashboardStatistics) {
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
export async function getProductivityInsightsData(options = {}, getDashboardStatistics) {
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
 * Get data specifically for the Tag Mastery page
 */
export async function getTagMasteryData(options = {}, getDashboardStatistics) {
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
export async function getLearningPathData(options = {}, getDashboardStatistics) {
  try {
    const fullData = await getDashboardStatistics(options);

    console.log('DEBUG standardProblemsMap:', {
      hasMap: !!fullData.standardProblemsMap,
      mapType: typeof fullData.standardProblemsMap,
      keys: fullData.standardProblemsMap ? Object.keys(fullData.standardProblemsMap).slice(0, 10) : [],
      firstValue: fullData.standardProblemsMap ? fullData.standardProblemsMap[Object.keys(fullData.standardProblemsMap)[0]] : null
    });

    // Convert standardProblemsMap object to array
    const standardProblemsArray = fullData.standardProblemsMap
      ? Object.values(fullData.standardProblemsMap)
      : [];

    console.log('getLearningPathData - fullData:', {
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

    console.log('Dynamic tag relationships built:', {
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
