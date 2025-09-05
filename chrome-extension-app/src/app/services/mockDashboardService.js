/**
 * Mock Dashboard Service
 *
 * Provides the same interface as the real dashboard service but returns
 * realistic mock data for UI testing and development.
 */

import { generateMockData } from "./mockDataService.js";
import { USER_SCENARIOS } from "../config/mockConfig.js";
import logger from "../../shared/utils/logger.js";
import { roundToPrecision } from "../../shared/utils/Utils.js";

/**
 * Generates enhanced session data with analytics
 */
function createEnhancedSessions(allSessions) {
  return allSessions.map((session, index) => ({
    ...session,
    duration: Math.floor(Math.random() * 45) + 15, // 15-60 min sessions
    accuracy: 0.6 + (Math.random() * 0.3), // 60-90% accuracy
    completed: Math.random() > 0.1, // 90% completion rate
    Date: new Date(Date.now() - (index * 24 * 60 * 60 * 1000)).toISOString(), // Spread over days
    sessionId: `session_${index + 1}`,
    problems: Array.from({ length: Math.floor(Math.random() * 8) + 3 }, (_, i) => ({
      id: `problem_${index}_${i}`,
      difficulty: ["Easy", "Medium", "Hard"][Math.floor(Math.random() * 3)],
      solved: Math.random() > 0.25
    }))
  }));
}

/**
 * Creates the flattened properties structure for dashboard components
 */
function createFlattenedProperties(mockData, enhancedSessions) {
  return {
    // Flattened statistics properties for Overview/Stats component
    statistics: mockData.statistics,
    averageTime: mockData.averageTime,
    successRate: mockData.successRate,
    allSessions: enhancedSessions,
    hintsUsed: mockData.hintsUsed,
    timeAccuracy: mockData.timeAccuracy,
    learningEfficiencyData: mockData.learningEfficiencyData,
    
    // Flattened progress properties for Progress component
    boxLevelData: mockData.boxLevelData,
    timerBehavior: mockData.timerBehavior,
    timerPercentage: mockData.timerPercentage,
    learningStatus: mockData.learningStatus || "Active Learning",
    progressTrend: mockData.progressTrend || "Improving",
    progressPercentage: mockData.progressPercentage || 75,
    nextReviewTime: mockData.nextReviewTime,
    nextReviewCount: mockData.nextReviewCount,
    allAttempts: mockData.allAttempts,
    allProblems: mockData.allProblems,
    learningState: mockData.learningState,
    strategySuccessRate: mockData.strategySuccessRate,
    promotionData: mockData.promotionData,
  };
}

/**
 * Creates nested structure for backward compatibility
 */
function createNestedStructure(mockData, enhancedSessions) {
  return {
    statistics: {
      statistics: mockData.statistics,
      averageTime: mockData.averageTime,
      successRate: mockData.successRate,
      allSessions: enhancedSessions,
      hintsUsed: mockData.hintsUsed,
      timeAccuracy: mockData.timeAccuracy,
      learningEfficiencyData: mockData.learningEfficiencyData,
    },
    progress: {
      learningState: mockData.learningState,
      boxLevelData: mockData.boxLevelData,
      allAttempts: mockData.allAttempts,
      allProblems: mockData.allProblems,
      allSessions: enhancedSessions,
      strategySuccessRate: mockData.strategySuccessRate,
      timerBehavior: mockData.timerBehavior,
      timerPercentage: mockData.timerPercentage,
      learningStatus: mockData.learningStatus || "Active Learning",
      progressTrend: mockData.progressTrend || "Improving",
      progressPercentage: mockData.progressPercentage || 75,
      nextReviewTime: mockData.nextReviewTime,
      nextReviewCount: mockData.nextReviewCount,
      promotionData: mockData.promotionData,
    }
  };
}

/**
 * Creates sessions object with analytics and metrics
 */
