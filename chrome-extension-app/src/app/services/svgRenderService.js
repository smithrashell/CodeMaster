export class SVGRenderService {
  static renderConnections(svg, nodePositions, hoveredConnection, isDarkMode, visibleTags = null, dynamicTagRelationships = {}, setHoveredConnection = null) {
    console.log('🎨 SVGRenderService.renderConnections called:', {
      relationshipCount: Object.keys(dynamicTagRelationships).length,
      visibleTagCount: visibleTags?.length || 0,
      sampleRelationship: Object.keys(dynamicTagRelationships)[0]
    });

    // If visibleTags is provided, create a Set for fast lookup
    const visibleTagSet = visibleTags ? new Set(visibleTags.map(node => node.tag)) : null;

    // Use dynamic tag relationships (co-occurrence from attempts)
    // Format: { "tag1:tag2": { tag1, tag2, strength, problems, successRate, successCount } }
    Object.entries(dynamicTagRelationships).forEach(([key, connectionData]) => {
      const { tag1, tag2, strength, successRate, problems } = connectionData;

      // Skip if either tag is not in visible tags
      if (visibleTagSet && (!visibleTagSet.has(tag1) || !visibleTagSet.has(tag2))) return;

      const fromPos = nodePositions[tag1];
      const toPos = nodePositions[tag2];

      if (fromPos && toPos) {
        const connectionId = `${tag1}<->${tag2}`;
        const isHovered = hoveredConnection === connectionId;

        // Use strength (number of problems) to determine weight (convert to 0-100 scale)
        // Map strength: 1-2 problems = weak, 3-5 = medium, 6+ = strong
        const normalizedWeight = Math.min(100, (strength / 10) * 100);

        const connectionGroup = this.createConnectionGroup(fromPos, toPos, {
          weight: normalizedWeight,
          isHovered,
          connectionId,
          isDarkMode,
          description: `${strength} problem${strength > 1 ? 's' : ''} | ${successRate}% success`,
          setHoveredConnection,
          connectionData // Pass full data for tooltip
        });

        svg.appendChild(connectionGroup);
      }
    });
  }

  static createConnectionGroup(fromPos, toPos, config) {
    const { weight, isHovered, connectionId, isDarkMode, setHoveredConnection } = config;
    const connectionGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    connectionGroup.setAttribute('class', 'connection-group');
    connectionGroup.setAttribute('data-connection', connectionId);
    connectionGroup.style.cursor = 'pointer';

    // Add hover detection
    if (setHoveredConnection) {
      connectionGroup.addEventListener('mouseenter', () => setHoveredConnection(connectionId));
      connectionGroup.addEventListener('mouseleave', () => setHoveredConnection(null));
    }
    
    // Calculate line thickness based on weight (2-6px range)
    const strokeWidth = Math.max(2, Math.min(6, (weight / 100) * 4 + 2));
    
    // Choose color based on weight strength
    let strokeColor = isDarkMode ? '#64748b' : '#cbd5e1';
    if (weight >= 85) strokeColor = '#10b981';
    else if (weight >= 70) strokeColor = '#3b82f6';
    else if (weight >= 60) strokeColor = '#f59e0b';
    else strokeColor = '#ef4444';
    
    // Create invisible thick line for easier hover detection
    const hoverLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    hoverLine.setAttribute('x1', fromPos.x + 30);
    hoverLine.setAttribute('y1', fromPos.y + 30);
    hoverLine.setAttribute('x2', toPos.x + 30);
    hoverLine.setAttribute('y2', toPos.y + 30);
    hoverLine.setAttribute('stroke', 'transparent');
    hoverLine.setAttribute('stroke-width', '12');
    connectionGroup.appendChild(hoverLine);
    
    // Create visible arrow line
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', fromPos.x + 30);
    line.setAttribute('y1', fromPos.y + 30);
    line.setAttribute('x2', toPos.x + 30);
    line.setAttribute('y2', toPos.y + 30);
    line.setAttribute('stroke', isHovered ? '#1d4ed8' : strokeColor);
    line.setAttribute('stroke-width', isHovered ? strokeWidth + 1 : strokeWidth);
    line.setAttribute('stroke-dasharray', weight >= 80 ? 'none' : '5,5');
    line.setAttribute('opacity', isHovered ? '1' : '0.8');
    connectionGroup.appendChild(line);

    // Create arrow head
    const arrowHead = this.createArrowHead(fromPos, toPos, isHovered, strokeColor);
    connectionGroup.appendChild(arrowHead);

    return connectionGroup;
  }

  static createArrowHead(fromPos, toPos, isHovered, strokeColor) {
    const arrowSize = isHovered ? 10 : 8;
    const angle = Math.atan2(toPos.y - fromPos.y, toPos.x - fromPos.x);
    const arrowX = toPos.x + 30 - arrowSize * Math.cos(angle);
    const arrowY = toPos.y + 30 - arrowSize * Math.sin(angle);
    
    const arrowHead = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    const arrowPoints = [
      [arrowX, arrowY],
      [arrowX - arrowSize * Math.cos(angle - Math.PI/6), arrowY - arrowSize * Math.sin(angle - Math.PI/6)],
      [arrowX - arrowSize * Math.cos(angle + Math.PI/6), arrowY - arrowSize * Math.sin(angle + Math.PI/6)]
    ];
    
    arrowHead.setAttribute('points', arrowPoints.map(p => p.join(',')).join(' '));
    arrowHead.setAttribute('fill', isHovered ? '#1d4ed8' : strokeColor);
    arrowHead.setAttribute('opacity', isHovered ? '1' : '0.8');
    
    return arrowHead;
  }

  static renderNodes(svg, pathData, config) {
    const { nodePositions, hoveredNode, onNodeClick, isDarkMode, setHoveredNode } = config;
    pathData.forEach(nodeData => {
      const node = this.createNode(nodeData, nodePositions, hoveredNode, onNodeClick, isDarkMode, setHoveredNode);
      svg.appendChild(node);
    });
  }

  static createNode(nodeData, nodePositions, hoveredNode, onNodeClick, isDarkMode, setHoveredNode) {
    const position = nodePositions[nodeData.tag] || nodeData.position || { x: 0, y: 0 };
    const isHovered = hoveredNode === nodeData.tag;
    
    const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    nodeGroup.setAttribute('class', 'node-group');
    nodeGroup.setAttribute('data-tag', nodeData.tag);
    nodeGroup.style.cursor = 'pointer';
    nodeGroup.setAttribute('transform', `translate(${position.x}, ${position.y})`);

    // Add hover detection
    if (setHoveredNode) {
      nodeGroup.addEventListener('mouseenter', () => setHoveredNode(nodeData.tag));
      nodeGroup.addEventListener('mouseleave', () => setHoveredNode(null));
    }
    
    // Create background circle
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', 30);
    circle.setAttribute('cy', 30);
    circle.setAttribute('r', isHovered ? 32 : 30);
    
    const fillColor = this.getNodeColor(nodeData.status, isDarkMode);
    circle.setAttribute('fill', fillColor);
    circle.setAttribute('stroke', isHovered ? '#1d4ed8' : '#e2e8f0');
    circle.setAttribute('stroke-width', isHovered ? '3' : '2');
    
    nodeGroup.appendChild(circle);
    
    // Add text label
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', 30);
    text.setAttribute('y', 35);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', '12');
    text.setAttribute('font-weight', 'bold');
    text.setAttribute('fill', isDarkMode ? '#e2e8f0' : '#1f2937');
    text.textContent = nodeData.tag.substring(0, 8);
    
    nodeGroup.appendChild(text);
    
    return nodeGroup;
  }

  static getNodeColor(status, isDarkMode) {
    const colors = {
      mastered: isDarkMode ? '#059669' : '#10b981',
      learning: isDarkMode ? '#d97706' : '#f59e0b', 
      locked: isDarkMode ? '#6b7280' : '#9ca3af',
      available: isDarkMode ? '#2563eb' : '#3b82f6'
    };
    return colors[status] || colors.available;
  }
}