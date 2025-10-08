/**
 * Force-directed graph layout algorithm for dynamic tag positioning
 * Based on tag relationships from actual attempt data
 */

/**
 * Apply repulsion forces between all node pairs (Coulomb's law)
 */
function applyRepulsionForces(visibleTags, positions, forces, repulsionStrength) {
  for (let i = 0; i < visibleTags.length; i++) {
    for (let j = i + 1; j < visibleTags.length; j++) {
      const tag1 = visibleTags[i];
      const tag2 = visibleTags[j];
      const pos1 = positions[tag1];
      const pos2 = positions[tag2];

      const dx = pos2.x - pos1.x;
      const dy = pos2.y - pos1.y;
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq) || 1;

      // Repulsion force (Coulomb's law)
      const force = repulsionStrength / distSq;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      forces[tag1].fx -= fx;
      forces[tag1].fy -= fy;
      forces[tag2].fx += fx;
      forces[tag2].fy += fy;
    }
  }
}

/**
 * Calculate force-directed layout positions for tags
 * @param {Array} pathData - Array of tag data with mastery info
 * @param {Object} tagRelationships - Dynamic relationships: { "tag1:tag2": { tag1, tag2, strength, ... } }
 * @returns {Object} - Map of tag positions: { tagName: { x, y } }
 */
export function calculateForceDirectedLayout(pathData, tagRelationships) {
  if (!pathData || pathData.length === 0) {
    return {};
  }

  // Extract all visible tags
  const visibleTags = pathData.map(node => node.tag.toLowerCase());

  // Build adjacency list from dynamic relationships
  const connections = new Map();
  visibleTags.forEach(tag => connections.set(tag, []));

  Object.entries(tagRelationships || {}).forEach(([_key, data]) => {
    const { tag1, tag2, strength } = data;
    if (visibleTags.includes(tag1) && visibleTags.includes(tag2)) {
      connections.get(tag1)?.push({ target: tag2, strength });
      connections.get(tag2)?.push({ target: tag1, strength });
    }
  });

  // Initialize positions randomly in a circle pattern
  const positions = {};
  const centerX = 500;
  const centerY = 300;
  const radius = 200;

  visibleTags.forEach((tag, index) => {
    const angle = (index / visibleTags.length) * 2 * Math.PI;
    positions[tag] = {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
      vx: 0,
      vy: 0
    };
  });

  // Force simulation parameters
  const iterations = 100;
  const repulsionStrength = 5000;
  const attractionStrength = 0.01;
  const damping = 0.8;

  // Run force simulation
  for (let iter = 0; iter < iterations; iter++) {
    // Calculate forces
    const forces = {};
    visibleTags.forEach(tag => {
      forces[tag] = { fx: 0, fy: 0 };
    });

    // Repulsion force between all nodes
    applyRepulsionForces(visibleTags, positions, forces, repulsionStrength);

    // Attraction force along connections
    Object.entries(tagRelationships || {}).forEach(([_key, data]) => {
      const { tag1, tag2, strength } = data;
      if (!visibleTags.includes(tag1) || !visibleTags.includes(tag2)) return;

      const pos1 = positions[tag1];
      const pos2 = positions[tag2];

      const dx = pos2.x - pos1.x;
      const dy = pos2.y - pos1.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      // Attraction force (Hooke's law) - stronger connections pull harder
      const force = attractionStrength * (strength / 10) * dist;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      forces[tag1].fx += fx;
      forces[tag1].fy += fy;
      forces[tag2].fx -= fx;
      forces[tag2].fy -= fy;
    });

    // Apply forces with velocity and damping
    visibleTags.forEach(tag => {
      const pos = positions[tag];
      const force = forces[tag];

      pos.vx = (pos.vx + force.fx) * damping;
      pos.vy = (pos.vy + force.fy) * damping;

      pos.x += pos.vx;
      pos.y += pos.vy;
    });

    // Center of mass correction - keep graph centered
    const centerOfMassX = visibleTags.reduce((sum, tag) => sum + positions[tag].x, 0) / visibleTags.length;
    const centerOfMassY = visibleTags.reduce((sum, tag) => sum + positions[tag].y, 0) / visibleTags.length;
    const offsetX = centerX - centerOfMassX;
    const offsetY = centerY - centerOfMassY;

    visibleTags.forEach(tag => {
      positions[tag].x += offsetX * 0.1;
      positions[tag].y += offsetY * 0.1;
    });
  }

  // Convert to final format (remove velocity)
  const finalPositions = {};
  visibleTags.forEach(tag => {
    finalPositions[tag] = {
      x: Math.round(positions[tag].x),
      y: Math.round(positions[tag].y)
    };
  });

  console.log('🎯 Force-directed layout calculated:', {
    tagCount: visibleTags.length,
    connectionCount: Object.keys(tagRelationships || {}).length,
    samplePositions: Object.entries(finalPositions).slice(0, 3)
  });

  return finalPositions;
}
