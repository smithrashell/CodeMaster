/**
 * Focus area insights and recommendations generation
 * Extracted from getFocusAreaAnalytics for better organization
 */

/**
 * Integrate session analytics data with focus areas
 */
export function integrateFocusAreaSessionAnalytics(focusAreas, recentSessionAnalytics, problemTagsMap) {
  const integration = {};

  for (const focusArea of focusAreas) {
    const relevantSessions = recentSessionAnalytics.filter(session => {
      if (!session.problems) return false;
      
      return session.problems.some(problem => {
        const problemTags = problemTagsMap.get(problem.id) || [];
        return problemTags.includes(focusArea);
      });
    });

    integration[focusArea] = {
      totalSessions: relevantSessions.length,
      averageProblemsPerSession: relevantSessions.length > 0 
        ? relevantSessions.reduce((sum, s) => sum + (s.problems?.length || 0), 0) / relevantSessions.length
        : 0,
      averageSessionDuration: relevantSessions.length > 0
        ? relevantSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / relevantSessions.length
        : 0,
      recentActivity: relevantSessions.slice(0, 5).map(session => ({
        date: session.date,
        problemCount: session.problems?.length || 0,
        duration: session.duration || 0,
        success: session.successRate > 0.5,
      })),
    };
  }

  return integration;
}

/**
 * Generate insights based on focus area performance data
 */
export function generateFocusAreaInsights(performance, _progressTracking, _effectiveness) {
  const insights = [];

  // Analyze overall performance patterns
  const focusAreas = Object.keys(performance);
  
  if (focusAreas.length === 0) {
    return ["No focus areas data available for analysis."];
  }

  // Find best and worst performing areas
  const performanceEntries = focusAreas
    .map(area => ({ area, successRate: performance[area].successRate, attempts: performance[area].totalAttempts }))
    .filter(entry => entry.attempts > 0);

  if (performanceEntries.length === 0) {
    return ["No attempts data available for focus areas analysis."];
  }

  const bestPerforming = performanceEntries.reduce((best, current) => 
    current.successRate > best.successRate ? current : best
  );

  const worstPerforming = performanceEntries.reduce((worst, current) => 
    current.successRate < worst.successRate ? current : worst
  );

  // Generate performance insights
  if (bestPerforming.successRate > 0.7) {
    insights.push(`Excellent performance in ${bestPerforming.area} with ${Math.round(bestPerforming.successRate * 100)}% success rate.`);
  }

  if (worstPerforming.successRate < 0.5) {
    insights.push(`${worstPerforming.area} needs attention with only ${Math.round(worstPerforming.successRate * 100)}% success rate.`);
  }

  // Analyze progress trends
  const improvingAreas = focusAreas.filter(area => 
    performance[area].recentTrend === 'improving'
  );

  const decliningAreas = focusAreas.filter(area => 
    performance[area].recentTrend === 'declining'
  );

  if (improvingAreas.length > 0) {
    insights.push(`Showing improvement in: ${improvingAreas.join(', ')}.`);
  }

  if (decliningAreas.length > 0) {
    insights.push(`Recent decline detected in: ${decliningAreas.join(', ')}. Consider focused review.`);
  }

  // Analyze practice consistency
  const totalAttempts = performanceEntries.reduce((sum, entry) => sum + entry.attempts, 0);
  const averageAttemptsPerArea = totalAttempts / focusAreas.length;

  if (averageAttemptsPerArea < 5) {
    insights.push("Consider increasing practice frequency for better skill development.");
  } else if (averageAttemptsPerArea > 20) {
    insights.push("Great practice consistency! Keep up the regular problem-solving routine.");
  }

  // Time-based insights
  const fastAreas = focusAreas.filter(area => performance[area].averageTime < 900); // < 15 minutes
  const slowAreas = focusAreas.filter(area => performance[area].averageTime > 1800); // > 30 minutes

  if (fastAreas.length > 0) {
    insights.push(`Quick problem solving in: ${fastAreas.join(', ')}. Consider tackling harder variants.`);
  }

  if (slowAreas.length > 0) {
    insights.push(`Spending significant time on: ${slowAreas.join(', ')}. Practice speed-solving techniques.`);
  }

  return insights.length > 0 ? insights : ["Focus area analysis in progress. More data needed for detailed insights."];
}

