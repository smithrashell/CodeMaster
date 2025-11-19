import {
  countProblemsByBoxLevel,
  addProblem,
  checkDatabaseForProblem,
  // Import retry-enabled functions
  getProblemWithRetry,
  checkDatabaseForProblemWithRetry,
  countProblemsByBoxLevelWithRetry,
  fetchAllProblemsWithRetry,
} from "../db/problems.js";
import { getProblemFromStandardProblems, fetchProblemById } from "../db/standard_problems.js";
import { AttemptsService } from "./attemptsService.js";
import { v4 as uuidv4 } from "uuid";
import {
  fetchAllProblems,
  fetchAdditionalProblems,
  updateProblemsWithRatings as updateProblemsWithRatingsInDB,
} from "../db/problems.js";
import { ScheduleService } from "./scheduleService.js";
import { StorageService } from "./storageService.js";
import SessionLimits from "../utils/sessionLimits.js";
import { buildAdaptiveSessionSettings } from "../db/sessions.js";
import { calculateDecayScore } from "../utils/Utils.js";
import { ProblemReasoningService } from "../../content/services/problemReasoningService.js";
import { getTagMastery } from "../db/tag_mastery.js";
import performanceMonitor from "../utils/PerformanceMonitor.js";
import { InterviewService } from "./interviewService.js";
import logger from "../utils/logger.js";
import { selectOptimalProblems } from "../db/problem_relationships.js";
import { applySafetyGuardRails } from "../utils/sessionBalancing.js";
import { normalizeProblems } from "./problemNormalizer.js";
import {
  enrichReviewProblem,
  normalizeReviewProblem,
  filterValidReviewProblems,
  logReviewProblemsAnalysis
} from "./problemServiceHelpers.js";

// Remove early binding - use TagService.getCurrentLearningState() directly

// Helper functions for fetchAndAssembleSessionProblems
async function addReviewProblemsToSession(sessionProblems, sessionLength, isOnboarding, allProblems) {
  if (isOnboarding) {
    logger.info("🔰 Skipping review problems during onboarding - focusing on new problem distribution");
    return 0;
  }

  // 🔧 LEITNER SYSTEM: Natural review problem selection
  // Get ALL problems due for review based on spaced repetition schedule
  // No artificial caps - if problems are due, they should be reviewed
  // Review problems can take up the entire session if many are due (proper spaced repetition)

  // Get ALL problems due for review from Leitner system
  const allReviewProblems = await ScheduleService.getDailyReviewSchedule(null);
  logger.info(`🔍 DEBUG: Found ${allReviewProblems?.length || 0} total problems due for review from Leitner system`);

  // Enrich review problems with core metadata from standard_problems
  logger.info(`🔄 Enriching ${allReviewProblems?.length || 0} review problems with data from standard_problems...`);
  const enrichedReviewProblems = await Promise.all(
    (allReviewProblems || []).map(reviewProblem => enrichReviewProblem(reviewProblem, fetchProblemById))
  );

  // Filter and normalize review problems
  const validReviewProblems = filterValidReviewProblems(enrichedReviewProblems).map(normalizeReviewProblem);

  // Priority logic: Take up to sessionLength worth of review problems if available
  const reviewProblemsToAdd = validReviewProblems.slice(0, Math.min(sessionLength, validReviewProblems.length));

  // Log analysis before and after adding problems
  logReviewProblemsAnalysis(enrichedReviewProblems, validReviewProblems, sessionProblems, reviewProblemsToAdd);

  sessionProblems.push(...reviewProblemsToAdd);

  logger.info(`🔍 DEBUG: After push - sessionProblems.length: ${sessionProblems.length}`);
  logger.info(`🔍 DEBUG: sessionProblems content:`,
    sessionProblems.slice(0, 3).map(p => ({
      id: p?.id,
      leetcode_id: p?.leetcode_id,
      title: p?.title
    }))
  );

  logger.info(`🔄 Added ${reviewProblemsToAdd.length} review problems to session (${validReviewProblems.length} total due from Leitner system)`);

  if (reviewProblemsToAdd.length === sessionLength) {
    logger.info(`ℹ️ Session filled entirely with review problems (${reviewProblemsToAdd.length}/${sessionLength}) - spaced repetition takes priority`);
  } else if (reviewProblemsToAdd.length > 0) {
    logger.info(`ℹ️ Session has ${reviewProblemsToAdd.length} review problems, ${sessionLength - reviewProblemsToAdd.length} slots available for new problems`);
  }

  analyzeReviewProblems(validReviewProblems, sessionLength, allProblems);
  return reviewProblemsToAdd.length;
}

function analyzeReviewProblems(reviewProblems, sessionLength, allProblems) {
  if (reviewProblems.length === 0) {
    const hasAttemptedProblems = allProblems.length > 0;
    if (!hasAttemptedProblems) {
      logger.info(`ℹ️ New user detected - no review problems available. Session will contain only new problems.`);
    } else {
      logger.info(`ℹ️ No review problems due today. Session will contain only new problems.`);
    }
  } else if (reviewProblems.length < sessionLength) {
    logger.info(`ℹ️ Found ${reviewProblems.length} review problems due. Remaining ${sessionLength - reviewProblems.length} slots will be filled with new problems.`);
  } else {
    logger.info(`ℹ️ Found ${reviewProblems.length} review problems due (more than session length of ${sessionLength}). Prioritizing spaced repetition.`);
  }
}

