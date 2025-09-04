/**
 * Helper functions for focus area analytics data transformation
 * Extracted to reduce complexity in getFocusAreaAnalytics
 */

import { StorageService } from "../../shared/services/storageService.js";
import { calculateSuccessRate } from "../../shared/utils/Utils.js";

/**
 * Create problem mappings from standard problems data
 */
export function createProblemMappings(allProblems, allStandardProblems) {
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

  return { standardProblemsMap, problemTagsMap };
}

/**
 * Get target focus areas from options or user settings
 */
export async function getTargetFocusAreas(providedFocusAreas) {
  if (providedFocusAreas) {
    return providedFocusAreas;
  }

  const settings = await StorageService.getSettings();
  return settings.focusAreas || [];
}

/**
 * Filter data by date range if provided
 */
export function filterDataByDateRange(allAttempts, allSessions, startDate, endDate) {
  if (!startDate && !endDate) {
    return { filteredAttempts: allAttempts, filteredSessions: allSessions };
  }

  const start = startDate ? new Date(startDate) : new Date(0);
  const end = endDate ? new Date(endDate) : new Date();

  const filteredAttempts = allAttempts.filter((attempt) => {
    const attemptDate = new Date(attempt.AttemptDate);
    return attemptDate >= start && attemptDate <= end;
  });

  const filteredSessions = allSessions.filter((session) => {
    const sessionDate = new Date(session.Date);
    return sessionDate >= start && sessionDate <= end;
  });

  return { filteredAttempts, filteredSessions };
}

/**
 * Calculate focus area performance metrics
 */
export function calculateFocusAreaPerformance(
  focusAreas, 
  attempts, 
  allProblems, 
  problemTagsMap, 
  standardProblemsMap
) {
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
        recentTrend: "no-data",
        boxLevelDistribution: {},
      };
      continue;
    }

    // Calculate basic metrics
    const totalAttempts = focusAreaAttempts.length;
    const successfulAttempts = focusAreaAttempts.filter(a => a.Success).length;
    const successRate = calculateSuccessRate(successfulAttempts, totalAttempts);
    const averageTime = focusAreaAttempts.reduce((sum, a) => sum + (a.TimeSpent || 0), 0) / totalAttempts;

    // Calculate difficulty breakdown
    const difficultyBreakdown = { Easy: { attempts: 0, successes: 0, avgTime: 0 }, Medium: { attempts: 0, successes: 0, avgTime: 0 }, Hard: { attempts: 0, successes: 0, avgTime: 0 } };
    
    focusAreaAttempts.forEach((attempt) => {
      const standardProblem = standardProblemsMap.get(
        allProblems.find(p => p.id === attempt.ProblemID)?.leetCodeID
      );
      const difficulty = standardProblem?.difficulty || 'Medium';
      
      difficultyBreakdown[difficulty].attempts++;
      if (attempt.Success) difficultyBreakdown[difficulty].successes++;
      difficultyBreakdown[difficulty].avgTime += attempt.TimeSpent || 0;
    });

    // Finalize difficulty breakdown averages
    Object.values(difficultyBreakdown).forEach(diff => {
      if (diff.attempts > 0) {
        diff.avgTime = diff.avgTime / diff.attempts;
      }
    });

    performance[focusArea] = {
      totalAttempts,
      successfulAttempts,
      successRate,
      averageTime,
      difficultyBreakdown,
      recentTrend: calculateRecentTrend(focusAreaAttempts),
      boxLevelDistribution: calculateBoxLevelDistribution(focusAreaAttempts, allProblems),
    };
  }

  return performance;
}

/**
 * Calculate progress tracking data
 */
export function calculateFocusAreaProgress(options) {
  const { focusAreas, attempts, problemTagsMap, learningState } = options;

  const progress = {};
  
  for (const focusArea of focusAreas) {
    const focusAreaAttempts = attempts.filter((attempt) => {
      const problemTags = problemTagsMap.get(attempt.ProblemID) || [];
      return problemTags.includes(focusArea);
    });

    const tagMastery = learningState?.tags?.[focusArea] || {};
    
    progress[focusArea] = {
      masteryLevel: tagMastery.masteryLevel || 'beginner',
      completionPercentage: tagMastery.completionPercentage || 0,
      problemsSolved: focusAreaAttempts.filter(a => a.Success).length,
      streak: tagMastery.currentStreak || 0,
      lastAttempt: focusAreaAttempts.length > 0 ? focusAreaAttempts[focusAreaAttempts.length - 1].AttemptDate : null,
      weeklyProgress: calculateWeeklyProgress(focusAreaAttempts),
      targetProgress: calculateTargetProgress(focusArea, tagMastery),
    };
  }

  return progress;
}

