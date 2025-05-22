import { dbHelper } from "./index.js";
import { v4 as uuidv4 } from "uuid";
import { getAllStandardProblems } from "./standard_problems.js";
import { getAllProblemRelationship } from "./problem_relationships.js";

const openDB = dbHelper.openDB;
const normalizeTag = (tag) => tag.trim().toLowerCase();
export const buildAndStoreTagGraph = async () => {
  let tagGraph = new Map();
  let tagProblemCounts = new Map(); // To track problem difficulty per tag
  const problems = await getAllStandardProblems();

  console.log("Problems:", problems);

  problems.forEach(({ tags, difficulty }) => {
    if (!tags || tags.length < 1) return;

    let weightMultiplier =
      difficulty === "Easy" ? 3 : difficulty === "Medium" ? 2 : 1;

    tags.forEach((tag) => {
      const normalized = normalizeTag(tag);

      if (!tagProblemCounts.has(normalized))
        tagProblemCounts.set(normalized, {
          easy: 0,
          medium: 0,
          hard: 0,
        });

      if (difficulty === "Easy") tagProblemCounts.get(normalized).easy++;
      if (difficulty === "Medium") tagProblemCounts.get(normalized).medium++;
      if (difficulty === "Hard") tagProblemCounts.get(normalized).hard++;
    });

    for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        let tagA = normalizeTag(tags[i]);
        let tagB = normalizeTag(tags[j]);

        if (!tagGraph.has(tagA)) tagGraph.set(tagA, new Map());
        if (!tagGraph.has(tagB)) tagGraph.set(tagB, new Map());

        let existingWeight = tagGraph.get(tagA).get(tagB) || 0;
        let newWeight = existingWeight + weightMultiplier;

        tagGraph.get(tagA).set(tagB, newWeight);
        tagGraph.get(tagB).set(tagA, newWeight);
      }
    }
  });

  console.log("Tag Easy Problem Counts:", tagProblemCounts);

  // Store in IndexedDB
  const db = await openDB();
  const transaction = db.transaction(["tag_relationships"], "readwrite");
  const store = transaction.objectStore("tag_relationships");
   
  tagGraph.forEach((relations, tag) => {
    console.log(tag);
    store.put({
      id: tag, // normalized
      relatedTags: Object.fromEntries(relations),
      problemCounts: tagProblemCounts.get(tag),
    });
  });

  transaction.oncomplete = function () {
    console.log("Tag graph successfully stored in IndexedDB.");
  };

  transaction.onerror = function (event) {
    console.error("Error storing tag graph in IndexedDB:", event.target.error);
  };

  return tagGraph;
};

