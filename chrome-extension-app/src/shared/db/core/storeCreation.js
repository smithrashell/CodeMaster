/**
 * Store creation and index management utilities
 * Extracted from database upgrade logic to reduce complexity
 */

import { v4 as uuidv4 } from "uuid";

/**
 * Ensures an index exists on a store
 * @param {IDBObjectStore} store - The object store
 * @param {string} indexName - Name of the index
 * @param {string|Array} keyPath - Key path for the index
 * @param {Object} options - Index options
 */
export function ensureIndex(store, indexName, keyPath, options = { unique: false }) {
  if (!store.indexNames.contains(indexName)) {
    store.createIndex(indexName, keyPath, options);
  }
}

/**
 * Creates the attempts store with all required indexes
 * @param {IDBDatabase} db - Database instance
 */
export function createAttemptsStore(db) {
  if (!db.objectStoreNames.contains("attempts")) {
    let attemptsStore = db.createObjectStore("attempts", {
      keyPath: "id",
    });

    // Create indexes using snake_case field names for database consistency
    ensureIndex(attemptsStore, "by_attempt_date", "attempt_date");
    ensureIndex(attemptsStore, "by_problem_and_date", ["problem_id", "attempt_date"]);
    ensureIndex(attemptsStore, "by_problem_id", "problem_id");
    ensureIndex(attemptsStore, "by_session_id", "session_id");
    ensureIndex(attemptsStore, "by_leetcode_id", "leetcode_id");
    ensureIndex(attemptsStore, "by_time_spent", "time_spent");
    ensureIndex(attemptsStore, "by_success", "success");

    console.log("✅ Attempts store created with snake_case schema for database consistency");

    // Handle data migration if we have temporary migration data
    if (globalThis._migrationAttempts && globalThis._migrationAttempts.length > 0) {
      console.log(`🔄 Restoring ${globalThis._migrationAttempts.length} attempt records after schema migration`);

      // Restore the attempt data to the new store
      globalThis._migrationAttempts.forEach(attempt => {
        try {
          // Ensure the attempt has a valid UUID (may be numeric from autoIncrement)
          const originalId = attempt.id;
          if (typeof attempt.id === 'number') {
            // Replace numeric autoIncrement ID with UUID
            attempt.id = uuidv4();
            console.log(`🔄 Converted attempt ID from ${originalId} to UUID: ${attempt.id}`);
          }

          attemptsStore.add(attempt);
        } catch (error) {
          console.error(`❌ Failed to migrate attempt record:`, attempt, error);
        }
      });

      // Clear the temporary migration data
      delete globalThis._migrationAttempts;
      console.log("✅ Attempt records migration completed");
    }
  }
}

/**
 * Creates the limits store with all required indexes
 * @param {IDBDatabase} db - Database instance
 */
export function createLimitsStore(db) {
  if (!db.objectStoreNames.contains("limits")) {
    let limitsStore = db.createObjectStore("limits", {
      keyPath: "id",
      autoIncrement: true,
    });

    ensureIndex(limitsStore, "by_create_at", "create_at");
  }
}

/**
 * Creates the session_state store
 * @param {IDBDatabase} db - Database instance
 */
export function createSessionStateStore(db) {
  if (!db.objectStoreNames.contains("session_state")) {
    db.createObjectStore("session_state", { keyPath: "id" });
  }
}

/**
 * Creates the problem_relationships store with indexes
 * @param {IDBDatabase} db - Database instance
 */
export function createProblemRelationshipsStore(db) {
  // Create the store if it doesn't exist
  if (!db.objectStoreNames.contains("problem_relationships")) {
    console.log("🔧 Creating new problem_relationships store with indexes");

    let relationshipsStore = db.createObjectStore("problem_relationships", {
      keyPath: "id",
      autoIncrement: true,
    });

    // Create required indexes
    ensureIndex(relationshipsStore, "by_problem_id1", "problem_id1");
    ensureIndex(relationshipsStore, "by_problem_id2", "problem_id2");

    console.log("✅ problem_relationships store created with indexes:", Array.from(relationshipsStore.indexNames));
  } else {
    console.log("📋 problem_relationships store already exists, keeping existing data");
  }
}

/**
 * Creates the problems store with indexes
 * @param {IDBDatabase} db - Database instance
 */
export function createProblemsStore(db) {
  if (!db.objectStoreNames.contains("problems")) {
    let problemsStore = db.createObjectStore("problems", {
      keyPath: "problem_id",
    });

    ensureIndex(problemsStore, "by_tags", "tags", { multiEntry: true });
    ensureIndex(problemsStore, "by_title", "title");
    ensureIndex(problemsStore, "by_box_level", "box_level");
    ensureIndex(problemsStore, "by_review_schedule", "review_schedule");
    ensureIndex(problemsStore, "by_session_id", "session_id");
    ensureIndex(problemsStore, "by_leetcode_id", "leetcode_id");
    ensureIndex(problemsStore, "by_cooldown_status", "cooldown_status");
  }
}

