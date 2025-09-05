import React from "react";
import { Card, Title, Text, Stack } from "@mantine/core";

const CurrentFocusAreas = ({ pathData }) => {
  const focusAreas = pathData.filter(tag => tag.isFocus).slice(0, 5);

  return (
    <Card withBorder p="lg" h={280}>
      <Title order={4} mb="md">Current Focus Areas</Title>
      <Stack gap="md">
        {focusAreas.map((tag, index) => (
          <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text fw={500}>{tag.tag}</Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Text size="sm" c="dimmed">{tag.attempts} attempts</Text>
              <Text fw={500} c={tag.progress >= 80 ? "green" : tag.progress >= 60 ? "orange" : "red"}>
                {tag.progress}%
              </Text>
            </div>
          </div>
        ))}
        {focusAreas.length === 0 && (
          <Text c="dimmed" ta="center">No focus areas set. Complete more sessions to see recommendations!</Text>
        )}
      </Stack>
    </Card>
  );
};

export default CurrentFocusAreas;