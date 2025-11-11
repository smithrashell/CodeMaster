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
    outline: 'none', // Remove outline
    border: variant === 'ghost' ? 'none' : (themeAwareVariants[variant]?.border || '1px solid transparent'),
    ...style,
    // Override color last to ensure it takes precedence
    color: variant === 'ghost' ? '#1a1a1a' : (variant === 'primary' ? '#ffffff' : '#1a1a1a'),
  };

  const handleMouseEnter = (e) => {
    if (disabled) return;
    // Ensure we target the button element, not child elements
    const button = e.currentTarget;
    if (variant === 'ghost') {
      button.style.backgroundColor = "rgba(26, 26, 26, 0.1)";
      button.style.color = '#1a1a1a';
      button.style.border = 'none';
      // Also update icon color
      const icons = button.querySelectorAll('svg');
      icons.forEach(icon => {
        icon.style.color = '#1a1a1a';
        icon.style.fill = '#1a1a1a';
      });
    } else if (variant === 'primary') {
      button.style.backgroundColor = "#364fc7";
      button.style.color = '#ffffff';
      // Also update icon color
      const icons = button.querySelectorAll('svg');
      icons.forEach(icon => {
        icon.style.color = '#ffffff';
        icon.style.fill = '#ffffff';
      });
    } else if (variant === 'secondary') {
      button.style.backgroundColor = isDark ? "#495057" : "#e9ecef";
    }
  };

  const handleMouseLeave = (e) => {
    if (disabled) return;
    // Ensure we target the button element, not child elements
    const button = e.currentTarget;
    if (variant === 'ghost') {
      button.style.backgroundColor = "transparent";
      button.style.color = '#1a1a1a';
      button.style.border = 'none';
      // Also update icon color
      const icons = button.querySelectorAll('svg');
      icons.forEach(icon => {
        icon.style.color = '#1a1a1a';
        icon.style.fill = '#1a1a1a';
      });
    } else if (variant === 'primary') {
      button.style.backgroundColor = "#4c6ef5";
      button.style.color = '#ffffff';
      // Also update icon color
      const icons = button.querySelectorAll('svg');
      icons.forEach(icon => {
        icon.style.color = '#ffffff';
        icon.style.fill = '#ffffff';
      });
    } else if (variant === 'secondary') {
      button.style.backgroundColor = isDark ? "#373a40" : "#f1f3f4";
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
    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' , flexDirection: 'column'}}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' , flexDirection: 'row'}} >
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
        margin: '2px'
      }}>
        {getStepIcon()}
      </div>
        <Text
          weight={600}
          size="sm"
          margin="0px 0px 0px 8px"
          className="tour-text"
          style={{
            lineHeight: 1.3,
            color: isDark ? '#ffffff' : '#1a1a1a'
          }}
        >
          {currentStepData.title}
        </Text>
      </div>
      <div style={{ }}>

        <Text
          size="xs"
          className="tour-text"
          style={{
            lineHeight: 1.3,
            color: isDark ? '#c9c9c9' : '#495057'
          }}
        >
          {typeof currentStepData.content === 'function' ? currentStepData.content() : currentStepData.content}
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
          {typeof actionPrompt === 'function' ? actionPrompt() : actionPrompt}
        </Text>
      </Group>
    </div>
  );
};

