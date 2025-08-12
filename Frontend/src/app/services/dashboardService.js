import { fetchAllProblems } from "../../shared/db/problems.js";
import { getAllAttempts } from "../../shared/db/attempts.js";
import { getAllSessions } from "../../shared/db/sessions.js";
import { TagService } from "../../shared/services/tagServices.js";
import { ProblemService } from "../../shared/services/problemService";
import AccurateTimer from "../../shared/utils/AccurateTimer.js";
import { getAllStandardProblems } from "../../shared/db/standard_problems.js";
import { StorageService } from "../../shared/services/storageService.js";
import { getRecentSessionAnalytics } from "../../shared/db/sessionAnalytics.js";

// Simple in-memory cache for focus area analytics
const analyticsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getDashboardStatistics(options = {}) {
  try {
    const { focusAreaFilter = null, dateRange = null } = options;
    
    const allProblems = await fetchAllProblems();
    const allAttempts = await getAllAttempts();
    const allSessions = await getAllSessions();
    const allStandardProblems = await getAllStandardProblems();
    const learningState = await TagService.getCurrentLearningState();
    let boxLevelData = await ProblemService.countProblemsByBoxLevel();

    // Create mapping from problem ID to official difficulty and tags
    const problemDifficultyMap = {};
    const problemTagsMap = new Map();
    const standardProblemsMap = {};
    allStandardProblems.forEach((standardProblem) => {
      standardProblemsMap[standardProblem.id] = standardProblem;
    });

    allProblems.forEach((problem) => {
      const standardProblem = standardProblemsMap[problem.leetCodeID];
      problemDifficultyMap[problem.id] = standardProblem?.difficulty || "Medium";
      if (standardProblem) {
        problemTagsMap.set(problem.id, standardProblem.tags || []);
      }
    });

    // Apply focus area filtering if specified
    let filteredProblems = allProblems;
    let filteredAttempts = allAttempts;
    let filteredSessions = allSessions;

    if (focusAreaFilter && focusAreaFilter.length > 0) {
      // Filter problems that contain at least one of the focus area tags
      const focusAreaProblemIds = new Set();
      allProblems.forEach((problem) => {
        const problemTags = problemTagsMap.get(problem.id) || [];
        const hasFocusAreaTag = focusAreaFilter.some(tag => problemTags.includes(tag));
        if (hasFocusAreaTag) {
          focusAreaProblemIds.add(problem.id);
        }
      });

      filteredProblems = allProblems.filter(problem => focusAreaProblemIds.has(problem.id));
      filteredAttempts = allAttempts.filter(attempt => focusAreaProblemIds.has(attempt.ProblemID));
      
      // Filter sessions that contain focus area problems
      filteredSessions = allSessions.filter(session => {
        if (!session.problems) return false;
        return session.problems.some(problem => focusAreaProblemIds.has(problem.id));
      });
    }

    // Apply date range filtering if specified
    if (dateRange && (dateRange.startDate || dateRange.endDate)) {
      const startDate = dateRange.startDate ? new Date(dateRange.startDate) : new Date(0);
      const endDate = dateRange.endDate ? new Date(dateRange.endDate) : new Date();

      filteredAttempts = filteredAttempts.filter((attempt) => {
        const attemptDate = new Date(attempt.AttemptDate);
        return attemptDate >= startDate && attemptDate <= endDate;
      });

      filteredSessions = filteredSessions.filter((session) => {
        const sessionDate = new Date(session.Date);
        return sessionDate >= startDate && sessionDate <= endDate;
      });
    }

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

    filteredProblems.forEach((problem) => {
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
    filteredAttempts.forEach((attempt) => {
      const officialDifficulty = problemDifficultyMap[attempt.ProblemID];
      const timeSpent = Number(attempt.TimeSpent) || 0; // TimeSpent now in seconds

      // Update overall time statistics
      timeStats.overall.totalTime += timeSpent;
      timeStats.overall.count++;

      // Update overall success statistics
      successStats.overall.total++;
      if (attempt.Success) {
        successStats.overall.successful++;
      }

      // Update statistics based on official difficulty
      if (officialDifficulty && timeStats[officialDifficulty]) {
        timeStats[officialDifficulty].totalTime += timeSpent;
        timeStats[officialDifficulty].count++;

        successStats[officialDifficulty].total++;
        if (attempt.Success) {
          successStats[officialDifficulty].successful++;
        }
      }
    });

    // Calculate average time in minutes for display (convert from seconds)
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

    return {
      statistics: { 
        statistics, 
        averageTime, 
        successRate, 
        allSessions: filteredSessions 
      },
      progress: {
        learningState,
        boxLevelData,
        allAttempts: filteredAttempts,
        allProblems: filteredProblems,
        allSessions: filteredSessions,
      },
      filters: {
        focusAreaFilter,
        dateRange,
        appliedFilters: {
          hasFocusAreaFilter: focusAreaFilter && focusAreaFilter.length > 0,
          hasDateFilter: dateRange && (dateRange.startDate || dateRange.endDate),
        },
        originalCounts: {
          problems: allProblems.length,
          attempts: allAttempts.length,
          sessions: allSessions.length,
        },
        filteredCounts: {
          problems: filteredProblems.length,
          attempts: filteredAttempts.length,
          sessions: filteredSessions.length,
        },
      },
    };
  } catch (error) {
    console.error("Error calculating dashboard statistics:", error);
    throw error;
  }
}

export async function getFocusAreaAnalytics(options = {}) {
  try {
    const {
      focusAreas = null,
      startDate = null,
      endDate = null,
      includeProgressTracking = true,
      includeEffectivenessAnalysis = true,
      useCache = true,
    } = options;

    // Create cache key based on options
    const cacheKey = JSON.stringify({
      focusAreas,
      startDate,
      endDate,
      includeProgressTracking,
      includeEffectivenessAnalysis,
    });

    // Check cache if enabled
    if (useCache && analyticsCache.has(cacheKey)) {
      const cached = analyticsCache.get(cacheKey);
      const now = Date.now();
      if (now - cached.timestamp < CACHE_TTL) {
        return cached.data;
      } else {
        analyticsCache.delete(cacheKey);
      }
    }

    // Get user's focus areas if not provided
    let targetFocusAreas = focusAreas;
    if (!targetFocusAreas) {
      const settings = await StorageService.getSettings();
      targetFocusAreas = settings.focusAreas || [];
    }

    if (targetFocusAreas.length === 0) {
      return {
        focusAreas: [],
        performance: {},
        progressTracking: {},
        effectiveness: {},
        recommendations: [],
        insights: ["No focus areas configured. Set focus areas in Settings to get detailed analytics."],
      };
    }

    // Fetch all necessary data including session analytics
    const [allProblems, allAttempts, allSessions, allStandardProblems, learningState, recentSessionAnalytics] = await Promise.all([
      fetchAllProblems(),
      getAllAttempts(),
      getAllSessions(),
      getAllStandardProblems(),
      TagService.getCurrentLearningState(),
      getRecentSessionAnalytics(50), // Get last 50 sessions for trend analysis
    ]);

    // Create problem mappings
    const standardProblemsMap = new Map();
    allStandardProblems.forEach((sp) => {
      standardProblemsMap.set(sp.id, sp);
    });

    const problemTagsMap = new Map();
    allProblems.forEach((problem) => {
      const standardProblem = standardProblemsMap.get(problem.leetCodeID);
      if (standardProblem) {
        problemTagsMap.set(problem.id, standardProblem.tags || []);
      }
    });

    // Filter data by date range if provided
    let filteredAttempts = allAttempts;
    let filteredSessions = allSessions;

    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : new Date(0);
      const end = endDate ? new Date(endDate) : new Date();

      filteredAttempts = allAttempts.filter((attempt) => {
        const attemptDate = new Date(attempt.AttemptDate);
        return attemptDate >= start && attemptDate <= end;
      });

      filteredSessions = allSessions.filter((session) => {
        const sessionDate = new Date(session.Date);
        return sessionDate >= start && sessionDate <= end;
      });
    }

    // Calculate focus area performance metrics
    const focusAreaPerformance = await calculateFocusAreaPerformance(
      targetFocusAreas,
      filteredAttempts,
      allProblems,
      problemTagsMap,
      standardProblemsMap
    );

    // Calculate progress tracking if requested
    let progressTracking = {};
    if (includeProgressTracking) {
      progressTracking = await calculateFocusAreaProgress(
        targetFocusAreas,
        filteredSessions,
        filteredAttempts,
        allProblems,
        problemTagsMap,
        learningState
      );
    }

    // Calculate effectiveness analysis if requested
    let effectiveness = {};
    if (includeEffectivenessAnalysis) {
      effectiveness = await calculateFocusAreaEffectiveness(
        targetFocusAreas,
        focusAreaPerformance,
        progressTracking,
        learningState
      );
    }

    // Integrate session analytics data
    const sessionAnalyticsIntegration = integrateFocusAreaSessionAnalytics(
      targetFocusAreas,
      recentSessionAnalytics,
      problemTagsMap
    );

    // Generate insights and recommendations
    const insights = generateFocusAreaInsights(focusAreaPerformance, progressTracking, effectiveness);
    const recommendations = generateFocusAreaRecommendations(focusAreaPerformance, effectiveness, learningState);

    const result = {
      focusAreas: targetFocusAreas,
      performance: focusAreaPerformance,
      progressTracking,
      effectiveness,
      sessionAnalytics: sessionAnalyticsIntegration,
      insights,
      recommendations,
      metadata: {
        dateRange: { startDate, endDate },
        totalAttempts: filteredAttempts.length,
        totalSessions: filteredSessions.length,
        generatedAt: new Date().toISOString(),
        cacheKey,
      },
    };

    // Cache the result if caching is enabled
    if (useCache) {
      analyticsCache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
      });
      
      // Clean up old cache entries
      cleanupAnalyticsCache();
    }

    return result;
  } catch (error) {
    console.error("Error calculating focus area analytics:", error);
    throw error;
  }
}

