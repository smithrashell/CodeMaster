import { useState, useEffect } from "react";
import { Text, Alert, Stack, SegmentedControl, Tooltip, Slider } from "@mantine/core";
import { IconInfoCircle, IconTrophy, IconClock, IconCalendar } from "@tabler/icons-react";
import { useChromeMessage } from "../../../shared/hooks/useChromeMessage";
import SessionLimits from "../../../shared/utils/session/sessionLimits.js";
import logger from "../../../shared/utils/logging/logger.js";

// Helper function to get interview mode data
export function getInterviewModeData() {
  return [
    {
      label: "Disabled",
      value: "disabled",
      description: "Standard learning sessions with full support"
    },
    {
      label: "Interview-Like",
      value: "interview-like",
      disabled: false,
      description: "Limited hints, mild time pressure"
    },
    {
      label: "Full Interview",
      value: "full-interview",
      disabled: false,
      description: "No hints, strict timing, realistic conditions"
    }
  ];
}

// Default Settings Configuration
export function getDefaultSettings() {
  return {
    adaptive: true,
    sessionLength: 'auto',
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

// Interview Mode Selector Component
export function InterviewModeSelector({ currentMode, currentModeData, settings, updateSettings }) {
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
export function InterviewFrequencyControls({ settings, updateSettings }) {
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
export function InterviewModeLoadingState() {
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
export function InterviewModeControls({ settings, updateSettings, _interviewReadiness }) {
  const currentMode = settings?.interviewMode || "disabled";
  const currentModeData = getInterviewModeData().find(mode => mode.value === currentMode);

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

      {currentMode !== "disabled" && (
        <InterviewFrequencyControls
          settings={settings}
          updateSettings={updateSettings}
        />
      )}
    </div>
  );
}

// Custom hook for managing max new problems
export function useMaxNewProblems(settings) {
  const [maxNewProblems, setMaxNewProblems] = useState(8);

  useEffect(() => {
    const updateMaxNewProblems = async () => {
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 2000)
        );

        const sessionStatePromise = chrome?.runtime?.sendMessage({ type: "getSessionState" });
        const sessionState = await Promise.race([sessionStatePromise, timeoutPromise]);

        const newMax = SessionLimits.getMaxNewProblems(sessionState, settings?.sessionLength);
        setMaxNewProblems(newMax);
      } catch (error) {
        const fallbackMax = SessionLimits.getMaxNewProblems(null, settings?.sessionLength);
        setMaxNewProblems(fallbackMax);
      }
    };

    if (settings) {
      updateMaxNewProblems().catch(() => {
        setMaxNewProblems(8);
      });
    }
  }, [settings]);

  return maxNewProblems;
}

// Settings initialization hook
export function useSettingsInitialization(settings, setSettings) {
  useEffect(() => {
    const hasValidSessionLength = typeof settings?.sessionLength === 'number' || settings?.sessionLength === 'auto';

    if (settings && (!hasValidSessionLength || !settings.interviewMode)) {
      const defaultSettings = { ...getDefaultSettings(), ...settings };

      if (settings.sessionLength !== defaultSettings.sessionLength || !settings.interviewMode) {
        setSettings(defaultSettings);
      }
    }
  }, [settings, setSettings]);
}

// Chrome settings loading hook
export function useChromeSettings(setSettings) {
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
export function useSettingsSave(setSaveStatus, setHasChanges, setIsSaving) {
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
      logger.error("AdaptiveSettingsCard: Error saving settings:", error);
      setSaveStatus({ type: "error", message: "Failed to save settings. Please try again." });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };
}
