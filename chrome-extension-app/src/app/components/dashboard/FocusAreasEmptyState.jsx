import React from "react";
import { Card, Group, Text, Button } from "@mantine/core";
import { IconTarget, IconSettings } from "@tabler/icons-react";

export function FocusAreasEmptyState({ onNavigateToSettings }) {
  return (
    <Card withBorder>
      <Group gap="xs" mb="xs">
        <IconTarget size={16} />
        <Text size="sm" fw={500}>Current Focus Areas</Text>
      </Group>
      <Text size="sm" mb="xs">
        No active session focus
      </Text>
      <Text size="xs" mb="md">
        Start a practice session to see current focus areas, or configure focus areas for your next session
      </Text>
      {onNavigateToSettings && (
        <Button
          size="xs"
          variant="light"
          leftSection={<IconSettings size={14} />}
          onClick={onNavigateToSettings}
          styles={{
            root: {
              color: 'white',
            }
          }}
        >
          Set Focus for Next Session
        </Button>
      )}
    </Card>
  );
}