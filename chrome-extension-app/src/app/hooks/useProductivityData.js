import { useState, useEffect } from "react";

// Function to filter sessions based on time range
const filterSessionsByTimeRange = (sessions, timeRange) => {
  const now = new Date();
  let startDate;
  
  switch (timeRange) {
    case "Last 7 days":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "Last 30 days":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "Quarter to date": {
      // Get start of current quarter
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1);
      break;
    }
    case "All time":
      return sessions; // No filtering for "All time"
    default:
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  
  return sessions.filter(session => {
    const sessionDate = new Date(session.Date || session.date);
    return sessionDate >= startDate;
  });
};

// Calculate hourly performance data for charts
const calculateHourlyPerformance = (sessions) => {
  const hourlyPerformance = {};
  sessions.forEach(session => {
    const sessionDate = session.date || session.Date;
    if (sessionDate) {
      const hour = new Date(sessionDate).getHours();
      const timeSlot = `${hour}:00`;
      if (!hourlyPerformance[timeSlot]) {
        hourlyPerformance[timeSlot] = { totalSessions: 0, totalAccuracy: 0, totalProblems: 0 };
      }
      hourlyPerformance[timeSlot].totalSessions += 1;
      hourlyPerformance[timeSlot].totalAccuracy += (session.accuracy || 0.75);
      hourlyPerformance[timeSlot].totalProblems += (session.problems?.length || 0);
    }
  });

  // Convert to chart data
  return Object.entries(hourlyPerformance).map(([time, data]) => ({
    time,
    avgAccuracy: Math.round((data.totalAccuracy / data.totalSessions) * 100),
    sessions: data.totalSessions,
    avgProblems: Math.round(data.totalProblems / data.totalSessions)
  })).sort((a, b) => parseInt(a.time) - parseInt(b.time));
};

export function useProductivityData(appState, timeRange) {
  const [productivityData, setProductivityData] = useState([]);

  useEffect(() => {
    if (!appState) return;

    // Get all sessions and apply time range filter
    const allSessions = appState.allSessions || [];
    const sessions = filterSessionsByTimeRange(allSessions, timeRange);
    
    // Calculate hourly performance for chart data
    const chartData = calculateHourlyPerformance(sessions);
    setProductivityData(chartData);
  }, [appState, timeRange]);

  // Calculate summary metrics
  const totalSessions = productivityData.reduce((sum, d) => sum + d.sessions, 0);
  const avgAccuracy = productivityData.length > 0 
    ? Math.round(productivityData.reduce((sum, d) => sum + d.avgAccuracy, 0) / productivityData.length)
    : 0;
  const peakHour = productivityData.length > 0 
    ? productivityData.reduce((best, current) => 
        current.avgAccuracy > best.avgAccuracy ? current : best
      ).time 
    : "N/A";

  return {
    productivityData,
    totalSessions,
    avgAccuracy,
    peakHour
  };
}