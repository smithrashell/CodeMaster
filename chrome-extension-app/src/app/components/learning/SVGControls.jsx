import React from 'react';
import { Group, ActionIcon } from '@mantine/core';
import { IconZoomIn, IconZoomOut, IconHome, IconLock, IconLockOpen } from '@tabler/icons-react';

export const SVGControls = ({ 
  onZoomIn, 
  onZoomOut, 
  onResetView, 
  isNodesLocked, 
  onToggleNodeLock,
  zoom 
}) => {
  return (
    <Group 
      gap={4}
      style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        zIndex: 10,
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(8px)',
        borderRadius: '8px',
        padding: '8px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
      }}
    >
      <ActionIcon
        size="sm"
        variant="light"
        onClick={onZoomIn}
        disabled={zoom >= 3}
        title="Zoom In"
      >
        <IconZoomIn size={16} />
      </ActionIcon>
      
      <ActionIcon
        size="sm"
        variant="light"
        onClick={onZoomOut}
        disabled={zoom <= 0.5}
        title="Zoom Out"
      >
        <IconZoomOut size={16} />
      </ActionIcon>
      
      <ActionIcon
        size="sm"
        variant="light"
        onClick={onResetView}
        title="Reset View"
      >
        <IconHome size={16} />
      </ActionIcon>
      
      <ActionIcon
        size="sm"
        variant={isNodesLocked ? "filled" : "light"}
        onClick={onToggleNodeLock}
        title={isNodesLocked ? "Unlock Nodes" : "Lock Nodes"}
      >
        {isNodesLocked ? <IconLock size={16} /> : <IconLockOpen size={16} />}
      </ActionIcon>
    </Group>
  );
};