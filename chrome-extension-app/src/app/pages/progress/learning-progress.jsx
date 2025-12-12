import { Container, Grid, Title, Group, Text, Button, Card } from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import TimeGranularChartCard from "../../components/charts/TimeGranularChartCard";
import { usePageData } from "../../hooks/usePageData";
import { useProgressData } from "./useProgressData";
import { ProgressKPICards } from "./ProgressKPICards";
import { LearningStateDetails } from "./LearningStateDetails";
import { ProgressCharts } from "./ProgressCharts";

export function Progress() {
  const { data: appState, loading, error, refresh } = usePageData('learning-progress');
  const progressData = useProgressData(appState);

  const totalProblems = appState?.boxLevelData ? Object.values(appState.boxLevelData).reduce((a, b) => a + b, 0) : 0;

  console.info("Progress component - appState:", appState);
  console.info("Progress component - loading:", loading);

  // Handle loading and error states after all hooks are called
  if (loading) {
    return (
      <Container size="xl" p="md">
        <Title order={2} mb="md">Leitner System Tracking</Title>
        <Text>Loading progress data...</Text>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="xl" p="md">
        <Title order={2} mb="md">Leitner System Tracking</Title>
        <Text color="red">Error loading progress data: {error.message}</Text>
        <Button leftSection={<IconRefresh size={16} />} onClick={refresh} mt="md">
          Retry
        </Button>
      </Container>
    );
  }

  return (
    <Container size="xl" p="md">
      <Group justify="space-between" mb="md">
        <Title order={2}>
          Leitner System Tracking
        </Title>
        <Button
          leftSection={<IconRefresh size={16} />}
          variant="light"
          onClick={refresh}
          size="sm"
        >
          Refresh
        </Button>
      </Group>
       
      {/* KPI cards */}
      <ProgressKPICards
        totalProblems={totalProblems}
        strategySuccessRate={progressData.strategySuccessRate}
        timerBehavior={progressData.timerBehavior}
        timerPercentage={progressData.timerPercentage}
        nextReviewTime={progressData.nextReviewTime}
        nextReviewCount={progressData.nextReviewCount}
      />

      {/* Box Distribution Chart */}
      <Grid gutter="md" mt="md">
        <Grid.Col span={12}>
          <Card p="md" radius="md" style={{ backgroundColor: 'var(--cm-card-bg)', border: '1px solid var(--cm-border)' }}>
            <Title order={4} mb="sm">Box Distribution</Title>
            <div style={{ height: 280 }}>
              <TimeGranularChartCard
                title=""
                chartType="bar"
                useTimeGranularity={false}
                data={progressData.boxLevelData}
                dataKeys={[{ key: "count", color: "#8884d8" }]}
                yAxisFormatter={(v) => v}
                tooltipFormatter={(value, name) => [`${value}`, name]}
              />
            </div>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Learning State Details */}
      <LearningStateDetails
        currentTier={progressData.currentTier}
        learningStatus={progressData.learningStatus}
        timerBehavior={progressData.timerBehavior}
        progressTrend={progressData.progressTrend}
        progressPercentage={progressData.progressPercentage}
      />

      {/* Charts Section */}
      <ProgressCharts
        reviewProblemsData={progressData.reviewProblemsData}
        activityData={progressData.activityData}
      />
    </Container>
  );
}