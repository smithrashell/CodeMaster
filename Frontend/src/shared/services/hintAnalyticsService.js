import { HintInteractionService } from "./hintInteractionService.js";
import {
  getInteractionsByDateRange,
  getInteractionsByDifficultyAndType,
  getInteractionsByHintType,
  getInteractionsByAction,
} from "../db/hint_interactions.js";

/**
 * Advanced analytics service for hint usage insights
 * Provides data-driven insights for system optimization
 */
export class HintAnalyticsService {
  /**
   * Generate comprehensive hint effectiveness report
   * @param {Object} options - Query options (dateRange, difficulty, etc.)
   * @returns {Promise<Object>} - Complete effectiveness report
   */
  static async generateEffectivenessReport(options = {}) {
    try {
      const {
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        endDate = new Date(),
        difficulty = null,
        hintType = null,
      } = options;

      console.log("📊 Generating hint effectiveness report...");

      // Get system-wide analytics
      const systemAnalytics = await HintInteractionService.getSystemAnalytics({
        startDate,
        endDate,
        difficulty,
        hintType,
      });

      // Get detailed engagement patterns
      const engagementPatterns = await this._analyzeEngagementPatterns(
        startDate,
        endDate
      );

      // Get hint type performance comparison
      const hintTypeComparison = await this._compareHintTypePerformance();

      // Get difficulty-based insights
      const difficultyInsights = await this._analyzeDifficultyPatterns();

      // Generate recommendations
      const recommendations = await this._generateRecommendations(
        systemAnalytics
      );

      const report = {
        generatedAt: new Date().toISOString(),
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
        filters: { difficulty, hintType },
        summary: {
          totalInteractions: systemAnalytics.overview.totalInteractions,
          uniqueProblems: systemAnalytics.overview.uniqueProblems,
          uniqueSessions: systemAnalytics.overview.uniqueSessions,
          averageEngagementRate: this._calculateAverageEngagement(
            systemAnalytics.effectiveness
          ),
        },
        systemAnalytics,
        engagementPatterns,
        hintTypeComparison,
        difficultyInsights,
        recommendations,
        insights: this._generateKeyInsights(
          systemAnalytics,
          engagementPatterns
        ),
      };

      console.log("✅ Hint effectiveness report generated successfully");
      return report;
    } catch (error) {
      console.error("❌ Error generating effectiveness report:", error);
      throw error;
    }
  }

  /**
   * Get most helpful hint types per difficulty/tag combination
   * @returns {Promise<Array>} - Sorted list of most helpful hints
   */
  static async getMostHelpfulHints() {
    try {
      const effectiveness = await HintInteractionService.getSystemAnalytics();

      const helpfulHints = Object.values(effectiveness.effectiveness)
        .filter((hint) => hint.totalInteractions >= 5) // Minimum sample size
        .sort((a, b) => b.engagementRate - a.engagementRate)
        .slice(0, 10)
        .map((hint) => ({
          hintType: hint.hintType,
          difficulty: hint.difficulty,
          engagementRate: (hint.engagementRate * 100).toFixed(1) + "%",
          totalInteractions: hint.totalInteractions,
          uniqueProblems: hint.uniqueProblems,
          score: this._calculateHelpfulnessScore(hint),
        }));

      return helpfulHints;
    } catch (error) {
      console.error("Error getting most helpful hints:", error);
      throw error;
    }
  }

  /**
   * Get user engagement patterns and drop-off analysis
   * @returns {Promise<Object>} - Engagement analysis
   */
  static async getEngagementAnalysis() {
    try {
      const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const now = new Date();

      const interactions = await getInteractionsByDateRange(last30Days, now);

      const analysis = {
        totalInteractions: interactions.length,
        engagementMetrics: {
          expandRate: this._calculateActionRate(interactions, "expand"),
          dismissRate: this._calculateActionRate(interactions, "dismissed"),
          copyRate: this._calculateActionRate(interactions, "copied"),
          collapseRate: this._calculateActionRate(interactions, "collapse"),
        },
        temporalPatterns: this._analyzeTemporalPatterns(interactions),
        sessionEngagement: this._analyzeSessionEngagement(interactions),
        dropOffPoints: this._identifyDropOffPoints(interactions),
      };

      return analysis;
    } catch (error) {
      console.error("Error analyzing engagement patterns:", error);
      throw error;
    }
  }

