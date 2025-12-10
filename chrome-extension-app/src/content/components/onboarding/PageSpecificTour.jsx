/**
 * Page-Specific Tour Component
 *
 * Provides contextual onboarding for individual pages when users first visit them.
 * Supports different tour configurations for different routes.
 */

import React, { useState } from "react";
import { Stack } from '../ui/Layout.jsx';
import { ElementHighlighter } from "./ElementHighlighter";
import { useTheme } from "../../../shared/provider/themeprovider.jsx";
import {
  TourArrow,
  TourHeader,
  TourContent,
  TourControls,
  TourProgressBar,
  TourCard,
  getStepIcon,
} from "./PageSpecificTourComponents.jsx";
import {
  useSmartPositioning,
  useMenuStateMonitor,
  useAutoTriggerEffects,
  useForceHoverEffect,
  useTourNavigation,
  useEarlyTourCompletion,
  useTargetElementMonitoring,
  shouldShowStep,
} from "./PageSpecificTourHooks.js";

export function PageSpecificTour({
  tourId: _tourId,
  tourSteps,
  tourConfig,
  isVisible,
  onComplete,
  onClose
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';

  // Use tourSteps if provided, otherwise extract steps from tourConfig
  const steps = tourSteps || (tourConfig?.steps || []);
  const currentStepData = steps[currentStep];

  const menuOpenState = useMenuStateMonitor();
  useTargetElementMonitoring(isVisible, currentStepData);
  const { tourPosition, arrowPosition, hasInitiallyPositioned } = useSmartPositioning(
    isVisible,
    currentStepData,
    currentStep,
    menuOpenState
  );
  const { handleNext, handlePrevious, handleSkip, forceHoverState } = useTourNavigation(
    currentStep,
    setCurrentStep,
    steps,
    onComplete,
    onClose
  );

  // Use custom hooks for complex effects
  useForceHoverEffect(isVisible, currentStepData, currentStep, forceHoverState);
  useAutoTriggerEffects(isVisible, currentStepData, menuOpenState);
  useEarlyTourCompletion(isVisible, tourConfig, _tourId, onComplete);

  if (!isVisible || !currentStepData || !shouldShowStep(currentStepData, menuOpenState)) {
    return null;
  }

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

      <TourCard tourPosition={tourPosition} isDark={isDark}>
        <TourArrow arrowPosition={arrowPosition} />

        <TourHeader
          currentStep={currentStep}
          totalSteps={steps.length}
          onSkip={handleSkip}
        />

        <TourProgressBar
          currentStep={currentStep}
          totalSteps={steps.length}
          isDark={isDark}
        />

        <Stack spacing="xs">
          <TourContent
            stepData={currentStepData}
            getStepIcon={() => getStepIcon(currentStepData?.type)}
          />

          <TourControls
            currentStep={currentStep}
            totalSteps={steps.length}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onSkip={handleSkip}
          />
        </Stack>
      </TourCard>
    </>
  );
}
