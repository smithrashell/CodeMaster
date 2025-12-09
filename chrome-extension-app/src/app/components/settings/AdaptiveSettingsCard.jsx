import { useState } from "react";
import { Card, Text, Title, Button, Stack, Alert, Group } from "@mantine/core";
import { IconSettings, IconInfoCircle } from "@tabler/icons-react";
import {
  SliderMarksSessionLength,
  SliderMarksNewProblemsPerSession,
  GradientSegmentedControlTimeLimit,
  ToggleSelectRemainders,
} from "../../../shared/components/nantine.jsx";
import AdaptiveSessionToggle from "../../../content/features/settings/AdaptiveSessionToggle.js";
import { useInterviewReadiness } from "../../../shared/hooks/useInterviewReadiness";
import { SettingsResetButton } from "./SettingsResetButton.jsx";
import {
  getDefaultSettings,
  InterviewModeControls,
  useMaxNewProblems,
  useSettingsInitialization,
  useChromeSettings,
  useSettingsSave,
} from "./AdaptiveSettingsHelpers.jsx";

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
