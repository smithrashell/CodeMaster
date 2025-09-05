import React from 'react';
import { Box, Text, Paper, Stack } from '@mantine/core';

function DropdownContent({ 
  opened, 
  disabled, 
  groupedData, 
  renderDropdownOption 
}) {
  if (!opened || disabled) return null;

  return (
    <Paper
      shadow="md"
      p="xs"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 1000,
        marginTop: 0,
        maxHeight: '200px',
        overflowY: 'auto',
        backgroundColor: 'var(--mantine-color-body)',
        border: '1px solid var(--mantine-color-default-border)'
      }}
    >
      {Object.keys(groupedData).length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="md">
          No options available
        </Text>
      ) : (
        Object.entries(groupedData).map(([groupName, items]) => (
          <Box key={groupName} mb="xs">
            {Object.keys(groupedData).length > 1 && (
              <Text size="xs" fw={600} c="dimmed" mb={4} px="xs">
                {groupName}
              </Text>
            )}
            <Stack gap={2}>
              {items.map(renderDropdownOption)}
            </Stack>
          </Box>
        ))
      )}
    </Paper>
  );
}

export default DropdownContent;