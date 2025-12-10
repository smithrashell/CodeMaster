/**
 * PageSpecificTour Custom Hooks
 */

import React, { useState, useEffect, useCallback } from "react";
import logger from "../../../shared/utils/logging/logger.js";
import { smartPositioning } from "./SmartPositioning";

// Helper to trigger hover state on elements
export const triggerElementHover = (stepData) => {
  if (!stepData.forceHover || !stepData.hoverTarget) return;

  const hoverElement = document.querySelector(stepData.hoverTarget);
  if (!hoverElement) return;

  logger.info("🎯 Forcing hover state on:", stepData.hoverTarget);

  const mouseEnterEvent = new MouseEvent('mouseenter', { bubbles: true, cancelable: true, view: window });
  hoverElement.dispatchEvent(mouseEnterEvent);
  hoverElement.classList.add('tour-forced-hover');

  if (stepData.expandedTarget) {
    setTimeout(() => {
      const expandedElement = document.querySelector(stepData.expandedTarget);
      if (expandedElement) {
        expandedElement.classList.add('tour-highlight-expanded');
      }
    }, 300);
  }
};

// Helper to remove hover state from elements
export const removeElementHover = (stepData) => {
  if (!stepData.forceHover || !stepData.hoverTarget) return;

  const hoverElement = document.querySelector(stepData.hoverTarget);
  if (!hoverElement) return;

  logger.info("🎯 Removing forced hover state from:", stepData.hoverTarget);

  const mouseLeaveEvent = new MouseEvent('mouseleave', { bubbles: true, cancelable: true, view: window });
  hoverElement.dispatchEvent(mouseLeaveEvent);
  hoverElement.classList.remove('tour-forced-hover');

  if (stepData.expandedTarget) {
    const expandedElement = document.querySelector(stepData.expandedTarget);
    if (expandedElement) {
      expandedElement.classList.remove('tour-highlight-expanded');
    }
  }
};

// Helper to reverse UI state changes when going back
export const reverseUIStateChanges = (currentStepData, previousStepData) => {
  if (currentStepData?.requiresMenuOpen && !previousStepData?.requiresMenuOpen) {
    const menuButton = document.querySelector("#cm-menuButton");
    const menuElement = document.querySelector("#cm-mySidenav");

    if (menuButton && menuElement && !menuElement.classList.contains("cm-hidden")) {
      logger.info("🔙 Back button: Closing menu (reversing state)");
      menuButton.click();
    }
  }

  if (currentStepData?.requiresHintOpen && !previousStepData?.requiresHintOpen) {
    const hintButton = document.querySelector("#floating-hint-button");
    if (hintButton && hintButton.getAttribute('aria-expanded') === 'true') {
      logger.info("🔙 Back button: Closing hint panel (reversing state)");
      hintButton.click();
    }
  }
};

// Custom hook for smart positioning
export function useSmartPositioning(isVisible, currentStepData, currentStep, menuOpenState) {
  const [tourPosition, setTourPosition] = useState(null);
  const [arrowPosition, setArrowPosition] = useState(null);
  const [hasInitiallyPositioned, setHasInitiallyPositioned] = useState(false);

  useEffect(() => {
    if (!isVisible || !currentStepData) return;

    setHasInitiallyPositioned(false);
    setTourPosition(null);

    const calculatePosition = () => {
      const position = smartPositioning.calculatePosition(currentStepData.target, currentStepData.position);
      setTourPosition({ top: position.top, left: position.left });
      setHasInitiallyPositioned(true);

      if (position.arrowDirection && position.targetRect) {
        const arrow = smartPositioning.getArrowPosition(position, position.targetRect, position.arrowDirection);
        setArrowPosition({ ...arrow, direction: position.arrowDirection });
      } else {
        setArrowPosition(null);
      }
    };

    const timeoutId = setTimeout(() => {
      calculatePosition();
    }, menuOpenState !== undefined ? 100 : 0);

    const handleReposition = () => {
      clearTimeout(timeoutId);
      calculatePosition();
    };

    window.addEventListener("scroll", handleReposition);
    window.addEventListener("resize", handleReposition);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("scroll", handleReposition);
      window.removeEventListener("resize", handleReposition);
    };
  }, [currentStep, isVisible, currentStepData, menuOpenState]);

  return { tourPosition, arrowPosition, hasInitiallyPositioned };
}

