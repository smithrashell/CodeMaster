import { getWeek, format, startOfISOWeek, addWeeks } from "date-fns";

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

// --- Accuracy Trend (still session-based) ---
export function getAccuracyTrendData(sessions, range = 'weekly') {
  const grouped = {};

  // Validate sessions input
  if (!Array.isArray(sessions)) {
    console.warn("Invalid sessions array provided to getAccuracyTrendData:", sessions);
    return [];
  }

  sessions.forEach((session) => {
    // Validate session structure
    if (!session || !session.Date) {
      console.warn("Session missing Date property:", session);
      return;
    }
    
    const key = getGroupKey(session.Date, range);
    // Skip sessions with invalid dates
    if (!key) return;
    
    if (!grouped[key]) grouped[key] = { correct: 0, total: 0 };

    // Validate attempts array
    if (!Array.isArray(session.attempts)) {
      console.warn("Session missing or invalid attempts array:", session);
      return;
    }

    session.attempts.forEach((attempt) => {
      if (attempt && typeof attempt.success !== 'undefined') {
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
    .filter(Boolean); // ✅ Remove 0-accuracy rows

  // ✅ SORT IT PROPERLY
  return sortByLabel(raw, range);
}

// --- Retry-aware Attempt Breakdown ---
export function getAttemptBreakdownData(sessions, range = "weekly") {
  const problemMap = {};

  sessions.forEach((session) => {
    session.attempts.forEach((attempt) => {
      if (!problemMap[attempt.problemId]) {
        problemMap[attempt.problemId] = [];
      }
      problemMap[attempt.problemId].push({ ...attempt, date: session.Date });
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

  return sortByLabel(result, range);
}


export function getProblemActivityData(sessions, range = "weekly") {
  const grouped = {};

  sessions.forEach((session) => {
    const key = getGroupKey(session.Date, range);
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

  return sortByLabel(result, range);
}
