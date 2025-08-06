import React, { useState, useEffect, useCallback } from "react";
import { Card, Text, Button, Group, Stack, ThemeIcon, Badge, Progress, ActionIcon } from "@mantine/core";
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
  IconClick
} from "@tabler/icons-react";
import { ElementHighlighter } from "./ElementHighlighter";
import { smartPositioning } from "./SmartPositioning";
import { updateContentOnboardingStep } from "../../../shared/services/onboardingService";

const TOUR_STEPS = [
  {
    id: "welcome",
    title: "Welcome to CodeMaster!",
    content: "Let's take a quick tour of CodeMaster's features to help you solve problems more effectively. This will only take 2 minutes.",
    target: null,
    position: "center",
    highlightType: null,
    screenKey: "intro",
    interactionType: null,
    actionPrompt: null
  },
  {
    id: "cm-button-intro",
    title: "Your CodeMaster Control Center",
    content: "This 'CM' button is your gateway to all CodeMaster features. It's always available when you're on LeetCode.",
    target: "#cd-menuButton",
    position: "auto",
    highlightType: "spotlight",
    screenKey: "cmButton",
    interactionType: null,
    actionPrompt: null
  },
  {
    id: "cm-button-interactive",
    title: "Opening the Menu",
    content: "Great! Now click the CM button to see your CodeMaster dashboard. The menu will appear on the right side.",
    target: "#cd-menuButton",
    position: "auto", 
    highlightType: "pointer",
    screenKey: "cmButton",
    interactionType: null,
    actionPrompt: "Click the CM button to continue",
    waitForInteraction: false
  },
  {
    id: "navigation-overview",
    title: "Your CodeMaster Dashboard",
    content: "Perfect! This is your CodeMaster menu. Here you can access all the tools to improve your problem-solving skills.",
    target: "#cd-mySidenav",
    position: "auto",
    highlightType: "outline",
    screenKey: "navigation",
    interactionType: null,
    actionPrompt: null,
    requiresMenuOpen: true
  },
  {
    id: "generator-feature",
    title: "Problem Generator",
    content: "Get personalized problem recommendations based on your current skill level and learning goals. This adapts as you improve!",
    target: "a[href='/ProbGen']",
    position: "auto",
    highlightType: "outline",
    screenKey: "generator",
    interactionType: null,
    actionPrompt: null,
    requiresMenuOpen: true
  },
  {
    id: "statistics-feature", 
    title: "Statistics & Analytics",
    content: "Track your progress, view detailed performance analytics, and identify your strengths and areas for improvement.",
    target: "a[href='/ProbStat']",
    position: "auto", 
    highlightType: "outline",
    screenKey: "statistics",
    interactionType: null,
    actionPrompt: null,
    requiresMenuOpen: true
  },
  {
    id: "settings-feature",
    title: "Settings & Preferences", 
    content: "Customize your CodeMaster experience, adjust difficulty preferences, and configure your learning goals.",
    target: "a[href='/Settings']",
    position: "auto",
    highlightType: "outline", 
    screenKey: "settings",
    interactionType: null,
    actionPrompt: null,
    requiresMenuOpen: true
  },
  {
    id: "timer-feature",
    title: "Problem Timer",
    content: "When you're solving a problem, use this to time your attempts and track your solving patterns over time.",
    target: "a[href='/ProbTime']",
    position: "auto",
    highlightType: "outline",
    screenKey: "problemTimer", 
    interactionType: null,
    actionPrompt: null,
    requiresMenuOpen: true
  },
  {
    id: "strategy-hints",
    title: "Smart Strategy Hints",
    content: "Look for strategy hint buttons on problem pages. They provide contextual help when you're stuck, without giving away the solution.",
    target: null,
    position: "center",
    highlightType: null,
    screenKey: "strategyHints",
    interactionType: null,
    actionPrompt: null
  },
  {
    id: "completion",
    title: "You're All Set!",
    content: "CodeMaster will now adapt to your learning style as you solve problems. Click the CM button anytime to access these features. Happy coding!",
    target: null,
    position: "center",
    highlightType: null,
    screenKey: "completion",
    interactionType: null,
    actionPrompt: null
  }
];

