/**
 * 🎯 Focus Coordination Service
 * Single source of truth for all focus area decisions with safe integration approach
 * 
 * Design Principle: "Algorithm First, User Choice Second"
 * - Integrates with existing systems (Escape Hatch, Tag Graduation, Session State)
 * - Provides unified decision making without replacing existing functionality
 * - Maintains algorithmic strength while offering user transparency
 */

import { TagService } from './tagServices.js';
import { StorageService } from './storageService.js';
import { detectApplicableEscapeHatches} from '../utils/escapeHatchUtils.js';

/**
 * Configuration constants for focus coordination
 */
const FOCUS_CONFIG = {
  onboarding: {
    sessionCount: 3,
    maxTags: 1
  },
  performance: {
    expansion: {
      goodThreshold: 0.75,
      excellentThreshold: 0.8,
      stagnationDays: 14
    }
  },
  limits: {
    systemTags: 3,
    userAreas: 3,
    totalTags: 5
  }
};

// Export FOCUS_CONFIG for use by other utilities (e.g., SessionLimits)
export { FOCUS_CONFIG };

export class FocusCoordinationService {
  /**
   * Main entry point for all focus area decisions
   * Integrates with existing systems to provide unified decision making
   * @param {string} userId - User identifier
   * @returns {Object} Complete focus decision with transparency data
   */
  static async getFocusDecision(userId) {
    try {
      // STEP 1: Gather all inputs from existing systems
      const inputs = await this.gatherSystemInputs(userId);
      
      // STEP 2: Check escape hatches FIRST (existing system priority)
      const escapeHatches = await detectApplicableEscapeHatches(
        inputs.sessionState,
        inputs.masteryData,
        inputs.tierTags
      );
      
      // STEP 3: Check tag graduation (existing system priority)
      const graduationStatus = await TagService.checkFocusAreasGraduation();
      if (graduationStatus.needsUpdate) {
        await TagService.graduateFocusAreas();
        // Refresh user preferences after graduation
        inputs.userPreferences = await this.getUserPreferences();
      }
      
      // STEP 4: Calculate algorithm decision (core logic)
      const algorithmDecision = this.calculateAlgorithmDecision(
        inputs.systemRecommendation,
        inputs.sessionState,
        escapeHatches
      );
      
      // STEP 5: Apply user influence (secondary to algorithm)
      const finalDecision = this.applyUserInfluence(
        algorithmDecision,
        inputs.userPreferences,
        inputs.tierTags
      );
      
      // STEP 6: Return comprehensive decision with transparency
      return {
        // What the session will actually use
        activeFocusTags: finalDecision.tags,
        tagCount: finalDecision.tags.length,
        
        // Transparency for UI
        systemRecommendation: inputs.systemRecommendation.focusTags || [],
        userPreferences: inputs.userPreferences || [],
        algorithmReasoning: finalDecision.reasoning,
        
        // Context information
        onboarding: this.isOnboarding(inputs.sessionState),
        performanceLevel: finalDecision.performanceLevel,
        escapeHatches: escapeHatches.recommendations || [],
        graduation: graduationStatus,
        
        // Available tags for UI
        availableTags: inputs.tierTags || []
      };
    } catch (error) {
      console.error('Focus Coordination Service error:', error);
      return this.getFailsafeDecision();
    }
  }
  
  /**
   * Gathers inputs from all existing systems
   * @param {string} userId - User identifier
   * @returns {Object} All system inputs
   */
  static async gatherSystemInputs(userId) {
    const [
      systemRecommendation,
      userPreferences,
      sessionState,
      settings
    ] = await Promise.all([
      TagService.getCurrentTier(),
      this.getUserPreferences(),
      StorageService.getSessionState(`sessionState_${userId}`),
      StorageService.getSettings()
    ]);
    
    return {
      systemRecommendation,
      userPreferences,
      sessionState: sessionState || { numSessionsCompleted: 0 },
      settings,
      masteryData: systemRecommendation.masteryData || [],
      tierTags: systemRecommendation.allTagsInCurrentTier || []
    };
  }
  