function createSessionsObject(enhancedSessions) {
  return {
    allSessions: enhancedSessions,
    recentSessions: enhancedSessions.slice(-10),
    sessionAnalytics: enhancedSessions.map(session => ({
      sessionId: session.sessionId,
      completedAt: session.Date,
      accuracy: roundToPrecision(session.accuracy),
      avgTime: session.duration,
      totalProblems: session.problems.length,
      difficulty: session.problems.reduce((acc, p) => {
        acc[p.difficulty] = (acc[p.difficulty] || 0) + 1;
        return acc;
      }, {}),
      insights: [
        session.accuracy > 0.8 ? "Great accuracy this session!" : "Focus on accuracy improvement",
        session.duration > 45 ? "Long focused session - excellent!" : "Consider longer practice sessions"
      ]
    })),
    productivityMetrics: {
      averageSessionLength: Math.round(enhancedSessions.reduce((acc, s) => acc + s.duration, 0) / enhancedSessions.length),
      completionRate: Math.round((enhancedSessions.filter(s => s.completed).length / enhancedSessions.length) * 100),
      streakDays: 7,
      bestPerformanceHour: "14:00"
    }
  };
}

/**
 * Creates mastery data with learning state information
 */
function createMasteryObject(mockData) {
  const masteryData = [
    // Core Concepts - Focus tags with good progress
    { tag: "array", totalAttempts: 15, successfulAttempts: 12, mastered: true, isFocus: true, progress: 85, hintHelpfulness: "high" },
    { tag: "string", totalAttempts: 12, successfulAttempts: 8, mastered: false, isFocus: true, progress: 67, hintHelpfulness: "high" },
    { tag: "two-pointers", totalAttempts: 8, successfulAttempts: 5, mastered: false, isFocus: true, progress: 63, hintHelpfulness: "medium" },
    
    // Supporting concepts
    { tag: "hash-table", totalAttempts: 10, successfulAttempts: 9, mastered: true, isFocus: false, progress: 90, hintHelpfulness: "low" },
    { tag: "math", totalAttempts: 5, successfulAttempts: 3, mastered: false, isFocus: false, progress: 60, hintHelpfulness: "medium" },
    
    // Basic Techniques (in progress)
    { tag: "binary-search", totalAttempts: 4, successfulAttempts: 2, mastered: false, isFocus: false, progress: 50, hintHelpfulness: "high" },
    { tag: "sliding-window", totalAttempts: 3, successfulAttempts: 1, mastered: false, isFocus: false, progress: 33, hintHelpfulness: "high" },
    { tag: "stack", totalAttempts: 7, successfulAttempts: 4, mastered: false, isFocus: false, progress: 57, hintHelpfulness: "medium" },
    { tag: "queue", totalAttempts: 4, successfulAttempts: 2, mastered: false, isFocus: false, progress: 50, hintHelpfulness: "medium" },
    
    // Intermediate (just starting)
    { tag: "dynamic-programming", totalAttempts: 12, successfulAttempts: 4, mastered: false, isFocus: false, progress: 33, hintHelpfulness: "high" },
    { tag: "greedy", totalAttempts: 5, successfulAttempts: 2, mastered: false, isFocus: false, progress: 40, hintHelpfulness: "medium" },
    { tag: "heap", totalAttempts: 6, successfulAttempts: 2, mastered: false, isFocus: false, progress: 33, hintHelpfulness: "high" },
    { tag: "tree", totalAttempts: 9, successfulAttempts: 3, mastered: false, isFocus: false, progress: 33, hintHelpfulness: "high" },
    { tag: "backtracking", totalAttempts: 3, successfulAttempts: 1, mastered: false, isFocus: false, progress: 33, hintHelpfulness: "high" },
    
    // Advanced (not started yet)
    { tag: "graph", totalAttempts: 8, successfulAttempts: 2, mastered: false, isFocus: false, progress: 25, hintHelpfulness: "high" },
    { tag: "trie", totalAttempts: 2, successfulAttempts: 0, mastered: false, isFocus: false, progress: 0, hintHelpfulness: "high" },
    { tag: "segment-tree", totalAttempts: 1, successfulAttempts: 0, mastered: false, isFocus: false, progress: 0, hintHelpfulness: "high" },
    { tag: "union-find", totalAttempts: 1, successfulAttempts: 0, mastered: false, isFocus: false, progress: 0, hintHelpfulness: "high" }
  ];

  return {
    currentTier: mockData.learningState.currentTier || "Core Concept",
    masteredTags: mockData.learningState.masteredTags || ["array", "hash-table"],
    allTagsInCurrentTier: mockData.learningState.allTagsInCurrentTier || [
      "array", "hash-table", "string", "two-pointers", 
      "binary-search", "sliding-window", "dynamic-programming",
      "greedy", "stack", "queue", "heap", "tree", "graph"
    ],
    focusTags: mockData.learningState.focusTags || ["array", "string", "two-pointers"],
    tagsinTier: mockData.learningState.tagsinTier || [
      "array", "hash-table", "string", "two-pointers", 
      "binary-search", "sliding-window"
    ],
    unmasteredTags: mockData.learningState.unmasteredTags || [
      "string", "two-pointers", "binary-search", "sliding-window", 
      "dynamic-programming", "greedy", "stack", "queue", "heap", "tree", "graph"
    ],
    masteryData,
    learningState: {
      ...mockData.learningState,
      // Ensure focus tags data is available at this level too
      focusTags: ["array", "string", "two-pointers"],
      masteryData: [
        // Core Concepts - Focus tags with good progress
        { tag: "array", totalAttempts: 15, successfulAttempts: 12, mastered: true, isFocus: true, progress: 85, hintHelpfulness: "high" },
        { tag: "string", totalAttempts: 12, successfulAttempts: 8, mastered: false, isFocus: true, progress: 67, hintHelpfulness: "high" },
        { tag: "two-pointers", totalAttempts: 8, successfulAttempts: 5, mastered: false, isFocus: true, progress: 63, hintHelpfulness: "medium" },
        
        // Supporting concepts
        { tag: "hash-table", totalAttempts: 10, successfulAttempts: 9, mastered: true, isFocus: false, progress: 90, hintHelpfulness: "low" },
        { tag: "binary-search", totalAttempts: 4, successfulAttempts: 2, mastered: false, isFocus: false, progress: 50, hintHelpfulness: "high" },
        { tag: "sliding-window", totalAttempts: 3, successfulAttempts: 1, mastered: false, isFocus: false, progress: 33, hintHelpfulness: "high" },
        { tag: "stack", totalAttempts: 7, successfulAttempts: 4, mastered: false, isFocus: false, progress: 57, hintHelpfulness: "medium" },
        { tag: "dynamic-programming", totalAttempts: 12, successfulAttempts: 4, mastered: false, isFocus: false, progress: 33, hintHelpfulness: "high" }
      ]
    } // For Strategy/Learning Path page
  };
}

