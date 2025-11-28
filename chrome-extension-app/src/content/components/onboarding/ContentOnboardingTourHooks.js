/**
 * Content Onboarding Tour Custom Hooks
 * Extracted from ContentOnboardingTour.jsx
 */

import { useState, useEffect, useCallback } from "react";
import logger from "../../../shared/utils/logger.js";
import ChromeAPIErrorHandler from "../../../shared/services/ChromeAPIErrorHandler.js";
import { smartPositioning } from "./SmartPositioning";
import { TOUR_STEPS } from "./ContentOnboardingTourData.js";
import { createUserInteractionHandler } from "./ContentOnboardingTourHelpers.js";

/**
 * Custom hook for tour positioning logic
 */
export const useTourPositioning = (isVisible, currentStepData, currentStep) => {
  const [tourPosition, setTourPosition] = useState(null);
  const [arrowPosition, setArrowPosition] = useState(null);
  const [hasInitiallyPositioned, setHasInitiallyPositioned] = useState(false);

  useEffect(() => {
    if (!isVisible) return;

    setHasInitiallyPositioned(false);
    setTourPosition(null);

    const calculatePosition = () => {
      try {
        const position = smartPositioning.calculatePosition(
          currentStepData.target,
          currentStepData.position,
          currentStepData.screenKey === "completion" ? "center" : undefined
        );

        if (position && typeof position.top === 'number' && typeof position.left === 'number') {
          setTourPosition({ top: position.top, left: position.left });
          setArrowPosition(position.arrowDirection ? {
            direction: position.arrowDirection,
            placement: position.placement
          } : null);
          setHasInitiallyPositioned(true);
        } else {
          logger.warn("ContentOnboardingTour: Invalid position calculated, using fallback");
          setTourPosition({ top: 100, left: 100 });
          setArrowPosition(null);
          setHasInitiallyPositioned(true);
        }
      } catch (error) {
        logger.error("ContentOnboardingTour: Error calculating position:", error);
        setTourPosition({ top: 100, left: 100 });
        setArrowPosition(null);
        setHasInitiallyPositioned(true);
      }
    };

    calculatePosition();

    const handleReposition = () => calculatePosition();
    window.addEventListener("scroll", handleReposition);
    window.addEventListener("resize", handleReposition);

    return () => {
      window.removeEventListener("scroll", handleReposition);
      window.removeEventListener("resize", handleReposition);
    };
  }, [currentStep, isVisible, currentStepData]);

  return { tourPosition, arrowPosition, hasInitiallyPositioned };
};

/**
 * Custom hook for menu state monitoring
 */
export const useMenuStateMonitoring = (isVisible) => {
  const [menuOpenState, setMenuOpenState] = useState(false);

  useEffect(() => {
    if (!isVisible) return;

    const checkMenuState = () => {
      const menuElement = document.querySelector("#cm-mySidenav");
      if (!menuElement) {
        setMenuOpenState(false);
        return false;
      }
      const isOpen = !menuElement.classList.contains("cm-hidden");
      setMenuOpenState(isOpen);
      return isOpen;
    };

    checkMenuState();

    let menuObserverAttached = false;
    const menuObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes" && mutation.attributeName === "class") {
          checkMenuState();
        }
      });
    });

    const domObserver = new MutationObserver(() => {
      const menuElement = document.querySelector("#cm-mySidenav");
      if (menuElement && !menuObserverAttached) {
        menuObserverAttached = true;
        checkMenuState();
        menuObserver.observe(menuElement, { attributes: true });
        domObserver.disconnect();
      }
    });

    const menuElement = document.querySelector("#cm-mySidenav");
    if (menuElement) {
      menuObserver.observe(menuElement, { attributes: true });
      menuObserverAttached = true;
    } else {
      domObserver.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      menuObserver.disconnect();
      domObserver.disconnect();
    };
  }, [isVisible]);

  return menuOpenState;
};

/**
 * Custom hook to monitor for target element existence
 */
export const useTargetElementMonitoring = (isVisible, currentStepData) => {
  const [targetExists, setTargetExists] = useState(false);

  useEffect(() => {
    if (!isVisible || !currentStepData.target) {
      return;
    }

    const checkTargetExists = () => {
      const targetElement = document.querySelector(currentStepData.target);
      const exists = !!targetElement;
      if (exists !== targetExists) {
        logger.info(`Target element ${currentStepData.target} ${exists ? 'appeared' : 'disappeared'}`);
        setTargetExists(exists);
      }
      return exists;
    };

    checkTargetExists();

    const targetObserver = new MutationObserver(() => {
      checkTargetExists();
    });

    if (currentStepData.requiresMenuOpen) {
      const menuElement = document.querySelector("#cm-mySidenav");
      if (menuElement) {
        targetObserver.observe(menuElement, { childList: true, subtree: true });
      } else {
        targetObserver.observe(document.body, { childList: true, subtree: true });
      }
    }

    return () => {
      targetObserver.disconnect();
    };
  }, [isVisible, currentStepData.target, currentStepData.requiresMenuOpen, targetExists]);

  return targetExists;
};

/**
 * Custom hook for tour navigation logic
 */
