import React from 'react';
import { Text } from '@mantine/core';
import { tagRelationships } from './TagRelationships.js';

/**
 * Hover tooltip component for displaying node and connection information
 */
export function HoverTooltip({ hoveredNode, hoveredConnection, pathData, isDarkMode }) {
  // Show connection tooltip
  if (hoveredConnection) {
    const [fromTag, toTag] = hoveredConnection.split('->');
    const relationship = tagRelationships[fromTag];
    const unlockData = relationship?.unlocks.find(u =>
      (typeof u === 'string' ? u : u.tag) === toTag
    );
    const weight = typeof unlockData === 'object' ? unlockData.weight : 70;
    const description = typeof unlockData === 'object' ? unlockData.description : '';

    return (
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        background: isDarkMode ? 'rgba(55, 65, 81, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDarkMode ? '#f8fafc' : '#1a202c',
        padding: '12px 16px',
        borderRadius: '8px',
        fontSize: '12px',
        pointerEvents: 'none',
        zIndex: 15,
        maxWidth: '280px',
        border: '1px solid rgba(203, 213, 225, 0.8)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)'
      }}>
        <Text size="sm" fw={700} c={isDarkMode ? '#f8fafc' : '#1a202c'} mb={4}>
          {fromTag} → {toTag}
        </Text>
        <Text size="xs" c={isDarkMode ? '#cbd5e1' : '#64748b'} mb={6}>
          Connection Strength: {weight}%
        </Text>
        {description && (
          <Text size="xs" c={isDarkMode ? '#e2e8f0' : '#475569'}>
            {description}
          </Text>
        )}
      </div>
    );
  }

  // Show node tooltip
  if (hoveredNode) {
    const nodeData = pathData?.find(node => node.tag === hoveredNode);
    if (!nodeData) return null;

    const totalAttempts = nodeData.total_attempts || 0;
    const successfulAttempts = nodeData.successful_attempts || 0;
    const progress = nodeData.progress || 0;
    const status = nodeData.status || 'not-started';

    return (
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        background: isDarkMode ? 'rgba(55, 65, 81, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDarkMode ? '#f8fafc' : '#1a202c',
        padding: '12px 16px',
        borderRadius: '8px',
        fontSize: '12px',
        pointerEvents: 'none',
        zIndex: 15,
        maxWidth: '240px',
        border: '1px solid rgba(203, 213, 225, 0.8)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)'
      }}>
        <Text size="sm" fw={700} c={isDarkMode ? '#f8fafc' : '#1a202c'} mb={4}>
          {hoveredNode}
        </Text>
        <Text size="xs" c={isDarkMode ? '#cbd5e1' : '#64748b'} mb={2}>
          Status: {status.charAt(0).toUpperCase() + status.slice(1)}
        </Text>
        {totalAttempts > 0 && (
          <>
            <Text size="xs" c={isDarkMode ? '#cbd5e1' : '#64748b'}>
              Progress: {progress}% ({successfulAttempts}/{totalAttempts})
            </Text>
          </>
        )}
        {nodeData.isFocus && (
          <Text size="xs" c="#3b82f6" fw={600} mt={4}>
            Current Focus Area
          </Text>
        )}
      </div>
    );
  }

  return null;
}
