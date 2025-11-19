/**
 * Problem Normalizer Service
 *
 * Ensures all problems have a consistent structure when added to sessions.
 * NO FALLBACKS - if data is missing or incorrect, throw an error.
 *
 * Standard Structure:
 * - id: LeetCode ID (number) - for UI display
 * - leetcode_id: LeetCode ID (number) - for matching/lookups
 * - problem_id: UUID (string) or null - null if never attempted before
 * - title, slug, difficulty, tags: core problem data
 *
 * Source Types:
 * - 'standard_problem': Brand new problem from standard_problems (no UUID)
 * - 'user_problem': Previously attempted problem from problems database (has UUID)
 * - 'interview': Problem for interview session
 */

import logger from "../utils/logger.js";

/**
 * Converts a string to title case (capitalizes first letter of each word)
 * @param {string} str - String to convert
 * @returns {string} Title cased string
 */
function toTitleCase(str) {
  if (!str || typeof str !== 'string') return str;
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Validates that a problem has the minimum required fields
 * @param {Object} problem - Raw problem object
 * @throws {Error} If validation fails
 */
function validateRawProblem(problem) {
  if (!problem) {
    throw new Error('Problem is null or undefined');
  }

  // Must have either leetcode_id OR id
  const leetcodeId = problem.leetcode_id || problem.id;
  if (!leetcodeId) {
    throw new Error(`Problem missing both leetcode_id and id: ${JSON.stringify(problem)}`);
  }

  // Must be a valid number
  if (isNaN(Number(leetcodeId))) {
    throw new Error(`Invalid leetcode_id (not a number): ${leetcodeId}`);
  }

  // Must have title
  if (!problem.title && !problem.Title && !problem.Description) {
    throw new Error(`Problem ${leetcodeId} missing title`);
  }

  // Must have difficulty - if missing, try to fetch from standard_problems
  if (!problem.difficulty && !problem.Difficulty) {
    logger.warn(`Problem ${leetcodeId} missing difficulty field. Attempting to fetch from standard_problems...`);
    logger.error(`Problem object with missing difficulty:`, problem);
    logger.error(`Available keys:`, Object.keys(problem));
    throw new Error(`Problem ${leetcodeId} missing difficulty - needs to be fetched from standard_problems`);
  }

  // Must have tags
  if (!problem.tags && !problem.Tags) {
    throw new Error(`Problem ${leetcodeId} missing tags`);
  }
}

/**
 * Validates that a normalized problem has all required fields
 * @param {Object} problem - Normalized problem object
 * @throws {Error} If validation fails
 */
function validateNormalizedProblem(problem) {
  const required = ['id', 'leetcode_id', 'title', 'difficulty', 'tags'];
  const missing = required.filter(field => problem[field] === undefined || problem[field] === null);

  if (missing.length > 0) {
    throw new Error(`Normalized problem missing required fields: ${missing.join(', ')}`);
  }

  // Verify id === leetcode_id
  if (problem.id !== problem.leetcode_id) {
    throw new Error(`ID mismatch: id=${problem.id}, leetcode_id=${problem.leetcode_id}`);
  }

  // Verify tags is an array
  if (!Array.isArray(problem.tags)) {
    throw new Error(`Tags must be an array, got: ${typeof problem.tags}`);
  }

  // problem_id must be string or null (not undefined)
  if (problem.problem_id !== null && typeof problem.problem_id !== 'string') {
    throw new Error(`problem_id must be string or null, got: ${typeof problem.problem_id}`);
  }
}

/**
 * Normalizes a problem object to the standard structure
 *
 * @param {Object} problem - Raw problem object
 * @param {string} source - Source type ('standard_problem', 'user_problem', 'interview')
 * @returns {Object} Normalized problem object
 * @throws {Error} If problem is invalid or missing required fields
 */
export function normalizeProblem(problem, source = 'unknown') {
  try {
    // Validate input
    validateRawProblem(problem);

    // Extract LeetCode ID (must exist due to validation)
    const leetcodeId = Number(problem.leetcode_id || problem.id);

    // Build normalized structure - NO FALLBACKS
    const normalized = {
      // ============ PRIMARY IDENTIFIERS ============
      id: leetcodeId,
      leetcode_id: leetcodeId,
      problem_id: problem.problem_id || null,

      // ============ CORE PROBLEM FIELDS ============
      title: toTitleCase(problem.title || problem.Title || problem.Description),
      slug: problem.slug,
      difficulty: problem.difficulty || problem.Difficulty,
      tags: problem.tags || problem.Tags || [],

      // ============ SESSION METADATA (preserve if present) ============
      // NOTE: selectionReason is added AFTER normalization by ProblemReasoningService
      ...(problem.selectionReason && { selectionReason: problem.selectionReason }),
      ...(problem.sessionIndex !== undefined && { sessionIndex: problem.sessionIndex }),

      // ============ ATTEMPT TRACKING - CURRENT SESSION (preserve if present) ============
      ...(problem.attempted !== undefined && { attempted: problem.attempted }),
      ...(problem.attempt_date && { attempt_date: problem.attempt_date }),

      // ============ SPACED REPETITION DATA - HISTORICAL ============
      // Only present if problem_id !== null (previously attempted)
      ...(problem.box_level !== undefined && { box_level: problem.box_level }),
      ...(problem.review_schedule && { review_schedule: problem.review_schedule }),
      ...(problem.perceived_difficulty !== undefined && {
        perceived_difficulty: problem.perceived_difficulty
      }),
      ...(problem.consecutive_failures !== undefined && {
        consecutive_failures: problem.consecutive_failures
      }),
      ...(problem.stability !== undefined && { stability: problem.stability }),
      ...(problem.attempt_stats && { attempt_stats: problem.attempt_stats }),
      ...(problem.last_attempt_date && { last_attempt_date: problem.last_attempt_date }),
      ...(problem.cooldown_status !== undefined && { cooldown_status: problem.cooldown_status }),
      ...(problem.leetcode_address && { leetcode_address: problem.leetcode_address }),
      ...(problem.leetcode_address && { LeetCodeAddress: problem.leetcode_address }),
      ...(problem.LeetCodeAddress && { LeetCodeAddress: problem.LeetCodeAddress }),
      // Convert attempt_stats to attempts array for frontend, or preserve existing attempts
      ...(problem.attempts && { attempts: problem.attempts }),
      ...(!problem.attempts && problem.attempt_stats && {
        attempts: problem.attempt_stats.total_attempts > 0
          ? [{ count: problem.attempt_stats.total_attempts }]
          : []
      }),

      // ============ INTERVIEW MODE (preserve if present) ============
      ...(problem.interviewMode && { interviewMode: problem.interviewMode }),
      ...(problem.interviewConstraints && { interviewConstraints: problem.interviewConstraints }),

      // ============ OPTIMAL PATH DATA (preserve if present) ============
      ...(problem.pathScore !== undefined && { pathScore: problem.pathScore }),
      ...(problem.optimalPathData && { optimalPathData: problem.optimalPathData }),

      // ============ METADATA ============
      _normalized: true,
      _normalizedAt: new Date().toISOString(),
      _source: source
    };

    // Validate output
    validateNormalizedProblem(normalized);

    logger.info(`✅ Normalized problem ${leetcodeId}:`, {
      title: normalized.title,
      source,
      hasUUID: !!normalized.problem_id,
      hasLeitnerData: !!normalized.box_level
    });

    return normalized;
  } catch (error) {
    logger.error(`❌ Failed to normalize problem:`, {
      error: error.message,
      problem: problem,
      source
    });
    throw error;
  }
}

/**
 * Normalizes an array of problems
 *
 * @param {Array} problems - Array of raw problem objects
 * @param {string} source - Source type
 * @returns {Array} Array of normalized problems
 * @throws {Error} If any problem fails normalization
 */
export function normalizeProblems(problems, source = 'unknown') {
  if (!Array.isArray(problems)) {
    throw new Error(`Expected array of problems, got: ${typeof problems}`);
  }

  logger.info(`🔄 Normalizing ${problems.length} problems from ${source}`);

  const normalized = problems.map((problem, index) => {
    try {
      return normalizeProblem(problem, source);
    } catch (error) {
      logger.error(`❌ Failed to normalize problem at index ${index}:`, error);
      throw new Error(`Problem normalization failed at index ${index}: ${error.message}`);
    }
  });

  logger.info(`✅ Successfully normalized ${normalized.length} problems`);

  return normalized;
}

/**
 * Checks if a problem is already normalized
 *
 * @param {Object} problem - Problem object to check
 * @returns {boolean} True if already normalized
 */
export function isNormalized(problem) {
  return problem && problem._normalized === true;
}

export default {
  normalizeProblem,
  normalizeProblems,
  isNormalized
};
