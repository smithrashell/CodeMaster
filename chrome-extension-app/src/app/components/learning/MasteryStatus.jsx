import React from "react";
import { Card, Title, Text, Stack } from "@mantine/core";

const MasteryStatus = ({ pathData }) => {
  const masteredCount = pathData.filter(tag => tag.mastered).length;
  const inProgressCount = pathData.filter(tag => !tag.mastered && tag.progress > 0).length;
  const notStartedCount = pathData.filter(tag => tag.progress === 0).length;

  return (
    <Card withBorder p="lg" h={280}>
      <Title order={4} mb="md">Mastery Status</Title>
      <Stack gap="md">
        <div>
          <Text size="sm" mb="xs">Mastered Topics</Text>
          <Text fw={500} size="lg" c="green">
            {masteredCount} / {pathData.length}
          </Text>
        </div>
        <div>
          <Text size="sm" mb="xs">In Progress</Text>
          <Text fw={500} size="lg" c="orange">
            {inProgressCount}
          </Text>
        </div>
        <div>
          <Text size="sm" mb="xs">Not Started</Text>
          <Text fw={500} size="lg" c="red">
            {notStartedCount}
          </Text>
        </div>
      </Stack>
    </Card>
  );
};

export default MasteryStatus;