/**
 * Creates or updates the sessions store with all required indexes
 * @param {IDBDatabase} db - Database instance
 * @param {IDBTransaction} transaction - The upgrade transaction
 */
export function createSessionsStore(db, transaction) {
  let sessionsStore;
  if (!db.objectStoreNames.contains("sessions")) {
    // Create new sessions store if it doesn't exist
    sessionsStore = db.createObjectStore("sessions", {
      keyPath: "id",
      autoIncrement: false, // You manually set sessionID
    });
  } else {
    // Access existing sessions store for index management
    sessionsStore = transaction.objectStore("sessions");
  }

  // Ensure required indexes exist
  if (!sessionsStore.indexNames.contains("by_date")) {
    sessionsStore.createIndex("by_date", "date", { unique: false });
  }

  // Add index for interview sessions
  if (!sessionsStore.indexNames.contains("by_session_type")) {
    sessionsStore.createIndex("by_session_type", "session_type", { unique: false });
  }

  // Add composite index for efficient sessionType + status queries
  if (!sessionsStore.indexNames.contains("by_session_type_status")) {
    sessionsStore.createIndex("by_session_type_status", ["session_type", "status"], { unique: false });
  }

  // Add indexes for session staleness detection
  if (!sessionsStore.indexNames.contains("by_last_activity_time")) {
    sessionsStore.createIndex("by_last_activity_time", "last_activity_time", { unique: false });
  }

  console.info("Sessions store configured safely!");
}

/**
 * Creates the standard_problems store with indexes
 * @param {IDBDatabase} db - Database instance
 */
export function createStandardProblemsStore(db) {
  if (!db.objectStoreNames.contains("standard_problems")) {
    let standardProblemsStore = db.createObjectStore("standard_problems", {
      keyPath: "id",
      // Note: autoIncrement removed - all problems have explicit IDs from JSON
    });

    ensureIndex(standardProblemsStore, "by_slug", "slug");
  }
}

/**
 * Creates the backup_storage store with indexes
 * @param {IDBDatabase} db - Database instance
 */
export function createBackupStorageStore(db) {
  if (!db.objectStoreNames.contains("backup_storage")) {
    let backupStore = db.createObjectStore("backup_storage", {
      keyPath: "backupId",
    });

    ensureIndex(backupStore, "by_backupId", "backupId");
  }
}

/**
 * Creates or updates the tag_relationships store with indexes
 * @param {IDBDatabase} db - Database instance
 * @param {IDBTransaction} transaction - The upgrade transaction
 */
export function createTagRelationshipsStore(db, transaction) {
  let tagRelationshipsStore;
  if (!db.objectStoreNames.contains("tag_relationships")) {
    tagRelationshipsStore = db.createObjectStore("tag_relationships", {
      keyPath: "id",
    });
  } else {
    tagRelationshipsStore = transaction.objectStore("tag_relationships");
  }

  // Ensure index on 'classification' is created
  if (!tagRelationshipsStore.indexNames.contains("by_classification")) {
    tagRelationshipsStore.createIndex("by_classification", "classification");
  }
}

/**
 * Creates the tag_mastery store with indexes
 * @param {IDBDatabase} db - Database instance
 */
export function createTagMasteryStore(db) {
  if (!db.objectStoreNames.contains("tag_mastery")) {
    let tagMasteryStore = db.createObjectStore("tag_mastery", {
      keyPath: "tag",
    });

    ensureIndex(tagMasteryStore, "by_tag", "tag");
  }
}

/**
 * Creates the settings store
 * @param {IDBDatabase} db - Database instance
 */
export function createSettingsStore(db) {
  if (!db.objectStoreNames.contains("settings")) {
    let _settingsStore = db.createObjectStore("settings", {
      keyPath: "id",
    });

    console.info("Settings store created!");
  }
}

/**
 * Creates the pattern_ladders store with indexes
 * @param {IDBDatabase} db - Database instance
 */
export function createPatternLaddersStore(db) {
  if (!db.objectStoreNames.contains("pattern_ladders")) {
    let patternLaddersStore = db.createObjectStore("pattern_ladders", {
      keyPath: "tag",
    });

    ensureIndex(patternLaddersStore, "by_tag", "tag");
  }
}

/**
 * Creates the session_analytics store with indexes
 * @param {IDBDatabase} db - Database instance
 */
