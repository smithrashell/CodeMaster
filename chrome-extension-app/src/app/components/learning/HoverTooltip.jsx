import React from 'react';
import { Text, Stack } from '@mantine/core';

/**
 * Hover tooltip component for displaying node and connection information
 */
export function HoverTooltip({ hoveredNode, hoveredConnection, pathData, tagRelationships, isDarkMode }) {
  // Show connection tooltip with dynamic data
  if (hoveredConnection) {
    // Parse connection ID (format: "tag1<->tag2")
    const [tag1, tag2] = hoveredConnection.split('<->');

    // Find connection data in dynamic relationships
    const connectionKey = tag1 < tag2 ? `${tag1}:${tag2}` : `${tag2}:${tag1}`;
    const connectionData = tagRelationships?.[connectionKey];

    if (!connectionData) return null;

    const { strength, successRate, problems } = connectionData;

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
        maxWidth: '320px',
        border: '1px solid rgba(203, 213, 225, 0.8)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)'
      }}>
        <Text size="sm" fw={700} c={isDarkMode ? '#f8fafc' : '#1a202c'} mb={6}>
          {tag1} ↔ {tag2}
        </Text>
        <Stack gap={4}>
          <Text size="xs" c={isDarkMode ? '#cbd5e1' : '#64748b'}>
            🔗 Connection Strength: {strength} problem{strength > 1 ? 's' : ''}
          </Text>
          <Text size="xs" c={isDarkMode ? '#cbd5e1' : '#64748b'}>
            📊 Success Rate: {successRate}%
          </Text>
          {problems && problems.length > 0 && (
            <>
              <Text size="xs" fw={600} c={isDarkMode ? '#f8fafc' : '#1a202c'} mt={4}>
                Example Problems:
              </Text>
              {problems.map((problem, idx) => (
                <Text key={idx} size="xs" c={isDarkMode ? '#e2e8f0' : '#475569'} pl={8}>
                  {problem.success ? '✓' : '✗'} {problem.title} ({problem.difficulty})
                </Text>
              ))}
            </>
          )}
        </Stack>
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
