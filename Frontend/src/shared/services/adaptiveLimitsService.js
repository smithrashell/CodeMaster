/**
 * Adaptive Limits Service for CodeMaster
 *
 * This service implements adaptive time limits that adjust based on user performance,
 * while maintaining minimum interview standards and providing user customization options.
 */

import logger from "../utils/logger.js";
// eslint-disable-next-line no-restricted-imports
import { dbHelper } from "../db/index.js";
import { fetchProblemById } from "../db/standard_problems.js";
import AccurateTimer from "../utils/AccurateTimer.js";
import { StorageService } from "./storageService.js";

// Default base limits (interview standards) in minutes
const BASE_LIMITS = {
  Easy: 15,
  Medium: 25,
  Hard: 40,
};

// User preference modes (matching settings UI options)
const LIMIT_MODES = {
  AUTO: "Auto", // Adaptive based on user performance
  OFF: "off", // No time limits
  FIXED: "Fixed", // Fixed time based on user preference
  // Legacy support for old format
  FIXED_15: "15",
  FIXED_20: "20",
  FIXED_30: "30",
};

// Default fixed time settings
const DEFAULT_FIXED_TIMES = {
  Easy: 15,
  Medium: 20,
  Hard: 30,
};

export class AdaptiveLimitsService {
  constructor() {
    this.userSettings = null;
    this.performanceCache = null;
    this.cacheExpiry = null;
  }

  /**
   * Get time limits for a specific problem
   * @param {string|number} problemId - LeetCode problem ID
   * @returns {Promise<Object>} Limit configuration
   */
  async getLimits(problemId) {
    logger.info(
      "🔍 AdaptiveLimitsService.getLimits called with problemId:",
      problemId
    );

    // Validate problemId
    if (
      !problemId ||
      (typeof problemId !== "string" && typeof problemId !== "number")
    ) {
      logger.warn(
        `⚠️ Invalid problemId provided: ${problemId}, defaulting to Medium`
      );
      const difficulty = "Medium";
      return this.getDefaultLimits(difficulty);
    }

    // First, get the official difficulty from standard_problems store
    let difficulty;
    try {
      logger.info("🔍 Fetching standard problem for ID:", problemId);
      const standardProblem = await fetchProblemById(problemId);
      logger.info("🔍 Standard problem result:", standardProblem);
      difficulty = standardProblem?.difficulty;

      if (!difficulty) {
        logger.warn(
          `⚠️ No difficulty found for problem ${problemId}, defaulting to Medium`
        );
        difficulty = "Medium";
      } else {
        logger.info("✅ Found difficulty:", difficulty);
      }
    } catch (error) {
      logger.error(
        `❌ Error fetching difficulty for problem ${problemId}:`,
        error
      );
      difficulty = "Medium"; // Fallback
    }
    try {
      logger.info("🔍 AdaptiveLimitsService.getLimits called with:", {
        difficulty,
        problemId,
      });

      const settings = await this.getUserSettings();
      logger.info("🔍 Retrieved settings:", settings);

      const mode = settings.limit || LIMIT_MODES.OFF; // Use existing settings.limit field
      logger.info("🔍 Using limit mode:", mode);

      let recommendedTime;
      let minimumTime;
      let maximumTime;
      let isAdaptive = false;

      switch (mode) {
        case LIMIT_MODES.AUTO: {
          // Adaptive mode - calculate based on user performance
          const adaptiveLimit = await this.calculateAdaptiveLimit(difficulty);
          recommendedTime = adaptiveLimit;
          minimumTime = BASE_LIMITS[difficulty]; // Never go below interview standard
          maximumTime = Math.max(
            adaptiveLimit * 1.5,
            BASE_LIMITS[difficulty] * 2
          );
          isAdaptive = true;
          break;
        }

        case LIMIT_MODES.OFF:
          // No limits mode - set very high values
          recommendedTime = 999;
          minimumTime = 999;
          maximumTime = 999;
          break;

        case LIMIT_MODES.FIXED: {
          // Fixed time based on difficulty and user preference
          const fixedTime =
            settings.fixedTimes?.[difficulty] ||
            DEFAULT_FIXED_TIMES[difficulty];
          recommendedTime = fixedTime;
          minimumTime = fixedTime;
          maximumTime = fixedTime * 1.5;
          break;
        }

        case LIMIT_MODES.FIXED_15:
          // Legacy: Fixed 15 minutes for all difficulties
          recommendedTime = 15;
          minimumTime = 15;
          maximumTime = 15 * 1.5;
          break;

        case LIMIT_MODES.FIXED_20:
          // Legacy: Fixed 20 minutes for all difficulties
          recommendedTime = 20;
          minimumTime = 20;
          maximumTime = 20 * 1.5;
          break;

        case LIMIT_MODES.FIXED_30:
          // Legacy: Fixed 30 minutes for all difficulties
          recommendedTime = 30;
          minimumTime = 30;
          maximumTime = 30 * 1.5;
          break;

        default:
          // Fallback to base limits for unknown modes
          recommendedTime = BASE_LIMITS[difficulty];
          minimumTime = BASE_LIMITS[difficulty];
          maximumTime = BASE_LIMITS[difficulty] * 1.5;
          break;
      }

      const result = {
        difficulty,
        recommendedTime: Math.round(recommendedTime),
        minimumTime: Math.round(minimumTime),
        maximumTime: Math.round(maximumTime),
        mode,
        isAdaptive,
        isUnlimited: mode === LIMIT_MODES.OFF,
        baseTime: BASE_LIMITS[difficulty],
      };

      logger.info("🔍 AdaptiveLimitsService returning:", {
        ...result,
        inputDifficulty: difficulty,
        settingsLimit: settings.limit,
        modeMapping:
          {
            [LIMIT_MODES.AUTO]: "Auto mode",
            [LIMIT_MODES.OFF]: "Off mode",
            [LIMIT_MODES.FIXED]: "Fixed mode",
            [LIMIT_MODES.FIXED_15]: "Legacy 15min",
            [LIMIT_MODES.FIXED_20]: "Legacy 20min",
            [LIMIT_MODES.FIXED_30]: "Legacy 30min",
          }[mode] || "Unknown mode",
      });
      return result;
    } catch (error) {
      logger.error("❌ Error getting adaptive limits:", error);
      // Fallback to base limits
      return {
        difficulty,
        recommendedTime: BASE_LIMITS[difficulty],
        minimumTime: BASE_LIMITS[difficulty],
        maximumTime: BASE_LIMITS[difficulty] * 1.5,
        mode: "fallback",
        isAdaptive: false,
        isUnlimited: false,
        baseTime: BASE_LIMITS[difficulty],
        error: error.message,
      };
    }
  }

