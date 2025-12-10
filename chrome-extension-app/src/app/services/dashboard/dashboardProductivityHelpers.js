/**
 * Helper functions for productivity insights and reflection analysis
 * Extracted from dashboardService.js to reduce file complexity
 */

import logger from "../../../shared/utils/logging/logger.js";

/**
 * Calculate reflection insights from attempt data
 */
export function calculateReflectionInsights(dashboardData) {
  try {
    const allAttempts = dashboardData.allAttempts || [];

    const attemptsWithReflections = allAttempts.filter(attempt => {
      const commentText = attempt.comments || attempt.Comments;
      return commentText && commentText.trim().length > 0;
    });

    const reflectionsCount = attemptsWithReflections.length;
    const totalAttempts = allAttempts.length;
    const reflectionRate = totalAttempts > 0 ? (reflectionsCount / totalAttempts) * 100 : 0;

    console.log('🔍 calculateReflectionInsights Debug:', {
      totalAttempts,
      reflectionsCount,
      reflectionRate,
      sampleAttemptWithComment: attemptsWithReflections[0],
      first3Attempts: allAttempts.slice(0, 3).map(a => ({
        hasComments: !!a.comments,
        hasCommentsCapital: !!a.Comments,
        commentValue: a.comments || a.Comments || 'EMPTY'
      }))
    });

    const commonThemes = analyzeReflectionThemes(attemptsWithReflections);

    const avgReflectionLength = reflectionsCount > 0
      ? attemptsWithReflections.reduce((sum, attempt) => {
          const commentText = attempt.comments || attempt.Comments;
          return sum + (commentText ? commentText.length : 0);
        }, 0) / reflectionsCount
      : 0;

    const reflectionPerformanceCorrelation = calculateReflectionPerformanceCorrelation(
      attemptsWithReflections,
      allAttempts
    );

    return {
      reflectionsCount,
      totalAttempts,
      reflectionRate: Math.round(reflectionRate * 10) / 10,
      commonThemes: commonThemes.slice(0, 3),
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
export function analyzeReflectionThemes(attemptsWithReflections) {
  const themeKeywords = {
    'time-management': ['time', 'slow', 'fast', 'rushed', 'deadline'],
    'algorithm-understanding': ['algorithm', 'approach', 'logic', 'understand', 'concept'],
    'implementation': ['code', 'syntax', 'bug', 'error', 'implementation'],
    'problem-analysis': ['analysis', 'breakdown', 'edge case', 'constraint', 'requirement'],
    'pattern-recognition': ['pattern', 'similar', 'seen before', 'template', 'approach']
  };

  const themeCounts = {};

  attemptsWithReflections.forEach(attempt => {
    const commentText = attempt.comments || attempt.Comments;
    const reflection = (commentText || '').toLowerCase();

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
export function calculateReflectionPerformanceCorrelation(attemptsWithReflections, allAttempts) {
  if (attemptsWithReflections.length === 0) return 0;

  const reflectionSuccessRate = attemptsWithReflections.filter(a => (a.success !== undefined ? a.success : a.Success)).length / attemptsWithReflections.length;
  const overallSuccessRate = allAttempts.filter(a => (a.success !== undefined ? a.success : a.Success)).length / allAttempts.length;

  return Math.round((reflectionSuccessRate - overallSuccessRate) * 100);
}