/**
 * Creates goals object with learning plan and missions
 */
function createGoalsObject() {
  return {
    learningPlan: {
      cadence: {
        sessionsPerWeek: 5,
        sessionLength: 45,
        flexibleSchedule: true
      },
      focus: {
        primaryTags: ["Dynamic Programming", "Graph Theory"],
        difficultyDistribution: { easy: 20, medium: 60, hard: 20 },
        reviewRatio: 40
      },
      guardrails: {
        minReviewRatio: 30,
        maxNewProblems: 5,
        difficultyCapEnabled: true,
        maxDifficulty: "Medium",
        hintLimitEnabled: false,
        maxHintsPerProblem: 3
      },
      missions: [
        { id: 1, title: "Complete 2 medium DP problems", progress: 1, target: 2, type: "skill", completed: false },
        { id: 2, title: "Review 3 graph problems from Box 2", progress: 3, target: 3, type: "review", completed: true },
        { id: 3, title: "Achieve 80% accuracy today", progress: 75, target: 80, type: "performance", completed: false },
        { id: 4, title: "Use max 2 hints per problem", progress: 1, target: 3, type: "efficiency", completed: false }
      ],
      outcomeTrends: {
        weeklyAccuracy: { value: 78, status: "excellent", target: 75 },
        problemsPerWeek: { value: 23, status: "behind", target: "25-30", display: "23" },
        hintEfficiency: { value: 1.8, status: "excellent", display: "<1.8 per problem" },
        learningVelocity: { value: "Progressive", status: "on_track" }
      }
    }
  };
}

/**
 * Mock version of getDashboardStatistics that returns the same data structure
 * as the real service but with generated mock data.
 *
 * @param {string} userType - Type of user scenario to simulate
 * @returns {Object} Mock dashboard statistics in expected format
 */
