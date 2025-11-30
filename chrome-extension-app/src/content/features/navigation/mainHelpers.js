/**
 * Helper functions for main navigation component
 */
import logger from "../../../shared/utils/logging/logger.js";
import ChromeAPIErrorHandler from "../../../shared/services/chrome/ChromeAPIErrorHandler.js";

// Function to extract the problem slug from the URL
export function getProblemSlugFromUrl(url) {
  const match = url.match(/problems\/([^/]+)\/?/);
  return match ? match[1] : null;
}

// Helper function to handle Chrome runtime messaging for problem data
export function sendProblemMessage(title, problemSlug, setProblemData, setProblemFound, setLoading) {
  const messageTimeout = setTimeout(() => {
    logger.warn("⚠️ Chrome message timeout - continuing without problem data");
    setLoading(false);
    setProblemData(null);
    setProblemFound(false);
  }, 5000);

  chrome.runtime.sendMessage(
    {
      type: "getProblemByDescription",
      description: title,
      slug: problemSlug,
    },
    (response) => {
      clearTimeout(messageTimeout);
      setLoading(false);

      if (chrome.runtime.lastError) {
        logger.warn("⚠️ Chrome runtime error:", chrome.runtime.lastError.message);
        setProblemData(null);
        setProblemFound(false);
        return;
      }

      if (response?.error) {
        logger.error("❌ Error in getProblemByDescription", response.error);
        setProblemData(null);
        setProblemFound(false);
        return;
      }

      if (response?.problem) {
        logger.info("✅ Problem found: ", response.problem);
        setProblemFound(response.found);
        setProblemData(response.problem);
        return;
      }

      logger.warn("⚠️ No problem found");
      setProblemData(null);
      setProblemFound(false);
    }
  );
}

// Helper function to check content onboarding status
export async function performContentOnboardingCheck(setShowContentOnboarding, setContentOnboardingStatus) {
  // Manual override for testing
  if (typeof window !== 'undefined' && localStorage.getItem('force-content-onboarding') === 'true') {
    logger.info("🔧 MANUAL OVERRIDE: Forcing content onboarding to show");
    setShowContentOnboarding(true);
    return;
  }

  try {
    const status = await ChromeAPIErrorHandler.sendMessageWithRetry({
      type: "checkContentOnboardingStatus"
    });
    logger.info("📊 Main: Content onboarding status received:", status);
    setContentOnboardingStatus(status);

    if (status.is_completed) {
      logger.info("⏭️ Content onboarding already completed - will NOT show", {
        is_completed: status.is_completed,
        completed_at: status.completed_at,
        current_step: status.current_step
      });
      setShowContentOnboarding(false);
      return;
    }

    logger.info("✅ Content onboarding check passed - will show", {
      content_completed: status.is_completed,
      current_step: status.current_step,
      lastActiveStep: status.lastActiveStep
    });

    const delayTime = status.lastActiveStep ? 500 : 1000;
    setTimeout(() => {
      logger.info("🎯 Setting showContentOnboarding to true");
      setShowContentOnboarding(true);
    }, delayTime);
  } catch (error) {
    logger.error("❌ Error checking onboarding status:", error);
    logger.info("🚫 Hiding content onboarding due to error - extension may not be ready");
    setShowContentOnboarding(false);
  }
}

// Helper function to setup URL change listeners
export function setupUrlChangeListeners(handleUrlChange) {
  logger.info("🔧 SETTING UP URL CHANGE LISTENERS");
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

  window.addEventListener("popstate", handleUrlChange);
  window.addEventListener("locationchange", handleUrlChange);

  return () => {
    logger.info("🧹 CLEANING UP URL CHANGE LISTENERS");
    window.history.pushState = originalPushState;
    window.history.replaceState = originalReplaceState;
    window.removeEventListener("popstate", handleUrlChange);
    window.removeEventListener("locationchange", handleUrlChange);
  };
}
