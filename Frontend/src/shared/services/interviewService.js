import { StorageService } from "./storageService.js";
import { getTagMastery } from "../db/tag_mastery.js";
import { getSessionPerformance } from "../db/sessions.js";

/**
 * Interview Service - Handles all interview simulation logic
 * Provides progressive interview modes and transfer testing capabilities
 */
export class InterviewService {
  // Interview mode configurations
  static INTERVIEW_CONFIGS = {
    'standard': {
      sessionLength: null, // Uses adaptive length
      hints: { max: null, timeRestriction: false },
      timing: { pressure: false, hardCutoff: false },
      primers: { available: true, encouraged: true },
      uiMode: 'full-support'
    },
    'interview-like': {
      sessionLength: { min: 3, max: 5 },
      hints: { max: 2, timeRestriction: false },
      timing: { 
        pressure: true, 
        hardCutoff: false,
        multiplier: 1.5, // 1.5x normal time
        thresholds: { Easy: 22 * 60000, Medium: 37 * 60000, Hard: 60 * 60000 } // in ms
      },
      primers: { available: true, encouraged: false },
      uiMode: 'pressure-indicators',
      problemMix: { mastered: 0.6, nearMastery: 0.3, challenging: 0.1 }
    },
    'full-interview': {
      sessionLength: { min: 3, max: 4 },
      hints: { max: 0, timeRestriction: true },
      timing: { 
        pressure: true, 
        hardCutoff: true,
        multiplier: 1.0, // Standard interview timing
        thresholds: { Easy: 15 * 60000, Medium: 25 * 60000, Hard: 40 * 60000 } // in ms
      },
      primers: { available: false, encouraged: false },
      uiMode: 'minimal-clean',
      problemMix: { mastered: 0.6, nearMastery: 0.3, wildcard: 0.1 }
    }
  };

  /**
   * Get interview configuration for a specific mode
   * @param {string} mode - Interview mode
   * @returns {Object} Interview configuration
   */
  static getInterviewConfig(mode) {
    return this.INTERVIEW_CONFIGS[mode] || this.INTERVIEW_CONFIGS['standard'];
  }

  /**
   * Assess user's interview readiness based on recent performance
   * @returns {Promise<Object>} Interview readiness assessment
   */
  static async assessInterviewReadiness() {
    try {
      // Get recent session performance
      const recentPerformance = await getSessionPerformance({
        recentSessionsLimit: 5
      });

      // Get tag mastery data
      const tagMastery = await getTagMastery();
      const masteredTagsCount = (tagMastery || []).filter(tm => tm.mastered).length;
      const totalTags = (tagMastery || []).length;

      // Calculate readiness metrics
      const accuracy = recentPerformance?.accuracy || 0;
      const consistentPerformance = accuracy >= 0.7;
      const hasMasteredTags = masteredTagsCount >= 3; // Need at least 3 mastered tags
      
      // Calculate transfer readiness score (if available from previous interview sessions)
      const transferReadinessScore = await this.calculateCurrentTransferReadiness(tagMastery);

      // Determine unlock status
      const interviewLikeUnlocked = consistentPerformance && hasMasteredTags;
      const fullInterviewUnlocked = interviewLikeUnlocked && 
        transferReadinessScore >= 0.7 && 
        accuracy >= 0.8;

      // Generate reasoning
      let reasoning = "";
      if (!consistentPerformance) {
        reasoning = `Need 70%+ accuracy in recent sessions (current: ${(accuracy * 100).toFixed(1)}%)`;
      } else if (!hasMasteredTags) {
        reasoning = `Need at least 3 mastered tags (current: ${masteredTagsCount})`;
      } else if (!fullInterviewUnlocked && transferReadinessScore < 0.7) {
        reasoning = `Need better transfer performance in Interview-Like mode`;
      } else {
        reasoning = "All interview modes available based on performance";
      }

      return {
        interviewLikeUnlocked,
        fullInterviewUnlocked,
        reasoning,
        metrics: {
          accuracy,
          masteredTagsCount,
          totalTags,
          transferReadinessScore
        }
      };
    } catch (error) {
      console.error("Error assessing interview readiness:", error);
      // Fallback for development/testing
      return {
        interviewLikeUnlocked: true,
        fullInterviewUnlocked: true,
        reasoning: "Fallback mode - interview features available",
        metrics: { accuracy: 0, masteredTagsCount: 0, totalTags: 0, transferReadinessScore: 0 }
      };
    }
  }

