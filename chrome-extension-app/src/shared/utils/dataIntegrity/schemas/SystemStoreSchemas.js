/**
 * System Store Schemas - Settings, Session State, Limits, Backup
 */

import { COMMON_TYPES } from "./CommonSchemaTypes.js";

export const SETTINGS_SCHEMA = {
  type: "object",
  required: ["id", "data"],
  properties: {
    id: { type: "string", minLength: 1 },
    data: {
      type: "object",
      properties: {
        theme: { type: "string", enum: ["light", "dark", "auto"] },
        sessionLength: { type: "integer", minimum: 1, maximum: 20 },
        limit: { type: "string", enum: ["off", "daily", "weekly"] },
        reminder: {
          type: "object",
          properties: {
            value: { type: "boolean" },
            label: { type: "string" },
          },
        },
        numberofNewProblemsPerSession: { type: "integer", minimum: 0, maximum: 10 },
        adaptive: { type: "boolean" },
      },
      additionalProperties: false,
    },
    lastUpdated: COMMON_TYPES.timestamp,
    source: { type: "string" },
  },
  additionalProperties: false,
};

export const SESSION_STATE_SCHEMA = {
  type: "object",
  required: ["id"],
  properties: {
    id: { type: "string", minLength: 1 },
    currentSession: {
      oneOf: [
        { type: "null" },
        {
          type: "object",
          required: ["id", "Date", "problems"],
          properties: {
            id: COMMON_TYPES.uuid,
            Date: COMMON_TYPES.timestamp,
            problems: { type: "array" },
          },
        },
      ],
    },
    sessionInProgress: { type: "boolean" },
    lastActiveDate: COMMON_TYPES.timestamp,
  },
  additionalProperties: false,
};

export const LIMITS_SCHEMA = {
  type: "object",
  required: ["id", "createAt"],
  properties: {
    id: { type: "integer", minimum: 1 },
    createAt: COMMON_TYPES.timestamp,
    limitType: { type: "string", enum: ["daily", "weekly", "session"] },
    limitValue: { type: "integer", minimum: 0 },
    currentUsage: { type: "integer", minimum: 0 },
    resetDate: COMMON_TYPES.timestamp,
  },
  additionalProperties: false,
};

export const BACKUP_STORAGE_SCHEMA = {
  type: "object",
  required: ["backupId"],
  properties: {
    backupId: { type: "string", minLength: 1 },
    backupData: { type: "object" },
    createdAt: COMMON_TYPES.timestamp,
    backupType: { type: "string", enum: ["manual", "automatic", "migration"] },
    description: { type: "string" },
    size: { type: "integer", minimum: 0 },
  },
  additionalProperties: false,
};
