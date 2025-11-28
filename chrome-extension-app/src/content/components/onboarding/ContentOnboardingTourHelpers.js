/**
 * Content Onboarding Tour Helper Functions
 * Extracted from ContentOnboardingTour.jsx
 */

import {
  IconTarget,
  IconBrain,
  IconClock,
  IconChartBar,
  IconMenu2,
  IconSettings,
  IconPlayerPlay,
  IconBulb,
  IconHeart,
} from "@tabler/icons-react";
import logger from "../../../shared/utils/logger.js";

/**
 * Helper function to handle user interactions
 */
export const createUserInteractionHandler = (currentStepData, setIsWaitingForInteraction, handleNext, onComplete) => {
  return (event) => {
    if (
      currentStepData.interactionType === "click" &&
      currentStepData.target &&
      event.target.closest(currentStepData.target)
    ) {
      logger.info("User interaction detected:", currentStepData.target);
      setIsWaitingForInteraction(false);

      if (currentStepData.target === "#cm-menuButton") {
        setTimeout(() => {
          handleNext();
        }, 500);
      } else if (currentStepData.id === "select-problem") {
        logger.info("User clicked problem link, advancing to next step");
        setTimeout(() => {
          handleNext();
        }, 300);
      } else if (currentStepData.target === "a[href='/Probgen']") {
        logger.info("User clicked Problem Generator, completing main tour");
        setTimeout(() => {
          onComplete();
        }, 300);
      } else {
        setTimeout(() => {
          handleNext();
        }, 300);
      }
    }
  };
};

/**
 * Helper function to get step icon
 */
export const getStepIcon = (stepId) => {
  switch (stepId) {
    case "welcome":
      return <IconBrain size={18} />;
    case "cm-button-intro":
    case "cm-button-interactive":
      return <IconTarget size={18} />;
    case "navigation-overview":
      return <IconMenu2 size={18} />;
    case "generator-feature":
      return <IconBulb size={18} />;
    case "statistics-feature":
      return <IconChartBar size={18} />;
    case "settings-feature":
      return <IconSettings size={18} />;
    case "timer-feature":
      return <IconClock size={18} />;
    case "guided-navigation":
      return <IconPlayerPlay size={18} />;
    case "completion":
      return <IconHeart size={18} />;
    default:
      return <IconTarget size={18} />;
  }
};

/**
 * Helper function to check if step should be shown
 */
export const shouldShowStep = (currentStepData, menuOpenState) => {
  if (currentStepData.requiresMenuOpen && !menuOpenState) {
    logger.info(`shouldShowStep: Menu required but not open (menuOpenState=${menuOpenState})`);
    return false;
  }

  if (currentStepData.target && currentStepData.screenKey !== "completion") {
    const targetElement = document.querySelector(currentStepData.target);
    if (!targetElement) {
      logger.info(`shouldShowStep: Target element not found: ${currentStepData.target}`);
      return false;
    }
  }

  return true;
};

/**
 * Helper function to get arrow styles based on direction
 */
export const getArrowStyles = (direction, isDark) => {
  const arrowColor = isDark ? '#1a1b1e' : 'white';

  const baseStyles = {
    position: "absolute",
    width: 0,
    height: 0,
    zIndex: 1001,
  };

  switch (direction) {
    case "up":
      return {
        ...baseStyles,
        borderLeft: "8px solid transparent",
        borderRight: "8px solid transparent",
        borderBottom: `8px solid ${arrowColor}`,
        filter: "drop-shadow(0 -2px 4px rgba(0,0,0,0.1))",
      };
    case "down":
      return {
        ...baseStyles,
        borderLeft: "8px solid transparent",
        borderRight: "8px solid transparent",
        borderTop: `8px solid ${arrowColor}`,
        filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))",
      };
    case "left":
      return {
        ...baseStyles,
        borderTop: "8px solid transparent",
        borderBottom: "8px solid transparent",
        borderRight: `8px solid ${arrowColor}`,
        filter: "drop-shadow(-2px 0 4px rgba(0,0,0,0.1))",
      };
    case "right":
      return {
        ...baseStyles,
        borderTop: "8px solid transparent",
        borderBottom: "8px solid transparent",
        borderLeft: `8px solid ${arrowColor}`,
        filter: "drop-shadow(2px 0 4px rgba(0,0,0,0.1))",
      };
    default:
      return baseStyles;
  }
};
