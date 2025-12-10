import { dbHelper } from "../index.js";

import { AttemptsService } from "../../services/attempts/attemptsService.js";

import { getAllStandardProblems } from "./standard_problems.js";
import { fetchProblemById } from "./standard_problems.js";
import { v4 as uuidv4 } from "uuid";

import { SessionService } from "../../services/session/sessionService.js";
import logger from "../../utils/logging/logger.js";

// Re-export selection helpers for backwards compatibility
export {
  normalizeTags,
  getDifficultyScore,
  getSingleLadder,
  filterProblemsByDifficultyCap,
  loadProblemSelectionContext,
  logProblemSelectionStart,
  calculateTagDifficultyAllowances,
  logSelectedProblems,
  selectProblemsForTag,
  addExpansionProblems,
  selectPrimaryAndExpansionProblems,
  expandWithRemainingFocusTags,
  fillRemainingWithRandomProblems
} from "./problemSelectionHelpers.js";

// Re-export retry helpers for backwards compatibility
export {
  getProblemWithRetry,
  checkDatabaseForProblemWithRetry,
  addProblemWithRetry,
  saveUpdatedProblemWithRetry,
  countProblemsByBoxLevelWithRetry,
  fetchAllProblemsWithRetry,
  getProblemWithOfficialDifficultyWithRetry
} from "./problemsRetryHelpers.js";

// Import selection helpers for internal use
import {
  loadProblemSelectionContext,
  logProblemSelectionStart,
  calculateTagDifficultyAllowances,
  selectPrimaryAndExpansionProblems,
  expandWithRemainingFocusTags,
  fillRemainingWithRandomProblems
} from "./problemSelectionHelpers.js";

const openDB = () => dbHelper.openDB();

/**
 * Updates problems with rating increases based on attempts.
 * @returns {Promise<string>} - Returns a message indicating the completion of the operation.
 */
export const updateProblemsWithRatings = async () => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("problems", "readwrite");
    const store = transaction.objectStore("problems");

    const request = store.openCursor();
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        const problem = cursor.value;
        problem.rating = problem.rating ? problem.rating + 1 : 1;
        store.put(problem);
        cursor.continue();
      } else {
        resolve("Problems updated with ratings");
      }
    };
    request.onerror = () => reject(request.error);
  });
};

/**
 * Fetches a problem by its ID.
 * @param {string} problemId - The ID of the problem.
 * @returns {Promise<Object|null>} - The problem object or null if not found.
 */
export async function getProblem(problemId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["problems"], "readonly");
    const problemStore = transaction.objectStore("problems");

    const request = problemStore.get(problemId);

    request.onsuccess = (event) => {
      resolve(event.target.result || null);
    };
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Fetch details of problems by IDs from standard_problems
 * @param {IDBDatabase} db - IndexedDB instance
 * @param {Array<string>} problemIds - List of problem IDs
 * @returns {Promise<Array>} - List of problems
 */
export async function fetchProblemsByIdsWithTransaction(db, problemIds) {
  const transaction = db.transaction(["standard_problems"], "readonly");
  const standardProblemsStore = transaction.objectStore("standard_problems");

  const problems = await Promise.all(
    problemIds.map(
      (id) =>
        new Promise((resolve) => {
          const request = standardProblemsStore.get(id);
          request.onsuccess = (event) => resolve(event.target.result || null);
          request.onerror = () => resolve(null);
        })
    )
  );

  return problems.filter(Boolean);
}

/**
 * Saves an updated problem in the database.
 * @param {Object} problem - The updated problem object.
 * @returns {Promise<void>}
 */
export async function saveUpdatedProblem(problem) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["problems"], "readwrite");
    const store = transaction.objectStore("problems");

    const request = store.put(problem);
    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Fetches a problem by description.
 * @param {string} description - The problem description.
 * @returns {Promise<Object|null>} - The problem object or null if not found.
 */