export function getMockDashboardStatistics(
  userType = USER_SCENARIOS.ACTIVE_USER
) {
  logger.info("Generating mock dashboard data", { userType, context: 'mock_service' });

  try {
    // Generate mock data based on user type
    const mockData = generateMockData(userType);

    // Generate enhanced session analytics using helper function
    const enhancedSessions = createEnhancedSessions(mockData.allSessions);

    // Build result using helper functions
    const result = {
      ...createFlattenedProperties(mockData, enhancedSessions),
      nested: createNestedStructure(mockData, enhancedSessions),
      sessions: createSessionsObject(enhancedSessions),
      mastery: createMasteryObject(mockData),
      goals: createGoalsObject(),
    };

    // Debug logging to verify flattened data structure
    logger.info("Mock Dashboard Service - Data Structure Verification", { context: 'mock_verification' });
    logger.info("Mock data verification", { hasStatistics: !!result.statistics, context: 'mock_verification' });
    logger.info("Mock data verification", { hasBoxLevelData: !!result.boxLevelData, context: 'mock_verification' });
    logger.info("Mock data verification", { timerBehavior: result.timerBehavior, context: 'mock_verification' });
    logger.info("Mock data verification", { sessionsCount: result.allSessions?.length, context: 'mock_verification' });
    logger.info("Mock data verification", { problemsCount: result.allProblems?.length, context: 'mock_verification' });
    logger.info("Mock data verification", { structureKeys: Object.keys(result).filter(key => key !== 'nested'), context: 'mock_verification' });

    logger.info("Mock Dashboard Service statistics generated", { 
      sessionsCount: mockData.allSessions.length, 
      problemsCount: mockData.allProblems.length,
      context: 'mock_service'
    });
    

    return result;
  } catch (error) {
    logger.error("Error generating mock dashboard statistics", { error, context: 'mock_service' });
    throw error;
  }
}

/**
 * Enhanced mock service that can simulate different user scenarios
 * and edge cases for comprehensive UI testing.
 */
export class MockDashboardService {
  constructor() {
    this.currentUserType = USER_SCENARIOS.ACTIVE_USER;
    this.mockDelay = 500; // Simulate network delay
  }

  /**
   * Set the user type for subsequent mock data generation
   */
  setUserType(userType) {
    if (Object.values(USER_SCENARIOS).includes(userType)) {
      this.currentUserType = userType;
      logger.info("Mock service user type changed", { userType, context: 'mock_service' });
    } else {
      logger.warn("Invalid user type provided", { userType, defaultType: this.currentUserType, context: 'mock_service' });
    }
  }

  /**
   * Set mock network delay (useful for testing loading states)
   */
  setDelay(milliseconds) {
    this.mockDelay = milliseconds;
  }

  /**
   * Get dashboard statistics with configurable user type and delay
   */
  async getDashboardStatistics(userType = null) {
    const targetUserType = userType || this.currentUserType;

    // Simulate network delay
    if (this.mockDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.mockDelay));
    }

    return getMockDashboardStatistics(targetUserType);
  }

  /**
   * Generate data for all user scenarios (useful for testing)
   */
  async getAllUserScenarios() {
    const scenarios = {};

    for (const [name, type] of Object.entries(USER_SCENARIOS)) {
      scenarios[name] = await getMockDashboardStatistics(type);
    }

    return scenarios;
  }

  /**
   * Simulate error conditions for testing error handling
   */
  async getDashboardStatisticsWithError(errorType = "generic") {
    await new Promise((resolve) => setTimeout(resolve, this.mockDelay));

    const errorMessages = {
      generic: "Failed to retrieve dashboard statistics",
      network: "Network connection error",
      database: "Database connection failed",
      timeout: "Request timeout",
      permissions: "Insufficient permissions",
    };

    const error = new Error(errorMessages[errorType] || errorMessages.generic);
    error.type = errorType;

    throw error;
  }

  /**
   * Get mock data for specific chart components
   */
  getChartData(chartType, userType = null) {
    const targetUserType = userType || this.currentUserType;
    const mockData = generateMockData(targetUserType);

    const chartData = {
      accuracy: mockData.accuracyData,
      breakdown: mockData.breakdownData,
      activity: mockData.activityData,
      promotion: mockData.promotionData,
      boxDistribution: Object.entries(mockData.boxLevelData).map(
        ([key, value]) => ({
          name: `Box ${key}`,
          count: value,
        })
      ),
    };

    return chartData[chartType] || null;
  }

  /**
   * Reset to default configuration
   */
  reset() {
    this.currentUserType = USER_SCENARIOS.ACTIVE_USER;
    this.mockDelay = 500;
    // eslint-disable-next-line no-console
    logger.info("Mock Dashboard Service reset to defaults", { context: 'mock_service' });
  }
}