async function addNewProblemsToSession(params) {
  const { sessionLength, sessionProblems, excludeIds, userFocusAreas,
    currentAllowedTags, currentDifficultyCap, isOnboarding } = params;

  logger.info(`🔍 DEBUG: Before calculating newProblemsNeeded:`, {
    sessionLength,
    sessionProblemsLength: sessionProblems.length,
    sessionProblemsContent: sessionProblems.map(p => ({ id: p?.id, leetcode_id: p?.leetcode_id, title: p?.title }))
  });

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

  // 🔧 FIX: Normalize new problems with same field mapping as review problems
  const normalizedNewProblems = newProblems.map(p => {
    const normalized = {
      ...p,
      id: p.id || p.leetcode_id  // Ensure id field exists
    };

    // Normalize field names for frontend compatibility
    if (p.leetcode_address && !normalized.LeetCodeAddress) {
      normalized.LeetCodeAddress = p.leetcode_address;
    }

    // Ensure slug exists for URL generation fallback
    if (!normalized.slug) {
      normalized.slug = p.slug || p.title_slug || p.titleSlug || p.TitleSlug;
    }

    // If still no slug, generate one from title as last resort
    if (!normalized.slug && (p.title || p.Title || p.ProblemDescription)) {
      const title = p.title || p.Title || p.ProblemDescription;
      normalized.slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      logger.warn(`⚠️ Generated slug from title for new problem: ${title} → ${normalized.slug}`);
    }

    // 🔍 DEBUG: Log what fields we have for URL generation
    logger.info(`🔗 New problem URL fields for "${p.title || p.Title}":`, {
      has_leetcode_address: !!p.leetcode_address,
      has_LeetCodeAddress: !!normalized.LeetCodeAddress,
      has_slug: !!normalized.slug,
      LeetCodeAddress: normalized.LeetCodeAddress,
      slug: normalized.slug
    });

    // New problems should have empty attempts array
    // Check attempt_stats first (in case problem was attempted before but marked as "new")
    if (p.attempt_stats) {
      normalized.attempts = p.attempt_stats.total_attempts > 0 ?
        [{ count: p.attempt_stats.total_attempts }] : [];
    } else if (!normalized.attempts) {
      normalized.attempts = [];
    }

    return normalized;
  });

  sessionProblems.push(...normalizedNewProblems);
  logger.info(`🆕 Added ${normalizedNewProblems.length}/${newProblemsNeeded} new problems${!isOnboarding ? ' with optimal path scoring' : ''}`);
}

async function selectNewProblems(candidateProblems, newProblemsNeeded, isOnboarding) {
  if (!isOnboarding && candidateProblems.length >= newProblemsNeeded) {
    logger.info(`🧮 Applying optimal path scoring to ${candidateProblems.length} candidates`);
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
      logger.info(`✅ Selected ${selected.length} optimal problems with scores: ${selected.map(p => `${p.id || p.leetcode_id}:${p.pathScore?.toFixed(2) || 'N/A'}`).join(', ')}`);
      return selected;
    } catch (error) {
      logger.error("❌ Error applying optimal path scoring, falling back to standard selection:", error);
      return candidateProblems.slice(0, newProblemsNeeded);
    }
  } else {
    logger.info(`📚 Using ${Math.min(candidateProblems.length, newProblemsNeeded)} problems (onboarding: ${isOnboarding}, candidates: ${candidateProblems.length})`);
    return candidateProblems.slice(0, newProblemsNeeded);
  }
}

function addFallbackProblems(sessionProblems, sessionLength, allProblems) {
  if (sessionProblems.length >= sessionLength) return;

  const fallbackNeeded = sessionLength - sessionProblems.length;
  const usedIds = new Set(sessionProblems.filter(p => p && (p.problem_id || p.leetcode_id) && p.title && p.title.trim()).map((p) => p.problem_id || p.leetcode_id));

  const fallbackProblems = allProblems
    .filter(p => p && (p.problem_id || p.leetcode_id) && p.title && p.title.trim())
    .filter((p) => !usedIds.has(p.problem_id || p.leetcode_id))
    .sort(problemSortingCriteria)
    .slice(0, fallbackNeeded);

  sessionProblems.push(...fallbackProblems);
  logger.info(`🔄 Added ${fallbackProblems.length} fallback problems`);
}

async function checkSafetyGuardRails(finalSession, currentDifficultyCap) {
  const sessionState = await StorageService.getSessionState();
  const sessionsAtCurrentDifficulty = sessionState?.escape_hatches?.sessions_at_current_difficulty || 0;

  const guardRailResult = applySafetyGuardRails(
    finalSession,
    currentDifficultyCap,
    sessionsAtCurrentDifficulty
  );

  if (guardRailResult.needsRebalance) {
    logger.warn(`⚖️ Session difficulty imbalance detected: ${guardRailResult.message}`);
    logger.warn(`   Current composition will be used, but may not be ideal for progression`);
  }
}

function logFinalSessionComposition(sessionWithReasons, sessionLength, reviewProblemsCount) {
  logger.info(`🎯 Final session composition:`);
  logger.info(`   📊 Total problems: ${sessionWithReasons.length}/${sessionLength}`);
  logger.info(`   🔄 Review problems: ${reviewProblemsCount}`);
  logger.info(`   🆕 New problems: ${sessionWithReasons.length - reviewProblemsCount}`);
  logger.info(`   🧠 Problems with reasoning: ${sessionWithReasons.filter((p) => p.selectionReason).length}`);
}

/**
 * ProblemService - Handles all logic for problem management.

 */
