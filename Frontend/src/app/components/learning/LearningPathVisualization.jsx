import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Text, Group, ActionIcon } from '@mantine/core';
import { IconZoomIn, IconZoomOut, IconHome, IconLock, IconLockOpen } from '@tabler/icons-react';

// LearningPathVisualization Component - Interactive Network Learning Path with Pan/Zoom/Drag
export function LearningPathVisualization({ pathData, onNodeClick }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Pan/Zoom State
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

  // Define tag relationships and positions for the network layout with weights
  const tagRelationships = React.useMemo(() => ({
    'array': { 
      prerequisites: [], 
      unlocks: [
        { tag: 'hash-table', weight: 85, description: 'Arrays are fundamental for hash table implementations' },
        { tag: 'two-pointers', weight: 90, description: 'Array manipulation is core to two-pointer techniques' }
      ], 
      position: { x: 100, y: 200 } 
    },
    'hash-table': { 
      prerequisites: ['array'], 
      unlocks: [
        { tag: 'string', weight: 75, description: 'Hash tables optimize string processing algorithms' },
        { tag: 'dynamic-programming', weight: 60, description: 'Hash tables help memoization in DP solutions' }
      ], 
      position: { x: 250, y: 150 } 
    },
    'two-pointers': { 
      prerequisites: ['array'], 
      unlocks: [
        { tag: 'binary-search', weight: 70, description: 'Two pointers help understand binary search mechanics' },
        { tag: 'sliding-window', weight: 95, description: 'Sliding window is an advanced two-pointer pattern' }
      ], 
      position: { x: 250, y: 250 } 
    },
    'string': { 
      prerequisites: ['hash-table'], 
      unlocks: [
        { tag: 'dynamic-programming', weight: 80, description: 'String DP problems are common and build on string fundamentals' }
      ], 
      position: { x: 400, y: 100 } 
    },
    'binary-search': { 
      prerequisites: ['two-pointers'], 
      unlocks: [
        { tag: 'tree', weight: 85, description: 'Binary search concepts apply directly to tree traversal' }
      ], 
      position: { x: 400, y: 200 } 
    },
    'sliding-window': { 
      prerequisites: ['two-pointers'], 
      unlocks: [
        { tag: 'dynamic-programming', weight: 65, description: 'Some DP problems use sliding window optimizations' }
      ], 
      position: { x: 400, y: 300 } 
    },
    'dynamic-programming': { 
      prerequisites: ['string', 'hash-table', 'sliding-window'], 
      unlocks: [
        { tag: 'graph', weight: 75, description: 'Graph DP problems combine both concepts effectively' }
      ], 
      position: { x: 550, y: 200 } 
    },
    'stack': { 
      prerequisites: [], 
      unlocks: [
        { tag: 'tree', weight: 80, description: 'Stack-based tree traversal is essential for tree mastery' },
        { tag: 'graph', weight: 70, description: 'DFS in graphs commonly uses stack data structure' }
      ], 
      position: { x: 100, y: 350 } 
    },
    'queue': { 
      prerequisites: ['stack'], 
      unlocks: [
        { tag: 'tree', weight: 75, description: 'BFS tree traversal requires queue understanding' },
        { tag: 'graph', weight: 85, description: 'BFS graph algorithms are queue-dependent' }
      ], 
      position: { x: 250, y: 350 } 
    },
    'tree': { 
      prerequisites: ['binary-search', 'stack'], 
      unlocks: [
        { tag: 'graph', weight: 90, description: 'Trees are specialized graphs - direct skill transfer' }
      ], 
      position: { x: 400, y: 400 } 
    },
    'graph': { 
      prerequisites: ['dynamic-programming', 'tree', 'queue'], 
      unlocks: [], 
      position: { x: 700, y: 300 } 
    }
  }), []);

  // Initialize node positions with tag relationships data
  useEffect(() => {
    const positions = {};
    Object.entries(tagRelationships).forEach(([tag, data]) => {
      positions[tag] = { ...data.position };
    });
    setNodePositions(positions);
  }, [tagRelationships]);

  // Track theme changes for reactive background updates
  useEffect(() => {
    const updateTheme = () => {
      const currentDarkMode = document.body.getAttribute('data-theme') === 'dark';
      setIsDarkMode(currentDarkMode);
    };

    // Initial theme detection
    updateTheme();

    // Listen for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          updateTheme();
        }
      });
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    return () => observer.disconnect();
  }, []);

  // Pan/Zoom Event Handlers
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
  }, [isNodesLocked]);

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
  }, [draggedNode, isPanning, lastPanPoint, zoom, dragStartPos]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setDraggedNode(null);
    setDragStartPos(null);
    // Reset dragging flag after a short delay to allow click events to process first
    setTimeout(() => {
      setIsDragging(false);
    }, 50);
  }, []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.1), 3);
    
    // Note: Future enhancement could center zoom on mouse position
    
    setZoom(newZoom);
    setViewBox(prev => ({
      ...prev,
      width: 800 / newZoom,
      height: 480 / newZoom
    }));
  }, [zoom]);

  // Zoom Controls
  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(zoom * 1.2, 3);
    setZoom(newZoom);
    setViewBox(prev => ({
      ...prev,
      width: 800 / newZoom,
      height: 480 / newZoom
    }));
  }, [zoom]);

  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(zoom * 0.8, 0.1);
    setZoom(newZoom);
    setViewBox(prev => ({
      ...prev,
      width: 800 / newZoom,
      height: 480 / newZoom
    }));
  }, [zoom]);

  const handleResetView = useCallback(() => {
    setZoom(1);
    setViewBox({ x: 0, y: 0, width: 800, height: 480 });
  }, []);

  // Toggle node lock/unlock
  const handleToggleNodesLock = useCallback(() => {
    setIsNodesLocked(prev => !prev);
  }, []);

  // Attach global event listeners
  useEffect(() => {
    const handleGlobalMouseMove = (e) => handleMouseMove(e);
    const handleGlobalMouseUp = () => handleMouseUp();

    if (isPanning || draggedNode) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isPanning, draggedNode, handleMouseMove, handleMouseUp]);

  // Render SVG content
  useEffect(() => {
    if (!pathData || pathData.length === 0 || !svgRef.current) return;

    const svg = svgRef.current;
    svg.innerHTML = '';

    const svgElement = svg;
    svgElement.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);

    // Draw connections first (so they appear behind nodes)
    Object.entries(tagRelationships).forEach(([_tag, data]) => {
      data.unlocks.forEach(unlockData => {
        const unlockedTag = typeof unlockData === 'string' ? unlockData : unlockData.tag;
        const connectionWeight = typeof unlockData === 'object' ? unlockData.weight : 70;
        const connectionDescription = typeof unlockData === 'object' ? unlockData.description : 'Learning connection';
        
        const fromPos = nodePositions[_tag] || data.position;
        const toPos = nodePositions[unlockedTag] || tagRelationships[unlockedTag]?.position;
        
        if (fromPos && toPos) {
          const connectionId = `${_tag}->${unlockedTag}`;
          const isHovered = hoveredConnection === connectionId;
          
          // Calculate line thickness based on weight (2-6px range)
          const strokeWidth = Math.max(2, Math.min(6, (connectionWeight / 100) * 4 + 2));
          
          // Choose color based on weight strength
          let strokeColor = '#cbd5e1'; // default
          if (connectionWeight >= 85) strokeColor = '#10b981'; // strong - green
          else if (connectionWeight >= 70) strokeColor = '#3b82f6'; // medium - blue
          else if (connectionWeight >= 60) strokeColor = '#f59e0b'; // weak - orange
          else strokeColor = '#ef4444'; // very weak - red
          
          // Create connection group for hover handling
          const connectionGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          connectionGroup.setAttribute('class', 'connection-group');
          connectionGroup.setAttribute('data-connection', connectionId);
          connectionGroup.style.cursor = 'pointer';
          
          // Create invisible thick line for easier hover detection
          const hoverLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          hoverLine.setAttribute('x1', fromPos.x + 30);
          hoverLine.setAttribute('y1', fromPos.y + 30);
          hoverLine.setAttribute('x2', toPos.x + 30);
          hoverLine.setAttribute('y2', toPos.y + 30);
          hoverLine.setAttribute('stroke', 'transparent');
          hoverLine.setAttribute('stroke-width', '12'); // Thick for easy hovering
          connectionGroup.appendChild(hoverLine);
          
          // Create visible arrow line
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', fromPos.x + 30);
          line.setAttribute('y1', fromPos.y + 30);
          line.setAttribute('x2', toPos.x + 30);
          line.setAttribute('y2', toPos.y + 30);
          line.setAttribute('stroke', isHovered ? '#1d4ed8' : strokeColor);
          line.setAttribute('stroke-width', isHovered ? strokeWidth + 1 : strokeWidth);
          line.setAttribute('stroke-dasharray', connectionWeight >= 80 ? 'none' : '5,5');
          line.setAttribute('opacity', isHovered ? '1' : '0.8');
          connectionGroup.appendChild(line);

          // Create arrow head
          const arrowSize = isHovered ? 10 : 8;
          const angle = Math.atan2(toPos.y - fromPos.y, toPos.x - fromPos.x);
          const arrowX = toPos.x + 30 - arrowSize * Math.cos(angle);
          const arrowY = toPos.y + 30 - arrowSize * Math.sin(angle);
          
          const arrowHead = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
          const arrowPoints = [
            [arrowX, arrowY],
            [arrowX - arrowSize * Math.cos(angle - Math.PI/6), arrowY - arrowSize * Math.sin(angle - Math.PI/6)],
            [arrowX - arrowSize * Math.cos(angle + Math.PI/6), arrowY - arrowSize * Math.sin(angle + Math.PI/6)]
          ].map(point => point.join(',')).join(' ');
          
          arrowHead.setAttribute('points', arrowPoints);
          arrowHead.setAttribute('fill', isHovered ? '#1d4ed8' : strokeColor);
          arrowHead.setAttribute('opacity', isHovered ? '1' : '0.8');
          connectionGroup.appendChild(arrowHead);
          
          // Add hover event listeners
          connectionGroup.addEventListener('mouseenter', () => {
            setHoveredConnection(connectionId);
          });
          
          connectionGroup.addEventListener('mouseleave', () => {
            setHoveredConnection(null);
          });
          
          // Store connection data for tooltip
          connectionGroup.connectionData = {
            from: _tag,
            to: unlockedTag,
            weight: connectionWeight,
            description: connectionDescription
          };

          svgElement.appendChild(connectionGroup);
        }
      });
    });

    // Draw nodes
    pathData.forEach(tag => {
      const position = nodePositions[tag.tag] || tagRelationships[tag.tag]?.position;
      if (!position) return;

      const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      nodeGroup.setAttribute('class', 'node-group');
      nodeGroup.setAttribute('data-tag', tag.tag);
      
      // Set cursor based on lock state and drag state
      let cursor = 'pointer'; // Default for locked nodes (click only)
      if (!isNodesLocked) {
        cursor = draggedNode === tag.tag ? 'grabbing' : 'grab';
      }
      nodeGroup.setAttribute('cursor', cursor);
      nodeGroup.style.transition = draggedNode === tag.tag ? 'none' : 'all 0.2s ease';

      // Node circle
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', position.x + 30);
      circle.setAttribute('cy', position.y + 30);
      circle.setAttribute('r', '25');
      
      // Color based on status
      let fillColor = '#f1f5f9';
      let strokeColor = '#cbd5e1';
      if (tag.mastered) {
        fillColor = '#10b981';
        strokeColor = '#059669';
      } else if (tag.isFocus) {
        fillColor = '#3b82f6';
        strokeColor = '#1d4ed8';
      } else if (tag.progress > 0) {
        fillColor = '#f59e0b';
        strokeColor = '#d97706';
      }
      
      circle.setAttribute('fill', fillColor);
      circle.setAttribute('stroke', strokeColor);
      
      // Enhanced visual feedback for hovered nodes
      const isHovered = hoveredNode === tag.tag;
      
      if (isHovered) {
        circle.setAttribute('stroke-width', '4');
        circle.setAttribute('filter', 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))');
      } else {
        circle.setAttribute('stroke-width', '3');
        circle.removeAttribute('filter');
      }
      nodeGroup.appendChild(circle);

      // Progress ring
      if (tag.progress > 0 && !tag.mastered) {
        const progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        progressCircle.setAttribute('cx', position.x + 30);
        progressCircle.setAttribute('cy', position.y + 30);
        progressCircle.setAttribute('r', '22');
        progressCircle.setAttribute('fill', 'none');
        progressCircle.setAttribute('stroke', '#ffffff');
        progressCircle.setAttribute('stroke-width', '4');
        progressCircle.setAttribute('stroke-linecap', 'round');
        
        const circumference = 2 * Math.PI * 22;
        const strokeDasharray = (tag.progress / 100) * circumference;
        progressCircle.setAttribute('stroke-dasharray', `${strokeDasharray} ${circumference}`);
        progressCircle.setAttribute('transform', `rotate(-90 ${position.x + 30} ${position.y + 30})`);
        nodeGroup.appendChild(progressCircle);
      }

      // Status icon
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      icon.setAttribute('x', position.x + 30);
      icon.setAttribute('y', position.y + 35);
      icon.setAttribute('text-anchor', 'middle');
      icon.setAttribute('font-size', '16');
      icon.setAttribute('pointer-events', 'none');
      icon.textContent = tag.mastered ? '✅' : tag.isFocus ? '🎯' : tag.progress > 0 ? '📚' : '⚪';
      nodeGroup.appendChild(icon);

      // Tag label
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', position.x + 30);
      label.setAttribute('y', position.y + 75);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '12');
      label.setAttribute('font-weight', '600');
      // Aggressive approach: Use both fill attribute AND style property
      const isDarkMode = document.body.getAttribute('data-theme') === 'dark';
      const textColor = isDarkMode ? '#f8fafc' : '#374151';
      label.setAttribute('fill', textColor);
      label.style.fill = textColor + ' !important';
      label.style.color = textColor + ' !important';
      label.setAttribute('class', isDarkMode ? 'svg-text-dark' : 'svg-text-light');
      label.setAttribute('pointer-events', 'none');
      label.textContent = tag.tag;
      nodeGroup.appendChild(label);

      // Progress percentage
      if (tag.progress > 0) {
        const progressText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        progressText.setAttribute('x', position.x + 30);
        progressText.setAttribute('y', position.y + 90);
        progressText.setAttribute('text-anchor', 'middle');
        progressText.setAttribute('font-size', '10');
        // Aggressive approach for progress text too
        const isDarkModeProgress = document.body.getAttribute('data-theme') === 'dark';
        const progressTextColor = isDarkModeProgress ? '#e5e7eb' : '#6b7280';
        progressText.setAttribute('fill', progressTextColor);
        progressText.style.fill = progressTextColor + ' !important';
        progressText.style.color = progressTextColor + ' !important';
        progressText.setAttribute('pointer-events', 'none');
        progressText.textContent = `${tag.progress}%`;
        nodeGroup.appendChild(progressText);
      }

      // Event handlers
      nodeGroup.addEventListener('mouseenter', () => {
        setHoveredNode(tag.tag);
      });

      nodeGroup.addEventListener('mouseleave', () => {
        setHoveredNode(null);
      });

      nodeGroup.addEventListener('click', (_e) => {
        // Only trigger click if we weren't dragging
        if (!isDragging && onNodeClick) {
          onNodeClick(tag.tag);
        }
      });

      svgElement.appendChild(nodeGroup);
    });


  }, [pathData, onNodeClick, tagRelationships, nodePositions, viewBox, hoveredNode, draggedNode, hoveredConnection, isDragging, isNodesLocked]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Zoom Controls */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        right: '10px',
        zIndex: 20,
        background: isDarkMode ? 'rgba(55, 65, 81, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        borderRadius: '8px',
        padding: '8px',
        boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.1)',
        border: isDarkMode ? '1px solid #4b5563' : '1px solid #e2e8f0'
      }}>
        <Group gap="xs">
          <ActionIcon
            variant="light"
            size="sm"
            onClick={handleZoomIn}
            title="Zoom In"
            disabled={zoom >= 3}
          >
            <IconZoomIn size={16} />
          </ActionIcon>
          <ActionIcon
            variant="light"
            size="sm"
            onClick={handleZoomOut}
            title="Zoom Out"
            disabled={zoom <= 0.1}
          >
            <IconZoomOut size={16} />
          </ActionIcon>
          <ActionIcon
            variant="light"
            size="sm"
            onClick={handleResetView}
            title="Reset View"
          >
            <IconHome size={16} />
          </ActionIcon>
          <ActionIcon
            variant={isNodesLocked ? "filled" : "light"}
            size="sm"
            onClick={handleToggleNodesLock}
            title={isNodesLocked ? "Unlock Nodes (Enable Dragging)" : "Lock Nodes (Click Only)"}
            color={isNodesLocked ? "blue" : "gray"}
          >
            {isNodesLocked ? <IconLock size={16} /> : <IconLockOpen size={16} />}
          </ActionIcon>
        </Group>
        <Text size="xs" c="dimmed" ta="center" mt="xs">
          {Math.round(zoom * 100)}%
        </Text>
        <Text size="xs" c={isNodesLocked ? "blue" : "gray"} ta="center" mt="xs">
          {isNodesLocked ? "🔒 Click Only" : "🖱️ Draggable"}
        </Text>
      </div>

      {/* Main SVG Canvas */}
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{ 
          background: isDarkMode 
            ? 'linear-gradient(135deg, #1f2937 0%, #374151 100%)' // Dark gradient
            : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', // Light gradient
          borderRadius: '8px',
          cursor: isPanning ? 'grabbing' : draggedNode ? 'grabbing' : 'grab'
        }}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
      />
      
      {/* Hover tooltip */}
      {hoveredNode && (
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
          <Text size="sm" fw={600} c={isDarkMode ? '#f8fafc' : '#1a202c'} mb="xs">{hoveredNode}</Text>
          {(() => {
            const tagData = pathData.find(t => t.tag === hoveredNode);
            return tagData && (
              <div style={{ marginBottom: '6px' }}>
                <Text size="xs" c={isDarkMode ? '#e5e7eb' : '#4a5568'} fw={500}>
                  {tagData.progress}% mastery • {tagData.attempts || 0} attempts
                </Text>
                <Text size="xs" c={isDarkMode ? '#d1d5db' : '#718096'}>
                  Status: {tagData.mastered ? 'Mastered' : tagData.isFocus ? 'Focus Area' : tagData.progress > 0 ? 'In Progress' : 'Not Started'}
                </Text>
              </div>
            );
          })()}
          <Text size="xs" c={isDarkMode ? '#d1d5db' : '#718096'} style={{ fontStyle: 'italic' }}>
            {draggedNode ? '🖱️ Drag to move position' : '🖱️ Click for strategy details'}
          </Text>
        </div>
      )}

      {/* Connection hover tooltip */}
      {hoveredConnection && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px', // Position to avoid overlap with zoom controls at bottom-right
          background: isDarkMode ? 'rgba(55, 65, 81, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          color: isDarkMode ? '#f8fafc' : '#1a202c',
          padding: '10px 14px',
          borderRadius: '8px',
          fontSize: '12px',
          pointerEvents: 'none',
          zIndex: 15,
          maxWidth: '280px',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          boxShadow: '0 4px 12px rgba(59, 130, 246, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)'
        }}>
          {(() => {
            const [from, to] = hoveredConnection.split('->');
            const connectionData = document.querySelector(`[data-connection="${hoveredConnection}"]`)?.connectionData;
            
            if (connectionData) {
              const getWeightColor = (weight) => {
                if (weight >= 85) return '#10b981'; // strong - green
                if (weight >= 70) return '#3b82f6'; // medium - blue  
                if (weight >= 60) return '#f59e0b'; // weak - orange
                return '#ef4444'; // very weak - red
              };
              
              const getWeightLabel = (weight) => {
                if (weight >= 85) return 'Very Strong';
                if (weight >= 70) return 'Strong';
                if (weight >= 60) return 'Moderate';
                return 'Weak';
              };
              
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Text size="sm" fw={600} c={isDarkMode ? '#f8fafc' : '#1a202c'}>
                      {from} → {to}
                    </Text>
                    <div style={{ 
                      backgroundColor: getWeightColor(connectionData.weight),
                      color: 'white',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 600
                    }}>
                      {connectionData.weight}%
                    </div>
                  </div>
                  <Text size="xs" c={isDarkMode ? '#e5e7eb' : '#4a5568'} fw={500} mb="xs">
                    Connection Strength: {getWeightLabel(connectionData.weight)}
                  </Text>
                  <Text size="xs" c={isDarkMode ? '#d1d5db' : '#718096'} style={{ lineHeight: '1.4' }}>
                    {connectionData.description}
                  </Text>
                </>
              );
            }
            return <Text size="xs">Loading connection info...</Text>;
          })()}
        </div>
      )}


      {/* Pan/Zoom Indicator */}
      {(isPanning || draggedNode) && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(59, 130, 246, 0.9)',
          color: 'white',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          pointerEvents: 'none',
          zIndex: 15
        }}>
          {isPanning ? 'Panning...' : 'Moving node...'}
        </div>
      )}
    </div>
  );
}

export default LearningPathVisualization;