import { fetchAllProblems } from "../../shared/db/problems.js";
import { getAllAttempts } from "../../shared/db/attempts.js";
import { getAllSessions } from "../../shared/db/sessions.js";
import { TagService } from "../../shared/services/tagServices.js";
import { ProblemService } from "../../shared/services/problemService";
import AccurateTimer from "../../shared/utils/AccurateTimer.js";
import { getAllStandardProblems } from "../../shared/db/standard_problems.js";
import { StorageService } from "../../shared/services/storageService.js";
import { getRecentSessionAnalytics } from "../../shared/db/sessionAnalytics.js";
import { HintInteractionService } from "../../shared/services/hintInteractionService.js";
import { getInteractionsBySession } from "../../shared/db/hint_interactions.js";
import { getLatestSession } from "../../shared/db/sessions.js";
import logger from "../../shared/utils/logger.js";

// Simple in-memory cache for focus area analytics
const analyticsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get initial focus areas from provided data (no direct service calls)
 * Background script should provide focusAreas using session generation logic
 */
// Default focus areas fallback data (similar to content script pattern)
const DEFAULT_FOCUS_AREAS = [
  "array", 
  "hash table", 
  "string", 
  "dynamic programming",
  "tree"
];

function getInitialFocusAreas(providedFocusAreas) {
  // Use provided focus areas from background script
  if (providedFocusAreas && providedFocusAreas.length > 0) {
    return providedFocusAreas;
  }
  
  // Enhanced fallback with multiple common focus areas (like content script pattern)
  logger.warn("No focus areas provided by background script", { context: 'focus_areas_fallback' });
  return DEFAULT_FOCUS_AREAS;
}

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

    // Generate session analytics data
    const sessionAnalytics = await generateSessionAnalytics(filteredSessions, filteredAttempts);
    
    // Generate mastery data with focus areas integration
    const masteryData = await generateMasteryData(learningState);
    
    // Generate goals/learning plan data with real metrics
    const goalsData = await generateGoalsData();

    // Generate learning efficiency chart data
    const learningEfficiencyData = await generateLearningEfficiencyChartData(filteredSessions, filteredAttempts);

    // Calculate timer behavior from actual session data with null checks
    const timerBehavior = calculateTimerBehavior(filteredAttempts) || "No data";
    const timerPercentage = calculateTimerPercentage(filteredAttempts) || 0;
    
    // Calculate learning status and progress trend from actual data
    const learningStatus = calculateLearningStatus(filteredAttempts, filteredSessions) || "No Data";
    const progressTrendData = calculateProgressTrend(filteredAttempts) || { trend: "No Data", percentage: 0 };
    const progressTrend = progressTrendData.trend;
    const progressPercentage = progressTrendData.percentage;
    
    // Calculate next review data from schedule service with null checks
    const nextReviewData = await calculateNextReviewData();
    const nextReviewTime = nextReviewData?.nextReviewTime || "Schedule unavailable";
    const nextReviewCount = nextReviewData?.nextReviewCount || 0;

    // Get real hint analytics data directly from HintInteractionService
    let hintsUsed = { total: 0, contextual: 0, general: 0, primer: 0 };
    try {
      logger.info("Getting hint analytics directly from service", { context: 'dashboard_hints' });
      
      const analytics = await HintInteractionService.getSystemAnalytics({});
      
      // Transform analytics data to match expected UI structure
      hintsUsed.total = analytics.overview?.totalInteractions || 0;
      
      // Extract hint type counts from analytics
      if (analytics.trends?.hintTypePopularity) {
        analytics.trends.hintTypePopularity.forEach(hint => {
          if (hintsUsed[hint.hintType] !== undefined) {
            hintsUsed[hint.hintType] = hint.count;
          }
        });
      }
      
      logger.info("Successfully retrieved hint analytics", { hintsUsed, context: 'dashboard_hints' });
    } catch (error) {
      logger.error("Failed to get hint analytics", { error, context: 'dashboard_hints' });
      // Keep fallback values
    }

    // Calculate time accuracy (how close user estimates are to actual time)
    const timeAccuracy = Math.floor(75 + Math.random() * 20); // 75-95% accuracy - TODO: implement real calculation

    // Create the return object with flattened structure for component compatibility
    const dashboardData = {
      // Flattened statistics properties for Overview/Stats component
      statistics,
      averageTime,
      successRate,
      allSessions: filteredSessions,
      hintsUsed,
      timeAccuracy,
      learningEfficiencyData,
      
      // Flattened progress properties for Progress component
      boxLevelData: boxLevelData || {},
      timerBehavior,
      timerPercentage,
      learningStatus,
      progressTrend,
      progressPercentage,
      nextReviewTime,
      nextReviewCount,
      allAttempts: filteredAttempts || [],
      allProblems: filteredProblems || [],
      learningState: learningState || {},
      
      // Keep nested structure for components that might still need it
      nested: {
        statistics: { 
          statistics, 
          averageTime, 
          successRate, 
          allSessions: filteredSessions,
          learningEfficiencyData
        },
        progress: {
          learningState: learningState || {},
          boxLevelData: boxLevelData || {},
          allAttempts: filteredAttempts || [],
          allProblems: filteredProblems || [],
          allSessions: filteredSessions || [],
          timerBehavior,
          timerPercentage,
          learningStatus,
          progressTrend,
          progressPercentage,
          nextReviewTime,
          nextReviewCount,
        }
      },
      
      // Keep existing sections for other components
      sessions: sessionAnalytics,
      mastery: masteryData,
      goals: goalsData,
      filters: {
        focusAreaFilter,
        dateRange,
        appliedFilters: {
          hasFocusAreaFilter: focusAreaFilter && focusAreaFilter.length > 0,
          hasDateFilter: Boolean(dateRange && (dateRange.startDate || dateRange.endDate)),
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

    // Debug logging to verify data structure
    logger.info("Dashboard Service - Data Structure Verification", { context: 'data_verification' });
    logger.info("Data verification", { totalProblems: allProblems.length, context: 'data_verification' });
    logger.info("Data verification", { totalAttempts: allAttempts.length, context: 'data_verification' });
    logger.info("Data verification", { boxLevelData, context: 'data_verification' });
    logger.info("Data verification", { timerBehavior, context: 'data_verification' });
    logger.info("Data verification", { statistics, context: 'data_verification' });
    logger.info("- Flattened Structure Keys:", Object.keys(dashboardData));
    
    return dashboardData;
  } catch (error) {
    logger.error("Error calculating dashboard statistics:", error);
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
    logger.error("Error calculating focus area analytics:", error);
    throw error;
  }
}

function calculateFocusAreaPerformance(focusAreas, attempts, allProblems, problemTagsMap, standardProblemsMap) {
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

function calculateFocusAreaProgress(focusAreas, _sessions, attempts, _allProblems, problemTagsMap, learningState) {
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

function calculateFocusAreaEffectiveness(focusAreas, performance, progressTracking, learningState) {
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

/**
 * Generate session analytics data structure matching mock service format
 */
export function generateSessionAnalytics(sessions, attempts) {
  const enhancedSessions = sessions.map((session, index) => {
    // Calculate session metrics from attempts
    const sessionAttempts = attempts.filter(attempt => 
      attempt.SessionID === session.sessionId || 
      (session.Date && Math.abs(new Date(session.Date) - new Date(attempt.AttemptDate)) < 60 * 60 * 1000) // Within 1 hour
    );

    const duration = session.duration || 
      (sessionAttempts.length > 0 ? sessionAttempts.reduce((sum, a) => sum + (Number(a.TimeSpent) || 0), 0) / 60 : 30); // Convert to minutes
    
    const accuracy = sessionAttempts.length > 0 ? 
      sessionAttempts.filter(a => a.Success).length / sessionAttempts.length : 
      0.7; // Default accuracy

    const completed = session.completed !== undefined ? session.completed : true;

    return {
      ...session,
      sessionId: session.sessionId || `session_${index + 1}`,
      duration: Math.round(duration),
      accuracy: Math.round(accuracy * 100) / 100,
      completed,
      problems: session.problems || sessionAttempts.map(attempt => ({
        id: attempt.ProblemID,
        difficulty: "Medium", // Would need to look up from standard problems
        solved: attempt.Success
      }))
    };
  });

  const sessionAnalytics = enhancedSessions.map(session => ({
    sessionId: session.sessionId,
    completedAt: session.Date || new Date().toISOString(),
    accuracy: session.accuracy,
    avgTime: session.duration,
    totalProblems: session.problems?.length || 0,
    difficulty: session.problems?.reduce((acc, p) => {
      acc[p.difficulty] = (acc[p.difficulty] || 0) + 1;
      return acc;
    }, {}) || {},
    insights: [
      session.accuracy > 0.8 ? "Great accuracy this session!" : "Focus on accuracy improvement",
      session.duration > 45 ? "Long focused session - excellent!" : "Consider longer practice sessions"
    ]
  }));

  const completedSessions = enhancedSessions.filter(s => s.completed);
  const averageSessionLength = completedSessions.length > 0 ? 
    Math.round(completedSessions.reduce((acc, s) => acc + s.duration, 0) / completedSessions.length) : 
    0;

  const productivityMetrics = {
    averageSessionLength,
    completionRate: enhancedSessions.length > 0 ? 
      Math.round((completedSessions.length / enhancedSessions.length) * 100) : 
      0,
    streakDays: calculateStreakDays(enhancedSessions),
    bestPerformanceHour: findBestPerformanceHour(enhancedSessions)
  };

  return {
    allSessions: enhancedSessions,
    recentSessions: enhancedSessions.slice(-10),
    sessionAnalytics,
    productivityMetrics
  };
}

/**
 * Generate enhanced mastery data with focus areas integration
 */
export async function generateMasteryData(learningState) {
  try {
    const settings = await StorageService.getSettings();
    const focusTags = settings.focusAreas || [];

    // Enhance mastery data with focus area information
    const enhancedMasteryData = (learningState.masteryData || []).map(mastery => ({
      ...mastery,
      isFocus: focusTags.includes(mastery.tag),
      progress: mastery.totalAttempts > 0 ? 
        Math.round((mastery.successfulAttempts / mastery.totalAttempts) * 100) : 
        0,
      hintHelpfulness: mastery.successfulAttempts / mastery.totalAttempts > 0.8 ? "low" :
                      mastery.successfulAttempts / mastery.totalAttempts > 0.5 ? "medium" : "high"
    }));

    return {
      currentTier: learningState.currentTier || "Core Concept",
      masteredTags: learningState.masteredTags || [],
      allTagsInCurrentTier: learningState.allTagsInCurrentTier || [],
      focusTags,
      tagsinTier: learningState.tagsinTier || [],
      unmasteredTags: learningState.unmasteredTags || [],
      masteryData: enhancedMasteryData,
      learningState: {
        ...learningState,
        focusTags,
        masteryData: enhancedMasteryData
      }
    };
  } catch (error) {
    logger.error("Error generating mastery data:", error);
    return {
      currentTier: "Core Concept",
      masteredTags: [],
      allTagsInCurrentTier: [],
      focusTags: [],
      tagsinTier: [],
      unmasteredTags: [],
      masteryData: [],
      learningState: {}
    };
  }
}

/**
 * Calculate outcome trends metrics for Goals page
 */
async function calculateOutcomeTrends(attempts, sessions) {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  // Weekly Accuracy Target
  const weeklyAttempts = attempts.filter(attempt => 
    new Date(attempt.AttemptDate) >= oneWeekAgo
  );
  const weeklyAccuracy = weeklyAttempts.length > 0 
    ? Math.round((weeklyAttempts.filter(a => a.Success).length / weeklyAttempts.length) * 100)
    : 0;
  
  // Problems Per Week
  const weeklyProblems = new Set(weeklyAttempts.map(a => a.ProblemID)).size;
  
  // Hint Efficiency - use real analytics data via background script
  let hintEfficiency = "2.5";
  try {
    // Get real hint analytics data with date filtering
    const hintAnalyticsData = await HintInteractionService.getSystemAnalytics({
      startDate: oneWeekAgo.toISOString(),
      endDate: now.toISOString()
    });
    
    if (hintAnalyticsData?.analytics?.overview?.totalInteractions && weeklyAttempts.length > 0) {
      // Use real hint interaction data
      const weeklyHints = hintAnalyticsData.analytics.overview.totalInteractions;
      const hintsPerProblem = weeklyHints / weeklyAttempts.length;
      hintEfficiency = hintsPerProblem.toFixed(1);
    } else if (hintAnalyticsData?.hintsUsed?.total && weeklyAttempts.length > 0) {
      // Fallback to hintsUsed total if analytics structure is different
      const hintsPerProblem = hintAnalyticsData.hintsUsed.total / weeklyAttempts.length;
      hintEfficiency = hintsPerProblem.toFixed(1);
    } else {
      // If no real hint data available, estimate based on success patterns
      const successRate = weeklyAccuracy / 100;
      const estimatedHints = successRate > 0.8 ? 1.5 : successRate > 0.6 ? 2.0 : 3.0;
      hintEfficiency = estimatedHints.toFixed(1);
    }
  } catch (error) {
    logger.warn("Could not get hint analytics for goals page, using fallback estimation:", error);
    // If hint data not available, estimate based on success patterns
    const successRate = weeklyAccuracy / 100;
    const estimatedHints = successRate > 0.8 ? 1.5 : successRate > 0.6 ? 2.0 : 3.0;
    hintEfficiency = estimatedHints.toFixed(1);
  }
  
  // Learning Velocity - based on recent trend
  const progressTrendData = calculateProgressTrend(attempts);
  let learningVelocity = "Steady";
  if (progressTrendData.trend.includes("Rapidly")) {
    learningVelocity = "Accelerating";
  } else if (progressTrendData.trend.includes("Improving")) {
    learningVelocity = "Progressive";
  } else if (progressTrendData.trend.includes("Declining")) {
    learningVelocity = "Slowing";
  }
  
  // Calculate status indicators
  const weeklyAccuracyStatus = weeklyAccuracy >= 75 ? "excellent" : weeklyAccuracy >= 65 ? "on_track" : "behind";
  const problemsPerWeekStatus = weeklyProblems >= 25 ? "excellent" : weeklyProblems >= 20 ? "on_track" : "behind";
  const hintEfficiencyStatus = parseFloat(hintEfficiency) <= 2.0 ? "excellent" : parseFloat(hintEfficiency) <= 3.0 ? "on_track" : "behind";
  const learningVelocityStatus = learningVelocity === "Accelerating" ? "excellent" : 
                                 learningVelocity === "Progressive" ? "on_track" : 
                                 learningVelocity === "Slowing" ? "behind" : "adaptive";
  
  return {
    weeklyAccuracy: {
      value: weeklyAccuracy,
      status: weeklyAccuracyStatus,
      target: 75
    },
    problemsPerWeek: {
      value: weeklyProblems,
      status: problemsPerWeekStatus,
      target: "25-30",
      display: weeklyProblems.toString()
    },
    hintEfficiency: {
      value: parseFloat(hintEfficiency),
      status: hintEfficiencyStatus,
      display: `<${hintEfficiency} per problem`
    },
    learningVelocity: {
      value: learningVelocity,
      status: learningVelocityStatus
    }
  };
}

/**
 * Generate enhanced daily missions based on user data
 */
function generateEnhancedDailyMissions(settings, learningState, recentAttempts) {
  const missions = [];
  const focusAreas = settings.focusAreas || [];
  
  // Mission 1: Focus area practice
  if (focusAreas.length > 0) {
    const primaryFocus = focusAreas[0];
    const recentFocusAttempts = recentAttempts.filter(attempt => {
      // Would need to check if attempt's problem has this tag
      // For now, use a simplified approach
      return Math.random() > 0.5; // Simulate tag matching
    });
    
    missions.push({
      id: 1,
      title: `Complete 2 ${primaryFocus} problems`,
      progress: recentFocusAttempts.length >= 2 ? 2 : recentFocusAttempts.length,
      target: 2,
      type: "skill",
      completed: recentFocusAttempts.length >= 2
    });
  }
  
  // Mission 2: Review practice based on box levels
  const lowBoxProblems = Math.floor(Math.random() * 5) + 1; // Simulate count
  missions.push({
    id: 2,
    title: "Review 3 problems from lower boxes",
    progress: lowBoxProblems >= 3 ? 3 : lowBoxProblems,
    target: 3,
    type: "review",
    completed: lowBoxProblems >= 3
  });
  
  // Mission 3: Accuracy target based on recent performance
  const recentAccuracy = recentAttempts.length > 0 
    ? Math.round((recentAttempts.filter(a => a.Success).length / recentAttempts.length) * 100)
    : 0;
  
  missions.push({
    id: 3,
    title: "Achieve 80% accuracy today",
    progress: recentAccuracy,
    target: 80,
    type: "performance",
    completed: recentAccuracy >= 80
  });
  
  // Mission 4: Efficiency goal
  missions.push({
    id: 4,
    title: "Complete session without excessive hints",
    progress: Math.random() > 0.5 ? 1 : 0, // Simulate progress
    target: 1,
    type: "efficiency",
    completed: Math.random() > 0.5
  });
  
  return missions;
}

/**
 * Generate goals/learning plan data structure with enhanced metrics
 */
export async function generateGoalsData(providedData = {}) {
  try {
    // Get consistent focus areas from background script (no direct service calls)
    const initialFocusAreas = getInitialFocusAreas(providedData.focusAreas);
    
    // Use provided data or fallbacks - no direct service calls
    const settings = providedData.settings || {
      sessionsPerWeek: 5,
      sessionLength: 4,
      focusAreas: initialFocusAreas,
      difficultyDistribution: { easy: 20, medium: 60, hard: 20 },
      reviewRatio: 40,
      numberofNewProblemsPerSession: 4
    };
    
    const allAttempts = providedData.allAttempts || [];
    const allSessions = providedData.allSessions || [];
    const learningState = providedData.learningState || null;
    
    // Calculate outcome trends from provided data
    const outcomeTrends = allAttempts.length > 0 && allSessions.length > 0 
      ? await calculateOutcomeTrends(allAttempts, allSessions)
      : {
          weeklyAccuracy: { value: 0, status: "behind", target: 75 },
          problemsPerWeek: { value: 0, status: "behind", target: "25-30", display: "0" },
          hintEfficiency: { value: 0, status: "behind", display: "<0 per problem" },
          learningVelocity: { value: "Steady", status: "adaptive" }
        };
    
    // Get recent attempts for mission generation (last 24 hours)
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentAttempts = allAttempts.filter(attempt => 
      new Date(attempt.AttemptDate) >= oneDayAgo
    );
    
    // Generate enhanced missions
    const enhancedMissions = generateEnhancedDailyMissions(settings, learningState, recentAttempts);
    
    return {
      learningPlan: {
        cadence: {
          sessionsPerWeek: settings.sessionsPerWeek || 5,
          sessionLength: settings.sessionLength || 4, // Match session generation default
          flexibleSchedule: settings.flexibleSchedule !== false
        },
        focus: {
          primaryTags: settings.focusAreas || ["array"], // Match session generation fallback
          userFocusAreas: providedData.userFocusAreas || [], // User-selected focus areas
          systemFocusTags: providedData.systemFocusTags || [], // System-recommended focus tags
          activeFocusTags: providedData.focusDecision?.activeFocusTags || (settings.focusAreas || ["array"]), // What sessions actually use
          algorithmReasoning: providedData.focusDecision?.algorithmReasoning || null, // Why algorithm made its decision
          onboarding: providedData.focusDecision?.onboarding || false, // Whether user is in onboarding
          performanceLevel: providedData.focusDecision?.performanceLevel || null, // Current performance level
          difficultyDistribution: settings.difficultyDistribution || { easy: 20, medium: 60, hard: 20 },
          reviewRatio: settings.reviewRatio || 40
        },
        guardrails: {
          minReviewRatio: 30,
          maxNewProblems: settings.numberofNewProblemsPerSession || 4, // Match session generation default
          difficultyCapEnabled: true,
          maxDifficulty: "Medium",
          hintLimitEnabled: false,
          maxHintsPerProblem: 3
        },
        missions: enhancedMissions,
        outcomeTrends
      }
    };
  } catch (error) {
    logger.error("Error generating goals data:", error);
    return {
      learningPlan: {
        cadence: { sessionsPerWeek: 5, sessionLength: 45, flexibleSchedule: true },
        focus: { primaryTags: [], difficultyDistribution: { easy: 20, medium: 60, hard: 20 }, reviewRatio: 40 },
        guardrails: { minReviewRatio: 30, maxNewProblems: 5, difficultyCapEnabled: true, maxDifficulty: "Medium", hintLimitEnabled: false, maxHintsPerProblem: 3 },
        missions: [],
        outcomeTrends: {
          weeklyAccuracy: { value: 0, status: "behind", target: 75 },
          problemsPerWeek: { value: 0, status: "behind", target: "25-30", display: "0" },
          hintEfficiency: { value: 0, status: "behind", display: "<0 per problem" },
          learningVelocity: { value: "Steady", status: "adaptive" }
        }
      }
    };
  }
}

/**
 * Calculate current streak days from session history
 */
function calculateStreakDays(sessions) {
  if (sessions.length === 0) return 0;
  
  const sortedSessions = sessions
    .filter(s => s.completed)
    .sort((a, b) => new Date(b.Date) - new Date(a.Date));
  
  if (sortedSessions.length === 0) return 0;
  
  let streak = 0;
  let currentDate = new Date();
  
  for (const session of sortedSessions) {
    const sessionDate = new Date(session.Date);
    const daysDiff = Math.floor((currentDate - sessionDate) / (1000 * 60 * 60 * 24));
    
    if (daysDiff <= streak + 1) {
      if (daysDiff === streak) {
        streak++;
        currentDate = sessionDate;
      }
    } else {
      break;
    }
  }
  
  return streak;
}

/**
 * Find best performance hour from session history
 */
function findBestPerformanceHour(sessions) {
  const hourlyPerformance = {};
  
  sessions.forEach(session => {
    if (session.Date) {
      const hour = new Date(session.Date).getHours();
      const hourKey = `${hour.toString().padStart(2, '0')}:00`;
      
      if (!hourlyPerformance[hourKey]) {
        hourlyPerformance[hourKey] = { total: 0, accuracy: 0 };
      }
      
      hourlyPerformance[hourKey].total++;
      hourlyPerformance[hourKey].accuracy += session.accuracy || 0;
    }
  });
  
  let bestHour = "14:00";
  let bestScore = 0;
  
  Object.entries(hourlyPerformance).forEach(([hour, data]) => {
    const avgAccuracy = data.accuracy / data.total;
    const score = avgAccuracy * Math.min(data.total, 5); // Weight by frequency but cap at 5
    
    if (score > bestScore) {
      bestScore = score;
      bestHour = hour;
    }
  });
  
  return bestHour;
}

/**
 * Generate daily missions based on user settings
 */
function generateDailyMissions(settings) {
  const focusAreas = settings.focusAreas || [];
  const missions = [];
  
  if (focusAreas.length > 0) {
    missions.push({
      id: 1,
      title: `Complete 2 ${focusAreas[0]} problems`,
      progress: 0,
      target: 2,
      type: "skill",
      completed: false
    });
  }
  
  missions.push(
    {
      id: 2,
      title: "Review 3 problems from lower boxes",
      progress: 0,
      target: 3,
      type: "review",
      completed: false
    },
    {
      id: 3,
      title: "Achieve 80% accuracy today",
      progress: 0,
      target: 80,
      type: "performance",
      completed: false
    },
    {
      id: 4,
      title: "Complete session without hints",
      progress: 0,
      target: 1,
      type: "efficiency",
      completed: false
    }
  );
  
  return missions;
}

/**
 * Generate learning efficiency chart data for different time periods
 * Learning efficiency = problems solved per hint used over time
 */
async function generateLearningEfficiencyChartData(sessions, attempts) {
  // Group sessions by time periods
  const now = new Date();
  const weekly = [];
  const monthly = [];
  const yearly = [];

  // Generate weekly data (last 12 weeks)
  for (let i = 11; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - (i * 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const weekSessions = sessions.filter(session => {
      const sessionDate = new Date(session.Date || session.createdAt);
      return sessionDate >= weekStart && sessionDate <= weekEnd;
    });

    const efficiency = await calculatePeriodEfficiency(weekSessions, attempts);
    weekly.push({
      name: `Week ${12 - i}`,
      efficiency: Math.round(efficiency * 10) / 10
    });
  }

  // Generate monthly data (last 12 months) 
  for (let i = 11; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    
    const monthSessions = sessions.filter(session => {
      const sessionDate = new Date(session.Date || session.createdAt);
      return sessionDate >= monthStart && sessionDate <= monthEnd;
    });

    const efficiency = await calculatePeriodEfficiency(monthSessions, attempts);
    const monthName = monthStart.toLocaleDateString('en-US', { month: 'short' });
    monthly.push({
      name: monthName,
      efficiency: Math.round(efficiency * 10) / 10
    });
  }

  // Generate yearly data (last 3 years)
  for (let i = 2; i >= 0; i--) {
    const year = now.getFullYear() - i;
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);
    
    const yearSessions = sessions.filter(session => {
      const sessionDate = new Date(session.Date || session.createdAt);
      return sessionDate >= yearStart && sessionDate <= yearEnd;
    });

    const efficiency = await calculatePeriodEfficiency(yearSessions, attempts);
    yearly.push({
      name: year.toString(),
      efficiency: Math.round(efficiency * 10) / 10
    });
  }

  return { weekly, monthly, yearly };
}

/**
 * Calculate learning efficiency for a period
 * Efficiency = successful problems / total hints used
 */
async function calculatePeriodEfficiency(sessions, allAttempts) {
  if (sessions.length === 0) return 0;

  // Get session IDs for this period
  const sessionIds = new Set(sessions.map(s => s.sessionId || s.SessionID));
  
  // Find attempts from these sessions
  const periodAttempts = allAttempts.filter(attempt => 
    sessionIds.has(attempt.SessionID) || sessionIds.has(attempt.sessionId)
  );

  if (periodAttempts.length === 0) return 0;

  // Count successful problems
  const successfulProblems = periodAttempts.filter(attempt => attempt.Success).length;
  
  // Try to get actual hint usage data from hint_interactions table
  let totalHintsUsed = 0;
  try {
    // Use static import for hint functions
    
    // Get hint interactions for all sessions in this period
    const hintPromises = Array.from(sessionIds).map(sessionId => 
      getInteractionsBySession(sessionId).catch(() => [])
    );
    const hintResults = await Promise.all(hintPromises);
    
    // Count total hints used across all sessions
    totalHintsUsed = hintResults.flat().length;
  } catch (error) {
    // If hint data is not available, fall back to estimation
    logger.warn("Could not fetch hint data, using estimation:", error);
    totalHintsUsed = 0;
  }
  
  // If no actual hint data available, estimate based on attempts and success patterns
  if (totalHintsUsed === 0) {
    const totalAttempts = periodAttempts.length;
    const failedAttempts = totalAttempts - successfulProblems;
    
    // Estimation: 1 hint per successful problem on first try, 2-3 hints per failed attempt
    totalHintsUsed = successfulProblems * 1.0 + failedAttempts * 2.5;
  }
  
  // Return efficiency (problems per hint), with minimum value to avoid division issues
  return totalHintsUsed > 0 ? successfulProblems / totalHintsUsed : 0;
}

/**
 * Calculate timer behavior based on actual session timing performance
 */
function calculateTimerBehavior(attempts) {
  if (!attempts || attempts.length === 0) return "No data";
  
  const recentAttempts = attempts.slice(-50); // Last 50 attempts for current behavior
  const timelyAttempts = recentAttempts.filter(attempt => {
    // Consider an attempt timely if it was successful and not overly long
    return attempt.Success && attempt.TimeSpent && attempt.TimeSpent < 3600; // Under 1 hour (TimeSpent is in seconds)
  });
  
  const timelyPercentage = (timelyAttempts.length / recentAttempts.length) * 100;
  
  if (timelyPercentage >= 85) return "Excellent timing";
  if (timelyPercentage >= 70) return "On time";
  if (timelyPercentage >= 50) return "Improving pace";
  return "Learning timing";
}

/**
 * Calculate learning status based on recent activity patterns
 */
function calculateLearningStatus(attempts, sessions) {
  if (!attempts || attempts.length === 0) return "No Data";
  
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  // Check for recent attempts in last 7 days
  const recentAttempts = attempts.filter(attempt => 
    new Date(attempt.AttemptDate) >= sevenDaysAgo
  );
  
  // Check for recent sessions in last 7 days
  const recentSessions = sessions.filter(session => 
    new Date(session.Date) >= sevenDaysAgo
  );
  
  // Check for any activity in last 30 days
  const monthlyAttempts = attempts.filter(attempt => 
    new Date(attempt.AttemptDate) >= thirtyDaysAgo
  );
  
  // Determine status based on activity patterns
  if (recentAttempts.length >= 3 || recentSessions.length >= 1) {
    return "Active Learning";
  } else if (monthlyAttempts.length >= 2) {
    return "Intermittent Learning";
  } else if (attempts.length > 0) {
    return "Inactive";
  } else {
    return "Getting Started";
  }
}

/**
 * Calculate progress trend based on recent performance improvement
 */
function calculateProgressTrend(attempts) {
  if (!attempts || attempts.length < 10) {
    return { trend: "Insufficient Data", percentage: 0 };
  }
  
  // Sort attempts by date
  const sortedAttempts = attempts.sort((a, b) => new Date(a.AttemptDate) - new Date(b.AttemptDate));
  
  // Take last 40 attempts for comparison, split into two halves
  const recentAttempts = sortedAttempts.slice(-40);
  const midpoint = Math.floor(recentAttempts.length / 2);
  const olderHalf = recentAttempts.slice(0, midpoint);
  const newerHalf = recentAttempts.slice(midpoint);
  
  if (olderHalf.length === 0 || newerHalf.length === 0) {
    return { trend: "Insufficient Data", percentage: 0 };
  }
  
  // Calculate success rates for both halves
  const olderSuccessRate = olderHalf.filter(a => a.Success).length / olderHalf.length;
  const newerSuccessRate = newerHalf.filter(a => a.Success).length / newerHalf.length;
  
  // Calculate improvement
  const improvement = newerSuccessRate - olderSuccessRate;
  
  // Determine trend
  let trend = "Stable";
  if (improvement > 0.15) {
    trend = "Rapidly Improving";
  } else if (improvement > 0.05) {
    trend = "Improving";
  } else if (improvement < -0.15) {
    trend = "Declining";
  } else if (improvement < -0.05) {
    trend = "Slightly Declining";
  }
  
  // Calculate percentage based on current success rate (newer half)
  const percentage = Math.round(newerSuccessRate * 100);
  
  return { trend, percentage };
}

/**
 * Calculate percentage of attempts completed within reasonable time limits
 */
function calculateTimerPercentage(attempts) {
  if (!attempts || attempts.length === 0) return 0;
  
  const recentAttempts = attempts.slice(-100); // Last 100 attempts
  const withinLimits = recentAttempts.filter(attempt => {
    if (!attempt.TimeSpent) return false;
    // Define reasonable time limits: Easy <20min, Medium <45min, Hard <90min
    // TimeSpent is in seconds, so multiply minutes by 60
    const timeLimit = attempt.Difficulty === "Easy" ? 1200 : 
                     attempt.Difficulty === "Hard" ? 5400 : 2700;
    return attempt.TimeSpent <= timeLimit;
  });
  
  return Math.round((withinLimits.length / recentAttempts.length) * 100);
}

/**
 * Calculate next review time and count using direct SessionService access
 * Runs directly in background context so no Chrome messaging needed
 */
async function calculateNextReviewData() {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      // Direct database access to avoid circular dependency with SessionService
      const session = await getLatestSession();
      
      // Process session data
      if (!session) {
        logger.info('📊 No active session found');
        return {
          nextReviewTime: "No active session", 
          nextReviewCount: 0
        };
      }
      logger.info('📊 Dashboard received session object:', session);
      
      // Handle null session explicitly
      if (session === null || session === undefined) {
        logger.info('📊 Session is null or undefined');
        return {
          nextReviewTime: "No session available",
          nextReviewCount: 0
        };
      }
      
      // Validate session object structure with better error reporting
      if (typeof session !== 'object') {
        logger.warn('❌ Session is not an object:', {
          sessionType: typeof session,
          sessionValue: session
        });
        return {
          nextReviewTime: "Invalid session type",
          nextReviewCount: 0
        };
      }

          // Handle both session.problems array and session.problemCount formats
          let totalProblems = 0;
          let currentIndex = session.currentProblemIndex || 0;
          
          if (Array.isArray(session.problems)) {
            totalProblems = session.problems.length;
          } else if (typeof session.problemCount === 'number') {
            totalProblems = session.problemCount;
          } else {
            logger.warn('❌ Session has neither problems array nor problemCount:', {
              hasProblems: 'problems' in session,
              problemsType: typeof session.problems,
              hasProblemCount: 'problemCount' in session,
              problemCountType: typeof session.problemCount,
              sessionKeys: Object.keys(session)
            });
            return {
              nextReviewTime: "Session missing problem data",
              nextReviewCount: 0
            };
          }
          
          const problemsRemaining = totalProblems - currentIndex;
          logger.info('📊 Session analysis:', {
            totalProblems,
            currentIndex,
            problemsRemaining,
            sessionId: session.id,
            sessionStatus: session.status,
            hasProblemsArray: Array.isArray(session.problems),
            sessionProblemCount: session.problemCount
          });
          
          // Format next review time based on session state
          const now = new Date();
          const nextReview = new Date();
          
          // If problems are remaining in current session, show immediate availability
          if (problemsRemaining > 0) {
            nextReview.setMinutes(nextReview.getMinutes() + 5); // Show 5 minutes from now
          } else {
            // Schedule for later today or tomorrow based on current time
            const currentHour = now.getHours();
            if (currentHour >= 20) {
              // After 8 PM, schedule for tomorrow morning
              nextReview.setDate(nextReview.getDate() + 1);
              nextReview.setHours(9, 0, 0, 0);
            } else if (currentHour < 9) {
              // Before 9 AM, schedule for later today
              nextReview.setHours(14, 0, 0, 0);
            } else {
              // During the day, schedule for later today
              nextReview.setHours(currentHour + 2, 0, 0, 0);
            }
          }
          
          const formatTime = (date) => {
            const isToday = date.toDateString() === now.toDateString();
            const timeStr = date.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit', 
              hour12: true 
            });
            
            if (isToday) {
              return `Today • ${timeStr}`;
            }
            
            const dayStr = date.toLocaleDateString('en-US', { weekday: 'short' });
            return `${dayStr} • ${timeStr}`;
          };
          
        return {
          nextReviewTime: formatTime(nextReview),
          nextReviewCount: Math.max(problemsRemaining, 0)
        };
        
    } else {
      // No Chrome extension API available (development mode)
      return {
        nextReviewTime: "Development mode",
        nextReviewCount: 0
      };
    }
  } catch (error) {
    logger.error('Error in calculateNextReviewData:', error);
    return {
      nextReviewTime: "Schedule unavailable",
      nextReviewCount: 0
    };
  }
}

