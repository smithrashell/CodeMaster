import React from "react";
import { Stack, Card, Group, Button, Title, Text } from "@mantine/core";
import { SettingsResetButton } from "./SettingsResetButton.jsx";

export function AccessibilityActionButtons({
  handleReset,
  handleSave,
  settings,
  loading,
  isSaving,
  hasChanges
}) {
  return (
    <Card withBorder p="lg" radius="md">
      <Stack gap="md">
        <Group justify="space-between">
          <SettingsResetButton
            onReset={handleReset}
            disabled={loading || isSaving}
            settingsType="accessibility settings"
            variant="subtle"
          />
          
          <Button
            onClick={() => handleSave(settings)}
            loading={isSaving}
            disabled={!hasChanges || loading}
            size="sm"
          >
            Save Accessibility Settings
          </Button>
        </Group>
        
        <Title order={4}>Need Additional Help?</Title>
        <Text size="sm">
          If you need additional accessibility accommodations or encounter any barriers 
          while using this application, please don&apos;t hesitate to reach out for support.
        </Text>
        <Text size="xs">
          These settings are saved securely and will persist across browser sessions.
          You may need to refresh the page for some changes to take full effect.
        </Text>
      </Stack>
    </Card>
  );
}