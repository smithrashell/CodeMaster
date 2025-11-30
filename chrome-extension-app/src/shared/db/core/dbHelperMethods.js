/**
 * 🛠️ Database Helper Methods
 * Extracted methods from dbHelperFactory for better code organization
 * All methods operate on a helper context object passed as first parameter
 */

import {
  getExecutionContext,
  getStackTrace,
  validateDatabaseAccess,
  logDatabaseAccess,
  checkProductionDatabaseAccess
} from "./core/accessControl.js";
import {
  createDatabaseConnection,
  logCachedConnection
} from "./connectionUtils.js";

/**
 * Open database connection with validation and caching
 */
export function openDB(helper) {
  // 🔄 TEST DATABASE INTERCEPT: If test database is active, redirect all calls
  // CRITICAL: Only redirect if this is NOT already the test helper (prevent infinite recursion)
  if (globalThis._testDatabaseActive && globalThis._testDatabaseHelper &&
      !helper.isTestMode && helper !== globalThis._testDatabaseHelper) {
    // Silently redirect to test database
    return globalThis._testDatabaseHelper.openDB();
  }

  const context = getExecutionContext();
  const stack = getStackTrace();

  // Validate database access permissions
  validateDatabaseAccess(context, stack);

  // 🚨 SAFETY: Block test code from accessing production database
  checkProductionDatabaseAccess(helper.dbName, context);

  // Log database access attempt
  logDatabaseAccess(context, stack);

  // Return existing connection if available
  if (helper.db && helper.db.name === helper.dbName) {
    if (helper.enableLogging) {
      logCachedConnection(helper.dbName, helper.isTestMode);
    }
    return Promise.resolve(helper.db);
  }

  // Return pending connection if in progress
  if (helper.pendingConnection) {
    if (helper.enableLogging) {
      console.log(`⏳ DATABASE: Returning pending connection for ${helper.dbName}`);
    }
    return helper.pendingConnection;
  }

  // Create new connection
  helper.pendingConnection = createDatabaseConnection(helper.dbName, helper.version, context, stack)
    .then(db => {
      helper.db = db;
      helper.pendingConnection = null;

      if (helper.enableLogging) {
        console.log(`✅ DATABASE ${helper.isTestMode ? 'TEST' : 'PROD'}: Connected to ${helper.dbName}`);
      }

      return db;
    })
    .catch(error => {
      helper.pendingConnection = null;

      if (helper.enableLogging) {
        console.error(`❌ DATABASE ${helper.isTestMode ? 'TEST' : 'PROD'}: Failed to connect to ${helper.dbName}:`, error);
      }

      throw error;
    });

  return helper.pendingConnection;
}

/**
 * Close database connection
 */
export function closeDB(helper) {
  if (helper.db) {
    helper.db.close();
    helper.db = null;

    if (helper.enableLogging) {
      console.log(`🔒 DATABASE ${helper.isTestMode ? 'TEST' : 'PROD'}: Closed connection to ${helper.dbName}`);
    }
  }
}

/**
 * Delete test database
 */
export async function deleteDB(helper) {
  if (!helper.isTestMode) {
    throw new Error('🚨 SAFETY: Cannot delete production database');
  }

  await closeDB(helper);

  return new Promise((resolve, reject) => {
    const deleteRequest = indexedDB.deleteDatabase(helper.dbName);

    deleteRequest.onsuccess = () => {
      if (helper.enableLogging) {
        console.log(`🗑️ DATABASE TEST: Deleted test database ${helper.dbName}`);
      }
      resolve();
    };

    deleteRequest.onerror = () => {
      if (helper.enableLogging) {
        console.error(`❌ DATABASE TEST: Failed to delete ${helper.dbName}:`, deleteRequest.error);
      }
      reject(deleteRequest.error);
    };

    deleteRequest.onblocked = () => {
      if (helper.enableLogging) {
        console.warn(`⚠️ DATABASE TEST: Delete blocked for ${helper.dbName} - close all connections first`);
      }
    };
  });
}

/**
 * Get all records from a store
 */
export async function getAll(helper, storeName) {
  const db = await openDB(helper);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get a single record by key
 */
export async function get(helper, storeName, key) {
  const db = await openDB(helper);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Add a new record to a store
 */
export async function add(helper, storeName, data) {
  const db = await openDB(helper);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.add(data);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Put (upsert) a record in a store
 */
export async function put(helper, storeName, data) {
  const db = await openDB(helper);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(data);

    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a record from a store
 */
export async function deleteRecord(helper, storeName, key) {
  const db = await openDB(helper);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all records from a store (test mode only)
 */
export async function clear(helper, storeName) {
  if (!helper.isTestMode) {
    throw new Error('🚨 SAFETY: Cannot clear production database store');
  }

  const db = await openDB(helper);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear a store with logging
 */
export async function clearStoreWithLogging(helper, storeName, results, logSuffix = '') {
  try {
    await clear(helper, storeName);
    results.cleared.push(storeName);
    if (helper.enableLogging) {
      console.log(`✅ TEST DB: Cleared ${storeName}${logSuffix ? ` ${logSuffix}` : ''}`);
    }
  } catch (error) {
    results.errors.push({ store: storeName, error: error.message });
    if (helper.enableLogging) {
      console.warn(`⚠️ TEST DB: Failed to clear ${storeName}:`, error.message);
    }
  }
}

/**
 * Clear configuration stores
 */
export async function clearConfigStores(helper, configStores, results) {
  for (const storeName of configStores) {
    try {
      await clear(helper, storeName);
      results.cleared.push(storeName);
      if (helper.enableLogging) {
        console.log(`✅ TEST DB: Cleared ${storeName} (config reset)`);
      }
    } catch (error) {
      if (error.message.includes('object stores was not found')) {
        if (helper.enableLogging) {
          console.log(`🔍 TEST DB: Store ${storeName} not found (skipping, likely not in schema)`);
        }
      } else {
        results.errors.push({ store: storeName, error: error.message });
        if (helper.enableLogging) {
          console.warn(`⚠️ TEST DB: Failed to clear ${storeName}:`, error.message);
        }
      }
    }
  }
}

/**
 * Handle expensive derived data
 */
export async function handleExpensiveDerivedData(helper, expensiveDerived, results) {
  const testModifiedStores = globalThis._testModifiedStores || new Set();

  for (const storeName of expensiveDerived) {
    if (testModifiedStores.has(storeName)) {
      await clearStoreWithLogging(helper, storeName, results, '(test-modified)');
    } else {
      results.preserved.push(storeName);
      if (helper.enableLogging) {
        console.log(`💾 TEST DB: Preserved ${storeName} (unmodified)`);
      }
    }
  }

  globalThis._testModifiedStores = new Set();
}

/**
 * Get helper info
 */
export function getInfo(helper) {
  return {
    dbName: helper.dbName,
    baseDbName: helper.baseDbName,
    version: helper.version,
    isTestMode: helper.isTestMode,
    testSession: helper.testSession,
    isConnected: !!helper.db,
    isPending: !!helper.pendingConnection
  };
}