  /**
   * Calculate current transfer readiness based on tag mastery and past interview performance
   * @param {Array} tagMastery - Tag mastery data
   * @returns {Promise<number>} Transfer readiness score (0-1)
   */
  static calculateCurrentTransferReadiness(tagMastery = []) {
    try {
      // This is a simplified calculation - would be enhanced with actual interview data
      const masteredTags = tagMastery.filter(tm => tm.mastered);
      const totalAttempts = tagMastery.reduce((sum, tm) => sum + (tm.totalAttempts || 0), 0);
      
      if (totalAttempts === 0) return 0;
      
      // Base score on mastery ratio and attempt consistency
      const masteryRatio = masteredTags.length / Math.max(tagMastery.length, 1);
      const experienceScore = Math.min(totalAttempts / 50, 1); // Normalize to 50 attempts
      
      return (masteryRatio * 0.7) + (experienceScore * 0.3);
    } catch (error) {
      console.warn("Error calculating transfer readiness:", error);
      return 0.5; // Neutral score as fallback
    }
  }

  /**
   * Create interview session problems with mode-specific constraints
   * @param {string} mode - Interview mode
   * @param {Object} options - Additional options
   * @returns {Promise<Array>} Interview session problems
   */
  static async createInterviewSession(mode, _options = {}) {
    const config = this.getInterviewConfig(mode);
    const settings = await StorageService.getSettings();
    
    try {
      // Determine session length based on mode
      let sessionLength;
      if (config.sessionLength) {
        sessionLength = Math.floor(Math.random() * 
          (config.sessionLength.max - config.sessionLength.min + 1)) + 
          config.sessionLength.min;
      } else {
        // Use standard adaptive length for normal mode
        sessionLength = settings.sessionLength || 5;
      }

      // Get tag mastery for problem selection
      const tagMastery = await getTagMastery();
      
      // Generate problem selection criteria based on interview mode
      const selectionCriteria = this.buildInterviewProblemCriteria(mode, config, tagMastery);
      
      return {
        sessionType: mode,
        sessionLength,
        config,
        selectionCriteria,
        interviewMetrics: this.initializeInterviewMetrics(),
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      console.error("Error creating interview session:", error);
      throw error;
    }
  }

  /**
   * Build problem selection criteria for interview modes
   * @param {string} mode - Interview mode
   * @param {Object} config - Interview configuration
   * @param {Array} tagMastery - Tag mastery data
   * @returns {Object} Problem selection criteria
   */
  static buildInterviewProblemCriteria(mode, config, tagMastery = []) {
    const masteredTags = tagMastery.filter(tm => tm.mastered).map(tm => tm.tag);
    const nearMasteryTags = tagMastery
      .filter(tm => !tm.mastered && (tm.totalAttempts || 0) >= 3 && (tm.successfulAttempts || 0) > 0)
      .map(tm => tm.tag);
    
    if (mode === 'standard') {
      return {
        allowedTags: masteredTags.concat(nearMasteryTags),
        difficulty: 'adaptive',
        reviewRatio: 0.4
      };
    }

    // Interview modes use specific problem mixes
    const problemMix = config.problemMix || { mastered: 0.6, nearMastery: 0.3, challenging: 0.1 };
    
    return {
      problemMix,
      masteredTags,
      nearMasteryTags,
      allowedTags: masteredTags.concat(nearMasteryTags),
      difficulty: 'balanced',
      reviewRatio: 0 // No spaced repetition in interviews
    };
  }

  /**
   * Initialize interview metrics structure
   * @returns {Object} Empty interview metrics
   */
  static initializeInterviewMetrics() {
    return {
      transferReadinessScore: null,
      interventionNeedScore: null,
      tagPerformance: new Map(),
      overallMetrics: {
        transferAccuracy: null,
        speedDelta: null,
        hintPressure: null,
        approachLatency: null
      },
      feedbackGenerated: {
        strengths: [],
        improvements: [],
        nextActions: []
      }
    };
  }

  /**
   * Calculate transfer metrics from interview session attempts
   * @param {Array} attempts - Session attempts
   * @param {Object} tagBaselines - Tag performance baselines
   * @returns {Object} Transfer metrics
   */
  static calculateTransferMetrics(attempts = [], tagBaselines = {}) {
    if (!attempts || attempts.length === 0) {
      return this.initializeInterviewMetrics();
    }

    try {
      const metrics = {
        transferAccuracy: this.calculateTransferAccuracy(attempts),
        speedDelta: this.calculateSpeedDelta(attempts, tagBaselines),
        hintPressure: this.calculateHintPressure(attempts),
        approachLatency: this.calculateApproachLatency(attempts)
      };

      // Calculate composite Transfer Readiness Score (TRS)
      const transferReadinessScore = this.calculateTransferReadinessScore(metrics);
      
      // Calculate Intervention Need Score (INS)
      const interventionNeedScore = 1 - transferReadinessScore;

      return {
        transferReadinessScore,
        interventionNeedScore,
        tagPerformance: this.analyzeTagInterviewPerformance(attempts),
        overallMetrics: metrics,
        feedbackGenerated: this.generateInterviewFeedback(metrics, transferReadinessScore)
      };
    } catch (error) {
      console.error("Error calculating transfer metrics:", error);
      return this.initializeInterviewMetrics();
    }
  }

  /**
   * Calculate Transfer Accuracy (TA) - first attempt correctness
   * @param {Array} attempts - Session attempts
   * @returns {number} Transfer accuracy score (0-1)
   */
  static calculateTransferAccuracy(attempts) {
    const transferAttempts = attempts.filter(attempt => 
      attempt.interviewSignals && 
      typeof attempt.interviewSignals.transferAccuracy === 'boolean'
    );
    
    if (transferAttempts.length === 0) return 0;
    
    const successfulTransfers = transferAttempts.filter(a => 
      a.interviewSignals.transferAccuracy
    ).length;
    
    return successfulTransfers / transferAttempts.length;
  }

  /**
   * Calculate Speed Delta - performance vs baseline
   * @param {Array} attempts - Session attempts  
   * @param {Object} tagBaselines - Tag performance baselines
   * @returns {number} Speed delta (negative = faster, positive = slower)
   */
  static calculateSpeedDelta(attempts, _tagBaselines) {
    const validAttempts = attempts.filter(a => 
      a.timeSpent && 
      a.interviewSignals && 
      typeof a.interviewSignals.speedDelta === 'number'
    );
    
    if (validAttempts.length === 0) return 0;
    
    const avgSpeedDelta = validAttempts.reduce((sum, a) => 
      sum + a.interviewSignals.speedDelta, 0
    ) / validAttempts.length;
    
    return avgSpeedDelta;
  }

  /**
   * Calculate Hint Pressure - hints used per time unit
   * @param {Array} attempts - Session attempts
   * @returns {number} Hint pressure score
   */
  static calculateHintPressure(attempts) {
    const hintAttempts = attempts.filter(a => 
      a.interviewSignals && 
      typeof a.interviewSignals.hintPressure === 'number'
    );
    
    if (hintAttempts.length === 0) return 0;
    
    return hintAttempts.reduce((sum, a) => 
      sum + a.interviewSignals.hintPressure, 0
    ) / hintAttempts.length;
  }

  /**
   * Calculate Approach Latency - time to first structured plan
   * @param {Array} attempts - Session attempts
   * @returns {number} Average approach latency in milliseconds
   */
  static calculateApproachLatency(attempts) {
    const latencyAttempts = attempts.filter(a => 
      a.interviewSignals && 
      typeof a.interviewSignals.timeToFirstPlanMs === 'number'
    );
    
    if (latencyAttempts.length === 0) return 0;
    
    return latencyAttempts.reduce((sum, a) => 
      sum + a.interviewSignals.timeToFirstPlanMs, 0
    ) / latencyAttempts.length;
  }

  /**
   * Calculate composite Transfer Readiness Score (TRS)
   * @param {Object} metrics - Individual transfer metrics
   * @returns {number} Transfer readiness score (0-1)
   */
  static calculateTransferReadinessScore(metrics) {
    // Weights: TA=35%, Speed=25%, Hints=20%, Approach=20%
    const normalizedSpeed = Math.max(0, 1 - Math.max(0, metrics.speedDelta));
    const normalizedHints = Math.max(0, 1 - (metrics.hintPressure / 2)); // Normalize assuming max 2 hints/min
    const normalizedLatency = Math.max(0, 1 - (metrics.approachLatency / (5 * 60000))); // Normalize to 5 minutes
    
    return (
      (metrics.transferAccuracy * 0.35) +
      (normalizedSpeed * 0.25) +
      (normalizedHints * 0.20) +
      (normalizedLatency * 0.20)
    );
  }

  /**
   * Analyze per-tag interview performance
   * @param {Array} attempts - Session attempts
   * @returns {Map} Tag-specific performance metrics
   */
  static analyzeTagInterviewPerformance(attempts) {
    const tagPerformance = new Map();
    
    attempts.forEach(attempt => {
      const problemTags = attempt.tags || [];
      problemTags.forEach(tag => {
        if (!tagPerformance.has(tag)) {
          tagPerformance.set(tag, {
            attempts: 0,
            successes: 0,
            totalTime: 0,
            hintUses: 0,
            transferAccuracies: []
          });
        }
        
        const perf = tagPerformance.get(tag);
        perf.attempts++;
        if (attempt.success) perf.successes++;
        perf.totalTime += attempt.timeSpent || 0;
        perf.hintUses += attempt.hintsUsed || 0;
        
        if (attempt.interviewSignals?.transferAccuracy !== undefined) {
          perf.transferAccuracies.push(attempt.interviewSignals.transferAccuracy);
        }
      });
    });
    
    return tagPerformance;
  }

  /**
   * Generate actionable feedback from interview performance
   * @param {Object} metrics - Transfer metrics
   * @param {number} transferReadinessScore - Overall TRS
   * @returns {Object} Structured feedback
   */
  static generateInterviewFeedback(metrics, transferReadinessScore) {
    const feedback = {
      strengths: [],
      improvements: [],
      nextActions: []
    };

    // Analyze strengths
    if (metrics.transferAccuracy >= 0.8) {
      feedback.strengths.push("Excellent first-attempt accuracy under pressure");
    }
    if (metrics.speedDelta <= 0) {
      feedback.strengths.push("Maintained or improved speed in interview conditions");
    }
    if (metrics.hintPressure <= 0.2) {
      feedback.strengths.push("Low dependency on hints during problem solving");
    }
    if (metrics.approachLatency <= 2 * 60000) {
      feedback.strengths.push("Quick problem approach identification");
    }

    // Analyze improvements needed
    if (metrics.transferAccuracy < 0.6) {
      feedback.improvements.push("Practice pattern transfer without hints");
    }
    if (metrics.speedDelta > 0.3) {
      feedback.improvements.push("Work on speed optimization for mastered patterns");
    }
    if (metrics.hintPressure > 0.5) {
      feedback.improvements.push("Build independence from hint system");
    }
    if (metrics.approachLatency > 3 * 60000) {
      feedback.improvements.push("Practice quick problem categorization skills");
    }

    // Generate next actions
    if (transferReadinessScore < 0.5) {
      feedback.nextActions.push("Focus on mastering fundamental patterns before interview practice");
    } else if (transferReadinessScore < 0.7) {
      feedback.nextActions.push("Continue Interview-Like mode to build confidence");
    } else {
      feedback.nextActions.push("Ready for Full Interview mode or real interviews");
    }

    return feedback;
  }

  /**
   * Update adaptive learning based on interview insights
   * @param {Object} interviewResults - Interview session results
   * @returns {Promise<void>}
   */
  static updateAdaptiveLearning(interviewResults) {
    try {
      // This would integrate with existing adaptive systems
      // For now, just log the insights
      console.log("Interview insights for adaptive learning:", {
        interventionNeeded: interviewResults.interventionNeedScore > 0.5,
        tagPerformance: Array.from(interviewResults.tagPerformance.entries()),
        overallReadiness: interviewResults.transferReadinessScore
      });
      
      // Future integration points:
      // - Update focus area selection based on weak interview tags
      // - Adjust difficulty progression for poor transfer performance  
      // - Trigger speed drill sessions for slow transfer
      // - Modify hint availability based on hint pressure
    } catch (error) {
      console.error("Error updating adaptive learning with interview insights:", error);
    }
  }

  /**
   * Get interview insights for adaptive learning integration
   * Analyzes recent interview performance to influence regular session parameters
   * @returns {Promise<Object>} Interview insights for adaptive learning
   */
  static async getInterviewInsightsForAdaptiveLearning() {
    try {
      // Get recent interview sessions (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const settings = await StorageService.getSettings();
      const isInterviewEnabled = settings?.interviewMode?.enabled;
      
      if (!isInterviewEnabled) {
        return {
          hasInterviewData: false,
          recommendations: {
            sessionLengthAdjustment: 0,
            difficultyAdjustment: 0,
            newProblemsAdjustment: 0,
            focusTagsWeight: 1.0,
            needsSpeedFocus: false,
            needsHintReduction: false
          }
        };
      }

      // Get interview analytics data (reuse existing dashboard function)
      const { dashboardService } = await import("../../app/services/dashboardService.js");
      const analyticsData = await dashboardService.getInterviewAnalyticsData({
        dateRange: { start: thirtyDaysAgo.toISOString() }
      });

      const { metrics, analytics } = analyticsData;
      
      if (!metrics || analytics.length === 0) {
        return {
          hasInterviewData: false,
          recommendations: {
            sessionLengthAdjustment: 0,
            difficultyAdjustment: 0,
            newProblemsAdjustment: 0,
            focusTagsWeight: 1.0,
            needsSpeedFocus: false,
            needsHintReduction: false
          }
        };
      }

      // Analyze performance deltas between standard and interview sessions
      const transferAccuracy = metrics.transferAccuracy || 0;
      const speedDelta = metrics.avgSpeedDelta || 0;
      const hintPressure = metrics.avgHintPressure || 0;

      // Generate adaptive learning recommendations based on interview performance
      const recommendations = {
        sessionLengthAdjustment: this.calculateSessionLengthAdjustment(transferAccuracy, speedDelta),
        difficultyAdjustment: this.calculateDifficultyAdjustment(transferAccuracy),
        newProblemsAdjustment: this.calculateNewProblemsAdjustment(transferAccuracy, speedDelta),
        focusTagsWeight: this.calculateFocusTagsWeight(metrics.tagPerformance || []),
        needsSpeedFocus: speedDelta > 0.3, // 30% slower in interviews
        needsHintReduction: hintPressure > 1.5, // Using >1.5 hints per minute in interviews
        weakTags: this.identifyWeakInterviewTags(metrics.tagPerformance || [])
      };

      return {
        hasInterviewData: true,
        recentSessionCount: analytics.length,
        transferAccuracy,
        speedDelta,
        hintPressure,
        recommendations
      };

    } catch (error) {
      console.error("Error getting interview insights for adaptive learning:", error);
      return {
        hasInterviewData: false,
        error: error.message,
        recommendations: {
          sessionLengthAdjustment: 0,
          difficultyAdjustment: 0,
          newProblemsAdjustment: 0,
          focusTagsWeight: 1.0,
          needsSpeedFocus: false,
          needsHintReduction: false
        }
      };
    }
  }

  /**
   * Calculate session length adjustment based on interview performance
   * @param {number} transferAccuracy - Transfer accuracy (0-1)
   * @param {number} speedDelta - Speed difference in interviews (0-1+)
   * @returns {number} Session length adjustment (-2 to +2)
   */
  static calculateSessionLengthAdjustment(transferAccuracy, speedDelta) {
    // Poor transfer performance suggests need for longer sessions to build confidence
    if (transferAccuracy < 0.6) {
      return 1; // +1 problem per session
    }
    
    // Slow interview performance suggests sessions are too challenging
    if (speedDelta > 0.4) {
      return -1; // -1 problem per session
    }
    
    // Good transfer performance allows normal session lengths
    if (transferAccuracy > 0.8 && speedDelta < 0.2) {
      return 1; // Can handle slightly longer sessions
    }
    
    return 0; // No adjustment needed
  }

  /**
   * Calculate difficulty adjustment based on interview transfer
   * @param {number} transferAccuracy - Transfer accuracy (0-1)
   * @returns {number} Difficulty adjustment (-1, 0, +1)
   */
  static calculateDifficultyAdjustment(transferAccuracy) {
    // Poor interview performance suggests current difficulty is too high
    if (transferAccuracy < 0.5) {
      return -1; // Reduce difficulty temporarily
    }
    
    // Excellent interview performance suggests can handle more challenge
    if (transferAccuracy > 0.9) {
      return 1; // Increase difficulty progression
    }
    
    return 0; // Keep current difficulty
  }

  /**
   * Calculate new problems adjustment based on interview performance
   * @param {number} transferAccuracy - Transfer accuracy (0-1)  
   * @param {number} speedDelta - Speed difference in interviews
   * @returns {number} New problems adjustment (-2 to +1)
   */
  static calculateNewProblemsAdjustment(transferAccuracy, speedDelta) {
    // Poor transfer suggests need for more review, fewer new problems
    if (transferAccuracy < 0.6) {
      return -1; // Reduce new problems, increase review
    }
    
    // Slow transfer suggests too much cognitive load
    if (speedDelta > 0.4) {
      return -1; // Focus on consolidation
    }
    
    // Good transfer performance allows normal new problem introduction
    return 0;
  }

  /**
   * Calculate focus tags weight based on tag-specific interview performance
   * @param {Array} tagPerformance - Per-tag performance data
   * @returns {number} Focus weight multiplier (0.5 to 2.0)
   */
  static calculateFocusTagsWeight(tagPerformance) {
    if (tagPerformance.length === 0) return 1.0;
    
    // Calculate average tag transfer performance
    const avgTransferAccuracy = tagPerformance.reduce((sum, tag) => 
      sum + (tag.transferAccuracy || 0), 0) / tagPerformance.length;
    
    // Poor tag transfer suggests need for more focused practice
    if (avgTransferAccuracy < 0.6) {
      return 0.7; // Reduce tag diversity, focus on weak areas
    }
    
    // Good tag transfer allows broader exploration
    if (avgTransferAccuracy > 0.8) {
      return 1.3; // Increase tag diversity
    }
    
    return 1.0;
  }

  /**
   * Identify tags with poor interview performance
   * @param {Array} tagPerformance - Per-tag performance data
   * @returns {Array} Tags that need focus based on interview performance
   */
  static identifyWeakInterviewTags(tagPerformance) {
    return tagPerformance
      .filter(tag => (tag.transferAccuracy || 0) < 0.6)
      .map(tag => tag.tagName)
      .slice(0, 3); // Return top 3 weak tags
  }
}

export default InterviewService;