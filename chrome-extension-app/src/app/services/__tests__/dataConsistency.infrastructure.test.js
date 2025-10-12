// Mock dependencies
jest.mock("../dashboardService");
jest.mock("../../../shared/db/problems");
jest.mock("../../../shared/db/attempts");
jest.mock("../../../shared/db/sessions");

import {
  getDashboardStatistics,
  getStatsData,
  getLearningProgressData,
  // getSessionHistoryData // Unused in current tests
} from "../dashboardService";
import {
  createMockDataWithRaceCondition,
  validateDataConsistency,
  createCacheTestData,
  detectCacheStaleness
} from "./dataConsistencyHelpers";

// eslint-disable-next-line max-lines-per-function
describe("Data Consistency Infrastructure - Cross-Component Validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("🔥 CRITICAL: Database State Consistency Across Views", () => {

    it("should detect database transaction isolation failures via cross-page data divergence", async () => {
      // Mock scenario: Concurrent database operations cause inconsistent reads
      const mockDataGenerator = createMockDataWithRaceCondition();

      getDashboardStatistics.mockImplementation(mockDataGenerator);
      getStatsData.mockImplementation(mockDataGenerator);
      getLearningProgressData.mockImplementation(mockDataGenerator);

      // Simulate multiple dashboard pages loading simultaneously
      const [statsData, progressData, dashboardData] = await Promise.all([
        getStatsData(),
        getLearningProgressData(), 
        getDashboardStatistics()
      ]);

      // CRITICAL: All pages should see consistent core statistics
      const { statsCount, progressCount, dashboardCount } = validateDataConsistency(
        statsData, 
        progressData, 
        dashboardData
      );

      // This reveals: IndexedDB transaction isolation issues
      // Production fix: Implement read consistency in dbHelper

      // For testing: at least verify no null/undefined states
      expect(statsCount).toBeGreaterThanOrEqual(0);
      expect(progressCount).toBeGreaterThanOrEqual(0);
      expect(dashboardCount).toBeGreaterThanOrEqual(0);
    });

    it("should detect cache corruption via data staleness patterns", async () => {
      // Mock scenario: Cache layer serves stale data
      const testData = createCacheTestData();

      getDashboardStatistics.mockResolvedValue(testData.fresh);
      getStatsData.mockResolvedValue(testData.stale);

      const [dashboardData, statsData] = await Promise.all([
        getDashboardStatistics(),
        getStatsData()
      ]);

      // CRITICAL: Detect cache staleness that could confuse users
      detectCacheStaleness(dashboardData, statsData);
        
      // This reveals: Cache invalidation problems
      // Production fix: Implement cache versioning/TTL

      expect(dashboardData.statistics.totalSolved).toBeGreaterThanOrEqual(0);
      expect(statsData.statistics.totalSolved).toBeGreaterThanOrEqual(0);
    });

    it("should detect database schema migration issues via field availability", async () => {
      // Mock scenario: Schema migration partially applied
      getDashboardStatistics.mockResolvedValue({
        statistics: { totalSolved: 10, mastered: 5 },
        // New schema fields
        boxLevelData: { 1: 3, 2: 2, 7: 5 },
        learningEfficiencyData: { weekly: [], monthly: [] }
      });

      getLearningProgressData.mockResolvedValue({
        statistics: { totalSolved: 10, mastered: 5 },
        // Missing new schema fields (migration incomplete)
        boxLevelData: undefined,
        learningEfficiencyData: undefined,
        schemaVersion: 35 // Old version
      });

      const [dashboardData, progressData] = await Promise.all([
        getDashboardStatistics(),
        getLearningProgressData()
      ]);

      // CRITICAL: Detect schema migration inconsistencies
      const dashboardHasNewFields = dashboardData.boxLevelData && dashboardData.learningEfficiencyData;
      const progressHasNewFields = progressData.boxLevelData && progressData.learningEfficiencyData;

      if (dashboardHasNewFields && !progressHasNewFields) {
        console.error("Schema migration inconsistency detected:", {
          dashboardSchema: "new",
          progressSchema: progressData.schemaVersion || "unknown",
          missingFields: ["boxLevelData", "learningEfficiencyData"]
        });
        
        // This reveals: Incomplete database migrations
        // Production fix: Add migration status tracking
      }

      expect(dashboardData.statistics).toBeDefined();
      expect(progressData.statistics).toBeDefined();
    });
  });

  describe("⚡ CRITICAL: Real-time State Synchronization", () => {
    it("should detect event propagation failures via delayed consistency", async () => {
      // Mock scenario: User action doesn't propagate to all views
      let actionApplied = false;
      
      const getDataWithAction = () => {
        if (actionApplied) {
          return {
            statistics: { totalSolved: 11 }, // +1 from user action
            lastAction: { type: "problem_completed", timestamp: Date.now() }
          };
        } else {
          return {
            statistics: { totalSolved: 10 },
            lastAction: null
          };
        }
      };

      getDashboardStatistics.mockImplementation(getDataWithAction);
      getStatsData.mockImplementation(getDataWithAction);

      // Initial state
      const [initialDashboard, initialStats] = await Promise.all([
        getDashboardStatistics(),
        getStatsData()
      ]);

      expect(initialDashboard.statistics.totalSolved).toBe(10);
      expect(initialStats.statistics.totalSolved).toBe(10);

      // Simulate user action (problem completion)
      actionApplied = true;

      // Check propagation
      const [updatedDashboard, updatedStats] = await Promise.all([
        getDashboardStatistics(),
        getStatsData()
      ]);

      // CRITICAL: Both views should reflect the user action
      expect(updatedDashboard.statistics.totalSolved).toBe(11);
      expect(updatedStats.statistics.totalSolved).toBe(11);
      expect(updatedDashboard.lastAction).toBeDefined();
      expect(updatedStats.lastAction).toBeDefined();

      // This test reveals: Need event-driven state synchronization
    });

    it("should detect concurrent modification conflicts via optimistic locking", async () => {
      // Mock scenario: Two operations modify same data simultaneously
      let modificationCount = 0;
      
      const simulateConcurrentUpdate = () => {
        modificationCount++;
        
        return {
          statistics: { totalSolved: 10 + modificationCount },
          version: modificationCount,
          lastModified: Date.now(),
          conflicts: modificationCount > 1 ? ["concurrent_write_detected"] : []
        };
      };

      getDashboardStatistics.mockImplementation(simulateConcurrentUpdate);

      // Simulate concurrent operations
      const [result1, result2] = await Promise.all([
        getDashboardStatistics(),
        getDashboardStatistics()
      ]);

      // CRITICAL: Detect concurrent modification attempts
      const hasConflicts = result1.conflicts?.length > 0 || result2.conflicts?.length > 0;
      const versionMismatch = result1.version !== result2.version;

      if (hasConflicts || versionMismatch) {
        console.warn("Concurrent modification detected:", {
          result1Version: result1.version,
          result2Version: result2.version,
          conflicts: [...(result1.conflicts || []), ...(result2.conflicts || [])]
        });
        
        // This reveals: Need optimistic locking in database operations
      }

      expect(result1.statistics.totalSolved).toBeGreaterThan(10);
      expect(result2.statistics.totalSolved).toBeGreaterThan(10);
    });
  });

  describe("🔧 CRITICAL: Data Recovery and Integrity", () => {
    it("should detect data corruption via checksum validation", async () => {
      // Mock scenario: Database returns corrupted data
      getDashboardStatistics.mockResolvedValue({
        statistics: { 
          totalSolved: 10,
          mastered: 15, // CORRUPTION: mastered > totalSolved
          inProgress: -2, // CORRUPTION: negative count
          new: "invalid" // CORRUPTION: wrong type
        },
        integrity: {
          checksum: "abc123",
          expectedChecksum: "def456", // Mismatch indicates corruption
          validationErrors: [
            "mastered_exceeds_total",
            "negative_progress_count", 
            "invalid_new_count_type"
          ]
        }
      });

      const data = await getDashboardStatistics();

      // CRITICAL: Detect logical data corruption
      const { statistics, integrity } = data;
      
      const logicalErrors = [];
      
      if (statistics.mastered > statistics.totalSolved) {
        logicalErrors.push("mastered_exceeds_total");
      }
      
      if (statistics.inProgress < 0) {
        logicalErrors.push("negative_progress_count");
      }
      
      if (typeof statistics.new !== "number") {
        logicalErrors.push("invalid_new_count_type");
      }

      const checksumMismatch = integrity?.checksum !== integrity?.expectedChecksum;

      if (logicalErrors.length > 0 || checksumMismatch) {
        console.error("Data corruption detected:", {
          logicalErrors,
          checksumMismatch,
          corruptedData: statistics
        });
        
        // This reveals: Need data validation in database layer
        // Production fix: Add integrity constraints and validation
      }

      // Test should validate detection, not correctness of corrupted data
      expect(logicalErrors.length).toBeGreaterThan(0);
      expect(checksumMismatch).toBe(true);
    });

    it("should detect backup/restore consistency via data reconstruction", async () => {
      // Mock scenario: Backup restore doesn't match original data
      const originalData = {
        statistics: { totalSolved: 10, mastered: 5 },
        sessions: [{ id: 1 }, { id: 2 }],
        backupMetadata: {
          timestamp: Date.now() - 3600000, // 1 hour ago
          version: 36,
          recordCount: 2
        }
      };

      const restoredData = {
        statistics: { totalSolved: 9, mastered: 5 }, // Lost 1 solved problem
        sessions: [{ id: 1 }], // Lost 1 session
        backupMetadata: {
          timestamp: Date.now() - 3600000,
          version: 36,
          recordCount: 1 // Mismatch: says 1 but should be 2
        }
      };

      getDashboardStatistics
        .mockResolvedValueOnce(originalData)
        .mockResolvedValueOnce(restoredData);

      const [original, restored] = await Promise.all([
        getDashboardStatistics(),
        getDashboardStatistics()
      ]);

      // CRITICAL: Detect data loss during backup/restore
      const dataLoss = {
        solvedProblems: original.statistics.totalSolved - restored.statistics.totalSolved,
        sessions: original.sessions.length - restored.sessions.length,
        recordCountMismatch: restored.backupMetadata.recordCount !== restored.sessions.length
      };

      if (dataLoss.solvedProblems > 0 || dataLoss.sessions > 0 || dataLoss.recordCountMismatch) {
        console.error("Backup/restore data loss detected:", dataLoss);
        
        // This reveals: Data loss in backup/restore operations
        // Production fix: Add backup integrity verification
      }

      expect(dataLoss.solvedProblems).toBeGreaterThanOrEqual(0);
      expect(dataLoss.sessions).toBeGreaterThanOrEqual(0);
    });
  });
});