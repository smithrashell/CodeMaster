import logger from "../../../shared/utils/logger.js";
import { Container, Grid, Title, Card, Text, Select, Slider, Switch, Badge, Group, Button, Stack, ScrollArea } from "@mantine/core";
// TODO: Re-enable when edit tags dialog is fixed
// import CustomMultiSelect from "../../components/shared/CustomMultiSelect";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconTarget, IconClock, IconShield, IconRocket, IconAdjustments, IconRefresh, IconEdit } from "@tabler/icons-react";
import { usePageData } from "../../hooks/usePageData";
import SessionLimits from "../../../shared/utils/sessionLimits.js";

const SECTION_HEIGHT = 700; // Increased to 700px for extra spacious cards

// Custom hooks for Goals page state management
const useCadenceSettings = () => {
  return useState({
    sessionsPerWeek: 5, // System default
    sessionLength: 5, // System default (was incorrectly hardcoded as 45)
    flexibleSchedule: true // System default for adaptive mode
  });
};

const useFocusPriorities = () => {
  return useState({
    primaryTags: [], // Empty until loaded from user settings/system recommendations
    difficultyDistribution: { easy: 20, medium: 60, hard: 20 }, // System default distribution
    reviewRatio: 40 // System default review ratio
  });
};

const useGuardrails = () => {
  return useState({
    minReviewRatio: 30, // System default
    maxNewProblems: 8, // System default (will be adjusted for onboarding)
    difficultyCapEnabled: false, // System default - no artificial difficulty cap
    maxDifficulty: "Hard", // System default - allow all difficulties
    hintLimitEnabled: false, // System default - no artificial hint limits
    maxHintsPerProblem: 0 // System default - unlimited hints
  });
};

const useDailyMissions = () => {
  return useState([
    // Will be populated with real missions generated from user progress
  ]);
};

// Helper function to calculate outcome trends from app state
const calculateOutcomeTrends = (appState, getAccuracyStatus, getProblemsStatus, getHintEfficiencyStatus) => {
  const accuracyValue = appState.statistics?.successRate?.overall ? 
    Math.round(appState.statistics.successRate.overall * 100) : 0;
  
  const sessionsCount = appState.sessions?.allSessions?.length || 0;
  const hintEfficiency = appState.statistics?.averageHints || 0;
  const currentTier = appState.mastery?.currentTier || "Getting Started";
  
  return {
    weeklyAccuracy: {
      value: accuracyValue,
      status: accuracyValue > 0 ? getAccuracyStatus(accuracyValue / 100) : "no_data",
      target: 75
    },
    problemsPerWeek: {
      value: sessionsCount,
      status: sessionsCount > 0 ? getProblemsStatus(sessionsCount) : "no_data",
      target: "25-30",
      display: sessionsCount > 0 ? `${sessionsCount}` : "No sessions yet"
    },
    hintEfficiency: {
      value: hintEfficiency,
      status: hintEfficiency > 0 ? getHintEfficiencyStatus(hintEfficiency) : "no_data",
      display: hintEfficiency > 0 ? 
        `${hintEfficiency.toFixed(1)} per problem` : 
        "No data yet"
    },
    learningVelocity: {
      value: currentTier,
      status: "adaptive"
    }
  };
};

/**
 * Update all learning plan data when appState changes
 */
