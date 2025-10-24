/**
 * Positioning hooks for timer tour - extracted to reduce file size
 */
import { useState, useEffect } from "react";
import { smartPositioning } from "./SmartPositioning";
import logger from "../../../shared/utils/logger.js";
import { findTimerLink, calculateTimerButtonPosition } from "./timerLinkHelpers.js";

// Custom hook for positioning
export const useTimerTourPositioning = (isVisible, currentStepData, currentStep) => {
  const [tourPosition, setTourPosition] = useState(null);
  const [arrowPosition, setArrowPosition] = useState(null);
  const [hasInitiallyPositioned, setHasInitiallyPositioned] = useState(false);

  useEffect(() => {
    if (!isVisible || !currentStepData) return;

    // Reset positioning state when step changes
    setHasInitiallyPositioned(false);
    setTourPosition(null);

    const calculatePosition = () => {
      const position = smartPositioning.calculatePosition(
        currentStepData.target,
        currentStepData.position
      );

      // For timer button step, use special positioning logic
      let finalPosition = { top: position.top, left: position.left };
      if (currentStepData.id === "timer-button" && position.targetRect) {
        finalPosition = calculateTimerButtonPosition(position);

        // If timer link not found immediately, retry after delay
        const timerLink = findTimerLink();
        if (!timerLink) {
          setTimeout(() => {
            const retryLink = findTimerLink();
            if (retryLink) {
              logger.info(`🕐 Positioning: Found timer link on retry, recalculating position`);
              calculatePosition();
            }
          }, 100);
        }
      }

      setTourPosition(finalPosition);

      // Always mark as positioned since we removed the blocking logic
      logger.info(`🕐 Positioning: Step ${currentStepData.id} positioned at (${finalPosition.top}, ${finalPosition.left})`);
      setHasInitiallyPositioned(true);

      if (position.arrowDirection && position.targetRect && currentStepData.id !== "timer-button") {
        const arrow = smartPositioning.getArrowPosition(
          position,
          position.targetRect,
          position.arrowDirection
        );
        setArrowPosition({ ...arrow, direction: position.arrowDirection });
      } else if (currentStepData.id === "timer-button" && position.targetRect) {
        // Arrow points left toward the New Problem button
        setArrowPosition({
          top: 50, // Vertical center of tour card
          left: -8, // Arrow pointing left toward New Problem button
          direction: "left"
        });
      } else {
        setArrowPosition(null);
      }
    };

    calculatePosition();

    const handleReposition = () => calculatePosition();
    window.addEventListener("scroll", handleReposition);
    window.addEventListener("resize", handleReposition);

    // For timer-button step, monitor menu visibility changes
    let menuObserver = null;
    if (currentStepData?.id === "timer-button") {
      const menuSidebar = document.querySelector("#cm-mySidenav");
      if (menuSidebar) {
        menuObserver = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
              const isNowOpen = !menuSidebar.classList.contains("cm-hidden");
              logger.info(`🕐 Menu visibility changed: isOpen=${isNowOpen}`);
              if (isNowOpen) {
                // Menu just opened, recalculate position after a short delay
                setTimeout(() => {
                  logger.info(`🕐 Menu opened, recalculating position for timer link`);
                  calculatePosition();
                }, 150);
              }
            }
          });
        });

        menuObserver.observe(menuSidebar, {
          attributes: true,
          attributeFilter: ['class']
        });
      }
    }

    return () => {
      window.removeEventListener("scroll", handleReposition);
      window.removeEventListener("resize", handleReposition);
      if (menuObserver) {
        menuObserver.disconnect();
      }
    };
  }, [currentStep, isVisible, currentStepData]);

  // Simple step change handler - positioning calculation will handle the rest
  useEffect(() => {
    logger.info(`🕐 Positioning: Step changed to: ${currentStepData?.id}`);
    // Let the main positioning effect handle the state
  }, [currentStep, currentStepData]);

  return { tourPosition, arrowPosition, hasInitiallyPositioned };
};

// Custom hook for menu state
export const useMenuStateMonitor = () => {
  const [menuOpenState, setMenuOpenState] = useState(false);

  useEffect(() => {
    const checkMenuState = () => {
      const menuElement = document.querySelector("#cm-mySidenav");
      const isOpen = menuElement && !menuElement.classList.contains("cm-hidden");
      setMenuOpenState(isOpen);
      return isOpen;
    };

    // Initial check
    checkMenuState();

    // Watch for menu visibility changes
    const menuElement = document.querySelector("#cm-mySidenav");
    if (menuElement) {
      const observer = new MutationObserver(() => {
        checkMenuState();
      });

      observer.observe(menuElement, {
        attributes: true,
        attributeFilter: ['class']
      });

      return () => observer.disconnect();
    }
  }, []);

  return menuOpenState;
};
