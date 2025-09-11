/**
 * Helper functions for FloatingHintButton component
 */

// Helper function to calculate interview restrictions
export const calculateInterviewRestrictions = (interviewConfig, sessionType, hintsUsed) => {
  if (!interviewConfig || !sessionType || sessionType === 'standard') {
    return { hintsAllowed: true, maxHints: null, hintsAvailable: true };
  }

  const maxHints = interviewConfig.hints?.max ?? null;
  const hintsAllowed = maxHints === null || maxHints > 0;
  const hintsAvailable = hintsAllowed && (maxHints === null || hintsUsed < maxHints);

  return {
    hintsAllowed,
    maxHints,
    hintsAvailable,
    hintsRemaining: maxHints === null ? null : Math.max(0, maxHints - hintsUsed),
    isInterviewMode: true,
    sessionType,
  };
};

// Helper function to get button styles based on UI mode
export const getButtonStyles = (uiMode, interviewRestrictions) => {
  const baseStyles = {
    border: "none",
    borderRadius: "50%",
    width: "32px",
    height: "32px", 
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    position: "relative",
    margin: "0 4px",
    transition: "all 0.2s ease",
  };

  switch (uiMode) {
    case 'minimal-clean':
      return {
        ...baseStyles,
        background: "#6b7280",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
      };
    case 'pressure-indicators':
      return {
        ...baseStyles,
        background: !interviewRestrictions.hintsAvailable 
          ? "#ef4444" 
          : "linear-gradient(135deg, #f59e0b, #d97706)",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
      };
    default:
      return {
        ...baseStyles,
        background: "linear-gradient(135deg, #ffd43b, #fd7e14)",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
      };
  }
};

// Helper function to calculate expanded hints count
const calculateExpandedHintsCount = (isCurrentlyExpanded, expandedHints) => {
  const currentSize = expandedHints?.size || 0;
  return isCurrentlyExpanded ? currentSize - 1 : currentSize + 1;
};

// Helper function to create session context object
const createSessionContext = (opened, hints, index, isCurrentlyExpanded, expandedHints) => ({
  popoverOpen: opened,
  totalHints: hints?.length || 0,
  hintPosition: index || 0,
  expandedHintsCount: calculateExpandedHintsCount(isCurrentlyExpanded, expandedHints),
});

// Helper function to create fallback hint data when hint is undefined
const createFallbackHintData = (params) => {
  const { problemId, hintId, hintType, problemTags, isCurrentlyExpanded, opened, hints, expandedHints, index } = params;
  
  return {
    problemId: problemId || "unknown",
    hintId: hintId || "unknown",
    hintType,
    primaryTag: "unknown",
    relatedTag: "unknown",
    content: "Unknown hint content",
    relationshipScore: null,
    timestamp: new Date().toISOString(),
    problemTags: problemTags || [],
    action: isCurrentlyExpanded ? "collapse" : "expand",
    sessionContext: createSessionContext(opened, hints, index, isCurrentlyExpanded, expandedHints),
  };
};

// Helper function to create hint click data
export const createHintClickData = (params) => {
  const { problemId, hintId, hintType, hint, problemTags, isCurrentlyExpanded, opened, hints, expandedHints, index } = params;
  
  if (!hint) {
    console.warn('⚠️ createHintClickData called with undefined hint:', params);
    return createFallbackHintData(params);
  }
  
  return {
    problemId: problemId || "unknown",
    hintId,
    hintType,
    primaryTag: hint.primaryTag || "unknown",
    relatedTag: hint.relatedTag || "unknown",
    content: hint.tip || "No content available",
    relationshipScore: hint.relationshipScore || null,
    timestamp: new Date().toISOString(),
    problemTags: problemTags || [],
    action: isCurrentlyExpanded ? "collapse" : "expand",
    sessionContext: createSessionContext(opened, hints, index, isCurrentlyExpanded, expandedHints),
  };
};

// Helper function to get tooltip label
export const getTooltipLabel = (interviewRestrictions, totalHints) => {
  return interviewRestrictions.isInterviewMode && interviewRestrictions.maxHints !== null
    ? `${interviewRestrictions.hintsRemaining} of ${interviewRestrictions.maxHints} hints remaining (Interview Mode)`
    : `${totalHints} strategy hints available`;
};

