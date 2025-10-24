import { Card, Title, Group, Stack, Text, Slider, Select, Switch, Badge } from "@mantine/core";
import { IconShield } from "@tabler/icons-react";
import SessionLimits from "../../../shared/utils/sessionLimits.js";

const SECTION_HEIGHT = 700;

export function GuardrailsSection({ 
  guardrails, 
  isOnboarding, 
  onGuardrailChange 
}) {
  return (
    <Card withBorder p="lg" h={SECTION_HEIGHT}>
      <Group gap="xs" mb="md">
        <IconShield size={20} style={{ color: 'var(--mantine-color-dimmed)' }} />
        <Title order={4}>Guardrails</Title>
      </Group>
      
      <Stack gap="md">
        <div>
          <Text size="sm" fw={500} mb="xs">Min review ratio: {guardrails.minReviewRatio}%</Text>
          <Slider
            value={guardrails.minReviewRatio}
            onChange={(value) => onGuardrailChange('minReviewRatio', value)}
            min={0}
            max={60}
            step={5}
            color="orange"
          />
        </div>

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
            data={[
              { value: "2", label: "2 problems" },
              { value: "3", label: "3 problems" },
              { value: "4", label: "4 problems" },
              ...(isOnboarding ? [] : [
                { value: "5", label: "5 problems" },
                { value: "8", label: "8 problems" },
                { value: "10", label: "10 problems" }
              ])
            ]}
          />
          {isOnboarding && (
            <Text size="xs" c="orange" mt="xs">
              🔰 Limited to 4 new problems during onboarding to ensure solid foundations
            </Text>
          )}
        </div>

        <Switch
          label="Enable adaptive difficulty progression"
          description="System automatically progresses from Easy → Medium → Hard based on your performance"
          checked={guardrails.difficultyCapEnabled}
          onChange={(event) => onGuardrailChange('difficultyCapEnabled', event.currentTarget.checked)}
          color="orange"
        />
      </Stack>
    </Card>
  );
}