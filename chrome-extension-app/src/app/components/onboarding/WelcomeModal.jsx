import React, { useState } from "react";
import {
  Modal,
  Button,
  Group,
  Text,
  Title,
  Stack,
  Progress,
  Card,
  SimpleGrid,
  Center,
  ThemeIcon,
  List,
} from "@mantine/core";
import {
  IconGauge,
  IconDeviceDesktopAnalytics,
  IconClock,
  IconCards,
  IconChevronRight,
  IconChevronLeft,
  IconCheck,
  IconChartBar,
  IconTarget,
  IconRefresh,
} from "@tabler/icons-react";
import { BrainIcon } from "../../../shared/components/ui/Icons";

const ONBOARDING_STEPS = [
  {
    title: "Welcome to CodeMaster",
    subtitle: "Your data stuctures and algorthims personal trainer ",
    content: "WelcomeStep",
  },
  {
    title: "Discover Core Features",
    subtitle: "Everything you need to master algorithms",
    content: "FeaturesStep",
  },
  {
    title: "Your Dashboard",
    subtitle: "Understanding your progress and analytics",
    content: "DashboardStep",
  },
  {
    title: "Your First Session",
    subtitle: "See how adaptive learning works",
    content: "SessionStep",
  },
  {
    title: "Ready to Begin",
    subtitle: "Let's start your coding journey",
    content: "CompletionStep",
  },
];

