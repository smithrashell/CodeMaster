/**
 * Problem reasoning strategies for adaptive algorithm selection
 * Refactored from generateSelectionReason to use strategy pattern
 */

import { REASON_TYPES } from './problemReasoningService.js';

/**
 * Base strategy class for problem selection reasoning
 */
class ReasoningStrategy {
  constructor(priority = 0) {
    this.priority = priority;
  }

  /**
   * Check if this strategy applies to the given context
   * @param {Object} problem - Problem data
   * @param {Object} _sessionContext - Session context
   * @param {Object} _userPerformance - User performance data
   * @returns {boolean} Whether this strategy should be used
   */
  applies(_problem, __sessionContext, __userPerformance) {
    throw new Error('applies method must be implemented');
  }

  /**
   * Generate reasoning for problem selection
   * @param {Object} problem - Problem data
   * @param {Object} _sessionContext - Session context  
   * @param {Object} _userPerformance - User performance data
   * @returns {Object} Reasoning object with type, details, shortText, fullText
   */
  generateReason(_problem, __sessionContext, __userPerformance) {
    throw new Error('generateReason method must be implemented');
  }
}

/**
 * Spaced repetition strategy - highest priority
 */
export class SpacedRepetitionStrategy extends ReasoningStrategy {
  constructor() {
    super(1); // Highest priority
  }

  applies(problem, __sessionContext, __userPerformance) {
    // Check if problem has been attempted before
    const hasAttempts = problem.attempt_stats && problem.attempt_stats.total_attempts > 0;

    if (!hasAttempts) return false;

    const daysSinceLastAttempt = this.calculateDaysSinceLastAttempt(problem);
    return daysSinceLastAttempt >= 7;
  }

  generateReason(problem, __sessionContext, __userPerformance) {
    const daysSinceLastAttempt = this.calculateDaysSinceLastAttempt(problem);

    return {
      type: REASON_TYPES.SPACED_REPETITION,
      details: {
        daysSinceLastAttempt,
        optimalInterval: 7,
        previousAttempts: problem.attempt_stats?.total_attempts || 0,
      },
      shortText: `Review: ${daysSinceLastAttempt}d ago`,
      fullText: `Time for spaced repetition review - last attempted ${daysSinceLastAttempt} days ago. This helps strengthen long-term retention.`,
    };
  }

  calculateDaysSinceLastAttempt(problem) {
    try {
      // Use last_attempt_date directly from problem object
      if (!problem.last_attempt_date) return 0;

      const lastAttemptDate = new Date(problem.last_attempt_date);
      if (isNaN(lastAttemptDate)) return 0;

      const now = new Date();
      const daysDiff = Math.floor((now - lastAttemptDate) / (1000 * 60 * 60 * 24));
      return Math.max(0, daysDiff);
    } catch (error) {
      console.error("Error calculating days since last attempt:", error);
      return 0;
    }
  }
}

/**
 * Tag weakness strategy - focus on improving weak areas
 */
export class TagWeaknessStrategy extends ReasoningStrategy {
  constructor() {
    super(2);
  }

  applies(problem, _sessionContext, _userPerformance) {
    const problemTags = problem.tags || problem.Tags || [];
    const primaryTag = problemTags.length > 0 ? problemTags[0] : null;
    
    return primaryTag &&
           _userPerformance.weakTags &&
           _userPerformance.weakTags.includes(primaryTag.toLowerCase());
  }

  generateReason(problem, _sessionContext, _userPerformance) {
    const problemTags = problem.tags || problem.Tags || [];
    const primaryTag = problemTags[0];
    const tagAccuracy = _userPerformance.tagAccuracy?.[primaryTag.toLowerCase()] || 0;
    
    return {
      type: REASON_TYPES.TAG_WEAKNESS,
      details: {
        weakTag: primaryTag,
        currentAccuracy: tagAccuracy,
        targetAccuracy: 0.8,
        totalProblems: _userPerformance.tagAttempts?.[primaryTag.toLowerCase()] || 0,
      },
      shortText: `Weak tag: ${this.capitalizeFirst(primaryTag)}`,
      fullText: `Selected to improve ${primaryTag} performance (currently ${Math.round(
        tagAccuracy * 100
      )}% accuracy). Target: 80%+`,
    };
  }

  capitalizeFirst(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
  }
}

/**
 * New tag introduction strategy - introduce new concepts
 */
export class NewTagIntroductionStrategy extends ReasoningStrategy {
  constructor() {
    super(3);
  }

