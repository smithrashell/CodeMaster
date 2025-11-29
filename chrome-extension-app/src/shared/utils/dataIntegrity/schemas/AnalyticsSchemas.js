/**
 * Analytics Store Schemas - Session Analytics, Strategy Data
 */

import { COMMON_TYPES } from "./CommonSchemaTypes.js";

export const SESSION_ANALYTICS_SCHEMA = {
  type: "object",
  required: ["session_id", "completed_at"],
  properties: {
    session_id: { type: "string", minLength: 1 },
    completed_at: COMMON_TYPES.timestamp,
    accuracy: COMMON_TYPES.successRate,
    avg_time: { type: "number", minimum: 0 },
    predominant_difficulty: COMMON_TYPES.difficulty,
    total_problems: { type: "integer", minimum: 0 },
    difficulty_mix: {
      type: "object",
      properties: {
        easy: { type: "number", minimum: 0, maximum: 100 },
        medium: { type: "number", minimum: 0, maximum: 100 },
        hard: { type: "number", minimum: 0, maximum: 100 },
      },
      additionalProperties: false,
    },
    new_masteries: { type: "integer", minimum: 0 },
    decayed_masteries: { type: "integer", minimum: 0 },
    mastery_deltas: {
      type: "array",
      items: {
        type: "object",
        required: ["tag", "delta"],
        properties: {
          tag: { type: "string", minLength: 1 },
          delta: { type: "number" },
        },
      },
    },
    strong_tags: { type: "array", items: { type: "string", minLength: 1 }, uniqueItems: true },
    weak_tags: { type: "array", items: { type: "string", minLength: 1 }, uniqueItems: true },
    timing_feedback: {
      type: "object",
      properties: {
        easy: { type: "string" },
        medium: { type: "string" },
        hard: { type: "string" },
      },
      additionalProperties: false,
    },
    insights: { type: "object", additionalProperties: true },
    difficulty_breakdown: {
      type: "object",
      properties: {
        easy: {
          type: "object",
          properties: {
            attempts: { type: "integer", minimum: 0 },
            correct: { type: "integer", minimum: 0 },
            time: { type: "number", minimum: 0 },
            avg_time: { type: "number", minimum: 0 },
          },
        },
        medium: {
          type: "object",
          properties: {
            attempts: { type: "integer", minimum: 0 },
            correct: { type: "integer", minimum: 0 },
            time: { type: "number", minimum: 0 },
            avg_time: { type: "number", minimum: 0 },
          },
        },
        hard: {
          type: "object",
          properties: {
            attempts: { type: "integer", minimum: 0 },
            correct: { type: "integer", minimum: 0 },
            time: { type: "number", minimum: 0 },
            avg_time: { type: "number", minimum: 0 },
          },
        },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
};

export const STRATEGY_DATA_SCHEMA = {
  type: "object",
  required: ["tag"],
  properties: {
    tag: { type: "string", minLength: 1 },
    strategies: {
      type: "array",
      items: {
        type: "object",
        required: ["title", "description"],
        properties: {
          title: { type: "string", minLength: 1 },
          description: { type: "string", minLength: 1 },
          timeComplexity: { type: "string" },
          spaceComplexity: { type: "string" },
          examples: { type: "array", items: { type: "string" } },
        },
      },
    },
    lastUpdated: COMMON_TYPES.timestamp,
  },
  additionalProperties: false,
};
