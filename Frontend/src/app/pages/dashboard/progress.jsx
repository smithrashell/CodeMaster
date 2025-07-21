import { Container, Grid, Title } from "@mantine/core";
// Note: Recharts imports removed - add back as needed when charts are implemented
import { useEffect, useState } from "react";
import TimeGranularChartCard from "../../../shared/components/TimeGranularChartCard";
import MasteryDashboard from "../../../shared/components/MasteryDashboard";
import { getPromotionDemotionData } from "../../../shared/components/generatePromotionDataFromSession";
import { getProblemActivityData } from "../../../shared/utils/DataAdapter";
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

        {/* Mastery Pie Chart */}
        <Grid.Col span={6}>
          {/* <MasteryDashboard data={learningState} /> */}
          <div>MasteryDashboard - Coming Soon</div>
          {/* <Card shadow="sm" p="lg">
            <Text weight={500} size="lg">
              Mastery Percentage
            </Text>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={masteryData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={100}
                  label
                >
                  {masteryData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card> */}
        </Grid.Col>
      </Grid>

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
