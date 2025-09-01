/**
 * Mock Data Service for Dashboard UI Testing
 *
 * Provides realistic test data that mimics the structure and patterns
 * of real user data for development and testing purposes.
 */

import AccurateTimer from "../../shared/utils/AccurateTimer.js";
import { USER_SCENARIOS } from "../config/mockConfig.js";

/**
 * Generate mock session data with realistic patterns
 */
const generateMockSessions = (userType = "active") => {
  const sessions = [];
  const now = new Date();
  const sessionsCount = {
    new: 5,
    beginner: 20,
    active: 50,
    advanced: 100,
  }[userType];

  for (let i = 0; i < sessionsCount; i++) {
    const daysAgo = Math.floor(Math.random() * 180); // Last 6 months
    const sessionDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    const problemsInSession = Math.floor(Math.random() * 8) + 3; // 3-10 problems
    const successRate =
      userType === "advanced"
        ? 0.8
        : userType === "active"
        ? 0.65
        : userType === "beginner"
        ? 0.45
        : 0.3;

    const successfulCount = Math.floor(problemsInSession * successRate);
    const _failedCount = problemsInSession - successfulCount;

    // Create attempts for this session for DataAdapter
    const sessionAttempts = [];
    for (let j = 0; j < problemsInSession; j++) {
      sessionAttempts.push({
        success: j < successfulCount, // First N attempts are successful
        timeSpent: 20 + Math.random() * 40, // 20-60 minutes
        problemId: `problem_${i}_${j}`,
        difficulty: Math.random() > 0.5 ? "Medium" : "Easy",
      });
    }

    sessions.push({
      id: `session_${i}`,
      date: sessionDate.toISOString(),
      problemCount: problemsInSession,
      successfulAttempts: successfulCount,
      totalTimeSpent: problemsInSession * (20 + Math.random() * 40), // 20-60 min per problem
      averageTime: 25 + Math.random() * 25, // 25-50 minutes average
      completed: true,
      timestamp: sessionDate.getTime(),
      // Add fields expected by DataAdapter
      Date: sessionDate.toISOString(), // Capital D for getProblemActivityData
      SessionDate: sessionDate.toISOString(),
      ProblemsAttempted: problemsInSession,
      ProblemsCompleted: successfulCount,
      attempts: sessionAttempts, // Array of attempts for getProblemActivityData
    });
  }

  return sessions.sort((a, b) => new Date(a.date) - new Date(b.date));
};

/**
 * Generate mock attempts data
 */
const generateMockAttempts = (sessions, userType = "active") => {
  const attempts = [];
  let attemptId = 1;

  const difficulties = ["Easy", "Medium", "Hard"];
  const difficultyDistribution = {
    new: [0.6, 0.35, 0.05],
    beginner: [0.5, 0.4, 0.1],
    active: [0.3, 0.55, 0.15],
    advanced: [0.2, 0.5, 0.3],
  }[userType];

  sessions.forEach((session, sessionIndex) => {
    for (let i = 0; i < session.problemCount; i++) {
      const difficultyRand = Math.random();
      let difficulty = "Easy";
      let cumulative = 0;

      for (let j = 0; j < difficulties.length; j++) {
        cumulative += difficultyDistribution[j];
        if (difficultyRand <= cumulative) {
          difficulty = difficulties[j];
          break;
        }
      }

      // Success rates by difficulty and user type
      const successRates = {
        new: { Easy: 0.4, Medium: 0.2, Hard: 0.1 },
        beginner: { Easy: 0.7, Medium: 0.4, Hard: 0.2 },
        active: { Easy: 0.85, Medium: 0.65, Hard: 0.4 },
        advanced: { Easy: 0.95, Medium: 0.8, Hard: 0.6 },
      }[userType];

      const isSuccess = Math.random() < successRates[difficulty];

      // Time varies by difficulty and success
      const baseTimes = { Easy: 15, Medium: 25, Hard: 45 };
      const timeVariation = isSuccess ? 0.8 : 1.3; // Failed attempts take longer
      const timeSpent =
        baseTimes[difficulty] * timeVariation * (0.7 + Math.random() * 0.6);

      const problemId = `problem_${sessionIndex}_${i}`;

      attempts.push({
        id: attemptId++,
        ProblemID: problemId,
        SessionID: session.id,
        Success: isSuccess,
        TimeSpent: Math.floor(timeSpent * 60), // Convert to seconds
        Difficulty: difficulty,
        AttemptDate: session.Date,
        timestamp: new Date(session.Date).getTime(),
        // Additional fields that might be expected
        AttemptDateTime: session.Date,
        problemId: problemId,
      });
    }
  });

  return attempts;
};

/**
 * Generate mock problems with Leitner box distribution
 */