  /**
   * Get default limits for a difficulty when problemId is invalid
   * @param {string} difficulty - Difficulty level
   * @returns {Object} Default limit configuration
   */
  getDefaultLimits(difficulty) {
    return {
      difficulty,
      recommendedTime: BASE_LIMITS[difficulty],
      minimumTime: BASE_LIMITS[difficulty],
      maximumTime: BASE_LIMITS[difficulty] * 1.5,
      mode: "fallback",
      isAdaptive: false,
      isUnlimited: false,
      baseTime: BASE_LIMITS[difficulty],
    };
  }

  /**
   * Calculate adaptive limit based on user's historical performance
   * @param {string} difficulty - Problem difficulty
   * @returns {Promise<number>} Adaptive time limit in minutes
   */
  async calculateAdaptiveLimit(difficulty) {
    const performance = await this.getPerformanceData(difficulty);
    const baseLimit = BASE_LIMITS[difficulty];

    if (performance.attempts < 5) {
      // Not enough data - use base limit with slight buffer
      return baseLimit * 1.1;
    }

    // Calculate user's 75th percentile performance time
    const userPercentile75 = performance.percentile75 / 60; // Convert to minutes
    const userMedian = performance.median / 60;
    const userAverage = performance.average / 60;

    // Use percentile-based approach for more consistent limits
    let adaptiveLimit = Math.min(
      userPercentile75 * 1.1, // 10% buffer above 75th percentile
      userAverage * 1.2 // Cap at 20% above average
    );

    // Apply constraints
    const minLimit = baseLimit * 0.8; // Don't go more than 20% below base
    const maxLimit = baseLimit * 1.8; // Don't go more than 80% above base

    adaptiveLimit = Math.max(minLimit, Math.min(adaptiveLimit, maxLimit));

    logger.info(`📊 Adaptive limit calculation for ${difficulty}:`, {
      baseLimit,
      userMedian,
      userPercentile75,
      userAverage,
      adaptiveLimit,
      attempts: performance.attempts,
    });

    return adaptiveLimit;
  }

  /**
   * Get user performance data for a specific difficulty
   * @param {string} difficulty - Problem difficulty
   * @returns {Promise<Object>} Performance statistics
   */
  async getPerformanceData(difficulty) {
    if (this.performanceCache && this.cacheExpiry > Date.now()) {
      return this.performanceCache[difficulty] || this.getDefaultPerformance();
    }

    try {
      const db = await dbHelper.openDB();
      const transaction = db.transaction(["attempts"], "readonly");
      const store = transaction.objectStore("attempts");

      const attempts = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      // Filter attempts by difficulty and successful ones only
      const difficultyMap = { 1: "Easy", 2: "Medium", 3: "Hard" };
      const targetDifficulty = Object.keys(difficultyMap).find(
        (key) => difficultyMap[key] === difficulty
      );

      const relevantAttempts = attempts
        .filter(
          (attempt) =>
            attempt.Difficulty == targetDifficulty &&
            attempt.Success &&
            attempt.TimeSpent > 0 &&
            attempt.TimeSpent < 14400 // Exclude outliers > 4 hours
        )
        .map((attempt) => Number(attempt.TimeSpent))
        .sort((a, b) => a - b);

      if (relevantAttempts.length === 0) {
        return this.getDefaultPerformance();
      }

      const performance = this.calculateStatistics(relevantAttempts);

      // Cache the results for 1 hour
      if (!this.performanceCache) this.performanceCache = {};
      this.performanceCache[difficulty] = performance;
      this.cacheExpiry = Date.now() + 60 * 60 * 1000; // 1 hour

      return performance;
    } catch (error) {
      logger.error(
        `❌ Error getting performance data for ${difficulty}:`,
        error
      );
      return this.getDefaultPerformance();
    }
  }

