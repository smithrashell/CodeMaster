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
} from "@tabler/icons-react";
import { BrainIcon } from "../../../shared/components/ui/Icons";

const ONBOARDING_STEPS = [
  {
    title: "Welcome to CodeMaster",
    subtitle: "Your AI-powered coding companion",
    content: "WelcomeStep",
  },
  {
    title: "Discover Core Features",
    subtitle: "Everything you need to master algorithms",
    content: "FeaturesStep",
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
          Stop grinding LeetCode blindly. CodeMaster uses AI to create
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
                Spaced repetition to ensure long-term retention
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
        "Spaced repetition flashcards for algorithm patterns and concepts",
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
                Don&apos;t skip the review sessions - they boost retention
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
            rightIcon={
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
