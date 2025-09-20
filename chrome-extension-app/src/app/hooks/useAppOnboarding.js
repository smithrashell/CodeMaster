/**
 * App Onboarding Hook
 */
import { useState, useEffect } from "react";
import {
  checkOnboardingStatus,
  completeOnboarding,
} from "../../shared/services/onboardingService";

export const useAppOnboarding = () => {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const status = await checkOnboardingStatus();
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
      await completeOnboarding();
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