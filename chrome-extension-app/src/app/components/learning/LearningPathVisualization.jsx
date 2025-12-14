import React, { useRef } from 'react';
import { useLearningPathState } from '../../hooks/useLearningPathState.js';
import { SVGControls } from './SVGControls.jsx';
import { useVisualizationEventHandlers } from './useVisualizationEventHandlers.js';
import { useNodePositionInitialization, useThemeDetection, useGlobalEventListeners } from './useVisualizationEffects.js';
import { useSVGRenderer } from './useSVGRenderer.js';
import { HoverTooltip } from './HoverTooltip.jsx';

// LearningPathVisualization Component - Interactive Network Learning Path with Pan/Zoom/Drag
export function LearningPathVisualization({ pathData, tagRelationships, onNodeClick }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  const {
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
  } = useLearningPathState();

  // Initialize node positions and handle theme detection
  useNodePositionInitialization(setNodePositions, pathData, tagRelationships);
  useThemeDetection(setIsDarkMode);

  // Event handlers for mouse interactions and zoom controls
  const {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    handleZoomIn,
    handleZoomOut,
    handleResetView,
    handleToggleNodesLock
  } = useVisualizationEventHandlers({
    isNodesLocked,
    zoom,
    dragStartPos,
    draggedNode,
    isPanning,
    lastPanPoint,
    setDragStartPos,
    setIsDragging,
    setDraggedNode,
    setIsPanning,
    setLastPanPoint,
    setNodePositions,
    setViewBox,
    setZoom,
    setIsNodesLocked
  });

  // Attach global event listeners
  useGlobalEventListeners(isPanning, draggedNode, handleMouseMove, handleMouseUp);

  // Handle SVG rendering
  useSVGRenderer({
    pathData,
    tagRelationships,
    onNodeClick,
    nodePositions,
    viewBox,
    hoveredNode,
    setHoveredNode,
    draggedNode,
    hoveredConnection,
    setHoveredConnection,
    isDragging,
    isNodesLocked,
    isDarkMode,
    svgRef
  });

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <SVGControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
        isNodesLocked={isNodesLocked}
        onToggleNodeLock={handleToggleNodesLock}
        zoom={zoom}
      />
      
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{
          background: 'var(--cm-bg-secondary)',
          borderRadius: '8px',
          cursor: isPanning ? 'grabbing' : draggedNode ? 'grabbing' : 'grab'
        }}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
      />
      
      <HoverTooltip
        hoveredNode={hoveredNode}
        hoveredConnection={hoveredConnection}
        pathData={pathData}
        tagRelationships={tagRelationships}
      />
    </div>
  );
}

export default LearningPathVisualization;
