import { useState } from 'react';
import { 
  getTodaysAttempts, 
  getTodaysAccuracy, 
  getTodaysHintUsage, 
  getTodaysReviewProblems, 
  getSkillProgress,
  generateOnboardingMissions,
  generateRegularMissions
} from './missionHelpers.js';

export const useMissions = () => {
  const [dailyMissions, setDailyMissions] = useState([]);

  // Generate missions with real progress calculation from user data
  const generateMissionsWithRealProgress = (appState, isOnboarding) => {
    const helpers = {
      getTodaysAttempts,
      getTodaysAccuracy,
      getTodaysHintUsage,
      getTodaysReviewProblems,
      getSkillProgress
    };
    
    return isOnboarding 
      ? generateOnboardingMissions(appState, helpers)
      : generateRegularMissions(appState, helpers);
  };

  // Generate meaningful default missions based on user progress and onboarding status
  const generateDefaultMissions = (appState, isOnboarding) => {
    // Generate with zero progress for default/placeholder missions
    const helpers = {
      getTodaysAttempts: () => 0,
      getTodaysAccuracy: () => 0,
      getTodaysHintUsage: () => 0,
      getTodaysReviewProblems: () => 0,
      getSkillProgress: () => 0
    };
    
    return isOnboarding 
      ? generateOnboardingMissions(appState, helpers)
      : generateRegularMissions(appState, helpers);
  };

  const getMissionIcon = (type) => {
    switch (type) {
      case "skill": return "🎯";
      case "review": return "📚";
      case "performance": return "⚡";
      case "efficiency": return "🎪";
      default: return "✨";
    }
  };

  const getMissionColor = (type) => {
    switch (type) {
      case "skill": return "blue";
      case "review": return "violet";
      case "performance": return "green";
      case "efficiency": return "orange";
      default: return "gray";
    }
  };

  return {
    dailyMissions,
    setDailyMissions,
    generateMissionsWithRealProgress,
    generateDefaultMissions,
    getMissionIcon,
    getMissionColor
  };
};