/**
 * Page-specific data fetching functions
 * Each function returns only the data needed for a specific page
 */

/**
 * Get data specifically for the Learning Progress page
 */
export async function getLearningProgressData(options = {}) {
  try {
    const fullData = await getDashboardStatistics(options);
    
    return {
      boxLevelData: fullData.boxLevelData,
      timerBehavior: fullData.timerBehavior,
      timerPercentage: fullData.timerPercentage,
      learningStatus: fullData.learningStatus,
      progressTrend: fullData.progressTrend,
      progressPercentage: fullData.progressPercentage,
      nextReviewTime: fullData.nextReviewTime,
      nextReviewCount: fullData.nextReviewCount,
      allAttempts: fullData.allAttempts,
      allProblems: fullData.allProblems,
      allSessions: fullData.allSessions,
      learningState: fullData.learningState,
      strategySuccessRate: fullData.strategySuccessRate,
      promotionData: fullData.nested?.progress?.promotionData,
    };
  } catch (error) {
    logger.error("Error getting learning progress data:", error);
    throw error;
  }
}

/**
 * Get data specifically for the Goals page
 * Can accept providedData to avoid direct service calls
 */
export async function getGoalsData(options = {}, providedData = null) {
  try {
    if (providedData) {
      // Use provided data directly
      return await generateGoalsData(providedData);
    } else {
      // Fallback: try existing method but catch errors gracefully
      try {
        const fullData = await getDashboardStatistics(options);
        return fullData.goals || await generateGoalsData();
      } catch (error) {
        // If getDashboardStatistics fails, use fallback
        logger.warn("getDashboardStatistics failed, using fallback goals data");
        return await generateGoalsData();
      }
    }
  } catch (error) {
    logger.error("Error getting goals data:", error);
    // Return fallback goals data instead of throwing
    return {
      learningPlan: {
        cadence: { sessionsPerWeek: 5, sessionLength: 4, flexibleSchedule: true },
        focus: { primaryTags: ["array"], difficultyDistribution: { easy: 20, medium: 60, hard: 20 }, reviewRatio: 40 },
        guardrails: { minReviewRatio: 30, maxNewProblems: 4, difficultyCapEnabled: true, maxDifficulty: "Medium", hintLimitEnabled: false, maxHintsPerProblem: 3 },
        missions: [],
        outcomeTrends: {
          weeklyAccuracy: { value: 0, status: "behind", target: 75 },
          problemsPerWeek: { value: 0, status: "behind", target: "25-30", display: "0" },
          hintEfficiency: { value: 0, status: "behind", display: "<0 per problem" },
          learningVelocity: { value: "Steady", status: "adaptive" }
        }
      }
    };
  }
}

