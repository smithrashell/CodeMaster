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

export function Progress() {
  const [boxData, setBoxData] = useState([]);
  const [promotionData, setPromotionData] = useState([]);
  const [masteryData, setMasteryData] = useState([]);
  const [boxLevelData, setBoxLevelData] = useState({});

  useEffect(() => {
    chrome.runtime.sendMessage(
      { type: "countProblemsByBoxLevel" },
      (response) => {
        if (response.status === "success") {
          console.log("boxLevelData", response.data);

          const formattedBoxData = Object.entries(response.data).map(
            ([key, value]) => ({
              name: `Box ${key}`,
              count: value,
            })
          );
          console.log("formattedBoxData", formattedBoxData);
          setBoxLevelData(formattedBoxData);
        } else {
          console.error("Failed to get problem count by box level");
        }
      }
    );
  }, [setBoxLevelData]);
  const sampleBoxData = [
    { name: "Box 1", count: 20 },
    { name: "Box 2", count: 30 },
    { name: "Box 3", count: 25 },
    { name: "Box 4", count: 15 },
    { name: "Box 5", count: 10 },
    { name: "Box 4", count: 15 },
    { name: "Box 5", count: 10 },
  ];

  const samplePromotionData = [
    { name: "Week 1", promotions: 5, demotions: 2 },
    { name: "Week 2", promotions: 8, demotions: 3 },
    { name: "Week 3", promotions: 6, demotions: 2 },
    { name: "Week 4", promotions: 10, demotions: 1 },
  ];

  //   const masteryData = [
  //     { name: "Mastered", value: 25 },
  //     { name: "Not Mastered", value: 75 },
  //   ];

  const COLORS = ["#8884d8", "#82ca9d"];
  return (
    <Container size="xl" p="md">
      <Title order={2} mb="md">
        Leitner System Tracking
      </Title>

      <Grid gutter="md">
        {/* Box Distribution */}
        <Grid.Col span={6}>
          <Card shadow="sm" p="lg">
            <Text weight={500} size="lg">
              Box Distribution
            </Text>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={boxLevelData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <CartesianGrid stroke="#f5f5f5" />
                <Bar dataKey="count" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Grid.Col>

        {/* Promotion & Demotion Trends */}
        <Grid.Col span={6}>
          <Card shadow="sm" p="lg">
            <Text weight={500} size="lg">
              Promotion & Demotion Trends
            </Text>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={samplePromotionData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <CartesianGrid stroke="#f5f5f5" />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="promotions"
                  stroke="#82ca9d"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="demotions"
                  stroke="#ff7300"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Mastery Percentage */}
      <Grid gutter="md" mt="md">
        <Grid.Col span={6}>
          <Card shadow="sm" p="lg">
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
                  fill="#8884d8"
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
          </Card>
        </Grid.Col>
      </Grid>
    </Container>
  );
}
