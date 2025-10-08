/**
 * Navigation controls for timer tour
 */
import React from "react";
import {
  IconChevronRight,
  IconChevronLeft,
  IconCheck,
} from "@tabler/icons-react";

export function TimerTourNavigation({
  SimpleButton,
  currentStep,
  totalSteps,
  handlePrevious,
  handleNext,
  handleSkip
}) {
  return (
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
  );
}