// Default dashboard statistics (similar to content script fallback pattern)
const DEFAULT_STATS = {
  statistics: { totalSolved: 0, mastered: 0, inProgress: 0, new: 0 },
  averageTime: { overall: 0, Easy: 0, Medium: 0, Hard: 0, timeAccuracy: 0 },
  successRate: { overall: 0, Easy: 0, Medium: 0, Hard: 0 },
  allSessions: [],
  hintsUsed: { total: 0, contextual: 0, general: 0, primer: 0 },
  timeAccuracy: 0,
  learningEfficiencyData: { weekly: [], monthly: [], yearly: [] }
};

/**
 * Get data specifically for the Stats/Overview page with fallback
 */
export async function getStatsData(options = {}) {
  try {
    const fullData = await getDashboardStatistics(options);
    
    return {
      statistics: fullData.statistics || DEFAULT_STATS.statistics,
      averageTime: fullData.averageTime || DEFAULT_STATS.averageTime,
      successRate: fullData.successRate || DEFAULT_STATS.successRate,
      allSessions: fullData.allSessions || DEFAULT_STATS.allSessions,
      hintsUsed: fullData.hintsUsed || DEFAULT_STATS.hintsUsed,
      timeAccuracy: fullData.timeAccuracy || DEFAULT_STATS.timeAccuracy,
      learningEfficiencyData: fullData.learningEfficiencyData || DEFAULT_STATS.learningEfficiencyData,
    };
  } catch (error) {
    logger.error("Error getting stats data, using fallback:", error);
    // Return fallback data instead of throwing (like content script pattern)
    return DEFAULT_STATS;
  }
}

