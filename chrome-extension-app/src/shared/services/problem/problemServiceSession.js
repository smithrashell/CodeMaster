/**
 * Problem Service Session Assembly Functions
 * Extracted from problemService.js
 */

import { fetchAdditionalProblems, fetchAllProblems } from "../../db/stores/problems.js";
import { fetchProblemById } from "../../db/stores/standard_problems.js";
import { ScheduleService } from "../schedule/scheduleService.js";
import { StorageService } from "../storage/storageService.js";
import { calculateDecayScore } from "../../utils/leitner/Utils.js";
import { getTagMastery } from "../../db/stores/tag_mastery.js";
import logger from "../../utils/logging/logger.js";
import {
  selectOptimalProblems,
  getRecentAttempts,
  getFailureTriggeredReviews
} from "../../db/stores/problem_relationships.js";
import { applySafetyGuardRails } from "../../utils/session/sessionBalancing.js";
import { getRecentSessionAnalytics } from "../../db/stores/sessionAnalytics.js";
import { getPatternLadders } from "../../utils/leitner/patternLadderUtils.js";
import { getTagRelationships } from "../../db/stores/tag_relationships.js";
import {
  enrichReviewProblem,
  normalizeReviewProblem,
  filterValidReviewProblems,
  logReviewProblemsAnalysis
} from "./problemServiceHelpers.js";

// ============================================================================
// ADAPTIVE LEARNING: TRIGGERED REVIEW SYSTEM (Priority 1)
// ============================================================================

/**
 * Add triggered reviews to session - mastered problems that reinforce struggling concepts
 * This is PRIORITY 1 in session composition - runs before regular reviews
 *
 * @param {Array} sessionProblems - Array to add problems to (modified in place)
 * @param {number} sessionLength - Maximum session length
 * @param {boolean} isOnboarding - Whether this is an onboarding session
 * @returns {Promise<number>} Number of triggered reviews added
 */
export async function addTriggeredReviewsToSession(sessionProblems, sessionLength, isOnboarding) {
  if (isOnboarding) {
    logger.info("Skipping triggered reviews during onboarding");
    return 0;
  }

  try {
    // Get recent attempts from last 2 sessions
    const recentAttempts = await getRecentAttempts({ sessions: 2 });

    if (recentAttempts.length === 0) {
      logger.info("No recent attempts found - skipping triggered reviews");
      return 0;
    }

    // Find mastered problems that relate to struggling problems
    const triggeredReviews = await getFailureTriggeredReviews(recentAttempts);

    if (triggeredReviews.length === 0) {
      logger.info("No triggered reviews needed - user doing well or no related mastered problems");
      return 0;
    }

    // Add up to 2 triggered reviews (max per session)
    const maxTriggeredReviews = Math.min(2, sessionLength, triggeredReviews.length);
    const reviewsToAdd = triggeredReviews.slice(0, maxTriggeredReviews);

    for (const review of reviewsToAdd) {
      const enrichedProblem = await enrichReviewProblem(review.problem, fetchProblemById);
      const normalizedProblem = {
        ...enrichedProblem,
        id: enrichedProblem.id || enrichedProblem.leetcode_id,
        leetcode_id: enrichedProblem.leetcode_id,
        selectionReason: {
          type: 'triggered_review',
          reason: review.triggerReason,
          triggeredBy: review.triggeredBy,
          aggregateStrength: review.aggregateStrength,
          connectedProblems: review.connectedProblems
        }
      };

      // Ensure slug exists
      if (!normalizedProblem.slug) {
        normalizedProblem.slug = enrichedProblem.slug || enrichedProblem.title_slug || enrichedProblem.titleSlug;
        if (!normalizedProblem.slug && enrichedProblem.title) {
          normalizedProblem.slug = enrichedProblem.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        }
      }

      sessionProblems.push(normalizedProblem);
    }

    logger.info(`🌉 Added ${reviewsToAdd.length} triggered reviews (bridge problems) to session`);
    return reviewsToAdd.length;
  } catch (error) {
    logger.error("Error adding triggered reviews:", error);
    return 0;
  }
}

