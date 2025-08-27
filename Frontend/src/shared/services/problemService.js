import {
  countProblemsByBoxLevel,
  addProblem,
  checkDatabaseForProblem,
  // Import retry-enabled functions
  getProblemWithRetry,
  checkDatabaseForProblemWithRetry,
  addProblemWithRetry,
  countProblemsByBoxLevelWithRetry,
  fetchAllProblemsWithRetry,
  saveUpdatedProblemWithRetry,
} from "../db/problems.js";
import { getProblemFromStandardProblems } from "../db/standard_problems.js";
import { AttemptsService } from "./attemptsService";
import { v4 as uuidv4 } from "uuid";
import {
  fetchAllProblems,
  fetchAdditionalProblems,
  updateProblemsWithRatings as updateProblemsWithRatingsInDB,
} from "../db/problems.js";
import { ScheduleService } from "./scheduleService.js";
import { TagService } from "./tagServices.js";
import { StorageService } from "./storageService.js";
import SessionLimits from "../utils/sessionLimits.js";
import { buildAdaptiveSessionSettings } from "../db/sessions.js";
import { calculateDecayScore } from "../utils/Utils.js";
import { ProblemReasoningService } from "../../content/services/problemReasoningService.js";
import { getTagMastery } from "../db/tag_mastery.js";
import performanceMonitor from "../utils/PerformanceMonitor.js";
import { InterviewService } from "./interviewService.js";

