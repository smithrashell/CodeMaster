import logger from "../../../shared/utils/logging/logger.js";
import { useState, useEffect } from "react";
import { Card, Text, Title, Button, Stack, Alert, Group, SegmentedControl, Tooltip, Slider } from "@mantine/core";
import { IconSettings, IconInfoCircle, IconTrophy, IconClock, IconCalendar } from "@tabler/icons-react";
import {
  SliderMarksSessionLength,
  SliderMarksNewProblemsPerSession,
  GradientSegmentedControlTimeLimit,
  ToggleSelectRemainders,
} from "../../../shared/components/nantine.jsx";
import AdaptiveSessionToggle from "../../../content/features/settings/AdaptiveSessionToggle.js";
import { useChromeMessage } from "../../../shared/hooks/useChromeMessage";
import { useInterviewReadiness } from "../../../shared/hooks/useInterviewReadiness";
import { SettingsResetButton } from "./SettingsResetButton.jsx";
import SessionLimits from "../../../shared/utils/session/sessionLimits.js";

// Session Controls Component (when adaptive is off)
function SessionControls({ settings, updateSettings, maxNewProblems }) {
  if (settings?.adaptive) return null;

  return (
    <Stack gap="md">
      <div>
        <Text size="sm" fw={500} mb="xs">Session Length</Text>
        <SliderMarksSessionLength
          value={settings?.sessionLength}
          onChange={(value) =>
            updateSettings({ ...settings, sessionLength: value })
          }
        />
      </div>

      <div>
        <Text size="sm" fw={500} mb="xs">New Problems Per Session</Text>
        <SliderMarksNewProblemsPerSession
          value={Math.min(settings?.numberofNewProblemsPerSession || 1, maxNewProblems || 8)}
          onChange={(value) =>
            updateSettings({
              ...settings,
              numberofNewProblemsPerSession: value,
            })
          }
          max={maxNewProblems || 8}
        />
      </div>
    </Stack>
  );
}


// Helper function to get interview mode data
function getInterviewModeData() {
  return [
    { 
      label: "Disabled", 
      value: "disabled",
      description: "Standard learning sessions with full support"
    },
    { 
      label: "Interview-Like", 
      value: "interview-like",
      disabled: false, // Always enable for testing - remove readiness check
      description: "Limited hints, mild time pressure"
    },
    { 
      label: "Full Interview", 
      value: "full-interview",
      disabled: false, // Always enable for testing - remove readiness check  
      description: "No hints, strict timing, realistic conditions"
    }
  ];
}

// Interview Mode Selector Component
function InterviewModeSelector({ currentMode, currentModeData, settings, updateSettings }) {
  return (
    <>
      <SegmentedControl
        value={currentMode}
        onChange={(value) => updateSettings({ ...settings, interviewMode: value })}
        data={getInterviewModeData()}
        fullWidth
        size="sm"
        color="var(--cm-active-blue)"
      />
      
      {currentModeData && (
        <Text size="xs" mt="xs">
          <IconClock size={12} style={{ marginRight: '4px' }} />
          {currentModeData.description}
        </Text>
      )}
      
      {currentMode !== "disabled" && (
        <Alert variant="light" color="blue" mt="xs" size="xs">
          🎯 Interview mode will apply to your next session generation
        </Alert>
      )}
    </>
  );
}

