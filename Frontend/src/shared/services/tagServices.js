import { dbHelper } from "../db/index.js";
import { getHighlyRelatedTags, getNextFiveTagsFromNextTier } from "../db/tag_relationships.js";
import { getSessionPerformance } from "../db/sessions.js";
import { StorageService } from "./storageService.js";

const openDB = dbHelper.openDB;

export const TagService = {
  getCurrentTier,
  getCurrentLearningState
};

async function getCurrentTier() {
  const db = await openDB();
  const tx = db.transaction(["tag_mastery", "tag_relationships"], "readwrite");
  const masteryStore = tx.objectStore("tag_mastery");
  const relationshipsStore = tx.objectStore("tag_relationships");

  const masteryData = await new Promise((resolve, reject) => {
    const request = masteryStore.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  console.log("🔍 masteryData:", masteryData);

  // ✅ Onboarding fallback: No mastery data yet
  if (!masteryData || masteryData.length === 0) {
    const tagRelationships = await new Promise((resolve, reject) => {
      const tx = db.transaction("tag_relationships", "readonly");
      const store = tx.objectStore("tag_relationships");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    const topTags = tagRelationships
      .map(entry => {
        const totalWeight = Object.values(entry.relatedTags || {}).reduce((sum, w) => sum + w, 0);
        return { tag: entry.id, weight: totalWeight };
      })
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5)
      .map(entry => entry.tag);

    const allTags = tagRelationships.map(entry => entry);
    const tagsinCurrentTier = allTags
      .filter(tag => tag.classification === "Core Concept")
      .map(tag => tag.id);

    // 🛡️ Onboarding safety: Ensure we have focus tags and tier tags
    const safeFocusTags = topTags.length > 0 ? topTags : 
      (tagsinCurrentTier.length > 0 ? tagsinCurrentTier.slice(0, 3) : ["array", "hash table", "string"]);
    
    const safeAllTagsInCurrentTier = tagsinCurrentTier.length > 0 ? tagsinCurrentTier :
      ["array", "hash table", "string", "dynamic programming", "two pointers"];

    console.log("👶 Onboarding with focus tags:", safeFocusTags);
    console.log("👶 All tags in current tier:", safeAllTagsInCurrentTier);
    
    return {
      classification: "Core Concept",
      masteredTags: [],
      allTagsInCurrentTier: safeAllTagsInCurrentTier,
      focusTags: safeFocusTags,
      masteryData: []
    };


    
  }

  // ✅ Returning user logic
  const tiers = ["Core Concept", "Fundamental Technique", "Advanced Technique"];

  for (const tier of tiers) {
    const tierRequest = relationshipsStore.index("by_classification").getAll(tier);
    const tierTags = await new Promise((resolve, reject) => {
      tierRequest.onsuccess = () => resolve(tierRequest.result.map(t => t.id));
      tierRequest.onerror = () => reject(tierRequest.error);
    });

    const masteredTags = masteryData
      .filter(
        tag =>
          tierTags.includes(tag.tag) &&
          tag.totalAttempts > 0 &&
          tag.successfulAttempts / tag.totalAttempts >= 0.8
      )
      .map(tag => tag.tag);

    const unmasteredTags = await getIntelligentFocusTags(
      masteryData,
      tierTags,
      db
    );

    const masteryThreshold = Math.ceil(tierTags.length * 0.8);
    const isTierMastered = masteredTags.length >= masteryThreshold;

    if (!isTierMastered) {
      console.log(`✅ User is in ${tier}, working on ${unmasteredTags.length} tags.`);
      return {
        classification: tier,
        masteredTags,
        allTagsInCurrentTier: tierTags,
        focusTags: unmasteredTags,
        masteryData
      };
    }

    const missingTags = tierTags.filter(tag => !masteryData.some(m => m.tag === tag));

    if (unmasteredTags.length === 0 && missingTags.length > 0) {
      const newTags = await getHighlyRelatedTags(db, masteredTags, missingTags, 5);

      console.log(`🔹 Seeding ${newTags.length} new tags from ${tier} into tag_mastery`);

      await Promise.all(
        newTags.map(newTag => {
          return new Promise((resolve, reject) => {
            const putRequest = masteryStore.put({
              tag: newTag,
              totalAttempts: 0,
              successfulAttempts: 0,
              decayScore: 1,
              mastered: false
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
        masteryData
      };
    }
  }

  // ✅ All tiers mastered — advance
  console.log("🚀 All tiers mastered. Advancing to next tier...");
  return getNextFiveTagsFromNextTier(masteryData);
}

async function getCurrentLearningState() {
  const {
    classification,
    masteredTags,
    allTagsInCurrentTier,
    focusTags,
    masteryData
  } = await getCurrentTier();

  const sessionPerformance = await getSessionPerformance({allTagsInCurrentTier });
  console.log("tags", allTagsInCurrentTier)
  console.log(`📌 Tier: ${classification}`);
  console.log(`✅ Mastered Tags: ${masteredTags.join(", ")}`);
  console.log(`🔹 Focus Tags: ${focusTags.join(", ")}`);
  console.log(`🔹 Tags in Tier: ${allTagsInCurrentTier.join(", ")}`);

  return {
    currentTier: classification,
    masteredTags,
    allTagsInCurrentTier,
    focusTags,
    masteryData,
    sessionPerformance
  };
}

/**
 * Intelligently selects focus tags based on learning efficiency and relationships
 * @param {array} masteryData - User's tag mastery data
 * @param {array} tierTags - All tags in current tier
 * @param {object} db - Database connection
 * @returns {Promise<Array>} Intelligent focus tags
 */
async function getIntelligentFocusTags(masteryData, tierTags) {
  console.log("🧠 Selecting intelligent focus tags...");
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
    acc[item.id] = item.relatedTags || {};
    return acc;
  }, {});
  
  // Filter unmastered tags in current tier
  const unmasteredTags = masteryData
    .filter(tag => 
      tierTags.includes(tag.tag) && 
      tag.totalAttempts > 0 && 
      tag.successfulAttempts / tag.totalAttempts < 0.8
    )
    .map(tag => ({
      ...tag,
      successRate: tag.successfulAttempts / tag.totalAttempts,
      learningVelocity: calculateLearningVelocity(tag),
      relationshipScore: calculateRelationshipScore(tag.tag, masteryData, tagRelationships)
    }));

  // 🎓 Check if current focus tags are mastered and need graduation
  const currentFocusTags = masteryData.filter(tag => 
    tierTags.includes(tag.tag) && 
    tag.totalAttempts > 0 && 
    tag.successfulAttempts / tag.totalAttempts >= 0.8
  );

  // 🎓 Graduate when most of focus window is mastered (4 out of 5 tags)
  if (currentFocusTags.length >= 4) {
    console.log(`🎓 ${currentFocusTags.length} tags mastered, graduating to new focus set...`);
    
    // Get unstarted tags for fresh learning
    const unstartedTags = tierTags.filter(tag => 
      !masteryData.some(m => m.tag === tag)
    );
    
    if (unstartedTags.length > 0) {
      const newFocusTags = await getHighlyRelatedTags(
        db, 
        currentFocusTags.map(t => t.tag), 
        unstartedTags, 
        5
      );
      
      console.log(`🎓 Graduating to new focus tags: ${newFocusTags.join(', ')}`);
      
      // Initialize new focus tags in mastery data
      await Promise.all(
        newFocusTags.map(newTag => {
          return new Promise((resolve, reject) => {
            const putRequest = masteryStore.put({
              tag: newTag,
              totalAttempts: 0,
              successfulAttempts: 0,
              decayScore: 1,
              mastered: false
            });
            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(putRequest.error);
          });
        })
      );
      
      // 🔄 Reset tagIndex for new focus window
      await resetTagIndexForNewWindow();
      
      return newFocusTags;
    }
  }
  
  // Sort by intelligent criteria
  const sortedTags = unmasteredTags.sort((a, b) => {
    // Primary: Focus on tags with moderate success rate (learning opportunity)
    const aOptimalLearning = getOptimalLearningScore(a.successRate, a.totalAttempts);
    const bOptimalLearning = getOptimalLearningScore(b.successRate, b.totalAttempts);
    
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
    const hasConflictingFocus = focusTags.some(existing => 
      Math.abs(existing.successRate - tag.successRate) < 0.2
    );
    
    if (!hasConflictingFocus || focusTags.length === 0) {
      focusTags.push(tag);
    }
  }
  
  const selectedTags = focusTags.map(tag => tag.tag);
  console.log("🧠 Selected intelligent focus tags:", selectedTags);
  
  return selectedTags;
}

/**
 * Calculates learning velocity based on recent performance trends
 * @param {object} tagData - Tag mastery data
 * @returns {number} Learning velocity score
 */
function calculateLearningVelocity(tagData) {
  // Simple velocity calculation based on attempts and success rate
  const attempts = tagData.totalAttempts;
  const successRate = tagData.successfulAttempts / tagData.totalAttempts;
  
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
function calculateRelationshipScore(tag, masteryData, tagRelationships) {
  const relationships = tagRelationships[tag] || {};
  
  // Get mastered tags
  const masteredTags = masteryData
    .filter(t => t.totalAttempts > 0 && t.successfulAttempts / t.totalAttempts >= 0.8)
    .map(t => t.tag);
  
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
 * Resets tagIndex to 0 when a new focus window is created
 * @returns {Promise<void>}
 */
async function resetTagIndexForNewWindow() {
  const sessionStateKey = "session_state";
  const sessionState = await StorageService.getSessionState(sessionStateKey);
  
  if (sessionState) {
    sessionState.tagIndex = 0; // Reset to start of new focus window
    await StorageService.setSessionState(sessionStateKey, sessionState);
    console.log("🔄 Reset tagIndex to 0 for new focus window");
  }
}
