import { useState, useEffect } from "react";

export function useProductivityInsights(appState, productivityData, totalSessions) {
  const [insights, setInsights] = useState([]);

  useEffect(() => {
    const generatedInsights = [];
    
    if (productivityData.length > 0) {
      const bestTime = productivityData.reduce((best, current) => 
        current.avgAccuracy > best.avgAccuracy ? current : best
      );
      generatedInsights.push({
        title: "Peak performance",
        body: `You're sharpest at ${bestTime.time} with ${bestTime.avgAccuracy}% accuracy.`
      });
      
      const mostActive = productivityData.reduce((most, current) =>
        current.attempts > most.attempts ? current : most
      );
      generatedInsights.push({
        title: "Most active",
        body: `${mostActive.time} has the highest attempt count (${mostActive.attempts} problems solved).`
      });

      // Reflection insights
      const reflectionData = appState?.reflectionData || {};
      const reflectionsCount = reflectionData.reflectionsCount || 0;
      const totalProblems = (appState?.allSessions || [])
        .filter(s => s.status === 'completed')
        .reduce((sum, s) => sum + (s.problems?.length || 0), 0);
      const reflectionRate = totalProblems > 0 ? (reflectionsCount / totalProblems) * 100 : 0;

      if (reflectionRate > 75) {
        generatedInsights.push({
          title: "Great reflection habit",
          body: `${Math.round(reflectionRate)}% reflection rate shows strong learning mindset.`
        });
      } else if (reflectionRate > 25) {
        generatedInsights.push({
          title: "Growing reflection practice",
          body: `${Math.round(reflectionRate)}% reflection rate - keep building this habit!`
        });
      } else if (totalProblems > 10) {
        generatedInsights.push({
          title: "Reflection opportunity",
          body: `Try reflecting on challenging problems to accelerate learning.`
        });
      }

      // Common reflection themes
      if (reflectionData.commonThemes && reflectionData.commonThemes.length > 0) {
        const topThemeData = reflectionData.commonThemes[0];
        // Extract theme string - handle both object {theme: "..."} and string formats
        let topTheme = topThemeData;
        if (typeof topThemeData === 'object' && topThemeData !== null) {
          topTheme = topThemeData.theme || JSON.stringify(topThemeData);
        }
        // Ensure it's a string
        topTheme = String(topTheme || 'unknown');
        generatedInsights.push({
          title: "Learning pattern",
          body: `Most common challenge: "${topTheme}" - focus area identified!`
        });
      }
    }
    
    setInsights(generatedInsights);
  }, [appState, productivityData, totalSessions]);

  return insights;
}