// Skip Button Component
const SkipButton = ({ onClick, text = "Skip" }) => (
  <SimpleButton
    variant="ghost"
    size="sm"
    onClick={onClick}
    style={{ 
      flex: text === "Skip Tour" ? 1 : 0,
      flexShrink: text === "Skip Tour" ? 1 : 0,
      minWidth: text === "Skip Tour" ? "auto" : "50px",
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
    {text}
  </SimpleButton>
);

// Back Button Component
const BackButton = ({ onClick, disabled, style = {} }) => (
  <SimpleButton
    variant="ghost"
    size="sm"
    onClick={onClick}
    disabled={disabled}
    style={{ ...style }}
  >
    <IconChevronLeft size={12} style={{ marginRight: 4 }} />
    Back
  </SimpleButton>
);

// Next Button Component
const NextButton = ({ onClick, isLastStep, style = {} }) => (
  <SimpleButton
    variant="primary"
    size="sm"
    onClick={onClick}
    style={{ ...style }}
  >
    {isLastStep ? (
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
);

// Navigation with Special Button Layout
const NavigationWithSpecialButton = ({ 
  currentStepData, 
  currentStep, 
  handleNavigation, 
  handlePrevious, 
  handleSkip 
}) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px", width: "100%" }}>
    <SimpleButton variant="primary" size="md" onClick={handleNavigation} style={{ width: "100%" }}>
      <IconChevronRight size={14} style={{ marginRight: 6 }} />
      {currentStepData.navigationText || "Continue"}
    </SimpleButton>
    
    <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", gap: "6px" }}>
      <BackButton onClick={handlePrevious} disabled={currentStep === 0} style={{ flex: 1 }} />
      <SkipButton onClick={handleSkip} text="Skip Tour" />
    </div>
  </div>
);

// Standard Navigation Layout
const StandardNavigation = ({ 
  currentStep, 
  totalSteps, 
  handlePrevious, 
  handleNext, 
  handleSkip 
}) => (
  <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: "6px", marginTop: "8px", width: "100%" }}>
    <BackButton onClick={handlePrevious} disabled={currentStep === 0} style={{ flex: 1, minWidth: "70px" }} />
    <NextButton onClick={handleNext} isLastStep={currentStep === totalSteps - 1} style={{ flex: 1, minWidth: "80px" }} />
    <SkipButton onClick={handleSkip} />
  </div>
);

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
      <NavigationWithSpecialButton 
        currentStepData={currentStepData}
        currentStep={currentStep}
        handleNavigation={handleNavigation}
        handlePrevious={handlePrevious}
        handleSkip={handleSkip}
      />
    );
  }

  return (
    <StandardNavigation 
      currentStep={currentStep}
      totalSteps={totalSteps}
      handlePrevious={handlePrevious}
      handleNext={handleNext}
      handleSkip={handleSkip}
    />
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
      "Perfect! Now open CodeMaster. The sidebar will appear on the left side.",
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
      "Perfect! This is your CodeMaster dashboard. Here you can access all the tools to improve your problem-solving skills.",
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
    title: "Statistics & Box Levels",
    content:
      "View your learning progress through Leitner box levels, which show how well you've mastered different problems and your total problem count.",
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
  const [tourPosition, setTourPosition] = useState(null);
  const [arrowPosition, setArrowPosition] = useState(null);
  const [hasInitiallyPositioned, setHasInitiallyPositioned] = useState(false);

  useEffect(() => {
    if (!isVisible) return;

    // Reset positioning state when step changes
    setHasInitiallyPositioned(false);
    setTourPosition(null);

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
          setHasInitiallyPositioned(true);
        } else {
          console.warn("ContentOnboardingTour: Invalid position calculated, using fallback");
          setTourPosition({ top: 100, left: 100 }); // Fallback position
          setArrowPosition(null);
          setHasInitiallyPositioned(true);
        }
      } catch (error) {
        console.error("ContentOnboardingTour: Error calculating position:", error);
        setTourPosition({ top: 100, left: 100 }); // Fallback position
        setArrowPosition(null);
        setHasInitiallyPositioned(true);
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

  return { tourPosition, arrowPosition, hasInitiallyPositioned };
};

// Custom hook for menu state monitoring
const useMenuStateMonitoring = (isVisible) => {
  const [menuOpenState, setMenuOpenState] = useState(() => {
    logger.info(`🔍 useState INITIALIZER called, returning false`);
    return false;
  });

  logger.info(`🔍 useMenuStateMonitoring CALLED: isVisible=${isVisible}, current menuOpenState=${menuOpenState}`);

  useEffect(() => {
    logger.info(`🔍 useMenuStateMonitoring effect: isVisible=${isVisible}, currentState=${menuOpenState}`);
    if (!isVisible) {
      logger.info(`⚠️ useMenuStateMonitoring: not visible, returning early`);
      return;
    }

    const checkMenuState = () => {
      const menuElement = document.querySelector("#cm-mySidenav");
      if (!menuElement) {
        // Menu doesn't exist yet - keep state as false (menu is closed/not rendered)
        logger.info(`🔍 Menu state check: Menu element not found, keeping state as false`);
        setMenuOpenState(false);
        return false;
      }
      const isOpen = !menuElement.classList.contains("cm-hidden");
      logger.info(`🔍 Menu state check: isOpen=${isOpen}, element=true, hasClass=${menuElement.classList.contains("cm-hidden")}`);
      setMenuOpenState(isOpen);
      return isOpen;
    };

    checkMenuState();

    let menuObserverAttached = false;
    const menuObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes" && mutation.attributeName === "class") {
          logger.info(`🔍 MutationObserver detected class change on menu`);
          checkMenuState();
        }
      });
    });

    // Observer to watch for menu element being added to DOM
    const domObserver = new MutationObserver(() => {
      const menuElement = document.querySelector("#cm-mySidenav");
      if (menuElement && !menuObserverAttached) {
        logger.info(`✅ Menu element appeared in DOM, attaching observer`);
        menuObserverAttached = true;
        checkMenuState();
        menuObserver.observe(menuElement, { attributes: true });
        domObserver.disconnect(); // Stop watching once we found it
      }
    });

    const menuElement = document.querySelector("#cm-mySidenav");
    if (menuElement) {
      menuObserver.observe(menuElement, { attributes: true });
      menuObserverAttached = true;
      logger.info(`✅ MutationObserver attached to existing menu`);
    } else {
      // Watch for menu element to be added
      domObserver.observe(document.body, { childList: true, subtree: true });
      logger.info(`👀 Watching for menu element to appear in DOM`);
    }

    return () => {
      logger.info(`🧹 useMenuStateMonitoring cleanup`);
      menuObserver.disconnect();
      domObserver.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible]);

  logger.info(`🔍 useMenuStateMonitoring returning: ${menuOpenState}`);
  return menuOpenState;
};

