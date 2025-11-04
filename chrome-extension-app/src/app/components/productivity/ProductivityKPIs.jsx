import React from "react";
import { SimpleGrid, Card, Text, Group } from "@mantine/core";

// Reusable Slim KPI Card Component
function SlimKPI({ title, value, sub }) {
  return (
    <Card p="sm" radius="md" style={{ backgroundColor: 'var(--mantine-color-dark-7)', border: '1px solid var(--mantine-color-dark-5)' }}>
      <Text size="xs" c="dimmed" mb={2}>{title}</Text>
      <Group align="baseline" gap={4}>
        <Text fw={700} size="lg" c="white">{value}</Text>
        {sub && <Text size="xs" c="dimmed">{sub}</Text>}
      </Group>
    </Card>
  );
}

// Calculate consecutive days with sessions
function calculateStudyStreak(sessions) {
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

export function ProductivityKPIs({ totalSessions, avgAccuracy, peakHour, timeRange, appState }) {
  // Calculate actual study streak from session dates
  const studyStreak = calculateStudyStreak(appState?.allSessions || []);

  // Calculate reflection rate using actual problem count instead of assuming 3 per session
  const totalProblems = (appState?.allSessions || [])
    .filter(s => s.status === 'completed')
    .reduce((sum, s) => sum + (s.problems?.length || 0), 0);

  // Debug logging
  console.log('🔍 ProductivityKPIs Debug:', {
    reflectionData: appState?.reflectionData,
    reflectionsCount: appState?.reflectionData?.reflectionsCount,
    totalProblems,
    totalAttempts: appState?.reflectionData?.totalAttempts
  });

  const reflectionRate = totalProblems > 0
    ? Math.round(((appState?.reflectionData?.reflectionsCount || 0) / totalProblems) * 100)
    : 0;

  return (
    <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="sm">
      <SlimKPI title="Study Streak" value={studyStreak} sub="days" />
      <SlimKPI title="Sessions" value={totalSessions} sub={timeRange.toLowerCase()} />
      <SlimKPI title="Accuracy" value={`${avgAccuracy}%`} sub="average" />
      <SlimKPI title="Peak Hour" value={peakHour} sub="best time" />
      <SlimKPI title="Reflection Rate" value={`${reflectionRate}%`} sub="engagement" />
    </SimpleGrid>
  );
}