/**
 * Custom hooks extracted from Main component
 */
import { useEffect } from "react";
import logger from "../../../shared/utils/logger.js";
import ChromeAPIErrorHandler from "../../../shared/services/ChromeAPIErrorHandler.js";
import { getProblemSlugFromUrl } from "./mainHelpers.js";

/**
 * Sets up URL change listeners using browser events
 */
export function useUrlChangeHandler(handleUrlChange) {
  useEffect(() => {
    logger.info("🔧 SETTING UP URL CHANGE LISTENERS");

    // Monkey-patch pushState and replaceState to detect changes
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function (...args) {
      originalPushState.apply(window.history, args);
      window.dispatchEvent(new Event("locationchange"));
    };

    window.history.replaceState = function (...args) {
      originalReplaceState.apply(window.history, args);
      window.dispatchEvent(new Event("locationchange"));
    };

    // Listen for popstate and locationchange events
    window.addEventListener("popstate", handleUrlChange);
    window.addEventListener("locationchange", handleUrlChange);

    // Return cleanup function
    return () => {
      logger.info("🧹 CLEANING UP URL CHANGE LISTENERS");
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener("popstate", handleUrlChange);
      window.removeEventListener("locationchange", handleUrlChange);
    };
  }, [handleUrlChange]);
}

/**
 * Listens for problem submission events to refresh problem data
 */
export function useProblemSubmissionListener(fetchProblemData, setProblemFound, setProblemData) {
  useEffect(() => {
    const handleProblemSubmission = async () => {
      const problemSlug = getProblemSlugFromUrl(window.location.href);
      if (problemSlug) {
        logger.info("🔄 Problem submitted, refreshing problem data for:", problemSlug);

        // Add a small additional delay to ensure the database is fully updated
        await new Promise(resolve => setTimeout(resolve, 500));

        // Reset the problem state first to trigger a clean fetch
        setProblemFound(false);
        setProblemData(null);

        // Then fetch the updated problem data
        fetchProblemData(problemSlug);

        logger.info("🔄 Problem data refresh initiated");
      } else {
        logger.warn("⚠️ Problem submitted but no problem slug found in URL");
      }
    };

    // Listen for Chrome extension messages
    const messageListener = (message, _sender, sendResponse) => {
      if (message.type === "problemSubmitted") {
        logger.info("📨 Received problemSubmitted message");
        handleProblemSubmission();
        sendResponse({ status: "success" });
      }
    };

    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.onMessage.addListener(messageListener);
    }

    return () => {
      if (typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.onMessage.removeListener(messageListener);
      }
    };
  }, [fetchProblemData, setProblemFound, setProblemData]);
}

/**
 * Re-checks main tour status when navigating to different pages
 * Safe to recheck on pathname changes now that DOM element monitoring is fixed
 */
export function useMainTourRecheck(pathname, showContentOnboarding, contentOnboardingStatus, setShowContentOnboarding) {
  useEffect(() => {
    const recheckMainTourStatus = async () => {
      // Only recheck if main tour is currently showing
      if (!showContentOnboarding) return;

      try {
        // Use the already loaded status if available, otherwise fetch fresh
        let mainTourStatus = contentOnboardingStatus;
        if (!mainTourStatus || !Object.prototype.hasOwnProperty.call(mainTourStatus, 'isCompleted')) {
          mainTourStatus = await ChromeAPIErrorHandler.sendMessageWithRetry({
            type: "checkContentOnboardingStatus"
          });
        }

        if (mainTourStatus && mainTourStatus.is_completed) {
          logger.info("🎯 Main tour was completed, hiding it now");
          setShowContentOnboarding(false);
        }
      } catch (error) {
        logger.error("Error rechecking main tour status:", error);
      }
    };

    recheckMainTourStatus();
  }, [pathname, showContentOnboarding, contentOnboardingStatus, setShowContentOnboarding]);
}

/**
 * Manages timer tour visibility based on page context and tour completion status
 */
export function useTimerTourCheck(pathname, contentOnboardingStatus, showContentOnboarding, setShowTimerTour) {
  useEffect(() => {
    const checkTimerTour = async () => {
      // Only check if we're on a problem page
      const url = window.location.href;
      const isProblemPage = url.includes('/problems/') && !url.includes('/problemset/');

      logger.info("🕐 Timer tour check:", {
        url,
        isProblemPage,
        showContentOnboarding,
        pathname,
        contentOnboardingStatus: contentOnboardingStatus ? {
          isCompleted: contentOnboardingStatus.is_completed,
          currentStep: contentOnboardingStatus.current_step
        } : null
      });

      if (!isProblemPage) {
        setShowTimerTour(false);
        return;
      }

      // Use the already loaded contentOnboardingStatus if available
      let mainTourStatus = contentOnboardingStatus;
      if (!mainTourStatus) {
        try {
          mainTourStatus = await ChromeAPIErrorHandler.sendMessageWithRetry({
            type: "checkContentOnboardingStatus"
          });
        } catch (error) {
          logger.error("Error checking main tour status:", error);
          setShowTimerTour(false);
          return;
        }
      }

      // Only show timer tour if main tour is completed
      if (!mainTourStatus || !mainTourStatus.is_completed) {
        logger.info("🕐 Main tour not completed yet, not showing timer tour", {
          isCompleted: mainTourStatus?.isCompleted,
          currentStep: mainTourStatus?.current_step
        });
        setShowTimerTour(false);
        return;
      }

      // Check if timer tour is completed
      try {
        const isTimerTourCompleted = await ChromeAPIErrorHandler.sendMessageWithRetry({
          type: 'checkPageTourStatus',
          pageId: 'timer_mini_tour'
        });

        if (!isTimerTourCompleted) {
          logger.info("🕐 Main tour completed, showing timer mini-tour on problem page");
          setShowTimerTour(true);
        } else {
          logger.info("🕐 Timer tour already completed");
          setShowTimerTour(false);
        }
      } catch (error) {
        logger.error("Error checking timer tour completion status:", error);
        setShowTimerTour(false);
      }
    };

    // Add a small delay to let state settle
    const timeoutId = setTimeout(() => {
      checkTimerTour();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [pathname, contentOnboardingStatus, showContentOnboarding, setShowTimerTour]);
}
