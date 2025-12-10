/**
 * Problems Retry Helpers
 * Extracted from problems.js for better organization
 * Contains retry-enabled database operations for problems
 */

import { dbHelper } from "../index.js";
import { v4 as uuidv4 } from "uuid";
import { fetchProblemById } from "./standard_problems.js";
import { SessionService } from "../../services/session/sessionService.js";
import indexedDBRetry from "../../services/storage/IndexedDBRetryService.js";
import logger from "../../utils/logging/logger.js";
import { getProblemWithOfficialDifficulty } from "./problems.js";

const openDB = () => dbHelper.openDB();

/**
 * Get problem by ID with retry logic
 * Enhanced version of getProblem() with timeout and retry handling
 * @param {number} problemId - Problem ID to fetch
 * @param {Object} options - Retry configuration options
 * @returns {Promise<Object|null>} Problem data or null
 */
export function getProblemWithRetry(problemId, options = {}) {
  const {
    timeout = indexedDBRetry.quickTimeout,
    operationName = "getProblem",
    priority = "normal",
    abortController = null,
  } = options;

  return indexedDBRetry.executeWithRetry(
    async () => {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(["problems"], "readonly");
        const problemStore = transaction.objectStore("problems");
        const request = problemStore.get(problemId);

        request.onsuccess = (event) => {
          resolve(event.target.result || null);
        };

        request.onerror = () => reject(request.error);
        transaction.onerror = () => reject(transaction.error);
      });
    },
    {
      timeout,
      operationName,
      priority,
      abortController,
      deduplicationKey: `get_problem_${problemId}`,
    }
  );
}

/**
 * Check if problem exists in database with retry logic
 * Enhanced version of checkDatabaseForProblem() with timeout and retry handling
 * @param {number} leetcodeId - Problem ID to check
 * @param {Object} options - Retry configuration options
 * @returns {Promise<boolean>} True if problem exists, false otherwise
 */
export function checkDatabaseForProblemWithRetry(leetcodeId, options = {}) {
  const {
    timeout = indexedDBRetry.quickTimeout,
    operationName = "checkDatabaseForProblem",
    priority = "normal",
    abortController = null,
  } = options;

  // Validate leetcodeId before attempting database operation
  if (leetcodeId == null || isNaN(Number(leetcodeId))) {
    logger.error("Invalid leetcodeId for database lookup with retry:", leetcodeId);
    return Promise.reject(new Error(`Invalid leetcodeId: ${leetcodeId}. Must be a valid number.`));
  }

  return indexedDBRetry.executeWithRetry(
    async () => {
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
        const request = index.get(Number(leetcodeId));

        request.onsuccess = () => {
          resolve(!!request.result);
        };

        request.onerror = () => reject(request.error);
        transaction.onerror = () => reject(transaction.error);
      });
    },
    {
      timeout,
      operationName,
      priority,
      abortController,
      deduplicationKey: `check_problem_${leetcodeId}`,
    }
  );
}

/**
 * Add problem to database with retry logic
 * Enhanced version of addProblem() with timeout and retry handling
 * @param {Object} problemData - Problem data to add
 * @param {Object} options - Retry configuration options
 * @returns {Promise<Object>} Result of add operation
 */
export function addProblemWithRetry(problemData, options = {}) {
  const {
    timeout = indexedDBRetry.defaultTimeout,
    operationName = "addProblem",
    priority = "normal",
    abortController = null,
  } = options;

  return indexedDBRetry.executeWithRetry(
    () => {
      return dbHelper.executeTransaction(
        ["problems", "standard_problems"],
        "readwrite",
        async (tx, stores) => {
          const [problemStore] = stores;

          const _standardProblem = await fetchProblemById(problemData.leetcode_id);

          let session = await SessionService.resumeSession();

          if (!session) {
            throw new Error("No active session found");
          }

          const problemEntry = {
            problem_id: uuidv4(),
            leetcode_id: problemData.leetcode_id,
            title: problemData.title.toLowerCase(),
            box_level: 1,
            review_schedule: new Date().toISOString(),
          };

          return new Promise((resolve, reject) => {
            const request = problemStore.put(problemEntry);
            request.onsuccess = () =>
              resolve({
                success: true,
                problemId: problemEntry.leetcode_id,
                data: problemEntry,
              });
            request.onerror = () => reject(request.error);
          });
        },
        {
          timeout,
          operationName,
          priority,
          abortController,
        }
      );
    },
    {
      timeout,
      operationName,
      priority,
      abortController,
      retries: 2,
    }
  );
}

