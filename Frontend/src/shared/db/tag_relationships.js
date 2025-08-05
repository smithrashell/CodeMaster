import { dbHelper } from "./index.js";
import { getAllStandardProblems } from "./standard_problems.js";

const openDB = dbHelper.openDB;

const normalizeTag = (tag) => tag.trim().toLowerCase();

export const buildAndStoreTagGraph2 = async () => {
  let tagGraph = new Map();
  let tagProblemCounts = new Map(); // To track problem difficulty per tag
  const problems = await getAllStandardProblems();

  console.log("Problems:", problems);

  problems.forEach(({ Tags, Difficulty }) => {
    if (!Tags || Tags.length < 1) return;

    let weightMultiplier =
      Difficulty === "Easy" ? 3 : Difficulty === "Medium" ? 2 : 1;

    Tags.forEach((tag) => {
      const normalized = normalizeTag(tag);

      if (!tagProblemCounts.has(normalized))
        tagProblemCounts.set(normalized, {
          easy: 0,
          medium: 0,
          hard: 0,
        });

      if (Difficulty === "Easy") tagProblemCounts.get(normalized).easy++;
      if (Difficulty === "Medium") tagProblemCounts.get(normalized).medium++;
      if (Difficulty === "Hard") tagProblemCounts.get(normalized).hard++;
    });

    for (let i = 0; i < Tags.length; i++) {
      for (let j = i + 1; j < Tags.length; j++) {
        let tagA = normalizeTag(Tags[i]);
        let tagB = normalizeTag(Tags[j]);

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
    console.log("🔁 tag_relationships already exist. Skipping insert.");
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

async function storeTagGraph(tagGraph, tagProblemCounts) {
  const db = await openDB();
  const tx = db.transaction("tag_relationships", "readwrite");
  const store = tx.objectStore("tag_relationships");

  for (const [tag, relations] of tagGraph.entries()) {
    await store.put({
      id: tag,
      relatedTags: Object.fromEntries(relations),
      problemCounts: tagProblemCounts.get(tag),
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
