/**
 * Custom hook for processing session data for charts and tables
 */
import { useState, useEffect } from "react";
import { filterSessionsByTimeRange, calculateKPIs } from "./sessionTimeUtils";
import { getIndividualSessionAccuracyData } from "../../../shared/utils/ui/DataAdapter";

export const useSessionData = (appState, timeRange) => {
  const [sessionLengthData, setSessionLengthData] = useState([]);
  const [accuracyData, setAccuracyData] = useState([]);
  const [recentSessions, setRecentSessions] = useState([]);

  useEffect(() => {
    if (!appState) return;

    // Get all sessions and apply time range filter
    const allSessions = appState.allSessions || [];
    const filteredSessions = filterSessionsByTimeRange(allSessions, timeRange);

    // Filter to only completed sessions with problems (attempts are stored as problems on sessions)
    const completedSessions = filteredSessions.filter(session => {
      const hasProblems = (session.problems && session.problems.length > 0) ||
                          (session.attempts && session.attempts.length > 0);
      return (session.status === "completed" || session.completed === true) && hasProblems;
    });

    // Sort by date so .slice(-N) returns the most recent sessions
    completedSessions.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Process session length data - limit to last 20 for readability
    const sessionsForLengthChart = completedSessions.slice(-20);
    const lengthData = sessionsForLengthChart.map((session, index) => {
      const duration = session.duration || session.session_duration || 30;
      return {
        name: `Session ${index + 1}`,
        length: duration
      };
    });
    setSessionLengthData(lengthData);

    // Use DataAdapter for accuracy data - shows individual sessions
    const accuracyChartData = getIndividualSessionAccuracyData(completedSessions);
    setAccuracyData(accuracyChartData);

    // Use filtered sessions for recent sessions table (limit to last 10 for table)
    setRecentSessions(completedSessions.slice(-10));
  }, [appState, timeRange]);

  // Calculate KPI values from filtered data
  const filteredSessionsForKPI = appState?.allSessions
    ? filterSessionsByTimeRange(appState.allSessions, timeRange)
    : [];

  // Only count sessions that are actually completed (same logic as Recent Sessions table)
  const completedSessionsForKPI = filteredSessionsForKPI.filter(session => {
    const hasProblems = (session.problems && session.problems.length > 0) ||
                        (session.attempts && session.attempts.length > 0);
    return (session.status === "completed" || session.completed === true) && hasProblems;
  });

  const kpis = calculateKPIs(completedSessionsForKPI);

  return {
    recentSessions,
    sessionLengthData,
    accuracyData,
    kpis
  };
};