/**
 * Save updated problem with retry logic
 * Enhanced version of saveUpdatedProblem() with timeout and retry handling
 * @param {Object} problem - Problem data to save
 * @param {Object} options - Retry configuration options
 * @returns {Promise<Object>} Save result
 */
export function saveUpdatedProblemWithRetry(problem, options = {}) {
  const {
    timeout = indexedDBRetry.defaultTimeout,
    operationName = "saveUpdatedProblem",
    priority = "normal",
    abortController = null,
  } = options;

  return indexedDBRetry.executeWithRetry(
    () => {
      return dbHelper.putRecord("problems", problem, {
        timeout,
        operationName,
        priority,
        abortController,
      });
    },
    {
      timeout,
      operationName,
      priority,
      abortController,
      retries: 2,
    }
  );
}

/**
 * Count problems by box level with retry logic
 * Enhanced version of countProblemsByBoxLevel() with timeout and retry handling
 * @param {Object} options - Retry configuration options
 * @returns {Promise<Object>} Box level counts as {boxLevel: count}
 */
export function countProblemsByBoxLevelWithRetry(options = {}) {
  const {
    timeout = indexedDBRetry.defaultTimeout,
    operationName = "countProblemsByBoxLevel",
    priority = "low",
    abortController = null,
  } = options;

  return indexedDBRetry.executeWithRetry(
    async () => {
      const db = await openDB();
      const problems = await new Promise((resolve, reject) => {
        const transaction = db.transaction(["problems"], "readonly");
        const store = transaction.objectStore("problems");
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const boxLevelCounts = {};
      problems.forEach((problem) => {
        const box_level = problem.box_level || 1;
        boxLevelCounts[box_level] = (boxLevelCounts[box_level] || 0) + 1;
      });

      return boxLevelCounts;
    },
    {
      timeout,
      operationName,
      priority,
      abortController,
      deduplicationKey: "count_problems_by_box",
    }
  );
}

/**
 * Fetch all problems with retry logic and streaming support
 * Enhanced version of fetchAllProblems() with timeout and retry handling
 * @param {Object} options - Retry configuration options
 * @returns {Promise<Array>} All problems
 */
export function fetchAllProblemsWithRetry(options = {}) {
  const {
    timeout = indexedDBRetry.bulkTimeout,
    operationName = "fetchAllProblems",
    priority = "low",
    abortController = null,
    streaming = false,
    onProgress = null,
  } = options;

  return indexedDBRetry.executeWithRetry(
    () => {
      return dbHelper.getAllRecords("problems", null, {
        timeout,
        operationName,
        priority,
        abortController,
        streaming,
        onProgress,
      });
    },
    {
      timeout,
      operationName,
      priority,
      abortController,
      retries: 3,
    }
  );
}

/**
 * Get problem with official difficulty using retry logic
 * Enhanced version of getProblemWithOfficialDifficulty() with timeout and retry handling
 * @param {number} leetCodeID - LeetCode problem ID
 * @param {Object} options - Retry configuration options
 * @returns {Promise<Object|null>} Problem with official difficulty
 */
export function getProblemWithOfficialDifficultyWithRetry(leetCodeID, options = {}) {
  const {
    timeout = indexedDBRetry.defaultTimeout,
    operationName = "getProblemWithOfficialDifficulty",
    priority = "normal",
    abortController = null,
  } = options;

  return indexedDBRetry.executeWithRetry(
    () => {
      return getProblemWithOfficialDifficulty(leetCodeID);
    },
    {
      timeout,
      operationName,
      priority,
      abortController,
      deduplicationKey: `problem_official_difficulty_${leetCodeID}`,
    }
  );
}