async function calculateFocusAreaPerformance(focusAreas, attempts, allProblems, problemTagsMap, standardProblemsMap) {
  const performance = {};

  for (const focusArea of focusAreas) {
    // Filter attempts for problems that contain this focus area tag
    const focusAreaAttempts = attempts.filter((attempt) => {
      const problemTags = problemTagsMap.get(attempt.ProblemID) || [];
      return problemTags.includes(focusArea);
    });

    if (focusAreaAttempts.length === 0) {
      performance[focusArea] = {
        totalAttempts: 0,
        successfulAttempts: 0,
        successRate: 0,
        averageTime: 0,
        difficultyBreakdown: {
          Easy: { attempts: 0, successes: 0, avgTime: 0 },
          Medium: { attempts: 0, successes: 0, avgTime: 0 },
          Hard: { attempts: 0, successes: 0, avgTime: 0 },
        },
        recentTrend: "stable",
        improvementVelocity: 0,
      };
      continue;
    }

    // Calculate overall metrics
    const totalAttempts = focusAreaAttempts.length;
    const successfulAttempts = focusAreaAttempts.filter((attempt) => attempt.Success).length;
    const successRate = (successfulAttempts / totalAttempts) * 100;
    const totalTime = focusAreaAttempts.reduce((sum, attempt) => sum + (Number(attempt.TimeSpent) || 0), 0);
    const averageTime = AccurateTimer.secondsToMinutes(totalTime / totalAttempts, 1);

    // Calculate difficulty breakdown
    const difficultyBreakdown = {
      Easy: { attempts: 0, successes: 0, totalTime: 0 },
      Medium: { attempts: 0, successes: 0, totalTime: 0 },
      Hard: { attempts: 0, successes: 0, totalTime: 0 },
    };

    focusAreaAttempts.forEach((attempt) => {
      const problem = allProblems.find((p) => p.id === attempt.ProblemID);
      if (problem) {
        const standardProblem = standardProblemsMap.get(problem.leetCodeID);
        const difficulty = standardProblem?.difficulty || "Medium";
        
        if (difficultyBreakdown[difficulty]) {
          difficultyBreakdown[difficulty].attempts++;
          if (attempt.Success) {
            difficultyBreakdown[difficulty].successes++;
          }
          difficultyBreakdown[difficulty].totalTime += Number(attempt.TimeSpent) || 0;
        }
      }
    });

    // Calculate average times for each difficulty
    Object.keys(difficultyBreakdown).forEach((difficulty) => {
      const data = difficultyBreakdown[difficulty];
      data.avgTime = data.attempts > 0 
        ? AccurateTimer.secondsToMinutes(data.totalTime / data.attempts, 1)
        : 0;
      data.successRate = data.attempts > 0 ? (data.successes / data.attempts) * 100 : 0;
      // Clean up totalTime as it's not needed in the final output
      delete data.totalTime;
    });

    // Calculate recent trend and improvement velocity
    const recentTrend = calculateRecentTrend(focusAreaAttempts);
    const improvementVelocity = calculateImprovementVelocity(focusAreaAttempts);

    performance[focusArea] = {
      totalAttempts,
      successfulAttempts,
      successRate: Math.round(successRate * 100) / 100,
      averageTime,
      difficultyBreakdown,
      recentTrend,
      improvementVelocity: Math.round(improvementVelocity * 100) / 100,
    };
  }

  return performance;
}