export const classifyTags = async () => {
  try {
    const db = await openDB();

    // ✅ Step 1: Retrieve Tag Relationships (With problemCounts)
    const tagGraphTransaction = db.transaction(
      ["tag_relationships"],
      "readonly"
    );
    const tagGraphStore = tagGraphTransaction.objectStore("tag_relationships");
    const tagRelationships = await new Promise((resolve, reject) => {
      const request = tagGraphStore.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    // ✅ Step 2: Classify Tags Using problemCounts
    let classifications = new Map();
    let coreConcepts = [];
    let fundamentalTechniques = [];
    let advancedTechniques = [];

    for (const entry of tagRelationships) {
      let tag = entry.id;
      let { easy = 0, medium = 0, hard = 0 } = entry.problemCounts || {};
      let total = easy + medium + hard;

      let classification = "Advanced Technique"; // Default

      // ✅ Compute Complexity Ratio
      let complexityRatio = total > 0 ? (hard + 0.5 * medium) / total : 1;

      // 🔍 Debug: Log problem statistics per tag
      console.log(
        `📊 Tag: ${tag} | Easy: ${easy}, Medium: ${medium}, Hard: ${hard}, Total: ${total}, Complexity Ratio: ${complexityRatio.toFixed(
          2
        )}`
      );

      // ✅ Core Concept: High total problems OR mostly easy problems
      if (total >= 150 || (easy > hard && easy >= 10)) {
        classification = "Core Concept";
      }

      // ✅ Fundamental Techniques: Intermediate mix of easy & medium, moderate problem count
      else if (
        (medium >= easy && medium >= hard) ||
        (total >= 50 && total < 150)
      ) {
        classification = "Fundamental Technique";
      }

      // ✅ Advanced Techniques: Low problem count, dominated by hard problems
      if (
        (hard > easy && hard > medium) ||
        total < 50 ||
        complexityRatio >= 0.7
      ) {
        classification = "Advanced Technique";
      }

      // ✅ Ensure a tag with **more medium than hard problems** remains Fundamental (Fixes Trie issue)
      if (medium > hard && classification === "Advanced Technique") {
        classification = "Fundamental Technique";
      }

      // 🔍 Debug: Log final classification decision
      console.log(`✅ Final Classification for ${tag}: ${classification}`);

      // ✅ Store classification
      classifications.set(tag, classification);

      if (classification === "Core Concept") coreConcepts.push(tag);
      if (classification === "Fundamental Technique")
        fundamentalTechniques.push(tag);
      if (classification === "Advanced Technique") advancedTechniques.push(tag);
    }

    // ✅ Step 3: Save Classifications to IndexedDB
    const writeTransaction = db.transaction(["tag_relationships"], "readwrite");
    const writeStore = writeTransaction.objectStore("tag_relationships");

    for (const [tag, classification] of classifications.entries()) {
      let entry = tagRelationships.find((e) => e.id === tag);
      if (entry) {
        entry.classification = classification;
        await writeStore.put(entry);
      }
    }

    // ✅ Step 4: Debugging Logs
    console.group("Tag Classifications");
    console.log("🔥 Core Concepts:", coreConcepts.join(", "));
    console.log("🔹 Fundamental Techniques:", fundamentalTechniques.join(", "));
    console.log("🚀 Advanced Techniques:", advancedTechniques.join(", "));
    console.groupEnd();

    console.log("✅ Tag classifications updated successfully in IndexedDB.");
  } catch (error) {
    console.error("❌ Error classifying tags:", error);
  }
};

export async function getTagRelationships() {
  const db = await openDB();
  const tx = db.transaction("tag_relationships", "readonly");
  const store = tx.objectStore("tag_relationships");
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const result = request.result.reduce((acc, item) => {
        acc[item.id] = item.relatedTags; // ✅ Ensure we get an object, not an array
        return acc;
      }, {});
      resolve(result);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getHighlyRelatedTags(
  db,
  masteredTags,
  missingTags,
  limit = 5
) {
  const tx = db.transaction("tag_relationships", "readonly");
  const relationshipsStore = tx.objectStore("tag_relationships");

  // Fetch relationships for mastered tags
  let relatedTags = [];
  for (const masteredTag of masteredTags) {
    const tagDataRequest = relationshipsStore.get(masteredTag);
    const tagData = await new Promise((resolve) => {
      tagDataRequest.onsuccess = () => resolve(tagDataRequest.result);
      tagDataRequest.onerror = () => resolve(null);
    });

    if (tagData && tagData.relatedTags) {
      for (const [relatedTag, score] of Object.entries(tagData.relatedTags)) {
        if (missingTags.includes(relatedTag)) {
          relatedTags.push({ tag: relatedTag, score });
        }
      }
    }
  }

  // Sort by relationship strength & take top `limit`
  relatedTags.sort((a, b) => b.score - a.score);
  return relatedTags.map((t) => t.tag).slice(0, limit);
}

export async function getNextFiveTagsFromNextTier(masteryData) {
  const db = await openDB();
  const tx = db.transaction("tag_relationships", "readonly");
  const relationshipsStore = tx.objectStore("tag_relationships");
  const tiers = ["Core Concept", "Fundamental Technique", "Advanced Technique"];
  const currentMasteredTags = masteryData.map((tag) => tag.tag);

  for (const tier of tiers) {
    const tierRequest = relationshipsStore
      .index("by_classification")
      .getAll(tier);
    const tierTags = await new Promise((resolve, reject) => {
      tierRequest.onsuccess = () =>
        resolve(tierRequest.result.map((tag) => tag.id));
      tierRequest.onerror = () => reject(request.error);
    });

    // Get new tags that are NOT in tag_mastery
    const missingTags = tierTags.filter(
      (tag) => !currentMasteredTags.includes(tag)
    );

    // Select the 5 most highly related missing tags
    const newTags = await getHighlyRelatedTags(
      db,
      currentMasteredTags,
      missingTags,
      5
    );
    //TODO: Add mastered tag and taginTier to the return object
    if (newTags.length > 0) {
      console.log(
        `🔹 Fetching 5 new highly related tags from ${tier}: ${newTags.join(
          ", "
        )}`
      );
      return {
        classification: tier,
        masteredTags: [],
        unmasteredTags: newTags,
      };
    }
  }

  console.log(`✅ No more tags left to learn. Fully mastered!`);
  return {
    classification: tiers[tiers.length - 1],
    masteredTags: [],
    unmasteredTags: [],
  };
}

export async function calculateTagMastery() {
  try {
    const db = await openDB();

    // Step 1: Fetch user problems
    const userProblems = await new Promise((resolve, reject) => {
      const transaction = db.transaction(["problems"], "readonly");
      const store = transaction.objectStore("problems");
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    console.log("📥 Loaded user problems:", userProblems.length);

    // Step 2: Fetch standard problems
    const standardProblems = await new Promise((resolve, reject) => {
      const transaction = db.transaction(["standard_problems"], "readonly");
      const store = transaction.objectStore("standard_problems");
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    console.log("📦 Loaded standard problems:", standardProblems.length);
    console.log("🔍 Sample standard problem:", standardProblems[0]);

    // Step 3: Extract all unique tags from standard problems
    let allTags = new Set();
    for (const problem of standardProblems) {
      const tags = Array.isArray(problem.tags) ? problem.tags : [];

      for (const tag of tags) {
        allTags.add(tag);
      }
    }

    console.log(
      "📊 Total unique tags found in standard problems:",
      allTags.size
    );
    console.log("🏷️ Tag list:", [...allTags]);

    // Step 4: Initialize tagStats
    let tagStats = new Map();
    for (const tag of allTags) {
      tagStats.set(tag, {
        totalAttempts: 0,
        successfulAttempts: 0,
        lastAttemptDate: null,
      });
    }

    // Step 5: Accumulate stats from userProblems
    for (const problem of userProblems) {
      const tags = Array.isArray(problem.Tags) ? problem.Tags : [];
      const { TotalAttempts = 0, SuccessfulAttempts = 0 } =
        problem.AttemptStats || {};

      for (const tag of tags) {
        if (!tagStats.has(tag)) {
          console.warn(
            `⚠️ Tag "${tag}" found in user problems but not in standard problems.`
          );
          tagStats.set(tag, {
            totalAttempts: 0,
            successfulAttempts: 0,
            lastAttemptDate: null,
          });
        }

        const entry = tagStats.get(tag);
        entry.totalAttempts += TotalAttempts;
        entry.successfulAttempts += SuccessfulAttempts;

        if (
          !entry.lastAttemptDate ||
          new Date(problem.lastAttemptDate) > new Date(entry.lastAttemptDate)
        ) {
          entry.lastAttemptDate = problem.lastAttemptDate;
        }
      }
    }

    console.log("📈 Tag stats before writing to DB:", [...tagStats.entries()]);

    // Step 6: Write to tag_mastery
    const updateTransaction = db.transaction(["tag_mastery"], "readwrite");
    const tagMasteryStore = updateTransaction.objectStore("tag_mastery");

    for (const [tag, stats] of tagStats.entries()) {
      const daysSinceLast = stats.lastAttemptDate
        ? (Date.now() - new Date(stats.lastAttemptDate)) / (1000 * 60 * 60 * 24)
        : 0;

      const masteryRatio =
        stats.totalAttempts > 0
          ? stats.successfulAttempts / stats.totalAttempts
          : 0;

      const decayScore =
        stats.totalAttempts > 0 ? (1 - masteryRatio) * daysSinceLast : 1;

      const mastered = masteryRatio >= 0.8;

      console.log(`🧠 Writing mastery for "${tag}":`, {
        totalAttempts: stats.totalAttempts,
        successfulAttempts: stats.successfulAttempts,
        decayScore,
        mastered,
      });

      await new Promise((resolve, reject) => {
        const request = tagMasteryStore.put({
          tag,
          totalAttempts: stats.totalAttempts,
          successfulAttempts: stats.successfulAttempts,
          decayScore,
          mastered,
        });

        request.onsuccess = resolve;
        request.onerror = () => reject(request.error);
      });
    }

    console.log("✅ Tag mastery calculation complete.");
  } catch (error) {
    console.error("❌ Error calculating tag mastery:", error);
  }
}

export async function getTagMastery() {
  const db = await openDB();
  const tx = db.transaction("tag_mastery", "readonly");
  const store = tx.objectStore("tag_mastery");
  const request = store.getAll();
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function calculateTagSimilarity(
  tags1,
  tags2,
  tagGraph,
  tagMastery,
  difficulty1,
  difficulty2
) {
  let similarity = 0;

  tags1.forEach((tag1) => {
    tags2.forEach((tag2) => {
      if (tag1 === tag2) {
        // Direct match gets highest weight
        similarity += 2;
      } else if (tagGraph[tag1] && tagGraph[tag1][tag2]) {
        // ✅ Fix: Use object property access instead of `.has()`
        let associationScore = tagGraph[tag1][tag2];

        // Normalize the score to prevent large values from dominating
        let normalizedScore = Math.log10(associationScore + 1); // Log scaling to dampen large values

        similarity += normalizedScore * 0.5; // Scale indirect relationships
      }
    });
  });

  // Apply tag mastery effect (weaker tags increase similarity)
  tags1.concat(tags2).forEach((tag) => {
    if (tagMastery[tag] && !tagMastery[tag].mastered) {
      similarity += tagMastery[tag].decayScore * 0.5;
    }
  });

  // Adjust similarity based on difficulty transitions
  const difficultyFactor = getDifficultyWeight(difficulty1, difficulty2);
  similarity *= difficultyFactor;

  return similarity;
}

// export function calculateTagSimilarity(
//   tags1,
//   tags2,
//   tagGraph,
//   tagMastery,
//   difficulty1,
//   difficulty2
// ) {
//   let similarity = 0;

//   tags1.forEach((tag1) => {
//     tags2.forEach((tag2) => {
//       if (tag1 === tag2) {
//         // Direct match gets highest weight
//         similarity += 2;
//       } else if (tagGraph.has(tag1) && tagGraph.get(tag1).has(tag2)) {
//         let associationScore = tagGraph.get(tag1).get(tag2);

//         // Normalize the score to prevent large values from dominating
//         let normalizedScore = Math.log10(associationScore + 1); // Log scaling to dampen large values

//         similarity += normalizedScore * 0.5; // Scale indirect relationships
//       }
//     });
//   });

//   // Apply tag mastery effect (weaker tags increase similarity)
//   tags1.concat(tags2).forEach((tag) => {
//     if (tagMastery[tag] && !tagMastery[tag].mastered) {
//       similarity += tagMastery[tag].decayScore * 0.5;
//     }
//   });

//   // Adjust similarity based on difficulty transitions
//   const difficultyFactor = getDifficultyWeight(difficulty1, difficulty2);
//   similarity *= difficultyFactor;

//   return similarity;
// }

function getDifficultyWeight(diff1, diff2) {
  const difficultyMap = { Easy: 1, Medium: 2, Hard: 3 };
  const d1 = difficultyMap[diff1] || 2;
  const d2 = difficultyMap[diff2] || 2;

  const diffGap = Math.abs(d1 - d2);

  if (diffGap === 0) return 1.2; // Prefer problems of the same difficulty
  if (diffGap === 1) return 1; // Allow slight jumps
  return 0.7; // Discourage large jumps (e.g., Easy → Hard)
}
