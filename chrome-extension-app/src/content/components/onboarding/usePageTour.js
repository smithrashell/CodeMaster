import logger from "../../../shared/utils/logger.js";
import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  getTourConfig,
  isPageTourCompleted,
  markPageTourCompleted
} from './pageTourConfigs';

/**
 * Helper to check installation status via Chrome messaging
 */
function checkInstallationStatus() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "checkInstallationOnboardingStatus" }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(`Chrome runtime error: ${chrome.runtime.lastError.message}`));
      } else if (!response) {
        reject(new Error('No response from background script'));
      } else if (response.error) {
        reject(new Error(`Background script error: ${response.error}`));
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Hook to manage page-specific tours
 * Automatically shows tours for pages that haven't been seen before
 */
export function usePageTour() {
  const { pathname } = useLocation();
  const [activeTour, setActiveTour] = useState(null);
  const [showTour, setShowTour] = useState(false);
  
  logger.info(`🎯 usePageTour: Hook initialized, pathname: "${pathname}"`);

  // Map route paths to tour IDs
  const getPageIdFromPath = useCallback((path) => {
    const pathMap = {
      '/ProbGen': 'probgen',
      '/Probgen': 'probgen', // Handle mixed case - this matches the actual route!
      '/probgen': 'probgen', // Handle lowercase
      '/ProbTime': 'probtime',
      '/Probtime': 'probtime',
      '/probtime': 'probtime', // Handle lowercase
      '/Timer': 'timer',
      '/timer': 'timer', // Handle lowercase
      '/ProbStat': 'probstat',
      '/Probstat': 'probstat',
      '/probstat': 'probstat', // Handle lowercase
      '/Settings': 'settings',
      '/settings': 'settings', // Handle lowercase
    };
    return pathMap[path];
  }, []);

  // Check and potentially show tour when route changes
  useEffect(() => {
    const checkAndShowTour = async () => {
      logger.info(`🎯 usePageTour: Route changed to "${pathname}"`);
      const pageId = getPageIdFromPath(pathname);
      logger.info(`🎯 usePageTour: Mapped to pageId "${pageId}"`);

      if (!pageId) {
        setActiveTour(null);
        setShowTour(false);
        return;
      }

      const tourConfig = getTourConfig(pageId);
      if (!tourConfig) {
        setActiveTour(null);
        setShowTour(false);
        return;
      }

      try {
        // STEP 1: First check if installation/database seeding is complete
        const installationStatus = await checkInstallationStatus();
        logger.info(`🎯 usePageTour: Installation status for page ${pageId}:`, installationStatus);

        if (!installationStatus.isComplete) {
          logger.info(`⏳ Installation not complete - hiding page tour for: ${pageId}`, {
            isComplete: installationStatus.isComplete,
            timestamp: installationStatus.timestamp
          });
          setActiveTour(null);
          setShowTour(false);
          return;
        }

        // STEP 2: Installation complete, check if tour has already been completed
        const isCompleted = await isPageTourCompleted(pageId);
        if (isCompleted) {
          logger.info(`⏭️ Page tour already completed for: ${pageId}`);
          setActiveTour(null);
          setShowTour(false);
          return;
        }

        // STEP 3: Show tour for this page
        logger.info(`✅ Installation complete and page tour not completed - showing tour for: ${pageId}`);
        setActiveTour(tourConfig);

        // Small delay to ensure page elements are rendered
        setTimeout(() => {
          setShowTour(true);
        }, 500);
      } catch (error) {
        logger.error(`❌ Error checking tour status for ${pageId}:`, error);
        // On error, don't show tour to avoid potential issues
        setActiveTour(null);
        setShowTour(false);
      }
    };

    checkAndShowTour();
  }, [pathname, getPageIdFromPath]);

  // Debug: Log every pathname change
  useEffect(() => {
    logger.info(`🎯 usePageTour: pathname dependency changed to "${pathname}"`);
  }, [pathname]);

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