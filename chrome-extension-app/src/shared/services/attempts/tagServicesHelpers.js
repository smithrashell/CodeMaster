/**
 * Tag Services Helpers - Scoring Functions and Focus Pool Management
 */

import { StorageService } from "../storage/storageService.js";
import logger from "../../utils/logging/logger.js";
import { calculateSuccessRate } from "../../utils/leitner/Utils.js";

/**
 * Calculates learning velocity based on recent performance trends
 */
export function calculateLearningVelocity(tagData) {
  if (!tagData || typeof tagData !== 'object') {
    return 0.1;
  }

  const attempts = tagData.total_attempts || 0;
  const successfulAttempts = tagData.successful_attempts || 0;
  const successRate = attempts > 0 ? successfulAttempts / attempts : 0;

  if (attempts < 3) return 0.3;
  if (attempts >= 8) return 0.2;

  return successRate * (1 - Math.abs(attempts - 5) / 5);
}

/**
 * Calculates proficiency-based weight for a tag based on success rate and attempt maturity
 */
export function calculateTagWeight(tagData, masteryThreshold = 0.8) {
  if (!tagData || typeof tagData !== 'object') {
    return 0;
  }

  const totalAttempts = tagData.total_attempts || 0;
  const successfulAttempts = tagData.successful_attempts || 0;

  if (totalAttempts === 0) {
    return 0;
  }

  const successRate = successfulAttempts / totalAttempts;
  const attemptMaturity = Math.min(1, totalAttempts / 8);

  let proficiencyWeight;
  if (successRate >= masteryThreshold) {
    proficiencyWeight = 1.0;
  } else if (successRate >= 0.6) {
    proficiencyWeight = 0.6;
  } else if (successRate >= 0.4) {
    proficiencyWeight = 0.3;
  } else {
    proficiencyWeight = 0.1;
  }

  return proficiencyWeight * attemptMaturity;
}

/**
 * Calculates relationship score based on weighted proficiency of related tags
 */
export function calculateRelationshipScore(tag, masteryData, tagRelationships, masteryThresholds = {}) {
  const relationships = tagRelationships[tag] || {};

  if (!Array.isArray(masteryData) || !tagRelationships) {
    return 0;
  }

  let relationshipScore = 0;

  for (const attemptedTag of masteryData) {
    if (!attemptedTag || typeof attemptedTag !== 'object') continue;

    const totalAttempts = attemptedTag.total_attempts || 0;
    if (totalAttempts === 0) continue;

    const tagName = attemptedTag.tag;
    const relationshipStrength = relationships[tagName] || 0;

    if (relationshipStrength === 0) continue;

    const threshold = masteryThresholds[tagName] || 0.8;
    const tagWeight = calculateTagWeight(attemptedTag, threshold);

    relationshipScore += relationshipStrength * tagWeight;
  }

  const totalRelationships = Object.keys(relationships).length;
  return totalRelationships > 0 ? relationshipScore / totalRelationships : 0;
}

/**
 * Calculates optimal learning score based on success rate and attempts
 */
export function getOptimalLearningScore(successRate, attempts) {
  const optimalSuccessRate = 0.55;
  const optimalAttempts = 5;

  const successRateScore = 1 - Math.abs(successRate - optimalSuccessRate) / 0.6;
  const attemptsScore = 1 - Math.abs(attempts - optimalAttempts) / 10;

  return (successRateScore + attemptsScore) / 2;
}

/**
 * Apply time-based escape hatch logic for stuck tags
 */
export function applyTimeBasedEscapeHatch(tag, baseMasteryThreshold = 0.8) {
  let adjustedMasteryThreshold = baseMasteryThreshold;
  let timeBasedEscapeHatch = false;
  const successRate = calculateSuccessRate(tag.successful_attempts, tag.total_attempts);
  const now = new Date();

  if (tag.last_attempt_date) {
    const lastAttemptDate = new Date(tag.last_attempt_date);
    const daysSinceLastAttempt = (now - lastAttemptDate) / (1000 * 60 * 60 * 24);

    if (daysSinceLastAttempt >= 14 && successRate >= 0.6 && successRate < baseMasteryThreshold) {
      adjustedMasteryThreshold = Math.max(0.6, baseMasteryThreshold - 0.2);
      timeBasedEscapeHatch = true;
      logger.info(`🔓 Time-based escape hatch available for "${tag.tag}": ${daysSinceLastAttempt.toFixed(0)} days since last attempt, ${(successRate * 100).toFixed(1)}% accuracy, threshold lowered from ${(baseMasteryThreshold * 100).toFixed(0)}% to ${(adjustedMasteryThreshold * 100).toFixed(0)}%`);
    }
  }

  return { adjustedMasteryThreshold, timeBasedEscapeHatch };
}

/**
 * Process and enrich tag data with calculated scores
 */