// Helper function to get aria label
export const getAriaLabel = (interviewRestrictions, totalHints, problemTags) => {
  return interviewRestrictions.isInterviewMode && interviewRestrictions.maxHints !== null
    ? `${interviewRestrictions.hintsRemaining} of ${interviewRestrictions.maxHints} hints remaining in Interview Mode. Click to view hints for ${problemTags.join(", ")}`
    : `${totalHints} strategy hints available. Click to view hints for ${problemTags.join(", ")}`;
};

// Helper function to get badge color
export const getBadgeColor = (interviewRestrictions) => {
  if (!interviewRestrictions.hintsAvailable) return "gray";
  return interviewRestrictions.isInterviewMode ? "orange" : "red";
};

// Helper function to get badge text
export const getBadgeText = (interviewRestrictions, totalHints) => {
  return interviewRestrictions.isInterviewMode && interviewRestrictions.maxHints !== null
    ? interviewRestrictions.hintsRemaining
    : totalHints;
};

// Helper function to get alert message
export const getAlertMessage = (interviewRestrictions) => {
  return interviewRestrictions.hintsAvailable 
    ? `${interviewRestrictions.hintsRemaining} hints remaining in this interview session`
    : 'No hints remaining in this interview session';
};

// Helper function to check if alert should be shown
export const shouldShowAlert = (interviewRestrictions) => {
  return interviewRestrictions.isInterviewMode && interviewRestrictions.maxHints !== null;
};

// Helper function to get popover dropdown styles
export const getPopoverDropdownStyles = (colors) => ({
  dropdown: {
    maxHeight: "80vh",
    overflowY: "auto",
    backgroundColor: colors.expandedBg, // Force override Mantine defaults with timer colors
    borderColor: colors.containerBorder, // Match timer border
    border: `1px solid ${colors.containerBorder}`, // Ensure border is applied
    color: colors.text, // Set text color to match timer
    // Fix positioning - override Mantine's auto-calculation
    position: "fixed !important",
    transform: "none !important", // Disable Mantine's transform-based positioning
    // Use CSS custom properties that can be updated dynamically
    top: "var(--popover-top, auto)",
    left: "var(--popover-left, auto)",
    zIndex: "var(--cm-z-popover, 10000)",
  },
});

// Helper function to calculate and set popover position
export const calculatePopoverPosition = (buttonRef, popoverWidth = 350, offset = 8) => {
  if (!buttonRef?.current) return;
  
  const button = buttonRef.current;
  const rect = button.getBoundingClientRect();
  
  // Calculate position below the button with offset
  const top = rect.bottom + offset;
  const left = rect.left + (rect.width / 2) - (popoverWidth / 2);
  
  // Ensure popover stays within viewport
  const viewportWidth = window.innerWidth;
  const adjustedLeft = Math.max(10, Math.min(left, viewportWidth - popoverWidth - 10));
  
  // Set CSS custom properties for positioning
  document.documentElement.style.setProperty('--popover-top', `${top}px`);
  document.documentElement.style.setProperty('--popover-left', `${adjustedLeft}px`);
};

// Helper function to handle mouse enter events
export const handleMouseEnter = (e) => {
  e.target.style.transform = "scale(1.20)";
  e.target.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.2)";
};

// Helper function to handle mouse leave events
export const handleMouseLeave = (e) => {
  e.target.style.transform = "scale(1)";
  e.target.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.15)";
};

// Helper function to create keydown handler
export const createKeyDownHandler = (handleButtonClick) => (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    handleButtonClick();
  }
};

// Helper function to create popover content props
export const createPopoverContentProps = ({
  loading,
  error,
  hints,
  colors,
  problemTags,
  interviewRestrictions,
  generalHints,
  contextualHints,
  expandedHints,
  toggleHintExpansion,
  onHintClick,
  getHintId
}) => ({
  loading,
  error,
  hints,
  colors,
  problemTags,
  interviewRestrictions,
  generalHints,
  contextualHints,
  expandedHints,
  toggleHintExpansion,
  onHintClick,
  getHintId
});