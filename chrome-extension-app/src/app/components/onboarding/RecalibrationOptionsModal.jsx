/**
 * Recalibration Options Modal (90+ days away)
 *
 * Allows user to choose recalibration approach:
 * - Moderate: 2 options (adaptive session, diagnostic)
 * - Major: 3 options (diagnostic, adaptive session, reset)
 */

import { useState } from "react";
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

export function RecalibrationOptionsModal({ opened, onClose, strategy, onConfirm }) {
  const [selectedApproach, setSelectedApproach] = useState(
    strategy?.recommendation || strategy?.approach || null
  );

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
          backgroundColor: 'var(--cm-modal-bg)',
          color: 'var(--cm-modal-text)',
          maxHeight: "90vh",
          overflow: "auto"
        },
        body: {
          color: 'var(--cm-modal-text)',
        },
      }}
    >
      <Stack spacing="xl">
        <Stack spacing="md" align="center">
          <RecalModalHeader strategy={strategy} />

          <Text size="md" ta="center" maw={450} c="var(--cm-modal-dimmed)">
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