  /**
   * Get effectiveness metrics for different hint presentation methods
   * @returns {Promise<Object>} - Presentation method comparison
   */
  static async getPresentationMethodEffectiveness() {
    try {
      const contextualHints = await getInteractionsByHintType("contextual");
      const generalHints = await getInteractionsByHintType("general");
      const primerHints = await getInteractionsByHintType("primer");
      const panelHints = await getInteractionsByHintType("panel");

      const effectiveness = {
        contextual: this._calculatePresentationEffectiveness(
          contextualHints,
          "Contextual Hints"
        ),
        general: this._calculatePresentationEffectiveness(
          generalHints,
          "General Hints"
        ),
        primer: this._calculatePresentationEffectiveness(
          primerHints,
          "Primer Section"
        ),
        panel: this._calculatePresentationEffectiveness(
          panelHints,
          "Hint Panel"
        ),
      };

      // Sort by effectiveness
      const sortedMethods = Object.entries(effectiveness)
        .sort(([, a], [, b]) => b.engagementRate - a.engagementRate)
        .map(([method, data]) => ({ method, ...data }));

      return {
        comparison: effectiveness,
        ranking: sortedMethods,
        insights: this._generatePresentationInsights(sortedMethods),
      };
    } catch (error) {
      console.error(
        "Error analyzing presentation method effectiveness:",
        error
      );
      throw error;
    }
  }

  // Private helper methods

  static async _analyzeEngagementPatterns(startDate, endDate) {
    const interactions = await getInteractionsByDateRange(startDate, endDate);

    return {
      dailyActivity: this._groupByDay(interactions),
      hourlyPatterns: this._groupByHour(interactions),
      actionDistribution: this._calculateActionDistribution(interactions),
      averageSessionDuration:
        this._calculateAverageSessionDuration(interactions),
    };
  }

  static async _compareHintTypePerformance() {
    const hintTypes = ["contextual", "general", "primer", "panel"];
    const comparison = {};

    for (const type of hintTypes) {
      const interactions = await getInteractionsByHintType(type);
      comparison[type] = {
        totalInteractions: interactions.length,
        engagementRate: this._calculateActionRate(interactions, "expand"),
        averageSessionsPerProblem:
          this._calculateAverageSessionsPerProblem(interactions),
        retentionScore: this._calculateRetentionScore(interactions),
      };
    }

    return comparison;
  }

  static async _analyzeDifficultyPatterns() {
    const difficulties = ["Easy", "Medium", "Hard"];
    const patterns = {};

    for (const difficulty of difficulties) {
      const contextualHints = await getInteractionsByDifficultyAndType(
        difficulty,
        "contextual"
      );
      const generalHints = await getInteractionsByDifficultyAndType(
        difficulty,
        "general"
      );

      patterns[difficulty] = {
        totalInteractions: contextualHints.length + generalHints.length,
        contextualEngagement: this._calculateActionRate(
          contextualHints,
          "expand"
        ),
        generalEngagement: this._calculateActionRate(generalHints, "expand"),
        preferredType:
          contextualHints.length > generalHints.length
            ? "contextual"
            : "general",
        insights: this._generateDifficultyInsights(
          difficulty,
          contextualHints,
          generalHints
        ),
      };
    }

    return patterns;
  }

