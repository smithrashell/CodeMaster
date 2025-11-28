import React, { useState } from "react";
import { Text, Stack, SegmentedControl, Switch, ColorPicker, Select, Slider } from "@mantine/core";

// Layout Preferences Component
export function LayoutPreferences({ settings, updateSettings }) {
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
export function ChartDisplayOptions({ settings, updateSettings }) {
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
export function DataGranularitySettings({ settings, updateSettings }) {
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
