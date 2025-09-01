/**
 * Similar Problems Section Component
 * Extracted from WhyThisProblem to reduce component size
 * Displays similar problems when expanded
 */
import React from 'react';

/**
 * Individual Similar Problem Item Component
 */
function SimilarProblemItem({ problem, index: _index, isLast }) {
  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'Easy': return '#10b981';
      case 'Hard': return '#ef4444';
      default: return '#f59e0b'; // Medium
    }
  };

  return (
    <div
      style={{
        padding: "6px 0",
        borderBottom: !isLast ? "1px solid rgba(255, 255, 255, 0.1)" : "none",
        display: "flex",
        alignItems: "center",
        gap: "8px",
      }}
    >
      <span style={{ fontSize: "10px" }}>•</span>
      <span style={{ flex: 1 }}>
        {problem.title || problem.problemDescription}
      </span>
      {problem.difficulty && (
        <span
          style={{
            fontSize: "10px",
            padding: "2px 6px",
            borderRadius: "4px",
            backgroundColor: getDifficultyColor(problem.difficulty),
            color: 'white',
          }}
        >
          {problem.difficulty}
        </span>
      )}
    </div>
  );
}

/**
 * Loading State Component
 */
function LoadingState() {
  return (
    <div style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.6)" }}>
      Finding similar problems...
    </div>
  );
}

/**
 * Empty State Component
 */
function EmptyState() {
  return (
    <div style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.6)" }}>
      No similar problems found yet. Keep practicing to build connections!
    </div>
  );
}

/**
 * Similar Problems List Component
 */
function SimilarProblemsList({ similarProblems }) {
  return (
    <div style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.8)" }}>
      {similarProblems.map((problem, index) => (
        <SimilarProblemItem
          key={problem.id || index}
          problem={problem}
          index={index}
          isLast={index === similarProblems.length - 1}
        />
      ))}
    </div>
  );
}

/**
 * Main Similar Problems Section Component
 */
export function SimilarProblemsSection({ 
  currentProblemId, 
  similarProblems, 
  loadingSimilar 
}) {
  if (!currentProblemId) {
    return null;
  }

  return (
    <div
      style={{
        marginTop: "12px",
        padding: "12px",
        backgroundColor: "rgba(255, 255, 255, 0.05)",
        borderRadius: "8px",
        border: "1px solid rgba(255, 255, 255, 0.1)",
      }}
    >
      <div
        style={{
          fontSize: "14px",
          fontWeight: "600",
          color: "rgba(255, 255, 255, 0.95)",
          marginBottom: "8px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        🔗 <span>Problems Like This</span>
      </div>

      {loadingSimilar && <LoadingState />}

      {!loadingSimilar && similarProblems.length > 0 && (
        <SimilarProblemsList similarProblems={similarProblems} />
      )}

      {!loadingSimilar && similarProblems.length === 0 && <EmptyState />}
    </div>
  );
}

export default SimilarProblemsSection;