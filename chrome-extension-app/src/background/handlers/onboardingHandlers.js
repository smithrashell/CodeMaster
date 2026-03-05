
import { StorageService } from "../../shared/services/storage/storageService.js";
import {
  onboardUserIfNeeded,
  checkContentOnboardingStatus,
  updateContentOnboardingStep,
  completeContentOnboarding,
  checkPageTourStatus,
  markPageTourCompleted,
  resetPageTour
} from "../../shared/services/focus/onboardingService.js";


function handleOnboardingUserIfNeeded(request, dependencies, sendResponse, finishRequest) {
  onboardUserIfNeeded()
    .then((result) => {
      // Handle both old and new response formats
      if (result && typeof result === 'object' && 'success' in result) {
        sendResponse(result);
      } else {
        // Legacy format - assume success
        sendResponse({ success: true, message: "Onboarding completed" });
      }
    })
    .catch((error) => {
      console.error("❌ Error onboarding user:", error);
      // Return a graceful error that doesn't break the UI
      sendResponse({
        success: false,
        error: error.message,
        fallback: true
      });
    })
    .finally(finishRequest);
  return true;
}


function handleCheckInstallationOnboardingStatus(request, dependencies, sendResponse, finishRequest) {
  StorageService.get('installation_onboarding_complete')
    .then((result) => {
      console.log("🔍 Installation onboarding status check:", result);
      // Handle both boolean and object formats
      const isComplete = result === true || result?.completed === true;
      sendResponse({
        isComplete,
        timestamp: result?.timestamp,
        version: result?.version,
        error: result?.error
      });
    })
    .catch((error) => {
      console.error("❌ Error checking installation onboarding status:", error);
      sendResponse({
        isComplete: false,
        error: error.message
      });
    })
    .finally(finishRequest);
  return true;
}


function handleCheckContentOnboardingStatus(request, dependencies, sendResponse, finishRequest) {
  checkContentOnboardingStatus()
    .then(sendResponse)
    .catch((error) => {
      console.error("❌ Error checking content onboarding status:", error);
      sendResponse({ error: error.message });
    })
    .finally(finishRequest);
  return true;
}


function handleCheckOnboardingStatus(request, dependencies, sendResponse, finishRequest) {
  const { checkOnboardingStatus } = dependencies;
  checkOnboardingStatus()
    .then(sendResponse)
    .catch((error) => {
      console.error("❌ Error checking onboarding status:", error);
      sendResponse({ error: error.message });
    })
    .finally(finishRequest);
  return true;
}


function handleCompleteOnboarding(request, dependencies, sendResponse, finishRequest) {
  const { completeOnboarding } = dependencies;
  completeOnboarding()
    .then(sendResponse)
    .catch((error) => {
      console.error("❌ Error completing onboarding:", error);
      sendResponse({ error: error.message });
    })
    .finally(finishRequest);
  return true;
}


function handleUpdateContentOnboardingStep(request, dependencies, sendResponse, finishRequest) {
  updateContentOnboardingStep(request.step)
    .then(sendResponse)
    .catch((error) => {
      console.error("❌ Error updating content onboarding step:", error);
      sendResponse({ error: error.message });
    })
    .finally(finishRequest);
  return true;
}


function handleCompleteContentOnboarding(request, dependencies, sendResponse, finishRequest) {
  completeContentOnboarding()
    .then(sendResponse)
    .catch((error) => {
      console.error("❌ Error completing content onboarding:", error);
      sendResponse({ error: error.message });
    })
    .finally(finishRequest);
  return true;
}


function handleCheckPageTourStatus(request, dependencies, sendResponse, finishRequest) {
  checkPageTourStatus(request.pageId)
    .then(sendResponse)
    .catch((error) => {
      console.error("❌ Error checking page tour status:", error);
      sendResponse({ error: error.message });
    })
    .finally(finishRequest);
  return true;
}


function handleMarkPageTourCompleted(request, dependencies, sendResponse, finishRequest) {
  markPageTourCompleted(request.pageId)
    .then(sendResponse)
    .catch((error) => {
      console.error("❌ Error marking page tour completed:", error);
      sendResponse({ error: error.message });
    })
    .finally(finishRequest);
  return true;
}


function handleResetPageTour(request, dependencies, sendResponse, finishRequest) {
  resetPageTour(request.pageId)
    .then(sendResponse)
    .catch((error) => {
      console.error("❌ Error resetting page tour:", error);
      sendResponse({ error: error.message });
    })
    .finally(finishRequest);
  return true;
}

/**
 * Onboarding handlers registry
 * Maps message types to their handler functions
 */
export const onboardingHandlers = {
  "onboardingUserIfNeeded": handleOnboardingUserIfNeeded,
  "checkInstallationOnboardingStatus": handleCheckInstallationOnboardingStatus,
  "checkContentOnboardingStatus": handleCheckContentOnboardingStatus,
  "checkOnboardingStatus": handleCheckOnboardingStatus,
  "completeOnboarding": handleCompleteOnboarding,
  "updateContentOnboardingStep": handleUpdateContentOnboardingStep,
  "completeContentOnboarding": handleCompleteContentOnboarding,
  "checkPageTourStatus": handleCheckPageTourStatus,
  "markPageTourCompleted": handleMarkPageTourCompleted,
  "resetPageTour": handleResetPageTour
};
