import { useState } from 'react';

export const useLearningPathState = () => {
  const [hoveredNode, setHoveredNode] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, width: 800, height: 480 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  const [draggedNode, setDraggedNode] = useState(null);
  const [nodePositions, setNodePositions] = useState({});
  const [hoveredConnection, setHoveredConnection] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState(null);
  const [isNodesLocked, setIsNodesLocked] = useState(true);

  return {
    hoveredNode, setHoveredNode,
    isDarkMode, setIsDarkMode,
    viewBox, setViewBox,
    zoom, setZoom,
    isPanning, setIsPanning,
    lastPanPoint, setLastPanPoint,
    draggedNode, setDraggedNode,
    nodePositions, setNodePositions,
    hoveredConnection, setHoveredConnection,
    isDragging, setIsDragging,
    dragStartPos, setDragStartPos,
    isNodesLocked, setIsNodesLocked
  };
};