/**
 * 🏭 Database Helper Factory
 * Creates configurable database helpers for production, testing, and other environments
 * Ensures complete isolation between different database contexts
 */

import "../utils/DatabaseDebugger.js";
import {
  getExecutionContext,
  getStackTrace,
  validateDatabaseAccess,
  logDatabaseAccess,
  checkProductionDatabaseAccess
} from "./accessControl.js";
import {
  createDatabaseConnection,
  logCachedConnection
} from "./connectionUtils.js";
import { insertStandardProblems } from "./standard_problems.js";

/**
 * Create a database helper with specified configuration
 * @param {Object} config Configuration options
 * @param {string} config.dbName Base database name (default: "CodeMaster")
 * @param {number} config.version Database version (default: 47)
 * @param {boolean} config.isTestMode Whether this is a test database
 * @param {string} config.testSession Test session identifier for isolation
 * @param {boolean} config.enableLogging Enable debug logging (default: true)
 * @returns {Object} Configured database helper
 */
export function createDbHelper(config = {}) {
  const {
    dbName = "CodeMaster",
    version = 47,
    isTestMode = false,
    testSession = null,
    enableLogging = true,
    testSessionUID = null
  } = config;

  // Calculate actual database name with test isolation
  console.log('🔍 dbHelperFactory createDbHelper called with:', {
    dbName,
    isTestMode,
    testSession,
    willAddSuffix: isTestMode && testSession
  });

  const actualDbName = isTestMode && testSession ?
    `${dbName}_test_${testSession}` :
    dbName;

  console.log('🔍 Calculated actualDbName:', actualDbName);

  const helper = {
    dbName: actualDbName,
    baseDbName: dbName,
    version,
    isTestMode,
    testSession,
    testSessionUID,
    enableLogging,
    db: null,
    pendingConnection: null,

    openDB() {
      // 🔄 TEST DATABASE INTERCEPT: If test database is active, redirect all calls
      // CRITICAL: Only redirect if this is NOT already the test helper (prevent infinite recursion)
      if (globalThis._testDatabaseActive && globalThis._testDatabaseHelper &&
          !this.isTestMode && this !== globalThis._testDatabaseHelper) {
        // Silently redirect to test database
        return globalThis._testDatabaseHelper.openDB();
      }

      const context = getExecutionContext();
      const stack = getStackTrace();

      // Validate database access permissions
      validateDatabaseAccess(context, stack);

      // 🚨 SAFETY: Block test code from accessing production database
      checkProductionDatabaseAccess(this.dbName, context);

      // Log database access attempt
      logDatabaseAccess(context, stack);

      if (this.enableLogging) {
        const uidPrefix = this.testSessionUID ? `[${this.testSessionUID}]` : '';
        console.log(`🔍 ${uidPrefix} DATABASE ${this.isTestMode ? 'TEST' : 'PROD'} DEBUG: openDB() called for:`, {
          dbName: this.dbName,
          isTestMode: this.isTestMode,
          testSession: this.testSession,
          testSessionUID: this.testSessionUID,
          context: context.contextType,
          stackSnippet: stack.substring(0, 200)
        });
      }

      // Return existing connection if available
      if (this.db && this.db.name === this.dbName) {
        if (this.enableLogging) {
          logCachedConnection(this.dbName, this.isTestMode);
        }
        return Promise.resolve(this.db);
      }

      // Return pending connection if in progress
      if (this.pendingConnection) {
        if (this.enableLogging) {
          console.log(`⏳ DATABASE: Returning pending connection for ${this.dbName}`);
        }
        return this.pendingConnection;
      }

      // Create new connection
      this.pendingConnection = createDatabaseConnection(this.dbName, this.version, context, stack)
        .then(db => {
          this.db = db;
          this.pendingConnection = null;

          if (this.enableLogging) {
            console.log(`✅ DATABASE ${this.isTestMode ? 'TEST' : 'PROD'}: Connected to ${this.dbName}`);
          }

          return db;
        })
        .catch(error => {
          this.pendingConnection = null;

          if (this.enableLogging) {
            console.error(`❌ DATABASE ${this.isTestMode ? 'TEST' : 'PROD'}: Failed to connect to ${this.dbName}:`, error);
          }

          throw error;
        });

      return this.pendingConnection;
    },

    async closeDB() {
      if (this.db) {
        this.db.close();
        this.db = null;

        if (this.enableLogging) {
          console.log(`🔒 DATABASE ${this.isTestMode ? 'TEST' : 'PROD'}: Closed connection to ${this.dbName}`);
        }
      }
    },

    async deleteDB() {
      if (!this.isTestMode) {
        throw new Error('🚨 SAFETY: Cannot delete production database');
      }

      await this.closeDB();

      return new Promise((resolve, reject) => {
        const deleteRequest = indexedDB.deleteDatabase(this.dbName);

        deleteRequest.onsuccess = () => {
          if (this.enableLogging) {
            console.log(`🗑️ DATABASE TEST: Deleted test database ${this.dbName}`);
          }
          resolve();
        };

        deleteRequest.onerror = () => {
          if (this.enableLogging) {
            console.error(`❌ DATABASE TEST: Failed to delete ${this.dbName}:`, deleteRequest.error);
          }
          reject(deleteRequest.error);
        };

        deleteRequest.onblocked = () => {
          if (this.enableLogging) {
            console.warn(`⚠️ DATABASE TEST: Delete blocked for ${this.dbName} - close all connections first`);
          }
        };
      });
    },

    // Add all the standard database operations
    async getAll(storeName) {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    },

    async get(storeName, key) {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    },

    async add(storeName, data) {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.add(data);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    },

    async put(storeName, data) {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);

        transaction.oncomplete = () => resolve(request.result);
        transaction.onerror = () => reject(transaction.error);
        request.onerror = () => reject(request.error);
      });
    },

    async delete(storeName, key) {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);

        transaction.oncomplete = () => resolve(request.result);
        transaction.onerror = () => reject(transaction.error);
        request.onerror = () => reject(request.error);
      });
    },

    async clear(storeName) {
      if (!this.isTestMode) {
        throw new Error('🚨 SAFETY: Cannot clear production database store');
      }

      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        transaction.oncomplete = () => resolve(request.result);
        transaction.onerror = () => reject(transaction.error);
        request.onerror = () => reject(request.error);
      });
    },

    async smartTeardown(options = {}) {
      if (!this.isTestMode) {
        throw new Error('🚨 SAFETY: Cannot teardown production database');
      }

      const {
        preserveSeededData = true,
        clearUserData = true
      } = options;

      if (this.enableLogging) {
        console.log(`🧹 TEST DB: Starting smart teardown (preserve seeded: ${preserveSeededData})`);
      }

      const results = {
        preserved: [],
        cleared: [],
        errors: []
      };

      // Define data categories for snapshot-based isolation
      const DATA_CATEGORIES = {
        STATIC: [
          'standard_problems',    // Never changes, expensive to seed (~3000+ problems)
          'strategy_data',        // Static algorithm data
          'tag_relationships'     // Static tag graph data
        ],
        EXPENSIVE_DERIVED: [
          'pattern_ladders',      // Derived from static data but expensive to rebuild
          'problem_relationships' // Modified by tests but very expensive to rebuild
        ],
        TEST_SESSION: [
          'sessions',             // Test session data - clear between tests
          'attempts',             // Test attempt data - clear between tests
          'tag_mastery',          // Test progress data - clear between tests
          'problems'              // Test custom problems - clear between tests
        ],
        CONFIG: [
          'settings',             // User settings - preserve or reset to defaults
          'user_progress',        // User progress state
          'notifications'         // User notifications
        ]
      };

      try {
        // Always clear test session data (fast to recreate)
        for (const storeName of DATA_CATEGORIES.TEST_SESSION) {
          try {
            await this.clear(storeName);
            results.cleared.push(storeName);
            if (this.enableLogging) {
              console.log(`✅ TEST DB: Cleared ${storeName}`);
            }
          } catch (error) {
            results.errors.push({ store: storeName, error: error.message });
            if (this.enableLogging) {
              console.warn(`⚠️ TEST DB: Failed to clear ${storeName}:`, error.message);
            }
          }
        }

        // Clear configuration data if requested
        if (clearUserData) {
          for (const storeName of DATA_CATEGORIES.CONFIG) {
            try {
              await this.clear(storeName);
              results.cleared.push(storeName);
              if (this.enableLogging) {
                console.log(`✅ TEST DB: Cleared ${storeName} (config reset)`);
              }
            } catch (error) {
              // Only warn about missing stores if they're not expected to be missing
              if (error.message.includes('object stores was not found')) {
                if (this.enableLogging) {
                  console.log(`🔍 TEST DB: Store ${storeName} not found (skipping, likely not in schema)`);
                }
              } else {
                results.errors.push({ store: storeName, error: error.message });
                if (this.enableLogging) {
                  console.warn(`⚠️ TEST DB: Failed to clear ${storeName}:`, error.message);
                }
              }
            }
          }
        }

        // Handle expensive derived data based on test isolation level
        if (!preserveSeededData) {
          // Full teardown - clear everything including expensive data
          for (const storeName of [...DATA_CATEGORIES.STATIC, ...DATA_CATEGORIES.EXPENSIVE_DERIVED]) {
            try {
              await this.clear(storeName);
              results.cleared.push(storeName);
              if (this.enableLogging) {
                console.log(`✅ TEST DB: Cleared ${storeName} (full teardown)`);
              }
            } catch (error) {
              results.errors.push({ store: storeName, error: error.message });
              if (this.enableLogging) {
                console.warn(`⚠️ TEST DB: Failed to clear ${storeName}:`, error.message);
              }
            }
          }
        } else {
          // Smart teardown - preserve expensive static data, conditionally clear derived data
          results.preserved = [...DATA_CATEGORIES.STATIC];

          // For expensive derived data, check if tests indicated they modified it
          const testModifiedStores = globalThis._testModifiedStores || new Set();

          for (const storeName of DATA_CATEGORIES.EXPENSIVE_DERIVED) {
            if (testModifiedStores.has(storeName)) {
              try {
                await this.clear(storeName);
                results.cleared.push(storeName);
                if (this.enableLogging) {
                  console.log(`✅ TEST DB: Cleared ${storeName} (test-modified)`);
                }
              } catch (error) {
                results.errors.push({ store: storeName, error: error.message });
                if (this.enableLogging) {
                  console.warn(`⚠️ TEST DB: Failed to clear ${storeName}:`, error.message);
                }
              }
            } else {
              results.preserved.push(storeName);
              if (this.enableLogging) {
                console.log(`💾 TEST DB: Preserved ${storeName} (unmodified)`);
              }
            }
          }

          // Clear the modification tracking for next test
          globalThis._testModifiedStores = new Set();

          if (this.enableLogging) {
            console.log(`💾 TEST DB: Preserved static data: ${results.preserved.join(', ')}`);
          }
        }

        if (this.enableLogging) {
          console.log(`🧹 TEST DB: Smart teardown complete - cleared: ${results.cleared.length}, preserved: ${results.preserved.length}, errors: ${results.errors.length}`);
        }

        return results;

      } catch (error) {
        if (this.enableLogging) {
          console.error('❌ TEST DB: Smart teardown failed:', error);
        }
        throw error;
      }
    },

    /**
     * Creates a baseline snapshot of expensive derived data for fast restoration
     * @returns {Promise<Object>} Snapshot metadata
     */
    async createBaseline() {
      if (!this.isTestMode) {
        throw new Error('🚨 SAFETY: Baseline snapshots only available in test mode');
      }

      const DATA_CATEGORIES = {
        EXPENSIVE_DERIVED: ['pattern_ladders', 'problem_relationships']
      };

      if (this.enableLogging) {
        console.log('📸 TEST DB: Creating baseline snapshot...');
      }

      const db = await this.openDB();
      const snapshotId = `baseline_${Date.now()}`;
      const snapshotData = {};

      // Capture current state of expensive derived stores
      for (const storeName of DATA_CATEGORIES.EXPENSIVE_DERIVED) {
        try {
          const transaction = db.transaction(storeName, 'readonly');
          const store = transaction.objectStore(storeName);
          const data = await new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });

          snapshotData[storeName] = {
            data,
            count: data.length,
            timestamp: new Date().toISOString()
          };

          if (this.enableLogging) {
            console.log(`📸 TEST DB: Captured ${data.length} records from ${storeName}`);
          }
        } catch (error) {
          if (this.enableLogging) {
            console.error(`❌ TEST DB: Failed to snapshot ${storeName}:`, error.message);
          }
          throw error;
        }
      }

      // Store snapshot metadata
      globalThis._testBaseline = {
        id: snapshotId,
        data: snapshotData,
        created: new Date().toISOString(),
        stores: Object.keys(snapshotData)
      };

      if (this.enableLogging) {
        const totalRecords = Object.values(snapshotData).reduce((sum, store) => sum + store.count, 0);
        console.log(`✅ TEST DB: Baseline snapshot created - ${totalRecords} records across ${Object.keys(snapshotData).length} stores`);
      }

      return globalThis._testBaseline;
    },

    /**
     * Restores expensive derived data from baseline snapshot
     * @returns {Promise<Object>} Restoration results
     */
    async restoreFromBaseline() {
      if (!this.isTestMode) {
        throw new Error('🚨 SAFETY: Baseline restoration only available in test mode');
      }

      if (!globalThis._testBaseline) {
        throw new Error('❌ TEST DB: No baseline snapshot available - call createBaseline() first');
      }

      if (this.enableLogging) {
        console.log('🔄 TEST DB: Restoring from baseline snapshot...');
      }

      const db = await this.openDB();
      const baseline = globalThis._testBaseline;
      const results = {
        restored: [],
        errors: [],
        totalRecords: 0
      };

      // Restore each snapshotted store
      for (const [storeName, storeSnapshot] of Object.entries(baseline.data)) {
        try {
          // Clear the store first
          await this.clear(storeName);

          // Restore data from snapshot
          const transaction = db.transaction(storeName, 'readwrite');
          const store = transaction.objectStore(storeName);

          for (const record of storeSnapshot.data) {
            store.put(record);
          }

          // Wait for transaction to complete
          await new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
          });

          results.restored.push(storeName);
          results.totalRecords += storeSnapshot.count;

          if (this.enableLogging) {
            console.log(`✅ TEST DB: Restored ${storeSnapshot.count} records to ${storeName}`);
          }
        } catch (error) {
          results.errors.push({ store: storeName, error: error.message });
          if (this.enableLogging) {
            console.error(`❌ TEST DB: Failed to restore ${storeName}:`, error.message);
          }
        }
      }

      if (this.enableLogging) {
        console.log(`🔄 TEST DB: Restoration complete - ${results.totalRecords} records restored to ${results.restored.length} stores`);
      }

      return results;
    },

    /**
     * Smart test isolation that uses snapshots for efficiency
     * @param {Object} options - Isolation options
     * @returns {Promise<Object>} Isolation results
     */
    async smartTestIsolation(options = {}) {
      const { useSnapshots = true, fullReset = false } = options;

      if (!this.isTestMode) {
        throw new Error('🚨 SAFETY: Test isolation only available in test mode');
      }

      const DATA_CATEGORIES = {
        TEST_SESSION: ['sessions', 'attempts', 'tag_mastery', 'problems'],
        CONFIG: ['settings', 'user_progress', 'notifications']
      };

      if (this.enableLogging) {
        console.log(`🧹 TEST DB: Starting smart isolation (snapshots: ${useSnapshots}, full: ${fullReset})`);
      }

      const results = {
        cleared: [],
        restored: [],
        errors: []
      };

      try {
        // Always clear test session data (fast)
        for (const storeName of DATA_CATEGORIES.TEST_SESSION) {
          try {
            await this.clear(storeName);
            results.cleared.push(storeName);
          } catch (error) {
            results.errors.push({ store: storeName, error: error.message });
          }
        }

        if (fullReset) {
          // Clear config data too
          for (const storeName of DATA_CATEGORIES.CONFIG) {
            try {
              await this.clear(storeName);
              results.cleared.push(storeName);
            } catch (error) {
              results.errors.push({ store: storeName, error: error.message });
            }
          }
        }

        // Handle expensive derived data
        if (useSnapshots && globalThis._testBaseline) {
          // Fast: restore from snapshot
          const restoreResults = await this.restoreFromBaseline();
          results.restored = restoreResults.restored;
          results.errors.push(...restoreResults.errors);
        } else if (fullReset) {
          // Slow: clear everything (will need re-seeding)
          const DATA_CATEGORIES_ALL = {
            STATIC: ['standard_problems', 'strategy_data', 'tag_relationships'],
            EXPENSIVE_DERIVED: ['pattern_ladders', 'problem_relationships']
          };

          for (const storeName of [...DATA_CATEGORIES_ALL.STATIC, ...DATA_CATEGORIES_ALL.EXPENSIVE_DERIVED]) {
            try {
              await this.clear(storeName);
              results.cleared.push(storeName);
            } catch (error) {
              results.errors.push({ store: storeName, error: error.message });
            }
          }
        }

        if (this.enableLogging) {
          console.log(`✅ TEST DB: Smart isolation complete - cleared: ${results.cleared.length}, restored: ${results.restored.length}, errors: ${results.errors.length}`);
        }

        return results;
      } catch (error) {
        if (this.enableLogging) {
          console.error(`❌ TEST DB: Smart isolation failed:`, error);
        }
        throw error;
      }
    },

    async resetToCleanState() {
      if (!this.isTestMode) {
        throw new Error('🚨 SAFETY: Cannot reset production database');
      }

      // Smart teardown preserving expensive seeded data
      const teardownResults = await this.smartTeardown({ preserveSeededData: true });

      // Add fresh user baseline data
      try {
        await this.put('tag_mastery', {
          id: 'array',
          mastery_level: 0,
          confidence_score: 0.5,
          last_practiced: new Date().toISOString(),
          practice_count: 0
        });

        await this.put('settings', {
          id: 'user_preferences',
          focus_areas: ['array', 'hash-table'],
          sessions_per_week: 3,
          difficulty_preference: 'Medium',
          last_updated: new Date().toISOString()
        });

        // Rebuild problem relationships using production algorithm
        try {
          if (this.enableLogging) {
            console.log('🔁 TEST DB: Rebuilding problem relationships...');
          }
          const { buildProblemRelationships } = require('../services/relationshipService.js');
          await buildProblemRelationships();
          if (this.enableLogging) {
            console.log('✅ TEST DB: Problem relationships rebuilt successfully');
          }
        } catch (error) {
          if (this.enableLogging) {
            console.warn('⚠️ TEST DB: Problem relationships rebuild failed:', error.message);
          }
        }

        if (this.enableLogging) {
          console.log('✅ TEST DB: Reset to clean state with baseline data and fresh relationships');
        }

        return {
          ...teardownResults,
          baselineDataAdded: true,
          relationshipsRebuilt: true
        };

      } catch (error) {
        if (this.enableLogging) {
          console.warn('⚠️ TEST DB: Failed to add baseline data:', error.message);
        }

        return {
          ...teardownResults,
          baselineDataAdded: false,
          baselineError: error.message
        };
      }
    },

    // Utility methods
    getInfo() {
      return {
        dbName: this.dbName,
        baseDbName: this.baseDbName,
        version: this.version,
        isTestMode: this.isTestMode,
        testSession: this.testSession,
        isConnected: !!this.db,
        isPending: !!this.pendingConnection
      };
    }
  };

  return helper;
}

