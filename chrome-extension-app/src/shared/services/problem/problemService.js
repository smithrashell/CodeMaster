/**
 * Problem Service - Core problem management and session creation.
 *
 * @module problemService
 *
 * DATA CONTRACT DOCUMENTATION
 * ==========================
 * This module manages problem fetching, session creation, and problem updates.
 * Problems are normalized to a standard structure before being returned.
 *
 * IMPORTANT: All problems returned from createSession() are normalized with
 * required fields validated. See NormalizedProblem typedef for the contract.
 *
 * NOTE: There is no `getNextProblem()` function. Session navigation is handled
 * by indexing into `session.problems[current_problem_index]` directly.
 */

import {
  countProblemsByBoxLevel,
  addProblem,
  checkDatabaseForProblem,
} from "../../db/stores/problems.js";
import { getProblemFromStandardProblems } from "../../db/stores/standard_problems.js";
import { AttemptsService } from "../attempts/attemptsService.js";
import { v4 as uuidv4 } from "uuid";
import { fetchAllProblems, updateProblemsWithRatings as updateProblemsWithRatingsInDB } from "../../db/stores/problems.js";
import { buildAdaptiveSessionSettings } from "../../db/stores/sessions.js";
import { ProblemReasoningService } from "../../../content/services/problemReasoningService.js";
import { getTagMastery } from "../../db/stores/tag_mastery.js";
import performanceMonitor from "../../utils/performance/PerformanceMonitor.js";
import logger from "../../utils/logging/logger.js";
import { normalizeProblems } from "./problemNormalizer.js";
import SessionLimits from "../../utils/session/sessionLimits.js";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * @typedef {Object} NormalizedProblem
 * @property {number} id - CRITICAL: LeetCode ID (must be valid number).
 * @property {number} leetcode_id - CRITICAL: LeetCode ID for lookups (same as id).
 * @property {string|null} problem_id - UUID from database (null if never attempted).
 * @property {string} title - Problem title in title case.
 * @property {string} slug - URL slug for the problem.
 * @property {string} difficulty - 'Easy', 'Medium', or 'Hard'.
 * @property {Array<string>} tags - Topic tags (lowercase).
 * @property {number} [box_level] - Leitner box level (1-5) if previously attempted.
 * @property {Object} [review_schedule] - Review timing data if in review rotation.
 * @property {Object} [cooldown_status] - Cooldown information.
 * @property {number} [perceived_difficulty] - User-perceived difficulty (1-10).
 * @property {number} [consecutiveFailures] - Count of consecutive failed attempts.
 * @property {Object} [attempt_stats] - Historical attempt statistics.
 * @property {Object} [selectionReason] - Why this problem was selected for session.
 * @property {boolean} _normalized - Always true for normalized problems.
 * @property {string} _normalizedAt - ISO timestamp of normalization.
 * @property {string} _source - Source context (e.g., 'session_creation').
 * @property {number} [_sourceIndex] - Position in session if applicable.
 * @property {boolean} [_hasUUID] - Whether problem_id exists.
 */

/**
 * @typedef {Object} SessionWithMetadata
 * @property {Array<NormalizedProblem>} problems - The session problems.
 * @property {Object} metadata - Session creation metadata.
 * @property {boolean} metadata.generatedWithConfig - Whether custom config was used.
 * @property {Object} metadata.sourceConfig - The adaptive config used.
 * @property {string} metadata.createdAt - ISO timestamp of creation.
 */

/**
 * @typedef {Object} ProblemLookupResult
 * @property {Object|null} problem - The found problem or null.
 * @property {boolean} found - Whether problem exists in user's problems store.
 */

// ============================================================================
// IMPLEMENTATION
// ============================================================================
import {
  addTriggeredReviewsToSession,
  addReviewProblemsToSession,
  addNewProblemsToSession,
  addPassiveMasteredReviews,
  addFallbackProblems,
  checkSafetyGuardRails,
  logFinalSessionComposition,
  deduplicateById,
} from "./problemServiceSession.js";
import {
  createInterviewSession as createInterviewSessionHelper,
  applyProblemMix,
  filterProblemsByTags,
  ensureSufficientProblems,
  handleInterviewSessionFallback,
  shuffleArray,
  addInterviewMetadata,
} from "./problemServiceInterview.js";
import {
  addOrUpdateProblemWithRetry as addOrUpdateProblemWithRetryHelper,
  getProblemByDescriptionWithRetry as getProblemByDescriptionWithRetryHelper,
  getAllProblemsWithRetry as getAllProblemsWithRetryHelper,
  countProblemsByBoxLevelWithRetryService,
  createAbortController,
  generateSessionWithRetry as generateSessionWithRetryHelper,
} from "./problemServiceRetry.js";

