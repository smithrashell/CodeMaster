import {
  updateStabilityFSRS,
  fetchAllProblems as getAllProblems,
} from "../../db/stores/problems.js";
// eslint-disable-next-line no-restricted-imports
import { dbHelper } from "../../db/index.js";
import {
  calculateTimePerformanceScore,
  applyBoxLevelAdjustments,
  applyStabilityAdjustment,
  calculateNextReviewDate,
  updateProblemStats
} from "./leitnerHelpers.js";

const openDB = dbHelper.openDB;

export async function evaluateAttempts(problem) {
  const db = await openDB();
  const problemId = problem.problem_id || problem.id;
  console.info("evaluateAttempt - problemId and problem", problemId, problem);

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["attempts"], "readonly");
    const attemptStore = transaction.objectStore("attempts");
    // Use simple by_problem_id index to avoid compound key type mismatches
    // (attempt_date may be stored as Date objects or ISO strings depending on version)
    const index = attemptStore.index("by_problem_id");
    const range = IDBKeyRange.only(problemId);

    const cursorRequest = index.openCursor(range);
    const attempts = [];

    cursorRequest.onsuccess = async (event) => {
      const cursor = event.target.result;
      if (cursor) {
        attempts.push(cursor.value);
        cursor.continue();
      } else {
        console.info(`evaluateAttempts: Found ${attempts.length} attempts for problem ${problemId}`);

        // Rebuild all stats from complete attempt history
        let updatedProblem = reassessBoxLevel(problem, attempts);

        // Recalculate stability from all attempts (FSRS model)
        // Start from initial stability and replay each attempt
        let stability = 1.0;
        for (const attempt of attempts) {
          const isSuccess = attempt.success !== undefined ? attempt.success : attempt.Success;
          stability = updateStabilityFSRS(stability, !!isSuccess);
        }
        updatedProblem.stability = parseFloat(stability.toFixed(2));

        resolve(updatedProblem);
      }
    };

    cursorRequest.onerror = (event) => {
      console.error(
        "Error in evaluating attempts for problem ID " + problemId,
        event.target.errorCode
      );
      reject(event.target.errorCode);
    };
  });
}

function reassessBoxLevel(problem, attempts) {
  // Sort by date - handle both uppercase and lowercase property names
  attempts.sort((a, b) => {
    const dateA = new Date(a.attempt_date || a.AttemptDate);
    const dateB = new Date(b.attempt_date || b.AttemptDate);
    return dateA - dateB;
  });

  let stats = {
    total_attempts: 0,
    successful_attempts: 0,
    unsuccessful_attempts: 0,
  };

  const boxIntervals = [1, 3, 7, 14, 30, 60, 90, 120];
  const FAILURE_THRESHOLD = 3;
  const COOLDOWN_REVIEW_INTERVAL = 3;

  // Start from the problem's existing box level, or default to 1 if not set
  let currentBoxLevel = Math.round(problem.boxLevel || problem.box_level || 1);
  let consecutiveFailures = 0;
  let totalPerceivedDifficulty = 0;

  for (const attempt of attempts) {
    // Use perceived_difficulty for user difficulty assessment, not actual difficulty
    // Handle both uppercase and lowercase property names
    totalPerceivedDifficulty += attempt.perceived_difficulty || attempt.Difficulty || 2; // Default to 2 (Medium)
    stats.total_attempts++;
    // Handle both uppercase and lowercase Success property
    const isSuccess = attempt.success !== undefined ? attempt.success : attempt.Success;
    isSuccess ? stats.successful_attempts++ : stats.unsuccessful_attempts++;

    if (isSuccess) {
      consecutiveFailures = 0;
      currentBoxLevel = Math.min(currentBoxLevel + 1, boxIntervals.length);
    } else {
      consecutiveFailures++;
      if (consecutiveFailures >= FAILURE_THRESHOLD) {
        currentBoxLevel = Math.max(currentBoxLevel - 1, 1);
        consecutiveFailures = 0;
      }
    }
  }

  problem.attempt_stats = stats;
  problem.cooldown_status = stats.unsuccessful_attempts >= FAILURE_THRESHOLD;
  problem.box_level = currentBoxLevel;
  console.info("problem.box_level", problem.box_level);

  let nextReviewDays = boxIntervals[currentBoxLevel - 1];

  console.info("nextReviewDays", nextReviewDays);
  if (problem.CooldownStatus) {
    nextReviewDays = Math.max(nextReviewDays, COOLDOWN_REVIEW_INTERVAL);
  }

  // Ensure lastAttemptDate is valid, fallback to current date if invalid
  const lastAttemptDate = problem.lastAttemptDate
    ? new Date(problem.lastAttemptDate)
    : new Date();
  if (isNaN(lastAttemptDate.getTime())) {
    // If still invalid, use current date
    lastAttemptDate.setTime(Date.now());
  }

  const nextReviewDate = new Date(lastAttemptDate);
  nextReviewDate.setDate(nextReviewDate.getDate() + nextReviewDays);
  problem.review_schedule = nextReviewDate.toISOString();
  problem.consecutive_failures = consecutiveFailures;

  // Store perceived difficulty as numeric average (preserve original difficulty from standard problems)
  if (stats.total_attempts > 0) {
    problem.perceived_difficulty = Math.round(totalPerceivedDifficulty / stats.total_attempts);
  }

  return problem;
}

function calculateLeitnerBox(problem, attemptData) {
  console.info("CalculateLeitnerBox - attemptData", attemptData);
  console.info("problem", problem);

  // Step 1: Calculate time performance score
  const { timePerformanceScore, exceededTimeLimit } = calculateTimePerformanceScore(attemptData);

  // Step 2: Apply box level adjustments based on success/failure
  problem = applyBoxLevelAdjustments(problem, attemptData, timePerformanceScore);

  // Step 3: Apply FSRS stability adjustments
  problem = applyStabilityAdjustment(problem, attemptData, timePerformanceScore, updateStabilityFSRS);

  // Step 4: Calculate next review date
  const { nextReviewDays, nextReviewDate } = calculateNextReviewDate(problem, attemptData);
  problem.review_schedule = nextReviewDate;

  // Step 5: Update problem statistics
  problem = updateProblemStats(problem, attemptData);

  // Enhanced logging for debugging and telemetry
  console.info("CalculateLeitnerBox - problem.consecutive_failures", problem.consecutive_failures);
  console.info("Enhanced Leitner Calculation Results:", {
    nextReviewDays,
    stability: problem.Stability,
    boxLevel: problem.box_level,
    timePerformanceScore,
    exceededTimeLimit,
    userIntent: attemptData?.user_intent,
    timeSpent: attemptData?.time_spent,
    success: attemptData?.success,
  });

  return problem;
}

async function updateProblemsWithAttemptStats() {
  const problems = await getAllProblems();

  // Phase 1: compute all updates (read-only, no writes)
  const updatedProblems = [];
  for (const problem of problems) {
    try {
      const updatedProblem = await evaluateAttempts(problem);
      updatedProblems.push(updatedProblem);
    } catch (error) {
      console.warn(`⚠️ Skipping problem ${problem.problem_id || problem.id}: ${error.message}`);
      updatedProblems.push(problem);
    }
  }

  // Phase 2: write all at once in a single atomic transaction
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["problems"], "readwrite");
    const store = tx.objectStore("problems");

    for (const problem of updatedProblems) {
      store.put(problem);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Transaction aborted"));
  });
}

export {
  reassessBoxLevel,
  calculateLeitnerBox,
  updateProblemsWithAttemptStats,
};
