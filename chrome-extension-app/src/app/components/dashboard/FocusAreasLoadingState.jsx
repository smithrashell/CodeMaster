import React from "react";
import { Card, Group, Text } from "@mantine/core";
import { IconTarget } from "@tabler/icons-react";

export function FocusAreasLoadingState() {
  return (
    <Card withBorder>
      <Group gap="xs" mb="xs">
        <IconTarget size={16} />
        <Text size="sm" fw={500}>Focus Areas</Text>
      </Group>
      <Text size="sm">Loading...</Text>
    </Card>
  );
}