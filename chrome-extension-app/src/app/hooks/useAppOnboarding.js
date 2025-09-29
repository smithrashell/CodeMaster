/**
 * App Onboarding Hook
 */
import { useState, useEffect } from "react";
import ChromeAPIErrorHandler from "../../shared/services/ChromeAPIErrorHandler.js";

export const useAppOnboarding = () => {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        // STEP 1: First check if installation/database seeding is complete
        const installationStatus = await ChromeAPIErrorHandler.sendMessageWithRetry({
          type: 'checkInstallationOnboardingStatus'
        });

        if (!installationStatus.isComplete) {
          // Database not ready - hide app onboarding
          setShowOnboarding(false);
          return;
        }

        // STEP 2: Installation complete, check app onboarding status
        const status = await ChromeAPIErrorHandler.sendMessageWithRetry({
          type: 'checkOnboardingStatus'
        });
        setShowOnboarding(!status.is_completed);
      } catch (error) {
        // Error checking onboarding status - hide onboarding for safety
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