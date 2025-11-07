import React from "react";
import { Container, Grid, Card, Title, Text, Group, Button } from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
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
  const { data: appState, loading, error, refresh } = usePageData('tag-mastery');
  // Use real mastery data from services
  const masteryData = appState || {};

  if (loading) return <Container size="xl" p="md"><Text>Loading tag mastery data...</Text></Container>;
  if (error) return (
    <Container size="xl" p="md">
      <Text c="red">Error loading tag mastery data: {error.message}</Text>
      <Button leftSection={<IconRefresh size={16} />} onClick={refresh} mt="md">
        Retry
      </Button>
    </Container>
  );
  
  // Check if we have actual data to display
  const hasData = masteryData.masteryData && masteryData.masteryData.length > 0;

  // Calculate mastery status KPIs only if we have data (support both snake_case and PascalCase)
  const pathData = hasData ? masteryData.masteryData.map(tag => {
    const totalAttempts = tag.total_attempts ?? tag.totalAttempts ?? 0;
    const successfulAttempts = tag.successful_attempts ?? tag.successfulAttempts ?? 0;
    return {
      ...tag,
      progress: totalAttempts > 0 ? Math.round((successfulAttempts / totalAttempts) * 100) : 0
    };
  }) : [];

  // Use the actual 'mastered' field from database which considers min_attempts_required
  const masteredCount = pathData.filter(t => t.mastered === true).length;
  const inProgressCount = pathData.filter(t => !t.mastered && t.progress > 0).length;
  const notStartedCount = pathData.filter(t => t.progress === 0).length;

  // Overall mastery is based on actually mastered tags, not just progress percentage
  const overallMastery = pathData.length > 0 ? Math.round((masteredCount / pathData.length) * 100) : 0;

  const kpiData = [
    { label: "Mastered", value: masteredCount },
    { label: "In Progress", value: inProgressCount },
    { label: "Not Started", value: notStartedCount },
    { label: "Overall Mastery", value: `${overallMastery}%` }
  ];

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="md">
        <Title order={2} style={{ color: "var(--cm-text)" }}>
          Tag Mastery Analytics
        </Title>
        <Button 
          leftSection={<IconRefresh size={16} />} 
          variant="light" 
          onClick={refresh}
          size="sm"
        >
          Refresh
        </Button>
      </Group>
      
      {hasData ? (
        <>
          {/* Mastery Status KPI Grid */}
          <Section title="Mastery Status" style={{ marginBottom: '2.5rem' }}>
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