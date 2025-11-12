import logger from "../../../shared/utils/logger.js";
import React, { useState, useMemo } from "react";
import { Card, Text, Title, Stack, Switch, Slider, Alert, Button, Group, Tooltip, Select } from "@mantine/core";
import { IconClock, IconInfoCircle } from "@tabler/icons-react";
import { useChromeMessage } from "../../../shared/hooks/useChromeMessage";
import { SettingsResetButton } from "./SettingsResetButton.jsx";

// Timer Display Options Component
function TimerDisplayOptions({ settings, updateSettings }) {
  const displayOptions = [
    { value: "mm:ss", label: "Minutes:Seconds (05:30)" },
    { value: "seconds", label: "Total Seconds (330)" },
    { value: "compact", label: "Compact (5m 30s)" },
    { value: "none", label: "Hidden Timer" }
  ];

  return (
    <div>
      <Text size="sm" fw={500} mb="xs">Timer Display Format</Text>
      <Select
        value={settings?.timerDisplay || "mm:ss"}
        onChange={(value) => updateSettings({ ...settings, timerDisplay: value })}
        data={displayOptions}
        placeholder="Select display format"
      />
    </div>
  );
}

// Break Interval Settings Component
function BreakIntervalSettings({ settings, updateSettings }) {
  const [breakEnabled, setBreakEnabled] = useState(settings?.breakReminders?.enabled || false);
  const [breakInterval, setBreakInterval] = useState(settings?.breakReminders?.interval || 25);

  const handleBreakToggle = (enabled) => {
    setBreakEnabled(enabled);
    updateSettings({
      ...settings,
      breakReminders: {
        ...settings?.breakReminders,
        enabled
      }
    });
  };

  const handleIntervalChange = (interval) => {
    setBreakInterval(interval);
    updateSettings({
      ...settings,
      breakReminders: {
        ...settings?.breakReminders,
        interval
      }
    });
  };

  return (
    <Stack gap="md">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Text size="sm" fw={500}>Break Reminders</Text>
          <Text size="xs">Remind you to take breaks during long sessions</Text>
        </div>
        <Switch
          checked={breakEnabled}
          onChange={(event) => handleBreakToggle(event.currentTarget.checked)}
        />
      </div>
      
      {breakEnabled && (
        <div>
          <Text size="sm" fw={500} mb="xs">Break Interval (minutes)</Text>
          <Slider
            value={breakInterval}
            onChange={handleIntervalChange}
            min={5}
            max={60}
            step={5}
            marks={[
              { value: 5, label: '5m' },
              { value: 15, label: '15m' },
              { value: 25, label: '25m' },
              { value: 45, label: '45m' },
              { value: 60, label: '60m' }
            ]}
          />
          <Text size="xs" mt="xs">
            Recommended: 25 minutes (Pomodoro technique)
          </Text>
        </div>
      )}
    </Stack>
  );
}

// Notification Preferences Component
function NotificationPreferences({ settings, updateSettings }) {
  const [soundEnabled, setSoundEnabled] = useState(settings?.notifications?.sound || false);
  const [browserNotifications, setBrowserNotifications] = useState(settings?.notifications?.browser || false);
  const [visualAlerts, setVisualAlerts] = useState(settings?.notifications?.visual !== false);

  const handleSoundToggle = (enabled) => {
    setSoundEnabled(enabled);
    updateSettings({
      ...settings,
      notifications: {
        ...settings?.notifications,
        sound: enabled
      }
    });
  };

  const handleBrowserToggle = (enabled) => {
    setBrowserNotifications(enabled);
    updateSettings({
      ...settings,
      notifications: {
        ...settings?.notifications,
        browser: enabled
      }
    });
  };

  const handleVisualToggle = (enabled) => {
    setVisualAlerts(enabled);
    updateSettings({
      ...settings,
      notifications: {
        ...settings?.notifications,
        visual: enabled
      }
    });
  };

  return (
    <Stack gap="md">
      <Text size="sm" fw={500}>Notification Preferences</Text>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Text size="sm">Sound Alerts</Text>
          <Text size="xs">Play sound for timer events</Text>
        </div>
        <Switch
          checked={soundEnabled}
          onChange={(event) => handleSoundToggle(event.currentTarget.checked)}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Text size="sm">Browser Notifications</Text>
          <Text size="xs">Show system notifications</Text>
        </div>
        <Switch
          checked={browserNotifications}
          onChange={(event) => handleBrowserToggle(event.currentTarget.checked)}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Text size="sm">Visual Alerts</Text>
          <Text size="xs">Flash or highlight timer when events occur</Text>
        </div>
        <Switch
          checked={visualAlerts}
          onChange={(event) => handleVisualToggle(event.currentTarget.checked)}
        />
      </div>
    </Stack>
  );
}

// Timer Settings Header Component
function TimerSettingsHeader() {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <IconClock size={20} />
        <Title order={4}>Timer Settings</Title>
        <Tooltip label="Configure timer display, breaks, and notifications for your coding sessions">
          <IconInfoCircle size={16} style={{ cursor: "help", color: 'var(--mantine-color-dimmed)' }} />
        </Tooltip>
      </div>
      <Text size="sm">
        Customize how the timer appears and behaves during your problem-solving sessions.
      </Text>
    </>
  );
}