function updateLearningPlanData(
  appState,
  isOnboarding,
  getSessionState,
  setCadenceSettings,
  setFocusPriorities,
  setGuardrails,
  setDailyMissions,
  setOutcomeTrends,
  getAccuracyStatus,
  getProblemsStatus,
  getHintEfficiencyStatus,
  generateMissionsWithRealProgress
) {
  // Update cadence settings with real user data, maintaining system defaults as fallbacks
  setCadenceSettings(_prev => ({
    sessionsPerWeek: appState.learningPlan.cadence?.sessionsPerWeek || 5,
    sessionLength: appState.learningPlan.cadence?.sessionLength || 5,
    flexibleSchedule: appState.learningPlan.cadence?.flexibleSchedule ?? true
  }));

  // Update focus priorities with real system recommendations and user preferences
  setFocusPriorities(prev => ({
    primaryTags: appState.learningPlan.focus?.userFocusAreas || 
                appState.learningPlan.focus?.systemFocusTags || 
                ['Array', 'Hash Table', 'String', 'Sorting', 'Math'], // System default recommendations
    difficultyDistribution: appState.learningPlan.focus?.difficultyDistribution || prev.difficultyDistribution,
    reviewRatio: appState.learningPlan.focus?.reviewRatio || 40
  }));

  // Update guardrails with onboarding-aware limits
  const sessionState = getSessionState();
  const sessionLimits = SessionLimits.getSessionLimits(sessionState);
  
  setGuardrails(_prev => ({
    minReviewRatio: appState.learningPlan.guardrails?.minReviewRatio || 30,
    maxNewProblems: sessionLimits.maxNewProblems, // Onboarding-aware: 4 during onboarding, 8 after
    difficultyCapEnabled: sessionLimits.isOnboarding, // Enable difficulty cap during onboarding
    maxDifficulty: sessionLimits.isOnboarding ? "Medium" : "Hard", // Cap difficulty during onboarding
    hintLimitEnabled: appState.learningPlan.guardrails?.hintLimitEnabled || false,
    maxHintsPerProblem: appState.learningPlan.guardrails?.maxHintsPerProblem || 0
  }));

  // Always generate fresh missions based on current user progress
  // Don't trust potentially stale mission data from appState
  const freshMissions = generateMissionsWithRealProgress(appState, isOnboarding);
  setDailyMissions(freshMissions);

  // Always update outcome trends with available data or meaningful fallbacks
  const trends = calculateOutcomeTrends(appState, getAccuracyStatus, getProblemsStatus, getHintEfficiencyStatus);
  setOutcomeTrends(trends);
}

