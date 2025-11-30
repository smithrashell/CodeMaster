/**
 * Session Limits Utility
 * 
 * Provides reusable functions for calculating onboarding-aware session limits
 * Used across Settings, Goals, and other components that need dynamic session constraints
 */

import FocusCoordinationService, { FOCUS_CONFIG } from '../../services/focus/focusCoordinationService.js';

/**
 * Session limit constants based on onboarding status
 */
const ONBOARDING_LIMITS = {
  MAX_NEW_PROBLEMS: 4,
  MAX_SESSION_LENGTH: 6,
};

const DEFAULT_LIMITS = {
  MAX_NEW_PROBLEMS: 8,
  MAX_SESSION_LENGTH: 8,
};

/**
 * Session Limits Utility Class
 * Provides dynamic, onboarding-aware session limit calculations
 */
export class SessionLimits {
  /**
   * Check if user is currently in onboarding phase
   * @param {Object} sessionState - Current session state from chrome message
   * @returns {boolean} True if user is onboarding
   */
  static isOnboarding(sessionState) {
    if (!sessionState) {
      return false;
    }
    return FocusCoordinationService.isOnboarding(sessionState);
  }

  /**
   * Get maximum number of new problems per session
   * @param {Object} sessionState - Current session state
   * @param {number} userSessionLength - User's configured session length
   * @returns {number} Maximum new problems allowed
   */
  static getMaxNewProblems(sessionState, _userSessionLength = null) {
    const isOnboarding = this.isOnboarding(sessionState);
    
    if (isOnboarding) {
      return ONBOARDING_LIMITS.MAX_NEW_PROBLEMS; // 4
    }
    
    // Post-onboarding: Always use the default limit (not session length!)
    // New problems per session should be independent of total session length
    return DEFAULT_LIMITS.MAX_NEW_PROBLEMS; // 8
  }

  /**
   * Get maximum session length
   * @param {Object} sessionState - Current session state
   * @returns {number} Maximum session length allowed
   */
  static getMaxSessionLength(sessionState) {
    const isOnboarding = this.isOnboarding(sessionState);
    
    return isOnboarding 
      ? ONBOARDING_LIMITS.MAX_SESSION_LENGTH 
      : DEFAULT_LIMITS.MAX_SESSION_LENGTH;
  }

  /**
   * Get all session limits in one call for efficiency
   * @param {Object} sessionState - Current session state
   * @param {number} userSessionLength - User's configured session length
   * @returns {Object} All session limits and onboarding status
   */
  static getSessionLimits(sessionState, userSessionLength = null) {
    const isOnboarding = this.isOnboarding(sessionState);
    
    return {
      isOnboarding,
      maxNewProblems: this.getMaxNewProblems(sessionState, userSessionLength),
      maxSessionLength: this.getMaxSessionLength(sessionState),
      limits: {
        onboarding: ONBOARDING_LIMITS,
        default: DEFAULT_LIMITS,
      },
    };
  }

  /**
   * Get onboarding badge text for UI components
   * @param {string} limitType - Type of limit ('newProblems' or 'sessionLength')
   * @returns {string} Badge text for UI
   */
  static getOnboardingBadgeText(limitType) {
    switch (limitType) {
      case 'newProblems':
        return `Onboarding: Max ${ONBOARDING_LIMITS.MAX_NEW_PROBLEMS}`;
      case 'sessionLength':
        return `Onboarding: Max ${ONBOARDING_LIMITS.MAX_SESSION_LENGTH}`;
      default:
        return 'Onboarding';
    }
  }

  /**
   * Get maximum number of focus tags allowed (references FOCUS_CONFIG)
   * @param {Object} sessionState - Current session state
   * @returns {number} Maximum focus tags allowed
   */
  static getMaxFocusTags(sessionState) {
    return this.isOnboarding(sessionState) 
      ? FOCUS_CONFIG.onboarding.maxTags    // 1 during onboarding
      : FOCUS_CONFIG.limits.userAreas;     // 3 after onboarding
  }

  /**
   * Get minimum attempts threshold for considering a tag "experienced" (centralized)
   * @returns {number} Minimum attempts threshold
   */
  static getMinAttemptsForExperienced() {
    return 3; // Centralize the "new tag" threshold used across problemService, Utils, etc.
  }

  /**
   * Get onboarding session count threshold (references FOCUS_CONFIG)
   * @returns {number} Number of sessions that constitute onboarding period
   */
  static getOnboardingSessionThreshold() {
    return FOCUS_CONFIG.onboarding.sessionCount; // 3
  }

  /**
   * Get onboarding explanatory text that references actual config values
   * @param {string} type - Type of explanation needed
   * @returns {string} Dynamic explanation text based on actual config
   */
  static getOnboardingExplanationText(type) {
    const sessionThreshold = this.getOnboardingSessionThreshold();
    const maxSessionLength = ONBOARDING_LIMITS.MAX_SESSION_LENGTH;
    const maxNewProblems = ONBOARDING_LIMITS.MAX_NEW_PROBLEMS;
    
    switch (type) {
      case 'sessionLimit':
        return `🔰 First ${sessionThreshold} sessions are limited to ${maxSessionLength} problems for optimal learning`;
      case 'focusLimit': 
        return `🔰 During onboarding, sessions focus on one tag for deeper learning`;
      case 'newProblemsLimit':
        return `🔰 Limited to ${maxNewProblems} new problems during onboarding to ensure solid foundations`;
      default:
        return '🔰 Onboarding restrictions for optimal learning';
    }
  }
}

export default SessionLimits;