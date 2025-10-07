import React from "react";
import { Stack, Text, Switch } from "@mantine/core";

/**
 * Notification Settings Component for Timer
 */
export function NotificationSettings({ settings, updateSettings }) {
  const handleNotificationToggle = (type, enabled) => {
    updateSettings({
      ...settings,
      notifications: {
        ...settings?.notifications,
        [type]: enabled
      }
    });
  };

  return (
    <Stack gap="sm">
      <Text size="sm" fw={500}>Notification Preferences</Text>
      
      <Switch
        label="Sound notifications"
        description="Play a sound when timer starts/stops"
        checked={settings?.notifications?.sound || false}
        onChange={(event) => handleNotificationToggle('sound', event.currentTarget.checked)}
      />
      
      <Switch
        label="Browser notifications"
        description="Show browser notifications for timer events"
        checked={settings?.notifications?.browser || false}
        onChange={(event) => handleNotificationToggle('browser', event.currentTarget.checked)}
      />
      
      <Switch
        label="Visual indicators"
        description="Show visual changes in the timer interface"
        checked={settings?.notifications?.visual !== false}
        onChange={(event) => handleNotificationToggle('visual', event.currentTarget.checked)}
      />
    </Stack>
  );
}