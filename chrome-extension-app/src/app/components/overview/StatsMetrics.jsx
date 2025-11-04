import { Grid } from "@mantine/core";
import MetricCard from "../analytics/MetricCard";

export function StatsMetrics({ 
  statistics, 
  averageTime, 
  successRate, 
  hintsUsed, 
  loading 
}) {
  return (
    <Grid gutter="sm">
      {/* Summary Cards with progressive loading */}
      <MetricCard
        title="Total Problems Solved"
        value={statistics?.totalSolved ?? 0}
        details={[
          { label: "Mastered", value: statistics?.mastered ?? 0 },
          { label: "In Progress", value: statistics?.inProgress ?? 0 },
          { label: "New", value: statistics?.new ?? 0 },
        ]}
        loading={loading}
      />

      <MetricCard
        title="Average Time Per Problem"
        value={averageTime?.overall ?? 0}
        details={[
          { label: "Easy", value: averageTime?.Easy ?? 0 },
          { label: "Medium", value: averageTime?.Medium ?? 0 },
          { label: "Hard", value: averageTime?.Hard ?? 0 },
          { label: "Time Accuracy", value: `${averageTime?.timeAccuracy ?? 0}%` },
        ]}
        loading={loading}
      />

      <MetricCard
        title="Success Rate"
        value={successRate?.overall ?? 0}
        details={[
          { label: "Easy", value: successRate?.Easy ?? 0 },
          { label: "Medium", value: successRate?.Medium ?? 0 },
          { label: "Hard", value: successRate?.Hard ?? 0 },
        ]}
        loading={loading}
      />

      <MetricCard
        title="Hints Used"
        value={hintsUsed?.total ?? 0}
        details={[
          { label: "Contextual", value: hintsUsed?.contextual ?? 0 },
          { label: "General", value: hintsUsed?.general ?? 0 },
        ]}
        loading={loading}
      />
    </Grid>
  );
}