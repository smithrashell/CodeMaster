import { useCallback } from 'react';
import { useZoomHandlers } from './useZoomHandlers.js';

/**
 * Custom hook for handling all mouse and zoom event interactions
 * in the LearningPathVisualization component
 */
export function useVisualizationEventHandlers({
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
}) {
  // Extract zoom handlers to separate hook
  const { handleWheel, handleZoomIn, handleZoomOut, handleZoomReset } = useZoomHandlers({
    zoom,
    setZoom,
    setViewBox
  });

  // Pan/Node Drag Event Handlers
  const handleMouseDown = useCallback((e) => {
    const startPos = { x: e.clientX, y: e.clientY };
    setDragStartPos(startPos);
    setIsDragging(false);
    
    if (e.target.closest('.node-group') && !isNodesLocked) {
      // Node dragging (only when unlocked)
      const nodeTag = e.target.closest('.node-group').dataset.tag;
      setDraggedNode(nodeTag);
      setLastPanPoint(startPos);
    } else if (!e.target.closest('.node-group')) {
      // Canvas panning (only when not clicking on a node)
      setIsPanning(true);
      setLastPanPoint(startPos);
    }
    e.preventDefault();
  }, [isNodesLocked, setDragStartPos, setIsDragging, setDraggedNode, setIsPanning, setLastPanPoint]);

  const handleMouseMove = useCallback((e) => {
    // Calculate total distance from start to determine if this is a drag
    if (dragStartPos && (draggedNode || isPanning)) {
      const totalDistance = Math.sqrt(
        Math.pow(e.clientX - dragStartPos.x, 2) + 
        Math.pow(e.clientY - dragStartPos.y, 2)
      );
      
      // Only mark as dragging if moved more than 8 pixels AND we're in a drag operation
      if (totalDistance > 8) {
        setIsDragging(true);
      }
    }
    
    if (draggedNode) {
      // Node dragging
      const dx = (e.clientX - lastPanPoint.x) / zoom;
      const dy = (e.clientY - lastPanPoint.y) / zoom;
      
      setNodePositions(prev => ({
        ...prev,
        [draggedNode]: {
          x: prev[draggedNode].x + dx,
          y: prev[draggedNode].y + dy
        }
      }));
      
      setLastPanPoint({ x: e.clientX, y: e.clientY });
    } else if (isPanning) {
      // Canvas panning
      const dx = (e.clientX - lastPanPoint.x) / zoom;
      const dy = (e.clientY - lastPanPoint.y) / zoom;
      
      setViewBox(prev => ({
        ...prev,
        x: prev.x - dx,
        y: prev.y - dy
      }));
      
      setLastPanPoint({ x: e.clientX, y: e.clientY });
    }
  }, [draggedNode, isPanning, lastPanPoint, zoom, dragStartPos, setIsDragging, setNodePositions, setLastPanPoint, setViewBox]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setDraggedNode(null);
    setDragStartPos(null);
    // Reset dragging flag after a short delay to allow click events to process first
    setTimeout(() => {
      setIsDragging(false);
    }, 50);
  }, [setIsPanning, setDraggedNode, setDragStartPos, setIsDragging]);


  // Toggle node lock/unlock
  const handleToggleNodesLock = useCallback(() => {
    setIsNodesLocked(prev => !prev);
  }, [setIsNodesLocked]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    handleZoomIn,
    handleZoomOut,
    handleResetView: handleZoomReset,
    handleToggleNodesLock
  };
}