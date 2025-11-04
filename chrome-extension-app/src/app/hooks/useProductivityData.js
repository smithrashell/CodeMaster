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

// Calculate hourly performance data using attempt timestamps (not session creation time)
const calculateHourlyPerformance = (sessions) => {
  const hourlyPerformance = {};

  // Extract all attempts from all sessions
  sessions.forEach(session => {
    const attempts = session.attempts || [];
    attempts.forEach(attempt => {
      const attemptDate = attempt.attempt_date;
      if (attemptDate) {
        const hour = new Date(attemptDate).getHours();
        const timeSlot = `${hour}:00`;

        if (!hourlyPerformance[timeSlot]) {
          hourlyPerformance[timeSlot] = {
            totalAttempts: 0,
            successfulAttempts: 0,
            totalTime: 0
          };
        }

        hourlyPerformance[timeSlot].totalAttempts += 1;
        if (attempt.success) {
          hourlyPerformance[timeSlot].successfulAttempts += 1;
        }
        hourlyPerformance[timeSlot].totalTime += (attempt.time_spent || 0);
      }
    });
  });

  // Convert to chart data with accuracy calculated from actual attempts
  return Object.entries(hourlyPerformance).map(([time, data]) => ({
    time,
    avgAccuracy: data.totalAttempts > 0
      ? Math.round((data.successfulAttempts / data.totalAttempts) * 100)
      : 0,
    sessions: data.totalAttempts, // Number of attempts (problems solved) in this hour
    avgTime: data.totalAttempts > 0
      ? Math.round(data.totalTime / data.totalAttempts)
      : 0
  })).sort((a, b) => parseInt(a.time) - parseInt(b.time));
};

// Calculate weekly heatmap data using attempt timestamps (day of week x hour)
const calculateWeeklyHeatmap = (sessions) => {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const heatmapData = [];

  // Initialize heatmap structure: 7 days x 24 hours
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      heatmapData.push({
        day: dayNames[day],
        dayIndex: day,
        hour: hour,
        hourLabel: `${hour.toString().padStart(2, '0')}:00`,
        count: 0
      });
    }
  }

  // Populate with attempt data (when problems were actually solved)
  sessions.forEach(session => {
    const attempts = session.attempts || [];
    attempts.forEach(attempt => {
      const attemptDate = attempt.attempt_date;
      if (attemptDate) {
        const date = new Date(attemptDate);
        const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
        const hour = date.getHours();

        // Find matching cell and increment count
        const cell = heatmapData.find(d => d.dayIndex === dayOfWeek && d.hour === hour);
        if (cell) {
          cell.count += 1;
        }
      }
    });
  });

  return heatmapData;
};

export function useProductivityData(appState, timeRange) {
  const [productivityData, setProductivityData] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);

  useEffect(() => {
    if (!appState) return;

    // Get all sessions and apply time range filter
    const allSessions = appState.allSessions || [];
    const sessions = filterSessionsByTimeRange(allSessions, timeRange);

    // Calculate hourly performance for chart data
    const chartData = calculateHourlyPerformance(sessions);
    setProductivityData(chartData);

    // Calculate weekly heatmap data
    const heatmap = calculateWeeklyHeatmap(sessions);
    setHeatmapData(heatmap);
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
    heatmapData,
    totalSessions,
    avgAccuracy,
    peakHour
  };
}