import logger from "../../../shared/utils/logger.js";
import React, { useState, useEffect } from "react";
import { BrainIcon } from "../../../shared/components/ui/Icons";
import { ReasonTypeIcon } from "./ProblemInfoIcon";

/**
 * WhyThisProblem Component
 * Displays detailed explanation of why a problem was selected by the adaptive engine
 * Follows the same expandable pattern as ExpandablePrimerSection in probdetail.jsx
 */
const WhyThisProblem = ({
  selectionReason,
  problemTags: _problemTags = [],
  className = "",
  currentProblemId = null,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [similarProblems, setSimilarProblems] = useState([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);

  // Fetch similar problems when expanded
  useEffect(() => {
    const fetchSimilarProblems = async () => {
      if (isExpanded && currentProblemId && !loadingSimilar && similarProblems.length === 0) {
        logger.info('🔗 Fetching similar problems for:', currentProblemId);
        setLoadingSimilar(true);
        try {
          // Use Chrome messaging to get similar problems
          chrome.runtime.sendMessage({
            type: 'getSimilarProblems',
            problemId: currentProblemId,
            limit: 3
          }, (response) => {
            logger.info('🔗 Similar problems response:', response);
            if (response?.similarProblems) {
              setSimilarProblems(response.similarProblems);
              logger.info('🔗 Set similar problems:', response.similarProblems.length);
            } else {
              logger.info('🔗 No similar problems found in response');
            }
            setLoadingSimilar(false);
          });
        } catch (error) {
          logger.error('❌ Error fetching similar problems:', error);
          setLoadingSimilar(false);
        }
      } else {
        logger.info('🔗 Skipping similar problems fetch:', {
          isExpanded,
          currentProblemId,
          loadingSimilar,
          similarProblemsLength: similarProblems.length
        });
      }
    };

    fetchSimilarProblems();
  }, [isExpanded, currentProblemId, loadingSimilar, similarProblems.length]);

  // Don't render if no selection reason provided
  if (!selectionReason) {
    return null;
  }

  const handleToggle = () => {
    logger.info(`📖 Strategy: ${isExpanded ? 'Collapsed' : 'Expanded'} "${selectionReason.type}" for problem ${currentProblemId}`);
    setIsExpanded(!isExpanded);
  };

  /**
   * Render detailed reason based on type and details
   */
  const renderReasonDetails = (type, details) => {
    if (!details) return null;

    switch (type) {
      case "tag_weakness":
        return (
          <div
            style={{
              fontSize: "13px",
              color: "rgba(255, 255, 255, 0.8)",
              lineHeight: "1.4",
            }}
          >
            <div style={{ marginBottom: "6px" }}>
              📊 <strong>Current Performance:</strong>{" "}
              {Math.round((details.currentAccuracy || 0) * 100)}% accuracy
            </div>
            <div style={{ marginBottom: "6px" }}>
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

      case "spaced_repetition":
        return (
          <div
            style={{
              fontSize: "13px",
              color: "rgba(255, 255, 255, 0.8)",
              lineHeight: "1.4",
            }}
          >
            <div style={{ marginBottom: "6px" }}>
              ⏰ <strong>Last Attempt:</strong> {details.daysSinceLastAttempt}{" "}
              days ago
            </div>
            <div style={{ marginBottom: "6px" }}>
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

      case "new_tag_introduction":
        return (
          <div
            style={{
              fontSize: "13px",
              color: "rgba(255, 255, 255, 0.8)",
              lineHeight: "1.4",
            }}
          >
            <div style={{ marginBottom: "6px" }}>
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

      case "difficulty_progression":
        return (
          <div
            style={{
              fontSize: "13px",
              color: "rgba(255, 255, 255, 0.8)",
              lineHeight: "1.4",
            }}
          >
            <div style={{ marginBottom: "6px" }}>
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

      case "performance_recovery":
        return (
          <div
            style={{
              fontSize: "13px",
              color: "rgba(255, 255, 255, 0.8)",
              lineHeight: "1.4",
            }}
          >
            <div style={{ marginBottom: "6px" }}>
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

      case "pattern_reinforcement":
        return (
          <div
            style={{
              fontSize: "13px",
              color: "rgba(255, 255, 255, 0.8)",
              lineHeight: "1.4",
            }}
          >
            <div style={{ marginBottom: "6px" }}>
              🎯 <strong>Reinforcing Pattern:</strong> {details.reinforcedTag}
            </div>
            <div>
              📊 <strong>Current Success Rate:</strong>{" "}
              {Math.round((details.successRate || 0) * 100)}%
            </div>
          </div>
        );

      case "new_problem":
        return (
          <div
            style={{
              fontSize: "13px",
              color: "rgba(255, 255, 255, 0.8)",
              lineHeight: "1.4",
            }}
          >
            <div style={{ marginBottom: "6px" }}>
              🆕 <strong>Problem Type:</strong> {details.difficulty} difficulty
            </div>
            {details.problemTags && details.problemTags.length > 0 && (
              <div>
                🏷️ <strong>Algorithm Tags:</strong>{" "}
                {details.problemTags.join(", ")}
              </div>
            )}
          </div>
        );

      case "review_problem":
        return (
          <div
            style={{
              fontSize: "13px",
              color: "rgba(255, 255, 255, 0.8)",
              lineHeight: "1.4",
            }}
          >
            <div style={{ marginBottom: "6px" }}>
              📚 <strong>Review Session:</strong> {details.totalAttempts}{" "}
              previous attempt(s)
            </div>
            {details.daysSinceLastAttempt > 0 && (
              <div>
                ⏰ <strong>Last Seen:</strong> {details.daysSinceLastAttempt}{" "}
                days ago
              </div>
            )}
          </div>
        );

      default:
        return (
          <div style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.8)" }}>
            🤖 Selected by adaptive learning algorithm based on your progress
            patterns.
          </div>
        );
    }
  };

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

  const reasonIcon = getReasonIcon(selectionReason.type);

  return (
    <div className={`problem-sidebar-section ${className}`}>
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

      {isExpanded && (
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
            {selectionReason.details &&
              renderReasonDetails(
                selectionReason.type,
                selectionReason.details
              )}

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

          {/* Similar Problems Section */}
          {currentProblemId && (
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

              {loadingSimilar && (
                <div style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.6)" }}>
                  Finding similar problems...
                </div>
              )}

              {!loadingSimilar && similarProblems.length > 0 && (
                <div style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.8)" }}>
                  {similarProblems.map((problem, index) => (
                    <div
                      key={problem.id || index}
                      style={{
                        padding: "6px 0",
                        borderBottom: index < similarProblems.length - 1 ? "1px solid rgba(255, 255, 255, 0.1)" : "none",
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
                            backgroundColor: problem.difficulty === 'Easy' ? '#10b981' : 
                                           problem.difficulty === 'Hard' ? '#ef4444' : '#f59e0b',
                            color: 'white',
                          }}
                        >
                          {problem.difficulty}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!loadingSimilar && similarProblems.length === 0 && currentProblemId && (
                <div style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.6)" }}>
                  No similar problems found yet. Keep practicing to build connections!
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Get learning tip based on reason type
 */
const getLearningTip = (reasonType) => {
  switch (reasonType) {
    case "tag_weakness":
      return "Focus on understanding the core concepts and patterns. Take your time to analyze the approach before coding.";
    case "spaced_repetition":
      return "Try to solve this from memory first. If stuck, review your previous approach and identify what you forgot.";
    case "new_tag_introduction":
      return "Take time to understand the new algorithmic concept. Look for patterns you can apply to similar problems.";
    case "difficulty_progression":
      return "This matches your current skill level. Use it to build confidence before tackling harder problems.";
    case "performance_recovery":
      return "Break down the problem step by step. Identify where you struggled before and plan your approach carefully.";
    case "pattern_reinforcement":
      return "Notice how this problem follows patterns you've succeeded with. Reinforce your understanding of these techniques.";
    case "review_problem":
      return "Test your retention. Try to recall your previous solution approach before looking at hints or your past code.";
    case "new_problem":
      return "Explore new patterns and techniques. Don't worry about optimal solutions on first attempt - focus on correctness.";
    default:
      return "Approach systematically: understand the problem, identify patterns, plan your solution, then implement.";
  }
};

export default WhyThisProblem;
