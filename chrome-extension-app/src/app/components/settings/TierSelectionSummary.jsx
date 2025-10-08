/**
 * Summary alert showing current tier selection
 */
import React from "react";
import { Alert, Text, Stack } from "@mantine/core";
import { getTierDescription } from "./tierHelpers.js";

export function TierSelectionSummary({ selectedFocusAreas, selectedTier }) {
  if (selectedFocusAreas.length === 0 || !selectedTier) {
    return null;
  }

  const tierDescription = getTierDescription(selectedTier);

  return (
    <Alert color="blue" variant="light">
      <Stack gap={4}>
        <Text size="xs" fw={500}>
          Selected: {selectedFocusAreas.length}/3 tags from {tierDescription.title}
        </Text>
        <Text size="xs">
          Your sessions will focus on {selectedFocusAreas.join(', ')} with {tierDescription.difficulty.toLowerCase()}
        </Text>
      </Stack>
    </Alert>
  );
}
