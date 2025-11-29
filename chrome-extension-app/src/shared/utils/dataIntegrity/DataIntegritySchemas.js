/**
 * Data Integrity Schemas for CodeMaster
 *
 * Defines JSON schemas for all IndexedDB stores to ensure data validity
 * and consistency across the application.
 */

import { COMMON_TYPES } from "./schemas/CommonSchemaTypes.js";
import {
  PROBLEMS_SCHEMA,
  ATTEMPTS_SCHEMA,
  SESSIONS_SCHEMA,
  TAG_MASTERY_SCHEMA,
  STANDARD_PROBLEMS_SCHEMA,
} from "./schemas/CoreStoreSchemas.js";
import {
  SETTINGS_SCHEMA,
  SESSION_STATE_SCHEMA,
  LIMITS_SCHEMA,
  BACKUP_STORAGE_SCHEMA,
} from "./schemas/SystemStoreSchemas.js";
import {
  PROBLEM_RELATIONSHIPS_SCHEMA,
  TAG_RELATIONSHIPS_SCHEMA,
  PATTERN_LADDERS_SCHEMA,
} from "./schemas/RelationshipSchemas.js";
import {
  SESSION_ANALYTICS_SCHEMA,
  STRATEGY_DATA_SCHEMA,
} from "./schemas/AnalyticsSchemas.js";
import { REFERENTIAL_CONSTRAINTS } from "./schemas/ReferentialConstraints.js";

export class DataIntegritySchemas {
  static COMMON_TYPES = COMMON_TYPES;
  static PROBLEMS_SCHEMA = PROBLEMS_SCHEMA;
  static ATTEMPTS_SCHEMA = ATTEMPTS_SCHEMA;
  static SESSIONS_SCHEMA = SESSIONS_SCHEMA;
  static TAG_MASTERY_SCHEMA = TAG_MASTERY_SCHEMA;
  static STANDARD_PROBLEMS_SCHEMA = STANDARD_PROBLEMS_SCHEMA;
  static SETTINGS_SCHEMA = SETTINGS_SCHEMA;
  static SESSION_STATE_SCHEMA = SESSION_STATE_SCHEMA;
  static PROBLEM_RELATIONSHIPS_SCHEMA = PROBLEM_RELATIONSHIPS_SCHEMA;
  static TAG_RELATIONSHIPS_SCHEMA = TAG_RELATIONSHIPS_SCHEMA;
  static PATTERN_LADDERS_SCHEMA = PATTERN_LADDERS_SCHEMA;
  static SESSION_ANALYTICS_SCHEMA = SESSION_ANALYTICS_SCHEMA;
  static STRATEGY_DATA_SCHEMA = STRATEGY_DATA_SCHEMA;
  static LIMITS_SCHEMA = LIMITS_SCHEMA;
  static BACKUP_STORAGE_SCHEMA = BACKUP_STORAGE_SCHEMA;

  static STORE_SCHEMAS = {
    problems: PROBLEMS_SCHEMA,
    attempts: ATTEMPTS_SCHEMA,
    sessions: SESSIONS_SCHEMA,
    tag_mastery: TAG_MASTERY_SCHEMA,
    standard_problems: STANDARD_PROBLEMS_SCHEMA,
    settings: SETTINGS_SCHEMA,
    session_state: SESSION_STATE_SCHEMA,
    problem_relationships: PROBLEM_RELATIONSHIPS_SCHEMA,
    tag_relationships: TAG_RELATIONSHIPS_SCHEMA,
    pattern_ladders: PATTERN_LADDERS_SCHEMA,
    session_analytics: SESSION_ANALYTICS_SCHEMA,
    strategy_data: STRATEGY_DATA_SCHEMA,
    limits: LIMITS_SCHEMA,
    backup_storage: BACKUP_STORAGE_SCHEMA,
  };

  static REFERENTIAL_CONSTRAINTS = REFERENTIAL_CONSTRAINTS;

  static getStoreSchema(storeName) {
    return this.STORE_SCHEMAS[storeName] || null;
  }

  static getAllSchemas() {
    return { ...this.STORE_SCHEMAS };
  }

  static getReferentialConstraints(storeName) {
    return this.REFERENTIAL_CONSTRAINTS[storeName] || [];
  }

  static getAllReferentialConstraints() {
    return { ...this.REFERENTIAL_CONSTRAINTS };
  }

  static isValidStoreName(storeName) {
    return storeName in this.STORE_SCHEMAS;
  }

  static getStoreNames() {
    return Object.keys(this.STORE_SCHEMAS);
  }
}

export default DataIntegritySchemas;
