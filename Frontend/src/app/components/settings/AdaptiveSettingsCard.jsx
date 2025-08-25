import { useState, useEffect } from "react";
import { Card, Text, Title, Button, Stack, Alert, Group } from "@mantine/core";
import { IconSettings, IconInfoCircle } from "@tabler/icons-react";
import {
  SliderMarksSessionLength,
  SliderMarksNewProblemsPerSession,
  GradientSegmentedControlTimeLimit,
  ToggleSelectRemainders,
} from "../../../shared/components/nantine.jsx";
import AdaptiveSessionToggle from "../../../content/features/settings/AdaptiveSessionToggle.js";
import { useChromeMessage } from "../../../shared/hooks/useChromeMessage";
import { SettingsResetButton } from "./SettingsResetButton.jsx";
import SessionLimits from "../../../shared/utils/sessionLimits.js";

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

// Settings Save Hook
function useSettingsSave(setSaveStatus, setHasChanges, setIsSaving) {
  return async (settings) => {
    if (!settings) return;

    setIsSaving(true);
    setSaveStatus(null);

    try {
      chrome.runtime.sendMessage(
        { type: "setSettings", message: settings },
        (response) => {
          // eslint-disable-next-line no-console
          console.log("AdaptiveSettingsCard: Settings saved:", response);

          chrome.runtime.sendMessage(
            { type: "clearSettingsCache" },
            (cacheResponse) => {
              // eslint-disable-next-line no-console
              console.log("AdaptiveSettingsCard: Settings cache cleared:", cacheResponse);
            }
          );

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
      console.error("AdaptiveSettingsCard: Error saving settings:", error);
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
  const [maxNewProblems, setMaxNewProblems] = useState(8); // Safe default, prevents breaking

  // Load settings using Chrome message hook
  const {
    data: _chromeSettings,
    loading,
    error,
  } = useChromeMessage({ type: "getSettings" }, [], {
    onSuccess: (response) => {
      if (response) {
        setSettings(response);
      } else {
        // eslint-disable-next-line no-console
        console.warn("No settings received, using defaults.");
      }
    },
  });

  // Use settings save hook
  const handleSave = useSettingsSave(setSaveStatus, setHasChanges, setIsSaving);

  // Ensure settings have proper default values for sessionLength
  useEffect(() => {
    if (settings && typeof settings.sessionLength !== 'number') {
      const defaultSettings = {
        adaptive: true,
        sessionLength: 8,
        numberofNewProblemsPerSession: 3,
        limit: "Auto",
        reminder: {
          enabled: true,
          time: "12",
        },
        ...settings
      };
      
      // Only update if the sessionLength is actually missing/invalid
      if (settings.sessionLength !== defaultSettings.sessionLength) {
        setSettings(defaultSettings);
      }
    }
  }, [settings]);

  // Update max new problems dynamically when settings change (non-blocking)
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

  // Reset settings to defaults
  const handleReset = async () => {
    const defaultSettings = {
      adaptive: true,
      sessionLength: 8,
      numberofNewProblemsPerSession: 3,
      limit: "Auto",
      reminder: {
        enabled: true,
        time: "12",
      },
    };
    
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

  if (loading) {
    return (
      <Card withBorder p="lg" radius="md">
        <Stack gap="md">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconSettings size={20} />
            <Title order={4}>Session Settings</Title>
          </div>
          <Text size="sm" c="dimmed">Loading settings...</Text>
        </Stack>
      </Card>
    );
  }

  if (error) {
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

  return (
    <Card withBorder p="lg" radius="md">
      <Stack gap="md">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <IconSettings size={20} />
          <Title order={4}>Session Settings</Title>
        </div>

        <Text size="sm" c="dimmed">
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
        <div>
          <Text size="sm" fw={500} mb="xs">Time Limits</Text>
          <GradientSegmentedControlTimeLimit
            value={settings?.limit}
            onChange={(value) => updateSettings({ ...settings, limit: value })}
          />
        </div>

        {/* Reminders */}
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

        {/* Action Buttons */}
        <Group justify="space-between" pt="md">
          <SettingsResetButton
            onReset={handleReset}
            disabled={loading || isSaving}
            settingsType="session settings"
            variant="subtle"
          />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <IconInfoCircle size={16} style={{ color: 'var(--mantine-color-dimmed)' }} />
              <Text size="xs" c="dimmed">
                Changes also sync to content overlay
              </Text>
            </div>
            
            <Button
              onClick={() => handleSave(settings)}
              loading={isSaving}
              disabled={!hasChanges || loading}
              size="sm"
            >
              Save Changes
            </Button>
          </div>
        </Group>
      </Stack>
    </Card>
  );
}