const generateMockProblems = (attempts, userType = "active") => {
  const problems = [];
  const uniqueProblemIds = [...new Set(attempts.map((a) => a.ProblemID))];

  // Box level distribution by user type
  const boxDistributions = {
    new: [0.8, 0.15, 0.05, 0, 0, 0, 0], // Mostly box 1
    beginner: [0.4, 0.3, 0.2, 0.07, 0.03, 0, 0], // Progressing through early boxes
    active: [0.2, 0.25, 0.25, 0.15, 0.1, 0.04, 0.01], // Distributed across boxes
    advanced: [0.1, 0.15, 0.2, 0.2, 0.2, 0.1, 0.05], // More in higher boxes
  }[userType];

  uniqueProblemIds.forEach((problemId) => {
    // Determine box level based on distribution
    const rand = Math.random();
    let boxLevel = 1;
    let cumulative = 0;

    for (let i = 0; i < boxDistributions.length; i++) {
      cumulative += boxDistributions[i];
      if (rand <= cumulative) {
        boxLevel = i + 1;
        break;
      }
    }

    const relatedAttempts = attempts.filter((a) => a.ProblemID === problemId);
    const lastAttempt = relatedAttempts[relatedAttempts.length - 1];

    problems.push({
      id: problemId,
      leetCodeID: Math.floor(Math.random() * 2000) + 1,
      title: `Problem ${problemId.split("_")[2] || problemId.split("_")[1]}`,
      difficulty: lastAttempt?.Difficulty || "Medium",
      BoxLevel: boxLevel,
      lastAttempted: lastAttempt?.AttemptDate || new Date().toISOString(),
      // Fields expected by promotion data function
      Tags: [`tag_${Math.floor(Math.random() * 20) + 1}`],
      Rating: Math.floor(Math.random() * 1000) + 1000, // Random rating 1000-2000
      // Additional fields that might be expected
      ProblemTitle: `Problem ${
        problemId.split("_")[2] || problemId.split("_")[1]
      }`,
      TotalAttempts: relatedAttempts.length,
      SuccessfulAttempts: relatedAttempts.filter((a) => a.Success).length,
      tags: [`tag_${Math.floor(Math.random() * 20) + 1}`], // Legacy field
    });
  });

  return problems;
};

/**
 * Generate time-granular chart data
 */
const generateChartData = (
  sessions,
  type = "accuracy",
  granularity = "weekly"
) => {
  const data = [];
  const now = new Date();
  const periods =
    granularity === "weekly" ? 12 : granularity === "monthly" ? 12 : 3;

  for (let i = periods - 1; i >= 0; i--) {
    let periodStart, periodEnd, name;

    if (granularity === "weekly") {
      periodStart = new Date(now.getTime() - (i * 7 + 7) * 24 * 60 * 60 * 1000);
      periodEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      name = `Week ${periods - i}`;
    } else if (granularity === "monthly") {
      periodStart = new Date(now.getFullYear(), now.getMonth() - i - 1, 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() - i, 0);
      name = periodStart.toLocaleDateString("en-US", { month: "short" });
    } else {
      periodStart = new Date(now.getFullYear() - i - 1, 0, 1);
      periodEnd = new Date(now.getFullYear() - i, 0, 0);
      name = `${periodStart.getFullYear()}`;
    }

    const periodSessions = sessions.filter((s) => {
      const sessionDate = new Date(s.date);
      return sessionDate >= periodStart && sessionDate <= periodEnd;
    });

    if (type === "accuracy") {
      const totalAttempts = periodSessions.reduce(
        (sum, s) => sum + s.problemCount,
        0
      );
      const successfulAttempts = periodSessions.reduce(
        (sum, s) => sum + s.successfulAttempts,
        0
      );
      const accuracy =
        totalAttempts > 0
          ? Math.round((successfulAttempts / totalAttempts) * 100)
          : 0;

      data.push({ name, accuracy });
    } else if (type === "breakdown") {
      const totalAttempts = periodSessions.reduce(
        (sum, s) => sum + s.problemCount,
        0
      );
      const successful = periodSessions.reduce(
        (sum, s) => sum + s.successfulAttempts,
        0
      );

      data.push({
        name,
        firstTry: Math.floor(successful * 0.7),
        retrySuccess: Math.floor(successful * 0.3),
        failed: totalAttempts - successful,
      });
    } else if (type === "activity") {
      const attempted = periodSessions.reduce(
        (sum, s) => sum + s.problemCount,
        0
      );
      const passed = periodSessions.reduce(
        (sum, s) => sum + s.successfulAttempts,
        0
      );
      const failed = attempted - passed;

      data.push({ name, attempted, passed, failed });
    } else if (type === "efficiency") {
      const problemsSolved = periodSessions.reduce(
        (sum, s) => sum + s.successfulAttempts,
        0
      );
      // Estimate hints used (roughly 1-3 hints per session)
      const hintsUsed = periodSessions.length * (1 + Math.random() * 2);
      const efficiency = hintsUsed > 0 ? Math.round((problemsSolved / hintsUsed) * 10) / 10 : 0;

      data.push({ name, efficiency });
    }
  }

  return data;
};

