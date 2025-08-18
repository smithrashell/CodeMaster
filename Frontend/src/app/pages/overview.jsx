import { Container, Grid, Title } from "@mantine/core";
import { useEffect, useState } from "react";
import MetricCard from "../components/analytics/MetricCard";
import TimeGranularChartCard from "../components/charts/TimeGranularChartCard";
import { EmptyStateCard } from "../components/onboarding/EmptyStateCard";
import {
  getAccuracyTrendData,
  getAttemptBreakdownData,
} from "../../shared/utils/DataAdapter.js";
import { checkContentOnboardingStatus } from "../../shared/services/onboardingService.js";
import { shouldUseMockDashboard } from "../config/mockConfig.js";
import { FocusAreasDisplay } from "../components/dashboard/FocusAreasDisplay.jsx";

export function Stats({ appState }) {
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
  const [breakdownData, setBreakdownData] = useState({
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
    console.info("props", appState);
    if (appState) {
      setStatistics(appState.statistics);
      setAverageTime(appState.averageTime);
      setSuccessRate(appState.successRate);
      setAllSessions(appState.allSessions);
      setHintsUsed(appState.hintsUsed);
      setLearningEfficiencyData(appState.learningEfficiencyData);

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
    }
  }, [appState]);

  const hasData =
    appState && (statistics?.totalSolved > 0 || (allSessions && allSessions.length > 0));
  const showStartSessionButton =
    (!hasData || contentOnboardingCompleted === false) && !shouldUseMockDashboard();

  const handleStartFirstSession = () => {
    window.open("https://leetcode.com/problems/", "_blank");
  };

  return (
    <Container size="xl" p="md">
      <Title order={2} mb="md">
        General Performance Summary
      </Title>

      {showStartSessionButton ? (
        <EmptyStateCard type="dashboard" onAction={handleStartFirstSession} />
      ) : (
        <>
          <Grid gutter="sm">
            {/* Summary Cards */}
            <MetricCard
              title="Total Problems Solved"
              value={statistics?.totalSolved ?? 0}
              details={[
                { label: "Mastered", value: statistics?.mastered ?? 0 },
                { label: "In Progress", value: statistics?.inProgress ?? 0 },
                { label: "New", value: statistics?.new ?? 0 },
              ]}
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
            />

            <MetricCard
              title="Success Rate"
              value={successRate?.overall ?? 0}
              details={[
                { label: "Easy", value: successRate?.Easy ?? 0 },
                { label: "Medium", value: successRate?.Medium ?? 0 },
                { label: "Hard", value: successRate?.Hard ?? 0 },
              ]}
            />

            <MetricCard
              title="Hints Used"
              value={hintsUsed?.total ?? 0}
              details={[
                { label: "Contextual", value: hintsUsed?.contextual ?? 0 },
                { label: "General", value: hintsUsed?.general ?? 0 },
                { label: "Primer", value: hintsUsed?.primer ?? 0 },
              ]}
            />
          </Grid>
          
          {/* Focus Areas - Full Width Second Row */}
          <Grid gutter="md" mt="md">
            <Grid.Col span={12}>
              <FocusAreasDisplay 
                onNavigateToSettings={() => {
                  // Navigate to settings - this would be handled by router in real app
                  // eslint-disable-next-line no-console
                  console.log("Navigate to focus areas settings");
                }}
              />
            </Grid.Col>
          </Grid>

          <Grid gutter="md" mt="md">
            <Grid.Col span={6}>
              <TimeGranularChartCard
                title="Accuracy Trend"
                chartType="line"
                data={accuracyData}
                dataKeys={[{ key: "accuracy", color: "#8884d8" }]}
                yAxisFormatter={(val) => `${val}%`}
                tooltipFormatter={(val) => `${val}%`}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TimeGranularChartCard
                title="Learning Efficiency"
                chartType="line"
                data={learningEfficiencyData}
                dataKeys={[{ key: "efficiency", color: "#82ca9d" }]}
                yAxisFormatter={(val) => `${val}`}
                tooltipFormatter={(val) => `${val} problems per hint`}
              />
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