  static async _generateRecommendations(analytics) {
    const recommendations = [];

    // Analyze effectiveness data for recommendations
    const effectivenessArray = Object.values(analytics.effectiveness);

    if (effectivenessArray.length === 0) {
      recommendations.push({
        type: "data",
        priority: "low",
        message:
          "Not enough interaction data for meaningful recommendations. Continue collecting data.",
      });
      return recommendations;
    }

    // Find most and least effective hint types
    const mostEffective = effectivenessArray.reduce((a, b) =>
      a.engagementRate > b.engagementRate ? a : b
    );
    const leastEffective = effectivenessArray.reduce((a, b) =>
      a.engagementRate < b.engagementRate ? a : b
    );

    if (mostEffective.engagementRate > 0.7) {
      recommendations.push({
        type: "optimization",
        priority: "medium",
        message: `${mostEffective.hintType} hints for ${
          mostEffective.difficulty
        } problems are highly effective (${(
          mostEffective.engagementRate * 100
        ).toFixed(1)}%). Consider expanding this approach to similar contexts.`,
      });
    }

    if (
      leastEffective.engagementRate < 0.3 &&
      leastEffective.totalInteractions > 10
    ) {
      recommendations.push({
        type: "improvement",
        priority: "high",
        message: `${leastEffective.hintType} hints for ${
          leastEffective.difficulty
        } problems have low engagement (${(
          leastEffective.engagementRate * 100
        ).toFixed(1)}%). Consider revising content or presentation method.`,
      });
    }

    // Check for data volume recommendations
    const totalInteractions = analytics.overview.totalInteractions;
    if (totalInteractions < 100) {
      recommendations.push({
        type: "data",
        priority: "medium",
        message:
          "Limited interaction data. Continue collecting data for more reliable insights.",
      });
    }

    return recommendations;
  }

  // Utility calculation methods

  static _calculateAverageEngagement(effectiveness) {
    const rates = Object.values(effectiveness).map((e) => e.engagementRate);
    return rates.length > 0
      ? rates.reduce((a, b) => a + b, 0) / rates.length
      : 0;
  }

  static _calculateHelpfulnessScore(hint) {
    // Weighted score based on engagement rate, sample size, and problem coverage
    const engagementWeight = hint.engagementRate * 0.6;
    const sampleWeight = Math.min(hint.totalInteractions / 50, 1) * 0.2;
    const coverageWeight = Math.min(hint.uniqueProblems / 10, 1) * 0.2;

    return (engagementWeight + sampleWeight + coverageWeight) * 100;
  }

  static _calculateActionRate(interactions, action) {
    const validInteractions = interactions.filter(
      (i) => i && typeof i === "object"
    );
    const actionCount = validInteractions.filter(
      (i) => i.userAction === action
    ).length;
    return validInteractions.length > 0
      ? actionCount / validInteractions.length
      : 0;
  }

  static _calculatePresentationEffectiveness(interactions, methodName) {
    return {
      name: methodName,
      totalInteractions: interactions.length,
      engagementRate: this._calculateActionRate(interactions, "expand"),
      dismissalRate: this._calculateActionRate(interactions, "dismissed"),
      uniqueProblems: new Set(interactions.map((i) => i.problemId)).size,
      averageSessionsPerProblem:
        this._calculateAverageSessionsPerProblem(interactions),
    };
  }

  static _calculateAverageSessionsPerProblem(interactions) {
    const problemSessions = {};
    interactions.forEach((i) => {
      if (!problemSessions[i.problemId]) {
        problemSessions[i.problemId] = new Set();
      }
      problemSessions[i.problemId].add(i.sessionId);
    });

    const sessionCounts = Object.values(problemSessions).map(
      (sessions) => sessions.size
    );
    return sessionCounts.length > 0
      ? sessionCounts.reduce((a, b) => a + b, 0) / sessionCounts.length
      : 0;
  }

  static _calculateRetentionScore(interactions) {
    // Calculate how often users return to hints for the same problem
    const problemReturns = {};
    interactions.forEach((i) => {
      if (!problemReturns[i.problemId]) {
        problemReturns[i.problemId] = [];
      }
      problemReturns[i.problemId].push(i.timestamp);
    });

    let totalReturns = 0;
    let problemsWithReturns = 0;

    Object.values(problemReturns).forEach((timestamps) => {
      if (timestamps.length > 1) {
        totalReturns += timestamps.length - 1;
        problemsWithReturns++;
      }
    });

    const totalProblems = Object.keys(problemReturns).length;
    return totalProblems > 0 ? problemsWithReturns / totalProblems : 0;
  }