/**
 * Generate promotion/demotion data
 */
const generatePromotionData = (granularity = "weekly") => {
  const data = [];
  const now = new Date();
  const periods =
    granularity === "weekly" ? 12 : granularity === "monthly" ? 12 : 3;

  for (let i = periods - 1; i >= 0; i--) {
    let name;
    if (granularity === "weekly") {
      name = `Week ${periods - i}`;
    } else if (granularity === "monthly") {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      name = date.toLocaleDateString("en-US", { month: "short" });
    } else {
      name = `${now.getFullYear() - i}`;
    }

    const promotions = Math.floor(Math.random() * 10) + 2;
    const demotions = Math.floor(Math.random() * 5) + 1;

    data.push({ name, promotions, demotions });
  }

  return data;
};

/**
 * Calculate statistics from problems data
 */
const calculateStatistics = (problems) => {
  const statistics = {
    totalSolved: problems.filter((p) => p.BoxLevel >= 2).length,
    mastered: problems.filter((p) => p.BoxLevel === 7).length,
    inProgress: problems.filter((p) => p.BoxLevel >= 2 && p.BoxLevel <= 6)
      .length,
    new: problems.filter((p) => p.BoxLevel === 1).length,
  };

  // Calculate box level distribution
  const boxLevelData = {};
  for (let i = 1; i <= 7; i++) {
    boxLevelData[i] = problems.filter((p) => p.BoxLevel === i).length;
  }

  return { statistics, boxLevelData };
};

/**
 * Calculate performance metrics from attempts data
 */
const calculatePerformanceMetrics = (attempts) => {
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

  attempts.forEach((attempt) => {
    const difficulty = attempt.Difficulty;
    const timeSpent = attempt.TimeSpent;

    timeStats.overall.totalTime += timeSpent;
    timeStats.overall.count++;
    successStats.overall.total++;

    if (attempt.Success) {
      successStats.overall.successful++;
    }

    if (timeStats[difficulty]) {
      timeStats[difficulty].totalTime += timeSpent;
      timeStats[difficulty].count++;
      successStats[difficulty].total++;

      if (attempt.Success) {
        successStats[difficulty].successful++;
      }
    }
  });

  // Calculate averages
  const calculateAverage = (totalTimeInSeconds, count) =>
    count > 0
      ? AccurateTimer.secondsToMinutes(totalTimeInSeconds / count, 1)
      : 0;

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

  return { averageTime, successRate };
};

/**
 * Generate analytics data based on user type
 */
const generateAnalyticsData = (userType, sessions) => {
  // Calculate time accuracy (how close user estimates are to actual time)
  const timeAccuracy = Math.floor(75 + Math.random() * 20); // 75-95% accuracy

  // Generate hint usage data matching IndexedDB hint_interactions schema
  const hintsUsed = {
    total: Math.floor(Math.random() * 30) + 15, // 15-45 total hints
    contextual: Math.floor(Math.random() * 20) + 10, // Most popular
    general: Math.floor(Math.random() * 8) + 3,
    primer: Math.floor(Math.random() * 5) + 2,
  };

  // Generate learning efficiency (problems solved per hint used)
  const learningEfficiencyData = {
    weekly: generateChartData(sessions, "efficiency", "weekly"),
    monthly: generateChartData(sessions, "efficiency", "monthly"), 
    yearly: generateChartData(sessions, "efficiency", "yearly"),
  };

  // Strategy success rate for Progress page
  const strategySuccessRate = Math.floor(65 + Math.random() * 25); // 65-90%

  // Timer behavior insight based on user type
  const timerBehaviorInsights = {
    new: "Learning timing",
    beginner: "Improving pace",
    active: "On time",
    advanced: "Excellent timing",
  };
  const timerBehavior = timerBehaviorInsights[userType] || timerBehaviorInsights.active;

  // Timer percentage based on user type
  const timerPercentageRanges = {
    new: [45, 65],      // 45-65%
    beginner: [60, 75], // 60-75%
    active: [75, 90],   // 75-90%
    advanced: [85, 95], // 85-95%
  };
  const [minPercent, maxPercent] = timerPercentageRanges[userType] || timerPercentageRanges.active;
  const timerPercentage = Math.floor(Math.random() * (maxPercent - minPercent + 1)) + minPercent;

  // Generate next review time (random time within next 24 hours)
  const nextReviewHours = Math.floor(Math.random() * 24);
  const nextReviewMinutes = Math.floor(Math.random() * 60);
  const isToday = nextReviewHours < 12;
  const reviewDate = new Date();
  if (!isToday) reviewDate.setDate(reviewDate.getDate() + 1);
  reviewDate.setHours(nextReviewHours, nextReviewMinutes, 0, 0);
  
  const formatTime = (date) => {
    const options = { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true,
      weekday: isToday ? undefined : 'short'
    };
    const timeStr = date.toLocaleTimeString('en-US', options);
    return isToday ? `Today • ${timeStr}` : `${date.toLocaleDateString('en-US', { weekday: 'short' })} • ${timeStr}`;
  };
  const nextReviewTime = formatTime(reviewDate);

  // Generate next review count based on user type
  const reviewCountRanges = {
    new: [5, 12],       // 5-12 problems
    beginner: [8, 18],  // 8-18 problems
    active: [12, 25],   // 12-25 problems
    advanced: [15, 30], // 15-30 problems
  };
  const [minCount, maxCount] = reviewCountRanges[userType] || reviewCountRanges.active;
  const nextReviewCount = Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount;

  return {
    hintsUsed,
    learningEfficiencyData,
    strategySuccessRate,
    timerBehavior,
    timerPercentage,
    nextReviewTime,
    nextReviewCount,
    timeAccuracy,
  };
};

