import { Group, Text, Badge } from "@mantine/core";

export function ActiveSessionFocus({ appState }) {
  return (
    <div>
      <Group gap="xs" mb="xs">
        <Text size="sm" fw={500}>Active Session Focus</Text>
        {appState?.learningPlan?.focus?.activeFocusTags ? (
          <Badge variant="light" color="teal" size="xs">
            Coordinated Decision
          </Badge>
        ) : (
          <Badge variant="light" color="cyan" size="xs">
            System Default
          </Badge>
        )}
        {appState?.learningPlan?.focus?.onboarding && (
          <Badge variant="light" color="orange" size="xs">
            Onboarding Mode
          </Badge>
        )}
        {appState?.learningPlan?.focus?.performanceLevel && (
          <Badge variant="light" color="blue" size="xs">
            {appState.learningPlan.focus.performanceLevel} Performance
          </Badge>
        )}
      </Group>
      <Group gap="xs">
        {(appState?.learningPlan?.focus?.activeFocusTags || 
          appState?.learningPlan?.focus?.systemFocusTags || 
          ['Array', 'Hash Table', 'String', 'Sorting', 'Math']).map((tag, index) => (
          <Badge 
            key={index} 
            variant={appState?.learningPlan?.focus?.activeFocusTags ? "filled" : "light"} 
            color={appState?.learningPlan?.focus?.activeFocusTags ? "teal" : "cyan"} 
            size="sm"
          >
            {tag}
          </Badge>
        ))}
      </Group>
      <Text size="xs" c="dimmed" mt="xs">
        {appState?.learningPlan?.focus?.activeFocusTags 
          ? "What your next session will actually focus on"
          : "System recommendations based on your performance and learning progress"
        }
      </Text>
      {appState?.learningPlan?.focus?.algorithmReasoning && (
        <Text size="xs" c="dimmed" fs="italic" mt="xs">
          📊 {appState.learningPlan.focus.algorithmReasoning}
        </Text>
      )}
    </div>
  );
}