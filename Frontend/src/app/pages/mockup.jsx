import React from "react";
import { Outlet } from "react-router-dom";
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
  Treemap,
  Rectangle,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

// Page Components
export function DashboardPage() {
  return (
    <div>
      <Outlet />
    </div>
  );
}

export function AnalyticsPage() {
  return (
    <div>
      <Outlet />
    </div>
  );
}

export function AccountPage() {
  return (
    <div>
      <Outlet />
    </div>
  );
}

export function SettingsPage() {
  return (
    <div>
      <Outlet />
    </div>
  );
}

export function FlashcardPage() {
  return (
    <div>
      <Outlet />
    </div>
  );
}

// New Sessions Section
export function SessionsPage() {
  return (
    <div>
      <Outlet />
    </div>
  );
}

// Dashboard Subroutes

export function Goals() {
  return <h1>Tracking Goals</h1>;
}

// Analytics Subroutes
export function Trends() {
  return <h1>Historical Graphs & Insights</h1>;
}

export function MistakeAnalysis() {
  return <h1>Common Errors & Improvements</h1>;
}

export function TagMastery() {
  // Mock Data for Mastery Metrics
  const tags = [
    "Array",
    "String",
    "Hash Table",
    "Dynamic Programming",
    "Math",
    "Sorting",
    "Greedy",
    "Depth-First Search",
    "Binary Search",
    "Database",
    "Matrix",
    "Tree",
    "Breadth-First Search",
    "Bit Manipulation",
    "Two Pointers",
    "Prefix Sum",
    "Heap (Priority Queue)",
    "Binary Tree",
    "Simulation",
    "Stack",
    "Graph",
    "Counting",
    "Sliding Window",
    "Design",
    "Enumeration",
    "Backtracking",
    "Union Find",
    "Linked List",
    "Ordered Set",
    "Number Theory",
    "Monotonic Stack",
    "Segment Tree",
    "Trie",
    "Bitmask",
    "Combinatorics",
    "Queue",
    "Divide and Conquer",
    "Recursion",
    "Memoization",
    "Binary Indexed Tree",
    "Geometry",
    "Binary Search Tree",
    "Hash Function",
    "String Matching",
    "Topological Sort",
    "Shortest Path",
    "Rolling Hash",
    "Game Theory",
    "Interactive",
    "Data Stream",
    "Monotonic Queue",
    "Brainteaser",
    "Randomized",
    "Merge Sort",
    "Doubly-Linked List",
    "Counting Sort",
    "Iterator",
    "Concurrency",
    "Probability and Statistics",
    "Quickselect",
    "Suffix Array",
    "Bucket Sort",
    "Line Sweep",
    "Minimum Spanning Tree",
    "Shell",
    "Reservoir Sampling",
    "Strongly Connected Component",
    "Eulerian Circuit",
    "Radix Sort",
    "Rejection Sampling",
    "Biconnected Component",
  ];

  const masteryData = tags.map((tag, _index) => ({
    tag,
    mastery: Math.floor(Math.random() * 100), // Mock mastery percentage
  }));

  const heatmapData = tags.map((tag, _index) => ({
    tag,
    week1: Math.floor(Math.random() * 10),
    week2: Math.floor(Math.random() * 10),
    week3: Math.floor(Math.random() * 10),
    week4: Math.floor(Math.random() * 10),
  }));

  const treemapData = tags.map((tag) => ({
    name: tag,
    size: Math.floor(Math.random() * 500) + 50,
  }));
  return (
    <Container size="lg" py="xl">
      <Title order={2} mb="xl">
        Tag Mastery Dashboard
      </Title>

      <Grid gutter="xl">
        {/* Radar Chart - Category Mastery */}
        <Grid.Col span={12} md={6}>
          <Card shadow="sm" padding="lg">
            <Title order={4} mb="sm">
              Category Mastery
            </Title>
            <ResponsiveContainer width="100%" height={400}>
              <RadarChart
                cx="50%"
                cy="50%"
                outerRadius="80%"
                data={masteryData}
              >
                <PolarGrid />
                <PolarAngleAxis dataKey="tag" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} />
                <Radar
                  name="Mastery"
                  dataKey="mastery"
                  stroke="#8884d8"
                  fill="#8884d8"
                  fillOpacity={0.6}
                />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </Card>
        </Grid.Col>

        {/* Heatmap - Progress Over Time */}
        <Grid.Col span={12} md={6}>
          <Card shadow="sm" padding="lg">
            <Title order={4} mb="sm">
              Progress Over Time
            </Title>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={heatmapData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tag" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="week1" fill="#8884d8" />
                <Bar dataKey="week2" fill="#82ca9d" />
                <Bar dataKey="week3" fill="#ffc658" />
                <Bar dataKey="week4" fill="#d88484" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Grid.Col>
      </Grid>

      <Grid gutter="xl" mt="xl">
        {/* Treemap - Problem Distribution */}
        <Grid.Col span={12}>
          <Card shadow="sm" padding="lg">
            <Title order={4} mb="sm">
              Problem Distribution Across Tags
            </Title>
            <ResponsiveContainer width="100%" height={500}>
              <Treemap
                width={400}
                height={400}
                data={treemapData}
                dataKey="size"
                stroke="#fff"
                fill="#82ca9d"
              >
                {(nodeProps) => (
                  <Rectangle {...nodeProps} fill="#82ca9d" stroke="#fff" />
                )}
              </Treemap>
            </ResponsiveContainer>
          </Card>
        </Grid.Col>
      </Grid>
    </Container>
  );
}

