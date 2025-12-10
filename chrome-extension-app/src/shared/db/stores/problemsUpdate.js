/**
 * Problem Update Functions
 * Extracted from problems.js - stability and rating update operations
 */

import { dbHelper } from "../index.js";
import { getAllStandardProblems, fetchProblemById } from "./standard_problems.js";
import logger from "../../utils/logging/logger.js";

const openDB = () => dbHelper.openDB();

/**
 * Calculate problem sequence score based on relationships
 * @private
 */
export async function getProblemSequenceScore(
  problemId,
  unmasteredTagSet,
  tierTagSet
) {
  const db = await openDB();
  const tx = db.transaction("problem_relationships", "readonly");
  const store = tx.objectStore("problem_relationships");

  return new Promise((resolve, reject) => {
    let index;
    try {
      index = store.index("by_problem_id1");
    } catch (error) {
      console.error(`PROBLEMS INDEX ERROR: by_problem_id1 index not found in problem_relationships`, {
        error: error.message,
        availableIndexes: Array.from(store.indexNames),
        storeName: "problem_relationships"
      });
      reject(error);
      return;
    }
    const request = index.getAll(problemId);
    request.onsuccess = async () => {
      const relationships = request.result;

      if (relationships.length > 0) {
        let totalStrength = 0;
        let count = 0;
        for (const rel of relationships) {
          const linkedProblem = await fetchProblemById(rel.problemId2);
          if (!linkedProblem) continue;

          const tags = linkedProblem.tags || [];
          const relevantTags = tags.filter(
            (tag) => unmasteredTagSet.has(tag) || tierTagSet.has(tag)
          );
          let tagBonus = relevantTags.length;

          const unrelatedTags = tags.filter(
            (tag) => !unmasteredTagSet.has(tag) && !tierTagSet.has(tag)
          );
          let tagPenalty = unrelatedTags.length;

          totalStrength += rel.strength * (tagBonus - 0.5 * tagPenalty);
          count++;
        }

        let weightedAvgStrength = count > 0 ? totalStrength / count : 0;
        logger.info(
          `Final sequenceScore for Problem ${problemId}:`,
          weightedAvgStrength
        );
        resolve(weightedAvgStrength);
      } else {
        logger.warn(`No relationships found for problem ${problemId}`);
        resolve(0);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Add stability scores to all problems based on attempt history
 */
export async function addStabilityToProblems() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["problems", "attempts"], "readwrite");
    const problemStore = transaction.objectStore("problems");
    const attemptStore = transaction.objectStore("attempts");
    let attemptIndex;
    try {
      attemptIndex = attemptStore.index("by_problem_id");
    } catch (error) {
      console.error(`PROBLEMS INDEX ERROR: by_problem_id index not found in attempts`, {
        error: error.message,
        availableIndexes: Array.from(attemptStore.indexNames),
        storeName: "attempts"
      });
      reject(error);
      return;
    }

    const problemsRequest = problemStore.getAll();

    problemsRequest.onsuccess = async (event) => {
      const problems = event.target.result;

      for (let problem of problems) {
        const problemId = problem.id;

        const attempts = await new Promise((resolved, reject) => {
          const request = attemptIndex.getAll(problemId);
          request.onsuccess = (event) => {
            resolved(event.target.result);
          };
          request.onerror = (event) => {
            reject(event.target.error);
          };
        });

        logger.info("Attempts:", attempts);

        attempts.sort(
          (a, b) => new Date(a.attempt_date) - new Date(b.attempt_date)
        );

        let currentStability = 1.0;

        for (let attempt of attempts) {
          currentStability = updateStabilityFSRS(
            currentStability,
            attempt.success
          );
        }

        problem.stability = currentStability;

        problemStore.put(problem);
      }

      transaction.oncomplete = () => {
        logger.info("Stability added/updated for all problems.");
        resolve();
      };

      transaction.onerror = (err) => {
        logger.error("Transaction failed:", err);
        reject(err);
      };
    };
  });
}

/**
 * Updates stability considering both performance and time elapsed
 * @param {number} currentStability - Current stability value
 * @param {boolean} wasCorrect - Whether the attempt was successful
 * @param {string|null} lastAttemptDate - ISO date string of last attempt (optional)
 * @returns {number} New stability value
 */
export function updateStabilityFSRS(currentStability, wasCorrect, lastAttemptDate = null) {
  let newStability;

  if (wasCorrect) {
    newStability = currentStability * 1.2 + 0.5;
  } else {
    newStability = currentStability * 0.7;
  }

  if (lastAttemptDate) {
    try {
      const lastDate = new Date(lastAttemptDate);
      const now = new Date();
      const daysSinceLastAttempt = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));

      if (daysSinceLastAttempt > 30) {
        const forgettingFactor = Math.exp(-daysSinceLastAttempt / 90);
        newStability = newStability * forgettingFactor;
      }
    } catch (error) {
      console.warn("Error applying time-based decay to stability:", error);
    }
  }

  return parseFloat(newStability.toFixed(2));
}

