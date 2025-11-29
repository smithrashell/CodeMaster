/**
 * Content Onboarding Tour UI Components
 * Extracted from ContentOnboardingTour.jsx
 */

import React from "react";
import { Group } from '../ui/Layout.jsx';
import Text from '../ui/Text.jsx';
import Badge from '../ui/Badge.jsx';
import { baseButtonStyles, sizeStyles, getThemeAwareVariantStyles } from "../../../shared/components/ui/buttonStyles";
import {
  IconX,
  IconChevronRight,
  IconChevronLeft,
  IconCheck,
  IconClick,
} from "@tabler/icons-react";
import { useTheme } from "../../../shared/provider/themeprovider.jsx";

/**
 * Theme-aware SimpleButton for the tour
 */
export const SimpleButton = ({ variant = "primary", size = "md", disabled = false, onClick, children, style = {}, ...props }) => {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';

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
      const icons = button.querySelectorAll('svg');
      icons.forEach(icon => {
        icon.style.color = '#1a1a1a';
        icon.style.fill = '#1a1a1a';
      });
    } else if (variant === 'primary') {
      button.style.backgroundColor = "#364fc7";
      button.style.color = '#ffffff';
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
    const button = e.currentTarget;
    if (variant === 'ghost') {
      button.style.backgroundColor = "transparent";
      button.style.color = '#1a1a1a';
      button.style.border = 'none';
      const icons = button.querySelectorAll('svg');
      icons.forEach(icon => {
        icon.style.color = '#1a1a1a';
        icon.style.fill = '#1a1a1a';
      });
    } else if (variant === 'primary') {
      button.style.backgroundColor = "#4c6ef5";
      button.style.color = '#ffffff';
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

/**
 * Tour Card Header Component
 */
export const TourCardHeader = ({ currentStep, totalSteps, onSkip }) => {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
      <Badge
        color="blue"
        variant="light"
        size="xs"
        style={{
          backgroundColor: isDark ? '#1e3a8a' : '#e7f5ff',
          color: isDark ? '#93c5fd' : '#1971c2'
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

/**
 * Tour Card Content Component
 */
export const TourCardContent = ({ currentStepData, getStepIcon }) => {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexDirection: 'column'}}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'row'}}>
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
      <div>
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

/**
 * Action Prompt Component
 */
export const ActionPrompt = ({ actionPrompt }) => {
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

/**
 * Skip Button Component
 */
export const SkipButton = ({ onClick, text = "Skip" }) => (
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

/**
 * Back Button Component
 */
export const BackButton = ({ onClick, disabled, style = {} }) => (
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

/**
 * Next Button Component
 */
export const NextButton = ({ onClick, isLastStep, style = {} }) => (
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

/**
 * Navigation with Special Button Layout
 */
export const NavigationWithSpecialButton = ({
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

/**
 * Standard Navigation Layout
 */
export const StandardNavigation = ({
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

/**
 * Navigation Controls Component
 */
export const NavigationControls = ({
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
