/**
 * Custom hooks for main navigation component
 */
import { useCallback, useEffect, useState } from "react";
import { useChromeMessage } from "../../../shared/hooks/useChromeMessage";
import ChromeAPIErrorHandler from "../../../shared/services/ChromeAPIErrorHandler.js";
import logger from "../../../shared/utils/logging/logger.js";
import { sendProblemMessage, getProblemSlugFromUrl, setupUrlChangeListeners } from "./mainHelpers.js";

// Helper custom hook to create fetchProblemData callback
export const useFetchProblemData = (setProblemTitle, setLoading, setProblemData, setProblemFound) => {
  return useCallback((problemSlug) => {
    if (!problemSlug) {
      return;
    }

    const problemTitleFormatted = problemSlug.replace(/-/g, " ");
    const title =
      problemTitleFormatted.charAt(0).toUpperCase() +
      problemTitleFormatted.slice(1);
    setProblemTitle(title);

    setLoading(true);
    sendProblemMessage(title, problemSlug, setProblemData, setProblemFound, setLoading);
  }, [setProblemTitle, setLoading, setProblemData, setProblemFound]);
};

// Helper hook for onboarding message
export const useOnboardingMessage = () => {
  return useChromeMessage({ type: "onboardingUserIfNeeded" }, [], {
    onSuccess: (response) => {
      if (response) {
        logger.info("onboardingUserIfNeeded", response);
      }
    },
  });
};

// Hook for URL change monitoring
export const useUrlChangeMonitoring = (currentProblem, fetchProblemData, pathname) => {
  const handleUrlChange = useCallback(() => {
    const newProblemSlug = getProblemSlugFromUrl(window.location.href);
    logger.info("🌐 URL CHANGED - New problem slug:", newProblemSlug);
    logger.info("🌐 Current problem slug:", currentProblem);

    if (newProblemSlug && newProblemSlug !== currentProblem) {
      logger.info("🔄 Problem changed, updating data...");
      fetchProblemData(newProblemSlug);
      logger.info("📍 Current internal route:", pathname);
      return newProblemSlug;
    }
    return null;
  }, [currentProblem, fetchProblemData, pathname]);

  useEffect(() => {
    const cleanup = setupUrlChangeListeners(handleUrlChange);
    return cleanup;
  }, [handleUrlChange]);

  return handleUrlChange;
};

// Hook for problem submission events
export const useProblemSubmissionListener = (fetchProblemData, setProblemFound, setProblemData) => {
  useEffect(() => {
    const handleProblemSubmission = async () => {
      const problemSlug = getProblemSlugFromUrl(window.location.href);
      if (problemSlug) {
        logger.info("🔄 Problem submitted, refreshing problem data for:", problemSlug);

        await new Promise(resolve => setTimeout(resolve, 500));

        setProblemFound(false);
        setProblemData(null);

        fetchProblemData(problemSlug);

        logger.info("🔄 Problem data refresh initiated");
      } else {
        logger.warn("⚠️ Problem submitted but no problem slug found in URL");
      }
    };

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
};

// Hook to recheck main tour status on navigation
export const useMainTourStatusCheck = (pathname, showContentOnboarding, contentOnboardingStatus, setShowContentOnboarding) => {
  useEffect(() => {
    const recheckMainTourStatus = async () => {
      if (!showContentOnboarding) return;

      try {
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
};

// Hook for timer tour logic
export const useTimerTour = (pathname, contentOnboardingStatus, showContentOnboarding) => {
  const [showTimerTour, setShowTimerTour] = useState(false);

  useEffect(() => {
    const checkTimerTour = async () => {
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

      if (!mainTourStatus || !mainTourStatus.is_completed) {
        logger.info("🕐 Main tour not completed yet, not showing timer tour", {
          isCompleted: mainTourStatus?.isCompleted,
          currentStep: mainTourStatus?.current_step
        });
        setShowTimerTour(false);
        return;
      }

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

    const timeoutId = setTimeout(() => {
      checkTimerTour();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [pathname, contentOnboardingStatus, showContentOnboarding]);

  return { showTimerTour, setShowTimerTour };
};

// Hook for timer tour completion
export const useTimerTourHandlers = (setShowTimerTour) => {
  const handleCompleteTimerTour = useCallback(async () => {
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

  const handleCloseTimerTour = useCallback(() => {
    setShowTimerTour(false);
  }, [setShowTimerTour]);

  return { handleCompleteTimerTour, handleCloseTimerTour };
};
