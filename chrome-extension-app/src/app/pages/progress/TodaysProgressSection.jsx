import { Card, Title, Group, Stack, Text, Badge } from "@mantine/core";
import { IconChartBar } from "@tabler/icons-react";

const SECTION_HEIGHT = 700;

export function TodaysProgressSection({ todaysProgress }) {
  const {
    problemsSolved,
    accuracy,
    reviewProblems,
    hintsPerProblem,
    avgTimeMinutes,
    hasActivity
  } = todaysProgress;

  return (
    <Card withBorder p="lg" h={SECTION_HEIGHT}>
      <Group gap="xs" mb="md">
        <IconChartBar size={20} style={{ color: 'var(--mantine-color-dimmed)' }} />
        <Title order={4}>Today&apos;s Progress</Title>
        <Badge variant="light" color="blue" size="sm">Live Stats</Badge>
      </Group>

      {hasActivity ? (
        <Stack gap="xl" mt="lg">
          {/* Performance Metrics */}
          <div>
            <Title order={5} mb="md">Performance</Title>
            <Stack gap="lg">
              {/* Problems Solved */}
              <Group justify="space-between" wrap="nowrap">
                <Text size="sm" fw={500}>Problems Solved</Text>
                <Group gap="xs" align="baseline">
                  <Text size="lg" fw={700} style={{ color: 'var(--mantine-color-blue-6)' }}>
                    {problemsSolved}
                  </Text>
                  <Text size="xs">problems</Text>
                </Group>
              </Group>

              {/* Accuracy Rate */}
              <Group justify="space-between" wrap="nowrap">
                <Text size="sm" fw={500}>Accuracy Rate</Text>
                <Group gap="xs" align="baseline">
                  <Text size="lg" fw={700} style={{
                    color: accuracy >= 75 ? 'var(--mantine-color-green-6)' :
                           accuracy >= 50 ? 'var(--mantine-color-yellow-6)' :
                           'var(--mantine-color-orange-6)'
                  }}>
                    {accuracy}%
                  </Text>
                  <Badge
                    variant="light"
                    color={accuracy >= 75 ? "green" : accuracy >= 50 ? "yellow" : "orange"}
                    size="xs"
                  >
                    {accuracy >= 75 ? "Excellent" : accuracy >= 50 ? "Good" : "Keep Going"}
                  </Badge>
                </Group>
              </Group>

              {/* Review Problems */}
              <Group justify="space-between" wrap="nowrap">
                <Text size="sm" fw={500}>Review Problems</Text>
                <Group gap="xs" align="baseline">
                  <Text size="lg" fw={700} style={{ color: 'var(--mantine-color-violet-6)' }}>
                    {reviewProblems}
                  </Text>
                  <Text size="xs">completed</Text>
                </Group>
              </Group>
            </Stack>
          </div>

          {/* Learning Metrics */}
          <div>
            <Title order={5} mb="md">Learning Efficiency</Title>
            <Stack gap="lg">
              {/* Hint Efficiency */}
              <Group justify="space-between" wrap="nowrap">
                <Text size="sm" fw={500}>Hint Usage</Text>
                <Group gap="xs" align="baseline">
                  <Text size="lg" fw={700} style={{
                    color: hintsPerProblem <= 1 ? 'var(--mantine-color-green-6)' :
                           hintsPerProblem <= 2 ? 'var(--mantine-color-yellow-6)' :
                           'var(--mantine-color-orange-6)'
                  }}>
                    {hintsPerProblem.toFixed(1)}
                  </Text>
                  <Text size="xs">per problem</Text>
                </Group>
              </Group>

              {/* Average Time */}
              <Group justify="space-between" wrap="nowrap">
                <Text size="sm" fw={500}>Avg Time</Text>
                <Group gap="xs" align="baseline">
                  <Text size="lg" fw={700} style={{ color: 'var(--mantine-color-cyan-6)' }}>
                    {avgTimeMinutes}
                  </Text>
                  <Text size="xs">min/problem</Text>
                </Group>
              </Group>
            </Stack>
          </div>
        </Stack>
      ) : (
        <Stack align="center" justify="center" h={SECTION_HEIGHT - 120} gap="md">
          <Text size="3rem" style={{ opacity: 0.3 }}>📊</Text>
          <Text size="lg" fw={500} ta="center">
            No activity today yet
          </Text>
          <Text size="sm" ta="center" style={{ maxWidth: '80%' }}>
            Start a practice session to see your progress here!
          </Text>
        </Stack>
      )}
    </Card>
  );
}
