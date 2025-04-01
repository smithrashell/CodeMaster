import { dbHelper } from "../db/index.js";
import { getHighlyRelatedTags } from "../db/tag_mastery.js";
import { getNextFiveTagsFromNextTier } from "../db/tag_mastery.js";

import { getSessionPerformance } from "../db/sessions.js";





  const openDB = dbHelper.openDB


export const TagService = {
    getCurrentTier,
    getCurrentLearningState

};




async function getCurrentTier() {
  const db = await openDB();
  const tx = db.transaction(["tag_mastery", "tag_relationships"], "readwrite");
  const masteryStore = tx.objectStore("tag_mastery");
  const relationshipsStore = tx.objectStore("tag_relationships");

  // Get all attempted tags from tag_mastery
  const masteryRequest = masteryStore.getAll();
  const masteryData = await new Promise((resolve, reject) => {
    masteryRequest.onsuccess = () => resolve(masteryRequest.result);
    masteryRequest.onerror = () => reject(request.error);
  });
console.log("🔍 masteryData:", masteryData);
let masteryDataCopy = [...masteryData];
  // Get all tiers from tag_relationships
  const tiers = ["Core Concept", "Fundamental Technique", "Advanced Technique"];

  for (const tier of tiers) {
    const tierRequest = relationshipsStore
      .index("by_classification")
      .getAll(tier);
    const tierTags = await new Promise((resolve, reject) => {
      tierRequest.onsuccess = () =>
        resolve(tierRequest.result.map((tag) => tag.id));
      tierRequest.onerror = () => reject(request.error);
    });

    // 1️⃣ **Get mastered & unmastered tags in this tier**
    let masteredTags = masteryData
      .filter(
        (tag) =>
          tierTags.includes(tag.tag) &&
          tag.successfulAttempts / tag.totalAttempts >= 0.8
      )
      .map((tag) => tag.tag);

    let unmasteredTags = masteryData
      .filter(
        (tag) =>
          tierTags.includes(tag.tag) &&
          tag.successfulAttempts / tag.totalAttempts < 0.8
      )
      .sort(
        (a, b) =>
          b.successfulAttempts / b.totalAttempts -
          a.successfulAttempts / a.totalAttempts
      ) // Sort by mastery rate
      .map((tag) => tag.tag)
      .slice(0, 5); // Limit to 5 unmastered tags

    // 2️⃣ **Check if tier is at 80% mastery**
    const masteryThreshold = Math.ceil(tierTags.length * 0.8);
    const isTierMastered = masteredTags.length >= masteryThreshold;

    if (!isTierMastered) {
      console.log(
        `✅ User is currently in ${tier}, focusing on ${unmasteredTags.length} unmastered tags.`
      );
      return {
        classification: tier,
        masteredTags: masteredTags,
        tagsinTier: tierTags,
        unmasteredTags: unmasteredTags,
        masteryData: masteryData,
      };
    }

    // 3️⃣ **If no unmastered tags remain, check for missing tags**
    const missingTags = tierTags.filter(
      (tag) => !masteryData.some((m) => m.tag === tag)
    );

    if (unmasteredTags.length === 0 && missingTags.length > 0) {
      // **Only add up to 5 new tags that are highly related to mastered tags**
      const newTags = await getHighlyRelatedTags(
        db,
        masteredTags,
        missingTags,
        5
      );

      console.log(
        `🔹 Adding ${newTags.length} new tags to tag_mastery from ${tier}.`
      );

      // **Ensure all inserts are fully resolved**
      await Promise.all(
        newTags.map(
          (newTag) =>
            new Promise((resolve, reject) => {
              const putRequest = masteryStore.put({
                tag: newTag,
                totalAttempts: 0,
                successfulAttempts: 0,
                decayScore: 0,
                mastered: false,
              });
              putRequest.onsuccess = () => resolve();
              putRequest.onerror = () => reject(putRequest.error);
            })
        )
      );

      return { classification: tier, masteredTags: masteredTags, tagsinTier: tierTags, unmasteredTags: newTags, masteryData: masteryData };
    }
  }

  // 4️⃣ **If no tags remain, move to the next classification in increments of 5**
  console.log(
    `✅ All tags mastered in all tiers. Fetching next batch of 5 new tags.`
  );
  return getNextFiveTagsFromNextTier( masteryData);
}


async function getCurrentLearningState(db) {
  const { classification, masteredTags, tagsinTier, unmasteredTags, masteryData } = await getCurrentTier(
  );
  const sessionPerformance = await getSessionPerformance();

  console.log(`📌 User Classification: ${classification}`);
  console.log(`✅ Mastered Tags: ${masteredTags.join(", ")}`);
  console.log(`🔹 Current Focus: ${unmasteredTags.slice(0, 5).join(", ")}`);
  console.log(`🔹 Tags in Tier: ${tagsinTier.join(", ")}`);

  return {
    classification: classification,
    masteredTags: masteredTags,
    tagsinTier: tagsinTier,
    unmasteredTags: unmasteredTags.slice(0, 5),
    masteryData: masteryData,
    sessionPerformance: sessionPerformance,

  };
}