  /**
   * Calculate comprehensive statistics from time data
   * @param {number[]} times - Array of time values in seconds
   * @returns {Object} Statistical data
   */
  calculateStatistics(times) {
    const sorted = [...times].sort((a, b) => a - b);
    const count = sorted.length;

    if (count === 0) return this.getDefaultPerformance();

    const sum = times.reduce((a, b) => a + b, 0);
    const average = sum / count;

    const median =
      count % 2 === 0
        ? (sorted[Math.floor(count / 2) - 1] + sorted[Math.floor(count / 2)]) /
          2
        : sorted[Math.floor(count / 2)];

    const percentile75 = sorted[Math.floor(count * 0.75)];
    const percentile90 = sorted[Math.floor(count * 0.9)];

    return {
      attempts: count,
      average: Math.round(average),
      median: Math.round(median),
      percentile75: Math.round(percentile75),
      percentile90: Math.round(percentile90),
      min: sorted[0],
      max: sorted[count - 1],
      recent: times.slice(-10), // Last 10 attempts
    };
  }

  /**
   * Get default performance data when no user data exists
   * @returns {Object} Default performance statistics
   */
  getDefaultPerformance() {
    return {
      attempts: 0,
      average: 0,
      median: 0,
      percentile75: 0,
      percentile90: 0,
      min: 0,
      max: 0,
      recent: [],
    };
  }

  /**
   * Get user settings for limits
   * @returns {Promise<Object>} User settings
   */
  async getUserSettings() {
    if (this.userSettings) return this.userSettings;

    try {
      // Use existing StorageService to get settings
      const settings = await StorageService.getSettings();

      this.userSettings = {
        limit: settings.limit || LIMIT_MODES.OFF,
        adaptive: settings.adaptive || true,
        sessionLength: settings.sessionLength || 5,
        reminder: settings.reminder || { value: false, label: "6" },
        lastUpdated: new Date().toISOString(),
      };

      return this.userSettings;
    } catch (error) {
      logger.error("❌ Error getting user settings:", error);
      return {
        limit: LIMIT_MODES.OFF,
        adaptive: true,
        sessionLength: 5,
        reminder: { value: false, label: "6" },
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  /**
   * Update user limit preferences
   * @param {Object} newSettings - New settings to apply
   * @returns {Promise<boolean>} Success status
   */
  async updateUserSettings(newSettings) {
    try {
      // Get current settings from StorageService
      const currentSettings = await StorageService.getSettings();
      const updatedSettings = {
        ...currentSettings,
        ...newSettings,
        lastUpdated: new Date().toISOString(),
      };

      // Save using existing StorageService
      const result = await StorageService.setSettings(updatedSettings);

      // Clear cache to force refresh
      this.userSettings = null;
      this.performanceCache = null;

      logger.info("✅ Updated user limit settings:", updatedSettings);
      return result.status === "success";
    } catch (error) {
      logger.error("❌ Error updating user settings:", error);
      return false;
    }
  }

  /**
   * Get detailed performance report for all difficulties
   * @returns {Promise<Object>} Complete performance report
   */
  async getPerformanceReport() {
    const report = {
      timestamp: new Date().toISOString(),
      difficulties: {},
      recommendations: [],
    };

    for (const difficulty of ["Easy", "Medium", "Hard"]) {
      const performance = await this.getPerformanceData(difficulty);
      const limits = await this.getLimits(difficulty);

      report.difficulties[difficulty] = {
        performance,
        limits,
        isDataSufficient: performance.attempts >= 5,
        avgTimeMinutes: AccurateTimer.secondsToMinutes(performance.average),
        recommendedTimeMinutes: limits.recommendedTime,
      };

      // Generate recommendations
      if (performance.attempts >= 5) {
        const avgMinutes = AccurateTimer.secondsToMinutes(performance.average);
        if (avgMinutes > limits.recommendedTime * 1.5) {
          report.recommendations.push(
            `Consider more practice on ${difficulty} problems - average time (${Math.round(
              avgMinutes
            )}m) exceeds recommendations`
          );
        } else if (avgMinutes < limits.recommendedTime * 0.7) {
          report.recommendations.push(
            `Great job on ${difficulty} problems! Consider attempting harder variations`
          );
        }
      }
    }

    return report;
  }

  /**
   * Clear performance cache (useful for testing or after major data changes)
   */
  clearCache() {
    this.performanceCache = null;
    this.cacheExpiry = null;
    this.userSettings = null;
  }
}

// Export singleton instance
export const adaptiveLimitsService = new AdaptiveLimitsService();

// Also export the class and constants for testing
export { LIMIT_MODES, BASE_LIMITS };
