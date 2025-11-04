// Calculate consecutive days with sessions
export function calculateStudyStreak(sessions) {
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
}
