import logger from "../../../shared/utils/logging/logger.js";
import React, { useState } from "react";
import { BrainIcon } from "../../../shared/components/ui/Icons";
import { ReasonTypeIcon } from "./ProblemInfoIcon";
import { ReasonDetailsRenderer } from "./ReasonDetailsRenderer.jsx";
import { SimilarProblemsSection } from "./SimilarProblemsSection.jsx";
import { useSimilarProblems } from "./useSimilarProblems.js";
import { getLearningTip } from "./learningTips.js";

/**
 * Get appropriate icon and color for reason type
 */
const getReasonIcon = (type) => {
  switch (type) {
    case "tag_weakness":
      return {
        component: <span style={{ fontSize: "16px" }}>⚠️</span>,
        color: "#f59e0b",
      };
    case "spaced_repetition":
      return {
        component: <span style={{ fontSize: "16px" }}>🔄</span>,
        color: "#3b82f6",
      };
    case "new_tag_introduction":
      return {
        component: <span style={{ fontSize: "16px" }}>✨</span>,
        color: "#10b981",
      };
    case "difficulty_progression":
      return {
        component: <span style={{ fontSize: "16px" }}>📈</span>,
        color: "#8b5cf6",
      };
    case "performance_recovery":
      return {
        component: <span style={{ fontSize: "16px" }}>💪</span>,
        color: "#ef4444",
      };
    case "pattern_reinforcement":
      return {
        component: <span style={{ fontSize: "16px" }}>🎯</span>,
        color: "#06b6d4",
      };
    case "review_problem":
      return {
        component: <span style={{ fontSize: "16px" }}>📚</span>,
        color: "#6b7280",
      };
    case "new_problem":
      return {
        component: <span style={{ fontSize: "16px" }}>🆕</span>,
        color: "#10b981",
      };
    default:
      return {
        component: <BrainIcon className="problem-sidebar-section-icon" />,
        color: "var(--cm-link)",
      };
  }
};

/**
 * Renders the expandable header section
 */
const renderHeader = (reasonIcon, isExpanded, handleToggle) => {
  return (
    <div
      className="problem-sidebar-section-header"
      onClick={handleToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleToggle();
        }
      }}
      role="button"
      tabIndex={0}
      style={{ cursor: "pointer", userSelect: "none" }}
    >
      {reasonIcon.component}
      <span className="problem-sidebar-section-title">Why This Problem?</span>
      <span style={{ marginLeft: "auto", fontSize: "12px" }}>
        {isExpanded ? "▼" : "▶"}
      </span>
    </div>
  );
};

/**
 * Check if similar problems should be shown based on interview mode
 */
const shouldShowSimilarProblems = (sessionType) => {
  // Hide similar problems in all interview modes to prevent "cheating"
  const isInterviewMode = sessionType && sessionType !== 'standard';
  return !isInterviewMode;
};

/**
 * Renders the expanded content section
 */
const renderExpandedContent = (selectionReason, currentProblemId, similarProblems, loadingSimilar, sessionType) => {
  return (
    <div
      className="problem-sidebar-primer-content"
      style={{
        marginTop: "8px",
        fontSize: "14px",
        lineHeight: "1.5",
        color: "rgba(255, 255, 255, 0.85)",
      }}
    >
      <div
        style={{
          marginBottom: "16px",
          padding: "12px",
          backgroundColor: "rgba(255, 255, 255, 0.08)",
          borderRadius: "8px",
          border: "1px solid rgba(255, 255, 255, 0.15)",
        }}
      >
        {/* Main explanation */}
        <div
          style={{
            fontWeight: "600",
            marginBottom: "10px",
            color: "rgba(255, 255, 255, 0.95)",
            fontSize: "15px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <ReasonTypeIcon reasonType={selectionReason.type} size={18} />
          {selectionReason.fullText}
        </div>

        {/* Detailed breakdown */}
        <ReasonDetailsRenderer 
          type={selectionReason.type}
          details={selectionReason.details}
        />

        {/* Learning tip based on reason type */}
        <div
          style={{
            marginTop: "12px",
            padding: "8px",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            borderRadius: "6px",
            borderLeft: "3px solid #3b82f6",
            fontSize: "13px",
            color: "rgba(255, 255, 255, 0.9)",
          }}
        >
          💡 <strong>Learning Tip:</strong>{" "}
          {getLearningTip(selectionReason.type)}
        </div>
      </div>

      {shouldShowSimilarProblems(sessionType) && (
        <SimilarProblemsSection
          currentProblemId={currentProblemId}
          similarProblems={similarProblems}
          loadingSimilar={loadingSimilar}
        />
      )}
    </div>
  );
};

/**
 * WhyThisProblem Component
 * Displays detailed explanation of why a problem was selected by the adaptive engine
 * Follows the same expandable pattern as ExpandablePrimerSection in probdetail.jsx
 */
function WhyThisProblem({
  selectionReason,
  problemTags: _problemTags = [],
  className = "",
  currentProblemId = null,
  interviewConfig: _interviewConfig = null,
  sessionType = null,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { similarProblems, loadingSimilar } = useSimilarProblems(currentProblemId, isExpanded);

  // Don't render if no selection reason provided
  if (!selectionReason) {
    return null;
  }

  const handleToggle = () => {
    logger.info(`📖 Strategy: ${isExpanded ? 'Collapsed' : 'Expanded'} "${selectionReason.type}" for problem ${currentProblemId}`);
    setIsExpanded(!isExpanded);
  };

  const reasonIcon = getReasonIcon(selectionReason.type);

  return (
    <div className={`problem-sidebar-section ${className}`}>
      {renderHeader(reasonIcon, isExpanded, handleToggle)}
      {isExpanded && renderExpandedContent(selectionReason, currentProblemId, similarProblems, loadingSimilar, sessionType)}
    </div>
  );
}


export default WhyThisProblem;
