import React, { useState } from "react";

/**
 * ProblemInfoIcon Component
 * Simple info badge that displays alongside other badges (NEW, difficulty)
 * No hover behavior - just a visual indicator
 */
const ProblemInfoIcon = ({ className = "" }) => {
  return (
    <div
      className={className}
      style={{
        width: 12,
        height: 12,
        borderRadius: "50%",
        backgroundColor: "var(--cd-info-icon-bg, #3b82f6)",
        color: "white",
        fontSize: "8px",
        fontWeight: "bold",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "default",
        opacity: 0.9,
      }}
    >
      i
    </div>
  );
};

/**
 * ReasonTypeIcon Component
 * Shows different icons based on the reason type for visual variety
 */
export const ReasonTypeIcon = ({ reasonType, size = 14 }) => {
  const getIconAndColor = (type) => {
    switch (type) {
      case "tag_weakness":
        return { icon: "⚠", color: "#f59e0b" }; // Yellow for weakness
      case "spaced_repetition":
        return { icon: "🔄", color: "#3b82f6" }; // Blue for review
      case "new_tag_introduction":
        return { icon: "✨", color: "#10b981" }; // Green for new
      case "difficulty_progression":
        return { icon: "📈", color: "#8b5cf6" }; // Purple for progression
      case "performance_recovery":
        return { icon: "💪", color: "#ef4444" }; // Red for recovery
      case "pattern_reinforcement":
        return { icon: "🎯", color: "#06b6d4" }; // Cyan for reinforcement
      case "review_problem":
        return { icon: "📚", color: "#6b7280" }; // Gray for general review
      case "new_problem":
        return { icon: "🆕", color: "#10b981" }; // Green for new
      default:
        return { icon: "i", color: "var(--cd-link, #cbd5e1)" }; // Default info
    }
  };

  const { icon, color } = getIconAndColor(reasonType);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: color,
        color: "white",
        fontSize: Math.floor(size * 0.6),
        fontWeight: "bold",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "default",
      }}
    >
      {icon}
    </div>
  );
};

/**
 * Enhanced ProblemInfoIcon with reason type styling
 */
export const StyledProblemInfoIcon = ({
  selectionReason,
  showIcon = false,
  className = "",
}) => {
  const [hovered, setHovered] = useState(false);

  if (!selectionReason || !selectionReason.shortText) {
    return null;
  }

  return (
    <div
      style={{
        position: "relative",
        display: "inline-block",
        marginLeft: "4px",
      }}
      className={className}
    >
      {/* Icon based on reason type or default info icon */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          opacity: 0.8,
          transition: "opacity 0.2s ease, transform 0.2s ease",
          transform: hovered ? "scale(1.1)" : "scale(1)",
        }}
        onMouseOver={(e) => (e.currentTarget.style.opacity = "1")}
        onMouseOut={(e) => (e.currentTarget.style.opacity = "0.8")}
      >
        {showIcon ? (
          <ReasonTypeIcon reasonType={selectionReason.type} size={14} />
        ) : (
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              backgroundColor: "var(--cd-link, #cbd5e1)",
              color: "white",
              fontSize: "9px",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "default",
            }}
          >
            i
          </div>
        )}
      </div>

      {/* Enhanced tooltip */}
      <div
        style={{
          position: "absolute",
          bottom: "18px",
          left: "50%",
          transform: "translateX(-50%)",
          maxHeight: hovered ? "60px" : "0px",
          opacity: hovered ? 1 : 0,
          overflow: "hidden",
          transition: "all 0.3s ease",
          backgroundColor: "var(--cd-bg, #1a1a1a)",
          border: "1px solid var(--cd-border, #334155)",
          borderRadius: "6px",
          padding: hovered ? "8px 10px" : "0px 10px",
          fontSize: "11px",
          color: "var(--cd-text, #ffffff)",
          whiteSpace: "nowrap",
          zIndex: 1000,
          boxShadow: hovered ? "0 4px 12px rgba(0, 0, 0, 0.3)" : "none",
          minWidth: "120px",
          textAlign: "center",
          backdropFilter: "blur(8px)",
        }}
      >
        {selectionReason.shortText}
      </div>

      {/* Tooltip arrow */}
      {hovered && (
        <div
          style={{
            position: "absolute",
            bottom: "12px",
            left: "50%",
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "4px solid transparent",
            borderRight: "4px solid transparent",
            borderTop: "4px solid var(--cd-border, #334155)",
            zIndex: 999,
          }}
        />
      )}
    </div>
  );
};

export default ProblemInfoIcon;
