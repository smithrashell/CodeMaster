import React from "react";
import { Card, Group, Text } from "@mantine/core";
import { IconTarget } from "@tabler/icons-react";

export function FocusAreasEmptyState({ onNavigateToSettings: _onNavigateToSettings }) {
  return (
    <Card withBorder>
      <Group gap="xs" mb="xs">
        <IconTarget size={16} />
        <Text size="sm" fw={500}>Focus Areas</Text>
      </Group>
      <Text size="sm" c="dimmed" mb="xs">
        No active focus areas yet
      </Text>
      <Text size="xs" c="dimmed" mb="md">
        Focus areas are automatically selected by the algorithm based on your performance. Start a practice session to see them.
      </Text>
    </Card>
  );
}