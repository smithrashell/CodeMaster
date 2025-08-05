import {
  countProblemsByBoxLevel,
  addProblem,
  checkDatabaseForProblem,
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
import { buildAdaptiveSessionSettings } from "../db/sessions.js";
import { calculateDecayScore } from "../utils/Utils.js";
import { ProblemReasoningService } from "../../content/services/problemReasoningService.js";
import { getTagMastery } from "../db/tag_mastery.js";

const getCurrentLearningState = TagService.getCurrentLearningState;
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
        return { problem: problemInProblems, found: true }; // ✅ Found in problems store
      }
    } else {
      console.warn("❌ Problem not found in any store.");
      return { problem: null, found: false }; // ❌ No problem found
    }

    console.warn(
      "⚠️ Problem not found in 'problems' store. returning problem from 'Standard_Problems' store"
    );

    console.log("✅ Returning problem found in  'standard_problems':", problem);
    return { problem: problem, found: false }; // ✅ Found in standard_problems
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
      settings.currentDifficultyCap
    );

    return problems;
  },

  /**
   * Assembles session problems with intelligent distribution
   * @param {number} sessionLength - Total number of problems in session
   * @param {number} numberOfNewProblems - Number of new problems to include
   * @param {string[]} currentAllowedTags - Tags to focus on
   * @param {string} currentDifficultyCap - Maximum difficulty level
   * @returns {Promise<Array>} - Array of problems for the session
   */
  async fetchAndAssembleSessionProblems(
    sessionLength,
    numberOfNewProblems,
    currentAllowedTags,
    currentDifficultyCap
  ) {
    console.log("🎯 Starting intelligent session assembly...");
    console.log("🎯 Session length:", sessionLength);
    console.log("🎯 New problems target:", numberOfNewProblems);

    const allProblems = await fetchAllProblems();
    const excludeIds = new Set(allProblems.map((p) => p.leetCodeID));

    const sessionProblems = [];

    // **Step 1: Review Problems (40% of session)**
    const reviewTarget = Math.floor(sessionLength * 0.4);
    const reviewProblems = await getDailyReviewSchedule(reviewTarget);
    sessionProblems.push(...reviewProblems);

    console.log(
      `🔄 Added ${reviewProblems.length}/${reviewTarget} review problems`
    );

    // **Step 2: New Problems (60% of session) - Split between focus and expansion**
    const newProblemsNeeded = sessionLength - sessionProblems.length;

    if (newProblemsNeeded > 0) {
      const newProblems = await fetchAdditionalProblems(
        newProblemsNeeded,
        excludeIds
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

    // Identify weak tags (below 70% accuracy)
    const weakTags = tagMasteryData
      .filter((tm) => tm.successRate < 0.7 && tm.totalAttempts >= 3)
      .map((tm) => tm.tag.toLowerCase());

    // Identify new tags (less than 3 attempts)
    const newTags = tagMasteryData
      .filter((tm) => tm.totalAttempts < 3)
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