/**
 * Get data specifically for the Session History page
 */
export async function getSessionHistoryData(options = {}) {
  try {
    const fullData = await getDashboardStatistics(options);
    
    return {
      allSessions: fullData.sessions?.allSessions || [],
      sessionAnalytics: fullData.sessions?.sessionAnalytics || [],
      productivityMetrics: fullData.sessions?.productivityMetrics || {},
      recentSessions: fullData.sessions?.recentSessions || [],
    };
  } catch (error) {
    logger.error("Error getting session history data:", error);
    throw error;
  }
}

/**
 * Get data specifically for the Productivity Insights page
 */
export async function getProductivityInsightsData(options = {}) {
  try {
    const fullData = await getDashboardStatistics(options);
    
    // Calculate reflection data
    const reflectionData = await calculateReflectionInsights(fullData);
    
    return {
      productivityMetrics: fullData.sessions?.productivityMetrics || {},
      sessionAnalytics: fullData.sessions?.sessionAnalytics || [],
      allSessions: fullData.sessions?.allSessions || [],
      learningEfficiencyData: fullData.learningEfficiencyData,
      reflectionData: reflectionData,
    };
  } catch (error) {
    logger.error("Error getting productivity insights data:", error);
    throw error;
  }
}

/**
 * Calculate reflection insights from attempt data
 */
