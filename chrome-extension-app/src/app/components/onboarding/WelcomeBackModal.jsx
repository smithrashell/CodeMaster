import React, { useState } from "react";
import {
  Modal,
  Button,
  Group,
  Text,
  Title,
  Stack,
  Card,
  ThemeIcon,
  Badge,
  Radio,
  Alert,
} from "@mantine/core";
import {
  IconRefresh,
  IconTrendingDown,
  IconAlertCircle,
  IconRocket,
  IconTarget,
  IconReload,
} from "@tabler/icons-react";
import { useTheme } from "../../../shared/provider/themeprovider.jsx";

/**
 * WelcomeBackModal - Phase 2: Smart Welcome Back Flow
 *
 * Shows contextual message based on usage gap duration.
 * Gives users options for recalibration approach.
 *
 * Strategy types:
 * - gentle_recal: 30-90 days away (simple message, auto-applies adaptive session)
 * - moderate_recal: 90-365 days (offers 2 choices)
 * - major_recal: 365+ days (offers 3 choices with strong diagnostic recommendation)
 */
export function WelcomeBackModal({ opened, onClose, strategy, onConfirm }) {
  const [selectedApproach, setSelectedApproach] = useState(
    strategy?.recommendation || strategy?.approach || null
  );
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';

  if (!strategy || strategy.type === 'normal') {
    return null;
  }

  const handleConfirm = () => {
    onConfirm(selectedApproach);
  };

  const renderIcon = () => {
    if (strategy.daysSinceLastUse >= 365) {
      return (
        <ThemeIcon size={80} radius="xl" variant="gradient" gradient={{ from: "orange", to: "red" }}>
          <IconTrendingDown size={40} />
        </ThemeIcon>
      );
    }
    if (strategy.daysSinceLastUse >= 90) {
      return (
        <ThemeIcon size={80} radius="xl" variant="gradient" gradient={{ from: "blue", to: "purple" }}>
          <IconRefresh size={40} />
        </ThemeIcon>
      );
    }
    return (
      <ThemeIcon size={80} radius="xl" variant="gradient" gradient={{ from: "teal", to: "lime" }}>
        <IconRocket size={40} />
      </ThemeIcon>
    );
  };

  const getDaysText = (days) => {
    if (days >= 365) {
      const years = Math.floor(days / 365);
      const months = Math.floor((days % 365) / 30);
      return months > 0 ? `${years} year${years > 1 ? 's' : ''}, ${months} month${months > 1 ? 's' : ''}` : `${years} year${years > 1 ? 's' : ''}`;
    }
    if (days >= 30) {
      const months = Math.floor(days / 30);
      return `${months} month${months > 1 ? 's' : ''}`;
    }
    return `${days} day${days > 1 ? 's' : ''}`;
  };

  // Gentle recalibration: Just a simple message with OK button
  if (strategy.type === 'gentle_recal') {
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
          {renderIcon()}

          <Stack spacing="sm" align="center">
            <Title order={2} ta="center">
              Welcome Back!
            </Title>
            <Badge size="lg" variant="light" color="blue">
              {getDaysText(strategy.daysSinceLastUse)} away
            </Badge>
          </Stack>

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

  // Moderate or major recalibration: Show options
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
          {renderIcon()}

          <Stack spacing="sm" align="center">
            <Title order={2} ta="center">
              {strategy.type === 'major_recal' ? "Long Time, No See!" : "Welcome Back!"}
            </Title>
            <Badge size="lg" variant="light" color={strategy.type === 'major_recal' ? 'orange' : 'blue'}>
              {getDaysText(strategy.daysSinceLastUse)} away
            </Badge>
          </Stack>

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
                <Card
                  key={option.value}
                  withBorder
                  p="md"
                  style={{
                    cursor: 'pointer',
                    borderColor: selectedApproach === option.value
                      ? (isDark ? '#4c8bf5' : '#3b82f6')
                      : undefined,
                    borderWidth: selectedApproach === option.value ? 2 : 1,
                    backgroundColor: selectedApproach === option.value
                      ? (isDark ? '#1e3a8a' : '#dbeafe')
                      : undefined
                  }}
                  onClick={() => setSelectedApproach(option.value)}
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

                      <Text size="xs" c={isDark ? '#a6a7ab' : 'dimmed'}>
                        {option.description}
                      </Text>

                      {option.warning && (
                        <Alert icon={<IconAlertCircle size={14} />} color="orange" variant="light" p="xs" mt="xs">
                          <Text size="xs">{option.warning}</Text>
                        </Alert>
                      )}
                    </Stack>

                    {option.value === 'diagnostic' && (
                      <ThemeIcon size={36} radius="md" color="blue" variant="light">
                        <IconTarget size={18} />
                      </ThemeIcon>
                    )}
                    {option.value === 'reset' && (
                      <ThemeIcon size={36} radius="md" color="orange" variant="light">
                        <IconReload size={18} />
                      </ThemeIcon>
                    )}
                    {option.value === 'adaptive_first_session' && (
                      <ThemeIcon size={36} radius="md" color="purple" variant="light">
                        <IconRocket size={18} />
                      </ThemeIcon>
                    )}
                  </Group>
                </Card>
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
