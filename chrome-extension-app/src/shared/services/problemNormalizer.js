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
import {
  buildSessionMetadata,
  buildAttemptTracking,
  buildSpacedRepetitionData,
  buildLeetCodeAddressFields,
  buildAttemptsArray,
  buildInterviewModeFields,
  buildOptimalPathData
} from "./problemNormalizerHelpers.js";

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
  if (!problem.title) {
    throw new Error(`Problem ${leetcodeId} missing title`);
  }

  // Must have difficulty - if missing, try to fetch from standard_problems
  if (!problem.difficulty) {
    logger.warn(`Problem ${leetcodeId} missing difficulty field. Attempting to fetch from standard_problems...`);
    logger.error(`Problem object with missing difficulty:`, problem);
    logger.error(`Available keys:`, Object.keys(problem));
    throw new Error(`Problem ${leetcodeId} missing difficulty - needs to be fetched from standard_problems`);
  }

  // Must have tags
  if (!problem.tags) {
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
      title: toTitleCase(problem.title),
      slug: problem.slug,
      difficulty: problem.difficulty,
      tags: problem.tags || [],

      // ============ OPTIONAL FIELDS (preserve if present) ============
      ...buildSessionMetadata(problem),
      ...buildAttemptTracking(problem),
      ...buildSpacedRepetitionData(problem),
      ...buildLeetCodeAddressFields(problem),
      ...buildAttemptsArray(problem),
      ...buildInterviewModeFields(problem),
      ...buildOptimalPathData(problem),

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
