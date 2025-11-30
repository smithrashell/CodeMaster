import logger from "../../../shared/utils/logging/logger.js";
import { Container, Grid, Title, Group, Button, Text } from "@mantine/core";
import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { IconRefresh } from "@tabler/icons-react";
import { usePageData } from "../../hooks/usePageData";
import { CadenceSettingsSection } from "./CadenceSettingsSection.jsx";
import { FocusPrioritiesSection } from "./FocusPrioritiesSection.jsx";
import { GuardrailsSection } from "./GuardrailsSection.jsx";
import { TodaysProgressSection } from "./TodaysProgressSection.jsx";
import { OutcomeTrendsSection } from "./OutcomeTrendsSection.jsx";
import { useStatusUtils } from "./useStatusUtils.js";
import { settingsMessaging } from "../../components/settings/settingsMessaging.js";
import { calculateTodaysProgress } from "./todaysProgressHelpers.js";

// Custom hooks for Goals page state management
const useCadenceSettings = () => {
  return useState({
    sessionsPerWeek: 5, // System default
    sessionLength: "auto" // System default - auto mode for adaptive session length
  });
};

const useFocusPriorities = () => {
  return useState({
    primaryTags: [] // Empty until loaded from user settings/system recommendations
  });
};

const useGuardrails = () => {
  return useState({
    maxNewProblems: 5 // System default (will be adjusted for onboarding to 4)
  });
};

