import migrationSafety from "./migrationSafety.js";
import indexedDBRetry from "../services/IndexedDBRetryService.js";

export const dbHelper = {
  dbName: "review",
  version: 34, // 🚨 Increment version to trigger upgrade (hint interactions analytics)
  db: null,

  async openDB() {
    if (dbHelper.db) {
      return dbHelper.db; // Return cached database if already opened
    }

    // Initialize migration safety system
    migrationSafety.initializeMigrationSafety();

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbHelper.dbName, dbHelper.version);

      request.onupgradeneeded = async (event) => {
        // eslint-disable-next-line no-console
        console.log("📋 Database upgrade needed - creating safety backup...");

        // Create backup before any schema changes
        try {
          if (event.oldVersion > 0) {
            // Only backup if upgrading existing database
            await migrationSafety.createMigrationBackup();
            // eslint-disable-next-line no-console
            console.log("✅ Safety backup created before upgrade");
          }
        } catch (error) {
          console.error(
            "⚠️ Backup creation failed, proceeding with upgrade:",
            error
          );
        }
        const db = event.target.result;

        // ✅ Ensure 'attempts' store exists
        if (!db.objectStoreNames.contains("attempts")) {
          let attemptsStore = db.createObjectStore("attempts", {
            keyPath: "id",
            autoIncrement: true,
          });

          dbHelper.ensureIndex(attemptsStore, "by_date", "date");
          dbHelper.ensureIndex(attemptsStore, "by_problem_and_date", [
            "problemId",
            "date",
          ]);
          dbHelper.ensureIndex(attemptsStore, "by_problemId", "problemId");
          dbHelper.ensureIndex(attemptsStore, "by_sessionId", "sessionId");
        }

        // ✅ Ensure 'limits' store exists
        if (!db.objectStoreNames.contains("limits")) {
          let limitsStore = db.createObjectStore("limits", {
            keyPath: "id",
            autoIncrement: true,
          });

          dbHelper.ensureIndex(limitsStore, "by_createAt", "createAt");
        }

        // ✅ Ensure 'problem_relationships' store exists
        // if (db.objectStoreNames.contains("problem_relationships")) {
        //   db.deleteObjectStore("problem_relationships");
        // }
        if (!db.objectStoreNames.contains("session_state")) {
          db.createObjectStore("session_state", { keyPath: "id" });
        }

        // ✅ Fix problem_relationships store schema - recreate with proper keyPath
        if (db.objectStoreNames.contains("problem_relationships")) {
          db.deleteObjectStore("problem_relationships");
        }

        let relationshipsStore = db.createObjectStore("problem_relationships", {
          keyPath: "id",
          autoIncrement: true,
        });

        dbHelper.ensureIndex(relationshipsStore, "by_problemId1", "problemId1");
        dbHelper.ensureIndex(relationshipsStore, "by_problemId2", "problemId2");

        // ✅ Ensure 'problems' store exists
        if (!db.objectStoreNames.contains("problems")) {
          let problemsStore = db.createObjectStore("problems", {
            keyPath: "leetCodeID",
          });

          dbHelper.ensureIndex(problemsStore, "by_tag", "tag");
          dbHelper.ensureIndex(problemsStore, "by_problem", "problem");
          dbHelper.ensureIndex(problemsStore, "by_review", "review");
          dbHelper.ensureIndex(
            problemsStore,
            "by_ProblemDescription",
            "ProblemDescription"
          );
          dbHelper.ensureIndex(problemsStore, "by_nextProblem", "nextProblem");
        }
        // ✅ Ensure 'sessions' store exists with safe migration
        let sessionsStore;
        if (!db.objectStoreNames.contains("sessions")) {
          // Create new sessions store if it doesn't exist
          sessionsStore = db.createObjectStore("sessions", {
            keyPath: "id",
            autoIncrement: false, // You manually set sessionID
          });
        } else {
          // Access existing sessions store for index management
          sessionsStore = event.target.transaction.objectStore("sessions");
        }

        // Ensure required indexes exist
        if (!sessionsStore.indexNames.contains("by_date")) {
          sessionsStore.createIndex("by_date", "Date", { unique: false });
        }

        // eslint-disable-next-line no-console
        console.log("Sessions store configured safely!");
        // ✅ Ensure 'standard_problems' store exists
        if (!db.objectStoreNames.contains("standard_problems")) {
          let standardProblemsStore = db.createObjectStore(
            "standard_problems",
            {
              keyPath: "id",
              autoIncrement: true,
            }
          );

          dbHelper.ensureIndex(standardProblemsStore, "by_slug", "slug");
        }

        // ✅ Ensure 'backup_storage' store exists
        if (!db.objectStoreNames.contains("backup_storage")) {
          let backupStore = db.createObjectStore("backup_storage", {
            keyPath: "backupId",
          });

          dbHelper.ensureIndex(backupStore, "by_backupId", "backupId");
        }

        // ✅ Ensure 'tag_relationships' store exists
        let tagRelationshipsStore;
        if (!db.objectStoreNames.contains("tag_relationships")) {
          tagRelationshipsStore = db.createObjectStore("tag_relationships", {
            keyPath: "id",
          });
        } else {
          tagRelationshipsStore =
            event.target.transaction.objectStore("tag_relationships");
        }

        // ✅ Ensure index on 'classification' is created
        if (!tagRelationshipsStore.indexNames.contains("by_classification")) {
          tagRelationshipsStore.createIndex(
            "by_classification",
            "classification"
          );
        }

        // eslint-disable-next-line no-console
        console.log("Database upgrade completed");

        // ✅ **NEW: Ensure 'tag_mastery' store exists**
        if (!db.objectStoreNames.contains("tag_mastery")) {
          let tagMasteryStore = db.createObjectStore("tag_mastery", {
            keyPath: "tag",
          });

          dbHelper.ensureIndex(tagMasteryStore, "by_tag", "tag");
        }

        // ✅ **NEW: Ensure 'settings' store exists**
        if (!db.objectStoreNames.contains("settings")) {
          let settingsStore = db.createObjectStore("settings", {
            keyPath: "id",
          });

          // eslint-disable-next-line no-console
          console.log("Settings store created!");
        }
        //add a index on classification

        // // ✅ **NEW: Ensure 'user_stats' store exists**
        if (!db.objectStoreNames.contains("pattern_ladders")) {
          let patternLaddersStore = db.createObjectStore("pattern_ladders", {
            keyPath: "tag",
          });

          dbHelper.ensureIndex(patternLaddersStore, "by_tag", "tag");
        }

        // ✅ **NEW: Ensure 'session_analytics' store exists**
        if (!db.objectStoreNames.contains("session_analytics")) {
          let sessionAnalyticsStore = db.createObjectStore(
            "session_analytics",
            {
              keyPath: "sessionId",
            }
          );

          dbHelper.ensureIndex(sessionAnalyticsStore, "by_date", "completedAt");
          dbHelper.ensureIndex(
            sessionAnalyticsStore,
            "by_accuracy",
            "accuracy"
          );
          dbHelper.ensureIndex(
            sessionAnalyticsStore,
            "by_difficulty",
            "predominantDifficulty"
          );

          // eslint-disable-next-line no-console
          console.log("✅ Session analytics store created!");
        }

        // ✅ **NEW: Ensure 'strategy_data' store exists with optimized indexes**
        if (!db.objectStoreNames.contains("strategy_data")) {
          let strategyDataStore = db.createObjectStore("strategy_data", {
            keyPath: "tag",
          });

          // Core indexes for fast lookups
          dbHelper.ensureIndex(strategyDataStore, "by_tag", "tag");
          dbHelper.ensureIndex(strategyDataStore, "by_patterns", "patterns", {
            multiEntry: true,
          });
          dbHelper.ensureIndex(strategyDataStore, "by_related", "related", {
            multiEntry: true,
          });

          // eslint-disable-next-line no-console
          console.log("✅ Strategy data store created with optimized indexes!");
        } else {
          // Add new indexes to existing store if they don't exist
          const strategyDataStore =
            event.target.transaction.objectStore("strategy_data");

          if (!strategyDataStore.indexNames.contains("by_patterns")) {
            strategyDataStore.createIndex("by_patterns", "patterns", {
              multiEntry: true,
            });
          }
          if (!strategyDataStore.indexNames.contains("by_related")) {
            strategyDataStore.createIndex("by_related", "related", {
              multiEntry: true,
            });
          }
        }

        // ✅ **NEW: Ensure 'hint_interactions' store exists for usage analytics**
        if (!db.objectStoreNames.contains("hint_interactions")) {
          let hintInteractionsStore = db.createObjectStore(
            "hint_interactions",
            {
              keyPath: "id",
              autoIncrement: true,
            }
          );

          // Core indexes for analytics queries
          dbHelper.ensureIndex(
            hintInteractionsStore,
            "by_problem_id",
            "problemId"
          );
          dbHelper.ensureIndex(
            hintInteractionsStore,
            "by_session_id",
            "sessionId"
          );
          dbHelper.ensureIndex(
            hintInteractionsStore,
            "by_timestamp",
            "timestamp"
          );
          dbHelper.ensureIndex(
            hintInteractionsStore,
            "by_hint_type",
            "hintType"
          );
          dbHelper.ensureIndex(
            hintInteractionsStore,
            "by_user_action",
            "userAction"
          );
          dbHelper.ensureIndex(
            hintInteractionsStore,
            "by_difficulty",
            "problemDifficulty"
          );
          dbHelper.ensureIndex(
            hintInteractionsStore,
            "by_box_level",
            "boxLevel"
          );

          // Composite indexes for advanced analytics
          dbHelper.ensureIndex(hintInteractionsStore, "by_problem_and_action", [
            "problemId",
            "userAction",
          ]);
          dbHelper.ensureIndex(
            hintInteractionsStore,
            "by_hint_type_and_difficulty",
            ["hintType", "problemDifficulty"]
          );

          // eslint-disable-next-line no-console
          console.log(
            "✅ Hint interactions store created for usage analytics!"
          );
        }
      };

      request.onsuccess = (event) => {
        dbHelper.db = event.target.result;
        // eslint-disable-next-line no-console
        console.log("✅ DB opened successfully (dbHelper working)");
        resolve(dbHelper.db);
      };

      request.onerror = (event) => reject(`❌ DB Error: ${event.target.error}`);
    });
  },

  ensureIndex(store, indexName, keyPath) {
    if (!store.indexNames.contains(indexName)) {
      store.createIndex(indexName, keyPath, { unique: false });
    }
  },

  async getStore(storeName, mode = "readonly") {
    if (!dbHelper.db) await dbHelper.openDB();
    return dbHelper.db.transaction(storeName, mode).objectStore(storeName);
  },

  // ===============================
  // RETRY-ENABLED DATABASE OPERATIONS
  // ===============================

  /**
   * Open database with retry logic and timeout handling
   * @param {Object} options - Retry configuration options
   * @returns {Promise<IDBDatabase>} Database instance
   */
  async openDBWithRetry(options = {}) {
    const {
      timeout = indexedDBRetry.defaultTimeout,
      operationName = "openDB",
      priority = "high",
      abortController = null,
    } = options;

    return indexedDBRetry.executeWithRetry(() => this.openDB(), {
      timeout,
      operationName,
      priority,
      abortController,
      deduplicationKey: "open_database",
    });
  },

  /**
   * Get store with retry logic
   * @param {string} storeName - Name of the store
   * @param {string} mode - Transaction mode ('readonly' | 'readwrite')
   * @param {Object} options - Retry configuration options
   * @returns {Promise<IDBObjectStore>} Object store
   */
  async getStoreWithRetry(storeName, mode = "readonly", options = {}) {
    const {
      timeout = indexedDBRetry.quickTimeout,
      operationName = `getStore_${storeName}_${mode}`,
      priority = "normal",
      abortController = null,
    } = options;

    return indexedDBRetry.executeWithRetry(
      () => this.getStore(storeName, mode),
      {
        timeout,
        operationName,
        priority,
        abortController,
        deduplicationKey: `store_${storeName}_${mode}`,
      }
    );
  },

  /**
   * Execute database transaction with retry logic
   * @param {string|string[]} storeNames - Store names for transaction
   * @param {string} mode - Transaction mode
   * @param {Function} operation - Operation function(tx, stores) => Promise<result>
   * @param {Object} options - Retry configuration options
   * @returns {Promise<any>} Transaction result
   */
  async executeTransaction(storeNames, mode, operation, options = {}) {
    const {
      timeout = indexedDBRetry.defaultTimeout,
      operationName = `transaction_${
        Array.isArray(storeNames) ? storeNames.join("_") : storeNames
      }_${mode}`,
      priority = "normal",
      abortController = null,
      deduplicationKey = null,
    } = options;

    return indexedDBRetry.executeWithRetry(
      async () => {
        const db = await this.openDB();
        const tx = db.transaction(storeNames, mode);

        // Handle both single store and multiple stores
        const stores = Array.isArray(storeNames)
          ? storeNames.map((name) => tx.objectStore(name))
          : tx.objectStore(storeNames);

        return new Promise((resolve, reject) => {
          tx.oncomplete = () => resolve(tx.result);
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(new Error("Transaction aborted"));

          // Execute the operation
          try {
            const result = operation(tx, stores);

            // If operation returns a promise, wait for it
            if (result instanceof Promise) {
              result
                .then((value) => {
                  tx.result = value;
                  if (tx.readyState === "active") {
                    // Transaction will complete automatically
                  }
                })
                .catch((error) => {
                  tx.abort();
                  reject(error);
                });
            } else {
              tx.result = result;
            }
          } catch (error) {
            tx.abort();
            reject(error);
          }
        });
      },
      {
        timeout,
        operationName,
        priority,
        abortController,
        deduplicationKey,
      }
    );
  },

  /**
   * Get single record with retry logic
   * @param {string} storeName - Store name
   * @param {any} key - Record key
   * @param {Object} options - Retry configuration options
   * @returns {Promise<any>} Record data or null
   */
  async getRecord(storeName, key, options = {}) {
    const {
      timeout = indexedDBRetry.quickTimeout,
      operationName = `getRecord_${storeName}`,
      priority = "normal",
      abortController = null,
    } = options;

    return indexedDBRetry.executeWithRetry(
      async () => {
        const store = await this.getStore(storeName, "readonly");
        return new Promise((resolve, reject) => {
          const request = store.get(key);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      },
      {
        timeout,
        operationName,
        priority,
        abortController,
        deduplicationKey: `get_${storeName}_${key}`,
      }
    );
  },

  /**
   * Put record with retry logic
   * @param {string} storeName - Store name
   * @param {any} data - Data to store
   * @param {Object} options - Retry configuration options
   * @returns {Promise<any>} Record key
   */
  async putRecord(storeName, data, options = {}) {
    const {
      timeout = indexedDBRetry.defaultTimeout,
      operationName = `putRecord_${storeName}`,
      priority = "normal",
      abortController = null,
    } = options;

    return indexedDBRetry.executeWithRetry(
      async () => {
        const store = await this.getStore(storeName, "readwrite");
        return new Promise((resolve, reject) => {
          const request = store.put(data);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      },
      {
        timeout,
        operationName,
        priority,
        abortController,
      }
    );
  },

  /**
   * Delete record with retry logic
   * @param {string} storeName - Store name
   * @param {any} key - Record key
   * @param {Object} options - Retry configuration options
   * @returns {Promise<void>}
   */
  async deleteRecord(storeName, key, options = {}) {
    const {
      timeout = indexedDBRetry.defaultTimeout,
      operationName = `deleteRecord_${storeName}`,
      priority = "normal",
      abortController = null,
    } = options;

    return indexedDBRetry.executeWithRetry(
      async () => {
        const store = await this.getStore(storeName, "readwrite");
        return new Promise((resolve, reject) => {
          const request = store.delete(key);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      },
      {
        timeout,
        operationName,
        priority,
        abortController,
      }
    );
  },

  /**
   * Count records with retry logic
   * @param {string} storeName - Store name
   * @param {IDBKeyRange} range - Optional key range
   * @param {Object} options - Retry configuration options
   * @returns {Promise<number>} Record count
   */
  async countRecords(storeName, range = null, options = {}) {
    const {
      timeout = indexedDBRetry.quickTimeout,
      operationName = `countRecords_${storeName}`,
      priority = "low",
      abortController = null,
    } = options;

    return indexedDBRetry.executeWithRetry(
      async () => {
        const store = await this.getStore(storeName, "readonly");
        return new Promise((resolve, reject) => {
          const request = store.count(range);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      },
      {
        timeout,
        operationName,
        priority,
        abortController,
        deduplicationKey: `count_${storeName}_${range ? "range" : "all"}`,
      }
    );
  },

  /**
   * Get all records with retry logic and streaming support
   * @param {string} storeName - Store name
   * @param {IDBKeyRange} range - Optional key range
   * @param {Object} options - Retry and streaming configuration
   * @returns {Promise<Array>} All records
   */
  async getAllRecords(storeName, range = null, options = {}) {
    const {
      timeout = indexedDBRetry.bulkTimeout,
      operationName = `getAllRecords_${storeName}`,
      priority = "low",
      abortController = null,
      limit = null,
      streaming = false,
      onProgress = null,
    } = options;

    return indexedDBRetry.executeWithRetry(
      async () => {
        const store = await this.getStore(storeName, "readonly");

        if (streaming && onProgress) {
          // Streaming mode with progress callbacks
          return this.streamRecords(
            store,
            range,
            limit,
            onProgress,
            abortController
          );
        } else {
          // Batch mode - get all at once
          return new Promise((resolve, reject) => {
            const request = limit
              ? store.getAll(range, limit)
              : store.getAll(range);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
        }
      },
      {
        timeout,
        operationName,
        priority,
        abortController,
        deduplicationKey: streaming
          ? null
          : `getAll_${storeName}_${range ? "range" : "all"}`,
      }
    );
  },

  /**
   * Stream records with progress callbacks (internal utility)
   * @param {IDBObjectStore} store - Object store
   * @param {IDBKeyRange} range - Key range
   * @param {number} limit - Record limit
   * @param {Function} onProgress - Progress callback
   * @param {AbortController} abortController - Abort controller
   * @returns {Promise<Array>} All records
   */
  async streamRecords(store, range, limit, onProgress, abortController) {
    return new Promise((resolve, reject) => {
      const records = [];
      const request = store.openCursor(range);
      let count = 0;

      request.onsuccess = (event) => {
        const cursor = event.target.result;

        if (abortController?.signal.aborted) {
          reject(new Error("Operation cancelled"));
          return;
        }

        if (cursor && (!limit || count < limit)) {
          records.push(cursor.value);
          count++;

          // Call progress callback every 100 records or at end
          if (count % 100 === 0 || count === limit) {
            try {
              onProgress(count, records.length);
            } catch (error) {
              console.warn("Progress callback error:", error);
            }
          }

          cursor.continue();
        } else {
          resolve(records);
        }
      };

      request.onerror = () => reject(request.error);
    });
  },

  // ===============================
  // UTILITY METHODS
  // ===============================

  /**
   * Get IndexedDB retry service instance
   * @returns {IndexedDBRetryService} Retry service
   */
  getRetryService() {
    return indexedDBRetry;
  },

  /**
   * Get database health statistics
   * @returns {Object} Health statistics
   */
  getHealthStats() {
    return {
      ...indexedDBRetry.getStatistics(),
      database: {
        name: this.dbName,
        version: this.version,
        connected: !!this.db,
      },
    };
  },
};
