import React from "react";
import { Grid, Card, Group, Title, Badge, Text, Stack } from "@mantine/core";
import TimeGranularChartCard from "../charts/TimeGranularChartCard";

export function ProductivityCharts({ productivityData, timeRange, peakHour }) {
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
  );
}