// Custom hook to monitor for target element existence
const useTargetElementMonitoring = (isVisible, currentStepData) => {
  const [targetExists, setTargetExists] = useState(false);

  useEffect(() => {
    if (!isVisible || !currentStepData.target) {
      return;
    }

    const checkTargetExists = () => {
      const targetElement = document.querySelector(currentStepData.target);
      const exists = !!targetElement;
      if (exists !== targetExists) {
        logger.info(`🎯 Target element ${currentStepData.target} ${exists ? 'appeared' : 'disappeared'}`);
        setTargetExists(exists);
      }
      return exists;
    };

    // Initial check
    checkTargetExists();

    // Watch for target element to appear
    const targetObserver = new MutationObserver(() => {
      checkTargetExists();
    });

    // Watch the menu element specifically for menu-related targets
    if (currentStepData.requiresMenuOpen) {
      const menuElement = document.querySelector("#cm-mySidenav");
      if (menuElement) {
        targetObserver.observe(menuElement, { childList: true, subtree: true });
        logger.info(`👀 Watching menu for target element: ${currentStepData.target}`);
      } else {
        // Watch body if menu doesn't exist yet
        targetObserver.observe(document.body, { childList: true, subtree: true });
        logger.info(`👀 Watching body for target element: ${currentStepData.target}`);
      }
    }

    return () => {
      targetObserver.disconnect();
    };
  }, [isVisible, currentStepData.target, currentStepData.requiresMenuOpen, targetExists]);

  return targetExists;
};

