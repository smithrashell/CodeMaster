import React from "react";
import { Card, Badge, Group, Title, Stack, Text, Divider, rem } from "@mantine/core";
import { IconTarget, IconClock, IconBulb, IconTrendingUp } from "@tabler/icons-react";

export function RecommendationsCard() {
  const recommendations = [
    {
      icon: IconClock,
      color: 'var(--mantine-color-green-5)',
      title: 'Peak scheduling',
      text: <>Schedule hard topics during your <Text span fw={600} c="white">07:30–09:30</Text> window</>
    },
    {
      icon: IconBulb,
      color: 'var(--mantine-color-blue-5)',
      title: 'Consistency',
      text: <>Maintain a <Text span fw={600} c="white">consistent daily</Text> session time</>
    },
    {
      icon: IconTrendingUp,
      color: 'var(--mantine-color-orange-5)',
      title: 'Progress tracking',
      text: <>Track <Text span fw={600} c="white">weekly % accuracy</Text> trend</>
    }
  ];

  return (
    <Card
      radius="md"
      p="md"
      style={{
        borderLeft: `${rem(4)} solid var(--mantine-color-green-5)`,
        backgroundColor: 'var(--mantine-color-dark-8)',
        border: '1px solid var(--mantine-color-dark-5)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        minHeight: '200px'
      }}
    >
      <Badge 
        variant="light" 
        color="green" 
        style={{ 
          position: 'absolute', 
          top: '12px', 
          right: '12px' 
        }}
      >
        Smart suggestions
      </Badge>
      
      <div style={{ textAlign: 'center', margin: 'auto' }}>
        <Group justify="center" gap="xs" mb="sm">
          <IconTarget size={18} />
          <Title order={4}>Recommendations</Title>
        </Group>
        
        <Stack gap="xs" align="center">
          {recommendations.map((rec, index) => (
            <div key={index} style={{ textAlign: 'center' }}>
              <Group justify="center" gap="xs" mb="xs">
                <rec.icon size={14} style={{ color: rec.color }} />
                <Text fw={600} size="sm">{rec.title}</Text>
              </Group>
              <Text size="sm" c="dimmed">
                {rec.text}
              </Text>
              {index < 2 && <Divider my="xs" variant="dashed" />}
            </div>
          ))}
        </Stack>
      </div>
    </Card>
  );
}