function calculateReflectionInsights(dashboardData) {
  try {
    const allAttempts = dashboardData.attempts || [];
    
    // Count attempts with reflections (non-empty comments field)
    const attemptsWithReflections = allAttempts.filter(attempt => 
      attempt.Comments && attempt.Comments.trim().length > 0
    );
    
    const reflectionsCount = attemptsWithReflections.length;
    const totalAttempts = allAttempts.length;
    const reflectionRate = totalAttempts > 0 ? (reflectionsCount / totalAttempts) * 100 : 0;
    
    // Analyze common themes in reflections
    const commonThemes = analyzeReflectionThemes(attemptsWithReflections);
    
    // Calculate reflection quality metrics
    const avgReflectionLength = reflectionsCount > 0 
      ? attemptsWithReflections.reduce((sum, attempt) => sum + attempt.Comments.length, 0) / reflectionsCount
      : 0;
    
    // Correlation with performance
    const reflectionPerformanceCorrelation = calculateReflectionPerformanceCorrelation(
      attemptsWithReflections, 
      allAttempts
    );
    
    return {
      reflectionsCount,
      totalAttempts,
      reflectionRate: Math.round(reflectionRate * 10) / 10,
      commonThemes: commonThemes.slice(0, 3), // Top 3 themes
      avgReflectionLength: Math.round(avgReflectionLength),
      performanceCorrelation: reflectionPerformanceCorrelation
    };
  } catch (error) {
    logger.error("Error calculating reflection insights:", error);
    return {
      reflectionsCount: 0,
      totalAttempts: 0,
      reflectionRate: 0,
      commonThemes: [],
      avgReflectionLength: 0,
      performanceCorrelation: 0
    };
  }
}

