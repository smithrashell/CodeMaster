import { dbHelper } from "./index.js";

const openDB = () => dbHelper.openDB();

const normalizeTag = (tag) => tag.trim().toLowerCase();

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
      tag: normalizeTag(t.id),
      total_attempts: 0,
      successful_attempts: 0,
      attempted_problem_ids: [],
      decay_score: 1,
      mastered: false,
      strength: 0,
      mastery_date: null,
      last_practiced: null
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
      total_attempts: 0,
      successful_attempts: 0,
      last_attempt_date: null,
    });
  }

  // Step 5: Accumulate stats from userProblems
  for (const problem of userProblems) {
    const tags = Array.isArray(problem.tags) ? problem.tags : [];
    const { total_attempts = 0, successful_attempts = 0 } =
      problem.attempt_stats || {};

    for (const tag of tags) {
      if (!tagStats.has(tag)) {
        console.warn(
          `⚠️ Tag "${tag}" found in user problems but not in standard problems.`
        );
        tagStats.set(tag, {
          total_attempts: 0,
          successful_attempts: 0,
          last_attempt_date: null,
        });
      }

      const entry = tagStats.get(tag);
      entry.total_attempts += total_attempts;
      entry.successful_attempts += successful_attempts;

      if (
        !entry.last_attempt_date ||
        new Date(problem.last_attempt_date) > new Date(entry.last_attempt_date)
      ) {
        entry.last_attempt_date = problem.last_attempt_date;
      }
    }
  }

  console.log("📈 Tag stats before writing to DB:", [...tagStats.entries()]);
  return tagStats;
}

// Legacy escape hatch function removed - replaced with data-driven mastery gates
// See updateTagMasteryForAttempt() and calculateTagMastery() for new implementation

