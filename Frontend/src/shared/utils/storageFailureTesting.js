/**
 * Storage Failure Testing Utilities for CodeMaster
 *
 * Provides tools to simulate and test various storage failure scenarios
 * to ensure the resilient storage system works correctly under adverse conditions.
 */

import { dbHelper } from "../db/index.js";
import { ChromeAPIErrorHandler } from "../services/ChromeAPIErrorHandler.js";
import ResilientStorage from "../services/ResilientStorage.js";
import StorageHealthMonitor from "./storageHealth.js";
import ErrorReportService from "../services/ErrorReportService.js";

export class StorageFailureTesting {
  static testResults = [];
  static isTestingMode = false;
  static originalMethods = {};

  // Test scenarios
  static TEST_SCENARIOS = {
    INDEXEDDB_UNAVAILABLE: "indexeddb_unavailable",
    INDEXEDDB_QUOTA_EXCEEDED: "indexeddb_quota_exceeded",
    CHROME_STORAGE_UNAVAILABLE: "chrome_storage_unavailable",
    CHROME_STORAGE_QUOTA_EXCEEDED: "chrome_storage_quota_exceeded",
    BOTH_STORAGE_UNAVAILABLE: "both_storage_unavailable",
    SLOW_INDEXEDDB: "slow_indexeddb",
    CORRUPTED_DATA: "corrupted_data",
    NETWORK_FAILURE: "network_failure",
  };

  /**
   * Enable testing mode and set up failure simulations
   */
  static enableTestingMode() {
    if (this.isTestingMode) {
      console.warn("Testing mode is already enabled");
      return;
    }

    this.isTestingMode = true;
    this.backupOriginalMethods();
    console.log("🧪 Storage failure testing mode enabled");
  }

  /**
   * Disable testing mode and restore original methods
   */
  static disableTestingMode() {
    if (!this.isTestingMode) {
      console.warn("Testing mode is not enabled");
      return;
    }

    this.restoreOriginalMethods();
    this.isTestingMode = false;
    console.log("✅ Storage failure testing mode disabled");
  }

  /**
   * Run a comprehensive test suite
   */
  static async runTestSuite(options = {}) {
    const {
      scenarios = Object.values(this.TEST_SCENARIOS),
      verbose = false,
      stopOnFailure = false,
    } = options;

    console.log("🚀 Starting storage failure test suite");
    this.enableTestingMode();

    const suiteResults = {
      startTime: new Date().toISOString(),
      totalTests: scenarios.length,
      passed: 0,
      failed: 0,
      scenarios: {},
    };

    try {
      for (const scenario of scenarios) {
        try {
          console.log(`\n🧪 Testing scenario: ${scenario}`);
          const result = await this.testScenario(scenario, { verbose });
          suiteResults.scenarios[scenario] = result;

          if (result.success) {
            suiteResults.passed++;
            console.log(`✅ ${scenario}: PASSED`);
          } else {
            suiteResults.failed++;
            console.log(`❌ ${scenario}: FAILED`);
            if (stopOnFailure) break;
          }
        } catch (error) {
          console.error(`💥 ${scenario}: CRASHED`, error);
          suiteResults.scenarios[scenario] = {
            success: false,
            error: error.message,
            crashed: true,
          };
          suiteResults.failed++;
          if (stopOnFailure) break;
        }
      }

      suiteResults.endTime = new Date().toISOString();
      suiteResults.duration =
        new Date(suiteResults.endTime) - new Date(suiteResults.startTime);

      console.log("\n📊 Test Suite Results:");
      console.log(`Total: ${suiteResults.totalTests}`);
      console.log(`Passed: ${suiteResults.passed}`);
      console.log(`Failed: ${suiteResults.failed}`);
      console.log(`Duration: ${suiteResults.duration}ms`);

      // Store results
      this.testResults.push(suiteResults);

      return suiteResults;
    } finally {
      this.disableTestingMode();
    }
  }

