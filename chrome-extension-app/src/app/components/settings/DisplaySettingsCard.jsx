import logger from "../../../shared/utils/logger.js";
import React, { useState, useMemo } from "react";
import { Card, Text, Title, Stack, SegmentedControl, Switch, ColorPicker, Alert, Button, Group, Tooltip, Slider, Select } from "@mantine/core";
import { IconChartBar, IconInfoCircle } from "@tabler/icons-react";
import { useChromeMessage } from "../../../shared/hooks/useChromeMessage";
import { ChromeAPIErrorHandler } from "../../../shared/services/ChromeAPIErrorHandler";
import { SettingsResetButton } from "./SettingsResetButton.jsx";

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

// Layout Preferences Component
function LayoutPreferences({ settings, updateSettings }) {
  const sidebarWidthOptions = [
    { value: "narrow", label: "Narrow (200px)" },
    { value: "normal", label: "Normal (250px)" },
    { value: "wide", label: "Wide (300px)" }
  ];

  const cardSpacingOptions = [
    { value: "compact", label: "Compact" },
    { value: "comfortable", label: "Comfortable" },
    { value: "spacious", label: "Spacious" }
  ];

  return (
    <Stack gap="md">
      <Text size="sm" fw={500}>Layout Preferences</Text>
      
      <div>
        <Text size="sm" fw={500} mb="xs">Sidebar Width</Text>
        <Select
          value={settings?.sidebarWidth || "normal"}
          onChange={(value) => updateSettings({ 
            ...settings, 
            sidebarWidth: value 
          })}
          data={sidebarWidthOptions}
        />
      </div>

      <div>
        <Text size="sm" fw={500} mb="xs">Card Spacing</Text>
        <SegmentedControl
          value={settings?.cardSpacing || "comfortable"}
          onChange={(value) => updateSettings({ 
            ...settings, 
            cardSpacing: value 
          })}
          data={cardSpacingOptions}
          fullWidth
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Text size="sm">Sidebar Auto-Collapse</Text>
          <Text size="xs">Automatically collapse sidebar on smaller screens</Text>
        </div>
        <Switch
          checked={settings?.autoCollapseSidebar !== false}
          onChange={(event) => updateSettings({
            ...settings,
            autoCollapseSidebar: event.currentTarget.checked
          })}
        />
      </div>
    </Stack>
  );
}

// Chart Display Options Component
function ChartDisplayOptions({ settings, updateSettings }) {
  const chartStyleOptions = [
    { value: "modern", label: "Modern" },
    { value: "minimal", label: "Minimal" },
    { value: "classic", label: "Classic" }
  ];

  const colorSchemeOptions = [
    { value: "blue", label: "Blue Theme" },
    { value: "green", label: "Green Theme" },
    { value: "purple", label: "Purple Theme" },
    { value: "orange", label: "Orange Theme" },
    { value: "custom", label: "Custom" }
  ];

  const [showCustomColors, setShowCustomColors] = useState(settings?.chartColorScheme === "custom");

  const handleColorSchemeChange = (value) => {
    setShowCustomColors(value === "custom");
    updateSettings({
      ...settings,
      chartColorScheme: value
    });
  };

  return (
    <Stack gap="md">
      <Text size="sm" fw={500}>Chart Display Options</Text>
      
      <div>
        <Text size="sm" fw={500} mb="xs">Chart Style</Text>
        <SegmentedControl
          value={settings?.chartStyle || "modern"}
          onChange={(value) => updateSettings({ 
            ...settings, 
            chartStyle: value 
          })}
          data={chartStyleOptions}
          fullWidth
        />
      </div>

      <div>
        <Text size="sm" fw={500} mb="xs">Color Scheme</Text>
        <Select
          value={settings?.chartColorScheme || "blue"}
          onChange={handleColorSchemeChange}
          data={colorSchemeOptions}
        />
      </div>

      {showCustomColors && (
        <div>
          <Text size="sm" fw={500} mb="xs">Primary Chart Color</Text>
          <ColorPicker
            value={settings?.customChartColor || "#3b82f6"}
            onChange={(color) => updateSettings({
              ...settings,
              customChartColor: color
            })}
            swatches={['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#6b7280']}
          />
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Text size="sm">Chart Animations</Text>
          <Text size="xs">Enable smooth transitions and hover effects</Text>
        </div>
        <Switch
          checked={settings?.chartAnimations !== false}
          onChange={(event) => updateSettings({
            ...settings,
            chartAnimations: event.currentTarget.checked
          })}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Text size="sm">Show Grid Lines</Text>
          <Text size="xs">Display background grid on charts</Text>
        </div>
        <Switch
          checked={settings?.showGridLines !== false}
          onChange={(event) => updateSettings({
            ...settings,
            showGridLines: event.currentTarget.checked
          })}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Text size="sm">Chart Legends</Text>
          <Text size="xs">Show legends on charts with multiple data series</Text>
        </div>
        <Switch
          checked={settings?.showChartLegends !== false}
          onChange={(event) => updateSettings({
            ...settings,
            showChartLegends: event.currentTarget.checked
          })}
        />
      </div>
    </Stack>
  );
}

// Data Granularity Settings Component
function DataGranularitySettings({ settings, updateSettings }) {
  const defaultTimeRangeOptions = [
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
    { value: "90d", label: "Last 3 months" },
    { value: "1y", label: "Last year" },
    { value: "all", label: "All time" }
  ];

  const [maxDataPoints, setMaxDataPoints] = useState(settings?.maxDataPoints || 50);

  const handleMaxDataPointsChange = (value) => {
    setMaxDataPoints(value);
    updateSettings({
      ...settings,
      maxDataPoints: value
    });
  };

  return (
    <Stack gap="md">
      <Text size="sm" fw={500}>Data Granularity Settings</Text>
      
      <div>
        <Text size="sm" fw={500} mb="xs">Default Time Range</Text>
        <Select
          value={settings?.defaultTimeRange || "30d"}
          onChange={(value) => updateSettings({ 
            ...settings, 
            defaultTimeRange: value 
          })}
          data={defaultTimeRangeOptions}
        />
      </div>

      <div>
        <Text size="sm" fw={500} mb="xs">Maximum Data Points ({maxDataPoints})</Text>
        <Slider
          value={maxDataPoints}
          onChange={handleMaxDataPointsChange}
          min={20}
          max={200}
          step={10}
          marks={[
            { value: 20, label: '20' },
            { value: 50, label: '50' },
            { value: 100, label: '100' },
            { value: 150, label: '150' },
            { value: 200, label: '200' }
          ]}
        />
        <Text size="xs" mt="md" mb="xs">
          Higher values show more detail but may impact performance
        </Text>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Text size="sm">Auto-Refresh Data</Text>
          <Text size="xs">Automatically update dashboard data every few minutes</Text>
        </div>
        <Switch
          checked={settings?.autoRefreshData !== false}
          onChange={(event) => updateSettings({
            ...settings,
            autoRefreshData: event.currentTarget.checked
          })}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Text size="sm">Show Empty Data Points</Text>
          <Text size="xs">Include days with no activity in charts</Text>
        </div>
        <Switch
          checked={settings?.showEmptyDataPoints || false}
          onChange={(event) => updateSettings({
            ...settings,
            showEmptyDataPoints: event.currentTarget.checked
          })}
        />
      </div>
    </Stack>
  );
}

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