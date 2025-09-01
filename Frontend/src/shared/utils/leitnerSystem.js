import {
  updateStabilityFSRS,
  fetchAllProblems as getAllProblems,
  saveUpdatedProblem,
} from "../db/problems.js";
// eslint-disable-next-line no-restricted-imports
import { dbHelper } from "../db/index.js";
import {
  computeTimePerformanceScore,
  applyBoxLevelAdjustments,
  applyStabilityAdjustment,
  calculateNextReviewDate,
  updateProblemStats
} from "./leitnerHelpers.js";

const openDB = dbHelper.openDB;

export async function evaluateAttempts(problem) {
  const db = await openDB();
  const problemId = problem.id;
  console.info("evaluateAttempt - problemId and problem", problemId, problem);

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["attempts"], "readonly");
    const attemptStore = transaction.objectStore("attempts");
    const index = attemptStore.index("by_problem_and_date");
    let startDate = new Date(2022, 0, 1);
    let endDate = new Date();

    console.info("evaluateAttempts - startDate", startDate.toISOString());
    console.info("evaluateAttempts - endDate", endDate.toISOString());

    const range = IDBKeyRange.bound(
      [problemId, startDate.toISOString()],
      [problemId, endDate.toISOString()],
      false,
      false
    );

    const cursorRequest = index.openCursor(range, "prev");
    const attempts = [];
    let lastAttempt = null;

    cursorRequest.onsuccess = async (event) => {
      const cursor = event.target.result;
      if (cursor) {
        if (!lastAttempt) {
          console.info("First attempt found:", cursor.value);
          lastAttempt = cursor.value;
        }

        attempts.push(cursor.value);
        cursor.continue();
      } else {
        console.info("All attempts sorted:", attempts, "problem", problem);
        let tempProblem = reassessBoxLevel(problem, attempts);
        let updatedProblem = await calculateLeitnerBox(
          tempProblem,
          lastAttempt
        );
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
  attempts.sort((a, b) => new Date(a.AttemptDate) - new Date(b.AttemptDate));

  let stats = {
    TotalAttempts: 0,
    SuccessfulAttempts: 0,
    UnsuccessfulAttempts: 0,
  };

  const boxIntervals = [1, 3, 7, 14, 30, 60, 90, 120];
  const FAILURE_THRESHOLD = 3;
  const COOLDOWN_REVIEW_INTERVAL = 3;

  let currentBoxLevel = 1;
  let consecutiveFailures = 0;
  let avgDifficulty = 0;

  for (const attempt of attempts) {
    avgDifficulty += attempt.Difficulty;
    stats.TotalAttempts++;
    attempt.Success ? stats.SuccessfulAttempts++ : stats.UnsuccessfulAttempts++;

    if (attempt.Success) {
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

  problem.AttemptStats = stats;
  problem.CooldownStatus = stats.UnsuccessfulAttempts >= FAILURE_THRESHOLD;
  problem.BoxLevel = currentBoxLevel;
  console.info("problem.BoxLevel", problem.BoxLevel);

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
  problem.ReviewSchedule = nextReviewDate.toISOString();
  problem.ConsecutiveFailures = consecutiveFailures;
  problem.Difficulty = avgDifficulty;

  return problem;
}

function calculateLeitnerBox(problem, attemptData, useTimeLimits = true) {
  console.info("CalculateLeitnerBox - attemptData", attemptData);
  console.info("problem", problem);

  // Step 1: Calculate time performance score
  const { timePerformanceScore, exceededTimeLimit } = computeTimePerformanceScore(attemptData, useTimeLimits);

  // Step 2: Apply box level adjustments based on success/failure
  problem = applyBoxLevelAdjustments(problem, attemptData, timePerformanceScore);

  // Step 3: Apply FSRS stability adjustments
  problem = applyStabilityAdjustment(problem, attemptData, timePerformanceScore, updateStabilityFSRS);

  // Step 4: Calculate next review date
  const { nextReviewDays, nextReviewDate } = calculateNextReviewDate(problem, attemptData);
  problem.ReviewSchedule = nextReviewDate;

  // Step 5: Update problem statistics
  problem = updateProblemStats(problem, attemptData);

  // Enhanced logging for debugging and telemetry
  console.info("CalculateLeitnerBox - problem.ConsecutiveFailures", problem.ConsecutiveFailures);
  console.info("Enhanced Leitner Calculation Results:", {
    nextReviewDays,
    stability: problem.Stability,
    boxLevel: problem.BoxLevel,
    timePerformanceScore,
    exceededTimeLimit,
    userIntent: attemptData?.UserIntent,
    timeSpent: attemptData?.TimeSpent,
    success: attemptData?.Success,
  });

  return problem;
}

async function updateProblemsWithAttemptStats() {
  const problems = await getAllProblems();
  for (const problem of problems) {
    const updatedProblem = await evaluateAttempts(problem);
    await saveUpdatedProblem(updatedProblem);
  }
}

export {
  reassessBoxLevel,
  calculateLeitnerBox,
  updateProblemsWithAttemptStats,
};
