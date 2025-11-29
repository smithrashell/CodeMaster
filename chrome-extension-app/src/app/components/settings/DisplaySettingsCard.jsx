import logger from "../../../shared/utils/logger.js";
import React, { useState, useMemo } from "react";
import { Card, Text, Title, Stack, Alert, Button, Group, Tooltip } from "@mantine/core";
import { IconChartBar, IconInfoCircle } from "@tabler/icons-react";
import { useChromeMessage } from "../../../shared/hooks/useChromeMessage";
import { ChromeAPIErrorHandler } from "../../../shared/services/ChromeAPIErrorHandler";
import { SettingsResetButton } from "./SettingsResetButton.jsx";
import { LayoutPreferences, ChartDisplayOptions, DataGranularitySettings } from "./DisplaySettingsComponents.jsx";

// Extracted helper hooks for DisplaySettingsCard
const useHandleReset = (defaultSettings, setSettings, setHasChanges, setSaveStatus, handleSave) => {
  return () => {
    setSettings(defaultSettings);
    setHasChanges(true);
    setSaveStatus({ type: "success", message: "Display settings reset to defaults!" });

    setTimeout(() => {
      handleSave(defaultSettings);
    }, 500);
  };
};

const useUpdateSettings = (setSettings, setHasChanges, setSaveStatus) => {
  return (newSettings) => {
    setSettings(newSettings);
    setHasChanges(true);
    setSaveStatus(null);
  };
};

// Helper render components for DisplaySettingsCard
const DisplaySettingsLoading = () => (
  <Card withBorder p="lg" radius="md">
    <Stack gap="md">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <IconChartBar size={20} />
        <Title order={4}>Display Settings</Title>
      </div>
      <Text size="sm">Loading display settings...</Text>
    </Stack>
  </Card>
);

const DisplaySettingsError = () => (
  <Card withBorder p="lg" radius="md">
    <Stack gap="md">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <IconChartBar size={20} />
        <Title order={4}>Display Settings</Title>
      </div>
      <Alert color="red" variant="light">
        Failed to load display settings. Please refresh the page.
      </Alert>
    </Stack>
  </Card>
);

// Settings Save Hook
function useDisplaySettingsSave(setSaveStatus, setHasChanges, setIsSaving) {
  return async (settings) => {
    if (!settings) return;

    setIsSaving(true);
    setSaveStatus(null);

    try {
      // Get current settings and merge display settings
      const currentSettings = await ChromeAPIErrorHandler.sendMessageWithRetry({
        type: "getSettings"
      });

      const updatedSettings = {
        ...currentSettings,
        display: {
          sidebarWidth: settings.sidebarWidth,
          cardSpacing: settings.cardSpacing,
          autoCollapseSidebar: settings.autoCollapseSidebar,
          chartStyle: settings.chartStyle,
          chartColorScheme: settings.chartColorScheme,
          customChartColor: settings.customChartColor,
          chartAnimations: settings.chartAnimations,
          showGridLines: settings.showGridLines,
          showChartLegends: settings.showChartLegends,
          defaultTimeRange: settings.defaultTimeRange,
          maxDataPoints: settings.maxDataPoints,
          autoRefreshData: settings.autoRefreshData,
          showEmptyDataPoints: settings.showEmptyDataPoints
        }
      };

      const response = await ChromeAPIErrorHandler.sendMessageWithRetry({
        type: "setSettings",
        message: updatedSettings
      });

      if (response?.status === "success") {
        setSaveStatus({ type: "success", message: "Display settings saved successfully!" });
        setHasChanges(false);
      } else {
        setSaveStatus({ type: "error", message: "Failed to save display settings." });
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      logger.error("DisplaySettingsCard: Error saving settings:", error);
      setSaveStatus({ type: "error", message: "Failed to save display settings." });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };
}

export function DisplaySettingsCard() {
  const [settings, setSettings] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  const DEFAULT_DISPLAY_SETTINGS = useMemo(() => ({
    sidebarWidth: "normal",
    cardSpacing: "comfortable",
    autoCollapseSidebar: true,
    chartStyle: "modern",
    chartColorScheme: "blue",
    customChartColor: "#3b82f6",
    chartAnimations: true,
    showGridLines: true,
    showChartLegends: true,
    defaultTimeRange: "30d",
    maxDataPoints: 50,
    autoRefreshData: true,
    showEmptyDataPoints: false
  }), []);

  // Load settings using Chrome message hook
  const {
    data: _chromeSettings,
    loading,
    error,
  } = useChromeMessage({ type: "getSettings" }, [], {
    onSuccess: (response) => {
      if (response?.display) {
        setSettings({ ...DEFAULT_DISPLAY_SETTINGS, ...response.display });
      } else {
        setSettings(DEFAULT_DISPLAY_SETTINGS);
      }
    },
  });

  // Use display settings save hook
  const handleSave = useDisplaySettingsSave(setSaveStatus, setHasChanges, setIsSaving);

  const handleReset = useHandleReset(DEFAULT_DISPLAY_SETTINGS, setSettings, setHasChanges, setSaveStatus, handleSave);

  const updateSettings = useUpdateSettings(setSettings, setHasChanges, setSaveStatus);

  if (loading) {
    return <DisplaySettingsLoading />;
  }

  if (error) {
    return <DisplaySettingsError />;
  }

  return (
    <Card withBorder p="lg" radius="md">
      <Stack gap="md">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <IconChartBar size={20} />
          <Title order={4}>Display Settings</Title>
          <Tooltip label="Customize dashboard layout, charts, and data visualization preferences">
            <IconInfoCircle size={16} style={{ cursor: "help", color: 'var(--mantine-color-dimmed)' }} />
          </Tooltip>
        </div>

        <Text size="sm">
          Personalize how your dashboard looks and how data is displayed across all charts and analytics.
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

        {/* Layout Preferences */}
        <LayoutPreferences settings={settings} updateSettings={updateSettings} />

        {/* Chart Display Options */}
        <ChartDisplayOptions settings={settings} updateSettings={updateSettings} />

        {/* Data Granularity Settings */}
        <DataGranularitySettings settings={settings} updateSettings={updateSettings} />

        {/* Action Buttons */}
        <Group justify="space-between" pt="md">
          <SettingsResetButton
            onReset={handleReset}
            disabled={loading || isSaving}
            settingsType="display settings"
            variant="subtle"
          />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <IconInfoCircle size={16} style={{ color: 'var(--mantine-color-dimmed)' }} />
              <Text size="xs">
                Changes apply to all dashboard charts and layouts
              </Text>
            </div>
            
            <Button
              onClick={() => handleSave(settings)}
              loading={isSaving}
              disabled={!hasChanges || loading}
              size="sm"
            >
              Save Display Settings
            </Button>
          </div>
        </Group>
      </Stack>
    </Card>
  );
}