  applies(problem, _sessionContext, _userPerformance) {
    const problemTags = problem.tags || problem.Tags || [];
    const primaryTag = problemTags.length > 0 ? problemTags[0] : null;
    
    return primaryTag &&
           _userPerformance.newTags &&
           _userPerformance.newTags.includes(primaryTag.toLowerCase());
  }

  generateReason(problem, _sessionContext, _userPerformance) {
    const problemTags = problem.tags || problem.Tags || [];
    const primaryTag = problemTags[0];
    
    return {
      type: REASON_TYPES.NEW_TAG_INTRODUCTION,
      details: {
        newTag: primaryTag,
        totalNewTags: _userPerformance.newTags.length,
      },
      shortText: `New tag: ${this.capitalizeFirst(primaryTag)}`,
      fullText: `Introducing new algorithmic concept: ${primaryTag}. This expands your problem-solving toolkit.`,
    };
  }

  capitalizeFirst(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
  }
}

/**
 * Difficulty progression strategy - match appropriate difficulty level
 */
export class DifficultyProgressionStrategy extends ReasoningStrategy {
  constructor() {
    super(4);
  }

  applies(problem, _sessionContext, _userPerformance) {
    return _sessionContext.difficultyProgression && 
           problem.difficulty &&
           _sessionContext.targetDifficulty &&
           problem.difficulty.toLowerCase() === _sessionContext.targetDifficulty.toLowerCase();
  }

  generateReason(problem, _sessionContext, _userPerformance) {
    return {
      type: REASON_TYPES.DIFFICULTY_PROGRESSION,
      details: {
        currentDifficulty: problem.difficulty,
        progressionReason: _sessionContext.progressionReason || "performance-based",
      },
      shortText: `Difficulty: ${problem.difficulty}`,
      fullText: `Selected to match your current ${problem.difficulty.toLowerCase()} level progression. Building confidence at appropriate difficulty.`,
    };
  }
}

/**
 * Performance recovery strategy - help with recently failed problems
 */
export class PerformanceRecoveryStrategy extends ReasoningStrategy {
  constructor() {
    super(5);
  }

  applies(problem, _sessionContext, _userPerformance) {
    // Check if problem has been attempted before
    const hasAttempts = !!(problem.attempt_stats && problem.attempt_stats.total_attempts > 0);

    return hasAttempts && this.hasRecentFailures(problem);
  }

  generateReason(problem, _sessionContext, _userPerformance) {
    return {
      type: REASON_TYPES.PERFORMANCE_RECOVERY,
      details: {
        recentFailures: this.countRecentFailures(problem),
        lastSuccess: this.getLastSuccessDate(problem),
      },
      shortText: `Recovery: Recent struggles`,
      fullText: `Selected for performance recovery - you've had difficulty with this problem recently. Practice makes perfect!`,
    };
  }

  hasRecentFailures(problem) {
    if (!problem.attempt_stats || problem.attempt_stats.total_attempts < 2) return false;

    try {
      const { total_attempts, unsuccessful_attempts } = problem.attempt_stats;
      // Consider it a recent failure pattern if more than half the attempts failed
      return unsuccessful_attempts >= (total_attempts / 2);
    } catch (error) {
      console.error("Error checking recent failures:", error);
      return false;
    }
  }

  countRecentFailures(problem) {
    if (!problem.attempt_stats) return 0;

    try {
      return problem.attempt_stats.unsuccessful_attempts || 0;
    } catch (error) {
      return 0;
    }
  }

  getLastSuccessDate(problem) {
    try {
      // If problem has successful attempts, return last attempt date
      if (problem.attempt_stats?.successful_attempts > 0 && problem.last_attempt_date) {
        return problem.last_attempt_date;
      }
      return null;
    } catch (error) {
      return null;
    }
  }
}

/**
 * Pattern reinforcement strategy - reinforce successful patterns
 */
export class PatternReinforcementStrategy extends ReasoningStrategy {
  constructor() {
    super(6);
  }

  applies(problem, _sessionContext, _userPerformance) {
    const problemTags = problem.tags || problem.Tags || [];
    const primaryTag = problemTags.length > 0 ? problemTags[0] : null;
    
    return _sessionContext.patternReinforcement && primaryTag;
  }

  generateReason(problem, _sessionContext, _userPerformance) {
    const problemTags = problem.tags || problem.Tags || [];
    const primaryTag = problemTags[0];
    const successRate = _userPerformance.tagAccuracy?.[primaryTag.toLowerCase()] || 0;
    
    return {
      type: REASON_TYPES.PATTERN_REINFORCEMENT,
      details: {
        reinforcedTag: primaryTag,
        successRate,
      },
      shortText: `Pattern: ${this.capitalizeFirst(primaryTag)}`,
      fullText: `Reinforcing successful patterns with ${primaryTag} problems (${Math.round(successRate * 100)}% success rate).`,
    };
  }

