import React from "react";
import { Text, Group } from "@mantine/core";

const LearningPathLegend = () => {
  const legendItems = [
    { color: '#10b981', label: 'Mastered', icon: '✅' },
    { color: '#3b82f6', label: 'Current Focus', icon: '🎯' },
    { color: '#f59e0b', label: 'In Progress', icon: '📚' },
    { color: '#cbd5e1', label: 'Not Started', icon: '⚪' }
  ];

  const connectionItems = [
    { color: '#10b981', label: 'Very Strong', dash: false },
    { color: '#3b82f6', label: 'Strong', dash: false },
    { color: '#f59e0b', label: 'Medium', dash: true },
    { color: '#94a3b8', label: 'Weak', dash: true }
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

      <Text size="sm" fw={600} mt="md" mb="xs" c="var(--cm-text)">Connection Strength</Text>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '6px 12px',
        alignItems: 'center'
      }}>
        {connectionItems.map((item, index) => (
          <Group key={index} gap="xs" wrap="nowrap">
            <svg width="24" height="10" style={{ flexShrink: 0 }}>
              <line
                x1="0" y1="5" x2="24" y2="5"
                stroke={item.color}
                strokeWidth="2"
                strokeDasharray={item.dash ? "4 3" : "none"}
              />
            </svg>
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
