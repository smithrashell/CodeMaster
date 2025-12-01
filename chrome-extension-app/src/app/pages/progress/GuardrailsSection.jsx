import { Card, Title, Group, Stack, Text, Select, Badge, Alert } from "@mantine/core";
import { IconShield, IconInfoCircle } from "@tabler/icons-react";
import SessionLimits from "../../../shared/utils/session/sessionLimits.js";
import { useEffect } from "react";

const SECTION_HEIGHT = 700;

/**
 * Generate dynamic options for max new problems based on session length
 * Ensures max new problems cannot exceed total session length
 */
function getMaxNewProblemsOptions(sessionLength, isOnboarding) {
  // During onboarding, limit to 2-4 problems regardless of session length
  if (isOnboarding) {
    return [
      { value: "2", label: "2 problems" },
      { value: "3", label: "3 problems" },
      { value: "4", label: "4 problems" }
    ];
  }

  // Normalize "auto" mode to actual session length value
  const effectiveSessionLength = sessionLength === "auto" ? 5 : sessionLength;

  // Generate options from 2 to session length
  const options = [];
  for (let i = 2; i <= effectiveSessionLength; i++) {
    options.push({ value: i.toString(), label: `${i} problems` });
  }

  return options;
}

export function GuardrailsSection({
  guardrails,
  sessionLength,
  isOnboarding,
  onGuardrailChange
}) {
  // Auto-adjust max new problems if it exceeds session length
  useEffect(() => {
    const effectiveSessionLength = sessionLength === "auto" ? 5 : sessionLength;

    if (guardrails.maxNewProblems > effectiveSessionLength) {
      console.log(`Auto-adjusting max new problems from ${guardrails.maxNewProblems} to ${effectiveSessionLength} (session length cap)`);
      onGuardrailChange('maxNewProblems', effectiveSessionLength);
    }
  }, [sessionLength, guardrails.maxNewProblems, onGuardrailChange]);

  const maxNewProblemsOptions = getMaxNewProblemsOptions(sessionLength, isOnboarding);

  return (
    <Card withBorder p="lg" h={SECTION_HEIGHT}>
      <Group gap="xs" mb="md">
        <IconShield size={20} style={{ color: 'var(--mantine-color-dimmed)' }} />
        <Title order={4}>Guardrails</Title>
      </Group>

      <Stack gap="md">
        <div>
          <Group gap="xs" mb="xs">
            <Text size="sm" fw={500}>Max new problems per session</Text>
            {isOnboarding && (
              <Badge variant="light" color="orange" size="xs">
                {SessionLimits.getOnboardingBadgeText('newProblems')}
              </Badge>
            )}
          </Group>
          <Select
            value={guardrails.maxNewProblems.toString()}
            onChange={(value) => onGuardrailChange('maxNewProblems', parseInt(value))}
            data={maxNewProblemsOptions}
          />
          {isOnboarding && (
            <Text size="xs" c="orange" mt="xs">
              🔰 Limited to 4 new problems during onboarding to ensure solid foundations
            </Text>
          )}
          {!isOnboarding && (
            <Text size="xs" mt="xs">
              Limited to session length ({sessionLength === "auto" ? "5" : sessionLength} problems)
            </Text>
          )}
        </div>

        <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
          <Text size="sm" fw={500} mb={4}>Adaptive Difficulty Progression</Text>
          <Text size="xs">
            The system automatically progresses from Easy → Medium → Hard based on your performance.
            This ensures you&apos;re always challenged appropriately while building solid foundations.
          </Text>
        </Alert>
      </Stack>
    </Card>
  );
}