// Custom hook for menu state monitoring
export function useMenuStateMonitor() {
  const [menuOpenState, setMenuOpenState] = useState(false);

  useEffect(() => {
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
    const menuObserver = new MutationObserver(() => { checkMenuState(); });

    const domObserver = new MutationObserver(() => {
      const menuElement = document.querySelector("#cm-mySidenav");
      if (menuElement && !menuObserverAttached) {
        menuObserverAttached = true;
        checkMenuState();
        menuObserver.observe(menuElement, { attributes: true, attributeFilter: ["class"] });
        domObserver.disconnect();
      }
    });

    const menuElement = document.querySelector("#cm-mySidenav");
    if (menuElement) {
      menuObserver.observe(menuElement, { attributes: true, attributeFilter: ["class"] });
      menuObserverAttached = true;
    } else {
      domObserver.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      menuObserver.disconnect();
      domObserver.disconnect();
    };
  }, []);

  return menuOpenState;
}

// Custom hook for handling auto-triggers and menu state
export function useAutoTriggerEffects(isVisible, currentStepData, menuOpenState) {
  React.useEffect(() => {
    if (!isVisible || !currentStepData) return;

    if (currentStepData.autoTriggerSelector) {
      const triggerElement = document.querySelector(currentStepData.autoTriggerSelector);
      if (triggerElement) {
        if (currentStepData.interactionType === "menu-open" && !menuOpenState) {
          logger.info("🎯 Auto-triggering menu open for tour step:", currentStepData.id);
          triggerElement.click();
        } else if (currentStepData.interactionType === "hint-open") {
          logger.info("🎯 Auto-triggering hint open for tour step:", currentStepData.id);
          triggerElement.click();
        }
      }
    } else if (currentStepData.requiresMenuOpen && !menuOpenState) {
      const menuButton = document.querySelector("#cm-menuButton");
      if (menuButton) {
        logger.info("🎯 Opening menu for tour step that requires it:", currentStepData.id);
        menuButton.click();
      }
    }

    if (currentStepData.requiresHintOpen) {
      const hintButton = document.querySelector("#floating-hint-button");
      if (hintButton && hintButton.getAttribute('aria-expanded') !== 'true') {
        logger.info("🎯 Opening hint panel for tour step that requires it:", currentStepData.id);
        hintButton.click();
      }
    }
  }, [isVisible, currentStepData, menuOpenState]);
}

// Custom hook for forcing hover states
export function useForceHoverEffect(isVisible, currentStepData, currentStep, forceHoverState) {
  React.useEffect(() => {
    if (isVisible && currentStepData && currentStepData.forceHover) {
      setTimeout(() => { forceHoverState(currentStepData); }, 200);
    }
  }, [currentStep, isVisible, currentStepData, forceHoverState]);
}

// Custom hook for tour navigation with hover state management
export function useTourNavigation(currentStep, setCurrentStep, tourSteps, onComplete, onClose) {
  const forceHoverState = useCallback(triggerElementHover, []);
  const removeForceHoverState = useCallback(removeElementHover, []);

  const handleNext = useCallback(() => {
    const currentStepData = tourSteps[currentStep];
    if (currentStepData.forceHover) { removeForceHoverState(currentStepData); }

    if (currentStep < tourSteps.length - 1) {
      const nextStep = currentStep + 1;
      const nextStepData = tourSteps[nextStep];
      setCurrentStep(nextStep);
      if (nextStepData.forceHover) { setTimeout(() => forceHoverState(nextStepData), 100); }
    } else {
      onComplete();
    }
  }, [currentStep, tourSteps, onComplete, setCurrentStep, forceHoverState, removeForceHoverState]);

  const handlePrevious = () => {
    if (currentStep > 0) {
      const currentStepData = tourSteps[currentStep];
      const previousStepData = tourSteps[currentStep - 1];
      if (currentStepData.forceHover) { removeForceHoverState(currentStepData); }
      reverseUIStateChanges(currentStepData, previousStepData);
      setCurrentStep(currentStep - 1);
      if (previousStepData.forceHover) { setTimeout(() => forceHoverState(previousStepData), 100); }
    }
  };

  const handleSkip = () => {
    const currentStepData = tourSteps[currentStep];
    if (currentStepData.forceHover) { removeForceHoverState(currentStepData); }
    onClose();
  };

  return { handleNext, handlePrevious, handleSkip, forceHoverState };
}

