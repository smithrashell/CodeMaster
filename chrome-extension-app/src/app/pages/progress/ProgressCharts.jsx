import { Grid } from "@mantine/core";
import TimeGranularChartCard from "../../components/charts/TimeGranularChartCard";

const CHART_HEIGHT = 320;

export function ProgressCharts({ reviewProblemsData, activityData }) {
  return (
    <Grid gutter="md" mt="md" align="stretch">
      <Grid.Col span={{ base: 12, lg: 6 }}>
        <TimeGranularChartCard
          title="Problems Reviewed per Session"
          chartType="bar"
          useTimeGranularity={false}
          height={CHART_HEIGHT}
          data={reviewProblemsData}
          dataKeys={[
            { key: "reviewCount", color: "#8884d8" },
          ]}
          yAxisFormatter={(v) => v}
          tooltipFormatter={(value, name) => [`${value} review problems`, name]}
        />
      </Grid.Col>

      <Grid.Col span={{ base: 12, lg: 6 }}>
        <TimeGranularChartCard
          title="Problem Activity per Session"
          chartType="bar"
          useTimeGranularity={false}
          height={CHART_HEIGHT}
          data={activityData}
          dataKeys={[
            { key: "attempted", color: "#8884d8" },
            { key: "passed", color: "#82ca9d" },
            { key: "failed", color: "#ff6b6b" },
          ]}
          yAxisFormatter={(v) => v}
          tooltipFormatter={(value, name) => [`${value}`, name]}
        />
      </Grid.Col>
    </Grid>
  );
}