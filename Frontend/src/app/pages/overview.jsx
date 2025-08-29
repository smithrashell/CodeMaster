import { Container, Grid, Title, Text, Button, Group } from "@mantine/core";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconRefresh } from "@tabler/icons-react";
import MetricCard from "../components/analytics/MetricCard";
import TimeGranularChartCard from "../components/charts/TimeGranularChartCard";
import ChartSkeleton from "../components/charts/ChartSkeleton";
import { EmptyStateCard } from "../components/onboarding/EmptyStateCard";
import {
  getAccuracyTrendData,
  getAttemptBreakdownData,
} from "../../shared/utils/DataAdapter.js";
import { checkContentOnboardingStatus } from "../../shared/services/onboardingService.js";
import { shouldUseMockDashboard } from "../config/mockConfig.js";
import { FocusAreasDisplay } from "../components/dashboard/FocusAreasDisplay.jsx";
import { usePageData } from "../hooks/usePageData";

export function Stats() {
  const { data: appState, loading, error, refresh } = usePageData('stats');
  const navigate = useNavigate();
  const [statistics, setStatistics] = useState(appState?.statistics);
  const [averageTime, setAverageTime] = useState(appState?.averageTime);
  const [successRate, setSuccessRate] = useState(appState?.successRate);
  const [allSessions, setAllSessions] = useState(appState?.allSessions);
  const [hintsUsed, setHintsUsed] = useState(appState?.hintsUsed);
  const [learningEfficiencyData, setLearningEfficiencyData] = useState(appState?.learningEfficiencyData);
  const [contentOnboardingCompleted, setContentOnboardingCompleted] =
    useState(null);
  const [accuracyData, setAccuracyData] = useState({
    weekly: null,
    monthly: null,
    yearly: null,
  });
  const [_breakdownData, setBreakdownData] = useState({
    weekly: null,
    monthly: null,
    yearly: null,
  });

  // Check content onboarding status
  useEffect(() => {
    const checkContentStatus = async () => {
      try {
        const status = await checkContentOnboardingStatus();
        setContentOnboardingCompleted(status.isCompleted);
      } catch (error) {
        console.error("Error checking content onboarding status:", error);
        setContentOnboardingCompleted(false);
      }
    };
    checkContentStatus();
  }, []);

  useEffect(() => {
    console.info("📊 Overview received appState:", appState);
    console.info("📊 Overview appState analysis:", {
      hasAppState: !!appState,
      hasStatistics: !!appState?.statistics,
      totalSolved: appState?.statistics?.statistics?.totalSolved,
      hasAllSessions: !!appState?.allSessions,
      allSessionsLength: appState?.allSessions?.length,
      contentOnboardingCompleted
    });
    if (appState) {
      setStatistics(appState.statistics);
      setAverageTime(appState.averageTime);
      setSuccessRate(appState.successRate);
      setAllSessions(appState.allSessions);
      setHintsUsed(appState.hintsUsed);
      setLearningEfficiencyData(appState.learningEfficiencyData);

      // Safety check for allSessions before calling DataAdapter functions
      if (appState.allSessions && Array.isArray(appState.allSessions)) {
        const weekly = getAccuracyTrendData(appState.allSessions, "weekly");
        const monthly = getAccuracyTrendData(appState.allSessions, "monthly");
        const yearly = getAccuracyTrendData(appState.allSessions, "yearly");

        setAccuracyData({ weekly, monthly, yearly });

        const weeklyBreakdown = getAttemptBreakdownData(
          appState.allSessions,
          "weekly"
        );
        const monthlyBreakdown = getAttemptBreakdownData(
          appState.allSessions,
          "monthly"
        );
        const yearlyBreakdown = getAttemptBreakdownData(
          appState.allSessions,
          "yearly"
        );

        setBreakdownData({
          weekly: weeklyBreakdown,
          monthly: monthlyBreakdown,
          yearly: yearlyBreakdown,
        });
      } else {
        console.warn("allSessions is not available or not an array:", appState.allSessions);
        setAccuracyData({ weekly: [], monthly: [], yearly: [] });
        setBreakdownData({ weekly: [], monthly: [], yearly: [] });
      }
    }
  }, [appState, contentOnboardingCompleted]);

  // Enhanced data detection logic - check multiple data sources
  const hasData = appState && (
    // Check multiple statistics properties
    (statistics?.totalSolved > 0) ||
    (statistics?.statistics?.totalSolved > 0) ||
    // Check multiple session sources
    (allSessions && allSessions.length > 0) ||
    (appState.allSessions && appState.allSessions.length > 0) ||
    // Check for any problem/attempt data
    (appState.allProblems && appState.allProblems.length > 0) ||
    (appState.allAttempts && appState.allAttempts.length > 0)
  );

  const showStartSessionButton =
    (contentOnboardingCompleted === false) && !shouldUseMockDashboard();

  // Comprehensive debug logging for data detection
  console.info("🔍 Data Detection Debug:", {
    appState: !!appState,
    statistics: statistics,
    'statistics.totalSolved': statistics?.totalSolved,
    'statistics.statistics': statistics?.statistics,
    'statistics.statistics.totalSolved': statistics?.statistics?.totalSolved,
    allSessions: allSessions?.length,
    'appState.allSessions': appState?.allSessions?.length,
    'appState.allProblems': appState?.allProblems?.length,
    'appState.allAttempts': appState?.allAttempts?.length,
    hasData,
    contentOnboardingCompleted,
    shouldUseMock: shouldUseMockDashboard(),
    showStartSessionButton,
    'Final Decision': showStartSessionButton ? 'SHOW ONBOARDING MODAL' : 'SHOW DASHBOARD DATA'
  });

  const handleStartFirstSession = () => {
    window.open("https://leetcode.com/problems/", "_blank");
  };

  // Handle loading and error states after all hooks are called
  if (loading) {
    return (
      <Container size="xl" p="md">
        <Group justify="space-between" mb="md">
          <Title order={2}>
            General Performance Summary
          </Title>
          <Button 
            leftSection={<IconRefresh size={16} />} 
            variant="light" 
            onClick={refresh}
            size="sm"
            loading
          >
            Refresh
          </Button>
        </Group>

        {/* Loading skeletons */}
        <Grid gutter="sm">
          <MetricCard loading={true} />
          <MetricCard loading={true} />
          <MetricCard loading={true} />
          <MetricCard loading={true} />
        </Grid>
        
        {/* Focus Areas Skeleton - Full Width Second Row */}
        <Grid gutter="md" mt="md">
          <Grid.Col span={12}>
            <ChartSkeleton title="Focus Areas" height={200} />
          </Grid.Col>
        </Grid>

        <Grid gutter="md" mt="md">
          <Grid.Col span={6}>
            <ChartSkeleton title="Accuracy Trend" />
          </Grid.Col>
          <Grid.Col span={6}>
            <ChartSkeleton title="Learning Efficiency" />
          </Grid.Col>
        </Grid>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="xl" p="md">
        <Title order={2} mb="md">Dashboard Overview</Title>
        <Text color="red">Error loading statistics: {error.message}</Text>
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
          General Performance Summary
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

      {showStartSessionButton ? (
        <EmptyStateCard type="dashboard" onAction={handleStartFirstSession} />
      ) : (
        <>
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
                { label: "Primer", value: hintsUsed?.primer ?? 0 },
              ]}
              loading={loading}
            />
          </Grid>
          
          {/* Focus Areas - Full Width Second Row */}
          <Grid gutter="md" mt="md">
            <Grid.Col span={12}>
              <FocusAreasDisplay 
                onNavigateToSettings={() => navigate("/settings/general")}
              />
            </Grid.Col>
          </Grid>

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