async function writeMasteryToDatabase(tagMasteryStore, masteryData) {
  const { tag, stats, decayScore, mastered } = masteryData;

  // Calculate strength as normalized success rate with decay factor
  const successRate = stats.total_attempts > 0 ?
    stats.successful_attempts / stats.total_attempts : 0;
  const strength = Math.min(successRate * (1 + decayScore), 1.0);

  // Determine mastery date if newly mastered
  const currentTime = new Date().toISOString();

  await new Promise((resolve, reject) => {
    const request = tagMasteryStore.put({
      tag,
      total_attempts: stats.total_attempts,
      successful_attempts: stats.successful_attempts,
      decay_score: decayScore,
      mastered,
      strength: Number(strength.toFixed(3)),
      mastery_date: mastered ? currentTime : null,
      last_practiced: stats.lastAttemptDate || currentTime
    });

    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
}

// Incremental tag mastery update for a single attempt
export async function updateTagMasteryForAttempt(problem, attempt) {
  try {
    const db = await openDB();
    const { tags, isSuccess, attemptDate } = prepareAttemptData(problem, attempt);

    if (tags.length === 0) {
      console.warn(`⚠️ No valid tags found for problem "${problem.title}", skipping tag mastery update`);
      return;
    }

    const tagRelationships = await fetchTagRelationships(db, tags);
    const context = { problem, isSuccess, attemptDate, tagRelationships };
    await updateTagMasteryRecords(db, tags, context);

    console.log("✅ Tag mastery updated for attempt");
  } catch (error) {
    console.error("❌ Error updating tag mastery for attempt:", error);
    throw error;
  }
}

function prepareAttemptData(problem, attempt) {
  const tags = (problem.tags || [])
    .filter(tag => tag && typeof tag === 'string' && tag.trim().length > 0)
    .map(normalizeTag);
  const isSuccess = attempt.success;
  const attemptDate = new Date().toISOString();

  console.log(`🧠 Updating tag mastery for attempt on problem "${problem.title}":`, {
    originalTags: problem.tags,
    filteredTags: tags,
    success: isSuccess,
    problemId: problem.leetcode_id || problem.id
  });

  return { tags, isSuccess, attemptDate };
}

async function fetchTagRelationships(db, tags) {
  const tagRelationships = {};
  const tagRelTx = db.transaction(["tag_relationships"], "readonly");
  const tagRelStore = tagRelTx.objectStore("tag_relationships");

  for (const tag of tags) {
    const tagRel = await new Promise((resolve, reject) => {
      const request = tagRelStore.get(tag);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (tagRel) {
      tagRelationships[tag] = tagRel;
    }
  }

  return tagRelationships;
}

async function updateTagMasteryRecords(db, tags, context) {
  const transaction = db.transaction(["tag_mastery"], "readwrite");
  const tagMasteryStore = transaction.objectStore("tag_mastery");

  for (const tag of tags) {
    const currentRecord = await getMasteryRecord(tagMasteryStore, tag);
    const masteryData = initializeMasteryData(currentRecord, tag);

    updateMasteryCounters(masteryData, context.problem, context.isSuccess, context.attemptDate);
    const masteryRatio = calculateMasteryRatio(masteryData);
    const masteryRequirements = getMasteryRequirements(context.tagRelationships, tag);
    updateMasteryStatus(masteryData, masteryRatio, masteryRequirements, context.attemptDate);
    logMasteryUpdate(tag, masteryData, masteryRatio, masteryRequirements);

    await saveMasteryRecord(tagMasteryStore, masteryData);
  }
}

function getMasteryRecord(tagMasteryStore, tag) {
  return new Promise((resolve, reject) => {
    const request = tagMasteryStore.get(tag);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function initializeMasteryData(currentRecord, tag) {
  return currentRecord || {
    tag: normalizeTag(tag),
    total_attempts: 0,
    successful_attempts: 0,
    attempted_problem_ids: [],
    decay_score: 1,
    mastered: false,
    strength: 0,
    mastery_date: null,
    last_practiced: null
  };
}

function updateMasteryCounters(masteryData, problem, isSuccess, attemptDate) {
  masteryData.total_attempts += 1;
  if (isSuccess) {
    masteryData.successful_attempts += 1;
  }
  masteryData.last_practiced = attemptDate;

  masteryData.attempted_problem_ids = masteryData.attempted_problem_ids || [];
  const problemId = problem.problem_id || problem.leetcode_id || problem.id;
  if (problemId && !masteryData.attempted_problem_ids.includes(problemId)) {
    masteryData.attempted_problem_ids.push(problemId);
  }
}

function calculateMasteryRatio(masteryData) {
  return masteryData.total_attempts > 0
    ? masteryData.successful_attempts / masteryData.total_attempts
    : 0;
}

function getMasteryRequirements(tagRelationships, tag) {
  const tagRel = tagRelationships[tag];
  const masteryThreshold = tagRel?.mastery_threshold || 0.80;
  const minAttemptsRequired = tagRel?.min_attempts_required || 6;
  const minUniqueRequired = Math.ceil(minAttemptsRequired * 0.7);

  return { masteryThreshold, minAttemptsRequired, minUniqueRequired };
}

function updateMasteryStatus(masteryData, masteryRatio, requirements, attemptDate) {
  const uniqueProblems = new Set(masteryData.attempted_problem_ids).size;
  const volumeOK = masteryData.total_attempts >= requirements.minAttemptsRequired;
  const uniqueOK = uniqueProblems >= requirements.minUniqueRequired;
  const accuracyOK = masteryRatio >= requirements.masteryThreshold;

  const wasAlreadyMastered = masteryData.mastered;
  masteryData.mastered = volumeOK && uniqueOK && accuracyOK;

  if (masteryData.mastered && !wasAlreadyMastered) {
    masteryData.mastery_date = attemptDate;
  }

  masteryData.strength = Math.round(masteryRatio * 100);
}

function logMasteryUpdate(tag, masteryData, masteryRatio, requirements) {
  const uniqueProblems = new Set(masteryData.attempted_problem_ids).size;
  const volumeOK = masteryData.total_attempts >= requirements.minAttemptsRequired;
  const uniqueOK = uniqueProblems >= requirements.minUniqueRequired;
  const accuracyOK = masteryRatio >= requirements.masteryThreshold;
  const wasAlreadyMastered = !masteryData.mastery_date || masteryData.mastery_date !== new Date().toISOString();

  console.log(`🧠 Updated mastery for "${tag}":`, {
    totalAttempts: masteryData.total_attempts,
    successfulAttempts: masteryData.successful_attempts,
    uniqueProblems,
    accuracy: `${(masteryRatio * 100).toFixed(1)}%`,
    mastered: masteryData.mastered,
    newlyMastered: masteryData.mastered && !wasAlreadyMastered,
    gates: {
      volume: `${volumeOK ? '✅' : '❌'} ${masteryData.total_attempts}/${requirements.minAttemptsRequired}`,
      unique: `${uniqueOK ? '✅' : '❌'} ${uniqueProblems}/${requirements.minUniqueRequired}`,
      accuracy: `${accuracyOK ? '✅' : '❌'} ${(masteryRatio * 100).toFixed(1)}%/${(requirements.masteryThreshold * 100).toFixed(0)}%`
    }
  });
}

function saveMasteryRecord(tagMasteryStore, masteryData) {
  return new Promise((resolve, reject) => {
    const request = tagMasteryStore.put(masteryData);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function calculateTagMastery() {
  try {
    const db = await openDB();

    const { userProblems, standardProblems } = await fetchProblemsData(db);
    const allTags = extractAllTags(standardProblems);
    const tagStats = calculateTagStats(allTags, userProblems);

    // Fetch all tag relationships for mastery requirements
    const tagRelationships = {};
    const tagRelTx = db.transaction(["tag_relationships"], "readonly");
    const tagRelStore = tagRelTx.objectStore("tag_relationships");
    const allTagRels = await new Promise((resolve, reject) => {
      const request = tagRelStore.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    allTagRels.forEach(rel => {
      tagRelationships[normalizeTag(rel.id)] = rel;
    });

    // Step 6: Write to tag_mastery
    const updateTransaction = db.transaction(["tag_mastery"], "readwrite");
    const tagMasteryStore = updateTransaction.objectStore("tag_mastery");

    for (const [tag, stats] of tagStats.entries()) {
      const normalizedTag = normalizeTag(tag);
      const daysSinceLast = stats.lastAttemptDate
        ? (Date.now() - new Date(stats.lastAttemptDate)) / (1000 * 60 * 60 * 24)
        : 0;

      const masteryRatio =
        stats.total_attempts > 0
          ? stats.successful_attempts / stats.total_attempts
          : 0;

      const decayScore =
        stats.total_attempts > 0 ? (1 - masteryRatio) * daysSinceLast : 1;

      // Get tag-specific requirements from tag_relationships
      const tagRel = tagRelationships[normalizedTag];
      const masteryThreshold = tagRel?.mastery_threshold || 0.80;
      const minAttemptsRequired = tagRel?.min_attempts_required || 6;

      // Calculate unique problems (approximation: assume unique_problems = total_attempts for batch calculation)
      // Real tracking happens in updateTagMasteryForAttempt
      const uniqueProblems = stats.unique_problem_count || stats.total_attempts;
      const minUniqueRequired = Math.ceil(minAttemptsRequired * 0.7);

      // Mastery gates: volume + uniqueness + accuracy
      const volumeOK = stats.total_attempts >= minAttemptsRequired;
      const uniqueOK = uniqueProblems >= minUniqueRequired;
      const accuracyOK = masteryRatio >= masteryThreshold;
      const mastered = volumeOK && uniqueOK && accuracyOK;

      console.log(`🧠 Writing mastery for "${normalizedTag}":`, {
        totalAttempts: stats.total_attempts,
        successfulAttempts: stats.successful_attempts,
        uniqueProblems,
        decayScore,
        mastered: mastered,
        gates: {
          volume: `${volumeOK ? '✅' : '❌'} ${stats.total_attempts}/${minAttemptsRequired}`,
          unique: `${uniqueOK ? '✅' : '❌'} ${uniqueProblems}/${minUniqueRequired}`,
          accuracy: `${accuracyOK ? '✅' : '❌'} ${(masteryRatio * 100).toFixed(1)}%/${(masteryThreshold * 100).toFixed(0)}%`
        }
      });

      await writeMasteryToDatabase(tagMasteryStore, {
        tag: normalizedTag,
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
  const TIMEOUT_MS = 10000; // 10 second timeout for database operations
  
  const dbOperation = async () => {
    const db = await openDB();
    const tx = db.transaction("tag_mastery", "readonly");
    const store = tx.objectStore("tag_mastery");
    const request = store.getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };
  
  // Add timeout protection
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`getTagMastery timed out after ${TIMEOUT_MS}ms`)), TIMEOUT_MS);
  });
  
  try {
    return await Promise.race([dbOperation(), timeoutPromise]);
  } catch (error) {
    console.error("❌ getTagMastery failed:", error);
    // Return empty array as fallback to prevent total failure
    return [];
  }
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
  const normalizedObj = { ...tagMasteryObj, tag: normalizeTag(tagMasteryObj.tag) };
  store.put(normalizedObj);
  return tx.complete;
}
