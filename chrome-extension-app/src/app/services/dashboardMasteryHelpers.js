/**
 * Helper functions for mastery data generation and tag relationships
 * Extracted from dashboardService.js to reduce file complexity
 */

import { StorageService } from "../../shared/services/storageService.js";
import { calculateProgressPercentage, calculateSuccessRate } from "../../shared/utils/Utils.js";
import { getTagRelationships } from "../../shared/db/tag_relationships.js";
import logger from "../../shared/utils/logger.js";

/**
 * Generate enhanced mastery data with focus areas integration
 */
export async function generateMasteryData(learningState) {
  try {
    const settings = await StorageService.getSettings();
    const sessionState = await StorageService.getSessionState();
    const focusTags = sessionState?.current_focus_tags || settings.focusAreas || [];

    const enhancedMasteryData = (learningState.masteryData || []).map(mastery => {
      const totalAttempts = mastery.total_attempts ?? mastery.totalAttempts ?? 0;
      const successfulAttempts = mastery.successful_attempts ?? mastery.successfulAttempts ?? 0;

      return {
        ...mastery,
        isFocus: focusTags.includes(mastery.tag),
        progress: totalAttempts > 0 ?
          calculateProgressPercentage(successfulAttempts, totalAttempts) :
          0,
        hintHelpfulness: calculateSuccessRate(successfulAttempts, totalAttempts) > 0.8 ? "low" :
                        calculateSuccessRate(successfulAttempts, totalAttempts) > 0.5 ? "medium" : "high"
      };
    });

    const allTagRelationships = await getTagRelationships();
    const allKnownTags = Object.keys(allTagRelationships);
    const masteryMap = new Map(enhancedMasteryData.map(m => [m.tag, m]));

    const allTagsWithData = allKnownTags.map(tagName => {
      if (masteryMap.has(tagName)) {
        return masteryMap.get(tagName);
      } else {
        return {
          tag: tagName,
          total_attempts: 0,
          successful_attempts: 0,
          mastered: false,
          isFocus: focusTags.includes(tagName),
          progress: 0,
          hintHelpfulness: "low"
        };
      }
    });

    const tierTags = (learningState.allTagsInCurrentTier || []);
    const currentTierTagsWithData = tierTags.map(tagName => {
      if (masteryMap.has(tagName)) {
        return masteryMap.get(tagName);
      } else {
        return {
          tag: tagName,
          total_attempts: 0,
          successful_attempts: 0,
          mastered: false,
          isFocus: focusTags.includes(tagName),
          progress: 0,
          hintHelpfulness: "low"
        };
      }
    });

    return {
      currentTier: learningState.currentTier || "Core Concept",
      masteredTags: learningState.masteredTags || [],
      allTagsInCurrentTier: learningState.allTagsInCurrentTier || [],
      focusTags,
      tagsinTier: learningState.tagsinTier || learningState.allTagsInCurrentTier || [],
      unmasteredTags: learningState.unmasteredTags || [],
      masteryData: enhancedMasteryData,
      allTagsData: allTagsWithData,
      tierTagsData: currentTierTagsWithData,
      learningState: {
        ...learningState,
        focusTags,
        masteryData: enhancedMasteryData
      }
    };
  } catch (error) {
    logger.error("Error generating mastery data:", error.message || error.toString());
    console.error("Full error stack:", error);
    return {
      currentTier: "Core Concept",
      masteredTags: [],
      allTagsInCurrentTier: [],
      focusTags: [],
      tagsinTier: [],
      unmasteredTags: [],
      masteryData: [],
      allTagsData: [],
      tierTagsData: [],
      learningState: {}
    };
  }
}

/**
 * Build dynamic tag relationships from actual attempt history
 */
