/**
 * Individual option card for recalibration modal
 *
 * Displays a single recalibration option with:
 * - Radio button
 * - Label, time estimate, badges
 * - Description
 * - Optional warning
 * - Icon
 */

import React from "react";
import {
  Card,
  Group,
  Radio,
  Stack,
  Text,
  Badge,
  Alert,
  ThemeIcon,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconTarget,
  IconReload,
  IconRocket,
} from "@tabler/icons-react";

// Get icon for each option type
function getOptionIcon(optionValue) {
  switch (optionValue) {
    case 'diagnostic':
      return <IconTarget size={18} />;
    case 'reset':
      return <IconReload size={18} />;
    case 'adaptive_first_session':
      return <IconRocket size={18} />;
    default:
      return null;
  }
}

// Get icon color based on option type
function getIconColor(optionValue) {
  switch (optionValue) {
    case 'reset':
      return 'orange';
    case 'diagnostic':
      return 'blue';
    default:
      return 'purple';
  }
}

export function RecalibrationOptionCard({ option, isSelected, onClick }) {
  return (
    <Card
      key={option.value}
      withBorder
      p="md"
      style={{
        cursor: 'pointer',
        borderColor: isSelected ? 'var(--cm-accent)' : undefined,
        borderWidth: isSelected ? 2 : 1,
        backgroundColor: isSelected ? 'var(--cm-accent-bg)' : undefined
      }}
      onClick={onClick}
    >
      <Group spacing="md" align="flex-start">
        <Radio
          value={option.value}
          styles={{ radio: { cursor: 'pointer' } }}
        />

        <Stack spacing={4} style={{ flex: 1 }}>
          <Group spacing="xs">
            <Text fw={500} size="sm">{option.label}</Text>
            {option.recommended && (
              <Badge size="sm" variant="filled" color="green">
                Recommended
              </Badge>
            )}
            <Badge size="sm" variant="light" color="gray">
              {option.time}
            </Badge>
          </Group>

          <Text size="xs" c="var(--cm-modal-dimmed)">
            {option.description}
          </Text>

          {option.warning && (
            <Alert icon={<IconAlertCircle size={14} />} color="orange" variant="light" p="xs" mt="xs">
              <Text size="xs">{option.warning}</Text>
            </Alert>
          )}
        </Stack>

        {getOptionIcon(option.value) && (
          <ThemeIcon
            size={36}
            radius="md"
            color={getIconColor(option.value)}
            variant="light"
          >
            {getOptionIcon(option.value)}
          </ThemeIcon>
        )}
      </Group>
    </Card>
  );
}
