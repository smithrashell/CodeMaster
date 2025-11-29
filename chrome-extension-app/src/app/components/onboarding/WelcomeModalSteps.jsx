import React from "react";
import {
  Text,
  Stack,
  Card,
  SimpleGrid,
  Center,
  ThemeIcon,
  List,
  Group,
} from "@mantine/core";
import {
  IconGauge,
  IconDeviceDesktopAnalytics,
  IconClock,
  IconCards,
  IconCheck,
  IconChartBar,
  IconTarget,
  IconRefresh,
} from "@tabler/icons-react";
import { BrainIcon } from "../../../shared/components/ui/Icons";
import { useTheme } from "../../../shared/provider/themeprovider.jsx";

export function WelcomeStep() {
  return (
    <Stack spacing="xl" align="center">
      <Center>
        <ThemeIcon
          size={120}
          radius="xl"
          variant="gradient"
          gradient={{ from: "blue", to: "purple" }}
        >
          <BrainIcon style={{ width: 60, height: 60 }} />
        </ThemeIcon>
      </Center>

      <Stack spacing="md" align="center">
        <Text size="lg" color="dimmed" ta="center" maw={400}>
          Stop grinding LeetCode blindly. CodeMaster is fine tuned to create
          personalized learning paths that adapt to your progress.
        </Text>

        <Card withBorder p="md" maw={500}>
          <Stack spacing="xs">
            <Text fw={500} size="sm">
              🎯 What makes CodeMaster different:
            </Text>
            <List size="sm" spacing="xs">
              <List.Item>
                Adaptive sessions that learn from your mistakes
              </List.Item>
              <List.Item>
                Pattern ladder progression to build strong foundations
              </List.Item>
              <List.Item>Pattern recognition training for interviews</List.Item>
              <List.Item>Real-time strategy hints and explanations</List.Item>
            </List>
          </Stack>
        </Card>
      </Stack>
    </Stack>
  );
}

export function FeaturesStep() {
  const features = [
    {
      icon: IconGauge,
      title: "Dashboard",
      description: "Track your progress, view statistics, and monitor learning goals",
      color: "blue",
    },
    {
      icon: IconDeviceDesktopAnalytics,
      title: "Analytics",
      description: "Deep insights into your problem-solving patterns and improvement areas",
      color: "green",
    },
    {
      icon: IconClock,
      title: "Sessions",
      description: "Adaptive practice sessions that adjust to your skill level",
      color: "orange",
    },
    {
      icon: IconCards,
      title: "Review",
      description: "Pattern recognition training through problem categorization and analysis",
      color: "purple",
    },
  ];

  return (
    <Stack spacing="lg">
      <Text ta="center" color="dimmed">
        CodeMaster organizes your learning into four main areas:
      </Text>

      <SimpleGrid cols={2} spacing="md">
        {features.map((feature) => (
          <Card key={feature.title} withBorder p="md" h={120}>
            <Group spacing="sm" h="100%">
              <ThemeIcon size={40} radius="md" color={feature.color} variant="light">
                <feature.icon size={20} />
              </ThemeIcon>
              <Stack spacing={4} style={{ flex: 1 }}>
                <Text fw={500} size="sm">{feature.title}</Text>
                <Text size="xs" color="dimmed">{feature.description}</Text>
              </Stack>
            </Group>
          </Card>
        ))}
      </SimpleGrid>

      <Text size="sm" ta="center" color="dimmed">
        Each section adapts to your learning style and progress level
      </Text>
    </Stack>
  );
}

