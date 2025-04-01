import { problemSortingCriteria, deduplicateById } from "../utils/Utils.js";
import { fetchAllProblems, fetchAdditionalProblems } from "../db/problems.js";
import { TagService } from "./tagServices.js";
import { ProblemService } from "./problemService.js";
import { calculateDecayScore } from "../utils/Utils.js";
const getCurrentLearningState = TagService.getCurrentLearningState;
export const ScheduleService = {
  isDueForReview,
  isRecentlyAttempted,
  getDailyReviewSchedule,
};


async function getDailyReviewSchedule(sessionLength) {
  try {
    const { unmasteredTags, tagsinTier } = await getCurrentLearningState();

    // ✅ Fetch all problems
    let allProblems = await fetchAllProblems();
    if (!Array.isArray(allProblems)) {
      console.warn(
        "⚠️ fetchAllProblems() returned an invalid value. Defaulting to empty array."
      );
      allProblems = [];
    }
    // ✅ Step 0: FallBack  if no problems after tag filtering, just get by **due for review** according to FSRS
    let fsrsDueProblems = allProblems.filter(
      (problem) =>
        isDueForReview(problem.ReviewSchedule) ||
        !isRecentlyAttempted(problem.lastAttemptDate, problem.BoxLevel)
    );

    // ✅ Step 1: Select problems that are **due for review** according to FSRS
    let reviewProblems = allProblems.filter(
      (problem) =>
        isDueForReview(problem.ReviewSchedule) ||
        !isRecentlyAttempted(problem.lastAttemptDate, problem.BoxLevel)
    );

    console.log(
      `✅ Problems due for review before filtering: ${reviewProblems.length}`
    );
    console.log("Tags:", reviewProblems[0].Tags, typeof reviewProblems[0].Tags);
    console.log("tagsinTier:", tagsinTier, typeof tagsinTier);
    // ✅ Step 2: Remove problems that contain tags NOT in the learning tier
    reviewProblems = reviewProblems.filter((problem) =>
      (problem.Tags || []).every((tag) => tagsinTier.includes(tag))
    );

    console.log(
      `✅ Problems after removing those outside learning tier: ${reviewProblems.length}`
    );

    // ✅ Step 3: Prioritize problems covering active **unmastered tags**
    reviewProblems.forEach((problem) => {
      problem.tagMatchScore = (problem.Tags || []).reduce((score, tag) => {
        return score + (unmasteredTags.includes(tag) ? 1 : 0);
      }, 0);
    });

    // ✅ Step 4: Ensure selected problems contain at least one `unmasteredTag`
    // High priority tag-matched problems
    let tagFocusedProblems = reviewProblems.filter((p) => p.tagMatchScore >= 2);
    // ✅ Step 5: Remove tag-focused problems from fsrsDueProblems
    const tagFocusedProblemIds = new Set(tagFocusedProblems.map((p) => p.id));
    fsrsDueProblems = fsrsDueProblems.filter(
      (p) => !tagFocusedProblemIds.has(p.id)
    );
    console.log(
      `✅ Problems after enforcing unmastered tag focus: ${reviewProblems.length}`
    );

    const minFsrsQuota = Math.max(Math.floor(sessionLength * 0.2), 2);
    const fsrsProblemsSelected = fsrsDueProblems
      .sort(
        (a, b) => new Date(a.ReviewSchedule) - new Date(b.ReviewSchedule) // Earliest due first
      )
      .slice(0, minFsrsQuota);
    // ✅ Step 6: Sort by **unmastered tag relevance** FIRST, then FSRS priority
    tagFocusedProblems.sort((a, b) => {
      const tagDiff = b.tagMatchScore - a.tagMatchScore;
      if (tagDiff !== 0) return tagDiff;

      // Secondary: Decay Score (instead of just review date)
      return (
        calculateDecayScore(
          a.lastAttemptDate,
          a.AttemptStats.SuccessfulAttempts / a.AttemptStats.TotalAttempts,
          a.Stability || 1
        ) -
        calculateDecayScore(
          b.lastAttemptDate,
          b.AttemptStats.SuccessfulAttempts / b.AttemptStats.TotalAttempts,
          b.Stability || 1
        )
      );
    });
let combinedProblems = [...tagFocusedProblems, ...fsrsProblemsSelected];

// Ensure final session length
combinedProblems = combinedProblems.slice(0, sessionLength);

    console.log(
      `🏆 Final sorted review problems:`,
      combinedProblems.slice(0, sessionLength)
    );

    return combinedProblems.slice(0, sessionLength);
  } catch (error) {
    console.error("❌ Error retrieving problems from Schedule:", error);
    return []; // Return an empty list to prevent crashes
  }
}

/**
 * Determines if a problem is due for review
 * @param {Date} reviewDate - Scheduled review date
 * @returns {boolean} - True if the problem should be reviewed today
 */
export function isDueForReview(reviewDate) {
  return new Date(reviewDate) <= new Date();
}

/**
 * Determines if a problem was recently attempted
 * @param {Date} lastAttemptDate - Last attempt date
 * @param {number} boxLevel - Box level of the problem
 * @param {boolean} allowRelaxation - Whether to apply relaxed scheduling
 * @returns {boolean} - True if the problem was recently attempted
 */
export function isRecentlyAttempted(
  lastAttemptDate,
  boxLevel,
  allowRelaxation = true
) {
  const today = new Date();
  const lastAttempt = new Date(lastAttemptDate);
  let skipInterval = [0, 1, 2, 4, 7, 14, 30][boxLevel - 1] || 14;

  if (allowRelaxation) {
    skipInterval /= 2;
  }

  const daysSinceLastAttempt = (today - lastAttempt) / (1000 * 60 * 60 * 24);
  return daysSinceLastAttempt < skipInterval;
}