// Custom hook for handling early tour completion
export function useEarlyTourCompletion(isVisible, tourConfig, _tourId, onComplete) {
  React.useEffect(() => {
    if (!isVisible) return;

    const tourId = tourConfig?.id || _tourId;
    const isProbgenTour = tourId === "probgen_tour" || _tourId === "probgen";
    const isProbTimeTour = tourId === "probtime_tour" || _tourId === "probtime";

    if (!isProbgenTour && !isProbTimeTour) return;

    const handleEarlyCompletionClick = (event) => {
      if (isProbgenTour) {
        const clickedElement = event.target.closest('a[href]');
        if (!clickedElement) return;
        const href = clickedElement.getAttribute('href');
        if (['/Probstat', '/Settings'].includes(href)) {
          console.log(`🎯 Probgen Tour: User clicked navigation link ${href}, completing tour early`);
          onComplete();
        }
      } else if (isProbTimeTour) {
        const clickedElement = event.target.closest('button, a');
        if (!clickedElement) return;
        const isAttemptButton = clickedElement.textContent?.toLowerCase().includes('attempt') ||
                              clickedElement.textContent?.toLowerCase().includes('start') ||
                              clickedElement.textContent?.toLowerCase().includes('solve') ||
                              clickedElement.className?.includes('timer') ||
                              clickedElement.className?.includes('start') ||
                              clickedElement.className?.includes('primary') ||
                              clickedElement.classList?.contains('start-button');
        if (isAttemptButton) {
          console.log(`🎯 Problem Details Tour: User clicked attempt/timer button, completing tour early`);
          onComplete();
        }
      }
    };

    document.addEventListener('click', handleEarlyCompletionClick, true);
    return () => { document.removeEventListener('click', handleEarlyCompletionClick, true); };
  }, [isVisible, onComplete, tourConfig, _tourId]);
}

// Custom hook to monitor for target element existence
export function useTargetElementMonitoring(isVisible, currentStepData) {
  const [targetExists, setTargetExists] = React.useState(false);

  React.useEffect(() => {
    if (!isVisible || !currentStepData?.target) return;

    const checkTargetExists = () => {
      const targetElement = document.querySelector(currentStepData.target);
      const exists = !!targetElement;
      if (exists !== targetExists) { setTargetExists(exists); }
      return exists;
    };

    checkTargetExists();

    const targetObserver = new MutationObserver(() => { checkTargetExists(); });

    if (currentStepData.requiresMenuOpen) {
      const menuElement = document.querySelector("#cm-mySidenav");
      if (menuElement) {
        targetObserver.observe(menuElement, { childList: true, subtree: true });
      } else {
        targetObserver.observe(document.body, { childList: true, subtree: true });
      }
    }

    return () => { targetObserver.disconnect(); };
  }, [isVisible, currentStepData?.target, currentStepData?.requiresMenuOpen, targetExists]);

  return targetExists;
}

// Helper function to check if step should be shown
export function shouldShowStep(currentStepData, menuOpenState) {
  if (currentStepData?.requiresMenuOpen && !menuOpenState) {
    if (currentStepData.autoTriggerSelector || currentStepData.interactionType === "menu-open") {
      return true;
    }
    return false;
  }

  if (currentStepData?.target) {
    const targetElement = document.querySelector(currentStepData.target);
    if (!targetElement) return false;
  }

  return true;
}
