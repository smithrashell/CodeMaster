/**
 * Problem Reasoning Service
 * Generates explanations for why the adaptive engine selected specific problems
 * Provides both short tooltips and detailed explanations for user transparency
 */

export const REASON_TYPES = {
  TAG_WEAKNESS: 'tag_weakness',
  SPACED_REPETITION: 'spaced_repetition', 
  NEW_TAG_INTRODUCTION: 'new_tag_introduction',
  DIFFICULTY_PROGRESSION: 'difficulty_progression',
  PERFORMANCE_RECOVERY: 'performance_recovery',
  PATTERN_REINFORCEMENT: 'pattern_reinforcement',
  REVIEW_PROBLEM: 'review_problem',
  NEW_PROBLEM: 'new_problem',
  GENERAL: 'general'
};

export class ProblemReasoningService {
  
  /**
   * Generate selection reasoning for a problem based on session context
   * @param {Object} problem - Problem object with tags, difficulty, attempts history
   * @param {Object} sessionContext - Current session context and user performance
   * @param {Object} userPerformance - User's tag mastery and performance data
   * @returns {Object} Reasoning object with type, details, short and full text
   */
  static generateSelectionReason(problem, sessionContext = {}, userPerformance = {}) {
    try {
      console.log(`🧠 Generating reason for problem: ${problem.problemDescription || problem.title}`);
      
      // Check if this is a review problem (has previous attempts)
      const isReviewProblem = problem.attempts && problem.attempts.length > 0;
      const isNewProblem = !isReviewProblem;
      
      // Calculate days since last attempt for review problems
      const daysSinceLastAttempt = this.calculateDaysSinceLastAttempt(problem);
      
      // Get problem tags for analysis
      const problemTags = problem.tags || problem.Tags || [];
      const primaryTag = problemTags.length > 0 ? problemTags[0] : null;
      
      // Priority 1: Spaced Repetition (review problems)
      if (isReviewProblem && daysSinceLastAttempt >= 7) {
        return {
          type: REASON_TYPES.SPACED_REPETITION,
          details: {
            daysSinceLastAttempt,
            optimalInterval: 7,
            previousAttempts: problem.attempts.length
          },
          shortText: `Review: ${daysSinceLastAttempt}d ago`,
          fullText: `Time for spaced repetition review - last attempted ${daysSinceLastAttempt} days ago. This helps strengthen long-term retention.`
        };
      }
      
      // Priority 2: Tag Weakness (based on user performance)
      if (primaryTag && userPerformance.weakTags && userPerformance.weakTags.includes(primaryTag.toLowerCase())) {
        const tagAccuracy = userPerformance.tagAccuracy?.[primaryTag.toLowerCase()] || 0;
        return {
          type: REASON_TYPES.TAG_WEAKNESS,
          details: {
            weakTag: primaryTag,
            currentAccuracy: tagAccuracy,
            targetAccuracy: 0.8,
            totalProblems: userPerformance.tagAttempts?.[primaryTag.toLowerCase()] || 0
          },
          shortText: `Weak tag: ${this.capitalizeFirst(primaryTag)}`,
          fullText: `Selected to improve ${primaryTag} performance (currently ${Math.round(tagAccuracy * 100)}% accuracy). Target: 80%+`
        };
      }
      
      // Priority 3: New Tag Introduction
      if (primaryTag && userPerformance.newTags && userPerformance.newTags.includes(primaryTag.toLowerCase())) {
        return {
          type: REASON_TYPES.NEW_TAG_INTRODUCTION,
          details: {
            newTag: primaryTag,
            totalNewTags: userPerformance.newTags.length
          },
          shortText: `New tag: ${this.capitalizeFirst(primaryTag)}`,
          fullText: `Introducing new algorithmic concept: ${primaryTag}. This expands your problem-solving toolkit.`
        };
      }
      
      // Priority 4: Difficulty Progression
      if (sessionContext.difficultyProgression && problem.difficulty) {
        const targetDifficulty = sessionContext.targetDifficulty;
        if (problem.difficulty.toLowerCase() === targetDifficulty?.toLowerCase()) {
          return {
            type: REASON_TYPES.DIFFICULTY_PROGRESSION,
            details: {
              currentDifficulty: problem.difficulty,
              progressionReason: sessionContext.progressionReason || 'performance-based'
            },
            shortText: `Difficulty: ${problem.difficulty}`,
            fullText: `Selected to match your current ${problem.difficulty.toLowerCase()} level progression. Building confidence at appropriate difficulty.`
          };
        }
      }
      
      // Priority 5: Performance Recovery (recent failures)
      if (isReviewProblem && this.hasRecentFailures(problem)) {
        return {
          type: REASON_TYPES.PERFORMANCE_RECOVERY,
          details: {
            recentFailures: this.countRecentFailures(problem),
            lastSuccess: this.getLastSuccessDate(problem)
          },
          shortText: `Recovery: Recent struggles`,
          fullText: `Selected for performance recovery - you've had difficulty with this problem recently. Practice makes perfect!`
        };
      }
      
      // Priority 6: Pattern Reinforcement (similar successful problems)
      if (sessionContext.patternReinforcement && primaryTag) {
        return {
          type: REASON_TYPES.PATTERN_REINFORCEMENT,
          details: {
            reinforcedTag: primaryTag,
            successRate: userPerformance.tagAccuracy?.[primaryTag.toLowerCase()] || 0
          },
          shortText: `Pattern: ${this.capitalizeFirst(primaryTag)}`,
          fullText: `Reinforcing successful patterns with ${primaryTag} problems (${Math.round((userPerformance.tagAccuracy?.[primaryTag.toLowerCase()] || 0) * 100)}% success rate).`
        };
      }
      
      // Default cases based on problem type
      if (isNewProblem) {
        return {
          type: REASON_TYPES.NEW_PROBLEM,
          details: {
            problemTags: problemTags,
            difficulty: problem.difficulty || 'Unknown'
          },
          shortText: `New: ${problem.difficulty || 'Practice'}`,
          fullText: `New problem selected to expand your experience with ${problemTags.join(', ')} concepts.`
        };
      }
      
      if (isReviewProblem) {
        return {
          type: REASON_TYPES.REVIEW_PROBLEM,
          details: {
            totalAttempts: problem.attempts.length,
            daysSinceLastAttempt
          },
          shortText: `Review: ${problem.attempts.length} attempts`,
          fullText: `Review problem to maintain proficiency - you've attempted this ${problem.attempts.length} time(s) before.`
        };
      }
      
      // Fallback general reason
      return {
        type: REASON_TYPES.GENERAL,
        details: {
          algorithmType: 'adaptive'
        },
        shortText: `Adaptive selection`,
        fullText: `Selected by adaptive algorithm based on your learning progress and performance patterns.`
      };
      
    } catch (error) {
      console.error('❌ Error generating problem selection reason:', error);
      return {
        type: REASON_TYPES.GENERAL,
        details: {},
        shortText: `Adaptive selection`,
        fullText: `Selected by adaptive learning algorithm.`
      };
    }
  }
  
