import logger from "../../../shared/utils/logger.js";
import React, { useState, useEffect, useCallback } from "react";
import { Card, Stack, Group } from '../ui/Layout.jsx';
import Text from '../ui/Text.jsx';
import Badge from '../ui/Badge.jsx';
// Note: ThemeIcon, Progress, ActionIcon simplified for onboarding
import { SimpleButton } from "../../../shared/components/ui/SimpleButton";
import {
  IconX,
  IconChevronRight,
  IconChevronLeft,
  IconCheck,
  IconBrain,
  IconClock,
  IconBulb,
  IconTarget,
} from "@tabler/icons-react";
import { ElementHighlighter } from "./ElementHighlighter";
import { smartPositioning } from "./SmartPositioning";

// Helper component for arrow pointer rendering
function TourArrow({ arrowPosition }) {
  if (!arrowPosition) return null;
  
  return (
    <div
      style={{
        position: "absolute",
        top: arrowPosition.top,
        left: arrowPosition.left,
        width: 0,
        height: 0,
        zIndex: 10001,
        ...(arrowPosition.direction === "up" && {
          borderLeft: "8px solid transparent",
          borderRight: "8px solid transparent",
          borderBottom: "8px solid white",
          filter: "drop-shadow(0 -2px 4px rgba(0,0,0,0.1))",
        }),
        ...(arrowPosition.direction === "down" && {
          borderLeft: "8px solid transparent",
          borderRight: "8px solid transparent",
          borderTop: "8px solid white",
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))",
        }),
        ...(arrowPosition.direction === "left" && {
          borderTop: "8px solid transparent",
          borderBottom: "8px solid transparent",
          borderRight: "8px solid white",
          filter: "drop-shadow(-2px 0 4px rgba(0,0,0,0.1))",
        }),
        ...(arrowPosition.direction === "right" && {
          borderTop: "8px solid transparent",
          borderBottom: "8px solid transparent",
          borderLeft: "8px solid white",
          filter: "drop-shadow(2px 0 4px rgba(0,0,0,0.1))",
        }),
      }}
    />
  );
}

// Helper component for tour header
function TourHeader({ currentStep, totalSteps, onSkip }) {
  return (
    <Group position="apart" mb="xs">
      <Badge color="green" variant="light" size="xs">
        {currentStep + 1} of {totalSteps}
      </Badge>
      <ActionIcon variant="subtle" size="xs" onClick={onSkip}>
        <IconX size={12} />
      </ActionIcon>
    </Group>
  );
}

// Helper component for tour content
function TourContent({ stepData, getStepIcon }) {
  return (
    <Group spacing="xs" align="flex-start">
      <ThemeIcon color="green" variant="light" size="sm" mt={1}>
        {getStepIcon()}
      </ThemeIcon>
      <div style={{ flex: 1 }}>
        <Text weight={600} size="xs" mb={2} style={{ lineHeight: 1.3 }}>
          {stepData.title}
        </Text>
        <Text size="xs" color="dimmed" style={{ lineHeight: 1.3 }}>
          {stepData.content}
        </Text>
      </div>
    </Group>
  );
}

// Helper component for navigation controls
function TourControls({ currentStep, totalSteps, onPrevious, onNext, onSkip }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "6px",
        marginTop: "8px",
        width: "100%",
      }}
    >
      <SimpleButton
        variant="ghost"
        size="sm"
        onClick={onPrevious}
        disabled={currentStep === 0}
        style={{ flex: 1, minWidth: "70px" }}
      >
        <IconChevronLeft size={12} style={{ marginRight: 4 }} />
        Back
      </SimpleButton>

      <SimpleButton
        variant="primary"
        size="sm"
        onClick={onNext}
        style={{ flex: 1, minWidth: "80px" }}
      >
        {currentStep === totalSteps - 1 ? (
          <>
            Got it!
            <IconCheck size={12} style={{ marginLeft: 4 }} />
          </>
        ) : (
          <>
            Next
            <IconChevronRight size={12} style={{ marginLeft: 4 }} />
          </>
        )}
      </SimpleButton>

      <SimpleButton
        variant="ghost"
        size="sm"
        onClick={onSkip}
        style={{ flexShrink: 0, minWidth: "50px" }}
      >
        Skip
      </SimpleButton>
    </div>
  );
}