export async function getProblemByDescription(description, _slug) {
  logger.info("getProblemByDescription called with:", description);

  if (!description) {
    logger.error("Error: No description provided.");
    return null;
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["problems"], "readonly");
    const store = transaction.objectStore("problems");

    if (!store.indexNames.contains("by_title")) {
      logger.error("Error: Index 'by_title' does not exist.");
      reject(new Error("Index missing: by_title"));
      return;
    }

    let index;
    try {
      index = store.index("by_title");
    } catch (error) {
      console.error(`PROBLEMS INDEX ERROR: by_title index not found in problems`, {
        error: error.message,
        availableIndexes: Array.from(store.indexNames),
        storeName: "problems"
      });
      reject(error);
      return;
    }

    const request = index.get(description.toLowerCase());

    request.onsuccess = (event) => {
      const result = event.target.result;
      if (result) {
        logger.info("Problem found:", result);
        resolve(result);
      } else {
        logger.warn("Problem not found for description:", description);
        resolve(false);
      }
    };

    request.onerror = (event) => {
      logger.error("Error fetching problem:", event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Adds a problem to the database.
 * @param {Object} problemData - The problem data.
 * @returns {Promise<void>}
 */
export async function addProblem(problemData) {
  try {
    const db = await openDB();
    const _standardProblem = await fetchProblemById(problemData.leetcode_id);

    const transaction = db.transaction(["problems"], "readwrite");
    const store = transaction.objectStore("problems");

    let index;
    try {
      index = store.index("by_leetcode_id");
    } catch (error) {
      console.error(`PROBLEMS INDEX ERROR: by_leetcode_id index not found in problems`, {
        error: error.message,
        availableIndexes: Array.from(store.indexNames),
        storeName: "problems"
      });
      throw error;
    }

    const existingCheck = index.get(Number(problemData.leetcode_id));
    const existingProblem = await new Promise((resolve, reject) => {
      existingCheck.onsuccess = () => {
        const result = existingCheck.result;
        logger.info("Duplicate check result:", result ? "Found existing problem" : "No duplicate found");
        resolve(result);
      };
      existingCheck.onerror = () => {
        logger.error("Error checking for duplicate problem:", existingCheck.error);
        reject(existingCheck.error);
      };
    });

    if (existingProblem) {
      logger.info("Problem already exists, not creating duplicate:", existingProblem);
      return existingProblem;
    }

    const problemId = uuidv4();
    const attemptId = uuidv4();

    const leetCodeID = problemData.leetcode_id
      ? Number(problemData.leetcode_id)
      : null;
    const address = problemData.address;
    const problem = {
      problem_id: problemId,
      leetcode_id: leetCodeID,
      title: problemData.title.toLowerCase(),
      leetcode_address: address,
      cooldown_status: false,
      box_level: 1,
      review_schedule: problemData.reviewSchedule,
      perceived_difficulty: null,
      consecutive_failures: 0,
      stability: 1.0,
      attempt_stats: {
        total_attempts: 0,
        successful_attempts: 0,
        unsuccessful_attempts: 0,
      }
    };
    logger.info("Adding problem:", problem);
    const request = store.add(problem);
    transaction.oncomplete = async function () {
      logger.info("Problem added successfully:", problem);

      let session = await SessionService.resumeSession();

      if (!session) {
        logger.warn("No active session found, creating session");
        session = await SessionService.getOrCreateSession();
      }

      const attemptData = {
        id: attemptId,
        problem_id: problemId,
        leetcode_id: leetCodeID,
        success: problemData.success,
        attempt_date: problemData.date,
        time_spent: Number(problemData.timeSpent),
        perceived_difficulty: problemData.difficulty || 1,
        comments: problemData.comments || "",
        box_level: 1,
        next_review_date: null,
        session_id: session.id,
        exceeded_recommended_time: problemData.exceededRecommendedTime || false,
        overage_time: Number(problemData.overageTime) || 0,
        user_intent: problemData.userIntent || "completed",
        time_warning_level: Number(problemData.timeWarningLevel) || 0,
      };

      try {
        if (!AttemptsService || !AttemptsService.addAttempt) {
          throw new Error(
            "attemptsService is undefined or missing addAttempt method."
          );
        }

        await AttemptsService.addAttempt(attemptData, problem);
        logger.info("Attempt and problem added successfully.");
      } catch (error) {
        logger.error("Error adding attempt:", error);
      }
    };

    request.onerror = function (event) {
      logger.error("Error adding problem:", event.target.error);
    };
  } catch (error) {
    logger.error("Error in addProblem function:", error);
  }
}

/**
 * Counts problems grouped by Leitner box level.
 * @returns {Promise<Object>} - An object with counts per box level.
 */
export async function countProblemsByBoxLevel() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["problems"], "readonly");
    const store = transaction.objectStore("problems");

    const boxLevelCounts = {};
    const request = store.openCursor();

    request.onsuccess = function (event) {
      const cursor = event.target.result;
      if (cursor) {
        const { box_level = 1 } = cursor.value;
        boxLevelCounts[box_level] = (boxLevelCounts[box_level] || 0) + 1;
        cursor.continue();
      } else {
        resolve(boxLevelCounts);
      }
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Checks if a problem exists in the database by its ID.
 * @param {string} leetcodeId - The LeetCode problem ID.
 * @returns {Promise<Object|null>} - Returns the problem if exists, null otherwise.
 */
export async function checkDatabaseForProblem(leetcodeId) {
  if (leetcodeId == null || isNaN(Number(leetcodeId))) {
    logger.error("Invalid leetcodeId for database lookup:", leetcodeId);
    throw new Error(`Invalid leetcodeId: ${leetcodeId}. Must be a valid number.`);
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["problems"], "readonly");
    const store = transaction.objectStore("problems");
    let index;
    try {
      index = store.index("by_leetcode_id");
    } catch (error) {
      console.error(`PROBLEMS INDEX ERROR: by_leetcode_id index not found in problems`, {
        error: error.message,
        availableIndexes: Array.from(store.indexNames),
        storeName: "problems"
      });
      reject(error);
      return;
    }
    logger.info("leetcodeId lookup:", leetcodeId);
    const request = index.get(Number(leetcodeId));

    request.onsuccess = () => {
      logger.info("Problem found in database by leetcode_id:", request.result);
      resolve(request.result);
    };
    request.onerror = () => {
      logger.error("Error checking database for problem by leetcode_id:", request.error);
      reject(request.error);
    };
  });
}

export async function fetchAllProblems() {
  console.log('FETCH ALL PROBLEMS: Starting to fetch problems...');
  const db = await openDB();
  console.log('FETCH ALL PROBLEMS: Database opened:', db.name);
  const transaction = db.transaction("problems", "readonly");
  const objectStore = transaction.objectStore("problems");
  const cursorRequest = objectStore.openCursor();
  const problems = [];

  return new Promise((resolve, _reject) => {
    cursorRequest.onsuccess = function (event) {
      const cursor = event.target.result;

      if (cursor) {
        console.log('FETCH ALL PROBLEMS: Found problem:', cursor.value.id, cursor.value.title);
        problems.push(cursor.value);
        cursor.continue();
      } else {
        console.log('FETCH ALL PROBLEMS: Finished. Total problems found:', problems.length);
        resolve(problems);
      }
    };

    cursorRequest.onerror = function (event) {
      logger.error(
        "Error fetching problems from IndexedDB:",
        event.target.error
      );
      resolve([]);
    };
  });
}

export async function fetchAdditionalProblems(
  numNewProblems,
  excludeIds = new Set(),
  _userFocusAreas = [],
  _currentAllowedTags = [],
  options = {}
) {
  const { currentDifficultyCap = null, isOnboarding = false } = options;
  logger.info("fetchAdditionalProblems called with isOnboarding:", isOnboarding);

  try {
    const context = await loadProblemSelectionContext(currentDifficultyCap, fetchAllProblems);
    logProblemSelectionStart(numNewProblems, context);

    const tagDifficultyAllowances = calculateTagDifficultyAllowances(
      context.enhancedFocusTags, context.masteryData, context.tagRelationshipsRaw
    );

    const { selectedProblems, usedProblemIds } = await selectPrimaryAndExpansionProblems(
      numNewProblems, context, tagDifficultyAllowances, currentDifficultyCap, excludeIds
    );

    await expandWithRemainingFocusTags({
      numNewProblems, selectedProblems, usedProblemIds, context, currentDifficultyCap
    });

    fillRemainingWithRandomProblems(
      numNewProblems, selectedProblems, usedProblemIds, context.availableProblems
    );

    logger.info(`Final selection: ${selectedProblems.length} problems`);
    return selectedProblems;
  } catch (error) {
    logger.error("Error in fetchAdditionalProblems:", error);
    return [];
  }
}

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
 *
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
 * @returns {Promise<void>}
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
 * Gets problem data with official difficulty from standard_problems
 * Merges user problem data with official difficulty information
 * @param {number} leetCodeID - The LeetCode problem ID
 * @returns {Promise<Object|null>} - Problem with official difficulty or null
 */
export async function getProblemWithOfficialDifficulty(leetCodeID) {
  try {
    const db = await openDB();

    const problemTx = db.transaction("problems", "readonly");
    const problemStore = problemTx.objectStore("problems");

    const userProblem = await new Promise((resolve, reject) => {
      let index;
      try {
        index = problemStore.index("by_leetcode_id");
      } catch (error) {
        console.error(`PROBLEMS INDEX ERROR: by_leetcode_id index not found in problems`, {
          error: error.message,
          availableIndexes: Array.from(problemStore.indexNames),
          storeName: "problems"
        });
        reject(error);
        return;
      }
      const request = index.get(leetCodeID);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });

    const standardProblem = await fetchProblemById(leetCodeID);

    if (!standardProblem) {
      logger.warn(
        `No standard problem found for LeetCode ID: ${leetCodeID}`
      );
      return {
        ...userProblem,
        id: userProblem?.leetcode_id || leetCodeID,
        leetcode_id: userProblem?.leetcode_id || leetCodeID,
        problemId: userProblem?.problem_id,
        title: userProblem?.title,
        difficulty: userProblem?.difficulty || userProblem?.Rating || "Unknown",
        tags: userProblem?.tags || userProblem?.Tags || [],
        boxLevel: userProblem?.box_level,
        reviewSchedule: userProblem?.review_schedule,
        cooldownStatus: userProblem?.cooldown_status,
        perceivedDifficulty: userProblem?.perceived_difficulty,
        consecutiveFailures: userProblem?.consecutive_failures,
        attemptStats: userProblem?.attempt_stats,
      };
    }

    const mergedProblem = {
      ...userProblem,
      id: userProblem?.leetcode_id || leetCodeID,
      leetcode_id: userProblem?.leetcode_id || leetCodeID,
      problemId: userProblem?.problem_id,
      difficulty: standardProblem.difficulty || userProblem?.difficulty || userProblem?.Rating || "Unknown",
      tags: standardProblem.tags || userProblem?.tags || userProblem?.Tags || [],
      title: standardProblem.title || userProblem?.title,
      boxLevel: userProblem?.box_level,
      reviewSchedule: userProblem?.review_schedule,
      cooldownStatus: userProblem?.cooldown_status,
      perceivedDifficulty: userProblem?.perceived_difficulty,
      consecutiveFailures: userProblem?.consecutive_failures,
      attemptStats: userProblem?.attempt_stats,
    };

    return mergedProblem;
  } catch (error) {
    logger.error(
      `Error getting problem with official difficulty for ID ${leetCodeID}:`,
      error
    );
    return null;
  }
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
