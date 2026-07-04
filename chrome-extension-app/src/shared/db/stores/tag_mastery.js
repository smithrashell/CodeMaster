import { dbHelper } from "../index.js";
import { getAllStandardProblems } from "./standard_problems.js";
import { MASTERY_WINDOW_SIZE } from "../../utils/leitner/Utils.js";

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



async function writeMasteryToDatabase(tagMasteryStore, record) {
  await new Promise((resolve, reject) => {
    const request = tagMasteryStore.put(record);
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

export async function getLadderCoverage(db, tag) {
  try {
    const transaction = db.transaction(["pattern_ladders"], "readonly");
    const store = transaction.objectStore("pattern_ladders");

    const ladder = await new Promise((resolve, reject) => {
      const request = store.get(tag);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (!ladder || !ladder.problems || ladder.problems.length === 0) {
      return { attempted: 0, total: 0, percentage: 0 };
    }

    const attemptedCount = ladder.problems.filter(p => p.attempted).length;
    const totalCount = ladder.problems.length;
    const percentage = totalCount > 0 ? attemptedCount / totalCount : 0;

    return {
      attempted: attemptedCount,
      total: totalCount,
      percentage
    };
  } catch (error) {
    console.error(`Error getting ladder coverage for ${tag}:`, error);
    return { attempted: 0, total: 0, percentage: 0 };
  }
}

async function updateTagMasteryRecords(db, tags, context) {
  // CRITICAL FIX: Fetch all ladder coverage data BEFORE starting the transaction
  // to prevent transaction timeout when awaiting async operations
  const ladderCoverageMap = new Map();
  for (const tag of tags) {
    const coverage = await getLadderCoverage(db, tag);
    ladderCoverageMap.set(tag, coverage);
  }

  // Now start the transaction and do all updates synchronously
  const transaction = db.transaction(["tag_mastery"], "readwrite");
  const tagMasteryStore = transaction.objectStore("tag_mastery");

  for (const tag of tags) {
    const currentRecord = await getMasteryRecord(tagMasteryStore, tag);
    const masteryData = initializeMasteryData(currentRecord, tag);

    updateMasteryCounters(masteryData, context.problem, context.isSuccess, context.attemptDate);
    const masteryRatio = calculateMasteryRatio(masteryData);
    const masteryRequirements = getMasteryRequirements(context.tagRelationships, tag);
    const ladderCoverage = ladderCoverageMap.get(tag); // Get from pre-fetched map
    updateMasteryStatus(masteryData, masteryRatio, masteryRequirements, ladderCoverage, context.attemptDate);
    logMasteryUpdate(tag, masteryData, masteryRatio, masteryRequirements, ladderCoverage);

    await saveMasteryRecord(tagMasteryStore, masteryData);
  }

  // Wait for transaction to complete before returning
  await new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(new Error('Transaction aborted'));
  });
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

  if (!Array.isArray(masteryData.recent_results)) {
    masteryData.recent_results = [];
  }
  masteryData.recent_results.push(isSuccess);
  if (masteryData.recent_results.length > MASTERY_WINDOW_SIZE) {
    masteryData.recent_results = masteryData.recent_results.slice(-MASTERY_WINDOW_SIZE);
  }

  masteryData.attempted_problem_ids = masteryData.attempted_problem_ids || [];
  const problemId = problem.problem_id || problem.leetcode_id || problem.id;
  if (problemId && !masteryData.attempted_problem_ids.includes(problemId)) {
    masteryData.attempted_problem_ids.push(problemId);
  }
}

function calculateMasteryRatio(masteryData) {
  if (Array.isArray(masteryData.recent_results) && masteryData.recent_results.length > 0) {
    return masteryData.recent_results.filter(Boolean).length / masteryData.recent_results.length;
  }
  return masteryData.total_attempts > 0
    ? masteryData.successful_attempts / masteryData.total_attempts
    : 0;
}

function getMasteryRequirements(tagRelationships, tag) {
  const tagRel = tagRelationships[tag];
  const masteryThreshold = tagRel?.mastery_threshold || 0.80;
  const minAttemptsRequired = tagRel?.min_attempts_required || 6;
  const minUniqueRequired = Math.ceil(minAttemptsRequired * 0.7);
  const minLadderCoverage = 0.70; // 70% of pattern ladder must be completed

  return { masteryThreshold, minAttemptsRequired, minUniqueRequired, minLadderCoverage };
}

function updateMasteryStatus(masteryData, masteryRatio, requirements, ladderCoverage, attemptDate) {
  const uniqueProblems = new Set(masteryData.attempted_problem_ids).size;
  const volumeOK = masteryData.total_attempts >= requirements.minAttemptsRequired;
  const uniqueOK = uniqueProblems >= requirements.minUniqueRequired;
  const accuracyOK = masteryRatio >= requirements.masteryThreshold;
  const ladderCompleted = ladderCoverage.total > 0 && uniqueProblems >= ladderCoverage.total;
  const ladderOK = ladderCoverage.percentage >= requirements.minLadderCoverage || ladderCompleted;

  const wasAlreadyMastered = masteryData.mastered;
  const allGatesPass = volumeOK && uniqueOK && accuracyOK && ladderOK;

  if (wasAlreadyMastered && !allGatesPass) {
    // Ladder gate is initial qualification only — it resets on regeneration
    // so exclude it from demotion. Volume/unique never regress.
    const nonAccuracyGatesPass = volumeOK && uniqueOK;
    if (nonAccuracyGatesPass) {
      const demotionThreshold = Math.round((requirements.masteryThreshold - 0.10) * 100) / 100;
      masteryData.mastered = masteryRatio >= demotionThreshold;
    } else {
      masteryData.mastered = false;
    }
  } else {
    masteryData.mastered = allGatesPass;
  }

  if (masteryData.mastered && !wasAlreadyMastered) {
    masteryData.mastery_date = attemptDate;
  }

  masteryData.strength = Math.round(masteryRatio * 100);
}

function logMasteryUpdate(tag, masteryData, masteryRatio, requirements, ladderCoverage) {
  const uniqueProblems = new Set(masteryData.attempted_problem_ids).size;
  const volumeOK = masteryData.total_attempts >= requirements.minAttemptsRequired;
  const uniqueOK = uniqueProblems >= requirements.minUniqueRequired;
  const accuracyOK = masteryRatio >= requirements.masteryThreshold;
  const ladderOK = ladderCoverage.percentage >= requirements.minLadderCoverage;
  const cumulativeRate = masteryData.total_attempts > 0
    ? masteryData.successful_attempts / masteryData.total_attempts : 0;

  console.log(`🧠 Updated mastery for "${tag}":`, {
    totalAttempts: masteryData.total_attempts,
    successfulAttempts: masteryData.successful_attempts,
    uniqueProblems,
    windowedAccuracy: `${(masteryRatio * 100).toFixed(1)}% (last ${masteryData.recent_results?.length || 0})`,
    cumulativeAccuracy: `${(cumulativeRate * 100).toFixed(1)}%`,
    mastered: masteryData.mastered,
    gates: {
      volume: `${volumeOK ? '✅' : '❌'} ${masteryData.total_attempts}/${requirements.minAttemptsRequired}`,
      unique: `${uniqueOK ? '✅' : '❌'} ${uniqueProblems}/${requirements.minUniqueRequired}`,
      accuracy: `${accuracyOK ? '✅' : '❌'} ${(masteryRatio * 100).toFixed(1)}%/${(requirements.masteryThreshold * 100).toFixed(0)}%`,
      ladder: `${ladderOK ? '✅' : '❌'} ${ladderCoverage.attempted}/${ladderCoverage.total} (${(ladderCoverage.percentage * 100).toFixed(0)}%/${(requirements.minLadderCoverage * 100).toFixed(0)}%)`
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

    const standardProblems = await getAllStandardProblems();

    const tagStats = await buildTagStatsFromAttempts(db, standardProblems);

    // Fetch tag relationships for mastery requirements
    const tagRelationships = {};
    const allTagRels = await new Promise((resolve, reject) => {
      const tx = db.transaction(["tag_relationships"], "readonly");
      const store = tx.objectStore("tag_relationships");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    allTagRels.forEach(rel => {
      tagRelationships[normalizeTag(rel.id)] = rel;
    });

    // Fetch all ladder coverage BEFORE starting the readwrite transaction
    const ladderCoverageMap = new Map();
    for (const [tag] of tagStats.entries()) {
      ladderCoverageMap.set(tag, await getLadderCoverage(db, tag));
    }

    // Read existing mastery for demotion hysteresis
    const existingMastery = await new Promise((resolve, reject) => {
      const tx = db.transaction("tag_mastery", "readonly");
      const store = tx.objectStore("tag_mastery");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const existingMasteryMap = new Map(existingMastery.map(m => [m.tag, m]));

    // Write complete records to tag_mastery
    const updateTransaction = db.transaction(["tag_mastery"], "readwrite");
    const tagMasteryStore = updateTransaction.objectStore("tag_mastery");

    for (const [tag, stats] of tagStats.entries()) {
      const daysSinceLast = stats.last_practiced
        ? (Date.now() - new Date(stats.last_practiced)) / (1000 * 60 * 60 * 24)
        : 0;

      const cumulativeRatio = stats.total_attempts > 0
        ? stats.successful_attempts / stats.total_attempts : 0;

      const masteryRatio = stats.recent_results.length > 0
        ? stats.recent_results.filter(Boolean).length / stats.recent_results.length
        : cumulativeRatio;

      const decayScore = stats.total_attempts > 0
        ? (1 - cumulativeRatio) * daysSinceLast : 1;

      const tagRel = tagRelationships[tag];
      const masteryThreshold = tagRel?.mastery_threshold || 0.80;
      const minAttemptsRequired = tagRel?.min_attempts_required || 6;
      const uniqueProblems = stats.attempted_problem_ids.length;
      const minUniqueRequired = Math.ceil(minAttemptsRequired * 0.7);
      const minLadderCoverage = 0.70;
      const ladderCoverage = ladderCoverageMap.get(tag);

      const volumeOK = stats.total_attempts >= minAttemptsRequired;
      const uniqueOK = uniqueProblems >= minUniqueRequired;
      const accuracyOK = masteryRatio >= masteryThreshold;
      const ladderOK = ladderCoverage.percentage >= minLadderCoverage;
      const allGatesPass = volumeOK && uniqueOK && accuracyOK && ladderOK;

      const wasAlreadyMastered = existingMasteryMap.get(tag)?.mastered === true;
      let mastered;
      if (wasAlreadyMastered && !allGatesPass) {
        const nonAccuracyGatesPass = volumeOK && uniqueOK && ladderOK;
        if (nonAccuracyGatesPass) {
          const demotionThreshold = Math.round((masteryThreshold - 0.10) * 100) / 100;
          mastered = masteryRatio >= demotionThreshold;
        } else {
          mastered = false;
        }
      } else {
        mastered = allGatesPass;
      }

      const strength = Math.round(masteryRatio * 100);
      const existingMasteryDate = existingMasteryMap.get(tag)?.mastery_date;
      const masteryDate = mastered
        ? (wasAlreadyMastered ? existingMasteryDate : new Date().toISOString())
        : null;

      console.log(`🧠 Writing mastery for "${tag}":`, {
        totalAttempts: stats.total_attempts,
        successfulAttempts: stats.successful_attempts,
        uniqueProblems,
        mastered,
        windowedAccuracy: `${(masteryRatio * 100).toFixed(1)}% (last ${stats.recent_results.length})`,
        cumulativeAccuracy: `${(cumulativeRatio * 100).toFixed(1)}%`,
      });

      await writeMasteryToDatabase(tagMasteryStore, {
        tag,
        total_attempts: stats.total_attempts,
        successful_attempts: stats.successful_attempts,
        attempted_problem_ids: stats.attempted_problem_ids,
        decay_score: decayScore,
        mastered,
        strength,
        mastery_date: masteryDate,
        last_practiced: stats.last_practiced,
        recent_results: stats.recent_results,
      });
    }

    console.log("✅ Tag mastery calculation complete.");
  } catch (error) {
    console.error("❌ Error calculating tag mastery:", error);
  }
}

async function buildTagStatsFromAttempts(db, standardProblems) {
  const problemTagMap = new Map();
  for (const p of standardProblems) {
    const pid = p.id;
    if (pid && Array.isArray(p.tags)) {
      problemTagMap.set(String(pid), p.tags.map(t => normalizeTag(t)));
    }
  }
  const allAttempts = await new Promise((resolve, reject) => {
    const tx = db.transaction("attempts", "readonly");
    const store = tx.objectStore("attempts");
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  const sortedAttempts = allAttempts
    .filter(a => a.attempt_date)
    .sort((a, b) => new Date(a.attempt_date) - new Date(b.attempt_date));

  const tagStats = new Map();
  for (const attempt of sortedAttempts) {
    const pid = String(attempt.leetcode_id || attempt.problem_id);
    const tags = problemTagMap.get(pid);
    if (!tags) continue;

    for (const tag of tags) {
      if (!tagStats.has(tag)) {
        tagStats.set(tag, {
          total_attempts: 0,
          successful_attempts: 0,
          attempted_problem_ids: [],
          recent_results: [],
          last_practiced: null,
        });
      }
      const entry = tagStats.get(tag);
      entry.total_attempts += 1;
      if (attempt.success) entry.successful_attempts += 1;

      if (pid && !entry.attempted_problem_ids.includes(pid)) {
        entry.attempted_problem_ids.push(pid);
      }

      entry.recent_results.push(!!attempt.success);
      if (entry.recent_results.length > MASTERY_WINDOW_SIZE) {
        entry.recent_results = entry.recent_results.slice(-MASTERY_WINDOW_SIZE);
      }

      const attemptDate = attempt.attempt_date instanceof Date
        ? attempt.attempt_date.toISOString()
        : attempt.attempt_date;
      if (!entry.last_practiced || attemptDate > entry.last_practiced) {
        entry.last_practiced = attemptDate;
      }
    }
  }

  return tagStats;
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
