import React, { useState } from "react";
import {
  Modal,
  Button,
  Group,
  Text,
  Title,
  Stack,
  Progress,
} from "@mantine/core";
import {
  IconChevronRight,
  IconChevronLeft,
  IconCheck,
} from "@tabler/icons-react";
import {
  WelcomeStep,
  FeaturesStep,
  DashboardStep,
  SessionStep,
  CompletionStep
} from "./WelcomeModalSteps.jsx";

const ONBOARDING_STEPS = [
  { title: "Welcome to CodeMaster", subtitle: "Your data structures and algorithms personal trainer", content: "WelcomeStep" },
  { title: "Discover Core Features", subtitle: "Everything you need to master algorithms", content: "FeaturesStep" },
  { title: "Your Dashboard", subtitle: "Understanding your progress and analytics", content: "DashboardStep" },
  { title: "Your First Session", subtitle: "See how adaptive learning works", content: "SessionStep" },
  { title: "Ready to Begin", subtitle: "Let's start your coding journey", content: "CompletionStep" },
];

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
          backgroundColor: 'var(--cm-modal-bg)',
          color: 'var(--cm-modal-text)',
        },
        body: {
          color: 'var(--cm-modal-text)',
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