export const ProblemService = {
  async getProblemByDescription(description, slug) {
    const queryContext = performanceMonitor.startQuery("getProblemByDescription", {
      operation: "problem_generation",
      description: description?.substring(0, 50),
      slug,
    });

    try {
      logger.info("ProblemService: Searching for problem:", description);

      const problem = await getProblemFromStandardProblems(slug);

      if (problem) {
        logger.info("Problem found in 'Standard_Problems' store:", problem);
        const problemInProblems = await checkDatabaseForProblem(problem.id);
        if (problemInProblems) {
          logger.info("Problem found in 'problems' store, merging with standard data:", problemInProblems);

          const mergedProblem = {
            ...problemInProblems,
            id: problemInProblems?.leetcode_id || problem.id,
            leetcode_id: problemInProblems?.leetcode_id || problem.id,
            problemId: problemInProblems?.problem_id,
            difficulty: problem.difficulty || problemInProblems?.difficulty || problemInProblems?.Rating || "Unknown",
            tags: problem.tags || problemInProblems?.tags || problemInProblems?.Tags || [],
            title: problem.title || problemInProblems?.title,
            boxLevel: problemInProblems?.box_level,
            reviewSchedule: problemInProblems?.review_schedule,
            cooldownStatus: problemInProblems?.cooldown_status,
            perceivedDifficulty: problemInProblems?.perceived_difficulty,
            consecutiveFailures: problemInProblems?.consecutive_failures,
            attemptStats: problemInProblems?.attempt_stats,
          };

          performanceMonitor.endQuery(queryContext, true, 1);
          return { problem: mergedProblem, found: true };
        }
      } else {
        logger.warn("Problem not found in any store.");
        performanceMonitor.endQuery(queryContext, true, 0);
        return { problem: null, found: false };
      }

      logger.warn("Problem not found in 'problems' store. returning problem from 'Standard_Problems' store");
      performanceMonitor.endQuery(queryContext, true, 1);
      return { problem: problem, found: false };
    } catch (error) {
      performanceMonitor.endQuery(queryContext, false, 0, error);
      throw error;
    }
  },

  countProblemsByBoxLevel() {
    return countProblemsByBoxLevel();
  },

  getAllProblems() {
    return fetchAllProblems();
  },

  async addOrUpdateProblem(contentScriptData) {
    logger.info("addOrUpdateProblem called", { contentScriptData });

    if (!contentScriptData.leetcode_id || isNaN(Number(contentScriptData.leetcode_id))) {
      logger.error("Invalid leetcode_id:", contentScriptData.leetcode_id);
      throw new Error(`Invalid leetcode_id: ${contentScriptData.leetcode_id}. Must be a valid number.`);
    }

    const leetcodeId = Number(contentScriptData.leetcode_id);
    const problem = await checkDatabaseForProblem(leetcodeId);

    logger.info("problemExists:", problem);
    if (problem) {
      return await AttemptsService.addAttempt(
        {
          id: uuidv4(),
          problem_id: problem.id,
          attempt_date: contentScriptData.date,
          success: contentScriptData.success,
          time_spent: contentScriptData.timeSpent,
          perceived_difficulty: contentScriptData.difficulty,
          comments: contentScriptData.comments,
        },
        problem
      );
    }
    return await addProblem(contentScriptData);
  },

  /**
   * Creates a new session with fresh problems based on adaptive settings.
   *
   * Used by: SessionService.createNewSession() for standard sessions.
   *
   * BEHAVIOR:
   * 1. Builds adaptive settings based on user preferences and learning state
   * 2. Fetches review problems (problems due for spaced repetition)
   * 3. Fetches new problems (based on focus areas and difficulty cap)
   * 4. Applies fallback if not enough problems found
   * 5. Deduplicates and normalizes all problems
   * 6. Adds selection reasoning for transparency
   *
   * SESSION COMPOSITION (default):
   * - ~40% review problems (from Leitner system)
   * - ~60% new problems (based on focus areas)
   *
   * CRITICAL:
   * - All returned problems have validated id/leetcode_id fields
   * - All problems are normalized with _normalized: true
   * - Returns empty array if no problems can be assembled
   *
   * @returns {Promise<Array<NormalizedProblem>>} Array of normalized problems for the session.
   *
   * @example
   * const problems = await ProblemService.createSession();
   * // problems[0].leetcode_id === 1 (number, not string)
   * // problems[0]._normalized === true
   * // problems[0].selectionReason === { type: 'review', ... }
   */
  async createSession() {
    const settings = await buildAdaptiveSessionSettings();
    const problems = await this.fetchAndAssembleSessionProblems(
      settings.sessionLength,
      settings.numberOfNewProblems,
      settings.currentAllowedTags,
      settings.currentDifficultyCap,
      settings.userFocusAreas,
      settings.isOnboarding
    );
    return problems;
  },

  async createSessionWithConfig(adaptiveConfig) {
    logger.info("Creating session with adaptive config:", adaptiveConfig);
    const sessionLength = adaptiveConfig.sessionLength || 8;
    const settings = await buildAdaptiveSessionSettings();

    const problems = await this.fetchAndAssembleSessionProblems(
      sessionLength,
      sessionLength,
      adaptiveConfig.focusAreas || settings.currentAllowedTags,
      settings.currentDifficultyCap,
      adaptiveConfig.focusAreas || settings.userFocusAreas,
      false
    );

    return {
      problems,
      metadata: {
        generatedWithConfig: true,
        sourceConfig: adaptiveConfig,
        createdAt: new Date().toISOString()
      }
    };
  },

  createInterviewSession(mode) {
    return createInterviewSessionHelper(
      mode,
      this.fetchAndAssembleInterviewProblems.bind(this),
      this.createSession.bind(this)
    );
  },

  /**
   * Assembles session problems using adaptive learning priorities:
   * PRIORITY 1: Triggered reviews (mastered problems related to struggling problems)
   * PRIORITY 2: Learning reviews (box 1-5, still learning)
   * PRIORITY 3: New problems (based on focus areas)
   * PRIORITY 4: Passive mastered reviews (box 6-8, only if session not full)
   * FALLBACK: Any available problems
   */
  async fetchAndAssembleSessionProblems(
    sessionLength,
    _numberOfNewProblems,
    currentAllowedTags,
    currentDifficultyCap,
    userFocusAreas = [],
    isOnboarding = false
  ) {
    logger.info("Starting intelligent session assembly with adaptive learning...");
    logger.info("Session length:", sessionLength);
    logger.info("Is onboarding session?", isOnboarding);

    const allProblems = await fetchAllProblems();
    const excludeIds = new Set(allProblems.filter(p => p && p.leetcode_id && p.title && p.title.trim()).map((p) => p.leetcode_id));

    const sessionProblems = [];

    // PRIORITY 1: Triggered reviews (mastered problems related to struggling problems)
    const triggeredReviewsCount = await addTriggeredReviewsToSession(
      sessionProblems, sessionLength, isOnboarding
    );

    // PRIORITY 2: Learning reviews (box 1-5)
    const learningReviewsCount = await addReviewProblemsToSession(
      sessionProblems, sessionLength, isOnboarding, allProblems
    );

    // PRIORITY 3: New problems (primary learning)
    await addNewProblemsToSession({
      sessionLength, sessionProblems, excludeIds, userFocusAreas,
      currentAllowedTags, currentDifficultyCap, isOnboarding
    });

    // PRIORITY 4: Passive mastered reviews (box 6-8, only if session not full)
    const passiveMasteredCount = await addPassiveMasteredReviews(
      sessionProblems, sessionLength, isOnboarding
    );

    // FALLBACK: Any available problems
    await addFallbackProblems(sessionProblems, sessionLength, allProblems);

    const deduplicated = deduplicateById(sessionProblems);
    const finalSession = deduplicated.slice(0, sessionLength);

    const { rebalancedSession } = await checkSafetyGuardRails(finalSession, currentDifficultyCap);
    const sessionToNormalize = rebalancedSession || finalSession;

    logger.info("Normalizing session problems to standard structure...");
    const normalizedProblems = normalizeProblems(
      sessionToNormalize.map((p, index) => ({ ...p, _sourceIndex: index, _hasUUID: !!p.problem_id })),
      'session_creation'
    );
    logger.info(`Normalized ${normalizedProblems.length} problems`);

    const totalReviewCount = triggeredReviewsCount + learningReviewsCount + passiveMasteredCount;
    const sessionWithReasons = await this.addProblemReasoningToSession(
      normalizedProblems,
      {
        sessionLength,
        reviewCount: totalReviewCount,
        triggeredReviewCount: triggeredReviewsCount,
        learningReviewCount: learningReviewsCount,
        passiveMasteredCount: passiveMasteredCount,
        newCount: normalizedProblems.length - totalReviewCount,
        allowedTags: currentAllowedTags,
        difficultyCap: currentDifficultyCap,
      }
    );

    logFinalSessionComposition(sessionWithReasons, sessionLength, totalReviewCount, triggeredReviewsCount);
    return sessionWithReasons;
  },

  async fetchAndAssembleInterviewProblems(sessionLength, selectionCriteria, mode) {
    try {
      logger.info(`Assembling interview session for ${mode} mode...`);

      if (mode === 'standard') {
        const settings = await buildAdaptiveSessionSettings();
        return this.fetchAndAssembleSessionProblems(
          settings.sessionLength, settings.numberOfNewProblems,
          settings.currentAllowedTags, settings.currentDifficultyCap,
          settings.userFocusAreas, settings.isOnboarding
        );
      }

      const allProblems = await fetchAllProblems();
      logger.info(`Total problems available: ${allProblems.length}`);

      if (allProblems.length === 0) {
        logger.error("No problems found in database");
        throw new Error("No problems available in database");
      }

      const availableProblems = filterProblemsByTags(allProblems, selectionCriteria);

      let selectedProblems = [];
      if (selectionCriteria && selectionCriteria.problemMix) {
        selectedProblems = applyProblemMix(availableProblems, selectionCriteria, sessionLength, shuffleArray);
      } else {
        logger.info("Using simple random selection");
        selectedProblems = shuffleArray(availableProblems).slice(0, sessionLength);
      }

      selectedProblems = ensureSufficientProblems(selectedProblems, availableProblems, sessionLength);
      logger.info(`Final selection: ${selectedProblems.length} problems`);

      if (selectedProblems.length === 0) {
        logger.error("No problems selected for interview session");
        throw new Error("Failed to select any problems for interview session");
      }

      const interviewProblems = addInterviewMetadata(selectedProblems, mode);
      logger.info(`Interview session assembled successfully: ${interviewProblems.length} normalized problems`);
      return interviewProblems;

    } catch (error) {
      return await handleInterviewSessionFallback(error, this.fetchAndAssembleSessionProblems.bind(this));
    }
  },

  shuffleArray,

  async addProblemReasoningToSession(problems, sessionContext) {
    try {
      logger.info(`Adding reasoning to ${problems.length} problems in session`);

      const tagMasteryData = await getTagMastery();
      const userPerformance = this.buildUserPerformanceContext(tagMasteryData);

      const problemsWithReasons = problems.map(problem => {
        const reason = ProblemReasoningService.generateSelectionReason(problem, sessionContext, userPerformance);
        return { ...problem, selectionReason: reason };
      });

      logger.info(`Added reasoning to ${problemsWithReasons.filter((p) => p.selectionReason).length} problems`);
      return problemsWithReasons;
    } catch (error) {
      logger.error("Error adding problem reasoning to session:", error);
      return problems;
    }
  },

  buildUserPerformanceContext(tagMasteryData) {
    if (!tagMasteryData || tagMasteryData.length === 0) {
      return { weakTags: [], newTags: [], tagAccuracy: {}, tagAttempts: {} };
    }

    const minAttempts = SessionLimits.getMinAttemptsForExperienced();

    const weakTags = tagMasteryData
      .filter((tm) => tm.successRate < 0.7 && tm.totalAttempts >= minAttempts)
      .map((tm) => tm.tag.toLowerCase());

    const newTags = tagMasteryData
      .filter((tm) => tm.totalAttempts < minAttempts)
      .map((tm) => tm.tag.toLowerCase());

    const tagAccuracy = {};
    const tagAttempts = {};

    tagMasteryData.forEach((tm) => {
      const tagKey = tm.tag.toLowerCase();
      let successRate = tm.successRate || 0;
      if (!Number.isFinite(successRate) || successRate < 0) {
        successRate = 0;
      } else if (successRate > 1) {
        successRate = 1;
      }
      tagAccuracy[tagKey] = successRate;
      tagAttempts[tagKey] = Math.max(0, tm.totalAttempts || 0);
    });

    return { weakTags, newTags, tagAccuracy, tagAttempts };
  },

  async updateProblemsWithRatings() {
    return await updateProblemsWithRatingsInDB();
  },

  addOrUpdateProblemInSession(session, problem, _attemptId) {
    const existingProblem = findProblemInSession(session, problem);
    if (existingProblem) {
      const updatedproblems = session.problems.map((curr) =>
        curr.id === existingProblem.id ? { ...curr, problem_id: problem.problem_id, attempted: true, attempt_date: new Date().toISOString() } : curr
      );
      session.problems = updatedproblems;
      logger.info("Updated session problem with problem_id and attempted flag");
    }
    return session;
  },
};

const findProblemInSession = (session, problemData) => {
  return session.problems.find((p) => p.leetcode_id === problemData.leetcode_id);
};

ProblemService.addOrUpdateProblemWithRetry = function(contentScriptData, sendResponse, options = {}) {
  return addOrUpdateProblemWithRetryHelper(this.addOrUpdateProblem.bind(this), contentScriptData, sendResponse, options);
};

ProblemService.getProblemByDescriptionWithRetry = getProblemByDescriptionWithRetryHelper;

ProblemService.getAllProblemsWithRetry = getAllProblemsWithRetryHelper;

ProblemService.countProblemsByBoxLevelWithRetry = countProblemsByBoxLevelWithRetryService;

ProblemService.createAbortController = createAbortController;

ProblemService.generateSessionWithRetry = function(params = {}, abortController = null) {
  return generateSessionWithRetryHelper(this.getAllProblemsWithRetry.bind(this), params, abortController);
};