export const useTourNavigation = (currentStep, { setCurrentStep, setIsWaitingForInteraction, onComplete, onClose, navigate }) => {
  const proceedToNextStep = useCallback(() => {
    logger.info(`proceedToNextStep called: currentStep=${currentStep}, nextStep=${currentStep + 1}`);
    if (currentStep < TOUR_STEPS.length - 1) {
      const nextStep = currentStep + 1;
      logger.info(`Advancing to step ${nextStep}: ${TOUR_STEPS[nextStep]?.id}`);
      setCurrentStep(nextStep);

      if (TOUR_STEPS[nextStep]?.waitForUserClick) {
        setIsWaitingForInteraction(true);
      } else {
        setIsWaitingForInteraction(false);
      }
    } else {
      logger.info(`Tour complete, calling onComplete()`);
      onComplete();
    }
  }, [currentStep, onComplete, setCurrentStep, setIsWaitingForInteraction]);

  const handleNext = useCallback(() => {
    logger.info(`handleNext clicked: currentStep=${currentStep}`);
    const currentStepData = TOUR_STEPS[currentStep];

    if (currentStepData.autoTriggerSelector) {
      const targetElement = document.querySelector(currentStepData.autoTriggerSelector);
      if (targetElement) {
        if (currentStepData.autoTriggerSelector === "#cm-menuButton") {
          const menuElement = document.querySelector("#cm-mySidenav");
          const isMenuAlreadyOpen = menuElement && !menuElement.classList.contains("cm-hidden");

          if (isMenuAlreadyOpen) {
            logger.info("Menu is already open, skipping auto-trigger");
            proceedToNextStep();
            return;
          }
        }

        targetElement.click();
        const delay = currentStepData.id === 'problem-generator-demo' ? 1000 : 600;
        setTimeout(() => {
          proceedToNextStep();
        }, delay);
        return;
      } else {
        logger.warn("Auto-trigger target not found:", currentStepData.autoTriggerSelector);
      }
    }

    proceedToNextStep();
  }, [currentStep, proceedToNextStep]);

  const handlePrevious = () => {
    if (currentStep > 0) {
      const currentStepData = TOUR_STEPS[currentStep];
      const previousStepData = TOUR_STEPS[currentStep - 1];

      if (currentStepData?.requiresMenuOpen && !previousStepData?.requiresMenuOpen) {
        const menuButton = document.querySelector("#cm-menuButton");
        const menuElement = document.querySelector("#cm-mySidenav");

        if (menuButton && menuElement && !menuElement.classList.contains("cm-hidden")) {
          logger.info("Back button: Closing menu (reversing state)");
          menuButton.click();
        }
      }

      setCurrentStep(currentStep - 1);
      setIsWaitingForInteraction(false);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  const handleNavigation = useCallback(async () => {
    const currentStepData = TOUR_STEPS[currentStep];
    if (currentStepData.navigationRoute) {
      logger.info("Navigating to:", currentStepData.navigationRoute);

      try {
        await ChromeAPIErrorHandler.sendMessageWithRetry({
          type: "completeContentOnboarding"
        });
        logger.info("Tour completed via navigation and saved to database");
      } catch (error) {
        logger.error("Error completing tour via navigation:", error);
      }

      onComplete();

      setTimeout(() => {
        navigate(currentStepData.navigationRoute);
      }, 100);
    }
  }, [currentStep, navigate, onComplete]);

  return {
    handleNext,
    handlePrevious,
    handleSkip,
    handleNavigation,
    proceedToNextStep
  };
};

/**
 * Helper hook for tour completion
 */
export const useTourCompleteHandler = (onComplete) => {
  return useCallback(async () => {
    try {
      await ChromeAPIErrorHandler.sendMessageWithRetry({
        type: "completeContentOnboarding"
      });
      logger.info("Tour completed and saved to database");
      onComplete();
    } catch (error) {
      logger.error("Error completing tour:", error);
      onComplete();
    }
  }, [onComplete]);
};

/**
 * Helper hook for tour close
 */
export const useTourCloseHandler = (onClose) => {
  return useCallback(() => {
    logger.info("Tour closed");
    onClose();
  }, [onClose]);
};

/**
 * Helper hook for navigation detection effect
 */
export const useNavigationDetectionEffect = (isVisible, handleTourComplete) => {
  useEffect(() => {
    if (!isVisible) return;

    const handleNavigationClick = (event) => {
      const clickedElement = event.target.closest('a[href="/Probgen"]');
      if (clickedElement) {
        logger.info("Main Tour: User navigating to Problem Generator, completing tour");
        handleTourComplete();
      }
    };

    document.addEventListener('click', handleNavigationClick, true);

    return () => {
      document.removeEventListener('click', handleNavigationClick, true);
    };
  }, [isVisible, handleTourComplete]);
};

/**
 * Helper hook for interaction handling effect
 */
export const useInteractionHandlingEffect = (isWaitingForInteraction, currentStepData, setIsWaitingForInteraction, handleNext, onComplete) => {
  useEffect(() => {
    if ((!isWaitingForInteraction || !currentStepData.waitForInteraction) && !currentStepData.waitForUserClick) return;
    const handleInteraction = createUserInteractionHandler(
      currentStepData,
      setIsWaitingForInteraction,
      handleNext,
      onComplete
    );

    const escapeTimer = setTimeout(() => {
      logger.info("Interaction timeout, allowing manual proceed");
      setIsWaitingForInteraction(false);
    }, 5000);

    document.addEventListener("click", handleInteraction, true);
    return () => {
      document.removeEventListener("click", handleInteraction, true);
      clearTimeout(escapeTimer);
    };
  }, [isWaitingForInteraction, currentStepData, handleNext, onComplete, setIsWaitingForInteraction]);
};