/**
 * Analyze common themes in reflection text
 */
function analyzeReflectionThemes(attemptsWithReflections) {
  const themeKeywords = {
    'time-management': ['time', 'slow', 'fast', 'rushed', 'deadline'],
    'algorithm-understanding': ['algorithm', 'approach', 'logic', 'understand', 'concept'],
    'implementation': ['code', 'syntax', 'bug', 'error', 'implementation'],
    'problem-analysis': ['analysis', 'breakdown', 'edge case', 'constraint', 'requirement'],
    'pattern-recognition': ['pattern', 'similar', 'seen before', 'template', 'approach']
  };
  
  const themeCounts = {};
  
  attemptsWithReflections.forEach(attempt => {
    const reflection = attempt.Comments.toLowerCase();
    
    Object.entries(themeKeywords).forEach(([theme, keywords]) => {
      const hasTheme = keywords.some(keyword => reflection.includes(keyword));
      if (hasTheme) {
        themeCounts[theme] = (themeCounts[theme] || 0) + 1;
      }
    });
  });
  
  return Object.entries(themeCounts)
    .sort(([,a], [,b]) => b - a)
    .map(([theme, count]) => ({
      theme: theme.replace('-', ' '),
      count,
      percentage: Math.round((count / attemptsWithReflections.length) * 100)
    }));
}

/**
 * Calculate correlation between reflection practice and performance
 */
function calculateReflectionPerformanceCorrelation(attemptsWithReflections, allAttempts) {
  if (attemptsWithReflections.length === 0) return 0;
  
  const reflectionSuccessRate = attemptsWithReflections.filter(a => a.Success).length / attemptsWithReflections.length;
  const overallSuccessRate = allAttempts.filter(a => a.Success).length / allAttempts.length;
  
  return Math.round((reflectionSuccessRate - overallSuccessRate) * 100);
}

/**
 * Get data specifically for the Tag Mastery page
 */
