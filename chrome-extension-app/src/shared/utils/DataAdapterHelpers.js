import { getWeek, format, startOfISOWeek, addWeeks } from "date-fns";

// Memoization cache for performance optimization
const dataCache = new Map();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes for chart data

// Create cache key from sessions data and range
export const createCacheKey = (sessions, range, functionName) => {
  if (!Array.isArray(sessions)) return null;

  const sessionHash = sessions.reduce((hash, session, index) => {
    const sessionDate = session.Date || session.date || session.created_date;
    const attemptsCount = session.attempts?.length || 0;
    return hash + sessionDate + attemptsCount + index;
  }, '');

  return `${functionName}_${range}_${sessionHash.length}_${sessions.length}`;
};

// Get from cache if valid
export const getCachedResult = (cacheKey) => {
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
export const setCachedResult = (cacheKey, data) => {
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
export function parseWeekLabel(label) {
  const [year, weekStr] = label.split("-W");
  const week = parseInt(weekStr, 10);
  const firstWeekStart = startOfISOWeek(new Date(year, 0, 4));
  return addWeeks(firstWeekStart, week - 1);
}

export function parseMonthLabel(label) {
  const [year, month] = label.split("-").map(Number);
  return new Date(year, month - 1);
}

// --- Sorting helper ---
export function sortByLabel(data, range) {
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
export function getGroupKey(dateStr, range = "weekly") {
  if (!dateStr) {
    console.warn("Invalid date provided to getGroupKey:", dateStr);
    return "";
  }

  const date = new Date(dateStr);

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