  static _groupByDay(interactions) {
    const daily = {};
    interactions.forEach((i) => {
      if (i && i.timestamp) {
        const date = new Date(i.timestamp).toDateString();
        daily[date] = (daily[date] || 0) + 1;
      }
    });
    return daily;
  }

  static _groupByHour(interactions) {
    const hourly = Array(24).fill(0);
    interactions.forEach((i) => {
      if (i && i.timestamp) {
        const hour = new Date(i.timestamp).getUTCHours();
        hourly[hour]++;
      }
    });
    return hourly;
  }

  static _calculateActionDistribution(interactions) {
    const actions = {};
    interactions.forEach((i) => {
      actions[i.userAction] = (actions[i.userAction] || 0) + 1;
    });
    return actions;
  }

  static _calculateAverageSessionDuration(interactions) {
    const sessions = {};
    interactions.forEach((i) => {
      if (!sessions[i.sessionId]) {
        sessions[i.sessionId] = [];
      }
      sessions[i.sessionId].push(new Date(i.timestamp).getTime());
    });

    const durations = Object.values(sessions)
      .filter((timestamps) => timestamps.length > 1)
      .map((timestamps) => {
        const sorted = timestamps.sort();
        return sorted[sorted.length - 1] - sorted[0];
      });

    return durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;
  }

  static _analyzeTemporalPatterns(interactions) {
    return {
      peakHours: this._findPeakHours(interactions),
      peakDays: this._findPeakDays(interactions),
      activityTrend: this._calculateActivityTrend(interactions),
    };
  }

  static _analyzeSessionEngagement(interactions) {
    const sessionData = {};

    interactions.forEach((i) => {
      if (i && i.sessionId) {
        if (!sessionData[i.sessionId]) {
          sessionData[i.sessionId] = {
            interactions: 0,
            problems: new Set(),
            actions: {},
          };
        }

        sessionData[i.sessionId].interactions++;
        if (i.problemId) {
          sessionData[i.sessionId].problems.add(i.problemId);
        }
        if (i.userAction) {
          sessionData[i.sessionId].actions[i.userAction] =
            (sessionData[i.sessionId].actions[i.userAction] || 0) + 1;
        }
      }
    });

    const sessions = Object.values(sessionData);

    if (sessions.length === 0) {
      return {
        averageInteractionsPerSession: 0,
        averageProblemsPerSession: 0,
        highEngagementSessions: 0,
      };
    }

    return {
      averageInteractionsPerSession:
        sessions.reduce((a, b) => a + b.interactions, 0) / sessions.length,
      averageProblemsPerSession:
        sessions.reduce((a, b) => a + b.problems.size, 0) / sessions.length,
      highEngagementSessions: sessions.filter((s) => s.interactions > 5).length,
    };
  }

  static _identifyDropOffPoints(interactions) {
    // Analyze where users stop engaging with hints
    const problemEngagement = {};

    interactions.forEach((i) => {
      if (i && i.problemId) {
        if (!problemEngagement[i.problemId]) {
          problemEngagement[i.problemId] = [];
        }
        problemEngagement[i.problemId].push(i);
      }
    });

    const dropOffPatterns = {
      quickDismissals: 0,
      noReturns: 0,
      shortSessions: 0,
    };

    Object.values(problemEngagement).forEach((problemInteractions) => {
      if (
        problemInteractions.length === 1 &&
        problemInteractions[0].userAction === "dismissed"
      ) {
        dropOffPatterns.quickDismissals++;
      }

      if (problemInteractions.length === 1) {
        dropOffPatterns.noReturns++;
      }

      const sessionDuration =
        this._calculateSessionDuration(problemInteractions);
      if (sessionDuration < 30000) {
        // Less than 30 seconds
        dropOffPatterns.shortSessions++;
      }
    });

    return dropOffPatterns;
  }

