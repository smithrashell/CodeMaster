import { Grid } from "@mantine/core";
import TimeGranularChartCard from "../charts/TimeGranularChartCard";
import ChartSkeleton from "../charts/ChartSkeleton";

export function StatsCharts({ 
  accuracyData, 
  learningEfficiencyData, 
  loading 
}) {
  return (
    <Grid gutter="md" mt="md">
      <Grid.Col span={6}>
        {loading ? (
          <ChartSkeleton title="Accuracy Trend" />
        ) : (
          <TimeGranularChartCard
            title="Accuracy Trend"
            chartType="line"
            data={accuracyData}
            dataKeys={[{ key: "accuracy", color: "#8884d8" }]}
            yAxisFormatter={(val) => `${val}%`}
            tooltipFormatter={(val) => `${val}%`}
          />
        )}
      </Grid.Col>
      <Grid.Col span={6}>
        {loading ? (
          <ChartSkeleton title="Learning Efficiency" />
        ) : (
          <TimeGranularChartCard
            title="Learning Efficiency"
            chartType="line"
            data={learningEfficiencyData}
            dataKeys={[{ key: "efficiency", color: "#82ca9d" }]}
            yAxisFormatter={(val) => `${val}`}
            tooltipFormatter={(val) => `${val} problems per hint`}
          />
        )}
      </Grid.Col>
    </Grid>
  );
}