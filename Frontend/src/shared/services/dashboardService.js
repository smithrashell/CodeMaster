import { fetchAllProblems } from "../db/problems.js";

export async function getProblemStatistics() {
  try {
    const allProblems = await fetchAllProblems();

    const statistics = {
      totalSolved: 0,
      mastered: 0,
      inProgress: 0,
      new: 0,
    };

    allProblems.forEach((problem) => {
      if (problem.AttemptStats.TotalAttempts > 0) {
        statistics.totalSolved++;
      }

      switch (problem.BoxLevel) {
        case 1:
          statistics.new++;
          break;
        case 7:
          statistics.mastered++;
          break;
        default:
          if (problem.BoxLevel >= 2 && problem.BoxLevel <= 6) {
            statistics.inProgress++;
          }
          break;
      }
    });

    return statistics;
  } catch (error) {
    console.error("Error fetching problem statistics:", error);
    throw error;
  }
}
