/**
 * Problem Generator Item Components
 * Extracted from ProblemGeneratorComponents.jsx
 */

import { useState, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import logger from "../../../shared/utils/logging/logger.js";
import ProblemInfoIcon from "../../components/problem/ProblemInfoIcon";
import { useSimilarProblems } from "../../components/problem/useSimilarProblems";
import { getInterviewProblemStyle } from "./ProblemGeneratorHelpers.js";

/**
 * Helper function to render problem badges
 */
const renderProblemBadges = ({ problem, isNewProblem, handleMouseEnter, handleMouseLeave }) => (
  <div className="cm-problem-badges">
    {problem.selectionReason && (
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="cm-problem-info-icon"
      >
        <ProblemInfoIcon className="cm-problem-info-icon" />
      </div>
    )}
    {isNewProblem && <span className="cm-new-tag">NEW</span>}
    <span
      className={`cd-difficulty cd-difficulty-${
        (problem.difficulty || "medium").toLowerCase()
      }`}
    >
      {problem.difficulty || "Medium"}
    </span>
  </div>
);

/**
 * Helper function to render similar problems section
 */
const renderSimilarProblems = ({ similarProblems, loadingSimilar, hovered }) => (
  <div style={{
    fontSize: "0.7rem",
    color: "var(--cm-text, #ffffff)",
    opacity: 0.9,
    padding: "2px 0",
  }}>
    <div style={{ textAlign: "left", fontWeight: "bold", marginBottom: "2px", fontSize: "0.7rem" }}>
      Similar Problems:
    </div>
    {loadingSimilar && (
      <div style={{ fontSize: "0.7rem", color: "rgba(7, 7, 7, 0.6)", fontStyle: "italic" }}>
        Finding similar problems...
      </div>
    )}
    {similarProblems.length > 0 && (
      <div style={{ display: "flex", flexDirection: "column", gap: "2px", textAlign: "left" }}>
        {similarProblems.slice(0, 2).map((similar, index) => (
          <div key={similar.id || index} style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.65rem",
            padding: "1px 0",
          }}>
            <span style={{
              flex: 1,
              textAlign: "left",
              lineHeight: "1.2",
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}>
              {(similar.Description || similar.ProblemDescription || similar.problemDescription || similar.title || '').substring(0, 30)}
              {(similar.Description || similar.ProblemDescription || similar.problemDescription || similar.title || '').length > 30 ? '...' : ''}
            </span>
            {similar.difficulty && (
              <span style={{
                fontSize: "0.55rem",
                padding: "2px 4px",
                borderRadius: "3px",
                backgroundColor: similar.difficulty === 'Easy' ? '#10b981' :
                               similar.difficulty === 'Hard' ? '#ef4444' : '#f59e0b',
                color: 'white',
                fontWeight: 'bold',
                flexShrink: 0,
              }}>
                {similar.difficulty.substring(0, 1)}
              </span>
            )}
          </div>
        ))}
      </div>
    )}
    {!loadingSimilar && similarProblems.length === 0 && hovered && (
      <div style={{ fontSize: "0.6rem", color: "rgba(255, 255, 255, 0.6)", fontStyle: "italic" }}>
        No patterns discovered yet<br/>
        Complete more problems to build connections!
      </div>
    )}
  </div>
);

/**
 * Check if similar problems should be shown based on interview mode
 */
const shouldShowSimilarProblems = (sessionType) => {
  // Hide similar problems in all interview modes to prevent "cheating"
  const isInterviewMode = sessionType && sessionType !== 'standard';
  return !isInterviewMode;
};

/**
 * Helper function to render expandable content
 */
