import React from "react";
import { Text, Group } from "@mantine/core";

const InteractiveControls = () => {
  const instructions = [
    '• Drag canvas to pan',
    '• Mouse wheel to zoom',
    '• Click nodes for details',
    '• Hover lines for info',
    '• Lock/unlock dragging'
  ];

  return (
    <div style={{ flex: 1 }}>
      <Group gap="xs" mb="md">
        <span style={{ fontSize: '14px' }}>🎮</span>
        <Text size="sm" fw={600} c="var(--cm-text)">Interactive Controls</Text>
      </Group>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '8px 12px',
        alignItems: 'start'
      }}>
        {instructions.map((instruction, index) => (
          <Text key={index} size="xs" c="var(--cm-text-secondary)" style={{ lineHeight: 1.3 }}>
            {instruction}
          </Text>
        ))}
      </div>
    </div>
  );
};

export default InteractiveControls;