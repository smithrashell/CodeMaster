/**
 * PageSpecificTour UI Components
 */

import React from "react";
import { Card } from '../ui/Layout.jsx';
import Text from '../ui/Text.jsx';
import Badge from '../ui/Badge.jsx';
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
import { useTheme } from "../../../shared/provider/themeprovider.jsx";

// Theme-aware SimpleButton for the tour
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
      icons.forEach(icon => { icon.style.color = '#1a1a1a'; icon.style.fill = '#1a1a1a'; });
    } else if (variant === 'primary') {
      button.style.backgroundColor = "#364fc7";
      button.style.color = '#ffffff';
      const icons = button.querySelectorAll('svg');
      icons.forEach(icon => { icon.style.color = '#ffffff'; icon.style.fill = '#ffffff'; });
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
      icons.forEach(icon => { icon.style.color = '#1a1a1a'; icon.style.fill = '#1a1a1a'; });
    } else if (variant === 'primary') {
      button.style.backgroundColor = "#4c6ef5";
      button.style.color = '#ffffff';
      const icons = button.querySelectorAll('svg');
      icons.forEach(icon => { icon.style.color = '#ffffff'; icon.style.fill = '#ffffff'; });
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
export function TourArrow({ arrowPosition }) {
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
export function TourHeader({ currentStep, totalSteps, onSkip }) {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
      <Badge
        color="green"
        variant="light"
        size="xs"
        style={{ backgroundColor: isDark ? '#1a4d2e' : '#e6fcf5', color: isDark ? '#69db7c' : '#2b8a3e' }}
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

// Helper function for step icons
export function getStepIcon(stepType) {
  switch (stepType) {
    case "feature": return <IconBulb size={18} />;
    case "interaction": return <IconTarget size={18} />;
    case "timer": return <IconClock size={18} />;
    case "strategy": return <IconBrain size={18} />;
    default: return <IconTarget size={18} />;
  }
}

// Helper component for tour content
export function TourContent({ stepData, getStepIcon: getIcon }) {
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
          {getIcon()}
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
      <div>
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
export function SkipButton({ onClick }) {
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
export function TourControls({ currentStep, totalSteps, onPrevious, onNext, onSkip }) {
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
        style={{ flex: 1, minWidth: "70px", transition: 'all 0.2s ease' }}
      >
        <IconChevronLeft size={12} style={{ marginRight: 4 }} />
        Back
      </SimpleButton>

      <SimpleButton
        variant="primary"
        size="sm"
        onClick={onNext}
        disabled={false}
        style={{ flex: 1, minWidth: "80px" }}
      >
        {currentStep === totalSteps - 1 ? (
          <>Finish<IconCheck size={12} style={{ marginLeft: 4 }} /></>
        ) : (
          <>Next<IconChevronRight size={12} style={{ marginLeft: 4 }} /></>
        )}
      </SimpleButton>

      <SkipButton onClick={onSkip} />
    </div>
  );
}

// Progress bar component
export function TourProgressBar({ currentStep, totalSteps, isDark }) {
  return (
    <div style={{
      width: '100%',
      height: '4px',
      backgroundColor: isDark ? '#373a40' : '#e9ecef',
      borderRadius: '2px',
      marginBottom: '12px',
      overflow: 'hidden'
    }}>
      <div style={{
        width: `${((currentStep + 1) / totalSteps) * 100}%`,
        height: '100%',
        backgroundColor: '#4caf50',
        borderRadius: '2px',
        transition: 'width 0.3s ease'
      }} />
    </div>
  );
}

// Tour card wrapper
export function TourCard({ children, tourPosition, isDark }) {
  return (
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
        {children}
      </Card>
    </div>
  );
}
