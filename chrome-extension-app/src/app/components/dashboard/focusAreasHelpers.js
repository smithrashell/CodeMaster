/**
 * Helper functions for FocusAreasDisplay component
 */

export const getHelpLevelIcon = (helpLevel) => {
  switch (helpLevel) {
    case "high":
      return "💡"; // Bright idea
    case "medium":
      return "📝"; // Note taking
    case "low":
      return "⚡"; // Quick/minimal help needed
    default:
      return "💡";
  }
};

export const getPriorityEmoji = (priority) => {
  switch (priority) {
    case "high":
      return "🔥";
    case "medium":
      return "📈";
    case "low":
      return "✨";
    default:
      return "📈";
  }
};

export const calculateMasteryProgress = (tag, masteryData) => {
  const masteryInfo = masteryData.find(m => m.tag === tag);
  if (!masteryInfo) return 0;
  
  const { totalAttempts, successfulAttempts } = masteryInfo;
  if (totalAttempts === 0) return 0;
  
  return Math.round((successfulAttempts / totalAttempts) * 100);
};

export const determineFocusAreaStatus = (focusArea, masteryData, masteredTags) => {
  const progress = calculateMasteryProgress(focusArea, masteryData);
  const isMastered = masteredTags.includes(focusArea);
  
  if (isMastered) return { status: 'mastered', progress };
  if (progress >= 80) return { status: 'ready-to-graduate', progress };
  if (progress >= 60) return { status: 'progressing-well', progress };
  if (progress >= 40) return { status: 'making-progress', progress };
  return { status: 'needs-attention', progress };
};

export const formatFocusAreaData = (focusAreas, masteryData, masteredTags) => {
  return focusAreas.map(area => ({
    ...area,
    ...determineFocusAreaStatus(area.tag || area, masteryData, masteredTags)
  }));
};

// Helper functions moved from FocusAreasDisplay component
export const getTagProgress = (tagName, masteryData) => {
  const tagData = masteryData.find((tag) => tag.tag === tagName);
  if (!tagData) return 0;

  // Get unique problems attempted from attempted_problem_ids
  const attemptedProblems = tagData?.attempted_problem_ids || [];
  const uniqueProblems = new Set(attemptedProblems).size;

  // Get mastery requirement (default to 20 unique problems for mastery)
  // This comes from tag_relationships.min_attempts_required * 0.7
  // Most tags need 28 total attempts * 0.7 = ~20 unique
  const minUniqueRequired = tagData?.min_unique_required || 20;

  // Calculate progress as percentage toward unique problem goal
  const progress = Math.min(100, Math.round((uniqueProblems / minUniqueRequired) * 100));

  return progress;
};

export const getHintEffectiveness = (tagName, masteryData) => {
  const tagData = masteryData.find((tag) => tag.tag === tagName);
  return tagData?.hintHelpfulness || "medium";
};

export const getProgressColor = (progress, isMastered, isNearMastery) => {
  if (isMastered) return "green";
  if (isNearMastery) return "yellow";
  return progress >= 60 ? "blue" : "gray";
};

export const formatTagName = (tag) => {
  return tag.charAt(0).toUpperCase() + tag.slice(1).replace(/[-_]/g, " ");
};

export const createPlaceholderCards = (focusAreasLength) => {
  if (focusAreasLength >= 3) return [];
  
  return Array(3 - focusAreasLength).fill(null).map((_, index) => ({
    key: `placeholder-${index}`,
    placeholder: true,
    text: focusAreasLength === 0 ? "Select focus areas to get started" : "Add another focus area"
  }));
};