/**
 * Add learning review problems to session (box levels 1-5 only)
 * This is PRIORITY 2 in session composition - runs after triggered reviews
 * Mastered problems (box 6-8) are now handled contextually by triggered reviews
 *
 * @param {Array} sessionProblems - Array to add problems to (modified in place)
 * @param {number} sessionLength - Maximum session length
 * @param {boolean} isOnboarding - Whether this is an onboarding session
 * @param {Array} allProblems - All user problems for fallback analysis
 * @returns {Promise<number>} Number of learning reviews added
 */
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

  // Filter to only include LEARNING reviews (box level 1-5)
  // Mastered reviews (box 6-8) are now handled by triggered reviews or passive fill
  const MAX_LEARNING_BOX_LEVEL = 5;
  const learningReviewProblems = filterValidReviewProblems(enrichedReviewProblems)
    .filter(p => {
      const boxLevel = p.box_level || p.boxLevel || 1;
      return boxLevel <= MAX_LEARNING_BOX_LEVEL;
    })
    .map(normalizeReviewProblem);

  const masteredReviewCount = enrichedReviewProblems.filter(p => {
    const boxLevel = p.box_level || p.boxLevel || 1;
    return boxLevel > MAX_LEARNING_BOX_LEVEL;
  }).length;

  // Calculate review slots: ~30% of remaining session space for reviews
  const remainingSlots = sessionLength - sessionProblems.length;
  const reviewSlots = Math.ceil(remainingSlots * 0.3);
  const reviewProblemsToAdd = learningReviewProblems.slice(0, Math.min(reviewSlots, learningReviewProblems.length));

  // Exclude IDs already in session (from triggered reviews)
  const sessionIds = new Set(sessionProblems.map(p => p.id || p.leetcode_id));
  const uniqueReviewProblems = reviewProblemsToAdd.filter(p => !sessionIds.has(p.id || p.leetcode_id));

  logReviewProblemsAnalysis(enrichedReviewProblems, learningReviewProblems, sessionProblems, uniqueReviewProblems);
  sessionProblems.push(...uniqueReviewProblems);

  logger.info(`Added ${uniqueReviewProblems.length} learning reviews (box 1-5) to session`);
  if (masteredReviewCount > 0) {
    logger.info(`📌 ${masteredReviewCount} mastered reviews (box 6-8) deferred to triggered/passive fill`);
  }

  if (uniqueReviewProblems.length > 0) {
    logger.info(`Session has ${sessionProblems.length} problems, ${sessionLength - sessionProblems.length} slots for new problems`);
  }

  analyzeReviewProblems(learningReviewProblems, sessionLength, allProblems);
  return uniqueReviewProblems.length;
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

/**
 * Add passive mastered reviews (box 6-8) if session still not full
 * This is PRIORITY 4 - only fills remaining slots after triggered reviews, learning reviews, and new problems
 *
 * @param {Array} sessionProblems - Array to add problems to (modified in place)
 * @param {number} sessionLength - Maximum session length
 * @param {boolean} isOnboarding - Whether this is an onboarding session
 * @returns {Promise<number>} Number of passive mastered reviews added
 */
