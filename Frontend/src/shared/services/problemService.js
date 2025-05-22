import {
  countProblemsByBoxLevel,
  getProblemByDescription,
  addProblem,
  checkDatabaseForProblem,
  getProblemsByDifficulty,
  getNewProblems,
  updateProblemsWithRatings,
} from "../db/problems.js";
import { getProblemFromStandardProblems } from "../db/standard_problems.js";
import { AttemptsService } from "./attemptsService";
import { v4 as uuidv4 } from "uuid";
import { fetchAllProblems, fetchAdditionalProblems } from "../db/problems.js";
import { ScheduleService } from "./scheduleService.js";
import { TagService } from "./tagServices.js";
import { StorageService } from "./storageService.js";
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

  /**
   * Fetches a set of problems for a session.
   * @param {number} sessionLength - The total number of problems for the session.
   * @param {number} numNewProblems - The number of new problems to introduce.
   * @returns {Promise<Array>} - Array of problems for the session.
   */

  // async fetchProblemsForSession(sessionLength, numNewProblems) {
  //   try {
  //     const { classification, unmasteredTags, sessionPerformance } =
  //       await getCurrentLearningState();

  //     // Fetch previously attempted problems to exclude
  //     const allProblems = await fetchAllProblems();
  //     console.log("✅ allProblems:", allProblems);
  //     const excludeIds = new Set(
  //       allProblems.map((problem) => problem.leetCodeID)
  //     );

  //     // Fetch problems that need review (FSRS controlled)
  //     const reviewProblems = await getDailyReviewSchedule(
  //       sessionLength - numNewProblems
  //     );

  //     // Fetch additional new problems (Hybrid: Tags + Problem Relationships)
  //     const newProblems = await fetchAdditionalProblems(
  //       numNewProblems,
  //       excludeIds
  //     );

  //     return shuffleArray([
  //       ...newProblems.slice(0, numNewProblems),
  //       ...reviewProblems,
  //     ]);
  //   } catch (error) {
  //     console.error("Error fetching problems for session:", error);
  //     throw error;
  //   }
  // },

  async fetchProblemsForSession(settings) {
    const { sessionPerformance, unmasteredTags, tagsinTier, masteryData } =
      await getCurrentLearningState();
    var { adaptive, sessionLength, numberofNewProblemsPerSession } =
      await StorageService.getSettings();
    const allProblems = await fetchAllProblems();

    // 🧠 If adaptive mode is enabled, compute dynamic values
    if (adaptive) {
      console.log("🧠 Adaptive mode is enabled");
      let lastAttemptDate = await AttemptsService.getMostRecentAttempt();
      lastAttemptDate = lastAttemptDate.AttemptDate;
      const now = new Date();
      const gapInDays = lastAttemptDate
        ? (now - new Date(lastAttemptDate)) / (1000 * 60 * 60 * 24)
        : 999;

      sessionLength = 10;

      if (gapInDays > 4 || sessionPerformance.accuracy < 0.5) {
        sessionLength = 5;
      } else if (
        sessionPerformance.accuracy >= 0.8 &&
        sessionPerformance.avgTime < 90
      ) {
        sessionLength = 12;
      }

      // 🤖 Adjust new problem count dynamically as well
      if (sessionPerformance.accuracy >= 0.85) {
        numberofNewProblemsPerSession = Math.min(5, Math.floor(sessionLength / 2));
      } else if (sessionPerformance.accuracy < 0.6) {
        numberofNewProblemsPerSession = 1;
      } else {
        numberofNewProblemsPerSession = Math.floor(sessionLength * 0.3);
      }

      console.log("🧠 Adaptive Session Config:", {
        sessionLength,
        numberofNewProblemsPerSession,
        gapInDays,
        performance: sessionPerformance,
      });
    }

    let problemsDueForReview = await getDailyReviewSchedule(
      sessionLength - numberofNewProblemsPerSession
    );
    console.log("🧼 sessionLength:", sessionLength);

    const additionalNeeded = numberofNewProblemsPerSession;
    const excludeIds = allProblems.map((p) => p.leetCodeID);

    const additionalProblems = await fetchAdditionalProblems(
      additionalNeeded,
      new Set(excludeIds)
    );
    function deduplicateById(problems) {
      const seen = new Set();
      return problems.filter((problem) => {
        if (seen.has(problem.id)) {
          return false;
        }
        seen.add(problem.id);
        return true;
      });
    }

    console.log("🧼 additionalProblems:", additionalProblems);
    console.log("🧼 problemsDueForReview:", problemsDueForReview);
    problemsDueForReview = [...problemsDueForReview, ...additionalProblems];
    console.log("🧼 problemsDueForReview:", problemsDueForReview);
    console.log("🧼 sessionLength:", sessionLength);
    if (problemsDueForReview.length < sessionLength) {
      const allProblems = await fetchAllProblems();
      const fallback = allProblems.filter((p) => !excludeIds.includes(p.id));

      fallback.sort(problemSortingCriteria);
      problemsDueForReview = deduplicateById([
        ...problemsDueForReview,
        ...fallback.slice(0, sessionLength - problemsDueForReview.length),
      ]);
    }

    return problemsDueForReview.slice(0, sessionLength);
  },

  // async fetchProblemsForSession() {
  //   const { sessionPerformance, unmasteredTags, tagsinTier, masteryData } =
  //     await getCurrentLearningState();
  //   const settings = await storageService.getSettings();
  //   const allProblems = await fetchAllProblems();

  //   let lastAttemptDate = await AttemptsService.getMostRecentAttempt();
  //   lastAttemptDate = lastAttemptDate.AttemptDate;
  //   const now = new Date();
  //   const gapInDays = lastAttemptDate
  //     ? (now - new Date(lastAttemptDate)) / (1000 * 60 * 60 * 24)
  //     : 999;

  //   // 🧠 Dynamically size session

  //   let sessionLength = 10;
  //   if (gapInDays > 4 || sessionPerformance.accuracy < 0.5) sessionLength = 5;
  //   else if (
  //     sessionPerformance.accuracy >= 0.8 &&
  //     sessionPerformance.avgTime < 90
  //   )
  //     sessionLength = 12;

  //   const numReviewProblems = Math.min(unmasteredTags.length, 5);
  //   const numNewProblems = sessionLength - numReviewProblems;

  //   const reviewProblems = await getDailyReviewSchedule(numReviewProblems);
  //   const excludeIds = new Set(
  //     allProblems.map((problem) => problem.leetCodeID)
  //   );

  //   const newProblems = await fetchAdditionalProblems(
  //     numNewProblems,
  //     excludeIds
  //   );
  //   console.log("🧼 reviewProblems:", reviewProblems);
  //   console.log("🧼 newProblems:", newProblems);
  //   return shuffleArray([...reviewProblems, ...newProblems]);
  // },

  // async generateAdaptiveSession({
  //   sessions,
  //   attempts,
  //   leitnerBoxState,
  //   tagMastery,
  //   patternLadders,
  //   problems,
  //   targetSessionSize = 10
  // }) {
  //   const recentSessions = getLastNSessions(sessions, 5);
  //   const performance = analyzeRecentSessionPerformance(recentSessions, attempts, problems);

  //   const dueReviews = getProblemsDueForReview(leitnerBoxState);
  //   const strugglingTags = performance.strugglingTags;
  //   const strongTags = performance.strongTags;

  //   let sessionProblems = [];

  //   if (performance.accuracy < 0.5) {
  //     // Struggling – focus on review
  //     sessionProblems = selectFrom(dueReviews, targetSessionSize);
  //   } else if (performance.accuracy >= 0.75) {
  //     // Performing well – half review, half new
  //     const newProblems = getIntroProblemsFromPatternLadders(patternLadders, strugglingTags);
  //     sessionProblems = [
  //       ...selectFrom(dueReviews, Math.floor(targetSessionSize / 2)),
  //       ...selectFrom(newProblems, Math.ceil(targetSessionSize / 2)),
  //     ];
  //   } else {
  //     // Mixed – mostly review, some new
  //     const newProblems = getIntroProblemsFromPatternLadders(patternLadders, strugglingTags);
  //     sessionProblems = [
  //       ...selectFrom(dueReviews, Math.floor(targetSessionSize * 0.7)),
  //       ...selectFrom(newProblems, Math.ceil(targetSessionSize * 0.3)),
  //     ];
  //   }

  //   return sessionProblems;
  // },

  async updateProblemsWithRatings() {
    return updateProblemsWithRatingsInDB();
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

//  async function testCheck(id) {
//   try {
//     const result = await checkDatabaseForProblem(Number(id));
//     console.log("Result:", result);
//   } catch (error) {
//     console.error("Error:", error);
//   }
// };
//Todo: might need to update this to use pa
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
