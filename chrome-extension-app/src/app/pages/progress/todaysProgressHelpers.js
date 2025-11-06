/**
 * Helper functions to calculate today's progress statistics
 * These functions query attempts data directly to include current active session
 */

/**
 * Get today's date string in YYYY-MM-DD format for comparison
 */
function getTodayDateString() {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

/**
 * Check if a date string matches today
 */
function isToday(dateString) {
  if (!dateString) return false;
  const date = new Date(dateString);
  const today = getTodayDateString();
  const checkDate = date.toISOString().split('T')[0];
  return checkDate === today;
}

/**
 * Get today's attempts from appState (includes current active session)
 */
function getTodaysAttempts(appState) {
  // Attempts are stored with attempt_date field
  const allAttempts = appState?.attempts || [];
  return allAttempts.filter(attempt =>
    attempt.attempt_date && isToday(attempt.attempt_date)
  );
}

/**
 * Calculate the number of problems solved today (includes current session)
 */
export function getTodaysProblemsSolved(appState) {
  const todaysAttempts = getTodaysAttempts(appState);

  // Count successful attempts (success === true)
  return todaysAttempts.filter(attempt => attempt.success === true).length;
}

/**
 * Calculate today's accuracy rate (includes current session)
 */
export function getTodaysAccuracy(appState) {
  const todaysAttempts = getTodaysAttempts(appState);

  if (todaysAttempts.length === 0) return 0;

  const successfulAttempts = todaysAttempts.filter(attempt => attempt.success === true).length;

  return Math.round((successfulAttempts / todaysAttempts.length) * 100);
}

/**
 * Count review problems completed today (includes current session)
 * Review problems are identified by box_level > 0
 */
export function getTodaysReviewProblems(appState) {
  const todaysAttempts = getTodaysAttempts(appState);

  // Count successful review attempts (box_level > 0)
  return todaysAttempts.filter(attempt =>
    attempt.box_level > 0 && attempt.success === true
  ).length;
}

/**
 * Calculate average hints per problem today (includes current session)
 */
export function getTodaysHintEfficiency(appState) {
  const todaysAttempts = getTodaysAttempts(appState);

  if (todaysAttempts.length === 0) return 0;

  const totalHints = todaysAttempts.reduce((sum, attempt) =>
    sum + (attempt.hints_used || 0), 0
  );

  return totalHints / todaysAttempts.length;
}

/**
 * Calculate average time per problem today in minutes (includes current session)
 */
export function getTodaysAverageTime(appState) {
  const todaysAttempts = getTodaysAttempts(appState);

  if (todaysAttempts.length === 0) return 0;

  const totalTime = todaysAttempts.reduce((sum, attempt) =>
    sum + (attempt.time_spent || 0), 0
  );

  // Convert from seconds to minutes and round to 1 decimal
  return Math.round((totalTime / todaysAttempts.length / 60) * 10) / 10;
}

/**
 * Check if there's any activity today (includes current session)
 */
export function hasActivityToday(appState) {
  const todaysAttempts = getTodaysAttempts(appState);

  return todaysAttempts.length > 0;
}

/**
 * Generate the complete today's progress object
 */
export function calculateTodaysProgress(appState) {
  const hasActivity = hasActivityToday(appState);

  if (!hasActivity) {
    return {
      problemsSolved: 0,
      accuracy: 0,
      reviewProblems: 0,
      hintsPerProblem: 0,
      avgTimeMinutes: 0,
      hasActivity: false
    };
  }

  return {
    problemsSolved: getTodaysProblemsSolved(appState),
    accuracy: getTodaysAccuracy(appState),
    reviewProblems: getTodaysReviewProblems(appState),
    hintsPerProblem: getTodaysHintEfficiency(appState),
    avgTimeMinutes: getTodaysAverageTime(appState),
    hasActivity: true
  };
}
