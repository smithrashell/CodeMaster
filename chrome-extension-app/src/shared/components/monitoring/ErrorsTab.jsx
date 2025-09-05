import React from 'react';
import { Stack, Card, Text, Table, Badge } from '@mantine/core';

export const ErrorsTab = ({ dashboardData }) => {
  const { errors } = dashboardData;
  
  if (!errors || !errors.recentErrors) {
    return (
      <Card withBorder>
        <Text c="dimmed">No error data available</Text>
      </Card>
    );
  }

  return (
    <Stack>
      {/* Error Statistics */}
      <Card withBorder>
        <Text size="lg" fw={500} mb="md">
          Error Statistics
        </Text>
        
        <Table>
          <Table.Tbody>
            <Table.Tr>
              <Table.Td>Recent Errors</Table.Td>
              <Table.Td>{errors.recentErrors.length}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>Total Errors (7 days)</Table.Td>
              <Table.Td>{errors.errorStats?.total || 0}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>Error Rate</Table.Td>
              <Table.Td>{errors.errorStats?.rate || 0}%</Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Card>

      {/* Recent Errors */}
      <Card withBorder>
        <Text size="lg" fw={500} mb="md">
          Recent Errors
        </Text>
        
        {errors.recentErrors.length > 0 ? (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Type</Table.Th>
                <Table.Th>Message</Table.Th>
                <Table.Th>Timestamp</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {errors.recentErrors.slice(0, 10).map((error, index) => (
                <Table.Tr key={index}>
                  <Table.Td>
                    <Badge size="sm" color="red">
                      {error.type || 'Error'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" truncate>
                      {error.message || 'No message'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {error.timestamp ? new Date(error.timestamp).toLocaleString() : 'Unknown'}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Text c="dimmed">No recent errors</Text>
        )}
      </Card>
    </Stack>
  );
};