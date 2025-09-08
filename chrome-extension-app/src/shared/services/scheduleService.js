import { fetchAllProblems } from "../db/problems.js";
import { TagService } from "./tagServices.js";
// Remove early binding - use TagService.getCurrentLearningState() directly
export const ScheduleService = {
  isDueForReview,
  isRecentlyAttempted,
  getDailyReviewSchedule,
};

export async function getDailyReviewSchedule(sessionLength) {
  try {
    const { allTagsInCurrentTier } =
      await TagService.getCurrentLearningState();
    let allProblems = await fetchAllProblems();

    if (!Array.isArray(allProblems)) allProblems = [];

    // Step 1: Get problems due for review
    let reviewProblems = allProblems.filter(
      (p) =>
        isDueForReview(p.ReviewSchedule) ||
        !isRecentlyAttempted(p.lastAttemptDate, p.BoxLevel)
    );

    // Step 2: Filter to tier-appropriate problems
    reviewProblems = reviewProblems.filter((p) =>
      (p.Tags || []).every((tag) => allTagsInCurrentTier.includes(tag))
    );

    // Step 3: Sort by review date and return problems due for review
    const finalReviewProblems = reviewProblems
      .sort((a, b) => new Date(a.ReviewSchedule) - new Date(b.ReviewSchedule))
      .slice(0, sessionLength);

    console.log(
      "✅ Final Review Set:",
      finalReviewProblems.map((p) => ({
        title: p.ProblemDescription,
        tags: p.Tags,
        leetcode_id: p.leetcode_id,
      }))
    );

    return finalReviewProblems;
  } catch (error) {
    console.error("❌ Error in getDailyReviewSchedule:", error);
    return [];
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