/**
 * Generate all chart data
 */
const generateAllChartData = (sessions) => {
  const accuracyData = {
    weekly: generateChartData(sessions, "accuracy", "weekly"),
    monthly: generateChartData(sessions, "accuracy", "monthly"),
    yearly: generateChartData(sessions, "accuracy", "yearly"),
  };

  const breakdownData = {
    weekly: generateChartData(sessions, "breakdown", "weekly"),
    monthly: generateChartData(sessions, "breakdown", "monthly"),
    yearly: generateChartData(sessions, "breakdown", "yearly"),
  };

  const activityData = {
    weekly: generateChartData(sessions, "activity", "weekly"),
    monthly: generateChartData(sessions, "activity", "monthly"),
    yearly: generateChartData(sessions, "activity", "yearly"),
  };

  const promotionData = {
    weekly: generatePromotionData("weekly"),
    monthly: generatePromotionData("monthly"),
    yearly: generatePromotionData("yearly"),
  };

  return { accuracyData, breakdownData, activityData, promotionData };
};

/**
 * Create mock learning state based on user type
 */
const createMockLearningState = (userType, strategySuccessRate, timerBehavior) => {
  return {
    currentTier:
      userType === "advanced"
        ? "Advanced Technique"
        : userType === "active"
        ? "Fundamental Technique"
        : "Core Concept",
    masteredTags: Math.floor(Math.random() * 15) + 5,
    totalTags: 50,
    focusTags: ["Array", "Two Pointers", "Sliding Window"].slice(
      0,
      Math.floor(Math.random() * 3) + 1
    ),
    strategySuccessRate,
    timerBehavior,
  };
};

/**
 * Main mock data generator
 */
export const generateMockData = (userType = "active") => {
  // eslint-disable-next-line no-console
  console.log(`🎭 Generating mock data for user type: ${userType}`);

  const sessions = generateMockSessions(userType);
  const attempts = generateMockAttempts(sessions, userType);
  const problems = generateMockProblems(attempts, userType);

  const { statistics, boxLevelData } = calculateStatistics(problems);
  const { averageTime, successRate } = calculatePerformanceMetrics(attempts);
  const analyticsData = generateAnalyticsData(userType, sessions);
  const chartData = generateAllChartData(sessions);
  const mockLearningState = createMockLearningState(
    userType,
    analyticsData.strategySuccessRate,
    analyticsData.timerBehavior
  );

  // eslint-disable-next-line no-console
  console.log(`✅ Generated mock data:`, {
    sessions: sessions.length,
    attempts: attempts.length,
    problems: problems.length,
    statistics,
  });

  return {
    // Raw data
    allSessions: sessions,
    allAttempts: attempts,
    allProblems: problems,

    // Calculated statistics
    statistics,
    averageTime: { ...averageTime, timeAccuracy: analyticsData.timeAccuracy },
    successRate,
    boxLevelData,
    learningState: mockLearningState,

    // New analytics data
    hintsUsed: analyticsData.hintsUsed,
    strategySuccessRate: analyticsData.strategySuccessRate,
    timerBehavior: analyticsData.timerBehavior,
    timerPercentage: analyticsData.timerPercentage,
    nextReviewTime: analyticsData.nextReviewTime,
    nextReviewCount: analyticsData.nextReviewCount,
    timeAccuracy: analyticsData.timeAccuracy,

    // Chart data
    accuracyData: chartData.accuracyData,
    breakdownData: chartData.breakdownData,
    activityData: chartData.activityData,
    promotionData: chartData.promotionData,
    learningEfficiencyData: analyticsData.learningEfficiencyData,
  };
};

export default { generateMockData, USER_SCENARIOS };
