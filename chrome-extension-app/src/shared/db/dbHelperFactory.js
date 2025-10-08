/**
 * 🏭 Database Helper Factory
 * Creates configurable database helpers for production, testing, and other environments
 * Ensures complete isolation between different database contexts
 */

import "../utils/DatabaseDebugger.js";
import * as dbMethods from "./dbHelperMethods.js";
import * as dbAdvanced from "./dbHelperAdvanced.js";
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

  // Create helper context object
  const helper = {
    dbName: actualDbName,
    baseDbName: dbName,
    version,
    isTestMode,
    testSession,
    testSessionUID,
    enableLogging,
    db: null,
    pendingConnection: null
  };

  // Attach all methods from imported modules
  // Basic CRUD operations
  helper.openDB = () => dbMethods.openDB(helper);
  helper.closeDB = () => dbMethods.closeDB(helper);
  helper.deleteDB = () => dbMethods.deleteDB(helper);
  helper.getAll = (storeName) => dbMethods.getAll(helper, storeName);
  helper.get = (storeName, key) => dbMethods.get(helper, storeName, key);
  helper.add = (storeName, data) => dbMethods.add(helper, storeName, data);
  helper.put = (storeName, data) => dbMethods.put(helper, storeName, data);
  helper.delete = (storeName, key) => dbMethods.deleteRecord(helper, storeName, key);
  helper.clear = (storeName) => dbMethods.clear(helper, storeName);
  helper.getInfo = () => dbMethods.getInfo(helper);

  // Test helper methods
  helper.clearStoreWithLogging = (storeName, results, logSuffix) =>
    dbMethods.clearStoreWithLogging(helper, storeName, results, logSuffix);
  helper.clearConfigStores = (configStores, results) =>
    dbMethods.clearConfigStores(helper, configStores, results);
  helper.handleExpensiveDerivedData = (expensiveDerived, results) =>
    dbMethods.handleExpensiveDerivedData(helper, expensiveDerived, results);

  // Advanced test operations
  helper.smartTeardown = (options) => dbAdvanced.smartTeardown(helper, options);
  helper.createBaseline = () => dbAdvanced.createBaseline(helper);
  helper.restoreFromBaseline = () => dbAdvanced.restoreFromBaseline(helper);
  helper.smartTestIsolation = (options) => dbAdvanced.smartTestIsolation(helper, options);
  helper.resetToCleanState = () => dbAdvanced.resetToCleanState(helper);

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
// Helper functions for createScenarioTestDb
async function seedBasicScenario(testDb) {
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
    if (testDb.enableLogging) {
      console.warn('⚠️  Test data seeding failed (non-critical):', error.message);
    }
  }
}

async function seedExperiencedScenario(testDb) {
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

function createScenarioSeedFunction(testDb) {
  return async (scenarioName) => {
    const scenarios = {
      'empty': async () => {
        // Just ensure clean database - no seeding
      },
      'basic': async () => await seedBasicScenario(testDb),
      'production-like': async () => await testDb.seedProductionLikeData(),
      'experienced': async () => await seedExperiencedScenario(testDb)
    };

    const seedFunction = scenarios[scenarioName] || scenarios['basic'];
    await seedFunction();

    if (testDb.enableLogging) {
      console.log(`🌱 DATABASE TEST: Seeded scenario '${scenarioName}' in ${testDb.dbName}`);
    }
  };
}

export function createScenarioTestDb(scenario = 'default', sharedSession = null) {
  const testDb = createTestDbHelper(sharedSession);

  // Extend with scenario-specific methods
  testDb.seedScenario = createScenarioSeedFunction(testDb);

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