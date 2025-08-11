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
  console.log(
    `🎭 Mock Dashboard Service: Generating data for ${userType} user`
  );

  try {
    // Generate mock data based on user type
    const mockData = generateMockData(userType);

    // Return data in the exact same structure as the real dashboard service
    const result = {
      statistics: {
        statistics: mockData.statistics,
        averageTime: mockData.averageTime,
        successRate: mockData.successRate,
        allSessions: mockData.allSessions,
      },
      progress: {
        learningState: mockData.learningState,
        boxLevelData: mockData.boxLevelData,
        allAttempts: mockData.allAttempts,
        allProblems: mockData.allProblems,
        allSessions: mockData.allSessions,
      },
    };

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
      console.log(`🎭 Mock service user type changed to: ${userType}`);
    } else {
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
