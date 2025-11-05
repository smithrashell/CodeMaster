import { useState, useMemo } from "react";
import { Grid, Card, Group, Title, Select } from "@mantine/core";
import TimeGranularChartCard from "../../components/charts/TimeGranularChartCard";
import { TIME_RANGE_OPTIONS } from "../sessions/sessionTimeUtils";

const CHART_HEIGHT = 320;

export function ProgressCharts({ reviewProblemsData, activityData }) {
  const [newVsReviewTimeRange, setNewVsReviewTimeRange] = useState("Last 7 days");
  const [activityTimeRange, setActivityTimeRange] = useState("Last 7 days");

  // Filter data based on individual time ranges
  // Note: We need to work with the raw session data, not pre-processed chart data
  // So we'll need to pass allSessions instead
  const filteredReviewData = useMemo(() => {
    if (!reviewProblemsData || reviewProblemsData.length === 0) return [];

    // Filter by date range
    const now = new Date();
    let startDate;

    switch (newVsReviewTimeRange) {
      case "Last 7 days":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "Last 30 days":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "Quarter to date": {
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      }
      case "Year to date":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case "All time":
      default:
        return reviewProblemsData;
    }

    return reviewProblemsData.filter(item => item.date >= startDate.getTime());
  }, [reviewProblemsData, newVsReviewTimeRange]);

  const filteredActivityData = useMemo(() => {
    if (!activityData || activityData.length === 0) return [];

    // Filter by date range
    const now = new Date();
    let startDate;

    switch (activityTimeRange) {
      case "Last 7 days":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "Last 30 days":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "Quarter to date": {
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      }
      case "Year to date":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case "All time":
      default:
        return activityData;
    }

    return activityData.filter(item => item.date >= startDate.getTime());
  }, [activityData, activityTimeRange]);

  return (
    <Grid gutter="md" mt="md" align="stretch">
      <Grid.Col span={{ base: 12, lg: 6 }}>
        <Card p="md" radius="md" style={{ backgroundColor: 'var(--mantine-color-dark-8)', border: '1px solid var(--mantine-color-dark-5)' }}>
          <Group justify="space-between" align="center" mb="sm">
            <Title order={4} c="white">New vs Review Problems per Session</Title>
            <Select
              size="xs"
              variant="filled"
              data={TIME_RANGE_OPTIONS}
              value={newVsReviewTimeRange}
              onChange={setNewVsReviewTimeRange}
              style={{ width: 120 }}
            />
          </Group>
          <div style={{ height: CHART_HEIGHT }}>
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
        <Card p="md" radius="md" style={{ backgroundColor: 'var(--mantine-color-dark-8)', border: '1px solid var(--mantine-color-dark-5)' }}>
          <Group justify="space-between" align="center" mb="sm">
            <Title order={4} c="white">Problem Activity per Session</Title>
            <Select
              size="xs"
              variant="filled"
              data={TIME_RANGE_OPTIONS}
              value={activityTimeRange}
              onChange={setActivityTimeRange}
              style={{ width: 120 }}
            />
          </Group>
          <div style={{ height: CHART_HEIGHT }}>
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