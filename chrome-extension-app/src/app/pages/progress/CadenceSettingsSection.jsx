import { Card, Title, Group, Stack, Text, Slider, Select, Badge } from "@mantine/core";
import { IconClock } from "@tabler/icons-react";
import SessionLimits from "../../../shared/utils/sessionLimits.js";

const SECTION_HEIGHT = 700;

export function CadenceSettingsSection({ 
  cadenceSettings, 
  isOnboarding, 
  onCadenceChange 
}) {
  return (
    <Card withBorder p="lg" h={SECTION_HEIGHT}>
      <Group gap="xs" mb="md">
        <IconClock size={20} style={{ color: 'var(--mantine-color-dimmed)' }} />
        <Title order={4}>Cadence Commitment</Title>
      </Group>
      
      <Stack gap="xl">
        <div>
          <Text size="sm" fw={500} mb="md">Sessions per week</Text>
          <div style={{ marginBottom: '20px' }}>
            <Slider
              value={cadenceSettings.sessionsPerWeek}
              onChange={(value) => onCadenceChange('sessionsPerWeek', value)}
              min={1}
              max={7}
              step={1}
              marks={[
                { value: 1, label: '1' },
                { value: 3, label: '3' },
                { value: 5, label: '5' },
                { value: 7, label: '7' }
              ]}
              color="blue"
            />
          </div>
          <Text size="xs" c="dimmed">
            Current: {cadenceSettings.sessionsPerWeek} sessions/week
          </Text>
        </div>

        <div>
          <Group gap="xs" mb="md">
            <Text size="sm" fw={500}>Max session length (problems)</Text>
            {isOnboarding && (
              <Badge variant="light" color="orange" size="xs">
                {SessionLimits.getOnboardingBadgeText('sessionLength')}
              </Badge>
            )}
          </Group>
          <Select
            value={cadenceSettings.sessionLength === 'auto' ? 'auto' : cadenceSettings.sessionLength.toString()}
            onChange={(value) => onCadenceChange('sessionLength', value === 'auto' ? 'auto' : parseInt(value))}
            data={[
              { value: "auto", label: "Auto (system decides)" },
              { value: "3", label: "3 problems" },
              { value: "4", label: "4 problems" },
              { value: "5", label: "5 problems" },
              { value: "6", label: "6 problems" },
              ...(isOnboarding ? [] : [
                { value: "8", label: "8 problems" },
                { value: "10", label: "10 problems" }
              ])
            ]}
          />
          {isOnboarding ? (
            <Text size="xs" c="orange" mt="md">
              🔰 During onboarding, maximum session length is capped at 6 problems for optimal learning
            </Text>
          ) : (
            <Text size="xs" c="dimmed" mt="xs">
              {cadenceSettings.sessionLength === 'auto'
                ? "📊 Algorithm adjusts session length based on performance (3-12 problems)"
                : `🔒 Sessions will never exceed ${cadenceSettings.sessionLength} problems`
              }
            </Text>
          )}
        </div>

      </Stack>
    </Card>
  );
}