import React, { useState, useEffect } from "react";
import { Container, Grid, Card, Title, Text, Stack, ScrollArea, Group, SimpleGrid, Select, Badge } from "@mantine/core";
import { usePageData } from "../../hooks/usePageData";
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

export function Metrics() {
  const { data: appState, loading: _loading, error: _error, refresh: _refresh } = usePageData('session-history');
  const [sessionData, setSessionData] = useState([]);
  const [recentSessions, setRecentSessions] = useState([]);
  const [timeRange, setTimeRange] = useState("Last 7 days");

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

  useEffect(() => {
    if (!appState) return;

    // Get all sessions and apply time range filter
    const allSessions = appState.allSessions || [];
    const filteredSessions = filterSessionsByTimeRange(allSessions, timeRange);
    
    // Process filtered sessions for charts (limit to last 14 for chart readability)
    const sessionsForChart = filteredSessions.slice(-14);
    const processedData = sessionsForChart.map((session, index) => ({
      name: `Day ${index + 1}`,
      length: session.duration || Math.floor(Math.random() * 30) + 30, // Fallback to mock if no duration
      accuracy: Math.round((session.accuracy || 0.75) * 100),
      problems: session.problems?.length || 0
    }));

    setSessionData(processedData);
    // Use filtered sessions for recent sessions table (limit to last 10 for table)
    setRecentSessions(filteredSessions.slice(-10));
  }, [appState, timeRange]); // Add timeRange dependency

  const sessionLengthData = sessionData;
  const accuracyData = sessionData.map(d => ({ name: d.name, accuracy: d.accuracy }));
  
  // Calculate KPI values from filtered data
  const filteredSessionsForKPI = appState?.allSessions 
    ? filterSessionsByTimeRange(appState.allSessions, timeRange) 
    : [];
  
  // Only count sessions that are actually completed (same logic as Recent Sessions table)
  const completedSessions = filteredSessionsForKPI.filter(session => {
    const hasAttempts = session.attempts && session.attempts.length > 0;
    return (session.status === "completed" || session.completed === true) && hasAttempts;
  });
  
  const totalSessions = completedSessions.length || 0;
  // Calculate averages based on completed sessions for accuracy
  const avgAccuracy = completedSessions.length > 0 
    ? Math.round(completedSessions.reduce((acc, session) => acc + ((session.accuracy || 0) * 100), 0) / completedSessions.length) 
    : 0;
  
  const avgDuration = completedSessions.length > 0 
    ? Math.round(completedSessions.reduce((acc, session) => acc + (session.duration || 0), 0) / completedSessions.length) 
    : 0;
  
  const totalProblems = completedSessions.reduce((acc, session) => acc + (session.problems?.length || 0), 0);

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
                  tooltipFormatter={(value, _name) => [`${value}%`, "Accuracy"]}
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
                {recentSessions.map((session, index) => {
                  const hasAttempts = session.attempts && session.attempts.length > 0;
                  const isCompleted = (session.status === "completed" || session.completed === true) && hasAttempts;
                  const sessionDate = session.Date || session.date || Date.now();
                  
                  return (
                    <tr key={session.sessionId || session.id || index} className="cm-table-row">
                      <td className="cm-table-td cm-table-primary">{new Date(sessionDate).toLocaleDateString()}</td>
                      <td className="cm-table-td cm-table-primary">
                        {isCompleted ? (session.duration || 'N/A') + ' min' : 'Ongoing'}
                      </td>
                      <td className="cm-table-td cm-table-primary">{session.problems?.length || 0}</td>
                      <td className="cm-table-td cm-table-primary">
                        {isCompleted ? `${Math.round((session.accuracy || 0) * 100)}%` : '—'}
                      </td>
                      <td className="cm-table-td cm-table-secondary">
                        <span className={`cm-table-status ${isCompleted ? 'completed' : 'in-progress'}`}>
                          {isCompleted ? "Completed" : "In Progress"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
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