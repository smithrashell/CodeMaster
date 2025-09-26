// eslint-disable-next-line no-restricted-imports
import { dbHelper } from "../db/index.js";
import {
  getHighlyRelatedTags,
  getNextFiveTagsFromNextTier,
} from "../db/tag_relationships.js";
import { getSessionPerformance } from "../db/sessions.js";
import { StorageService } from "./storageService.js";
import SessionLimits from "../utils/sessionLimits.js";
import logger from "../utils/logger.js";
import { calculateSuccessRate } from "../utils/Utils.js";

const openDB = () => dbHelper.openDB();

// Helper function for onboarding fallback when no mastery data exists
async function handleOnboardingFallback(db) {
  const tagRelationships = await new Promise((resolve, reject) => {
    const tx = db.transaction("tag_relationships", "readonly");
    const store = tx.objectStore("tag_relationships");
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  const topTags = tagRelationships
    .map((entry) => {
      const totalWeight = (entry.related_tags || []).reduce(
        (sum, relation) => sum + relation.strength,
        0
      );
      return { tag: entry.id, weight: totalWeight };
    })
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5)
    .map((entry) => entry.tag);

  const allTags = tagRelationships.map((entry) => entry);
  const tagsinCurrentTier = allTags
    .filter((tag) => tag.classification === "Core Concept")
    .map((tag) => tag.id);

  // 🛡️ Onboarding safety: Ensure we have focus tags and tier tags
  const safeFocusTags =
    topTags.length > 0
      ? topTags
      : tagsinCurrentTier.length > 0
      ? tagsinCurrentTier.slice(0, 3)
      : ["array", "hash table", "string"];

  const safeAllTagsInCurrentTier =
    tagsinCurrentTier.length > 0
      ? tagsinCurrentTier
      : [
          "array",
          "hash table",
          "string",
          "dynamic programming",
          "two pointers",
        ];

  logger.info("👶 Onboarding with focus tags:", safeFocusTags);
  logger.info("👶 All tags in current tier:", safeAllTagsInCurrentTier);

  return {
    classification: "Core Concept",
    masteredTags: [],
    allTagsInCurrentTier: safeAllTagsInCurrentTier,
    focusTags: safeFocusTags,
    masteryData: [],
  };
}

// Helper function to check tier progression with escape hatch
async function checkTierProgression(tier, masteredTags, tierTags, isTierMastered) {
  // 🔓 Time-based tier progression escape hatch: Allow advancement after 30+ days without progress
  const now = new Date();
  let allowTierAdvancement = isTierMastered;
  let tierEscapeHatchActivated = false;

  if (!isTierMastered) {
    // Check if user has been stuck at this tier for 30+ days
    const tierProgressKey = `tier_progress_${tier}`;
    let tierProgressData = (await StorageService.getSessionState(
      tierProgressKey
    )) || {
      tierStartDate: now.toISOString(),
      lastProgressDate: now.toISOString(),
      daysWithoutProgress: 0,
    };

    // Calculate days since last tier progress
    const lastProgressDate = new Date(tierProgressData.lastProgressDate);
    const daysSinceProgress =
      (now - lastProgressDate) / (1000 * 60 * 60 * 24);

    // Check if user has reasonable progress (60%+ tags mastered) and been stuck 30+ days
    const progressRatio = masteredTags.length / tierTags.length;
    if (daysSinceProgress >= 30 && progressRatio >= 0.6) {
      allowTierAdvancement = true;
      tierEscapeHatchActivated = true;
      logger.info(
        `🔓 Tier progression escape hatch ACTIVATED for ${tier}: ${Math.floor(
          daysSinceProgress
        )} days without progress, ${masteredTags.length}/${
          tierTags.length
        } tags mastered (${(progressRatio * 100).toFixed(1)}%)`
      );

      // Update progress tracking
      tierProgressData.lastProgressDate = now.toISOString();
      await StorageService.setSessionState(tierProgressKey, tierProgressData);
    } else {
      // Update days without progress tracking
      tierProgressData.daysWithoutProgress = Math.floor(daysSinceProgress);
      await StorageService.setSessionState(tierProgressKey, tierProgressData);
    }
  }

  return { allowTierAdvancement, tierEscapeHatchActivated };
}

// Helper function to seed new tags when needed
async function seedNewTagsIfNeeded(context) {
  const { db, masteryStore, masteredTags, tierTags, unmasteredTags, masteryData, tier, tierEscapeHatchActivated } = context;
  const missingTags = tierTags.filter(
    (tag) => !masteryData.some((m) => m.tag === tag)
  );

  if (unmasteredTags.length === 0 && missingTags.length > 0) {
    const newTags = await getHighlyRelatedTags(
      db,
      masteredTags,
      missingTags,
      5
    );

    logger.info(
      `🔹 Seeding ${newTags.length} new tags from ${tier} into tag_mastery`
    );

    await Promise.all(
      newTags.map((newTag) => {
        return new Promise((resolve, reject) => {
          const putRequest = masteryStore.put({
            tag: newTag,
            total_attempts: 0,
            successful_attempts: 0,
            decay_score: 1,
            mastered: false,
          });
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        });
      })
    );

    return {
      classification: tier,
      masteredTags,
      allTagsInCurrentTier: tierTags,
      focusTags: newTags,
      masteryData,
      tierEscapeHatchActivated,
    };
  }
  return null;
}

async function getCurrentTier() {
  const db = await openDB();
  const tx = db.transaction(["tag_mastery", "tag_relationships"], "readonly");
  const masteryStore = tx.objectStore("tag_mastery");
  const relationshipsStore = tx.objectStore("tag_relationships");

  // Execute both queries in parallel within the same transaction
  const [masteryData, allTagRelationships] = await Promise.all([
    new Promise((resolve, reject) => {
      const request = masteryStore.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }),
    new Promise((resolve, reject) => {
      const request = relationshipsStore.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    })
  ]);

  logger.info("🔍 masteryData:", masteryData);

  // ✅ Onboarding fallback: No mastery data yet
  if (!masteryData || masteryData.length === 0) {
    return await handleOnboardingFallback(db);
  }

  const masteryThresholds = allTagRelationships.reduce((acc, item) => {
    acc[item.id] = item.mastery_threshold || 0.8;
    return acc;
  }, {});

  // ✅ Returning user logic
  const tiers = ["Core Concept", "Fundamental Technique", "Advanced Technique"];

  for (const tier of tiers) {
    const tierRequest = relationshipsStore
      .index("by_classification")
      .getAll(tier);
    const tierTags = await new Promise((resolve, reject) => {
      tierRequest.onsuccess = () =>
        resolve(tierRequest.result.map((t) => t.id));
      tierRequest.onerror = () => reject(tierRequest.error);
    });

    const masteredTags = masteryData
      .filter(
        (tag) =>
          tierTags.includes(tag.tag) &&
          tag.total_attempts > 0 &&
          calculateSuccessRate(tag.successful_attempts, tag.total_attempts) >= (masteryThresholds[tag.tag] || 0.8)
      )
      .map((tag) => tag.tag);

    const unmasteredTags = await getIntelligentFocusTags(
      masteryData,
      tierTags,
      db
    );

    const masteryThreshold = Math.ceil(tierTags.length * 0.8);
    const isTierMastered = masteredTags.length >= masteryThreshold;

    const { allowTierAdvancement, tierEscapeHatchActivated } = await checkTierProgression(tier, masteredTags, tierTags, isTierMastered);

    if (!allowTierAdvancement) {
      logger.info(
        `✅ User is in ${tier}, working on ${unmasteredTags.length} tags.`
      );

      // 🛡️ FINAL SAFETY NET: Ensure focus tags are never empty
      const safeFocusTags = unmasteredTags && unmasteredTags.length > 0
        ? unmasteredTags
        : (tierTags.length > 0 ? tierTags.slice(0, 3) : ["array"]);

      if (safeFocusTags !== unmasteredTags) {
        logger.warn(`⚠️ getCurrentTier using fallback focus tags: ${safeFocusTags}`);
      }

      return {
        classification: tier,
        masteredTags,
        allTagsInCurrentTier: tierTags,
        focusTags: safeFocusTags,
        masteryData,
        tierEscapeHatchActivated: false,
      };
    }

    const seedResult = await seedNewTagsIfNeeded({
      db, masteryStore, masteredTags, tierTags, unmasteredTags, masteryData, tier, tierEscapeHatchActivated
    });
    if (seedResult) {
      return seedResult;
    }
  }

  // ✅ All tiers mastered — advance
  logger.info("🚀 All tiers mastered. Advancing to next tier...");
  return getNextFiveTagsFromNextTier(masteryData);
}

async function getCurrentLearningState() {
  const {
    classification,
    masteredTags,
    allTagsInCurrentTier,
    focusTags,
    masteryData,
  } = await getCurrentTier();

  const sessionPerformance = await getSessionPerformance({
    allTagsInCurrentTier,
  });
  logger.info("tags", allTagsInCurrentTier);
  logger.info(`📌 Tier: ${classification}`);
  logger.info(`✅ Mastered Tags: ${masteredTags.join(", ")}`);
  logger.info(`🔹 Focus Tags: ${focusTags.join(", ")}`);
  logger.info(`🔹 Tags in Tier: ${allTagsInCurrentTier.join(", ")}`);

  return {
    currentTier: classification,
    masteredTags,
    allTagsInCurrentTier,
    focusTags,
    masteryData,
    sessionPerformance,
  };
}

/**
 * Intelligently selects focus tags based on learning efficiency and relationships
 * @param {array} masteryData - User's tag mastery data
 * @param {array} tierTags - All tags in current tier
 * @param {object} db - Database connection
 * @returns {Promise<Array>} Intelligent focus tags
 */
// Helper function to apply time-based escape hatch logic
function applyTimeBasedEscapeHatch(tag, baseMasteryThreshold = 0.8) {
  let adjustedMasteryThreshold = baseMasteryThreshold;
  let timeBasedEscapeHatch = false;
  const successRate = calculateSuccessRate(tag.successful_attempts, tag.total_attempts);
  const now = new Date();

  // Check if tag has been stuck for 2+ weeks
  if (tag.last_attempt_date) {
    const lastAttemptDate = new Date(tag.last_attempt_date);
    const daysSinceLastAttempt = (now - lastAttemptDate) / (1000 * 60 * 60 * 24);

    // Apply time-based escape hatch if stuck for 14+ days and has some progress (≥60%)
    // Lower the tag-specific threshold by 20 percentage points (e.g., 85% -> 65%, 70% -> 50%)
    if (daysSinceLastAttempt >= 14 && successRate >= 0.6 && successRate < baseMasteryThreshold) {
      adjustedMasteryThreshold = Math.max(0.6, baseMasteryThreshold - 0.2);
      timeBasedEscapeHatch = true;
      logger.info(`🔓 Time-based escape hatch available for "${tag.tag}": ${daysSinceLastAttempt.toFixed(0)} days since last attempt, ${(successRate * 100).toFixed(1)}% accuracy, threshold lowered from ${(baseMasteryThreshold * 100).toFixed(0)}% to ${(adjustedMasteryThreshold * 100).toFixed(0)}%`);
    }
  }

  return { adjustedMasteryThreshold, timeBasedEscapeHatch };
}

// Helper function to process and enrich tag data
function processAndEnrichTags(masteryData, tierTags, tagRelationships, masteryThresholds) {
  return masteryData
    .filter((tag) => tierTags.includes(tag.tag) && tag.total_attempts > 0)
    .map((tag) => {
      const successRate = calculateSuccessRate(tag.successful_attempts, tag.total_attempts);

      // Use tag-specific mastery threshold from tag_relationships, with time-based escape hatch
      const baseMasteryThreshold = masteryThresholds[tag.tag] || 0.8;
      const { adjustedMasteryThreshold, timeBasedEscapeHatch } = applyTimeBasedEscapeHatch(tag, baseMasteryThreshold);

      return {
        ...tag,
        successRate,
        adjustedMasteryThreshold,
        timeBasedEscapeHatch,
        learningVelocity: calculateLearningVelocity(tag),
        relationshipScore: calculateRelationshipScore(tag.tag, masteryData, tagRelationships, masteryThresholds),
      };
    });
}

// Helper function to handle graduation logic
async function _handleGraduation(masteredTags, tierTags, masteryData, db, masteryStore) {
  // 🎓 Graduate when most of focus window is mastered (4 out of 5 tags)
  if (masteredTags.length >= 4) {
    logger.info(`🎓 ${masteredTags.length} tags mastered, graduating to new focus set...`);

    // Get unstarted tags for fresh learning
    const unstartedTags = tierTags.filter(
      (tag) => !masteryData.some((m) => m.tag === tag)
    );

    if (unstartedTags.length > 0) {
      const newFocusTags = await getHighlyRelatedTags(
        db,
        masteredTags.map((t) => t.tag),
        unstartedTags,
        5
      );

      logger.info(`🎓 Graduating to new focus tags: ${newFocusTags.join(", ")}`);

      // Initialize new focus tags in mastery data
      await Promise.all(
        newFocusTags.map((newTag) => {
          return new Promise((resolve, reject) => {
            const putRequest = masteryStore.put({
              tag: newTag,
              total_attempts: 0,
              successful_attempts: 0,
              decay_score: 1,
              mastered: false,
            });
            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(putRequest.error);
          });
        })
      );

      // 🔄 Reset tagIndex for new focus window
      await resetTagIndexForNewWindow();

      // 📝 Update user settings with new focus areas
      try {
        const settings = await StorageService.getSettings();
        const updatedSettings = {
          ...settings,
          focusAreas: newFocusTags.slice(0, 3), // Limit to 3 as per UI convention
        };
        await StorageService.setSettings(updatedSettings);
        logger.info(`📝 Updated user focus areas settings with graduated tags: ${newFocusTags.slice(0, 3).join(', ')}`);
      } catch (error) {
        logger.error('❌ Failed to update focus areas settings after graduation:', error);
        // Don't fail the graduation just because settings update failed
      }

      return newFocusTags;
    }
  }
  return null;
}

// Helper function to sort and select focus tags
function sortAndSelectFocusTags(unmasteredTags) {
  // Sort by intelligent criteria
  const sortedTags = unmasteredTags.sort((a, b) => {
    // Primary: Focus on tags with moderate success rate (learning opportunity)
    const aOptimalLearning = getOptimalLearningScore(a.successRate, a.total_attempts);
    const bOptimalLearning = getOptimalLearningScore(b.successRate, b.total_attempts);

    if (Math.abs(aOptimalLearning - bOptimalLearning) > 0.1) {
      return bOptimalLearning - aOptimalLearning;
    }

    // Secondary: Learning velocity (improvement potential)
    if (Math.abs(a.learningVelocity - b.learningVelocity) > 0.1) {
      return b.learningVelocity - a.learningVelocity;
    }

    // Tertiary: Relationship score (connected learning)
    return b.relationshipScore - a.relationshipScore;
  });

  // Select top focus tags with strategic distribution
  const focusTags = [];
  const maxFocusTags = 3; // Limit to prevent overwhelming user

  for (const tag of sortedTags) {
    if (focusTags.length >= maxFocusTags) break;

    // Ensure diversity in difficulty/success rates
    const hasConflictingFocus = focusTags.some(
      (existing) => Math.abs(existing.successRate - tag.successRate) < 0.2
    );

    if (!hasConflictingFocus || focusTags.length === 0) {
      focusTags.push(tag);
    }
  }

  const selectedTags = focusTags.map((tag) => tag.tag);

  // 🛡️ SAFETY NET: Never return empty focus tags
  if (selectedTags.length === 0) {
    logger.warn("⚠️ sortAndSelectFocusTags returned empty, using fallback tags");
    return ["array", "hash table", "string"].slice(0, 1); // Onboarding-safe fallback
  }

  return selectedTags;
}

async function getIntelligentFocusTags(masteryData, tierTags) {
  logger.info("🧠 Selecting intelligent focus tags...");
  const db = await openDB();

  // Get tag relationships for intelligent expansion
  const tagRelationshipsData = await new Promise((resolve, reject) => {
    const tx = db.transaction("tag_relationships", "readonly");
    const store = tx.objectStore("tag_relationships");
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  const tagRelationships = tagRelationshipsData.reduce((acc, item) => {
    // Convert array format to object for consumer compatibility
    acc[item.id] = item.related_tags.reduce((tagObj, relation) => {
      tagObj[relation.tag] = relation.strength;
      return tagObj;
    }, {});
    return acc;
  }, {});

  // Create mastery threshold lookup from tag_relationships data
  const masteryThresholds = tagRelationshipsData.reduce((acc, item) => {
    acc[item.id] = item.mastery_threshold || 0.8; // Fallback to 80% if not set
    return acc;
  }, {});

  // Filter and process tags in current tier with time-based escape hatch logic
  const allRelevantTags = processAndEnrichTags(masteryData, tierTags, tagRelationships, masteryThresholds);

  // Split into mastered and unmastered using adjusted thresholds
  const unmasteredTags = allRelevantTags.filter(
    (tag) => tag.successRate < tag.adjustedMasteryThreshold
  );
  const _masteredTags = allRelevantTags.filter(
    (tag) => tag.successRate >= tag.adjustedMasteryThreshold
  );

  // 🎓 Skip graduation logic when using readonly transaction (Focus Coordination Service handles this)
  // Graduation logic is now handled by Focus Coordination Service through weighted integration

  const selectedTags = sortAndSelectFocusTags(unmasteredTags);
  logger.info("🧠 Selected intelligent focus tags:", selectedTags);

  // 🛡️ SAFETY NET: Ensure we always have focus tags
  if (!selectedTags || selectedTags.length === 0) {
    logger.warn("⚠️ getIntelligentFocusTags failed, falling back to tier tags");
    // Fall back to first available tier tags
    const fallbackTags = tierTags.slice(0, 3);
    return fallbackTags.length > 0 ? fallbackTags : ["array"];
  }

  return selectedTags;
}

/**
 * Calculates learning velocity based on recent performance trends
 * @param {object} tagData - Tag mastery data
 * @returns {number} Learning velocity score
 */
function calculateLearningVelocity(tagData) {
  // Defensive programming: Handle undefined or invalid tagData
  if (!tagData || typeof tagData !== 'object') {
    return 0.1; // Default low velocity for invalid data
  }

  // Simple velocity calculation based on attempts and success rate
  const attempts = tagData.total_attempts || 0;
  const successfulAttempts = tagData.successful_attempts || 0;
  const successRate = attempts > 0 ? successfulAttempts / attempts : 0;

  // Higher velocity for tags with moderate attempts and growing success
  if (attempts < 3) return 0.3; // Low velocity for new tags
  if (attempts >= 8) return 0.2; // Lower velocity for well-practiced tags

  // Optimal velocity in middle range with decent success rate
  return successRate * (1 - Math.abs(attempts - 5) / 5);
}

/**
 * Calculates relationship score based on connected mastered tags
 * @param {string} tag - The tag to calculate score for
 * @param {array} masteryData - All mastery data
 * @param {object} tagRelationships - Tag relationship data
 * @returns {number} Relationship score
 */
function calculateRelationshipScore(tag, masteryData, tagRelationships, masteryThresholds = {}) {
  const relationships = tagRelationships[tag] || {};

  // Defensive programming: Handle invalid inputs
  if (!Array.isArray(masteryData) || !tagRelationships) {
    return 0;
  }

  // Get mastered tags using tag-specific mastery thresholds
  const masteredTags = masteryData
    .filter((t) => {
      // Handle undefined/null objects and use snake_case field names
      if (!t || typeof t !== 'object') return false;
      const totalAttempts = t.total_attempts || 0;
      const successfulAttempts = t.successful_attempts || 0;
      const threshold = masteryThresholds[t.tag] || 0.8;
      return totalAttempts > 0 && successfulAttempts / totalAttempts >= threshold;
    })
    .map((t) => t.tag);

  // Calculate relationship strength to mastered tags
  let relationshipScore = 0;
  for (const masteredTag of masteredTags) {
    const weight = relationships[masteredTag] || 0;
    relationshipScore += weight;
  }

  // Normalize by number of relationships
  const totalRelationships = Object.keys(relationships).length;
  return totalRelationships > 0 ? relationshipScore / totalRelationships : 0;
}

/**
 * Calculates optimal learning score based on success rate and attempts
 * @param {number} successRate - Current success rate
 * @param {number} attempts - Total attempts
 * @returns {number} Optimal learning score
 */
function getOptimalLearningScore(successRate, attempts) {
  // Optimal learning zone: 40-70% success rate with 3-8 attempts
  const optimalSuccessRate = 0.55; // Sweet spot for learning
  const optimalAttempts = 5;

  const successRateScore = 1 - Math.abs(successRate - optimalSuccessRate) / 0.6;
  const attemptsScore = 1 - Math.abs(attempts - optimalAttempts) / 10;

  return (successRateScore + attemptsScore) / 2;
}

/**
 * Resets tag_index to 0 when a new focus window is created
 * @returns {Promise<void>}
 */
async function resetTagIndexForNewWindow() {
  const sessionStateKey = "session_state";
  const sessionState = await StorageService.getSessionState(sessionStateKey);

  if (sessionState) {
    sessionState.tag_index = 0; // Reset to start of new focus window
    await StorageService.setSessionState(sessionStateKey, sessionState);
    logger.info("🔄 Reset tag_index to 0 for new focus window");
  }
}

/**
 * Checks if user focus areas need to be updated due to mastery graduation
 * @returns {Promise<Object>} Status of focus areas and suggested updates
 */
async function checkFocusAreasGraduation() {
  try {
    const settings = await StorageService.getSettings();
    const userFocusAreas = settings.focusAreas || [];
    
    if (userFocusAreas.length === 0) {
      return { needsUpdate: false, masteredTags: [], suggestions: [] };
    }

    const { masteredTags, allTagsInCurrentTier, masteryData } = await getCurrentLearningState();
    
    // Check which focus areas have been mastered
    const masteredFocusAreas = userFocusAreas.filter(tag => 
      masteredTags.includes(tag)
    );

    // Get tag-specific thresholds for near-mastery calculation
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

    // Check if any focus areas are close to mastery (using tag-specific thresholds)
    const nearMasteryFocusAreas = userFocusAreas.filter(tag => {
      const tagData = masteryData.find(m => m.tag === tag);
      if (!tagData || tagData.total_attempts === 0) return false;
      const successRate = tagData.successful_attempts / tagData.total_attempts;
      const threshold = masteryThresholds[tag] || 0.8;
      return successRate >= threshold && !masteredTags.includes(tag);
    });

    // Suggest new focus areas from current tier
    const availableForFocus = allTagsInCurrentTier.filter(tag => 
      !masteredTags.includes(tag) && 
      !userFocusAreas.includes(tag)
    );

    const suggestions = availableForFocus.slice(0, 3); // Suggest up to 3 alternatives

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
 * @returns {Promise<Object>} Updated focus areas and graduation report
 */
async function graduateFocusAreas() {
  try {
    const graduationStatus = await checkFocusAreasGraduation();
    
    if (!graduationStatus.needsUpdate) {
      return { updated: false, report: graduationStatus };
    }

    const settings = await StorageService.getSettings();
    const currentFocusAreas = settings.focusAreas || [];
    
    // Remove mastered tags from focus areas
    const updatedFocusAreas = currentFocusAreas.filter(tag => 
      !graduationStatus.masteredTags.includes(tag)
    );

    // Auto-add suggestions if we have space (max 3 total)
    const spacesAvailable = 3 - updatedFocusAreas.length;
    if (spacesAvailable > 0 && graduationStatus.suggestions.length > 0) {
      const autoAddTags = graduationStatus.suggestions.slice(0, spacesAvailable);
      updatedFocusAreas.push(...autoAddTags);
      logger.info(`🔄 Auto-added focus areas: ${autoAddTags.join(', ')}`);
    }

    // Save updated settings
    const updatedSettings = {
      ...settings,
      focusAreas: updatedFocusAreas,
    };
    await StorageService.setSettings(updatedSettings);

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


/**
 * Gets available tags for focus area selection with tier-based previews
 * @param {string} userId - User identifier (for future use)
 * @returns {Promise<Object>} Available tags with tier access information
 */
async function getAvailableTagsForFocus(userId) {
  try {
    logger.info("🔍 TAGSERVICE: getAvailableTagsForFocus called with userId:", userId);
    
    // Get current learning state - this already has most of what we need!
    const learningState = await getCurrentLearningState();
    const settings = await StorageService.getSettings();
    
    // Check onboarding status using same logic as session generation
    const sessionStateKey = `sessionState_${userId}`;
    const sessionState = (await StorageService.migrateSessionStateToIndexedDB()) ||
      (await StorageService.getSessionState(sessionStateKey)) || {
        num_sessions_completed: 0
      };
    const isOnboarding = SessionLimits.isOnboarding(sessionState);
    logger.info(`🔰 Onboarding status: ${isOnboarding} (sessions completed: ${sessionState.num_sessions_completed})`);

    const currentTier = learningState?.currentTier || "Core Concept";
    const systemSelectedTags = learningState?.focusTags || [];
    const currentTierTags = learningState?.allTagsInCurrentTier || [];
    const userOverrideTags = settings.focusAreas || [];

    // Create simple tag structure - current tier tags are selectable, add some preview tags
    const tags = [
      // Current tier tags (selectable)
      ...currentTierTags.slice(0, 10).map(tagId => ({
        tagId,
        name: tagId.charAt(0).toUpperCase() + tagId.slice(1).replace(/[-_]/g, " "),
        tier: "core",
        selectable: true,
        reason: "current-tier"
      })),
      // Add some preview tags (not selectable)
      ...[
        { tagId: "two-pointers", name: "Two Pointers", tier: "fundamental", selectable: false, reason: "preview-locked" },
        { tagId: "sliding-window", name: "Sliding Window", tier: "fundamental", selectable: false, reason: "preview-locked" },
        { tagId: "binary-search", name: "Binary Search", tier: "fundamental", selectable: false, reason: "preview-locked" }
      ]
    ];

    // Apply onboarding restrictions to caps and active tags
    const onboardingCaps = isOnboarding 
      ? { core: 1, fundamental: 3, advanced: 3 }
      : { core: Infinity, fundamental: 3, advanced: 3 };
    
    // Limit active session tags during onboarding (using centralized config)
    const maxFocusTags = SessionLimits.getMaxFocusTags(sessionState);
    let effectiveActiveSessionTags;
    if (userOverrideTags.length > 0) {
      effectiveActiveSessionTags = userOverrideTags.slice(0, maxFocusTags);
    } else {
      effectiveActiveSessionTags = systemSelectedTags.slice(0, maxFocusTags);
    }
    
    logger.info(`🔰 Focus areas limit: ${isOnboarding ? '1 (onboarding)' : '3+ (post-onboarding)'}`);
    logger.info(`🔰 Effective active session tags: [${effectiveActiveSessionTags.join(', ')}]`);

    return {
      access: { core: "confirmed", fundamental: "none", advanced: "none" },
      caps: onboardingCaps,
      tags,
      starterCore: [],
      currentTier,
      systemSelectedTags,
      userOverrideTags,
      activeSessionTags: effectiveActiveSessionTags,
      isOnboarding, // Add onboarding status for UI feedback
    };

  } catch (error) {
    logger.error("Error in getAvailableTagsForFocus:", error);
    // Fallback to current behavior with conservative onboarding assumption
    const learningState = await getCurrentLearningState();
    const isOnboardingFallback = true; // Conservative assumption for error case
    
    return {
      access: { core: "confirmed", fundamental: "none", advanced: "none" },
      caps: { core: isOnboardingFallback ? 1 : 2, fundamental: 3, advanced: 3 },
      tags: learningState.allTagsInCurrentTier.map(tag => ({
        tagId: tag,
        name: tag.charAt(0).toUpperCase() + tag.slice(1).replace(/[-_]/g, " "),
        tier: learningState.currentTier.toLowerCase(),
        selectable: true,
        reason: "current-tier"
      })),
      starterCore: learningState.allTagsInCurrentTier.slice(0, 8),
      currentTier: learningState.currentTier,
      systemSelectedTags: learningState.focusTags || [],
      userOverrideTags: [],
      activeSessionTags: (learningState.focusTags || []).slice(0, isOnboardingFallback ? 1 : 3),
      isOnboarding: isOnboardingFallback,
    };
  }
}

// Export TagService after all functions are defined
export const TagService = {
  getCurrentTier,
  getCurrentLearningState,
  checkFocusAreasGraduation,
  graduateFocusAreas,
  getAvailableTagsForFocus,
};
