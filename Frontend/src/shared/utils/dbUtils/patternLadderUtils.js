import { calculateDecayScore } from "../Utils.js";
import { dbHelper } from "../../db/index.js";

const openDB = dbHelper.openDB;

const classificationRank = {
  "core concept": 1,
  "fundamental technique": 2,
  "advanced technique": 3,
};

/**
 * Returns a list of allowed classification names based on the given classification.
 * Lower or equal ranked classifications are allowed.
 * 
 * @param {string} currentClassification - The classification to evaluate from.
 * @returns {string[]} Array of allowed classification names (capitalized).
 */
export function getAllowedClassifications(currentClassification) {
  const normalized = (currentClassification || "").toLowerCase().trim();
  const currentRank = classificationRank[normalized] ?? 1;
  console.info("normalized", normalized)
 console.info("currentRank", currentRank)

  return Object.entries(classificationRank)
    .filter(([_, rank]) => rank <= currentRank)
    .map(([cls]) =>
      cls
        .split(" ")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    );
}




/**
 * Filter and return problems that:
 * - include the target tag
 * - are not already attempted
 * - have all tags within allowed classifications
 */
export function getValidProblems({
  problems,
  userProblemMap,
  tagRelationships,
  allowedClassifications,
  focusTags,
}) {
  const tagInfoMap = new Map(
    tagRelationships.map(r => [
      r.id.toLowerCase(),
      r.classification?.toLowerCase()
    ])
  );

  const focusTagSet = new Set(focusTags);
  const allowedClsSet = new Set(allowedClassifications.map(c => c.toLowerCase()));

  let totalChecked = 0;
  let failedUserMap = 0;
  let failedTier = 0;
  let failedFocusTag = 0;
  let passed = 0;

  const valid = problems
  .filter((p) => {
    totalChecked++;

    if (userProblemMap.has(p.id)) {
      failedUserMap++;
      return false;
    }

    const tags = (p.tags).map(t => t.toLowerCase());
    tags.forEach(t => {
      if (!tagInfoMap.has(t)) {
        console.warn(`🚨 Tag "${t}" missing from tagInfoMap`);
      }
    })
 
    const matchedFocusTags = tags.filter(t => focusTagSet.has(t));
    if (matchedFocusTags.length === 0) {
      failedFocusTag++;
      return false;
    }

    const allTagsInTier = tags.every(t => {
      const cls = tagInfoMap.get(t);
  
      const match = allowedClsSet.has(cls);
      return match;
    });
    
    if (!allTagsInTier) {
      failedTier++;
      return false;
    }

    // Attach matchedFocusTag count for later sorting
    p._matchedFocusTags = matchedFocusTags.length;

    // if (passed < 5) {
    //   console.info(`   • Problem #${p.Title} - ID ${p.id}:`, tags);
    // }
    passed++;
    return true;
  })
  .sort((a, b) => b._matchedFocusTags - a._matchedFocusTags); // Highest count first


  console.info("📊 Problem filtering summary");
  console.info(`   • Total checked: ${totalChecked}`);
  console.info(`   • Skipped (seen): ${failedUserMap}`);
  console.info(`   • Skipped (no focus tag): ${failedFocusTag}`);
  console.info(`   • Skipped (tag out of tier): ${failedTier}`);
  console.info(`   ✅ Passed: ${passed}`);
  console.info(`   🎯 Returned validProblems: ${valid.length}`);

  return valid;
}


/**
 * Build a pattern ladder of problems with decay scores and relationships.
 */
export function buildLadder({
  validProblems,
  problemCounts,
  userProblemMap,
  relationshipMap,
  ladderSize,
}) {

  const total = (problemCounts.easy || 0) + (problemCounts.medium || 0) + (problemCounts.hard || 0) || 1;

  const easyCount = Math.round(((problemCounts.easy || 0) / total) * ladderSize);
  const mediumCount = Math.round(((problemCounts.medium || 0) / total) * ladderSize);
  const hardCount = ladderSize - easyCount - mediumCount;
  console.info("easyCount", easyCount)
  console.info("mediumCount", mediumCount)
  console.info("hardCount", hardCount)

  const easy = validProblems.filter(p => p.difficulty === "Easy").slice(0, easyCount);
  const medium = validProblems.filter(p => p.difficulty === "Medium").slice(0, mediumCount);
  const hard = validProblems.filter(p => p.difficulty === "Hard").slice(0, hardCount);

  let problemsByDifficulty = [...easy, ...medium, ...hard];
  console.info("ladderProblems", problemsByDifficulty)
  const ladderProblems = problemsByDifficulty.map((p) => {
    const userData = userProblemMap.get(p.id);
    const stats = userData?.AttemptStats || {};
    const totalAttempts = stats.TotalAttempts || 0;
    const successAttempts = stats.SuccessfulAttempts || 0;
    const successRate = totalAttempts > 0 ? successAttempts / totalAttempts : 0;

    const lastAttemptDate = userData?.lastAttemptDate || new Date().toISOString();
    const stability = userData?.Stability || 6.0;

    const decayScore = totalAttempts > 0
      ? calculateDecayScore(lastAttemptDate, successRate, stability)
      : 1;

      const fullConnections = relationshipMap.get(p.id) || {};
      const sortedConnections = Object.entries(fullConnections)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      
 

    return {
      leetCodeID: p.id,
      title: p.title,
      rating: p.difficulty,
      tags: p.tags || [],
      decayScore,
      connections: sortedConnections.map(([id]) => id),
      connectedStrengths: Object.fromEntries(sortedConnections),
    };
  });
  if (ladderProblems.length < 1) {
    console.warn("🚨 No problems in ladder");
  }
  return ladderProblems;
}

export async function getPatternLadders() {
  const db = await openDB();
  const transaction = db.transaction("pattern_ladders", "readonly");
  const store = transaction.objectStore("pattern_ladders");

  return new Promise((resolve, reject) => {
    const request = store.getAll();

    request.onsuccess = () => {
      const ladders = request.result;
      // Convert array to object keyed by tag
      const ladderMap = {};
      for (const ladder of ladders) {
        ladderMap[ladder.tag] = ladder;
      }
      resolve(ladderMap);
    };

    request.onerror = () => {
      console.error("Error fetching pattern ladders:", request.error);
      reject(request.error); 
    };
  });
}
