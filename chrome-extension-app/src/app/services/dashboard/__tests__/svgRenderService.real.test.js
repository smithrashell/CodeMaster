/**
 * Tests for SVGRenderService
 *
 * Covers: renderConnections, createConnectionGroup, createArrowHead,
 * renderNodes, createNode, getNodeColor.
 *
 * Uses JSDOM's built-in DOM/SVG support.
 */

import { SVGRenderService } from '../svgRenderService.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createSvg() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  document.body.appendChild(svg);
  return svg;
}

function cleanupSvg(svg) {
  if (svg && svg.parentNode) {
    svg.parentNode.removeChild(svg);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('SVGRenderService', () => {
  let svg;

  beforeEach(() => {
    svg = createSvg();
  });

  afterEach(() => {
    cleanupSvg(svg);
  });

  // ========================================================================
  // getNodeColor
  // ========================================================================
  describe('getNodeColor', () => {
    it('should return blue for focus tags (light mode)', () => {
      const color = SVGRenderService.getNodeColor({ isFocus: true }, false);
      expect(color).toBe('#3b82f6');
    });

    it('should return dark blue for focus tags (dark mode)', () => {
      const color = SVGRenderService.getNodeColor({ isFocus: true }, true);
      expect(color).toBe('#2563eb');
    });

    it('should return green for mastered status (light mode)', () => {
      const color = SVGRenderService.getNodeColor({ status: 'mastered' }, false);
      expect(color).toBe('#10b981');
    });

    it('should return dark green for mastered status (dark mode)', () => {
      const color = SVGRenderService.getNodeColor({ status: 'mastered' }, true);
      expect(color).toBe('#059669');
    });

    it('should return amber for learning status', () => {
      const color = SVGRenderService.getNodeColor({ status: 'learning' }, false);
      expect(color).toBe('#f59e0b');
    });

    it('should return gray for locked status', () => {
      const color = SVGRenderService.getNodeColor({ status: 'locked' }, false);
      expect(color).toBe('#9ca3af');
    });

    it('should return available color for unknown status', () => {
      const color = SVGRenderService.getNodeColor({ status: 'unknown' }, false);
      expect(color).toBe('#3b82f6');
    });

    it('should prioritize isFocus over status', () => {
      const color = SVGRenderService.getNodeColor({ isFocus: true, status: 'locked' }, false);
      expect(color).toBe('#3b82f6');
    });

    it('should handle nodeData without status as available', () => {
      const color = SVGRenderService.getNodeColor({}, false);
      expect(color).toBe('#3b82f6');
    });
  });

  // ========================================================================
  // createArrowHead
  // ========================================================================
  describe('createArrowHead', () => {
    it('should create a polygon SVG element', () => {
      const fromPos = { x: 0, y: 0 };
      const toPos = { x: 100, y: 100 };
      const arrow = SVGRenderService.createArrowHead(fromPos, toPos, false, '#10b981');

      expect(arrow.tagName).toBe('polygon');
      expect(arrow.getAttribute('fill')).toBe('#10b981');
      expect(arrow.getAttribute('points')).toBeTruthy();
      expect(arrow.getAttribute('opacity')).toBe('0.8');
    });

    it('should use blue fill and full opacity when hovered', () => {
      const fromPos = { x: 0, y: 0 };
      const toPos = { x: 50, y: 50 };
      const arrow = SVGRenderService.createArrowHead(fromPos, toPos, true, '#10b981');

      expect(arrow.getAttribute('fill')).toBe('#1d4ed8');
      expect(arrow.getAttribute('opacity')).toBe('1');
    });

    it('should produce different arrow sizes for hovered vs normal', () => {
      const fromPos = { x: 0, y: 0 };
      const toPos = { x: 100, y: 0 };
      const normalArrow = SVGRenderService.createArrowHead(fromPos, toPos, false, '#aaa');
      const hoveredArrow = SVGRenderService.createArrowHead(fromPos, toPos, true, '#aaa');

      // The points should differ because arrow size is 8 vs 10
      expect(normalArrow.getAttribute('points')).not.toBe(hoveredArrow.getAttribute('points'));
    });
  });

  // ========================================================================
  // createConnectionGroup
  // ========================================================================
  describe('createConnectionGroup', () => {
    it('should create a group with correct structure', () => {
      const fromPos = { x: 10, y: 20 };
      const toPos = { x: 200, y: 150 };
      const group = SVGRenderService.createConnectionGroup(fromPos, toPos, {
        weight: 50,
        isHovered: false,
        connectionId: 'tag1<->tag2',
        isDarkMode: false,
        setHoveredConnection: null,
      });

      expect(group.tagName).toBe('g');
      expect(group.getAttribute('class')).toBe('connection-group');
      expect(group.getAttribute('data-connection')).toBe('tag1<->tag2');
      // Should have: hover line, visible line, arrow head = 3 children
      expect(group.children.length).toBe(3);
    });

    it('should add hover event listeners when setHoveredConnection is provided', () => {
      const setHoveredConnection = jest.fn();
      const group = SVGRenderService.createConnectionGroup(
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        {
          weight: 70,
          isHovered: false,
          connectionId: 'a<->b',
          isDarkMode: false,
          setHoveredConnection,
        }
      );

      // Trigger mouseenter event
      const enterEvent = new Event('mouseenter');
      group.dispatchEvent(enterEvent);
      expect(setHoveredConnection).toHaveBeenCalledWith('a<->b');

      // Trigger mouseleave event
      const leaveEvent = new Event('mouseleave');
      group.dispatchEvent(leaveEvent);
      expect(setHoveredConnection).toHaveBeenCalledWith(null);
    });

    it('should use dashed stroke for connections with weight < 80', () => {
      const group = SVGRenderService.createConnectionGroup(
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        {
          weight: 50,
          isHovered: false,
          connectionId: 'x<->y',
          isDarkMode: false,
          setHoveredConnection: null,
        }
      );

      // The second line (visible) should have dashed stroke
      const visibleLine = group.children[1];
      expect(visibleLine.getAttribute('stroke-dasharray')).toBe('5,5');
    });

    it('should use solid stroke for connections with weight >= 80', () => {
      const group = SVGRenderService.createConnectionGroup(
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        {
          weight: 90,
          isHovered: false,
          connectionId: 'x<->y',
          isDarkMode: false,
          setHoveredConnection: null,
        }
      );

      const visibleLine = group.children[1];
      expect(visibleLine.getAttribute('stroke-dasharray')).toBe('none');
    });

    it('should use green color for weight >= 85', () => {
      const group = SVGRenderService.createConnectionGroup(
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        {
          weight: 90,
          isHovered: false,
          connectionId: 'x<->y',
          isDarkMode: false,
          setHoveredConnection: null,
        }
      );

      const visibleLine = group.children[1];
      expect(visibleLine.getAttribute('stroke')).toBe('#10b981');
    });

    it('should use blue color for weight >= 70', () => {
      const group = SVGRenderService.createConnectionGroup(
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        {
          weight: 75,
          isHovered: false,
          connectionId: 'x<->y',
          isDarkMode: false,
          setHoveredConnection: null,
        }
      );

      const visibleLine = group.children[1];
      expect(visibleLine.getAttribute('stroke')).toBe('#3b82f6');
    });

    it('should use amber color for weight >= 60', () => {
      const group = SVGRenderService.createConnectionGroup(
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        {
          weight: 65,
          isHovered: false,
          connectionId: 'x<->y',
          isDarkMode: false,
          setHoveredConnection: null,
        }
      );

      const visibleLine = group.children[1];
      expect(visibleLine.getAttribute('stroke')).toBe('#f59e0b');
    });

    it('should use red color for weight < 60', () => {
      const group = SVGRenderService.createConnectionGroup(
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        {
          weight: 30,
          isHovered: false,
          connectionId: 'x<->y',
          isDarkMode: false,
          setHoveredConnection: null,
        }
      );

      const visibleLine = group.children[1];
      expect(visibleLine.getAttribute('stroke')).toBe('#ef4444');
    });

    it('should use blue highlight when hovered', () => {
      const group = SVGRenderService.createConnectionGroup(
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        {
          weight: 50,
          isHovered: true,
          connectionId: 'x<->y',
          isDarkMode: false,
          setHoveredConnection: null,
        }
      );

      const visibleLine = group.children[1];
      expect(visibleLine.getAttribute('stroke')).toBe('#1d4ed8');
      expect(visibleLine.getAttribute('opacity')).toBe('1');
    });
  });

  // ========================================================================
  // renderConnections
  // ========================================================================
  describe('renderConnections', () => {
    it('should render connections for visible tags', () => {
      const nodePositions = {
        'array': { x: 100, y: 100 },
        'hashmap': { x: 300, y: 200 },
      };
      const dynamicTagRelationships = {
        'array:hashmap': {
          tag1: 'array',
          tag2: 'hashmap',
          strength: 5,
          successRate: 80,
          problems: ['p1', 'p2'],
        },
      };

      SVGRenderService.renderConnections(svg, nodePositions, {
        dynamicTagRelationships,
        isDarkMode: false,
      });

      // Should have appended one connection group
      expect(svg.children.length).toBe(1);
      expect(svg.children[0].getAttribute('class')).toBe('connection-group');
    });

    it('should not render connections when tags are not in positions', () => {
      const nodePositions = {
        'array': { x: 100, y: 100 },
      };
      const dynamicTagRelationships = {
        'array:hashmap': {
          tag1: 'array',
          tag2: 'hashmap',
          strength: 5,
          successRate: 80,
          problems: [],
        },
      };

      SVGRenderService.renderConnections(svg, nodePositions, {
        dynamicTagRelationships,
        isDarkMode: false,
      });

      expect(svg.children.length).toBe(0);
    });

    it('should skip connections when either tag is not in visibleTags', () => {
      const nodePositions = {
        'array': { x: 100, y: 100 },
        'hashmap': { x: 300, y: 200 },
      };
      const visibleTags = [{ tag: 'Array' }]; // Only Array visible

      SVGRenderService.renderConnections(svg, nodePositions, {
        dynamicTagRelationships: {
          'array:hashmap': {
            tag1: 'array',
            tag2: 'hashmap',
            strength: 3,
            successRate: 60,
            problems: [],
          },
        },
        visibleTags,
        isDarkMode: false,
      });

      // hashmap is not in visibleTags, so connection should be skipped
      expect(svg.children.length).toBe(0);
    });

    it('should render when both tags are in visibleTags', () => {
      const nodePositions = {
        'array': { x: 100, y: 100 },
        'hashmap': { x: 300, y: 200 },
      };
      const visibleTags = [{ tag: 'array' }, { tag: 'hashmap' }];

      SVGRenderService.renderConnections(svg, nodePositions, {
        dynamicTagRelationships: {
          'array:hashmap': {
            tag1: 'array',
            tag2: 'hashmap',
            strength: 3,
            successRate: 60,
            problems: [],
          },
        },
        visibleTags,
        isDarkMode: false,
      });

      expect(svg.children.length).toBe(1);
    });

    it('should handle empty relationships', () => {
      SVGRenderService.renderConnections(svg, {}, {
        dynamicTagRelationships: {},
        isDarkMode: false,
      });
      expect(svg.children.length).toBe(0);
    });
  });

  // ========================================================================
  // createNode
  // ========================================================================
  describe('createNode', () => {
    it('should create a node group with circle and text', () => {
      const nodeData = { tag: 'Array', status: 'mastered' };
      const positions = { Array: { x: 100, y: 100 } };

      const node = SVGRenderService.createNode(
        nodeData,
        positions,
        null,
        null,
        false,
        null
      );

      expect(node.tagName).toBe('g');
      expect(node.getAttribute('class')).toBe('node-group');
      expect(node.getAttribute('data-tag')).toBe('Array');

      // Should contain circle and text
      const circle = node.querySelector('circle');
      const text = node.querySelector('text');
      expect(circle).not.toBeNull();
      expect(text).not.toBeNull();
      expect(text.textContent).toBe('Array');
    });

    it('should truncate tag name to 8 characters in the label', () => {
      const nodeData = { tag: 'DynamicProgramming', status: 'learning' };
      const positions = { DynamicProgramming: { x: 50, y: 50 } };

      const node = SVGRenderService.createNode(
        nodeData,
        positions,
        null,
        null,
        false,
        null
      );

      const text = node.querySelector('text');
      expect(text.textContent).toBe('DynamicP');
    });

    it('should enlarge circle when hovered', () => {
      const nodeData = { tag: 'BFS', status: 'available' };
      const positions = { BFS: { x: 200, y: 200 } };

      const hoveredNode = SVGRenderService.createNode(
        nodeData,
        positions,
        'BFS',
        null,
        false,
        null
      );
      const normalNode = SVGRenderService.createNode(
        nodeData,
        positions,
        null,
        null,
        false,
        null
      );

      const hoveredR = hoveredNode.querySelector('circle').getAttribute('r');
      const normalR = normalNode.querySelector('circle').getAttribute('r');
      expect(Number(hoveredR)).toBeGreaterThan(Number(normalR));
    });

    it('should use node position from nodePositions', () => {
      const nodeData = { tag: 'Stack' };
      const positions = { Stack: { x: 42, y: 73 } };

      const node = SVGRenderService.createNode(nodeData, positions, null, null, false, null);
      expect(node.getAttribute('transform')).toBe('translate(42, 73)');
    });

    it('should fall back to nodeData.position when not in nodePositions', () => {
      const nodeData = { tag: 'Queue', position: { x: 10, y: 20 } };
      const positions = {};

      const node = SVGRenderService.createNode(nodeData, positions, null, null, false, null);
      expect(node.getAttribute('transform')).toBe('translate(10, 20)');
    });

    it('should fall back to (0,0) when no position available', () => {
      const nodeData = { tag: 'Heap' };
      const positions = {};

      const node = SVGRenderService.createNode(nodeData, positions, null, null, false, null);
      expect(node.getAttribute('transform')).toBe('translate(0, 0)');
    });

    it('should add hover listeners when setHoveredNode is provided', () => {
      const setHoveredNode = jest.fn();
      const nodeData = { tag: 'Tree' };
      const positions = { Tree: { x: 0, y: 0 } };

      const node = SVGRenderService.createNode(nodeData, positions, null, null, false, setHoveredNode);

      node.dispatchEvent(new Event('mouseenter'));
      expect(setHoveredNode).toHaveBeenCalledWith('Tree');

      node.dispatchEvent(new Event('mouseleave'));
      expect(setHoveredNode).toHaveBeenCalledWith(null);
    });

    it('should use dark mode text color when isDarkMode is true', () => {
      const nodeData = { tag: 'Graph' };
      const positions = { Graph: { x: 0, y: 0 } };

      const darkNode = SVGRenderService.createNode(nodeData, positions, null, null, true, null);
      const lightNode = SVGRenderService.createNode(nodeData, positions, null, null, false, null);

      const darkFill = darkNode.querySelector('text').getAttribute('fill');
      const lightFill = lightNode.querySelector('text').getAttribute('fill');
      expect(darkFill).not.toBe(lightFill);
    });
  });

  // ========================================================================
  // renderNodes
  // ========================================================================
  describe('renderNodes', () => {
    it('should render nodes for all pathData entries', () => {
      const pathData = [
        { tag: 'Array', status: 'mastered' },
        { tag: 'String', status: 'learning' },
        { tag: 'Tree', status: 'locked' },
      ];
      const nodePositions = {
        Array: { x: 100, y: 100 },
        String: { x: 200, y: 200 },
        Tree: { x: 300, y: 300 },
      };

      SVGRenderService.renderNodes(svg, pathData, {
        nodePositions,
        hoveredNode: null,
        onNodeClick: null,
        isDarkMode: false,
        setHoveredNode: null,
      });

      expect(svg.children.length).toBe(3);
    });

    it('should render zero nodes for empty pathData', () => {
      SVGRenderService.renderNodes(svg, [], {
        nodePositions: {},
        hoveredNode: null,
        onNodeClick: null,
        isDarkMode: false,
        setHoveredNode: null,
      });

      expect(svg.children.length).toBe(0);
    });
  });
});