  capitalizeFirst(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
  }
}

/**
 * New problem strategy - default for new problems
 */
export class NewProblemStrategy extends ReasoningStrategy {
  constructor() {
    super(7);
  }

  applies(problem, _sessionContext, _userPerformance) {
    // New problem = no attempt_stats or zero attempts
    return !problem.attempt_stats || problem.attempt_stats.total_attempts === 0;
  }

  generateReason(problem, _sessionContext, _userPerformance) {
    const problemTags = problem.tags || problem.Tags || [];
    
    return {
      type: REASON_TYPES.NEW_PROBLEM,
      details: {
        problemTags: problemTags,
        difficulty: problem.difficulty || "Unknown",
      },
      shortText: `New: ${problem.difficulty || "Practice"}`,
      fullText: `New problem selected to expand your experience with ${problemTags.join(", ")} concepts.`,
    };
  }
}

/**
 * Review problem strategy - default for review problems
 */
export class ReviewProblemStrategy extends ReasoningStrategy {
  constructor() {
    super(8);
  }

  applies(problem, _sessionContext, _userPerformance) {
    // Review problem = has attempt_stats with at least one attempt
    return !!(problem.attempt_stats && problem.attempt_stats.total_attempts > 0);
  }

  generateReason(problem, _sessionContext, _userPerformance) {
    const daysSinceLastAttempt = this.calculateDaysSinceLastAttempt(problem);

    // Get total attempts from attempt_stats
    const totalAttempts = problem.attempt_stats?.total_attempts || 0;

    return {
      type: REASON_TYPES.REVIEW_PROBLEM,
      details: {
        totalAttempts,
        daysSinceLastAttempt,
      },
      shortText: `Review: ${totalAttempts} attempt${totalAttempts !== 1 ? 's' : ''}`,
      fullText: `Review problem to maintain proficiency - you've attempted this ${totalAttempts} time(s) before.`,
    };
  }

  calculateDaysSinceLastAttempt(problem) {
    try {
      // Use last_attempt_date directly from problem object
      if (!problem.last_attempt_date) return 0;

      const lastAttemptDate = new Date(problem.last_attempt_date);
      if (isNaN(lastAttemptDate)) return 0;

      const now = new Date();
      const daysDiff = Math.floor((now - lastAttemptDate) / (1000 * 60 * 60 * 24));
      return Math.max(0, daysDiff);
    } catch (error) {
      console.error("Error calculating days since last attempt:", error);
      return 0;
    }
  }
}

/**
 * General strategy - fallback for all cases
 */
export class GeneralStrategy extends ReasoningStrategy {
  constructor() {
    super(9); // Lowest priority - fallback
  }

  applies(_problem, _sessionContext, _userPerformance) {
    return true; // Always applies as fallback
  }

  generateReason(_problem, _sessionContext, _userPerformance) {
    return {
      type: REASON_TYPES.GENERAL,
      details: {
        algorithmType: "adaptive",
      },
      shortText: `Adaptive selection`,
      fullText: `Selected by adaptive algorithm based on your learning progress and performance patterns.`,
    };
  }
}

/**
 * Strategy manager to coordinate all reasoning strategies
 */
export class ReasoningStrategyManager {
  constructor() {
    this.strategies = [
      new SpacedRepetitionStrategy(),
      new TagWeaknessStrategy(),
      new NewTagIntroductionStrategy(),
      new DifficultyProgressionStrategy(),
      new PerformanceRecoveryStrategy(),
      new PatternReinforcementStrategy(),
      new NewProblemStrategy(),
      new ReviewProblemStrategy(),
      new GeneralStrategy(), // Fallback - always last
    ].sort((a, b) => a.priority - b.priority); // Sort by priority
  }

  /**
   * Generate reasoning using the first applicable strategy
   * @param {Object} problem - Problem data
   * @param {Object} _sessionContext - Session context
   * @param {Object} _userPerformance - User performance data
   * @returns {Object} Reasoning result
   */
  generateReason(problem, _sessionContext, _userPerformance) {
    try {
      for (const strategy of this.strategies) {
        if (strategy.applies(problem, _sessionContext, _userPerformance)) {
          return strategy.generateReason(problem, _sessionContext, _userPerformance);
        }
      }

      // This should never happen since GeneralStrategy always applies
      return new GeneralStrategy().generateReason(problem, _sessionContext, _userPerformance);
    } catch (error) {
      console.error("❌ Error in strategy generation:", error);
      return new GeneralStrategy().generateReason(problem, _sessionContext, _userPerformance);
    }
  }
}