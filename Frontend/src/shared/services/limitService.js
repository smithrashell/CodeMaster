import { getMostRecentLimit } from "../db/limit.js";
import { updateProblemsWithRatings } from "../db/problems.js";

const limits = {
  Easy: 15,
  Medium: 25,
  Hard: 40,
};
export const LimitService = {
  async getLimits(problemId) {
    // await updateProblemsWithRatings();
    const limit = await getMostRecentLimit(problemId);
    console.log("✅ limit being sent from limitService", limit);
    return { limit: limit, Time: limits[limit] };
  },
};
