import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Stack, Group } from '../ui/Layout.jsx';
import Text from '../ui/Text.jsx';
import Badge from '../ui/Badge.jsx';
// Note: ThemeIcon, Progress, ActionIcon simplified for onboarding
import { baseButtonStyles, sizeStyles, getThemeAwareVariantStyles } from "../../../shared/components/ui/buttonStyles";
import {
  IconTarget,
  IconX,
  IconChevronRight,
  IconChevronLeft,
  IconCheck,
  IconBrain,
  IconClock,
  IconChartBar,
  IconMenu2,
  IconSettings,
  IconPlayerPlay,
  IconBulb,
  IconHeart,
  IconClick,
} from "@tabler/icons-react";
import { ElementHighlighter } from "./ElementHighlighter";
import { smartPositioning } from "./SmartPositioning";
import ChromeAPIErrorHandler from "../../../shared/services/ChromeAPIErrorHandler.js";
import logger from "../../../shared/utils/logger.js";

// Theme-aware SimpleButton for the tour
const SimpleButton = ({ variant = "primary", size = "md", disabled = false, onClick, children, style = {}, ...props }) => {
  // Get current theme
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
    ...style,
  };

  const handleMouseEnter = (e) => {
    if (disabled) return;
    if (variant === 'ghost') {
      e.target.style.backgroundColor = isDark ? "rgba(201, 201, 201, 0.1)" : "rgba(73, 80, 87, 0.1)";
      e.target.style.borderColor = isDark ? "rgba(201, 201, 201, 0.5)" : "rgba(73, 80, 87, 0.5)";
    } else if (variant === 'primary') {
      e.target.style.backgroundColor = "#364fc7";
    } else if (variant === 'secondary') {
      e.target.style.backgroundColor = isDark ? "#495057" : "#e9ecef";
    }
  };

  const handleMouseLeave = (e) => {
    if (disabled) return;
    if (variant === 'ghost') {
      e.target.style.backgroundColor = "transparent";
      e.target.style.borderColor = isDark ? "rgba(201, 201, 201, 0.3)" : "rgba(73, 80, 87, 0.3)";
    } else if (variant === 'primary') {
      e.target.style.backgroundColor = "#4c6ef5";
    } else if (variant === 'secondary') {
      e.target.style.backgroundColor = isDark ? "#373a40" : "#f1f3f4";
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

// Tour Card Header Component
const TourCardHeader = ({ currentStep, totalSteps, onSkip }) => {
  // Get current theme for proper button styling
  const isDark = document.documentElement.getAttribute('data-mantine-color-scheme') === 'dark' ||
                 document.body.classList.contains('dark-theme') ||
                 window.matchMedia?.('(prefers-color-scheme: dark)').matches;

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
      <Badge color="blue" variant="light" size="xs">
        {currentStep + 1} of {totalSteps}
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
          color: isDark ? '#c9c9c9' : '#495057'
        }}
        onClick={onSkip}
        onMouseEnter={(e) => {
          e.target.style.backgroundColor = isDark ? '#373a40' : '#f8f9fa';
        }}
        onMouseLeave={(e) => {
          e.target.style.backgroundColor = 'transparent';
        }}
      >
        <IconX size={12} />
      </button>
    </div>
  );
};

// Tour Card Content Component  
const TourCardContent = ({ currentStepData, getStepIcon }) => {
  // Get current theme
  const isDark = document.documentElement.getAttribute('data-mantine-color-scheme') === 'dark' ||
                 document.body.classList.contains('dark-theme') ||
                 window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
      <div style={{
        backgroundColor: isDark 
          ? 'var(--mantine-color-blue-8, #1c3f5c)' 
          : 'var(--mantine-color-blue-1, #e3f2fd)',
        color: isDark 
          ? 'var(--mantine-color-blue-3, #74c0fc)' 
          : 'var(--mantine-color-blue-6, #1976d2)',
        borderRadius: '4px',
        padding: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '24px',
        height: '24px',
        marginTop: '2px'
      }}>
        {getStepIcon()}
      </div>
      <div style={{ flex: 1 }}>
        <Text weight={600} size="xs" mb={2} style={{ lineHeight: 1.3 }}>
          {currentStepData.title}
        </Text>
        <Text size="xs" color="dimmed" style={{ lineHeight: 1.3 }}>
          {currentStepData.content}
        </Text>
      </div>
    </div>
  );
};

