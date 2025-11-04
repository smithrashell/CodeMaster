import { getWeek, format, startOfISOWeek, addWeeks } from "date-fns";

// Memoization cache for performance optimization
const dataCache = new Map();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes for chart data

// Create cache key from sessions data and range
const createCacheKey = (sessions, range, functionName) => {
  if (!Array.isArray(sessions)) return null;
  
  // Create a hash based on sessions data structure and range
  const sessionHash = sessions.reduce((hash, session, index) => {
    const sessionDate = session.Date || session.date || session.created_date;
    const attemptsCount = session.attempts?.length || 0;
    return hash + sessionDate + attemptsCount + index;
  }, '');
  
  return `${functionName}_${range}_${sessionHash.length}_${sessions.length}`;
};

// Get from cache if valid
const getCachedResult = (cacheKey) => {
  if (!cacheKey) return null;
  
  const cached = dataCache.get(cacheKey);
  if (!cached) return null;
  
  const now = Date.now();
  if (now - cached.timestamp > CACHE_TTL) {
    dataCache.delete(cacheKey);
    return null;
  }
  
  return cached.data;
};

// Set cache result
const setCachedResult = (cacheKey, data) => {
  if (!cacheKey) return;
  
  dataCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });
  
  // Prevent memory leaks - keep only last 20 cache entries
  if (dataCache.size > 20) {
    const firstKey = dataCache.keys().next().value;
    dataCache.delete(firstKey);
  }
};

// --- Parse labels to real Date objects ---
function parseWeekLabel(label) {
  const [year, weekStr] = label.split("-W");
  const week = parseInt(weekStr, 10);
  const firstWeekStart = startOfISOWeek(new Date(year, 0, 4));
  return addWeeks(firstWeekStart, week - 1);
}

function parseMonthLabel(label) {
  const [year, month] = label.split("-").map(Number);
  return new Date(year, month - 1);
}

// --- Sorting helper ---
function sortByLabel(data, range) {
  if (range === "weekly") {
    return [...data].sort(
      (a, b) => parseWeekLabel(a.name) - parseWeekLabel(b.name)
    );
  }
  if (range === "monthly") {
    return [...data].sort(
      (a, b) => parseMonthLabel(a.name) - parseMonthLabel(b.name)
    );
  }
  if (range === "yearly") {
    return [...data].sort((a, b) => Number(a.name) - Number(b.name));
  }
  return data;
}

// --- Time bucket key ---
function getGroupKey(dateStr, range = "weekly") {
  // Validate and normalize date input
  if (!dateStr) {
    console.warn("Invalid date provided to getGroupKey:", dateStr);
    return "";
  }

  const date = new Date(dateStr);

  // Check if date is valid
  if (isNaN(date.getTime())) {
    console.warn("Invalid date value in getGroupKey:", dateStr);
    return "";
  }

  if (range === "weekly") {
    const week = getWeek(date, { weekStartsOn: 1 });
    return `${date.getFullYear()}-W${String(week).padStart(2, "0")}`;
  }
  if (range === "monthly") {
    return format(date, "yyyy-MM");
  }
  if (range === "yearly") {
    return date.getFullYear().toString();
  }
  return "";
}

// --- Individual Session Accuracy (for Session History page) ---
// Returns one data point per session
export function getIndividualSessionAccuracyData(sessions) {
  // Check cache first for performance
  const cacheKey = createCacheKey(sessions, 'individual', 'getIndividualSessionAccuracyData');
  const cachedResult = getCachedResult(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  // Validate sessions input
  if (!Array.isArray(sessions)) {
    console.warn(
      "Invalid sessions array provided to getIndividualSessionAccuracyData:",
      sessions
    );
    return [];
  }

  const now = new Date();

  // Map each session to individual data point
  const sessionDataPoints = sessions
    .map((session) => {
      // Validate session structure - use lowercase date property
      const sessionDate = session.date;
      if (!session || !sessionDate) {
        console.warn("Session missing date property:", session);
        return null;
      }

      const date = new Date(sessionDate);
      // Skip future sessions
      if (date > now) return null;

      // Validate attempts array
      if (!Array.isArray(session.attempts) || session.attempts.length === 0) {
        console.warn("Session missing or invalid attempts array:", session);
        return null;
      }

      // Calculate accuracy for this specific session
      let correct = 0;
      let total = 0;
      session.attempts.forEach((attempt) => {
        if (attempt && typeof attempt.success !== "undefined") {
          total += 1;
          if (attempt.success) correct += 1;
        }
      });

      if (total === 0) return null;

      const accuracy = Math.round((correct / total) * 100);

      // Use session date as the label for individual sessions
      return {
        name: format(date, "MMM dd, HH:mm"),
        accuracy,
        date: date.getTime(), // for sorting
        sessionId: session.id || sessionDate // for uniqueness
      };
    })
    .filter(Boolean); // Remove null entries

  // Sort by date chronologically
  const result = sessionDataPoints.sort((a, b) => a.date - b.date);

  // Cache the result for better performance
  setCachedResult(cacheKey, result);

  return result;
}

// --- Individual Session Learning Efficiency ---
// Returns learning efficiency (problems per hint) for each session
export function getIndividualSessionEfficiencyData(sessions) {
  // Check cache first for performance
  const cacheKey = createCacheKey(sessions, 'individual', 'getIndividualSessionEfficiencyData');
  const cachedResult = getCachedResult(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  // Validate sessions input
  if (!Array.isArray(sessions)) {
    console.warn(
      "Invalid sessions array provided to getIndividualSessionEfficiencyData:",
      sessions
    );
    return [];
  }

  const now = new Date();

  // Map each session to individual efficiency data point
  const sessionDataPoints = sessions
    .map((session) => {
      // Validate session structure
      const sessionDate = session.date;
      if (!session || !sessionDate) {
        console.warn("Session missing date property:", session);
        return null;
      }

      const date = new Date(sessionDate);
      // Skip future sessions
      if (date > now) return null;

      // Validate attempts array
      if (!Array.isArray(session.attempts) || session.attempts.length === 0) {
        return null;
      }

      // Count successful problems
      const successfulProblems = session.attempts.filter(
        attempt => attempt && attempt.success
      ).length;

      // Get actual hints used from session (populated by dashboardService)
      const hintsUsed = session.hintsUsed || 0;

      // Only include sessions with successful problems
      if (successfulProblems === 0) return null;

      // Calculate efficiency as "hints per problem" (lower is better)
      // 0.0 hints per problem = perfect (solved without help)
      // 2.5 hints per problem = needed help
      const efficiency = hintsUsed / successfulProblems;

      return {
        name: format(date, "MMM dd, HH:mm"),
        efficiency: Math.round(efficiency * 100) / 100, // 2 decimal places
        date: date.getTime(), // for sorting
        sessionId: session.id || sessionDate
      };
    })
    .filter(Boolean); // Remove null entries

  // Sort by date chronologically
  const result = sessionDataPoints.sort((a, b) => a.date - b.date);

  // Cache the result for better performance
  setCachedResult(cacheKey, result);

  return result;
}

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