const renderExpandableContent = ({ problem, hovered, similarProblems, loadingSimilar, sessionType }) => {
  if (!problem.selectionReason) return null;

  const showSimilar = shouldShowSimilarProblems(sessionType) && (similarProblems.length > 0 || loadingSimilar);

  return (
    <div style={{
      maxHeight: hovered ? "160px" : "0px",
      opacity: hovered ? 1 : 0,
      overflow: "hidden",
      transition: "all 0.3s ease",
    }}>
      <div style={{
        maxWidth: "240px",
        margin: 0,
        fontSize: "0.75rem",
        color: "var(--cm-text, #ffffff)",
        lineHeight: 1.4,
        wordWrap: "break-word",
        overflowWrap: "anywhere",
        padding: "4px 0",
        borderBottom: showSimilar ? "1px solid rgba(255, 255, 255, 0.1)" : "none",
        marginBottom: showSimilar ? "6px" : "0",
        textAlign: "left",
      }}>
        <strong>Selected because:</strong> {problem.selectionReason.fullText}
      </div>

      {showSimilar &&
        renderSimilarProblems({ similarProblems, loadingSimilar, hovered })
      }
    </div>
  );
};

/**
 * Problem Item Component with expandable reason text
 */
export const ProblemItemWithReason = ({ problem, isNewProblem, onLinkClick, sessionType }) => {
  const [hovered, setHovered] = useState(false);

  const { similarProblems, loadingSimilar } = useSimilarProblems(problem?.id, hovered);

  const handleMouseEnter = useCallback(() => {
    setHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHovered(false);
  }, []);

  return (
    <div
      className="cm-simple-problem-item-container"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="cm-simple-problem-item">
        <button
          type="button"
          onClick={(e) => {
            onLinkClick(problem);
            e.target.blur();
            setTimeout(() => {
              if (e.target === document.activeElement) {
                e.target.blur();
              }
            }, 0);
          }}
          className="cm-simple-problem-link"
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            textAlign: 'left',
            width: '100%'
          }}
        >
          {problem.Description || problem.ProblemDescription || problem.problemDescription || problem.title || "N/A"}
        </button>
        {renderProblemBadges({ problem, isNewProblem, handleMouseEnter, handleMouseLeave })}
      </div>

      {renderExpandableContent({ problem, hovered, similarProblems, loadingSimilar, sessionType })}
    </div>
  );
};

/**
 * Enhanced Problem Item with Interview Context
 */
export const ProblemItemWithInterviewContext = ({ problem, isNewProblem, interviewMode, onLinkClick }) => {
  return (
    <div style={getInterviewProblemStyle(interviewMode)}>
      <ProblemItemWithReason
        problem={problem}
        isNewProblem={isNewProblem}
        onLinkClick={onLinkClick}
        sessionType={interviewMode}
      />
      {interviewMode && interviewMode !== 'standard' && (
        <div style={{
          fontSize: '10px',
          color: 'var(--cm-text-secondary, #888)',
          marginTop: '4px',
          fontStyle: 'italic'
        }}>
          Interview practice problem
        </div>
      )}
    </div>
  );
};

/**
 * Problems List Component
 */
export const ProblemsList = ({ problems, sessionData, onLinkClick }) => {
  const unattemptedProblems = problems.filter(problem => !problem.attempted);

  if (problems.length !== unattemptedProblems.length) {
    logger.info(`Filtered problems: ${problems.length} total -> ${unattemptedProblems.length} unattempted`);
  }

  return (
    <div className="cm-simple-problems-list">
      {unattemptedProblems.map((problem) => {
        const hasAttempts = problem.attempts && problem.attempts.length > 0;
        const hasAttemptStats = problem.attempt_stats && problem.attempt_stats.total_attempts > 0;
        const isNewProblem = !hasAttempts && !hasAttemptStats;

        return (
          <div key={uuidv4()} role="listitem">
            <ProblemItemWithInterviewContext
              problem={problem}
              isNewProblem={isNewProblem}
              interviewMode={sessionData?.session_type}
              onLinkClick={onLinkClick}
            />
          </div>
        );
      })}
    </div>
  );
};
