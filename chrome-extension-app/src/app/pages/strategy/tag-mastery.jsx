import React from "react";
import { Container, Grid, Card, Title, Text, Group, Button } from "@mantine/core";
import { usePageData } from "../../hooks/usePageData";
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

export function TagMastery() {
  const { data: appState } = usePageData('tag-mastery');
  // Use real mastery data from services
  const masteryData = appState || {};
  
  // Check if we have actual data to display
  const hasData = masteryData.masteryData && masteryData.masteryData.length > 0;

  // Calculate mastery status KPIs only if we have data
  const pathData = hasData ? masteryData.masteryData.map(tag => ({
    ...tag,
    progress: tag.totalAttempts > 0 ? Math.round((tag.successfulAttempts / tag.totalAttempts) * 100) : 0
  })) : [];

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
      
      {hasData ? (
        <>
          {/* Mastery Status KPI Grid */}
          <Section title="Mastery Status" style={{ marginBottom: '1rem' }}>
            <Kpis items={kpiData} />
          </Section>
          
          {/* Use the comprehensive MasteryDashboard component */}
          <MasteryDashboard data={masteryData} />
        </>
      ) : (
        <Card withBorder p="xl" style={{ textAlign: 'center' }}>
          <Text size="lg" fw={600} mb="md" c="var(--cm-text)">No Tag Mastery Data Yet</Text>
          <Text size="sm" c="dimmed" mb="lg">
            Complete some coding sessions to see your tag mastery progress and analytics.
          </Text>
          <Button 
            variant="light" 
            onClick={() => window.open("https://leetcode.com/problems/", "_blank")}
          >
            Start Your First Session
          </Button>
        </Card>
      )}
    </Container>
  );
}