function calculateRecentTrend(attempts) {
  if (attempts.length < 4) return "insufficient_data";

  // Sort attempts by date
  const sortedAttempts = attempts.sort((a, b) => new Date(a.AttemptDate) - new Date(b.AttemptDate));
  
  // Split into older and recent halves
  const midpoint = Math.floor(sortedAttempts.length / 2);
  const olderHalf = sortedAttempts.slice(0, midpoint);
  const recentHalf = sortedAttempts.slice(midpoint);

  const olderSuccessRate = olderHalf.filter(a => a.Success).length / olderHalf.length;
  const recentSuccessRate = recentHalf.filter(a => a.Success).length / recentHalf.length;

  const improvement = recentSuccessRate - olderSuccessRate;
  
  if (improvement > 0.1) return "improving";
  if (improvement < -0.1) return "declining";
  return "stable";
}

function calculateImprovementVelocity(attempts) {
  if (attempts.length < 2) return 0;

  // Sort attempts by date
  const sortedAttempts = attempts.sort((a, b) => new Date(a.AttemptDate) - new Date(b.AttemptDate));
  
  // Calculate success rate over time using a sliding window
  const windowSize = Math.max(3, Math.floor(attempts.length / 4));
  const velocityPoints = [];

  for (let i = windowSize; i <= sortedAttempts.length; i++) {
    const window = sortedAttempts.slice(i - windowSize, i);
    const successRate = window.filter(a => a.Success).length / window.length;
    velocityPoints.push(successRate);
  }

  if (velocityPoints.length < 2) return 0;

  // Calculate linear trend (slope)
  const n = velocityPoints.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const y = velocityPoints;
  
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  
  return isNaN(slope) ? 0 : slope * 100; // Convert to percentage points
}

