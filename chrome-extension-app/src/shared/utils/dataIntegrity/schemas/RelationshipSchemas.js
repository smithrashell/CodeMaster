/**
 * Relationship Store Schemas - Problem and Tag Relationships
 */

import { COMMON_TYPES } from "./CommonSchemaTypes.js";

export const PROBLEM_RELATIONSHIPS_SCHEMA = {
  type: "object",
  required: ["id", "problem_id1", "problem_id2", "relationshipType"],
  properties: {
    id: { type: "integer", minimum: 1 },
    problem_id1: { type: "integer", minimum: 1 },
    problem_id2: { type: "integer", minimum: 1 },
    relationshipType: { type: "string", enum: ["similar", "prerequisite", "followup", "variation"] },
    strength: { type: "number", minimum: 0, maximum: 1 },
    createdAt: COMMON_TYPES.timestamp,
  },
  additionalProperties: false,
};

export const TAG_RELATIONSHIPS_SCHEMA = {
  type: "object",
  required: ["id", "classification", "related_tags", "difficulty_distribution"],
  properties: {
    id: { type: "string", minLength: 1 },
    classification: { type: "string", enum: ["Core Concept", "Fundamental Technique", "Advanced Technique"] },
    related_tags: {
      type: "array",
      items: {
        type: "object",
        required: ["tag", "strength"],
        properties: {
          tag: { type: "string", minLength: 1 },
          strength: { type: "number", minimum: 0, maximum: 1 },
        },
        additionalProperties: false,
      },
    },
    difficulty_distribution: {
      type: "object",
      required: ["easy", "medium", "hard"],
      properties: {
        easy: { type: "integer", minimum: 0 },
        medium: { type: "integer", minimum: 0 },
        hard: { type: "integer", minimum: 0 },
      },
      additionalProperties: false,
    },
    learning_order: { type: "integer", minimum: 1 },
    prerequisite_tags: { type: "array", items: { type: "string", minLength: 1 }, uniqueItems: true },
    mastery_threshold: { type: "number", minimum: 0, maximum: 1 },
  },
  additionalProperties: false,
};

export const PATTERN_LADDERS_SCHEMA = {
  type: "object",
  required: ["tag", "problems"],
  properties: {
    tag: { type: "string", minLength: 1 },
    last_updated: COMMON_TYPES.timestamp,
    problems: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "title", "difficulty", "tags"],
        properties: {
          id: { type: "integer", minimum: 1 },
          title: { type: "string", minLength: 1 },
          difficulty: COMMON_TYPES.difficulty,
          tags: { type: "array", items: { type: "string", minLength: 1 }, minItems: 1 },
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
};
