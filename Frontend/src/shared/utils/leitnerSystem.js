import {
  updateStabilityFSRS,
  fetchAllProblems as getAllProblems,
  saveUpdatedProblem,
} from "../db/problems.js";
import { dbHelper } from "../db/index.js";

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

  // Enhanced time evaluation using soft limits
  let timePerformanceScore = 1.0; // Default neutral score
  let exceededTimeLimit = false;

  if (useTimeLimits && attemptData) {
    // Get recommended time limits by difficulty (in minutes)
    const timeLimitsByDifficulty = { 1: 15, 2: 25, 3: 40 };
    const recommendedTimeMinutes =
      timeLimitsByDifficulty[attemptData.Difficulty] || 25;
    const recommendedTimeSeconds = recommendedTimeMinutes * 60;

    const timeSpentSeconds = Number(attemptData.TimeSpent) || 0;

    if (timeSpentSeconds <= recommendedTimeSeconds) {
      // Excellent time performance
      timePerformanceScore = 1.2;
    } else if (timeSpentSeconds <= recommendedTimeSeconds * 1.5) {
      // Good time performance with awareness
      timePerformanceScore = 1.0;
    } else if (timeSpentSeconds <= recommendedTimeSeconds * 2.0) {
      // Acceptable but needs speed work
      timePerformanceScore = 0.8;
    } else {
      // Significant overtime
      timePerformanceScore = 0.6;
      exceededTimeLimit = true;
    }

    // Factor in user intent if available
    if (attemptData.UserIntent === "stuck") {
      timePerformanceScore *= 0.9; // Slight penalty for getting stuck
    } else if (
      attemptData.UserIntent === "solving" &&
      attemptData.ExceededRecommendedTime
    ) {
      timePerformanceScore *= 1.1; // Bonus for persistence
    }
  }

  // Note: problemId available for future use if needed
  // const problemId = problem.id;
  let AttemptStats = problem.AttemptStats;
  const FAILURE_THRESHOLD = 3;
  const COOLDOWN_REVIEW_INTERVAL = 3;
  const boxIntervals = [1, 3, 7, 14, 30, 45, 60, 90];

  AttemptStats.TotalAttempts++;

  // ----- BoxLevel and Attempt Stats Update with Graduated Scoring -----
  if (
    attemptData &&
    (attemptData.Success || (problem.CooldownStatus && attemptData.Success))
  ) {
    problem.CooldownStatus = false;
    problem.ConsecutiveFailures = 0;
    AttemptStats.SuccessfulAttempts++;

    // Graduated box level promotion based on time performance
    if (timePerformanceScore >= 1.2) {
      // Excellent performance - full promotion
      problem.BoxLevel = Math.min(
        problem.BoxLevel + 1,
        boxIntervals.length - 1
      );
    } else if (timePerformanceScore >= 1.0) {
      // Good performance - normal promotion
      problem.BoxLevel = Math.min(
        problem.BoxLevel + 1,
        boxIntervals.length - 1
      );
    } else if (timePerformanceScore >= 0.8) {
      // Acceptable but slow - half promotion (rounded down)
      const promotionAmount = Math.floor(0.5 + problem.BoxLevel * 0.1);
      problem.BoxLevel = Math.min(
        problem.BoxLevel + promotionAmount,
        boxIntervals.length - 1
      );
    } else {
      // Success but very slow - maintain current level (no change needed)
      // problem.BoxLevel remains unchanged
    }
  } else {
    problem.ConsecutiveFailures++;
    AttemptStats.UnsuccessfulAttempts++;

    // Graduated demotion based on time and effort
    if (problem.ConsecutiveFailures >= FAILURE_THRESHOLD) {
      problem.CooldownStatus = true;

      // Softer demotion if user showed effort (time spent or indicated working)
      const showedEffort =
        timePerformanceScore >= 0.8 || attemptData.UserIntent === "solving";
      const demotionAmount = showedEffort ? 0.5 : 1;

      problem.BoxLevel = Math.max(problem.BoxLevel - demotionAmount, 1);
    }
  }

  // ----- Base Next Review Days -----
  let baseDays = boxIntervals[problem.BoxLevel];

  // ----- Enhanced Stability Adjustment -----
  // Update Stability based on success/failure and time performance
  let stabilityAdjustment = updateStabilityFSRS(
    problem.Stability,
    attemptData ? attemptData.Success : false
  );

  // Apply time performance bonus/penalty to stability
  if (attemptData && attemptData.Success) {
    stabilityAdjustment *= timePerformanceScore;
  }

  problem.Stability = stabilityAdjustment;

  // Apply Stability multiplier to next review days
  const stabilityMultiplier = problem.Stability / 2;
  let nextReviewDays = Math.round(baseDays * stabilityMultiplier);
  console.info("nextReviewDays", nextReviewDays);
  // Safety net: Don't allow too short interval
  nextReviewDays = Math.max(1, nextReviewDays);

  // Cooldown override: Ensure minimum review gap
  if (problem.CooldownStatus) {
    nextReviewDays = Math.max(nextReviewDays, COOLDOWN_REVIEW_INTERVAL);
  }

  // ----- Update Problem Stats -----
  if (attemptData) {
    problem.Difficulty += attemptData.Difficulty || 0;
    problem.lastAttemptDate = attemptData.AttemptDate;
  }
  problem.AttemptStats = AttemptStats;
  console.info("attemptData.AttemptDate", attemptData?.AttemptDate);

  // Ensure attemptDate is valid, fallback to current date if invalid
  const attemptDate = attemptData?.AttemptDate
    ? new Date(attemptData.AttemptDate)
    : new Date();
  if (isNaN(attemptDate.getTime())) {
    attemptDate.setTime(Date.now());
  }

  const nextReviewDate = new Date(attemptDate);
  console.info("nextReviewDate", nextReviewDate);
  console.info("nextReviewDays", nextReviewDays);
  nextReviewDate.setDate(nextReviewDate.getDate() + nextReviewDays);
  console.info("nextReviewDate", nextReviewDate);
  problem.ReviewSchedule = nextReviewDate.toISOString();
  console.info("problem.ReviewSchedule", problem.ReviewSchedule);

  console.info(
    "CalculateLeitnerBox - problem.ConsecutiveFailures",
    problem.ConsecutiveFailures
  );
  console.info("Enhanced Leitner Calculation Results:", {
    nextReviewDays,
    stability: problem.Stability,
    boxLevel: problem.BoxLevel,
    timePerformanceScore,
    exceededTimeLimit,
    userIntent: attemptData.UserIntent,
    timeSpent: attemptData.TimeSpent,
    success: attemptData.Success,
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
  evaluateAttempts,
  reassessBoxLevel,
  calculateLeitnerBox,
  updateProblemsWithAttemptStats,
};
