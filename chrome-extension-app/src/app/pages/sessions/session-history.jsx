import React, { useState } from "react";
import { Container, Grid, Card, Title, Text, Stack, Group, SimpleGrid, Select, Button } from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import { usePageData } from "../../hooks/usePageData";
import TimeGranularChartCard from "../../components/charts/TimeGranularChartCard";
import { TIME_RANGE_OPTIONS } from "./sessionTimeUtils";
import { useSessionData } from "./useSessionData";
import { RecentSessionsTable } from "./RecentSessionsTable";

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

export function Metrics() {
  const { data: appState, loading, error, refresh} = usePageData('session-history');
  const [timeRange, setTimeRange] = useState("Last 7 days");
  
  const { recentSessions, sessionLengthData, accuracyData, kpis } = useSessionData(appState, timeRange);

  if (loading) return <Container size="xl" p="md"><Text>Loading session history...</Text></Container>;
  if (error) return (
    <Container size="xl" p="md">
      <Text c="red">Error loading session data: {error.message}</Text>
      <Button leftSection={<IconRefresh size={16} />} onClick={refresh} mt="md">
        Retry
      </Button>
    </Container>
  );

  return (
    <Container size="xl" p="md">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Title order={2}>Session History</Title>
          <Group gap="sm">
            <Select
              size="sm"
              data={TIME_RANGE_OPTIONS}
              value={timeRange}
              onChange={setTimeRange}
            />
            <Button 
              leftSection={<IconRefresh size={16} />} 
              variant="light" 
              onClick={refresh}
              size="sm"
            >
              Refresh
            </Button>
          </Group>
        </Group>

        {/* KPI Strip - Slim hero section */}
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
          <SlimKPI title="Total Sessions" value={kpis.totalSessions} sub="completed" />
          <SlimKPI title="Avg Accuracy" value={kpis.avgAccuracy} sub="success rate" />
          <SlimKPI title="Avg Duration" value={kpis.avgSessionTime} sub="per session" />
          <SlimKPI title="Problems Solved" value={kpis.problemsSolved} sub="total" />
        </SimpleGrid>

        {/* Session Trends Charts - Equal weight */}
        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, lg: 6 }}>
            <Card p="md" radius="md" style={{ backgroundColor: 'var(--mantine-color-dark-8)', border: '1px solid var(--mantine-color-dark-5)' }}>
              <Group justify="space-between" align="center" mb="sm">
                <Title order={4} c="white">Session Length Over Time</Title>
                <Select
                  size="xs"
                  variant="filled"
                  data={TIME_RANGE_OPTIONS}
                  value={timeRange}
                  onChange={setTimeRange}
                  style={{ width: 120 }}
                />
              </Group>
              <div style={{ height: 300 }}>
                <TimeGranularChartCard
                  title=""
                  chartType="line"
                  useTimeGranularity={false}
                  data={sessionLengthData}
                  dataKeys={[{ key: "length", color: "#8884d8" }]}
                  yAxisFormatter={(v) => `${v} min`}
                  tooltipFormatter={(value, _name) => [`${value} minutes`, "Duration"]}
                />
              </div>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: 6 }}>
            <Card p="md" radius="md" style={{ backgroundColor: 'var(--mantine-color-dark-8)', border: '1px solid var(--mantine-color-dark-5)' }}>
              <Group justify="space-between" align="center" mb="sm">
                <Title order={4} c="white">Session Accuracy Trends</Title>
                <Select
                  size="xs"
                  variant="filled"
                  data={TIME_RANGE_OPTIONS}
                  value={timeRange}
                  onChange={setTimeRange}
                  style={{ width: 120 }}
                />
              </Group>
              <div style={{ height: 300 }}>
                <TimeGranularChartCard
                  title=""
                  chartType="line"
                  useTimeGranularity={false}
                  data={accuracyData}
                  dataKeys={[{ key: "accuracy", color: "#82ca9d" }]}
                  yAxisFormatter={(v) => `${v}%`}
                  tooltipFormatter={(value, _name) => [`${value}%`, "Accuracy"]}
                />
              </div>
            </Card>
          </Grid.Col>
        </Grid>

        {/* Recent Sessions Table */}
        <RecentSessionsTable recentSessions={recentSessions} />
      </Stack>
    </Container>
  );
}