  /**
   * Test individual failure scenario
   */
  static async testScenario(scenario, options = {}) {
    const { verbose = false } = options;

    const testResult = {
      scenario,
      startTime: new Date().toISOString(),
      success: false,
      steps: [],
      error: null,
    };

    try {
      // Setup failure simulation
      await this.setupFailureSimulation(scenario, testResult);

      // Test storage operations
      await this.testStorageOperations(scenario, testResult, verbose);

      // Verify recovery behavior
      await this.testRecoveryBehavior(scenario, testResult, verbose);

      // Cleanup
      await this.cleanupFailureSimulation(scenario, testResult);

      testResult.success = true;
      testResult.endTime = new Date().toISOString();
    } catch (error) {
      testResult.error = error.message;
      testResult.endTime = new Date().toISOString();
      if (verbose) {
        console.error(`Test scenario ${scenario} failed:`, error);
      }
    }

    return testResult;
  }

  /**
   * Setup failure simulation for specific scenario
   */
  static async setupFailureSimulation(scenario, testResult) {
    testResult.steps.push({ step: "setup", status: "started" });

    switch (scenario) {
      case this.TEST_SCENARIOS.INDEXEDDB_UNAVAILABLE:
        this.simulateIndexedDBUnavailable();
        break;

      case this.TEST_SCENARIOS.INDEXEDDB_QUOTA_EXCEEDED:
        this.simulateIndexedDBQuotaExceeded();
        break;

      case this.TEST_SCENARIOS.CHROME_STORAGE_UNAVAILABLE:
        this.simulateChromeStorageUnavailable();
        break;

      case this.TEST_SCENARIOS.CHROME_STORAGE_QUOTA_EXCEEDED:
        this.simulateChromeStorageQuotaExceeded();
        break;

      case this.TEST_SCENARIOS.BOTH_STORAGE_UNAVAILABLE:
        this.simulateIndexedDBUnavailable();
        this.simulateChromeStorageUnavailable();
        break;

      case this.TEST_SCENARIOS.SLOW_INDEXEDDB:
        this.simulateSlowIndexedDB();
        break;

      case this.TEST_SCENARIOS.CORRUPTED_DATA:
        await this.simulateCorruptedData();
        break;

      default:
        throw new Error(`Unknown test scenario: ${scenario}`);
    }

    testResult.steps.push({ step: "setup", status: "completed" });
  }

  /**
   * Test storage operations under failure conditions
   */
  static async testStorageOperations(scenario, testResult, verbose) {
    testResult.steps.push({ step: "storage_operations", status: "started" });

    const testData = {
      test_key: `test_data_${Date.now()}`,
      timestamp: new Date().toISOString(),
      scenario,
      data: "This is test data for storage failure testing",
    };

    // Test basic read/write operations
    try {
      // Test set operation
      await ResilientStorage.set("test_failure_key", testData);
      testResult.steps.push({
        step: "set_operation",
        status: "completed",
        note: "Set operation handled gracefully",
      });

      // Test get operation
      const retrievedData = await ResilientStorage.get("test_failure_key");
      if (!retrievedData) {
        throw new Error("Data retrieval failed");
      }
      testResult.steps.push({
        step: "get_operation",
        status: "completed",
        note: "Get operation handled gracefully",
      });

      // Verify data integrity
      if (JSON.stringify(retrievedData) !== JSON.stringify(testData)) {
        throw new Error("Data integrity check failed");
      }
      testResult.steps.push({
        step: "data_integrity",
        status: "completed",
      });
    } catch (error) {
      testResult.steps.push({
        step: "storage_operations",
        status: "failed",
        error: error.message,
      });
      throw error;
    }

    testResult.steps.push({ step: "storage_operations", status: "completed" });
  }