// Custom hook for smart positioning
function useSmartPositioning(isVisible, currentStepData, currentStep) {
  const [tourPosition, setTourPosition] = useState({ top: 0, left: 0 });
  const [arrowPosition, setArrowPosition] = useState(null);

  useEffect(() => {
    if (!isVisible || !currentStepData) return;

    const calculatePosition = () => {
      const position = smartPositioning.calculatePosition(
        currentStepData.target,
        currentStepData.position
      );

      setTourPosition({ top: position.top, left: position.left });

      if (position.arrowDirection && position.targetRect) {
        const arrow = smartPositioning.getArrowPosition(
          position,
          position.targetRect,
          position.arrowDirection
        );
        setArrowPosition({ ...arrow, direction: position.arrowDirection });
      } else {
        setArrowPosition(null);
      }
    };

    // Initial calculation
    calculatePosition();

    // Recalculate on scroll/resize
    const handleReposition = () => calculatePosition();
    window.addEventListener("scroll", handleReposition);
    window.addEventListener("resize", handleReposition);

    return () => {
      window.removeEventListener("scroll", handleReposition);
      window.removeEventListener("resize", handleReposition);
    };
  }, [currentStep, isVisible, currentStepData]);

  return { tourPosition, arrowPosition };
}

// Custom hook for menu state monitoring
function useMenuStateMonitor() {
  const [menuOpenState, setMenuOpenState] = useState(false);

  useEffect(() => {
    const checkMenuState = () => {
      const menuElement = document.querySelector("#cm-mySidenav");
      const isOpen =
        menuElement && !menuElement.classList.contains("cm-hidden");
      setMenuOpenState(isOpen);
    };

    // Check immediately and set up observer
    checkMenuState();

    // Watch for menu state changes
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

// Custom hook for tour navigation
function useTourNavigation(currentStep, setCurrentStep, tourSteps, onComplete, onClose) {
  const handleNext = useCallback(() => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  }, [currentStep, tourSteps.length, onComplete, setCurrentStep]);

  const handlePrevious = () => {
    if (currentStep > 0) {
      const currentStepData = tourSteps[currentStep];
      const previousStepData = tourSteps[currentStep - 1];

      // Reverse menu state changes when going back
      if (currentStepData?.requiresMenuOpen && !previousStepData?.requiresMenuOpen) {
        // Current step required menu open, previous doesn't - close the menu
        const menuButton = document.querySelector("#cm-menuButton");
        const menuElement = document.querySelector("#cm-mySidenav");
        
        if (menuButton && menuElement && !menuElement.classList.contains("cm-hidden")) {
          logger.info("🔙 Back button: Closing menu (reversing state)");
          menuButton.click();
        }
      }

      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  return { handleNext, handlePrevious, handleSkip };
}

// Helper function for step icons
function getStepIcon(stepType) {
  switch (stepType) {
    case "feature":
      return <IconBulb size={18} />;
    case "interaction":
      return <IconTarget size={18} />;
    case "timer":
      return <IconClock size={18} />;
    case "strategy":
      return <IconBrain size={18} />;
    default:
      return <IconTarget size={18} />;
  }
}

// Helper function to check if step should be shown
function shouldShowStep(currentStepData, menuOpenState) {
  if (currentStepData?.requiresMenuOpen && !menuOpenState) {
    return false;
  }
  return true;
}

/**
 * Page-Specific Tour Component
 * 
 * Provides contextual onboarding for individual pages when users first visit them.
 * Supports different tour configurations for different routes.
 */
export function PageSpecificTour({ 
  tourId: _tourId, 
  tourSteps, 
  isVisible, 
  onComplete, 
  onClose 
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const currentStepData = tourSteps[currentStep];

  const { tourPosition, arrowPosition } = useSmartPositioning(isVisible, currentStepData, currentStep);
  const menuOpenState = useMenuStateMonitor();
  const { handleNext, handlePrevious, handleSkip } = useTourNavigation(
    currentStep, 
    setCurrentStep, 
    tourSteps, 
    onComplete, 
    onClose
  );

  if (!isVisible || !currentStepData || !shouldShowStep(currentStepData, menuOpenState)) {
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
        }}
      >
        <TourArrow arrowPosition={arrowPosition} />

        <Card shadow="lg" padding="sm" withBorder radius="md">
          <TourHeader 
            currentStep={currentStep} 
            totalSteps={tourSteps.length} 
            onSkip={handleSkip} 
          />

          <Progress
            value={((currentStep + 1) / tourSteps.length) * 100}
            size="xs"
            mb="sm"
            color="green"
          />

          <Stack spacing="xs">
            <TourContent 
              stepData={currentStepData} 
              getStepIcon={() => getStepIcon(currentStepData?.type)} 
            />
            
            <TourControls 
              currentStep={currentStep}
              totalSteps={tourSteps.length}
              onPrevious={handlePrevious}
              onNext={handleNext}
              onSkip={handleSkip}
            />
          </Stack>
        </Card>
      </div>
    </>
  );
}