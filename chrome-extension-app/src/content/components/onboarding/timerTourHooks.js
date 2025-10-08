/**
 * Custom hooks for timer tour positioning and state management
 */
import { useState, useEffect } from "react";
import { smartPositioning } from "./SmartPositioning";
import { findTimerLinkAndPosition } from "./timerTourHelpers";
import logger from "../../../shared/utils/logger.js";

/**
 * Custom hook for timer tour positioning
 */
export function useTimerTourPositioning(isVisible, currentStepData, currentStep) {
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

      // For timer button step, offset to avoid blocking the link
      let finalPosition = { top: position.top, left: position.left };
      if (currentStepData.id === "timer-button" && position.targetRect) {
        // Check if menu is actually open and give it time to load
        const menuSidebar = document.querySelector("#cm-mySidenav");
        const menuClasses = menuSidebar ? Array.from(menuSidebar.classList) : [];
        const isMenuOpen = menuSidebar && !menuSidebar.classList.contains("cm-hidden");

        logger.info(`🕐 Positioning DEBUG: Menu sidebar found: ${!!menuSidebar}, classes: [${menuClasses.join(', ')}], isMenuOpen: ${isMenuOpen}`);

        if (isMenuOpen) {
          // Try immediately first
          let timerLink = findTimerLinkAndPosition();

          // If not found, try again after a short delay for menu to fully load
          if (!timerLink) {
            setTimeout(() => {
              timerLink = findTimerLinkAndPosition();
              if (timerLink) {
                logger.info(`🕐 Positioning: Found timer link on retry, recalculating position`);
                calculatePosition(); // Recalculate with the found link
              }
            }, 100);
          }

          if (timerLink) {
            const timerRect = timerLink.getBoundingClientRect();
            logger.info(`🕐 Positioning: Found timer link at (${timerRect.top}, ${timerRect.left}, ${timerRect.right}, ${timerRect.bottom}), positioning tour to point at it`);

            // Position to the right of the timer link with proper spacing
            const viewportWidth = window.innerWidth;
            const tourWidth = 280;

            finalPosition = {
              top: Math.max(60, timerRect.top - 10), // Align with timer link top, slight offset up
              left: Math.min(
                timerRect.right + 30, // Close enough to clearly point to the timer link
                viewportWidth - tourWidth - 40 // Don't go off screen
              )
            };
          } else {
            logger.info(`🕐 Positioning: Timer link not found, using menu-relative positioning`);
            const sidebarRect = menuSidebar.getBoundingClientRect();
            finalPosition = {
              top: sidebarRect.top + 100,
              left: Math.min(
                sidebarRect.right + 30,
                window.innerWidth - 320
              )
            };
          }
        } else {
          logger.info(`🕐 Positioning: Menu not open, using default fallback positioning`);
          // Even if menu not detected as open, use a safe fallback position
          finalPosition = {
            top: 100,
            left: Math.max(350, window.innerWidth - 350)
          };
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
}

/**
 * Custom hook for menu state monitoring
 */
export function useMenuStateMonitor() {
  const [menuOpenState, setMenuOpenState] = useState(false);

  useEffect(() => {
    const checkMenuState = () => {
      const menuElement = document.querySelector("#cm-mySidenav");
      const isOpen = menuElement && !menuElement.classList.contains("cm-hidden");
      setMenuOpenState(isOpen);
    };

    checkMenuState();

    const observer = new MutationObserver(checkMenuState);
    const menuElement = document.querySelector("#cm-mySidenav");
    if (menuElement) {
      observer.observe(menuElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
    }

    return () => observer.disconnect();
  }, []);

  return menuOpenState;
}