export function processAndEnrichTags(masteryData, tierTags, tagRelationships, masteryThresholds, tagRelationshipsData) {
  return masteryData
    .filter((tag) => tierTags.includes(tag.tag) && tag.total_attempts > 0)
    .map((tag) => {
      const successRate = calculateSuccessRate(tag.successful_attempts, tag.total_attempts);
      const baseMasteryThreshold = masteryThresholds[tag.tag] || 0.8;
      const { adjustedMasteryThreshold, timeBasedEscapeHatch } = applyTimeBasedEscapeHatch(tag, baseMasteryThreshold);

      const tagRelationship = tagRelationshipsData.find(tr => tr.id === tag.tag);
      const dist = tagRelationship?.difficulty_distribution || { easy: 0, medium: 0, hard: 0 };
      const totalProblems = dist.easy + dist.medium + dist.hard;

      return {
        ...tag,
        successRate,
        adjustedMasteryThreshold,
        timeBasedEscapeHatch,
        learningVelocity: calculateLearningVelocity(tag),
        relationshipScore: calculateRelationshipScore(tag.tag, masteryData, tagRelationships, masteryThresholds),
        totalProblems,
      };
    });
}

/**
 * Sort and select focus tags based on intelligent criteria
 */
export function sortAndSelectFocusTags(unmasteredTags, count = 5) {
  console.log('🔍 TAG SORTING DEBUG: Sorting', unmasteredTags.length, 'candidate tags');

  const sortedTags = unmasteredTags.sort((a, b) => {
    if (Math.abs(a.relationshipScore - b.relationshipScore) > 0.05) {
      return b.relationshipScore - a.relationshipScore;
    }

    const aMaturity = Math.min(1, a.total_attempts / 8);
    const bMaturity = Math.min(1, b.total_attempts / 8);
    if (Math.abs(aMaturity - bMaturity) > 0.1) {
      return bMaturity - aMaturity;
    }

    const aOptimalLearning = getOptimalLearningScore(a.successRate, a.total_attempts);
    const bOptimalLearning = getOptimalLearningScore(b.successRate, b.total_attempts);
    if (Math.abs(aOptimalLearning - bOptimalLearning) > 0.05) {
      return bOptimalLearning - aOptimalLearning;
    }

    return (b.totalProblems || 0) - (a.totalProblems || 0);
  });

  console.log('🔍 TAG SORTING DEBUG: Top 10 sorted tags:', sortedTags.slice(0, 10).map(t => ({
    tag: t.tag,
    relationshipScore: t.relationshipScore,
    attempts: t.total_attempts,
    totalProblems: t.totalProblems
  })));

  const maxFocusTags = count;
  const focusTags = sortedTags.slice(0, maxFocusTags);
  const selectedTags = focusTags.map((tag) => tag.tag);

  console.log('🔍 TAG SORTING DEBUG: Final selected tags after diversity filter:', selectedTags);

  if (selectedTags.length === 0) {
    logger.warn("⚠️ sortAndSelectFocusTags returned empty, using fallback tags");
    return ["array", "hash table", "string"].slice(0, 1);
  }

  return selectedTags;
}

/**
 * Resets tag_index to 0 when a new focus window is created
 */
export async function resetTagIndexForNewWindow() {
  const sessionStateKey = "session_state";
  const sessionState = await StorageService.getSessionState(sessionStateKey);

  if (sessionState) {
    sessionState.tag_index = 0;
    await StorageService.setSessionState(sessionStateKey, sessionState);
    logger.info("🔄 Reset tag_index to 0 for new focus window");
  }
}

/**
 * Creates a new stable system focus pool
 */
export async function createSystemPool(masteryData, tierTags, currentTier, excludeTags, getCandidatesForSystemPool) {
  const candidates = await getCandidatesForSystemPool(masteryData, tierTags, excludeTags);
  const poolSize = Math.min(5 - excludeTags.length, 5);
  const selectedTags = sortAndSelectFocusTags(candidates, poolSize);

  const settings = await StorageService.getSettings();
  await StorageService.setSettings({
    ...settings,
    systemFocusPool: {
      tags: selectedTags,
      tier: currentTier,
      lastGenerated: new Date().toISOString()
    }
  });

  logger.info(`✅ Created system focus pool (${selectedTags.length} tags):`, selectedTags);
  return selectedTags;
}

/**
 * Maintains existing stable system pool
 */
export async function maintainSystemPool(existing, masteryData, tierTags, currentTier, excludeTags, getCandidatesForSystemPool) {
  const poolSize = Math.min(5 - excludeTags.length, 5);

  const keptTags = existing.tags.filter(tag => {
    const tagData = masteryData.find(m => m.tag === tag);

    if (tagData?.mastered) {
      logger.info(`🎓 Graduated from system pool: ${tag} (mastered)`);
      return false;
    }

    return true;
  });

  logger.info(`✅ Kept ${keptTags.length}/${existing.tags.length} tags from system pool`);

  if (keptTags.length < poolSize) {
    const emptySlots = poolSize - keptTags.length;
    logger.info(`🔄 Refilling ${emptySlots} empty slots in system pool`);

    const candidates = await getCandidatesForSystemPool(
      masteryData,
      tierTags,
      [...excludeTags, ...keptTags]
    );
    const newTags = sortAndSelectFocusTags(candidates, emptySlots);

    const updatedTags = [...keptTags, ...newTags];

    const settings = await StorageService.getSettings();
    await StorageService.setSettings({
      ...settings,
      systemFocusPool: {
        tags: updatedTags,
        tier: currentTier,
        lastGenerated: existing.lastGenerated,
        lastUpdated: new Date().toISOString()
      }
    });

    logger.info(`✅ Refilled system pool with new tags:`, newTags);
    return updatedTags;
  }

  return keptTags;
}

