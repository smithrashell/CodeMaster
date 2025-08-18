import React from "react";
import { Container, Grid, Card, Title, Text, Group } from "@mantine/core";
import MasteryDashboard from "../../components/analytics/MasteryDashboard.jsx";

// Shared Components from mockup.jsx
function Section({ title, right, children }) {
  return (
    <Card withBorder radius="md" p="md" style={{ background: "var(--surface)", boxShadow: "var(--shadow)" }}>
      <Group justify="space-between" mb="xs">
        <Text fw={700} c="var(--text)">{title}</Text>
        {right}
      </Group>
      {children}
    </Card>
  );
}

function Kpis({ items }) {
  return (
    <Grid gutter="sm">
      {items.map((k) => (
        <Grid.Col key={k.label} span={{ base: 6, sm: 3 }}>
          <Card withBorder p="sm" style={{ background: "var(--surface)" }}>
            <Text c="var(--muted)" size="xs">{k.label}</Text>
            <Text fw={800} fz="xl" c="var(--text)">{k.value}</Text>
          </Card>
        </Grid.Col>
      ))}
    </Grid>
  );
}

export function TagMastery({ appState }) {
  // Enhanced Tag Mastery with MasteryDashboard integration
  // Use appState data when available, otherwise fall back to static mock data
  const masteryData = appState || {
    currentTier: "Core Concept",
    masteredTags: ["array", "hash-table"],
    allTagsInCurrentTier: [
      "array", "hash-table", "string", "two-pointers", 
      "binary-search", "sliding-window", "dynamic-programming",
      "greedy", "stack", "queue", "heap", "tree", "graph"
    ],
    focusTags: ["string", "two-pointers", "dynamic-programming"],
    tagsinTier: [
      "array", "hash-table", "string", "two-pointers", 
      "binary-search", "sliding-window"
    ],
    unmasteredTags: [
      "string", "two-pointers", "binary-search", "sliding-window", 
      "dynamic-programming", "greedy", "stack", "queue", "heap", "tree", "graph"
    ],
    masteryData: [
      { tag: "array", totalAttempts: 15, successfulAttempts: 12 },
      { tag: "hash-table", totalAttempts: 10, successfulAttempts: 9 },
      { tag: "string", totalAttempts: 8, successfulAttempts: 5 },
      { tag: "two-pointers", totalAttempts: 6, successfulAttempts: 3 },
      { tag: "binary-search", totalAttempts: 4, successfulAttempts: 2 },
      { tag: "sliding-window", totalAttempts: 3, successfulAttempts: 1 },
      { tag: "dynamic-programming", totalAttempts: 12, successfulAttempts: 4 },
      { tag: "greedy", totalAttempts: 5, successfulAttempts: 2 },
      { tag: "stack", totalAttempts: 7, successfulAttempts: 4 },
      { tag: "queue", totalAttempts: 4, successfulAttempts: 2 },
      { tag: "heap", totalAttempts: 6, successfulAttempts: 2 },
      { tag: "tree", totalAttempts: 9, successfulAttempts: 3 },
      { tag: "graph", totalAttempts: 8, successfulAttempts: 2 }
    ]
  };

  // Calculate mastery status KPIs
  const pathData = masteryData.masteryData.map(tag => ({
    ...tag,
    progress: tag.totalAttempts > 0 ? Math.round((tag.successfulAttempts / tag.totalAttempts) * 100) : 0
  }));

  const masteredCount = pathData.filter(t => t.progress >= 80).length;
  const inProgressCount = pathData.filter(t => t.progress >= 30 && t.progress < 80).length;
  const notStartedCount = pathData.filter(t => t.progress < 30).length;
  const overallMastery = pathData.length > 0 ? Math.round(pathData.reduce((acc, t) => acc + t.progress, 0) / pathData.length) : 0;

  const kpiData = [
    { label: "Mastered", value: masteredCount },
    { label: "In Progress", value: inProgressCount },
    { label: "Not Started", value: notStartedCount },
    { label: "Overall Mastery", value: `${overallMastery}%` }
  ];

  return (
    <Container size="xl" py="md">
      <Title order={2} mb="md" style={{ color: "var(--cm-text)" }}>
        Tag Mastery Analytics
      </Title>
      
      {/* Mastery Status KPI Grid */}
      <Section title="Mastery Status" style={{ marginBottom: '1rem' }}>
        <Kpis items={kpiData} />
      </Section>
      
      {/* Use the comprehensive MasteryDashboard component */}
      <MasteryDashboard data={masteryData} />
    </Container>
  );
}