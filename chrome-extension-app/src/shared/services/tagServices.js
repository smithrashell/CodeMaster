// eslint-disable-next-line no-restricted-imports
import { dbHelper } from "../db/index.js";
import {
  getHighlyRelatedTags,
  getNextFiveTagsFromNextTier,
} from "../db/entities/tag_relationships.js";
import { getSessionPerformance } from "../db/entities/sessions.js";
import { StorageService } from "./storage/storageService.js";
import SessionLimits from "../utils/sessionLimits.js";
import logger from "../utils/logging/logger.js";
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

  // Select tags with highest TOTAL problem count (Easy + Medium + Hard)
  // This ensures beginners start with well-covered topics (array, hash table, string, etc.)
  const topTags = tagRelationships
    .filter((entry) => entry.classification === "Core Concept") // Only Core Concept tags for onboarding
    .map((entry) => {
      const dist = entry.difficulty_distribution || { easy: 0, medium: 0, hard: 0 };
      const totalProblems = dist.easy + dist.medium + dist.hard;
      return { tag: entry.id, totalProblems, easyProblems: dist.easy };
    })
    .sort((a, b) => {
      // Primary: Total problem count (more problems = better coverage)
      if (b.totalProblems !== a.totalProblems) {
        return b.totalProblems - a.totalProblems;
      }
      // Secondary: Easy problem count (for true beginners)
      return b.easyProblems - a.easyProblems;
    })
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

