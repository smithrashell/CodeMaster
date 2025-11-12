import React from 'react';
import { Box, Text, Paper, Stack, Portal } from '@mantine/core';

const DropdownContent = React.forwardRef(({
  opened,
  disabled,
  groupedData,
  renderDropdownOption,
  targetRef
}, ref) => {
  if (!opened || disabled) return null;

  // Get the position of the target element
  const rect = targetRef?.current?.getBoundingClientRect();

  return (
    <Portal>
      <Paper
        ref={ref}
        shadow="md"
        p="xs"
        style={{
          position: 'fixed',
          left: rect?.left || 0,
          top: (rect?.bottom || 0) + window.scrollY,
          width: rect?.width || 'auto',
          zIndex: 1000,
          marginTop: 0,
          maxHeight: '200px',
          overflowY: 'auto',
          backgroundColor: 'var(--mantine-color-body)',
          border: '1px solid var(--mantine-color-default-border)'
        }}
      >
        {Object.keys(groupedData).length === 0 ? (
          <Text size="sm" ta="center" py="md">
            No options available
          </Text>
        ) : (
          Object.entries(groupedData).map(([groupName, items]) => (
            <Box key={groupName} mb="xs">
              {Object.keys(groupedData).length > 1 && (
                <Text size="xs" fw={600} mb={4} px="xs">
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
    </Portal>
  );
});

DropdownContent.displayName = 'DropdownContent';

export default DropdownContent;