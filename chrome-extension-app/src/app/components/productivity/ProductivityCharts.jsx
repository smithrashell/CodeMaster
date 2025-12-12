import React from "react";
import { Grid, Card, Group, Title, Badge, Text, Stack } from "@mantine/core";
import TimeGranularChartCard from "../charts/TimeGranularChartCard";
import { HeatmapChart } from "./HeatmapChart";

export function ProductivityCharts({ difficultyProgressionData, heatmapData, timeRange }) {
  return (
    <Grid gutter="lg">
      <Grid.Col span={{ base: 12, lg: 6 }}>
        <Card p="md" radius="md" style={{ backgroundColor: 'var(--cm-card-bg)', border: '1px solid var(--cm-border)' }}>
          <Group justify="space-between" align="center" mb="sm">
            <Title order={4}>Difficulty Progression</Title>
            <Badge variant="light" color="gray" size="sm">{timeRange}</Badge>
          </Group>
          <Text size="xs" mb="sm">
            📊 Track your problem difficulty distribution across sessions
          </Text>
          {difficultyProgressionData.length > 0 ? (
            <>
              <div style={{ height: 300 }}>
                <TimeGranularChartCard
                  title=""
                  chartType="bar"
                  useTimeGranularity={false}
                  data={difficultyProgressionData}
                  dataKeys={[
                    { key: "Easy", color: "#82ca9d", name: "Easy", stackId: "a" },
                    { key: "Medium", color: "#ffc658", name: "Medium", stackId: "a" },
                    { key: "Hard", color: "#ff8042", name: "Hard", stackId: "a" }
                  ]}
                  yAxisFormatter={(v) => v}
                  tooltipFormatter={(value, name) => [`${value} problems`, name]}
                />
              </div>
              <Text size="xs" mt="xs">
                💡 Stacked bars show problem difficulty mix per session - aim to progressively tackle harder problems
              </Text>
            </>
          ) : (
            <Stack gap="xs" align="center" style={{ height: 300, justifyContent: 'center' }}>
              <Text size="sm">No completed sessions in this time range</Text>
              <Text size="xs" c="dark.3">Complete sessions to see difficulty progression</Text>
            </Stack>
          )}
        </Card>
      </Grid.Col>

      <Grid.Col span={{ base: 12, lg: 6 }}>
        <Card p="md" radius="md" style={{ backgroundColor: 'var(--cm-card-bg)', border: '1px solid var(--cm-border)' }}>
          <Group justify="space-between" align="center" mb="sm">
            <Title order={4}>Weekly Pattern</Title>
            <Badge variant="light" color="gray" size="sm">{timeRange}</Badge>
          </Group>
          <Text size="xs" mb="sm">
            Heatmap: Hour (0-23) by Day of week, Color intensity = attempt count
          </Text>
          <div style={{ height: 300, overflowY: 'auto' }}>
            <HeatmapChart data={heatmapData} />
          </div>
          <Text size="xs" mt="sm">
            💡 Darker cells indicate more study activity - use this to identify your productive time slots
          </Text>
        </Card>
      </Grid.Col>
    </Grid>
  );
}