import { useEffect, useState } from "react";
import { checkContentOnboardingStatus } from "../../shared/services/onboardingService.js";
import { shouldUseMockDashboard } from "../config/mockConfig.js";
import { filterSessionsByTimeRange } from "../pages/sessions/sessionTimeUtils.js";
import AccurateTimer from "../../shared/utils/timing/AccurateTimer.js";

/**
 * Recalculate KPI metrics from filtered sessions
 */
function recalculateKPIsFromSessions(filteredSessions, appState) {
  if (!filteredSessions || filteredSessions.length === 0 || !appState) {
    return null; // Return null to indicate no recalculation needed
  }

  // Build set of problem IDs from filtered sessions
  const problemIds = new Set();
  const attempts = [];
  const hintCounts = { total: 0, contextual: 0, general: 0 };

  filteredSessions.forEach(session => {
    if (session.attempts && Array.isArray(session.attempts)) {
      session.attempts.forEach(attempt => {
        attempts.push(attempt);
        if (attempt.problem_id) {
          problemIds.add(attempt.problem_id);
        }
      });
    }

    // Aggregate hint counts if available
    if (session.hintsUsed) {
      hintCounts.total += session.hintsUsed;
    }
  });

  // Calculate statistics
  const uniqueProblems = problemIds.size;
  const successfulAttempts = attempts.filter(a => a.success).length;
  const totalAttempts = attempts.length;

  // Calculate average time (convert seconds to minutes)
  const totalTimeSeconds = attempts.reduce((sum, a) => sum + (a.time_spent || 0), 0);
  const avgTimeMinutes = totalAttempts > 0
    ? AccurateTimer.secondsToMinutes(totalTimeSeconds / totalAttempts, 1)
    : 0;

  // Calculate success rate
  const successRateValue = totalAttempts > 0
    ? Math.round((successfulAttempts / totalAttempts) * 100)
    : 0;

  return {
    statistics: {
      totalSolved: uniqueProblems,
      mastered: appState.statistics?.mastered || 0, // Can't recalculate mastery without box levels
      inProgress: appState.statistics?.inProgress || 0,
      new: appState.statistics?.new || 0,
    },
    averageTime: {
      overall: avgTimeMinutes,
      Easy: appState.averageTime?.Easy || 0, // Difficulty breakdown requires problem metadata
      Medium: appState.averageTime?.Medium || 0,
      Hard: appState.averageTime?.Hard || 0,
    },
    successRate: {
      overall: successRateValue,
      Easy: appState.successRate?.Easy || 0,
      Medium: appState.successRate?.Medium || 0,
      Hard: appState.successRate?.Hard || 0,
    },
    hintsUsed: {
      total: hintCounts.total,
      contextual: hintCounts.contextual,
      general: hintCounts.general,
    }
  };
}

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

    return filteredSessions; // Return filtered sessions for KPI recalculation
  } else {
    console.warn("allSessions is not available or not an array:", allSessions);
    setAccuracyData([]);
    setEfficiencyData([]);
    return [];
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
      contentOnboardingCompleted,
      timeRange
    });
    if (appState) {
      // Process session data for charts and get filtered sessions
      const filteredSessions = processSessionData(appState.allSessions, timeRange, setAccuracyData, setEfficiencyData);

      // If time range is "All time", use original appState data
      // Otherwise, recalculate KPIs from filtered sessions
      if (timeRange === "All time" || !filteredSessions || filteredSessions.length === 0) {
        setStatistics(appState.statistics);
        setAverageTime(appState.averageTime);
        setSuccessRate(appState.successRate);
        setHintsUsed(appState.hintsUsed);
      } else {
        // Recalculate KPIs from filtered sessions
        const recalculated = recalculateKPIsFromSessions(filteredSessions, appState);
        if (recalculated) {
          setStatistics(recalculated.statistics);
          setAverageTime(recalculated.averageTime);
          setSuccessRate(recalculated.successRate);
          setHintsUsed(recalculated.hintsUsed);
          console.info("📊 Recalculated KPIs from filtered sessions:", {
            timeRange,
            filteredSessionsCount: filteredSessions.length,
            totalSolved: recalculated.statistics.totalSolved,
            avgTime: recalculated.averageTime.overall,
            successRate: recalculated.successRate.overall
          });
        } else {
          // Fallback to original data if recalculation fails
          setStatistics(appState.statistics);
          setAverageTime(appState.averageTime);
          setSuccessRate(appState.successRate);
          setHintsUsed(appState.hintsUsed);
        }
      }

      setAllSessions(appState.allSessions);
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