export function createSessionAnalyticsStore(db) {
  // Check if we need to recreate the store with correct keyPath (snake_case migration)
  if (db.objectStoreNames.contains("session_analytics")) {
    // Delete existing store to recreate with correct keyPath
    db.deleteObjectStore("session_analytics");
    console.info("🔄 Deleted old session_analytics store for snake_case migration");
  }

  let sessionAnalyticsStore = db.createObjectStore("session_analytics", {
    keyPath: "session_id",
  });

  ensureIndex(sessionAnalyticsStore, "by_date", "completed_at");
  ensureIndex(sessionAnalyticsStore, "by_accuracy", "accuracy");
  ensureIndex(sessionAnalyticsStore, "by_difficulty", "predominant_difficulty");

  console.info("✅ Session analytics store created with session_id keyPath!");
}

/**
 * Creates or updates the strategy_data store with optimized indexes
 * @param {IDBDatabase} db - Database instance
 * @param {IDBTransaction} transaction - The upgrade transaction
 */
export function createStrategyDataStore(db, transaction) {
  if (!db.objectStoreNames.contains("strategy_data")) {
    let strategyDataStore = db.createObjectStore("strategy_data", {
      keyPath: "tag",
    });

    // Core indexes for fast lookups
    ensureIndex(strategyDataStore, "by_tag", "tag");
    ensureIndex(strategyDataStore, "by_patterns", "patterns", { multiEntry: true });
    ensureIndex(strategyDataStore, "by_related", "related", { multiEntry: true });

    console.info("✅ Strategy data store created with optimized indexes!");
  } else {
    // Add new indexes to existing store if they don't exist
    const strategyDataStore = transaction.objectStore("strategy_data");

    if (!strategyDataStore.indexNames.contains("by_patterns")) {
      strategyDataStore.createIndex("by_patterns", "patterns", { multiEntry: true });
    }
    if (!strategyDataStore.indexNames.contains("by_related")) {
      strategyDataStore.createIndex("by_related", "related", { multiEntry: true });
    }
  }
}

/**
 * Creates the hint_interactions store for usage analytics
 * @param {IDBDatabase} db - Database instance
 */
export function createHintInteractionsStore(db) {
  if (!db.objectStoreNames.contains("hint_interactions")) {
    let hintInteractionsStore = db.createObjectStore("hint_interactions", {
      keyPath: "id",
      autoIncrement: true,
    });

    // Core indexes for analytics queries
    ensureIndex(hintInteractionsStore, "by_problem_id", "problem_id");
    ensureIndex(hintInteractionsStore, "by_session_id", "session_id");
    ensureIndex(hintInteractionsStore, "by_timestamp", "timestamp");
    ensureIndex(hintInteractionsStore, "by_hint_type", "hint_type");
    ensureIndex(hintInteractionsStore, "by_user_action", "user_action");
    ensureIndex(hintInteractionsStore, "by_difficulty", "problem_difficulty");
    ensureIndex(hintInteractionsStore, "by_box_level", "box_level");

    // Composite indexes for advanced analytics
    ensureIndex(hintInteractionsStore, "by_problem_and_action", ["problem_id", "user_action"]);
    ensureIndex(hintInteractionsStore, "by_hint_type_and_difficulty", ["hint_type", "problem_difficulty"]);

    console.info("✅ Hint interactions store created for usage analytics!");
  }
}

/**
 * Creates the user_actions store for user action tracking
 * @param {IDBDatabase} db - Database instance
 */
export function createUserActionsStore(db) {
  if (!db.objectStoreNames.contains("user_actions")) {
    let userActionsStore = db.createObjectStore("user_actions", {
      keyPath: "id",
      autoIncrement: true,
    });

    // Create indexes for efficient analytics queries
    ensureIndex(userActionsStore, "by_timestamp", "timestamp");
    ensureIndex(userActionsStore, "by_category", "category");
    ensureIndex(userActionsStore, "by_action", "action");
    ensureIndex(userActionsStore, "by_session", "session_id");
    ensureIndex(userActionsStore, "by_user_agent", "user_agent");
    ensureIndex(userActionsStore, "by_url", "url");

    console.info("✅ User actions store created for tracking!");
  }
}

/**
 * Creates the error_reports store for error reporting
 * @param {IDBDatabase} db - Database instance
 */
export function createErrorReportsStore(db) {
  if (!db.objectStoreNames.contains("error_reports")) {
    let errorReportsStore = db.createObjectStore("error_reports", {
      keyPath: "id",
      autoIncrement: true,
    });

    // Create indexes for efficient querying
    ensureIndex(errorReportsStore, "by_timestamp", "timestamp");
    ensureIndex(errorReportsStore, "by_section", "section");
    ensureIndex(errorReportsStore, "by_error_type", "error_type");
    ensureIndex(errorReportsStore, "by_user_agent", "user_agent");

    console.info("✅ Error reports store created for error tracking!");
  }
}

