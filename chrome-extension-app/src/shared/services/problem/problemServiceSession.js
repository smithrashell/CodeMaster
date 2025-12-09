/**
 * Problem Service Session Assembly Functions
 * Extracted from problemService.js
 */

import { fetchAdditionalProblems, fetchAllProblems } from "../../db/stores/problems.js";
import { fetchProblemById } from "../../db/stores/standard_problems.js";
import { ScheduleService } from "../schedule/scheduleService.js";
import { StorageService } from "./storageService.js";
import { calculateDecayScore } from "../utils/Utils.js";
import { getTagMastery } from "../../db/stores/tag_mastery.js";
import logger from "../../utils/logging/logger.js";
import { selectOptimalProblems } from "../db/problem_relationships.js";
import { applySafetyGuardRails } from "../utils/sessionBalancing.js";
import {
  enrichReviewProblem,
  normalizeReviewProblem,
  filterValidReviewProblems,
  logReviewProblemsAnalysis
} from "./problemServiceHelpers.js";

export async function addReviewProblemsToSession(sessionProblems, sessionLength, isOnboarding, allProblems) {
  if (isOnboarding) {
    logger.info("Skipping review problems during onboarding - focusing on new problem distribution");
    return 0;
  }

  const allReviewProblems = await ScheduleService.getDailyReviewSchedule(null);
  logger.info(`Found ${allReviewProblems?.length || 0} total problems due for review from Leitner system`);

  const enrichedReviewProblems = await Promise.all(
    (allReviewProblems || []).map(reviewProblem => enrichReviewProblem(reviewProblem, fetchProblemById))
  );

  const validReviewProblems = filterValidReviewProblems(enrichedReviewProblems).map(normalizeReviewProblem);
  const reviewProblemsToAdd = validReviewProblems.slice(0, Math.min(sessionLength, validReviewProblems.length));

  logReviewProblemsAnalysis(enrichedReviewProblems, validReviewProblems, sessionProblems, reviewProblemsToAdd);
  sessionProblems.push(...reviewProblemsToAdd);

  logger.info(`Added ${reviewProblemsToAdd.length} review problems to session (${validReviewProblems.length} total due from Leitner system)`);

  if (reviewProblemsToAdd.length === sessionLength) {
    logger.info(`Session filled entirely with review problems (${reviewProblemsToAdd.length}/${sessionLength})`);
  } else if (reviewProblemsToAdd.length > 0) {
    logger.info(`Session has ${reviewProblemsToAdd.length} review problems, ${sessionLength - reviewProblemsToAdd.length} slots available for new problems`);
  }

  analyzeReviewProblems(validReviewProblems, sessionLength, allProblems);
  return reviewProblemsToAdd.length;
}

export function analyzeReviewProblems(reviewProblems, sessionLength, allProblems) {
  if (reviewProblems.length === 0) {
    const hasAttemptedProblems = allProblems.length > 0;
    if (!hasAttemptedProblems) {
      logger.info(`New user detected - no review problems available. Session will contain only new problems.`);
    } else {
      logger.info(`No review problems due today. Session will contain only new problems.`);
    }
  } else if (reviewProblems.length < sessionLength) {
    logger.info(`Found ${reviewProblems.length} review problems due. Remaining ${sessionLength - reviewProblems.length} slots will be filled with new problems.`);
  } else {
    logger.info(`Found ${reviewProblems.length} review problems due (more than session length of ${sessionLength}).`);
  }
}

export async function addNewProblemsToSession(params) {
  const { sessionLength, sessionProblems, excludeIds, userFocusAreas,
    currentAllowedTags, currentDifficultyCap, isOnboarding } = params;

  const newProblemsNeeded = sessionLength - sessionProblems.length;
  if (newProblemsNeeded <= 0) return;

  const candidatesNeeded = Math.min(newProblemsNeeded * 3, 50);
  const candidateProblems = await fetchAdditionalProblems(
    candidatesNeeded,
    excludeIds,
    userFocusAreas,
    currentAllowedTags,
    {
      userId: "session_state",
      currentDifficultyCap,
      isOnboarding
    }
  );

  const newProblems = await selectNewProblems(candidateProblems, newProblemsNeeded, isOnboarding);

  const normalizedNewProblems = newProblems.map(p => {
    const normalized = {
      ...p,
      id: p.id || p.leetcode_id
    };

    if (!normalized.slug) {
      normalized.slug = p.slug || p.title_slug || p.titleSlug || p.TitleSlug;
    }

    if (!normalized.slug && p.title) {
      normalized.slug = p.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      logger.warn(`Generated slug from title for new problem: ${p.title} → ${normalized.slug}`);
    }

    if (p.attempt_stats) {
      normalized.attempts = p.attempt_stats.total_attempts > 0 ?
        [{ count: p.attempt_stats.total_attempts }] : [];
    } else if (!normalized.attempts) {
      normalized.attempts = [];
    }

    return normalized;
  });

  sessionProblems.push(...normalizedNewProblems);
  logger.info(`Added ${normalizedNewProblems.length}/${newProblemsNeeded} new problems${!isOnboarding ? ' with optimal path scoring' : ''}`);
}

