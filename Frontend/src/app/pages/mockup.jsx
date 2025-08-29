import React, { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Container, Grid, Card, Title, Text, Button, Stack, Group, Box } from "@mantine/core";
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

// Dashboard Subroutes

export function Goals({ appState }) {
  const [goals, setGoals] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGoal, setNewGoal] = useState({
    type: 'problems', // 'problems', 'accuracy', 'tags', 'consistency'
    target: '',
    timeframe: 'weekly', // 'weekly', 'monthly'
    description: '',
    startDate: new Date().toISOString().split('T')[0]
  });

  // Load goals from localStorage on component mount
  useEffect(() => {
    const savedGoals = localStorage.getItem('userGoals');
    if (savedGoals) {
      setGoals(JSON.parse(savedGoals));
    }
  }, []);

  // Save goals to localStorage whenever goals change
  useEffect(() => {
    localStorage.setItem('userGoals', JSON.stringify(goals));
  }, [goals]);

  const handleCreateGoal = () => {
    if (!newGoal.target || !newGoal.description) return;

    const goal = {
      id: Date.now(),
      ...newGoal,
      target: parseInt(newGoal.target),
      createdAt: new Date().toISOString(),
      completed: false,
      progress: 0
    };

    setGoals([...goals, goal]);
    setNewGoal({
      type: 'problems',
      target: '',
      timeframe: 'weekly',
      description: '',
      startDate: new Date().toISOString().split('T')[0]
    });
    setShowCreateModal(false);
  };

  const calculateProgress = (goal) => {
    if (!appState?.statistics) return 0;

    const now = new Date();
    const startDate = new Date(goal.startDate || goal.createdAt);
    
    switch (goal.type) {
      case 'problems': {
        // Use recent problem count from statistics
        const recentProblems = appState.statistics.totalProblems || 0;
        return Math.min((recentProblems / goal.target) * 100, 100);
      }
      
      case 'accuracy': {
        // Use current accuracy from statistics
        const currentAccuracy = (appState.statistics.successRate || 0) * 100;
        return Math.min((currentAccuracy / goal.target) * 100, 100);
      }
      
      case 'consistency': {
        // Calculate based on session frequency
        const totalSessions = appState.statistics.totalSessions || 0;
        const daysActive = Math.max(Math.ceil((now - startDate) / (1000 * 60 * 60 * 24)), 1);
        const sessionsPerDay = totalSessions / daysActive;
        const targetSessionsPerDay = goal.target / (goal.timeframe === 'weekly' ? 7 : 30);
        return Math.min((sessionsPerDay / targetSessionsPerDay) * 100, 100);
      }
      
      default:
        return 0;
    }
  };

  const getGoalTypeLabel = (type) => {
    const labels = {
      problems: 'Problems Solved',
      accuracy: 'Accuracy Rate',
      tags: 'Tag Mastery',
      consistency: 'Session Consistency'
    };
    return labels[type] || type;
  };

  const getGoalIcon = (type) => {
    switch (type) {
      case 'problems': return '🎯';
      case 'accuracy': return '📈';
      case 'tags': return '🏷️';
      case 'consistency': return '📅';
      default: return '⭐';
    }
  };

  const activeGoals = goals.filter(g => !g.completed);
  const completedGoals = goals.filter(g => g.completed);

  return (
    <Container size="lg" p="xl">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <Title order={2}>Learning Goals</Title>
          <Text c="dimmed" size="sm" mt="xs">Set and track your personal learning objectives</Text>
        </div>
        <Button onClick={() => setShowCreateModal(true)} leftSection="➕">
          New Goal
        </Button>
      </div>

      {/* Active Goals */}
      {activeGoals.length > 0 && (
        <div style={{ marginBottom: '3rem' }}>
          <Title order={3} mb="lg">Active Goals ({activeGoals.length})</Title>
          <Grid>
            {activeGoals.map((goal) => {
              const progress = calculateProgress(goal);
              return (
                <Grid.Col span={6} key={goal.id}>
                  <Card withBorder p="lg" radius="md">
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
                      <Text size="xl">{getGoalIcon(goal.type)}</Text>
                      <div style={{ flex: 1 }}>
                        <Text fw={600} size="md">{goal.description}</Text>
                        <Text size="sm" c="dimmed">{getGoalTypeLabel(goal.type)} • {goal.timeframe}</Text>
                      </div>
                    </div>
                    
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <Text size="sm" fw={500}>Progress</Text>
                        <Text size="sm" fw={600} c={progress >= 100 ? "green" : "blue"}>
                          {Math.round(progress)}% ({Math.round((progress / 100) * goal.target)}/{goal.target})
                        </Text>
                      </div>
                      <div style={{
                        background: '#e9ecef',
                        borderRadius: '8px',
                        height: '8px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          background: progress >= 100 ? '#28a745' : '#007bff',
                          width: `${Math.min(progress, 100)}%`,
                          height: '100%',
                          borderRadius: '8px',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                    </div>

                    {progress >= 100 && (
                      <Button
                        size="sm"
                        variant="light"
                        color="green"
                        fullWidth
                        onClick={() => {
                          const updatedGoals = goals.map(g => 
                            g.id === goal.id ? { ...g, completed: true, completedAt: new Date().toISOString() } : g
                          );
                          setGoals(updatedGoals);
                        }}
                      >
                        Mark as Completed ✓
                      </Button>
                    )}
                  </Card>
                </Grid.Col>
              );
            })}
          </Grid>
        </div>
      )}

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <div>
          <Title order={3} mb="lg">Completed Goals ({completedGoals.length})</Title>
          <Grid>
            {completedGoals.map((goal) => (
              <Grid.Col span={6} key={goal.id}>
                <Card withBorder p="lg" radius="md" style={{ opacity: 0.8 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <Text size="xl">✅</Text>
                    <div>
                      <Text fw={600} size="md" td="line-through">{goal.description}</Text>
                      <Text size="sm" c="dimmed">{getGoalTypeLabel(goal.type)} • Completed</Text>
                      {goal.completedAt && (
                        <Text size="xs" c="green" mt="xs">
                          Completed on {new Date(goal.completedAt).toLocaleDateString()}
                        </Text>
                      )}
                    </div>
                  </div>
                </Card>
              </Grid.Col>
            ))}
          </Grid>
        </div>
      )}

      {/* Empty State */}
      {goals.length === 0 && (
        <Card withBorder p="xl" radius="md" style={{ textAlign: 'center' }}>
          <Text size="xl" mb="md">🎯</Text>
          <Text fw={600} size="lg" mb="xs">No goals set yet</Text>
          <Text c="dimmed" mb="lg">Set your first learning goal to start tracking your progress</Text>
          <Button onClick={() => setShowCreateModal(true)}>Create Your First Goal</Button>
        </Card>
      )}

      {/* Create Goal Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <Card withBorder p="xl" radius="md" style={{ width: '500px', maxWidth: '90vw' }}>
            <Title order={3} mb="lg">Create New Goal</Title>
            
            <Stack>
              <div>
                <Text size="sm" fw={500} mb="xs">Goal Type</Text>
                <select
                  value={newGoal.type}
                  onChange={(e) => setNewGoal({ ...newGoal, type: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                >
                  <option value="problems">Problems Solved</option>
                  <option value="accuracy">Accuracy Rate (%)</option>
                  <option value="consistency">Study Sessions</option>
                </select>
              </div>

              <div>
                <Text size="sm" fw={500} mb="xs">Target</Text>
                <input
                  type="number"
                  value={newGoal.target}
                  onChange={(e) => setNewGoal({ ...newGoal, target: e.target.value })}
                  placeholder={newGoal.type === 'accuracy' ? '85' : '20'}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                />
              </div>

              <div>
                <Text size="sm" fw={500} mb="xs">Timeframe</Text>
                <select
                  value={newGoal.timeframe}
                  onChange={(e) => setNewGoal({ ...newGoal, timeframe: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div>
                <Text size="sm" fw={500} mb="xs">Description</Text>
                <input
                  type="text"
                  value={newGoal.description}
                  onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                  placeholder="e.g., Solve 20 medium problems this week"
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <Button
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                  style={{ flex: 1 }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateGoal}
                  disabled={!newGoal.target || !newGoal.description}
                  style={{ flex: 1 }}
                >
                  Create Goal
                </Button>
              </div>
            </Stack>
          </Card>
        </div>
      )}
    </Container>
  );
}

// All extracted components have been moved to their respective files:
// - MistakeAnalysis → strategy/mistake-analysis.jsx
// - TagMastery → strategy/tag-mastery.jsx  
// - Metrics → sessions/session-history.jsx
// - ProductivityInsights → sessions/productivity-insights.jsx
// - LearningPath → strategy/learning-path.jsx
// - General → settings/general.jsx
// - Appearance → settings/appearance.jsx
// - Accessibility → settings/accessibility.jsx

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