// Create singleton instance for easy use
export const mockDashboardService = new MockDashboardService();

/**
 * Page-specific mock data functions
 * Each function returns only the data needed for a specific page
 */

/**
 * Get mock data specifically for the Learning Progress page
 */
export async function getMockLearningProgressData(userType = USER_SCENARIOS.ACTIVE_USER) {
  const fullData = await getMockDashboardStatistics(userType);
  
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
    promotionData: fullData.promotionData,
  };
}

/**
 * Get mock data specifically for the Goals page
 */
export async function getMockGoalsData(userType = USER_SCENARIOS.ACTIVE_USER) {
  const fullData = await getMockDashboardStatistics(userType);
  return fullData.goals;
}

/**
 * Get mock data specifically for the Stats/Overview page
 */
export async function getMockStatsData(userType = USER_SCENARIOS.ACTIVE_USER) {
  const fullData = await getMockDashboardStatistics(userType);
  
  return {
    statistics: fullData.statistics,
    averageTime: fullData.averageTime,
    successRate: fullData.successRate,
    allSessions: fullData.allSessions,
    hintsUsed: fullData.hintsUsed,
    timeAccuracy: fullData.timeAccuracy,
    learningEfficiencyData: fullData.learningEfficiencyData,
  };
}

/**
 * Get mock data specifically for the Session History page
 */
export async function getMockSessionHistoryData(userType = USER_SCENARIOS.ACTIVE_USER) {
  const fullData = await getMockDashboardStatistics(userType);
  
  return {
    allSessions: fullData.sessions?.allSessions || [],
    sessionAnalytics: fullData.sessions?.sessionAnalytics || [],
    productivityMetrics: fullData.sessions?.productivityMetrics || {},
    recentSessions: fullData.sessions?.recentSessions || [],
  };
}

/**
 * Get mock data specifically for the Productivity Insights page
 */
export async function getMockProductivityInsightsData(userType = USER_SCENARIOS.ACTIVE_USER) {
  const fullData = await getMockDashboardStatistics(userType);
  
  return {
    productivityMetrics: fullData.sessions?.productivityMetrics || {},
    sessionAnalytics: fullData.sessions?.sessionAnalytics || [],
    allSessions: fullData.sessions?.allSessions || [],
    learningEfficiencyData: fullData.learningEfficiencyData,
  };
}

/**
 * Get mock data specifically for the Tag Mastery page
 */
export async function getMockTagMasteryData(userType = USER_SCENARIOS.ACTIVE_USER) {
  const fullData = await getMockDashboardStatistics(userType);
  return fullData.mastery;
}

/**
 * Get mock data specifically for the Learning Path page
 */
export async function getMockLearningPathData(userType = USER_SCENARIOS.ACTIVE_USER) {
  const fullData = await getMockDashboardStatistics(userType);
  return fullData.mastery;
}

/**
 * Get mock data specifically for the Mistake Analysis page
 */
export async function getMockMistakeAnalysisData(userType = USER_SCENARIOS.ACTIVE_USER) {
  const fullData = await getMockDashboardStatistics(userType);
  
  return {
    allAttempts: fullData.allAttempts,
    allProblems: fullData.allProblems,
    allSessions: fullData.allSessions,
    statistics: fullData.statistics,
    learningState: fullData.learningState,
    mastery: fullData.mastery,
  };
}

// Export user scenarios for easy access
export { USER_SCENARIOS };

// Default export maintains compatibility
export default {
  getMockDashboardStatistics,
  getMockLearningProgressData,
  getMockGoalsData,
  getMockStatsData,
  getMockSessionHistoryData,
  getMockProductivityInsightsData,
  getMockTagMasteryData,
  getMockLearningPathData,
  getMockMistakeAnalysisData,
  MockDashboardService,
  mockDashboardService,
  USER_SCENARIOS,
};
