import logger from "../../../shared/utils/logger.js";
import React, { useState, useEffect, useCallback } from "react";
import { Card, Stack } from '../ui/Layout.jsx';
import Text from '../ui/Text.jsx';
import Badge from '../ui/Badge.jsx';
// Note: ThemeIcon, Progress, ActionIcon simplified for onboarding
import { baseButtonStyles, sizeStyles, getThemeAwareVariantStyles } from "../../../shared/components/ui/buttonStyles";
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
import { useTheme } from "../../../shared/provider/themeprovider.jsx";

// Theme-aware SimpleButton for the tour
const SimpleButton = ({ variant = "primary", size = "md", disabled = false, onClick, children, style = {}, ...props }) => {
  // Get current theme from context
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';

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

// Helper component for arrow pointer rendering
function TourArrow({ arrowPosition }) {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';
  const arrowColor = isDark ? '#1a1b1e' : 'white';

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
          borderBottom: `8px solid ${arrowColor}`,
          filter: "drop-shadow(0 -2px 4px rgba(0,0,0,0.1))",
        }),
        ...(arrowPosition.direction === "down" && {
          borderLeft: "8px solid transparent",
          borderRight: "8px solid transparent",
          borderTop: `8px solid ${arrowColor}`,
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))",
        }),
        ...(arrowPosition.direction === "left" && {
          borderTop: "8px solid transparent",
          borderBottom: "8px solid transparent",
          borderRight: `8px solid ${arrowColor}`,
          filter: "drop-shadow(-2px 0 4px rgba(0,0,0,0.1))",
        }),
        ...(arrowPosition.direction === "right" && {
          borderTop: "8px solid transparent",
          borderBottom: "8px solid transparent",
          borderLeft: `8px solid ${arrowColor}`,
          filter: "drop-shadow(2px 0 4px rgba(0,0,0,0.1))",
        }),
      }}
    />
  );
}

// Helper component for tour header
function TourHeader({ currentStep, totalSteps, onSkip }) {
  // Get current theme from context
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
      <Badge
        color="green"
        variant="light"
        size="xs"
        style={{
          backgroundColor: isDark ? '#1a4d2e' : '#e6fcf5',
          color: isDark ? '#69db7c' : '#2b8a3e'
        }}
      >
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
          color: isDark ? '#c9c9c9' : '#495057',
          transition: 'transform 0.2s ease'
        }}
        onClick={onSkip}
        onMouseEnter={(e) => {
          e.target.style.backgroundColor = isDark ? '#373a40' : '#f8f9fa';
          e.target.style.transform = 'scale(1.20)';
        }}
        onMouseLeave={(e) => {
          e.target.style.backgroundColor = 'transparent';
          e.target.style.transform = 'scale(1)';
        }}
      >
        <IconX size={12} />
      </button>
    </div>
  );
}