export async function addPassiveMasteredReviews(sessionProblems, sessionLength, isOnboarding) {
  if (isOnboarding || sessionProblems.length >= sessionLength) {
    return 0;
  }

  try {
    const allReviewProblems = await ScheduleService.getDailyReviewSchedule(null);
    if (!allReviewProblems || allReviewProblems.length === 0) {
      return 0;
    }

    const enrichedReviewProblems = await Promise.all(
      allReviewProblems.map(reviewProblem => enrichReviewProblem(reviewProblem, fetchProblemById))
    );

    // Filter to only mastered problems (box 6-8)
    const MIN_MASTERED_BOX_LEVEL = 6;
    const masteredReviews = filterValidReviewProblems(enrichedReviewProblems)
      .filter(p => {
        const boxLevel = p.box_level || p.boxLevel || 1;
        return boxLevel >= MIN_MASTERED_BOX_LEVEL;
      })
      .map(normalizeReviewProblem);

    // Exclude IDs already in session
    const sessionIds = new Set(sessionProblems.map(p => p.id || p.leetcode_id));
    const availableMastered = masteredReviews.filter(p => !sessionIds.has(p.id || p.leetcode_id));

    // Only add what's needed to fill the session
    const slotsRemaining = sessionLength - sessionProblems.length;
    const passiveReviewsToAdd = availableMastered.slice(0, slotsRemaining);

    // Mark as passive mastered review
    passiveReviewsToAdd.forEach(p => {
      p.selectionReason = {
        type: 'passive_mastered_review',
        reason: 'Session filler - mastered problem due for scheduled review'
      };
    });

    sessionProblems.push(...passiveReviewsToAdd);

    if (passiveReviewsToAdd.length > 0) {
      logger.info(`📚 Added ${passiveReviewsToAdd.length} passive mastered reviews (box 6-8) to fill session`);
    }

    return passiveReviewsToAdd.length;
  } catch (error) {
    logger.error("Error adding passive mastered reviews:", error);
    return 0;
  }
}

export async function addFallbackProblems(sessionProblems, sessionLength, allProblems) {
  if (sessionProblems.length >= sessionLength) return;

  const fallbackNeeded = sessionLength - sessionProblems.length;
  const usedIds = new Set(sessionProblems.filter(p => p && (p.problem_id || p.leetcode_id) && p.title && p.title.trim()).map((p) => p.problem_id || p.leetcode_id));

  const fallbackProblems = allProblems
    .filter(p => p && (p.problem_id || p.leetcode_id) && p.title && p.title.trim())
    .filter((p) => !usedIds.has(p.problem_id || p.leetcode_id))
    .sort(problemSortingCriteria)
    .slice(0, fallbackNeeded);

  const enrichedFallback = await Promise.all(
    fallbackProblems.map(p => enrichReviewProblem(p, fetchProblemById))
  );
  const validFallback = enrichedFallback.filter(p => p.difficulty && p.tags);

  sessionProblems.push(...validFallback);
  logger.info(`Added ${validFallback.length} fallback problems`);
}

export async function checkSafetyGuardRails(finalSession, currentDifficultyCap) {
  const sessionState = await StorageService.getSessionState();
  const sessionsAtCurrentDifficulty = sessionState?.escape_hatches?.sessions_at_current_difficulty || 0;
  const currentPromotionType = sessionState?.escape_hatches?.current_promotion_type || null;

  // Get recent performance for guard rail check
  const recentPerformance = await getRecentPerformanceForGuardRails();

  const guardRailResult = applySafetyGuardRails(
    finalSession,
    currentDifficultyCap,
    sessionsAtCurrentDifficulty,
    recentPerformance,
    currentPromotionType
  );

  if (guardRailResult.needsRebalance) {
    logger.warn(`Session difficulty imbalance detected: ${guardRailResult.message}`);

    if (guardRailResult.guardRailType === 'poor_performance_protection') {
      const rebalancedSession = await rebalanceSessionForPoorPerformance([...finalSession], guardRailResult);
      return { rebalancedSession, guardRailResult };
    }
  }

  return { rebalancedSession: null, guardRailResult };
}

async function getRecentPerformanceForGuardRails() {
  try {
    const recentAnalytics = await getRecentSessionAnalytics(3);
    if (!recentAnalytics || recentAnalytics.length === 0) return null;

    const totalAccuracy = recentAnalytics.reduce((sum, s) => sum + (s.accuracy || 0), 0);
    return {
      accuracy: totalAccuracy / recentAnalytics.length,
      sessionsAnalyzed: recentAnalytics.length
    };
  } catch (error) {
    logger.warn("Failed to get recent performance:", error);
    return null;
  }
}

