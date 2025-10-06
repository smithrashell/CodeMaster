import { useEffect } from 'react';
import { calculateForceDirectedLayout } from './forceDirectedLayout.js';

/**
 * Custom hooks for managing theme detection and node positioning effects
 */

/**
 * Initialize node positions using force-directed layout based on dynamic tag relationships
 */
export function useNodePositionInitialization(setNodePositions, pathData, dynamicTagRelationships) {
  useEffect(() => {
    if (!pathData || pathData.length === 0) {
      return;
    }

    console.log('🎨 Initializing node positions with force-directed layout:', {
      pathDataCount: pathData.length,
      relationshipCount: Object.keys(dynamicTagRelationships || {}).length
    });

    const positions = calculateForceDirectedLayout(pathData, dynamicTagRelationships);
    setNodePositions(positions);
  }, [setNodePositions, pathData, dynamicTagRelationships]);
}

/**
 * Track theme changes for reactive background updates
 */
export function useThemeDetection(setIsDarkMode) {
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
  }, [setIsDarkMode]);
}

/**
 * Attach global event listeners for mouse events
 */
export function useGlobalEventListeners(isPanning, draggedNode, handleMouseMove, handleMouseUp) {
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
}