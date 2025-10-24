import React from 'react';
import { Stack, Card, Text, Table, Badge, Group } from '@mantine/core';

export const PerformanceTab = ({ dashboardData, getHealthColor, formatDuration: _formatDuration }) => {
  const { performance } = dashboardData;
  
  if (!performance) {
    return (
      <Card withBorder>
        <Text c="dimmed">No performance data available</Text>
      </Card>
    );
  }

  return (
    <Stack>
      {/* Performance Summary */}
      <Card withBorder>
        <Group justify="space-between" mb="md">
          <Text size="lg" fw={500}>
            Performance Overview
          </Text>
          <Badge color={getHealthColor(performance.health)}>
            {performance.health}
          </Badge>
        </Group>
        
        <Table>
          <Table.Tbody>
            <Table.Tr>
              <Table.Td>Average Response Time</Table.Td>
              <Table.Td>{performance.summary?.averageResponseTime || 'N/A'}ms</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>Total Requests</Table.Td>
              <Table.Td>{performance.summary?.totalRequests || 'N/A'}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>Success Rate</Table.Td>
              <Table.Td>{performance.summary?.successRate || 'N/A'}%</Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Card>

      {/* Query Statistics */}
      {performance.queryStats && Object.keys(performance.queryStats).length > 0 && (
        <Card withBorder>
          <Text size="lg" fw={500} mb="md">
            Database Query Performance
          </Text>
          
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Operation</Table.Th>
                <Table.Th>Average Time</Table.Th>
                <Table.Th>Total Calls</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {Object.entries(performance.queryStats).map(([operation, stats]) => (
                <Table.Tr key={operation}>
                  <Table.Td>{operation}</Table.Td>
                  <Table.Td>{stats.averageTime}ms</Table.Td>
                  <Table.Td>{stats.totalCalls}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}
    </Stack>
  );
};