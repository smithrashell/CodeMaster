import React, { useState, useEffect } from "react";
import { Container, Grid, Card, Title, Text, Stack, ScrollArea, Group, SimpleGrid, Select, Badge } from "@mantine/core";
import TimeGranularChartCard from "../../components/charts/TimeGranularChartCard";

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

export function Metrics({ appState }) {
  const [sessionData, setSessionData] = useState([]);
  const [recentSessions, setRecentSessions] = useState([]);
  const [timeRange, setTimeRange] = useState("Last 7 days");

  useEffect(() => {
    if (!appState) return;

    // Process session analytics for charts
    const sessions = appState.allSessions || [];
    const processedData = sessions.slice(-14).map((session, index) => ({
      name: `Day ${index + 1}`,
      length: session.duration || Math.floor(Math.random() * 30) + 30, // Fallback to mock if no duration
      accuracy: Math.round((session.accuracy || 0.75) * 100),
      problems: session.problems?.length || 0
    }));

    setSessionData(processedData);
    setRecentSessions(sessions.slice(-10)); // Last 10 sessions for table
  }, [appState]);

  const sessionLengthData = sessionData;
  const accuracyData = sessionData.map(d => ({ name: d.name, accuracy: d.accuracy }));
  
  // Calculate KPI values
  const totalSessions = recentSessions.length || 0;
  const avgAccuracy = sessionData.length > 0 
    ? Math.round(sessionData.reduce((acc, s) => acc + s.accuracy, 0) / sessionData.length) 
    : 0;
  const avgDuration = sessionData.length > 0 
    ? Math.round(sessionData.reduce((acc, s) => acc + s.length, 0) / sessionData.length) 
    : 0;
  const totalProblems = sessionData.reduce((acc, s) => acc + (s.problems || 0), 0);

  return (
    <Container size="xl" p="md">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Title order={2}>Session History</Title>
          <Group gap="sm">
            <Select
              size="sm"
              data={["Last 7 days", "Last 30 days", "Quarter to date", "All time"]}
              value={timeRange}
              onChange={setTimeRange}
            />
          </Group>
        </Group>

        {/* KPI Strip - Slim hero section */}
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
          <SlimKPI title="Total Sessions" value={totalSessions} sub="completed" />
          <SlimKPI title="Avg Accuracy" value={`${avgAccuracy}%`} sub="success rate" />
          <SlimKPI title="Avg Duration" value={`${avgDuration}m`} sub="per session" />
          <SlimKPI title="Problems Solved" value={totalProblems} sub="total" />
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
                  data={["Last 7 days", "Last 30 days", "Quarter to date", "All time"]}
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
                  tooltipFormatter={(value, name) => [`${value} minutes`, "Duration"]}
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
                  data={["Last 7 days", "Last 30 days", "Quarter to date", "All time"]}
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
                  tooltipFormatter={(value, name) => [`${value}%`, "Accuracy"]}
                />
              </div>
            </Card>
          </Grid.Col>
        </Grid>

        {/* Recent Sessions Table */}
        <Card p="md" radius="md" style={{ backgroundColor: 'var(--mantine-color-dark-8)', border: '1px solid var(--mantine-color-dark-5)' }}>
          <Group justify="space-between" align="center" mb="sm">
            <Title order={4} c="white">Recent Sessions</Title>
            <Badge variant="light" color="gray" size="sm">Last 10 sessions</Badge>
          </Group>
          <ScrollArea>
            <table className="cm-table">
              <thead className="cm-table-header">
                <tr>
                  <th className="cm-table-th">Date</th>
                  <th className="cm-table-th">Duration</th>
                  <th className="cm-table-th">Problems</th>
                  <th className="cm-table-th">Accuracy</th>
                  <th className="cm-table-th">Status</th>
                </tr>
              </thead>
              <tbody className="cm-table-body">
                {recentSessions.map((session, index) => (
                  <tr key={session.sessionId || index} className="cm-table-row">
                    <td className="cm-table-td cm-table-primary">{new Date(session.Date || Date.now()).toLocaleDateString()}</td>
                    <td className="cm-table-td cm-table-primary">{session.duration || 'N/A'} min</td>
                    <td className="cm-table-td cm-table-primary">{session.problems?.length || 0}</td>
                    <td className="cm-table-td cm-table-primary">{Math.round((session.accuracy || 0.75) * 100)}%</td>
                    <td className="cm-table-td cm-table-secondary">
                      <span className={`cm-table-status ${session.completed ? 'completed' : 'in-progress'}`}>
                        {session.completed ? "Completed" : "In Progress"}
                      </span>
                    </td>
                  </tr>
                ))}
                {recentSessions.length === 0 && (
                  <tr className="cm-table-row">
                    <td colSpan={5} className="cm-table-td cm-table-empty">
                      <Text c="dimmed">No recent sessions found. Start practicing to see your session history!</Text>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </ScrollArea>
        </Card>
      </Stack>
    </Container>
  );
}