/**
 * Custom hook for processing session data for charts and tables
 */
import { useState, useEffect } from "react";
import { filterSessionsByTimeRange, calculateKPIs } from "./sessionTimeUtils";

export const useSessionData = (appState, timeRange) => {
  const [sessionData, setSessionData] = useState([]);
  const [recentSessions, setRecentSessions] = useState([]);

  useEffect(() => {
    if (!appState) return;

    // Get all sessions and apply time range filter
    const allSessions = appState.allSessions || [];
    const filteredSessions = filterSessionsByTimeRange(allSessions, timeRange);
    
    // Process filtered sessions for charts (limit to last 14 for chart readability)
    const sessionsForChart = filteredSessions.slice(-14);
    const processedData = sessionsForChart.map((session, index) => ({
      name: `Day ${index + 1}`,
      length: session.duration || Math.floor(Math.random() * 30) + 30, // Fallback to mock if no duration
      accuracy: Math.round((session.accuracy || 0.75) * 100),
      problems: session.problems?.length || 0
    }));

    setSessionData(processedData);
    // Use filtered sessions for recent sessions table (limit to last 10 for table)
    setRecentSessions(filteredSessions.slice(-10));
  }, [appState, timeRange]);

  // Calculate KPI values from filtered data
  const filteredSessionsForKPI = appState?.allSessions 
    ? filterSessionsByTimeRange(appState.allSessions, timeRange) 
    : [];
  
  // Only count sessions that are actually completed (same logic as Recent Sessions table)
  const completedSessions = filteredSessionsForKPI.filter(session => {
    const hasAttempts = session.attempts && session.attempts.length > 0;
    return (session.status === "completed" || session.completed === true) && hasAttempts;
  });
  
  const kpis = calculateKPIs(completedSessions);

  return {
    sessionData,
    recentSessions,
    sessionLengthData: sessionData,
    accuracyData: sessionData.map(d => ({ name: d.name, accuracy: d.accuracy })),
    kpis
  };
};