async function rebalanceSessionForPoorPerformance(session, guardRailResult) {
  const { excessHard, replacementDifficulty } = guardRailResult;

  // Identify Hard problems to remove (from end of list)
  const hardProblems = session.filter(p => p.difficulty === 'Hard');
  const problemsToRemove = hardProblems.slice(-excessHard);
  const removedIds = new Set(problemsToRemove.map(p => p.id || p.leetcode_id));

  // Get tags from removed problems for finding related replacements
  const removedTags = new Set();
  problemsToRemove.forEach(p => {
    (p.tags || []).forEach(tag => removedTags.add(tag.toLowerCase()));
  });

  // Find replacement problems from related ladders
  const replacements = await findReplacementProblems(
    Array.from(removedTags),
    excessHard,
    replacementDifficulty,
    removedIds,
    session
  );

  // Remove excess Hard problems
  for (let i = session.length - 1; i >= 0; i--) {
    const problemId = session[i].id || session[i].leetcode_id;
    if (removedIds.has(problemId)) {
      session.splice(i, 1);
    }
  }

  // Add replacements
  session.push(...replacements);

  logger.info(`Rebalanced: removed ${excessHard} Hard, added ${replacements.length} ${replacementDifficulty}`);
  return session;
}

async function findReplacementProblems(primaryTags, count, targetDifficulty, excludeIds, currentSession) {
  try {
    const ladders = await getPatternLadders();
    const tagRelationships = await getTagRelationships();
    const currentSessionIds = new Set(currentSession.map(p => p.id || p.leetcode_id));
    const allExcludeIds = new Set([...excludeIds, ...currentSessionIds]);

    const candidates = [];

    // Step 1: Try primary tags first
    for (const tag of primaryTags) {
      const ladder = ladders[tag];
      if (ladder?.problems) {
        const matching = ladder.problems.filter(p =>
          p.difficulty === targetDifficulty && !p.attempted && !allExcludeIds.has(p.id)
        );
        candidates.push(...matching.map(p => ({ ...p, sourceTag: tag, relationScore: 1.0 })));
      }
    }

    // Step 2: Try related tags (sorted by relationship strength)
    for (const tag of primaryTags) {
      const related = tagRelationships[tag];
      if (!related) continue;

      // Sort related tags by strength (descending)
      const sortedRelated = Object.entries(related)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);  // Top 5 related tags

      for (const [relatedTag, strength] of sortedRelated) {
        if (candidates.length >= count * 2) break;

        const ladder = ladders[relatedTag];
        if (ladder?.problems) {
          const matching = ladder.problems.filter(p =>
            p.difficulty === targetDifficulty && !p.attempted && !allExcludeIds.has(p.id)
          );
          candidates.push(...matching.map(p => ({ ...p, sourceTag: relatedTag, relationScore: strength })));
        }
      }
    }

    // Step 3: Fall back to Easy if not enough Medium
    if (candidates.length < count && targetDifficulty === 'Medium') {
      for (const tag of primaryTags) {
        const ladder = ladders[tag];
        if (ladder?.problems) {
          const easyProblems = ladder.problems.filter(p =>
            p.difficulty === 'Easy' && !p.attempted && !allExcludeIds.has(p.id)
          );
          candidates.push(...easyProblems.map(p => ({ ...p, sourceTag: tag, relationScore: 0.5 })));
        }
      }
    }

    // Deduplicate and select top by relation score
    candidates.sort((a, b) => b.relationScore - a.relationScore);
    const seen = new Set();
    const selected = [];
    for (const candidate of candidates) {
      if (selected.length >= count) break;
      if (!seen.has(candidate.id)) {
        seen.add(candidate.id);
        selected.push(candidate);
      }
    }

    logger.info(`Found ${selected.length} replacement problems from related ladders`);
    return selected;
  } catch (error) {
    logger.error("Error finding replacement problems:", error);
    return [];
  }
}

export function logFinalSessionComposition(sessionWithReasons, sessionLength, reviewProblemsCount, triggeredReviewsCount = 0) {
  logger.info(`Final session composition:`);
  logger.info(`   Total problems: ${sessionWithReasons.length}/${sessionLength}`);
  logger.info(`   Review problems: ${reviewProblemsCount}`);
  if (triggeredReviewsCount > 0) {
    logger.info(`      - Triggered reviews (bridge problems): ${triggeredReviewsCount}`);
    logger.info(`      - Learning/passive reviews: ${reviewProblemsCount - triggeredReviewsCount}`);
  }
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