  /**
   * Gets user preferences from settings
   * @returns {Array} User focus area preferences
   */
  static async getUserPreferences() {
    const settings = await StorageService.getSettings();
    return settings.focusAreas || [];
  }
  
  /**
   * Algorithm-first decision making
   * Honors escape hatch decisions and applies core learning algorithm
   * @param {Object} systemRec - System recommendation from TagService
   * @param {Object} sessionState - Current session state
   * @param {Object} escapeHatches - Escape hatch results
   * @returns {Object} Algorithm decision
   */
  static calculateAlgorithmDecision(systemRec, sessionState, escapeHatches) {
    const performance = this.getPerformanceMetrics(sessionState);
    const isOnboarding = this.isOnboarding(sessionState);
    
    // Get base system tags
    const systemTags = systemRec.focusTags || ['array'];
    
    // Apply onboarding restrictions (CORE ALGORITHM)
    if (isOnboarding) {
      return {
        tags: systemTags.slice(0, FOCUS_CONFIG.onboarding.maxTags),
        reasoning: 'Onboarding: Deep focus on single concept for learning foundation',
        performanceLevel: 'onboarding',
        availableTags: systemTags
      };
    }
    
    // Calculate optimal tag count based on performance (CORE ALGORITHM)
    const optimalTagCount = this.calculateOptimalTagCount(performance, escapeHatches);
    let algorithmTags = systemTags.slice(0, optimalTagCount);
    
    // Apply escape hatch modifications if needed
    if (escapeHatches.sessionBased?.applicable) {
      // Session-based escape hatch might affect difficulty progression
      // but doesn't change tag selection - handled in session generation
    }
    
    return {
      tags: algorithmTags,
      reasoning: `Performance-based: ${optimalTagCount} tags optimal for current skill level`,
      performanceLevel: performance.level,
      availableTags: systemTags
    };
  }
  
  /**
   * Calculates optimal tag count based on performance metrics
   * @param {Object} performance - Performance metrics
   * @param {Object} escapeHatches - Escape hatch results
   * @returns {number} Optimal tag count
   */
  static calculateOptimalTagCount(performance, escapeHatches) {
    const { accuracy, efficiency } = performance;
    
    // Start with base count
    let tagCount = 1;
    
    // Performance-based expansion
    const hasGoodPerformance = accuracy >= FOCUS_CONFIG.performance.expansion.goodThreshold || 
                              efficiency >= 0.6;
    const hasExcellentPerformance = accuracy >= FOCUS_CONFIG.performance.expansion.excellentThreshold;
    const hasStagnation = performance.daysSinceProgress >= FOCUS_CONFIG.performance.expansion.stagnationDays;
    
    if (hasExcellentPerformance || hasStagnation) {
      tagCount = Math.min(4, FOCUS_CONFIG.limits.totalTags); // Significant expansion
    } else if (hasGoodPerformance) {
      tagCount = 2; // Moderate expansion
    }
    
    return tagCount;
  }
  
  /**
   * Applies user influence to algorithm decision
   * User can reorder tags but cannot override count or onboarding rules
   * @param {Object} algorithmDecision - Base algorithm decision
   * @param {Array} userPreferences - User focus area preferences
   * @param {Array} availableTags - All available tags in current tier
   * @returns {Object} Final decision with user influence
   */
  static applyUserInfluence(algorithmDecision, userPreferences, availableTags) {
    if (!userPreferences?.length) {
      return algorithmDecision; // Pure algorithm decision
    }
    
    // Filter user preferences to valid choices only
    const validUserTags = userPreferences.filter(tag =>
      availableTags.includes(tag)
    );
    
    if (!validUserTags.length) {
      return algorithmDecision; // No valid user preferences
    }
    
    // USER INFLUENCE: Reorder algorithm's tags by user preference
    // Algorithm still controls the COUNT, user influences the ORDER
    const reorderedTags = this.reorderByUserPreference(
      algorithmDecision.tags,
      validUserTags,
      algorithmDecision.availableTags
    );
    
    return {
      ...algorithmDecision,
      tags: reorderedTags,
      reasoning: `${algorithmDecision.reasoning} + User preference ordering applied`
    };
  }
  
