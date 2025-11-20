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

  // Ensure slug exists
  if (!normalized.slug) {
    normalized.slug = p.slug || p.title_slug || p.titleSlug || p.TitleSlug;
  }

  // Generate slug from title as last resort
  if (!normalized.slug && p.title) {
    normalized.slug = p.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    logger.warn(`⚠️ Generated slug from title for problem: ${p.title} → ${normalized.slug}`);
  }

  // Only log URL field details in debug mode
  if (process.env.NODE_ENV !== 'production' && process.env.DEBUG_PROBLEM_SERVICE) {
    logger.debug(`Review problem URL fields for "${p.title}":`, {
      has_leetcode_address: !!p.leetcode_address,
      has_slug: !!normalized.slug
    });
  }

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
 * Checks for required fields: id, title, difficulty, tags
 */
export function filterValidReviewProblems(problems) {
  return (problems || []).filter(p => {
    // Must have an id
    if (!p || (!p.id && !p.leetcode_id)) {
      if (p) {
        logger.warn(`Filtering out problem with no id`);
      }
      return false;
    }

    // Must have title (required for normalization)
    if (!p.title) {
      logger.warn(`Filtering out problem ${p.id || p.leetcode_id} with no title (likely missing standard_problem data)`);
      return false;
    }

    // Must have difficulty
    if (!p.difficulty) {
      logger.warn(`Filtering out problem ${p.id || p.leetcode_id} with no difficulty`);
      return false;
    }

    // Must have tags
    if (!p.tags) {
      logger.warn(`Filtering out problem ${p.id || p.leetcode_id} with no tags`);
      return false;
    }

    return true;
  });
}

/**
 * Log review problems analysis (only in debug mode)
 */
export function logReviewProblemsAnalysis(enrichedReviewProblems, validReviewProblems, sessionProblems, reviewProblemsToAdd) {
  // Only log in development/debug mode
  if (process.env.NODE_ENV !== 'production' && process.env.DEBUG_PROBLEM_SERVICE) {
    logger.debug(`Review problems analysis:`, {
      enrichedCount: enrichedReviewProblems?.length,
      validCount: validReviewProblems.length,
      sessionCount: sessionProblems.length,
      toAddCount: reviewProblemsToAdd.length
    });
  }
}
