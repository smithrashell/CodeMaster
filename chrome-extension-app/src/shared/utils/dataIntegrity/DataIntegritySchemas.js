/**
 * Data Integrity Schemas for CodeMaster
 *
 * Defines JSON schemas for all IndexedDB stores to ensure data validity
 * and consistency across the application.
 */

export class DataIntegritySchemas {
  // Common data types for reuse
  static COMMON_TYPES = {
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

  // Problems store schema
  static PROBLEMS_SCHEMA = {
    type: "object",
    required: [
      "leetcode_id",
      "description",
      "difficulty",
      "box_level",
      "attempt_stats",
    ],
    properties: {
      leetcode_id: {
        type: "integer",
        minimum: 1,
      },
      description: {
        type: "string",
        minLength: 1,
      },
      difficulty: this.COMMON_TYPES.difficulty,
      box_level: this.COMMON_TYPES.boxLevel,
      tags: {
        type: "array",
        items: {
          type: "string",
          minLength: 1,
        },
        uniqueItems: true,
      },
      attempt_stats: {
        type: "object",
        required: ["total_attempts", "successful_attempts"],
        properties: {
          total_attempts: {
            type: "integer",
            minimum: 0,
          },
          successful_attempts: {
            type: "integer",
            minimum: 0,
          },
        },
        additionalProperties: false,
      },
      review_schedule: this.COMMON_TYPES.timestamp,
      last_attempt_date: this.COMMON_TYPES.timestamp,
      next_problem: {
        type: ["integer", "null"],
      },
      created_at: this.COMMON_TYPES.timestamp,
    },
    additionalProperties: false,
  };

  // Attempts store schema
  static ATTEMPTS_SCHEMA = {
    type: "object",
    required: ["id", "problem_id", "success", "attempt_date", "time_spent"],
    properties: {
      id: this.COMMON_TYPES.uuid,
      problem_id: {
        type: "integer",
        minimum: 1,
      },
      session_id: this.COMMON_TYPES.uuid,
      success: {
        type: "boolean",
      },
      attempt_date: this.COMMON_TYPES.timestamp,
      time_spent: {
        type: "integer",
        minimum: 0,
      },
      difficulty: this.COMMON_TYPES.difficulty,
      tags: {
        type: "array",
        items: {
          type: "string",
          minLength: 1,
        },
      },
      comments: {
        type: "string",
      },
    },
    additionalProperties: false,
  };

  // Sessions store schema
  static SESSIONS_SCHEMA = {
    type: "object",
    required: ["id", "date", "problems"],
    properties: {
      id: this.COMMON_TYPES.uuid,
      date: this.COMMON_TYPES.timestamp,
      problems: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "leetcode_id"],
          properties: {
            id: {
              type: "integer",
              minimum: 1,
            },
            leetcode_id: {
              type: "integer",
              minimum: 1,
            },
            selection_reason: {
              type: "string",
            },
          },
        },
      },
      attempts: {
        type: "array",
        items: {
          type: "object",
          required: ["attempt_id", "problem_id"],
          properties: {
            attempt_id: this.COMMON_TYPES.uuid,
            problem_id: {
              type: "integer",
              minimum: 1,
            },
            success: {
              type: "boolean",
            },
            time_spent: {
              type: "integer",
              minimum: 0,
            },
          },
        },
      },
      session_length: {
        type: "integer",
        minimum: 1,
        maximum: 20,
      },
      completed_at: this.COMMON_TYPES.timestamp,
      is_completed: {
        type: "boolean",
      },
    },
    additionalProperties: false,
  };

  // Tag Mastery store schema
  static TAG_MASTERY_SCHEMA = {
    type: "object",
    required: ["tag"],
    properties: {
      tag: {
        type: "string",
        minLength: 1,
      },
      strength: {
        type: "number",
        minimum: 0,
      },
      decayScore: {
        type: "number",
        minimum: 0,
        maximum: 1,
      },
      coreLadder: {
        type: "array",
        items: {
          type: "object",
          properties: {
            difficulty: this.COMMON_TYPES.difficulty,
            completed: {
              type: "boolean",
            },
          },
        },
      },
      totalAttempts: {
        type: "integer",
        minimum: 0,
      },
      successfulAttempts: {
        type: "integer",
        minimum: 0,
      },
      successRate: this.COMMON_TYPES.successRate,
      lastAttemptDate: this.COMMON_TYPES.timestamp,
      mastery: {
        type: "number",
        minimum: 0,
        maximum: 1,
      },
    },
    additionalProperties: false,
  };

  // Standard Problems store schema
  static STANDARD_PROBLEMS_SCHEMA = {
    type: "object",
    required: ["id", "title", "slug", "difficulty"],
    properties: {
      id: {
        type: "integer",
        minimum: 1,
      },
      title: {
        type: "string",
        minLength: 1,
      },
      slug: {
        type: "string",
        minLength: 1,
        pattern: "^[a-z0-9-]+$",
      },
      difficulty: this.COMMON_TYPES.difficulty,
      tags: {
        type: "array",
        items: {
          type: "string",
          minLength: 1,
        },
        uniqueItems: true,
      },
      isPremium: {
        type: "boolean",
      },
      acRate: {
        type: "number",
        minimum: 0,
        maximum: 100,
      },
      frequency: {
        type: "number",
        minimum: 0,
      },
    },
    additionalProperties: false,
  };

  // Settings store schema
  static SETTINGS_SCHEMA = {
    type: "object",
    required: ["id", "data"],
    properties: {
      id: {
        type: "string",
        minLength: 1,
      },
      data: {
        type: "object",
        properties: {
          theme: {
            type: "string",
            enum: ["light", "dark", "auto"],
          },
          sessionLength: {
            type: "integer",
            minimum: 1,
            maximum: 20,
          },
          limit: {
            type: "string",
            enum: ["off", "daily", "weekly"],
          },
          reminder: {
            type: "object",
            properties: {
              value: {
                type: "boolean",
              },
              label: {
                type: "string",
              },
            },
          },
          numberofNewProblemsPerSession: {
            type: "integer",
            minimum: 0,
            maximum: 10,
          },
          adaptive: {
            type: "boolean",
          },
        },
        additionalProperties: false,
      },
      lastUpdated: this.COMMON_TYPES.timestamp,
      source: {
        type: "string",
      },
    },
    additionalProperties: false,
  };

  // Session State store schema
  static SESSION_STATE_SCHEMA = {
    type: "object",
    required: ["id"],
    properties: {
      id: {
        type: "string",
        minLength: 1,
      },
      currentSession: {
        oneOf: [
          { type: "null" },
          {
            type: "object",
            required: ["id", "Date", "problems"],
            properties: {
              id: this.COMMON_TYPES.uuid,
              Date: this.COMMON_TYPES.timestamp,
              problems: {
                type: "array",
              },
            },
          },
        ],
      },
      sessionInProgress: {
        type: "boolean",
      },
      lastActiveDate: this.COMMON_TYPES.timestamp,
    },
    additionalProperties: false,
  };

  // Problem Relationships store schema
  static PROBLEM_RELATIONSHIPS_SCHEMA = {
    type: "object",
    required: ["id", "problem_id1", "problem_id2", "relationshipType"],
    properties: {
      id: {
        type: "integer",
        minimum: 1,
      },
      problem_id1: {
        type: "integer",
        minimum: 1,
      },
      problem_id2: {
        type: "integer",
        minimum: 1,
      },
      relationshipType: {
        type: "string",
        enum: ["similar", "prerequisite", "followup", "variation"],
      },
      strength: {
        type: "number",
        minimum: 0,
        maximum: 1,
      },
      createdAt: this.COMMON_TYPES.timestamp,
    },
    additionalProperties: false,
  };

  // Tag Relationships store schema
  static TAG_RELATIONSHIPS_SCHEMA = {
    type: "object",
    required: ["id", "classification", "related_tags", "difficulty_distribution"],
    properties: {
      id: {
        type: "string",
        minLength: 1,
      },
      classification: {
        type: "string",
        enum: [
          "Core Concept",
          "Fundamental Technique",
          "Advanced Technique",
        ],
      },
      related_tags: {
        type: "array",
        items: {
          type: "object",
          required: ["tag", "strength"],
          properties: {
            tag: {
              type: "string",
              minLength: 1,
            },
            strength: {
              type: "number",
              minimum: 0,
              maximum: 1,
            },
          },
          additionalProperties: false,
        },
      },
      difficulty_distribution: {
        type: "object",
        required: ["easy", "medium", "hard"],
        properties: {
          easy: {
            type: "integer",
            minimum: 0,
          },
          medium: {
            type: "integer",
            minimum: 0,
          },
          hard: {
            type: "integer",
            minimum: 0,
          },
        },
        additionalProperties: false,
      },
      learning_order: {
        type: "integer",
        minimum: 1,
      },
      prerequisite_tags: {
        type: "array",
        items: {
          type: "string",
          minLength: 1,
        },
        uniqueItems: true,
      },
      mastery_threshold: {
        type: "number",
        minimum: 0,
        maximum: 1,
      },
    },
    additionalProperties: false,
  };

  // Pattern Ladders store schema
  static PATTERN_LADDERS_SCHEMA = {
    type: "object",
    required: ["tag", "problems"],
    properties: {
      tag: {
        type: "string",
        minLength: 1,
      },
      last_updated: this.COMMON_TYPES.timestamp,
      problems: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "title", "difficulty", "tags"],
          properties: {
            id: {
              type: "integer",
              minimum: 1,
            },
            title: {
              type: "string",
              minLength: 1,
            },
            difficulty: this.COMMON_TYPES.difficulty,
            tags: {
              type: "array",
              items: {
                type: "string",
                minLength: 1,
              },
              minItems: 1,
            },
          },
          additionalProperties: false,
        },
      },
    },
    additionalProperties: false,
  };

  // Session Analytics store schema
  static SESSION_ANALYTICS_SCHEMA = {
    type: "object",
    required: ["session_id", "completed_at"],
    properties: {
      session_id: {
        type: "string",
        minLength: 1,
      },
      completed_at: this.COMMON_TYPES.timestamp,
      accuracy: this.COMMON_TYPES.successRate,
      avg_time: {
        type: "number",
        minimum: 0,
      },
      predominant_difficulty: this.COMMON_TYPES.difficulty,
      total_problems: {
        type: "integer",
        minimum: 0,
      },
      difficulty_mix: {
        type: "object",
        properties: {
          easy: { type: "number", minimum: 0, maximum: 100 },
          medium: { type: "number", minimum: 0, maximum: 100 },
          hard: { type: "number", minimum: 0, maximum: 100 },
        },
        additionalProperties: false,
      },
      new_masteries: {
        type: "integer",
        minimum: 0,
      },
      decayed_masteries: {
        type: "integer",
        minimum: 0,
      },
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
      strong_tags: {
        type: "array",
        items: { type: "string", minLength: 1 },
        uniqueItems: true,
      },
      weak_tags: {
        type: "array",
        items: { type: "string", minLength: 1 },
        uniqueItems: true,
      },
      timing_feedback: {
        type: "object",
        properties: {
          easy: { type: "string" },
          medium: { type: "string" },
          hard: { type: "string" },
        },
        additionalProperties: false,
      },
      insights: {
        type: "object",
        additionalProperties: true,
      },
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

  // Strategy Data store schema
  static STRATEGY_DATA_SCHEMA = {
    type: "object",
    required: ["tag"],
    properties: {
      tag: {
        type: "string",
        minLength: 1,
      },
      strategies: {
        type: "array",
        items: {
          type: "object",
          required: ["title", "description"],
          properties: {
            title: {
              type: "string",
              minLength: 1,
            },
            description: {
              type: "string",
              minLength: 1,
            },
            timeComplexity: {
              type: "string",
            },
            spaceComplexity: {
              type: "string",
            },
            examples: {
              type: "array",
              items: {
                type: "string",
              },
            },
          },
        },
      },
      lastUpdated: this.COMMON_TYPES.timestamp,
    },
    additionalProperties: false,
  };

  // Limits store schema
  static LIMITS_SCHEMA = {
    type: "object",
    required: ["id", "createAt"],
    properties: {
      id: {
        type: "integer",
        minimum: 1,
      },
      createAt: this.COMMON_TYPES.timestamp,
      limitType: {
        type: "string",
        enum: ["daily", "weekly", "session"],
      },
      limitValue: {
        type: "integer",
        minimum: 0,
      },
      currentUsage: {
        type: "integer",
        minimum: 0,
      },
      resetDate: this.COMMON_TYPES.timestamp,
    },
    additionalProperties: false,
  };

  // Backup Storage store schema
  static BACKUP_STORAGE_SCHEMA = {
    type: "object",
    required: ["backupId"],
    properties: {
      backupId: {
        type: "string",
        minLength: 1,
      },
      backupData: {
        type: "object",
      },
      createdAt: this.COMMON_TYPES.timestamp,
      backupType: {
        type: "string",
        enum: ["manual", "automatic", "migration"],
      },
      description: {
        type: "string",
      },
      size: {
        type: "integer",
        minimum: 0,
      },
    },
    additionalProperties: false,
  };

  // Store name to schema mapping
  static STORE_SCHEMAS = {
    problems: this.PROBLEMS_SCHEMA,
    attempts: this.ATTEMPTS_SCHEMA,
    sessions: this.SESSIONS_SCHEMA,
    tag_mastery: this.TAG_MASTERY_SCHEMA,
    standard_problems: this.STANDARD_PROBLEMS_SCHEMA,
    settings: this.SETTINGS_SCHEMA,
    session_state: this.SESSION_STATE_SCHEMA,
    problem_relationships: this.PROBLEM_RELATIONSHIPS_SCHEMA,
    tag_relationships: this.TAG_RELATIONSHIPS_SCHEMA,
    pattern_ladders: this.PATTERN_LADDERS_SCHEMA,
    session_analytics: this.SESSION_ANALYTICS_SCHEMA,
    strategy_data: this.STRATEGY_DATA_SCHEMA,
    limits: this.LIMITS_SCHEMA,
    backup_storage: this.BACKUP_STORAGE_SCHEMA,
  };

  // Referential integrity constraints
  static REFERENTIAL_CONSTRAINTS = {
    attempts: [
      {
        field: "problem_id",
        references: {
          store: "problems",
          field: "leetcode_id",
        },
        required: true,
      },
      {
        field: "session_id",
        references: {
          store: "sessions",
          field: "id",
        },
        required: false,
      },
    ],
    sessions: [
      {
        field: "problems.leetcode_id",
        references: {
          store: "problems",
          field: "leetcode_id",
        },
        required: true,
      },
      {
        field: "attempts.attempt_id",
        references: {
          store: "attempts",
          field: "id",
        },
        required: false,
      },
    ],
    problem_relationships: [
      {
        field: "problem_id1",
        references: {
          store: "problems",
          field: "leetcode_id",
        },
        required: true,
      },
      {
        field: "problem_id2",
        references: {
          store: "problems",
          field: "leetcode_id",
        },
        required: true,
      },
    ],
    session_analytics: [
      {
        field: "session_id",
        references: {
          store: "sessions",
          field: "id",
        },
        required: true,
      },
    ],
  };

  /**
   * Get schema for a specific store
   * @param {string} storeName - Name of the IndexedDB store
   * @returns {Object|null} - JSON schema object or null if not found
   */
  static getStoreSchema(storeName) {
    return this.STORE_SCHEMAS[storeName] || null;
  }

  /**
   * Get all store schemas
   * @returns {Object} - Object with store names as keys and schemas as values
   */
  static getAllSchemas() {
    return { ...this.STORE_SCHEMAS };
  }

  /**
   * Get referential constraints for a store
   * @param {string} storeName - Name of the IndexedDB store
   * @returns {Array} - Array of constraint objects
   */
  static getReferentialConstraints(storeName) {
    return this.REFERENTIAL_CONSTRAINTS[storeName] || [];
  }

  /**
   * Get all referential constraints
   * @returns {Object} - Object with store names as keys and constraints as values
   */
  static getAllReferentialConstraints() {
    return { ...this.REFERENTIAL_CONSTRAINTS };
  }

  /**
   * Validate if a store name is supported
   * @param {string} storeName - Name of the IndexedDB store
   * @returns {boolean} - True if store is supported
   */
  static isValidStoreName(storeName) {
    return storeName in this.STORE_SCHEMAS;
  }

  /**
   * Get list of all supported store names
   * @returns {Array<string>} - Array of store names
   */
  static getStoreNames() {
    return Object.keys(this.STORE_SCHEMAS);
  }
}

export default DataIntegritySchemas;