export async function getTagMasteryData(options = {}) {
  try {
    const fullData = await getDashboardStatistics(options);
    
    return fullData.mastery || {
      currentTier: "Core Concept",
      masteredTags: [],
      allTagsInCurrentTier: [],
      focusTags: [],
      tagsinTier: [],
      unmasteredTags: [],
      masteryData: [],
      learningState: {}
    };
  } catch (error) {
    logger.error("Error getting tag mastery data:", error);
    throw error;
  }
}

/**
 * Get data specifically for the Learning Path page
 */
export async function getLearningPathData(options = {}) {
  try {
    const fullData = await getDashboardStatistics(options);
    
    return fullData.mastery || {
      currentTier: "Core Concept",
      masteredTags: [],
      allTagsInCurrentTier: [],
      focusTags: [],
      tagsinTier: [],
      unmasteredTags: [],
      masteryData: [],
      learningState: {}
    };
  } catch (error) {
    logger.error("Error getting learning path data:", error);
    throw error;
  }
}

/**
 * Get data specifically for the Mistake Analysis page
 */
export async function getMistakeAnalysisData(options = {}) {
  try {
    const fullData = await getDashboardStatistics(options);
    
    // Mistake analysis needs broader data for pattern analysis
    return {
      allAttempts: fullData.allAttempts,
      allProblems: fullData.allProblems,
      allSessions: fullData.allSessions,
      statistics: fullData.statistics,
      learningState: fullData.learningState,
      mastery: fullData.mastery,
    };
  } catch (error) {
    logger.error("Error getting mistake analysis data:", error);
    throw error;
  }
}

export async function getInterviewAnalyticsData(options = {}) {
  try {
    logger.info("🎯 Getting interview analytics data...");
    
    const allSessions = await getAllSessions();
    const allAttempts = await getAllAttempts();
    
    // Filter for interview sessions
    const interviewSessions = allSessions.filter(session => 
      session.sessionType && session.sessionType !== 'standard'
    );
    
    logger.info(`Found ${interviewSessions.length} interview sessions`);
    
    if (interviewSessions.length === 0) {
      return {
        totalInterviewSessions: 0,
        interviewModeBreakdown: {
          'interview-like': 0,
          'full-interview': 0
        },
        averagePerformance: {
          accuracy: 0,
          timePerProblem: 0,
          completionRate: 0
        },
        progressTrend: [],
        transferMetrics: {
          standardToInterview: 0,
          improvementRate: 0
        },
        recentSessions: [],
        recommendations: [
          "Start with Interview-Like mode to practice with limited hints",
          "Build confidence before moving to Full Interview mode"
        ]
      };
    }

    // Calculate interview session metrics
    const interviewModeBreakdown = {};
    let totalAccuracy = 0;
    let totalTimeSpent = 0;
    let totalProblemsAttempted = 0;
    let totalProblemsCompleted = 0;

    interviewSessions.forEach(session => {
      const mode = session.sessionType || 'interview-like';
      interviewModeBreakdown[mode] = (interviewModeBreakdown[mode] || 0) + 1;

      // Get attempts for this session
      const sessionAttempts = allAttempts.filter(attempt => 
        attempt.sessionId === session.sessionId
      );

      sessionAttempts.forEach(attempt => {
        totalProblemsAttempted++;
        if (attempt.status === 'correct') {
          totalProblemsCompleted++;
          totalAccuracy++;
        }
        if (attempt.timeSpent) {
          totalTimeSpent += attempt.timeSpent;
        }
      });
    });

    // Calculate averages
    const accuracy = totalProblemsAttempted > 0 ? (totalAccuracy / totalProblemsAttempted) * 100 : 0;
    const averageTimePerProblem = totalProblemsAttempted > 0 ? totalTimeSpent / totalProblemsAttempted : 0;
    const completionRate = totalProblemsAttempted > 0 ? (totalProblemsCompleted / totalProblemsAttempted) * 100 : 0;

    // Generate progress trend (last 10 sessions)
    const recentInterviewSessions = interviewSessions
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10);

    const progressTrend = recentInterviewSessions.map(session => {
      const sessionAttempts = allAttempts.filter(attempt => 
        attempt.sessionId === session.sessionId
      );
      
      const sessionAccuracy = sessionAttempts.length > 0 ? 
        (sessionAttempts.filter(a => a.status === 'correct').length / sessionAttempts.length) * 100 : 0;

      return {
        sessionId: session.sessionId,
        date: session.timestamp,
        mode: session.sessionType,
        accuracy: sessionAccuracy,
        problemsAttempted: sessionAttempts.length,
        timeSpent: sessionAttempts.reduce((sum, a) => sum + (a.timeSpent || 0), 0)
      };
    }).reverse(); // Show oldest to newest for trend

    // Calculate transfer metrics (compare interview vs standard performance)
    const standardSessions = allSessions.filter(session => 
      !session.sessionType || session.sessionType === 'standard'
    );
    
    let standardAccuracy = 0;
    if (standardSessions.length > 0) {
      const standardAttempts = allAttempts.filter(attempt =>
        standardSessions.some(session => session.sessionId === attempt.sessionId)
      );
      standardAccuracy = standardAttempts.length > 0 ?
        (standardAttempts.filter(a => a.status === 'correct').length / standardAttempts.length) * 100 : 0;
    }

    const transferScore = standardAccuracy > 0 ? (accuracy / standardAccuracy) : 0;
    
    // Generate recommendations based on performance
    const recommendations = [];
    if (accuracy < 50) {
      recommendations.push("Focus on Interview-Like mode to build confidence with reduced pressure");
    } else if (accuracy < 70) {
      recommendations.push("Good progress! Continue practicing in Interview-Like mode");
    } else {
      recommendations.push("Excellent performance! Ready to try Full Interview mode");
    }

    if (averageTimePerProblem > 1800) { // 30 minutes
      recommendations.push("Work on time management - aim for 20-25 minutes per problem");
    }

    if (transferScore < 0.8) {
      recommendations.push("Practice more standard sessions to strengthen fundamentals");
    }

    return {
      totalInterviewSessions: interviewSessions.length,
      interviewModeBreakdown: {
        'interview-like': interviewModeBreakdown['interview-like'] || 0,
        'full-interview': interviewModeBreakdown['full-interview'] || 0
      },
      averagePerformance: {
        accuracy: Math.round(accuracy * 10) / 10,
        timePerProblem: Math.round(averageTimePerProblem / 60), // Convert to minutes
        completionRate: Math.round(completionRate * 10) / 10
      },
      progressTrend,
      transferMetrics: {
        standardToInterview: Math.round(transferScore * 100) / 100,
        improvementRate: progressTrend.length >= 2 ? 
          Math.round(((progressTrend[progressTrend.length - 1].accuracy - progressTrend[0].accuracy) / progressTrend.length) * 10) / 10 : 0
      },
      recentSessions: recentInterviewSessions.slice(0, 5).map(session => ({
        sessionId: session.sessionId,
        date: session.timestamp,
        mode: session.sessionType,
        problemsAttempted: allAttempts.filter(a => a.sessionId === session.sessionId).length,
        accuracy: allAttempts.filter(a => a.sessionId === session.sessionId && a.status === 'correct').length /
                  Math.max(1, allAttempts.filter(a => a.sessionId === session.sessionId).length) * 100
      })),
      recommendations
    };
    
  } catch (error) {
    logger.error("Error in getInterviewAnalyticsData:", error);
    throw error;
  }
}

/**
 * Get separated analytics for guided vs tracking sessions
 * Provides comprehensive metrics for both session types
 */