/**
 * Generate actionable recommendations based on analytics
 */
export function generateFocusAreaRecommendations(performance, effectiveness, learningState) {
  const recommendations = [];
  const focusAreas = Object.keys(performance);

  if (focusAreas.length === 0) {
    return [{
      priority: 'high',
      category: 'setup',
      title: 'Set Focus Areas',
      description: 'Configure focus areas in Settings to get personalized recommendations.',
      action: 'Go to Settings → Focus Areas',
    }];
  }

  // High priority recommendations
  const strugglingAreas = focusAreas.filter(area => 
    performance[area].successRate < 0.5 && performance[area].totalAttempts > 3
  );

  strugglingAreas.forEach(area => {
    recommendations.push({
      priority: 'high',
      category: 'improvement',
      title: `Strengthen ${area}`,
      description: `Success rate is ${Math.round(performance[area].successRate * 100)}%. Focus on fundamentals.`,
      action: `Practice easier ${area} problems first`,
    });
  });

  // Medium priority recommendations
  const slowAreas = focusAreas.filter(area => 
    performance[area].averageTime > 1800 && performance[area].successRate > 0.6
  );

  slowAreas.forEach(area => {
    recommendations.push({
      priority: 'medium',
      category: 'speed',
      title: `Improve ${area} Speed`,
      description: `Average solve time is ${Math.round(performance[area].averageTime / 60)} minutes.`,
      action: `Practice ${area} problems with time limits`,
    });
  });

  // Low priority recommendations
  const excellentAreas = focusAreas.filter(area => 
    performance[area].successRate > 0.8 && performance[area].averageTime < 1200
  );

  excellentAreas.forEach(area => {
    recommendations.push({
      priority: 'low',
      category: 'advanced',
      title: `Advanced ${area} Practice`,
      description: `Strong performance (${Math.round(performance[area].successRate * 100)}% success rate).`,
      action: `Try harder ${area} problems or explore variants`,
    });
  });

  // Consistency recommendations
  const inconsistentAreas = focusAreas.filter(area => {
    const tagMastery = learningState?.tags?.[area];
    return tagMastery && (tagMastery.currentStreak || 0) < 3 && performance[area].totalAttempts > 0;
  });

  inconsistentAreas.forEach(area => {
    recommendations.push({
      priority: 'medium',
      category: 'consistency',
      title: `Build ${area} Consistency`,
      description: 'Low practice streak detected.',
      action: `Schedule regular ${area} practice sessions`,
    });
  });

  // Balance recommendations
  const unbalancedDifficulty = focusAreas.filter(area => {
    const breakdown = performance[area].difficultyBreakdown;
    const easyPercent = breakdown.Easy.attempts / Math.max(performance[area].totalAttempts, 1);
    const hardPercent = breakdown.Hard.attempts / Math.max(performance[area].totalAttempts, 1);
    
    return easyPercent > 0.8 || (hardPercent === 0 && performance[area].totalAttempts > 5);
  });

  unbalancedDifficulty.forEach(area => {
    recommendations.push({
      priority: 'low',
      category: 'balance',
      title: `Balance ${area} Difficulty`,
      description: 'Practice is concentrated on one difficulty level.',
      action: `Try a mix of easy, medium, and hard ${area} problems`,
    });
  });

  // Sort by priority
  const priorityOrder = { high: 3, medium: 2, low: 1 };
  return recommendations
    .sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])
    .slice(0, 8); // Limit to top 8 recommendations
}

/**
 * Clean up old analytics cache entries
 */
export function cleanupAnalyticsCache(analyticsCache, maxEntries = 20) {
  if (analyticsCache.size > maxEntries) {
    const entries = Array.from(analyticsCache.entries());
    const sortedEntries = entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
    
    // Keep only the most recent entries
    analyticsCache.clear();
    sortedEntries.slice(0, maxEntries).forEach(([key, value]) => {
      analyticsCache.set(key, value);
    });
    
    console.info(`Cleaned analytics cache, kept ${maxEntries} most recent entries`);
  }
}