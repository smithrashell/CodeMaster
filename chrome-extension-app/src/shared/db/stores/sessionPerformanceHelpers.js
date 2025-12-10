/**
 * Session Performance Helpers
 * Extracted from sessions.js for better organization
 * Contains functions for processing session performance data
 */

import { getAttemptsBySessionId } from "./attempts.js";
import logger from "../../utils/logging/logger.js";

/**
 * Helper function to filter sessions by time or recent count
 */
export function filterSessions(allSessions, daysBack, recentSessionsLimit) {
  const now = new Date();
  if (daysBack) {
    return allSessions.filter((s) => {
      const date = new Date(s.date || s.created_date);
      return (now - date) / (1000 * 60 * 60 * 24) <= daysBack;
    });
  } else {
    allSessions.sort((a, b) => new Date(a.date || a.created_date) - new Date(b.date || b.created_date));
    return allSessions.slice(-recentSessionsLimit);
  }
}

/**
 * Helper function to process attempts and calculate statistics
 */
export async function processAttempts(sessions) {
  const performance = {
    easy: { attempts: 0, correct: 0, time: 0 },
    medium: { attempts: 0, correct: 0, time: 0 },
    hard: { attempts: 0, correct: 0, time: 0 },
  };
  const tagStats = {};
  let totalAttempts = 0;
  let totalCorrect = 0;
  let totalTime = 0;

  for (let session of sessions) {
    const attempts = await getAttemptsBySessionId(session.id);
    const problems = session.problems || [];

    if (attempts.length === 0) {
      console.log(`Skipping session ${session.id} - no attempts recorded yet`);
      continue;
    }

    const problemMap = new Map(problems.map((p) => [p.id, p]));

    for (let attempt of attempts) {
      const leetcodeId = attempt.leetcode_id;

      let problem = problemMap.get(leetcodeId) ||
                   problemMap.get(String(leetcodeId)) ||
                   problemMap.get(Number(leetcodeId));

      if (!problem) {
        const sessionProblem = problems.find(p => String(p.id) === String(leetcodeId));
        if (!sessionProblem) {
          throw new Error(`Attempt ${attempt.id} references leetcode_id ${leetcodeId} but no matching problem found in session ${session.id}`);
        }
        problem = sessionProblem;
      }

      if (!problem.difficulty) {
        throw new Error(`Problem ${leetcodeId} in attempt ${attempt.id} is missing difficulty field - data integrity issue`);
      }
      const rating = problem.difficulty.toLowerCase();

      const tags = problem.tags || [];
      const timeSpent = attempt.time_spent || 0;
      const success = attempt.success;

      if (typeof success !== 'boolean') {
        throw new Error(`Invalid success value in attempt ${attempt.id}: expected boolean, got ${typeof success} (${success})`);
      }

      if (typeof timeSpent !== 'number' || timeSpent < 0) {
        throw new Error(`Invalid time_spent value in attempt ${attempt.id}: expected non-negative number, got ${typeof timeSpent} (${timeSpent})`);
      }

      performance[rating].attempts += 1;
      performance[rating].time += timeSpent;
      if (success) performance[rating].correct += 1;

      for (let tag of tags) {
        if (!tagStats[tag]) {
          tagStats[tag] = { attempts: 0, correct: 0, time: 0 };
        }
        tagStats[tag].attempts += 1;
        tagStats[tag].time += timeSpent;
        if (success) tagStats[tag].correct += 1;
      }

      totalAttempts += 1;
      totalTime += timeSpent;
      if (success) totalCorrect += 1;
    }
  }

  return { performance, tagStats, totalAttempts, totalCorrect, totalTime };
}

/**
 * Helper function to calculate strong and weak tags
 */
