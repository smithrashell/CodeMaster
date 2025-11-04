import React, { useState } from "react";
import { Container, Title, Text, Stack, Group, SimpleGrid, Select, Button } from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import { usePageData } from "../../hooks/usePageData";
import { useProductivityData } from "../../hooks/useProductivityData";
import { useProductivityInsights } from "../../hooks/useProductivityInsights";
import { ProductivityKPIs } from "../../components/productivity/ProductivityKPIs";
import { InsightsCard } from "../../components/productivity/InsightsCard";
import { RecommendationsCard } from "../../components/productivity/RecommendationsCard";
import { ProductivityCharts } from "../../components/productivity/ProductivityCharts";

export function ProductivityInsights() {
  const { data: appState, loading, error, refresh} = usePageData('productivity-insights');
  const [timeRange, setTimeRange] = useState("Last 7 days");

  // Use custom hooks for data processing
  const { productivityData, heatmapData, totalSessions, studyStreak, avgAccuracy, peakHour } = useProductivityData(appState, timeRange);
  const insights = useProductivityInsights(appState, productivityData, totalSessions);

  if (loading) return <Container size="xl" p="md"><Text>Loading productivity insights...</Text></Container>;
  if (error) return (
    <Container size="xl" p="md">
      <Text c="red">Error loading productivity data: {error.message}</Text>
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
          <Title order={2}>Productivity Insights</Title>
          <Group gap="sm">
            <Select
              size="sm"
              data={["Last 7 days", "Last 30 days", "Quarter to date", "All time"]}
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

        {/* KPI Strip */}
        <ProductivityKPIs 
          totalSessions={totalSessions}
          avgAccuracy={avgAccuracy}
          peakHour={peakHour}
          timeRange={timeRange}
          appState={appState}
        />

        {/* Insights and Recommendations */}
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <InsightsCard insights={insights} timeRange={timeRange} />
          <RecommendationsCard
            peakHour={peakHour}
            studyStreak={studyStreak}
            avgAccuracy={avgAccuracy}
            totalSessions={totalSessions}
          />
        </SimpleGrid>

        {/* Charts */}
        <ProductivityCharts
          productivityData={productivityData}
          heatmapData={heatmapData}
          timeRange={timeRange}
          peakHour={peakHour}
        />
      </Stack>
    </Container>
  );
}