export function Goals() {
  const { data: appState, loading, error, refresh } = usePageData('goals');
  const navigate = useNavigate();
  
  // Initialize with system defaults - will be updated with real data via useEffect
  const [cadenceSettings, setCadenceSettings] = useCadenceSettings();

  const [focusPriorities, setFocusPriorities] = useFocusPriorities();

  const [guardrails, setGuardrails] = useGuardrails();

  const [dailyMissions, setDailyMissions] = useDailyMissions();

  const [outcomeTrends, setOutcomeTrends] = useState({
    weeklyAccuracy: { value: 0, status: "loading", target: 75 },
    problemsPerWeek: { value: 0, status: "loading", target: "0", display: "Loading..." },
    hintEfficiency: { value: 0, status: "loading", display: "Loading..." },
    learningVelocity: { value: "Loading...", status: "loading" }
  });

  // TODO: Fix edit tags dialog - temporarily disabled
  // const [editTagsModalOpen, setEditTagsModalOpen] = useState(false);
  // const [availableTags] = useState([
  //   "Dynamic Programming", "Graph Theory", "Array", "String", "Tree", "Hash Table",
  //   "Two Pointers", "Binary Search", "Sliding Window", "Greedy", "Backtracking",
  //   "Stack", "Queue", "Heap", "Trie", "Union Find", "Segment Tree", "Bit Manipulation"
  // ]);

  // Check if user is in onboarding mode using SessionLimits utility
  const getSessionState = () => {
    return {
      numSessionsCompleted: appState?.allSessions ? appState.allSessions.length : 0
    };
  };
  const isOnboarding = SessionLimits.isOnboarding(getSessionState());

  useEffect(() => {
    if (appState?.learningPlan) {
      updateLearningPlanData(
        appState,
        isOnboarding,
        getSessionState,
        setCadenceSettings,
        setFocusPriorities,
        setGuardrails,
        setDailyMissions,
        setOutcomeTrends,
        getAccuracyStatus,
        getProblemsStatus,
        getHintEfficiencyStatus,
        generateMissionsWithRealProgress
      );
    }
  }, [appState, isOnboarding]); // eslint-disable-line react-hooks/exhaustive-deps

  // Helper functions for status determination
  const getAccuracyStatus = (accuracy) => {
    if (accuracy >= 80) return "excellent";
    if (accuracy >= 70) return "on_track"; 
    if (accuracy >= 60) return "needs_improvement";
    return "behind";
  };

  const getProblemsStatus = (count) => {
    if (count >= 25) return "excellent";
    if (count >= 20) return "on_track";
    if (count >= 15) return "needs_improvement";
    return "behind";
  };

  const getHintEfficiencyStatus = (hintsPerProblem) => {
    if (hintsPerProblem <= 1) return "excellent";
    if (hintsPerProblem <= 2) return "on_track";
    if (hintsPerProblem <= 3) return "needs_improvement";
    return "behind";
  };

  // Generate missions with real progress calculation from user data
  const generateMissionsWithRealProgress = (appState, isOnboarding) => {
    const focusTags = appState?.learningPlan?.focus?.systemFocusTags || 
                     appState?.learningPlan?.focus?.userFocusAreas || 
                     ['Array', 'String'];
    
    // Calculate real progress from user's actual session and attempt data
    const todaysAttempts = getTodaysAttempts(appState);
    const todaysAccuracy = getTodaysAccuracy(appState);
    const todaysHintUsage = getTodaysHintUsage(appState);
    const reviewProblemsCompleted = getTodaysReviewProblems(appState);
    
    if (isOnboarding) {
      return [
        { 
          id: 1, 
          title: `Practice ${focusTags[0] || 'Array'} problems`, 
          progress: getSkillProgress(appState, focusTags[0]), 
          target: 2, 
          type: "skill", 
          completed: getSkillProgress(appState, focusTags[0]) >= 2 
        },
        { 
          id: 2, 
          title: "Complete first session without hints", 
          progress: todaysHintUsage <= 0 ? 1 : 0, 
          target: 1, 
          type: "efficiency", 
          completed: todaysHintUsage <= 0 && todaysAttempts > 0
        },
        { 
          id: 3, 
          title: "Achieve 60% accuracy today", 
          progress: Math.round(todaysAccuracy), 
          target: 60, 
          type: "performance", 
          completed: todaysAccuracy >= 60 
        }
      ];
    } else {
      return [
        { 
          id: 1, 
          title: `Master ${focusTags[0] || 'Dynamic Programming'} fundamentals`, 
          progress: getSkillProgress(appState, focusTags[0]), 
          target: 3, 
          type: "skill", 
          completed: getSkillProgress(appState, focusTags[0]) >= 3 
        },
        { 
          id: 2, 
          title: "Review problems from lower boxes", 
          progress: reviewProblemsCompleted, 
          target: 4, 
          type: "review", 
          completed: reviewProblemsCompleted >= 4 
        },
        { 
          id: 3, 
          title: "Maintain 75% accuracy today", 
          progress: Math.round(todaysAccuracy), 
          target: 75, 
          type: "performance", 
          completed: todaysAccuracy >= 75 
        },
        { 
          id: 4, 
          title: "Solve problems efficiently", 
          progress: todaysHintUsage <= 1 ? 2 : (todaysHintUsage <= 2 ? 1 : 0), 
          target: 2, 
          type: "efficiency", 
          completed: todaysHintUsage <= 1 && todaysAttempts > 0
        }
      ];
    }
  };

  // Helper functions to calculate real user progress for missions
  const getTodaysAttempts = (appState) => {
    const today = new Date().toDateString();
    return appState?.sessions?.allSessions?.filter(session => 
      new Date(session.date).toDateString() === today
    )?.length || 0;
  };

  const getTodaysAccuracy = (appState) => {
    if (!appState?.statistics?.successRate?.overall) return 0;
    return appState.statistics.successRate.overall * 100;
  };

  const getTodaysHintUsage = (appState) => {
    return appState?.statistics?.averageHints || 0;
  };

  const getTodaysReviewProblems = (_appState) => {
    const _today = new Date().toDateString();
    // Count problems solved today that were review problems
    // This would need integration with session data to identify review vs new problems
    // For now, return 0 as we don't have detailed session breakdown
    return 0;
  };

  const getSkillProgress = (_appState, _focusTag) => {
    // Count problems solved in the specific focus area
    // This would need integration with attempt data filtered by tag
    // For now, return 0 as we don't have tag-specific attempt data easily accessible
    return 0;
  };

  // Generate meaningful default missions based on user progress and onboarding status
  const generateDefaultMissions = (appState, isOnboarding) => {
    const focusTags = appState?.learningPlan?.focus?.systemFocusTags || 
                     appState?.learningPlan?.focus?.userFocusAreas || 
                     ['Array', 'String'];
    
    if (isOnboarding) {
      return [
        { 
          id: 1, 
          title: `Practice ${focusTags[0] || 'Array'} problems`, 
          progress: 0, 
          target: 2, 
          type: "skill", 
          completed: false 
        },
        { 
          id: 2, 
          title: "Complete first session without hints", 
          progress: 0, 
          target: 1, 
          type: "efficiency", 
          completed: false 
        },
        { 
          id: 3, 
          title: "Achieve 60% accuracy today", 
          progress: 0, 
          target: 60, 
          type: "performance", 
          completed: false 
        }
      ];
    } else {
      return [
        { 
          id: 1, 
          title: `Master ${focusTags[0] || 'Dynamic Programming'} fundamentals`, 
          progress: 0, 
          target: 3, 
          type: "skill", 
          completed: false 
        },
        { 
          id: 2, 
          title: "Review problems from lower boxes", 
          progress: 0, 
          target: 4, 
          type: "review", 
          completed: false 
        },
        { 
          id: 3, 
          title: "Maintain 75% accuracy today", 
          progress: 0, 
          target: 75, 
          type: "performance", 
          completed: false 
        },
        { 
          id: 4, 
          title: "Solve problems efficiently", 
          progress: 0, 
          target: 2, 
          type: "efficiency", 
          completed: false 
        }
      ];
    }
  };

  const handleCadenceChange = (field, value) => {
    setCadenceSettings(prev => ({ ...prev, [field]: value }));
    // Auto-save after a short delay
    setTimeout(saveSettings, 1000);
  };

  const handleGuardrailChange = (field, value) => {
    setGuardrails(prev => ({ ...prev, [field]: value }));
    // Auto-save after a short delay
    setTimeout(saveSettings, 1000);
  };

  // TODO: Fix edit tags dialog - temporarily disabled
  // const handleTagsChange = (newTags) => {
  //   setFocusPriorities(prev => ({ ...prev, primaryTags: newTags }));
  //   // Save immediately when tags change
  //   setTimeout(saveSettings, 500);
  // };

  const handleGenerateNewMissions = () => {
    // Generate new missions based on current user progress and system recommendations
    const newMissions = generateDefaultMissions(appState, isOnboarding);
    setDailyMissions(newMissions);
  };

  const saveSettings = () => {
    const settings = {
      sessionsPerWeek: cadenceSettings.sessionsPerWeek,
      sessionLength: cadenceSettings.sessionLength,
      flexibleSchedule: cadenceSettings.flexibleSchedule,
      focusAreas: focusPriorities.primaryTags,
      difficultyDistribution: focusPriorities.difficultyDistribution,
      reviewRatio: focusPriorities.reviewRatio,
      numberofNewProblemsPerSession: guardrails.maxNewProblems
    };

    chrome.runtime.sendMessage(
      { type: "setSettings", message: settings },
      (response) => {
        if (response?.status === "success") {
          chrome.runtime.sendMessage({ type: "clearSettingsCache" });
        } else {
          logger.error("Failed to save settings");
        }
      }
    );
  };

  const getMissionIcon = (type) => {
    switch (type) {
      case "skill": return "🎯";
      case "review": return "📚";
      case "performance": return "⚡";
      case "efficiency": return "🎪";
      default: return "✨";
    }
  };

  const getMissionColor = (type) => {
    switch (type) {
      case "skill": return "blue";
      case "review": return "violet";
      case "performance": return "green";
      case "efficiency": return "orange";
      default: return "gray";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "excellent": return "green";
      case "on_track": return "green";
      case "needs_improvement": return "yellow";
      case "behind": return "red";
      case "adaptive": return "blue";
      case "no_data": return "gray";
      case "loading": return "gray";
      default: return "gray";
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "excellent": return "Excellent";
      case "on_track": return "On track";
      case "needs_improvement": return "Needs improvement";
      case "behind": return "Behind";
      case "adaptive": return "Adaptive";
      case "no_data": return "No data yet";
      case "loading": return "Loading...";
      default: return "Unknown";
    }
  };

  // Handle loading and error states after all hooks are called
  if (loading) {
    return (
      <Container size="xl" p="md">
        <Title order={2} mb="md">Learning Plan & Missions</Title>
        <Text>Loading goals data...</Text>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="xl" p="md">
        <Title order={2} mb="md">Learning Plan & Missions</Title>
        <Text color="red">Error loading goals data: {error.message}</Text>
        <Button leftSection={<IconRefresh size={16} />} onClick={refresh} mt="md">
          Retry
        </Button>
      </Container>
    );
  }

  return (
    <Container size="xl" p="md">
      <Group justify="space-between" mb="md">
        <div>
          <Title order={2}>
            Learning Plan & Missions
          </Title>
          <Text size="sm" c="dimmed" mt="xs">
            Configure your learning preferences to guide the adaptive engine
          </Text>
        </div>
        <Button 
          leftSection={<IconRefresh size={16} />} 
          variant="light" 
          onClick={refresh}
          size="sm"
        >
          Refresh
        </Button>
      </Group>
      
      {/* Row 3: Outcome Trends */}
      <Grid gutter="md" mt="md">
        <Grid.Col span={12}>
          <Card withBorder p="lg">
            <Group gap="xs" mb="md">
              <IconAdjustments size={20} style={{ color: 'var(--mantine-color-dimmed)' }} />
              <Title order={4}>Outcome Trends & Soft Targets</Title>
              <Badge variant="light" color="cyan" size="sm">System guided</Badge>
            </Group>
            
            <Grid>
              <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
                <div style={{ textAlign: 'center' }}>
                  <Text size="xs" c="dimmed" mb={4}>Weekly Accuracy Target</Text>
                  <Text size="xl" fw={700} style={{ color: 'var(--mantine-color-cyan-6)' }}>
                    {outcomeTrends.weeklyAccuracy.value}%
                  </Text>
                  <Badge variant="light" color={getStatusColor(outcomeTrends.weeklyAccuracy.status)} size="xs" mt="xs">
                    {getStatusText(outcomeTrends.weeklyAccuracy.status)}
                  </Badge>
                </div>
              </Grid.Col>
              
              <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
                <div style={{ textAlign: 'center' }}>
                  <Text size="xs" c="dimmed" mb={4}>Problems Per Week</Text>
                  <Text size="xl" fw={700} style={{ color: 'var(--mantine-color-cyan-6)' }}>
                    {outcomeTrends.problemsPerWeek.display || outcomeTrends.problemsPerWeek.value}
                  </Text>
                  <Badge variant="light" color={getStatusColor(outcomeTrends.problemsPerWeek.status)} size="xs" mt="xs">
                    {getStatusText(outcomeTrends.problemsPerWeek.status)}
                  </Badge>
                </div>
              </Grid.Col>
              
              <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
                <div style={{ textAlign: 'center' }}>
                  <Text size="xs" c="dimmed" mb={4}>Hint Efficiency</Text>
                  <Text size="xl" fw={700} style={{ color: 'var(--mantine-color-cyan-6)' }}>
                    {outcomeTrends.hintEfficiency.display}
                  </Text>
                  <Badge variant="light" color={getStatusColor(outcomeTrends.hintEfficiency.status)} size="xs" mt="xs">
                    {getStatusText(outcomeTrends.hintEfficiency.status)}
                  </Badge>
                </div>
              </Grid.Col>
              
              <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
                <div style={{ textAlign: 'center' }}>
                  <Text size="xs" c="dimmed" mb={4}>Learning Velocity</Text>
                  <Text size="xl" fw={700} style={{ color: 'var(--mantine-color-cyan-6)' }}>
                    {outcomeTrends.learningVelocity.value}
                  </Text>
                  <Badge variant="light" color={getStatusColor(outcomeTrends.learningVelocity.status)} size="xs" mt="xs">
                    {getStatusText(outcomeTrends.learningVelocity.status)}
                  </Badge>
                </div>
              </Grid.Col>
            </Grid>
          </Card>
        </Grid.Col>
      </Grid>
      {/* Row 1: Cadence Commitment + Focus Priorities */}
      <Grid gutter="md" align="stretch">
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <Card withBorder p="lg" h={SECTION_HEIGHT}>
            <Group gap="xs" mb="md">
              <IconClock size={20} style={{ color: 'var(--mantine-color-dimmed)' }} />
              <Title order={4}>Cadence Commitment</Title>
            </Group>
            
            <Stack gap="xl">
              <div>
                <Text size="sm" fw={500} mb="md">Sessions per week</Text>
                <div style={{ marginBottom: '20px' }}>
                  <Slider
                    value={cadenceSettings.sessionsPerWeek}
                    onChange={(value) => handleCadenceChange('sessionsPerWeek', value)}
                    min={1}
                    max={7}
                    step={1}
                    marks={[
                      { value: 1, label: '1' },
                      { value: 3, label: '3' },
                      { value: 5, label: '5' },
                      { value: 7, label: '7' }
                    ]}
                    color="blue"
                  />
                </div>
                <Text size="xs" c="dimmed">
                  Current: {cadenceSettings.sessionsPerWeek} sessions/week
                </Text>
              </div>

              <div>
                <Group gap="xs" mb="md">
                  <Text size="sm" fw={500}>Session length (problems)</Text>
                  {isOnboarding && (
                    <Badge variant="light" color="orange" size="xs">
{SessionLimits.getOnboardingBadgeText('sessionLength')}
                    </Badge>
                  )}
                </Group>
                <Select
                  value={cadenceSettings.sessionLength.toString()}
                  onChange={(value) => handleCadenceChange('sessionLength', parseInt(value))}
                  data={[
                    { value: "3", label: "3 problems" },
                    { value: "4", label: "4 problems" },
                    { value: "5", label: "5 problems" },
                    { value: "6", label: "6 problems" },
                    ...(isOnboarding ? [] : [
                      { value: "8", label: "8 problems" },
                      { value: "10", label: "10 problems" }
                    ])
                  ]}
                />
                {isOnboarding && (
                  <Text size="xs" c="orange" mt="md">
                    🔰 First 3 sessions are limited to 6 problems for optimal learning
                  </Text>
                )}
              </div>

              <div>
                <Switch
                  label="Flexible schedule (adapt based on performance)"
                  checked={cadenceSettings.flexibleSchedule}
                  onChange={(event) => handleCadenceChange('flexibleSchedule', event.currentTarget.checked)}
                  color="blue"
                />
              </div>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 6 }}>
          <Card withBorder p="lg" h={SECTION_HEIGHT}>
            <Group gap="xs" mb="md">
              <IconTarget size={20} style={{ color: 'var(--mantine-color-dimmed)' }} />
              <Title order={4}>Focus Priorities</Title>
            </Group>
            
            <Stack gap="lg">
              {/* System Focus Tags - Always Show */}
              <div>
                <Group gap="xs" mb="xs">
                  <Text size="sm" fw={500}>System Recommendations</Text>
                  <Badge variant="light" color="cyan" size="xs">
                    System Recommended
                  </Badge>
                </Group>
                <Group gap="xs">
                  {(appState?.learningPlan?.focus?.systemFocusTags || []).map((tag, index) => (
                    <Badge key={index} variant="light" color="cyan" size="sm">
                      {tag}
                    </Badge>
                  ))}
                </Group>
                <Text size="xs" c="dimmed" mt="xs">
                  Based on your performance and learning progress
                </Text>
              </div>

              {/* User Focus Areas */}
              <div>
                <Group gap="xs" mb="xs">
                  <Text size="sm" fw={500}>Your Focus Areas</Text>
                  {isOnboarding && (
                    <Badge variant="light" color="orange" size="xs">
                      Onboarding: 1 tag limit
                    </Badge>
                  )}
                </Group>
                <Group gap="xs">
                  {(appState?.learningPlan?.focus?.userFocusAreas || []).length > 0 ? (
                    appState.learningPlan.focus.userFocusAreas.slice(0, isOnboarding ? 1 : 3).map((tag, index) => (
                      <Badge key={index} variant="light" color="violet" size="sm">
                        {tag}
                      </Badge>
                    ))
                  ) : (
                    <Text size="sm" c="dimmed">No focus areas selected</Text>
                  )}
                  {/* Link to settings for editing */}
                  <Button 
                    variant="subtle" 
                    size="xs" 
                    color="violet"
                    leftSection={<IconEdit size={12} />}
                    onClick={() => navigate('/settings/general')}
                  >
                    {(appState?.learningPlan?.focus?.userFocusAreas || []).length > 0 ? 'Edit' : 'Set Focus Areas'}
                  </Button>
                </Group>
                <Text size="xs" c="dimmed" mt="xs">
                  Your preferences get priority in problem selection
                </Text>
                {isOnboarding && (
                  <Text size="xs" c="orange" mt="xs">
                    🔰 During onboarding, sessions focus on one tag for deeper learning
                  </Text>
                )}
              </div>

              {/* Active Session Focus - Always Show with System Default */}
              <div>
                <Group gap="xs" mb="xs">
                  <Text size="sm" fw={500}>Active Session Focus</Text>
                  {appState?.learningPlan?.focus?.activeFocusTags ? (
                    <Badge variant="light" color="teal" size="xs">
                      Coordinated Decision
                    </Badge>
                  ) : (
                    <Badge variant="light" color="cyan" size="xs">
                      System Default
                    </Badge>
                  )}
                  {appState?.learningPlan?.focus?.onboarding && (
                    <Badge variant="light" color="orange" size="xs">
                      Onboarding Mode
                    </Badge>
                  )}
                  {appState?.learningPlan?.focus?.performanceLevel && (
                    <Badge variant="light" color="blue" size="xs">
                      {appState.learningPlan.focus.performanceLevel} Performance
                    </Badge>
                  )}
                </Group>
                <Group gap="xs">
                  {(appState?.learningPlan?.focus?.activeFocusTags || 
                    appState?.learningPlan?.focus?.systemFocusTags || 
                    ['Array', 'Hash Table', 'String', 'Sorting', 'Math']).map((tag, index) => (
                    <Badge 
                      key={index} 
                      variant={appState?.learningPlan?.focus?.activeFocusTags ? "filled" : "light"} 
                      color={appState?.learningPlan?.focus?.activeFocusTags ? "teal" : "cyan"} 
                      size="sm"
                    >
                      {tag}
                    </Badge>
                  ))}
                </Group>
                <Text size="xs" c="dimmed" mt="xs">
                  {appState?.learningPlan?.focus?.activeFocusTags 
                    ? "What your next session will actually focus on"
                    : "System recommendations based on your performance and learning progress"
                  }
                </Text>
                {appState?.learningPlan?.focus?.algorithmReasoning && (
                  <Text size="xs" c="dimmed" fs="italic" mt="xs">
                    📊 {appState.learningPlan.focus.algorithmReasoning}
                  </Text>
                )}
              </div>

              {/* Difficulty Distribution and Review Ratio in one line */}
              <Grid gutter="lg">
                <Grid.Col span={6}>
                  <div>
                    <Text size="sm" fw={500} mb="xs">Difficulty distribution</Text>
                    <Group gap="md">
                      <div style={{ textAlign: 'center' }}>
                        <Text size="md" fw={600} style={{ color: 'var(--mantine-color-green-6)' }}>
                          {focusPriorities.difficultyDistribution.easy}%
                        </Text>
                        <Text size="xs" c="dimmed">Easy</Text>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <Text size="md" fw={600} style={{ color: 'var(--mantine-color-yellow-6)' }}>
                          {focusPriorities.difficultyDistribution.medium}%
                        </Text>
                        <Text size="xs" c="dimmed">Medium</Text>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <Text size="md" fw={600} style={{ color: 'var(--mantine-color-red-6)' }}>
                          {focusPriorities.difficultyDistribution.hard}%
                        </Text>
                        <Text size="xs" c="dimmed">Hard</Text>
                      </div>
                    </Group>
                  </div>
                </Grid.Col>
                
                <Grid.Col span={6}>
                  <div>
                    <Text size="sm" fw={500} mb="xs">Review ratio: {focusPriorities.reviewRatio}%</Text>
                    <Slider
                      value={focusPriorities.reviewRatio}
                      onChange={(value) => {
                        setFocusPriorities(prev => ({ ...prev, reviewRatio: value }));
                        setTimeout(saveSettings, 1000);
                      }}
                      min={0}
                      max={80}
                      step={10}
                      color="violet"
                    />
                    <Text size="xs" c="dimmed" mt="xs">
                      Balance between new problems and review
                    </Text>
                  </div>
                </Grid.Col>
              </Grid>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Row 2: Guardrails + Daily Missions */}
      <Grid gutter="md" mt="md" align="stretch">
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <Card withBorder p="lg" h={SECTION_HEIGHT}>
            <Group gap="xs" mb="md">
              <IconShield size={20} style={{ color: 'var(--mantine-color-dimmed)' }} />
              <Title order={4}>Guardrails</Title>
            </Group>
            
            <Stack gap="md">
              <div>
                <Text size="sm" fw={500} mb="xs">Min review ratio: {guardrails.minReviewRatio}%</Text>
                <Slider
                  value={guardrails.minReviewRatio}
                  onChange={(value) => handleGuardrailChange('minReviewRatio', value)}
                  min={0}
                  max={60}
                  step={5}
                  color="orange"
                />
              </div>

              <div>
                <Group gap="xs" mb="xs">
                  <Text size="sm" fw={500}>Max new problems per session</Text>
                  {isOnboarding && (
                    <Badge variant="light" color="orange" size="xs">
{SessionLimits.getOnboardingBadgeText('newProblems')}
                    </Badge>
                  )}
                </Group>
                <Select
                  value={guardrails.maxNewProblems.toString()}
                  onChange={(value) => handleGuardrailChange('maxNewProblems', parseInt(value))}
                  data={[
                    { value: "2", label: "2 problems" },
                    { value: "3", label: "3 problems" },
                    { value: "4", label: "4 problems" },
                    ...(isOnboarding ? [] : [
                      { value: "5", label: "5 problems" },
                      { value: "8", label: "8 problems" },
                      { value: "10", label: "10 problems" }
                    ])
                  ]}
                />
                {isOnboarding && (
                  <Text size="xs" c="orange" mt="xs">
                    🔰 Limited to 4 new problems during onboarding to ensure solid foundations
                  </Text>
                )}
              </div>

              <Switch
                label="Enable difficulty cap"
                checked={guardrails.difficultyCapEnabled}
                onChange={(event) => handleGuardrailChange('difficultyCapEnabled', event.currentTarget.checked)}
                color="orange"
              />

              {guardrails.difficultyCapEnabled && (
                <Select
                  label="Max difficulty"
                  value={guardrails.maxDifficulty}
                  onChange={(value) => handleGuardrailChange('maxDifficulty', value)}
                  data={[
                    { value: "Easy", label: "Easy" },
                    { value: "Medium", label: "Medium" },
                    { value: "Hard", label: "Hard" }
                  ]}
                />
              )}
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 6 }}>
          <Card withBorder p="lg" h={SECTION_HEIGHT}>
            <Group gap="xs" mb="md">
              <IconRocket size={20} style={{ color: 'var(--mantine-color-dimmed)' }} />
              <Title order={4}>Today&apos;s Missions</Title>
              <Badge variant="light" color="teal" size="sm">Auto-generated</Badge>
            </Group>
            
            <ScrollArea h={SECTION_HEIGHT - 140}>
              <Stack gap="xs">
                {dailyMissions.map((mission) => (
                  <Card key={mission.id} withBorder p="sm" style={{ backgroundColor: 'var(--cm-card-bg)' }}>
                    <Group justify="space-between" align="center">
                      <Group gap="xs" style={{ flex: 1 }}>
                        <Text size="sm">{getMissionIcon(mission.type)}</Text>
                        <div style={{ flex: 1 }}>
                          <Text size="sm" fw={500} style={{ 
                            textDecoration: mission.completed ? 'line-through' : 'none',
                            opacity: mission.completed ? 0.7 : 1
                          }}>
                            {mission.title}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {mission.type === "performance" 
                              ? `${mission.progress}% / ${mission.target}%`
                              : `${mission.progress} / ${mission.target}`
                            }
                          </Text>
                        </div>
                      </Group>
                      <Badge 
                        variant="light" 
                        color={mission.completed ? "green" : getMissionColor(mission.type)} 
                        size="sm"
                      >
                        {mission.completed ? "✓" : "In Progress"}
                      </Badge>
                    </Group>
                  </Card>
                ))}
              </Stack>
            </ScrollArea>
            
            <Button 
              variant="light" 
              color="teal" 
              size="sm" 
              mt="md" 
              fullWidth
              leftSection={<IconRocket size={14} />}
              onClick={handleGenerateNewMissions}
            >
              Generate New Missions
            </Button>
          </Card>
        </Grid.Col>
      </Grid>

      {/* TODO: Fix edit tags dialog - temporarily commented out */}
      {/* <Modal
        opened={editTagsModalOpen}
        onClose={() => setEditTagsModalOpen(false)}
        title="Edit Focus Tags"
        size="md"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Select up to 3 tags to focus your learning sessions
          </Text>
          <CustomMultiSelect
            label="Primary Focus Tags"
            placeholder="Select tags"
            data={availableTags.map(tag => ({ value: tag, label: tag }))}
            value={focusPriorities.primaryTags}
            onChange={handleTagsChange}
            maxValues={3}
            searchable
            clearable
            description="These tags will have higher priority in your learning sessions"
          />
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setEditTagsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setEditTagsModalOpen(false)}>
              Save Changes
            </Button>
          </Group>
        </Stack>
      </Modal> */}

    </Container>
  );
}