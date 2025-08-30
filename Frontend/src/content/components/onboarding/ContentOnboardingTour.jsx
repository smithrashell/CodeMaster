import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Text,
  Group,
  Stack,
  ThemeIcon,
  Badge,
  Progress,
  ActionIcon,
} from "@mantine/core";
import { SimpleButton } from "../../../shared/components/ui/SimpleButton";
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
import { updateContentOnboardingStep } from "../../../shared/services/onboardingService";
import logger from "../../../shared/utils/logger.js";

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
    target: "a[href='/ProbGen']",
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
    target: "a[href='/ProbStat']",
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
    target: "a[href='/ProbTime']",
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
    navigationRoute: "/ProbGen",
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

export function ContentOnboardingTour({ isVisible, onComplete, onClose }) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [tourPosition, setTourPosition] = useState({ top: 0, left: 0 });
  const [arrowPosition, setArrowPosition] = useState(null);
  const [isWaitingForInteraction, setIsWaitingForInteraction] = useState(false);
  const [menuOpenState, setMenuOpenState] = useState(false);

  const currentStepData = TOUR_STEPS[currentStep];

  // Smart positioning effect
  useEffect(() => {
    if (!isVisible) return;

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

  // Enhanced menu state monitoring
  useEffect(() => {
    if (!isVisible) return;

    const checkMenuState = () => {
      const menuElement = document.querySelector("#cm-mySidenav");
      const isOpen =
        menuElement && !menuElement.classList.contains("cm-hidden");
      setMenuOpenState(isOpen);

      // Debug logging
      logger.info("Menu state check:", { isOpen, element: !!menuElement });
    };

    // Check immediately and set up observer
    checkMenuState();

    // Set up mutation observer for class changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "class"
        ) {
          checkMenuState();
        }
      });
    });

    const menuElement = document.querySelector("#cm-mySidenav");
    if (menuElement) {
      observer.observe(menuElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
    }

    // Also monitor for DOM changes in case menu gets added later
    const bodyObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (
            node.nodeType === 1 &&
            (node.id === "cd-mySidenav" || node.querySelector("#cm-mySidenav"))
          ) {
            setTimeout(checkMenuState, 100);
          }
        });
      });
    });

    bodyObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      bodyObserver.disconnect();
    };
  }, [isVisible]);

  // Interaction handling
  useEffect(() => {
    if ((!isWaitingForInteraction || !currentStepData.waitForInteraction) && !currentStepData.waitForUserClick) return;

    const handleInteraction = (event) => {
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
        } else if (currentStepData.target === "a[href='/ProbGen']") {
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
  }, [currentStep, onComplete]);

  const handleNext = useCallback(async () => {
    // Update progress in database
    try {
      await updateContentOnboardingStep(
        currentStep,
        currentStepData.screenKey,
        currentStepData.interactionType
      );
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
  }, [currentStep, currentStepData, proceedToNextStep]);

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
    if (currentStepData.navigationRoute) {
      logger.info("Navigating to:", currentStepData.navigationRoute);
      navigate(currentStepData.navigationRoute);
      // Complete the tour after navigation
      setTimeout(() => {
        onComplete();
      }, 300);
    }
  }, [currentStepData, navigate, onComplete]);

  // Check if current step should be shown (e.g., menu needs to be open)
  const shouldShowStep = () => {
    if (currentStepData.requiresMenuOpen && !menuOpenState) {
      return false;
    }
    return true;
  };

  const getStepIcon = () => {
    switch (currentStepData.id) {
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

  if (!isVisible || !shouldShowStep()) {
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

        <Card shadow="lg" padding="sm" withBorder radius="md">
          {/* Header - More compact */}
          <Group position="apart" mb="xs">
            <Badge color="blue" variant="light" size="xs">
              {currentStep + 1} of {TOUR_STEPS.length}
            </Badge>
            <ActionIcon variant="subtle" size="xs" onClick={handleSkip}>
              <IconX size={12} />
            </ActionIcon>
          </Group>

          {/* Progress Bar */}
          <Progress
            value={((currentStep + 1) / TOUR_STEPS.length) * 100}
            size="xs"
            mb="sm"
            color="blue"
          />

          {/* Content - More compact layout */}
          <Stack spacing="xs">
            <Group spacing="xs" align="flex-start">
              <ThemeIcon color="blue" variant="light" size="sm" mt={1}>
                {getStepIcon()}
              </ThemeIcon>
              <div style={{ flex: 1 }}>
                <Text weight={600} size="xs" mb={2} style={{ lineHeight: 1.3 }}>
                  {currentStepData.title}
                </Text>
                <Text size="xs" color="dimmed" style={{ lineHeight: 1.3 }}>
                  {currentStepData.content}
                </Text>
              </div>
            </Group>

            {/* Action Prompt - More compact */}
            {currentStepData.actionPrompt && (
              <div
                style={{
                  padding: "4px 8px",
                  backgroundColor: "#e3f2fd",
                  borderRadius: "4px",
                  border: "1px solid #90caf9",
                }}
              >
                <Group spacing="xs">
                  <IconClick size={12} color="#1976d2" />
                  <Text size="xs" color="#1976d2" weight={500} style={{ lineHeight: 1.2 }}>
                    {currentStepData.actionPrompt}
                  </Text>
                </Group>
              </div>
            )}

            {/* Controls - Navigation or Standard Layout */}
            {currentStepData.hasNavigationButton ? (
              // Navigation Button Layout
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
            ) : (
              // Standard Control Layout
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
                  {currentStep === TOUR_STEPS.length - 1 ? (
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
            )}
          </Stack>
        </Card>
      </div>
    </>
  );
}
