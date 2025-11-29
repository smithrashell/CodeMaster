/**
 * Referential Integrity Constraints for Data Integrity
 */

export const REFERENTIAL_CONSTRAINTS = {
  attempts: [
    {
      field: "problem_id",
      references: { store: "problems", field: "leetcode_id" },
      required: true,
    },
    {
      field: "session_id",
      references: { store: "sessions", field: "id" },
      required: false,
    },
  ],
  sessions: [
    {
      field: "problems.leetcode_id",
      references: { store: "problems", field: "leetcode_id" },
      required: true,
    },
    {
      field: "attempts.attempt_id",
      references: { store: "attempts", field: "id" },
      required: false,
    },
  ],
  problem_relationships: [
    {
      field: "problem_id1",
      references: { store: "problems", field: "leetcode_id" },
      required: true,
    },
    {
      field: "problem_id2",
      references: { store: "problems", field: "leetcode_id" },
      required: true,
    },
  ],
  session_analytics: [
    {
      field: "session_id",
      references: { store: "sessions", field: "id" },
      required: true,
    },
  ],
};
