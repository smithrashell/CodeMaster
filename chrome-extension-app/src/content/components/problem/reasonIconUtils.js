import { BrainIcon } from "../../../shared/components/ui/Icons";

/**
 * Get appropriate icon and color for reason type
 */
export const getReasonIcon = (type) => {
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