export function ContentOnboardingTour({ isVisible, onComplete, onClose }) {
  console.log("🎯 ContentOnboardingTour rendered, isVisible:", isVisible);
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
    window.addEventListener('scroll', handleReposition);
    window.addEventListener('resize', handleReposition);

    return () => {
      window.removeEventListener('scroll', handleReposition);
      window.removeEventListener('resize', handleReposition);
    };
  }, [currentStep, isVisible, currentStepData]);

  // Enhanced menu state monitoring
  useEffect(() => {
    if (!isVisible) return;

    const checkMenuState = () => {
      const menuElement = document.querySelector('#cd-mySidenav');
      const isOpen = menuElement && !menuElement.classList.contains('cd-hidden');
      setMenuOpenState(isOpen);
      
      // Debug logging
      console.log('Menu state check:', { isOpen, element: !!menuElement });
    };

    // Check immediately and set up observer
    checkMenuState();
    
    // Set up mutation observer for class changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          checkMenuState();
        }
      });
    });
    
    const menuElement = document.querySelector('#cd-mySidenav');
    if (menuElement) {
      observer.observe(menuElement, { 
        attributes: true, 
        attributeFilter: ['class'] 
      });
    }

    // Also monitor for DOM changes in case menu gets added later
    const bodyObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1 && (node.id === 'cd-mySidenav' || node.querySelector('#cd-mySidenav'))) {
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
    if (!isWaitingForInteraction || !currentStepData.waitForInteraction) return;

    const handleInteraction = (event) => {
      if (currentStepData.interactionType === 'click' && 
          currentStepData.target && 
          event.target.closest(currentStepData.target)) {
        
        console.log('CM button clicked, proceeding to next step');
        setIsWaitingForInteraction(false);
        
        // For CM button click, wait for menu to actually open
        if (currentStepData.target === "#cd-menuButton") {
          setTimeout(() => {
            handleNext();
          }, 500); // Longer delay for menu animation
        } else {
          setTimeout(() => {
            handleNext();
          }, 300);
        }
      }
    };

    // Also add escape hatch - allow manual proceed after 5 seconds
    const escapeTimer = setTimeout(() => {
      console.log('Interaction timeout, allowing manual proceed');
      setIsWaitingForInteraction(false);
    }, 5000);

    document.addEventListener('click', handleInteraction, true); // Use capture phase
    return () => {
      document.removeEventListener('click', handleInteraction, true);
      clearTimeout(escapeTimer);
    };
  }, [isWaitingForInteraction, currentStepData, handleNext]);

  const handleNext = useCallback(async () => {
    // Update progress in database
    try {
      await updateContentOnboardingStep(
        currentStep, 
        currentStepData.screenKey,
        currentStepData.interactionType
      );
    } catch (error) {
      console.error('Error updating onboarding progress:', error);
    }

    // Always proceed to next step - no more waiting for interactions
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
      setIsWaitingForInteraction(false);
    } else {
      onComplete();
    }
  }, [currentStep, currentStepData, onComplete]);

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setIsWaitingForInteraction(false);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  // Check if current step should be shown (e.g., menu needs to be open)
  const shouldShowStep = () => {
    if (currentStepData.requiresMenuOpen && !menuOpenState) {
      return false;
    }
    return true;
  };

  const getStepIcon = () => {
    switch (currentStepData.id) {
      case "welcome": return <IconBrain size={18} />;
      case "cm-button-intro": 
      case "cm-button-interactive": return <IconTarget size={18} />;
      case "navigation-overview": return <IconMenu2 size={18} />;
      case "generator-feature": return <IconBulb size={18} />;
      case "statistics-feature": return <IconChartBar size={18} />;
      case "settings-feature": return <IconSettings size={18} />;
      case "timer-feature": return <IconClock size={18} />;
      case "strategy-hints": return <IconBulb size={18} />;
      case "completion": return <IconHeart size={18} />;
      default: return <IconTarget size={18} />;
    }
  };

  if (!isVisible || !shouldShowStep()) return null;

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
          maxWidth: "90vw"
        }}
      >
        {/* Arrow pointer */}
        {arrowPosition && (
          <div
            style={{
              position: 'absolute',
              top: arrowPosition.top,
              left: arrowPosition.left,
              width: 0,
              height: 0,
              zIndex: 10001,
              ...(arrowPosition.direction === 'up' && {
                borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent',
                borderBottom: '8px solid white',
                filter: 'drop-shadow(0 -2px 4px rgba(0,0,0,0.1))'
              }),
              ...(arrowPosition.direction === 'down' && {
                borderLeft: '8px solid transparent', 
                borderRight: '8px solid transparent',
                borderTop: '8px solid white',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
              }),
              ...(arrowPosition.direction === 'left' && {
                borderTop: '8px solid transparent',
                borderBottom: '8px solid transparent', 
                borderRight: '8px solid white',
                filter: 'drop-shadow(-2px 0 4px rgba(0,0,0,0.1))'
              }),
              ...(arrowPosition.direction === 'right' && {
                borderTop: '8px solid transparent',
                borderBottom: '8px solid transparent',
                borderLeft: '8px solid white', 
                filter: 'drop-shadow(2px 0 4px rgba(0,0,0,0.1))'
              })
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
            value={(currentStep + 1) / TOUR_STEPS.length * 100} 
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
                <Text weight={600} size="xs" mb={2} lineHeight={1.3}>
                  {currentStepData.title}
                </Text>
                <Text size="xs" color="dimmed" lineHeight={1.3}>
                  {currentStepData.content}
                </Text>
              </div>
            </Group>

            {/* Action Prompt - More compact */}
            {currentStepData.actionPrompt && (
              <div style={{
                padding: '4px 8px',
                backgroundColor: '#e3f2fd',
                borderRadius: '4px',
                border: '1px solid #90caf9'
              }}>
                <Group spacing="xs">
                  <IconClick size={12} color="#1976d2" />
                  <Text size="xs" color="#1976d2" weight={500} lineHeight={1.2}>
                    {currentStepData.actionPrompt}
                  </Text>
                </Group>
              </div>
            )}

            {/* Controls - Forced horizontal layout with flexbox */}
            <div style={{ 
              display: 'flex', 
              flexDirection: 'row', 
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '6px',
              marginTop: '8px',
              width: '100%'
            }}>
              <Button
                variant="subtle"
                size="sm"
                onClick={handlePrevious}
                disabled={currentStep === 0}
                styles={{
                  root: {
                    height: '28px',
                    minHeight: '28px',
                    padding: '0 12px',
                    fontSize: '12px',
                    fontWeight: 500,
                    flex: '1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  },
                  inner: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  },
                  label: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }
                }}
              >
                <IconChevronLeft size={12} style={{ marginRight: 4 }} />
                Back
              </Button>

              <Button
                size="sm"
                onClick={handleNext}
                disabled={false}
                styles={{
                  root: {
                    height: '28px',
                    minHeight: '28px', 
                    padding: '0 12px',
                    fontSize: '12px',
                    fontWeight: 500,
                    flex: '1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  },
                  inner: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  },
                  label: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }
                }}
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
              </Button>

              <Button
                variant="subtle"
                size="sm"
                color="gray"
                onClick={handleSkip}
                styles={{
                  root: {
                    height: '28px',
                    minHeight: '28px',
                    padding: '0 8px',
                    fontSize: '11px',
                    fontWeight: 400,
                    flex: '0 0 auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  },
                  inner: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  },
                  label: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }
                }}
              >
                Skip
              </Button>
            </div>
          </Stack>
        </Card>
      </div>
    </>
  );
}