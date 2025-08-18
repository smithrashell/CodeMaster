import { Container, Grid, Title, Card, Text, SimpleGrid, Group, Badge, Box } from "@mantine/core";
import { useEffect, useState } from "react";
import TimeGranularChartCard from "../../components/charts/TimeGranularChartCard";
import { getPromotionDemotionData } from "../../components/analytics/generatePromotionDataFromSession";
import { getProblemActivityData } from "../../../shared/utils/DataAdapter";

const KPI_HEIGHT = 132;         // keeps the 4 KPI cards the same height
const CHART_HEIGHT = 320;       // keeps the two charts aligned

export function Progress({ appState }) {
  console.info("Progress component - appState:", appState);
  const [boxLevelData, setBoxLevelData] = useState(appState?.boxLevelData || {});
  const [promotionData, setPromotionData] = useState(null);
  const [activityData, setActivityData] = useState(null);
  const [strategySuccessRate, setStrategySuccessRate] = useState(appState?.strategySuccessRate);
  const [timerBehavior, setTimerBehavior] = useState(appState?.timerBehavior);

  useEffect(() => {
    if (!appState) return;

    const formatted = Object.entries(appState.boxLevelData || {}).map(
      ([key, value]) => ({
        name: `Box ${key}`,
        count: value,
      })
    );
    setBoxLevelData(formatted);
    setStrategySuccessRate(appState.strategySuccessRate);
    setTimerBehavior(appState.timerBehavior);

    // Use pre-generated promotion data from mock service if available
    if (appState.promotionData) {
      console.info("✅ Using pre-generated promotion data:", appState.promotionData);
      setPromotionData(appState.promotionData);
    } else if (appState.allAttempts && appState.allProblems) {
      // Fallback to calculating promotion data from raw data
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
      console.info("✅ Calculated promotion data:", { weekly, monthly, yearly });
      setPromotionData({ weekly, monthly, yearly });
    }

    if (appState.allSessions) {
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
      setActivityData({
        weekly: activityData,
        monthly: monthlyActivityData,
        yearly: yearlyActivityData,
      });
    }
  }, [appState]);

  useEffect(() => {
    console.info("📊 Rendered promotionData:", promotionData);
  }, [promotionData]);

  const totalProblems = appState?.boxLevelData ? Object.values(appState.boxLevelData).reduce((a, b) => a + b, 0) : 0;

  return (
    <Container size="xl" p="md">
      <Title order={2} mb="md">
        Leitner System Tracking
      </Title>
       
      {/* ===== Row 1: KPI cards (equal height, stretch) ===== */}
      <Grid gutter="md" align="stretch">
        {[
          // Box Distribution Summary
          <Card withBorder p="lg" style={{ textAlign: 'center' }}>
            <Text size="lg" fw={600} mb="xs">Box Distribution</Text>
            <Text size="xl" fw={700} style={{ color: 'var(--cm-text)', fontSize: '1.4rem' }}>
              {totalProblems} problems
            </Text>
            <Text size="xs" c="dimmed">across 7 boxes</Text>
          </Card>,
          
          // Learning Progress Summary KPI
          <Card withBorder p="lg" style={{ textAlign: 'center' }}>
            <Text size="lg" fw={600} mb="xs">Strategy Success</Text>
            <Text size="xl" fw={700} style={{ color: 'var(--cm-text)', fontSize: '1.4rem' }}>
              {strategySuccessRate ?? 0}%
            </Text>
            <Text size="xs" c="dimmed">effectiveness rate</Text>
          </Card>,

          // Timer Behavior KPI
          <Card withBorder p="lg" style={{ textAlign: 'center' }}>
            <Text size="lg" fw={600} mb="xs">Timer Behavior</Text>
            <Badge variant="light" color="teal" size="lg" style={{ fontSize: '0.9rem', padding: '8px 12px' }}>
              On time
            </Badge>
            <Text size="xs" c="dimmed" mt="xs">86% within limits</Text>
          </Card>,

          // Next Review KPI
          <Card withBorder p="lg" style={{ textAlign: 'center' }}>
            <Text size="lg" fw={600} mb="xs">Next Review</Text>
            <Text size="md" fw={600} style={{ color: 'var(--cm-text)' }}>
              Today • 4:00 PM
            </Text>
            <Text size="xs" c="dimmed">17 problems ready</Text>
          </Card>,
        ].map((card, i) => (
          <Grid.Col key={i} span={{ base: 12, sm: 6, lg: 3 }}>
            {/* wrapper forces equal height */}
            <Box h={KPI_HEIGHT} style={{ display: "flex", flexDirection: "column" }}>
              {card}
            </Box>
          </Grid.Col>
        ))}
      </Grid>

      

      {/* ===== Row 2: Box Distribution Chart (full width) ===== */}
      <Grid gutter="md" mt="md">
        <Grid.Col span={12}>
          <TimeGranularChartCard
            title="Box Distribution"
            chartType="bar"
            useTimeGranularity={false}
            height={280}
            data={boxLevelData}
            dataKeys={[{ key: "count", color: "#8884d8" }]}
            yAxisFormatter={(v) => v}
            tooltipFormatter={(value, name) => [`${value}`, name]}
          />
        </Grid.Col>
      </Grid>

            {/* ===== Row 4 (optional): Learning State Details (full width) ===== */}
      <Grid gutter="md" mt="md">
        <Grid.Col span={12}>
          <Card withBorder p="lg">
            <Title order={4} mb="md">Learning State Details</Title>
            <SimpleGrid cols={4} spacing="md">
              <div>
                <Text size="xs" c="dimmed" mb={4}>Current Tier</Text>
                <Badge variant="light" color="blue" size="sm">Core Concepts</Badge>
              </div>
              <div>
                <Text size="xs" c="dimmed" mb={4}>Learning Status</Text>
                <Badge variant="light" color="green" size="sm">Active Learning</Badge>
              </div>
              <div>
                <Text size="xs" c="dimmed" mb={4}>Timer Pattern</Text>
                <Text size="sm" fw={600} style={{ color: 'var(--cm-text)' }}>
                  {timerBehavior ?? "Analyzing patterns..."}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed" mb={4}>Progress Trend</Text>
                <Group gap="xs" align="center">
                  <Badge variant="light" color="teal" size="sm">Improving</Badge>
                  <div style={{ 
                    width: '40px', 
                    height: '4px', 
                    background: 'rgba(255,255,255,0.1)', 
                    borderRadius: '2px',
                    overflow: 'hidden'
                  }}>
                    <div style={{ 
                      width: '75%', 
                      height: '100%', 
                      background: 'linear-gradient(90deg, #10b981, #0ea5e9)' 
                    }} />
                  </div>
                </Group>
              </div>
            </SimpleGrid>
          </Card>
        </Grid.Col>
      </Grid>

      {/* ===== Row 3: Two charts side-by-side, same height ===== */}
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


    </Container>
  );
}