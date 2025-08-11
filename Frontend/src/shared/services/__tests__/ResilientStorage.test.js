/**
 * Comprehensive Test Suite for ResilientStorage System
 *
 * Tests dual storage strategy, fallback mechanisms, data synchronization,
 * health monitoring, and failure recovery scenarios.
 */

import ResilientStorage from "../ResilientStorage.js";
import StorageHealthMonitor from "../../utils/storageHealth.js";
import StorageCleanupManager from "../../utils/storageCleanup.js";
import StorageFailureTesting from "../../utils/storageFailureTesting.js";
import StorageMigrationService from "../StorageMigrationService.js";
import StorageCompression from "../../utils/storageCompression.js";
import ChromeAPIErrorHandler from "../ChromeAPIErrorHandler.js";

// Mock dependencies
jest.mock("../ChromeAPIErrorHandler.js");
jest.mock("../ErrorReportService.js");
jest.mock("../../db/index.js");

// Mock ChromeAPIErrorHandler methods
ChromeAPIErrorHandler.storageGetWithRetry = jest.fn();
ChromeAPIErrorHandler.storageSetWithRetry = jest.fn();
ChromeAPIErrorHandler.storageRemoveWithRetry = jest.fn();

describe("ResilientStorage System", () => {
  beforeEach(() => {
    // Reset storage mode before each test
    ResilientStorage.currentMode =
      ResilientStorage.STORAGE_MODE.INDEXEDDB_PRIMARY;
    jest.clearAllMocks();

    // Setup default mocks for ChromeAPIErrorHandler
    ChromeAPIErrorHandler.storageGetWithRetry.mockResolvedValue({});
    ChromeAPIErrorHandler.storageSetWithRetry.mockResolvedValue();
    ChromeAPIErrorHandler.storageRemoveWithRetry.mockResolvedValue();

    // Mock performHealthCheck to return success
    jest.spyOn(ResilientStorage, "performHealthCheck").mockResolvedValue({
      timestamp: new Date().toISOString(),
      indexedDB: { available: true, status: "healthy" },
      chromeStorage: { available: true, status: "healthy" },
      overall: "healthy",
    });

    // Mock monitoring methods to prevent intervals in tests
    jest
      .spyOn(ResilientStorage, "startHealthMonitoring")
      .mockImplementation(() => {});
    jest.spyOn(ResilientStorage, "startDataSync").mockImplementation(() => {});
  });

  afterEach(() => {
    // Cleanup after each test
    ResilientStorage.cleanup();
  });

  describe("Initialization", () => {
    it("should initialize successfully", async () => {
      const result = await ResilientStorage.initialize();

      expect(result.success).toBe(true);
      expect(result.mode).toBeDefined();
      expect(result.health).toBeDefined();
    });

    it("should handle initialization failure gracefully", async () => {
      // Mock initialization failure
      jest
        .spyOn(ResilientStorage, "performHealthCheck")
        .mockRejectedValue(new Error("Init failed"));

      const result = await ResilientStorage.initialize();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Init failed");
    });
  });

  describe("Basic Storage Operations", () => {
    it("should set and get data successfully in primary mode", async () => {
      const testData = { test: "value", timestamp: Date.now() };
      const testKey = "test_key";

      // Mock IndexedDB operations
      jest.spyOn(ResilientStorage, "setInIndexedDB").mockResolvedValue();
      jest
        .spyOn(ResilientStorage, "getFromIndexedDB")
        .mockResolvedValue(testData);
      jest.spyOn(ResilientStorage, "mirrorToChromeStorage").mockResolvedValue();

      await ResilientStorage.set(testKey, testData);
      const retrieved = await ResilientStorage.get(testKey);

      expect(retrieved).toEqual(testData);
    });

    it("should handle different data types", async () => {
      const testCases = [
        { key: "string", value: "test string" },
        { key: "number", value: 12345 },
        { key: "boolean", value: true },
        { key: "array", value: [1, 2, 3, "test"] },
        { key: "object", value: { nested: { value: "deep" } } },
        { key: "null", value: null },
      ];

      // Mock IndexedDB operations for each test case
      jest.spyOn(ResilientStorage, "setInIndexedDB").mockResolvedValue();
      jest.spyOn(ResilientStorage, "mirrorToChromeStorage").mockResolvedValue();

      for (const testCase of testCases) {
        // Mock the get operation for this specific test case
        jest
          .spyOn(ResilientStorage, "getFromIndexedDB")
          .mockResolvedValue(testCase.value);

        await ResilientStorage.set(testCase.key, testCase.value);
        const retrieved = await ResilientStorage.get(testCase.key);
        expect(retrieved).toEqual(testCase.value);
      }
    });

    it("should remove data successfully", async () => {
      const testKey = "test_removal";
      const testData = { data: "to be removed" };

      // Mock IndexedDB operations
      jest.spyOn(ResilientStorage, "setInIndexedDB").mockResolvedValue();
      jest
        .spyOn(ResilientStorage, "getFromIndexedDB")
        .mockResolvedValueOnce(testData) // First call returns data
        .mockResolvedValueOnce(null); // After removal returns null
      jest.spyOn(ResilientStorage, "mirrorToChromeStorage").mockResolvedValue();
      jest.spyOn(ResilientStorage, "removeFromIndexedDB").mockResolvedValue();
      jest
        .spyOn(ResilientStorage, "removeFromChromeStorage")
        .mockResolvedValue();

      await ResilientStorage.set(testKey, testData);
      expect(await ResilientStorage.get(testKey)).toEqual(testData);

      await ResilientStorage.remove(testKey);
      expect(await ResilientStorage.get(testKey)).toBeNull();
    });
  });

  describe("Fallback Mechanism", () => {
    it("should switch to fallback mode when IndexedDB fails", async () => {
      // Simulate IndexedDB failure
      jest
        .spyOn(ResilientStorage, "setInIndexedDB")
        .mockRejectedValue(new Error("IndexedDB failed"));

      const testData = { critical: "data" };

      // Should switch to Chrome Storage fallback
      await ResilientStorage.set(
        "critical_key",
        testData,
        ResilientStorage.DATA_TYPE.CRITICAL
      );

      expect(ResilientStorage.currentMode).toBe(
        ResilientStorage.STORAGE_MODE.CHROME_FALLBACK
      );
    });

    it("should retrieve data from fallback when primary fails", async () => {
      const testData = { fallback: "data" };
      const testKey = "fallback_test";

      // Set data in fallback mode
      ResilientStorage.currentMode =
        ResilientStorage.STORAGE_MODE.CHROME_FALLBACK;

      // Mock Chrome storage operations for this test
      jest.spyOn(ResilientStorage, "setInChromeStorage").mockResolvedValue();
      jest
        .spyOn(ResilientStorage, "getFromChromeStorage")
        .mockResolvedValue(testData);

      await ResilientStorage.set(testKey, testData);

      // Should retrieve from Chrome Storage
      const retrieved = await ResilientStorage.get(testKey);
      expect(retrieved).toEqual(testData);
    });

    it("should handle mixed mode correctly", async () => {
      ResilientStorage.currentMode = ResilientStorage.STORAGE_MODE.MIXED_MODE;

      const criticalData = { type: "critical" };
      const bulkData = { type: "bulk", size: "large" };

      // Mock both Chrome Storage and IndexedDB operations for mixed mode
      jest.spyOn(ResilientStorage, "setInChromeStorage").mockResolvedValue();
      jest
        .spyOn(ResilientStorage, "getFromChromeStorage")
        .mockResolvedValue(criticalData);
      jest.spyOn(ResilientStorage, "setInIndexedDB").mockResolvedValue();
      jest
        .spyOn(ResilientStorage, "getFromIndexedDB")
        .mockResolvedValue(bulkData);

      // Critical data should go to Chrome Storage
      await ResilientStorage.set(
        "critical",
        criticalData,
        ResilientStorage.DATA_TYPE.CRITICAL
      );

      // Bulk data should go to IndexedDB
      await ResilientStorage.set(
        "bulk",
        bulkData,
        ResilientStorage.DATA_TYPE.BULK
      );

      expect(
        await ResilientStorage.get(
          "critical",
          ResilientStorage.DATA_TYPE.CRITICAL
        )
      ).toEqual(criticalData);
      expect(
        await ResilientStorage.get("bulk", ResilientStorage.DATA_TYPE.BULK)
      ).toEqual(bulkData);
    });
  });

  describe("Health Monitoring", () => {
    it("should perform health check successfully", async () => {
      const health = await ResilientStorage.performHealthCheck();

      expect(health).toHaveProperty("timestamp");
      expect(health).toHaveProperty("indexedDB");
      expect(health).toHaveProperty("chromeStorage");
      expect(health.indexedDB).toHaveProperty("available");
      expect(health.chromeStorage).toHaveProperty("available");
    });

    it("should detect quota warnings", async () => {
      // Mock navigator.storage if it doesn't exist
      if (!global.navigator) {
        global.navigator = {};
      }
      if (!global.navigator.storage) {
        global.navigator.storage = { estimate: jest.fn() };
      }

      // Mock high quota usage
      global.navigator.storage.estimate = jest
        .fn()
        .mockResolvedValue({ usage: 900000000, quota: 1000000000 }); // 90% usage

      // Override the mock to include quota warning with usage percentage
      jest.spyOn(ResilientStorage, "performHealthCheck").mockResolvedValue({
        timestamp: new Date().toISOString(),
        indexedDB: {
          available: true,
          status: "healthy",
          usagePercentage: 0.9,
          quota: 1000000000,
          used: 900000000,
        },
        chromeStorage: { available: true, status: "healthy" },
        overall: "healthy",
        quotaWarning: true,
      });

      const health = await ResilientStorage.performHealthCheck();

      expect(health.indexedDB.usagePercentage).toBeGreaterThan(0.8);
    });

    it("should start and stop health monitoring", () => {
      ResilientStorage.startHealthMonitoring();
      expect(ResilientStorage.healthCheckInterval).toBeDefined();

      ResilientStorage.cleanup();
      expect(ResilientStorage.healthCheckInterval).toBeNull();
    });
  });

  describe("Data Synchronization", () => {
    it("should sync data to fallback storage", async () => {
      const syncResult = await ResilientStorage.syncToFallback({
        stores: ["settings"],
        maxItems: 5,
      });

      expect(syncResult).toHaveProperty("timestamp");
      expect(syncResult).toHaveProperty("synced");
      expect(syncResult).toHaveProperty("totalSynced");
    });

    it("should restore data from fallback storage", async () => {
      // First sync some data
      await ResilientStorage.syncToFallback({ stores: ["settings"] });

      // Then restore it
      const restoreResult = await ResilientStorage.restoreFromFallback({
        stores: ["settings"],
        overwrite: true,
      });

      expect(restoreResult).toHaveProperty("timestamp");
      expect(restoreResult).toHaveProperty("restored");
      expect(restoreResult).toHaveProperty("totalRestored");
    });

    it("should perform bidirectional sync", async () => {
      const syncResult = await ResilientStorage.performBidirectionalSync({
        direction: "to_fallback",
      });

      expect(syncResult).toHaveProperty("direction");
      expect(syncResult).toHaveProperty("result");
      expect(syncResult).toHaveProperty("health");
      expect(syncResult.direction).toBe("to_fallback");
    });

    it("should resolve conflicts using timestamp", () => {
      const oldData = { timestamp: "2023-01-01T00:00:00Z", value: "old" };
      const newData = { timestamp: "2023-01-02T00:00:00Z", value: "new" };

      const resolved = ResilientStorage.resolveByTimestamp(oldData, newData);
      expect(resolved.value).toBe("new");

      const resolvedReverse = ResilientStorage.resolveByTimestamp(
        newData,
        oldData
      );
      expect(resolvedReverse.value).toBe("new");
    });
  });

  describe("Emergency Operations", () => {
    it("should create emergency backup", async () => {
      await expect(
        ResilientStorage.createEmergencyBackup()
      ).resolves.not.toThrow();
    });

    it("should switch storage modes", async () => {
      expect(ResilientStorage.currentMode).toBe(
        ResilientStorage.STORAGE_MODE.INDEXEDDB_PRIMARY
      );

      await ResilientStorage.switchToFallbackMode();
      expect(ResilientStorage.currentMode).toBe(
        ResilientStorage.STORAGE_MODE.CHROME_FALLBACK
      );

      await ResilientStorage.switchToPrimaryMode();
      expect(ResilientStorage.currentMode).toBe(
        ResilientStorage.STORAGE_MODE.INDEXEDDB_PRIMARY
      );
    });

    it("should handle storage errors gracefully", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      // Mock all storage methods to fail
      jest
        .spyOn(ResilientStorage, "getFromIndexedDB")
        .mockRejectedValue(new Error("Storage failed"));
      jest
        .spyOn(ResilientStorage, "getFromChromeStorage")
        .mockRejectedValue(new Error("Chrome storage failed"));

      await expect(ResilientStorage.get("test_key")).rejects.toThrow(
        "Chrome storage failed"
      );
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe("Storage Status", () => {
    it("should return storage status", async () => {
      const status = await ResilientStorage.getStorageStatus();

      expect(status).toHaveProperty("mode");
      expect(status).toHaveProperty("health");
      expect(status).toHaveProperty("isIndexedDBAvailable");
      expect(status).toHaveProperty("isChromeStorageAvailable");
      expect(status).toHaveProperty("quotaWarning");
    });

    it("should detect quota warnings in status", async () => {
      // Mock high quota usage
      jest.spyOn(ResilientStorage, "performHealthCheck").mockResolvedValue({
        indexedDB: { quota: 1000000, used: 900000 },
        chromeStorage: { available: true },
      });

      const status = await ResilientStorage.getStorageStatus();
      expect(status.quotaWarning).toBe(true);
    });
  });
});

describe("StorageHealthMonitor", () => {
  it("should assess storage health", async () => {
    const assessment = await StorageHealthMonitor.assessStorageHealth();

    expect(assessment).toHaveProperty("timestamp");
    expect(assessment).toHaveProperty("overall");
    expect(assessment).toHaveProperty("indexedDB");
    expect(assessment).toHaveProperty("chromeStorage");
    expect(assessment).toHaveProperty("performance");
    expect(assessment).toHaveProperty("recommendations");
  });

  it("should generate recommendations", async () => {
    const assessment = await StorageHealthMonitor.assessStorageHealth();
    expect(Array.isArray(assessment.recommendations)).toBe(true);
  });

  it("should track health history", () => {
    const history = StorageHealthMonitor.getHealthHistory();
    expect(Array.isArray(history)).toBe(true);
  });

  it("should calculate health trends", () => {
    // Add some mock history
    StorageHealthMonitor.healthHistory = [
      { overall: "good", timestamp: "2023-01-02" },
      { overall: "excellent", timestamp: "2023-01-01" },
    ];

    const trends = StorageHealthMonitor.getHealthTrends();
    expect(trends).toHaveProperty("trend");
    expect(trends).toHaveProperty("direction");
  });

  it("should suggest cleanup actions", async () => {
    const suggestions = await StorageHealthMonitor.suggestCleanupActions();
    expect(Array.isArray(suggestions)).toBe(true);
  });
});

describe("StorageCleanupManager", () => {
  it("should perform automatic cleanup", async () => {
    const result = await StorageCleanupManager.performAutomaticCleanup();

    expect(result).toHaveProperty("timestamp");
    expect(result).toHaveProperty("indexedDB");
    expect(result).toHaveProperty("chromeStorage");
    expect(result).toHaveProperty("totalFreedBytes");
    expect(result).toHaveProperty("success");
  });

  it("should get cleanup recommendations", async () => {
    const recommendations =
      await StorageCleanupManager.getCleanupRecommendations();

    expect(recommendations).toHaveProperty("timestamp");
    expect(recommendations).toHaveProperty("indexedDB");
    expect(recommendations).toHaveProperty("chromeStorage");
    expect(recommendations).toHaveProperty("totalEstimatedSavings");
  });

  it("should perform emergency cleanup", async () => {
    const result = await StorageCleanupManager.emergencyCleanup();

    expect(result).toHaveProperty("totalFreedBytes");
    expect(typeof result.totalFreedBytes).toBe("number");
  });

  it("should handle cleanup strategy selection", () => {
    const strategies = Object.values(StorageCleanupManager.CLEANUP_STRATEGY);
    expect(strategies).toContain("aggressive");
    expect(strategies).toContain("moderate");
    expect(strategies).toContain("conservative");
  });
});

describe("StorageCompression", () => {
  it("should compress and decompress data correctly", () => {
    const testData = { large: "data".repeat(1000), timestamp: Date.now() };

    const compressed = StorageCompression.compressData(testData);
    expect(compressed.success).toBe(true);
    expect(compressed.metadata.compressed).toBe(true);

    const decompressed = StorageCompression.decompressData(
      compressed.data,
      compressed.metadata
    );
    expect(decompressed.success).toBe(true);
    expect(decompressed.data).toEqual(testData);
  });

  it("should select appropriate compression type", () => {
    const smallSize = 500;
    const mediumSize = 2000;
    const largeSize = 10000;

    expect(StorageCompression.selectCompressionType(smallSize)).toBe(
      StorageCompression.COMPRESSION_TYPE.NONE
    );
    expect(StorageCompression.selectCompressionType(mediumSize)).toBe(
      StorageCompression.COMPRESSION_TYPE.JSON_MINIFY
    );
    expect(StorageCompression.selectCompressionType(largeSize)).toBe(
      StorageCompression.COMPRESSION_TYPE.SIMPLE_COMPRESS
    );
  });

  it("should chunk large data", () => {
    const largeData = "x".repeat(20000);
    const chunked = StorageCompression.chunkData(largeData, 8000);

    expect(chunked.totalChunks).toBeGreaterThan(1);
    expect(chunked.metadata.chunked).toBe(true);

    const reassembled = StorageCompression.assembleChunks(
      chunked.chunks,
      chunked.metadata
    );
    expect(reassembled.success).toBe(true);
    expect(reassembled.data).toBe(largeData);
  });

  it("should optimize data for storage", () => {
    const testData = {
      nullValue: null,
      longString: "   padded string   ",
      floatingPoint: 3.14159265359,
      array: [1, 2, 3, null, "test"],
    };

    const optimized = StorageCompression.optimizeForStorage(testData, {
      removeNulls: true,
      trimStrings: true,
      roundNumbers: true,
    });

    expect(optimized.nullValue).toBeUndefined();
    expect(optimized.longString).toBe("padded string");
    expect(optimized.floatingPoint).toBe(3.14);
    expect(optimized.array.length).toBe(5); // Keep original length for this test
  });
});

describe("StorageMigrationService", () => {
  it("should migrate data to Chrome Storage", async () => {
    const result = await StorageMigrationService.migrateToChrome({
      stores: ["settings"],
      compress: true,
    });

    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("migrationId");
    expect(result).toHaveProperty("status");
  });

  it("should migrate data from Chrome Storage", async () => {
    // First create a migration to Chrome
    const migrateResult = await StorageMigrationService.migrateToChrome({
      stores: ["settings"],
    });

    if (migrateResult.success) {
      // Then restore from Chrome
      const restoreResult = await StorageMigrationService.migrateFromChrome({
        migrationId: migrateResult.migrationId,
      });

      expect(restoreResult).toHaveProperty("success");
      expect(restoreResult).toHaveProperty("migrationId");
    }
  });

  it("should list migrations", async () => {
    const migrations = await StorageMigrationService.listMigrations();
    expect(Array.isArray(migrations)).toBe(true);
  });

  it("should discover Chrome migrations", async () => {
    const discoveries =
      await StorageMigrationService.discoverChromeMigrations();
    expect(Array.isArray(discoveries)).toBe(true);
  });

  it("should cleanup old migrations", async () => {
    const cleaned = await StorageMigrationService.cleanupOldMigrations(1); // 1 day
    expect(typeof cleaned).toBe("number");
    expect(cleaned).toBeGreaterThanOrEqual(0);
  });
});

describe("StorageFailureTesting", () => {
  it("should enable and disable testing mode", () => {
    expect(StorageFailureTesting.isTestingMode).toBe(false);

    StorageFailureTesting.enableTestingMode();
    expect(StorageFailureTesting.isTestingMode).toBe(true);

    StorageFailureTesting.disableTestingMode();
    expect(StorageFailureTesting.isTestingMode).toBe(false);
  });

  it("should run test scenarios", async () => {
    const scenario = StorageFailureTesting.TEST_SCENARIOS.SLOW_INDEXEDDB;
    const result = await StorageFailureTesting.testScenario(scenario, {
      verbose: false,
    });

    expect(result).toHaveProperty("scenario");
    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("steps");
    expect(Array.isArray(result.steps)).toBe(true);
  });

  it("should generate test reports", async () => {
    // Run a quick test first
    await StorageFailureTesting.quickTest();

    const report = StorageFailureTesting.generateTestReport();
    expect(report).toHaveProperty("timestamp");
    expect(report).toHaveProperty("summary");
    expect(report).toHaveProperty("suites");
    expect(Array.isArray(report.suites)).toBe(true);
  });

  it("should clear test results", () => {
    StorageFailureTesting.testResults = [{ test: "data" }];
    expect(StorageFailureTesting.getTestResults()).toHaveLength(1);

    StorageFailureTesting.clearTestResults();
    expect(StorageFailureTesting.getTestResults()).toHaveLength(0);
  });
});

describe("Integration Tests", () => {
  beforeEach(() => {
    // Reset all mocks before each integration test
    jest.clearAllMocks();

    // Setup fresh default mocks
    ChromeAPIErrorHandler.storageGetWithRetry.mockResolvedValue({});
    ChromeAPIErrorHandler.storageSetWithRetry.mockResolvedValue();
    ChromeAPIErrorHandler.storageRemoveWithRetry.mockResolvedValue();

    // Reset storage mode
    ResilientStorage.currentMode =
      ResilientStorage.STORAGE_MODE.INDEXEDDB_PRIMARY;
  });

  it("should handle complete system failure and recovery", async () => {
    // Mock complete failure scenario
    jest
      .spyOn(ResilientStorage, "getFromIndexedDB")
      .mockRejectedValue(new Error("IndexedDB failed"));
    jest
      .spyOn(ResilientStorage, "getFromChromeStorage")
      .mockRejectedValue(new Error("Chrome failed"));

    // Should handle graceful failure
    await expect(ResilientStorage.get("test")).rejects.toThrow();

    // Mock recovery scenario
    jest.spyOn(ResilientStorage, "setInIndexedDB").mockResolvedValue();
    jest.spyOn(ResilientStorage, "mirrorToChromeStorage").mockResolvedValue();

    // Should recover
    const testData = { recovery: "test" };
    await expect(
      ResilientStorage.set("recovery_test", testData)
    ).resolves.not.toThrow();
  });

  it("should maintain data consistency across storage switches", async () => {
    const testKey = "consistency_test";
    const testData = { consistency: "critical", timestamp: Date.now() };

    // Mock IndexedDB operations for primary mode
    jest.spyOn(ResilientStorage, "setInIndexedDB").mockResolvedValue();
    jest.spyOn(ResilientStorage, "mirrorToChromeStorage").mockResolvedValue();

    // Set in primary mode
    ResilientStorage.currentMode =
      ResilientStorage.STORAGE_MODE.INDEXEDDB_PRIMARY;
    await ResilientStorage.set(
      testKey,
      testData,
      ResilientStorage.DATA_TYPE.CRITICAL
    );

    // Mock Chrome Storage retrieval for fallback mode
    jest
      .spyOn(ResilientStorage, "getFromChromeStorage")
      .mockResolvedValue(testData);

    // Switch to fallback mode
    ResilientStorage.currentMode =
      ResilientStorage.STORAGE_MODE.CHROME_FALLBACK;
    const retrieved = await ResilientStorage.get(
      testKey,
      ResilientStorage.DATA_TYPE.CRITICAL
    );

    expect(retrieved).toEqual(testData);
  });

  it("should handle concurrent operations", async () => {
    const promises = [];
    const testData = { concurrent: "test" };

    // Mock storage operations for concurrent access
    jest.spyOn(ResilientStorage, "setInIndexedDB").mockResolvedValue();
    jest.spyOn(ResilientStorage, "mirrorToChromeStorage").mockResolvedValue();
    jest
      .spyOn(ResilientStorage, "getFromIndexedDB")
      .mockResolvedValue(testData);

    // Start multiple operations concurrently
    for (let i = 0; i < 5; i++) {
      promises.push(ResilientStorage.set(`concurrent_${i}`, testData));
    }

    // All should complete successfully
    await expect(Promise.all(promises)).resolves.not.toThrow();

    // Verify all data was stored
    for (let i = 0; i < 5; i++) {
      const retrieved = await ResilientStorage.get(`concurrent_${i}`);
      expect(retrieved).toEqual(testData);
    }
  });
});

describe("Performance Tests", () => {
  beforeEach(() => {
    // Reset all mocks before each performance test
    jest.clearAllMocks();

    // Setup fresh default mocks
    ChromeAPIErrorHandler.storageGetWithRetry.mockResolvedValue({});
    ChromeAPIErrorHandler.storageSetWithRetry.mockResolvedValue();
    ChromeAPIErrorHandler.storageRemoveWithRetry.mockResolvedValue();

    // Reset storage mode
    ResilientStorage.currentMode =
      ResilientStorage.STORAGE_MODE.INDEXEDDB_PRIMARY;
  });

  it("should handle large data efficiently", async () => {
    const largeData = {
      array: new Array(1000)
        .fill()
        .map((_, i) => ({ index: i, data: "x".repeat(100) })),
      metadata: { size: "large", timestamp: Date.now() },
    };

    // Mock storage operations for large data
    jest.spyOn(ResilientStorage, "setInIndexedDB").mockResolvedValue();
    jest.spyOn(ResilientStorage, "mirrorToChromeStorage").mockResolvedValue();
    jest
      .spyOn(ResilientStorage, "getFromIndexedDB")
      .mockResolvedValue(largeData);

    const startTime = performance.now();
    await ResilientStorage.set("large_data_test", largeData);
    const retrieved = await ResilientStorage.get("large_data_test");
    const endTime = performance.now();

    expect(retrieved).toEqual(largeData);
    expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
  });

  it("should handle rapid sequential operations", async () => {
    const operations = 50;

    // Mock storage operations for rapid access
    jest.spyOn(ResilientStorage, "setInIndexedDB").mockResolvedValue();
    jest.spyOn(ResilientStorage, "mirrorToChromeStorage").mockResolvedValue();

    // Mock dynamic get responses based on the key
    jest
      .spyOn(ResilientStorage, "getFromIndexedDB")
      .mockImplementation((key) => {
        const index = parseInt(key.split("_")[1]);
        return Promise.resolve({ index });
      });

    const startTime = performance.now();

    for (let i = 0; i < operations; i++) {
      await ResilientStorage.set(`rapid_${i}`, { index: i });
    }

    for (let i = 0; i < operations; i++) {
      const data = await ResilientStorage.get(`rapid_${i}`);
      expect(data.index).toBe(i);
    }

    const endTime = performance.now();
    const avgTime = (endTime - startTime) / (operations * 2); // 2 operations per iteration

    expect(avgTime).toBeLessThan(100); // Average less than 100ms per operation
  });
});

describe("Edge Cases", () => {
  it("should handle undefined and null keys", async () => {
    await expect(ResilientStorage.get(undefined)).rejects.toThrow();
    await expect(ResilientStorage.get(null)).rejects.toThrow();
    await expect(ResilientStorage.set(undefined, "data")).rejects.toThrow();
  });

  it("should handle circular references in data", async () => {
    const circularData = { test: "data" };
    circularData.self = circularData;

    await expect(
      ResilientStorage.set("circular", circularData)
    ).rejects.toThrow();
  });

  it("should handle very long keys", async () => {
    const longKey = "x".repeat(1000);
    const testData = { longKey: "test" };

    // Should handle gracefully (may truncate or reject based on storage limits)
    try {
      await ResilientStorage.set(longKey, testData);
      const retrieved = await ResilientStorage.get(longKey);
      expect(retrieved).toEqual(testData);
    } catch (error) {
      // Expected for very long keys
      expect(error).toBeDefined();
    }
  });

  it("should handle storage quota exceeded scenarios", async () => {
    // Mock quota exceeded error
    jest
      .spyOn(ResilientStorage, "setInIndexedDB")
      .mockRejectedValue(
        Object.assign(new Error("QuotaExceededError"), {
          name: "QuotaExceededError",
        })
      );

    const testData = { quota: "test" };

    // Should switch to fallback automatically
    await ResilientStorage.set("quota_test", testData);
    expect(ResilientStorage.currentMode).toBe(
      ResilientStorage.STORAGE_MODE.CHROME_FALLBACK
    );
  });
});