export const ProblemService = {
  /**
   * Fetches a problem by description from `problems` store.
   * If not found, fetches from `standard_problems` store.
   * @param {string} description - The problem description.
   * @param {string} slug - The problem slug.
   * @returns {Promise<{ problem: Object|null, found: boolean }>}
   */

  async getProblemByDescription(description, slug) {
    const queryContext = performanceMonitor.startQuery(
      "getProblemByDescription",
      {
        operation: "problem_generation",
        description: description?.substring(0, 50),
        slug,
      }
    );

    try {
      logger.info("📌 ProblemService: Searching for problem:", description);

      // 1️⃣ Try fetching from `Standard_Problems` store
      const problem = await getProblemFromStandardProblems(slug);

      if (problem) {
        logger.info("✅ Problem found in 'Standard_Problems' store:", problem);
        //  2️⃣  Check if problem exists in `problems` store
        const problemInProblems = await checkDatabaseForProblem(problem.id);
        if (problemInProblems) {
          logger.info(
            "✅ Problem found in 'problems' store, merging with standard data:",
            problemInProblems
          );

          // Merge user problem data with standard problem metadata (including tags)
          const mergedProblem = {
            ...problemInProblems,
            // Map snake_case fields to camelCase for UI compatibility
            id: problemInProblems?.leetcode_id || problem.id,
            leetcode_id: problemInProblems?.leetcode_id || problem.id,
            problemId: problemInProblems?.problem_id,
            // Official metadata from standard_problems (including tags!)
            difficulty: problem.difficulty || problemInProblems?.difficulty || problemInProblems?.Rating || "Unknown",
            tags: problem.tags || problemInProblems?.tags || problemInProblems?.Tags || [],
            title: problem.title || problemInProblems?.title,
            // Map other snake_case fields to camelCase
            boxLevel: problemInProblems?.box_level,
            reviewSchedule: problemInProblems?.review_schedule,
            cooldownStatus: problemInProblems?.cooldown_status,
            perceivedDifficulty: problemInProblems?.perceived_difficulty,
            consecutiveFailures: problemInProblems?.consecutive_failures,
            attemptStats: problemInProblems?.attempt_stats,
          };

          performanceMonitor.endQuery(queryContext, true, 1);
          return { problem: mergedProblem, found: true }; // ✅ Found in problems store with tags
        }
      } else {
        logger.warn("❌ Problem not found in any store.");
        performanceMonitor.endQuery(queryContext, true, 0);
        return { problem: null, found: false }; // ❌ No problem found
      }

      logger.warn(
        "⚠️ Problem not found in 'problems' store. returning problem from 'Standard_Problems' store"
      );

      logger.info(
        "✅ Returning problem found in  'standard_problems':",
        problem
      );
      performanceMonitor.endQuery(queryContext, true, 1);
      return { problem: problem, found: false }; // ✅ Found in standard_problems
    } catch (error) {
      performanceMonitor.endQuery(queryContext, false, 0, error);
      throw error;
    }
  },

  /**
   * Counts problems grouped by box level.
   * @returns {Promise<Object>} - Box level counts.
   */
  countProblemsByBoxLevel() {
    return countProblemsByBoxLevel();
  },

  /**
   * Adds or updates a problem in the database.
   * If the problem exists, adds an attempt. Otherwise, adds a new problem.
   * @param {Object} contentScriptData - Data of the problem to add.
   * @returns {Promise<Object>} - The added/updated problem.
   */
  async addOrUpdateProblem(contentScriptData) {
    logger.info("📌 addOrUpdateProblem called", { contentScriptData });

    // Validate leetcode_id before using it as a database key
    if (!contentScriptData.leetcode_id || isNaN(Number(contentScriptData.leetcode_id))) {
      logger.error("❌ Invalid leetcode_id:", contentScriptData.leetcode_id);
      throw new Error(`Invalid leetcode_id: ${contentScriptData.leetcode_id}. Must be a valid number.`);
    }

    const leetcodeId = Number(contentScriptData.leetcode_id);
    const problem = await checkDatabaseForProblem(leetcodeId);

    logger.info("✅ problemExists:", problem);
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

  async createSession() {
    const settings = await buildAdaptiveSessionSettings(); // includes session length and tag/difficulty caps

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

  // NEW: Create session with custom configuration (used by tracking activity generator)
  async createSessionWithConfig(adaptiveConfig) {
    logger.info("🎯 Creating session with adaptive config:", adaptiveConfig);

    const sessionLength = adaptiveConfig.sessionLength || 8;
    const settings = await buildAdaptiveSessionSettings();

    // Use adaptive config to override defaults
    const problems = await this.fetchAndAssembleSessionProblems(
      sessionLength,
      sessionLength, // All new problems for generated sessions
      adaptiveConfig.focusAreas || settings.currentAllowedTags,
      settings.currentDifficultyCap,
      adaptiveConfig.focusAreas || settings.userFocusAreas,
      false // Not onboarding
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

  // NEW: Interview session creation (additive, doesn't modify existing flow)
  async createInterviewSession(mode) {
    const operationStart = Date.now();
    try {
      logger.info(`🎯 PROBLEM SERVICE: Creating interview session in ${mode} mode`);
      
      // Get interview session configuration from InterviewService
      logger.info("🎯 Calling InterviewService.createInterviewSession");
      const configStart = Date.now();
      
      const interviewConfig = await InterviewService.createInterviewSession(mode);
      const configDuration = Date.now() - configStart;
      
      logger.info("🎯 InterviewService returned config:", {
        hasConfig: !!interviewConfig,
        sessionLength: interviewConfig?.sessionLength,
        hasCriteria: !!interviewConfig?.selectionCriteria,
        configTime: configDuration + 'ms'
      });
      
      // Use interview-specific problem selection
      logger.info("🎯 Calling fetchAndAssembleInterviewProblems");
      const problemsStart = Date.now();
      
      // Add timeout protection to problem fetching
      const PROBLEM_FETCH_TIMEOUT = 12000; // 12 seconds for problem fetching
      const problemTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`fetchAndAssembleInterviewProblems timed out after ${PROBLEM_FETCH_TIMEOUT}ms`)), PROBLEM_FETCH_TIMEOUT);
      });
      
      const problems = await Promise.race([
        this.fetchAndAssembleInterviewProblems(
          interviewConfig.sessionLength,
          interviewConfig.selectionCriteria,
          mode
        ),
        problemTimeout
      ]);
      const problemsDuration = Date.now() - problemsStart;
      
      logger.info("🎯 fetchAndAssembleInterviewProblems returned:", {
        problemCount: problems?.length,
        firstProblem: problems?.[0]?.title,
        problemsTime: problemsDuration + 'ms'
      });

      // Add interview metadata to session
      const result = {
        problems,
        session_type: mode,
        interviewConfig: interviewConfig.config,
        interviewMetrics: interviewConfig.interviewMetrics,
        createdAt: interviewConfig.createdAt
      };
      
      const totalDuration = Date.now() - operationStart;
      logger.info("🎯 PROBLEM SERVICE: Returning interview session data:", {
        problemCount: result.problems?.length,
        session_type: result.session_type,
        hasConfig: !!result.interviewConfig,
        totalTime: totalDuration + 'ms'
      });
      
      return result;
    } catch (error) {
      const totalDuration = Date.now() - operationStart;
      logger.error("🎯 ERROR creating interview session:", error);
      logger.error(`   ⏱️ Failed after ${totalDuration}ms`);
      
      // Provide more detailed error information
      if (error.message.includes('timed out')) {
        logger.error("🕐 Interview session creation timed out - likely database or service hang");
        throw new Error(`Interview session creation timed out after ${totalDuration}ms: ${error.message}`);
      }
      
      // Fallback to standard session if interview creation fails
      logger.info("🎯 Falling back to standard session creation");
      try {
        const fallbackProblems = await this.createSession();
        return {
          problems: fallbackProblems,
          session_type: 'standard', // Fallback becomes standard
          error: `Interview session failed: ${error.message}`,
          fallbackUsed: true
        };
      } catch (fallbackError) {
        logger.error("❌ Even fallback session creation failed:", fallbackError);
        throw new Error(`Both interview and fallback session creation failed: ${error.message}`);
      }
    }
  },

  /**
   * Assembles session problems with intelligent distribution
   * @param {number} sessionLength - Total number of problems in session
   * @param {number} numberOfNewProblems - Number of new problems to include
   * @param {string[]} currentAllowedTags - Tags to focus on
   * @param {string} currentDifficultyCap - Maximum difficulty level
   * @param {string[]} userFocusAreas - User-selected focus areas for weighting
   * @param {boolean} isOnboarding - Whether this is an onboarding session
   * @returns {Promise<Array>} - Array of problems for the session
   */
  async fetchAndAssembleSessionProblems(
    sessionLength,
    numberOfNewProblems,
    currentAllowedTags,
    currentDifficultyCap,
    userFocusAreas = [],
    isOnboarding = false
  ) {
    logger.info("🎯 Starting intelligent session assembly...");
    logger.info("🎯 Session length:", sessionLength);
    logger.info("🎯 New problems target:", numberOfNewProblems);
    logger.info("🔰 Is onboarding session?", isOnboarding);

    const allProblems = await fetchAllProblems();
    const excludeIds = new Set(allProblems.filter(p => p && p.leetcode_id && p.title && p.title.trim()).map((p) => p.leetcode_id));

    const sessionProblems = [];

    // **Step 1: Add review problems**
    const reviewProblemsCount = await addReviewProblemsToSession(
      sessionProblems, sessionLength, isOnboarding, allProblems
    );

    // **Step 2: Add new problems**
    await addNewProblemsToSession({
      sessionLength, sessionProblems, excludeIds, userFocusAreas,
      currentAllowedTags, currentDifficultyCap, isOnboarding
    });

    // **Step 3: Add fallback problems if needed**
    addFallbackProblems(sessionProblems, sessionLength, allProblems);

    // **Step 4: Deduplicate and apply safety guard rails**
    logger.info(`🔍 DEBUG: Before deduplication - sessionProblems.length: ${sessionProblems.length}`);
    logger.info(`🔍 DEBUG: First 3 problems before dedup:`,
      sessionProblems.slice(0, 3).map(p => ({
        id: p?.id,
        leetcode_id: p?.leetcode_id,
        title: p?.title
      }))
    );

    const deduplicated = deduplicateById(sessionProblems);

    logger.info(`🔍 DEBUG: After deduplication - deduplicated.length: ${deduplicated.length}`);
    logger.info(`🔍 DEBUG: First 3 problems after dedup:`,
      deduplicated.slice(0, 3).map(p => ({
        id: p?.id,
        leetcode_id: p?.leetcode_id,
        title: p?.title
      }))
    );

    const finalSession = deduplicated.slice(0, sessionLength);

    logger.info(`🔍 DEBUG: After slice to sessionLength(${sessionLength}) - finalSession.length: ${finalSession.length}`);

    await checkSafetyGuardRails(finalSession, currentDifficultyCap);

    // **Step 5: Normalize all problems to standard structure**
    logger.info("🔄 Normalizing session problems to standard structure...");
    const normalizedProblems = normalizeProblems(
      finalSession.map((p, index) => ({
        ...p,
        _sourceIndex: index,
        _hasUUID: !!p.problem_id
      })),
      'session_creation'
    );
    logger.info(`✅ Normalized ${normalizedProblems.length} problems`);

    // **Step 6: Add reasoning to normalized problems**
    const sessionWithReasons = await this.addProblemReasoningToSession(
      normalizedProblems,
      {
        sessionLength,
        reviewCount: reviewProblemsCount,
        newCount: normalizedProblems.length - reviewProblemsCount,
        allowedTags: currentAllowedTags,
        difficultyCap: currentDifficultyCap,
      }
    );

    logFinalSessionComposition(sessionWithReasons, sessionLength, reviewProblemsCount);

    // Log what we're actually returning to help debug frontend display issues
    logger.info(`🔍 DEBUG: Returning session with ${sessionWithReasons.length} problems to frontend:`,
      sessionWithReasons.map(p => ({
        id: p.id,
        leetcode_id: p.leetcode_id,
        title: p.title,
        hasId: !!p.id,
        hasLeetcodeId: !!p.leetcode_id
      }))
    );

    // 🔍 NORMALIZATION DEBUG: Final check before returning
    if (sessionWithReasons.length > 0) {
      logger.info(`🔍 NORMALIZATION CHECK - First problem being returned from fetchAndAssembleSessionProblems:`, {
        id: sessionWithReasons[0].id,
        leetcode_id: sessionWithReasons[0].leetcode_id,
        problem_id: sessionWithReasons[0].problem_id,
        hasAttempts: !!sessionWithReasons[0].attempts,
        attemptsLength: sessionWithReasons[0].attempts?.length,
        attemptsContent: sessionWithReasons[0].attempts,
        hasAttemptStats: !!sessionWithReasons[0].attempt_stats,
        allKeys: Object.keys(sessionWithReasons[0])
      });
    }

    return sessionWithReasons;
  },

  // NEW: Interview-specific problem fetching (additive, doesn't modify existing)
  async fetchAndAssembleInterviewProblems(sessionLength, selectionCriteria, mode) {
    try {
      logger.info(`🎯 Assembling interview session for ${mode} mode...`);
      logger.info("🎯 Session length:", sessionLength);
      logger.info("🎯 Selection criteria:", selectionCriteria);
      
      if (mode === 'standard') {
        // For standard mode, fall back to regular session assembly
        const settings = await buildAdaptiveSessionSettings();
        return this.fetchAndAssembleSessionProblems(
          settings.sessionLength,
          settings.numberOfNewProblems,
          settings.currentAllowedTags,
          settings.currentDifficultyCap,
          settings.userFocusAreas,
          settings.isOnboarding
        );
      }

      // Get all problems
      const allProblems = await fetchAllProblems();
      logger.info(`🎯 Total problems available: ${allProblems.length}`);
      
      if (allProblems.length === 0) {
        logger.error("❌ No problems found in database");
        throw new Error("No problems available in database");
      }

      // Apply tag filtering
      const availableProblems = this.filterProblemsByTags(allProblems, selectionCriteria);

      // Select problems for session
      let selectedProblems = [];
      
      // Try to apply interview-specific problem mix if available
      if (selectionCriteria && selectionCriteria.problemMix) {
        selectedProblems = this.applyProblemMix(availableProblems, selectionCriteria, sessionLength);
      } else {
        // Simple fallback: random selection from available problems
        logger.info("🎯 Using simple random selection");
        selectedProblems = this.shuffleArray(availableProblems).slice(0, sessionLength);
      }

      // Ensure we have enough problems - fill with random selection if needed
      selectedProblems = this.ensureSufficientProblems(selectedProblems, availableProblems, sessionLength);

      logger.info(`🎯 Final selection: ${selectedProblems.length} problems`);

      // Ensure we actually have problems
      if (selectedProblems.length === 0) {
        logger.error("❌ No problems selected for interview session");
        throw new Error("Failed to select any problems for interview session");
      }

      // Normalize problems first
      logger.info("🔄 Normalizing interview problems...");
      const normalizedProblems = normalizeProblems(selectedProblems, 'interview');

      // Add interview metadata to normalized problems
      const interviewProblems = normalizedProblems.map(problem => ({
        ...problem,
        interviewMode: mode,
        interviewConstraints: InterviewService.getInterviewConfig(mode),
        selectionReason: {
          shortText: `Selected for ${mode} interview practice`,
          context: `Interview mode: ${mode}`,
        }
      }));

      logger.info(`✅ Interview session assembled successfully: ${interviewProblems.length} normalized problems`);
      return interviewProblems;
      
    } catch (error) {
      return await this.handleInterviewSessionFallback(error);
    }
  },

  // Helper method for applying interview problem mix
  applyProblemMix(availableProblems, selectionCriteria, sessionLength) {
    logger.info("🎯 Applying interview problem mix");
    const { problemMix } = selectionCriteria;
    
    const masteredCount = Math.floor(sessionLength * (problemMix.mastered || 0));
    const nearMasteryCount = Math.floor(sessionLength * (problemMix.nearMastery || 0));
    const challengingCount = sessionLength - masteredCount - nearMasteryCount;

    logger.info(`🎯 Problem distribution - Mastered: ${masteredCount}, Near-mastery: ${nearMasteryCount}, Challenging: ${challengingCount}`);

    let selectedProblems = [];

    // Select mastered tag problems if criteria exists
    if (selectionCriteria.masteredTags && selectionCriteria.masteredTags.length > 0) {
      const masteredProblems = availableProblems.filter(problem => {
        const problemTags = problem.Tags || [];
        return problemTags.some(tag => 
          selectionCriteria.masteredTags.includes(tag.toLowerCase())
        );
      });
      selectedProblems.push(...this.shuffleArray(masteredProblems).slice(0, masteredCount));
      logger.info(`🎯 Added ${Math.min(masteredProblems.length, masteredCount)} mastered problems`);
    }

    // Select near-mastery problems if criteria exists
    if (selectionCriteria.nearMasteryTags && selectionCriteria.nearMasteryTags.length > 0) {
      const nearMasteryProblems = availableProblems.filter(problem => {
        const problemTags = problem.Tags || [];
        return problemTags.some(tag => 
          selectionCriteria.nearMasteryTags.includes(tag.toLowerCase())
        ) && !selectedProblems.includes(problem);
      });
      selectedProblems.push(...this.shuffleArray(nearMasteryProblems).slice(0, nearMasteryCount));
      logger.info(`🎯 Added ${Math.min(nearMasteryProblems.length, nearMasteryCount)} near-mastery problems`);
    }

    // Fill remaining slots with random problems
    const remainingProblems = availableProblems.filter(problem => 
      !selectedProblems.includes(problem)
    );
    selectedProblems.push(...this.shuffleArray(remainingProblems).slice(0, challengingCount));
    logger.info(`🎯 Added ${Math.min(remainingProblems.length, challengingCount)} challenging problems`);

    return selectedProblems;
  },

  // Helper method for filtering problems by tags
  filterProblemsByTags(allProblems, selectionCriteria) {
    // Apply tag filtering if criteria exists and has allowedTags
    if (selectionCriteria && selectionCriteria.allowedTags && selectionCriteria.allowedTags.length > 0) {
      logger.info("🎯 Filtering by tags:", selectionCriteria.allowedTags);
      const filteredByTags = allProblems.filter(problem => {
        const problemTags = problem.Tags || [];
        return problemTags.some(tag => 
          selectionCriteria.allowedTags.includes(tag.toLowerCase())
        );
      });
      
      logger.info(`🎯 Problems matching tag criteria: ${filteredByTags.length}`);
      
      if (filteredByTags.length > 0) {
        return filteredByTags;
      } else {
        logger.warn("No problems found matching interview tag criteria, using all problems");
        return allProblems;
      }
    } else {
      logger.info("🎯 No tag filtering criteria provided, using all problems");
      return allProblems;
    }
  },

  // Helper method for ensuring sufficient problems in selection
  ensureSufficientProblems(selectedProblems, availableProblems, sessionLength) {
    // Ensure we have enough problems - fill with random selection if needed
    const result = [...selectedProblems];
    while (result.length < sessionLength && availableProblems.length > result.length) {
      const remaining = availableProblems.filter(p => !result.includes(p));
      if (remaining.length > 0) {
        result.push(remaining[Math.floor(Math.random() * remaining.length)]);
      } else {
        break;
      }
    }
    return result;
  },

  // Helper method for handling interview session fallback
  async handleInterviewSessionFallback(error) {
    logger.error("❌ Error assembling interview problems:", error);
    // Enhanced fallback to standard session
    logger.info("🎯 Attempting fallback to standard session");
    try {
      const settings = await buildAdaptiveSessionSettings();
      const fallbackProblems = await this.fetchAndAssembleSessionProblems(
        settings.sessionLength,
        settings.numberOfNewProblems,
        settings.currentAllowedTags,
        settings.currentDifficultyCap,
        settings.userFocusAreas,
        settings.isOnboarding
      );
      logger.info(`🎯 Fallback session created with ${fallbackProblems.length} problems`);
      return fallbackProblems;
    } catch (fallbackError) {
      logger.error("❌ Fallback session creation also failed:", fallbackError);
      throw new Error(`Both interview and fallback session creation failed: ${error.message}`);
    }
  },

  // Utility method for shuffling arrays (used in interview selection)
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  },

  /**
   * Add problem selection reasoning to each problem in the session
   * @param {Array} problems - Array of problems in the session
   * @param {Object} sessionContext - Session context and metadata
   * @returns {Promise<Array>} - Problems with selectionReason added
   */
  async addProblemReasoningToSession(problems, sessionContext) {
    try {
      logger.info(
        `🧠 Adding reasoning to ${problems.length} problems in session`
      );

      // Get user performance data for reasoning generation
      const tagMasteryData = await getTagMastery();
      const userPerformance = this.buildUserPerformanceContext(tagMasteryData);

      // Generate reasoning for all problems (strategy pattern handles new vs review)
      const problemsWithReasons = problems.map(problem => {
        const reason = ProblemReasoningService.generateSelectionReason(
          problem,
          sessionContext,
          userPerformance
        );
        return {
          ...problem,
          selectionReason: reason
        };
      });

      logger.info(
        `✅ Added reasoning to ${
          problemsWithReasons.filter((p) => p.selectionReason).length
        } problems`
      );
      return problemsWithReasons;
    } catch (error) {
      logger.error("❌ Error adding problem reasoning to session:", error);
      // Return original problems if reasoning fails
      return problems;
    }
  },

  /**
   * Build user performance context from tag mastery data
   * @param {Array} tagMasteryData - Tag mastery records
   * @returns {Object} - Formatted user performance data
   */
  buildUserPerformanceContext(tagMasteryData) {
    if (!tagMasteryData || tagMasteryData.length === 0) {
      return {
        weakTags: [],
        newTags: [],
        tagAccuracy: {},
        tagAttempts: {},
      };
    }

    // Get centralized threshold for experienced vs new tags
    const minAttempts = SessionLimits.getMinAttemptsForExperienced();

    // Identify weak tags (below 70% accuracy with sufficient attempts)
    const weakTags = tagMasteryData
      .filter((tm) => tm.successRate < 0.7 && tm.totalAttempts >= minAttempts)
      .map((tm) => tm.tag.toLowerCase());

    // Identify new tags (using centralized threshold)
    const newTags = tagMasteryData
      .filter((tm) => tm.totalAttempts < minAttempts)
      .map((tm) => tm.tag.toLowerCase());

    // Build accuracy mapping
    const tagAccuracy = {};
    const tagAttempts = {};

    tagMasteryData.forEach((tm) => {
      const tagKey = tm.tag.toLowerCase();
      
      // Normalize success rate to valid range [0, 1] and handle invalid values
      let successRate = tm.successRate || 0;
      if (!Number.isFinite(successRate) || successRate < 0) {
        successRate = 0;
      } else if (successRate > 1) {
        successRate = 1;
      }
      
      tagAccuracy[tagKey] = successRate;
      tagAttempts[tagKey] = Math.max(0, tm.totalAttempts || 0); // Also normalize attempts to non-negative
    });

    return {
      weakTags,
      newTags,
      tagAccuracy,
      tagAttempts,
    };
  },

  async updateProblemsWithRatings() {
    return await updateProblemsWithRatingsInDB();
  },
  /**
   * Adds or updates a problem within a session.
   * @param {Object} session - The session object.
   * @param {Object} problem - The problem object.
   * @param {string} attemptId - The attempt ID.
   * @returns {Object} - The updated session object.
   */
  addOrUpdateProblemInSession(session, problem, _attemptId) {
    const existingProblem = findProblemInSession(session, problem);

    if (existingProblem) {
      const updatedproblems = session.problems.map((curr) =>
        curr.id === existingProblem.id ? { ...curr, problem_id: problem.problem_id, attempted: true, attempt_date: new Date().toISOString() } : curr
      );
      session.problems = updatedproblems;
      logger.info("✅ Updated session problem with problem_id and attempted flag");
    }
    return session;
  },
};

