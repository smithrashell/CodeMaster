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
    sessionCount: 1,
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
   * @param {string} sessionStateKey - Session state key to read from
   * @returns {Object} Complete focus decision with transparency data
   */
  static async getFocusDecision(sessionStateKey) {
    try {
      // STEP 1: Gather all inputs from existing systems
      const inputs = await this.gatherSystemInputs(sessionStateKey);
      
      // STEP 2: Check escape hatches FIRST (existing system priority)
      const escapeHatches = await detectApplicableEscapeHatches(
        inputs.sessionState,
        inputs.masteryData,
        inputs.tierTags
      );
      
      // STEP 3: Check tag graduation (weighted integration - no direct modification)
      const graduationStatus = await TagService.checkFocusAreasGraduation();
      if (graduationStatus.needsUpdate) {
        // Apply weighted graduation: remove mastered, blend with suggestions
        inputs.userPreferences = this.applyWeightedGraduation(
          inputs.userPreferences,
          graduationStatus,
          inputs.tierTags
        );
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
   * @param {string} sessionStateKey - Session state key
   * @returns {Object} All system inputs
   */
  static async gatherSystemInputs(sessionStateKey) {
    const [
      systemRecommendation,
      userPreferences,
      sessionState,
      settings
    ] = await Promise.all([
      TagService.getCurrentTier(),
      this.getUserPreferences(),
      StorageService.getSessionState(sessionStateKey),
      StorageService.getSettings()
    ]);
    
    return {
      systemRecommendation,
      userPreferences,
      sessionState: sessionState || { num_sessions_completed: 0 },
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
    
    // Get base system tags with proper fallback for empty arrays
    const systemTags = (systemRec.focusTags && systemRec.focusTags.length > 0) ? systemRec.focusTags : ['array'];
    
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
  static calculateOptimalTagCount(performance, _escapeHatches) {
    const { accuracy, efficiency } = performance;

    // Adaptive tag count based on performance bands
    // Performance bands (most restrictive first):
    // < 40%: 1 tag (struggling significantly - need deep focus)
    // 40-60%: 1-2 tags (struggling - reduce cognitive load)
    // 60-75%: 2 tags (developing - moderate challenge)
    // 75-80%: 2-3 tags (good - expanding capability)
    // 80%+: 3-4 tags (excellent - ready for complexity)
    // 14+ days stagnation: 4 tags (force variety to break plateau)

    let tagCount = 1;
    const hasStagnation = performance.daysSinceProgress >= FOCUS_CONFIG.performance.expansion.stagnationDays;

    // Stagnation overrides everything - force expansion to break plateau
    if (hasStagnation) {
      tagCount = Math.min(4, FOCUS_CONFIG.limits.totalTags);
    }
    // Excellent performance - ready for full complexity
    else if (accuracy >= FOCUS_CONFIG.performance.expansion.excellentThreshold) {
      tagCount = Math.min(4, FOCUS_CONFIG.limits.totalTags);
    }
    // Good performance - moderate expansion
    else if (accuracy >= FOCUS_CONFIG.performance.expansion.goodThreshold) {
      tagCount = accuracy >= 0.78 ? 3 : 2; // 78%+ gets 3 tags, 75-78% gets 2 tags
    }
    // Developing (60-75%) - stay at 2 tags for consistent practice
    else if (accuracy >= 0.6) {
      tagCount = 2;
    }
    // Struggling (40-60%) - adaptive between 1-2 tags
    else if (accuracy >= 0.4) {
      tagCount = accuracy >= 0.55 ? 2 : 1; // 55%+ gets 2 tags, below gets 1
    }
    // Struggling significantly (<40%) - single focus
    else {
      tagCount = 1;
    }

    console.log(`🔍 DEBUG: Tag count calculation - FINAL RESULT: ${tagCount} tags`);
    console.log(`🔍 DEBUG: Performance values:`, {
      accuracy,
      efficiency,
      hasStagnation,
      performanceBand: accuracy >= 0.8 ? 'excellent' :
                       accuracy >= 0.75 ? 'good' :
                       accuracy >= 0.6 ? 'developing' :
                       accuracy >= 0.4 ? 'struggling' : 'struggling-significantly',
      excellentThreshold: FOCUS_CONFIG.performance.expansion.excellentThreshold,
      totalTagsLimit: FOCUS_CONFIG.limits.totalTags
    });

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
   * Applies weighted graduation without modifying user settings
   * Uses same pattern as problem selection: blend user + system recommendations
   * @param {Array} userPreferences - Current user focus areas
   * @param {Object} graduationStatus - Graduation analysis results
   * @param {Array} availableTags - All available tags in current tier
   * @returns {Array} Updated focus areas for this session only
   */
  static applyWeightedGraduation(userPreferences, graduationStatus, availableTags) {
    // Remove mastered tags from user preferences (like removing used problems)
    const filteredUserPrefs = userPreferences.filter(tag =>
      !graduationStatus.masteredTags.includes(tag)
    );

    // Add system suggestions (like expansion tags in problem selection)
    const systemSuggestions = graduationStatus.suggestions.filter(tag =>
      availableTags.includes(tag) && !filteredUserPrefs.includes(tag)
    );

    // Weighted integration: 70% user preferences, 30% system suggestions
    const maxTags = 3;
    const userSlots = Math.min(filteredUserPrefs.length, Math.ceil(maxTags * 0.7));
    const systemSlots = maxTags - userSlots;

    const weighted = [
      ...filteredUserPrefs.slice(0, userSlots),
      ...systemSuggestions.slice(0, systemSlots)
    ];

    // Fallback if empty (same as problem selection fallback)
    return weighted.length > 0 ? weighted : ['array'];
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
    const lastPerformance = sessionState.last_performance || {};
    const accuracy = lastPerformance.accuracy || 0.0;
    const efficiency = lastPerformance.efficiency_score || 0.0;

    console.log(`🔍 DEBUG: Performance metrics calculation:`, {
      sessionState,
      lastPerformance,
      accuracy,
      efficiency,
      level: this.getPerformanceLevel(accuracy),
      thresholds: {
        good: FOCUS_CONFIG.performance.expansion.goodThreshold,
        excellent: FOCUS_CONFIG.performance.expansion.excellentThreshold
      }
    });

    return {
      accuracy,
      efficiency,
      level: this.getPerformanceLevel(accuracy),
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
    const completed = sessionState.num_sessions_completed || 0;
    const threshold = FOCUS_CONFIG.onboarding.sessionCount;
    const isOnboarding = completed < threshold;

    console.log(`🔍 ONBOARDING DEBUG: ${completed} sessions completed < ${threshold} threshold = ${isOnboarding}`, {
      sessionStateId: sessionState?.id,
      completed,
      threshold,
      isOnboarding,
      sessionStateKeys: Object.keys(sessionState || {})
    });

    return isOnboarding;
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
      // DON'T touch: num_sessions_completed, escapeHatches, etc.
      // These are owned by other systems
      current_focus_tags: focusDecision.activeFocusTags,
      focus_decision_timestamp: new Date().toISOString(),
      performance_level: focusDecision.performanceLevel
    };
  }
}

export default FocusCoordinationService;