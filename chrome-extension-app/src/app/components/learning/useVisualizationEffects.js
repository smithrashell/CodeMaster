import { useEffect } from 'react';
import { calculateForceDirectedLayout } from './forceDirectedLayout.js';
import ChromeAPIErrorHandler from '../../../shared/services/chrome/chromeAPIErrorHandler.js';

/**
 * Custom hooks for managing theme detection and node positioning effects
 */

/**
 * Initialize node positions - load saved positions first, run layout only for new tags
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

    // Try loading saved positions, then merge with layout for any new tags
    (async () => {
      let savedPositions = null;
      try {
        const response = await ChromeAPIErrorHandler.sendMessageWithRetry({
          type: 'getStorage',
          key: 'learning_path_node_positions'
        });
        if (response && typeof response === 'object' && !response.error) {
          savedPositions = response;
        }
      } catch {
        // No saved positions - will use full layout
      }

      const layoutPositions = calculateForceDirectedLayout(pathData, dynamicTagRelationships);

      if (savedPositions) {
        // Use saved positions for known tags, layout positions for new tags
        const merged = { ...layoutPositions };
        const allTags = Object.keys(layoutPositions);
        for (const tag of allTags) {
          if (savedPositions[tag]) {
            merged[tag] = savedPositions[tag];
          }
        }
        setNodePositions(merged);
      } else {
        setNodePositions(layoutPositions);
      }
    })();
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