export function calculateTagStrengths(tagStats, unmasteredTagSet) {
  const strongTags = [];
  const weakTags = [];

  for (let tag in tagStats) {
    const { attempts, correct } = tagStats[tag];

    if (attempts === 0) {
      logger.warn(`Tag ${tag} has zero attempts - skipping accuracy calculation`);
      continue;
    }

    const acc = correct / attempts;

    logger.info(
      `Evaluating ${tag} — acc: ${acc.toFixed(
        2
      )},correct: ${correct}, attempts: ${attempts}, mastered: ${!unmasteredTagSet.has(tag)}`
    );

    if (acc >= 0.8 && attempts >= 1) {
      strongTags.push(tag);
    } else if (acc < 0.7 && attempts >= 1) {
      weakTags.push(tag);
    }
  }

  return { strongTags, weakTags };
}

/**
 * Helper function to calculate timing feedback
 */
export function calculateTimingFeedback(performance) {
  const expected = {
    Easy: [600, 900],
    Medium: [1200, 1500],
    Hard: [1800, 2100],
  };

  const timingFeedback = {};
  const difficultyMappings = [
    { perfKey: "easy", timingKey: "Easy" },
    { perfKey: "medium", timingKey: "Medium" },
    { perfKey: "hard", timingKey: "Hard" }
  ];

  for (let { perfKey, timingKey } of difficultyMappings) {
    const perfData = performance[perfKey];
    if (!perfData) {
      timingFeedback[timingKey] = "noData";
      continue;
    }

    const { attempts, time } = perfData;
    if (attempts === 0) {
      timingFeedback[timingKey] = "noData";
    } else {
      const avg = time / attempts;
      const [min, max] = expected[timingKey];
      if (avg < min) timingFeedback[timingKey] = "tooFast";
      else if (avg > max) timingFeedback[timingKey] = "tooSlow";
      else timingFeedback[timingKey] = "onTarget";
    }
  }

  return timingFeedback;
}

/**
 * Calculates progressive tag exposure within the focus window (5 tags max)
 */
export function calculateTagIndexProgression(
  accuracy,
  efficiencyScore,
  currentTagIndex,
  focusTagsLength,
  sessionState
) {
  let tagCount = currentTagIndex + 1;

  const hasGoodAccuracy = accuracy >= 0.75;
  const hasGoodEfficiency = efficiencyScore >= 0.6;
  const hasExcellentAccuracy = accuracy >= 0.9;
  const hasExcellentEfficiency = efficiencyScore >= 0.8;

  const canExpandToNext = hasGoodAccuracy || hasGoodEfficiency;
  const canExpandQuickly =
    (hasExcellentAccuracy || hasExcellentEfficiency) &&
    (accuracy >= 0.7 || efficiencyScore >= 0.5);

  const sessionsAtCurrentTagCount = sessionState.sessionsAtCurrentTagCount || 0;
  const canExpandByStagnation =
    sessionsAtCurrentTagCount >= 5 &&
    (accuracy >= 0.6 || efficiencyScore >= 0.4);

  if (
    (canExpandQuickly || canExpandByStagnation) &&
    tagCount < focusTagsLength
  ) {
    tagCount = Math.min(tagCount + 2, focusTagsLength);
    logger.info(
      `Tag expansion: +2 tags (${
        canExpandQuickly ? "excellent performance" : "stagnation fallback"
      })`
    );
  } else if (canExpandToNext && tagCount < focusTagsLength) {
    tagCount = Math.min(tagCount + 1, focusTagsLength);
    logger.info(
      `Tag expansion: +1 tag (good ${
        hasGoodAccuracy ? "accuracy" : "efficiency"
      })`
    );
  }

  if (!sessionState.sessionsAtCurrentTagCount) {
    sessionState.sessionsAtCurrentTagCount = 0;
  }

  const previousTagCount = sessionState.lastTagCount || 1;
  if (tagCount === previousTagCount) {
    sessionState.sessionsAtCurrentTagCount++;
  } else {
    sessionState.sessionsAtCurrentTagCount = 0;
  }
  sessionState.lastTagCount = tagCount;

  const finalCount = Math.min(Math.max(1, tagCount), focusTagsLength);

  logger.info(
    `Tag progression: index=${currentTagIndex} → count=${finalCount}/${focusTagsLength} (accuracy: ${(
      accuracy * 100
    ).toFixed(1)}%, efficiency: ${(efficiencyScore * 100).toFixed(1)}%)`
  );

  return finalCount;
}
