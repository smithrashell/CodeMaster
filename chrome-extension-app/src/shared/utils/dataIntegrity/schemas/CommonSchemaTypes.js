/**
 * Common Data Types for Data Integrity Schemas
 */

export const COMMON_TYPES = {
  uuid: {
    type: "string",
    pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
  },
  timestamp: {
    type: "string",
    format: "date-time",
  },
  date: {
    type: "string",
    pattern: "^\\d{4}-\\d{2}-\\d{2}$",
  },
  difficulty: {
    type: "string",
    enum: ["Easy", "Medium", "Hard"],
  },
  boxLevel: {
    type: "integer",
    minimum: 0,
    maximum: 7,
  },
  successRate: {
    type: "number",
    minimum: 0,
    maximum: 1,
  },
};
