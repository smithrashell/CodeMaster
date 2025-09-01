import { dbHelper } from "./index.js";

const openDB = dbHelper.openDB;

export async function insertDefaultTagMasteryRecords() {
  const db = await openDB();

  // 🔹 First: read from tag_relationships (you can await this safely)
  const tagRelationships = await new Promise((resolve, reject) => {
    const tagTx = db.transaction("tag_relationships", "readonly");
    const tagStore = tagTx.objectStore("tag_relationships");
    const req = tagStore.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  if (!tagRelationships || tagRelationships.length === 0) {
    console.warn(
      "⚠️ No tag_relationships found. Skipping tag_mastery initialization."
    );
    return;
  }

  // 🔹 Then check if tag_mastery already has records
  const existingMastery = await new Promise((resolve, reject) => {
    const checkTx = db.transaction("tag_mastery", "readonly");
    const checkStore = checkTx.objectStore("tag_mastery");
    const req = checkStore.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  if (existingMastery.length > 0) {
    console.log("🎯 tag_mastery already initialized.");
    return;
  }

  // 🔹 Now write inside a fresh transaction without any await in-between
  const writeTx = db.transaction("tag_mastery", "readwrite");
  const masteryStore = writeTx.objectStore("tag_mastery");

  for (const t of tagRelationships) {
    masteryStore.put({
      tag: t.id,
      strength: 0,
      decayScore: 1,
      coreLadder: [],
    });
  }

  await new Promise((resolve, reject) => {
    writeTx.oncomplete = () => resolve();
    writeTx.onerror = () => reject(writeTx.error);
    writeTx.onabort = () => reject(writeTx.error);
  });

  console.log(`✅ Initialized ${tagRelationships.length} tag_mastery records.`);
}

async function fetchProblemsData(db) {
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

  return { userProblems, standardProblems };
}

function extractAllTags(standardProblems) {
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

  return allTags;
}

function calculateTagStats(allTags, userProblems) {
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
  return tagStats;
}

function calculateMasteryThresholds(stats, masteryRatio, tag) {
  // 🔓 Progressive attempt-based escape hatch: Multiple thresholds based on struggle level
  let masteryThreshold = 0.8; // Default 80% success rate
  let escapeHatchActivated = false;
  let escapeHatchType = "";

  const failedAttempts = stats.totalAttempts - stats.successfulAttempts;

  // Progressive softening based on struggle level:
  // 1. Light struggle: 8+ attempts with 75-79% → allow graduation
  // 2. Moderate struggle: 12+ attempts with 70-79% → allow graduation
  // 3. Heavy struggle: 15+ attempts with 60%+ → allow graduation (existing)

  if (
    stats.totalAttempts >= 8 &&
    masteryRatio >= 0.75 &&
    masteryRatio < 0.8
  ) {
    // Light struggle escape: 75-79% with 8+ attempts
    masteryThreshold = 0.75;
    escapeHatchActivated = true;
    escapeHatchType = "light struggle (75% threshold)";
    console.log(
      `🔓 Light struggle escape hatch ACTIVATED for "${tag}": ${
        stats.totalAttempts
      } attempts at ${(masteryRatio * 100).toFixed(1)}% accuracy`
    );
  } else if (
    stats.totalAttempts >= 12 &&
    masteryRatio >= 0.7 &&
    masteryRatio < 0.8
  ) {
    // Moderate struggle escape: 70-79% with 12+ attempts
    masteryThreshold = 0.7;
    escapeHatchActivated = true;
    escapeHatchType = "moderate struggle (70% threshold)";
    console.log(
      `🔓 Moderate struggle escape hatch ACTIVATED for "${tag}": ${
        stats.totalAttempts
      } attempts at ${(masteryRatio * 100).toFixed(1)}% accuracy`
    );
  } else if (failedAttempts >= 15 && masteryRatio >= 0.6) {
    // Heavy struggle escape: 60%+ with 15+ failed attempts (existing logic)
    masteryThreshold = 0.6;
    escapeHatchActivated = true;
    escapeHatchType = "heavy struggle (60% threshold)";
    console.log(
      `🔓 Heavy struggle escape hatch ACTIVATED for "${tag}": ${failedAttempts} failed attempts, allowing graduation at 60% (was ${(
        masteryRatio * 100
      ).toFixed(1)}%)`
    );
  }

  return {
    masteryThreshold,
    escapeHatchActivated,
    escapeHatchType,
    failedAttempts
  };
}

async function writeMasteryToDatabase(tagMasteryStore, masteryData) {
  const { tag, stats, decayScore, mastered } = masteryData;
  
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

export async function calculateTagMastery() {
  try {
    const db = await openDB();

    const { userProblems, standardProblems } = await fetchProblemsData(db);
    const allTags = extractAllTags(standardProblems);
    const tagStats = calculateTagStats(allTags, userProblems);

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

      const {
        masteryThreshold,
        escapeHatchActivated,
        escapeHatchType,
        failedAttempts
      } = calculateMasteryThresholds(stats, masteryRatio, tag);

      const mastered = masteryRatio >= masteryThreshold;

      console.log(`🧠 Writing mastery for "${tag}":`, {
        totalAttempts: stats.totalAttempts,
        successfulAttempts: stats.successfulAttempts,
        failedAttempts,
        decayScore,
        mastered: mastered,
        masteryThreshold: `${(masteryThreshold * 100).toFixed(0)}%`,
        currentAccuracy: `${(masteryRatio * 100).toFixed(1)}%`,
        escapeHatchUsed: escapeHatchActivated,
        escapeHatchType: escapeHatchType || "none",
      });

      await writeMasteryToDatabase(tagMasteryStore, {
        tag,
        stats,
        decayScore,
        mastered
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

export function calculateTagSimilarity({ tags1, tags2, tagGraph, tagMastery, difficulty1, difficulty2 }) {
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

function getDifficultyWeight(diff1, diff2) {
  const difficultyMap = { Easy: 1, Medium: 2, Hard: 3 };
  const d1 = difficultyMap[diff1] || 2;
  const d2 = difficultyMap[diff2] || 2;

  const diffGap = Math.abs(d1 - d2);

  if (diffGap === 0) return 1.2; // Prefer problems of the same difficulty
  if (diffGap === 1) return 1; // Allow slight jumps
  return 0.7; // Discourage large jumps (e.g., Easy → Hard)
}

export async function getAllTagMastery() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["tag_mastery"], "readonly");
    const store = tx.objectStore("tag_mastery");
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function upsertTagMastery(tagMasteryObj) {
  const db = await openDB();
  const tx = db.transaction("tag_mastery", "readwrite");
  const store = tx.objectStore("tag_mastery");
  store.put(tagMasteryObj);
  return tx.complete;
}
