/**
 * Gentle Recalibration Modal (30-90 days away)
 *
 * Simple welcome message with auto-applied adjustments
 * No user choices - just Continue button
 */

import React from "react";
import { Modal, Button, Stack, Text, Card, Group, ThemeIcon } from "@mantine/core";
import { IconTarget } from "@tabler/icons-react";
import { RecalModalHeader } from "./RecalModalHeader";
import { useTheme } from "../../../shared/provider/themeprovider";

export function GentleRecalModal({ opened, onClose, strategy, onConfirm }) {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';

  const handleConfirm = () => {
    onConfirm(strategy.recommendation || strategy.approach);
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="md"
      centered
      withCloseButton={false}
      padding="xl"
      styles={{
        modal: {
          backgroundColor: isDark ? '#1a1b1e' : '#ffffff',
          color: isDark ? '#ffffff' : '#000000',
        },
        body: {
          color: isDark ? '#ffffff' : '#000000',
        },
      }}
    >
      <Stack spacing="xl" align="center">
        <RecalModalHeader strategy={strategy} />

        <Text size="md" ta="center" maw={400} c={isDark ? '#c1c2c5' : 'dimmed'}>
          {strategy.message}
        </Text>

        <Card
          withBorder
          p="md"
          style={{
            backgroundColor: isDark ? '#1e3a8a' : '#e7f5ff',
            width: '100%'
          }}
        >
          <Group spacing="sm">
            <ThemeIcon size={32} radius="md" color="blue" variant="light">
              <IconTarget size={16} />
            </ThemeIcon>
            <Stack spacing={2} style={{ flex: 1 }}>
              <Text fw={500} size="sm">What to expect</Text>
              <Text size="xs" c={isDark ? '#93c5fd' : 'blue'}>
                We&apos;ve already applied some gentle adjustments to your learning path.
                Your next session will adapt in real-time to help us recalibrate your current level.
              </Text>
            </Stack>
          </Group>
        </Card>

        <Button fullWidth onClick={handleConfirm} size="md">
          Continue
        </Button>
      </Stack>
    </Modal>
  );
}
