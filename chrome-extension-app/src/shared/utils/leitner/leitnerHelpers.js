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
export function calculateTimePerformanceScore(attemptData, useTimeLimits = true) {
  if (!useTimeLimits || !attemptData) {
    return { timePerformanceScore: 1.0, exceededTimeLimit: false };
  }

  const recommendedTimeMinutes = TIME_LIMITS_BY_DIFFICULTY[attemptData.difficulty] || 25;
  const recommendedTimeSeconds = recommendedTimeMinutes * 60;
  const timeSpentSeconds = Number(attemptData.time_spent) || 0;

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
  // Defensive programming: Initialize attempt_stats if missing
  if (!problem.attempt_stats) {
    problem.attempt_stats = {
      total_attempts: 0,
      successful_attempts: 0,
      unsuccessful_attempts: 0
    };
  }
  
  const attemptStats = problem.attempt_stats;
  attemptStats.total_attempts++;

  const isSuccess = attemptData && attemptData.success;

  if (isSuccess) {
    // Handle success case
    problem.cooldown_status = false;
    problem.consecutive_failures = 0;
    problem.attempt_stats.successful_attempts++;

    // Graduated box level promotion
    if (timePerformanceScore >= 1.2) {
      problem.box_level = Math.min(problem.box_level + 1, BOX_INTERVALS.length - 1);
    } else if (timePerformanceScore >= 1.0) {
      problem.box_level = Math.min(problem.box_level + 1, BOX_INTERVALS.length - 1);
    } else if (timePerformanceScore >= 0.8) {
      const promotionAmount = Math.floor(0.5 + problem.box_level * 0.1);
      problem.box_level = Math.min(problem.box_level + promotionAmount, BOX_INTERVALS.length - 1);
    }
    // For timePerformanceScore < 0.8, maintain current level (no change)
  } else {
    // Handle failure case
    problem.consecutive_failures++;
    problem.attempt_stats.unsuccessful_attempts++;

    if (problem.consecutive_failures >= FAILURE_THRESHOLD) {
      problem.cooldown_status = true;

      // Graduated demotion based on effort
      const showedEffort = timePerformanceScore >= 0.8 || attemptData?.UserIntent === "solving";
      const demotionAmount = showedEffort ? 0.5 : 1;
      problem.box_level = Math.max(problem.box_level - demotionAmount, 1);
    }
  }

  return problem;
}

/**
 * Apply FSRS stability adjustments
 */
export function applyStabilityAdjustment(problem, attemptData, timePerformanceScore, updateStabilityFSRS) {
  let stabilityAdjustment = updateStabilityFSRS(
    problem.stability,
    attemptData ? attemptData.Success : false
  );

  // Apply time performance bonus/penalty to stability
  if (attemptData && attemptData.Success) {
    stabilityAdjustment *= timePerformanceScore;
  }

  problem.stability = stabilityAdjustment;
  return problem;
}

/**
 * Calculate next review date based on box level and stability
 */
export function calculateNextReviewDate(problem, attemptData) {
  // Get base days from box level
  const baseDays = BOX_INTERVALS[problem.box_level];

  // Apply stability multiplier
  const stabilityMultiplier = problem.stability / 2;
  let nextReviewDays = Math.round(baseDays * stabilityMultiplier);

  // Safety nets
  nextReviewDays = Math.max(1, nextReviewDays); // Don't allow too short interval
  
  if (problem.cooldown_status) {
    nextReviewDays = Math.max(nextReviewDays, COOLDOWN_REVIEW_INTERVAL);
  }

  // Calculate the actual date
  const attemptDate = attemptData?.attempt_date ? new Date(attemptData.attempt_date) : new Date();
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
    // Track perceived difficulty from attempt data
    if (attemptData.perceived_difficulty !== undefined && attemptData.perceived_difficulty !== null) {
      const currentPerceivedDifficulty = Number(problem.perceived_difficulty) || 0;
      const attemptPerceivedDifficulty = Number(attemptData.perceived_difficulty) || 0;
      problem.perceived_difficulty = currentPerceivedDifficulty + attemptPerceivedDifficulty;
    }
    problem.last_attempt_date = attemptData.attempt_date;
  }
  return problem;
}