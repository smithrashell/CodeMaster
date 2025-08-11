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
      "leetCodeID",
      "ProblemDescription",
      "Difficulty",
      "BoxLevel",
      "AttemptStats",
    ],
    properties: {
      leetCodeID: {
        type: "integer",
        minimum: 1,
      },
      ProblemDescription: {
        type: "string",
        minLength: 1,
      },
      Difficulty: this.COMMON_TYPES.difficulty,
      BoxLevel: this.COMMON_TYPES.boxLevel,
      Tags: {
        type: "array",
        items: {
          type: "string",
          minLength: 1,
        },
        uniqueItems: true,
      },
      AttemptStats: {
        type: "object",
        required: ["TotalAttempts", "SuccessfulAttempts"],
        properties: {
          TotalAttempts: {
            type: "integer",
            minimum: 0,
          },
          SuccessfulAttempts: {
            type: "integer",
            minimum: 0,
          },
        },
        additionalProperties: false,
      },
      ReviewSchedule: this.COMMON_TYPES.timestamp,
      lastAttemptDate: this.COMMON_TYPES.timestamp,
      NextProblem: {
        type: ["integer", "null"],
      },
      CreatedAt: this.COMMON_TYPES.timestamp,
    },
    additionalProperties: false,
  };

  // Attempts store schema
  static ATTEMPTS_SCHEMA = {
    type: "object",
    required: ["id", "problemId", "success", "date", "timeSpent"],
    properties: {
      id: this.COMMON_TYPES.uuid,
      problemId: {
        type: "integer",
        minimum: 1,
      },
      sessionId: this.COMMON_TYPES.uuid,
      success: {
        type: "boolean",
      },
      date: this.COMMON_TYPES.timestamp,
      timeSpent: {
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
    required: ["id", "Date", "problems"],
    properties: {
      id: this.COMMON_TYPES.uuid,
      Date: this.COMMON_TYPES.timestamp,
      problems: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "leetCodeID"],
          properties: {
            id: {
              type: "integer",
              minimum: 1,
            },
            leetCodeID: {
              type: "integer",
              minimum: 1,
            },
            selectionReason: {
              type: "string",
            },
          },
        },
      },
      attempts: {
        type: "array",
        items: {
          type: "object",
          required: ["attemptId", "problemId"],
          properties: {
            attemptId: this.COMMON_TYPES.uuid,
            problemId: {
              type: "integer",
              minimum: 1,
            },
            success: {
              type: "boolean",
            },
            timeSpent: {
              type: "integer",
              minimum: 0,
            },
          },
        },
      },
      sessionLength: {
        type: "integer",
        minimum: 1,
        maximum: 20,
      },
      completedAt: this.COMMON_TYPES.timestamp,
      isCompleted: {
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
    required: ["id", "problemId1", "problemId2", "relationshipType"],
    properties: {
      id: {
        type: "integer",
        minimum: 1,
      },
      problemId1: {
        type: "integer",
        minimum: 1,
      },
      problemId2: {
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
    required: ["id", "classification"],
    properties: {
      id: {
        type: "string",
        minLength: 1,
      },
      classification: {
        type: "string",
        enum: [
          "pattern",
          "algorithm",
          "data_structure",
          "technique",
          "concept",
        ],
      },
      parentTag: {
        type: "string",
      },
      relatedTags: {
        type: "array",
        items: {
          type: "string",
          minLength: 1,
        },
        uniqueItems: true,
      },
      prerequisites: {
        type: "array",
        items: {
          type: "string",
          minLength: 1,
        },
        uniqueItems: true,
      },
      difficulty: this.COMMON_TYPES.difficulty,
    },
    additionalProperties: false,
  };

  // Pattern Ladders store schema
  static PATTERN_LADDERS_SCHEMA = {
    type: "object",
    required: ["tag"],
    properties: {
      tag: {
        type: "string",
        minLength: 1,
      },
      ladder: {
        type: "array",
        items: {
          type: "object",
          required: ["problemId", "difficulty", "order"],
          properties: {
            problemId: {
              type: "integer",
              minimum: 1,
            },
            difficulty: this.COMMON_TYPES.difficulty,
            order: {
              type: "integer",
              minimum: 0,
            },
            isCompleted: {
              type: "boolean",
            },
            attempts: {
              type: "integer",
              minimum: 0,
            },
          },
        },
      },
      progress: {
        type: "object",
        properties: {
          completed: {
            type: "integer",
            minimum: 0,
          },
          total: {
            type: "integer",
            minimum: 0,
          },
          percentage: this.COMMON_TYPES.successRate,
        },
      },
      lastUpdated: this.COMMON_TYPES.timestamp,
    },
    additionalProperties: false,
  };

  // Session Analytics store schema
  static SESSION_ANALYTICS_SCHEMA = {
    type: "object",
    required: ["sessionId"],
    properties: {
      sessionId: this.COMMON_TYPES.uuid,
      completedAt: this.COMMON_TYPES.timestamp,
      totalProblems: {
        type: "integer",
        minimum: 0,
      },
      totalAttempts: {
        type: "integer",
        minimum: 0,
      },
      successfulAttempts: {
        type: "integer",
        minimum: 0,
      },
      accuracy: this.COMMON_TYPES.successRate,
      averageTimePerProblem: {
        type: "number",
        minimum: 0,
      },
      totalTimeSpent: {
        type: "integer",
        minimum: 0,
      },
      predominantDifficulty: this.COMMON_TYPES.difficulty,
      tagsWorkedOn: {
        type: "array",
        items: {
          type: "string",
          minLength: 1,
        },
        uniqueItems: true,
      },
      improvementAreas: {
        type: "array",
        items: {
          type: "string",
        },
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
        field: "problemId",
        references: {
          store: "problems",
          field: "leetCodeID",
        },
        required: true,
      },
      {
        field: "sessionId",
        references: {
          store: "sessions",
          field: "id",
        },
        required: false,
      },
    ],
    sessions: [
      {
        field: "problems.leetCodeID",
        references: {
          store: "problems",
          field: "leetCodeID",
        },
        required: true,
      },
      {
        field: "attempts.attemptId",
        references: {
          store: "attempts",
          field: "id",
        },
        required: false,
      },
    ],
    problem_relationships: [
      {
        field: "problemId1",
        references: {
          store: "problems",
          field: "leetCodeID",
        },
        required: true,
      },
      {
        field: "problemId2",
        references: {
          store: "problems",
          field: "leetCodeID",
        },
        required: true,
      },
    ],
    session_analytics: [
      {
        field: "sessionId",
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
