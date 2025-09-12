/**
 * Helper functions for Leitner System calculations
 * Extracted to reduce complexity and improve readability
 */

const BOX_INTERVALS = [1, 3, 7, 14, 30, 45, 60, 90];
const FAILURE_THRESHOLD = 3;
const COOLDOWN_REVIEW_INTERVAL = 3;
const TIME_LIMITS_BY_DIFFICULTY = { 1: 15, 2: 25, 3: 40 };

/**
 * Calculate time performance score based on attempt data
 */
export function computeTimePerformanceScore(attemptData, useTimeLimits = true) {
  if (!useTimeLimits || !attemptData) {
    return { timePerformanceScore: 1.0, exceededTimeLimit: false };
  }

  const recommendedTimeMinutes = TIME_LIMITS_BY_DIFFICULTY[attemptData.Difficulty] || 25;
  const recommendedTimeSeconds = recommendedTimeMinutes * 60;
  const timeSpentSeconds = Number(attemptData.TimeSpent) || 0;

  let timePerformanceScore = 1.0;
  let exceededTimeLimit = false;

  // Calculate base score from time performance
  if (timeSpentSeconds <= recommendedTimeSeconds) {
    timePerformanceScore = 1.2; // Excellent
  } else if (timeSpentSeconds <= recommendedTimeSeconds * 1.5) {
    timePerformanceScore = 1.0; // Good
  } else if (timeSpentSeconds <= recommendedTimeSeconds * 2.0) {
    timePerformanceScore = 0.8; // Acceptable but slow
  } else {
    timePerformanceScore = 0.6; // Significant overtime
    exceededTimeLimit = true;
  }

  // Apply user intent modifiers
  if (attemptData.UserIntent === "stuck") {
    timePerformanceScore *= 0.9; // Slight penalty
  } else if (attemptData.UserIntent === "solving" && attemptData.ExceededRecommendedTime) {
    timePerformanceScore *= 1.1; // Bonus for persistence
  }

  return { timePerformanceScore, exceededTimeLimit };
}

/**
 * Calculate box level adjustments based on success/failure and performance
 */
export function applyBoxLevelAdjustments(problem, attemptData, timePerformanceScore) {
  // Defensive programming: Initialize AttemptStats if missing
  if (!problem.AttemptStats) {
    problem.AttemptStats = {
      TotalAttempts: 0,
      SuccessfulAttempts: 0,
      UnsuccessfulAttempts: 0
    };
  }
  
  const AttemptStats = problem.AttemptStats;
  AttemptStats.TotalAttempts++;

  const isSuccess = attemptData && (attemptData.Success || (problem.CooldownStatus && attemptData.Success));

  if (isSuccess) {
    // Handle success case
    problem.CooldownStatus = false;
    problem.ConsecutiveFailures = 0;
    AttemptStats.SuccessfulAttempts++;

    // Graduated box level promotion
    if (timePerformanceScore >= 1.2) {
      problem.BoxLevel = Math.min(problem.BoxLevel + 1, BOX_INTERVALS.length - 1);
    } else if (timePerformanceScore >= 1.0) {
      problem.BoxLevel = Math.min(problem.BoxLevel + 1, BOX_INTERVALS.length - 1);
    } else if (timePerformanceScore >= 0.8) {
      const promotionAmount = Math.floor(0.5 + problem.BoxLevel * 0.1);
      problem.BoxLevel = Math.min(problem.BoxLevel + promotionAmount, BOX_INTERVALS.length - 1);
    }
    // For timePerformanceScore < 0.8, maintain current level (no change)
  } else {
    // Handle failure case
    problem.ConsecutiveFailures++;
    AttemptStats.UnsuccessfulAttempts++;

    if (problem.ConsecutiveFailures >= FAILURE_THRESHOLD) {
      problem.CooldownStatus = true;

      // Graduated demotion based on effort
      const showedEffort = timePerformanceScore >= 0.8 || attemptData?.UserIntent === "solving";
      const demotionAmount = showedEffort ? 0.5 : 1;
      problem.BoxLevel = Math.max(problem.BoxLevel - demotionAmount, 1);
    }
  }

  problem.AttemptStats = AttemptStats;
  return problem;
}

/**
 * Apply FSRS stability adjustments
 */
export function applyStabilityAdjustment(problem, attemptData, timePerformanceScore, updateStabilityFSRS) {
  let stabilityAdjustment = updateStabilityFSRS(
    problem.Stability,
    attemptData ? attemptData.Success : false
  );

  // Apply time performance bonus/penalty to stability
  if (attemptData && attemptData.Success) {
    stabilityAdjustment *= timePerformanceScore;
  }

  problem.Stability = stabilityAdjustment;
  return problem;
}

/**
 * Calculate next review date based on box level and stability
 */
export function calculateNextReviewDate(problem, attemptData) {
  // Get base days from box level
  const baseDays = BOX_INTERVALS[problem.BoxLevel];

  // Apply stability multiplier
  const stabilityMultiplier = problem.Stability / 2;
  let nextReviewDays = Math.round(baseDays * stabilityMultiplier);

  // Safety nets
  nextReviewDays = Math.max(1, nextReviewDays); // Don't allow too short interval
  
  if (problem.CooldownStatus) {
    nextReviewDays = Math.max(nextReviewDays, COOLDOWN_REVIEW_INTERVAL);
  }

  // Calculate the actual date
  const attemptDate = attemptData?.AttemptDate ? new Date(attemptData.AttemptDate) : new Date();
  if (isNaN(attemptDate.getTime())) {
    attemptDate.setTime(Date.now());
  }

  const nextReviewDate = new Date(attemptDate);
  nextReviewDate.setDate(nextReviewDate.getDate() + nextReviewDays);
  
  // Defensive programming: Handle invalid date calculations
  if (isNaN(nextReviewDate.getTime())) {
    // Fallback to a reasonable next review date (1 day from now)
    nextReviewDate.setTime(Date.now() + 24 * 60 * 60 * 1000);
  }
  
  return {
    nextReviewDays,
    nextReviewDate: nextReviewDate.toISOString()
  };
}

/**
 * Update problem statistics from attempt data
 */
export function updateProblemStats(problem, attemptData) {
  if (attemptData) {
    problem.Difficulty += attemptData.Difficulty || 0;
    problem.lastAttemptDate = attemptData.AttemptDate;
  }
  return problem;
}