export function DashboardStep() {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';

  return (
    <Stack spacing="md">
      <Text ta="center" color="dimmed" size="sm">
        Your dashboard drives your personalized learning experience:
      </Text>

      <Stack spacing="sm">
        <Card withBorder p="sm">
          <Group spacing="sm" align="flex-start">
            <ThemeIcon size={32} radius="md" color="orange" variant="light">
              <IconTarget size={16} />
            </ThemeIcon>
            <Stack spacing={2} style={{ flex: 1 }}>
              <Text fw={500} size="sm">Focus Areas & Session Creation</Text>
              <Text size="xs" color="dimmed">
                Your focus areas automatically determine which problems appear in your next session.
                Struggling with arrays? You&apos;ll get more array problems.
              </Text>
            </Stack>
          </Group>
        </Card>

        <Card withBorder p="sm">
          <Group spacing="sm" align="flex-start">
            <ThemeIcon size={32} radius="md" color="blue" variant="light">
              <IconChartBar size={16} />
            </ThemeIcon>
            <Stack spacing={2} style={{ flex: 1 }}>
              <Text fw={500} size="sm">Performance Metrics</Text>
              <Text size="xs" color="dimmed">
                Success rates and timing data help CodeMaster adjust difficulty.
              </Text>
            </Stack>
          </Group>
        </Card>

        <Card withBorder p="sm">
          <Group spacing="sm" align="flex-start">
            <ThemeIcon size={32} radius="md" color="green" variant="light">
              <IconRefresh size={16} />
            </ThemeIcon>
            <Stack spacing={2} style={{ flex: 1 }}>
              <Text fw={500} size="sm">Adaptive Learning</Text>
              <Text size="xs" color="dimmed">
                Every problem you complete updates your dashboard, which improves future recommendations.
              </Text>
            </Stack>
          </Group>
        </Card>
      </Stack>

      <Card withBorder p="sm" style={{ backgroundColor: isDark ? '#1e3a8a' : '#e7f5ff' }}>
        <Stack spacing={4}>
          <Text fw={500} size="sm" ta="center" color="blue">💡 Key Insight</Text>
          <Text size="xs" ta="center" c={isDark ? '#93c5fd' : 'blue'}>
            Your dashboard isn&apos;t just for tracking - it&apos;s the brain that personalizes every session.
          </Text>
        </Stack>
      </Card>
    </Stack>
  );
}

export function SessionStep() {
  const steps = [
    { num: 1, color: "blue", title: "Assessment", desc: "We'll start with a few problems to understand your current level" },
    { num: 2, color: "green", title: "Adaptive Selection", desc: "Problems are chosen based on your strengths and learning gaps" },
    { num: 3, color: "orange", title: "Smart Hints", desc: "Get contextual hints and strategy guidance when you're stuck" },
    { num: 4, color: "purple", title: "Progress Tracking", desc: "Your performance informs future sessions and review scheduling" },
  ];

  return (
    <Stack spacing="lg">
      <Text ta="center" color="dimmed">
        Here&apos;s how your first adaptive session will work:
      </Text>

      <Stack spacing="md">
        {steps.map(({ num, color, title, desc }) => (
          <Card key={num} withBorder p="md">
            <Group spacing="md">
              <ThemeIcon size={30} radius="xl" color={color} variant="light">
                <Text size="sm" fw={700}>{num}</Text>
              </ThemeIcon>
              <Stack spacing={4} style={{ flex: 1 }}>
                <Text fw={500} size="sm">{title}</Text>
                <Text size="xs" color="dimmed">{desc}</Text>
              </Stack>
            </Group>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}

export function CompletionStep() {
  return (
    <Stack spacing="xl" align="center">
      <Center>
        <ThemeIcon size={100} radius="xl" color="green" variant="light">
          <IconCheck size={50} />
        </ThemeIcon>
      </Center>

      <Stack spacing="md" align="center">
        <Text size="lg" ta="center" maw={400}>
          You&apos;re all set! Your personalized learning journey starts now.
        </Text>

        <Card withBorder p="md" maw={450}>
          <Stack spacing="sm">
            <Text fw={500} size="sm" ta="center">💡 Pro Tips for Success:</Text>
            <List size="sm" spacing="xs">
              <List.Item>Practice consistently - even 15 minutes daily helps</List.Item>
              <List.Item>Review solved problems to reinforce learned patterns</List.Item>
              <List.Item>Use hints strategically to learn new patterns</List.Item>
              <List.Item>Check your analytics to identify improvement areas</List.Item>
            </List>
          </Stack>
        </Card>

        <Text size="sm" color="dimmed" ta="center">
          Ready to start your first adaptive session?
        </Text>
      </Stack>
    </Stack>
  );
}