// Interview Frequency Controls Component
function InterviewFrequencyControls({ settings, updateSettings }) {
  return (
    <Stack gap="md" mt="md" pt="md" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
      <div>
        <Text size="sm" fw={500} mb="xs" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <IconCalendar size={16} />
          Interview Frequency
          <Tooltip 
            label="When should interview sessions be automatically suggested?"
            withArrow 
            position="top"
            classNames={{
              tooltip: 'cm-force-tooltip-visible'
            }}
          >
            <IconInfoCircle size={14} style={{ cursor: "help", color: 'var(--mantine-color-dimmed)' }} />
          </Tooltip>
        </Text>

        <SegmentedControl
          value={settings?.interviewFrequency || "manual"}
          onChange={(value) => updateSettings({ ...settings, interviewFrequency: value })}
          data={[
            { label: "Manual", value: "manual" },
            { label: "Weekly", value: "weekly" },
            { label: "Level Up", value: "level-up" }
          ]}
          fullWidth
          size="sm"
          color="var(--cm-active-blue)"
        />

        <Text size="xs" mt="xs">
          {settings?.interviewFrequency === "manual" && "🎯 Interview sessions available on demand"}
          {settings?.interviewFrequency === "weekly" && "⏰ System will suggest interview sessions every 7-10 days"}
          {settings?.interviewFrequency === "level-up" && "📈 Interview sessions suggested after tag mastery improvements"}
        </Text>
      </div>

      {/* Readiness Threshold - Show only for level-up frequency */}
      {settings?.interviewFrequency === "level-up" && (
        <div>
          <Text size="sm" fw={500} mb="xs" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconTrophy size={16} />
            Readiness Threshold
            <Tooltip 
              label="Minimum performance score needed before suggesting Full Interview mode"
              withArrow 
              position="top"
              styles={{
                tooltip: {
                  zIndex: 1000,
                  fontSize: '11px'
                }
              }}
            >
              <IconInfoCircle size={14} style={{ cursor: "help", color: 'var(--mantine-color-dimmed)' }} />
            </Tooltip>
          </Text>

          <Slider
            value={(settings?.interviewReadinessThreshold || 0.7) * 100}
            onChange={(value) => updateSettings({ 
              ...settings, 
              interviewReadinessThreshold: value / 100 
            })}
            min={50}
            max={100}
            step={5}
            marks={[
              { value: 50, label: 'Conservative' },
              { value: 70, label: '70%' },
              { value: 85, label: '85%' },
              { value: 100, label: 'Confident' }
            ]}
            color="var(--cm-active-blue)"
          />

          <Text size="xs" mt="xs" ta="center">
            🎯 Full Interview mode unlocks at {Math.round((settings?.interviewReadinessThreshold || 0.7) * 100)}% mastery
          </Text>
        </div>
      )}
    </Stack>
  );
}

// Loading state for Interview Mode Controls
function InterviewModeLoadingState() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <IconTrophy size={16} />
        <Text size="sm" fw={500}>Interview Practice Mode</Text>
        <Tooltip 
          label="Loading interview settings..." 
          withArrow 
          position="top"
          classNames={{
            tooltip: 'cm-force-tooltip-visible'
          }}
        >
          <IconInfoCircle size={14} style={{ cursor: "help", color: 'var(--mantine-color-dimmed)' }} />
        </Tooltip>
      </div>
      <Alert variant="light" color="gray" size="xs">
        ⏳ Loading interview settings...
      </Alert>
    </div>
  );
}

// Interview Mode Controls Component
function InterviewModeControls({ settings, updateSettings, _interviewReadiness }) {
  const currentMode = settings?.interviewMode || "disabled";
  const currentModeData = getInterviewModeData().find(mode => mode.value === currentMode);

  // Always render the component, even if settings aren't loaded yet
  if (!settings) {
    return <InterviewModeLoadingState />;
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <IconTrophy size={16} />
        <Text size="sm" fw={500}>Interview Practice Mode</Text>
        <Tooltip 
          label="Progressive interview simulation modes to test skill transfer under pressure"
          withArrow
          position="top"
          classNames={{
            tooltip: 'cm-force-tooltip-visible'
          }}
        >
          <IconInfoCircle size={14} style={{ cursor: "help", color: 'var(--mantine-color-dimmed)' }} />
        </Tooltip>
      </div>

      <InterviewModeSelector 
        currentMode={currentMode}
        currentModeData={currentModeData}
        settings={settings}
        updateSettings={updateSettings}
      />

      {/* Interview Frequency Controls - Show only when interview mode is enabled */}
      {currentMode !== "disabled" && (
        <InterviewFrequencyControls 
          settings={settings} 
          updateSettings={updateSettings}
        />
      )}
    </div>
  );
}