  /**
   * Calculate days since last attempt for a problem
   * @param {Object} problem - Problem with attempts array
   * @returns {number} Days since last attempt, or 0 if no attempts
   */
  static calculateDaysSinceLastAttempt(problem) {
    if (!problem.attempts || problem.attempts.length === 0) {
      return 0;
    }
    
    try {
      // Get the most recent attempt date
      const lastAttempt = problem.attempts
        .map(attempt => new Date(attempt.AttemptDate || attempt.date))
        .filter(date => !isNaN(date))
        .sort((a, b) => b - a)[0]; // Most recent first
      
      if (!lastAttempt) return 0;
      
      const now = new Date();
      const daysDiff = Math.floor((now - lastAttempt) / (1000 * 60 * 60 * 24));
      return Math.max(0, daysDiff);
      
    } catch (error) {
      console.error('Error calculating days since last attempt:', error);
      return 0;
    }
  }
  
  /**
   * Check if problem has recent failures (last 2 attempts unsuccessful)
   * @param {Object} problem - Problem with attempts array
   * @returns {boolean} True if recent attempts were failures
   */
  static hasRecentFailures(problem) {
    if (!problem.attempts || problem.attempts.length < 2) {
      return false;
    }
    
    try {
      // Sort attempts by date (most recent first)
      const sortedAttempts = [...problem.attempts]
        .sort((a, b) => new Date(b.AttemptDate || b.date) - new Date(a.AttemptDate || a.date));
      
      // Check if last 2 attempts were unsuccessful
      const lastTwo = sortedAttempts.slice(0, 2);
      return lastTwo.every(attempt => !attempt.Success);
      
    } catch (error) {
      console.error('Error checking recent failures:', error);
      return false;
    }
  }
  
  /**
   * Count recent failures in last 5 attempts
   * @param {Object} problem - Problem with attempts array  
   * @returns {number} Number of recent failures
   */
  static countRecentFailures(problem) {
    if (!problem.attempts || problem.attempts.length === 0) {
      return 0;
    }
    
    try {
      const sortedAttempts = [...problem.attempts]
        .sort((a, b) => new Date(b.AttemptDate || b.date) - new Date(a.AttemptDate || a.date));
      
      const recentAttempts = sortedAttempts.slice(0, 5);
      return recentAttempts.filter(attempt => !attempt.Success).length;
      
    } catch (error) {
      console.error('Error counting recent failures:', error);
      return 0;
    }
  }
  
  /**
   * Get date of last successful attempt
   * @param {Object} problem - Problem with attempts array
   * @returns {string|null} Date string of last success, or null if none
   */
  static getLastSuccessDate(problem) {
    if (!problem.attempts || problem.attempts.length === 0) {
      return null;
    }
    
    try {
      const successfulAttempts = problem.attempts
        .filter(attempt => attempt.Success)
        .sort((a, b) => new Date(b.AttemptDate || b.date) - new Date(a.AttemptDate || a.date));
      
      return successfulAttempts.length > 0 ? successfulAttempts[0].AttemptDate || successfulAttempts[0].date : null;
      
    } catch (error) {
      console.error('Error getting last success date:', error);
      return null;
    }
  }
  
  /**
   * Capitalize first letter of string
   * @param {string} str - String to capitalize
   * @returns {string} Capitalized string
   */
  static capitalizeFirst(str) {
    if (!str || typeof str !== 'string') return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }
  
  /**
   * Generate batch reasoning for all problems in a session
   * @param {Array} problems - Array of problems in session
   * @param {Object} sessionContext - Session context and metadata
   * @param {Object} userPerformance - User performance data
   * @returns {Array} Problems with added selectionReason field
   */
  static generateSessionReasons(problems, sessionContext = {}, userPerformance = {}) {
    console.log(`🧠 Generating reasons for ${problems.length} problems in session`);
    
    return problems.map((problem, index) => {
      const reason = this.generateSelectionReason(problem, sessionContext, userPerformance);
      
      return {
        ...problem,
        selectionReason: reason,
        sessionIndex: index
      };
    });
  }
}

export default ProblemReasoningService;