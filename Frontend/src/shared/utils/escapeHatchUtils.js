import { calculateSuccessRate, calculateFailedAttempts } from './Utils.js';

/**
 * 🔓 Escape Hatch Utilities
 * Centralized logic for detecting and activating escape hatches to prevent user stalling
 *
 * Escape hatch types:
 * 1. Session-based: 10+ sessions without difficulty promotion (90% → 80% threshold)
 * 2. Attempt-based: 15+ failed tag attempts (80% → 60% success rate)
 * 3. Time-based: 2+ weeks without tag/tier progression (80% → 60% threshold)
 */

/**
 * Detects and returns applicable escape hatches for the current user state
 * @param {Object} sessionState - Current session state with escape hatch tracking
 * @param {Array} masteryData - User's tag mastery data
 * @param {Array} tierTags - Tags in current tier
 * @returns {Object} Escape hatch detection results and recommendations
 */
export function detectApplicableEscapeHatches(
  sessionState,
  masteryData,
  tierTags
) {
  const now = new Date();
  const escapeHatches = sessionState.escapeHatches || {
    sessionsAtCurrentDifficulty: 0,
    lastDifficultyPromotion: null,
    sessionsWithoutPromotion: 0,
    activatedEscapeHatches: [],
  };

  const results = {
    sessionBased: detectSessionBasedEscapeHatch(escapeHatches),
    attemptBased: detectAttemptBasedEscapeHatches(masteryData, tierTags),
    timeBased: detectTimeBasedEscapeHatches(masteryData, tierTags, now),
    recommendations: [],
  };

  // Generate user-friendly recommendations
  if (results.sessionBased.applicable) {
    results.recommendations.push({
      type: "session-based",
      message: `🔓 After ${escapeHatches.sessionsAtCurrentDifficulty} sessions at ${sessionState.currentDifficultyCap} difficulty, we're lowering the promotion threshold from 90% to 80% to help you progress.`,
      impact: "Difficulty promotion threshold reduced",
    });
  }

  if (results.attemptBased.length > 0) {
    results.attemptBased.forEach((tag) => {
      results.recommendations.push({
        type: "attempt-based",
        message: `🔓 "${tag.tag}" has ${tag.failedAttempts} failed attempts. We're lowering the mastery threshold from 80% to 60% for this tag.`,
        impact: `Tag mastery threshold reduced for ${tag.tag}`,
      });
    });
  }

  if (results.timeBased.length > 0) {
    results.timeBased.forEach((tag) => {
      const daysSinceLastAttempt = Math.floor(
        (now - new Date(tag.lastAttemptDate)) / (1000 * 60 * 60 * 24)
      );
      results.recommendations.push({
        type: "time-based",
        message: `🔓 "${tag.tag}" hasn't seen progress in ${daysSinceLastAttempt} days. We're lowering the mastery threshold from 80% to 60% to help you move forward.`,
        impact: `Time-based threshold reduction for ${tag.tag}`,
      });
    });
  }

  return results;
}

/**
 * Detects session-based escape hatch eligibility
 * @param {Object} escapeHatches - Escape hatch tracking data
 * @returns {Object} Session-based escape hatch detection result
 */
function detectSessionBasedEscapeHatch(escapeHatches) {
  const sessionsAtCurrentDifficulty =
    escapeHatches.sessionsAtCurrentDifficulty || 0;
  const applicable = sessionsAtCurrentDifficulty >= 10;

  return {
    applicable,
    sessionsStuck: sessionsAtCurrentDifficulty,
    threshold: applicable ? 0.8 : 0.9,
    description: applicable
      ? `Applied: ${sessionsAtCurrentDifficulty} sessions without promotion`
      : `Not applicable: ${sessionsAtCurrentDifficulty}/10 sessions`,
  };
}

/**
 * Detects attempt-based escape hatches for struggling tags
 * @param {Array} masteryData - User's tag mastery data
 * @param {Array} tierTags - Tags in current tier
 * @returns {Array} Tags eligible for attempt-based escape hatch
 */
function detectAttemptBasedEscapeHatches(masteryData, tierTags) {
  const eligibleTags = [];

  masteryData
    .filter((tag) => tierTags.includes(tag.tag) && tag.totalAttempts > 0)
    .forEach((tag) => {
      const successRate = calculateSuccessRate(tag.successfulAttempts, tag.totalAttempts);
      const failedAttempts = calculateFailedAttempts(tag.successfulAttempts, tag.totalAttempts);

      // Apply escape hatch if 15+ failed attempts and 60%+ success rate (but below 80%)
      if (failedAttempts >= 15 && successRate >= 0.6 && successRate < 0.8) {
        eligibleTags.push({
          tag: tag.tag,
          failedAttempts,
          successRate,
          adjustedThreshold: 0.6,
          originalThreshold: 0.8,
        });
      }
    });

  return eligibleTags;
}