// Default Settings Configuration
function getDefaultSettings() {
  return {
    adaptive: true,
    sessionLength: 'auto', // Auto mode lets algorithm decide (3-12 problems based on performance)
    numberofNewProblemsPerSession: 3,
    limit: "Auto",
    reminder: {
      enabled: true,
      time: "12",
    },
    interviewMode: "disabled",
    interviewReadinessThreshold: 0.8,
    interviewFrequency: "manual",
  };
}

// Time Limits Component
function TimeLimitsSection({ settings, updateSettings }) {
  return (
    <div>
      <Text size="sm" fw={500} mb="xs">Time Limits</Text>
      <GradientSegmentedControlTimeLimit
        value={settings?.limit}
        onChange={(value) => updateSettings({ ...settings, limit: value })}
      />
    </div>
  );
}

// Reminders Component
function RemindersSection({ settings, updateSettings }) {
  return (
    <div>
      <Text size="sm" fw={500} mb="xs">Reminders</Text>
      <ToggleSelectRemainders
        reminder={settings?.reminder}
        onChange={(updatedReminder) =>
          updateSettings({
            ...settings,
            reminder: { ...settings.reminder, ...updatedReminder },
          })
        }
      />
    </div>
  );
}

// Action Buttons Component
function ActionButtons({ hasChanges, loading, isSaving, onReset, onSave }) {
  return (
    <Group justify="space-between" pt="md">
      <SettingsResetButton
        onReset={onReset}
        disabled={loading || isSaving}
        settingsType="session settings"
        variant="subtle"
      />
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <IconInfoCircle size={16} style={{ color: 'var(--mantine-color-dimmed)' }} />
          <Text size="xs">
            Changes also sync to content overlay
          </Text>
        </div>
        
        <Button
          onClick={onSave}
          loading={isSaving}
          disabled={!hasChanges || loading}
          size="sm"
        >
          Save Changes
        </Button>
      </div>
    </Group>
  );
}

// Loading State Component
function LoadingState() {
  return (
    <Card withBorder p="lg" radius="md">
      <Stack gap="md">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <IconSettings size={20} />
          <Title order={4}>Session Settings</Title>
        </div>
        <Text size="sm">Loading settings...</Text>
      </Stack>
    </Card>
  );
}

// Error State Component
function ErrorState() {
  return (
    <Card withBorder p="lg" radius="md">
      <Stack gap="md">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <IconSettings size={20} />
          <Title order={4}>Session Settings</Title>
        </div>
        <Alert color="red" variant="light">
          Failed to load settings. Please refresh the page.
        </Alert>
      </Stack>
    </Card>
  );
}

// Custom hook for managing max new problems
function useMaxNewProblems(settings) {
  const [maxNewProblems, setMaxNewProblems] = useState(8);

  useEffect(() => {
    const updateMaxNewProblems = async () => {
      try {
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 2000)
        );
        
        const sessionStatePromise = chrome?.runtime?.sendMessage({ type: "getSessionState" });
        const sessionState = await Promise.race([sessionStatePromise, timeoutPromise]);
        
        const newMax = SessionLimits.getMaxNewProblems(sessionState, settings?.sessionLength);
        setMaxNewProblems(newMax);
      } catch (error) {
        // Silent fallback to prevent breaking settings load
        const fallbackMax = SessionLimits.getMaxNewProblems(null, settings?.sessionLength);
        setMaxNewProblems(fallbackMax);
      }
    };

    if (settings) {
      // Run async without blocking component render
      updateMaxNewProblems().catch(() => {
        // Final fallback if everything fails
        setMaxNewProblems(8);
      });
    }
  }, [settings]);

  return maxNewProblems;
}

// Settings initialization hook
function useSettingsInitialization(settings, setSettings) {
  useEffect(() => {
    // sessionLength can be 'auto' or a number
    const hasValidSessionLength = typeof settings?.sessionLength === 'number' || settings?.sessionLength === 'auto';

    if (settings && (!hasValidSessionLength || !settings.interviewMode)) {
      const defaultSettings = { ...getDefaultSettings(), ...settings };

      // Only update if the sessionLength or interviewMode is actually missing/invalid
      if (settings.sessionLength !== defaultSettings.sessionLength || !settings.interviewMode) {
        setSettings(defaultSettings);
      }
    }
  }, [settings, setSettings]);
}

