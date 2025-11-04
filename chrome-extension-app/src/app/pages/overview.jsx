import { useState } from "react";
import { Container, Grid, Title, Button, Group, Select } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { IconRefresh } from "@tabler/icons-react";
import { EmptyStateCard } from "../components/onboarding/EmptyStateCard";
import { FocusAreasDisplay } from "../components/dashboard/FocusAreasDisplay.jsx";
import { usePageData } from "../hooks/usePageData";
import { useStatsState } from "../hooks/useStatsState";
import { StatsMetrics } from "../components/overview/StatsMetrics";
import { StatsCharts } from "../components/overview/StatsCharts";
import { StatsLoadingState } from "../components/overview/StatsLoadingState";
import { StatsErrorState } from "../components/overview/StatsErrorState";
import { TIME_RANGE_OPTIONS } from "./sessions/sessionTimeUtils";


export function Stats() {
  const { data: appState, loading, error, refresh } = usePageData('stats');
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState("All time");
  
  const {
    statistics,
    averageTime,
    successRate,
    hintsUsed,
    learningEfficiencyData,
    accuracyData,
    showStartSessionButton
  } = useStatsState(appState, timeRange);

  const handleStartFirstSession = () => {
    window.open("https://leetcode.com/problems/", "_blank");
  };

  // Handle loading and error states after all hooks are called
  if (loading) {
    return <StatsLoadingState refresh={refresh} />;
  }

  if (error) {
    return <StatsErrorState error={error} refresh={refresh} />;
  }

  return (
    <Container size="xl" p="md" className="dashboard-overview">
      <Group justify="space-between" mb="md" className="dashboard-navigation">
        <Title order={2}>
          General Performance Summary
        </Title>
        <Group gap="sm">
          <Select
            size="sm"
            data={TIME_RANGE_OPTIONS}
            value={timeRange}
            onChange={setTimeRange}
          />
          <Button
            leftSection={<IconRefresh size={16} />}
            variant="light"
            onClick={refresh}
            size="sm"
          >
            Refresh
          </Button>
        </Group>
      </Group>

      {showStartSessionButton ? (
        <EmptyStateCard type="dashboard" onAction={handleStartFirstSession} />
      ) : (
        <>
          <div className="dashboard-metrics">
            <StatsMetrics 
              statistics={statistics}
              averageTime={averageTime}
              successRate={successRate}
              hintsUsed={hintsUsed}
              loading={loading}
            />
          </div>
          
          {/* Focus Areas - Full Width Second Row */}
          <Grid gutter="md" mt="md" className="dashboard-focus-areas">
            <Grid.Col span={12}>
              <FocusAreasDisplay 
                onNavigateToSettings={() => navigate("/settings/general")}
              />
            </Grid.Col>
          </Grid>

          <StatsCharts 
            accuracyData={accuracyData}
            learningEfficiencyData={learningEfficiencyData}
            loading={loading}
          />
        </>
      )}

      {/* <Grid gutter="md" mt="md">
        <Grid.Col span={12}>
          <TimeGranularChartCard
            title="Weekly Activity Progress"
            chartType="bar"
            data={breakdownData}
            dataKeys={[
              { key: "firstTry", color: "#4CAF50" },
              { key: "retrySuccess", color: "#FFC107" },
              { key: "failed", color: "#F44336" },
            ]}
          />
        </Grid.Col>
      </Grid> */}

    </Container>
  );
}