// Sessions Subroutes
export function Metrics() {
  const sessionLengthData = [
    { name: "Day 1", length: 45 },
    { name: "Day 2", length: 50 },
    { name: "Day 3", length: 40 },
    { name: "Day 4", length: 55 },
    { name: "Day 5", length: 60 },
    { name: "Day 6", length: 35 },
    { name: "Day 7", length: 50 },
  ];

  const sessionFrequencyData = [
    { name: "Monday", sessions: 3 },
    { name: "Tuesday", sessions: 4 },
    { name: "Wednesday", sessions: 5 },
    { name: "Thursday", sessions: 2 },
    { name: "Friday", sessions: 4 },
    { name: "Saturday", sessions: 3 },
    { name: "Sunday", sessions: 5 },
  ];

  const peakProductivityData = [
    { time: "6 AM", activity: 2 },
    { time: "9 AM", activity: 5 },
    { time: "12 PM", activity: 8 },
    { time: "3 PM", activity: 4 },
    { time: "6 PM", activity: 6 },
    { time: "9 PM", activity: 7 },
  ];
  return (
    <Container size="xl" p="md">
      <Title order={2} mb="md">
        Sessions - Custom Session Metrics
      </Title>

      <Grid gutter="md">
        {/* Average Session Length */}
        <Grid.Col span={6}>
          <Card shadow="sm" p="lg">
            <Text weight={500} size="lg">
              Average Session Length
            </Text>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={sessionLengthData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <CartesianGrid stroke="#f5f5f5" />
                <Line
                  type="monotone"
                  dataKey="length"
                  stroke="#8884d8"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Grid.Col>

        {/* Session Frequency */}
        <Grid.Col span={6}>
          <Card shadow="sm" p="lg">
            <Text weight={500} size="lg">
              Session Frequency
            </Text>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={sessionFrequencyData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <CartesianGrid stroke="#f5f5f5" />
                <Bar dataKey="sessions" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Peak Productivity Time */}
      <Grid gutter="md" mt="md">
        <Grid.Col span={6}>
          <Card shadow="sm" p="lg">
            <Text weight={500} size="lg">
              Peak Productivity Time
            </Text>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={peakProductivityData}>
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <CartesianGrid stroke="#f5f5f5" />
                <Bar dataKey="activity" fill="#ff7300" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Grid.Col>
      </Grid>
    </Container>
  );
}

export function ProductivityInsights() {
  return <h1>Peak Productivity Insights</h1>;
}

// Account Subroutes
export function Profile() {
  return <h1>Profile</h1>;
}

export function Notifications() {
  return <h1>Notifications</h1>;
}

export function General() {
  return <h1>General Settings</h1>;
}

export function Appearance() {
  return <h1>Appearance Settings</h1>;
}

export function Accessibility() {
  return <h1>Accessibility Settings</h1>;
}

// Flashcards Subroutes
export function Flashcards() {
  return <h1>Flashcards</h1>;
}

export function Practice() {
  return <h1>Practice Mode</h1>;
}

export function Review() {
  return <h1>Review Mode</h1>;
}

// Mock Data for Charts
const data = [
  { week: "Week 1", problemsSolved: 10, avgTime: 5 },
  { week: "Week 2", problemsSolved: 20, avgTime: 4 },
  { week: "Week 3", problemsSolved: 35, avgTime: 3.5 },
  { week: "Week 4", problemsSolved: 50, avgTime: 3 },
];

// Dashboard Component with Charts
export function Dashboard() {
  return (
    <Container size="lg" py="xl">
      <Title order={2} mb="xl">
        Dashboard Overview
      </Title>

      <Grid gutter="xl">
        {/* Problems Solved Over Time */}
        <Grid.Col span={12} md={6}>
          <Card shadow="sm" padding="lg">
            <Title order={4} mb="sm">
              Problems Solved
            </Title>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="problemsSolved"
                  stroke="#228be6"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Grid.Col>

        {/* Average Time Per Problem */}
        <Grid.Col span={12} md={6}>
          <Card shadow="sm" padding="lg">
            <Title order={4} mb="sm">
              Average Time Per Problem (mins)
            </Title>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="avgTime"
                  stroke="#fa5252"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Grid.Col>
      </Grid>

      <Card shadow="sm" padding="lg" mt="xl" align="center">
        <Text size="lg">
          Enhance your problem-solving skills with structured learning.
        </Text>
        <Button mt="md" variant="filled" color="blue">
          Start a New Session
        </Button>
      </Card>
    </Container>
  );
}