function WelcomeStep() {
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

function FeaturesStep() {
  const features = [
    {
      icon: IconGauge,
      title: "Dashboard",
      description:
        "Track your progress, view statistics, and monitor learning goals",
      color: "blue",
    },
    {
      icon: IconDeviceDesktopAnalytics,
      title: "Analytics",
      description:
        "Deep insights into your problem-solving patterns and improvement areas",
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
      description:
        "Pattern recognition training through problem categorization and analysis",
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
              <ThemeIcon
                size={40}
                radius="md"
                color={feature.color}
                variant="light"
              >
                <feature.icon size={20} />
              </ThemeIcon>
              <Stack spacing={4} style={{ flex: 1 }}>
                <Text fw={500} size="sm">
                  {feature.title}
                </Text>
                <Text size="xs" color="dimmed">
                  {feature.description}
                </Text>
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

function DashboardStep() {
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
                Struggling with arrays? You&apos;ll get more array problems. Mastered trees? Less tree practice, more variety.
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
                High success rate = harder problems. Slow solving time = more practice at that level.
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
                Every problem you complete updates your dashboard, which immediately improves 
                future session recommendations. It&apos;s a continuous learning loop.
              </Text>
            </Stack>
          </Group>
        </Card>
      </Stack>

      <Card withBorder p="sm" style={{ backgroundColor: 'var(--mantine-color-blue-0, #e7f5ff)' }}>
        <Stack spacing={4}>
          <Text fw={500} size="sm" ta="center" color="blue">
            💡 Key Insight
          </Text>
          <Text size="xs" ta="center" color="blue">
            Your dashboard isn&apos;t just for tracking - it&apos;s the brain that personalizes every session. 
            The more you practice, the smarter your recommendations become!
          </Text>
        </Stack>
      </Card>
    </Stack>
  );
}

function SessionStep() {
  return (
    <Stack spacing="lg">
      <Text ta="center" color="dimmed">
        Here&apos;s how your first adaptive session will work:
      </Text>

      <Stack spacing="md">
        <Card withBorder p="md">
          <Group spacing="md">
            <ThemeIcon size={30} radius="xl" color="blue" variant="light">
              <Text size="sm" fw={700}>
                1
              </Text>
            </ThemeIcon>
            <Stack spacing={4} style={{ flex: 1 }}>
              <Text fw={500} size="sm">
                Assessment
              </Text>
              <Text size="xs" color="dimmed">
                We&apos;ll start with a few problems to understand your current
                level
              </Text>
            </Stack>
          </Group>
        </Card>

        <Card withBorder p="md">
          <Group spacing="md">
            <ThemeIcon size={30} radius="xl" color="green" variant="light">
              <Text size="sm" fw={700}>
                2
              </Text>
            </ThemeIcon>
            <Stack spacing={4} style={{ flex: 1 }}>
              <Text fw={500} size="sm">
                Adaptive Selection
              </Text>
              <Text size="xs" color="dimmed">
                Problems are chosen based on your strengths and learning gaps
              </Text>
            </Stack>
          </Group>
        </Card>

        <Card withBorder p="md">
          <Group spacing="md">
            <ThemeIcon size={30} radius="xl" color="orange" variant="light">
              <Text size="sm" fw={700}>
                3
              </Text>
            </ThemeIcon>
            <Stack spacing={4} style={{ flex: 1 }}>
              <Text fw={500} size="sm">
                Smart Hints
              </Text>
              <Text size="xs" color="dimmed">
                Get contextual hints and strategy guidance when you&apos;re
                stuck
              </Text>
            </Stack>
          </Group>
        </Card>

        <Card withBorder p="md">
          <Group spacing="md">
            <ThemeIcon size={30} radius="xl" color="purple" variant="light">
              <Text size="sm" fw={700}>
                4
              </Text>
            </ThemeIcon>
            <Stack spacing={4} style={{ flex: 1 }}>
              <Text fw={500} size="sm">
                Progress Tracking
              </Text>
              <Text size="xs" color="dimmed">
                Your performance informs future sessions and review scheduling
              </Text>
            </Stack>
          </Group>
        </Card>
      </Stack>
    </Stack>
  );
}

function CompletionStep() {
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
            <Text fw={500} size="sm" ta="center">
              💡 Pro Tips for Success:
            </Text>
            <List size="sm" spacing="xs">
              <List.Item>
                Practice consistently - even 15 minutes daily helps
              </List.Item>
              <List.Item>
                Review solved problems to reinforce learned patterns
              </List.Item>
              <List.Item>
                Use hints strategically to learn new patterns
              </List.Item>
              <List.Item>
                Check your analytics to identify improvement areas
              </List.Item>
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

export function WelcomeModal({ opened, onClose, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const currentStepData = ONBOARDING_STEPS[currentStep];
  const progressValue = ((currentStep + 1) / ONBOARDING_STEPS.length) * 100;

  const renderStepContent = () => {
    switch (currentStepData.content) {
      case "WelcomeStep":
        return <WelcomeStep />;
      case "FeaturesStep":
        return <FeaturesStep />;
      case "DashboardStep":
        return <DashboardStep />;
      case "SessionStep":
        return <SessionStep />;
      case "CompletionStep":
        return <CompletionStep />;
      default:
        return null;
    }
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
          maxHeight: "90vh",
          overflow: "auto",
        },
      }}
    >
      <Stack spacing="xl">
        <Stack spacing="xs">
          <Progress value={progressValue} size="sm" />
          <Group position="apart">
            <Text size="xs" color="dimmed">
              Step {currentStep + 1} of {ONBOARDING_STEPS.length}
            </Text>
            <Text size="xs" color="dimmed">
              {Math.round(progressValue)}% complete
            </Text>
          </Group>
        </Stack>

        <Stack spacing="md" align="center">
          <Title order={2} ta="center">
            {currentStepData.title}
          </Title>
          <Text color="dimmed" ta="center">
            {currentStepData.subtitle}
          </Text>
        </Stack>

        {renderStepContent()}

        <Group position="apart" mt="xl">
          <Button
            variant="subtle"
            leftSection={<IconChevronLeft size={16} />}
            onClick={handlePrevious}
            disabled={currentStep === 0}
          >
            Previous
          </Button>

          <Button
            rightSection={
              currentStep === ONBOARDING_STEPS.length - 1 ? (
                <IconCheck size={16} />
              ) : (
                <IconChevronRight size={16} />
              )
            }
            onClick={handleNext}
          >
            {currentStep === ONBOARDING_STEPS.length - 1
              ? "Get Started"
              : "Next"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