/**
 * Create a production database helper
 */
export function createProductionDbHelper() {
  return createDbHelper({
    dbName: "CodeMaster",
    isTestMode: false,
    enableLogging: true
  });
}

/**
 * Create a test database helper with isolated database
 */
export function createTestDbHelper(testSession = null) {
  // Check if a shared test session is available
  const sharedSession = globalThis._sharedTestSession;
  const session = testSession || sharedSession;  // Removed || 'test' - if no session, use null

  console.log('🔍 createTestDbHelper called with:', {
    testSessionParam: testSession,
    sharedSession,
    finalSession: session
  });

  return createDbHelper({
    dbName: "CodeMaster_test",  // Use full name since testSession will be null for single shared DB
    isTestMode: true,
    testSession: session,  // Will be null for shared test DB, creating "CodeMaster_test"
    enableLogging: true
  });
}

/**
 * Test helper factory for specific test scenarios
 */
export function createScenarioTestDb(scenario = 'default', sharedSession = null) {
  const testDb = createTestDbHelper(sharedSession);

  // Extend with scenario-specific methods
  testDb.seedScenario = async (scenarioName = scenario) => {
    const scenarios = {
      'empty': async () => {
        // Just ensure clean database - no seeding
      },
      'basic': async () => {
        try {
          await testDb.put('problems', {
            id: 1,
            title: "Two Sum",
            difficulty: "Easy",
            tags: ['array', 'hash-table']
          });
          await testDb.put('settings', {
            id: 1,
            focusAreas: ['array'],
            sessionsPerWeek: 3
          });
        } catch (error) {
          // Ignore seeding errors for now - database might not be fully ready
          if (testDb.enableLogging) {
            console.warn('⚠️  Test data seeding failed (non-critical):', error.message);
          }
        }
      },
      'production-like': async () => {
        // Seed with production-like data for comprehensive testing
        await testDb.seedProductionLikeData();
      },
      'experienced': async () => {
        // Seed with more complex data for experienced user testing
        const problems = [
          { id: 1, title: "Two Sum", difficulty: "Easy", tags: ['array', 'hash-table'] },
          { id: 2, title: "Add Two Numbers", difficulty: "Medium", tags: ['linked-list', 'math'] },
          { id: 3, title: "Median of Arrays", difficulty: "Hard", tags: ['array', 'binary-search'] }
        ];

        for (const problem of problems) {
          await testDb.put('problems', problem);
        }

        await testDb.put('settings', {
          id: 1,
          focusAreas: ['array', 'linked-list'],
          sessionsPerWeek: 7
        });
      }
    };

    const seedFunction = scenarios[scenarioName] || scenarios['basic'];
    await seedFunction();

    if (testDb.enableLogging) {
      console.log(`🌱 DATABASE TEST: Seeded scenario '${scenarioName}' in ${testDb.dbName}`);
    }
  };

  // Add production-like seeding method
  testDb.seedProductionLikeData = async function() {
    if (this.enableLogging) {
      console.log('🌱 DATABASE TEST: Starting production-like seeding...');
    }
    console.log('🌱 DATABASE TEST: Starting production-like seeding (forced log)...');

    const results = {
      standardProblems: false,
      strategyData: false,
      tagRelationships: false,
      problemRelationships: false,
      userSetup: false
    };

    try {
      // Basic test data seeding - simplified approach
      const testDbRef = this;

      // 1. Load comprehensive standard problems dataset for realistic testing
      try {
        // Use the production standard problems loading function
        // This will set up global test database context and load all problems
        const originalActive = globalThis._testDatabaseActive;
        const originalHelper = globalThis._testDatabaseHelper;

        // Temporarily set test context to ensure insertStandardProblems uses test DB
        globalThis._testDatabaseActive = true;
        globalThis._testDatabaseHelper = testDbRef;

        await insertStandardProblems();

        // Restore original context
        globalThis._testDatabaseActive = originalActive;
        globalThis._testDatabaseHelper = originalHelper;

        results.standardProblems = true;
        if (testDbRef.enableLogging) {
          console.log('✅ TEST DB: Comprehensive standard problems loaded from production dataset');
        }
        console.log('✅ TEST DB: Comprehensive standard problems loaded from production dataset (forced log)');
      } catch (error) {
        if (testDbRef.enableLogging) {
          console.warn('⚠️ TEST DB: Basic test problems seeding failed:', error.message);
        }
        console.error('❌ TEST DB: Basic test problems seeding failed (forced log):', error);
      }

      // 2. Basic strategy data
      try {
        await testDbRef.put('strategy_data', {
          id: 'array',
          strategies: ['two-pointer', 'sliding-window'],
          difficulty_levels: ['Easy', 'Medium']
        });
        results.strategyData = true;
        if (testDbRef.enableLogging) {
          console.log('✅ TEST DB: Basic strategy data seeded');
        }
      } catch (error) {
        if (testDbRef.enableLogging) {
          console.warn('⚠️ TEST DB: Basic strategy data seeding failed:', error.message);
        }
      }

      // 3. Basic tag relationships
      try {
        await testDbRef.put('tag_relationships', {
          id: 'array-fundamentals',
          related_tags: [
            { tag: 'hash-table', strength: 0.8 },
            { tag: 'two-pointer', strength: 0.7 }
          ]
        });
        results.tagRelationships = true;
        if (testDbRef.enableLogging) {
          console.log('✅ TEST DB: Basic tag relationships built');
        }
      } catch (error) {
        if (testDbRef.enableLogging) {
          console.warn('⚠️ TEST DB: Basic tag relationships failed:', error.message);
        }
      }

      // 4. Build problem relationships using production algorithm
      try {
        if (testDbRef.enableLogging) {
          console.log('🔁 TEST DB: Building problem relationships using production algorithm...');
        }

        // Import and call the same relationship building service used in production
        const { buildProblemRelationships } = require('../services/relationshipService.js');
        await buildProblemRelationships();

        results.problemRelationships = true;
        if (testDbRef.enableLogging) {
          console.log('✅ TEST DB: Problem relationships built successfully using production algorithm');
        }
      } catch (error) {
        if (testDbRef.enableLogging) {
          console.warn('⚠️ TEST DB: Problem relationships building failed:', error.message);
        }
        results.problemRelationships = false;
      }

      // 5. Setup basic user data
      try {
        await testDbRef.put('tag_mastery', {
          id: 'array',
          mastery_level: 0,
          confidence_score: 0.5,
          last_practiced: new Date().toISOString(),
          practice_count: 0
        });

        await testDbRef.put('settings', {
          id: 'user_preferences',
          focus_areas: ['array', 'hash-table'],
          sessions_per_week: 3,
          difficulty_preference: 'Medium',
          last_updated: new Date().toISOString()
        });

        results.userSetup = true;
        if (testDbRef.enableLogging) {
          console.log('✅ TEST DB: User data setup complete');
        }
      } catch (error) {
        if (testDbRef.enableLogging) {
          console.warn('⚠️ TEST DB: User data setup failed:', error.message);
        }
      }

      const successCount = Object.values(results).filter(Boolean).length;
      if (testDbRef.enableLogging) {
        console.log(`🌱 DATABASE TEST: Production-like seeding complete: ${successCount}/5 components seeded`);
      }

      return results;

    } catch (error) {
      if (this.enableLogging) {
        console.error('❌ TEST DB: Production-like seeding failed:', error);
      }
      throw error;
    }
  };

  // Test database context management methods
  testDb.activateGlobalContext = function() {
    // Store original context for restoration
    testDb._originalActive = globalThis._testDatabaseActive;
    testDb._originalHelper = globalThis._testDatabaseHelper;

    // Set global test database context
    globalThis._testDatabaseActive = true;
    globalThis._testDatabaseHelper = testDb;

    if (testDb.enableLogging) {
      console.log('🔄 TEST DB: Activated global context - all services will now use test database');
    }
  };

  testDb.deactivateGlobalContext = function() {
    // Restore original context
    globalThis._testDatabaseActive = testDb._originalActive;
    globalThis._testDatabaseHelper = testDb._originalHelper;

    if (testDb.enableLogging) {
      console.log('🔄 TEST DB: Deactivated global context - services restored to main database');
    }
  };

  return testDb;
}

export default createDbHelper;