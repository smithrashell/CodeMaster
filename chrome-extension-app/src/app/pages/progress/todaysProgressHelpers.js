/**
 * Helper functions to calculate today's progress statistics
 * These functions query real data from appState instead of hardcoded values
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
 * Calculate the number of problems solved today
 */
export function getTodaysProblemsSolved(appState) {
  const todaysSessions = appState?.sessions?.allSessions?.filter(session =>
    session.date && isToday(session.date)
  ) || [];

  // Sum up successful problems from today's sessions
  return todaysSessions.reduce((total, session) => {
    const successfulProblems = session.problems?.filter(p => p.success === true).length || 0;
    return total + successfulProblems;
  }, 0);
}

/**
 * Calculate today's accuracy rate
 */
export function getTodaysAccuracy(appState) {
  const todaysSessions = appState?.sessions?.allSessions?.filter(session =>
    session.date && isToday(session.date)
  ) || [];

  if (todaysSessions.length === 0) return 0;

  let totalProblems = 0;
  let successfulProblems = 0;

  todaysSessions.forEach(session => {
    const problems = session.problems || [];
    totalProblems += problems.length;
    successfulProblems += problems.filter(p => p.success === true).length;
  });

  if (totalProblems === 0) return 0;

  return Math.round((successfulProblems / totalProblems) * 100);
}

/**
 * Count review problems completed today
 * Review problems are identified by box_level > 0
 */
export function getTodaysReviewProblems(appState) {
  const todaysSessions = appState?.sessions?.allSessions?.filter(session =>
    session.date && isToday(session.date)
  ) || [];

  return todaysSessions.reduce((total, session) => {
    const reviewProblems = session.problems?.filter(p =>
      p.box_level > 0 && p.success === true
    ).length || 0;
    return total + reviewProblems;
  }, 0);
}

/**
 * Calculate average hints per problem today
 */
export function getTodaysHintEfficiency(appState) {
  const todaysSessions = appState?.sessions?.allSessions?.filter(session =>
    session.date && isToday(session.date)
  ) || [];

  if (todaysSessions.length === 0) return 0;

  let totalHints = 0;
  let totalProblems = 0;

  todaysSessions.forEach(session => {
    const problems = session.problems || [];
    totalProblems += problems.length;

    // Sum up hints used for each problem
    problems.forEach(problem => {
      const hints = problem.hintsUsed || 0;
      totalHints += hints;
    });
  });

  if (totalProblems === 0) return 0;

  return totalHints / totalProblems;
}

/**
 * Calculate average time per problem today (in minutes)
 */
export function getTodaysAverageTime(appState) {
  const todaysSessions = appState?.sessions?.allSessions?.filter(session =>
    session.date && isToday(session.date)
  ) || [];

  if (todaysSessions.length === 0) return 0;

  let totalTime = 0;
  let totalProblems = 0;

  todaysSessions.forEach(session => {
    const problems = session.problems || [];
    totalProblems += problems.length;

    // Sum up time spent on each problem (in seconds)
    problems.forEach(problem => {
      const timeSpent = problem.timeSpent || 0;
      totalTime += timeSpent;
    });
  });

  if (totalProblems === 0) return 0;

  // Convert from seconds to minutes and round to 1 decimal
  return Math.round((totalTime / totalProblems / 60) * 10) / 10;
}

/**
 * Check if there's any activity today
 */
export function hasActivityToday(appState) {
  const todaysSessions = appState?.sessions?.allSessions?.filter(session =>
    session.date && isToday(session.date)
  ) || [];

  return todaysSessions.length > 0;
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
