// Helper functions to calculate real user progress for missions
export const getTodaysAttempts = (appState) => {
  const today = new Date().toDateString();
  return appState?.sessions?.allSessions?.filter(session => 
    new Date(session.date).toDateString() === today
  )?.length || 0;
};

export const getTodaysAccuracy = (appState) => {
  if (!appState?.statistics?.successRate?.overall) return 0;
  return appState.statistics.successRate.overall * 100;
};

export const getTodaysHintUsage = (appState) => {
  return appState?.statistics?.averageHints || 0;
};

export const getTodaysReviewProblems = (_appState) => {
  const _today = new Date().toDateString();
  // Count problems solved today that were review problems
  // This would need integration with session data to identify review vs new problems
  // For now, return 0 as we don't have detailed session breakdown
  return 0;
};

export const getSkillProgress = (_appState, _focusTag) => {
  // Count problems solved in the specific focus area
  // This would need integration with attempt data filtered by tag
  // For now, return 0 as we don't have tag-specific attempt data easily accessible
  return 0;
};

// Mission generation functions
export const generateOnboardingMissions = (appState, helpers) => {
  const { getTodaysAttempts, getTodaysAccuracy, getTodaysHintUsage, getSkillProgress } = helpers;
  const focusTags = appState?.learningPlan?.focus?.systemFocusTags || 
                   appState?.learningPlan?.focus?.userFocusAreas || 
                   ['Array', 'String'];
  
  const todaysAttempts = getTodaysAttempts(appState);
  const todaysAccuracy = getTodaysAccuracy(appState);
  const todaysHintUsage = getTodaysHintUsage(appState);
  
  return [
    { 
      id: 1, 
      title: `Practice ${focusTags[0] || 'Array'} problems`, 
      progress: getSkillProgress(appState, focusTags[0]), 
      target: 2, 
      type: "skill", 
      completed: getSkillProgress(appState, focusTags[0]) >= 2 
    },
    { 
      id: 2, 
      title: "Complete first session without hints", 
      progress: todaysHintUsage <= 0 ? 1 : 0, 
      target: 1, 
      type: "efficiency", 
      completed: todaysHintUsage <= 0 && todaysAttempts > 0
    },
    { 
      id: 3, 
      title: "Achieve 60% accuracy today", 
      progress: Math.round(todaysAccuracy), 
      target: 60, 
      type: "performance", 
      completed: todaysAccuracy >= 60 
    }
  ];
};

export const generateRegularMissions = (appState, helpers) => {
  const { getTodaysAttempts, getTodaysAccuracy, getTodaysHintUsage, getTodaysReviewProblems, getSkillProgress } = helpers;
  const focusTags = appState?.learningPlan?.focus?.systemFocusTags || 
                   appState?.learningPlan?.focus?.userFocusAreas || 
                   ['Array', 'String'];
  
  const todaysAttempts = getTodaysAttempts(appState);
  const todaysAccuracy = getTodaysAccuracy(appState);
  const todaysHintUsage = getTodaysHintUsage(appState);
  const reviewProblemsCompleted = getTodaysReviewProblems(appState);
  
  return [
    { 
      id: 1, 
      title: `Master ${focusTags[0] || 'Dynamic Programming'} fundamentals`, 
      progress: getSkillProgress(appState, focusTags[0]), 
      target: 3, 
      type: "skill", 
      completed: getSkillProgress(appState, focusTags[0]) >= 3 
    },
    { 
      id: 2, 
      title: "Review problems from lower boxes", 
      progress: reviewProblemsCompleted, 
      target: 4, 
      type: "review", 
      completed: reviewProblemsCompleted >= 4 
    },
    { 
      id: 3, 
      title: "Maintain 75% accuracy today", 
      progress: Math.round(todaysAccuracy), 
      target: 75, 
      type: "performance", 
      completed: todaysAccuracy >= 75 
    },
    { 
      id: 4, 
      title: "Solve problems efficiently", 
      progress: todaysHintUsage <= 1 ? 2 : (todaysHintUsage <= 2 ? 1 : 0), 
      target: 2, 
      type: "efficiency", 
      completed: todaysHintUsage <= 1 && todaysAttempts > 0
    }
  ];
};