async function calculateFocusAreaProgress(focusAreas, _sessions, attempts, _allProblems, problemTagsMap, learningState) {
  const progressTracking = {};

  // Group sessions by time periods
  const now = new Date();

  for (const focusArea of focusAreas) {
    // Filter attempts for this focus area
    const focusAreaAttempts = attempts.filter((attempt) => {
      const problemTags = problemTagsMap.get(attempt.ProblemID) || [];
      return problemTags.includes(focusArea);
    });

    if (focusAreaAttempts.length === 0) {
      progressTracking[focusArea] = {
        weeklyProgress: [],
        monthlyProgress: [],
        milestones: [],
        masteryStatus: "not_started",
        timeToMastery: null,
        currentStreak: 0,
      };
      continue;
    }

    // Calculate weekly progress (last 4 weeks)
    const weeklyProgress = [];
    for (let i = 0; i < 4; i++) {
      const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      
      const weekAttempts = focusAreaAttempts.filter(attempt => {
        const attemptDate = new Date(attempt.AttemptDate);
        return attemptDate >= weekStart && attemptDate < weekEnd;
      });

      const weeklyData = {
        period: `Week ${4 - i}`,
        startDate: weekStart.toISOString(),
        endDate: weekEnd.toISOString(),
        attempts: weekAttempts.length,
        successes: weekAttempts.filter(a => a.Success).length,
        successRate: weekAttempts.length > 0 ? (weekAttempts.filter(a => a.Success).length / weekAttempts.length) * 100 : 0,
        averageTime: weekAttempts.length > 0 
          ? AccurateTimer.secondsToMinutes(
              weekAttempts.reduce((sum, a) => sum + (Number(a.TimeSpent) || 0), 0) / weekAttempts.length,
              1
            )
          : 0,
      };

      weeklyProgress.unshift(weeklyData);
    }

    // Calculate monthly progress (last 3 months)
    const monthlyProgress = [];
    for (let i = 0; i < 3; i++) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i - 1, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i, 1);
      
      const monthAttempts = focusAreaAttempts.filter(attempt => {
        const attemptDate = new Date(attempt.AttemptDate);
        return attemptDate >= monthStart && attemptDate < monthEnd;
      });

      const monthlyData = {
        period: monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        startDate: monthStart.toISOString(),
        endDate: monthEnd.toISOString(),
        attempts: monthAttempts.length,
        successes: monthAttempts.filter(a => a.Success).length,
        successRate: monthAttempts.length > 0 ? (monthAttempts.filter(a => a.Success).length / monthAttempts.length) * 100 : 0,
        averageTime: monthAttempts.length > 0 
          ? AccurateTimer.secondsToMinutes(
              monthAttempts.reduce((sum, a) => sum + (Number(a.TimeSpent) || 0), 0) / monthAttempts.length,
              1
            )
          : 0,
      };

      monthlyProgress.unshift(monthlyData);
    }

    // Detect milestones
    const milestones = detectFocusAreaMilestones(focusAreaAttempts, focusArea);

    // Determine mastery status
    const masteryData = learningState.masteryData.find(m => m.tag === focusArea);
    let masteryStatus = "not_started";
    let timeToMastery = null;

    if (masteryData) {
      const successRate = masteryData.totalAttempts > 0 ? masteryData.successfulAttempts / masteryData.totalAttempts : 0;
      if (successRate >= 0.8) {
        masteryStatus = "mastered";
      } else if (successRate >= 0.6) {
        masteryStatus = "approaching_mastery";
        // Estimate time to mastery based on current improvement rate
        const recentAttempts = focusAreaAttempts.slice(-10);
        if (recentAttempts.length >= 5) {
          const recentSuccessRate = recentAttempts.filter(a => a.Success).length / recentAttempts.length;
          const improvementNeeded = 0.8 - recentSuccessRate;
          const averageImprovementRate = calculateImprovementVelocity(focusAreaAttempts) / 100;
          if (averageImprovementRate > 0) {
            timeToMastery = Math.ceil(improvementNeeded / averageImprovementRate);
          }
        }
      } else if (successRate >= 0.3) {
        masteryStatus = "developing";
      } else {
        masteryStatus = "struggling";
      }
    }

    // Calculate current streak
    const currentStreak = calculateCurrentStreak(focusAreaAttempts);

    progressTracking[focusArea] = {
      weeklyProgress,
      monthlyProgress,
      milestones,
      masteryStatus,
      timeToMastery,
      currentStreak,
      totalProblemsAttempted: new Set(focusAreaAttempts.map(a => a.ProblemID)).size,
      firstAttemptDate: focusAreaAttempts.length > 0 
        ? Math.min(...focusAreaAttempts.map(a => new Date(a.AttemptDate)))
        : null,
      lastAttemptDate: focusAreaAttempts.length > 0 
        ? Math.max(...focusAreaAttempts.map(a => new Date(a.AttemptDate)))
        : null,
    };
  }

  return progressTracking;
}

