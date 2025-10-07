import { useEffect } from 'react';
import { SVGRenderService } from '../../services/svgRenderService.js';

/**
 * Custom hook for handling SVG rendering effects
 */
export function useSVGRenderer({
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
}) {
  useEffect(() => {
    if (!pathData || pathData.length === 0 || !svgRef.current) return;

    const svg = svgRef.current;
    svg.innerHTML = '';
    svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);

    // Render connections first (so they appear behind nodes) - only between visible tags
    SVGRenderService.renderConnections(svg, nodePositions, {
      hoveredConnection,
      isDarkMode,
      visibleTags: pathData,
      dynamicTagRelationships: tagRelationships,
      setHoveredConnection
    });

    // Render nodes
    SVGRenderService.renderNodes(svg, pathData, {
      nodePositions,
      hoveredNode,
      setHoveredNode,
      onNodeClick,
      isDarkMode
    });

  }, [pathData, tagRelationships, onNodeClick, nodePositions, viewBox, hoveredNode, setHoveredNode, draggedNode, hoveredConnection, setHoveredConnection, isDragging, isNodesLocked, isDarkMode, svgRef]);
}