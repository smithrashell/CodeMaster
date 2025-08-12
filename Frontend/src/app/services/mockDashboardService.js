/**
 * Mock Dashboard Service
 *
 * Provides the same interface as the real dashboard service but returns
 * realistic mock data for UI testing and development.
 */

import { generateMockData } from "./mockDataService.js";
import { USER_SCENARIOS } from "../config/mockConfig.js";

/**
 * Mock version of getDashboardStatistics that returns the same data structure
 * as the real service but with generated mock data.
 *
 * @param {string} userType - Type of user scenario to simulate
 * @returns {Promise<Object>} Mock dashboard statistics in expected format
 */
export async function getMockDashboardStatistics(
  userType = USER_SCENARIOS.ACTIVE_USER
) {
  // eslint-disable-next-line no-console
  console.log(
    `🎭 Mock Dashboard Service: Generating data for ${userType} user`
  );

  try {
    // Generate mock data based on user type
    const mockData = generateMockData(userType);

    // Generate enhanced session analytics for new pages
    const enhancedSessions = mockData.allSessions.map((session, index) => ({
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

    // Return data in the exact same structure as the real dashboard service
    const result = {
      statistics: {
        statistics: mockData.statistics,
        averageTime: mockData.averageTime,
        successRate: mockData.successRate,
        allSessions: enhancedSessions,
        // Also expose at root level since Stats component expects them here
        ...mockData.statistics,  // Spread statistics properties
        // Ensure allSessions is directly accessible
        allSessions: enhancedSessions,
        averageTime: mockData.averageTime,
        successRate: mockData.successRate,
      },
      progress: {
        learningState: mockData.learningState,
        boxLevelData: mockData.boxLevelData,
        allAttempts: mockData.allAttempts,
        allProblems: mockData.allProblems,
        allSessions: enhancedSessions,
      },
      sessions: {
        allSessions: enhancedSessions,
        recentSessions: enhancedSessions.slice(-10),
        sessionAnalytics: enhancedSessions.map(session => ({
          sessionId: session.sessionId,
          completedAt: session.Date,
          accuracy: Math.round(session.accuracy * 100) / 100,
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
      },
      mastery: {
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
        masteryData: mockData.learningState.masteryData || [
          // Core Concepts - Focus tags with good progress
          { tag: "array", totalAttempts: 15, successfulAttempts: 12, mastered: true, isFocus: true, progress: 85 },
          { tag: "string", totalAttempts: 12, successfulAttempts: 8, mastered: false, isFocus: true, progress: 67 },
          { tag: "two-pointers", totalAttempts: 8, successfulAttempts: 5, mastered: false, isFocus: true, progress: 63 },
          
          // Supporting concepts
          { tag: "hash-table", totalAttempts: 10, successfulAttempts: 9, mastered: true, isFocus: false, progress: 90 },
          { tag: "math", totalAttempts: 5, successfulAttempts: 3, mastered: false, isFocus: false, progress: 60 },
          
          // Basic Techniques (in progress)
          { tag: "binary-search", totalAttempts: 4, successfulAttempts: 2, mastered: false, isFocus: false, progress: 50 },
          { tag: "sliding-window", totalAttempts: 3, successfulAttempts: 1, mastered: false, isFocus: false, progress: 33 },
          { tag: "stack", totalAttempts: 7, successfulAttempts: 4, mastered: false, isFocus: false, progress: 57 },
          { tag: "queue", totalAttempts: 4, successfulAttempts: 2, mastered: false, isFocus: false, progress: 50 },
          
          // Intermediate (just starting)
          { tag: "dynamic-programming", totalAttempts: 12, successfulAttempts: 4, mastered: false, isFocus: false, progress: 33 },
          { tag: "greedy", totalAttempts: 5, successfulAttempts: 2, mastered: false, isFocus: false, progress: 40 },
          { tag: "heap", totalAttempts: 6, successfulAttempts: 2, mastered: false, isFocus: false, progress: 33 },
          { tag: "tree", totalAttempts: 9, successfulAttempts: 3, mastered: false, isFocus: false, progress: 33 },
          { tag: "backtracking", totalAttempts: 3, successfulAttempts: 1, mastered: false, isFocus: false, progress: 33 },
          
          // Advanced (not started yet)
          { tag: "graph", totalAttempts: 8, successfulAttempts: 2, mastered: false, isFocus: false, progress: 25 },
          { tag: "trie", totalAttempts: 2, successfulAttempts: 0, mastered: false, isFocus: false, progress: 0 },
          { tag: "segment-tree", totalAttempts: 1, successfulAttempts: 0, mastered: false, isFocus: false, progress: 0 },
          { tag: "union-find", totalAttempts: 1, successfulAttempts: 0, mastered: false, isFocus: false, progress: 0 }
        ],
        learningState: {
          ...mockData.learningState,
          // Ensure focus tags data is available at this level too
          focusTags: ["array", "string", "two-pointers"],
          masteryData: [
            // Core Concepts - Focus tags with good progress
            { tag: "array", totalAttempts: 15, successfulAttempts: 12, mastered: true, isFocus: true, progress: 85 },
            { tag: "string", totalAttempts: 12, successfulAttempts: 8, mastered: false, isFocus: true, progress: 67 },
            { tag: "two-pointers", totalAttempts: 8, successfulAttempts: 5, mastered: false, isFocus: true, progress: 63 },
            
            // Supporting concepts
            { tag: "hash-table", totalAttempts: 10, successfulAttempts: 9, mastered: true, isFocus: false, progress: 90 },
            { tag: "binary-search", totalAttempts: 4, successfulAttempts: 2, mastered: false, isFocus: false, progress: 50 },
            { tag: "sliding-window", totalAttempts: 3, successfulAttempts: 1, mastered: false, isFocus: false, progress: 33 },
            { tag: "stack", totalAttempts: 7, successfulAttempts: 4, mastered: false, isFocus: false, progress: 57 },
            { tag: "dynamic-programming", totalAttempts: 12, successfulAttempts: 4, mastered: false, isFocus: false, progress: 33 }
          ]
        } // For Strategy/Learning Path page
      },
    };

    // eslint-disable-next-line no-console
    console.log(
      `✅ Mock Dashboard Service: Generated statistics for ${mockData.allSessions.length} sessions, ${mockData.allProblems.length} problems`
    );
    

    return result;
  } catch (error) {
    console.error("❌ Error generating mock dashboard statistics:", error);
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
      // eslint-disable-next-line no-console
      console.log(`🎭 Mock service user type changed to: ${userType}`);
    } else {
      // eslint-disable-next-line no-console
      console.warn(
        `⚠️ Invalid user type: ${userType}. Using default: ${this.currentUserType}`
      );
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
  async getChartData(chartType, userType = null) {
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
    console.log("🎭 Mock Dashboard Service reset to defaults");
  }
}

// Create singleton instance for easy use
export const mockDashboardService = new MockDashboardService();

// Export user scenarios for easy access
export { USER_SCENARIOS };

// Default export maintains compatibility
export default {
  getMockDashboardStatistics,
  MockDashboardService,
  mockDashboardService,
  USER_SCENARIOS,
};
