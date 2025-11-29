// eslint-disable-next-line no-restricted-imports
import { dbHelper } from "../db/index.js";
import { getNextFiveTagsFromNextTier } from "../db/tag_relationships.js";
import { getSessionPerformance } from "../db/sessions.js";
import { StorageService } from "./storageService.js";
import SessionLimits from "../utils/sessionLimits.js";
import logger from "../utils/logger.js";
import {
  calculateRelationshipScore,
  processAndEnrichTags,
  getStableSystemPool,
  checkFocusAreasGraduation as checkFocusAreasGraduationHelper,
  graduateFocusAreas as graduateFocusAreasHelper,
} from "./tagServicesHelpers.js";

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
 * Gets candidate tags for system pool
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
  const systemPool = await getStableSystemPool(masteryData, tierTags, currentTier, userFocusAreas, getCandidatesForSystemPool);

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

// Wrapper functions for graduation helpers
function checkFocusAreasGraduation() {
  return checkFocusAreasGraduationHelper(getCurrentLearningState, openDB);
}

function graduateFocusAreas() {
  return graduateFocusAreasHelper(checkFocusAreasGraduation);
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
