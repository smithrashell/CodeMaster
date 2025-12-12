/**
 * App Onboarding Hook
 */
import { useState, useEffect } from "react";
import ChromeAPIErrorHandler from "../../shared/services/chrome/chromeAPIErrorHandler.js";

export const useAppOnboarding = () => {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const status = await ChromeAPIErrorHandler.sendMessageWithRetry({
          type: 'checkOnboardingStatus'
        });
        setShowOnboarding(!status.is_completed);
      } catch (error) {
        // Error checking onboarding status
        setShowOnboarding(false);
      }
    };

    checkOnboarding();
  }, []);

  const handleCompleteOnboarding = async () => {
    try {
      await ChromeAPIErrorHandler.sendMessageWithRetry({
        type: 'completeOnboarding'
      });
      setShowOnboarding(false);
    } catch (error) {
      // Error completing onboarding
    }
  };

  const handleCloseOnboarding = () => {
    setShowOnboarding(false);
  };

  return {
    showOnboarding,
    handleCompleteOnboarding,
    handleCloseOnboarding,
  };
};