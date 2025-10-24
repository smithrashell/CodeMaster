import { fetchAllProblems } from "../db/problems.js";

export const ScheduleService = {
  isDueForReview,
  isRecentlyAttempted,
  getDailyReviewSchedule,
};

export async function getDailyReviewSchedule(maxProblems = null) {
  try {
    // Note: We no longer filter by tier - review problems should appear regardless of current focus
    // This was removed per learning science principles (spaced repetition should be content-agnostic)
    let allProblems = await fetchAllProblems();

    if (!Array.isArray(allProblems)) allProblems = [];

    console.log(`🔍 DEBUG: getDailyReviewSchedule - Total problems from DB: ${allProblems.length}`);

    // Debug: Check field names on first problem
    if (allProblems.length > 0) {
      const sample = allProblems[0];
      console.log(`🔍 DEBUG: Sample problem from DB:`, {
        has_review_schedule: 'review_schedule' in sample,
        has_ReviewSchedule: 'ReviewSchedule' in sample,
        review_schedule_value: sample.review_schedule,
        ReviewSchedule_value: sample.ReviewSchedule,
        has_id: 'id' in sample,
        has_leetcode_id: 'leetcode_id' in sample,
        id_value: sample.id,
        leetcode_id_value: sample.leetcode_id,
        has_tags: 'tags' in sample,
        has_Tags: 'Tags' in sample,
        title: sample.title
      });
    }

    // Step 1: Get problems due for review
    let reviewProblems = allProblems.filter(
      (p) => {
        const reviewDate = p.review_schedule || p.ReviewSchedule;
        const isDue = isDueForReview(reviewDate);

        // Log first few to debug
        if (allProblems.indexOf(p) < 3) {
          console.log(`🔍 DEBUG: Checking problem ${p.title || p.leetcode_id}:`, {
            reviewDate,
            isDue,
            today: new Date().toISOString(),
            hasReviewSchedule: !!reviewDate
          });
        }

        return isDue;
      }
    );

    console.log(`🔍 DEBUG: Problems due for review (no tier filtering): ${reviewProblems.length}`);

    // 🔧 CRITICAL FIX: REMOVED tier filtering for review problems
    // Learning Science Principle: Spaced repetition should be content-agnostic
    //
    // Why NO filtering:
    // - Review schedule encodes what you've LEARNED (regardless of current focus)
    // - Filtering by tier defeats spaced repetition - you'd forget old topics
    // - Focus/tier system should ONLY apply to NEW problem selection
    // - If a problem has review_schedule, you learned it → you must review it
    //
    // Example of why this matters:
    //   - You learned "Array" problems 2 weeks ago (now in Leitner box 3)
    //   - You moved focus to "Two Pointers"
    //   - Array problems become due for review
    //   - OLD (BROKEN): Filtered out because not in current tier → YOU FORGET ARRAYS
    //   - NEW (CORRECT): Appear for review → Maintain long-term retention
    //
    // The two systems:
    //   1. Review (maintenance) - operates on ALL learned problems, no filtering
    //   2. New problems (expansion) - filtered by focus/tier for structured learning

    // Step 3: Sort by review date (most overdue first)
    // 🔧 NEW BEHAVIOR: Return ALL due problems, let caller decide how many to use
    // This allows priority-based selection where reviews can take precedence
    const sortedReviewProblems = reviewProblems
      .sort((a, b) => new Date(a.review_schedule || a.ReviewSchedule) - new Date(b.review_schedule || b.ReviewSchedule));

    // Only limit if maxProblems is explicitly provided (for backward compatibility)
    const finalReviewProblems = maxProblems !== null
      ? sortedReviewProblems.slice(0, maxProblems)
      : sortedReviewProblems;

    console.log(
      `✅ Final Review Set: ${finalReviewProblems.length} problems (${maxProblems !== null ? `limited to ${maxProblems}` : 'all due problems'})`,
      finalReviewProblems.map((p) => ({
        title: p.title || p.ProblemDescription,
        tags: p.tags || p.Tags,
        leetcode_id: p.leetcode_id,
        review_schedule: p.review_schedule || p.ReviewSchedule
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
