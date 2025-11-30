import migrationSafety from "./migrations/migrationSafety.js";
import indexedDBRetry from "../services/storage/IndexedDBRetryService.js";
// Import database debugger to install global interceptor
import "../utils/testing/DatabaseDebugger.js";
// Import extracted modules for modular database operations
import {
  getExecutionContext,
  getStackTrace,
  validateDatabaseAccess,
  logDatabaseAccess,
  checkProductionDatabaseAccess
} from "./core/accessControl.js";
import {
  createDatabaseConnection,
  logNewConnectionWarning,
  logCachedConnection
} from "./core/connectionUtils.js";

// Global IndexedDB error handler for debugging
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (event.error && event.error.name && event.error.name.includes('IndexedDB')) {
      console.error('🚨 GLOBAL INDEXEDDB ERROR CAUGHT:', {
        message: event.error.message,
        name: event.error.name,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error.stack
      });
    }
  });
}

const dbHelper = {
  dbName: "CodeMaster",
  version: 47, // 🆙 Fixed problem_relationships store snake_case field names migration
  db: null,
  pendingConnection: null, // Track pending database connection promises

  // Helper to recover invalid dbHelper state
  recoverDbHelperState() {
    console.error('🚨 CRITICAL ERROR: dbHelper or dbHelper.dbName is undefined!', {
      thisObject: this,
      hasThis: !!this,
      hasDbName: this ? 'dbName' in this : false,
      dbNameValue: this ? this.dbName : 'N/A',
      thisKeys: Object.keys(this || {}),
      stack: new Error().stack
    });

    console.log('🔧 Attempting to recover with default database configuration...');
    try {
      this.dbName = "CodeMaster";
      this.version = 47;
      this.db = null;
      this.pendingConnection = null;

      if (!this.dbName) {
        throw new Error('Database helper recovery failed - still no dbName');
      }

      console.log('✅ Database helper recovered with default configuration');
    } catch (error) {
      console.error('❌ Database helper recovery failed:', error);
      throw new Error('Database helper is in an invalid state and could not be recovered');
    }
  },

  openDB() {
    // 🔄 TEST DATABASE INTERCEPT: If test database is active, redirect all calls
    if (globalThis._testDatabaseActive && globalThis._testDatabaseHelper) {
      // Silently redirect to test database
      return globalThis._testDatabaseHelper.openDB();
    }

    // 🚨 SAFETY CHECK: Ensure this dbHelper has proper properties
    if (!this || !this.dbName) {
      this.recoverDbHelperState();
    }

    const context = getExecutionContext();
    const stack = getStackTrace();

    // Validate database access permissions
    validateDatabaseAccess(context, stack);

    // 🚨 SAFETY: Block test code from accessing production database
    checkProductionDatabaseAccess(this.dbName, context);

    // Log database access attempt
    logDatabaseAccess(context, stack);
    
    console.log(`🔍 INDEXEDDB DEBUG: openDB() called from:`, {
      context: context.contextType,
      stackSnippet: stack.substring(0, 200)
    });
    
    // Check if cached database is still valid
    if (dbHelper.db) {
      try {
        // Test if the connection is still valid by checking basic properties
        if (dbHelper.db && dbHelper.db.name && dbHelper.db.version) {
          logCachedConnection();
          return Promise.resolve(dbHelper.db);
        } else {
          // Connection is invalid, clear the cache
          console.warn('🔄 Database connection invalid, clearing cache and reopening');
          dbHelper.db = null;
          dbHelper.pendingConnection = null;
        }
      } catch (error) {
        // Connection is invalid, clear the cache
        console.warn('🔄 Database connection error, clearing cache:', error.message);
        dbHelper.db = null;
        dbHelper.pendingConnection = null;
      }
    }

    // Check if there's already a pending connection
    if (dbHelper.pendingConnection) {
      console.log('🔄 RACE CONDITION AVOIDED: Using existing pending connection');
      return dbHelper.pendingConnection;
    }
    
    logNewConnectionWarning();

    // Initialize migration safety system
    migrationSafety.initializeMigrationSafety();

    // Create and configure database connection - track pending promise to avoid race conditions
    dbHelper.pendingConnection = createDatabaseConnection(dbHelper.dbName, dbHelper.version, context, stack)
      .then(async db => {
        console.log(`🔍 INDEXEDDB DEBUG: Database connection established successfully`);
        
        // Add connection event handlers to detect when connection becomes invalid
        db.onclose = () => {
          console.warn('🔌 Database connection closed, clearing cache');
          if (dbHelper.db === db) {
            dbHelper.db = null;
          }
        };
        
        db.onversionchange = () => {
          console.warn('🔄 Database version change detected, closing connection');
          db.close();
          if (dbHelper.db === db) {
            dbHelper.db = null;
          }
        };
        
        // PRODUCTION SAFETY: Validate database integrity
        // Skip intensive validation immediately after upgrade to prevent circular reference
        try {
          // Add a small delay after database connection to ensure upgrade transaction completes
          await new Promise(resolve => setTimeout(resolve, 50));

          const isValid = await dbHelper.validateDatabaseIntegrity(db);
          if (!isValid) {
            console.warn('🔧 Database validation failed, attempting repair...');
            return dbHelper.repairDatabase(db);
          }
        } catch (error) {
          // If validation fails during upgrade, log but continue - the database should still be functional
          if (error.message && error.message.includes('index not found')) {
            console.warn('⚠️ Database validation skipped due to upgrade timing issue:', error.message);
            console.log('📝 Database should be functional, continuing...');
          } else {
            console.error(`❌ INDEXEDDB DEBUG: Database validation failed:`, {
              error: error.message,
              name: error.name,
              code: error.code
            });
            throw error;
          }
        }
        
        dbHelper.db = db;
        dbHelper.pendingConnection = null; // Clear pending connection on success
        console.log(`🔍 INDEXEDDB DEBUG: Database ready for use`);
        return db;
      })
      .catch(error => {
        console.error(`❌ INDEXEDDB DEBUG: Database connection failed:`, {
          error: error.message,
          name: error.name,
          code: error.code,
          stack: error.stack
        });
        dbHelper.pendingConnection = null; // Clear pending connection on error
        throw error;
      });

    // Return the pending promise
    return dbHelper.pendingConnection;
  },

  /**
   * Validates that all required object stores exist in the database
   * @param {IDBDatabase} db - Database instance to validate
   * @returns {Promise<boolean>} True if database is valid
   */
  validateDatabaseIntegrity(db) {
    const requiredStores = [
      'attempts', 'problems', 'sessions', 'settings', 'tag_mastery',
      'standard_problems', 'strategy_data', 'tag_relationships',
      'problem_relationships', 'pattern_ladders', 'session_analytics',
      'hint_interactions', 'user_actions', 'error_reports', 
      'limits', 'session_state', 'backup_storage'
    ];

    const existingStores = Array.from(db.objectStoreNames);
    const missingStores = requiredStores.filter(store => !existingStores.includes(store));

    if (missingStores.length > 0) {
      console.error('❌ Database validation failed - missing stores:', missingStores);
      console.log('📊 Existing stores:', existingStores);
      return false;
    }

    console.log('✅ Database validation passed - all required stores present');
    return true;
  },

  /**
   * Repairs a corrupted database by recreating it
   * @param {IDBDatabase} db - Corrupted database instance
   * @returns {Promise<IDBDatabase>} Repaired database
   */
  repairDatabase(db) {
    console.warn('🛠️ Starting database repair process...');
    
    // Close the corrupted database
    db.close();
    
    // Delete the corrupted database
    return new Promise((resolve, reject) => {
      const deleteRequest = indexedDB.deleteDatabase(dbHelper.dbName);
      
      deleteRequest.onsuccess = () => {
        console.log('🗑️ Corrupted database deleted successfully');
        
        // Recreate the database with a fresh connection
        dbHelper.db = null; // Clear cache
        createDatabaseConnection(dbHelper.dbName, dbHelper.version, getExecutionContext(), getStackTrace())
          .then(newDb => {
            console.log('✅ Database repair completed successfully');
            resolve(newDb);
          })
          .catch(reject);
      };
      
      deleteRequest.onerror = () => {
        console.error('❌ Failed to delete corrupted database');
        reject(new Error('Database repair failed'));
      };
      
      deleteRequest.onblocked = () => {
        console.warn('⚠️ Database deletion blocked - other connections may be open');
        // Continue anyway, the next open attempt should trigger upgrade
        setTimeout(() => {
          dbHelper.db = null;
          createDatabaseConnection(dbHelper.dbName, dbHelper.version, getExecutionContext(), getStackTrace())
            .then(resolve)
            .catch(reject);
        }, 1000);
      };
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

// 🔄 GLOBAL INTERCEPTION: Create a proxy wrapper for the entire dbHelper
// This ensures ALL database operations go through test database interception
const originalDbHelper = { ...dbHelper };

// Methods that need openDB interception
const methodsUsingOpenDB = [
  'openDB', 'getStore', 'openDBWithRetry', 'getStoreWithRetry',
  'executeTransaction', 'getRecord', 'putRecord', 'deleteRecord',
  'countRecords', 'getAllRecords'
];

// Create a proxy that intercepts all database-accessing methods
export const dbHelperProxy = new Proxy(dbHelper, {
  get(target, prop) {
    if (methodsUsingOpenDB.includes(prop)) {
      return function(...args) {
        // Check for global test database interception
        if (globalThis._testDatabaseActive && globalThis._testDatabaseHelper) {
          console.log(`🔄 PROXY INTERCEPTION: Redirecting ${prop} to test database`);
          // Call the method on the test database helper
          return globalThis._testDatabaseHelper[prop].apply(globalThis._testDatabaseHelper, args);
        }
        // Otherwise call the original method with proper context
        return originalDbHelper[prop].apply(target, args);
      };
    }
    // For all other properties, return normally
    return target[prop];
  }
});

// Replace the export with the proxy
export { dbHelperProxy as dbHelper };
