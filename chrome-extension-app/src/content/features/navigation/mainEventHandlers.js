/**
 * Event handlers for Main component
 */
import logger from "../../../shared/utils/logging/logger.js";
import ChromeAPIErrorHandler from "../../../shared/services/chrome/ChromeAPIErrorHandler.js";

/**
 * Creates content onboarding complete handler
 */
export function createCompleteContentOnboardingHandler(setShowContentOnboarding) {
  return () => {
    setShowContentOnboarding(false);
    logger.info("Content onboarding completed");
  };
}

/**
 * Creates content onboarding close handler
 */
export function createCloseContentOnboardingHandler(setShowContentOnboarding) {
  return () => {
    setShowContentOnboarding(false);
  };
}

/**
 * Creates timer tour complete handler
 */
export function createCompleteTimerTourHandler(setShowTimerTour) {
  return async () => {
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
  };
}

/**
 * Creates timer tour close handler
 */
export function createCloseTimerTourHandler(setShowTimerTour) {
  return () => {
    setShowTimerTour(false);
  };
}
