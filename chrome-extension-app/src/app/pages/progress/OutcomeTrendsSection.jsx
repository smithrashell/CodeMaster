import { Card, Title, Group, Grid, Text, Badge } from "@mantine/core";
import { IconAdjustments } from "@tabler/icons-react";

export function OutcomeTrendsSection({ 
  outcomeTrends, 
  getStatusColor, 
  getStatusText 
}) {
  return (
    <Grid gutter="md" mt="md">
      <Grid.Col span={12}>
        <Card withBorder p="lg">
          <Group gap="xs" mb="md">
            <IconAdjustments size={20} style={{ color: 'var(--mantine-color-dimmed)' }} />
            <Title order={4}>Outcome Trends & Soft Targets</Title>
            <Badge variant="light" color="cyan" size="sm">System guided</Badge>
          </Group>
          
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
              <div style={{ textAlign: 'center' }}>
                <Text size="xs" c="dimmed" mb={4}>Weekly Accuracy Target</Text>
                <Text size="xl" fw={700} style={{ color: 'var(--mantine-color-cyan-6)' }}>
                  {outcomeTrends.weeklyAccuracy.value}%
                </Text>
                <Badge variant="light" color={getStatusColor(outcomeTrends.weeklyAccuracy.status)} size="xs" mt="xs">
                  {getStatusText(outcomeTrends.weeklyAccuracy.status)}
                </Badge>
              </div>
            </Grid.Col>
            
            <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
              <div style={{ textAlign: 'center' }}>
                <Text size="xs" c="dimmed" mb={4}>Problems Per Week</Text>
                <Text size="xl" fw={700} style={{ color: 'var(--mantine-color-cyan-6)' }}>
                  {outcomeTrends.problemsPerWeek.display || outcomeTrends.problemsPerWeek.value}
                </Text>
                <Badge variant="light" color={getStatusColor(outcomeTrends.problemsPerWeek.status)} size="xs" mt="xs">
                  {getStatusText(outcomeTrends.problemsPerWeek.status)}
                </Badge>
              </div>
            </Grid.Col>
            
            <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
              <div style={{ textAlign: 'center' }}>
                <Text size="xs" c="dimmed" mb={4}>Hint Efficiency</Text>
                <Text size="xl" fw={700} style={{ color: 'var(--mantine-color-cyan-6)' }}>
                  {outcomeTrends.hintEfficiency.display}
                </Text>
                <Badge variant="light" color={getStatusColor(outcomeTrends.hintEfficiency.status)} size="xs" mt="xs">
                  {getStatusText(outcomeTrends.hintEfficiency.status)}
                </Badge>
              </div>
            </Grid.Col>
            
            <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
              <div style={{ textAlign: 'center' }}>
                <Text size="xs" c="dimmed" mb={4}>Learning Velocity</Text>
                <Text size="xl" fw={700} style={{ color: 'var(--mantine-color-cyan-6)' }}>
                  {outcomeTrends.learningVelocity.value}
                </Text>
                <Badge variant="light" color={getStatusColor(outcomeTrends.learningVelocity.status)} size="xs" mt="xs">
                  {getStatusText(outcomeTrends.learningVelocity.status)}
                </Badge>
              </div>
            </Grid.Col>
          </Grid>
        </Card>
      </Grid.Col>
    </Grid>
  );
}