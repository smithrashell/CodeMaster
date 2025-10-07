import {
  saveHintInteraction,
  getInteractionsByProblem,
  getInteractionsBySession,
  getAllInteractions,
  getInteractionStats,
  getHintEffectiveness,
  deleteOldInteractions,
} from "../db/hint_interactions.js";
import { SessionService } from "./sessionService.js";

/**
 * Service for managing hint interactions and analytics
 * Handles persistence, session context, and privacy-compliant analytics
 */
export class HintInteractionService {
  /**
   * Save a hint interaction with complete context
   * @param {Object} interactionData - Raw interaction data from components
   * @param {Object} sessionContext - Current session context
   * @returns {Promise<Object>} - Saved interaction record
   */
  static async saveHintInteraction(interactionData, sessionContext = {}) {
    try {
      const startTime = performance.now();

      // Generate unique interaction ID using timestamp and random component
      const interactionId = `hint_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Extract session information
      let sessionId = sessionContext.session_id;
      let boxLevel = sessionContext.box_level || 1;
      let problemDifficulty = sessionContext.problem_difficulty || "Medium";

      // Try to get current session from storage if not provided
      if (!sessionId) {
        try {
          const currentSession = await SessionService.resumeSession();

          if (currentSession) {
            sessionId = currentSession.id;
          } else {
            sessionId = `session_${Date.now()}`; // Fallback session ID
          }
        } catch (error) {
          console.warn("Could not retrieve current session:", error);
          sessionId = `session_${Date.now()}`; // Fallback
        }
      }

      // Use problem context from enriched data (provided by background script) or fallback values
      if (interactionData.box_level !== undefined) {
        boxLevel = interactionData.box_level;
      }
      if (interactionData.problem_difficulty) {
        problemDifficulty = interactionData.problem_difficulty;
      }
      // Additional fallback from sessionContext if available
      if (!interactionData.box_level && sessionContext.box_level) {
        boxLevel = sessionContext.box_level;
      }
      if (!interactionData.problem_difficulty && sessionContext.problem_difficulty) {
        problemDifficulty = sessionContext.problem_difficulty;
      }

      // Build the complete interaction record (all snake_case to match database schema)
      const completeInteraction = {
        id: interactionId,
        problem_id: interactionData.problem_id || "unknown",
        hint_type: interactionData.hint_type || "general",
        hint_id:
          interactionData.hint_id ||
          `${interactionData.hint_type}_${interactionData.primary_tag}_${Date.now()}`,
        timestamp: new Date().toISOString(),
        session_id: sessionId,
        box_level: boxLevel,
        user_action:
          interactionData.action || interactionData.user_action || "clicked",
        problem_difficulty: problemDifficulty,
        tags_combination:
          interactionData.problem_tags || interactionData.tags_combination || [],

        // Additional context for analytics
        primary_tag: interactionData.primary_tag,
        related_tag: interactionData.related_tag,
        content: interactionData.content || interactionData.tip,
        relationship_score: interactionData.relationship_score || null,
        session_context: interactionData.session_context || {},

        // Performance tracking
        processing_time: null, // Will be set below
      };

      // Record processing time before saving
      const processingTime = performance.now() - startTime;
      completeInteraction.processing_time = processingTime;

      // Save to database - route through background script if in content script context
      const savedInteraction = await this._saveInteractionWithContext(completeInteraction, sessionContext);

      // Keep only error logging for debugging - removed verbose success logging for performance

      return savedInteraction;
    } catch (error) {
      console.error("❌ Failed to save hint interaction:", error);

      // For analytics - track failed saves (but don't throw to avoid breaking UI)
      console.warn("Hint interaction will not be tracked due to error:", {
        action: interactionData.action,
        hint_type: interactionData.hint_type,
        error: error.message,
      });

      // Return a minimal record indicating failure
      return {
        id: null,
        error: error.message,
        failed_data: interactionData,
      };
    }
  }

  /**
   * Get interaction analytics for a specific problem
   * @param {string} problemId - Problem identifier
   * @returns {Promise<Object>} - Analytics data for the problem
   */
  static async getProblemAnalytics(problemId) {
    try {
      const interactions = await getInteractionsByProblem(problemId);

      const analytics = {
        totalInteractions: interactions.length,
        uniqueSessions: new Set(interactions.map((i) => i.sessionId)).size,
        byAction: {},
        byHintType: {},
        engagementRate: 0,
        mostPopularHints: {},
        timeline: interactions
          .map((i) => ({
            timestamp: i.timestamp,
            action: i.userAction,
            hintType: i.hintType,
          }))
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
      };

      // Calculate breakdowns
      interactions.forEach((interaction) => {
        analytics.byAction[interaction.userAction] =
          (analytics.byAction[interaction.userAction] || 0) + 1;
        analytics.byHintType[interaction.hintType] =
          (analytics.byHintType[interaction.hintType] || 0) + 1;

        // Track hint popularity
        const hintKey = `${interaction.hintType}-${interaction.primaryTag}${
          interaction.relatedTag ? "-" + interaction.relatedTag : ""
        }`;
        analytics.mostPopularHints[hintKey] =
          (analytics.mostPopularHints[hintKey] || 0) + 1;
      });

      // Calculate engagement rate
      const expansions = analytics.byAction.expand || 0;
      analytics.engagementRate =
        interactions.length > 0 ? expansions / interactions.length : 0;

      return analytics;
    } catch (error) {
      console.error("Error getting problem analytics:", error);
      throw error;
    }
  }

  /**
   * Get interaction analytics for a specific session
   * @param {string} sessionId - Session identifier
   * @returns {Promise<Object>} - Analytics data for the session
   */
  static async getSessionAnalytics(sessionId) {
    try {
      const interactions = await getInteractionsBySession(sessionId);

      const analytics = {
        sessionId,
        totalInteractions: interactions.length,
        uniqueProblems: new Set(interactions.map((i) => i.problemId)).size,
        byAction: {},
        byHintType: {},
        averageEngagementRate: 0,
        hintEffectiveness: {},
        interactionPattern: [],
      };

      // Group by problem to calculate per-problem engagement
      const byProblem = {};
      interactions.forEach((interaction) => {
        if (!byProblem[interaction.problemId]) {
          byProblem[interaction.problemId] = [];
        }
        byProblem[interaction.problemId].push(interaction);

        // Overall breakdowns
        analytics.byAction[interaction.userAction] =
          (analytics.byAction[interaction.userAction] || 0) + 1;
        analytics.byHintType[interaction.hintType] =
          (analytics.byHintType[interaction.hintType] || 0) + 1;
      });

      // Calculate engagement per problem and average
      let totalEngagement = 0;
      Object.values(byProblem).forEach((problemInteractions) => {
        const expansions = problemInteractions.filter(
          (i) => i.userAction === "expand"
        ).length;
        const engagement =
          problemInteractions.length > 0
            ? expansions / problemInteractions.length
            : 0;
        totalEngagement += engagement;
      });

      analytics.averageEngagementRate =
        Object.keys(byProblem).length > 0
          ? totalEngagement / Object.keys(byProblem).length
          : 0;

      // Create interaction timeline
      analytics.interactionPattern = interactions
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        .map((i) => ({
          timestamp: i.timestamp,
          problemId: i.problemId,
          action: i.userAction,
          hintType: i.hintType,
        }));

      return analytics;
    } catch (error) {
      console.error("Error getting session analytics:", error);
      throw error;
    }
  }

  /**
   * Get system-wide hint effectiveness metrics
   * @param {Object} filters - Optional filters for date range, difficulty, etc.
   * @returns {Promise<Object>} - Comprehensive effectiveness analytics
   */
  static async getSystemAnalytics(filters = {}) {
    try {
      let interactions = await getAllInteractions();

      // Apply filters
      if (filters.startDate && filters.endDate) {
        const start = new Date(filters.startDate);
        const end = new Date(filters.endDate);
        interactions = interactions.filter((i) => {
          const date = new Date(i.timestamp);
          return date >= start && date <= end;
        });
      }

      if (filters.difficulty) {
        interactions = interactions.filter(
          (i) => i.problemDifficulty === filters.difficulty
        );
      }

      if (filters.hintType) {
        interactions = interactions.filter(
          (i) => i.hintType === filters.hintType
        );
      }

      // Get basic stats
      const stats = await getInteractionStats();
      const effectiveness = await getHintEffectiveness();

      // Calculate advanced metrics
      const analytics = {
        overview: stats,
        effectiveness,
        trends: {
          dailyInteractions: this._calculateDailyTrends(interactions),
          hintTypePopularity: this._calculateHintTypePopularity(interactions),
          difficultyBreakdown: this._calculateDifficultyBreakdown(interactions),
        },
        insights: this._generateInsights(interactions, effectiveness),
      };

      return analytics;
    } catch (error) {
      console.error("Error getting system analytics:", error);
      throw error;
    }
  }

  /**
   * Clean up old interaction data (for privacy and performance)
   * @param {number} daysToKeep - Number of days of data to retain (default: 90)
   * @returns {Promise<Object>} - Cleanup results
   */
  static async cleanupOldData(daysToKeep = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const deletedCount = await deleteOldInteractions(cutoffDate);

      // eslint-disable-next-line no-console
      console.log(
        `🧹 Cleaned up ${deletedCount} old hint interactions (older than ${daysToKeep} days)`
      );

      return {
        success: true,
        deletedCount,
        cutoffDate: cutoffDate.toISOString(),
        daysKept: daysToKeep,
      };
    } catch (error) {
      console.error("Error cleaning up old interaction data:", error);
      throw error;
    }
  }

  // Private helper methods for analytics calculations
  static _calculateDailyTrends(interactions) {
    const dailyCounts = {};
    interactions.forEach((interaction) => {
      const date = new Date(interaction.timestamp).toDateString();
      dailyCounts[date] = (dailyCounts[date] || 0) + 1;
    });

    return Object.entries(dailyCounts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  static _calculateHintTypePopularity(interactions) {
    const popularity = {};
    interactions.forEach((interaction) => {
      popularity[interaction.hintType] =
        (popularity[interaction.hintType] || 0) + 1;
    });

    return Object.entries(popularity)
      .map(([hintType, count]) => ({ hintType, count }))
      .sort((a, b) => b.count - a.count);
  }

  static _calculateDifficultyBreakdown(interactions) {
    const breakdown = {};
    interactions.forEach((interaction) => {
      const diff = interaction.problemDifficulty;
      if (!breakdown[diff]) {
        breakdown[diff] = { total: 0, expanded: 0 };
      }
      breakdown[diff].total++;
      if (interaction.userAction === "expand") {
        breakdown[diff].expanded++;
      }
    });

    // Calculate engagement rates
    Object.keys(breakdown).forEach((diff) => {
      breakdown[diff].engagementRate =
        breakdown[diff].total > 0
          ? breakdown[diff].expanded / breakdown[diff].total
          : 0;
    });

    return breakdown;
  }

  static _generateInsights(interactions, effectiveness) {
    const insights = [];

    // Find most effective hint types
    const effectivenessArray = Object.values(effectiveness);
    if (effectivenessArray.length > 0) {
      const mostEffective = effectivenessArray.reduce((a, b) =>
        a.engagementRate > b.engagementRate ? a : b
      );
      insights.push(
        `Most effective hints: ${mostEffective.hintType} for ${
          mostEffective.difficulty
        } problems (${(mostEffective.engagementRate * 100).toFixed(
          1
        )}% engagement)`
      );
    }

    // Find usage patterns
    const recentInteractions = interactions.filter(
      (i) =>
        new Date(i.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );
    if (recentInteractions.length > 0) {
      insights.push(
        `${recentInteractions.length} hint interactions in the past week`
      );
    }

    return insights;
  }

  /**
   * Save interaction with context detection - routes through background script if in content script
   * @param {Object} interactionData - Complete interaction data
   * @param {Object} sessionContext - Session context information
   * @returns {Promise<Object>} - Saved interaction record
   * @private
   */
  static async _saveInteractionWithContext(interactionData, sessionContext) {
    // Detect if we're running in a content script context
    const isContentScript = this._isContentScriptContext();

    if (isContentScript) {
      // eslint-disable-next-line no-console
      console.log("🔄 Routing hint interaction through background script");
      
      // Use Chrome messaging to route through background script
      return new Promise((resolve, reject) => {
        if (typeof chrome === 'undefined' || !chrome.runtime) {
          reject(new Error('Chrome extension API not available'));
          return;
        }

        // Use longer timeout for hint interactions due to IndexedDB operations
        const timeoutId = setTimeout(() => {
          reject(new Error('Hint interaction save timeout - background script may be busy'));
        }, 15000); // 15 second timeout for IndexedDB operations

        chrome.runtime.sendMessage({
          type: "saveHintInteraction",
          data: interactionData,
          sessionContext: sessionContext
        }, (response) => {
          clearTimeout(timeoutId);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response.interaction);
          }
        });
      });
    } else {
      // eslint-disable-next-line no-console
      console.log("💾 Direct database save (background/dashboard context)");
      
      // Direct database access (background script or dashboard context)
      return await saveHintInteraction(interactionData);
    }
  }

  /**
   * Detect if we're running in a content script context
   * @returns {boolean} - True if content script, false if background/dashboard
   * @private
   */
  static _isContentScriptContext() {
    try {
      // Content scripts have window object and run on web pages
      if (typeof window !== 'undefined' && window.location) {
        // Check if we're on a web page (not extension page)
        const protocol = window.location.protocol;
        const isWebPage = protocol === 'http:' || protocol === 'https:';
        const isNotExtensionPage = !window.location.href.startsWith('chrome-extension://');
        
        return isWebPage && isNotExtensionPage;
      }
      
      // Background scripts don't have window object
      return false;
    } catch (error) {
      // If any error in detection, assume content script for safety
      return true;
    }
  }
}
