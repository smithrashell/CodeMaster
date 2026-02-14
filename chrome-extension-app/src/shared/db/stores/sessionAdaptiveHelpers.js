/**
 * Session Adaptive Helpers
 * Extracted from sessions.js for better organization
 * Contains functions for adaptive session logic and onboarding
 */

import { getMostRecentAttempt } from "./attempts.js";
import SessionLimits from "../../utils/session/sessionLimits.js";
import logger from "../../utils/logging/logger.js";

/**
 * Apply onboarding mode settings with safety constraints
 */
export function applyOnboardingSettings(settings, sessionState, allowedTags, focusDecision) {
  logger.info("Onboarding mode: Enforcing session parameters for optimal learning");

  const maxOnboardingSessionLength = SessionLimits.getMaxSessionLength(sessionState);

  const userSessionLength = settings.sessionLength;
  const normalizedUserLength = normalizeSessionLengthForCalculation(userSessionLength);
  let sessionLength = Math.min(normalizedUserLength, maxOnboardingSessionLength);
  let numberOfNewProblems = sessionLength;

  logger.info(`Session length calculation debug:`, {
    userSessionLength: userSessionLength,
    normalizedUserLength: normalizedUserLength,
    maxOnboardingSessionLength: maxOnboardingSessionLength,
    finalSessionLength: sessionLength,
    action: "respecting_user_preference_with_onboarding_cap"
  });

  logger.info(`Onboarding session length: ${sessionLength} problems (user preference ${userSessionLength}, max ${maxOnboardingSessionLength})`);

  const userMaxNewProblems = settings.numberofNewProblemsPerSession;
  const maxNewProblems = SessionLimits.getMaxNewProblems(sessionState);
  if (userMaxNewProblems && userMaxNewProblems > 0) {
    numberOfNewProblems = Math.min(numberOfNewProblems, userMaxNewProblems, maxNewProblems);
    logger.info(`User new problems preference applied: ${userMaxNewProblems} → capped at ${numberOfNewProblems} for onboarding`);
  }

  logger.info(`Focus tags from coordination service: [${allowedTags.join(', ')}] (${focusDecision.reasoning})`);

  return { sessionLength, numberOfNewProblems };
}

/**
 * Apply post-onboarding adaptive logic with performance-based adjustments
 */
export async function applyPostOnboardingLogic({
  accuracy, efficiencyScore, settings, interviewInsights,
  allowedTags, focusTags, _sessionState, now, performanceTrend, consecutiveExcellentSessions
}) {
  let gapInDays = null;
  const lastAttempt = await getMostRecentAttempt();
  if (lastAttempt?.attempt_date) {
    const lastTime = new Date(lastAttempt.attempt_date);
    gapInDays = (now - lastTime) / (1000 * 60 * 60 * 24);
  }

  const baseLength = normalizeSessionLengthForCalculation(settings.sessionLength);
  const adaptiveSessionLength = computeSessionLength(accuracy, efficiencyScore, baseLength, performanceTrend, consecutiveExcellentSessions);

  let sessionLength = applySessionLengthPreference(adaptiveSessionLength, settings.sessionLength);

  sessionLength = applyInterviewInsightsToSessionLength(sessionLength, interviewInsights);

  if ((gapInDays !== null && gapInDays > 4) || accuracy < 0.5) {
    const originalLength = sessionLength;
    sessionLength = Math.min(sessionLength, 5);
    const gapText = gapInDays !== null ? `${gapInDays.toFixed(1)} days` : 'no gap data';
    logger.info(`Performance constraint applied: Session length capped from ${originalLength} to ${sessionLength} due to gap (${gapText}) or low accuracy (${(accuracy * 100).toFixed(1)}%)`);
  }

  let numberOfNewProblems = calculateNewProblems(accuracy, sessionLength, settings, interviewInsights);

  const tagResult = applyInterviewInsightsToTags(allowedTags, focusTags, interviewInsights, accuracy);

  return {
    sessionLength,
    numberOfNewProblems,
    allowedTags: tagResult.allowedTags,
    tag_index: tagResult.tag_index
  };
}

/**
 * Apply interview insights to session length
 */
