import React from 'react';
import { Text } from '@mantine/core';

/**
 * Hover tooltip component for displaying node information
 */
export function HoverTooltip({ hoveredNode, isDarkMode }) {
  if (!hoveredNode) {
    return null;
  }

  return (
    <div style={{
      position: 'absolute',
      top: '10px',
      left: '10px',
      background: isDarkMode ? 'rgba(55, 65, 81, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      color: isDarkMode ? '#f8fafc' : '#1a202c',
      padding: '10px 14px',
      borderRadius: '8px',
      fontSize: '12px',
      pointerEvents: 'none',
      zIndex: 15,
      maxWidth: '240px',
      border: '1px solid rgba(203, 213, 225, 0.8)',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)'
    }}>
      <Text size="sm" fw={600} c={isDarkMode ? '#f8fafc' : '#1a202c'} mb="xs">
        {hoveredNode}
      </Text>
    </div>
  );
}