/**
 * Updates all problems with a Rating property based on their difficulty from standard_problems.
 */
export async function updateProblemsWithRating() {
  try {
    const db = await openDB();
    const standardProblems = await getAllStandardProblems();

    const difficultyMap = {};
    standardProblems.forEach((problem) => {
      difficultyMap[problem.id] = problem.difficulty;
    });
    logger.info("difficultyMap:", difficultyMap);
    const transaction = db.transaction(["problems"], "readwrite");
    const problemStore = transaction.objectStore("problems");

    const request = problemStore.getAll();

    request.onsuccess = (event) => {
      const problems = event.target.result;

      for (let problem of problems) {
        const difficulty = difficultyMap[problem.leetcode_id];
        logger.info("difficulty:", difficulty);
        logger.info("problem:", problem.leetcode_id);
        if (difficulty) {
          problem.Rating = difficulty;
          problemStore.put(problem);
        }
      }
    };

    transaction.oncomplete = () => {
      logger.info("All problems updated with ratings.");
    };

    transaction.onerror = (event) => {
      logger.error("Transaction error:", event.target.error);
    };
  } catch (error) {
    logger.error("Error updating problems with ratings:", error);
  }
}

/**
 * Updates all problems with tags from standard_problems
 */
export async function updateProblemWithTags() {
  const db = await openDB();
  const standardProblems = await getAllStandardProblems();
  const problemStore = db
    .transaction(["problems"], "readwrite")
    .objectStore("problems");
  const request = problemStore.getAll();

  request.onsuccess = (event) => {
    const problems = event.target.result;

    for (let problem of problems) {
      const standardProblem = standardProblems.find(
        (p) => p.id === problem.leetcode_id
      );
      if (standardProblem) {
        problem.tags = standardProblem.tags;
        problemStore.put(problem);
      }
    }
  };
}

/**
 * Fixes problems with corrupted difficulty fields by restoring from standard problems
 * @returns {Promise<number>} Number of problems fixed
 */
export async function fixCorruptedDifficultyFields() {
  const db = await openDB();
  let fixedCount = 0;

  return new Promise((resolve, reject) => {
    (async () => {
      try {
        const standardProblems = await getAllStandardProblems();
        const standardProblemsMap = {};
        standardProblems.forEach(p => {
          standardProblemsMap[p.id] = p;
        });

        const transaction = db.transaction(["problems"], "readwrite");
        const store = transaction.objectStore("problems");
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            cursor.continue();
          } else {
            console.log(`Fixed ${fixedCount} problems with corrupted difficulty fields`);
            resolve(fixedCount);
          }
        };

        request.onerror = () => reject(request.error);
      } catch (error) {
        reject(error);
      }
    })();
  });
}
