import logger from "../../../shared/utils/logger.js";
import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  getTourConfig, 
  isPageTourCompleted, 
  markPageTourCompleted 
} from './pageTourConfigs';

/**
 * Hook to manage page-specific tours
 * Automatically shows tours for pages that haven't been seen before
 */
export function usePageTour() {
  const { pathname } = useLocation();
  const [activeTour, setActiveTour] = useState(null);
  const [showTour, setShowTour] = useState(false);

  // Map route paths to tour IDs
  const getPageIdFromPath = useCallback((path) => {
    const pathMap = {
      '/ProbGen': 'probgen',
      '/Probgen': 'probgen', // Handle case variations
      '/ProbTime': 'probtime',
      '/Probtime': 'probtime',
      '/Timer': 'timer',
      '/ProbStat': 'probstat',
      '/Probstat': 'probstat',
      '/Settings': 'settings',
    };
    return pathMap[path];
  }, []);

  // Check and potentially show tour when route changes
  useEffect(() => {
    const checkAndShowTour = async () => {
      const pageId = getPageIdFromPath(pathname);
      
      if (!pageId) {
        // No tour configured for this page
        setActiveTour(null);
        setShowTour(false);
        return;
      }

      const tourConfig = getTourConfig(pageId);
      if (!tourConfig) {
        // No tour configuration found
        setActiveTour(null);
        setShowTour(false);
        return;
      }

      try {
        // Check if tour has already been completed (async database call)
        const isCompleted = await isPageTourCompleted(pageId);
        if (isCompleted) {
          // Tour already seen
          logger.info(`⏭️ Page tour already completed for: ${pageId}`);
          setActiveTour(null);
          setShowTour(false);
          return;
        }

        // Show tour for this page
        logger.info(`🎯 Showing page tour for: ${pageId}`);
        setActiveTour(tourConfig);
        
        // Small delay to ensure page elements are rendered
        setTimeout(() => {
          setShowTour(true);
        }, 500);
      } catch (error) {
        logger.error(`❌ Error checking page tour status for ${pageId}:`, error);
        // On error, don't show tour to avoid potential issues
        setActiveTour(null);
        setShowTour(false);
      }
    };

    checkAndShowTour();
  }, [pathname, getPageIdFromPath]);

  const handleTourComplete = useCallback(async () => {
    if (activeTour) {
      logger.info(`✅ Page tour completed: ${activeTour.id}`);
      try {
        await markPageTourCompleted(getPageIdFromPath(pathname));
      } catch (error) {
        logger.error(`❌ Error marking page tour completed:`, error);
        // Continue with UI update even if database update fails
      }
      setShowTour(false);
      setActiveTour(null);
    }
  }, [activeTour, pathname, getPageIdFromPath]);

  const handleTourClose = useCallback(() => {
    logger.info(`❌ Page tour closed: ${activeTour?.id}`);
    setShowTour(false);
    setActiveTour(null);
    // Note: We don't mark as completed when closed/skipped
    // So it will show again on next visit
  }, [activeTour]);

  return {
    showTour,
    tourConfig: activeTour,
    onTourComplete: handleTourComplete,
    onTourClose: handleTourClose,
  };
}