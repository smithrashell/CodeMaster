import React from "react";
import { Outlet } from "react-router-dom";
import { Container, Grid, Card, Title, Text, Button, Stack } from "@mantine/core";
import ThemeToggle from "../../shared/components/ThemeToggle.jsx";
import {
  FontSizeSelector,
  LayoutDensitySelector,
  AnimationToggle,
} from "../../shared/components/AppearanceControls.jsx";
import { FocusAreasSelector } from "../components/settings/FocusAreasSelector.jsx";
import MasteryDashboard from "../components/analytics/MasteryDashboard.jsx";
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

export function TagMastery({ appState }) {
  // Enhanced Tag Mastery with MasteryDashboard integration
  // Use appState data when available, otherwise fall back to static mock data
  const masteryData = appState || {
    currentTier: "Core Concept",
    masteredTags: ["array", "hash-table"],
    allTagsInCurrentTier: [
      "array", "hash-table", "string", "two-pointers", 
      "binary-search", "sliding-window", "dynamic-programming",
      "greedy", "stack", "queue", "heap", "tree", "graph"
    ],
    focusTags: ["string", "two-pointers", "dynamic-programming"],
    tagsinTier: [
      "array", "hash-table", "string", "two-pointers", 
      "binary-search", "sliding-window"
    ],
    unmasteredTags: [
      "string", "two-pointers", "binary-search", "sliding-window", 
      "dynamic-programming", "greedy", "stack", "queue", "heap", "tree", "graph"
    ],
    masteryData: [
      { tag: "array", totalAttempts: 15, successfulAttempts: 12 },
      { tag: "hash-table", totalAttempts: 10, successfulAttempts: 9 },
      { tag: "string", totalAttempts: 8, successfulAttempts: 5 },
      { tag: "two-pointers", totalAttempts: 6, successfulAttempts: 3 },
      { tag: "binary-search", totalAttempts: 4, successfulAttempts: 2 },
      { tag: "sliding-window", totalAttempts: 3, successfulAttempts: 1 },
      { tag: "dynamic-programming", totalAttempts: 12, successfulAttempts: 4 },
      { tag: "greedy", totalAttempts: 5, successfulAttempts: 2 },
      { tag: "stack", totalAttempts: 7, successfulAttempts: 4 },
      { tag: "queue", totalAttempts: 4, successfulAttempts: 2 },
      { tag: "heap", totalAttempts: 6, successfulAttempts: 2 },
      { tag: "tree", totalAttempts: 9, successfulAttempts: 3 },
      { tag: "graph", totalAttempts: 8, successfulAttempts: 2 }
    ]
  };


  return (
    <Container size="xl" py="md">
      <Title order={2} mb="md" style={{ color: "var(--cm-text)" }}>
        Tag Mastery Analytics
      </Title>
      
      {/* Use the comprehensive MasteryDashboard component */}
      <MasteryDashboard data={masteryData} />
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
  return (
    <Container size="md" p="xl">
      <Title order={2} mb="xl" style={{ color: "var(--cm-text)" }}>
        Learning Settings
      </Title>
      
      <Stack gap="lg">
        <FocusAreasSelector />
      </Stack>
    </Container>
  );
}

export function Appearance() {
  return (
    <Container size="md" p="xl">
      <Title order={2} mb="xl" style={{ color: "var(--cm-text)" }}>
        Appearance Settings
      </Title>

      <Grid gutter="lg">
        {/* Theme Selection */}
        <Grid.Col span={12}>
          <Card
            shadow="sm"
            p="lg"
            style={{
              backgroundColor: "var(--cm-card-bg)",
              borderColor: "var(--cm-border)",
            }}
          >
            <Text
              weight={500}
              size="lg"
              mb="md"
              style={{ color: "var(--cm-text)" }}
            >
              Theme
            </Text>
            <Text
              size="sm"
              color="dimmed"
              mb="md"
              style={{ color: "var(--cm-text-dimmed)" }}
            >
              Choose between light and dark themes. Changes will sync across the
              content page and dashboard.
            </Text>
            <ThemeToggle />
          </Card>
        </Grid.Col>

        {/* Font Size Settings */}
        <Grid.Col span={12}>
          <Card
            shadow="sm"
            p="lg"
            style={{
              backgroundColor: "var(--cm-card-bg)",
              borderColor: "var(--cm-border)",
            }}
          >
            <Text
              weight={500}
              size="lg"
              mb="md"
              style={{ color: "var(--cm-text)" }}
            >
              Font Size
            </Text>
            <Text
              size="sm"
              color="dimmed"
              mb="md"
              style={{ color: "var(--cm-text-dimmed)" }}
            >
              Adjust the text size for better readability.
            </Text>
            <FontSizeSelector />
          </Card>
        </Grid.Col>

        {/* Layout Density */}
        <Grid.Col span={12}>
          <Card
            shadow="sm"
            p="lg"
            style={{
              backgroundColor: "var(--cm-card-bg)",
              borderColor: "var(--cm-border)",
            }}
          >
            <Text
              weight={500}
              size="lg"
              mb="md"
              style={{ color: "var(--cm-text)" }}
            >
              Layout Density
            </Text>
            <Text
              size="sm"
              color="dimmed"
              mb="md"
              style={{ color: "var(--cm-text-dimmed)" }}
            >
              Choose between compact or comfortable spacing for interface
              elements.
            </Text>
            <LayoutDensitySelector />
          </Card>
        </Grid.Col>

        {/* Animation Preferences */}
        <Grid.Col span={12}>
          <Card
            shadow="sm"
            p="lg"
            style={{
              backgroundColor: "var(--cm-card-bg)",
              borderColor: "var(--cm-border)",
            }}
          >
            <Text
              weight={500}
              size="lg"
              mb="md"
              style={{ color: "var(--cm-text)" }}
            >
              Animations
            </Text>
            <Text
              size="sm"
              color="dimmed"
              mb="md"
              style={{ color: "var(--cm-text-dimmed)" }}
            >
              Enable or disable animations and transitions for better
              performance.
            </Text>
            <AnimationToggle />
          </Card>
        </Grid.Col>
      </Grid>
    </Container>
  );
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
