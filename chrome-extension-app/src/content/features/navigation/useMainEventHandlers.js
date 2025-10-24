/**
 * Custom hooks for Main component event handlers
 */
import { useCallback } from "react";
import logger from "../../../shared/utils/logger.js";
import ChromeAPIErrorHandler from "../../../shared/services/ChromeAPIErrorHandler.js";

/**
 * Hook for content onboarding complete handler
 */
export function useContentOnboardingCompleteHandler(setShowContentOnboarding) {
  return useCallback(() => {
    setShowContentOnboarding(false);
    logger.info("Content onboarding completed");
  }, [setShowContentOnboarding]);
}

/**
 * Hook for content onboarding close handler
 */
export function useContentOnboardingCloseHandler(setShowContentOnboarding) {
  return useCallback(() => {
    setShowContentOnboarding(false);
  }, [setShowContentOnboarding]);
}

/**
 * Hook for timer tour complete handler
 */
export function useTimerTourCompleteHandler(setShowTimerTour) {
  return useCallback(async () => {
    try {
      await ChromeAPIErrorHandler.sendMessageWithRetry({
        type: 'markPageTourCompleted',
        pageId: 'timer_mini_tour'
      });
      setShowTimerTour(false);
      logger.info("🕐 Timer tour completed");
    } catch (error) {
      logger.error("Error completing timer tour:", error);
    }
  }, [setShowTimerTour]);
}

/**
 * Hook for timer tour close handler
 */
export function useTimerTourCloseHandler(setShowTimerTour) {
  return useCallback(() => {
    setShowTimerTour(false);
  }, [setShowTimerTour]);
}
