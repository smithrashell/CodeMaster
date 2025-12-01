/**
 * Helper functions for ContentOnboardingTour render logic
 *
 * Extracted to reduce component complexity
 */

import logger from "../../../shared/utils/logging/logger.js";

/**
 * Log tour render check for debugging
 */
export const logTourRenderCheck = (currentStep, isVisible, menuOpenState, currentStepData, shouldShow) => {
  logger.info(`🔍 RENDER CHECK: step=${currentStep}, isVisible=${isVisible}, menuOpenState=${menuOpenState}, requiresMenuOpen=${currentStepData?.requiresMenuOpen}, shouldShow=${shouldShow}`);
};

/**
 * Log blocked render for visibility/menu
 */
export const logBlockedRenderVisibility = (isVisible, shouldShow, currentStep, stepId) => {
  logger.info(`❌ BLOCKING RENDER: isVisible=${isVisible}, shouldShow=${shouldShow}, step=${currentStep}, stepId=${stepId}`);
};

/**
 * Log blocked render for positioning
 */
export const logBlockedRenderPositioning = (hasPositioned, hasPosition, currentStep) => {
  logger.info(`❌ BLOCKING RENDER (positioning): hasPositioned=${hasPositioned}, hasPosition=${hasPosition}, step=${currentStep}`);
};
