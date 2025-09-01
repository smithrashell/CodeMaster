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
    const isReviewProblem = problem.attempts && problem.attempts.length > 0;
    if (!isReviewProblem) return false;

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
        previousAttempts: problem.attempts.length,
      },
      shortText: `Review: ${daysSinceLastAttempt}d ago`,
      fullText: `Time for spaced repetition review - last attempted ${daysSinceLastAttempt} days ago. This helps strengthen long-term retention.`,
    };
  }

  calculateDaysSinceLastAttempt(problem) {
    if (!problem.attempts || problem.attempts.length === 0) return 0;

    try {
      const lastAttempt = problem.attempts
        .map((attempt) => new Date(attempt.AttemptDate || attempt.date))
        .filter((date) => !isNaN(date))
        .sort((a, b) => b - a)[0];

      if (!lastAttempt) return 0;

      const now = new Date();
      const daysDiff = Math.floor((now - lastAttempt) / (1000 * 60 * 60 * 24));
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
    const isReviewProblem = problem.attempts && problem.attempts.length > 0;
    return isReviewProblem && this.hasRecentFailures(problem);
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
    if (!problem.attempts || problem.attempts.length < 2) return false;

    try {
      const sortedAttempts = [...problem.attempts].sort(
        (a, b) => new Date(b.AttemptDate || b.date) - new Date(a.AttemptDate || a.date)
      );

      const lastTwo = sortedAttempts.slice(0, 2);
      return lastTwo.every((attempt) => !attempt.Success);
    } catch (error) {
      console.error("Error checking recent failures:", error);
      return false;
    }
  }

  countRecentFailures(problem) {
    if (!problem.attempts) return 0;
    
    try {
      const sortedAttempts = [...problem.attempts].sort(
        (a, b) => new Date(b.AttemptDate || b.date) - new Date(a.AttemptDate || a.date)
      );
      
      let failures = 0;
      for (const attempt of sortedAttempts) {
        if (!attempt.Success) failures++;
        else break;
      }
      return failures;
    } catch (error) {
      return 0;
    }
  }

  getLastSuccessDate(problem) {
    if (!problem.attempts) return null;
    
    try {
      const sortedAttempts = [...problem.attempts].sort(
        (a, b) => new Date(b.AttemptDate || b.date) - new Date(a.AttemptDate || a.date)
      );
      
      const lastSuccess = sortedAttempts.find((attempt) => attempt.Success);
      return lastSuccess ? (lastSuccess.AttemptDate || lastSuccess.date) : null;
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
    return !problem.attempts || problem.attempts.length === 0;
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
    return problem.attempts && problem.attempts.length > 0;
  }

  generateReason(problem, _sessionContext, _userPerformance) {
    const daysSinceLastAttempt = this.calculateDaysSinceLastAttempt(problem);
    
    return {
      type: REASON_TYPES.REVIEW_PROBLEM,
      details: {
        totalAttempts: problem.attempts.length,
        daysSinceLastAttempt,
      },
      shortText: `Review: ${problem.attempts.length} attempts`,
      fullText: `Review problem to maintain proficiency - you've attempted this ${problem.attempts.length} time(s) before.`,
    };
  }

  calculateDaysSinceLastAttempt(problem) {
    if (!problem.attempts || problem.attempts.length === 0) return 0;

    try {
      const lastAttempt = problem.attempts
        .map((attempt) => new Date(attempt.AttemptDate || attempt.date))
        .filter((date) => !isNaN(date))
        .sort((a, b) => b - a)[0];

      if (!lastAttempt) return 0;

      const now = new Date();
      const daysDiff = Math.floor((now - lastAttempt) / (1000 * 60 * 60 * 24));
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