/**
 * Finds a problem in the session based on its ID.
 * @param {Object} session - The session object.
 * @param {Object} problemData - The problem data.
 * @returns {Object|null} - The found problem or null.
 */
const findProblemInSession = (session, problemData) => {
  return session.problems.find((p) => p.leetcode_id === problemData.leetcode_id);
};

/**
 * Shuffles an array using the Fisher-Yates algorithm.
 * @param {Array} array - The array to shuffle.
 * @returns {Array} - The shuffled array.
 */
const _shuffleArray = (array) => {
  let shuffled = array.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * Deduplicates an array of problems by their ID.
 * @param {Array} problems - The array of problems to deduplicate.
 * @returns {Array} - The deduplicated array.
 */
const deduplicateById = (problems) => {
  const seen = new Set();
  let kept = 0;
  let filtered = 0;

  const result = problems.filter((problem, index) => {
    // Use id or leetcode_id (problems may have either field)
    const problemId = problem.id || problem.leetcode_id;

    // Debug first few problems
    if (index < 3) {
      logger.info(`🔍 DEBUG deduplicateById [${index}]:`, {
        title: problem.title,
        id: problem.id,
        leetcode_id: problem.leetcode_id,
        problemId,
        hasProblemId: !!problemId,
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

  logger.info(`🔍 DEBUG deduplicateById summary: kept=${kept}, filtered=${filtered}, total=${problems.length}`);
  return result;
};

function problemSortingCriteria(a, b) {
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

// ===============================
// RETRY-ENABLED SERVICE METHODS
// ===============================

/**
 * Enhanced version of addOrUpdateProblem with retry logic
 * @param {Object} contentScriptData - Problem data from content script
 * @param {Function} sendResponse - Response callback function
 * @param {Object} options - Retry configuration options
 * @returns {Promise<Object>} Operation result
 */
ProblemService.addOrUpdateProblemWithRetry = async function (
  contentScriptData,
  sendResponse,
  options = {}
) {
  const {
    timeout: _timeout = 10000, // Longer timeout for complex operation
    priority: _priority = "high", // High priority for user-initiated actions
    abortController: _abortController = null,
  } = options;

  try {
    logger.info(
      "📌 ProblemService: Adding/updating problem with retry logic:",
      contentScriptData
    );

    // Call the original addOrUpdateProblem method which handles the full logic
    const result = await this.addOrUpdateProblem(contentScriptData);

    logger.info("✅ Problem added/updated successfully with retry:", result);

    if (sendResponse) {
      sendResponse({
        success: true,
        message: "Problem added successfully",
        data: result,
      });
    }

    return result;
  } catch (error) {
    logger.error("❌ Error adding/updating problem:", error);

    if (sendResponse) {
      sendResponse({
        success: false,
        error: "Failed to add problem: " + error.message,
      });
    }

    throw error;
  }
};

/**
 * Enhanced version of getProblemByDescription with retry logic
 * @param {string} description - Problem description
 * @param {string} slug - Problem slug
 * @param {Object} options - Retry configuration options
 * @returns {Promise<Object>} Problem search result
 */
ProblemService.getProblemByDescriptionWithRetry = async function (
  description,
  slug,
  options = {}
) {
  const {
    timeout = 5000,
    priority = "normal",
    abortController = null,
  } = options;

  try {
    logger.info(
      "📌 ProblemService: Searching for problem with retry logic:",
      description
    );

    // 1️⃣ Try fetching from `Standard_Problems` store (this doesn't need retry as it's already cached)
    const problem = await getProblemFromStandardProblems(slug);

    if (problem) {
      logger.info("✅ Problem found in 'Standard_Problems' store:", problem);

      // 2️⃣ Check if problem exists in `problems` store using retry logic
      const problemInProblems = await checkDatabaseForProblemWithRetry(
        problem.id,
        {
          timeout,
          priority,
          abortController,
          operationName: "ProblemService.checkDatabaseForProblem",
        }
      );

      if (problemInProblems) {
        logger.info("✅ Problem found in 'problems' store with retry");

        // Get the full problem data with retry
        const fullProblem = await getProblemWithRetry(problem.id, {
          timeout,
          priority,
          abortController,
          operationName: "ProblemService.getProblem",
        });

        return { problem: fullProblem, found: true };
      }
    } else {
      logger.warn("❌ Problem not found in any store.");
      return { problem: null, found: false };
    }

    logger.warn(
      "⚠️ Problem not found in 'problems' store. returning problem from 'Standard_Problems' store"
    );
    logger.info("✅ Returning problem found in 'standard_problems':", problem);

    return { problem, found: true };
  } catch (error) {
    logger.error("❌ Error in getProblemByDescriptionWithRetry:", error);
    throw error;
  }
};

/**
 * Enhanced version of getAllProblems with retry logic and streaming support
 * @param {Object} options - Retry configuration options
 * @returns {Promise<Array>} All problems
 */
ProblemService.getAllProblemsWithRetry = async function (options = {}) {
  const {
    timeout = 15000, // Longer timeout for bulk operation
    priority = "low",
    abortController = null,
    streaming = false,
    onProgress = null,
  } = options;

  try {
    logger.info("📌 ProblemService: Fetching all problems with retry logic");

    const problems = await fetchAllProblemsWithRetry({
      timeout,
      priority,
      abortController,
      streaming,
      onProgress,
      operationName: "ProblemService.getAllProblems",
    });

    logger.info(`✅ Fetched ${problems.length} problems with retry logic`);
    return problems;
  } catch (error) {
    logger.error("❌ Error fetching all problems with retry:", error);
    throw error;
  }
};

/**
 * Enhanced version of countProblemsByBoxLevel with retry logic
 * @param {Object} options - Retry configuration options
 * @returns {Promise<Array>} Box level counts
 */
ProblemService.countProblemsByBoxLevelWithRetry = async function (
  options = {}
) {
  const { timeout = 5000, priority = "low", abortController = null } = options;

  try {
    logger.info(
      "📌 ProblemService: Counting problems by box level with retry logic"
    );

    const counts = await countProblemsByBoxLevelWithRetry({
      timeout,
      priority,
      abortController,
      operationName: "ProblemService.countProblemsByBoxLevel",
    });

    logger.info("✅ Box level counts with retry:", counts);
    return counts;
  } catch (error) {
    logger.error("❌ Error counting problems by box level with retry:", error);
    throw error;
  }
};

/**
 * Create an abort controller for cancelling operations
 * @returns {AbortController} New abort controller
 */
ProblemService.createAbortController = function () {
  return new AbortController();
};

/**
 * Enhanced session generation with retry logic and cancellation support
 * @param {Object} params - Session generation parameters
 * @param {AbortController} abortController - Optional abort controller
 * @returns {Promise<Array>} Generated session problems
 */
ProblemService.generateSessionWithRetry = async function (
  params = {},
  abortController = null
) {
  const {
    sessionLength = 5,
    difficulty = "Medium",
    tags = [],
    _includeReview = true,
    streaming = false,
    onProgress = null,
    timeout = 20000,
  } = params;

  try {
    logger.info(
      "📌 ProblemService: Generating session with retry logic",
      params
    );

    // Check if operation was cancelled before starting
    if (abortController?.signal.aborted) {
      throw new Error("Session generation cancelled before start");
    }

    // Get all problems with retry logic
    let allProblems = await this.getAllProblemsWithRetry({
      timeout,
      priority: "high",
      abortController,
      streaming,
      onProgress: streaming
        ? (count) => onProgress?.({ stage: "loading", count })
        : null,
    });

    // Check cancellation after data loading
    if (abortController?.signal.aborted) {
      throw new Error("Session generation cancelled after data loading");
    }

    // Apply filters and selection logic
    let filteredProblems = allProblems;

    // Filter by difficulty if specified
    if (difficulty && difficulty !== "Any") {
      filteredProblems = filteredProblems.filter(
        (problem) =>
          problem.difficulty === difficulty || problem.Rating === difficulty
      );
    }

    // Filter by tags if specified
    if (tags && tags.length > 0) {
      filteredProblems = filteredProblems.filter(
        (problem) =>
          problem.tags && problem.tags.some((tag) => tags.includes(tag))
      );
    }

    // Check cancellation before final processing
    if (abortController?.signal.aborted) {
      throw new Error("Session generation cancelled during processing");
    }

    // Select problems for session (simplified logic for demonstration)
    const selectedProblems = filteredProblems
      .sort((a, b) => new Date(a.review) - new Date(b.review)) // Sort by review date
      .slice(0, sessionLength);

    logger.info(
      `✅ Generated session with ${selectedProblems.length} problems using retry logic`
    );

    if (onProgress) {
      onProgress({ stage: "complete", count: selectedProblems.length });
    }

    return selectedProblems;
  } catch (error) {
    if (error.message.includes("cancelled")) {
      logger.info("🚫 Session generation cancelled:", error.message);
    } else {
      logger.error("❌ Error generating session with retry:", error);
    }
    throw error;
  }
};