// Helper function to calculate outcome trends from app state
const calculateOutcomeTrends = (appState, getAccuracyStatus, getProblemsStatus, getHintEfficiencyStatus, cadenceSettings) => {
  // Check if we have any session/attempt data to distinguish "no data" from "0% performance"
  const hasData = (appState.sessions?.allSessions?.length || 0) > 0 || (appState.attempts?.length || 0) > 0;

  // Use backend-calculated weekly accuracy (from last 7 days) instead of overall accuracy
  const weeklyAccuracyData = appState.learningPlan?.outcomeTrends?.weeklyAccuracy;
  const weeklyAccuracyValue = weeklyAccuracyData?.value ?? 0;

  // Calculate weekly target from user settings
  const sessionsPerWeek = cadenceSettings.sessionsPerWeek || 5;
  const sessionLength = cadenceSettings.sessionLength;

  // Handle sessionLength ('auto' mode uses max 12, numeric values use the number)
  const maxProblemsPerSession = sessionLength === 'auto' ? 12 : (typeof sessionLength === 'number' ? sessionLength : 5);
  const weeklyTarget = sessionsPerWeek * maxProblemsPerSession;

  // Get actual problems completed this week from backend
  const weeklyProblemsCompleted = appState.learningPlan?.outcomeTrends?.problemsPerWeek?.value ?? 0;
  const remainingProblems = Math.max(0, weeklyTarget - weeklyProblemsCompleted);

  // Use backend hint efficiency data
  const hintEfficiencyData = appState.learningPlan?.outcomeTrends?.hintEfficiency;
  const hintEfficiency = hintEfficiencyData?.value ?? 0;

  // Use backend learning velocity data
  const learningVelocityData = appState.learningPlan?.outcomeTrends?.learningVelocity;
  const learningVelocity = learningVelocityData?.value || "Getting Started";

  // For display: If we have sessions/attempts, show actual metrics (even if 0)
  // Only show "no data" if we truly have no activity ever
  return {
    weeklyAccuracy: {
      value: weeklyAccuracyValue,
      // Use backend-calculated status (already considers target thresholds)
      status: hasData ? (weeklyAccuracyData?.status || getAccuracyStatus(weeklyAccuracyValue / 100)) : "no_data",
      target: 75
    },
    problemsPerWeek: {
      value: weeklyProblemsCompleted,
      // Use backend-calculated status (already considers user's actual target)
      status: hasData ? (appState.learningPlan?.outcomeTrends?.problemsPerWeek?.status || getProblemsStatus(weeklyProblemsCompleted)) : "no_data",
      target: weeklyTarget,
      // Always show remaining count if we have any data, even if it's "10 of 10 remaining"
      display: hasData
        ? `${remainingProblems} of ${weeklyTarget} remaining`
        : "No sessions yet"
    },
    hintEfficiency: {
      value: hintEfficiency,
      status: hasData && hintEfficiency > 0 ? getHintEfficiencyStatus(hintEfficiency) : "no_data",
      display: hasData && hintEfficiency > 0
        ? (hintEfficiencyData?.display || `${hintEfficiency.toFixed(1)} per problem`)
        : "No data yet"
    },
    learningVelocity: {
      value: learningVelocity,
      status: learningVelocityData?.status || "adaptive"
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
  setters
}) {
  const { getAccuracyStatus, getProblemsStatus, getHintEfficiencyStatus } = getters;
  const { setCadenceSettings, setFocusPriorities, setGuardrails, setTodaysProgress, setOutcomeTrends } = setters;
  // Update cadence settings with real user data, maintaining system defaults as fallbacks
  setCadenceSettings(_prev => ({
    sessionsPerWeek: appState.learningPlan.cadence?.sessionsPerWeek ?? 5,
    sessionLength: appState.learningPlan.cadence?.sessionLength ?? "auto"
  }));

  // Update focus priorities with real system recommendations and user preferences
  setFocusPriorities(_prev => ({
    primaryTags: appState.learningPlan.focus?.userFocusAreas ||
                appState.learningPlan.focus?.systemFocusTags ||
                ['Array', 'Hash Table', 'String', 'Sorting', 'Math'] // System default recommendations
  }));

  // Update guardrails with user-saved value or onboarding-aware default
  const savedMaxNewProblems = appState.learningPlan.guardrails?.maxNewProblems;
  const defaultMaxNewProblems = isOnboarding ? 4 : 5;

  setGuardrails(_prev => ({
    maxNewProblems: savedMaxNewProblems || defaultMaxNewProblems
  }));

  // Calculate today's progress from real session data
  const progress = calculateTodaysProgress(appState);
  setTodaysProgress(progress);

  // Always update outcome trends with available data or meaningful fallbacks
  // Note: We pass the cadence settings from setters context to ensure calculations use current settings
  const currentCadenceSettings = {
    sessionsPerWeek: appState.learningPlan.cadence?.sessionsPerWeek ?? 5,
    sessionLength: appState.learningPlan.cadence?.sessionLength ?? "auto"
  };
  const trends = calculateOutcomeTrends(appState, getAccuracyStatus, getProblemsStatus, getHintEfficiencyStatus, currentCadenceSettings);
  setOutcomeTrends(trends);
}

// Helper function to create settings change handlers
const createSettingsHandlers = (settings, handlers, _context) => {
  const { setters, debouncedSave } = handlers;

  const { setCadenceSettings, setFocusPriorities, setGuardrails } = setters;

  const handleCadenceChange = (field, value) => {
    setCadenceSettings(prev => {
      const newSettings = { ...prev, [field]: value };
      return newSettings;
    });
    debouncedSave();
  };

  const handleGuardrailChange = (field, value) => {
    setGuardrails(prev => ({ ...prev, [field]: value }));
    debouncedSave();
  };

  const handleFocusPrioritiesChange = (field, value) => {
    setFocusPriorities(prev => ({ ...prev, [field]: value }));
  };

  return {
    handleCadenceChange,
    handleGuardrailChange,
    handleFocusPrioritiesChange
  };
};

// NOTE: Settings are saved using a debounced approach with refs to avoid stale closure bugs
// The refs ensure we always save the latest state values even if the save is delayed

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
  todaysProgress,
  handlers,
  saveSettings,
  navigate,
  isOnboarding
}) {
  const { getStatusColor, getStatusText } = statusUtils;
  const { handleCadenceChange, handleGuardrailChange, handleFocusPrioritiesChange } = handlers;
  
  return (
    <Container size="xl" p="md">
      <Group justify="space-between" mb="md">
        <div>
          <Title order={2}>
            Learning Plan & Missions
          </Title>
          <Text size="sm" mt="xs">
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
          <TodaysProgressSection
            todaysProgress={todaysProgress}
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
  
  // Calculate today's progress
  const [todaysProgress, setTodaysProgress] = useState({
    problemsSolved: 0,
    accuracy: 0,
    reviewProblems: 0,
    hintsPerProblem: 0,
    avgTimeMinutes: 0,
    hasActivity: false
  });

  const statusUtils = useStatusUtils();
  const { getAccuracyStatus, getProblemsStatus, getHintEfficiencyStatus } = statusUtils;

  // Check if user is in onboarding mode (threshold: 1 session)
  // Use the same path as line 48: appState.sessions?.allSessions
  const numSessions = appState?.sessions?.allSessions?.length || 0;
  const isOnboarding = numSessions < 1;

  // Use refs to always have the latest state values for saving
  const cadenceSettingsRef = useRef(cadenceSettings);
  const focusPrioritiesRef = useRef(focusPriorities);
  const guardrailsRef = useRef(guardrails);
  const saveTimeoutRef = useRef(null);

  // Update refs whenever state changes
  useEffect(() => {
    cadenceSettingsRef.current = cadenceSettings;
    focusPrioritiesRef.current = focusPriorities;
    guardrailsRef.current = guardrails;
  }, [cadenceSettings, focusPriorities, guardrails]);

  // Save settings function that reads from refs to get latest values
  const saveSettings = useCallback(async () => {
    try {
      // Get current settings first to preserve other settings
      const currentSettings = await settingsMessaging.getAllSettings();

      const updatedSettings = {
        ...currentSettings,
        sessionsPerWeek: cadenceSettingsRef.current.sessionsPerWeek,
        sessionLength: cadenceSettingsRef.current.sessionLength,
        focusAreas: focusPrioritiesRef.current.primaryTags,
        numberofNewProblemsPerSession: guardrailsRef.current.maxNewProblems
      };

      const response = await settingsMessaging.saveSettings(updatedSettings);

      if (!response || response.status !== "success") {
        logger.error("Failed to save settings");
      }
    } catch (error) {
      logger.error("Failed to save settings:", error);
    }
  }, []); // No dependencies - reads from refs

  // Debounced save function
  const debouncedSave = useCallback(() => {
    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    // Set new timeout
    saveTimeoutRef.current = setTimeout(() => {
      saveSettings();
    }, 1000);
  }, [saveSettings]);

  // Create handlers
  const handlers = createSettingsHandlers(
    { cadenceSettings, focusPriorities, guardrails },
    {
      setters: { setCadenceSettings, setFocusPriorities, setGuardrails },
      debouncedSave
    },
    { appState, isOnboarding }
  );

  useEffect(() => {
    if (appState?.learningPlan) {
      updateLearningPlanData({
        appState,
        isOnboarding,
        getters: { getAccuracyStatus, getProblemsStatus, getHintEfficiencyStatus },
        setters: { setCadenceSettings, setFocusPriorities, setGuardrails, setTodaysProgress, setOutcomeTrends }
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
      todaysProgress={todaysProgress}
      handlers={handlers}
      saveSettings={saveSettings}
      navigate={navigate}
      isOnboarding={isOnboarding}
    />
  );
}