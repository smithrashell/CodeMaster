import { Grid } from "@mantine/core";
import TimeGranularChartCard from "../../components/charts/TimeGranularChartCard";

const CHART_HEIGHT = 320;

export function ProgressCharts({ promotionData, activityData }) {
  return (
    <Grid gutter="md" mt="md" align="stretch">
      <Grid.Col span={{ base: 12, lg: 6 }}>
        <TimeGranularChartCard
          title="Promotion & Demotion Trends"
          chartType="line"
          height={CHART_HEIGHT}
          data={promotionData}
          dataKeys={[
            { key: "promotions", color: "#82ca9d" },
            { key: "demotions", color: "#ff7300" },
          ]}
          yAxisFormatter={(v) => v}
          tooltipFormatter={(value, name) => [`${value}`, name]}
        />
      </Grid.Col>

      <Grid.Col span={{ base: 12, lg: 6 }}>
        <TimeGranularChartCard
          title="Problem Activity Over Time"
          chartType="bar"
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