/**
 * FloatingHintButtonCore - Extracted button with badge for FloatingHintButton
 */
import React from "react";
import Badge from '../ui/Badge.jsx';
import { IconBulb } from "@tabler/icons-react";
import { 
  getAriaLabel, 
  getBadgeColor, 
  getBadgeText 
} from './floatingHintHelpers.js';

const FloatingHintButtonCore = ({
  buttonRef,
  handleButtonClick,
  buttonStyles,
  interviewRestrictions,
  totalHints,
  problemTags,
  opened
}) => {
  return (
      <button
        id="floating-hint-button"
        ref={buttonRef}
        onClick={handleButtonClick}
        style={buttonStyles}
        aria-label={getAriaLabel(interviewRestrictions, totalHints, problemTags)}
        aria-expanded={opened}
        aria-haspopup="dialog"
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.1)";
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleButtonClick();
          }
        }}
      >
        <IconBulb size={16} color="white" />
        {(totalHints > 0 || interviewRestrictions.isInterviewMode) && (
          <Badge
            size="xs"
            variant="filled"
            color={getBadgeColor(interviewRestrictions)}
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 16,
              height: 16,
              padding: 0,
              fontSize: "9px",
              lineHeight: "16px",
            }}
          >
            {getBadgeText(interviewRestrictions, totalHints)}
          </Badge>
        )}
      </button>
  );
};

export default FloatingHintButtonCore;