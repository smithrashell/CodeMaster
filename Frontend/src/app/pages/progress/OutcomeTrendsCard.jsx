import React from 'react';
import { Card, Grid, Group, Title, Badge, Text } from '@mantine/core';
import { IconAdjustments } from '@tabler/icons-react';

const getStatusColor = (status) => {
  switch (status) {
    case "trending_up": return "green";
    case "stable": return "blue";
    case "needs_attention": return "orange";
    case "loading": return "gray";
    default: return "gray";
  }
};

const getStatusText = (status) => {
  switch (status) {
    case "trending_up": return "Trending Up";
    case "stable": return "Stable";
    case "needs_attention": return "Needs Attention";
    case "loading": return "Loading...";
    default: return "Unknown";
  }
};

export function OutcomeTrendsCard({ outcomeTrends }) {
  return (
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
              <Text size="xl" fw={700} style={{ color: 'var(--mantine-color-green-6)' }}>
                {outcomeTrends.problemsPerWeek.display}
              </Text>
              <Badge variant="light" color={getStatusColor(outcomeTrends.problemsPerWeek.status)} size="xs" mt="xs">
                {getStatusText(outcomeTrends.problemsPerWeek.status)}
              </Badge>
            </div>
          </Grid.Col>
          
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <div style={{ textAlign: 'center' }}>
              <Text size="xs" c="dimmed" mb={4}>Hint Efficiency</Text>
              <Text size="xl" fw={700} style={{ color: 'var(--mantine-color-orange-6)' }}>
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
              <Text size="xl" fw={700} style={{ color: 'var(--mantine-color-violet-6)' }}>
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
  );
}