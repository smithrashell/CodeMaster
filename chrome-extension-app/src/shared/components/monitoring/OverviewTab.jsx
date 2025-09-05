import React from 'react';
import { Stack, Grid, Card, Text, Badge, Progress, Group } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

export const OverviewTab = ({ dashboardData, getHealthColor, formatBytes }) => {
  const { system, performance, errors, alerts } = dashboardData;

  return (
    <Stack>
      <Grid>
        {/* System Health */}
        <Grid.Col span={6}>
          <Card withBorder>
            <Group justify="space-between" mb="xs">
              <Text size="sm" fw={500}>
                System Health
              </Text>
              <Badge color={getHealthColor(performance?.health)}>
                {performance?.health || 'Unknown'}
              </Badge>
            </Group>
            
            {system?.memory && (
              <Stack gap="xs">
                <Text size="xs" c="dimmed">
                  Memory Usage: {formatBytes(system.memory.used)} / {formatBytes(system.memory.total)}
                </Text>
                <Progress
                  value={(system.memory.used / system.memory.total) * 100}
                  color={getHealthColor(performance?.health)}
                />
              </Stack>
            )}
          </Card>
        </Grid.Col>

        {/* Alerts Summary */}
        <Grid.Col span={6}>
          <Card withBorder>
            <Group justify="space-between" mb="xs">
              <Text size="sm" fw={500}>
                Active Alerts
              </Text>
              <IconAlertTriangle size={16} />
            </Group>
            
            <Stack gap="xs">
              <Text size="lg" fw={600}>
                {alerts?.active?.length || 0}
              </Text>
              <Text size="xs" c="dimmed">
                {alerts?.acknowledged?.length || 0} acknowledged
              </Text>
            </Stack>
          </Card>
        </Grid.Col>

        {/* Error Rate */}
        <Grid.Col span={6}>
          <Card withBorder>
            <Text size="sm" fw={500} mb="xs">
              Recent Errors
            </Text>
            <Text size="lg" fw={600}>
              {errors?.recentErrors?.length || 0}
            </Text>
            <Text size="xs" c="dimmed">
              Last 24 hours
            </Text>
          </Card>
        </Grid.Col>

        {/* Performance Score */}
        <Grid.Col span={6}>
          <Card withBorder>
            <Text size="sm" fw={500} mb="xs">
              Performance Score
            </Text>
            <Text size="lg" fw={600}>
              {performance?.summary?.averageResponseTime || 'N/A'}ms
            </Text>
            <Text size="xs" c="dimmed">
              Average response time
            </Text>
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  );
};