// Timer Settings Actions Component
function TimerSettingsActions({ hasChanges, loading, isSaving, onReset, onSave }) {
  return (
    <Group justify="space-between" pt="md">
      <SettingsResetButton
        onReset={onReset}
        disabled={loading || isSaving}
        settingsType="timer settings"
        variant="subtle"
      />
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <IconInfoCircle size={16} style={{ color: 'var(--mantine-color-dimmed)' }} />
          <Text size="xs">
            Timer settings apply to all problem-solving sessions
          </Text>
        </div>
        
        <Button
          onClick={onSave}
          loading={isSaving}
          disabled={!hasChanges || loading}
          size="sm"
        >
          Save Timer Settings
        </Button>
      </div>
    </Group>
  );
}

// Loading State Component
function TimerSettingsLoadingState() {
  return (
    <Card withBorder p="lg" radius="md">
      <Stack gap="md">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <IconClock size={20} />
          <Title order={4}>Timer Settings</Title>
        </div>
        <Text size="sm">Loading timer settings...</Text>
      </Stack>
    </Card>
  );
}

// Error State Component
function TimerSettingsErrorState() {
  return (
    <Card withBorder p="lg" radius="md">
      <Stack gap="md">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <IconClock size={20} />
          <Title order={4}>Timer Settings</Title>
        </div>
        <Alert color="red" variant="light">
          Failed to load timer settings. Please refresh the page.
        </Alert>
      </Stack>
    </Card>
  );
}

// Settings Save Hook
function useTimerSettingsSave(setSaveStatus, setHasChanges, setIsSaving) {
  return async (settings) => {
    if (!settings) return;

    setIsSaving(true);
    setSaveStatus(null);

    try {
      // Get current settings and merge timer settings
      const currentSettings = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "getSettings" }, (response) => {
          resolve(response || {});
        });
      });

      const updatedSettings = {
        ...currentSettings,
        timerDisplay: settings.timerDisplay,
        breakReminders: settings.breakReminders,
        notifications: settings.notifications
      };

      chrome.runtime.sendMessage(
        { type: "setSettings", message: updatedSettings },
        (response) => {
          if (response?.status === "success") {
            setSaveStatus({ type: "success", message: "Timer settings saved successfully!" });
            setHasChanges(false);
          } else {
            setSaveStatus({ type: "error", message: "Failed to save timer settings." });
          }
        }
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      logger.error("TimerSettingsCard: Error saving settings:", error);
      setSaveStatus({ type: "error", message: "Failed to save timer settings." });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };
}

export function TimerSettingsCard() {
  const [settings, setSettings] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  const DEFAULT_TIMER_SETTINGS = useMemo(() => ({
    timerDisplay: "mm:ss",
    breakReminders: {
      enabled: false,
      interval: 25
    },
    notifications: {
      sound: false,
      browser: false,
      visual: true
    }
  }), []);

  // Load settings using Chrome message hook
  const {
    data: _chromeSettings,
    loading,
    error,
  } = useChromeMessage({ type: "getSettings" }, [], {
    onSuccess: (response) => {
      if (response) {
        // Extract timer-related settings or use defaults
        setSettings({
          timerDisplay: response.timerDisplay || DEFAULT_TIMER_SETTINGS.timerDisplay,
          breakReminders: response.breakReminders || DEFAULT_TIMER_SETTINGS.breakReminders,
          notifications: response.notifications || DEFAULT_TIMER_SETTINGS.notifications
        });
      } else {
        setSettings(DEFAULT_TIMER_SETTINGS);
      }
    },
  });

  // Use timer settings save hook
  const handleSave = useTimerSettingsSave(setSaveStatus, setHasChanges, setIsSaving);

  // Reset timer settings to defaults
  const handleReset = () => {
    setSettings(DEFAULT_TIMER_SETTINGS);
    setHasChanges(true);
    setSaveStatus({ type: "success", message: "Timer settings reset to defaults!" });
    
    // Auto-save after reset
    setTimeout(() => {
      handleSave(DEFAULT_TIMER_SETTINGS);
    }, 500);
  };

  // Update settings and mark as changed
  const updateSettings = (newSettings) => {
    setSettings(newSettings);
    setHasChanges(true);
    setSaveStatus(null);
  };

  // Early returns for loading and error states
  if (loading) return <TimerSettingsLoadingState />;
  if (error) return <TimerSettingsErrorState />;

  return (
    <Card withBorder p="lg" radius="md">
      <Stack gap="md">
        {/* Header */}
        <TimerSettingsHeader />

        {/* Save Status */}
        {saveStatus && (
          <Alert 
            color={saveStatus.type === "success" ? "green" : "red"} 
            variant="light"
          >
            {saveStatus.message}
          </Alert>
        )}

        {/* Timer Display Options */}
        <TimerDisplayOptions settings={settings} updateSettings={updateSettings} />

        {/* Break Interval Settings */}
        <BreakIntervalSettings settings={settings} updateSettings={updateSettings} />

        {/* Notification Preferences */}
        <NotificationPreferences settings={settings} updateSettings={updateSettings} />

        {/* Action Buttons */}
        <TimerSettingsActions 
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