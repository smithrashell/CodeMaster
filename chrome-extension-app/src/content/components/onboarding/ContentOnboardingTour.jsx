import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Stack } from '../ui/Layout.jsx';
import { ElementHighlighter } from "./ElementHighlighter";
import logger from "../../../shared/utils/logging/logger.js";
import { useTheme } from "../../../shared/provider/themeprovider.jsx";
import { TOUR_STEPS } from "./ContentOnboardingTourData.js";
import { getStepIcon, shouldShowStep, getArrowStyles } from "./ContentOnboardingTourHelpers.js";
import {
  useTourPositioning,
  useMenuStateMonitoring,
  useTargetElementMonitoring,
  useTourNavigation,
  useTourCompleteHandler,
  useTourCloseHandler,
  useNavigationDetectionEffect,
  useInteractionHandlingEffect
} from "./ContentOnboardingTourHooks.js";
import {
  TourCardHeader,
  TourCardContent,
  ActionPrompt,
  NavigationControls
} from "./ContentOnboardingTourComponents.jsx";

export function ContentOnboardingTour({ isVisible, onComplete, onClose }) {
  const navigate = useNavigate();
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';
  const [currentStep, setCurrentStep] = useState(0);
  const [isWaitingForInteraction, setIsWaitingForInteraction] = useState(false);
  const currentStepData = TOUR_STEPS[currentStep];
  const handleTourComplete = useTourCompleteHandler(onComplete);
  const handleTourClose = useTourCloseHandler(onClose);

  const { tourPosition, arrowPosition, hasInitiallyPositioned } = useTourPositioning(isVisible, currentStepData, currentStep);
  const menuOpenState = useMenuStateMonitoring(isVisible);
  useTargetElementMonitoring(isVisible, currentStepData);
  const { handleNext, handlePrevious, handleNavigation } = useTourNavigation(
    currentStep, { setCurrentStep, setIsWaitingForInteraction, onComplete: handleTourComplete, onClose: handleTourClose, navigate }
  );

  useNavigationDetectionEffect(isVisible, handleTourComplete);
  useInteractionHandlingEffect(isWaitingForInteraction, currentStepData, setIsWaitingForInteraction, handleNext, onComplete);

  logger.info(`step=${currentStep}, visible=${isVisible}, menu=${menuOpenState}`);
  if (!isVisible || !shouldShowStep(currentStepData, menuOpenState)) return null;
  if (!hasInitiallyPositioned || !tourPosition) return null;

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
        {arrowPosition && (
          <div
            style={{
              top: arrowPosition.top,
              left: arrowPosition.left,
              zIndex: 10001,
              ...getArrowStyles(arrowPosition.direction, isDark),
            }}
          />
        )}

        <Card
          shadow="lg"
          padding="sm"
          withBorder
          radius="md"
          style={{
            maxHeight: "80vh",
            overflowY: "auto",
            backgroundColor: isDark ? '#1a1b1e' : '#ffffff',
            borderColor: isDark ? '#373a40' : '#dee2e6'
          }}
        >
          <TourCardHeader
            currentStep={currentStep}
            totalSteps={TOUR_STEPS.length}
            onSkip={handleTourClose}
          />

          <div style={{
            width: '100%',
            height: '4px',
            backgroundColor: isDark ? '#373a40' : '#e9ecef',
            borderRadius: '2px',
            marginBottom: '12px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${((currentStep + 1) / TOUR_STEPS.length) * 100}%`,
              height: '100%',
              backgroundColor: '#228be6',
              borderRadius: '2px',
              transition: 'width 0.3s ease'
            }} />
          </div>

          <Stack spacing="xs">
            <TourCardContent
              currentStepData={currentStepData}
              getStepIcon={() => getStepIcon(currentStepData.id)}
            />

            {(currentStepData.actionPrompt && (typeof currentStepData.actionPrompt === 'function' ? currentStepData.actionPrompt() : currentStepData.actionPrompt)) && (
              <ActionPrompt actionPrompt={currentStepData.actionPrompt} />
            )}

            <NavigationControls
              currentStepData={currentStepData}
              currentStep={currentStep}
              totalSteps={TOUR_STEPS.length}
              handleNavigation={handleNavigation}
              handlePrevious={handlePrevious}
              handleSkip={handleTourClose}
              handleNext={handleNext}
            />
          </Stack>
        </Card>
      </div>
    </>
  );
}
