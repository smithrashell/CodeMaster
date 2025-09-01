import React from "react";
import { Text, Group } from "@mantine/core";

const LearningPathLegend = () => {
  const legendItems = [
    { color: '#10b981', label: 'Mastered', icon: '✅' },
    { color: '#3b82f6', label: 'Current Focus', icon: '🎯' },
    { color: '#f59e0b', label: 'In Progress', icon: '📚' },
    { color: '#cbd5e1', label: 'Not Started', icon: '⚪' }
  ];

  return (
    <div style={{ flex: 1 }}>
      <Text size="sm" fw={600} mb="md" c="var(--cm-text)">Legend</Text>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '8px 12px',
        alignItems: 'start'
      }}>
        {legendItems.map((item, index) => (
          <Group key={index} gap="xs" wrap="nowrap">
            <div style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              backgroundColor: item.color,
              border: '2px solid var(--cm-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '8px',
              flexShrink: 0
            }}>
              {item.icon}
            </div>
            <Text size="xs" c="var(--cm-text)">
              {item.label}
            </Text>
          </Group>
        ))}
      </div>
    </div>
  );
};

export default LearningPathLegend;