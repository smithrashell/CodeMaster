/**
 * Problem Reasoning Service
 * Generates explanations for why the adaptive engine selected specific problems
 * Provides both short tooltips and detailed explanations for user transparency
 */

import { ReasoningStrategyManager } from './problemReasoningStrategies.js';

export const REASON_TYPES = {
  TAG_WEAKNESS: "tag_weakness",
  SPACED_REPETITION: "spaced_repetition",
  NEW_TAG_INTRODUCTION: "new_tag_introduction",
  DIFFICULTY_PROGRESSION: "difficulty_progression",
  PERFORMANCE_RECOVERY: "performance_recovery",
  PATTERN_REINFORCEMENT: "pattern_reinforcement",
  REVIEW_PROBLEM: "review_problem",
  NEW_PROBLEM: "new_problem",
  GENERAL: "general",
};

export class ProblemReasoningService {
  /**
   * Generate selection reasoning for a problem based on session context
   * @param {Object} problem - Problem object with tags, difficulty, attempts history
   * @param {Object} sessionContext - Current session context and user performance
   * @param {Object} userPerformance - User's tag mastery and performance data
   * @returns {Object} Reasoning object with type, details, short and full text
   */
  static generateSelectionReason(
    problem,
    sessionContext = {},
    userPerformance = {}
  ) {
    try {
      console.log(
        `🧠 Generating reason for problem: ${
          problem.problemDescription || problem.title
        }`
      );

      const strategyManager = new ReasoningStrategyManager();
      return strategyManager.generateReason(problem, sessionContext, userPerformance);
    } catch (error) {
      console.error("❌ Error generating problem selection reason:", error);
      return {
        type: REASON_TYPES.GENERAL,
        details: {},
        shortText: `Adaptive selection`,
        fullText: `Selected by adaptive learning algorithm.`,
      };
    }
  }

  // Helper methods moved to strategy classes for better encapsulation

  /**
   * Capitalize first letter of string
   * @param {string} str - String to capitalize
   * @returns {string} Capitalized string
   */
  static capitalizeFirst(str) {
    if (!str || typeof str !== "string") return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  /**
   * Generate batch reasoning for all problems in a session
   * @param {Array} problems - Array of problems in session
   * @param {Object} sessionContext - Session context and metadata
   * @param {Object} userPerformance - User performance data
   * @returns {Array} Problems with added selectionReason field
   */
  static generateSessionReasons(
    problems,
    sessionContext = {},
    userPerformance = {}
  ) {
    console.log(
      `🧠 Generating reasons for ${problems.length} problems in session`
    );

    return problems.map((problem, index) => {
      const reason = this.generateSelectionReason(
        problem,
        sessionContext,
        userPerformance
      );

      return {
        ...problem,
        selectionReason: reason,
        sessionIndex: index,
      };
    });
  }
}

export default ProblemReasoningService;