  /**
   * Reorders algorithm tags to prioritize user preferences
   * @param {Array} algorithmTags - Algorithm-selected tags
   * @param {Array} userPreferences - User preferences
   * @param {Array} availableTags - All available tags
   * @returns {Array} Reordered tags
   */
  static reorderByUserPreference(algorithmTags, userPreferences, availableTags) {
    const tagCount = algorithmTags.length; // Algorithm controls count
    
    // Start with user preferences that are in available tags
    const userChoices = userPreferences.filter(tag => availableTags.includes(tag));
    
    // Add system tags that aren't in user choices
    const systemChoices = algorithmTags.filter(tag => !userChoices.includes(tag));
    
    // Combine, respecting algorithm's count decision
    const combined = [...userChoices, ...systemChoices];
    
    return combined.slice(0, tagCount);
  }
  
  /**
   * Gets performance metrics from session state
   * @param {Object} sessionState - Session state data
   * @returns {Object} Performance metrics
   */
  static getPerformanceMetrics(sessionState) {
    const lastPerformance = sessionState.lastPerformance || {};
    
    return {
      accuracy: lastPerformance.accuracy || 0.0,
      efficiency: lastPerformance.efficiencyScore || 0.0,
      level: this.getPerformanceLevel(lastPerformance.accuracy || 0.0),
      daysSinceProgress: this.calculateDaysSinceProgress(sessionState)
    };
  }
  
  /**
   * Determines performance level based on accuracy
   * @param {number} accuracy - Accuracy score
   * @returns {string} Performance level
   */
  static getPerformanceLevel(accuracy) {
    if (accuracy >= FOCUS_CONFIG.performance.expansion.excellentThreshold) {
      return 'excellent';
    } else if (accuracy >= FOCUS_CONFIG.performance.expansion.goodThreshold) {
      return 'good';
    } else {
      return 'developing';
    }
  }
  
  /**
   * Calculates days since last progress
   * @param {Object} sessionState - Session state data
   * @returns {number} Days since progress
   */
  static calculateDaysSinceProgress(sessionState) {
    if (!sessionState.lastProgressDate) return 0;
    
    const now = new Date();
    const lastProgress = new Date(sessionState.lastProgressDate);
    return Math.floor((now - lastProgress) / (1000 * 60 * 60 * 24));
  }
  
  /**
   * Checks if user is in onboarding phase
   * @param {Object} sessionState - Session state data
   * @returns {boolean} True if onboarding
   */
  static isOnboarding(sessionState) {
    return (sessionState.numSessionsCompleted || 0) < FOCUS_CONFIG.onboarding.sessionCount;
  }
  
  /**
   * Returns failsafe decision when system fails
   * @returns {Object} Safe fallback decision
   */
  static getFailsafeDecision() {
    return {
      activeFocusTags: ['array'],
      tagCount: 1,
      systemRecommendation: ['array'],
      userPreferences: [],
      algorithmReasoning: 'Failsafe: Single focus area for stability',
      onboarding: true,
      performanceLevel: 'developing',
      escapeHatches: [],
      graduation: { needsUpdate: false },
      availableTags: ['array']
    };
  }
  
  /**
   * Updates session state with focus-related fields only
   * Respects other systems' ownership of their session state fields
   * @param {Object} sessionState - Current session state
   * @param {Object} focusDecision - Focus decision result
   * @returns {Object} Updated session state
   */
  static updateSessionState(sessionState, focusDecision) {
    // Only update focus-related fields to avoid conflicts
    return {
      ...sessionState,
      // DON'T touch: numSessionsCompleted, escapeHatches, etc.
      // These are owned by other systems
      currentFocusTags: focusDecision.activeFocusTags,
      focusDecisionTimestamp: new Date().toISOString(),
      performanceLevel: focusDecision.performanceLevel
    };
  }
}

export default FocusCoordinationService;