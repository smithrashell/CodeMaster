/**
 * Tier description header component
 */
import React from "react";
import { Text, Stack, Group } from "@mantine/core";

export function TierDescriptionHeader({ description }) {
  return (
    <Stack spacing="xs" mb="md">
      <Group spacing="xs" align="center">
        <Text size="xl">{description.icon}</Text>
        <div>
          <Text size="lg" weight={600}>{description.title}</Text>
          <Text size="sm" color="dimmed">{description.subtitle}</Text>
        </div>
      </Group>
      <Stack spacing={4}>
        <Text size="sm">
          <strong>Difficulty:</strong> {description.difficulty}
        </Text>
        <Text size="sm">
          <strong>Problem Pool:</strong> {description.pool}
        </Text>
      </Stack>
    </Stack>
  );
}
