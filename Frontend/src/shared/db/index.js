import migrationSafety from "./migrationSafety.js";
import indexedDBRetry from "../services/IndexedDBRetryService.js";
// Import database debugger to install global interceptor
import "../utils/DatabaseDebugger.js";
// Import extracted modules for modular database operations
import {
  getExecutionContext,
  getStackTrace,
  validateDatabaseAccess,
  logDatabaseAccess
} from "./accessControl.js";
import {
  createDatabaseConnection,
  logNewConnectionWarning,
  logCachedConnection
} from "./connectionUtils.js";

export const dbHelper = {
  dbName: "review",
  version: 36, // 🆙 Upgraded for sessionType index support
  db: null,

  openDB() {
    const context = getExecutionContext();
    const stack = getStackTrace();
    
    // Validate database access permissions
    validateDatabaseAccess(context, stack);
    
    // Log database access attempt
    logDatabaseAccess(context, stack);
    
    // Return cached database if already opened
    if (dbHelper.db) {
      logCachedConnection();
      return dbHelper.db;
    }
    
    logNewConnectionWarning();

    // Initialize migration safety system
    migrationSafety.initializeMigrationSafety();

    // Create and configure database connection
    return createDatabaseConnection(dbHelper.dbName, dbHelper.version, context, stack)
      .then(db => {
        dbHelper.db = db;
        return db;
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
  openDBWithRetry(options = {}) {
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
  getStoreWithRetry(storeName, mode = "readonly", options = {}) {
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
  executeTransaction(storeNames, mode, operation, options = {}) {
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
  getRecord(storeName, key, options = {}) {
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
  putRecord(storeName, data, options = {}) {
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
  deleteRecord(storeName, key, options = {}) {
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
  countRecords(storeName, range = null, options = {}) {
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
  getAllRecords(storeName, range = null, options = {}) {
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
  streamRecords(store, range, limit, onProgress, abortController) {
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
