/**
 * Settings Tab Component for Storage Settings
 *
 * Displays storage configuration options and advanced settings.
 */
import React from "react";
import {
  Title,
  Group,
  Card,
  Select,
  NumberInput,
  Switch,
} from "@mantine/core";

export const SettingsTab = ({
  fallbackMode,
  setFallbackMode,
  syncInterval,
  setSyncInterval,
  autoCleanup,
  setAutoCleanup,
}) => {
  return (
    <div>
      <Title order={3} mb="lg">
        Storage Configuration
      </Title>

      <Card mb="lg">
        <Title order={4} mb="md">
          Cleanup Settings
        </Title>
        <Group>
          <Switch
            label="Automatic Cleanup"
            description="Automatically cleanup old data when storage is low"
            checked={autoCleanup}
            onChange={(event) => setAutoCleanup(event.currentTarget.checked)}
          />
        </Group>
      </Card>

      <Card mb="lg">
        <Title order={4} mb="md">
          Fallback Settings
        </Title>
        <Select
          label="Fallback Mode"
          description="How the system should handle storage failures"
          value={fallbackMode}
          onChange={setFallbackMode}
          data={[
            { value: "auto", label: "Automatic - Switch based on health" },
            { value: "manual", label: "Manual - User controlled switching" },
            { value: "always_fallback", label: "Always use Chrome Storage" },
          ]}
          mb="md"
        />

        <NumberInput
          label="Sync Interval (seconds)"
          description="How often to sync critical data to fallback storage"
          value={syncInterval}
          onChange={setSyncInterval}
          min={10}
          max={300}
        />
      </Card>

      <Card>
        <Title order={4} mb="md">
          Advanced Options
        </Title>
        <Group>
          <Switch
            label="Enable Compression"
            description="Compress data when storing in Chrome Storage"
            defaultChecked
          />
          <Switch
            label="Health Monitoring"
            description="Continuously monitor storage health"
            defaultChecked
          />
        </Group>
      </Card>
    </div>
  );
};