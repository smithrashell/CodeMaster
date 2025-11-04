import { useState, useEffect } from "react";

// Calculate consecutive days with sessions
const calculateStudyStreak = (sessions) => {
  if (!sessions || sessions.length === 0) return 0;

  // Get unique dates and sort descending (newest first)
  const uniqueDates = [...new Set(
    sessions
      .filter(s => s.status === 'completed')
      .map(s => new Date(s.date || s.Date).toDateString())
  )].sort((a, b) => new Date(b) - new Date(a));

  if (uniqueDates.length === 0) return 0;

  let streak = 1;
  const today = new Date().toDateString();

  // Check if most recent session is today or yesterday
  const mostRecent = uniqueDates[0];
  const daysSinceRecent = Math.floor((new Date(today) - new Date(mostRecent)) / (1000 * 60 * 60 * 24));

  // If most recent session is more than 1 day ago, streak is broken
  if (daysSinceRecent > 1) return 0;

  // Count consecutive days
  for (let i = 0; i < uniqueDates.length - 1; i++) {
    const currentDate = new Date(uniqueDates[i]);
    const nextDate = new Date(uniqueDates[i + 1]);
    const dayDiff = Math.floor((currentDate - nextDate) / (1000 * 60 * 60 * 24));

    if (dayDiff === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
};

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

  // Extract attempted problems from all sessions
  sessions.forEach(session => {
    const problems = session.problems || [];
    const attempts = session.attempts || [];

    problems.forEach(problem => {
      // Only process problems that have been attempted
      if (problem.attempted && problem.attempt_date) {
        const hour = new Date(problem.attempt_date).getHours();
        const timeSlot = `${hour}:00`;

        if (!hourlyPerformance[timeSlot]) {
          hourlyPerformance[timeSlot] = {
            totalAttempts: 0,
            successfulAttempts: 0,
            totalTime: 0
          };
        }

        // Find matching attempt to get success status and time spent
        const matchingAttempt = attempts.find(
          a => a.problem_id === problem.problem_id || a.leetcode_id === problem.leetcode_id
        );

        hourlyPerformance[timeSlot].totalAttempts += 1;
        if (matchingAttempt?.success) {
          hourlyPerformance[timeSlot].successfulAttempts += 1;
        }
        hourlyPerformance[timeSlot].totalTime += (matchingAttempt?.time_spent || 0);
      }
    });
  });

  // Convert to chart data with accuracy calculated from actual attempts
  return Object.entries(hourlyPerformance).map(([time, data]) => ({
    time,
    avgAccuracy: data.totalAttempts > 0
      ? Math.round((data.successfulAttempts / data.totalAttempts) * 100)
      : 0,
    attempts: data.totalAttempts, // Number of attempts (problems solved) in this hour
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

  // Populate with problem attempt data (when problems were actually solved)
  sessions.forEach(session => {
    const problems = session.problems || [];

    problems.forEach(problem => {
      // Only count problems that have been attempted
      if (problem.attempted && problem.attempt_date) {
        const date = new Date(problem.attempt_date);
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

// Calculate difficulty progression over time (sessions)
const calculateDifficultyProgression = (sessions) => {
  // Sort sessions by date (oldest to newest)
  const sortedSessions = sessions
    .filter(s => s.status === 'completed')
    .sort((a, b) => new Date(a.date || a.Date) - new Date(b.date || b.Date));

  // Group by date and count difficulties
  return sortedSessions.map(session => {
    const problems = session.problems || [];
    const attemptedProblems = problems.filter(p => p.attempted);

    const difficultyCount = {
      Easy: 0,
      Medium: 0,
      Hard: 0
    };

    attemptedProblems.forEach(problem => {
      const difficulty = problem.difficulty;
      if (difficultyCount.hasOwnProperty(difficulty)) {
        difficultyCount[difficulty]++;
      }
    });

    // Format date for display
    const sessionDate = new Date(session.date || session.Date);
    const dateStr = sessionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return {
      date: dateStr,
      Easy: difficultyCount.Easy,
      Medium: difficultyCount.Medium,
      Hard: difficultyCount.Hard,
      total: attemptedProblems.length
    };
  });
};

export function useProductivityData(appState, timeRange) {
  const [productivityData, setProductivityData] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [difficultyProgressionData, setDifficultyProgressionData] = useState([]);

  useEffect(() => {
    if (!appState) return;

    // Get all sessions and apply time range filter
    const allSessions = appState.allSessions || [];
    const sessions = filterSessionsByTimeRange(allSessions, timeRange);

    // Debug logging
    console.log('🔍 useProductivityData Debug:', {
      timeRange,
      totalSessions: allSessions.length,
      filteredSessions: sessions.length,
      firstSession: sessions[0],
      firstSessionProblems: sessions[0]?.problems?.length,
      firstSessionAttempts: sessions[0]?.attempts?.length,
      sampleProblem: sessions[0]?.problems?.[0],
      sampleAttempt: sessions[0]?.attempts?.[0],
      attemptedProblems: sessions[0]?.problems?.filter(p => p.attempted)
    });

    // Calculate hourly performance for chart data
    const chartData = calculateHourlyPerformance(sessions);
    setProductivityData(chartData);

    // Calculate weekly heatmap data
    const heatmap = calculateWeeklyHeatmap(sessions);
    setHeatmapData(heatmap);

    // Calculate difficulty progression
    const difficultyProgression = calculateDifficultyProgression(sessions);
    setDifficultyProgressionData(difficultyProgression);
  }, [appState, timeRange]);

  // Calculate summary metrics
  // Count actual completed sessions in the time range (not attempts)
  const allSessions = appState?.allSessions || [];
  const filteredSessions = filterSessionsByTimeRange(allSessions, timeRange);
  const totalSessions = filteredSessions.filter(s => s.status === 'completed').length;

  // Calculate study streak from all sessions (not filtered by time range)
  const studyStreak = calculateStudyStreak(allSessions);

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
    difficultyProgressionData,
    totalSessions,
    studyStreak,
    avgAccuracy,
    peakHour
  };
}