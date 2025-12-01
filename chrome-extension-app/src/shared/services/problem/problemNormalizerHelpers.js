/**
 * Helper functions for problemNormalizer.js
 *
 * Extracted to reduce cyclomatic complexity
 */

/**
 * Build session metadata fields
 */
export function buildSessionMetadata(problem) {
  return {
    ...(problem.selectionReason && { selectionReason: problem.selectionReason }),
    ...(problem.sessionIndex !== undefined && { sessionIndex: problem.sessionIndex }),
  };
}

/**
 * Build attempt tracking fields for current session
 */
export function buildAttemptTracking(problem) {
  return {
    ...(problem.attempted !== undefined && { attempted: problem.attempted }),
    ...(problem.attempt_date && { attempt_date: problem.attempt_date }),
  };
}

/**
 * Build spaced repetition data fields
 */
export function buildSpacedRepetitionData(problem) {
  return {
    ...(problem.box_level !== undefined && { box_level: problem.box_level }),
    ...(problem.review_schedule && { review_schedule: problem.review_schedule }),
    ...(problem.perceived_difficulty !== undefined && {
      perceived_difficulty: problem.perceived_difficulty
    }),
    ...(problem.consecutive_failures !== undefined && {
      consecutive_failures: problem.consecutive_failures
    }),
    ...(problem.stability !== undefined && { stability: problem.stability }),
    ...(problem.attempt_stats && { attempt_stats: problem.attempt_stats }),
    ...(problem.last_attempt_date && { last_attempt_date: problem.last_attempt_date }),
    ...(problem.cooldown_status !== undefined && { cooldown_status: problem.cooldown_status }),
  };
}

/**
 * Build LeetCode address field
 */
export function buildLeetCodeAddressFields(problem) {
  return {
    ...(problem.leetcode_address && { leetcode_address: problem.leetcode_address }),
  };
}

/**
 * Build attempts array from attempt_stats or preserve existing
 */
export function buildAttemptsArray(problem) {
  if (problem.attempts) {
    return { attempts: problem.attempts };
  }

  if (problem.attempt_stats) {
    return {
      attempts: problem.attempt_stats.total_attempts > 0
        ? [{ count: problem.attempt_stats.total_attempts }]
        : []
    };
  }

  return {};
}

/**
 * Build interview mode fields
 */
export function buildInterviewModeFields(problem) {
  return {
    ...(problem.interviewMode && { interviewMode: problem.interviewMode }),
    ...(problem.interviewConstraints && { interviewConstraints: problem.interviewConstraints }),
  };
}

/**
 * Build optimal path data fields
 */
export function buildOptimalPathData(problem) {
  return {
    ...(problem.pathScore !== undefined && { pathScore: problem.pathScore }),
    ...(problem.optimalPathData && { optimalPathData: problem.optimalPathData }),
  };
}
