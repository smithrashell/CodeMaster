/**
 * Individual tier panel component for tier visualization tabs
 */
import React from "react";
import { Alert, Text, Stack, Group, Card } from "@mantine/core";
import { getTierDescription } from "./tierHelpers.js";

export function TierPanel({
  tierKey,
  tagsByTier,
  isViewingDifferentTier,
  currentActiveTab,
  selectedFocusAreas,
  selectedTier,
  renderTagBadge,
  backgroundColor
}) {
  const tierDescription = getTierDescription(tierKey);
  const tagsForTier = tagsByTier[tierKey] || [];

  return (
    <Stack gap="sm">
      {isViewingDifferentTier && currentActiveTab === tierKey && (
        <Alert color="yellow" variant="light">
          <Text size="xs">
            You have {selectedFocusAreas.length} tag(s) selected from <strong>{getTierDescription(selectedTier).title}</strong>.
            Selecting a tag here will clear your previous selection.
          </Text>
        </Alert>
      )}
      <Card withBorder p="xs" style={{ backgroundColor }}>
        <Stack gap={4}>
          <Text size="xs" fw={500}>{tierDescription.subtitle}</Text>
          <Text size="xs" c="dimmed">📊 {tierDescription.difficulty}</Text>
          <Text size="xs" c="dimmed">🎯 {tierDescription.pool}</Text>
        </Stack>
      </Card>
      <Group gap="xs">
        {tagsForTier.length > 0 ? (
          tagsForTier.map(tag => renderTagBadge(tag, tierKey))
        ) : (
          <Text size="sm" c="dimmed">No tags in this tier</Text>
        )}
      </Group>
    </Stack>
  );
}
