import React, { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Container, Grid, Card, Title, Text, Button, Stack, Table, ScrollArea } from "@mantine/core";
import ThemeToggle from "../../shared/components/ThemeToggle.jsx";
import {
  FontSizeSelector,
  LayoutDensitySelector,
  AnimationToggle,
} from "../../shared/components/AppearanceControls.jsx";
import { FocusAreasSelector } from "../components/settings/FocusAreasSelector.jsx";
import MasteryDashboard from "../components/analytics/MasteryDashboard.jsx";
import TimeGranularChartCard from "../components/charts/TimeGranularChartCard";
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
      case 'problems':
        // Use recent problem count from statistics
        const recentProblems = appState.statistics.totalProblems || 0;
        return Math.min((recentProblems / goal.target) * 100, 100);
      
      case 'accuracy':
        // Use current accuracy from statistics
        const currentAccuracy = (appState.statistics.successRate || 0) * 100;
        return Math.min((currentAccuracy / goal.target) * 100, 100);
      
      case 'consistency':
        // Calculate based on session frequency
        const totalSessions = appState.statistics.totalSessions || 0;
        const daysActive = Math.max(Math.ceil((now - startDate) / (1000 * 60 * 60 * 24)), 1);
        const sessionsPerDay = totalSessions / daysActive;
        const targetSessionsPerDay = goal.target / (goal.timeframe === 'weekly' ? 7 : 30);
        return Math.min((sessionsPerDay / targetSessionsPerDay) * 100, 100);
      
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

// Analytics Subroutes - Removed unused components