// Action Prompt Component
const ActionPrompt = ({ actionPrompt }) => {
  // Get current theme
  const isDark = document.documentElement.getAttribute('data-mantine-color-scheme') === 'dark' ||
                 document.body.classList.contains('dark-theme') ||
                 window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  
  return (
    <div
      style={{
        padding: "4px 8px",
        backgroundColor: isDark ? "#1c3f5c" : "#e3f2fd",
        borderRadius: "4px",
        border: isDark ? "1px solid #2c5aa0" : "1px solid #90caf9",
      }}
    >
      <Group spacing="xs">
        <IconClick size={12} color={isDark ? "#74c0fc" : "#1976d2"} />
        <Text size="xs" color={isDark ? "#74c0fc" : "#1976d2"} weight={500} style={{ lineHeight: 1.2 }}>
          {actionPrompt}
        </Text>
      </Group>
    </div>
  );
};

// Navigation Controls Component
const NavigationControls = ({ 
  currentStepData, 
  currentStep, 
  totalSteps, 
  handleNavigation, 
  handlePrevious, 
  handleSkip, 
  handleNext 
}) => {
  if (currentStepData.hasNavigationButton) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          marginTop: "8px",
          width: "100%",
        }}
      >
        <SimpleButton
          variant="primary"
          size="md"
          onClick={handleNavigation}
          style={{ width: "100%" }}
        >
          <IconChevronRight size={14} style={{ marginRight: 6 }} />
          {currentStepData.navigationText || "Continue"}
        </SimpleButton>
        
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            gap: "6px",
          }}
        >
          <SimpleButton
            variant="ghost"
            size="sm"
            onClick={handlePrevious}
            disabled={currentStep === 0}
            style={{ flex: 1 }}
          >
            <IconChevronLeft size={12} style={{ marginRight: 4 }} />
            Back
          </SimpleButton>

          <SimpleButton
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            style={{ flex: 1 }}
          >
            Skip Tour
          </SimpleButton>
        </div>
      </div>
    );
  }

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
        onClick={handlePrevious}
        disabled={currentStep === 0}
        style={{ flex: 1, minWidth: "70px" }}
      >
        <IconChevronLeft size={12} style={{ marginRight: 4 }} />
        Back
      </SimpleButton>

      <SimpleButton
        variant="primary"
        size="sm"
        onClick={handleNext}
        disabled={false}
        style={{ flex: 1, minWidth: "80px" }}
      >
        {currentStep === totalSteps - 1 ? (
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

      <SimpleButton
        variant="ghost"
        size="sm"
        onClick={handleSkip}
        style={{ flexShrink: 0, minWidth: "50px" }}
      >
        Skip
      </SimpleButton>
    </div>
  );
};

