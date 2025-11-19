/**
 * Constants for Learning Efficiency Analytics
 *
 * Extracted from LearningEfficiencyAnalytics component to reduce complexity
 */

export const METRICS_EXPLANATION = [
  {
    title: "Learning Efficiency",
    description: "Scores 0-100 based on accuracy and speed",
    ranges: [
      { range: "0-30:", meaning: "building fundamentals" },
      { range: "30-60:", meaning: "developing skills" },
      { range: "60+:", meaning: "strong performance" }
    ],
    color: "var(--cm-chart-primary)",
    backgroundColor: "rgba(59, 130, 246, 0.1)"
  },
  {
    title: "Knowledge Retention",
    description: "Scores 0-100 on review problem success",
    ranges: [
      { range: "0-30:", meaning: "needs more practice" },
      { range: "30-60:", meaning: "improving recall" },
      { range: "60+:", meaning: "solid retention" }
    ],
    color: "var(--cm-chart-success)",
    backgroundColor: "rgba(16, 185, 129, 0.1)"
  },
  {
    title: "Learning Momentum",
    description: "Scores 0-100 tracking consistency",
    ranges: [
      { range: "0-30:", meaning: "getting started" },
      { range: "30-60:", meaning: "building habits" },
      { range: "60+:", meaning: "strong momentum" }
    ],
    color: "var(--cm-chart-warning)",
    backgroundColor: "rgba(245, 158, 11, 0.1)"
  }
];
