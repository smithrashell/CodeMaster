// eslint-disable-next-line no-restricted-imports
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
  console.info("normalized", normalized);
  console.info("currentRank", currentRank);

  return Object.entries(classificationRank)
    .filter(([_, rank]) => rank <= currentRank)
    .map(([cls]) =>
      cls
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
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
    tagRelationships.map((r) => [
      r.id.toLowerCase(),
      r.classification?.toLowerCase(),
    ])
  );

  const focusTagSet = new Set(focusTags);
  const allowedClsSet = new Set(
    allowedClassifications.map((c) => c.toLowerCase())
  );

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

      const tags = p.tags.map((t) => t.toLowerCase());
      tags.forEach((t) => {
        if (!tagInfoMap.has(t)) {
          console.warn(`🚨 Tag "${t}" missing from tagInfoMap`);
        }
      });

      const matchedFocusTags = tags.filter((t) => focusTagSet.has(t));
      if (matchedFocusTags.length === 0) {
        failedFocusTag++;
        return false;
      }

      const allTagsInTier = tags.every((t) => {
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
 * Calculate relationship score for a problem based on user's attempted problems
 * Higher score = more connected to user's learning path
 */
function calculateRelationshipScore(problemId, attemptedProblems, relationshipMap) {
  if (!relationshipMap || attemptedProblems.length === 0) return 0;

  let totalScore = 0;
  let relationshipCount = 0;

  // Check relationships with attempted problems
  for (const attemptedId of attemptedProblems) {
    // Convert to numbers for map lookup (relationship map uses numeric keys)
    const numProblemId = Number(problemId);
    const numAttemptedId = Number(attemptedId);

    // Check both directions of relationships
    const relationships1 = relationshipMap.get(numProblemId);
    const relationships2 = relationshipMap.get(numAttemptedId);

    if (relationships1 && relationships1[numAttemptedId]) {
      totalScore += relationships1[numAttemptedId];
      relationshipCount++;
    }

    if (relationships2 && relationships2[numProblemId]) {
      totalScore += relationships2[numProblemId];
      relationshipCount++;
    }
  }

  // Return average relationship strength, or 0 if no relationships
  return relationshipCount > 0 ? totalScore / relationshipCount : 0;
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
  isOnboarding = false,
}) {
  let easyCount, mediumCount, hardCount;
  
  // 🔰 ONBOARDING: Force Easy-only problems for new users
  if (isOnboarding) {
    easyCount = ladderSize;
    mediumCount = 0;
    hardCount = 0;
    console.info("🔰 Onboarding mode: Using Easy-only pattern ladder", {
      ladderSize,
      easyCount,
      mediumCount,
      hardCount
    });
  } else {
    // Normal proportional distribution for experienced users
    const total =
      (problemCounts.easy || 0) +
        (problemCounts.medium || 0) +
        (problemCounts.hard || 0) || 1;

    easyCount = Math.round(
      ((problemCounts.easy || 0) / total) * ladderSize
    );
    mediumCount = Math.round(
      ((problemCounts.medium || 0) / total) * ladderSize
    );
    hardCount = ladderSize - easyCount - mediumCount;
  }
  console.info("easyCount", easyCount);
  console.info("mediumCount", mediumCount);
  console.info("hardCount", hardCount);

  // Helper function to sort problems by relationship strength (secondary criteria)
  const sortByRelationships = (problems) => {
    if (!relationshipMap || !userProblemMap) return problems;

    return problems.sort((a, b) => {
      // Get attempted problems for relationship scoring
      const attemptedProblems = Array.from(userProblemMap.keys());

      // Calculate relationship scores for each problem
      const scoreA = calculateRelationshipScore(a.id, attemptedProblems, relationshipMap);
      const scoreB = calculateRelationshipScore(b.id, attemptedProblems, relationshipMap);

      // Higher relationship score = more connected to user's learning path
      return scoreB - scoreA;
    });
  };

  const easy = sortByRelationships(
    validProblems.filter((p) => p.difficulty === "Easy")
  ).slice(0, easyCount);

  const medium = sortByRelationships(
    validProblems.filter((p) => p.difficulty === "Medium")
  ).slice(0, mediumCount);

  const hard = sortByRelationships(
    validProblems.filter((p) => p.difficulty === "Hard")
  ).slice(0, hardCount);

  let problemsByDifficulty = [...easy, ...medium, ...hard];
  console.info("ladderProblems", problemsByDifficulty);
  const ladderProblems = problemsByDifficulty.map((p) => {
    // Check if this problem has been attempted by user
    const isAttempted = userProblemMap ? userProblemMap.has(p.id) : false;

    return {
      id: p.id,                    // Standardized: use 'id' to match standard problems schema
      title: p.title,
      difficulty: p.difficulty,    // Standardized: use 'difficulty' to match standard problems schema
      tags: p.tags || [],
      attempted: isAttempted       // Track if user has attempted this problem
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