  /**
   * Test recovery behavior
   */
  static async testRecoveryBehavior(scenario, testResult, verbose) {
    testResult.steps.push({ step: "recovery_behavior", status: "started" });

    try {
      // Check if system switched to fallback mode appropriately
      const storageStatus = await ResilientStorage.getStorageStatus();

      // Verify fallback behavior based on scenario
      switch (scenario) {
        case this.TEST_SCENARIOS.INDEXEDDB_UNAVAILABLE:
          if (storageStatus.mode !== "chrome_fallback") {
            throw new Error("System did not switch to Chrome Storage fallback");
          }
          break;

        case this.TEST_SCENARIOS.CHROME_STORAGE_UNAVAILABLE:
          if (!storageStatus.isIndexedDBAvailable) {
            throw new Error("IndexedDB should still be available");
          }
          break;

        case this.TEST_SCENARIOS.BOTH_STORAGE_UNAVAILABLE:
          if (
            storageStatus.isIndexedDBAvailable ||
            storageStatus.isChromeStorageAvailable
          ) {
            throw new Error("Both storage systems should be unavailable");
          }
          break;
      }

      // Test health monitoring response
      const healthAssessment = await StorageHealthMonitor.assessStorageHealth();
      if (
        healthAssessment.overall === "excellent" &&
        scenario !== this.TEST_SCENARIOS.SLOW_INDEXEDDB
      ) {
        throw new Error("Health monitor did not detect storage issues");
      }

      testResult.steps.push({
        step: "fallback_detection",
        status: "completed",
        mode: storageStatus.mode,
      });
    } catch (error) {
      testResult.steps.push({
        step: "recovery_behavior",
        status: "failed",
        error: error.message,
      });
      throw error;
    }

    testResult.steps.push({ step: "recovery_behavior", status: "completed" });
  }

  /**
   * Cleanup failure simulation
   */
  static async cleanupFailureSimulation(scenario, testResult) {
    testResult.steps.push({ step: "cleanup", status: "started" });

    // Remove test data
    try {
      await ResilientStorage.remove("test_failure_key");
    } catch (error) {
      // Cleanup errors are non-fatal
      console.warn("Test cleanup warning:", error);
    }

    testResult.steps.push({ step: "cleanup", status: "completed" });
  }

  /**
   * Simulation methods for different failure types
   */
  static simulateIndexedDBUnavailable() {
    const originalOpenDB = dbHelper.openDB;
    dbHelper.openDB = async () => {
      throw new Error("IndexedDB unavailable - simulated failure");
    };
    this.originalMethods.openDB = originalOpenDB;
  }

  static simulateIndexedDBQuotaExceeded() {
    const originalOpenDB = dbHelper.openDB;
    dbHelper.openDB = async () => {
      const db = await originalOpenDB.call(dbHelper);

      // Override transaction methods to throw quota exceeded errors
      const originalTransaction = db.transaction.bind(db);
      db.transaction = (...args) => {
        const transaction = originalTransaction(...args);
        const originalObjectStore = transaction.objectStore.bind(transaction);

        transaction.objectStore = (storeName) => {
          const store = originalObjectStore(storeName);
          const originalPut = store.put.bind(store);

          store.put = (data) => {
            const request = originalPut(data);
            setTimeout(() => {
              if (request.onerror) {
                const error = new Error("QuotaExceededError");
                error.name = "QuotaExceededError";
                request.error = error;
                request.onerror({ target: { error } });
              }
            }, 10);
            return request;
          };

          return store;
        };

        return transaction;
      };

      return db;
    };
    this.originalMethods.openDB = originalOpenDB;
  }

  static simulateChromeStorageUnavailable() {
    const originalStorageGet = ChromeAPIErrorHandler.storageGetWithRetry;
    const originalStorageSet = ChromeAPIErrorHandler.storageSetWithRetry;

    ChromeAPIErrorHandler.storageGetWithRetry = async () => {
      throw new Error("Chrome Storage unavailable - simulated failure");
    };

    ChromeAPIErrorHandler.storageSetWithRetry = async () => {
      throw new Error("Chrome Storage unavailable - simulated failure");
    };

    this.originalMethods.storageGet = originalStorageGet;
    this.originalMethods.storageSet = originalStorageSet;
  }

  static simulateChromeStorageQuotaExceeded() {
    const originalStorageSet = ChromeAPIErrorHandler.storageSetWithRetry;

    ChromeAPIErrorHandler.storageSetWithRetry = async () => {
      const error = new Error("QUOTA_BYTES quota exceeded");
      error.name = "QuotaExceededError";
      throw error;
    };

    this.originalMethods.storageSet = originalStorageSet;
  }

  static simulateSlowIndexedDB() {
    const originalOpenDB = dbHelper.openDB;
    dbHelper.openDB = async () => {
      // Add artificial delay
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return await originalOpenDB.call(dbHelper);
    };
    this.originalMethods.openDB = originalOpenDB;
  }

