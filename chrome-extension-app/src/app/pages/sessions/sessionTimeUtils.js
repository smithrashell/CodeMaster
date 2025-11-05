/**
 * Utility functions for session time filtering and calculations
 */

export const TIME_RANGE_OPTIONS = [
  "Last 7 days",
  "Last 30 days", 
  "Quarter to date",
  "Year to date",
  "All time"
];

export function filterSessionsByTimeRange(sessions, timeRange) {
  if (!sessions || sessions.length === 0) return [];
  
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
    case "Year to date":
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    case "All time":
    default:
      return sessions; // Return all sessions
  }

  return sessions.filter(session => {
    // Support multiple date field names (created_date, date, timestamp, Date)
    const dateValue = session.created_date || session.date || session.timestamp || session.Date;
    if (!dateValue) return false;
    const sessionDate = new Date(dateValue);
    return sessionDate >= startDate;
  });
}

/**
 * Filter chart data by time range using timestamp
 * @param {Array} data - Array of chart data points with date property (timestamp)
 * @param {string} timeRange - Time range option
 * @returns {Array} Filtered data
 */
export function filterChartDataByTimeRange(data, timeRange) {
  if (!data || !Array.isArray(data)) {
    console.warn("Invalid data provided to filterChartDataByTimeRange:", data);
    return [];
  }

  if (data.length === 0) return [];

  // "All time" returns all data
  if (timeRange === "All time") return data;

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
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1);
      break;
    }
    case "Year to date":
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      return data;
  }

  const startTimestamp = startDate.getTime();

  return data.filter(item => {
    if (!item || !item.date) return false;
    // Handle both timestamp numbers and date strings
    const itemTimestamp = typeof item.date === 'number'
      ? item.date
      : new Date(item.date).getTime();
    return !isNaN(itemTimestamp) && itemTimestamp >= startTimestamp;
  });
}

export function calculateKPIs(sessions) {
  if (!sessions || sessions.length === 0) {
    return {
      totalSessions: 0,
      totalTime: "0m",
      avgSessionTime: "0m",
      problemsSolved: 0,
      avgAccuracy: "0%"
    };
  }

  const totalSessions = sessions.length;
  const totalTimeMinutes = sessions.reduce((sum, session) => sum + (session.duration || 0), 0);
  const avgSessionMinutes = totalSessions > 0 ? Math.round(totalTimeMinutes / totalSessions) : 0;
  
  const problemsSolved = sessions.reduce((sum, session) => sum + (session.problems?.length || 0), 0);
  const sessionsWithAccuracy = sessions.filter(session => session.accuracy > 0);
  const avgAccuracy = sessionsWithAccuracy.length > 0 
    ? Math.round(sessionsWithAccuracy.reduce((sum, session) => sum + ((session.accuracy || 0) * 100), 0) / sessionsWithAccuracy.length)
    : 0;

  return {
    totalSessions,
    totalTime: totalTimeMinutes > 60 
      ? `${Math.floor(totalTimeMinutes / 60)}h ${totalTimeMinutes % 60}m`
      : `${totalTimeMinutes}m`,
    avgSessionTime: `${avgSessionMinutes}m`,
    problemsSolved,
    avgAccuracy: `${avgAccuracy}%`
  };
}