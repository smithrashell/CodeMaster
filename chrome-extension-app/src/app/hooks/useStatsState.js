import { useEffect, useState } from "react";
import { checkContentOnboardingStatus } from "../../shared/services/onboardingService.js";
import { shouldUseMockDashboard } from "../config/mockConfig.js";
import { filterSessionsByTimeRange } from "../pages/sessions/sessionTimeUtils.js";

/**
 * Process session data for accuracy and efficiency charts
 * Shows individual sessions, not aggregated
 */
function processSessionData(allSessions, timeRange, setAccuracyData, setEfficiencyData) {
  if (allSessions && Array.isArray(allSessions)) {
    const { getIndividualSessionAccuracyData, getIndividualSessionEfficiencyData } = require("../../shared/utils/DataAdapter.js");

    // Filter sessions by time range first
    const filteredSessions = filterSessionsByTimeRange(allSessions, timeRange);

    // Get individual session data (no aggregation)
    const individualAccuracyData = getIndividualSessionAccuracyData(filteredSessions);
    const individualEfficiencyData = getIndividualSessionEfficiencyData(filteredSessions);

    setAccuracyData(individualAccuracyData);
    setEfficiencyData(individualEfficiencyData);
  } else {
    console.warn("allSessions is not available or not an array:", allSessions);
    setAccuracyData([]);
    setEfficiencyData([]);
  }
}

/**
 * Detect if there is any available data to display
 */
function detectAvailableData(appState, statistics, allSessions) {
  return appState && (
    // Check multiple statistics properties
    (statistics?.totalSolved > 0) ||
    (statistics?.statistics?.totalSolved > 0) ||
    // Check multiple session sources
    (allSessions && allSessions.length > 0) ||
    (appState.allSessions && appState.allSessions.length > 0) ||
    // Check for any problem/attempt data
    (appState.allProblems && appState.allProblems.length > 0) ||
    (appState.allAttempts && appState.allAttempts.length > 0)
  );
}

export function useStatsState(appState, timeRange = "All time") {
  const [statistics, setStatistics] = useState(appState?.statistics);
  const [averageTime, setAverageTime] = useState(appState?.averageTime);
  const [successRate, setSuccessRate] = useState(appState?.successRate);
  const [allSessions, setAllSessions] = useState(appState?.allSessions);
  const [hintsUsed, setHintsUsed] = useState(appState?.hintsUsed);
  const [contentOnboardingCompleted, setContentOnboardingCompleted] = useState(null);
  const [accuracyData, setAccuracyData] = useState([]);
  const [efficiencyData, setEfficiencyData] = useState([]);

  // Check content onboarding status
  useEffect(() => {
    const checkContentStatus = async () => {
      try {
        const status = await checkContentOnboardingStatus();
        setContentOnboardingCompleted(status.is_completed);
      } catch (error) {
        console.error("Error checking content onboarding status:", error);
        setContentOnboardingCompleted(false);
      }
    };
    checkContentStatus();
  }, []);

  useEffect(() => {
    console.info("📊 Overview received appState:", appState);
    console.info("📊 Overview appState analysis:", {
      hasAppState: !!appState,
      hasStatistics: !!appState?.statistics,
      totalSolved: appState?.statistics?.statistics?.totalSolved,
      hasAllSessions: !!appState?.allSessions,
      allSessionsLength: appState?.allSessions?.length,
      contentOnboardingCompleted
    });
    if (appState) {
      setStatistics(appState.statistics);
      setAverageTime(appState.averageTime);
      setSuccessRate(appState.successRate);
      setAllSessions(appState.allSessions);
      setHintsUsed(appState.hintsUsed);

      // Process session data for charts (individual sessions, not aggregated)
      processSessionData(appState.allSessions, timeRange, setAccuracyData, setEfficiencyData);
    }
  }, [appState, timeRange, contentOnboardingCompleted]);

  // Enhanced data detection logic - check multiple data sources
  const hasData = detectAvailableData(appState, statistics, allSessions);

  const showStartSessionButton =
    (contentOnboardingCompleted === false) && !shouldUseMockDashboard();

  // Comprehensive debug logging for data detection
  console.info("🔍 Data Detection Debug:", {
    appState: !!appState,
    statistics: statistics,
    'statistics.totalSolved': statistics?.totalSolved,
    'statistics.statistics': statistics?.statistics,
    'statistics.statistics.totalSolved': statistics?.statistics?.totalSolved,
    allSessions: allSessions?.length,
    'appState.allSessions': appState?.allSessions?.length,
    'appState.allProblems': appState?.allProblems?.length,
    'appState.allAttempts': appState?.allAttempts?.length,
    hasData,
    contentOnboardingCompleted,
    shouldUseMock: shouldUseMockDashboard(),
    showStartSessionButton,
    'Final Decision': showStartSessionButton ? 'SHOW ONBOARDING MODAL' : 'SHOW DASHBOARD DATA'
  });

  return {
    statistics,
    averageTime,
    successRate,
    allSessions,
    hintsUsed,
    learningEfficiencyData: efficiencyData, // Use individual session efficiency
    contentOnboardingCompleted,
    accuracyData,
    hasData,
    showStartSessionButton
  };
}