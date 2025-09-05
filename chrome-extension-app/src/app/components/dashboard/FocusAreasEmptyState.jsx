import React from "react";
import { Card, Group, Text, Button } from "@mantine/core";
import { IconTarget, IconSettings } from "@tabler/icons-react";

export function FocusAreasEmptyState({ onNavigateToSettings }) {
  return (
    <Card withBorder>
      <Group gap="xs" mb="xs">
        <IconTarget size={16} />
        <Text size="sm" fw={500}>Focus Areas</Text>
      </Group>
      <Text size="sm" c="dimmed" mb="xs">
        No focus areas selected
      </Text>
      <Text size="xs" c="dimmed" mb="md">
        Set focus areas to prioritize specific tags in your learning sessions
      </Text>
      {onNavigateToSettings && (
        <Button
          size="xs"
          variant="light"
          leftSection={<IconSettings size={14} />}
          onClick={onNavigateToSettings}
        >
          Configure Focus Areas
        </Button>
      )}
    </Card>
  );
}