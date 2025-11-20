/**
 * Shared header component for recalibration modals
 *
 * Displays: Icon, Title, and Days Away Badge
 */

import React from "react";
import { Stack, Title, Badge } from "@mantine/core";
import {
  getRecalibrationIcon,
  formatDaysAway,
  getRecalibrationTitle,
  getRecalibrationBadgeColor,
} from "../../../shared/utils/recalibrationHelpers";

export function RecalModalHeader({ strategy }) {
  const { type, daysSinceLastUse } = strategy;

  return (
    <Stack spacing="md" align="center">
      {getRecalibrationIcon(daysSinceLastUse)}

      <Stack spacing="sm" align="center">
        <Title order={2} ta="center">
          {getRecalibrationTitle(type)}
        </Title>
        <Badge
          size="lg"
          variant="light"
          color={getRecalibrationBadgeColor(type)}
        >
          {formatDaysAway(daysSinceLastUse)} away
        </Badge>
      </Stack>
    </Stack>
  );
}