export function applyInterviewInsightsToSessionLength(sessionLength, interviewInsights) {
  if (interviewInsights.hasInterviewData) {
    const recs = interviewInsights.recommendations;

    if (recs.sessionLengthAdjustment !== 0) {
      const originalLength = sessionLength;
      sessionLength = Math.max(3, Math.min(8, sessionLength + recs.sessionLengthAdjustment));
      logger.info(`Interview insight: Session length adjusted from ${originalLength} to ${sessionLength} (transfer accuracy: ${(interviewInsights.transferAccuracy * 100).toFixed(1)}%)`);
    }

    if (recs.difficultyAdjustment !== 0) {
      if (recs.difficultyAdjustment < 0) {
        logger.info(`Interview insight: Conservative difficulty due to poor transfer (${(interviewInsights.transferAccuracy * 100).toFixed(1)}% accuracy)`);
      } else if (recs.difficultyAdjustment > 0) {
        logger.info(`Interview insight: Aggressive difficulty due to strong transfer (${(interviewInsights.transferAccuracy * 100).toFixed(1)}% accuracy)`);
      }
    }
  }
  return sessionLength;
}

/**
 * Calculate new problems based on performance and apply guardrails
 */
export function calculateNewProblems(accuracy, sessionLength, settings, interviewInsights) {
  let numberOfNewProblems;

  if (accuracy >= 0.85) {
    numberOfNewProblems = Math.min(5, Math.floor(sessionLength / 2));
  } else if (accuracy < 0.6) {
    numberOfNewProblems = 1;
  } else {
    numberOfNewProblems = Math.floor(sessionLength * 0.3);
  }

  const userMaxNewProblems = settings.numberofNewProblemsPerSession;
  if (userMaxNewProblems && userMaxNewProblems > 0) {
    const originalNewProblems = numberOfNewProblems;
    numberOfNewProblems = Math.min(numberOfNewProblems, userMaxNewProblems);
    if (originalNewProblems !== numberOfNewProblems) {
      logger.info(`User guardrail applied: New problems capped from ${originalNewProblems} to ${numberOfNewProblems}`);
    }
  }

  if (interviewInsights.hasInterviewData && interviewInsights.recommendations.newProblemsAdjustment !== 0) {
    const originalNewProblems = numberOfNewProblems;
    numberOfNewProblems = Math.max(0, numberOfNewProblems + interviewInsights.recommendations.newProblemsAdjustment);
    logger.info(`Interview insight: New problems adjusted from ${originalNewProblems} to ${numberOfNewProblems} (transfer performance: ${(interviewInsights.transferAccuracy * 100).toFixed(1)}%)`);
  }

  return numberOfNewProblems;
}

/**
 * Apply interview insights to focus tag selection
 */
export function applyInterviewInsightsToTags(allowedTags, focusTags, interviewInsights, accuracy) {
  let tagCount = allowedTags.length;

  if (interviewInsights.hasInterviewData) {
    const recs = interviewInsights.recommendations;
    const focusWeight = recs.focusTagsWeight;

    if (focusWeight < 1.0) {
      const weakTags = recs.weakTags || [];
      if (weakTags.length > 0) {
        const weakTagsInFocus = allowedTags.filter(tag => weakTags.includes(tag));
        if (weakTagsInFocus.length > 0) {
          const originalTags = [...allowedTags];
          allowedTags = weakTagsInFocus.slice(0, Math.max(2, Math.ceil(tagCount * focusWeight)));
          logger.info(`Interview insight: Focusing on weak tags [${allowedTags.join(', ')}] (was [${originalTags.join(', ')}]) due to poor transfer`);
        }
      }
    } else if (focusWeight > 1.0) {
      const additionalTags = focusTags.filter(tag => !allowedTags.includes(tag));
      const tagsToAdd = Math.floor((focusWeight - 1.0) * tagCount);
      if (additionalTags.length > 0 && tagsToAdd > 0) {
        const originalTags = [...allowedTags];
        allowedTags = [...allowedTags, ...additionalTags.slice(0, tagsToAdd)];
        logger.info(`Interview insight: Expanding tags [${allowedTags.join(', ')}] (was [${originalTags.join(', ')}]) due to strong transfer`);
      }
    }

    tagCount = allowedTags.length;
  }

  const tagIndex = tagCount - 1;

  logger.info(
    `Tag exposure from coordination service: ${tagCount}/${focusTags.length} focus tags (coordinated: [${allowedTags.join(', ')}], accuracy: ${(accuracy * 100).toFixed(1)}%)`
  );

  return { allowedTags, tag_index: tagIndex };
}