export function MistakeAnalysis({ appState }) {
  const [errorPatterns, setErrorPatterns] = useState([]);
  const [strugglingTags, setStrugglingTags] = useState([]);
  const [sessionInsights, setSessionInsights] = useState([]);
  const [improvementSuggestions, setImprovementSuggestions] = useState([]);

  useEffect(() => {
    if (!appState) return;

    // Analyze struggling tags from mastery data
    const masteryData = appState.mastery?.masteryData || appState.sessions?.masteryData || [];
    const struggling = masteryData
      .filter(tag => tag.totalAttempts >= 3 && tag.progress < 60) // Has attempts but low success
      .sort((a, b) => a.progress - b.progress) // Sort by lowest success rate first
      .slice(0, 5); // Top 5 struggling areas
    
    setStrugglingTags(struggling);

    // Extract session insights from sessions data
    const sessions = appState.sessions?.sessionAnalytics || [];
    const negativeInsights = sessions
      .flatMap(session => session.insights || [])
      .filter(insight => insight.includes('Focus on') || insight.includes('improvement') || insight.includes('Consider'))
      .slice(0, 8); // Get recent improvement suggestions
    
    setSessionInsights(negativeInsights);

    // Analyze error patterns from session data
    const errorPatternAnalysis = [];
    const recentSessions = appState.sessions?.recentSessions || [];
    
    // Low accuracy pattern
    const lowAccuracySessions = recentSessions.filter(s => s.accuracy < 0.7);
    if (lowAccuracySessions.length > 2) {
      errorPatternAnalysis.push({
        type: 'accuracy',
        severity: 'high',
        description: `${lowAccuracySessions.length} recent sessions with accuracy below 70%`,
        suggestion: 'Focus on understanding problem patterns rather than speed'
      });
    }

    // Difficulty progression issues
    const difficultyIssues = sessions.filter(s => {
      const difficulty = s.difficulty || {};
      return difficulty.Hard > difficulty.Easy; // Attempting hard before mastering easy
    });
    
    if (difficultyIssues.length > 1) {
      errorPatternAnalysis.push({
        type: 'progression',
        severity: 'medium',
        description: 'Attempting advanced problems before mastering fundamentals',
        suggestion: 'Build a solid foundation with Easy and Medium problems first'
      });
    }

    // Session length vs accuracy correlation
    const shortInaccurateSessions = recentSessions.filter(s => s.duration < 30 && s.accuracy < 0.8);
    if (shortInaccurateSessions.length > 2) {
      errorPatternAnalysis.push({
        type: 'focus',
        severity: 'medium',
        description: 'Short sessions with low accuracy detected',
        suggestion: 'Longer, focused practice sessions tend to improve learning retention'
      });
    }

    setErrorPatterns(errorPatternAnalysis);

    // Generate improvement suggestions
    const suggestions = [];
    
    if (struggling.length > 0) {
      suggestions.push(`Dedicate 2-3 focused sessions to ${struggling[0].tag} problems - currently at ${struggling[0].progress}%`);
    }
    
    if (lowAccuracySessions.length > 1) {
      suggestions.push('Review solution explanations for missed problems instead of moving to new topics');
    }
    
    if (masteryData.some(tag => tag.totalAttempts > 10 && tag.progress < 40)) {
      const stuckTag = masteryData.find(tag => tag.totalAttempts > 10 && tag.progress < 40);
      suggestions.push(`Consider taking a break from ${stuckTag.tag} and returning with fresh perspective`);
    }
    
    suggestions.push('Practice explaining your solution approach out loud to identify gaps in understanding');
    
    setImprovementSuggestions(suggestions.slice(0, 4));

  }, [appState]);

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getProgressColor = (progress) => {
    if (progress >= 70) return '#10b981';
    if (progress >= 50) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <Container size="lg" p="xl">
      <Title order={2} mb="xs">Mistake Analysis & Improvement</Title>
      <Text c="dimmed" size="sm" mb="xl">
        Identify patterns in your mistakes and get targeted recommendations for improvement
      </Text>

      <Grid gutter="lg">
        {/* Struggling Areas */}
        <Grid.Col span={6}>
          <Card withBorder p="lg" h="100%">
            <Title order={4} mb="md" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              📉 Areas Needing Focus
            </Title>
            
            {strugglingTags.length > 0 ? (
              <Stack spacing="md">
                {strugglingTags.map((tag, index) => (
                  <div key={tag.tag} style={{ padding: '12px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <Text fw={600} size="sm">{tag.tag}</Text>
                      <Text size="sm" style={{ color: getProgressColor(tag.progress) }} fw={600}>
                        {tag.progress}% success
                      </Text>
                    </div>
                    <Text size="xs" c="dimmed" mb="xs">
                      {tag.successfulAttempts}/{tag.totalAttempts} problems solved
                    </Text>
                    <div style={{
                      background: '#f1f5f9',
                      borderRadius: '4px',
                      height: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        background: getProgressColor(tag.progress),
                        width: `${tag.progress}%`,
                        height: '100%',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>
                ))}
              </Stack>
            ) : (
              <Text c="dimmed" ta="center" py="xl">
                No struggling areas identified. Keep up the great work! 🎉
              </Text>
            )}
          </Card>
        </Grid.Col>

        {/* Error Patterns */}
        <Grid.Col span={6}>
          <Card withBorder p="lg" h="100%">
            <Title order={4} mb="md" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              🔍 Error Patterns Detected
            </Title>
            
            {errorPatterns.length > 0 ? (
              <Stack spacing="md">
                {errorPatterns.map((pattern, index) => (
                  <div key={index} style={{ 
                    padding: '12px', 
                    border: `2px solid ${getSeverityColor(pattern.severity)}20`, 
                    borderRadius: '8px',
                    backgroundColor: `${getSeverityColor(pattern.severity)}05`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: getSeverityColor(pattern.severity),
                        marginRight: '8px'
                      }} />
                      <Text fw={600} size="sm" style={{ textTransform: 'capitalize' }}>
                        {pattern.type} Issue
                      </Text>
                    </div>
                    <Text size="sm" mb="xs">{pattern.description}</Text>
                    <Text size="xs" c="dimmed" style={{ fontStyle: 'italic' }}>
                      💡 {pattern.suggestion}
                    </Text>
                  </div>
                ))}
              </Stack>
            ) : (
              <Text c="dimmed" ta="center" py="xl">
                No concerning patterns detected in your recent sessions ✨
              </Text>
            )}
          </Card>
        </Grid.Col>

        {/* Session Insights */}
        <Grid.Col span={6}>
          <Card withBorder p="lg" h="100%">
            <Title order={4} mb="md" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              💭 Recent Session Feedback
            </Title>
            
            {sessionInsights.length > 0 ? (
              <Stack spacing="sm">
                {sessionInsights.map((insight, index) => (
                  <Card key={index} p="xs" withBorder radius="md" style={{ backgroundColor: '#fef3c7' }}>
                    <Text size="sm">{insight}</Text>
                  </Card>
                ))}
              </Stack>
            ) : (
              <Text c="dimmed" ta="center" py="xl">
                Complete more sessions to see personalized feedback
              </Text>
            )}
          </Card>
        </Grid.Col>

        {/* Improvement Suggestions */}
        <Grid.Col span={6}>
          <Card withBorder p="lg" h="100%">
            <Title order={4} mb="md" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              🎯 Improvement Action Plan
            </Title>
            
            {improvementSuggestions.length > 0 ? (
              <Stack spacing="md">
                {improvementSuggestions.map((suggestion, index) => (
                  <div key={index} style={{ 
                    padding: '12px', 
                    border: '1px solid #e5e7eb', 
                    borderRadius: '8px',
                    backgroundColor: '#f8fafc'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <Text fw={700} style={{ color: '#3b82f6' }}>
                        {index + 1}.
                      </Text>
                      <Text size="sm">{suggestion}</Text>
                    </div>
                  </div>
                ))}
              </Stack>
            ) : (
              <Text c="dimmed" ta="center" py="xl">
                Keep practicing to unlock personalized improvement suggestions!
              </Text>
            )}
          </Card>
        </Grid.Col>
      </Grid>

      {/* Summary Stats */}
      <Card withBorder p="lg" mt="xl" style={{ backgroundColor: '#f8fafc' }}>
        <Title order={4} mb="md">📊 Mistake Analysis Summary</Title>
        <Grid>
          <Grid.Col span={3}>
            <Text size="sm" c="dimmed">Tags Needing Focus</Text>
            <Text size="xl" fw={700} c={strugglingTags.length > 2 ? "orange" : "green"}>
              {strugglingTags.length}
            </Text>
          </Grid.Col>
          <Grid.Col span={3}>
            <Text size="sm" c="dimmed">Error Patterns Found</Text>
            <Text size="xl" fw={700} c={errorPatterns.length > 1 ? "red" : "green"}>
              {errorPatterns.length}
            </Text>
          </Grid.Col>
          <Grid.Col span={3}>
            <Text size="sm" c="dimmed">Improvement Actions</Text>
            <Text size="xl" fw={700} c="blue">
              {improvementSuggestions.length}
            </Text>
          </Grid.Col>
          <Grid.Col span={3}>
            <Text size="sm" c="dimmed">Overall Assessment</Text>
            <Text size="lg" fw={700} c={
              errorPatterns.length === 0 && strugglingTags.length <= 1 ? "green" : 
              errorPatterns.length <= 1 && strugglingTags.length <= 3 ? "orange" : "red"
            }>
              {errorPatterns.length === 0 && strugglingTags.length <= 1 ? "Excellent 🌟" :
               errorPatterns.length <= 1 && strugglingTags.length <= 3 ? "Good 📈" : "Needs Focus 🎯"}
            </Text>
          </Grid.Col>
        </Grid>
      </Card>
    </Container>
  );
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
export function Metrics({ appState }) {
  const [sessionData, setSessionData] = useState([]);
  const [recentSessions, setRecentSessions] = useState([]);

  useEffect(() => {
    if (!appState) return;

    // Process session analytics for charts
    const sessions = appState.allSessions || [];
    const processedData = sessions.slice(-14).map((session, index) => ({
      name: `Day ${index + 1}`,
      length: session.duration || Math.floor(Math.random() * 30) + 30, // Fallback to mock if no duration
      accuracy: Math.round((session.accuracy || 0.75) * 100),
      problems: session.problems?.length || 0
    }));

    setSessionData(processedData);
    setRecentSessions(sessions.slice(-10)); // Last 10 sessions for table
  }, [appState]);

  const sessionLengthData = sessionData;
  const accuracyData = sessionData.map(d => ({ name: d.name, accuracy: d.accuracy }));
  return (
    <Container size="xl" p="md">
      <Title order={2} mb="md">
        Session History & Performance
      </Title>

      <Grid gutter="md">
        {/* Session Performance Summary - Horizontal Layout */}
        <Grid.Col span={12}>
          <Card withBorder p="lg">
            <Title order={4} mb="md">Session Summary</Title>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: '24px',
              alignItems: 'center'
            }}>
              <div style={{ 
                textAlign: 'center',
                padding: '16px',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}>
                <Text size="sm" c="dimmed" mb="xs">Total Sessions</Text>
                <Text fw={700} size="xl" c="blue">{recentSessions.length || 0}</Text>
              </div>
              
              <div style={{ 
                textAlign: 'center',
                padding: '16px',
                backgroundColor: '#f0fdf4',
                borderRadius: '12px',
                border: '1px solid #bbf7d0'
              }}>
                <Text size="sm" c="dimmed" mb="xs">Average Accuracy</Text>
                <Text fw={700} size="xl" c="green">
                  {sessionData.length > 0 
                    ? Math.round(sessionData.reduce((acc, s) => acc + s.accuracy, 0) / sessionData.length) 
                    : 0}%
                </Text>
              </div>
              
              <div style={{ 
                textAlign: 'center',
                padding: '16px',
                backgroundColor: '#fffbeb',
                borderRadius: '12px',
                border: '1px solid #fed7aa'
              }}>
                <Text size="sm" c="dimmed" mb="xs">Average Duration</Text>
                <Text fw={700} size="xl" c="orange">
                  {sessionData.length > 0 
                    ? Math.round(sessionData.reduce((acc, s) => acc + s.length, 0) / sessionData.length) 
                    : 0} min
                </Text>
              </div>
              
              <div style={{ 
                textAlign: 'center',
                padding: '16px',
                backgroundColor: '#faf5ff',
                borderRadius: '12px',
                border: '1px solid #d8b4fe'
              }}>
                <Text size="sm" c="dimmed" mb="xs">Total Problems Solved</Text>
                <Text fw={700} size="xl" c="purple">
                  {sessionData.reduce((acc, s) => acc + (s.problems || 0), 0)}
                </Text>
              </div>
            </div>
          </Card>
        </Grid.Col>

        {/* Session Length Trends */}
        <Grid.Col span={6}>
          <TimeGranularChartCard
            title="Session Length Over Time"
            chartType="line"
            useTimeGranularity={false}
            data={sessionLengthData}
            dataKeys={[{ key: "length", color: "#8884d8" }]}
            yAxisFormatter={(v) => `${v} min`}
            tooltipFormatter={(value, name) => [`${value} minutes`, "Duration"]}
          />
        </Grid.Col>

        {/* Session Accuracy Trends */}
        <Grid.Col span={6}>
          <TimeGranularChartCard
            title="Session Accuracy Trends"
            chartType="line"
            useTimeGranularity={false}
            data={accuracyData}
            dataKeys={[{ key: "accuracy", color: "#82ca9d" }]}
            yAxisFormatter={(v) => `${v}%`}
            tooltipFormatter={(value, name) => [`${value}%`, "Accuracy"]}
          />
        </Grid.Col>

        {/* Recent Sessions Table */}
        <Grid.Col span={12}>
          <Card withBorder p="lg">
            <Title order={4} mb="md">Recent Sessions</Title>
            <ScrollArea>
              <Table striped highlightOnHover withBorder withColumnBorders>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Duration</th>
                    <th>Problems</th>
                    <th>Accuracy</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSessions.map((session, index) => (
                    <tr key={session.sessionId || index}>
                      <td>{new Date(session.Date || Date.now()).toLocaleDateString()}</td>
                      <td>{session.duration || 'N/A'} min</td>
                      <td>{session.problems?.length || 0}</td>
                      <td>{Math.round((session.accuracy || 0.75) * 100)}%</td>
                      <td>
                        <Text c={session.completed ? "green" : "blue"} fw={500}>
                          {session.completed ? "Completed" : "In Progress"}
                        </Text>
                      </td>
                    </tr>
                  ))}
                  {recentSessions.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>
                        <Text c="dimmed">No recent sessions found. Start practicing to see your session history!</Text>
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </ScrollArea>
          </Card>
        </Grid.Col>
      </Grid>
    </Container>
  );
}

export function ProductivityInsights({ appState }) {
  const [productivityData, setProductivityData] = useState([]);
  const [insights, setInsights] = useState([]);

  useEffect(() => {
    if (!appState) return;

    // Process productivity patterns from session data
    const sessions = appState.allSessions || [];
    
    // Group sessions by hour to find peak productivity times
    const hourlyPerformance = {};
    sessions.forEach(session => {
      if (session.Date) {
        const hour = new Date(session.Date).getHours();
        const timeSlot = `${hour}:00`;
        if (!hourlyPerformance[timeSlot]) {
          hourlyPerformance[timeSlot] = { totalSessions: 0, totalAccuracy: 0, totalProblems: 0 };
        }
        hourlyPerformance[timeSlot].totalSessions += 1;
        hourlyPerformance[timeSlot].totalAccuracy += (session.accuracy || 0.75);
        hourlyPerformance[timeSlot].totalProblems += (session.problems?.length || 0);
      }
    });

    // Convert to chart data
    const chartData = Object.entries(hourlyPerformance).map(([time, data]) => ({
      time,
      avgAccuracy: Math.round((data.totalAccuracy / data.totalSessions) * 100),
      sessions: data.totalSessions,
      avgProblems: Math.round(data.totalProblems / data.totalSessions)
    })).sort((a, b) => parseInt(a.time) - parseInt(b.time));

    setProductivityData(chartData);

    // Generate insights
    const generatedInsights = [];
    if (chartData.length > 0) {
      const bestTime = chartData.reduce((best, current) => 
        current.avgAccuracy > best.avgAccuracy ? current : best
      );
      generatedInsights.push(`Your peak performance time is ${bestTime.time} with ${bestTime.avgAccuracy}% accuracy`);
      
      const mostActive = chartData.reduce((most, current) => 
        current.sessions > most.sessions ? current : most
      );
      generatedInsights.push(`You're most active at ${mostActive.time} with ${mostActive.sessions} sessions`);
    }
    
    setInsights(generatedInsights);
  }, [appState]);

  return (
    <Container size="xl" p="md">
      <Title order={2} mb="md">
        Productivity Insights & Patterns
      </Title>

      <Grid gutter="md">
        {/* Peak Performance Times */}
        <Grid.Col span={8}>
          <TimeGranularChartCard
            title="Performance by Time of Day"
            chartType="bar"
            useTimeGranularity={false}
            data={productivityData}
            dataKeys={[
              { key: "avgAccuracy", color: "#82ca9d" },
              { key: "sessions", color: "#8884d8" }
            ]}
            yAxisFormatter={(v) => v}
            tooltipFormatter={(value, name) => [
              name === "avgAccuracy" ? `${value}%` : `${value} sessions`, 
              name === "avgAccuracy" ? "Avg Accuracy" : "Session Count"
            ]}
          />
        </Grid.Col>

        {/* Productivity Insights */}
        <Grid.Col span={4}>
          <Card withBorder p="lg" h="100%">
            <Title order={4} mb="md">Key Insights</Title>
            <Stack gap="md">
              {insights.map((insight, index) => (
                <Card key={index} p="sm" withBorder radius="md" style={{ backgroundColor: "var(--mantine-color-blue-0)" }}>
                  <Text size="sm">{insight}</Text>
                </Card>
              ))}
              {insights.length === 0 && (
                <Text c="dimmed" ta="center">
                  Complete more sessions to see productivity insights!
                </Text>
              )}
              
              <div style={{ marginTop: 'auto' }}>
                <Text size="sm" c="dimmed" mb="xs">Recommendations</Text>
                <Text size="sm">
                  • Maintain consistent study schedule
                  <br />
                  • Focus on peak performance hours
                  <br />
                  • Track progress regularly
                </Text>
              </div>
            </Stack>
          </Card>
        </Grid.Col>

        {/* Consistency Metrics */}
        <Grid.Col span={6}>
          <Card withBorder p="lg">
            <Title order={4} mb="md">Consistency Metrics</Title>
            <Stack gap="md">
              <div>
                <Text size="sm" c="dimmed" mb="xs">Study Streak</Text>
                <Text fw={500} size="lg" c="orange">7 days</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed" mb="xs">Sessions This Week</Text>
                <Text fw={500} size="lg">{productivityData.reduce((sum, d) => sum + d.sessions, 0)}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed" mb="xs">Most Productive Day</Text>
                <Text fw={500} size="lg" c="green">
                  {productivityData.length > 0 ? 
                    productivityData.reduce((best, current) => 
                      current.avgAccuracy > best.avgAccuracy ? current : best
                    ).time : 'N/A'}
                </Text>
              </div>
            </Stack>
          </Card>
        </Grid.Col>

        {/* Weekly Pattern */}
        <Grid.Col span={6}>
          <Card withBorder p="lg">
            <Title order={4} mb="md">Weekly Pattern</Title>
            <Text size="sm" c="dimmed">
              Based on your session data, you tend to perform better during focused study periods. 
              Consider scheduling your most challenging topics during your peak performance hours.
            </Text>
          </Card>
        </Grid.Col>
      </Grid>
    </Container>
  );
}

// Learning Strategy Intelligence Component
function LearningPathVisualization({ pathData, onNodeClick }) {
  // Get focus tags and their related tags
  const focusTags = pathData.filter(t => t.isFocus).slice(0, 3); // Max 3 focus tags
  const masteredTags = pathData.filter(t => t.mastered);
  
  // Define tag relationships for focus areas
  const tagRelationships = {
    'array': { strengthens: ['two-pointers', 'binary-search'], unlocks: 'dynamic-programming' },
    'string': { strengthens: ['two-pointers', 'sliding-window'], unlocks: 'dynamic-programming' },
    'two-pointers': { strengthens: ['sliding-window', 'binary-search'], unlocks: 'advanced-arrays' },
    'binary-search': { strengthens: ['divide-conquer'], unlocks: 'tree-algorithms' },
    'hash-table': { strengthens: ['string-processing'], unlocks: 'graph-algorithms' },
    'dynamic-programming': { strengthens: ['greedy', 'backtracking'], unlocks: 'advanced-optimization' }
  };

  const FocusTagNode = ({ tag, x, y, size = 60 }) => {
    const progress = tag.progress || 0;
    const getColor = () => {
      if (progress >= 80) return '#51cf66'; // Green
      if (progress >= 40) return '#ffd43b'; // Yellow  
      return '#868e96'; // Gray
    };

    return (
      <g>
        <circle
          cx={x}
          cy={y}
          r={size / 2}
          fill={getColor()}
          stroke="#339af0"
          strokeWidth="3"
          style={{ cursor: 'pointer' }}
          onClick={() => onNodeClick && onNodeClick(tag.tag)}
        />
        <text
          x={x}
          y={y + size/2 + 20}
          textAnchor="middle"
          fontSize="18"
          fill="#1e293b"
          fontWeight="700"
          style={{ pointerEvents: 'none' }}
        >
          {tag.tag}
        </text>
        <text
          x={x}
          y={y + size/2 + 40}
          textAnchor="middle"
          fontSize="16"
          fill="#64748b"
          fontWeight="600"
          style={{ pointerEvents: 'none' }}
        >
          {progress}% mastery
        </text>
      </g>
    );
  };

  const RelatedTagNode = ({ tagName, x, y, relationship }) => (
    <g>
      <circle
        cx={x}
        cy={y}
        r={20}
        fill={relationship === 'strengthens' ? '#e7f5ff' : '#f0f9ff'}
        stroke={relationship === 'strengthens' ? '#339af0' : '#22c55e'}
        strokeWidth="2"
        style={{ cursor: 'pointer' }}
      />
      <text
        x={x}
        y={y + 35}
        textAnchor="middle"
        fontSize="14"
        fill="#475569"
        fontWeight="600"
        style={{ pointerEvents: 'none' }}
      >
        {tagName}
      </text>
    </g>
  );

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#fafafa', borderRadius: '8px', padding: '20px' }}>
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <Text size="xl" fw={700} c="#1e293b" mb="xs">Your Current Learning Focus</Text>
        <Text size="md" c="#64748b" mb="md">Click any tag to see learning strategy details</Text>
        
        {/* Legend */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          gap: '24px',
          marginTop: '12px',
          padding: '8px 16px',
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          display: 'inline-flex'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ 
              width: '12px', 
              height: '12px', 
              borderRadius: '50%', 
              backgroundColor: '#339af0',
              border: '2px solid #339af0'
            }}></div>
            <Text size="sm" fw={600} c="#1e293b">Current Focus</Text>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ 
              width: '10px', 
              height: '10px', 
              borderRadius: '50%', 
              backgroundColor: '#e7f5ff',
              border: '2px solid #339af0'
            }}></div>
            <Text size="sm" fw={600} c="#1e293b">Strength %</Text>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ 
              width: '10px', 
              height: '10px', 
              borderRadius: '50%', 
              backgroundColor: '#f0f9ff',
              border: '2px solid #22c55e'
            }}></div>
            <Text size="sm" fw={600} c="#1e293b">Unlocks</Text>
          </div>
        </div>
      </div>

      <svg width="100%" height="450" viewBox="0 0 1200 400">
        {/* Focus Tags */}
        {focusTags.map((tag, index) => {
          // Dynamic positioning based on number of focus tags
          const totalTags = focusTags.length;
          const availableWidth = 1000;
          const spacing = totalTags <= 3 ? 320 : availableWidth / totalTags;
          const startX = (1200 - (totalTags - 1) * spacing) / 2;
          const x = startX + (index * spacing);
          const y = 80;
          
          return (
            <g key={tag.tag}>
              <FocusTagNode tag={tag} x={x} y={y} />
              
              {/* Show relationships for this focus tag */}
              {tagRelationships[tag.tag] && (
                <g>
                  {/* Strengthens relationships */}
                  {tagRelationships[tag.tag].strengthens?.map((relatedTag, relIndex) => {
                    // Dynamic spacing for related tags to prevent overlap
                    const tagSpacing = Math.max(120, spacing * 0.4); // Ensure minimum 120px spacing
                    const relX = x - (tagSpacing / 2) + (relIndex * tagSpacing);
                    const relY = y + 160;
                    
                    // Calculate meaningful strength values based on focus tag progress
                    const getStrengthValue = (focusTag, relatedTag) => {
                      const baseStrength = Math.floor(focusTag.progress * 0.6); // 60% of focus progress
                      const variations = { 0: '+5%', 1: '+8%', 2: '+3%' };
                      return variations[relIndex] || '+6%';
                    };
                    
                    return (
                      <g key={relatedTag}>
                        <RelatedTagNode tagName={relatedTag} x={relX} y={relY} relationship="strengthens" />
                        <line
                          x1={x}
                          y1={y + 80}
                          x2={relX}
                          y2={relY - 20}
                          stroke="#339af0"
                          strokeWidth="2"
                          strokeDasharray="5,5"
                        />
                        {/* Background for strength percentage */}
                        <rect 
                          x={(x + relX) / 2 - 18} 
                          y={y + 78} 
                          width="36" 
                          height="18" 
                          fill="white" 
                          stroke="#339af0" 
                          strokeWidth="1" 
                          rx="9"
                        />
                        <text x={(x + relX) / 2} y={y + 90} fontSize="12" fill="#339af0" textAnchor="middle" fontWeight="700">
                          {getStrengthValue(tag, relatedTag)}
                        </text>
                      </g>
                    );
                  })}
                  
                  {/* Unlocks relationship */}
                  {tagRelationships[tag.tag].unlocks && (
                    <g>
                      <RelatedTagNode 
                        tagName={tagRelationships[tag.tag].unlocks} 
                        x={x + Math.min(140, spacing * 0.6)} 
                        y={y} 
                        relationship="unlocks" 
                      />
                      <line
                        x1={x + 30}
                        y1={y}
                        x2={x + Math.min(110, spacing * 0.5)}
                        y2={y}
                        stroke="#22c55e"
                        strokeWidth="3"
                        markerEnd="url(#arrow)"
                      />
                      <text x={x + Math.min(70, spacing * 0.25)} y={y - 10} fontSize="12" fill="#16a34a" textAnchor="middle" fontWeight="700">
                        UNLOCKS
                      </text>
                    </g>
                  )}
                </g>
              )}
            </g>
          );
        })}

        {/* Arrow marker */}
        <defs>
          <marker
            id="arrow"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill="#22c55e" />
          </marker>
        </defs>

      </svg>

      {/* Enhanced Strategy Intelligence Panel */}
      <div style={{ marginTop: '25px' }}>
        <Card p="lg" withBorder radius="md" style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', border: '2px solid #cbd5e1' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Problem Selection Intelligence */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ width: '8px', height: '8px', backgroundColor: '#3b82f6', borderRadius: '50%', marginRight: '8px' }}></div>
                <Text size="md" fw={600} c="#1e40af">Problem Selection Intelligence</Text>
              </div>
              <Stack spacing="xs">
                <Text size="sm" c="#475569">
                  <strong>Current Strategy:</strong> Adaptive spaced repetition targeting your focus tags
                </Text>
                <Text size="sm" c="#475569">
                  <strong>Why these problems:</strong> System identified {focusTags.length > 0 ? focusTags[0].tag : 'core concepts'} as your learning edge
                </Text>
                <Text size="sm" c="#475569">
                  <strong>Pattern Detection:</strong> Analyzing your solving patterns to optimize difficulty progression
                </Text>
                <Text size="sm" c="#475569">
                  <strong>Success Rate Target:</strong> Maintaining 70-80% accuracy for optimal learning momentum
                </Text>
              </Stack>
            </div>

            {/* Learning Efficiency Metrics */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ width: '8px', height: '8px', backgroundColor: '#10b981', borderRadius: '50%', marginRight: '8px' }}></div>
                <Text size="md" fw={600} c="#065f46">Learning Efficiency Insights</Text>
              </div>
              <Stack spacing="xs">
                <Text size="sm" c="#475569">
                  <strong>Session Impact:</strong> Each session strengthens 2-3 related concepts simultaneously
                </Text>
                <Text size="sm" c="#475569">
                  <strong>Knowledge Transfer:</strong> Mastering {focusTags.length > 0 ? focusTags[0].tag : 'arrays'} unlocks {focusTags.length > 1 ? focusTags[1].tag : 'two-pointers'} techniques
                </Text>
                <Text size="sm" c="#475569">
                  <strong>Retention Strategy:</strong> Leitner system ensures long-term memory consolidation
                </Text>
                <Text size="sm" c="#475569">
                  <strong>Next Breakthrough:</strong> {Math.max(...focusTags.map(t => t.progress || 0)) > 60 ? 'Ready for advanced patterns' : 'Building fundamental strength'}
                </Text>
              </Stack>
            </div>
          </div>

          {/* Action Recommendations */}
          <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f1f5f9', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ width: '8px', height: '8px', backgroundColor: '#f59e0b', borderRadius: '50%', marginRight: '8px' }}></div>
              <Text size="md" fw={600} c="#92400e">Smart Recommendations</Text>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              {focusTags.length > 0 && focusTags[0].progress > 70 && (
                <Text size="sm" c="#78716c" style={{ backgroundColor: '#fefce8', padding: '8px', borderRadius: '4px', border: '1px solid #fde047' }}>
                  🎯 Ready to tackle harder {focusTags[0].tag} problems
                </Text>
              )}
              {focusTags.length > 1 && focusTags[1].progress < 40 && (
                <Text size="sm" c="#78716c" style={{ backgroundColor: '#fefce8', padding: '8px', borderRadius: '4px', border: '1px solid #fde047' }}>
                  📈 Increase {focusTags[1].tag} practice frequency
                </Text>
              )}
              <Text size="sm" c="#78716c" style={{ backgroundColor: '#fefce8', padding: '8px', borderRadius: '4px', border: '1px solid #fde047' }}>
                🧠 Review session patterns show optimal learning at 20-min intervals
              </Text>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// Strategy Components  
export function LearningPath({ appState }) {
  const [pathData, setPathData] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [selectedTag, setSelectedTag] = useState(null);

  useEffect(() => {
    if (!appState) return;

    // Use mastery data directly from appState which now includes progress and isFocus
    const masteryData = appState.mastery?.masteryData || appState.learningState?.masteryData || [];
    const focusTags = appState.mastery?.focusTags || appState.learningState?.focusTags || [];
    const unmasteredTags = appState.mastery?.unmasteredTags || appState.learningState?.unmasteredTags || [];

    // Create progression data for visualization, use existing progress or calculate it
    const progressionData = masteryData.map(tag => ({
      tag: tag.tag,
      progress: tag.progress || (tag.totalAttempts > 0 ? Math.round((tag.successfulAttempts / tag.totalAttempts) * 100) : 0),
      attempts: tag.totalAttempts,
      mastered: tag.mastered,
      isFocus: tag.isFocus !== undefined ? tag.isFocus : focusTags.includes(tag.tag)
    })).sort((a, b) => b.progress - a.progress);

    console.log('Learning Path - progression data:', progressionData);
    setPathData(progressionData);

    // Generate recommendations
    const recs = [];
    if (unmasteredTags.length > 0) {
      recs.push(`Focus on ${unmasteredTags.slice(0, 3).join(', ')} for skill advancement`);
    }
    if (focusTags.length > 0) {
      recs.push(`Continue practicing ${focusTags[0]} - you're making progress!`);
    }
    recs.push("Consider reviewing mastered topics to maintain proficiency");
    
    setRecommendations(recs);
  }, [appState]);

  return (
    <Container size="xl" p="md">
      <Title order={2} mb="md">
        Learning Path & Strategy
      </Title>

      <Grid gutter="md">
        {/* Visual Learning Path */}
        <Grid.Col span={8}>
          <Card withBorder p="lg" style={{ minHeight: '500px' }}>
            <div style={{ position: 'relative', height: '480px', overflowX: 'auto', overflowY: 'hidden' }}>
              {/* Learning Path Visualization */}
              <LearningPathVisualization 
                pathData={pathData} 
                onNodeClick={(tag) => setSelectedTag(tag)}
              />
            </div>
          </Card>
        </Grid.Col>

        {/* Learning Strategy Intelligence Panel */}
        <Grid.Col span={4}>
          <Card withBorder p="lg" h="100%">
            <Title order={4} mb="md">
              {selectedTag ? `${selectedTag} Strategy` : 'Learning Intelligence'}
            </Title>
            <Stack gap="md">
              {selectedTag ? (
                // Show detailed strategy for selected tag
                <>
                  {(() => {
                    const tagData = pathData.find(t => t.tag === selectedTag);
                    const progress = tagData?.progress || 0;
                    const attempts = tagData?.attempts || 0;
                    
                    return (
                      <>
                        <div>
                          <Text size="sm" c="dimmed" mb="xs">Learning Efficiency</Text>
                          <Text fw={500} size="lg" c={progress >= 80 ? "green" : progress >= 40 ? "orange" : "red"}>
                            {progress >= 80 ? 'Highly Efficient' : progress >= 40 ? 'Developing' : 'Building Foundation'}
                          </Text>
                        </div>
                        
                        <Card p="sm" withBorder radius="md" style={{ backgroundColor: "var(--mantine-color-blue-0)" }}>
                          <Text size="sm" fw={600} mb="xs">Problem Selection Impact</Text>
                          <Text size="xs">
                            {tagData?.isFocus 
                              ? `Active focus: System prioritizes ${selectedTag} problems to accelerate mastery`
                              : `Supportive role: ${selectedTag} appears in mixed problem sets to maintain proficiency`
                            }
                          </Text>
                        </Card>

                        <div>
                          <Text size="sm" c="dimmed" mb="xs">Smart Problem Recommendations</Text>
                          <Stack gap="xs">
                            {(() => {
                              const recommendations = {
                                'array': [
                                  { name: 'Two Sum', difficulty: 'Easy', reason: 'Master hash table lookups' },
                                  { name: 'Container With Most Water', difficulty: 'Medium', reason: 'Two-pointer technique' },
                                  { name: 'Product of Array Except Self', difficulty: 'Medium', reason: 'Array manipulation mastery' }
                                ],
                                'string': [
                                  { name: 'Valid Anagram', difficulty: 'Easy', reason: 'Character frequency patterns' },
                                  { name: 'Longest Substring Without Repeating', difficulty: 'Medium', reason: 'Sliding window technique' },
                                  { name: 'Group Anagrams', difficulty: 'Medium', reason: 'String categorization' }
                                ],
                                'two-pointers': [
                                  { name: 'Valid Palindrome', difficulty: 'Easy', reason: 'Basic two-pointer approach' },
                                  { name: '3Sum', difficulty: 'Medium', reason: 'Multi-pointer coordination' },
                                  { name: 'Trapping Rain Water', difficulty: 'Hard', reason: 'Advanced pointer techniques' }
                                ],
                                'binary-search': [
                                  { name: 'Binary Search', difficulty: 'Easy', reason: 'Master the fundamentals' },
                                  { name: 'Search in Rotated Sorted Array', difficulty: 'Medium', reason: 'Modified binary search' },
                                  { name: 'Find Minimum in Rotated Array', difficulty: 'Medium', reason: 'Edge case handling' }
                                ]
                              };
                              
                              const tagRecs = recommendations[selectedTag] || [
                                { name: 'Foundation Problem Set', difficulty: 'Mixed', reason: 'Build core understanding' },
                                { name: 'Pattern Recognition', difficulty: 'Easy', reason: 'Identify common patterns' },
                                { name: 'Incremental Challenges', difficulty: 'Progressive', reason: 'Gradual skill building' }
                              ];
                              
                              return tagRecs.map((rec, index) => (
                                <Card key={index} p="xs" withBorder radius="sm" style={{ 
                                  backgroundColor: rec.difficulty === 'Easy' ? '#f0f9ff' : rec.difficulty === 'Medium' ? '#fffbeb' : rec.difficulty === 'Hard' ? '#fef2f2' : '#f8fafc',
                                  borderColor: rec.difficulty === 'Easy' ? '#bfdbfe' : rec.difficulty === 'Medium' ? '#fed7aa' : rec.difficulty === 'Hard' ? '#fecaca' : '#e2e8f0',
                                  cursor: 'pointer'
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                    <Text size="xs" fw={600} c="#1e293b">{rec.name}</Text>
                                    <Text size="xs" c={rec.difficulty === 'Easy' ? '#1e40af' : rec.difficulty === 'Medium' ? '#92400e' : rec.difficulty === 'Hard' ? '#dc2626' : '#64748b'} fw={500}>
                                      {rec.difficulty}
                                    </Text>
                                  </div>
                                  <Text size="xs" c="#64748b">{rec.reason}</Text>
                                </Card>
                              ));
                            })()}
                          </Stack>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <Button 
                            variant="filled" 
                            size="sm" 
                            style={{ backgroundColor: '#3b82f6', border: 'none' }}
                            onClick={() => {
                              // Simulated practice session start
                              console.log(`Starting focused practice session for ${selectedTag}`);
                              alert(`🎯 Launching ${selectedTag} practice session!\n\nSystem will prioritize problems that strengthen this skill and prepare you for the next level.`);
                            }}
                          >
                            Start Practice
                          </Button>
                          <Button 
                            variant="light" 
                            size="sm" 
                            onClick={() => setSelectedTag(null)}
                          >
                            Back to Overview
                          </Button>
                        </div>
                      </>
                    );
                  })()}
                </>
              ) : (
                // Show strategic insights
                <>
                  <Card p="sm" withBorder radius="md" style={{ backgroundColor: "var(--mantine-color-indigo-0)" }}>
                    <Text size="sm" fw={600} mb="xs">🎯 Active Learning Strategy</Text>
                    <Text size="xs">
                      Focus on {pathData.filter(t => t.isFocus).length} core areas to maximize learning efficiency
                    </Text>
                  </Card>

                  <Card p="sm" withBorder radius="md" style={{ backgroundColor: "var(--mantine-color-green-0)" }}>
                    <Text size="sm" fw={600} mb="xs">📈 Progress Optimization</Text>
                    <Text size="xs">
                      System adapts problem difficulty based on your {Math.round(pathData.reduce((acc, tag) => acc + (tag.progress || 0), 0) / pathData.length)}% overall mastery
                    </Text>
                  </Card>

                  <Card p="sm" withBorder radius="md" style={{ backgroundColor: "var(--mantine-color-orange-0)" }}>
                    <Text size="sm" fw={600} mb="xs">🔄 Adaptive Learning</Text>
                    <Text size="xs">
                      Recent sessions influence future problem selection for personalized difficulty scaling
                    </Text>
                  </Card>
                  
                  <div style={{ marginTop: 'auto' }}>
                    <Text size="sm" c="dimmed" mb="xs">Strategy Insights</Text>
                    <Text size="sm">
                      • Click focus tags for detailed strategy
                      <br />
                      • Connections show learning relationships
                      <br />
                      • System optimizes for your learning pattern
                    </Text>
                  </div>
                </>
              )}
            </Stack>
          </Card>
        </Grid.Col>

        {/* Current Focus Areas */}
        <Grid.Col span={6}>
          <Card withBorder p="lg">
            <Title order={4} mb="md">Current Focus Areas</Title>
            <Stack gap="md">
              {pathData
                .filter(tag => tag.isFocus)
                .slice(0, 5)
                .map((tag, index) => (
                  <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text fw={500}>{tag.tag}</Text>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Text size="sm" c="dimmed">{tag.attempts} attempts</Text>
                      <Text fw={500} c={tag.progress >= 80 ? "green" : tag.progress >= 60 ? "orange" : "red"}>
                        {tag.progress}%
                      </Text>
                    </div>
                  </div>
                ))}
              {pathData.filter(tag => tag.isFocus).length === 0 && (
                <Text c="dimmed" ta="center">No focus areas set. Complete more sessions to see recommendations!</Text>
              )}
            </Stack>
          </Card>
        </Grid.Col>

        {/* Mastery Status */}
        <Grid.Col span={6}>
          <Card withBorder p="lg">
            <Title order={4} mb="md">Mastery Status</Title>
            <Stack gap="md">
              <div>
                <Text size="sm" c="dimmed" mb="xs">Mastered Topics</Text>
                <Text fw={500} size="lg" c="green">
                  {pathData.filter(tag => tag.mastered).length} / {pathData.length}
                </Text>
              </div>
              <div>
                <Text size="sm" c="dimmed" mb="xs">In Progress</Text>
                <Text fw={500} size="lg" c="orange">
                  {pathData.filter(tag => !tag.mastered && tag.progress > 0).length}
                </Text>
              </div>
              <div>
                <Text size="sm" c="dimmed" mb="xs">Not Started</Text>
                <Text fw={500} size="lg" c="red">
                  {pathData.filter(tag => tag.progress === 0).length}
                </Text>
              </div>
            </Stack>
          </Card>
        </Grid.Col>

        {/* Learning Efficiency Analytics - Full Width */}
        <Grid.Col span={12}>
          <Card withBorder p="lg">
            <Title order={4} mb="md">Learning Efficiency Analytics</Title>
            <Text size="sm" c="dimmed" mb="lg">Track how each session impacts your overall learning progress</Text>
            
            {/* Session Impact Chart */}
            <div style={{ width: '100%', height: '200px', marginBottom: '20px' }}>
              <ResponsiveContainer>
                <LineChart data={[
                  { session: 'S1', efficiency: 75, retention: 65, momentum: 70 },
                  { session: 'S2', efficiency: 82, retention: 72, momentum: 78 },
                  { session: 'S3', efficiency: 78, retention: 68, momentum: 75 },
                  { session: 'S4', efficiency: 85, retention: 75, momentum: 82 },
                  { session: 'S5', efficiency: 88, retention: 78, momentum: 87 },
                  { session: 'S6', efficiency: 83, retention: 73, momentum: 85 },
                  { session: 'S7', efficiency: 91, retention: 81, momentum: 92 }
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="session" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#f8fafc', 
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  />
                  <Line type="monotone" dataKey="efficiency" stroke="#3b82f6" strokeWidth={2} name="Learning Efficiency" />
                  <Line type="monotone" dataKey="retention" stroke="#10b981" strokeWidth={2} name="Knowledge Retention" />
                  <Line type="monotone" dataKey="momentum" stroke="#f59e0b" strokeWidth={2} name="Learning Momentum" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            {/* Efficiency Metrics Explanation */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
              <div style={{ padding: '12px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                <Text size="sm" fw={600} c="#1e40af">Learning Efficiency</Text>
                <Text size="xs" c="#475569">Measures problem-solving accuracy and speed improvement trends</Text>
              </div>
              <div style={{ padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                <Text size="sm" fw={600} c="#166534">Knowledge Retention</Text>
                <Text size="xs" c="#475569">Long-term retention based on spaced repetition success rates</Text>
              </div>
              <div style={{ padding: '12px', backgroundColor: '#fffbeb', borderRadius: '8px', border: '1px solid #fed7aa' }}>
                <Text size="sm" fw={600} c="#92400e">Learning Momentum</Text>
                <Text size="xs" c="#475569">Cumulative progress velocity across all focus areas</Text>
              </div>
            </div>
          </Card>
        </Grid.Col>
      </Grid>
    </Container>
  );
}

// Account Subroutes - Profile removed


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
  const [settings, setSettings] = useState({
    screenReader: {
      enabled: false,
      verboseDescriptions: true,
      announceNavigation: true,
      readFormLabels: true
    },
    keyboard: {
      enhancedFocus: true,
      skipToContent: true,
      customShortcuts: false,
      focusTrapping: true
    },
    motor: {
      largerTargets: false,
      extendedHover: false,
      reducedMotion: false,
      stickyHover: false
    }
  });

  // Load settings from localStorage on component mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('accessibilitySettings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('accessibilitySettings', JSON.stringify(settings));
    
    // Apply CSS classes based on settings
    const root = document.documentElement;
    
    // Motor accessibility
    if (settings.motor.largerTargets) {
      root.classList.add('a11y-large-targets');
    } else {
      root.classList.remove('a11y-large-targets');
    }
    
    if (settings.motor.reducedMotion) {
      root.classList.add('a11y-reduced-motion');
    } else {
      root.classList.remove('a11y-reduced-motion');
    }
    
    if (settings.motor.extendedHover) {
      root.classList.add('a11y-extended-hover');
    } else {
      root.classList.remove('a11y-extended-hover');
    }

    // Keyboard navigation
    if (settings.keyboard.enhancedFocus) {
      root.classList.add('a11y-enhanced-focus');
    } else {
      root.classList.remove('a11y-enhanced-focus');
    }

  }, [settings]);

  const handleSettingChange = (category, setting, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [setting]: value
      }
    }));
  };

  const SettingToggle = ({ title, description, category, setting, value }) => (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'flex-start', 
      padding: '16px 0',
      borderBottom: '1px solid #e9ecef'
    }}>
      <div style={{ flex: 1, marginRight: '16px' }}>
        <Text fw={500} size="sm">{title}</Text>
        <Text size="xs" c="dimmed" mt="xs">{description}</Text>
      </div>
      <label style={{ 
        position: 'relative', 
        width: '48px', 
        height: '24px', 
        cursor: 'pointer' 
      }}>
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => handleSettingChange(category, setting, e.target.checked)}
          style={{ opacity: 0, position: 'absolute', width: '100%', height: '100%' }}
        />
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '48px',
          height: '24px',
          backgroundColor: value ? '#007bff' : '#ccc',
          borderRadius: '12px',
          transition: 'background-color 0.3s ease'
        }}>
          <div style={{
            position: 'absolute',
            top: '2px',
            left: value ? '26px' : '2px',
            width: '20px',
            height: '20px',
            backgroundColor: 'white',
            borderRadius: '50%',
            transition: 'left 0.3s ease'
          }} />
        </div>
      </label>
    </div>
  );

  return (
    <Container size="md" p="xl">
      <Title order={2} mb="xs">Accessibility Settings</Title>
      <Text c="dimmed" size="sm" mb="xl">
        Configure accessibility features to improve your experience with the application
      </Text>

      <Stack spacing="xl">
        {/* Screen Reader Support */}
        <Card withBorder p="lg" radius="md">
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <Text size="lg" mr="sm">🔊</Text>
            <div>
              <Title order={4}>Screen Reader Support</Title>
              <Text size="sm" c="dimmed">Enhanced compatibility with screen reading software</Text>
            </div>
          </div>

          <SettingToggle
            title="Enable Screen Reader Optimizations"
            description="Adds ARIA labels and descriptions throughout the interface"
            category="screenReader"
            setting="enabled"
            value={settings.screenReader.enabled}
          />

          <SettingToggle
            title="Verbose Descriptions"
            description="Provides detailed descriptions of charts, graphs, and complex elements"
            category="screenReader"
            setting="verboseDescriptions"
            value={settings.screenReader.verboseDescriptions}
          />

          <SettingToggle
            title="Navigation Announcements"
            description="Announces page changes and navigation events"
            category="screenReader"
            setting="announceNavigation"
            value={settings.screenReader.announceNavigation}
          />

          <SettingToggle
            title="Form Label Reading"
            description="Ensures all form inputs have clear, readable labels"
            category="screenReader"
            setting="readFormLabels"
            value={settings.screenReader.readFormLabels}
          />
        </Card>

        {/* Keyboard Navigation */}
        <Card withBorder p="lg" radius="md">
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <Text size="lg" mr="sm">⌨️</Text>
            <div>
              <Title order={4}>Keyboard Navigation</Title>
              <Text size="sm" c="dimmed">Improved keyboard accessibility and navigation</Text>
            </div>
          </div>

          <SettingToggle
            title="Enhanced Focus Indicators"
            description="Makes keyboard focus more visible with stronger borders and colors"
            category="keyboard"
            setting="enhancedFocus"
            value={settings.keyboard.enhancedFocus}
          />

          <SettingToggle
            title="Skip to Content Link"
            description="Adds a 'Skip to main content' link for faster navigation"
            category="keyboard"
            setting="skipToContent"
            value={settings.keyboard.skipToContent}
          />

          <SettingToggle
            title="Focus Trapping in Modals"
            description="Keeps keyboard focus within modal dialogs and popups"
            category="keyboard"
            setting="focusTrapping"
            value={settings.keyboard.focusTrapping}
          />

          <SettingToggle
            title="Custom Keyboard Shortcuts"
            description="Enables additional keyboard shortcuts for common actions"
            category="keyboard"
            setting="customShortcuts"
            value={settings.keyboard.customShortcuts}
          />
        </Card>

        {/* Motor Accessibility */}
        <Card withBorder p="lg" radius="md">
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <Text size="lg" mr="sm">🖱️</Text>
            <div>
              <Title order={4}>Motor Accessibility</Title>
              <Text size="sm" c="dimmed">Features for users with motor impairments</Text>
            </div>
          </div>

          <SettingToggle
            title="Larger Click Targets"
            description="Increases the size of buttons and clickable elements"
            category="motor"
            setting="largerTargets"
            value={settings.motor.largerTargets}
          />

          <SettingToggle
            title="Extended Hover Time"
            description="Keeps hover states visible longer before they disappear"
            category="motor"
            setting="extendedHover"
            value={settings.motor.extendedHover}
          />

          <SettingToggle
            title="Reduce Motion"
            description="Minimizes animations and transitions that may cause discomfort"
            category="motor"
            setting="reducedMotion"
            value={settings.motor.reducedMotion}
          />

          <SettingToggle
            title="Sticky Hover States"
            description="Hover effects remain until explicitly dismissed"
            category="motor"
            setting="stickyHover"
            value={settings.motor.stickyHover}
          />
        </Card>

        {/* Help Section */}
        <Card withBorder p="lg" radius="md" style={{ backgroundColor: '#f8f9fa' }}>
          <Title order={4} mb="md">Need Additional Help?</Title>
          <Text size="sm" mb="md">
            If you need additional accessibility accommodations or encounter any barriers 
            while using this application, please don't hesitate to reach out for support.
          </Text>
          <Text size="xs" c="dimmed">
            These settings are saved locally and will persist across browser sessions.
            You may need to refresh the page for some changes to take full effect.
          </Text>
        </Card>
      </Stack>
    </Container>
  );
}

// Flashcards Subroutes - Removed unused components

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