// Remove early binding - use TagService.getCurrentLearningState() directly
const getDailyReviewSchedule = ScheduleService.getDailyReviewSchedule;

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
      console.log("📌 ProblemService: Searching for problem:", description);

      // 1️⃣ Try fetching from `Standard_Problems` store
      const problem = await getProblemFromStandardProblems(slug);

      if (problem) {
        console.log("✅ Problem found in 'Standard_Problems' store:", problem);
        //  2️⃣  Check if problem exists in `problems` store
        const problemInProblems = await checkDatabaseForProblem(problem.id);
        if (problemInProblems) {
          console.log(
            "✅ Returning Problem found in 'problems' store:",
            problemInProblems
          );
          performanceMonitor.endQuery(queryContext, true, 1);
          return { problem: problemInProblems, found: true }; // ✅ Found in problems store
        }
      } else {
        console.warn("❌ Problem not found in any store.");
        performanceMonitor.endQuery(queryContext, true, 0);
        return { problem: null, found: false }; // ❌ No problem found
      }

      console.warn(
        "⚠️ Problem not found in 'problems' store. returning problem from 'Standard_Problems' store"
      );

      console.log(
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
  async countProblemsByBoxLevel() {
    return countProblemsByBoxLevel();
  },

  /**
   * Adds or updates a problem in the database.
   * If the problem exists, adds an attempt. Otherwise, adds a new problem.
   * @param {Object} contentScriptData - Data of the problem to add.
   * @returns {Promise<Object>} - The added/updated problem.
   */
  async addOrUpdateProblem(contentScriptData) {
    console.log("📌 addOrUpdateProblem called");

    const problem = await checkDatabaseForProblem(
      Number(contentScriptData.leetCodeID)
    );

    console.log("✅ problemExists:", problem);
    if (problem) {
      return await AttemptsService.addAttempt(
        {
          id: uuidv4(),
          ProblemID: problem.id,
          AttemptDate: contentScriptData.date,
          Success: contentScriptData.success,
          TimeSpent: contentScriptData.timeSpent,
          Difficulty: contentScriptData.difficulty,
          Comments: contentScriptData.comments,
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
      settings.userFocusAreas
    );

    return problems;
  },

  // NEW: Interview session creation (additive, doesn't modify existing flow)
  async createInterviewSession(mode) {
    try {
      console.log(`🎯 PROBLEM SERVICE: Creating interview session in ${mode} mode`);
      
      // Get interview session configuration from InterviewService
      console.log("🎯 Calling InterviewService.createInterviewSession");
      const interviewConfig = await InterviewService.createInterviewSession(mode);
      console.log("🎯 InterviewService returned config:", {
        hasConfig: !!interviewConfig,
        sessionLength: interviewConfig?.sessionLength,
        hasCriteria: !!interviewConfig?.selectionCriteria
      });
      
      // Use interview-specific problem selection
      console.log("🎯 Calling fetchAndAssembleInterviewProblems");
      const problems = await this.fetchAndAssembleInterviewProblems(
        interviewConfig.sessionLength,
        interviewConfig.selectionCriteria,
        mode
      );
      console.log("🎯 fetchAndAssembleInterviewProblems returned:", {
        problemCount: problems?.length,
        firstProblem: problems?.[0]?.title
      });

      // Add interview metadata to session
      const result = {
        problems,
        sessionType: mode,
        interviewConfig: interviewConfig.config,
        interviewMetrics: interviewConfig.interviewMetrics,
        createdAt: interviewConfig.createdAt
      };
      
      console.log("🎯 PROBLEM SERVICE: Returning interview session data:", {
        problemCount: result.problems?.length,
        sessionType: result.sessionType,
        hasConfig: !!result.interviewConfig
      });
      
      return result;
    } catch (error) {
      console.error("🎯 ERROR creating interview session:", error);
      // Fallback to standard session if interview creation fails
      console.log("🎯 Falling back to standard session creation");
      const fallbackProblems = await this.createSession();
      return {
        problems: fallbackProblems,
        sessionType: 'standard', // Fallback becomes standard
        error: `Interview session failed: ${error.message}`
      };
    }
  },

  /**
   * Assembles session problems with intelligent distribution
   * @param {number} sessionLength - Total number of problems in session
   * @param {number} numberOfNewProblems - Number of new problems to include
   * @param {string[]} currentAllowedTags - Tags to focus on
   * @param {string} currentDifficultyCap - Maximum difficulty level
   * @param {string[]} userFocusAreas - User-selected focus areas for weighting
   * @returns {Promise<Array>} - Array of problems for the session
   */
  async fetchAndAssembleSessionProblems(
    sessionLength,
    numberOfNewProblems,
    currentAllowedTags,
    currentDifficultyCap,
    userFocusAreas = []
  ) {
    console.log("🎯 Starting intelligent session assembly...");
    console.log("🎯 Session length:", sessionLength);
    console.log("🎯 New problems target:", numberOfNewProblems);

    const allProblems = await fetchAllProblems();
    const excludeIds = new Set(allProblems.map((p) => p.leetCodeID));

    const sessionProblems = [];

    // **Step 1: Review Problems (user-configurable ratio)**
    const settings = await StorageService.getSettings();
    const reviewRatio = (settings.reviewRatio || 40) / 100; // Default to 40% if not set
    const reviewTarget = Math.floor(sessionLength * reviewRatio);
    console.log(`🔄 Using review ratio: ${(reviewRatio * 100).toFixed(0)}% (${reviewTarget}/${sessionLength} problems)`);
    
    const reviewProblems = await getDailyReviewSchedule(reviewTarget);
    sessionProblems.push(...reviewProblems);

    console.log(
      `🔄 Added ${reviewProblems.length}/${reviewTarget} review problems`
    );

    // **Step 2: New Problems (remaining session) - Split between focus and expansion**
    const newProblemsNeeded = sessionLength - sessionProblems.length;

    if (newProblemsNeeded > 0) {
      const newProblems = await fetchAdditionalProblems(
        newProblemsNeeded,
        excludeIds,
        userFocusAreas,
        currentAllowedTags,
        "session_state" // Pass userId for coordination service
      );

      sessionProblems.push(...newProblems);
      console.log(
        `🆕 Added ${newProblems.length}/${newProblemsNeeded} new problems`
      );
    }

    // **Step 3: Fallback if still short**
    if (sessionProblems.length < sessionLength) {
      const fallbackNeeded = sessionLength - sessionProblems.length;
      const usedIds = new Set(sessionProblems.map((p) => p.id || p.leetCodeID));

      const fallbackProblems = allProblems
        .filter((p) => !usedIds.has(p.id))
        .sort(problemSortingCriteria)
        .slice(0, fallbackNeeded);

      sessionProblems.push(...fallbackProblems);
      console.log(`🔄 Added ${fallbackProblems.length} fallback problems`);
    }

    // **Step 4: Final session composition**
    const finalSession = deduplicateById(sessionProblems).slice(
      0,
      sessionLength
    );

    // **Step 5: Add problem selection reasoning**
    const sessionWithReasons = await this.addProblemReasoningToSession(
      finalSession,
      {
        sessionLength,
        reviewCount: reviewProblems.length,
        newCount: finalSession.length - reviewProblems.length,
        allowedTags: currentAllowedTags,
        difficultyCap: currentDifficultyCap,
      }
    );

    console.log(`🎯 Final session composition:`);
    console.log(
      `   📊 Total problems: ${sessionWithReasons.length}/${sessionLength}`
    );
    console.log(`   🔄 Review problems: ${reviewProblems.length}`);
    console.log(
      `   🆕 New problems: ${sessionWithReasons.length - reviewProblems.length}`
    );
    console.log(
      `   🧠 Problems with reasoning: ${
        sessionWithReasons.filter((p) => p.selectionReason).length
      }`
    );

    return sessionWithReasons;
  },

  // NEW: Interview-specific problem fetching (additive, doesn't modify existing)
  async fetchAndAssembleInterviewProblems(sessionLength, selectionCriteria, mode) {
    try {
      console.log(`🎯 Assembling interview session for ${mode} mode...`);
      console.log("🎯 Session length:", sessionLength);
      
      if (mode === 'standard') {
        // For standard mode, fall back to regular session assembly
        const settings = await buildAdaptiveSessionSettings();
        return this.fetchAndAssembleSessionProblems(
          settings.sessionLength,
          settings.numberOfNewProblems,
          settings.currentAllowedTags,
          settings.currentDifficultyCap,
          settings.userFocusAreas
        );
      }

      // Interview modes use specialized problem selection
      const allProblems = await problems.getAllProblems();
      let availableProblems = allProblems.filter(problem => {
        // Filter to problems that have the required tags
        const problemTags = problem.Tags || [];
        return problemTags.some(tag => 
          selectionCriteria.allowedTags.includes(tag.toLowerCase())
        );
      });

      if (availableProblems.length === 0) {
        console.warn("No problems found matching interview criteria, falling back to all problems");
        availableProblems = allProblems;
      }

      // Apply interview-specific problem mix
      const selectedProblems = [];
      const { problemMix } = selectionCriteria;
      
      if (problemMix) {
        const masteredCount = Math.floor(sessionLength * problemMix.mastered);
        const nearMasteryCount = Math.floor(sessionLength * problemMix.nearMastery);
        const challengingCount = sessionLength - masteredCount - nearMasteryCount;

        // Select mastered tag problems
        const masteredProblems = availableProblems.filter(problem => {
          const problemTags = problem.Tags || [];
          return problemTags.some(tag => 
            selectionCriteria.masteredTags.includes(tag.toLowerCase())
          );
        });
        selectedProblems.push(...this.shuffleArray(masteredProblems).slice(0, masteredCount));

        // Select near-mastery problems
        const nearMasteryProblems = availableProblems.filter(problem => {
          const problemTags = problem.Tags || [];
          return problemTags.some(tag => 
            selectionCriteria.nearMasteryTags.includes(tag.toLowerCase())
          ) && !selectedProblems.includes(problem);
        });
        selectedProblems.push(...this.shuffleArray(nearMasteryProblems).slice(0, nearMasteryCount));

        // Fill remaining slots with challenging/wildcard problems
        const remainingProblems = availableProblems.filter(problem => 
          !selectedProblems.includes(problem)
        );
        selectedProblems.push(...this.shuffleArray(remainingProblems).slice(0, challengingCount));
      } else {
        // Fallback: random selection from available problems
        selectedProblems.push(...this.shuffleArray(availableProblems).slice(0, sessionLength));
      }

      // Ensure we have enough problems
      while (selectedProblems.length < sessionLength && availableProblems.length > selectedProblems.length) {
        const remaining = availableProblems.filter(p => !selectedProblems.includes(p));
        if (remaining.length > 0) {
          selectedProblems.push(remaining[Math.floor(Math.random() * remaining.length)]);
        } else {
          break;
        }
      }

      // Add interview metadata to problems
      const interviewProblems = selectedProblems.map(problem => ({
        ...problem,
        interviewMode: mode,
        interviewConstraints: InterviewService.getInterviewConfig(mode),
        selectionReason: {
          shortText: `Selected for ${mode} interview practice`,
          context: `Interview mode: ${mode}`,
        }
      }));

      console.log(`🎯 Interview session assembled: ${interviewProblems.length} problems`);
      return interviewProblems;
      
    } catch (error) {
      console.error("Error assembling interview problems:", error);
      // Fallback to standard session
      const settings = await buildAdaptiveSessionSettings();
      return this.fetchAndAssembleSessionProblems(
        settings.sessionLength,
        settings.numberOfNewProblems,
        settings.currentAllowedTags,
        settings.currentDifficultyCap,
        settings.userFocusAreas
      );
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
      console.log(
        `🧠 Adding reasoning to ${problems.length} problems in session`
      );

      // Get user performance data for reasoning generation
      const tagMasteryData = await getTagMastery();
      const userPerformance = this.buildUserPerformanceContext(tagMasteryData);

      // Generate reasoning for each problem
      const problemsWithReasons =
        ProblemReasoningService.generateSessionReasons(
          problems,
          sessionContext,
          userPerformance
        );

      console.log(
        `✅ Added reasoning to ${
          problemsWithReasons.filter((p) => p.selectionReason).length
        } problems`
      );
      return problemsWithReasons;
    } catch (error) {
      console.error("❌ Error adding problem reasoning to session:", error);
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
      tagAccuracy[tagKey] = tm.successRate || 0;
      tagAttempts[tagKey] = tm.totalAttempts || 0;
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
  async addOrUpdateProblemInSession(session, problem, attemptId) {
    const existingProblem = findProblemInSession(session, problem);

    if (existingProblem) {
      const updatedproblems = session.problems.map((curr) =>
        curr.id === existingProblem.id ? problem : curr
      );
      session.problems = updatedproblems;
      console.log("✅updatedSession", session);
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
  return session.problems.find((p) => p.id === problemData.leetCodeID);
};

/**
 * Shuffles an array using the Fisher-Yates algorithm.
 * @param {Array} array - The array to shuffle.
 * @returns {Array} - The shuffled array.
 */
const shuffleArray = (array) => {
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
  return problems.filter((problem) => {
    if (seen.has(problem.id)) {
      return false;
    }
    seen.add(problem.id);
    return true;
  });
};

function problemSortingCriteria(a, b) {
  const reviewDateA = new Date(a.ReviewSchedule);
  const reviewDateB = new Date(b.ReviewSchedule);

  if (reviewDateA < reviewDateB) return -1;
  if (reviewDateA > reviewDateB) return 1;

  const totalAttemptsA = a.AttemptStats.TotalAttempts;
  const totalAttemptsB = b.AttemptStats.TotalAttempts;

  if (totalAttemptsA < totalAttemptsB) return -1;
  if (totalAttemptsA > totalAttemptsB) return 1;

  const aScore = calculateDecayScore(
    a.lastAttemptDate,
    a.AttemptStats.SuccessfulAttempts / a.AttemptStats.TotalAttempts
  );
  const bScore = calculateDecayScore(
    b.lastAttemptDate,
    b.AttemptStats.SuccessfulAttempts / b.AttemptStats.TotalAttempts
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
    timeout = 10000, // Longer timeout for complex operation
    priority = "high", // High priority for user-initiated actions
    abortController = null,
  } = options;

  try {
    console.log(
      "📌 ProblemService: Adding/updating problem with retry logic:",
      contentScriptData
    );

    // Use retry-enabled database functions
    const result = await addProblemWithRetry(contentScriptData, {
      timeout,
      priority,
      abortController,
      operationName: "ProblemService.addOrUpdateProblem",
    });

    console.log("✅ Problem added/updated successfully with retry:", result);

    if (sendResponse) {
      sendResponse({
        success: true,
        message: "Problem added successfully",
        data: result,
      });
    }

    return result;
  } catch (error) {
    console.error("❌ Error adding/updating problem:", error);

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
    console.log(
      "📌 ProblemService: Searching for problem with retry logic:",
      description
    );

    // 1️⃣ Try fetching from `Standard_Problems` store (this doesn't need retry as it's already cached)
    const problem = await getProblemFromStandardProblems(slug);

    if (problem) {
      console.log("✅ Problem found in 'Standard_Problems' store:", problem);

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
        console.log("✅ Problem found in 'problems' store with retry");

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
      console.warn("❌ Problem not found in any store.");
      return { problem: null, found: false };
    }

    console.warn(
      "⚠️ Problem not found in 'problems' store. returning problem from 'Standard_Problems' store"
    );
    console.log("✅ Returning problem found in 'standard_problems':", problem);

    return { problem, found: true };
  } catch (error) {
    console.error("❌ Error in getProblemByDescriptionWithRetry:", error);
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
    console.log("📌 ProblemService: Fetching all problems with retry logic");

    const problems = await fetchAllProblemsWithRetry({
      timeout,
      priority,
      abortController,
      streaming,
      onProgress,
      operationName: "ProblemService.getAllProblems",
    });

    console.log(`✅ Fetched ${problems.length} problems with retry logic`);
    return problems;
  } catch (error) {
    console.error("❌ Error fetching all problems with retry:", error);
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
    console.log(
      "📌 ProblemService: Counting problems by box level with retry logic"
    );

    const counts = await countProblemsByBoxLevelWithRetry({
      timeout,
      priority,
      abortController,
      operationName: "ProblemService.countProblemsByBoxLevel",
    });

    console.log("✅ Box level counts with retry:", counts);
    return counts;
  } catch (error) {
    console.error("❌ Error counting problems by box level with retry:", error);
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
    includeReview = true,
    streaming = false,
    onProgress = null,
    timeout = 20000,
  } = params;

  try {
    console.log(
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

    console.log(
      `✅ Generated session with ${selectedProblems.length} problems using retry logic`
    );

    if (onProgress) {
      onProgress({ stage: "complete", count: selectedProblems.length });
    }

    return selectedProblems;
  } catch (error) {
    if (error.message.includes("cancelled")) {
      console.log("🚫 Session generation cancelled:", error.message);
    } else {
      console.error("❌ Error generating session with retry:", error);
    }
    throw error;
  }
};