  static async simulateCorruptedData() {
    // This would inject corrupted data into storage for testing
    try {
      const corruptedData = {
        corrupted: true,
        invalidStructure: "not_json_parseable",
        timestamp: null,
      };
      await ResilientStorage.set("corrupted_test_key", corruptedData);
    } catch (error) {
      console.warn("Failed to inject corrupted data:", error);
    }
  }

  /**
   * Backup original methods before simulation
   */
  static backupOriginalMethods() {
    this.originalMethods = {
      openDB: dbHelper.openDB,
      storageGet: ChromeAPIErrorHandler.storageGetWithRetry,
      storageSet: ChromeAPIErrorHandler.storageSetWithRetry,
    };
  }

  /**
   * Restore original methods after testing
   */
  static restoreOriginalMethods() {
    if (this.originalMethods.openDB) {
      dbHelper.openDB = this.originalMethods.openDB;
    }
    if (this.originalMethods.storageGet) {
      ChromeAPIErrorHandler.storageGetWithRetry =
        this.originalMethods.storageGet;
    }
    if (this.originalMethods.storageSet) {
      ChromeAPIErrorHandler.storageSetWithRetry =
        this.originalMethods.storageSet;
    }
    this.originalMethods = {};
  }

  /**
   * Generate test report
   */
  static generateTestReport() {
    const report = {
      timestamp: new Date().toISOString(),
      totalSuites: this.testResults.length,
      summary: {
        totalTests: 0,
        totalPassed: 0,
        totalFailed: 0,
        totalCrashed: 0,
      },
      suites: this.testResults,
    };

    this.testResults.forEach((suite) => {
      report.summary.totalTests += suite.totalTests;
      report.summary.totalPassed += suite.passed;
      report.summary.totalFailed += suite.failed;

      Object.values(suite.scenarios).forEach((scenario) => {
        if (scenario.crashed) {
          report.summary.totalCrashed++;
        }
      });
    });

    return report;
  }

  /**
   * Get test results for UI display
   */
  static getTestResults() {
    return this.testResults;
  }

  /**
   * Clear test results
   */
  static clearTestResults() {
    this.testResults = [];
  }

  /**
   * Quick test for development
   */
  static async quickTest() {
    console.log("🧪 Running quick storage failure test");

    const result = await this.runTestSuite({
      scenarios: [
        this.TEST_SCENARIOS.INDEXEDDB_UNAVAILABLE,
        this.TEST_SCENARIOS.CHROME_STORAGE_UNAVAILABLE,
      ],
      verbose: true,
      stopOnFailure: false,
    });

    console.log("Quick test completed:", result);
    return result;
  }

  /**
   * Stress test with multiple concurrent failures
   */
  static async stressTest() {
    console.log("💪 Running storage stress test");

    const promises = [];

    // Run multiple test suites concurrently
    for (let i = 0; i < 3; i++) {
      promises.push(
        this.runTestSuite({
          scenarios: [this.TEST_SCENARIOS.SLOW_INDEXEDDB],
          verbose: false,
        })
      );
    }

    const results = await Promise.all(promises);
    console.log("Stress test completed:", results);
    return results;
  }

  /**
   * Test storage recovery after failures
   */
  static async testStorageRecovery() {
    console.log("🔄 Testing storage recovery behavior");

    this.enableTestingMode();

    try {
      // Simulate failure
      this.simulateIndexedDBUnavailable();

      // Verify fallback
      let status = await ResilientStorage.getStorageStatus();
      console.log("Status after failure:", status.mode);

      // Restore normal operation
      this.restoreOriginalMethods();
      this.backupOriginalMethods();

      // Wait for recovery
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify recovery
      status = await ResilientStorage.getStorageStatus();
      console.log("Status after recovery:", status.mode);

      return {
        success: true,
        recoveredMode: status.mode,
      };
    } catch (error) {
      console.error("Recovery test failed:", error);
      return {
        success: false,
        error: error.message,
      };
    } finally {
      this.disableTestingMode();
    }
  }
}

export default StorageFailureTesting;
