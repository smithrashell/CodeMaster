import { Container, Grid, Card, Title, Text, Button } from "@mantine/core";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  HeatMap,
  HeatMapChart,
  Treemap,
  Rectangle,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import { useEffect, useState } from "react";

export function Stats() {
  const sampleAccuracyData = [
    { name: "Day 1", accuracy: 75 },
    { name: "Day 2", accuracy: 80 },
    { name: "Day 3", accuracy: 78 },
    { name: "Day 4", accuracy: 85 },
    { name: "Day 5", accuracy: 82 },
    { name: "Day 6", accuracy: 88 },
    { name: "Day 7", accuracy: 90 },
  ];

  const sampleGoalData = [
    { name: "Week 1", completion: 50 },
    { name: "Week 2", completion: 65 },
    { name: "Week 3", completion: 80 },
    { name: "Week 4", completion: 90 },
  ];
  return (
    <Container size="xl" p="md">
      <Title order={2} mb="md">
        General Performance Summary
      </Title>
      <Grid gutter="md">
        {/* Summary Cards */}
        <Grid.Col span={4}>
          <Card shadow="sm" p="lg">
            <Text weight={500} size="lg">
              Total Problems Solved
            </Text>
            <Text size="xl" weight={700}>
              120
            </Text>
          </Card>
        </Grid.Col>
        <Grid.Col span={4}>
          <Card shadow="sm" p="lg">
            <Text weight={500} size="lg">
              Average Time Per Problem
            </Text>
            <Text size="xl" weight={700}>
              3m 25s
            </Text>
          </Card>
        </Grid.Col>
        <Grid.Col span={4}>
          <Card shadow="sm" p="lg">
            <Text weight={500} size="lg">
              Success Rate
            </Text>
            <Text size="xl" weight={700}>
              85%
            </Text>
          </Card>
        </Grid.Col>
      </Grid>

      <Grid gutter="md" mt="md">
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
        </Grid.Col>

        <Grid.Col span={6}>
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
      </Grid>
    </Container>
  );
}