export function buildDynamicTagRelationships(attempts, problems) {
  const tagCoOccurrence = new Map();
  const problemMap = new Map(problems.map(p => [p.leetcode_id || p.id, p]));

  console.log('🔨 buildDynamicTagRelationships:', {
    attemptsCount: attempts.length,
    problemsCount: problems.length,
    sampleProblem: problems[0],
    sampleAttempt: attempts[0]
  });

  let skipped = 0;
  let processed = 0;

  attempts.forEach(attempt => {
    const problemId = attempt.leetcode_id || attempt.ProblemID || attempt.problem_id;
    const problem = problemMap.get(problemId);

    if (!problem) {
      console.log('⚠️ No problem found for attempt:', { problemId, attempt });
      skipped++;
      return;
    }

    const tags = problem.tags;
    if (!tags) {
      console.log('⚠️ Problem has no tags:', problem);
      skipped++;
      return;
    }
    if (tags.length < 2) {
      console.log('⚠️ Problem has only 1 tag:', tags, 'problem:', problem.id || problem.leetcode_id);
      skipped++;
      return;
    }

    processed++;
    const success = attempt.success;

    for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        const tag1 = tags[i].toLowerCase();
        const tag2 = tags[j].toLowerCase();
        const key = tag1 < tag2 ? `${tag1}:${tag2}` : `${tag2}:${tag1}`;

        if (!tagCoOccurrence.has(key)) {
          tagCoOccurrence.set(key, {
            tag1: tag1 < tag2 ? tag1 : tag2,
            tag2: tag1 < tag2 ? tag2 : tag1,
            strength: 0,
            problems: [],
            successCount: 0
          });
        }

        const connection = tagCoOccurrence.get(key);
        connection.strength++;
        if (success) connection.successCount++;

        if (connection.problems.length < 3) {
          connection.problems.push({
            id: problem.id,
            title: problem.title || `Problem ${problem.id}`,
            success: success,
            difficulty: problem.difficulty
          });
        }
      }
    }
  });

  const relationships = {};
  tagCoOccurrence.forEach((data, key) => {
    relationships[key] = {
      ...data,
      successRate: data.strength > 0 ? Math.round((data.successCount / data.strength) * 100) : 0
    };
  });

  console.log('✅ buildDynamicTagRelationships complete:', {
    processed,
    skipped,
    relationshipsCreated: Object.keys(relationships).length,
    sampleRelationship: Object.keys(relationships)[0] ? relationships[Object.keys(relationships)[0]] : null
  });

  return relationships;
}

/**
 * Calculate outcome trends metrics for Goals page
 */
