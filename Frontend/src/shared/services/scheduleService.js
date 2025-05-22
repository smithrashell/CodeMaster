import { problemSortingCriteria, deduplicateById } from "../utils/Utils.js";
import { fetchAllProblems, fetchAdditionalProblems } from "../db/problems.js";

import { ProblemService } from "./problemService.js";
import { calculateDecayScore } from "../utils/Utils.js";
import { TagService } from "./tagServices.js";
const getCurrentLearningState = TagService.getCurrentLearningState;
export const ScheduleService = {
  isDueForReview,
  isRecentlyAttempted,
  getDailyReviewSchedule,
};

export async function getDailyReviewSchedule(sessionLength) {
  try {
    const { unmasteredTags, tagsinTier } = await getCurrentLearningState();
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
      (p.Tags || []).every((tag) => tagsinTier.includes(tag))
    );

    // ✅ Step 3: Select one unique problem per unmasteredTag
    const seen = new Set();
    const tagMatchedProblems = [];

    for (let tag of unmasteredTags) {
      const match = reviewProblems.find((p) => {
        const id = p.leetCodeID ?? p.id;
        return (p.Tags || []).includes(tag) && !seen.has(id);
      });

      if (match) {
        const id = match.leetCodeID ?? match.id;
        seen.add(id);
        tagMatchedProblems.push(match);
        console.log(
          `🎯 Matched tag "${tag}" with problem "${match.ProblemDescription}"`
        );
      } else {
        console.warn(`⚠️ No available review problem found for tag "${tag}"`);
      }
    }

    // ✅ Step 4: Fill remaining with other FSRS due problems (if needed)
    const fsrsFillers = reviewProblems
      .filter((p) => !seen.has(p.leetCodeID ?? p.id))
      .sort((a, b) => new Date(a.ReviewSchedule) - new Date(b.ReviewSchedule))
      .slice(0, sessionLength - tagMatchedProblems.length);

    const finalReviewProblems = [...tagMatchedProblems, ...fsrsFillers].slice(
      0,
      sessionLength
    );

    console.log(
      "✅ Final Review Set:",
      finalReviewProblems.map((p) => ({
        title: p.ProblemDescription,
        tags: p.Tags,
        leetCodeID: p.leetCodeID,
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
