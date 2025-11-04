import React from "react";
import { Grid, Card, Group, Title, Badge, Text, Stack } from "@mantine/core";
import TimeGranularChartCard from "../charts/TimeGranularChartCard";
import { HeatmapChart } from "./HeatmapChart";

export function ProductivityCharts({ productivityData, heatmapData, timeRange, peakHour }) {
  return (
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
            Heatmap: Hour (0-23) by Day of week, Color intensity = session count
          </Text>
          <div style={{ height: 300, overflowY: 'auto' }}>
            <HeatmapChart data={heatmapData} />
          </div>
          <Text size="xs" c="dimmed" mt="sm">
            💡 Darker cells indicate more study activity - use this to identify your productive time slots
          </Text>
        </Card>
      </Grid.Col>
    </Grid>
  );
}