import { useState, useMemo } from "react";
import { Grid, Card, Group, Title, Select } from "@mantine/core";
import TimeGranularChartCard from "../../components/charts/TimeGranularChartCard";
import { TIME_RANGE_OPTIONS, filterChartDataByTimeRange } from "../sessions/sessionTimeUtils";

const CHART_HEIGHT = 320;

export function ProgressCharts({ reviewProblemsData, activityData }) {
  const [newVsReviewTimeRange, setNewVsReviewTimeRange] = useState("Last 7 days");
  const [activityTimeRange, setActivityTimeRange] = useState("Last 7 days");

  // Filter data based on individual time ranges using shared utility
  const filteredReviewData = useMemo(() => {
    return filterChartDataByTimeRange(reviewProblemsData, newVsReviewTimeRange);
  }, [reviewProblemsData, newVsReviewTimeRange]);

  const filteredActivityData = useMemo(() => {
    return filterChartDataByTimeRange(activityData, activityTimeRange);
  }, [activityData, activityTimeRange]);

  return (
    <Grid gutter="md" mt="md" align="stretch">
      <Grid.Col span={{ base: 12, lg: 6 }}>
        <Card p="md" radius="md" style={{ backgroundColor: 'var(--mantine-color-dark-8)', border: '1px solid var(--mantine-color-dark-5)', height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Group justify="space-between" align="center" mb="sm">
            <Title order={4}>New vs Review Problems per Session</Title>
            <Select
              size="xs"
              variant="filled"
              data={TIME_RANGE_OPTIONS}
              value={newVsReviewTimeRange}
              onChange={setNewVsReviewTimeRange}
              style={{ width: 120 }}
            />
          </Group>
          <div style={{ height: CHART_HEIGHT, flex: 1 }}>
            <TimeGranularChartCard
              title=""
              chartType="bar"
              useTimeGranularity={false}
              data={filteredReviewData}
              dataKeys={[
                { key: "newProblems", color: "#8884d8" },
                { key: "reviewProblems", color: "#82ca9d" },
              ]}
              yAxisFormatter={(v) => v}
              tooltipFormatter={(value, name) => {
                const label = name === "newProblems" ? "new problems" : "review problems";
                return [`${value} ${label}`, name];
              }}
            />
          </div>
        </Card>
      </Grid.Col>

      <Grid.Col span={{ base: 12, lg: 6 }}>
        <Card p="md" radius="md" style={{ backgroundColor: 'var(--mantine-color-dark-8)', border: '1px solid var(--mantine-color-dark-5)', height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Group justify="space-between" align="center" mb="sm">
            <Title order={4}>Problem Activity per Session</Title>
            <Select
              size="xs"
              variant="filled"
              data={TIME_RANGE_OPTIONS}
              value={activityTimeRange}
              onChange={setActivityTimeRange}
              style={{ width: 120 }}
            />
          </Group>
          <div style={{ height: CHART_HEIGHT, flex: 1 }}>
            <TimeGranularChartCard
              title=""
              chartType="bar"
              useTimeGranularity={false}
              data={filteredActivityData}
              dataKeys={[
                { key: "attempted", color: "#8884d8" },
                { key: "passed", color: "#82ca9d" },
                { key: "failed", color: "#ff6b6b" },
              ]}
              yAxisFormatter={(v) => v}
              tooltipFormatter={(value, name) => [`${value}`, name]}
            />
          </div>
        </Card>
      </Grid.Col>
    </Grid>
  );
}