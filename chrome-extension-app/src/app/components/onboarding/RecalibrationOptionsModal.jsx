/**
 * Recalibration Options Modal (90+ days away)
 *
 * Allows user to choose recalibration approach:
 * - Moderate: 2 options (adaptive session, diagnostic)
 * - Major: 3 options (diagnostic, adaptive session, reset)
 */

import React, { useState } from "react";
import {
  Modal,
  Button,
  Stack,
  Text,
  Group,
  Alert,
  Radio,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconRocket,
} from "@tabler/icons-react";
import { RecalModalHeader } from "./RecalModalHeader";
import { RecalibrationOptionCard } from "./RecalibrationOptionCard";
import { useTheme } from "../../../shared/provider/themeprovider";

export function RecalibrationOptionsModal({ opened, onClose, strategy, onConfirm }) {
  const [selectedApproach, setSelectedApproach] = useState(
    strategy?.recommendation || strategy?.approach || null
  );
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';

  const handleConfirm = () => {
    onConfirm(selectedApproach);
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="lg"
      centered
      withCloseButton={false}
      padding="xl"
      styles={{
        modal: {
          backgroundColor: isDark ? '#1a1b1e' : '#ffffff',
          color: isDark ? '#ffffff' : '#000000',
          maxHeight: "90vh",
          overflow: "auto"
        },
        body: {
          color: isDark ? '#ffffff' : '#000000',
        },
      }}
    >
      <Stack spacing="xl">
        <Stack spacing="md" align="center">
          <RecalModalHeader strategy={strategy} />

          <Text size="md" ta="center" maw={450} c={isDark ? '#c1c2c5' : 'dimmed'}>
            {strategy.message}
          </Text>
        </Stack>

        {strategy.type === 'major_recal' && (
          <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
            <Text size="sm">
              We&apos;ve applied passive decay to your box levels and stability scores based on time elapsed.
              Choose how you&apos;d like to recalibrate for the best learning experience.
            </Text>
          </Alert>
        )}

        <Stack spacing="sm">
          <Text fw={500} size="sm">Choose your approach:</Text>

          <Radio.Group value={selectedApproach} onChange={setSelectedApproach}>
            <Stack spacing="sm">
              {strategy.options.map((option) => (
                <RecalibrationOptionCard
                  key={option.value}
                  option={option}
                  isSelected={selectedApproach === option.value}
                  onClick={() => setSelectedApproach(option.value)}
                  isDark={isDark}
                />
              ))}
            </Stack>
          </Radio.Group>
        </Stack>

        <Group position="apart" mt="md">
          <Button variant="subtle" onClick={onClose}>
            Maybe Later
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedApproach}
            size="md"
            leftSection={<IconRocket size={16} />}
          >
            {selectedApproach === 'diagnostic' ? 'Start Assessment' : 'Continue'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
