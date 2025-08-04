import { Container, Grid, Title } from "@mantine/core";
import { useEffect, useState } from "react";
import MetricCard from "../../../shared/components/MetricCard";
import TimeGranularChartCard from "../../../shared/components/TimeGranularChartCard";
import {
  getAccuracyTrendData,
  getAttemptBreakdownData,
} from "../../../shared/utils/DataAdapter.js";
export function Stats({appState}) {
  const [statistics, setStatistics] = useState(appState.statistics);
  const [averageTime, setAverageTime] = useState(appState.averageTime);
  const [successRate, setSuccessRate] = useState(appState.successRate);
  const [allSessions, setAllSessions] = useState(appState.allSessions);
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

  useEffect(() => {
console.info("props", appState)
        if (appState) {
          setStatistics(appState.statistics);
          setAverageTime(appState.averageTime);
          setSuccessRate(appState.successRate);
          setAllSessions(appState.allSessions);

          const weekly = getAccuracyTrendData(
            appState.allSessions,
            "weekly"
          );
          const monthly = getAccuracyTrendData(
            appState.allSessions,
            "monthly"
          );
          const yearly = getAccuracyTrendData(
            appState.allSessions,
            "yearly"
          );

          setAccuracyData({
            weekly,
            monthly,
            yearly,
          });

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
    
  }, []);
  console.info("allSessions", allSessions);
  console.info("accuracyData", accuracyData);
  // const accuracyData = {
  //   weekly: getAccuracyTrendData(allSessions, "weekly"),
  //   monthly: getAccuracyTrendData(allSessions, "monthly"),
  //   yearly: getAccuracyTrendData(allSessions, "yearly"),
  // };

  // const breakdownData = {
  //   weekly: getAttemptBreakdownData(allSessions, "weekly"),
  //   monthly: getAttemptBreakdownData(allSessions, "monthly"),
  //   yearly: getAttemptBreakdownData(allSessions, "yearly"),
  // };
  return (
    <Container size="xl" p="md">
      <Title order={2} mb="md">
        General Performance Summary
      </Title>
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
          title="Attempt Quality Breakdown"
          chartType="bar"
          data={breakdownData}
          dataKeys={[
            { key: "firstTry", color: "#4CAF50" },
            { key: "retrySuccess", color: "#FFC107" },
              { key: "failed", color: "#F44336" },
            ]}
          />
        </Grid.Col>
      </Grid>

      {/* <Grid gutter="md" mt="md">
        <Grid.Col span={6}>
          <Card shadow="sm" p="lg">
            <Text weight={500} size="lg" mb="sm">
              Accuracy Trend (7-day)
            </Text>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={sampleAccuracyData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <CartesianGrid stroke="#f5f5f5" />
                <Line
                  type="monotone"
                  dataKey="accuracy"
                  stroke="#8884d8"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Grid.Col> */}

      {/* <Grid.Col span={6}>
          <Card shadow="sm" p="lg">
            <Text weight={500} size="lg" mb="sm">
              Goal Completion %
            </Text>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={sampleGoalData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <CartesianGrid stroke="#f5f5f5" />
                <Bar dataKey="completion" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Grid.Col>
      </Grid> */}
    </Container>
  );
}
