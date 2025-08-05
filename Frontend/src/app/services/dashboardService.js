import { fetchAllProblems } from "../../shared/db/problems.js";
import { getAllAttempts } from "../../shared/db/attempts.js";
import { getAllSessions } from "../../shared/db/sessions.js";
import { TagService } from "../../shared/services/tagServices.js";
import { ProblemService } from "../../shared/services/problemService";

export async function getDashboardStatistics() {
  try {
    const allProblems = await fetchAllProblems();
    const allAttempts = await getAllAttempts();
    const allSessions = await getAllSessions();
    const learningState = await TagService.getCurrentLearningState();
    let boxLevelData = await ProblemService.countProblemsByBoxLevel();
    const problemRatingMap = {};
    allProblems.forEach((problem) => {
      problemRatingMap[problem.id] = problem.Rating;
    });

    const statistics = {
      totalSolved: 0,
      mastered: 0,
      inProgress: 0,
      new: 0,
    };

    const timeStats = {
      overall: { totalTime: 0, count: 0 },
      Easy: { totalTime: 0, count: 0 },
      Medium: { totalTime: 0, count: 0 },
      Hard: { totalTime: 0, count: 0 },
    };

    const successStats = {
      overall: { successful: 0, total: 0 },
      Easy: { successful: 0, total: 0 },
      Medium: { successful: 0, total: 0 },
      Hard: { successful: 0, total: 0 },
    };

    allProblems.forEach((problem) => {
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
    statistics.totalSolved = statistics.mastered + statistics.inProgress;
    allAttempts.forEach((attempt) => {
      const problemRating = problemRatingMap[attempt.ProblemID];
      const timeSpent = attempt.TimeSpent;

      // Update overall time statistics
      timeStats.overall.totalTime += timeSpent;
      timeStats.overall.count++;

      // Update overall success statistics
      successStats.overall.total++;
      if (attempt.Success) {
        successStats.overall.successful++;
      }

      // Update statistics based on problem rating
      if (problemRating && timeStats[problemRating]) {
        timeStats[problemRating].totalTime += timeSpent;
        timeStats[problemRating].count++;

        successStats[problemRating].total++;
        if (attempt.Success) {
          successStats[problemRating].successful++;
        }
      }
    });

    const calculateAverage = (totalTime, count) =>
      count > 0 ? parseInt(totalTime / count) : 0;

    const calculateSuccessRate = (successful, total) =>
      total > 0 ? parseInt((successful / total) * 100) : 0;

    const averageTime = {
      overall: calculateAverage(
        timeStats.overall.totalTime,
        timeStats.overall.count
      ),
      Easy: calculateAverage(timeStats.Easy.totalTime, timeStats.Easy.count),
      Medium: calculateAverage(
        timeStats.Medium.totalTime,
        timeStats.Medium.count
      ),
      Hard: calculateAverage(timeStats.Hard.totalTime, timeStats.Hard.count),
    };

    const successRate = {
      overall: calculateSuccessRate(
        successStats.overall.successful,
        successStats.overall.total
      ),
      Easy: calculateSuccessRate(
        successStats.Easy.successful,
        successStats.Easy.total
      ),
      Medium: calculateSuccessRate(
        successStats.Medium.successful,
        successStats.Medium.total
      ),
      Hard: calculateSuccessRate(
        successStats.Hard.successful,
        successStats.Hard.total
      ),
    };

    return {
      statistics: { statistics, averageTime, successRate, allSessions },
      progress: {
        learningState,
        boxLevelData,
        allAttempts,
        allProblems,
        allSessions,
      },
    };
  } catch (error) {
    console.error("Error calculating dashboard statistics:", error);
    throw error;
  }
}
