import { Container, Grid, Title, Card, Stack, Text } from "@mantine/core";
// Note: Recharts imports removed - add back as needed when charts are implemented
import { useEffect, useState } from "react";
import TimeGranularChartCard from "../../components/charts/TimeGranularChartCard";
// MasteryDashboard moved to dedicated analytics section
import { getPromotionDemotionData } from "../../components/analytics/generatePromotionDataFromSession";
import { getProblemActivityData } from "../../../shared/utils/DataAdapter";
// FocusAreasDisplay moved to Stats page
export function Progress({ appState }) {
  console.info("Progress component - appState:", appState);
  const [boxLevelData, setBoxLevelData] = useState(appState.boxLevelData);
  // Note: Unused state variables commented out - uncomment when implementing charts
  // const [masteryData, setMasteryData] = useState(appState.masteryData);
  // const [learningState, setLearningState] = useState(appState.learningState);
  const [promotionData, setPromotionData] = useState(null);
  const [activityData, setActivityData] = useState(null);
  useEffect(() => {
    if (!appState) return;

    const formatted = Object.entries(appState.boxLevelData || {}).map(
      ([key, value]) => ({
        name: `Box ${key}`,
        count: value,
      })
    );
    setBoxLevelData(formatted);

    if (appState.allAttempts && appState.allProblems) {
      const weekly = getPromotionDemotionData(
        appState.allAttempts,
        appState.allProblems,
        "weekly"
      );
      const monthly = getPromotionDemotionData(
        appState.allAttempts,
        appState.allProblems,
        "monthly"
      );
      const yearly = getPromotionDemotionData(
        appState.allAttempts,
        appState.allProblems,
        "yearly"
      );

      const activityData = getProblemActivityData(
        appState.allSessions,
        "weekly"
      );
      const monthlyActivityData = getProblemActivityData(
        appState.allSessions,
        "monthly"
      );
      const yearlyActivityData = getProblemActivityData(
        appState.allSessions,
        "yearly"
      );
      console.info("✅ weekly promotion data:", weekly);
      setPromotionData({ weekly, monthly, yearly });
      setActivityData({
        weekly: activityData,
        monthly: monthlyActivityData,
        yearly: yearlyActivityData,
      });
    }
  }, [appState]);

  useEffect(() => {
    console.info("📊 Rendered promotionData:", promotionData);
    console.info("📊 Rendered activityData:", activityData);
  }, [promotionData, activityData]);

  // Note: Colors for charts - uncomment when implementing visualizations
  // const COLORS = ["#8884d8", "#82ca9d"];

  return (
    <Container size="xl" p="md">
      <Title order={2} mb="md">
        Leitner System Tracking
      </Title>

      <Grid gutter="md">
        {/* Box Distribution */}
        <Grid.Col span={6}>
          <TimeGranularChartCard
            title="Box Distribution"
            chartType="bar"
            useTimeGranularity={false}
            data={boxLevelData}
            dataKeys={[{ key: "count", color: "#8884d8" }]}
            yAxisFormatter={(v) => v}
            tooltipFormatter={(value, name) => [`${value}`, name]}
          />
        </Grid.Col>

        {/* Learning Progress Summary */}
        <Grid.Col span={6}>
          <Card withBorder p="lg" h="100%">
            <Title order={4} mb="md">Learning Progress Summary</Title>
            <Stack gap="md">
              <div>
                <Text size="sm" c="dimmed" mb="xs">Current Tier</Text>
                <Text fw={500}>Core Concepts</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed" mb="xs">Active Problems</Text>
                <Text fw={500}>{appState?.boxLevelData ? Object.values(appState.boxLevelData).reduce((a, b) => a + b, 0) : 0} problems in system</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed" mb="xs">Learning Status</Text>
                <Text fw={500} c="blue">Active Learning Phase</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed" mb="xs">Next Review</Text>
                <Text fw={500}>Problems ready for review</Text>
              </div>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Focus Areas moved to Stats page for better organization */}

      <Grid gutter="md" mt="md">
        {/* Promotion & Demotion */}
        <Grid.Col span={6}>
          <TimeGranularChartCard
            title="Promotion & Demotion Trends"
            chartType="line"
            data={promotionData}
            dataKeys={[
              { key: "promotions", color: "#82ca9d" },
              { key: "demotions", color: "#ff7300" },
            ]}
            yAxisFormatter={(v) => v}
            tooltipFormatter={(value, name) => [`${value}`, name]}
          />
        </Grid.Col>

        {/* Problem Activity */}
        <Grid.Col span={6}>
          <TimeGranularChartCard
            title="Problem Activity Over Time"
            chartType="bar"
            data={activityData}
            dataKeys={[
              { key: "attempted", color: "#8884d8" },
              { key: "passed", color: "#82ca9d" },
              { key: "failed", color: "#ff4d4f" },
            ]}
            yAxisFormatter={(v) => v}
            tooltipFormatter={(value, name) => [`${value}`, name]}
          />
        </Grid.Col>
      </Grid>
    </Container>
  );
}
