import { dbHelper } from "../db/index.js";
import { getHighlyRelatedTags, getNextFiveTagsFromNextTier } from "../db/tag_relationships.js";
import { getSessionPerformance } from "../db/sessions.js";

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
    const tagsinCurrentTier = allTags.filter(tag => tag.classification === "Core Concept").map(tag => tag.id);

    console.log("👶 Onboarding with top weighted tags:", topTags);
   console.log("allTags", allTags)
   console.log("allTagsInCurrentTier", allTags.filter(tag => tag.classification === "Core Concept"))
    return {
      classification: "Core Concept",
      masteredTags: [],
      allTagsInCurrentTier: tagsinCurrentTier,
      focusTags: topTags,
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

    const unmasteredTags = masteryData
      .filter(
        tag =>
          tierTags.includes(tag.tag) &&
          tag.totalAttempts > 0 &&
          tag.successfulAttempts / tag.totalAttempts < 0.8
      )
      .sort(
        (a, b) =>
          b.successfulAttempts / b.totalAttempts -
          a.successfulAttempts / a.totalAttempts
      )
      .map(tag => tag.tag)
      .slice(0, 5);

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
