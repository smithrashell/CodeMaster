import {
  createCacheKey,
  getCachedResult,
  setCachedResult,
  parseWeekLabel,
  parseMonthLabel,
  sortByLabel,
  getGroupKey
} from "./DataAdapterHelpers.js";

// Re-export individual session functions for backwards compatibility
export {
  getIndividualSessionAccuracyData,
  getIndividualSessionEfficiencyData,
  getNewVsReviewProblemsPerSession,
  getIndividualSessionActivityData
} from "./IndividualSessionData.js";

// --- Aggregated Accuracy Trend (for Overview page) ---
// Aggregates sessions by time period
export function getAccuracyTrendData(sessions, range = "weekly") {
  // Check cache first for performance
  const cacheKey = createCacheKey(sessions, range, 'getAccuracyTrendData');
  const cachedResult = getCachedResult(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  const grouped = {};

  // Validate sessions input
  if (!Array.isArray(sessions)) {
    console.warn(
      "Invalid sessions array provided to getAccuracyTrendData:",
      sessions
    );
    return [];
  }

  sessions.forEach((session) => {
    // Validate session structure - use lowercase date property
    const sessionDate = session.date;
    if (!session || !sessionDate) {
      console.warn("Session missing date property:", session);
      return;
    }

    const key = getGroupKey(sessionDate, range);
    // Skip sessions with invalid dates
    if (!key) return;

    if (!grouped[key]) grouped[key] = { correct: 0, total: 0 };

    // Validate attempts array
    if (!Array.isArray(session.attempts)) {
      console.warn("Session missing or invalid attempts array:", session);
      return;
    }

    session.attempts.forEach((attempt) => {
      if (attempt && typeof attempt.success !== "undefined") {
        grouped[key].total += 1;
        if (attempt.success) grouped[key].correct += 1;
      }
    });
  });

  const now = new Date();
  const raw = Object.entries(grouped)
    .filter(([key, val]) => {
      if (val.total === 0) return false;

      const date =
        range === "weekly"
          ? parseWeekLabel(key)
          : range === "monthly"
          ? parseMonthLabel(key)
          : new Date(key, 0);

      return date <= now;
    })
    .map(([key, val]) => {
      const accuracy = Math.round((val.correct / val.total) * 100);
      return accuracy > 0 ? { name: key, accuracy } : null;
    })
    .filter(Boolean);

  const result = sortByLabel(raw, range);

  // Cache the result for better performance
  setCachedResult(cacheKey, result);

  return result;
}

// --- Retry-aware Attempt Breakdown ---
export function getAttemptBreakdownData(sessions, range = "weekly") {
  // Check cache first for performance
  const cacheKey = createCacheKey(sessions, range, 'getAttemptBreakdownData');
  const cachedResult = getCachedResult(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }
  
  const problemMap = {};

  // Validate sessions input
  if (!Array.isArray(sessions)) {
    console.warn(
      "Invalid sessions array provided to getAttemptBreakdownData:",
      sessions
    );
    return [];
  }

  sessions.forEach((session) => {
    // Use lowercase date property
    const sessionDate = session.date;

    session.attempts.forEach((attempt) => {
      const problemId = attempt.problemId || attempt.problem_id || attempt.leetcode_id;
      if (!problemMap[problemId]) {
        problemMap[problemId] = [];
      }
      problemMap[problemId].push({ ...attempt, date: sessionDate });
    });
  });

  const resolvedMap = {};
  Object.entries(problemMap).forEach(([problemId, attempts]) => {
    const sorted = attempts.sort((a, b) => new Date(a.date) - new Date(b.date));
    const index = sorted.findIndex((a) => a.success);
    resolvedMap[problemId] = {
      outcome:
        index === -1 ? "failed" : index === 0 ? "firstTry" : "retrySuccess",
      successDate: index >= 0 ? sorted[index].date : sorted.at(-1).date,
    };
  });

  const grouped = {};
  Object.values(resolvedMap).forEach(({ outcome, successDate }) => {
    const key = getGroupKey(successDate, range);
    if (!grouped[key])
      grouped[key] = { firstTry: 0, retrySuccess: 0, failed: 0 };
    grouped[key][outcome]++;
  });

  const now = new Date();
  const result = Object.entries(grouped)
    .filter(([key]) => {
      const date =
        range === "weekly"
          ? parseWeekLabel(key)
          : range === "monthly"
          ? parseMonthLabel(key)
          : new Date(key, 0);
      return date <= now;
    })
    .map(([key, val]) => ({
      name: key,
      ...val,
    }));

  const finalResult = sortByLabel(result, range);
  
  // Cache the result for better performance
  setCachedResult(cacheKey, finalResult);
  
  return finalResult;
}

export function getProblemActivityData(sessions, range = "weekly") {
  // Check cache first for performance
  const cacheKey = createCacheKey(sessions, range, 'getProblemActivityData');
  const cachedResult = getCachedResult(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }
  
  const grouped = {};

  // Validate sessions input
  if (!Array.isArray(sessions)) {
    console.warn(
      "Invalid sessions array provided to getProblemActivityData:",
      sessions
    );
    return [];
  }

  sessions.forEach((session) => {
    // Use lowercase date property
    const sessionDate = session.date;
    if (!sessionDate) {
      console.warn("Session missing date property in getProblemActivityData:", session);
      return;
    }
    
    const key = getGroupKey(sessionDate, range);
    if (!grouped[key]) grouped[key] = { attempted: 0, passed: 0, failed: 0 };

    session.attempts.forEach((attempt) => {
      grouped[key].attempted += 1;
      if (attempt.success) {
        grouped[key].passed += 1;
      } else {
        grouped[key].failed += 1;
      }
    });
  });

  const now = new Date();
  const result = Object.entries(grouped)
    .filter(([key]) => {
      const date =
        range === "weekly"
          ? parseWeekLabel(key)
          : range === "monthly"
          ? parseMonthLabel(key)
          : new Date(key, 0);
      return date <= now;
    })
    .map(([key, val]) => ({
      name: key,
      ...val,
    }));

  const finalResult = sortByLabel(result, range);
  
  // Cache the result for better performance
  setCachedResult(cacheKey, finalResult);
  
  return finalResult;
}
