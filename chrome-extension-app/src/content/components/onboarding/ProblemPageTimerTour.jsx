import React, { useState, useEffect } from "react";
import { Card, Stack } from '../ui/Layout.jsx';
import Text from '../ui/Text.jsx';
import Badge from '../ui/Badge.jsx';
import { baseButtonStyles, sizeStyles, getThemeAwareVariantStyles } from "../../../shared/components/ui/buttonStyles";
import {
  IconX,
  IconChevronRight,
  IconChevronLeft,
  IconCheck,
  IconClock,
} from "@tabler/icons-react";
import { ElementHighlighter } from "./ElementHighlighter";
import { TIMER_TOUR_STEPS, checkTimerTourCompleted, markTimerTourCompleted } from "./timerTourHelpers";
import { useTimerTourPositioning, useMenuStateMonitor } from "./timerTourHooks";
import logger from "../../../shared/utils/logger.js";

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

export function ProblemPageTimerTour({ isVisible, onComplete, onClose }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const currentStepData = TIMER_TOUR_STEPS[currentStep];
  
  const { tourPosition, arrowPosition, hasInitiallyPositioned } = useTimerTourPositioning(isVisible, currentStepData, currentStep);
  const menuOpenState = useMenuStateMonitor();

  // Check if tour should be shown
  useEffect(() => {
    const initializeTour = async () => {
      if (!isVisible) return;
      
      setIsLoading(true);
      const isCompleted = await checkTimerTourCompleted();
      
      if (isCompleted) {
        logger.info("🕐 Timer tour already completed");
        setIsLoading(false);
        return;
      }
      
      logger.info("🕐 Starting timer mini-tour");
      setIsLoading(false);
    };
    
    initializeTour();
  }, [isVisible]);

  // Auto-open menu for steps that require it
  useEffect(() => {
    if (!isVisible || !currentStepData) return;
    
    if (currentStepData.requiresMenuOpen && !menuOpenState) {
      const menuButton = document.querySelector("#cm-menuButton");
      if (menuButton) {
        logger.info("🕐 Opening menu for timer tour step");
        menuButton.click();
      }
    }
  }, [isVisible, currentStepData, menuOpenState]);

  const handleNext = () => {
    if (currentStep < TIMER_TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    await markTimerTourCompleted();
    logger.info("🕐 Timer tour completed");
    onComplete();
  };

  const handleSkip = () => {
    onClose();
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

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
        {arrowPosition && (
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
        )}

        <Card shadow="lg" padding="sm" withBorder radius="md" style={{ maxHeight: "80vh", overflowY: "auto" }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <Badge color="orange" variant="light" size="xs">
              Problem Analysis: {currentStep + 1} of {TIMER_TOUR_STEPS.length}
            </Badge>
            <button 
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#495057'
              }}
              onClick={handleSkip}
            >
              <IconX size={12} />
            </button>
          </div>

          {/* Progress Bar */}
          <div style={{ 
            width: '100%', 
            height: '4px', 
            backgroundColor: '#e9ecef', 
            borderRadius: '2px',
            marginBottom: '12px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${((currentStep + 1) / TIMER_TOUR_STEPS.length) * 100}%`,
              height: '100%',
              backgroundColor: '#fd7e14',
              borderRadius: '2px',
              transition: 'width 0.3s ease'
            }} />
          </div>

          <Stack spacing="xs">
            {/* Content */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
                <div style={{
                  backgroundColor: '#fff4e6',
                  color: '#fd7e14',
                  borderRadius: '4px',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '24px',
                  height: '24px',
                  margin: '2px'
                }}>
                  <IconClock size={18} />
                </div>
                <Text 
                  weight={600} 
                  size="sm" 
                  margin="0px 0px 0px 8px" 
                  style={{ lineHeight: 1.3, color: '#1a1a1a !important' }}
                >
                  {currentStepData.title}
                </Text>
              </div>
              <div>
                <Text 
                  size="xs" 
                  style={{ lineHeight: 1.3, color: '#1a1a1a !important' }}
                >
                  {currentStepData.content}
                </Text>
              </div>
            </div>
            
            {/* Navigation Controls - matching main tour layout */}
            <div style={{ 
              display: "flex", 
              flexDirection: "row", 
              justifyContent: "space-between", 
              alignItems: "center", 
              gap: "6px", 
              marginTop: "8px", 
              width: "100%" 
            }}>
              {/* Back Button */}
              <SimpleButton
                variant="ghost"
                size="sm"
                onClick={handlePrevious}
                disabled={currentStep === 0}
                style={{ flex: 1, minWidth: "70px" }}
              >
                <IconChevronLeft size={12} style={{ marginRight: 4 }} />
                Back
              </SimpleButton>
              
              {/* Next/Complete Button */}
              <SimpleButton
                variant="primary"
                size="sm"
                onClick={handleNext}
                style={{ flex: 1, minWidth: "80px" }}
              >
                {currentStep === TIMER_TOUR_STEPS.length - 1 ? (
                  <>
                    Finish
                    <IconCheck size={12} style={{ marginLeft: 4 }} />
                  </>
                ) : (
                  <>
                    Next
                    <IconChevronRight size={12} style={{ marginLeft: 4 }} />
                  </>
                )}
              </SimpleButton>
              
              {/* Skip Button */}
              <SimpleButton
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                style={{ 
                  flex: 0,
                  flexShrink: 0,
                  minWidth: "50px",
                  textDecoration: 'underline',
                  transition: 'transform 0.2s ease',
                  color: '#1a1a1a !important',
                  backgroundColor: 'transparent !important'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'scale(1.20)';
                  e.target.style.backgroundColor = 'transparent';
                  e.target.style.color = '#1a1a1a';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'scale(1)';
                  e.target.style.backgroundColor = 'transparent';
                  e.target.style.color = '#1a1a1a';
                }}
              >
                Skip
              </SimpleButton>
            </div>
          </Stack>
        </Card>
      </div>
    </>
  );
}