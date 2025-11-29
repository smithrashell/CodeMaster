/**
 * 🏭 Database Helper Factory
 * Creates configurable database helpers for production, testing, and other environments
 * Ensures complete isolation between different database contexts
 */

import "../../utils/DatabaseDebugger.js";
import * as dbMethods from "./dbHelperMethods.js";
import * as dbAdvanced from "./dbHelperAdvanced.js";
import * as scenarioHelpers from "../entities/scenarioHelpers.js";

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
export function createScenarioTestDb(_scenario = 'default', sharedSession = null) {
  const testDb = createTestDbHelper(sharedSession);

  // Extend with scenario-specific methods from scenarioHelpers
  testDb.seedScenario = scenarioHelpers.createScenarioSeedFunction(testDb);
  testDb.seedProductionLikeData = () => scenarioHelpers.seedProductionLikeData(testDb);
  testDb.activateGlobalContext = () => scenarioHelpers.activateGlobalContext(testDb);
  testDb.deactivateGlobalContext = () => scenarioHelpers.deactivateGlobalContext(testDb);

  return testDb;
}

export default createDbHelper;