export async function getSessionMetrics(options = {}) {
  try {
    const { range = 30 } = options;
    const cutoffDate = new Date(Date.now() - (range * 24 * 60 * 60 * 1000));
    
    const sessions = await getAllSessions();
    const attempts = await getAllAttempts();
    
    // Filter sessions by date range if specified
    const recentSessions = sessions.filter(session => 
      new Date(session.date) >= cutoffDate
    );
    
    // Separate sessions by origin
    const guidedSessions = recentSessions.filter(s => s.origin === 'generator');
    const trackingSessions = recentSessions.filter(s => s.origin === 'tracking');
    
    // Get attempts for each session type
    const guidedSessionIds = new Set(guidedSessions.map(s => s.id));
    const trackingSessionIds = new Set(trackingSessions.map(s => s.id));
    
    const guidedAttempts = attempts.filter(a => guidedSessionIds.has(a.SessionID));
    const trackingAttempts = attempts.filter(a => trackingSessionIds.has(a.SessionID));
    
    // Calculate metrics for guided sessions
    const guidedMetrics = calculateSessionTypeMetrics(guidedSessions, guidedAttempts, 'guided');
    
    // Calculate metrics for tracking sessions  
    const trackingMetrics = calculateSessionTypeMetrics(trackingSessions, trackingAttempts, 'tracking');
    
    // Calculate transfer metrics (tracking → guided adoption)
    const transferMetrics = calculateTransferMetrics(sessions, attempts);
    
    // Calculate session health metrics
    const healthMetrics = await calculateSessionHealthMetrics(sessions);
    
    return {
      guided: guidedMetrics,
      tracking: trackingMetrics,
      transfer: transferMetrics,
      health: healthMetrics,
      overall: {
        totalSessions: recentSessions.length,
        totalAttempts: guidedAttempts.length + trackingAttempts.length,
        avgSessionLength: calculateAverageSessionLength([...guidedSessions, ...trackingSessions]),
        sessionDistribution: {
          guided: Math.round((guidedSessions.length / Math.max(1, recentSessions.length)) * 100),
          tracking: Math.round((trackingSessions.length / Math.max(1, recentSessions.length)) * 100)
        }
      }
    };
    
  } catch (error) {
    logger.error("Error in getSessionMetrics:", error);
    throw error;
  }
}

/**
 * Calculate detailed metrics for a specific session type
 */
function calculateSessionTypeMetrics(sessions, attempts, type) {
  const completedSessions = sessions.filter(s => s.status === 'completed');
  const activeSessions = sessions.filter(s => s.status === 'in_progress');
  const draftSessions = sessions.filter(s => s.status === 'draft');
  
  // Success rate calculation
  const successfulAttempts = attempts.filter(a => a.Success === true || a.Success === 1);
  const successRate = attempts.length > 0 ? 
    Math.round((successfulAttempts.length / attempts.length) * 100) : 0;
  
  // Average session length
  const avgSessionLength = calculateAverageSessionLength(sessions);
  
  // Problems per session
  const avgProblemsPerSession = sessions.length > 0 ?
    Math.round(attempts.length / sessions.length * 10) / 10 : 0;
  
  // Session completion rate (for guided sessions)
  const completionRate = type === 'guided' && sessions.length > 0 ?
    Math.round((completedSessions.length / sessions.length) * 100) : null;
  
  // Time-based metrics
  const totalTimeSpent = attempts.reduce((sum, a) => sum + (a.TimeSpent || 0), 0);
  const avgTimePerProblem = attempts.length > 0 ?
    Math.round(totalTimeSpent / attempts.length) : 0;
  
  return {
    totalSessions: sessions.length,
    sessionsByStatus: {
      completed: completedSessions.length,
      active: activeSessions.length,
      draft: draftSessions.length
    },
    completionRate,
    totalAttempts: attempts.length,
    successRate,
    avgSessionLength,
    avgProblemsPerSession,
    avgTimePerProblem,
    totalTimeSpent: Math.round(totalTimeSpent / 60), // Convert to minutes
    recentActivity: getRecentActivity(sessions, attempts)
  };
}

/**
 * Calculate transfer metrics (tracking → guided session adoption)
 */
function calculateTransferMetrics(sessions, attempts) {
  // Find users who have both tracking and guided sessions
  const hasTracking = sessions.some(s => s.origin === 'tracking');
  const hasGuided = sessions.some(s => s.origin === 'generator');
  
  if (!hasTracking) {
    return {
      hasTrackingActivity: false,
      transferRate: 0,
      generatedFromTracking: 0,
      recommendations: ['Start solving problems independently to unlock personalized guided sessions']
    };
  }
  
  if (!hasGuided) {
    const trackingAttempts = attempts.filter(a => 
      sessions.find(s => s.id === a.SessionID && s.origin === 'tracking')
    );
    
    return {
      hasTrackingActivity: true,
      transferRate: 0,
      trackingAttempts: trackingAttempts.length,
      recommendations: trackingAttempts.length >= 4 ? 
        ['You have enough tracking activity to generate a personalized guided session'] :
        [`Solve ${4 - trackingAttempts.length} more problems independently to unlock guided sessions`]
    };
  }
  
  // Count auto-generated sessions
  const autoGeneratedSessions = sessions.filter(s => 
    s.origin === 'generator' && s.startedBy === 'auto_inferred'
  );
  
  const transferRate = sessions.length > 0 ?
    Math.round((autoGeneratedSessions.length / sessions.length) * 100) : 0;
  
  return {
    hasTrackingActivity: true,
    hasGuidedActivity: true,
    transferRate,
    generatedFromTracking: autoGeneratedSessions.length,
    totalSessions: sessions.length,
    recommendations: transferRate > 0 ?
      ['Great! The system is learning from your independent practice'] :
      ['Try solving more problems independently to improve session personalization']
  };
}

/**
 * Calculate session health metrics using classification system
 */
function calculateSessionHealthMetrics(sessions) {
  try {
    // This would typically call the background script to classify sessions
    // For now, we'll simulate the classification
    const stalledCount = sessions.filter(session => {
      const now = Date.now();
      const lastActivity = new Date(session.lastActivityTime || session.date);
      const hoursStale = (now - lastActivity.getTime()) / (1000 * 60 * 60);
      
      return hoursStale > 24 && session.status !== 'completed';
    }).length;
    
    const healthyCount = sessions.length - stalledCount;
    
    return {
      totalSessions: sessions.length,
      healthyCount,
      stalledCount,
      healthScore: sessions.length > 0 ? 
        Math.round((healthyCount / sessions.length) * 100) : 100,
      needsCleanup: stalledCount > 0
    };
    
  } catch (error) {
    logger.error("Error calculating session health:", error);
    return {
      totalSessions: sessions.length,
      healthyCount: sessions.length,
      stalledCount: 0,
      healthScore: 100,
      needsCleanup: false
    };
  }
}

/**
 * Calculate average session length in problems
 */
function calculateAverageSessionLength(sessions) {
  if (sessions.length === 0) return 0;
  
  const totalProblems = sessions.reduce((sum, session) => 
    sum + (session.problems?.length || 0), 0
  );
  
  return Math.round((totalProblems / sessions.length) * 10) / 10;
}

/**
 * Get recent activity for a session type
 */
function getRecentActivity(sessions, attempts) {
  const last7Days = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
  
  const recentSessions = sessions.filter(s => new Date(s.date) >= last7Days);
  const recentAttempts = attempts.filter(a => new Date(a.date) >= last7Days);
  
  return {
    sessionsLast7Days: recentSessions.length,
    attemptsLast7Days: recentAttempts.length,
    avgDailyActivity: Math.round(recentAttempts.length / 7 * 10) / 10
  };
}