// NOTE: seedNewTagsIfNeeded() removed - tags now discovered organically through problem attempts
// No longer pre-seeding tags with 0 attempts into tag_mastery
// Tags are added to tag_mastery ONLY when first attempted

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

  const _masteryThresholds = allTagRelationships.reduce((acc, item) => {
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

    // Use actual 'mastered' field from database which considers both success rate AND min_attempts_required
    const masteredTags = masteryData
      .filter(
        (tag) =>
          tierTags.includes(tag.tag) &&
          tag.mastered === true
      )
      .map((tag) => tag.tag);

    const unmasteredTags = await getIntelligentFocusTags(
      masteryData,
      tierTags,
      db
    );

    const masteryThreshold = Math.ceil(tierTags.length * 0.8);
    const isTierMastered = masteredTags.length >= masteryThreshold;

    const { allowTierAdvancement, tierEscapeHatchActivated: _tierEscapeHatchActivated } = await checkTierProgression(tier, masteredTags, tierTags, isTierMastered);

    if (!allowTierAdvancement) {
      logger.info(
        `✅ User is in ${tier}, working on ${unmasteredTags.length} tags.`
      );

      // 🛡️ CRITICAL: Focus tags should never be empty
      if (!unmasteredTags || unmasteredTags.length === 0) {
        if (tierTags.length > 0) {
          // Use tier tags if available
          logger.warn(`⚠️ No unmastered tags, using tier tags as fallback`);
          const safeFocusTags = tierTags.slice(0, 3);

          return {
            classification: tier,
            masteredTags,
            allTagsInCurrentTier: tierTags,
            focusTags: safeFocusTags,
            masteryData,
            tierEscapeHatchActivated: false,
          };
        }

        // Complete failure - no tags available
        logger.error("❌ CRITICAL: No focus tags available!");
        logger.error("Context:", { tier, masteredTagsCount: masteredTags.length, tierTagsCount: tierTags.length });
        throw new Error("Unable to determine focus tags - no unmastered or tier tags available. This indicates a data integrity issue.");
      }

      const safeFocusTags = unmasteredTags;

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

    // ✅ Tier advancement allowed - continue to next tier
    // No pre-seeding needed - tags will be added organically through problem attempts
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
function processAndEnrichTags(masteryData, tierTags, tagRelationships, masteryThresholds, tagRelationshipsData) {
  return masteryData
    .filter((tag) => tierTags.includes(tag.tag) && tag.total_attempts > 0)
    .map((tag) => {
      const successRate = calculateSuccessRate(tag.successful_attempts, tag.total_attempts);

      // Use tag-specific mastery threshold from tag_relationships, with time-based escape hatch
      const baseMasteryThreshold = masteryThresholds[tag.tag] || 0.8;
      const { adjustedMasteryThreshold, timeBasedEscapeHatch } = applyTimeBasedEscapeHatch(tag, baseMasteryThreshold);

      // Get problem count from tag_relationships for coverage-based tiebreaking
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
        totalProblems, // Add problem count for tiebreaking
      };
    });
}

// Helper function to handle graduation logic
// NOTE: Graduation no longer pre-seeds tags into tag_mastery
// Tags will be discovered organically through problem attempts
// This function is kept for potential future graduation ceremony logic
async function _handleGraduation(masteredTags, tierTags, masteryData, db, _masteryStore) {
  // 🎓 Graduate when most of focus window is mastered (4 out of 5 tags)
  if (masteredTags.length >= 4) {
    logger.info(`🎓 ${masteredTags.length} tags mastered, ready for new challenges...`);

    // Get unstarted tags for fresh learning
    const unstartedTags = tierTags.filter(
      (tag) => !masteryData.some((m) => m.tag === tag)
    );

    if (unstartedTags.length > 0) {
      // Identify recommended tags for next focus (but don't pre-seed them)
      const recommendedTags = await getHighlyRelatedTags(
        db,
        masteredTags.map((t) => t.tag),
        unstartedTags,
        5
      );

      logger.info(`🎓 Recommended new focus tags: ${recommendedTags.join(", ")} (will be added on first attempt)`);

      // 🔄 Reset tagIndex for new focus window
      await resetTagIndexForNewWindow();

      // 📝 Update user settings with recommended focus areas
      // These are suggestions - tags won't enter tag_mastery until attempted
      try {
        const settings = await StorageService.getSettings();
        const updatedSettings = {
          ...settings,
          focusAreas: recommendedTags.slice(0, 3), // Limit to 3 as per UI convention
        };
        await StorageService.setSettings(updatedSettings);
        logger.info(`📝 Updated user focus areas settings with recommended tags: ${recommendedTags.slice(0, 3).join(', ')}`);
      } catch (error) {
        logger.error('❌ Failed to update focus areas settings after graduation:', error);
        // Don't fail the graduation just because settings update failed
      }

      return recommendedTags;
    }
  }
  return null;
}

// Helper function to sort and select focus tags
function sortAndSelectFocusTags(unmasteredTags, count = 5) {
  console.log('🔍 TAG SORTING DEBUG: Sorting', unmasteredTags.length, 'candidate tags');

  // Sort by intelligent criteria optimized for pattern recognition learning
  const sortedTags = unmasteredTags.sort((a, b) => {
    // Primary: Relationship score (pattern recognition - build interconnected knowledge)
    // Tags strongly related to already-attempted tags get highest priority
    if (Math.abs(a.relationshipScore - b.relationshipScore) > 0.05) {
      return b.relationshipScore - a.relationshipScore;
    }

    // Secondary: Attempt maturity (favor tags with more practice experience)
    // More attempts = better foundation for pattern recognition
    const aMaturity = Math.min(1, a.total_attempts / 8);
    const bMaturity = Math.min(1, b.total_attempts / 8);
    if (Math.abs(aMaturity - bMaturity) > 0.1) {
      return bMaturity - aMaturity;
    }

    // Tertiary: Optimal learning score (learning opportunity within established patterns)
    const aOptimalLearning = getOptimalLearningScore(a.successRate, a.total_attempts);
    const bOptimalLearning = getOptimalLearningScore(b.successRate, b.total_attempts);
    if (Math.abs(aOptimalLearning - bOptimalLearning) > 0.05) {
      return bOptimalLearning - aOptimalLearning;
    }

    // Quaternary: Problem count (coverage - more problems = more practice variety)
    // When all else is equal, prefer tags with more problem coverage
    return (b.totalProblems || 0) - (a.totalProblems || 0);
  });

  console.log('🔍 TAG SORTING DEBUG: Top 10 sorted tags:', sortedTags.slice(0, 10).map(t => ({
    tag: t.tag,
    relationshipScore: t.relationshipScore,
    attempts: t.total_attempts,
    totalProblems: t.totalProblems
  })));

  // Select top focus tags (multi-level sorting already handles prioritization)
  const maxFocusTags = count;
  const focusTags = sortedTags.slice(0, maxFocusTags);
  const selectedTags = focusTags.map((tag) => tag.tag);

  console.log('🔍 TAG SORTING DEBUG: Final selected tags after diversity filter:', selectedTags);

  // 🛡️ SAFETY NET: Never return empty focus tags
  if (selectedTags.length === 0) {
    logger.warn("⚠️ sortAndSelectFocusTags returned empty, using fallback tags");
    return ["array", "hash table", "string"].slice(0, 1); // Onboarding-safe fallback
  }

  return selectedTags;
}

/**
 * Gets stable system focus pool or creates new one
 * Pool persists across sessions until tags are mastered or tier changes
 * @param {Array} masteryData - User's tag mastery data
 * @param {Array} tierTags - All tags in current tier
 * @param {string} currentTier - Current tier name
 * @param {Array} excludeTags - Tags to exclude (user selections)
 * @returns {Promise<Array>} Stable pool of system-selected tags
 */
async function getStableSystemPool(masteryData, tierTags, currentTier, excludeTags) {
  const settings = await StorageService.getSettings();
  const existing = settings.systemFocusPool;

  // Need new pool? (tier change, first time, or corrupted)
  if (!existing || existing.tier !== currentTier || !Array.isArray(existing.tags)) {
    logger.info(`🔄 Creating new system focus pool for tier: ${currentTier}`);
    return await createSystemPool(masteryData, tierTags, currentTier, excludeTags);
  }

  // Maintain existing pool
  logger.info('✅ Maintaining existing system focus pool');
  return await maintainSystemPool(existing, masteryData, tierTags, currentTier, excludeTags);
}

/**
 * Creates a new stable system focus pool
 * Called on tier change or first session
 */
async function createSystemPool(masteryData, tierTags, currentTier, excludeTags) {
  const candidates = await getCandidatesForSystemPool(masteryData, tierTags, excludeTags);
  const poolSize = Math.min(5 - excludeTags.length, 5); // Max 5 total, accounting for user selections
  const selectedTags = sortAndSelectFocusTags(candidates, poolSize);

  // Save new pool
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
 * Removes mastered tags, refills empty slots
 */
async function maintainSystemPool(existing, masteryData, tierTags, currentTier, excludeTags) {
  const poolSize = Math.min(5 - excludeTags.length, 5);

  // Keep non-mastered tags
  const keptTags = existing.tags.filter(tag => {
    const tagData = masteryData.find(m => m.tag === tag);

    // Remove if mastered
    if (tagData?.mastered) {
      logger.info(`🎓 Graduated from system pool: ${tag} (mastered)`);
      return false;
    }

    // Keep everything else (attempted or unattempted)
    return true;
  });

  logger.info(`✅ Kept ${keptTags.length}/${existing.tags.length} tags from system pool`);

  // Refill if needed
  if (keptTags.length < poolSize) {
    const emptySlots = poolSize - keptTags.length;
    logger.info(`🔄 Refilling ${emptySlots} empty slots in system pool`);

    const candidates = await getCandidatesForSystemPool(
      masteryData,
      tierTags,
      [...excludeTags, ...keptTags] // Exclude user tags + existing pool
    );
    const newTags = sortAndSelectFocusTags(candidates, emptySlots);

    const updatedTags = [...keptTags, ...newTags];

    // Save updated pool
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
 * Gets candidate tags for system pool
 * Excludes user-selected tags and already-committed tags
 */
async function getCandidatesForSystemPool(masteryData, tierTags, excludedTags) {
  const db = await openDB();

  // Get tag relationships (existing logic from getIntelligentFocusTags)
  const tagRelationshipsData = await new Promise((resolve, reject) => {
    const tx = db.transaction("tag_relationships", "readonly");
    const store = tx.objectStore("tag_relationships");
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  const tagRelationships = tagRelationshipsData.reduce((acc, item) => {
    acc[item.id] = item.related_tags.reduce((tagObj, relation) => {
      tagObj[relation.tag] = relation.strength;
      return tagObj;
    }, {});
    return acc;
  }, {});

  const masteryThresholds = tagRelationshipsData.reduce((acc, item) => {
    acc[item.id] = item.mastery_threshold || 0.8;
    return acc;
  }, {});

  // Process attempted tags
  const attemptedTags = processAndEnrichTags(
    masteryData,
    tierTags,
    tagRelationships,
    masteryThresholds,
    tagRelationshipsData
  );

  const unmasteredAttemptedTags = attemptedTags.filter(
    (tag) => !tag.mastered && !excludedTags.includes(tag.tag)
  );

  // Unattempted tags
  const unattemptedTagNames = tierTags.filter(
    (tag) => !masteryData.some((m) => m.tag === tag) && !excludedTags.includes(tag)
  );

  const unattemptedTagsEnriched = unattemptedTagNames.map((tagName) => {
    const relationshipScore = calculateRelationshipScore(
      tagName,
      masteryData,
      tagRelationships,
      masteryThresholds
    );

    const tagRelationship = tagRelationshipsData.find(tr => tr.id === tagName);
    const dist = tagRelationship?.difficulty_distribution || { easy: 0, medium: 0, hard: 0 };
    const totalProblems = dist.easy + dist.medium + dist.hard;

    return {
      tag: tagName,
      total_attempts: 0,
      successful_attempts: 0,
      successRate: 0,
      adjustedMasteryThreshold: masteryThresholds[tagName] || 0.8,
      timeBasedEscapeHatch: false,
      learningVelocity: 0.5,
      relationshipScore,
      totalProblems
    };
  });

  return [...unmasteredAttemptedTags, ...unattemptedTagsEnriched];
}

async function getIntelligentFocusTags(masteryData, tierTags) {
  logger.info("🧠 Selecting intelligent focus tags with stable pool...");

  // Determine current tier from the tierTags being passed in
  // Lookup the tier classification from the first tag in tierTags
  let currentTier = "Core Concept"; // Default fallback

  if (tierTags && tierTags.length > 0) {
    try {
      const db = await openDB();
      const tx = db.transaction(["tag_relationships"], "readonly");
      const relationshipsStore = tx.objectStore("tag_relationships");

      const firstTagRelation = await new Promise((resolve, reject) => {
        const req = relationshipsStore.get(tierTags[0]);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      if (firstTagRelation && firstTagRelation.classification) {
        currentTier = firstTagRelation.classification;
        logger.info(`✅ Determined current tier: ${currentTier}`);
      }
    } catch (error) {
      logger.warn(`⚠️ Could not determine tier, using default: ${currentTier}`, error);
    }
  }

  // Get user manual selections
  const settings = await StorageService.getSettings();
  const userFocusAreas = settings.focusAreas || [];

  logger.info(`📊 User has ${userFocusAreas.length} manual focus areas selected`);

  // CASE 1: User has 3+ manual selections → use user choices only
  if (userFocusAreas.length >= 3) {
    logger.info('🎯 Using full user focus areas (3+ tags selected)');
    return userFocusAreas.slice(0, 5); // Max 5, respects FOCUS_CONFIG.limits.totalTags
  }

  // CASE 2 & 3: Get stable system pool
  const systemPool = await getStableSystemPool(masteryData, tierTags, currentTier, userFocusAreas);

  // CASE 2: User has 1-2 manual selections → blend user + system pool
  if (userFocusAreas.length > 0) {
    logger.info('🎯 Blending user selections with stable system pool');
    const remainingSlots = 5 - userFocusAreas.length;
    const blendedTags = [...userFocusAreas, ...systemPool.slice(0, remainingSlots)];
    logger.info(`✅ Final focus tags (user + system): ${blendedTags.join(', ')}`);
    return blendedTags;
  }

  // CASE 3: User has NO manual selections → use stable system pool only
  logger.info('🎯 Using stable system pool (no user selections)');
  logger.info(`✅ Final focus tags (system only): ${systemPool.join(', ')}`);

  // 🛡️ CRITICAL: System pool should never be empty in normal operation
  if (!systemPool || systemPool.length === 0) {
    logger.error("❌ CRITICAL: System pool generation failed!");
    logger.error("This indicates a serious data integrity issue");
    logger.error("Context:", { tierTags, currentTier, masteryDataCount: masteryData?.length });
    throw new Error("Unable to generate focus tags - system pool is empty. This indicates a data integrity issue.");
  }

  return systemPool;
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
 * Calculates proficiency-based weight for a tag based on success rate and attempt maturity
 * @param {object} tagData - Tag mastery data
 * @param {number} masteryThreshold - Tag-specific mastery threshold
 * @returns {number} Weight between 0.1 and 1.0
 */
function calculateTagWeight(tagData, masteryThreshold = 0.8) {
  if (!tagData || typeof tagData !== 'object') {
    return 0;
  }

  const totalAttempts = tagData.total_attempts || 0;
  const successfulAttempts = tagData.successful_attempts || 0;

  if (totalAttempts === 0) {
    return 0; // No attempts = no weight
  }

  const successRate = successfulAttempts / totalAttempts;

  // Attempt maturity: caps at 8 attempts for full maturity
  const attemptMaturity = Math.min(1, totalAttempts / 8);

  // Proficiency weight tiers based on success rate:
  // - 80%+ (mastered): 1.0 weight - full influence
  // - 60-80% (strong foundation): 0.6 weight - good influence
  // - 40-60% (learning): 0.3 weight - some influence
  // - <40% (struggling): 0.1 weight - minimal influence
  let proficiencyWeight;
  if (successRate >= masteryThreshold) {
    proficiencyWeight = 1.0; // Mastered
  } else if (successRate >= 0.6) {
    proficiencyWeight = 0.6; // Strong foundation
  } else if (successRate >= 0.4) {
    proficiencyWeight = 0.3; // Learning
  } else {
    proficiencyWeight = 0.1; // Struggling
  }

  return proficiencyWeight * attemptMaturity;
}

/**
 * Calculates relationship score based on weighted proficiency of related tags
 * Uses graduated weighting instead of binary mastered/unmastered to support
 * pattern recognition and interconnected learning even with partial mastery.
 * @param {string} tag - The tag to calculate score for
 * @param {array} masteryData - All mastery data
 * @param {object} tagRelationships - Tag relationship data
 * @param {object} masteryThresholds - Tag-specific mastery thresholds
 * @returns {number} Relationship score
 */
function calculateRelationshipScore(tag, masteryData, tagRelationships, masteryThresholds = {}) {
  const relationships = tagRelationships[tag] || {};

  // Defensive programming: Handle invalid inputs
  if (!Array.isArray(masteryData) || !tagRelationships) {
    return 0;
  }

  // Calculate weighted relationship score using ALL attempted tags
  // Tags with higher success rates contribute more to the recommendation
  let relationshipScore = 0;

  for (const attemptedTag of masteryData) {
    if (!attemptedTag || typeof attemptedTag !== 'object') continue;

    const totalAttempts = attemptedTag.total_attempts || 0;
    if (totalAttempts === 0) continue; // Skip unattempted tags

    const tagName = attemptedTag.tag;
    const relationshipStrength = relationships[tagName] || 0;

    if (relationshipStrength === 0) continue; // Skip unrelated tags

    // Weight this tag's contribution by proficiency level
    const threshold = masteryThresholds[tagName] || 0.8;
    const tagWeight = calculateTagWeight(attemptedTag, threshold);

    // Contribution = relationship strength × proficiency weight
    relationshipScore += relationshipStrength * tagWeight;
  }

  // Normalize by number of relationships to keep scores comparable
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

    // PURE SYSTEM RECOMMENDATIONS - from stable system pool (algorithm only, no user influence)
    const pureSystemTags = settings.systemFocusPool?.tags || [];
    logger.info(`🎯 Pure system recommendations (algorithm only): [${pureSystemTags.join(', ')}]`);

    // ACTIVE FOCUS TAGS - what sessions actually use (may include user blending)
    const activeFocusTags = learningState?.focusTags || [];
    logger.info(`🎯 Active focus tags (may include user blending): [${activeFocusTags.join(', ')}]`);

    const _currentTierTags = learningState?.allTagsInCurrentTier || [];
    const userOverrideTags = settings.focusAreas || [];

    // Get ALL tag classifications from tag_relationships
    const db = await openDB();
    const tagRelationships = await new Promise((resolve, reject) => {
      const tx = db.transaction("tag_relationships", "readonly");
      const store = tx.objectStore("tag_relationships");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    // Map tag classification to tier number
    const classificationToTier = {
      "Core Concept": 0,
      "Fundamental Technique": 1,
      "Advanced Technique": 2
    };

    // Create tags list with proper tier classification from database
    // Use Map to deduplicate by tagId (defensive programming in case db has duplicates)
    const tagsMap = new Map();
    tagRelationships.forEach(entry => {
      if (!tagsMap.has(entry.id)) {
        tagsMap.set(entry.id, {
          tagId: entry.id,
          tag: entry.id,
          name: entry.id.charAt(0).toUpperCase() + entry.id.slice(1).replace(/[-_]/g, " "),
          tier: classificationToTier[entry.classification] ?? 0,
          classification: entry.classification,
          selectable: true, // All tags are selectable now (single-tier enforced in UI)
          reason: "available"
        });
      }
    });
    const tags = Array.from(tagsMap.values());

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
      effectiveActiveSessionTags = activeFocusTags.slice(0, maxFocusTags);
    }

    logger.info(`🔰 Focus areas limit: ${isOnboarding ? '1 (onboarding)' : '3+ (post-onboarding)'}`);
    logger.info(`🔰 Effective active session tags: [${effectiveActiveSessionTags.join(', ')}]`);

    return {
      access: { core: "confirmed", fundamental: "none", advanced: "none" },
      caps: onboardingCaps,
      tags,
      starterCore: [],
      currentTier,
      systemSelectedTags: pureSystemTags, // Pure algorithm picks, no user influence
      userOverrideTags,
      activeSessionTags: effectiveActiveSessionTags, // What will actually be used in sessions
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