/**
 * Calculate effectiveness analysis
 */
export function calculateFocusAreaEffectiveness(focusAreas, performance, progressTracking, _learningState) {
  const effectiveness = {};

  for (const focusArea of focusAreas) {
    const perf = performance[focusArea];
    const progress = progressTracking[focusArea];
    
    if (!perf || perf.totalAttempts === 0) {
      effectiveness[focusArea] = {
        score: 0,
        trend: 'no-data',
        recommendations: ['No data available for analysis'],
        strengths: [],
        weaknesses: ['Insufficient practice'],
      };
      continue;
    }

    const effectivenessScore = calculateEffectivenessScore(perf, progress);
    
    effectiveness[focusArea] = {
      score: effectivenessScore,
      trend: perf.recentTrend,
      recommendations: generateTagRecommendations(focusArea, perf, progress),
      strengths: identifyStrengths(perf),
      weaknesses: identifyWeaknesses(perf),
    };
  }

  return effectiveness;
}

// Helper functions for calculations
function calculateRecentTrend(attempts) {
  if (attempts.length < 5) return 'insufficient-data';
  
  const recent = attempts.slice(-5);
  const older = attempts.slice(-10, -5);
  
  if (older.length === 0) return 'new';
  
  const recentSuccess = recent.filter(a => a.Success).length / recent.length;
  const olderSuccess = older.filter(a => a.Success).length / older.length;
  
  if (recentSuccess > olderSuccess + 0.1) return 'improving';
  if (recentSuccess < olderSuccess - 0.1) return 'declining';
  return 'stable';
}

function calculateBoxLevelDistribution(attempts, allProblems) {
  const distribution = {};
  
  attempts.forEach(attempt => {
    const problem = allProblems.find(p => p.id === attempt.ProblemID);
    const boxLevel = problem?.BoxLevel || 1;
    distribution[boxLevel] = (distribution[boxLevel] || 0) + 1;
  });
  
  return distribution;
}

function calculateWeeklyProgress(attempts) {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentAttempts = attempts.filter(a => new Date(a.AttemptDate) >= oneWeekAgo);
  
  return {
    attempts: recentAttempts.length,
    successes: recentAttempts.filter(a => a.Success).length,
    averageTime: recentAttempts.length > 0 
      ? recentAttempts.reduce((sum, a) => sum + (a.TimeSpent || 0), 0) / recentAttempts.length 
      : 0,
  };
}

function calculateTargetProgress(focusArea, tagMastery) {
  const target = tagMastery.targetProblems || 20;
  const current = tagMastery.solvedProblems || 0;
  
  return {
    current,
    target,
    percentage: target > 0 ? (current / target) * 100 : 0,
  };
}

function calculateEffectivenessScore(performance, progress) {
  let score = 0;
  
  // Success rate contributes 40%
  score += performance.successRate * 40;
  
  // Progress trend contributes 30%
  const trendScore = progress.streak > 5 ? 30 : progress.streak * 6;
  score += Math.min(trendScore, 30);
  
  // Consistency contributes 30%
  const consistencyScore = performance.totalAttempts > 10 ? 30 : performance.totalAttempts * 3;
  score += Math.min(consistencyScore, 30);
  
  return Math.min(Math.round(score), 100);
}

function generateTagRecommendations(focusArea, performance, progress) {
  const recommendations = [];
  
  if (performance.successRate < 0.5) {
    recommendations.push(`Focus on easier ${focusArea} problems to build confidence`);
  }
  
  if (performance.averageTime > 1800) { // 30 minutes
    recommendations.push(`Practice ${focusArea} problems with time pressure`);
  }
  
  if (progress.streak < 3) {
    recommendations.push(`Establish consistent practice routine for ${focusArea}`);
  }
  
  return recommendations.length > 0 ? recommendations : [`Continue practicing ${focusArea} problems`];
}

function identifyStrengths(performance) {
  const strengths = [];
  
  if (performance.successRate > 0.7) strengths.push('High success rate');
  if (performance.averageTime < 900) strengths.push('Fast problem solving'); // 15 minutes
  if (performance.difficultyBreakdown.Hard.successes > 0) strengths.push('Can handle hard problems');
  
  return strengths;
}

function identifyWeaknesses(performance) {
  const weaknesses = [];
  
  if (performance.successRate < 0.5) weaknesses.push('Low success rate');
  if (performance.averageTime > 1800) weaknesses.push('Slow problem solving'); // 30 minutes
  if (performance.difficultyBreakdown.Easy.successes / Math.max(performance.difficultyBreakdown.Easy.attempts, 1) < 0.8) {
    weaknesses.push('Struggling with easy problems');
  }
  
  return weaknesses;
}