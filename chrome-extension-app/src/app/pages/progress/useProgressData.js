import { useEffect, useState } from "react";
import { getPromotionDemotionData } from "../../components/analytics/generatePromotionDataFromSession";
import { getProblemActivityData } from "../../../shared/utils/DataAdapter";

export function useProgressData(appState) {
  const [boxLevelData, setBoxLevelData] = useState(appState?.boxLevelData || {});
  const [promotionData, setPromotionData] = useState(null);
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

    // Use pre-generated promotion data from mock service if available
    if (appState.promotionData) {
      console.info("✅ Using pre-generated promotion data:", appState.promotionData);
      setPromotionData(appState.promotionData);
    } else if (appState.allAttempts && appState.allProblems) {
      // Fallback to calculating promotion data from raw data
      const weekly = getPromotionDemotionData(
        appState.allAttempts,
        appState.allProblems,
        "weekly"
      );
      const monthly = getPromotionDemotionData(
        appState.allAttempts,
        appState.allProblems,
        "monthly"
      );
      const yearly = getPromotionDemotionData(
        appState.allAttempts,
        appState.allProblems,
        "yearly"
      );
      console.info("✅ Calculated promotion data:", { weekly, monthly, yearly });
      setPromotionData({ weekly, monthly, yearly });
    }

    if (appState.allSessions) {
      const activityData = getProblemActivityData(
        appState.allSessions,
        "weekly"
      );
      const monthlyActivityData = getProblemActivityData(
        appState.allSessions,
        "monthly"
      );
      const yearlyActivityData = getProblemActivityData(
        appState.allSessions,
        "yearly"
      );
      setActivityData({
        weekly: activityData,
        monthly: monthlyActivityData,
        yearly: yearlyActivityData,
      });
    }
  }, [appState]);

  useEffect(() => {
    console.info("📊 Rendered promotionData:", promotionData);
  }, [promotionData]);

  return {
    boxLevelData,
    promotionData,
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