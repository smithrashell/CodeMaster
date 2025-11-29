/**
 * Helper functions for page-specific data fetching
 * Extracted from dashboardService.js to reduce file complexity
 */

import { getAllSessions } from "../../shared/db/sessions.js";
import { getAllAttempts } from "../../shared/db/attempts.js";
import logger from "../../shared/utils/logger.js";
import { generateSessionAnalytics } from "./dashboardSessionAnalyticsHelpers.js";
import { buildDynamicTagRelationships } from "./dashboardMasteryHelpers.js";
import { calculateReflectionInsights } from "./dashboardProductivityHelpers.js";
import { generateGoalsData } from "./dashboardGoalsHelpers.js";

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
 * Get data specifically for the Learning Progress page
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
 * Get data specifically for the Goals page
 * Can accept providedData to avoid direct service calls
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
 * Get data specifically for the Stats/Overview page with fallback
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

    // Convert standardProblemsMap (which is a Map) to array
    const standardProblemsArray = fullData.standardProblemsMap instanceof Map
      ? Array.from(fullData.standardProblemsMap.values())
      : (fullData.standardProblemsMap ? Object.values(fullData.standardProblemsMap) : []);

    // Build dynamic tag relationships from actual attempts
    // Use standard_problems which have Tags, not user problems
    const tagRelationships = buildDynamicTagRelationships(
      fullData.allAttempts || [],
      standardProblemsArray
    );

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
