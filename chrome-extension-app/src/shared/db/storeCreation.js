/**
 * Store creation and index management utilities
 * Extracted from database upgrade logic to reduce complexity
 */

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
      autoIncrement: true,
    });

    ensureIndex(attemptsStore, "by_date", "date");
    ensureIndex(attemptsStore, "by_problem_and_date", ["problem_id", "date"]);
    ensureIndex(attemptsStore, "by_problem_id", "problem_id");
    ensureIndex(attemptsStore, "by_session_id", "session_id");
    ensureIndex(attemptsStore, "by_leetcode_id", "leetcode_id");
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
  // Fix problem_relationships store schema - recreate with proper keyPath
  if (db.objectStoreNames.contains("problem_relationships")) {
    db.deleteObjectStore("problem_relationships");
  }

  let relationshipsStore = db.createObjectStore("problem_relationships", {
    keyPath: "id",
    autoIncrement: true,
  });

  ensureIndex(relationshipsStore, "by_problem_id_1", "problem_id_1");
  ensureIndex(relationshipsStore, "by_problem_id_2", "problem_id_2");
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

    ensureIndex(problemsStore, "by_tag", "tags");
    ensureIndex(problemsStore, "by_problem", "problem");
    ensureIndex(problemsStore, "by_review", "review");
    ensureIndex(problemsStore, "by_title", "title");
    ensureIndex(problemsStore, "by_nextProblem", "nextProblem");
    ensureIndex(problemsStore, "by_leetcode_id", "leetcode_id");
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

  // Add indexes for session attribution and staleness detection
  if (!sessionsStore.indexNames.contains("by_origin")) {
    sessionsStore.createIndex("by_origin", "origin", { unique: false });
  }
  
  if (!sessionsStore.indexNames.contains("by_last_activity_time")) {
    sessionsStore.createIndex("by_last_activity_time", "last_activity_time", { unique: false });
  }
  
  if (!sessionsStore.indexNames.contains("by_origin_status")) {
    sessionsStore.createIndex("by_origin_status", ["origin", "status"], { unique: false });
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
      autoIncrement: true,
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
  if (!db.objectStoreNames.contains("session_analytics")) {
    let sessionAnalyticsStore = db.createObjectStore("session_analytics", {
      keyPath: "sessionId",
    });

    ensureIndex(sessionAnalyticsStore, "by_date", "completed_at");
    ensureIndex(sessionAnalyticsStore, "by_accuracy", "accuracy");
    ensureIndex(sessionAnalyticsStore, "by_difficulty", "predominant_difficulty");

    console.info("✅ Session analytics store created!");
  }
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