// Custom hook for tour navigation logic
const useTourNavigation = (currentStep, { setCurrentStep, setIsWaitingForInteraction, onComplete, onClose, navigate }) => {
  const proceedToNextStep = useCallback(() => {
    logger.info(`🚶 proceedToNextStep called: currentStep=${currentStep}, nextStep=${currentStep + 1}`);
    if (currentStep < TOUR_STEPS.length - 1) {
      const nextStep = currentStep + 1;
      logger.info(`✅ Advancing to step ${nextStep}: ${TOUR_STEPS[nextStep]?.id}`);
      setCurrentStep(nextStep);

      // Check if next step requires user interaction
      if (TOUR_STEPS[nextStep]?.waitForUserClick) {
        setIsWaitingForInteraction(true);
      } else {
        setIsWaitingForInteraction(false);
      }
    } else {
      logger.info(`🎉 Tour complete, calling onComplete()`);
      onComplete();
    }
  }, [currentStep, onComplete, setCurrentStep, setIsWaitingForInteraction]);

  const handleNext = useCallback(() => {
    logger.info(`👆 handleNext clicked: currentStep=${currentStep}`);
    const currentStepData = TOUR_STEPS[currentStep];

    // Auto-trigger UI element if specified
    if (currentStepData.autoTriggerSelector) {
      const targetElement = document.querySelector(currentStepData.autoTriggerSelector);
      if (targetElement) {
        // Special handling for menu button - check if menu is already open
        if (currentStepData.autoTriggerSelector === "#cm-menuButton") {
          const menuElement = document.querySelector("#cm-mySidenav");
          const isMenuAlreadyOpen = menuElement && !menuElement.classList.contains("cm-hidden");
          
          if (isMenuAlreadyOpen) {
            logger.info("Menu is already open, skipping auto-trigger");
            // Proceed directly without clicking since menu is already open
            proceedToNextStep();
            return;
          } else {
            logger.info("Auto-triggering menu button (menu is currently closed)");
          }
        } else {
          logger.info("Auto-triggering element:", currentStepData.autoTriggerSelector);
        }
        
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

  const handleNavigation = useCallback(async () => {
    const currentStepData = TOUR_STEPS[currentStep];
    if (currentStepData.navigationRoute) {
      logger.info("Navigating to:", currentStepData.navigationRoute);
      
      // Complete the tour before navigation using the passed onComplete
      try {
        await ChromeAPIErrorHandler.sendMessageWithRetry({
          type: "completeContentOnboarding"
        });
        logger.info("🎉 Tour completed via navigation and saved to database");
      } catch (error) {
        logger.error("Error completing tour via navigation:", error);
      }
      
      onComplete();
      
      // Small delay then navigate
      setTimeout(() => {
        navigate(currentStepData.navigationRoute);
      }, 100);
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
      } else if (currentStepData.id === "select-problem") {
        // User clicked on a problem link - they're navigating to problem page
        logger.info("User clicked problem link, advancing to next step");
        setTimeout(() => {
          handleNext();
        }, 300);
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
  // Check if menu needs to be open
  if (currentStepData.requiresMenuOpen && !menuOpenState) {
    logger.info(`❌ shouldShowStep: Menu required but not open (menuOpenState=${menuOpenState})`);
    return false;
  }

  // Check if target element exists (except for center/completion steps)
  if (currentStepData.target && currentStepData.screenKey !== "completion") {
    const targetElement = document.querySelector(currentStepData.target);
    if (!targetElement) {
      logger.info(`❌ shouldShowStep: Target element not found: ${currentStepData.target}`);
      return false;
    }
  }

  return true;
};

// Helper function to get arrow styles based on direction
const getArrowStyles = (direction) => {
  const isDark = document.documentElement.getAttribute('data-mantine-color-scheme') === 'dark' ||
                 document.body.classList.contains('dark-theme') ||
                 window.matchMedia?.('(prefers-color-scheme: dark)').matches;
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

// Helper hook for tour completion
const useTourCompleteHandler = (onComplete) => {
  return useCallback(async () => {
    try {
      await ChromeAPIErrorHandler.sendMessageWithRetry({
        type: "completeContentOnboarding"
      });
      logger.info("🎉 Tour completed and saved to database");
      onComplete();
    } catch (error) {
      logger.error("Error completing tour:", error);
      // Still call onComplete even if database update fails
      onComplete();
    }
  }, [onComplete]);
};

// Helper hook for tour close
const useTourCloseHandler = (onClose) => {
  return useCallback(() => {
    logger.info("🚪 Tour closed");
    onClose();
  }, [onClose]);
};

// Helper hook for navigation detection effect
const useNavigationDetectionEffect = (isVisible, handleTourComplete) => {
  useEffect(() => {
    if (!isVisible) return;
    
    const handleNavigationClick = (event) => {
      // Check if the clicked element is a link to Problem Generator
      const clickedElement = event.target.closest('a[href="/Probgen"]');
      if (clickedElement) {
        logger.info("🎯 Main Tour: User navigating to Problem Generator, completing tour");
        // Complete the tour since user is going to the intended destination
        handleTourComplete();
      }
    };
    
    // Listen for clicks on the entire document
    document.addEventListener('click', handleNavigationClick, true);
    
    return () => {
      document.removeEventListener('click', handleNavigationClick, true);
    };
  }, [isVisible, handleTourComplete]);
};

// Helper hook for interaction handling effect
const useInteractionHandlingEffect = (isWaitingForInteraction, currentStepData, setIsWaitingForInteraction, handleNext, onComplete) => {
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
  }, [isWaitingForInteraction, currentStepData, handleNext, onComplete, setIsWaitingForInteraction]);
};

export function ContentOnboardingTour({ isVisible, onComplete, onClose }) {
  const navigate = useNavigate();
  
  // Simple state management (no database persistence)
  const [currentStep, setCurrentStep] = useState(0);
  const [isWaitingForInteraction, setIsWaitingForInteraction] = useState(false);
  const currentStepData = TOUR_STEPS[currentStep];
  
  // Handle tour completion and close
  const handleTourComplete = useTourCompleteHandler(onComplete);
  const handleTourClose = useTourCloseHandler(onClose);

  // Use extracted hooks
  const { tourPosition, arrowPosition, hasInitiallyPositioned } = useTourPositioning(isVisible, currentStepData, currentStep);
  const menuOpenState = useMenuStateMonitoring(isVisible);
  // Monitor for target element existence (triggers re-render when element appears)
  useTargetElementMonitoring(isVisible, currentStepData);
  const { handleNext, handlePrevious, handleNavigation } = useTourNavigation(
    currentStep, { setCurrentStep, setIsWaitingForInteraction, onComplete: handleTourComplete, onClose: handleTourClose, navigate }
  );

  // Use extracted effect for navigation detection
  useNavigationDetectionEffect(isVisible, handleTourComplete);
  // Use extracted effect for interaction handling
  useInteractionHandlingEffect(isWaitingForInteraction, currentStepData, setIsWaitingForInteraction, handleNext, onComplete);

  // Debug logging for step 4 issue
  logger.info(`🔍 RENDER CHECK: step=${currentStep}, isVisible=${isVisible}, menuOpenState=${menuOpenState}, requiresMenuOpen=${currentStepData?.requiresMenuOpen}, shouldShow=${shouldShowStep(currentStepData, menuOpenState)}`);

  if (!isVisible || !shouldShowStep(currentStepData, menuOpenState)) {
    logger.info(`❌ BLOCKING RENDER: isVisible=${isVisible}, shouldShow=${shouldShowStep(currentStepData, menuOpenState)}, step=${currentStep}, stepId=${currentStepData?.id}`);
    return null;
  }

  // Don't show tour until positioning is complete to prevent flash
  if (!hasInitiallyPositioned || !tourPosition) {
    logger.info(`❌ BLOCKING RENDER (positioning): hasPositioned=${hasInitiallyPositioned}, hasPosition=${!!tourPosition}, step=${currentStep}`);
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
          maxHeight: "80vh",
          overflow: "hidden",
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

        <Card
          shadow="lg"
          padding="sm"
          withBorder
          radius="md"
          style={{
            maxHeight: "80vh",
            overflowY: "auto",
            backgroundColor: (document.documentElement.getAttribute('data-mantine-color-scheme') === 'dark' ||
                            document.body.classList.contains('dark-theme') ||
                            window.matchMedia?.('(prefers-color-scheme: dark)').matches)
              ? '#1a1b1e'
              : '#ffffff',
            borderColor: (document.documentElement.getAttribute('data-mantine-color-scheme') === 'dark' ||
                         document.body.classList.contains('dark-theme') ||
                         window.matchMedia?.('(prefers-color-scheme: dark)').matches)
              ? '#373a40'
              : '#dee2e6'
          }}
        >
          {/* Header */}
          <TourCardHeader 
            currentStep={currentStep} 
            totalSteps={TOUR_STEPS.length} 
            onSkip={handleTourClose} 
          />

          {/* Progress Bar */}
          <div style={{
            width: '100%',
            height: '4px',
            backgroundColor: (document.documentElement.getAttribute('data-mantine-color-scheme') === 'dark' ||
                            document.body.classList.contains('dark-theme') ||
                            window.matchMedia?.('(prefers-color-scheme: dark)').matches)
              ? '#373a40'
              : '#e9ecef',
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
            {(currentStepData.actionPrompt && (typeof currentStepData.actionPrompt === 'function' ? currentStepData.actionPrompt() : currentStepData.actionPrompt)) && (
              <ActionPrompt actionPrompt={currentStepData.actionPrompt} />
            )}

            {/* Navigation Controls */}
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
