import { dbHelper } from "../index.js";
import { getAllStandardProblems } from "./standard_problems.js";
import logger from "../../utils/logging/logger.js";

const openDB = dbHelper.openDB;

const normalizeTag = (tag) => tag.trim().toLowerCase();


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
      let { easy = 0, medium = 0, hard = 0 } = entry.difficulty_distribution || {};
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
        // Recalculate mastery threshold with updated classification
        entry.mastery_threshold = calculateMasteryThreshold(classification, entry.difficulty_distribution);
        await writeStore.put(entry);
      }
    }

    // ✅ Step 4: Debugging Logs
    logger.group("Tag Classifications");
    console.log("🔥 Core Concepts:", coreConcepts.join(", "));
    console.log("🔹 Fundamental Techniques:", fundamentalTechniques.join(", "));
    console.log("🚀 Advanced Techniques:", advancedTechniques.join(", "));
    logger.groupEnd();

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
        // Convert array format to object for consumer compatibility
        acc[item.id] = item.related_tags.reduce((tagObj, relation) => {
          tagObj[relation.tag] = relation.strength;
          return tagObj;
        }, {});
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

    if (tagData && tagData.related_tags) {
      for (const relation of tagData.related_tags) {
        if (missingTags.includes(relation.tag)) {
          relatedTags.push({ tag: relation.tag, score: relation.strength });
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
    let index;
    try {
      index = relationshipsStore.index("by_classification");
    } catch (error) {
      console.error(`❌ TAG RELATIONSHIPS INDEX ERROR: by_classification index not found in tag_relationships`, {
        error: error.message,
        availableIndexes: Array.from(relationshipsStore.indexNames),
        storeName: "tag_relationships"
      });
      throw error;
    }
    
    const tierRequest = index.getAll(tier);
    const tierTags = await new Promise((resolve, reject) => {
      tierRequest.onsuccess = () =>
        resolve(tierRequest.result.map((tag) => tag.id));
      tierRequest.onerror = () => reject(tierRequest.error);
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
    // Note: Consider adding tagInTier info to return object for better debugging
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

export async function buildTagRelationships() {
  const db = await openDB();
  const tx = db.transaction("tag_relationships", "readonly");
  const store = tx.objectStore("tag_relationships");

  const existing = await new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  if (existing.length > 0) {
    console.log("🔁 tag_relationships already exist. Skipping initialization.");
    return;
  }

  console.log("🧠 No tag_relationships found. Building from problems...");

  // ✅ Build tag graph from problem metadata
  await buildAndStoreTagGraph();

  // ✅ Classify tags based on problemCounts
  await classifyTags();

  console.log("✅ tag_relationships successfully initialized.");
}

export const buildAndStoreTagGraph = async () => {
  const problems = await getAllStandardProblems();
  const { tagGraph, tagProblemCounts } = buildTagGraphAndCounts(problems);
  await storeTagGraph(tagGraph, tagProblemCounts);
  return tagGraph;
};

function buildTagGraphAndCounts(problems) {
  const tagGraph = new Map();
  const tagProblemCounts = new Map();
  const difficultyWeights = { Easy: 3, Medium: 2, Hard: 1 };

  for (const { tags, difficulty } of problems) {
    if (!tags || tags.length < 1) continue;
    const weight = difficultyWeights[difficulty] || 1;

    const normalizedTags = tags.map(normalizeTag);

    normalizedTags.forEach((tag) => {
      if (!tagProblemCounts.has(tag)) {
        tagProblemCounts.set(tag, { easy: 0, medium: 0, hard: 0 });
      }

      if (difficulty === "Easy") tagProblemCounts.get(tag).easy++;
      if (difficulty === "Medium") tagProblemCounts.get(tag).medium++;
      if (difficulty === "Hard") tagProblemCounts.get(tag).hard++;
    });

    for (let i = 0; i < normalizedTags.length; i++) {
      for (let j = i + 1; j < normalizedTags.length; j++) {
        const tagA = normalizedTags[i];
        const tagB = normalizedTags[j];

        if (!tagGraph.has(tagA)) tagGraph.set(tagA, new Map());
        if (!tagGraph.has(tagB)) tagGraph.set(tagB, new Map());

        const prevWeight = tagGraph.get(tagA).get(tagB) || 0;
        const newWeight = prevWeight + weight;

        tagGraph.get(tagA).set(tagB, newWeight);
        tagGraph.get(tagB).set(tagA, newWeight);
      }
    }
  }

  return { tagGraph, tagProblemCounts };
}

function calculateMasteryThreshold(classification, problemCounts) {
  // Base thresholds by classification
  const baseThresholds = {
    "Core Concept": 0.75,        // 75% for fundamental concepts
    "Fundamental Technique": 0.80, // 80% for core techniques
    "Advanced Technique": 0.85    // 85% for advanced concepts
  };

  let threshold = baseThresholds[classification] || 0.80;

  // Adjust based on problem distribution - if mostly hard problems, lower threshold slightly
  if (problemCounts) {
    const { easy = 0, medium = 0, hard = 0 } = problemCounts;
    const total = easy + medium + hard;
    if (total > 0) {
      const hardRatio = hard / total;
      if (hardRatio > 0.6) {
        threshold -= 0.05; // Lower threshold for hard-heavy tags
      }
    }
  }

  return Number(threshold.toFixed(2));
}

/**
 * Calculates minimum attempts required for tag mastery based on problem distribution.
 * Data-driven approach: scales with tag size and difficulty coverage requirements.
 * @param {Object} problemCounts - { easy, medium, hard }
 * @returns {number} Minimum attempts required (6-30 range)
 */
function calculateMinimumAttempts(problemCounts) {
  const { easy = 0, medium = 0, hard = 0 } = problemCounts;
  const total = easy + medium + hard;

  // Count how many difficulty tiers exist for this tag
  const tiers = (easy > 0 ? 1 : 0) + (medium > 0 ? 1 : 0) + (hard > 0 ? 1 : 0);

  // Base coverage: require attempting problems from each difficulty tier
  // Example: Array has 3 tiers → 6 base attempts (2 per tier)
  const baseCoverage = tiers * 2;

  // Scaling factor: grows sublinearly with total problem count
  // sqrt(total/10) ensures large tags don't require excessive attempts
  // Example: Array (1787 problems) → sqrt(178.7) ≈ 13.4 → 14
  const scalingFactor = Math.ceil(Math.sqrt(total / 10));

  // Combine base + scaling, clamped to reasonable bounds (6-30)
  // Small tags (20 problems): ~6-8 attempts
  // Medium tags (100 problems): ~10-12 attempts
  // Large tags (1000+ problems): ~20-25 attempts
  const minAttempts = baseCoverage + scalingFactor;

  return Math.min(30, Math.max(6, minAttempts));
}

async function storeTagGraph(tagGraph, tagProblemCounts) {
  const db = await openDB();
  const tx = db.transaction("tag_relationships", "readwrite");
  const store = tx.objectStore("tag_relationships");

  // Find the maximum strength value for normalization
  let maxStrength = 0;
  tagGraph.forEach((relations) => {
    relations.forEach((strength) => {
      maxStrength = Math.max(maxStrength, strength);
    });
  });

  for (const [tag, relations] of tagGraph.entries()) {
    // Convert relations to normalized array format
    const related_tags = Array.from(relations.entries()).map(([relatedTag, strength]) => ({
      tag: relatedTag,
      strength: maxStrength > 0 ? Number((strength / maxStrength).toFixed(3)) : 0
    }));

    const problemCounts = tagProblemCounts.get(tag);
    const classification = "Core Concept"; // Will be updated by classifyTags()
    const masteryThreshold = calculateMasteryThreshold(classification, problemCounts);
    const minAttemptsRequired = calculateMinimumAttempts(problemCounts);

    await store.put({
      id: tag,
      classification: classification,
      related_tags: related_tags,
      difficulty_distribution: problemCounts || { easy: 0, medium: 0, hard: 0 },
      learning_order: 1, // Default, can be updated later
      prerequisite_tags: [], // Keep empty - using tier-based progression instead
      mastery_threshold: masteryThreshold,
      min_attempts_required: minAttemptsRequired
    });
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      console.log("✅ Tag graph stored in IndexedDB.");
      resolve();
    };
    tx.onerror = (e) => {
      console.error("❌ Error storing tag graph:", e.target.error);
      reject(e.target.error);
    };
  });
}