// Helper component for tour content
function TourContent({ stepData, getStepIcon }) {
  // Get current theme from context
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
        <div style={{
          backgroundColor: isDark ? '#1a4d2e' : '#e6fcf5',
          color: isDark ? '#69db7c' : '#37b24d',
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
          style={{ lineHeight: 1.3, color: isDark ? '#ffffff' : '#1a1a1a' }}
        >
          {stepData.title}
        </Text>
      </div>
      <div style={{}}>
        <Text
          size="xs"
          className="tour-text"
          style={{ lineHeight: 1.3, color: isDark ? '#c9c9c9' : '#495057' }}
        >
          {stepData.content}
        </Text>
      </div>
    </div>
  );
}

// Helper component for skip button with dark mode support
function SkipButton({ onClick }) {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';

  return (
    <SimpleButton
      variant="ghost"
      size="sm"
      onClick={onClick}
      style={{
        flexShrink: 0,
        minWidth: "50px",
        textDecoration: 'underline',
        transition: 'transform 0.2s ease',
        color: isDark ? '#c9c9c9' : '#1a1a1a',
        backgroundColor: 'transparent'
      }}
      onMouseEnter={(e) => {
        e.target.style.transform = 'scale(1.20)';
        e.target.style.backgroundColor = 'transparent';
        e.target.style.color = isDark ? '#c9c9c9' : '#1a1a1a';
      }}
      onMouseLeave={(e) => {
        e.target.style.transform = 'scale(1)';
        e.target.style.backgroundColor = 'transparent';
        e.target.style.color = isDark ? '#c9c9c9' : '#1a1a1a';
      }}
    >
      Skip
    </SimpleButton>
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
        style={{ 
          flex: 1, 
          minWidth: "70px", 
          transition: 'all 0.2s ease'
        }}
      >
        <IconChevronLeft size={12} style={{ marginRight: 4 }} />
        Back
      </SimpleButton>

      <SimpleButton
        variant="primary"
        size="sm"
        onClick={onNext}
        disabled={false}
        style={{ 
          flex: 1, 
          minWidth: "80px"
        }}
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

      <SkipButton onClick={onSkip} />

    </div>
  );
}

// Custom hook for smart positioning
function useSmartPositioning(isVisible, currentStepData, currentStep, menuOpenState) {
  const [tourPosition, setTourPosition] = useState(null);
  const [arrowPosition, setArrowPosition] = useState(null);
  const [hasInitiallyPositioned, setHasInitiallyPositioned] = useState(false);

  useEffect(() => {
    if (!isVisible || !currentStepData) return;

    // Reset positioning state when step changes
    setHasInitiallyPositioned(false);
    setTourPosition(null);

    const calculatePosition = () => {
      // Add a small delay when menu state changes to allow DOM to settle
      const position = smartPositioning.calculatePosition(
        currentStepData.target,
        currentStepData.position
      );

      setTourPosition({ top: position.top, left: position.left });
      setHasInitiallyPositioned(true);

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

    // Add delay for positioning calculation to allow DOM to settle after menu changes
    const timeoutId = setTimeout(() => {
      calculatePosition();
    }, menuOpenState !== undefined ? 100 : 0); // Small delay when menu state is involved

    // Recalculate on scroll/resize
    const handleReposition = () => {
      // Clear any pending timeout to avoid race conditions
      clearTimeout(timeoutId);
      calculatePosition();
    };
    
    window.addEventListener("scroll", handleReposition);
    window.addEventListener("resize", handleReposition);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("scroll", handleReposition);
      window.removeEventListener("resize", handleReposition);
    };
  }, [currentStep, isVisible, currentStepData, menuOpenState]); // Include menuOpenState as dependency

  return { tourPosition, arrowPosition, hasInitiallyPositioned };
}

// Custom hook for menu state monitoring
function useMenuStateMonitor() {
  const [menuOpenState, setMenuOpenState] = useState(false);

  useEffect(() => {
    const checkMenuState = () => {
      const menuElement = document.querySelector("#cm-mySidenav");
      if (!menuElement) {
        // Menu doesn't exist yet - keep state as false (menu is closed/not rendered)
        setMenuOpenState(false);
        return false;
      }
      const isOpen = !menuElement.classList.contains("cm-hidden");
      setMenuOpenState(isOpen);
      return isOpen;
    };

    // Check immediately
    checkMenuState();

    let menuObserverAttached = false;
    const menuObserver = new MutationObserver(() => {
      checkMenuState();
    });

    // Observer to watch for menu element being added to DOM
    const domObserver = new MutationObserver(() => {
      const menuElement = document.querySelector("#cm-mySidenav");
      if (menuElement && !menuObserverAttached) {
        menuObserverAttached = true;
        checkMenuState();
        menuObserver.observe(menuElement, {
          attributes: true,
          attributeFilter: ["class"],
        });
        domObserver.disconnect(); // Stop watching once we found it
      }
    });

    const menuElement = document.querySelector("#cm-mySidenav");
    if (menuElement) {
      menuObserver.observe(menuElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
      menuObserverAttached = true;
    } else {
      // Watch for menu element to be added
      domObserver.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      menuObserver.disconnect();
      domObserver.disconnect();
    };
  }, []);

  return menuOpenState;
}

// Custom hook for handling auto-triggers and menu state
function useAutoTriggerEffects(isVisible, currentStepData, menuOpenState) {
  React.useEffect(() => {
    if (!isVisible || !currentStepData) return;

    // Auto-trigger interactions for steps that require it
    if (currentStepData.autoTriggerSelector) {
      const triggerElement = document.querySelector(currentStepData.autoTriggerSelector);
      if (triggerElement) {
        // Handle different interaction types
        if (currentStepData.interactionType === "menu-open" && !menuOpenState) {
          logger.info("🎯 Auto-triggering menu open for tour step:", currentStepData.id);
          triggerElement.click();
        } else if (currentStepData.interactionType === "hint-open") {
          logger.info("🎯 Auto-triggering hint open for tour step:", currentStepData.id);
          triggerElement.click();
        }
      }
    }
    // Ensure menu is open for steps that require it
    else if (currentStepData.requiresMenuOpen && !menuOpenState) {
      const menuButton = document.querySelector("#cm-menuButton");
      if (menuButton) {
        logger.info("🎯 Opening menu for tour step that requires it:", currentStepData.id);
        menuButton.click();
      }
    }
    
    // Ensure hint panel is open for steps that require it
    if (currentStepData.requiresHintOpen) {
      const hintButton = document.querySelector("#floating-hint-button");
      if (hintButton && hintButton.getAttribute('aria-expanded') !== 'true') {
        logger.info("🎯 Opening hint panel for tour step that requires it:", currentStepData.id);
        hintButton.click();
      }
    }
  }, [isVisible, currentStepData, menuOpenState]);
}

// Custom hook for forcing hover states
function useForceHoverEffect(isVisible, currentStepData, currentStep, forceHoverState) {
  React.useEffect(() => {
    if (isVisible && currentStepData && currentStepData.forceHover) {
      setTimeout(() => {
        forceHoverState(currentStepData);
      }, 200); // Small delay to ensure elements are rendered
    }
  }, [currentStep, isVisible, currentStepData, forceHoverState]);
}

// Helper to trigger hover state on elements
const triggerElementHover = (stepData) => {
  if (!stepData.forceHover || !stepData.hoverTarget) return;
  
  const hoverElement = document.querySelector(stepData.hoverTarget);
  if (!hoverElement) return;

  logger.info("🎯 Forcing hover state on:", stepData.hoverTarget);
  
  // Trigger mouseenter event
  const mouseEnterEvent = new MouseEvent('mouseenter', {
    bubbles: true,
    cancelable: true,
    view: window
  });
  hoverElement.dispatchEvent(mouseEnterEvent);
  hoverElement.classList.add('tour-forced-hover');
  
  // Handle expanded content if specified
  if (stepData.expandedTarget) {
    setTimeout(() => {
      const expandedElement = document.querySelector(stepData.expandedTarget);
      if (expandedElement) {
        expandedElement.classList.add('tour-highlight-expanded');
      }
    }, 300);
  }
};

// Helper to remove hover state from elements
const removeElementHover = (stepData) => {
  if (!stepData.forceHover || !stepData.hoverTarget) return;
  
  const hoverElement = document.querySelector(stepData.hoverTarget);
  if (!hoverElement) return;

  logger.info("🎯 Removing forced hover state from:", stepData.hoverTarget);
  
  // Trigger mouseleave event
  const mouseLeaveEvent = new MouseEvent('mouseleave', {
    bubbles: true,
    cancelable: true,
    view: window
  });
  hoverElement.dispatchEvent(mouseLeaveEvent);
  hoverElement.classList.remove('tour-forced-hover');
  
  // Clean up expanded content
  if (stepData.expandedTarget) {
    const expandedElement = document.querySelector(stepData.expandedTarget);
    if (expandedElement) {
      expandedElement.classList.remove('tour-highlight-expanded');
    }
  }
};

// Helper to reverse UI state changes when going back
const reverseUIStateChanges = (currentStepData, previousStepData) => {
  // Reverse menu state changes
  if (currentStepData?.requiresMenuOpen && !previousStepData?.requiresMenuOpen) {
    const menuButton = document.querySelector("#cm-menuButton");
    const menuElement = document.querySelector("#cm-mySidenav");
    
    if (menuButton && menuElement && !menuElement.classList.contains("cm-hidden")) {
      logger.info("🔙 Back button: Closing menu (reversing state)");
      menuButton.click();
    }
  }

  // Reverse hint state changes
  if (currentStepData?.requiresHintOpen && !previousStepData?.requiresHintOpen) {
    const hintButton = document.querySelector("#floating-hint-button");
    if (hintButton && hintButton.getAttribute('aria-expanded') === 'true') {
      logger.info("🔙 Back button: Closing hint panel (reversing state)");
      hintButton.click();
    }
  }
};

// Custom hook for tour navigation with hover state management
function useTourNavigation(currentStep, setCurrentStep, tourSteps, onComplete, onClose) {
  const forceHoverState = useCallback(triggerElementHover, []);
  const removeForceHoverState = useCallback(removeElementHover, []);

  const handleNext = useCallback(() => {
    const currentStepData = tourSteps[currentStep];
    
    if (currentStepData.forceHover) {
      removeForceHoverState(currentStepData);
    }
    
    if (currentStep < tourSteps.length - 1) {
      const nextStep = currentStep + 1;
      const nextStepData = tourSteps[nextStep];
      
      setCurrentStep(nextStep);
      
      if (nextStepData.forceHover) {
        setTimeout(() => forceHoverState(nextStepData), 100);
      }
    } else {
      onComplete();
    }
  }, [currentStep, tourSteps, onComplete, setCurrentStep, forceHoverState, removeForceHoverState]);

  const handlePrevious = () => {
    if (currentStep > 0) {
      const currentStepData = tourSteps[currentStep];
      const previousStepData = tourSteps[currentStep - 1];

      if (currentStepData.forceHover) {
        removeForceHoverState(currentStepData);
      }

      reverseUIStateChanges(currentStepData, previousStepData);
      setCurrentStep(currentStep - 1);
      
      if (previousStepData.forceHover) {
        setTimeout(() => forceHoverState(previousStepData), 100);
      }
    }
  };

  const handleSkip = () => {
    const currentStepData = tourSteps[currentStep];
    if (currentStepData.forceHover) {
      removeForceHoverState(currentStepData);
    }
    onClose();
  };

  return { handleNext, handlePrevious, handleSkip, forceHoverState };
}

// Custom hook for handling early tour completion
function useEarlyTourCompletion(isVisible, tourConfig, _tourId, onComplete) {
  React.useEffect(() => {
    if (!isVisible) return;
    
    const tourId = tourConfig?.id || _tourId;
    const isProbgenTour = tourId === "probgen_tour" || _tourId === "probgen";
    const isProbTimeTour = tourId === "probtime_tour" || _tourId === "probtime";
    
    if (!isProbgenTour && !isProbTimeTour) return;
    
    const handleEarlyCompletionClick = (event) => {
      if (isProbgenTour) {
        // Check if the clicked element is a navigation link for probgen tour
        const clickedElement = event.target.closest('a[href]');
        if (!clickedElement) return;
        
        const href = clickedElement.getAttribute('href');
        
        // List of navigation links that should complete the probgen tour
        const navigationLinks = ['/Probstat', '/Settings'];
        
        if (navigationLinks.includes(href)) {
          console.log(`🎯 Probgen Tour: User clicked navigation link ${href}, completing tour early`);
          onComplete();
        }
      } else if (isProbTimeTour) {
        // Check if the clicked element is an attempt/timer button for probtime tour
        const clickedElement = event.target.closest('button, a');
        if (!clickedElement) return;
        
        // Check for attempt/timer/start button patterns
        const isAttemptButton = clickedElement.textContent?.toLowerCase().includes('attempt') ||
                              clickedElement.textContent?.toLowerCase().includes('start') ||
                              clickedElement.textContent?.toLowerCase().includes('solve') ||
                              clickedElement.className?.includes('timer') ||
                              clickedElement.className?.includes('start') ||
                              clickedElement.className?.includes('primary') ||
                              clickedElement.classList?.contains('start-button');
        
        if (isAttemptButton) {
          console.log(`🎯 Problem Details Tour: User clicked attempt/timer button, completing tour early`);
          onComplete();
        }
      }
    };
    
    // Listen for clicks on the entire document
    document.addEventListener('click', handleEarlyCompletionClick, true);
    
    return () => {
      document.removeEventListener('click', handleEarlyCompletionClick, true);
    };
  }, [isVisible, onComplete, tourConfig, _tourId]);
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

// Custom hook to monitor for target element existence
function useTargetElementMonitoring(isVisible, currentStepData) {
  const [targetExists, setTargetExists] = React.useState(false);

  React.useEffect(() => {
    if (!isVisible || !currentStepData?.target) {
      return;
    }

    const checkTargetExists = () => {
      const targetElement = document.querySelector(currentStepData.target);
      const exists = !!targetElement;
      if (exists !== targetExists) {
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
      } else {
        // Watch body if menu doesn't exist yet
        targetObserver.observe(document.body, { childList: true, subtree: true });
      }
    }

    return () => {
      targetObserver.disconnect();
    };
  }, [isVisible, currentStepData?.target, currentStepData?.requiresMenuOpen, targetExists]);

  return targetExists;
}

// Helper function to check if step should be shown
function shouldShowStep(currentStepData, menuOpenState) {
  // For steps that require menu open, check if we can auto-trigger it
  if (currentStepData?.requiresMenuOpen && !menuOpenState) {
    // If we have an auto-trigger or this step is designed to open the menu, allow it to show
    if (currentStepData.autoTriggerSelector || currentStepData.interactionType === "menu-open") {
      return true; // Allow step to show so menu can be auto-opened
    }
    return false; // Hide step if menu is required but can't be opened
  }

  // Check if target element exists (skip for center/null target steps)
  if (currentStepData?.target) {
    const targetElement = document.querySelector(currentStepData.target);
    if (!targetElement) {
      return false;
    }
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
  // Monitor for target element existence (triggers re-render when element appears)
  useTargetElementMonitoring(isVisible, currentStepData);
  const { tourPosition, arrowPosition, hasInitiallyPositioned } = useSmartPositioning(isVisible, currentStepData, currentStep, menuOpenState);
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

  // Handle early tour completion on specific interactions
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
          <TourHeader
            currentStep={currentStep}
            totalSteps={steps.length}
            onSkip={handleSkip}
          />

          {/* Progress Bar */}
          <div style={{
            width: '100%',
            height: '4px',
            backgroundColor: isDark ? '#373a40' : '#e9ecef',
            borderRadius: '2px',
            marginBottom: '12px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${((currentStep + 1) / steps.length) * 100}%`,
              height: '100%',
              backgroundColor: '#4caf50',
              borderRadius: '2px',
              transition: 'width 0.3s ease'
            }} />
          </div>

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
        </Card>
      </div>
    </>
  );
}