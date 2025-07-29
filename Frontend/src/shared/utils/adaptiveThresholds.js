/**
 * 🎯 Adaptive Threshold Management
 * Progressively lowers thresholds based on repeated struggle patterns
 * Maintains educational integrity while preventing permanent stagnation
 */

/**
 * Calculates adaptive thresholds based on user struggle history
 * @param {Object} baseThresholds - Default threshold values
 * @param {Object} struggleHistory - User's struggle tracking data
 * @param {string} context - Context for threshold (difficulty, mastery, expansion)
 * @returns {Object} Adjusted thresholds and metadata
 */
export function calculateAdaptiveThresholds(baseThresholds, struggleHistory, context) {
  const adaptations = {
    original: baseThresholds,
    adjusted: { ...baseThresholds },
    adaptations: [],
    reason: 'No adaptations needed'
  };

  if (!struggleHistory || Object.keys(struggleHistory).length === 0) {
    return adaptations;
  }

  switch (context) {
    case 'difficulty':
      return adaptDifficultyThresholds(adaptations, struggleHistory);
    case 'mastery':
      return adaptMasteryThresholds(adaptations, struggleHistory);
    case 'expansion':
      return adaptExpansionThresholds(adaptations, struggleHistory);
    default:
      return adaptations;
  }
}

/**
 * Adapts difficulty promotion thresholds based on struggle patterns
 */
function adaptDifficultyThresholds(adaptations, history) {
  const { sessionsAtCurrentLevel = 0, consecutiveFailedPromotions = 0 } = history;
  
  // Progressive difficulty threshold reduction
  if (sessionsAtCurrentLevel >= 15) {
    adaptations.adjusted.promotionAccuracy = 0.75; // From 0.8 or 0.9
    adaptations.adaptations.push('Heavy struggle: 75% accuracy threshold');
    adaptations.reason = `${sessionsAtCurrentLevel} sessions at current difficulty`;
  } else if (sessionsAtCurrentLevel >= 10) {
    adaptations.adjusted.promotionAccuracy = 0.8; // From 0.9
    adaptations.adaptations.push('Moderate struggle: 80% accuracy threshold');
    adaptations.reason = `${sessionsAtCurrentLevel} sessions without promotion`;
  }

  return adaptations;
}

/**
 * Adapts tag mastery thresholds based on attempt patterns
 */
function adaptMasteryThresholds(adaptations, history) {
  const { totalAttempts = 0, consecutiveStruggles = 0, daysWithoutProgress = 0 } = history;
  
  // Multi-factor adaptive mastery thresholds
  let adjustedThreshold = adaptations.original.masteryThreshold || 0.8;
  
  // Attempt-based adaptations
  if (totalAttempts >= 20 && consecutiveStruggles >= 8) {
    adjustedThreshold = Math.min(adjustedThreshold, 0.65);
    adaptations.adaptations.push('Extreme struggle: 65% mastery threshold');
  } else if (totalAttempts >= 15 && consecutiveStruggles >= 5) {
    adjustedThreshold = Math.min(adjustedThreshold, 0.7);
    adaptations.adaptations.push('Heavy struggle: 70% mastery threshold');
  } else if (totalAttempts >= 8) {
    adjustedThreshold = Math.min(adjustedThreshold, 0.75);
    adaptations.adaptations.push('Light struggle: 75% mastery threshold');
  }

  // Time-based adaptations
  if (daysWithoutProgress >= 21) {
    adjustedThreshold = Math.min(adjustedThreshold, 0.6);
    adaptations.adaptations.push('Time-based: 60% threshold after 3+ weeks');
  } else if (daysWithoutProgress >= 14) {
    adjustedThreshold = Math.min(adjustedThreshold, 0.7);
    adaptations.adaptations.push('Time-based: 70% threshold after 2+ weeks');
  }

  adaptations.adjusted.masteryThreshold = adjustedThreshold;
  adaptations.reason = `${totalAttempts} attempts, ${consecutiveStruggles} consecutive struggles, ${daysWithoutProgress} days stagnant`;
  
  return adaptations;
}

/**
 * Adapts tag expansion thresholds based on expansion failure patterns
 */