  static _calculateSessionDuration(interactions) {
    const timestamps = interactions
      .map((i) => new Date(i.timestamp).getTime())
      .sort();
    return timestamps.length > 1
      ? timestamps[timestamps.length - 1] - timestamps[0]
      : 0;
  }

  static _generateKeyInsights(systemAnalytics, engagementPatterns) {
    const insights = [];

    // Most effective hint type
    const effectiveness = Object.values(systemAnalytics.effectiveness);
    if (effectiveness.length > 0) {
      const mostEffective = effectiveness.reduce((a, b) =>
        a.engagementRate > b.engagementRate ? a : b
      );
      insights.push(
        `Most effective: ${mostEffective.hintType} hints for ${mostEffective.difficulty} problems`
      );
    }

    // Peak usage time
    if (engagementPatterns.temporalPatterns) {
      insights.push(
        `Peak usage occurs during ${engagementPatterns.temporalPatterns.peakHours} hours`
      );
    }

    // Engagement trend
    const totalInteractions = systemAnalytics.overview.totalInteractions;
    if (totalInteractions > 50) {
      insights.push(
        `Strong user engagement with ${totalInteractions} total interactions across ${systemAnalytics.overview.uniqueProblems} problems`
      );
    }

    return insights;
  }

  static _findPeakHours(interactions) {
    const hourCounts = this._groupByHour(interactions);
    const maxHour = hourCounts.indexOf(Math.max(...hourCounts));
    return `${maxHour}:00-${maxHour + 1}:00`;
  }

  static _findPeakDays(interactions) {
    const dailyCounts = this._groupByDay(interactions);
    const entries = Object.entries(dailyCounts);
    if (entries.length === 0) {
      return "No data";
    }
    const maxDay = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
    return maxDay[0];
  }

  static _calculateActivityTrend(interactions) {
    // Simple trend analysis - comparing first half vs second half of data
    const validInteractions = interactions.filter((i) => i && i.timestamp);
    if (validInteractions.length === 0) {
      return {
        trend: "no data",
        changeRate: 0,
      };
    }

    const sorted = validInteractions.sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );
    const midpoint = Math.floor(sorted.length / 2);

    const firstHalf = sorted.slice(0, midpoint);
    const secondHalf = sorted.slice(midpoint);

    return {
      trend: secondHalf.length > firstHalf.length ? "increasing" : "decreasing",
      changeRate:
        firstHalf.length > 0
          ? (secondHalf.length - firstHalf.length) / firstHalf.length
          : 0,
    };
  }

  static _generateDifficultyInsights(difficulty, contextual, general) {
    const insights = [];

    const contextualRate = this._calculateActionRate(contextual, "expand");
    const generalRate = this._calculateActionRate(general, "expand");

    if (contextualRate > generalRate) {
      insights.push(`Users prefer contextual hints for ${difficulty} problems`);
    } else if (generalRate > contextualRate) {
      insights.push(`Users prefer general hints for ${difficulty} problems`);
    }

    if (contextual.length + general.length > 20) {
      insights.push(`High engagement with ${difficulty} problem hints`);
    }

    return insights;
  }

  static _generatePresentationInsights(sortedMethods) {
    const insights = [];

    if (sortedMethods.length > 0) {
      const best = sortedMethods[0];
      insights.push(
        `${best.method} is the most effective presentation method with ${(
          best.engagementRate * 100
        ).toFixed(1)}% engagement rate`
      );

      if (sortedMethods.length > 1) {
        const worst = sortedMethods[sortedMethods.length - 1];
        insights.push(
          `${worst.method} has the lowest engagement at ${(
            worst.engagementRate * 100
          ).toFixed(1)}%`
        );
      }
    }

    return insights;
  }
}
