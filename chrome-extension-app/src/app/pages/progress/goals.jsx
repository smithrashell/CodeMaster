import logger from "../../../shared/utils/logger.js";
import { Container, Grid, Title, Group, Button, Text } from "@mantine/core";
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { IconRefresh } from "@tabler/icons-react";
import { usePageData } from "../../hooks/usePageData";
import { CadenceSettingsSection } from "./CadenceSettingsSection.jsx";
import { FocusPrioritiesSection } from "./FocusPrioritiesSection.jsx";
import { GuardrailsSection } from "./GuardrailsSection.jsx";
import { DailyMissionsSection } from "./DailyMissionsSection.jsx";
import { OutcomeTrendsSection } from "./OutcomeTrendsSection.jsx";
import { useMissions } from "./useMissions.js";
import { useStatusUtils } from "./useStatusUtils.js";
import { settingsMessaging } from "../../components/settings/settingsMessaging.js";

// Custom hooks for Goals page state management
const useCadenceSettings = () => {
  return useState({
    sessionsPerWeek: 5, // System default
    sessionLength: 5 // System default - now represents max session length
  });
};

const useFocusPriorities = () => {
  return useState({
    primaryTags: [] // Empty until loaded from user settings/system recommendations
  });
};

const useGuardrails = () => {
  return useState({
    maxNewProblems: 8, // System default (will be adjusted for onboarding)
    difficultyCapEnabled: false, // System default - adaptive progression disabled
    hintLimitEnabled: false, // System default - no artificial hint limits
    maxHintsPerProblem: 0 // System default - unlimited hints
  });
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
function updateLearningPlanData({
  appState,
  isOnboarding,
  getters,
  setters,
  generators
}) {
  const { getAccuracyStatus, getProblemsStatus, getHintEfficiencyStatus } = getters;
  const { setCadenceSettings, setFocusPriorities, setGuardrails, setDailyMissions, setOutcomeTrends } = setters;
  const { generateMissionsWithRealProgress } = generators;
  // Update cadence settings with real user data, maintaining system defaults as fallbacks
  setCadenceSettings(_prev => ({
    sessionsPerWeek: appState.learningPlan.cadence?.sessionsPerWeek || 5,
    sessionLength: appState.learningPlan.cadence?.sessionLength || 5
  }));

  // Update focus priorities with real system recommendations and user preferences
  setFocusPriorities(_prev => ({
    primaryTags: appState.learningPlan.focus?.userFocusAreas ||
                appState.learningPlan.focus?.systemFocusTags ||
                ['Array', 'Hash Table', 'String', 'Sorting', 'Math'] // System default recommendations
  }));

  // Update guardrails with onboarding-aware limits
  // Use isOnboarding directly: 4 new problems during onboarding, 8 after
  setGuardrails(_prev => ({
    maxNewProblems: isOnboarding ? 4 : 8, // Onboarding-aware: 4 during onboarding, 8 after
    difficultyCapEnabled: isOnboarding, // Enable difficulty cap during onboarding
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

// Helper function to create settings change handlers
const createSettingsHandlers = (settings, handlers, context) => {
  const { setters, saveSettings, generators } = handlers;
  const { appState, isOnboarding } = context;
  
  const { setCadenceSettings, setFocusPriorities, setGuardrails, setDailyMissions } = setters;
  const { generateDefaultMissions } = generators;
  
  const handleCadenceChange = (field, value) => {
    setCadenceSettings(prev => ({ ...prev, [field]: value }));
    setTimeout(saveSettings, 1000);
  };

  const handleGuardrailChange = (field, value) => {
    setGuardrails(prev => ({ ...prev, [field]: value }));
    setTimeout(saveSettings, 1000);
  };

  const handleFocusPrioritiesChange = (field, value) => {
    setFocusPriorities(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerateNewMissions = () => {
    const newMissions = generateDefaultMissions(appState, isOnboarding);
    setDailyMissions(newMissions);
  };
  
  return {
    handleCadenceChange,
    handleGuardrailChange,
    handleFocusPrioritiesChange,
    handleGenerateNewMissions
  };
};

// NOTE: createSaveSettings has been removed - now using useCallback in Goals component
// to avoid stale closure bugs where old state values were being saved

// Helper component for loading and error states
function LoadingErrorStates({ loading, error, refresh }) {
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

  return null;
}

// Helper component for the main Goals layout
function GoalsLayout({ 
  appState, 
  refresh, 
  outcomeTrends, 
  statusUtils, 
  cadenceSettings, 
  focusPriorities, 
  guardrails, 
  dailyMissions,
  handlers,
  saveSettings,
  missions,
  navigate,
  isOnboarding 
}) {
  const { getStatusColor, getStatusText } = statusUtils;
  const { getMissionIcon, getMissionColor } = missions;
  const { handleCadenceChange, handleGuardrailChange, handleFocusPrioritiesChange, handleGenerateNewMissions } = handlers;
  
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
      
      <OutcomeTrendsSection 
        outcomeTrends={outcomeTrends}
        getStatusColor={getStatusColor}
        getStatusText={getStatusText}
      />
      
      <Grid gutter="md" align="stretch">
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <CadenceSettingsSection 
            cadenceSettings={cadenceSettings}
            isOnboarding={isOnboarding}
            onCadenceChange={handleCadenceChange}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 6 }}>
          <FocusPrioritiesSection 
            appState={appState}
            focusPriorities={focusPriorities}
            isOnboarding={isOnboarding}
            navigate={navigate}
            onFocusPrioritiesChange={handleFocusPrioritiesChange}
            onSaveSettings={saveSettings}
          />
        </Grid.Col>
      </Grid>

      <Grid gutter="md" mt="md" align="stretch">
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <GuardrailsSection
            guardrails={guardrails}
            sessionLength={cadenceSettings.sessionLength}
            isOnboarding={isOnboarding}
            onGuardrailChange={handleGuardrailChange}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 6 }}>
          <DailyMissionsSection 
            dailyMissions={dailyMissions}
            onGenerateNewMissions={handleGenerateNewMissions}
            getMissionIcon={getMissionIcon}
            getMissionColor={getMissionColor}
          />
        </Grid.Col>
      </Grid>
    </Container>
  );
}

export function Goals() {
  const { data: appState, loading, error, refresh } = usePageData('goals');
  const navigate = useNavigate();
  
  // Initialize with system defaults - will be updated with real data via useEffect
  const [cadenceSettings, setCadenceSettings] = useCadenceSettings();
  const [focusPriorities, setFocusPriorities] = useFocusPriorities();
  const [guardrails, setGuardrails] = useGuardrails();
  const [outcomeTrends, setOutcomeTrends] = useState({
    weeklyAccuracy: { value: 0, status: "loading", target: 75 },
    problemsPerWeek: { value: 0, status: "loading", target: "0", display: "Loading..." },
    hintEfficiency: { value: 0, status: "loading", display: "Loading..." },
    learningVelocity: { value: "Loading...", status: "loading" }
  });
  
  // Use custom hooks
  const {
    dailyMissions,
    setDailyMissions,
    generateMissionsWithRealProgress,
    generateDefaultMissions,
    getMissionIcon,
    getMissionColor
  } = useMissions();
  
  const statusUtils = useStatusUtils();
  const { getAccuracyStatus, getProblemsStatus, getHintEfficiencyStatus } = statusUtils;

  // Check if user is in onboarding mode (threshold: 1 session)
  // Use the same path as line 48: appState.sessions?.allSessions
  const numSessions = appState?.sessions?.allSessions?.length || 0;
  const isOnboarding = numSessions < 1;

  // Create save settings function using useCallback to avoid stale closures
  // This ensures we always read the latest state values when saving
  const saveSettings = useCallback(async () => {
    try {
      // Get current settings first to preserve other settings
      const currentSettings = await settingsMessaging.getAllSettings();

      const updatedSettings = {
        ...currentSettings,
        sessionsPerWeek: cadenceSettings.sessionsPerWeek,
        sessionLength: cadenceSettings.sessionLength,
        focusAreas: focusPriorities.primaryTags,
        numberofNewProblemsPerSession: guardrails.maxNewProblems
      };

      const response = await settingsMessaging.saveSettings(updatedSettings);

      if (!response || response.status !== "success") {
        logger.error("Failed to save settings");
      }
    } catch (error) {
      logger.error("Failed to save settings:", error);
    }
  }, [cadenceSettings, focusPriorities, guardrails]);

  // Create handlers
  const handlers = createSettingsHandlers(
    { cadenceSettings, focusPriorities, guardrails },
    { 
      setters: { setCadenceSettings, setFocusPriorities, setGuardrails, setDailyMissions },
      saveSettings,
      generators: { generateDefaultMissions }
    },
    { appState, isOnboarding }
  );

  useEffect(() => {
    if (appState?.learningPlan) {
      updateLearningPlanData({
        appState,
        isOnboarding,
        getters: { getAccuracyStatus, getProblemsStatus, getHintEfficiencyStatus },
        setters: { setCadenceSettings, setFocusPriorities, setGuardrails, setDailyMissions, setOutcomeTrends },
        generators: { generateMissionsWithRealProgress }
      });
    }
  }, [appState, isOnboarding]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle loading and error states
  const loadingErrorComponent = LoadingErrorStates({ loading, error, refresh });
  if (loadingErrorComponent) return loadingErrorComponent;

  return (
    <GoalsLayout 
      appState={appState}
      refresh={refresh}
      outcomeTrends={outcomeTrends}
      statusUtils={statusUtils}
      cadenceSettings={cadenceSettings}
      focusPriorities={focusPriorities}
      guardrails={guardrails}
      dailyMissions={dailyMissions}
      handlers={handlers}
      saveSettings={saveSettings}
      missions={{ getMissionIcon, getMissionColor }}
      navigate={navigate}
      isOnboarding={isOnboarding}
    />
  );
}