import React from "react";
import { SimpleGrid, Card, Text, Group } from "@mantine/core";
import { calculateStudyStreak } from "../../utils/productivityUtils";

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

export function ProductivityKPIs({ totalSessions, avgAccuracy, peakHour, timeRange, appState }) {
  // Calculate actual study streak from session dates
  const studyStreak = calculateStudyStreak(appState?.allSessions || []);

  // Calculate reflection rate using actual problem count instead of assuming 3 per session
  const totalProblems = (appState?.allSessions || [])
    .filter(s => s.status === 'completed')
    .reduce((sum, s) => sum + (s.problems?.length || 0), 0);

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