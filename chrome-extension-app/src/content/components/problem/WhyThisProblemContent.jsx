import React from "react";
import { ReasonTypeIcon } from "./ProblemInfoIcon";
import { ReasonDetailsRenderer } from "./ReasonDetailsRenderer.jsx";
import { SimilarProblemsSection } from "./SimilarProblemsSection.jsx";
import { getLearningTip } from "./learningTips.js";

/**
 * Expanded content for WhyThisProblem component
 * Displays detailed reasoning, learning tips, and similar problems
 */
export function WhyThisProblemContent({
  selectionReason,
  currentProblemId,
  similarProblems,
  loadingSimilar,
}) {
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

      <SimilarProblemsSection 
        currentProblemId={currentProblemId}
        similarProblems={similarProblems}
        loadingSimilar={loadingSimilar}
      />
    </div>
  );
}