/**
 * Compute adaptive session length based on performance
 */
export function computeSessionLength(accuracy, efficiencyScore, userPreferredLength = 4, performanceTrend = 'stable', consecutiveExcellentSessions = 0) {
  const accWeight = Math.min(Math.max(accuracy ?? 0.5, 0), 1);
  const effWeight = Math.min(Math.max(efficiencyScore ?? 0.5, 0), 1);

  const baseLength = Math.max(userPreferredLength || 4, 3);

  let lengthMultiplier = 1.0;

  if (accWeight >= 0.9) {
    lengthMultiplier = 1.25;
  } else if (accWeight >= 0.7) {
    lengthMultiplier = 1.0;
  } else if (accWeight < 0.5) {
    lengthMultiplier = 0.8;
  }

  if (performanceTrend === 'sustained_excellence') {
    const momentumBonus = Math.min(consecutiveExcellentSessions * 0.15, 0.6);
    lengthMultiplier += momentumBonus;
    logger.info(`Sustained excellence bonus: ${(momentumBonus * 100).toFixed(0)}% (${consecutiveExcellentSessions} consecutive excellent sessions)`);
  } else if (performanceTrend === 'improving') {
    lengthMultiplier += 0.1;
    logger.info(`Improvement momentum: +10% session length`);
  } else if (performanceTrend === 'struggling') {
    lengthMultiplier = Math.max(lengthMultiplier - 0.2, 0.6);
    logger.info(`Struggling support: Extra session length reduction`);
  } else if (performanceTrend === 'stable') {
    if (accWeight >= 0.8) {
      lengthMultiplier += 0.05;
      logger.info(`Stable strong performance: +5% session length (${(accWeight * 100).toFixed(1)}% accuracy)`);
    } else if (accWeight >= 0.6) {
      lengthMultiplier += 0.025;
      logger.info(`Stable performance: +2.5% session length for engagement (${(accWeight * 100).toFixed(1)}% accuracy)`);
    }
  }

  if (effWeight > 0.8 && accWeight > 0.8) {
    lengthMultiplier *= 1.1;
  }

  const maxLength = performanceTrend === 'sustained_excellence' ? 12 : 8;
  const adaptedLength = Math.round(baseLength * lengthMultiplier);
  const finalLength = Math.min(Math.max(adaptedLength, 3), maxLength);

  console.log(`SESSION LENGTH COMPUTATION:`, {
    accuracy: accWeight,
    performanceTrend,
    consecutiveExcellentSessions,
    baseLength,
    lengthMultiplier,
    adaptedLength,
    maxLength,
    finalLength
  });

  return finalLength;
}

/**
 * Normalizes session length setting to a numeric value for calculations
 */
export function normalizeSessionLengthForCalculation(userSetting, defaultBase = 4) {
  if (!userSetting || userSetting === 'auto' || userSetting <= 0) {
    return defaultBase;
  }

  const numeric = Number(userSetting);
  return isNaN(numeric) ? defaultBase : numeric;
}

/**
 * Apply user session length preference as a minimum floor
 * When user explicitly sets a session length, respect it as the minimum
 */
export function applySessionLengthPreference(adaptiveLength, userPreferredLength) {
  if (!userPreferredLength || userPreferredLength === 'auto' || userPreferredLength <= 0) {
    return adaptiveLength;
  }

  const adjustedLength = Math.max(adaptiveLength, userPreferredLength);

  if (adjustedLength !== adaptiveLength) {
    logger.info(`Session length raised: Adaptive ${adaptiveLength} → User preference ${userPreferredLength} = ${adjustedLength}`);
  }

  return adjustedLength;
}