function adaptExpansionThresholds(adaptations, history) {
  const { sessionsAtSameTagCount = 0, expansionFailures = 0 } = history;
  
  // Progressive expansion threshold reduction
  if (sessionsAtSameTagCount >= 8) {
    adaptations.adjusted.accuracyThreshold = 0.6; // From 0.75
    adaptations.adjusted.efficiencyThreshold = 0.4; // From 0.6
    adaptations.adaptations.push('Expansion stagnation: 60% accuracy OR 40% efficiency');
    adaptations.reason = `${sessionsAtSameTagCount} sessions at same tag count`;
  } else if (sessionsAtSameTagCount >= 5) {
    adaptations.adjusted.accuracyThreshold = 0.65; // From 0.75
    adaptations.adjusted.efficiencyThreshold = 0.5; // From 0.6
    adaptations.adaptations.push('Expansion struggle: 65% accuracy OR 50% efficiency');
    adaptations.reason = `${sessionsAtSameTagCount} sessions without expansion`;
  }

  return adaptations;
}

/**
 * Updates struggle history based on current performance
 * @param {Object} currentHistory - Existing struggle history
 * @param {Object} performanceData - Current session/attempt performance
 * @param {string} context - Context for tracking (difficulty, mastery, expansion)
 * @returns {Object} Updated struggle history
 */
export function updateStruggleHistory(currentHistory = {}, performanceData, context) {
  const now = new Date();
  const updated = { ...currentHistory };

  // Initialize tracking if not present
  if (!updated.firstStruggleDate) {
    updated.firstStruggleDate = now.toISOString();
  }
  updated.lastUpdateDate = now.toISOString();

  switch (context) {
    case 'difficulty':
      return updateDifficultyStruggleHistory(updated, performanceData);
    case 'mastery':
      return updateMasteryStruggleHistory(updated, performanceData);
    case 'expansion':
      return updateExpansionStruggleHistory(updated, performanceData);
    default:
      return updated;
  }
}

function updateDifficultyStruggleHistory(history, data) {
  const { promoted, sessionsAtLevel } = data;
  
  history.sessionsAtCurrentLevel = sessionsAtLevel;
  
  if (promoted) {
    history.consecutiveFailedPromotions = 0;
    history.lastPromotionDate = new Date().toISOString();
  } else {
    history.consecutiveFailedPromotions = (history.consecutiveFailedPromotions || 0) + 1;
  }

  return history;
}

function updateMasteryStruggleHistory(history, data) {
  const { mastered, attempts, success } = data;
  
  history.totalAttempts = attempts;
  
  if (mastered) {
    history.consecutiveStruggles = 0;
    history.lastMasteryDate = new Date().toISOString();
  } else if (!success) {
    history.consecutiveStruggles = (history.consecutiveStruggles || 0) + 1;
  }

  // Calculate days without progress
  if (history.lastMasteryDate) {
    const lastMastery = new Date(history.lastMasteryDate);
    history.daysWithoutProgress = Math.floor((new Date() - lastMastery) / (1000 * 60 * 60 * 24));
  }

  return history;
}

function updateExpansionStruggleHistory(history, data) {
  const { expanded, tagCount, previousTagCount } = data;
  
  if (expanded && tagCount > previousTagCount) {
    history.sessionsAtSameTagCount = 0;
    history.lastExpansionDate = new Date().toISOString();
  } else {
    history.sessionsAtSameTagCount = (history.sessionsAtSameTagCount || 0) + 1;
  }

  if (!expanded) {
    history.expansionFailures = (history.expansionFailures || 0) + 1;
  }

  return history;
}

/**
 * Generates user-friendly messages about threshold adaptations
 * @param {Object} adaptiveThresholds - Result from calculateAdaptiveThresholds
 * @returns {Array} User-friendly messages
 */
export function generateAdaptationMessages(adaptiveThresholds) {
  if (adaptiveThresholds.adaptations.length === 0) {
    return [];
  }

  return adaptiveThresholds.adaptations.map(adaptation => ({
    type: 'adaptive-threshold',
    level: 'info',
    title: 'Learning Assistance Activated',
    message: `🎯 ${adaptation} - We've adjusted the requirements to help you progress.`,
    reason: adaptiveThresholds.reason,
    context: 'We maintain challenge while preventing frustration.'
  }));
}

/**
 * Resets struggle history when significant progress is made
 * @param {Object} history - Current struggle history
 * @param {string} context - Context that triggered reset
 * @returns {Object} Reset struggle history
 */
export function resetStruggleHistory(history = {}, context) {
  const resetHistory = {
    ...history,
    resetDate: new Date().toISOString(),
    resetReason: context,
    previousStruggles: { ...history }
  };

  // Clear struggle counters but keep dates for reference
  delete resetHistory.consecutiveFailedPromotions;
  delete resetHistory.consecutiveStruggles;
  delete resetHistory.sessionsAtCurrentLevel;
  delete resetHistory.sessionsAtSameTagCount;
  delete resetHistory.expansionFailures;
  delete resetHistory.daysWithoutProgress;

  return resetHistory;
}