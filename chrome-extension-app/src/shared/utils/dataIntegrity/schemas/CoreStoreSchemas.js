/**
 * Core Store Schemas - Problems, Attempts, Sessions, Tag Mastery
 */

import { COMMON_TYPES } from "./CommonSchemaTypes.js";

export const PROBLEMS_SCHEMA = {
  type: "object",
  required: ["leetcode_id", "description", "difficulty", "box_level", "attempt_stats"],
  properties: {
    leetcode_id: { type: "integer", minimum: 1 },
    description: { type: "string", minLength: 1 },
    difficulty: COMMON_TYPES.difficulty,
    box_level: COMMON_TYPES.boxLevel,
    tags: { type: "array", items: { type: "string", minLength: 1 }, uniqueItems: true },
    attempt_stats: {
      type: "object",
      required: ["total_attempts", "successful_attempts"],
      properties: {
        total_attempts: { type: "integer", minimum: 0 },
        successful_attempts: { type: "integer", minimum: 0 },
      },
      additionalProperties: false,
    },
    review_schedule: COMMON_TYPES.timestamp,
    last_attempt_date: COMMON_TYPES.timestamp,
    next_problem: { type: ["integer", "null"] },
    created_at: COMMON_TYPES.timestamp,
  },
  additionalProperties: false,
};

export const ATTEMPTS_SCHEMA = {
  type: "object",
  required: ["id", "problem_id", "success", "attempt_date", "time_spent"],
  properties: {
    id: COMMON_TYPES.uuid,
    problem_id: { type: "integer", minimum: 1 },
    session_id: COMMON_TYPES.uuid,
    success: { type: "boolean" },
    attempt_date: COMMON_TYPES.timestamp,
    time_spent: { type: "integer", minimum: 0 },
    difficulty: COMMON_TYPES.difficulty,
    tags: { type: "array", items: { type: "string", minLength: 1 } },
    comments: { type: "string" },
  },
  additionalProperties: false,
};

export const SESSIONS_SCHEMA = {
  type: "object",
  required: ["id", "date", "problems"],
  properties: {
    id: COMMON_TYPES.uuid,
    date: COMMON_TYPES.timestamp,
    problems: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "leetcode_id"],
        properties: {
          id: { type: "integer", minimum: 1 },
          leetcode_id: { type: "integer", minimum: 1 },
          selection_reason: { type: "string" },
        },
      },
    },
    attempts: {
      type: "array",
      items: {
        type: "object",
        required: ["attempt_id", "problem_id"],
        properties: {
          attempt_id: COMMON_TYPES.uuid,
          problem_id: { type: "integer", minimum: 1 },
          success: { type: "boolean" },
          time_spent: { type: "integer", minimum: 0 },
        },
      },
    },
    session_length: { type: "integer", minimum: 1, maximum: 20 },
    completed_at: COMMON_TYPES.timestamp,
    is_completed: { type: "boolean" },
  },
  additionalProperties: false,
};

export const TAG_MASTERY_SCHEMA = {
  type: "object",
  required: ["tag"],
  properties: {
    tag: { type: "string", minLength: 1 },
    strength: { type: "number", minimum: 0 },
    decayScore: { type: "number", minimum: 0, maximum: 1 },
    totalAttempts: { type: "integer", minimum: 0 },
    successfulAttempts: { type: "integer", minimum: 0 },
    successRate: COMMON_TYPES.successRate,
    lastAttemptDate: COMMON_TYPES.timestamp,
    mastery: { type: "number", minimum: 0, maximum: 1 },
  },
  additionalProperties: false,
};

export const STANDARD_PROBLEMS_SCHEMA = {
  type: "object",
  required: ["id", "title", "slug", "difficulty"],
  properties: {
    id: { type: "integer", minimum: 1 },
    title: { type: "string", minLength: 1 },
    slug: { type: "string", minLength: 1, pattern: "^[a-z0-9-]+$" },
    difficulty: COMMON_TYPES.difficulty,
    tags: { type: "array", items: { type: "string", minLength: 1 }, uniqueItems: true },
    isPremium: { type: "boolean" },
    acRate: { type: "number", minimum: 0, maximum: 100 },
    frequency: { type: "number", minimum: 0 },
  },
  additionalProperties: false,
};
