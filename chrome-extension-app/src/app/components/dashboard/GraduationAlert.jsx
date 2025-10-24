import React from 'react';
import { Alert, Button, Group, Text } from '@mantine/core';
import { IconTrophy } from '@tabler/icons-react';

export function GraduationAlert({ graduationStatus, onAutoGraduate }) {
  if (!graduationStatus?.needsUpdate) {
    return null;
  }

  return (
    <Alert color="green" variant="light" mb="md">
      <Group gap="xs" align="center">
        <IconTrophy size={16} />
        <Text size="sm">
          🎉 You&apos;ve mastered {graduationStatus.masteredTags.length} focus area(s)!
        </Text>
        <Button size="xs" variant="light" color="green" onClick={onAutoGraduate}>
          Update Focus Areas
        </Button>
      </Group>
    </Alert>
  );
}