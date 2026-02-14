/**
 * Helper functions to calculate today's progress statistics
 * These functions query attempts data directly to include current active session
 */

/**
 * Get today's date string in YYYY-MM-DD format for comparison (local timezone)
 */
function getTodayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Check if a date string matches today (using local timezone)
 */
function isToday(dateString) {
  if (!dateString) return false;
  const date = new Date(dateString);
  const today = getTodayDateString();

  // Get local date from the Date object
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const checkDate = `${year}-${month}-${day}`;

  return checkDate === today;
}

/**
 * Get today's attempts from appState (includes current active session)
 */
function getTodaysAttempts(appState) {
  // Attempts are stored with attempt_date field
  const allAttempts = appState?.attempts || [];
  const todaysAttempts = allAttempts.filter(attempt =>
    attempt.attempt_date && isToday(attempt.attempt_date)
  );

  // Debug logging
  console.log('📊 Today\'s Progress Debug:', {
    totalAttempts: allAttempts.length,
    todaysAttempts: todaysAttempts.length,
    todaysAttemptDetails: todaysAttempts.map(a => ({
      date: a.attempt_date,
      success: a.success,
      successType: typeof a.success,
      problemId: a.problem_id
    }))
  });

  return todaysAttempts;
}

/**
 * Calculate the number of problems solved today (includes current session)
 */
export function getTodaysProblemsSolved(appState) {
  const todaysAttempts = getTodaysAttempts(appState);

  // Count successful attempts (handle both boolean true and number 1)
  return todaysAttempts.filter(attempt => !!attempt.success).length;
}

/**
 * Calculate today's accuracy rate (includes current session)
 */
export function getTodaysAccuracy(appState) {
  const todaysAttempts = getTodaysAttempts(appState);

  if (todaysAttempts.length === 0) return 0;

  const successfulAttempts = todaysAttempts.filter(attempt => !!attempt.success).length;

  return Math.round((successfulAttempts / todaysAttempts.length) * 100);
}

/**
 * Count review problems completed today (includes current session)
 * Review problems are those with box_level > 1 in the problems store
 */
export function getTodaysReviewProblems(appState) {
  const todaysAttempts = getTodaysAttempts(appState);

  // Build a map of problem_id -> box_level from the problems store
  const allProblems = appState?.problems || appState?.allProblems || [];
  const boxLevelMap = {};
  allProblems.forEach(p => {
    const id = p.problem_id || p.leetcode_id || p.id;
    if (id != null) {
      boxLevelMap[id] = p.box_level || p.BoxLevel || 1;
    }
  });

  // A review problem is one that already existed in the user's problem store (box_level > 1)
  return todaysAttempts.filter(attempt => {
    const problemId = attempt.problem_id || attempt.leetcode_id || attempt.ProblemID;
    const boxLevel = boxLevelMap[problemId] || 1;
    return boxLevel > 1 && !!attempt.success;
  }).length;
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