// Chrome settings loading hook
function useChromeSettings(setSettings) {
  return useChromeMessage({ type: "getSettings" }, [], {
    onSuccess: (response) => {
      if (response) {
        setSettings(response);
      } else {
        logger.warn("No settings received, using defaults.");
      }
    },
  });
}

// Settings Save Hook
function useSettingsSave(setSaveStatus, setHasChanges, setIsSaving) {
  return (settings) => {
    if (!settings) return;

    setIsSaving(true);
    setSaveStatus(null);

    try {
      chrome.runtime.sendMessage(
        { type: "setSettings", message: settings },
        (response) => {
          if (response?.status === "success") {
            setSaveStatus({ type: "success", message: "Settings saved successfully!" });
            setHasChanges(false);
          } else {
            setSaveStatus({ type: "error", message: "Failed to save settings. Please try again." });
          }
        }
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      logger.error("AdaptiveSettingsCard: Error saving settings:", error);
      setSaveStatus({ type: "error", message: "Failed to save settings. Please try again." });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };
}


export function AdaptiveSettingsCard() {
  const [settings, setSettings] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  // Load settings using Chrome message hook
  const { loading, error } = useChromeSettings(setSettings);

  // Initialize settings and ensure proper defaults
  useSettingsInitialization(settings, setSettings);

  // Check interview readiness
  const interviewReadiness = useInterviewReadiness(settings);

  // Use custom hook for max new problems
  const maxNewProblems = useMaxNewProblems(settings);

  // Always ensure settings exist for form controls
  const workingSettings = settings || getDefaultSettings();

  // Use settings save hook
  const handleSave = useSettingsSave(setSaveStatus, setHasChanges, setIsSaving);


  // Reset settings to defaults
  const handleReset = () => {
    const defaultSettings = getDefaultSettings();
    
    setSettings(defaultSettings);
    setHasChanges(true);
    setSaveStatus({ type: "success", message: "Settings reset to defaults!" });
    
    // Auto-save after reset
    setTimeout(() => {
      handleSave(defaultSettings);
    }, 500);
  };

  // Update settings and mark as changed
  const updateSettings = (newSettings) => {
    setSettings(newSettings);
    setHasChanges(true);
    setSaveStatus(null);
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState />;

  return (
    <Card withBorder p="lg" radius="md">
      <Stack gap="md">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <IconSettings size={20} />
          <Title order={4}>Session Settings</Title>
        </div>

        <Text size="sm">
          Configure your learning session parameters. These settings sync with the quick settings in the content overlay.
        </Text>

        {/* Save Status */}
        {saveStatus && (
          <Alert 
            color={saveStatus.type === "success" ? "green" : "red"} 
            variant="light"
          >
            {saveStatus.message}
          </Alert>
        )}

        {/* Adaptive Sessions Toggle */}
        <div>
          <AdaptiveSessionToggle
            adaptive={settings?.adaptive}
            onChange={(val) => updateSettings({ ...settings, adaptive: val })}
          />
        </div>

        {/* Session Controls (conditionally shown when adaptive is off) */}
        <SessionControls settings={settings} updateSettings={updateSettings} maxNewProblems={maxNewProblems} />

        {/* Time Limits */}
        <TimeLimitsSection settings={settings} updateSettings={updateSettings} />
        
        {/* Interview Mode Controls */}
        <InterviewModeControls 
          settings={workingSettings} 
          updateSettings={(newSettings) => {
            setSettings(newSettings);
            updateSettings(newSettings);
          }} 
          interviewReadiness={interviewReadiness}
        />

        {/* Reminders */}
        <RemindersSection settings={settings} updateSettings={updateSettings} />

        {/* Action Buttons */}
        <ActionButtons 
          hasChanges={hasChanges}
          loading={loading}
          isSaving={isSaving}
          onReset={handleReset}
          onSave={() => handleSave(settings)}
        />
      </Stack>
    </Card>
  );
}