function detectFocusAreaMilestones(attempts, focusArea) {
  const milestones = [];
  const sortedAttempts = attempts.sort((a, b) => new Date(a.AttemptDate) - new Date(b.AttemptDate));
  
  // Track success rate milestones
  const windows = [5, 10, 20]; // Window sizes to check
  const thresholds = [0.5, 0.7, 0.8, 0.9]; // Success rate thresholds

  for (const windowSize of windows) {
    for (let i = windowSize; i <= sortedAttempts.length; i++) {
      const window = sortedAttempts.slice(i - windowSize, i);
      const successRate = window.filter(a => a.Success).length / window.length;
      
      for (const threshold of thresholds) {
        if (successRate >= threshold) {
          const existingMilestone = milestones.find(m => 
            m.type === "success_rate" && 
            m.threshold === threshold && 
            m.windowSize === windowSize
          );
          
          if (!existingMilestone) {
            milestones.push({
              type: "success_rate",
              threshold,
              windowSize,
              achievedAt: window[window.length - 1].AttemptDate,
              description: `Achieved ${(threshold * 100).toFixed(0)}% success rate over ${windowSize} attempts`,
            });
          }
        }
      }
    }
  }

  // Track problem count milestones
  const uniqueProblems = new Set();
  const problemCountThresholds = [5, 10, 25, 50, 100];
  
  sortedAttempts.forEach(attempt => {
    uniqueProblems.add(attempt.ProblemID);
    const problemCount = uniqueProblems.size;
    
    for (const threshold of problemCountThresholds) {
      if (problemCount === threshold) {
        const existingMilestone = milestones.find(m => 
          m.type === "problem_count" && m.count === threshold
        );
        
        if (!existingMilestone) {
          milestones.push({
            type: "problem_count",
            count: threshold,
            achievedAt: attempt.AttemptDate,
            description: `Attempted ${threshold} different problems in ${focusArea}`,
          });
        }
      }
    }
  });

  return milestones.sort((a, b) => new Date(b.achievedAt) - new Date(a.achievedAt));
}

function calculateCurrentStreak(attempts) {
  if (attempts.length === 0) return 0;
  
  // Sort attempts by date (most recent first)
  const sortedAttempts = attempts.sort((a, b) => new Date(b.AttemptDate) - new Date(a.AttemptDate));
  
  let currentStreak = 0;
  for (const attempt of sortedAttempts) {
    if (attempt.Success) {
      currentStreak++;
    } else {
      break;
    }
  }
  
  return currentStreak;
}

async function calculateFocusAreaEffectiveness(focusAreas, performance, progressTracking, learningState) {
  const effectiveness = {};

  for (const focusArea of focusAreas) {
    const focusAreaPerf = performance[focusArea];
    const focusAreaProgress = progressTracking[focusArea];
    
    if (!focusAreaPerf || focusAreaPerf.totalAttempts === 0) {
      effectiveness[focusArea] = {
        roi: 0,
        learningEfficiency: 0,
        difficultyProgression: "none",
        correlationWithOtherAreas: {},
        bottleneckRisk: "low",
        recommendation: "start_practicing",
      };
      continue;
    }

    // Calculate ROI (Return on Investment)
    const timeInvested = focusAreaPerf.averageTime * focusAreaPerf.totalAttempts; // Total minutes
    const improvementGained = focusAreaPerf.improvementVelocity;
    const roi = timeInvested > 0 ? (improvementGained / timeInvested) * 100 : 0;

    // Calculate learning efficiency
    const learningEfficiency = calculateLearningEfficiency(focusAreaPerf, focusAreaProgress);

    // Analyze difficulty progression
    const difficultyProgression = analyzeDifficultyProgression(focusAreaPerf.difficultyBreakdown);

    // Calculate correlation with other focus areas
    const correlationWithOtherAreas = calculateFocusAreaCorrelations(focusArea, focusAreas, performance);

    // Assess bottleneck risk
    const bottleneckRisk = assessBottleneckRisk(focusAreaPerf, focusAreaProgress, learningState);

    // Generate recommendation
    const recommendation = generateEffectivenessRecommendation(
      focusAreaPerf,
      focusAreaProgress,
      roi,
      learningEfficiency,
      bottleneckRisk
    );

    effectiveness[focusArea] = {
      roi: Math.round(roi * 100) / 100,
      learningEfficiency: Math.round(learningEfficiency * 100) / 100,
      difficultyProgression,
      correlationWithOtherAreas,
      bottleneckRisk,
      recommendation,
      timeInvestment: {
        totalMinutes: Math.round(timeInvested),
        averagePerAttempt: focusAreaPerf.averageTime,
        comparedToAverage: calculateTimeEfficiencyComparison(focusAreaPerf, performance),
      },
    };
  }

  return effectiveness;
}

