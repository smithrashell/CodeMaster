/**
 * Helper functions for problemService.js
 *
 * Extracted to reduce function complexity
 */

import logger from '../utils/logger.js';

/**
 * Enrich review problem with metadata from standard problem
 */
export async function enrichReviewProblem(reviewProblem, fetchProblemById) {
  const leetcodeId = reviewProblem.leetcode_id || reviewProblem.id;

  if (!leetcodeId) {
    logger.warn(`⚠️ Review problem missing leetcode_id:`, reviewProblem);
    return reviewProblem;
  }

  const standardProblem = await fetchProblemById(Number(leetcodeId));

  if (!standardProblem) {
    logger.error(`❌ Could not find problem ${leetcodeId} in standard_problems. Review problem may be from old data.`);
    return reviewProblem;
  }

  const enriched = {
    ...reviewProblem,
    difficulty: reviewProblem.difficulty || standardProblem.difficulty,
    tags: reviewProblem.tags || standardProblem.tags,
    slug: reviewProblem.slug || standardProblem.slug,
    title: reviewProblem.title || standardProblem.title,
    id: Number(leetcodeId),
    leetcode_id: Number(leetcodeId)
  };

  logger.info(`✅ Enriched problem ${leetcodeId}:`, {
    title: enriched.title,
    difficulty: enriched.difficulty,
    tagsCount: enriched.tags?.length,
    hasSlug: !!enriched.slug
  });

  return enriched;
}

/**
 * Normalize a single review problem for frontend compatibility
 */
export function normalizeReviewProblem(p) {
  const normalized = {
    ...p,
    id: p.id || p.leetcode_id
  };

  // Normalize field names for frontend compatibility
  if (p.leetcode_address && !normalized.LeetCodeAddress) {
    normalized.LeetCodeAddress = p.leetcode_address;
  }

  // Ensure slug exists
  if (!normalized.slug) {
    normalized.slug = p.slug || p.title_slug || p.titleSlug || p.TitleSlug;
  }

  // Generate slug from title as last resort
  if (!normalized.slug && (p.title || p.Title || p.ProblemDescription)) {
    const title = p.title || p.Title || p.ProblemDescription;
    normalized.slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    logger.warn(`⚠️ Generated slug from title for problem: ${title} → ${normalized.slug}`);
  }

  logger.info(`🔗 Review problem URL fields for "${p.title || p.Title}":`, {
    has_leetcode_address: !!p.leetcode_address,
    has_LeetCodeAddress: !!normalized.LeetCodeAddress,
    has_slug: !!normalized.slug,
    LeetCodeAddress: normalized.LeetCodeAddress,
    slug: normalized.slug
  });

  // Include attempt data for frontend
  if (p.attempt_stats) {
    normalized.attempts = p.attempt_stats.total_attempts > 0 ?
      [{ count: p.attempt_stats.total_attempts }] : [];
  } else if (!normalized.attempts) {
    normalized.attempts = [];
  }

  return normalized;
}

/**
 * Filter valid review problems
 */
export function filterValidReviewProblems(problems) {
  return (problems || []).filter(p => {
    const isValid = p && (p.id || p.leetcode_id);
    if (!isValid && p) {
      logger.warn(`🔍 DEBUG: Filtering out invalid review problem:`, {
        hasP: !!p,
        hasId: !!p.id,
        hasLeetcodeId: !!p.leetcode_id,
        hasProblemId: !!p.problem_id,
        keys: Object.keys(p)
      });
    }
    return isValid;
  });
}

/**
 * Log review problems analysis
 */
export function logReviewProblemsAnalysis(enrichedReviewProblems, validReviewProblems, sessionProblems, reviewProblemsToAdd) {
  logger.info(`🔍 DEBUG: reviewProblems before filtering:`, {
    isArray: Array.isArray(enrichedReviewProblems),
    length: enrichedReviewProblems?.length,
    first5: enrichedReviewProblems?.slice(0, 5).map(p => ({
      id: p?.id,
      leetcode_id: p?.leetcode_id,
      problem_id: p?.problem_id,
      title: p?.title,
      difficulty: p?.difficulty,
      review_schedule: p?.review_schedule,
      allKeys: Object.keys(p || {})
    }))
  });

  logger.info(`🔍 DEBUG: After filtering and normalizing - valid review problems: ${validReviewProblems.length}`);

  if (validReviewProblems.length > 0) {
    logger.info(`🔍 NORMALIZATION CHECK - First review problem after normalization:`, {
      id: validReviewProblems[0].id,
      leetcode_id: validReviewProblems[0].leetcode_id,
      problem_id: validReviewProblems[0].problem_id,
      hasAttempts: !!validReviewProblems[0].attempts,
      attemptsLength: validReviewProblems[0].attempts?.length,
      attemptsContent: validReviewProblems[0].attempts,
      hasAttemptStats: !!validReviewProblems[0].attempt_stats,
      attemptStatsTotal: validReviewProblems[0].attempt_stats?.total_attempts
    });
  }

  logger.info(`🔍 DEBUG: Before push - sessionProblems.length: ${sessionProblems.length}`);
  logger.info(`🔍 DEBUG: About to push ${reviewProblemsToAdd.length} problems:`,
    reviewProblemsToAdd.slice(0, 3).map(p => ({
      id: p?.id,
      leetcode_id: p?.leetcode_id,
      title: p?.title,
      hasAttempts: !!p.attempts,
      attemptsLength: p.attempts?.length
    }))
  );
}
