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
import { getAllFromStore } from '../db/common.js';

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
   * @param {string|Object} sessionStateKeyOrObject - Session state key to read from, or session state object directly
   * @returns {Object} Complete focus decision with transparency data
   */
  static async getFocusDecision(sessionStateKeyOrObject) {
    try {
      // STEP 1: Gather all inputs from existing systems
      const inputs = await this.gatherSystemInputs(sessionStateKeyOrObject);
      
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
      const algorithmDecision = await this.calculateAlgorithmDecision(
        inputs.systemRecommendation,
        inputs.sessionState,
        escapeHatches
      );
      
      // STEP 5: Apply user influence (secondary to algorithm)
      const finalDecision = this.applyUserInfluence(
        algorithmDecision,
        inputs.userPreferences,
        inputs.tierTags,
        inputs.selectedTier  // Pass selected tier to bypass filtering
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
   * @param {string|Object} sessionStateKeyOrObject - Session state key or session state object
   * @returns {Object} All system inputs
   */
  static async gatherSystemInputs(sessionStateKeyOrObject) {
    // If passed an object, use it directly; otherwise read from storage
    const sessionStatePromise = typeof sessionStateKeyOrObject === 'string'
      ? StorageService.getSessionState(sessionStateKeyOrObject)
      : Promise.resolve(sessionStateKeyOrObject);

    const [
      systemRecommendation,
      userPrefsData,
      sessionState,
      settings
    ] = await Promise.all([
      TagService.getCurrentTier(),
      this.getUserPreferences(),
      sessionStatePromise,
      StorageService.getSettings()
    ]);

    // If user has explicitly selected a tier, use ALL tags instead of just current tier
    // This allows advanced users to practice from any tier
    const userPreferences = userPrefsData.focusAreas;
    const selectedTier = userPrefsData.selectedTier;

    console.log('🔍 FocusCoordinationService.gatherSystemInputs:', {
      sessionStatePerformance: sessionState?.last_performance,
      systemRecommendationFocusTags: systemRecommendation.focusTags,
      allTagsInCurrentTier: systemRecommendation.allTagsInCurrentTier?.length
    });

    return {
      systemRecommendation,
      userPreferences,
      selectedTier,
      sessionState: sessionState || { num_sessions_completed: 0 },
      settings,
      masteryData: systemRecommendation.masteryData || [],
      tierTags: systemRecommendation.allTagsInCurrentTier || []
    };
  }
  
  /**
   * Gets user preferences from settings
   * @returns {Object} User focus area preferences with tier info
   */
  static async getUserPreferences() {
    const settings = await StorageService.getSettings();
    return {
      focusAreas: settings.focusAreas || [],
      selectedTier: settings.focusAreasTier || null
    };
  }
  
  /**
   * Algorithm-first decision making
   * Honors escape hatch decisions and applies core learning algorithm
   * @param {Object} systemRec - System recommendation from TagService
   * @param {Object} sessionState - Current session state
   * @param {Object} escapeHatches - Escape hatch results
   * @returns {Object} Algorithm decision
   */
  static async calculateAlgorithmDecision(systemRec, sessionState, escapeHatches) {
    // Get total problems attempted for volume-based gating
    let totalProblemsAttempted = 0;
    try {
      const allProblems = await getAllFromStore('problems');
      totalProblemsAttempted = allProblems?.length || 0;
    } catch (error) {
      console.warn('Failed to fetch total problems, defaulting to 0:', error);
    }

    const performance = this.getPerformanceMetrics(sessionState, totalProblemsAttempted);
    const isOnboarding = this.isOnboarding(sessionState);

    // Get intelligent focus tags (relationship-scored, sorted by learning priority)
    // These 5 tags are the expansion pool - algorithm expands within this intelligent selection
    const intelligentFocusTags = (systemRec.focusTags && systemRec.focusTags.length > 0) ? systemRec.focusTags : ['array'];
    const expansionPool = intelligentFocusTags; // Expand within intelligent selection, not entire tier

    console.log('🔍 FocusCoordinationService.calculateAlgorithmDecision:', {
      intelligentFocusTags,
      expansionPoolSize: expansionPool.length,
      performance,
      isOnboarding
    });

    // Apply onboarding restrictions (CORE ALGORITHM)
    if (isOnboarding) {
      return {
        tags: intelligentFocusTags.slice(0, FOCUS_CONFIG.onboarding.maxTags),
        reasoning: 'Onboarding: Deep focus on single concept for learning foundation',
        performanceLevel: 'onboarding',
        availableTags: intelligentFocusTags
      };
    }

    // Calculate optimal tag count based on performance (CORE ALGORITHM)
    const optimalTagCount = this.calculateOptimalTagCount(performance, escapeHatches);

    // Select optimal number of tags from intelligent focus tags (already sorted by priority)
    const algorithmTags = intelligentFocusTags.slice(0, optimalTagCount);

    // Apply escape hatch modifications if needed
    if (escapeHatches.sessionBased?.applicable) {
      // Session-based escape hatch might affect difficulty progression
      // but doesn't change tag selection - handled in session generation
    }

    console.log('🔍 FocusCoordinationService algorithm result:', {
      optimalTagCount,
      algorithmTags,
      reasoning: `Performance-based: ${optimalTagCount} tags optimal for current skill level`
    });

    return {
      tags: algorithmTags,
      reasoning: `Performance-based: ${optimalTagCount} tags optimal for current skill level`,
      performanceLevel: performance.level,
      availableTags: expansionPool
    };
  }
  
  /**
   * Calculates optimal tag count based on performance metrics
   * @param {Object} performance - Performance metrics
   * @param {Object} escapeHatches - Escape hatch results
   * @returns {number} Optimal tag count
   */
  static calculateOptimalTagCount(performance, _escapeHatches) {
    const { accuracy, efficiency, totalProblemsAttempted } = performance;

    // Adaptive tag count based on performance bands + volume gating
    // Performance bands (most restrictive first):
    // < 40%: 1 tag (struggling significantly - need deep focus)
    // 40-60%: 1-2 tags (struggling - reduce cognitive load)
    // 60-75%: 2 tags (developing - moderate challenge)
    // 75-80%: 2-3 tags (good - expanding capability)
    // 80%+: 2-4 tags (excellent - volume-gated expansion)
    // 14+ days stagnation: 4 tags (force variety to break plateau)

    // VOLUME GATING: Require minimum problems before expanding
    if (totalProblemsAttempted < 4) {
      return 1;  // Stay at 1 tag until 4+ problems attempted
    }

    let tagCount = 1;
    const hasStagnation = performance.daysSinceProgress >= FOCUS_CONFIG.performance.expansion.stagnationDays;

    // Stagnation overrides everything - force expansion to break plateau
    if (hasStagnation) {
      tagCount = Math.min(4, FOCUS_CONFIG.limits.totalTags);
    }
    // Excellent performance - volume-gated expansion
    else if (accuracy >= FOCUS_CONFIG.performance.expansion.excellentThreshold) {
      if (totalProblemsAttempted >= 20) {
        tagCount = 4;  // 20+ problems → 4 tags
      } else if (totalProblemsAttempted >= 10) {
        tagCount = 3;  // 10-19 problems → 3 tags
      } else {
        tagCount = 2;  // 4-9 problems → 2 tags
      }
    }
    // Good performance - moderate expansion with volume gating
    else if (accuracy >= FOCUS_CONFIG.performance.expansion.goodThreshold) {
      if (totalProblemsAttempted >= 10) {
        tagCount = accuracy >= 0.78 ? 3 : 2;
      } else {
        tagCount = 2;  // 4-9 problems → 2 tags max
      }
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
      totalProblemsAttempted,
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
   * @param {string|null} selectedTier - User's explicitly selected tier (bypasses filtering)
   * @returns {Object} Final decision with user influence
   */
  static applyUserInfluence(algorithmDecision, userPreferences, availableTags, selectedTier = null) {
    if (!userPreferences?.length) {
      return algorithmDecision; // Pure algorithm decision
    }

    // If user explicitly selected a tier, use their tags AS-IS without filtering
    // This allows advanced users to practice from any tier they choose
    const validUserTags = selectedTier
      ? userPreferences
      : userPreferences.filter(tag => availableTags.includes(tag));

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
      reasoning: `${algorithmDecision.reasoning} + User preference ordering applied${selectedTier ? ` (${selectedTier} tier)` : ''}`
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
   * @param {number} totalProblemsAttempted - Total problems from problems store
   * @returns {Object} Performance metrics
   */
  static getPerformanceMetrics(sessionState, totalProblemsAttempted = 0) {
    const lastPerformance = sessionState.last_performance || {};
    const accuracy = lastPerformance.accuracy || 0.0;
    const efficiency = lastPerformance.efficiency_score || 0.0;

    console.log(`🔍 DEBUG: Performance metrics calculation:`, {
      sessionState,
      lastPerformance,
      accuracy,
      efficiency,
      totalProblemsAttempted,
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
      daysSinceProgress: this.calculateDaysSinceProgress(sessionState),
      totalProblemsAttempted
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