function calculateLearningEfficiency(performance, progress) {
  // Learning efficiency = (Success rate improvement × Problem variety) / Time investment
  const successRateWeight = performance.successRate / 100;
  const improvementWeight = Math.max(0, performance.improvementVelocity / 10);
  const varietyWeight = Math.min(1, progress.totalProblemsAttempted / 20);
  const timeEfficiencyWeight = Math.max(0.1, 1 / Math.max(1, performance.averageTime / 10));

  return (successRateWeight + improvementWeight + varietyWeight) * timeEfficiencyWeight;
}

function analyzeDifficultyProgression(difficultyBreakdown) {
  const { Easy, Medium, Hard } = difficultyBreakdown;
  
  const easyMastery = Easy.attempts > 0 && Easy.successRate >= 80;
  const mediumMastery = Medium.attempts > 0 && Medium.successRate >= 70;
  const hardMastery = Hard.attempts > 0 && Hard.successRate >= 60;

  if (hardMastery) return "advanced";
  if (mediumMastery && easyMastery) return "intermediate";
  if (easyMastery) return "beginner";
  if (Easy.attempts > 0) return "learning";
  return "none";
}

function calculateFocusAreaCorrelations(currentFocusArea, allFocusAreas, performance) {
  const correlations = {};
  const currentPerf = performance[currentFocusArea];

  if (!currentPerf || currentPerf.totalAttempts === 0) {
    return correlations;
  }

  for (const otherArea of allFocusAreas) {
    if (otherArea === currentFocusArea) continue;
    
    const otherPerf = performance[otherArea];
    if (!otherPerf || otherPerf.totalAttempts === 0) {
      correlations[otherArea] = { strength: 0, type: "no_data" };
      continue;
    }

    // Calculate correlation based on success rates and improvement trends
    const successRateCorr = 1 - Math.abs(currentPerf.successRate - otherPerf.successRate) / 100;
    const trendCorr = calculateTrendCorrelation(currentPerf.recentTrend, otherPerf.recentTrend);
    const velocityCorr = 1 - Math.abs(currentPerf.improvementVelocity - otherPerf.improvementVelocity) / 20;

    const overallCorrelation = (successRateCorr + trendCorr + velocityCorr) / 3;
    
    let type = "weak";
    if (overallCorrelation >= 0.7) type = "strong";
    else if (overallCorrelation >= 0.5) type = "moderate";

    correlations[otherArea] = {
      strength: Math.round(overallCorrelation * 100) / 100,
      type,
    };
  }

  return correlations;
}

function calculateTrendCorrelation(trend1, trend2) {
  const trendValues = { improving: 1, stable: 0, declining: -1, insufficient_data: 0 };
  const val1 = trendValues[trend1] || 0;
  const val2 = trendValues[trend2] || 0;
  
  return 1 - Math.abs(val1 - val2) / 2;
}

function assessBottleneckRisk(performance, progress, _learningState) {
  const riskFactors = [];

  // Low success rate risk
  if (performance.successRate < 30) {
    riskFactors.push("low_success_rate");
  }

  // Declining trend risk
  if (performance.recentTrend === "declining") {
    riskFactors.push("declining_performance");
  }

  // High time investment with low progress
  if (performance.averageTime > 20 && performance.successRate < 50) {
    riskFactors.push("inefficient_time_use");
  }

  // Stagnant progress
  if (progress.masteryStatus === "struggling" && progress.currentStreak === 0) {
    riskFactors.push("learning_plateau");
  }

  if (riskFactors.length >= 3) return "high";
  if (riskFactors.length >= 1) return "medium";
  return "low";
}