/**
 * Detects time-based escape hatches for stagnant tags
 * @param {Array} masteryData - User's tag mastery data
 * @param {Array} tierTags - Tags in current tier
 * @param {Date} now - Current date
 * @returns {Array} Tags eligible for time-based escape hatch
 */
function detectTimeBasedEscapeHatches(masteryData, tierTags, now) {
  const eligibleTags = [];

  masteryData
    .filter((tag) => tierTags.includes(tag.tag) && tag.totalAttempts > 0)
    .forEach((tag) => {
      const successRate = calculateSuccessRate(tag.successfulAttempts, tag.totalAttempts);

      if (tag.lastAttemptDate) {
        const lastAttemptDate = new Date(tag.lastAttemptDate);
        const daysSinceLastAttempt =
          (now - lastAttemptDate) / (1000 * 60 * 60 * 24);

        // Apply escape hatch if stuck for 14+ days and has progress (60%+) but below 80%
        if (
          daysSinceLastAttempt >= 14 &&
          successRate >= 0.6 &&
          successRate < 0.8
        ) {
          eligibleTags.push({
            tag: tag.tag,
            daysSinceLastAttempt,
            successRate,
            adjustedThreshold: 0.6,
            originalThreshold: 0.8,
            lastAttemptDate: tag.lastAttemptDate,
          });
        }
      }
    });

  return eligibleTags;
}

/**
 * Calculates adjusted thresholds based on active escape hatches
 * @param {Object} escapeHatchResults - Results from detectApplicableEscapeHatches
 * @param {string} type - Type of threshold ('difficulty' or 'mastery')
 * @param {string} tag - Tag name (for mastery thresholds)
 * @returns {number} Adjusted threshold value
 */
export function calculateAdjustedThreshold(
  escapeHatchResults,
  type,
  tag = null
) {
  if (type === "difficulty") {
    return escapeHatchResults.sessionBased.applicable ? 0.8 : 0.9;
  }

  if (type === "mastery" && tag) {
    // Check attempt-based escape hatch for this tag
    const attemptBasedTag = escapeHatchResults.attemptBased.find(
      (t) => t.tag === tag
    );
    if (attemptBasedTag) {
      return attemptBasedTag.adjustedThreshold;
    }

    // Check time-based escape hatch for this tag
    const timeBasedTag = escapeHatchResults.timeBased.find(
      (t) => t.tag === tag
    );
    if (timeBasedTag) {
      return timeBasedTag.adjustedThreshold;
    }
  }

  // Default thresholds
  return type === "difficulty" ? 0.9 : 0.8;
}

/**
 * Updates session state to track escape hatch activations
 * @param {Object} sessionState - Current session state
 * @param {Object} escapeHatchResults - Results from detectApplicableEscapeHatches
 * @returns {Object} Updated session state
 */
export function updateEscapeHatchTracking(sessionState, escapeHatchResults) {
  if (!sessionState.escapeHatches) {
    sessionState.escapeHatches = {
      sessionsAtCurrentDifficulty: 0,
      lastDifficultyPromotion: null,
      sessionsWithoutPromotion: 0,
      activatedEscapeHatches: [],
    };
  }

  const activatedHatches = sessionState.escapeHatches.activatedEscapeHatches;

  // Track session-based activation
  if (
    escapeHatchResults.sessionBased.applicable &&
    !activatedHatches.includes("session-based")
  ) {
    activatedHatches.push("session-based");
    console.info("🔓 Session-based escape hatch activated and tracked");
  }

  // Track attempt-based activations
  escapeHatchResults.attemptBased.forEach((tag) => {
    const key = `attempt-based-${tag.tag}`;
    if (!activatedHatches.includes(key)) {
      activatedHatches.push(key);
      console.info(`🔓 Attempt-based escape hatch activated for ${tag.tag}`);
    }
  });

  // Track time-based activations
  escapeHatchResults.timeBased.forEach((tag) => {
    const key = `time-based-${tag.tag}`;
    if (!activatedHatches.includes(key)) {
      activatedHatches.push(key);
      console.info(`🔓 Time-based escape hatch activated for ${tag.tag}`);
    }
  });

  return sessionState;
}

/**
 * Generates user-friendly messages for escape hatch activations
 * @param {Object} escapeHatchResults - Results from detectApplicableEscapeHatches
 * @returns {Array} Array of user-friendly messages
 */
export function generateEscapeHatchMessages(escapeHatchResults) {
  const messages = [];

  escapeHatchResults.recommendations.forEach((rec) => {
    messages.push({
      type: rec.type,
      level: "info",
      title: "Learning Assistance Activated",
      message: rec.message,
      action: rec.impact,
    });
  });

  return messages;
}
