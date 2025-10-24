/**
 * Reason Details Renderer Component
 * Extracted from WhyThisProblem to reduce component size
 * Handles rendering detailed information for different selection reason types
 */
import React from 'react';

const DETAIL_STYLE = {
  fontSize: "13px",
  color: "rgba(255, 255, 255, 0.8)",
  lineHeight: "1.4",
};

const DETAIL_ITEM_STYLE = {
  marginBottom: "6px",
};

/**
 * Tag Weakness Details Component
 */
function TagWeaknessDetails({ details }) {
  return (
    <div style={DETAIL_STYLE}>
      <div style={DETAIL_ITEM_STYLE}>
        📊 <strong>Current Performance:</strong>{" "}
        {Math.round((details.currentAccuracy || 0) * 100)}% accuracy
      </div>
      <div style={DETAIL_ITEM_STYLE}>
        🎯 <strong>Target Performance:</strong>{" "}
        {Math.round((details.targetAccuracy || 0.8) * 100)}% accuracy
      </div>
      {details.totalProblems > 0 && (
        <div>
          📈 <strong>Problems Attempted:</strong> {details.totalProblems}{" "}
          with {details.weakTag} tag
        </div>
      )}
    </div>
  );
}

/**
 * Spaced Repetition Details Component
 */
function SpacedRepetitionDetails({ details }) {
  return (
    <div style={DETAIL_STYLE}>
      <div style={DETAIL_ITEM_STYLE}>
        ⏰ <strong>Last Attempt:</strong> {details.daysSinceLastAttempt}{" "}
        days ago
      </div>
      <div style={DETAIL_ITEM_STYLE}>
        🎯 <strong>Optimal Review Interval:</strong>{" "}
        {details.optimalInterval} days
      </div>
      {details.previousAttempts > 0 && (
        <div>
          📚 <strong>Previous Attempts:</strong>{" "}
          {details.previousAttempts} time(s)
        </div>
      )}
    </div>
  );
}

/**
 * New Tag Introduction Details Component
 */
function NewTagIntroductionDetails({ details }) {
  return (
    <div style={DETAIL_STYLE}>
      <div style={DETAIL_ITEM_STYLE}>
        ✨ <strong>New Concept:</strong> {details.newTag}
      </div>
      {details.totalNewTags > 1 && (
        <div>
          📖 <strong>Total New Tags in Session:</strong>{" "}
          {details.totalNewTags}
        </div>
      )}
    </div>
  );
}

/**
 * Difficulty Progression Details Component
 */
function DifficultyProgressionDetails({ details }) {
  return (
    <div style={DETAIL_STYLE}>
      <div style={DETAIL_ITEM_STYLE}>
        📈 <strong>Current Level:</strong> {details.currentDifficulty}
      </div>
      <div>
        🎯 <strong>Progression Reason:</strong>{" "}
        {details.progressionReason === "performance-based"
          ? "Based on your recent performance"
          : "Systematic advancement"}
      </div>
    </div>
  );
}

/**
 * Performance Recovery Details Component
 */
function PerformanceRecoveryDetails({ details }) {
  return (
    <div style={DETAIL_STYLE}>
      <div style={DETAIL_ITEM_STYLE}>
        💪 <strong>Recent Struggles:</strong> {details.recentFailures}{" "}
        unsuccessful attempts
      </div>
      {details.lastSuccess && (
        <div>
          ✅ <strong>Last Success:</strong>{" "}
          {new Date(details.lastSuccess).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}

/**
 * Pattern Reinforcement Details Component
 */
function PatternReinforcementDetails({ details }) {
  return (
    <div style={DETAIL_STYLE}>
      <div style={DETAIL_ITEM_STYLE}>
        🎯 <strong>Reinforcing Pattern:</strong> {details.reinforcedTag}
      </div>
      <div>
        📊 <strong>Current Success Rate:</strong>{" "}
        {Math.round((details.successRate || 0) * 100)}%
      </div>
    </div>
  );
}

/**
 * New Problem Details Component
 */
function NewProblemDetails({ details }) {
  return (
    <div style={DETAIL_STYLE}>
      <div style={DETAIL_ITEM_STYLE}>
        🆕 <strong>Difficulty Level:</strong> {details.difficulty}
      </div>
      {details.problemTags && details.problemTags.length > 0 && (
        <div>
          🏷️ <strong>Tags:</strong> {details.problemTags.join(", ")}
        </div>
      )}
    </div>
  );
}

/**
 * Review Problem Details Component
 */
function ReviewProblemDetails({ details }) {
  return (
    <div style={DETAIL_STYLE}>
      <div style={DETAIL_ITEM_STYLE}>
        📚 <strong>Total Attempts:</strong> {details.totalAttempts}
      </div>
      {details.daysSinceLastAttempt > 0 && (
        <div>
          ⏱️ <strong>Last Attempted:</strong> {details.daysSinceLastAttempt}{" "}
          days ago
        </div>
      )}
    </div>
  );
}

/**
 * General Details Component
 */
function GeneralDetails({ details }) {
  return (
    <div style={DETAIL_STYLE}>
      <div>
        🤖 <strong>Algorithm Type:</strong> {details.algorithmType || "adaptive"}
      </div>
    </div>
  );
}

/**
 * Main Reason Details Renderer
 * Renders appropriate detail component based on reason type
 */
export function ReasonDetailsRenderer({ type, details }) {
  if (!details) return null;

  switch (type) {
    case "tag_weakness":
      return <TagWeaknessDetails details={details} />;
    case "spaced_repetition":
      return <SpacedRepetitionDetails details={details} />;
    case "new_tag_introduction":
      return <NewTagIntroductionDetails details={details} />;
    case "difficulty_progression":
      return <DifficultyProgressionDetails details={details} />;
    case "performance_recovery":
      return <PerformanceRecoveryDetails details={details} />;
    case "pattern_reinforcement":
      return <PatternReinforcementDetails details={details} />;
    case "new_problem":
      return <NewProblemDetails details={details} />;
    case "review_problem":
      return <ReviewProblemDetails details={details} />;
    case "general":
    default:
      return <GeneralDetails details={details} />;
  }
}

export default ReasonDetailsRenderer;