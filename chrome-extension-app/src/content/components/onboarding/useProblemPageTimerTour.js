/**
 * Custom hooks for ProblemPageTimerTour component
 */
import { useState, useEffect, useCallback } from "react";
import logger from "../../../shared/utils/logging/logger.js";
import { checkTimerTourCompleted, markTimerTourCompleted, TIMER_TOUR_STEPS } from "./ProblemPageTimerTourHelpers.js";

/**
 * Hook to check if tour should be shown
 */
export function useTourInitialization(isVisible) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeTour = async () => {
      if (!isVisible) return;

      setIsLoading(true);
      const isCompleted = await checkTimerTourCompleted();

      if (isCompleted) {
        logger.info("🕐 Timer tour already completed");
        setIsLoading(false);
        return;
      }

      logger.info("🕐 Starting timer mini-tour");
      setIsLoading(false);
    };

    initializeTour();
  }, [isVisible]);

  return isLoading;
}

/**
 * Hook to auto-open menu for steps that require it
 */
export function useAutoMenuOpen(isVisible, currentStepData, menuOpenState) {
  useEffect(() => {
    if (!isVisible || !currentStepData) return;

    if (currentStepData.requiresMenuOpen && !menuOpenState) {
      const menuButton = document.querySelector("#cm-menuButton");
      if (menuButton) {
        logger.info("🕐 Opening menu for timer tour step");
        menuButton.click();
      }
    }
  }, [isVisible, currentStepData, menuOpenState]);
}

/**
 * Hook for tour navigation and completion handlers
 */
export function useTourHandlers(currentStep, setCurrentStep, onComplete, onClose) {
  const handleComplete = useCallback(async () => {
    await markTimerTourCompleted();
    logger.info("🕐 Timer tour completed");
    onComplete();
  }, [onComplete]);

  const handleNext = useCallback(() => {
    if (currentStep < TIMER_TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  }, [currentStep, setCurrentStep, handleComplete]);

  const handleSkip = useCallback(() => {
    onClose();
  }, [onClose]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep, setCurrentStep]);

  return { handleNext, handleComplete, handleSkip, handlePrevious };
}
