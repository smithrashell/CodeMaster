/**
 * Sub-components extracted from ProblemPageTimerTour
 */
import React from "react";
import { Stack } from '../ui/Layout.jsx';
import Text from '../ui/Text.jsx';
import Badge from '../ui/Badge.jsx';
import {
  IconX,
  IconChevronRight,
  IconChevronLeft,
  IconCheck,
  IconClock,
} from "@tabler/icons-react";
import { useTheme } from "../../../shared/provider/themeprovider.jsx";

/**
 * Arrow component for pointing to target elements
 */
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

/**
 * Header with badge and close button
 */
export function TourHeader({ currentStep, totalSteps, onSkip }) {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
      <Badge
        color="orange"
        variant="light"
        size="xs"
        style={{
          backgroundColor: isDark ? '#4a2a1a' : '#fff4e6',
          color: isDark ? '#ffa94d' : '#e8590c'
        }}
      >
        Problem Analysis: {currentStep + 1} of {totalSteps}
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
}

/**
 * Progress bar showing current step
 */
export function TourProgressBar({ currentStep, totalSteps }) {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';
  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div style={{
      width: '100%',
      height: '3px',
      backgroundColor: isDark ? '#373a40' : '#e9ecef',
      borderRadius: '2px',
      overflow: 'hidden',
      marginBottom: '12px'
    }}>
      <div style={{
        width: `${progress}%`,
        height: '100%',
        backgroundColor: '#fd7e14',
        transition: 'width 0.3s ease',
        borderRadius: '2px'
      }} />
    </div>
  );
}

/**
 * Tour content with icon, title, and description
 */
export function TourContent({ title, content }) {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';

  return (
    <>
      <div style={{
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-start',
        marginBottom: '12px'
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          backgroundColor: isDark ? '#4a2a1a' : '#fff4e6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <IconClock size={18} style={{ color: '#fd7e14' }} />
        </div>
        <div>
          <Text weight={600} size="sm" style={{ marginBottom: '6px', color: isDark ? '#ffffff' : '#212529' }}>
            {title}
          </Text>
          <Text size="sm" style={{ color: isDark ? '#c9c9c9' : '#495057', lineHeight: '1.4' }}>
            {content}
          </Text>
        </div>
      </div>
    </>
  );
}

/**
 * Navigation buttons for the tour
 */
export function TourNavigationButtons({ currentStep, totalSteps, onPrevious, onNext, SimpleButton }) {
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <Stack direction="horizontal" gap="xs" justify="space-between" style={{ width: '100%' }}>
      <SimpleButton
        variant="ghost"
        size="xs"
        onClick={onPrevious}
        disabled={isFirstStep}
        style={{
          visibility: isFirstStep ? 'hidden' : 'visible'
        }}
      >
        <IconChevronLeft size={14} style={{ marginRight: '2px' }} />
        Back
      </SimpleButton>

      <SimpleButton
        variant="primary"
        size="xs"
        onClick={onNext}
      >
        {isLastStep ? (
          <>
            Done
            <IconCheck size={14} style={{ marginLeft: '4px' }} />
          </>
        ) : (
          <>
            Next
            <IconChevronRight size={14} style={{ marginLeft: '4px' }} />
          </>
        )}
      </SimpleButton>
    </Stack>
  );
}
