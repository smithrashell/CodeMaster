import { Card, Title, Group, Stack, Text, Badge, Button, Grid, Slider } from "@mantine/core";
import { IconTarget, IconEdit } from "@tabler/icons-react";
import { ActiveSessionFocus } from "./ActiveSessionFocus.jsx";

const SECTION_HEIGHT = 700;

// Helper component for System Focus Tags section
function SystemFocusTagsSection({ appState }) {
  return (
    <div>
      <Group gap="xs" mb="xs">
        <Text size="sm" fw={500}>System Recommendations</Text>
        <Badge color="cyan" size="xs">
          System Recommended
        </Badge>
      </Group>
      <Group gap="xs">
        {(appState?.learningPlan?.focus?.systemFocusTags || []).map((tag, index) => (
          <Badge key={index} color="cyan" size="sm">
            {tag}
          </Badge>
        ))}
      </Group>
      <Text size="xs" c="dimmed" mt="xs">
        Based on your performance and learning progress
      </Text>
    </div>
  );
}

// Helper component for User Focus Areas section
function UserFocusAreasSection({ appState, isOnboarding, navigate }) {
  const userFocusAreas = appState?.learningPlan?.focus?.userFocusAreas || [];
  
  return (
    <div>
      <Group gap="xs" mb="xs">
        <Text size="sm" fw={500}>Your Focus Areas</Text>
        {isOnboarding && (
          <Badge color="orange" size="xs">
            Onboarding: 1 tag limit
          </Badge>
        )}
      </Group>
      <Group gap="xs">
        {userFocusAreas.length > 0 ? (
          userFocusAreas.slice(0, isOnboarding ? 1 : 3).map((tag, index) => (
            <Badge key={index} color="violet" size="sm">
              {tag}
            </Badge>
          ))
        ) : (
          <Text size="sm" c="dimmed">No focus areas selected</Text>
        )}
        <Button 
          variant="subtle" 
          size="xs" 
          color="violet"
          leftSection={<IconEdit size={12} />}
          onClick={() => navigate('/settings/general')}
        >
          {userFocusAreas.length > 0 ? 'Edit' : 'Set Focus Areas'}
        </Button>
      </Group>
      <Text size="xs" c="dimmed" mt="xs">
        Your preferences get priority in problem selection
      </Text>
      {isOnboarding && (
        <Text size="xs" c="orange" mt="xs">
          🔰 During onboarding, sessions focus on one tag for deeper learning
        </Text>
      )}
    </div>
  );
}

// Difficulty Distribution display removed - Adaptive difficulty escape hatch system automatically handles Easy → Medium → Hard progression
// Review Ratio slider removed - Leitner system naturally determines review problems based on spaced repetition schedule

export function FocusPrioritiesSection({ 
  appState, 
  focusPriorities, 
  isOnboarding, 
  navigate,
  onFocusPrioritiesChange,
  onSaveSettings
}) {
  return (
    <Card withBorder p="lg" h={SECTION_HEIGHT}>
      <Group gap="xs" mb="md">
        <IconTarget size={20} style={{ color: 'var(--mantine-color-dimmed)' }} />
        <Title order={4}>Focus Priorities</Title>
      </Group>
      
      <Stack gap="lg">
        <SystemFocusTagsSection appState={appState} />
        <UserFocusAreasSection appState={appState} isOnboarding={isOnboarding} navigate={navigate} />
        <ActiveSessionFocus appState={appState} />
      </Stack>
    </Card>
  );
}