/**
 * Problem Service Retry Functions
 * Extracted from problemService.js
 */

import {
  getProblemWithRetry,
  checkDatabaseForProblemWithRetry,
  countProblemsByBoxLevelWithRetry,
  fetchAllProblemsWithRetry,
} from "../../db/stores/problems.js";
import { getProblemFromStandardProblems } from "../../db/stores/standard_problems.js";
import logger from "../../utils/logging/logger.js";

/**
 * Enhanced version of addOrUpdateProblem with retry logic
 */
export async function addOrUpdateProblemWithRetry(
  addOrUpdateProblem,
  contentScriptData,
  sendResponse,
  _options = {}
) {
  try {
    logger.info("Adding/updating problem with retry logic:", contentScriptData);

    const result = await addOrUpdateProblem(contentScriptData);

    logger.info("Problem added/updated successfully with retry:", result);

    if (sendResponse) {
      sendResponse({
        success: true,
        message: "Problem added successfully",
        data: result,
      });
    }

    return result;
  } catch (error) {
    logger.error("Error adding/updating problem:", error);

    if (sendResponse) {
      sendResponse({
        success: false,
        error: "Failed to add problem: " + error.message,
      });
    }

    throw error;
  }
}

/**
 * Enhanced version of getProblemByDescription with retry logic
 */
export async function getProblemByDescriptionWithRetry(
  description,
  slug,
  options = {}
) {
  const {
    timeout = 5000,
    priority = "normal",
    abortController = null,
  } = options;

  try {
    logger.info("Searching for problem with retry logic:", description);

    const problem = await getProblemFromStandardProblems(slug);

    if (problem) {
      logger.info("Problem found in 'Standard_Problems' store:", problem);

      const problemInProblems = await checkDatabaseForProblemWithRetry(
        problem.id,
        {
          timeout,
          priority,
          abortController,
          operationName: "ProblemService.checkDatabaseForProblem",
        }
      );

      if (problemInProblems) {
        logger.info("Problem found in 'problems' store with retry");

        const fullProblem = await getProblemWithRetry(problem.id, {
          timeout,
          priority,
          abortController,
          operationName: "ProblemService.getProblem",
        });

        return { problem: fullProblem, found: true };
      }
    } else {
      logger.warn("Problem not found in any store.");
      return { problem: null, found: false };
    }

    logger.warn("Problem not found in 'problems' store. returning problem from 'Standard_Problems' store");
    logger.info("Returning problem found in 'standard_problems':", problem);

    return { problem, found: true };
  } catch (error) {
    logger.error("Error in getProblemByDescriptionWithRetry:", error);
    throw error;
  }
}

/**
 * Enhanced version of getAllProblems with retry logic and streaming support
 */
export async function getAllProblemsWithRetry(options = {}) {
  const {
    timeout = 15000,
    priority = "low",
    abortController = null,
    streaming = false,
    onProgress = null,
  } = options;

  try {
    logger.info("Fetching all problems with retry logic");

    const problems = await fetchAllProblemsWithRetry({
      timeout,
      priority,
      abortController,
      streaming,
      onProgress,
      operationName: "ProblemService.getAllProblems",
    });

    logger.info(`Fetched ${problems.length} problems with retry logic`);
    return problems;
  } catch (error) {
    logger.error("Error fetching all problems with retry:", error);
    throw error;
  }
}

/**
 * Enhanced version of countProblemsByBoxLevel with retry logic
 */
export async function countProblemsByBoxLevelWithRetryService(options = {}) {
  const { timeout = 5000, priority = "low", abortController = null } = options;

  try {
    logger.info("Counting problems by box level with retry logic");

    const counts = await countProblemsByBoxLevelWithRetry({
      timeout,
      priority,
      abortController,
      operationName: "ProblemService.countProblemsByBoxLevel",
    });

    logger.info("Box level counts with retry:", counts);
    return counts;
  } catch (error) {
    logger.error("Error counting problems by box level with retry:", error);
    throw error;
  }
}

/**
 * Create an abort controller for cancelling operations
 */
export function createAbortController() {
  return new AbortController();
}

/**
 * Enhanced session generation with retry logic and cancellation support
 */
export async function generateSessionWithRetry(
  getAllProblemsWithRetryFn,
  params = {},
  abortController = null
) {
  const {
    sessionLength = 5,
    difficulty = "Medium",
    tags = [],
    streaming = false,
    onProgress = null,
    timeout = 20000,
  } = params;

  try {
    logger.info("Generating session with retry logic", params);

    if (abortController?.signal.aborted) {
      throw new Error("Session generation cancelled before start");
    }

    let allProblems = await getAllProblemsWithRetryFn({
      timeout,
      priority: "high",
      abortController,
      streaming,
      onProgress: streaming
        ? (count) => onProgress?.({ stage: "loading", count })
        : null,
    });

    if (abortController?.signal.aborted) {
      throw new Error("Session generation cancelled after data loading");
    }

    let filteredProblems = allProblems;

    if (difficulty && difficulty !== "Any") {
      filteredProblems = filteredProblems.filter(
        (problem) =>
          problem.difficulty === difficulty || problem.Rating === difficulty
      );
    }

    if (tags && tags.length > 0) {
      filteredProblems = filteredProblems.filter(
        (problem) =>
          problem.tags && problem.tags.some((tag) => tags.includes(tag))
      );
    }

    if (abortController?.signal.aborted) {
      throw new Error("Session generation cancelled during processing");
    }

    const selectedProblems = filteredProblems
      .sort((a, b) => new Date(a.review) - new Date(b.review))
      .slice(0, sessionLength);

    logger.info(`Generated session with ${selectedProblems.length} problems using retry logic`);

    if (onProgress) {
      onProgress({ stage: "complete", count: selectedProblems.length });
    }

    return selectedProblems;
  } catch (error) {
    if (error.message.includes("cancelled")) {
      logger.info("Session generation cancelled:", error.message);
    } else {
      logger.error("Error generating session with retry:", error);
    }
    throw error;
  }
}
