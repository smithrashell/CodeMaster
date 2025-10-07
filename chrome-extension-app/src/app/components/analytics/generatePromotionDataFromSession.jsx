export function getPromotionDemotionData(
  attempts,
  problems,
  granularity = "weekly"
) {
  const problemMap = new Map(problems.map((p) => [p.id, p]));
  const historyByProblem = new Map();

  // 1️⃣ Group attempts by problem and sort them
  for (const attempt of attempts) {
    const pid = attempt.ProblemID;
    const prob = problemMap.get(pid);
    if (!pid || !attempt.AttemptDate || !prob) continue;

    if (!historyByProblem.has(pid)) historyByProblem.set(pid, []);
    historyByProblem.get(pid).push({
      date: new Date(attempt.AttemptDate),
      success: attempt.Success,
      metadata: prob, // attach the full problem
    });
  }

  // 2️⃣ Simulate BoxLevel progression
  const fullHistory = [];

  for (const [pid, probAttempts] of historyByProblem.entries()) {
    probAttempts.sort((a, b) => a.date - b.date);
    let boxLevel = 1;

    for (const a of probAttempts) {
      fullHistory.push({
        problemId: pid,
        date: a.date,
        boxLevel,
        tags: a.metadata.Tags,
        rating: a.metadata.Rating,
      });

      boxLevel = a.success ? boxLevel + 1 : Math.max(1, boxLevel - 1);
    }
  }

  // 3️⃣ Aggregate trends by time window
  const lastBoxByProblem = new Map();
  const trendMap = new Map();

  for (const record of fullHistory) {
    const { problemId, date, boxLevel } = record;
    const label = getTimeLabel(date, granularity);

    if (!trendMap.has(label)) {
      trendMap.set(label, {
        name: label,
        timestamp: date,
        promotions: 0,
        demotions: 0,
      });
    }

    const prev = lastBoxByProblem.get(problemId);
    if (prev != null) {
      const diff = boxLevel - prev;
      if (diff > 0) trendMap.get(label).promotions += 1;
      else if (diff < 0) trendMap.get(label).demotions += 1;
    }

    lastBoxByProblem.set(problemId, boxLevel);
  }

  return Array.from(trendMap.values()).sort(
    (a, b) => a.timestamp - b.timestamp
  );
}

function getTimeLabel(date, granularity) {
  const d = new Date(date);
  const year = d.getFullYear();

  if (granularity === "weekly") {
    const week = getWeekNumber(d);
    return `${year}-W${String(week).padStart(2, "0")}`;
  }

  if (granularity === "monthly") {
    const month = d.getMonth() + 1; // month is 0-based
    return `${year}-${String(month).padStart(2, "0")}`;
  }

  if (granularity === "yearly") {
    return `${year}`;
  }

  return d.toISOString().split("T")[0];
}

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}
