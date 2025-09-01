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

// Helper function to create hint click data
export const createHintClickData = (params) => {
  const { problemId, hintId, hintType, hint, problemTags, isCurrentlyExpanded, opened, hints, expandedHints, index } = params;
  
  return {
    problemId: problemId || "unknown",
    hintId,
    hintType,
    primaryTag: hint.primaryTag,
    relatedTag: hint.relatedTag,
    content: hint.tip,
    relationshipScore: hint.relationshipScore || null,
    timestamp: new Date().toISOString(),
    problemTags: problemTags,
    action: isCurrentlyExpanded ? "collapse" : "expand",
    sessionContext: {
      popoverOpen: opened,
      totalHints: hints.length,
      hintPosition: index,
      expandedHintsCount: isCurrentlyExpanded
        ? expandedHints.size - 1
        : expandedHints.size + 1,
    },
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
  },
});

// Helper function to handle mouse enter events
export const handleMouseEnter = (e) => {
  e.target.style.transform = "scale(1.05)";
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