function generateEffectivenessRecommendation(performance, progress, roi, learningEfficiency, bottleneckRisk) {
  // High-performing areas
  if (performance.successRate >= 70 && performance.recentTrend === "improving") {
    return "continue_momentum";
  }

  // Good ROI but needs more practice
  if (roi > 5 && performance.totalAttempts < 20) {
    return "increase_practice_volume";
  }

  // High bottleneck risk
  if (bottleneckRisk === "high") {
    return "seek_help_or_change_approach";
  }

  // Inefficient learning
  if (learningEfficiency < 0.3) {
    return "optimize_learning_strategy";
  }

  // Steady progress
  if (performance.recentTrend === "stable" && performance.successRate >= 50) {
    return "maintain_current_approach";
  }

  // Need to start or restart
  if (performance.totalAttempts < 5) {
    return "build_foundation";
  }

  return "focus_on_weak_areas";
}

function calculateTimeEfficiencyComparison(focusAreaPerf, allPerformance) {
  const allAreas = Object.values(allPerformance);
  const validAreas = allAreas.filter(perf => perf.totalAttempts > 0);
  
  if (validAreas.length === 0) return "no_comparison";
  
  const averageTime = validAreas.reduce((sum, perf) => sum + perf.averageTime, 0) / validAreas.length;
  const comparison = focusAreaPerf.averageTime / averageTime;
  
  if (comparison <= 0.8) return "faster_than_average";
  if (comparison >= 1.2) return "slower_than_average";
  return "average";
}

function generateFocusAreaInsights(performance, progressTracking, effectiveness) {
  const insights = [];
  const focusAreas = Object.keys(performance);

  if (focusAreas.length === 0) {
    return ["No focus areas configured. Set focus areas in Settings to get detailed analytics."];
  }

  // Identify top performing areas
  const topPerformer = focusAreas.reduce((best, area) => 
    performance[area].successRate > performance[best].successRate ? area : best
  );
  
  if (performance[topPerformer].totalAttempts > 0) {
    insights.push(`${topPerformer} is your strongest focus area with ${performance[topPerformer].successRate.toFixed(1)}% success rate`);
  }

  // Identify areas with high improvement velocity
  const fastestImproving = focusAreas.reduce((best, area) => 
    performance[area].improvementVelocity > performance[best].improvementVelocity ? area : best
  );
  
  if (performance[fastestImproving].improvementVelocity > 5) {
    insights.push(`${fastestImproving} shows rapid improvement with ${performance[fastestImproving].improvementVelocity.toFixed(1)}% velocity`);
  }

  // Identify bottleneck areas
  const bottlenecks = focusAreas.filter(area => effectiveness[area]?.bottleneckRisk === "high");
  if (bottlenecks.length > 0) {
    insights.push(`Consider reviewing your approach for: ${bottlenecks.join(", ")} - showing signs of learning bottlenecks`);
  }

  // Mastery insights
  const masteredAreas = focusAreas.filter(area => progressTracking[area]?.masteryStatus === "mastered");
  if (masteredAreas.length > 0) {
    insights.push(`Congratulations! You've mastered: ${masteredAreas.join(", ")}`);
  }

  // Time efficiency insights
  const inefficientAreas = focusAreas.filter(area => 
    effectiveness[area]?.timeInvestment?.comparedToAverage === "slower_than_average"
  );
  
  if (inefficientAreas.length > 0) {
    insights.push(`Focus on time efficiency for: ${inefficientAreas.join(", ")} - taking longer than average`);
  }

  return insights.length > 0 ? insights : ["Continue practicing your focus areas to unlock insights"];
}