const TOUR_STEPS = [
  {
    id: "welcome",
    title: "Welcome to CodeMaster!",
    content:
      "Let's take a quick tour of CodeMaster's features to help you solve problems more effectively. This will only take 2 minutes.",
    target: null,
    position: "center",
    highlightType: null,
    screenKey: "intro",
    interactionType: null,
    actionPrompt: null,
  },
  {
    id: "cm-button-intro",
    title: "Your CodeMaster Control Center",
    content:
      "This 'CM' button is your gateway to all CodeMaster features. It's always available when you're on LeetCode.",
    target: "#cm-menuButton",
    position: "auto",
    highlightType: "spotlight",
    screenKey: "cmButton",
    interactionType: null,
    actionPrompt: null,
  },
  {
    id: "cm-button-interactive",
    title: "Opening the Menu",
    content:
      "Perfect! Now we'll automatically open the CodeMaster dashboard for you. The menu will appear on the right side.",
    target: "#cm-menuButton",
    position: "auto",
    highlightType: "pointer",
    screenKey: "cmButton",
    interactionType: null,
    actionPrompt: null,
    waitForInteraction: false,
    autoTriggerSelector: "#cm-menuButton",
  },
  {
    id: "navigation-overview",
    title: "Your CodeMaster Dashboard",
    content:
      "Perfect! This is your CodeMaster menu. Here you can access all the tools to improve your problem-solving skills.",
    target: "#cm-mySidenav",
    position: "auto",
    highlightType: "outline",
    screenKey: "navigation",
    interactionType: null,
    actionPrompt: null,
    requiresMenuOpen: true,
  },
  {
    id: "generator-feature",
    title: "Problem Generator",
    content:
      "Get personalized problem recommendations based on your current skill level and learning goals. This adapts as you improve!",
    target: "a[href='/Probgen']",
    position: "auto",
    highlightType: "outline",
    screenKey: "generator",
    interactionType: null,
    actionPrompt: null,
    requiresMenuOpen: true,
  },
  {
    id: "statistics-feature",
    title: "Statistics & Analytics",
    content:
      "Track your progress, view detailed performance analytics, and identify your strengths and areas for improvement.",
    target: "a[href='/Probstat']",
    position: "auto",
    highlightType: "outline",
    screenKey: "statistics",
    interactionType: null,
    actionPrompt: null,
    requiresMenuOpen: true,
  },
  {
    id: "settings-feature",
    title: "Settings & Preferences",
    content:
      "Customize your CodeMaster experience, adjust difficulty preferences, and configure your learning goals.",
    target: "a[href='/Settings']",
    position: "auto",
    highlightType: "outline",
    screenKey: "settings",
    interactionType: null,
    actionPrompt: null,
    requiresMenuOpen: true,
  },
  {
    id: "timer-feature",
    title: "Problem Timer",
    content:
      "When you're solving a problem, use this to time your attempts and track your solving patterns over time.",
    target: "a[href='/Probtime']",
    position: "auto",
    highlightType: "outline",
    screenKey: "problemTimer",
    interactionType: null,
    actionPrompt: null,
    requiresMenuOpen: true,
  },
  {
    id: "guided-navigation",
    title: "Let's Explore the Problem Generator!",
    content:
      "Ready to see CodeMaster in action? We'll take you to the Problem Generator where you can find personalized problem recommendations and see how the strategy system works. Click the button below to continue your guided tour.",
    target: null,
    position: "center",
    highlightType: null,
    screenKey: "guidedNavigation",
    interactionType: null,
    actionPrompt: null,
    hasNavigationButton: true,
    navigationRoute: "/Probgen",
    navigationText: "Go to Problem Generator",
  },
  {
    id: "completion",
    title: "You're Ready to Start!",
    content:
      "You've seen CodeMaster's complete toolkit: smart problem selection, tailored strategies, and progressive hints. Click on any problem in the generator to experience the full system. Happy coding!",
    target: null,
    position: "center",
    highlightType: null,
    screenKey: "completion",
    interactionType: null,
    actionPrompt: null,
  },
];

// Custom hook for tour positioning logic
const useTourPositioning = (isVisible, currentStepData, currentStep) => {
  const [tourPosition, setTourPosition] = useState({ top: 0, left: 0 });
  const [arrowPosition, setArrowPosition] = useState(null);

  useEffect(() => {
    if (!isVisible) return;

    const calculatePosition = () => {
      try {
        console.log(`🎯 TOUR DEBUG: Calculating position for step ${currentStep}`, {
          target: currentStepData.target,
          position: currentStepData.position,
          screenKey: currentStepData.screenKey
        });
        
        const position = smartPositioning.calculatePosition(
          currentStepData.target,
          currentStepData.position,
          currentStepData.screenKey === "completion" ? "center" : undefined
        );
        
        console.log(`📍 TOUR DEBUG: Position calculated:`, position);
        
        // Add defensive checks to prevent undefined errors
        if (position && typeof position.top === 'number' && typeof position.left === 'number') {
          console.log(`✅ TOUR DEBUG: Setting position:`, position);
          setTourPosition({ top: position.top, left: position.left });
          setArrowPosition(position.arrowDirection ? {
            direction: position.arrowDirection,
            placement: position.placement
          } : null);
        } else {
          console.warn("ContentOnboardingTour: Invalid position calculated, using fallback");
          setTourPosition({ top: 100, left: 100 }); // Fallback position
          setArrowPosition(null);
        }
      } catch (error) {
        console.error("ContentOnboardingTour: Error calculating position:", error);
        setTourPosition({ top: 100, left: 100 }); // Fallback position
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
};

// Custom hook for menu state monitoring
const useMenuStateMonitoring = (isVisible) => {
  const [menuOpenState, setMenuOpenState] = useState(false);

  useEffect(() => {
    if (!isVisible) return;

    const checkMenuState = () => {
      const menuElement = document.querySelector("#cm-mySidenav");
      const isOpen = menuElement && !menuElement.classList.contains("cm-hidden");
      setMenuOpenState(isOpen);
      logger.info("Menu state check:", { isOpen, element: !!menuElement });
    };

    checkMenuState();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes" && mutation.attributeName === "class") {
          checkMenuState();
        }
      });
    });

    const menuElement = document.querySelector("#cm-mySidenav");
    if (menuElement) {
      observer.observe(menuElement, { attributes: true });
    }

    return () => observer.disconnect();
  }, [isVisible]);

  return menuOpenState;
};

