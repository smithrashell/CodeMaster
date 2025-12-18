import React from "react";
import { Card, Badge, Group, Title, Stack, Text, Divider, rem } from "@mantine/core";
import { IconBulb, IconTarget } from "@tabler/icons-react";

export function InsightsCard({ insights, timeRange }) {
  return (
    <Card
      radius="md"
      p="md"
      style={{
        borderLeft: `${rem(4)} solid var(--mantine-color-blue-5)`,
        backgroundColor: 'var(--cm-card-bg)',
        border: '1px solid var(--cm-border)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        minHeight: '200px'
      }}
    >
      <Badge 
        variant="light" 
        style={{ 
          position: 'absolute', 
          top: '12px', 
          right: '12px' 
        }}
      >
        {timeRange}
      </Badge>
      
      <div style={{ textAlign: 'center', margin: 'auto' }}>
        <Group justify="center" gap="xs" mb="sm">
          <IconBulb size={18} />
          <Title order={4}>Key Insights</Title>
        </Group>
        
        <Stack gap="xs" align="center">
          {insights.length > 0 ? (
            insights.map((insight, index) => (
              <div key={index} style={{ textAlign: 'center' }}>
                <Group justify="center" gap="xs" mb="xs">
                  <IconTarget size={14} style={{ color: 'var(--cm-text-dimmed)' }} />
                  <Text fw={600} size="sm">{insight.title}</Text>
                </Group>
                <Text size="sm">
                  {insight.body.includes('%') ? (
                    <>
                      {insight.body.split(' ').map((word, i) => {
                        if (word.includes('%') || word.includes(':')) {
                          return <Text key={i} span fw={600}>{word} </Text>;
                        }
                        return word + ' ';
                      })}
                    </>
                  ) : (
                    insight.body
                  )}
                </Text>
                {index < insights.length - 1 && <Divider my="xs" variant="dashed" />}
              </div>
            ))
          ) : (
            <Text size="sm">Complete more sessions to see insights!</Text>
          )}
        </Stack>
      </div>
    </Card>
  );
}