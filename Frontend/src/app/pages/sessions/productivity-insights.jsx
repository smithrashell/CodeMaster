import React, { useState } from "react";
import { Container, Title, Stack, Group, SimpleGrid, Select } from "@mantine/core";
import { usePageData } from "../../hooks/usePageData";
import { useProductivityData } from "../../hooks/useProductivityData";
import { useProductivityInsights } from "../../hooks/useProductivityInsights";
import { ProductivityKPIs } from "../../components/productivity/ProductivityKPIs";
import { InsightsCard } from "../../components/productivity/InsightsCard";
import { RecommendationsCard } from "../../components/productivity/RecommendationsCard";
import { ProductivityCharts } from "../../components/productivity/ProductivityCharts";

export function ProductivityInsights() {
  const { data: appState, loading: _loading, error: _error, refresh: _refresh } = usePageData('productivity-insights');
  const [timeRange, setTimeRange] = useState("Last 7 days");

  // Use custom hooks for data processing
  const { productivityData, totalSessions, avgAccuracy, peakHour } = useProductivityData(appState, timeRange);
  const insights = useProductivityInsights(appState, productivityData, totalSessions);

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
          <RecommendationsCard />
        </SimpleGrid>

        {/* Charts */}
        <ProductivityCharts 
          productivityData={productivityData}
          timeRange={timeRange}
          peakHour={peakHour}
        />
      </Stack>
    </Container>
  );
}