// Custom hook for tour navigation logic
const useTourNavigation = (currentStep, { setCurrentStep, setIsWaitingForInteraction, onComplete, onClose, navigate }) => {
  const proceedToNextStep = useCallback(() => {
    if (currentStep < TOUR_STEPS.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      
      // Check if next step requires user interaction
      if (TOUR_STEPS[nextStep]?.waitForUserClick) {
        setIsWaitingForInteraction(true);
      } else {
        setIsWaitingForInteraction(false);
      }
    } else {
      onComplete();
    }
  }, [currentStep, onComplete, setCurrentStep, setIsWaitingForInteraction]);

  const handleNext = useCallback(async () => {
    const currentStepData = TOUR_STEPS[currentStep];
    
    // Update progress in database
    try {
      await ChromeAPIErrorHandler.sendMessageWithRetry({
        type: "updateContentOnboardingStep",
        currentStep,
        screenKey: currentStepData.screenKey,
        interactionType: currentStepData.interactionType
      });
    } catch (error) {
      logger.error("Error updating onboarding progress:", error);
    }

    // Auto-trigger UI element if specified
    if (currentStepData.autoTriggerSelector) {
      const targetElement = document.querySelector(currentStepData.autoTriggerSelector);
      if (targetElement) {
        logger.info("Auto-triggering element:", currentStepData.autoTriggerSelector);
        targetElement.click();
        // Wait for UI to respond before proceeding
        // Longer delay for navigation steps
        const delay = currentStepData.id === 'problem-generator-demo' ? 1000 : 600;
        setTimeout(() => {
          proceedToNextStep();
        }, delay);
        return;
      } else {
        logger.warn("Auto-trigger target not found:", currentStepData.autoTriggerSelector);
      }
    }

    // Proceed normally if no auto-trigger
    proceedToNextStep();
  }, [currentStep, proceedToNextStep]);

  const handlePrevious = () => {
    if (currentStep > 0) {
      const currentStepData = TOUR_STEPS[currentStep];
      const previousStepData = TOUR_STEPS[currentStep - 1];

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
      setIsWaitingForInteraction(false);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  const handleNavigation = useCallback(() => {
    const currentStepData = TOUR_STEPS[currentStep];
    if (currentStepData.navigationRoute) {
      logger.info("Navigating to:", currentStepData.navigationRoute);
      navigate(currentStepData.navigationRoute);
      // Complete the tour after navigation
      setTimeout(() => {
        onComplete();
      }, 300);
    }
  }, [currentStep, navigate, onComplete]);

  return {
    handleNext,
    handlePrevious,
    handleSkip,
    handleNavigation,
    proceedToNextStep
  };
};

// Helper function to handle user interactions
const createUserInteractionHandler = (currentStepData, setIsWaitingForInteraction, handleNext, onComplete) => {
  return (event) => {
    if (
      currentStepData.interactionType === "click" &&
      currentStepData.target &&
      event.target.closest(currentStepData.target)
    ) {
      logger.info("User interaction detected:", currentStepData.target);
      setIsWaitingForInteraction(false);

      // Special handling for different interaction types
      if (currentStepData.target === "#cm-menuButton") {
        setTimeout(() => {
          handleNext();
        }, 500); // Longer delay for menu animation
      } else if (currentStepData.target === "a[href='/Probgen']") {
        // User clicked Problem Generator - complete the main tour
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

// Helper function to get step icon
const getStepIcon = (stepId) => {
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

// Helper function to check if step should be shown
const shouldShowStep = (currentStepData, menuOpenState) => {
  if (currentStepData.requiresMenuOpen && !menuOpenState) {
    return false;
  }
  return true;
};

// Helper function to get arrow styles based on direction
const getArrowStyles = (direction) => {
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
        borderBottom: "8px solid white",
        filter: "drop-shadow(0 -2px 4px rgba(0,0,0,0.1))",
      };
    case "down":
      return {
        ...baseStyles,
        borderLeft: "8px solid transparent",
        borderRight: "8px solid transparent",
        borderTop: "8px solid white",
        filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))",
      };
    case "left":
      return {
        ...baseStyles,
        borderTop: "8px solid transparent",
        borderBottom: "8px solid transparent",
        borderRight: "8px solid white",
        filter: "drop-shadow(-2px 0 4px rgba(0,0,0,0.1))",
      };
    case "right":
      return {
        ...baseStyles,
        borderTop: "8px solid transparent",
        borderBottom: "8px solid transparent",
        borderLeft: "8px solid white",
        filter: "drop-shadow(2px 0 4px rgba(0,0,0,0.1))",
      };
    default:
      return baseStyles;
  }
};

export function ContentOnboardingTour({ isVisible, onComplete, onClose }) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isWaitingForInteraction, setIsWaitingForInteraction] = useState(false);

  const currentStepData = TOUR_STEPS[currentStep];
  
  // Use extracted hooks
  const { tourPosition, arrowPosition } = useTourPositioning(isVisible, currentStepData, currentStep);
  const menuOpenState = useMenuStateMonitoring(isVisible);
  const { handleNext, handlePrevious, handleSkip, handleNavigation } = useTourNavigation(
    currentStep, { setCurrentStep, setIsWaitingForInteraction, onComplete, onClose, navigate }
  );
  useEffect(() => {
    if ((!isWaitingForInteraction || !currentStepData.waitForInteraction) && !currentStepData.waitForUserClick) return;

    const handleInteraction = createUserInteractionHandler(
      currentStepData, 
      setIsWaitingForInteraction, 
      handleNext, 
      onComplete
    );

    // Also add escape hatch - allow manual proceed after 5 seconds
    const escapeTimer = setTimeout(() => {
      logger.info("Interaction timeout, allowing manual proceed");
      setIsWaitingForInteraction(false);
    }, 5000);

    document.addEventListener("click", handleInteraction, true); // Use capture phase
    return () => {
      document.removeEventListener("click", handleInteraction, true);
      clearTimeout(escapeTimer);
    };
  }, [isWaitingForInteraction, currentStepData, handleNext, onComplete]);

  if (!isVisible || !shouldShowStep(currentStepData, menuOpenState)) {
    return null;
  }

  // Additional safety check for positioning
  if (!tourPosition || typeof tourPosition.top === 'undefined' || typeof tourPosition.left === 'undefined') {
    console.warn("ContentOnboardingTour: Invalid tourPosition, skipping render");
    return null;
  }

  return (
    <>
      {/* Element Highlighting */}
      <ElementHighlighter
        targetSelector={currentStepData.target}
        highlightType={currentStepData.highlightType}
        isActive={true}
      />

      {/* Tour Card */}
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
        {/* Arrow pointer */}
        {arrowPosition && (
          <div
            style={{
              top: arrowPosition.top,
              left: arrowPosition.left,
              zIndex: 10001,
              ...getArrowStyles(arrowPosition.direction),
            }}
          />
        )}

        <Card shadow="lg" padding="sm" withBorder radius="md">
          {/* Header */}
          <TourCardHeader 
            currentStep={currentStep} 
            totalSteps={TOUR_STEPS.length} 
            onSkip={handleSkip} 
          />

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
              width: `${((currentStep + 1) / TOUR_STEPS.length) * 100}%`,
              height: '100%',
              backgroundColor: '#228be6',
              borderRadius: '2px',
              transition: 'width 0.3s ease'
            }} />
          </div>

          {/* Content */}
          <Stack spacing="xs">
            <TourCardContent 
              currentStepData={currentStepData} 
              getStepIcon={() => getStepIcon(currentStepData.id)} 
            />

            {/* Action Prompt */}
            {currentStepData.actionPrompt && (
              <ActionPrompt actionPrompt={currentStepData.actionPrompt} />
            )}

            {/* Navigation Controls */}
            <NavigationControls 
              currentStepData={currentStepData}
              currentStep={currentStep}
              totalSteps={TOUR_STEPS.length}
              handleNavigation={handleNavigation}
              handlePrevious={handlePrevious}
              handleSkip={handleSkip}
              handleNext={handleNext}
            />
          </Stack>
        </Card>
      </div>
    </>
  );
}
