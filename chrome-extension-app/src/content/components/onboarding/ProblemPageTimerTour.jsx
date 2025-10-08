import React, { useState } from "react";
import { Card, Stack } from '../ui/Layout.jsx';
import { baseButtonStyles, sizeStyles, getThemeAwareVariantStyles } from "../../../shared/components/ui/buttonStyles";
import { ElementHighlighter } from "./ElementHighlighter";
import logger from "../../../shared/utils/logger.js";
import {
  TourArrow,
  TourHeader,
  TourProgressBar,
  TourContent
} from "./ProblemPageTimerTourComponents.jsx";
import { TimerTourNavigation } from "./TimerTourNavigation.jsx";
import { TIMER_TOUR_STEPS } from "./ProblemPageTimerTourHelpers.js";
import { useTourInitialization, useAutoMenuOpen, useTourHandlers } from "./useProblemPageTimerTour.js";
import { useTimerTourPositioning, useMenuStateMonitor } from "./TimerTourPositioningHooks.js";

// Theme-aware SimpleButton for the tour
const SimpleButton = ({ variant = "primary", size = "md", disabled = false, onClick, children, style = {}, ...props }) => {
  const isDark = document.documentElement.getAttribute('data-mantine-color-scheme') === 'dark' ||
                 document.body.classList.contains('dark-theme') ||
                 window.matchMedia?.('(prefers-color-scheme: dark)').matches;

  const themeAwareVariants = getThemeAwareVariantStyles(isDark);
  
  const buttonStyles = {
    ...baseButtonStyles,
    ...sizeStyles[size],
    ...themeAwareVariants[variant],
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    outline: 'none',
    border: variant === 'ghost' ? 'none' : (themeAwareVariants[variant]?.border || '1px solid transparent'),
    ...style,
    color: variant === 'ghost' ? '#1a1a1a' : (variant === 'primary' ? '#ffffff' : '#1a1a1a'),
  };

  const handleMouseEnter = (e) => {
    if (disabled) return;
    const button = e.currentTarget;
    if (variant === 'ghost') {
      button.style.backgroundColor = "rgba(26, 26, 26, 0.1)";
      button.style.color = '#1a1a1a';
      button.style.border = 'none';
    } else if (variant === 'primary') {
      button.style.backgroundColor = "#364fc7";
      button.style.color = '#ffffff';
    }
  };

  const handleMouseLeave = (e) => {
    if (disabled) return;
    const button = e.currentTarget;
    if (variant === 'ghost') {
      button.style.backgroundColor = "transparent";
      button.style.color = '#1a1a1a';
      button.style.border = 'none';
    } else if (variant === 'primary') {
      button.style.backgroundColor = "#4c6ef5";
      button.style.color = '#ffffff';
    }
  };

  return (
    <button
      style={buttonStyles}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {children}
    </button>
  );
};

// Timer tour steps, helper functions, and positioning hooks extracted to separate files:
// - TIMER_TOUR_STEPS, checkTimerTourCompleted, markTimerTourCompleted → ProblemPageTimerTourHelpers.js
// - useTimerTourPositioning, useMenuStateMonitor → TimerTourPositioningHooks.js

export function ProblemPageTimerTour({ isVisible, onComplete, onClose }) {
  const [currentStep, setCurrentStep] = useState(0);
  const currentStepData = TIMER_TOUR_STEPS[currentStep];

  const { tourPosition, arrowPosition, hasInitiallyPositioned } = useTimerTourPositioning(isVisible, currentStepData, currentStep);
  const menuOpenState = useMenuStateMonitor();

  // Use custom hooks for initialization and auto-open
  const isLoading = useTourInitialization(isVisible);
  useAutoMenuOpen(isVisible, currentStepData, menuOpenState);

  // Use custom hook for event handlers
  const { handleNext, handleComplete: _handleComplete, handleSkip, handlePrevious } = useTourHandlers(
    currentStep,
    setCurrentStep,
    onComplete,
    onClose
  );

  // Don't show if loading or tour is completed
  if (!isVisible || isLoading) {
    logger.info(`🕐 Timer tour blocked: isVisible=${isVisible}, isLoading=${isLoading}`);
    return null;
  }

  // Don't show if step requires menu open but menu is closed
  if (currentStepData?.requiresMenuOpen && !menuOpenState) {
    logger.info(`🕐 Timer tour blocked: step requires menu open but menu is closed. Step: ${currentStepData.id}, menuOpen: ${menuOpenState}`);
    return null;
  }

  // For timer-button step, just make sure the menu is open
  // Remove the off-screen position check - let it show even with fallback positioning

  logger.info(`🕐 Timer tour RENDERING: step=${currentStep}, stepId=${currentStepData?.id}, isVisible=${isVisible}, menuOpen=${menuOpenState}, hasPositioned=${hasInitiallyPositioned}`);

  // Don't show tour until positioning is complete to prevent flash
  if (!hasInitiallyPositioned || !tourPosition) {
    return null;
  }

  return (
    <>
      <ElementHighlighter
        targetSelector={currentStepData.target}
        highlightType={currentStepData.highlightType}
        isActive={true}
      />

      <div
        style={{
          position: "absolute",
          top: tourPosition.top,
          left: tourPosition.left,
          zIndex: 10000,
          width: 280,
          maxWidth: "90vw",
          maxHeight: "80vh",
          overflow: "hidden",
        }}
      >
        <TourArrow arrowPosition={arrowPosition} />

        <Card shadow="lg" padding="sm" withBorder radius="md" style={{ maxHeight: "80vh", overflowY: "auto" }}>
          <TourHeader currentStep={currentStep} totalSteps={TIMER_TOUR_STEPS.length} onSkip={handleSkip} />
          <TourProgressBar currentStep={currentStep} totalSteps={TIMER_TOUR_STEPS.length} />

          <Stack spacing="xs">
            <TourContent title={currentStepData.title} content={currentStepData.content} />
            <TimerTourNavigation
              SimpleButton={SimpleButton}
              currentStep={currentStep}
              totalSteps={TIMER_TOUR_STEPS.length}
              handlePrevious={handlePrevious}
              handleNext={handleNext}
              handleSkip={handleSkip}
            />
          </Stack>
        </Card>
      </div>
    </>
  );
}