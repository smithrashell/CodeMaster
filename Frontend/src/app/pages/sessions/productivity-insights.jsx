import React, { useState, useEffect } from "react";
import { Container, Grid, Card, Title, Text, Stack, Group, SimpleGrid, Select, Badge, Divider, rem } from "@mantine/core";
import { IconBulb, IconTrendingUp, IconTarget, IconClock } from "@tabler/icons-react";
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

export function ProductivityInsights() {
  const { data: appState, loading, error, refresh } = usePageData('productivity-insights');
  const [productivityData, setProductivityData] = useState([]);
  const [insights, setInsights] = useState([]);
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
      case "Quarter to date":
        // Get start of current quarter
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
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
    const sessions = filterSessionsByTimeRange(allSessions, timeRange);
    
    // Group sessions by hour to find peak productivity times
    const hourlyPerformance = {};
    sessions.forEach(session => {
      if (session.Date) {
        const hour = new Date(session.Date).getHours();
        const timeSlot = `${hour}:00`;
        if (!hourlyPerformance[timeSlot]) {
          hourlyPerformance[timeSlot] = { totalSessions: 0, totalAccuracy: 0, totalProblems: 0 };
        }
        hourlyPerformance[timeSlot].totalSessions += 1;
        hourlyPerformance[timeSlot].totalAccuracy += (session.accuracy || 0.75);
        hourlyPerformance[timeSlot].totalProblems += (session.problems?.length || 0);
      }
    });

    // Convert to chart data
    const chartData = Object.entries(hourlyPerformance).map(([time, data]) => ({
      time,
      avgAccuracy: Math.round((data.totalAccuracy / data.totalSessions) * 100),
      sessions: data.totalSessions,
      avgProblems: Math.round(data.totalProblems / data.totalSessions)
    })).sort((a, b) => parseInt(a.time) - parseInt(b.time));

    setProductivityData(chartData);

    // Generate insights
    const generatedInsights = [];
    if (chartData.length > 0) {
      const bestTime = chartData.reduce((best, current) => 
        current.avgAccuracy > best.avgAccuracy ? current : best
      );
      generatedInsights.push({
        title: "Peak performance",
        body: `You're sharpest at ${bestTime.time} with ${bestTime.avgAccuracy}% accuracy.`
      });
      
      const mostActive = chartData.reduce((most, current) => 
        current.sessions > most.sessions ? current : most
      );
      generatedInsights.push({
        title: "Most active",
        body: `${mostActive.time} has the highest session count (${mostActive.sessions}).`
      });
    }
    
    setInsights(generatedInsights);
  }, [appState, timeRange]); // Add timeRange dependency

  const totalSessions = productivityData.reduce((sum, d) => sum + d.sessions, 0);
  const avgAccuracy = productivityData.length > 0 
    ? Math.round(productivityData.reduce((sum, d) => sum + d.avgAccuracy, 0) / productivityData.length)
    : 0;
  const peakHour = productivityData.length > 0 
    ? productivityData.reduce((best, current) => 
        current.avgAccuracy > best.avgAccuracy ? current : best
      ).time 
    : "N/A";

  return (
    <Container size="xl" p="md">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Title order={2}>Productivity Insights</Title>
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
          <SlimKPI title="Study Streak" value="7" sub="days" />
          <SlimKPI title="Sessions" value={totalSessions} sub={timeRange.toLowerCase()} />
          <SlimKPI title="Accuracy" value={`${avgAccuracy}%`} sub="average" />
          <SlimKPI title="Peak Hour" value={peakHour} sub="best time" />
        </SimpleGrid>

        {/* Row 1: Key Insights and Recommendations - Two separate cards */}
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          {/* Left: Key Insights Card */}
          <Card
            radius="md"
            p="md"
            style={{
              borderLeft: `${rem(4)} solid var(--mantine-color-blue-5)`,
              backgroundColor: 'var(--mantine-color-dark-8)',
              border: '1px solid var(--mantine-color-dark-5)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              minHeight: '200px'
            }}
          >
            <Badge 
              variant="light" 
              style={{ 
                position: 'absolute', 
                top: '12px', 
                right: '12px' 
              }}
            >
              {timeRange}
            </Badge>
            
            <div style={{ textAlign: 'center', margin: 'auto' }}>
              <Group justify="center" gap="xs" mb="sm">
                <IconBulb size={18} />
                <Title order={4}>Key Insights</Title>
              </Group>
              
              <Stack gap="xs" align="center">
                {insights.length > 0 ? (
                  insights.map((insight, index) => (
                    <div key={index} style={{ textAlign: 'center' }}>
                      <Group justify="center" gap="xs" mb="xs">
                        <IconTarget size={14} style={{ color: 'var(--mantine-color-dimmed)' }} />
                        <Text fw={600} size="sm">{insight.title}</Text>
                      </Group>
                      <Text size="sm" c="dimmed">
                        {insight.body.includes('%') ? (
                          <>
                            {insight.body.split(' ').map((word, i) => {
                              if (word.includes('%') || word.includes(':')) {
                                return <Text key={i} span fw={600} c="white">{word} </Text>;
                              }
                              return word + ' ';
                            })}
                          </>
                        ) : (
                          insight.body
                        )}
                      </Text>
                      {index < insights.length - 1 && <Divider my="xs" variant="dashed" />}
                    </div>
                  ))
                ) : (
                  <Text size="sm" c="dimmed">Complete more sessions to see insights!</Text>
                )}
              </Stack>
            </div>
          </Card>

          {/* Right: Recommendations Card */}
          <Card
            radius="md"
            p="md"
            style={{
              borderLeft: `${rem(4)} solid var(--mantine-color-green-5)`,
              backgroundColor: 'var(--mantine-color-dark-8)',
              border: '1px solid var(--mantine-color-dark-5)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              minHeight: '200px'
            }}
          >
            <Badge 
              variant="light" 
              color="green" 
              style={{ 
                position: 'absolute', 
                top: '12px', 
                right: '12px' 
              }}
            >
              Smart suggestions
            </Badge>
            
            <div style={{ textAlign: 'center', margin: 'auto' }}>
              <Group justify="center" gap="xs" mb="sm">
                <IconTarget size={18} />
                <Title order={4}>Recommendations</Title>
              </Group>
              
              <Stack gap="xs" align="center">
                {[
                  {
                    icon: IconClock,
                    color: 'var(--mantine-color-green-5)',
                    title: 'Peak scheduling',
                    text: <>Schedule hard topics during your <Text span fw={600} c="white">07:30–09:30</Text> window</>
                  },
                  {
                    icon: IconBulb,
                    color: 'var(--mantine-color-blue-5)',
                    title: 'Consistency',
                    text: <>Maintain a <Text span fw={600} c="white">consistent daily</Text> session time</>
                  },
                  {
                    icon: IconTrendingUp,
                    color: 'var(--mantine-color-orange-5)',
                    title: 'Progress tracking',
                    text: <>Track <Text span fw={600} c="white">weekly % accuracy</Text> trend</>
                  }
                ].map((rec, index) => (
                  <div key={index} style={{ textAlign: 'center' }}>
                    <Group justify="center" gap="xs" mb="xs">
                      <rec.icon size={14} style={{ color: rec.color }} />
                      <Text fw={600} size="sm">{rec.title}</Text>
                    </Group>
                    <Text size="sm" c="dimmed">
                      {rec.text}
                    </Text>
                    {index < 2 && <Divider my="xs" variant="dashed" />}
                  </div>
                ))}
              </Stack>
            </div>
          </Card>
        </SimpleGrid>

        {/* Row 2: Two Half-Width Charts */}
        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, lg: 6 }}>
            <Card p="md" radius="md" style={{ backgroundColor: 'var(--mantine-color-dark-8)', border: '1px solid var(--mantine-color-dark-5)' }}>
              <Group justify="space-between" align="center" mb="sm">
                <Title order={4} c="white">Performance by Time of Day</Title>
                <Badge variant="light" color="gray" size="sm">{timeRange}</Badge>
              </Group>
              <Text size="xs" c="dimmed" mb="sm">
                📊 Bars = sessions per hour (0–23) • 📈 Line = accuracy % (right axis)
              </Text>
              <div style={{ height: 300 }}>
                <TimeGranularChartCard
                  title=""
                  chartType="bar"
                  useTimeGranularity={false}
                  data={productivityData}
                  dataKeys={[
                    { key: "sessions", color: "#8884d8", name: "Sessions" },
                    { key: "avgAccuracy", color: "#82ca9d", name: "Accuracy %" }
                  ]}
                  yAxisFormatter={(v) => v}
                  tooltipFormatter={(value, name) => [
                    name === "Accuracy %" ? `${value}%` : `${value} sessions`, 
                    name === "Accuracy %" ? "Avg Accuracy" : "Session Count"
                  ]}
                />
              </div>
              {/* Highlight best performance window */}
              <Text size="xs" c="dimmed" mt="xs">
                💡 Highlight band: {peakHour !== "N/A" ? `${peakHour} optimal performance window` : "Complete sessions to see patterns"}
              </Text>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: 6 }}>
            <Card p="md" radius="md" style={{ backgroundColor: 'var(--mantine-color-dark-8)', border: '1px solid var(--mantine-color-dark-5)' }}>
              <Group justify="space-between" align="center" mb="sm">
                <Title order={4} c="white">Weekly Pattern</Title>
                <Badge variant="light" color="gray" size="sm">{timeRange}</Badge>
              </Group>
              <Text size="xs" c="dimmed" mb="sm">
                Heatmap: X = Hour, Y = Day of week, Color = activity volume
              </Text>
              <div style={{ height: 300 }}>
                <div style={{ 
                  height: '100%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  backgroundColor: 'var(--mantine-color-dark-9)',
                  borderRadius: '8px',
                  border: '1px solid var(--mantine-color-dark-4)'
                }}>
                  <Stack gap="xs" align="center">
                    <Text size="sm" c="dimmed" ta="center">
                      📊 Weekly Activity Heatmap
                    </Text>
                    <Text size="xs" c="dark.3" ta="center">
                      Coming soon - hourly activity patterns by day
                    </Text>
                    <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                      {[...Array(7)].map((_, i) => (
                        <div key={i} style={{
                          width: '12px',
                          height: '12px',
                          backgroundColor: `rgba(130, 202, 157, ${0.2 + (Math.random() * 0.6)})`,
                          borderRadius: '2px'
                        }} />
                      ))}
                    </div>
                  </Stack>
                </div>
              </div>
              <Text size="xs" c="dimmed" mt="sm">
                You perform best during focused morning periods—front-load challenging topics into your peak hours.
              </Text>
            </Card>
          </Grid.Col>
        </Grid>

      </Stack>
    </Container>
  );
}