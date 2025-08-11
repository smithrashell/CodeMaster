import React from "react";
import { Card, Stack, Text, Button, Center, ThemeIcon } from "@mantine/core";
import {
  IconBrain,
  IconChartBar,
  IconClock,
  IconCards,
} from "@tabler/icons-react";

const EMPTY_STATE_CONFIGS = {
  dashboard: {
    icon: IconChartBar,
    title: "Welcome to Your Dashboard",
    description:
      "Your progress statistics will appear here once you complete your first session.",
    action: "Start First Session",
    color: "blue",
  },
  analytics: {
    icon: IconBrain,
    title: "No Analytics Data Yet",
    description:
      "Complete a few problems to see detailed analytics about your learning patterns.",
    action: "Begin Practice",
    color: "green",
  },
  sessions: {
    icon: IconClock,
    title: "No Sessions Completed",
    description:
      "Start your first adaptive session to track your practice time and progress.",
    action: "Create Session",
    color: "orange",
  },
  flashcards: {
    icon: IconCards,
    title: "No Review Cards Available",
    description:
      "Practice some problems to generate personalized review flashcards.",
    action: "Start Practicing",
    color: "purple",
  },
};

export function EmptyStateCard({
  type = "dashboard",
  onAction,
  actionProps = {},
}) {
  const config = EMPTY_STATE_CONFIGS[type];

  if (!config) {
    return null;
  }

  return (
    <Card withBorder p="xl" mih={300}>
      <Center h="100%">
        <Stack spacing="lg" align="center" maw={400}>
          <ThemeIcon size={80} radius="xl" color={config.color} variant="light">
            <config.icon size={40} />
          </ThemeIcon>

          <Stack spacing="sm" align="center">
            <Text fw={600} size="lg" ta="center">
              {config.title}
            </Text>
            <Text color="dimmed" ta="center" size="sm">
              {config.description}
            </Text>
          </Stack>

          {onAction && (
            <Button
              variant="light"
              color={config.color}
              onClick={onAction}
              {...actionProps}
            >
              {config.action}
            </Button>
          )}
        </Stack>
      </Center>
    </Card>
  );
}
