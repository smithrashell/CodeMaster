import React from "react";
import { Outlet } from "react-router-dom";
import { Container, Grid, Card, Title, Text, Button, Group, Box } from "@mantine/core";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// Re-export Goals from GoalsComponents for backwards compatibility
export { Goals } from "./GoalsComponents.jsx";

// Shared Components for Learning Path & Mistake Analysis
function _Section({ title, right, children }) {
  return (
    <Card withBorder radius="md" p="md" style={{ background: "var(--surface)", boxShadow: "var(--shadow)" }}>
      <Group justify="space-between" mb="xs">
        <Text fw={700} c="var(--text)">{title}</Text>
        {right}
      </Group>
      {children}
    </Card>
  );
}

function _Kpis({ items }) {
  return (
    <Grid gutter="sm">
      {items.map((k) => (
        <Grid.Col key={k.label} span={{ base: 6, sm: 3 }}>
          <Card withBorder p="sm" style={{ background: "var(--surface)" }}>
            <Text c="var(--muted)" size="xs">{k.label}</Text>
            <Text fw={800} fz="xl" c="var(--text)">{k.value}</Text>
          </Card>
        </Grid.Col>
      ))}
    </Grid>
  );
}

function _FeedbackItem({ icon, title, note, meta }) {
  return (
    <Card withBorder radius="md" p="sm" style={{ background: "var(--surface)" }}>
      <Group align="flex-start" gap="sm">
        <Text fz="lg">{icon}</Text>
        <Box style={{ flex: 1 }}>
          <Group justify="space-between" wrap="nowrap">
            <Text fw={600} c="var(--text)">{title}</Text>
            <Text c="var(--muted)" size="xs">{meta}</Text>
          </Group>
          <Text c="var(--muted)" size="sm">{note}</Text>
        </Box>
      </Group>
    </Card>
  );
}

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

export function SettingsPage() {
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