function generateFocusAreaRecommendations(performance, effectiveness, learningState) {
  const recommendations = [];
  const focusAreas = Object.keys(performance);

  if (focusAreas.length === 0) {
    return [
      {
        type: "setup",
        priority: "high",
        action: "Configure focus areas in Settings to get personalized recommendations",
        expectedImpact: "Enable targeted learning analytics",
      }
    ];
  }

  // High ROI recommendations
  const highROIAreas = focusAreas.filter(area => effectiveness[area]?.roi > 10);
  if (highROIAreas.length > 0) {
    recommendations.push({
      type: "continue",
      priority: "high",
      action: `Increase practice time for ${highROIAreas[0]} - showing excellent return on investment`,
      expectedImpact: `Accelerate mastery with high learning efficiency`,
    });
  }

  // Bottleneck recommendations
  const bottleneckAreas = focusAreas.filter(area => effectiveness[area]?.bottleneckRisk === "high");
  for (const area of bottleneckAreas.slice(0, 2)) { // Limit to top 2
    recommendations.push({
      type: "intervention",
      priority: "high",
      action: `Review learning strategy for ${area} - showing signs of learning plateau`,
      expectedImpact: "Break through current learning bottleneck",
    });
  }

  // Difficulty progression recommendations
  const beginnerAreas = focusAreas.filter(area => 
    effectiveness[area]?.difficultyProgression === "beginner"
  );
  
  for (const area of beginnerAreas.slice(0, 2)) {
    recommendations.push({
      type: "progression",
      priority: "medium",
      action: `Try Medium difficulty problems for ${area} - ready to advance from Easy problems`,
      expectedImpact: "Accelerate skill development and challenge growth",
    });
  }

  // Time efficiency recommendations
  const slowAreas = focusAreas.filter(area => 
    effectiveness[area]?.timeInvestment?.comparedToAverage === "slower_than_average" &&
    performance[area].successRate < 60
  );
  
  if (slowAreas.length > 0) {
    recommendations.push({
      type: "optimization",
      priority: "medium",
      action: `Focus on time management techniques for ${slowAreas[0]}`,
      expectedImpact: "Improve problem-solving efficiency and confidence",
    });
  }

  // New focus area recommendations based on mastery
  const masteredAreas = focusAreas.filter(area => 
    effectiveness[area]?.recommendation === "continue_momentum"
  );
  
  if (masteredAreas.length > 0 && learningState.allTagsInCurrentTier) {
    const availableTags = learningState.allTagsInCurrentTier.filter(tag => 
      !focusAreas.includes(tag)
    );
    
    if (availableTags.length > 0) {
      recommendations.push({
        type: "expansion",
        priority: "low",
        action: `Consider adding ${availableTags[0]} as a new focus area`,
        expectedImpact: "Expand skill portfolio and maintain learning momentum",
      });
    }
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });
}

function integrateFocusAreaSessionAnalytics(focusAreas, sessionAnalytics, _problemTagsMap) {
  const integration = {};

  for (const focusArea of focusAreas) {
    // Filter session analytics for sessions that involved this focus area
    const focusAreaSessions = sessionAnalytics.filter(session => {
      if (!session.strongTags && !session.weakTags) return false;
      
      const sessionTags = [
        ...(session.strongTags || []),
        ...(session.weakTags || [])
      ];
      
      return sessionTags.includes(focusArea);
    });

    const recentSessions = focusAreaSessions.slice(0, 10); // Last 10 relevant sessions
    
    integration[focusArea] = {
      recentSessionCount: focusAreaSessions.length,
      averageAccuracy: focusAreaSessions.length > 0 
        ? focusAreaSessions.reduce((sum, s) => sum + (s.accuracy || 0), 0) / focusAreaSessions.length
        : 0,
      averageTime: focusAreaSessions.length > 0 
        ? focusAreaSessions.reduce((sum, s) => sum + (s.avgTime || 0), 0) / focusAreaSessions.length
        : 0,
      strongPerformanceSessions: focusAreaSessions.filter(s => 
        s.strongTags && s.strongTags.includes(focusArea)
      ).length,
      weakPerformanceSessions: focusAreaSessions.filter(s => 
        s.weakTags && s.weakTags.includes(focusArea)
      ).length,
      recentTrend: calculateSessionAnalyticsTrend(recentSessions, focusArea),
      lastSessionDate: focusAreaSessions.length > 0 
        ? focusAreaSessions[0].completedAt
        : null,
    };
  }

  return integration;
}

function calculateSessionAnalyticsTrend(sessions, _focusArea) {
  if (sessions.length < 3) return "insufficient_data";

  // Sort sessions by completion date (most recent first)
  const sortedSessions = sessions.sort((a, b) => 
    new Date(b.completedAt) - new Date(a.completedAt)
  );

  const recentHalf = sortedSessions.slice(0, Math.ceil(sessions.length / 2));
  const olderHalf = sortedSessions.slice(Math.ceil(sessions.length / 2));

  const recentAvgAccuracy = recentHalf.reduce((sum, s) => sum + (s.accuracy || 0), 0) / recentHalf.length;
  const olderAvgAccuracy = olderHalf.reduce((sum, s) => sum + (s.accuracy || 0), 0) / olderHalf.length;

  const improvement = recentAvgAccuracy - olderAvgAccuracy;

  if (improvement > 0.05) return "improving";
  if (improvement < -0.05) return "declining";
  return "stable";
}

function cleanupAnalyticsCache() {
  const now = Date.now();
  const expiredKeys = [];

  for (const [key, value] of analyticsCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      expiredKeys.push(key);
    }
  }

  for (const key of expiredKeys) {
    analyticsCache.delete(key);
  }

  // Limit cache size to prevent memory issues
  const maxCacheSize = 50;
  if (analyticsCache.size > maxCacheSize) {
    const sortedEntries = Array.from(analyticsCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toDelete = sortedEntries.slice(0, analyticsCache.size - maxCacheSize);
    for (const [key] of toDelete) {
      analyticsCache.delete(key);
    }
  }
}

// Utility function to clear analytics cache (useful for testing or data updates)
export function clearFocusAreaAnalyticsCache() {
  analyticsCache.clear();
}