export function calculateOutcomeTrends(attempts, _sessions, userSettings = {}, providedHints = null) {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const sessionsPerWeek = userSettings.sessionsPerWeek || 2;
  const sessionLength = userSettings.sessionLength;
  const maxProblemsPerSession = sessionLength === 'auto' ? 12 : (typeof sessionLength === 'number' ? sessionLength : 5);
  const userWeeklyTarget = sessionsPerWeek * maxProblemsPerSession;

  const weeklyAttempts = attempts.filter(attempt => {
    const attemptDateValue = attempt.attempt_date || attempt.AttemptDate;
    if (!attemptDateValue) {
      console.warn("⚠️ Attempt missing date:", attempt.id);
      return false;
    }

    const attemptDate = new Date(attemptDateValue);
    if (isNaN(attemptDate.getTime())) {
      console.warn("⚠️ Attempt has invalid date:", attempt.id, attemptDateValue);
      return false;
    }

    return attemptDate >= oneWeekAgo;
  });

  const successfulAttempts = weeklyAttempts.filter(a => (a.success !== undefined ? a.success : a.Success));
  const weeklyAccuracy = weeklyAttempts.length > 0
    ? Math.round((successfulAttempts.length / weeklyAttempts.length) * 100)
    : 0;

  console.log("📊 Weekly Accuracy Calculation:", {
    weeklyAttemptsCount: weeklyAttempts.length,
    successfulAttemptsCount: successfulAttempts.length,
    weeklyAccuracy: `${weeklyAccuracy}%`
  });

  const weeklyProblems = new Set(weeklyAttempts.map(a => a.problem_id || a.ProblemID)).size;

  let hintEfficiency = "2.5";
  if (providedHints && providedHints.total > 0 && weeklyAttempts.length > 0) {
    const hintsPerAttempt = weeklyAttempts.length > 0
      ? providedHints.total / weeklyAttempts.length
      : 0;
    hintEfficiency = hintsPerAttempt > 0 ? hintsPerAttempt.toFixed(1) : "0.0";
  } else {
    const successRate = weeklyAccuracy / 100;
    const estimatedHints = successRate > 0.8 ? 1.5 : successRate > 0.6 ? 2.0 : 3.0;
    hintEfficiency = estimatedHints.toFixed(1);
  }

  const progressTrendData = calculateProgressTrend(attempts);
  let learningVelocity = "Steady";
  if (progressTrendData.trend.includes("Rapidly")) {
    learningVelocity = "Accelerating";
  } else if (progressTrendData.trend.includes("Improving")) {
    learningVelocity = "Progressive";
  } else if (progressTrendData.trend.includes("Declining")) {
    learningVelocity = "Slowing";
  }

  const weeklyAccuracyStatus = weeklyAccuracy >= 75 ? "excellent" : weeklyAccuracy >= 65 ? "on_track" : "behind";
  const targetPercentage = userWeeklyTarget > 0 ? (weeklyProblems / userWeeklyTarget) * 100 : 0;
  const problemsPerWeekStatus = targetPercentage >= 100 ? "excellent" : targetPercentage >= 80 ? "on_track" : "behind";
  const hintEfficiencyStatus = parseFloat(hintEfficiency) <= 2.0 ? "excellent" : parseFloat(hintEfficiency) <= 3.0 ? "on_track" : "behind";
  const learningVelocityStatus = learningVelocity === "Accelerating" ? "excellent" :
                                 learningVelocity === "Progressive" ? "on_track" :
                                 learningVelocity === "Slowing" ? "behind" : "adaptive";

  return {
    weeklyAccuracy: {
      value: weeklyAccuracy,
      status: weeklyAccuracyStatus,
      target: 75
    },
    problemsPerWeek: {
      value: weeklyProblems,
      status: problemsPerWeekStatus,
      target: userWeeklyTarget,
      display: weeklyProblems.toString()
    },
    hintEfficiency: {
      value: parseFloat(hintEfficiency),
      status: hintEfficiencyStatus,
      display: `<${hintEfficiency} per problem`
    },
    learningVelocity: {
      value: learningVelocity,
      status: learningVelocityStatus
    }
  };
}

/**
 * Calculate progress trend based on recent performance improvement
 */
export function calculateProgressTrend(attempts) {
  if (!attempts || attempts.length < 10) {
    return { trend: "Insufficient Data", percentage: 0 };
  }

  const sortedAttempts = attempts.sort((a, b) =>
    new Date(a.attempt_date || a.AttemptDate) - new Date(b.attempt_date || b.AttemptDate)
  );

  const recentAttempts = sortedAttempts.slice(-40);
  const midpoint = Math.floor(recentAttempts.length / 2);
  const olderHalf = recentAttempts.slice(0, midpoint);
  const newerHalf = recentAttempts.slice(midpoint);

  if (olderHalf.length === 0 || newerHalf.length === 0) {
    return { trend: "Insufficient Data", percentage: 0 };
  }

  const olderSuccessRate = olderHalf.filter(a => (a.success !== undefined ? a.success : a.Success)).length / olderHalf.length;
  const newerSuccessRate = newerHalf.filter(a => (a.success !== undefined ? a.success : a.Success)).length / newerHalf.length;

  const improvement = newerSuccessRate - olderSuccessRate;

  let trend = "Stable";
  if (improvement > 0.15) {
    trend = "Rapidly Improving";
  } else if (improvement > 0.05) {
    trend = "Improving";
  } else if (improvement < -0.15) {
    trend = "Declining";
  } else if (improvement < -0.05) {
    trend = "Slightly Declining";
  }

  const percentage = Math.round(newerSuccessRate * 100);

  return { trend, percentage };
}
