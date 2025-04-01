import { updateStabilityFSRS } from "../db/problems.js";


async function evaluateAttempts(problem) {
  const db = await getDatabase();
  const problemId = problem.id;
  console.log("evaluateAttempt - problemId and problem", problemId, problem);

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["attempts"], "readonly");
    const attemptStore = transaction.objectStore("attempts");
    const index = attemptStore.index("by_problem_and_date");
    let startDate = new Date(2022, 0, 1);
    let endDate = new Date();

    console.log("evaluateAttempts - startDate", startDate.toISOString());
    console.log("evaluateAttempts - endDate", endDate.toISOString());

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
          console.log("First attempt found:", cursor.value);
          lastAttempt = cursor.value;
        }

        attempts.push(cursor.value);
        cursor.continue();
      } else {
        console.log("All attempts sorted:", attempts, "problem", problem);
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
  console.log("problem.BoxLevel", problem.BoxLevel);

  let nextReviewDays = boxIntervals[currentBoxLevel - 1];

  console.log("nextReviewDays", nextReviewDays);
  if (problem.CooldownStatus) {
    nextReviewDays = Math.max(nextReviewDays, COOLDOWN_REVIEW_INTERVAL);
  }

  const nextReviewDate = new Date(problem.lastAttemptDate);
  nextReviewDate.setDate(nextReviewDate.getDate() + nextReviewDays);
  problem.ReviewSchedule = nextReviewDate.toISOString();
  problem.ConsecutiveFailures = consecutiveFailures;
  problem.Difficulty = avgDifficulty;

  return problem;
}

async function calculateLeitnerBox(
  problem,
  attemptData,
  useTimeLimits = false
) {
  console.log("CalculateLeitnerBox - attemptData", attemptData);
  console.log("problem", problem);

  let exceededTimeLimit = false;
  if (useTimeLimits) {
    const timeLimitsByDifficulty = { 1: 15, 2: 25, 3: 35 };
    const allowedTime =
      timeLimitsByDifficulty[
        attemptData.Difficulty / problem.AttemptStats.TotalAttempts
      ];
    exceededTimeLimit = attemptData.TimeSpent > allowedTime;
  }

  const problemId = problem.id;
  let AttemptStats = problem.AttemptStats;
  const FAILURE_THRESHOLD = 3;
  const COOLDOWN_REVIEW_INTERVAL = 3;
  const boxIntervals = [1, 3, 7, 14, 30, 45, 60, 90];

  AttemptStats.TotalAttempts++;

  // ----- BoxLevel and Attempt Stats Update -----
  if (attemptData.Success || (problem.CooldownStatus && attemptData.Success)) {
    problem.CooldownStatus = false;
    problem.ConsecutiveFailures = 0;
    AttemptStats.SuccessfulAttempts++;
    problem.BoxLevel = exceededTimeLimit
      ? Math.max(problem.BoxLevel, 1)
      : Math.min(problem.BoxLevel + 1, boxIntervals.length - 1);
  } else {
    problem.ConsecutiveFailures++;
    AttemptStats.UnsuccessfulAttempts++;

    if (problem.ConsecutiveFailures >= FAILURE_THRESHOLD) {
      problem.CooldownStatus = true;
      problem.BoxLevel = Math.max(problem.BoxLevel - 1, 1);
    }
  }

  // ----- Base Next Review Days -----
  let baseDays = boxIntervals[problem.BoxLevel];

  // ----- Stability Adjustment -----
  // Update Stability based on success/failure
  problem.Stability = updateStabilityFSRS(
    problem.Stability,
    attemptData.Success
  );

  // Apply Stability multiplier to next review days
  const stabilityMultiplier = problem.Stability / 2;
  let nextReviewDays = Math.round(baseDays * stabilityMultiplier);
  console.log("nextReviewDays", nextReviewDays);
  // Safety net: Don't allow too short interval
  nextReviewDays = Math.max(1, nextReviewDays);

  // Cooldown override: Ensure minimum review gap
  if (problem.CooldownStatus) {
    nextReviewDays = Math.max(nextReviewDays, COOLDOWN_REVIEW_INTERVAL);
  }

  // ----- Update Problem Stats -----
  problem.Difficulty += attemptData.Difficulty;
  problem.lastAttemptDate = attemptData.AttemptDate;
  problem.AttemptStats = AttemptStats;
  console.log("attemptData.AttemptDate", attemptData.AttemptDate);
  const nextReviewDate = new Date(attemptData.AttemptDate);
  console.log("nextReviewDate", nextReviewDate);
  console.log("nextReviewDays", nextReviewDays);
  nextReviewDate.setDate(nextReviewDate.getDate() + nextReviewDays);
  console.log("nextReviewDate", nextReviewDate);
  problem.ReviewSchedule = nextReviewDate.toISOString();
  console.log("problem.ReviewSchedule", problem.ReviewSchedule);

  console.log(
    "CalculateLeitnerBox - problem.ConsecutiveFailures",
    problem.ConsecutiveFailures
  );
  console.log(
    "Next Review Days:",
    nextReviewDays,
    "| Stability:",
    problem.Stability,
    "| Box Level:",
    problem.BoxLevel
  );

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