export async function selectNewProblems(candidateProblems, newProblemsNeeded, isOnboarding) {
  if (!candidateProblems || !Array.isArray(candidateProblems)) {
    logger.warn(`candidateProblems is ${candidateProblems === null ? 'null' : typeof candidateProblems}, returning empty array`);
    return [];
  }

  if (!isOnboarding && candidateProblems.length >= newProblemsNeeded) {
    logger.info(`Applying optimal path scoring to ${candidateProblems.length} candidates`);
    try {
      const tagMastery = await getTagMastery();
      const userState = {
        tagMastery: tagMastery.reduce((acc, tm) => {
          acc[tm.tag] = {
            mastered: tm.mastered,
            successRate: tm.totalAttempts > 0 ? tm.successfulAttempts / tm.totalAttempts : 0,
            attempts: tm.totalAttempts
          };
          return acc;
        }, {})
      };

      const scoredProblems = await selectOptimalProblems(candidateProblems, userState);
      const selected = scoredProblems.slice(0, newProblemsNeeded);
      logger.info(`Selected ${selected.length} optimal problems`);
      return selected;
    } catch (error) {
      logger.error("Error applying optimal path scoring, falling back to standard selection:", error);
      return candidateProblems.slice(0, newProblemsNeeded);
    }
  } else {
    logger.info(`Using ${Math.min(candidateProblems.length, newProblemsNeeded)} problems (onboarding: ${isOnboarding})`);
    return candidateProblems.slice(0, newProblemsNeeded);
  }
}

export function addFallbackProblems(sessionProblems, sessionLength, allProblems) {
  if (sessionProblems.length >= sessionLength) return;

  const fallbackNeeded = sessionLength - sessionProblems.length;
  const usedIds = new Set(sessionProblems.filter(p => p && (p.problem_id || p.leetcode_id) && p.title && p.title.trim()).map((p) => p.problem_id || p.leetcode_id));

  const fallbackProblems = allProblems
    .filter(p => p && (p.problem_id || p.leetcode_id) && p.title && p.title.trim())
    .filter((p) => !usedIds.has(p.problem_id || p.leetcode_id))
    .sort(problemSortingCriteria)
    .slice(0, fallbackNeeded);

  sessionProblems.push(...fallbackProblems);
  logger.info(`Added ${fallbackProblems.length} fallback problems`);
}

export async function checkSafetyGuardRails(finalSession, currentDifficultyCap) {
  const sessionState = await StorageService.getSessionState();
  const sessionsAtCurrentDifficulty = sessionState?.escape_hatches?.sessions_at_current_difficulty || 0;

  const guardRailResult = applySafetyGuardRails(
    finalSession,
    currentDifficultyCap,
    sessionsAtCurrentDifficulty
  );

  if (guardRailResult.needsRebalance) {
    logger.warn(`Session difficulty imbalance detected: ${guardRailResult.message}`);
  }
}

export function logFinalSessionComposition(sessionWithReasons, sessionLength, reviewProblemsCount) {
  logger.info(`Final session composition:`);
  logger.info(`   Total problems: ${sessionWithReasons.length}/${sessionLength}`);
  logger.info(`   Review problems: ${reviewProblemsCount}`);
  logger.info(`   New problems: ${sessionWithReasons.length - reviewProblemsCount}`);
  logger.info(`   Problems with reasoning: ${sessionWithReasons.filter((p) => p.selectionReason).length}`);
}

export function deduplicateById(problems) {
  const seen = new Set();
  let kept = 0;
  let filtered = 0;

  const result = problems.filter((problem, index) => {
    const problemId = problem.id || problem.leetcode_id;

    if (index < 3) {
      logger.info(`Deduplication [${index}]:`, {
        title: problem.title,
        id: problem.id,
        leetcode_id: problem.leetcode_id,
        problemId,
        alreadySeen: seen.has(problemId)
      });
    }

    if (!problemId || seen.has(problemId)) {
      filtered++;
      return false;
    }
    seen.add(problemId);
    kept++;
    return true;
  });

  logger.info(`Deduplication summary: kept=${kept}, filtered=${filtered}, total=${problems.length}`);
  return result;
}

export function problemSortingCriteria(a, b) {
  const reviewDateA = new Date(a.review_schedule);
  const reviewDateB = new Date(b.review_schedule);

  if (reviewDateA < reviewDateB) return -1;
  if (reviewDateA > reviewDateB) return 1;

  const totalAttemptsA = a.attempt_stats?.total_attempts || 0;
  const totalAttemptsB = b.attempt_stats?.total_attempts || 0;

  if (totalAttemptsA < totalAttemptsB) return -1;
  if (totalAttemptsA > totalAttemptsB) return 1;

  const successfulAttemptsA = a.attempt_stats?.successful_attempts || 0;
  const successfulAttemptsB = b.attempt_stats?.successful_attempts || 0;

  const aScore = calculateDecayScore(
    a.lastAttemptDate,
    totalAttemptsA > 0 ? successfulAttemptsA / totalAttemptsA : 0
  );
  const bScore = calculateDecayScore(
    b.lastAttemptDate,
    totalAttemptsB > 0 ? successfulAttemptsB / totalAttemptsB : 0
  );

  return bScore - aScore;
}

export async function getExistingProblemsAndExcludeIds() {
  const allProblems = await fetchAllProblems();
  const excludeIds = new Set(allProblems.filter(p => p && p.leetcode_id && p.title && p.title.trim()).map((p) => p.leetcode_id));
  return { allProblems, excludeIds };
}