/**
 * Declarative schema for all 17 CodeMaster stores.
 * Single source of truth used by both production DB upgrades and test helpers.
 * Each entry: { name, options: { keyPath, autoIncrement? }, indexes: [[name, keyPath, opts?]] }
 */
export const STORES = [
  {
    name: 'attempts',
    options: { keyPath: 'id' },
    indexes: [
      ['by_attempt_date', 'attempt_date'],
      ['by_problem_and_date', ['problem_id', 'attempt_date']],
      ['by_problem_id', 'problem_id'],
      ['by_session_id', 'session_id'],
      ['by_leetcode_id', 'leetcode_id'],
      ['by_time_spent', 'time_spent'],
      ['by_success', 'success'],
    ],
  },
  {
    name: 'problems',
    options: { keyPath: 'problem_id' },
    indexes: [
      ['by_tags', 'tags', { multiEntry: true }],
      ['by_title', 'title'],
      ['by_box_level', 'box_level'],
      ['by_review_schedule', 'review_schedule'],
      ['by_session_id', 'session_id'],
      ['by_leetcode_id', 'leetcode_id'],
      ['by_cooldown_status', 'cooldown_status'],
    ],
  },
  {
    name: 'sessions',
    options: { keyPath: 'id', autoIncrement: false },
    indexes: [
      ['by_date', 'date'],
      ['by_session_type', 'session_type'],
      ['by_session_type_status', ['session_type', 'status']],
      ['by_last_activity_time', 'last_activity_time'],
    ],
  },
  {
    name: 'settings',
    options: { keyPath: 'id' },
    indexes: [],
  },
  {
    name: 'tag_mastery',
    options: { keyPath: 'tag' },
    indexes: [['by_tag', 'tag']],
  },
  {
    name: 'standard_problems',
    options: { keyPath: 'id' },
    indexes: [['by_slug', 'slug']],
  },
  {
    name: 'strategy_data',
    options: { keyPath: 'tag' },
    indexes: [
      ['by_tag', 'tag'],
      ['by_patterns', 'patterns', { multiEntry: true }],
      ['by_related', 'related', { multiEntry: true }],
    ],
  },
  {
    name: 'tag_relationships',
    options: { keyPath: 'id' },
    indexes: [['by_classification', 'classification']],
  },
  {
    name: 'problem_relationships',
    options: { keyPath: 'id', autoIncrement: true },
    indexes: [
      ['by_problem_id1', 'problem_id1'],
      ['by_problem_id2', 'problem_id2'],
    ],
  },
  {
    name: 'pattern_ladders',
    options: { keyPath: 'tag' },
    indexes: [['by_tag', 'tag']],
  },
  {
    name: 'session_analytics',
    options: { keyPath: 'session_id' },
    indexes: [
      ['by_date', 'completed_at'],
      ['by_accuracy', 'accuracy'],
      ['by_difficulty', 'predominant_difficulty'],
    ],
  },
  {
    name: 'hint_interactions',
    options: { keyPath: 'id', autoIncrement: true },
    indexes: [
      ['by_problem_id', 'problem_id'],
      ['by_session_id', 'session_id'],
      ['by_timestamp', 'timestamp'],
      ['by_hint_type', 'hint_type'],
      ['by_user_action', 'user_action'],
      ['by_difficulty', 'problem_difficulty'],
      ['by_box_level', 'box_level'],
      ['by_problem_and_action', ['problem_id', 'user_action']],
      ['by_hint_type_and_difficulty', ['hint_type', 'problem_difficulty']],
    ],
  },
  {
    name: 'user_actions',
    options: { keyPath: 'id', autoIncrement: true },
    indexes: [
      ['by_timestamp', 'timestamp'],
      ['by_category', 'category'],
      ['by_action', 'action'],
      ['by_session', 'session_id'],
      ['by_user_agent', 'user_agent'],
      ['by_url', 'url'],
    ],
  },
  {
    name: 'error_reports',
    options: { keyPath: 'id', autoIncrement: true },
    indexes: [
      ['by_timestamp', 'timestamp'],
      ['by_section', 'section'],
      ['by_error_type', 'error_type'],
      ['by_user_agent', 'user_agent'],
    ],
  },
  {
    name: 'limits',
    options: { keyPath: 'id', autoIncrement: true },
    indexes: [['by_create_at', 'create_at']],
  },
  {
    name: 'session_state',
    options: { keyPath: 'id' },
    indexes: [],
  },
  {
    name: 'backup_storage',
    options: { keyPath: 'backupId' },
    indexes: [['by_backupId', 'backupId']],
  },
];