/**
 * Gets stable system focus pool or creates new one
 */
export async function getStableSystemPool(masteryData, tierTags, currentTier, excludeTags, getCandidatesForSystemPool) {
  const settings = await StorageService.getSettings();
  const existing = settings.systemFocusPool;

  if (!existing || existing.tier !== currentTier || !Array.isArray(existing.tags)) {
    logger.info(`🔄 Creating new system focus pool for tier: ${currentTier}`);
    return await createSystemPool(masteryData, tierTags, currentTier, excludeTags, getCandidatesForSystemPool);
  }

  logger.info('✅ Maintaining existing system focus pool');
  return await maintainSystemPool(existing, masteryData, tierTags, currentTier, excludeTags, getCandidatesForSystemPool);
}

/**
 * Checks if user focus areas need to be updated due to mastery graduation
 */
export async function checkFocusAreasGraduation(getCurrentLearningState, openDB) {
  try {
    const settings = await StorageService.getSettings();
    const userFocusAreas = settings.focusAreas || [];

    if (userFocusAreas.length === 0) {
      return { needsUpdate: false, masteredTags: [], suggestions: [] };
    }

    const { masteredTags, allTagsInCurrentTier, masteryData } = await getCurrentLearningState();

    const masteredFocusAreas = userFocusAreas.filter(tag =>
      masteredTags.includes(tag)
    );

    const db = await openDB();
    const tagRelationshipsData = await new Promise((resolve, reject) => {
      const tx = db.transaction("tag_relationships", "readonly");
      const store = tx.objectStore("tag_relationships");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    const masteryThresholds = tagRelationshipsData.reduce((acc, item) => {
      acc[item.id] = item.mastery_threshold || 0.8;
      return acc;
    }, {});

    const nearMasteryFocusAreas = userFocusAreas.filter(tag => {
      const tagData = masteryData.find(m => m.tag === tag);
      if (!tagData || tagData.total_attempts === 0) return false;
      const successRate = tagData.successful_attempts / tagData.total_attempts;
      const threshold = masteryThresholds[tag] || 0.8;
      return successRate >= threshold && !masteredTags.includes(tag);
    });

    const availableForFocus = allTagsInCurrentTier.filter(tag =>
      !masteredTags.includes(tag) &&
      !userFocusAreas.includes(tag)
    );

    const suggestions = availableForFocus.slice(0, 3);
    const needsUpdate = masteredFocusAreas.length > 0;

    if (needsUpdate) {
      logger.info(`🎓 Focus areas graduation detected: ${masteredFocusAreas.join(', ')} mastered`);
    }

    return {
      needsUpdate,
      masteredTags: masteredFocusAreas,
      nearMasteryTags: nearMasteryFocusAreas,
      suggestions,
      currentFocusAreas: userFocusAreas,
    };
  } catch (error) {
    logger.error('Error checking focus areas graduation:', error);
    return { needsUpdate: false, masteredTags: [], suggestions: [] };
  }
}

/**
 * Automatically graduates mastered focus areas and suggests replacements
 */
export async function graduateFocusAreas(checkGraduation) {
  try {
    const graduationStatus = await checkGraduation();

    if (!graduationStatus.needsUpdate) {
      return { updated: false, report: graduationStatus };
    }

    const settings = await StorageService.getSettings();
    const currentFocusAreas = settings.focusAreas || [];

    const updatedFocusAreas = currentFocusAreas.filter(tag =>
      !graduationStatus.masteredTags.includes(tag)
    );

    const spacesAvailable = 3 - updatedFocusAreas.length;
    if (spacesAvailable > 0 && graduationStatus.suggestions.length > 0) {
      const autoAddTags = graduationStatus.suggestions.slice(0, spacesAvailable);
      updatedFocusAreas.push(...autoAddTags);
      logger.info(`🔄 Auto-added focus areas: ${autoAddTags.join(', ')}`);
    }

    await StorageService.setSettings({
      ...settings,
      focusAreas: updatedFocusAreas,
    });

    logger.info(`🎓 Graduated focus areas: ${graduationStatus.masteredTags.join(', ')}`);
    logger.info(`🎯 New focus areas: ${updatedFocusAreas.join(', ')}`);

    return {
      updated: true,
      report: {
        ...graduationStatus,
        newFocusAreas: updatedFocusAreas,
        autoAddedTags: updatedFocusAreas.filter(tag =>
          graduationStatus.suggestions.includes(tag)
        ),
      }
    };
  } catch (error) {
    logger.error('Error graduating focus areas:', error);
    return { updated: false, error: error.message };
  }
}
