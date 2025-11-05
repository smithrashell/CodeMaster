import { useEffect, useState } from "react";
import { getNewVsReviewProblemsPerSession, getIndividualSessionActivityData } from "../../../shared/utils/DataAdapter";

export function useProgressData(appState) {
  const [boxLevelData, setBoxLevelData] = useState(appState?.boxLevelData || {});
  const [reviewProblemsData, setReviewProblemsData] = useState(null);
  const [activityData, setActivityData] = useState(null);
  const [strategySuccessRate, setStrategySuccessRate] = useState(appState?.strategySuccessRate);
  const [timerBehavior, setTimerBehavior] = useState(appState?.timerBehavior);
  const [timerPercentage, setTimerPercentage] = useState(appState?.timerPercentage);
  const [learningStatus, setLearningStatus] = useState(appState?.learningStatus);
  const [progressTrend, setProgressTrend] = useState(appState?.progressTrend);
  const [progressPercentage, setProgressPercentage] = useState(appState?.progressPercentage);
  const [currentTier, setCurrentTier] = useState(appState?.learningState?.currentTier);
  const [nextReviewTime, setNextReviewTime] = useState(appState?.nextReviewTime);
  const [nextReviewCount, setNextReviewCount] = useState(appState?.nextReviewCount);

  // Process loaded data
  useEffect(() => {
    if (!appState) return;

    const formatted = Object.entries(appState.boxLevelData || {}).map(
      ([key, value]) => ({
        name: `Box ${key}`,
        count: value,
      })
    );
    setBoxLevelData(formatted);
    setStrategySuccessRate(appState.strategySuccessRate);
    setTimerBehavior(appState.timerBehavior);
    setTimerPercentage(appState.timerPercentage);
    setLearningStatus(appState.learningStatus);
    setProgressTrend(appState.progressTrend);
    setProgressPercentage(appState.progressPercentage);
    setCurrentTier(appState.learningState?.currentTier);
    setNextReviewTime(appState.nextReviewTime);
    setNextReviewCount(appState.nextReviewCount);

    // Calculate new vs review problems per session (individual sessions, not aggregated)
    if (appState.allSessions) {
      const newVsReviewData = getNewVsReviewProblemsPerSession(appState.allSessions);
      console.info("✅ Calculated new vs review problems per session:", newVsReviewData);
      setReviewProblemsData(newVsReviewData);

      // Calculate activity data per session (individual sessions, not aggregated)
      const individualActivityData = getIndividualSessionActivityData(appState.allSessions);
      console.info("✅ Calculated individual session activity data:", individualActivityData);
      setActivityData(individualActivityData);
    }
  }, [appState]);

  useEffect(() => {
    console.info("📊 Rendered reviewProblemsData:", reviewProblemsData);
  }, [reviewProblemsData]);

  return {
    boxLevelData,
    reviewProblemsData,
    activityData,
    strategySuccessRate,
    timerBehavior,
    timerPercentage,
    learningStatus,
    progressTrend,
    progressPercentage,
    currentTier,
    nextReviewTime,
    nextReviewCount
  };
}