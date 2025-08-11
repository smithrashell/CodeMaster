/**
 * Storage Health Monitoring Utilities for CodeMaster
 *
 * Provides comprehensive storage health monitoring, quota tracking, and
 * performance metrics for both IndexedDB and Chrome Storage systems.
 */

import { dbHelper } from "../db/index.js";
import { ChromeAPIErrorHandler } from "../services/ChromeAPIErrorHandler.js";
import ErrorReportService from "../services/ErrorReportService.js";

export class StorageHealthMonitor {
  // Health status levels
  static HEALTH_STATUS = {
    EXCELLENT: "excellent",
    GOOD: "good",
    WARNING: "warning",
    CRITICAL: "critical",
    UNAVAILABLE: "unavailable",
  };

  // Performance thresholds (in milliseconds)
  static PERFORMANCE_THRESHOLDS = {
    EXCELLENT: 50,
    GOOD: 200,
    WARNING: 500,
    CRITICAL: 1000,
  };

  // Quota thresholds (as percentage)
  static QUOTA_THRESHOLDS = {
    GOOD: 0.5, // 50%
    WARNING: 0.8, // 80%
    CRITICAL: 0.9, // 90%
  };

  static healthHistory = [];
  static maxHistoryLength = 50;

  /**
   * Comprehensive storage health assessment
   */
  static async assessStorageHealth() {
    const assessment = {
      timestamp: new Date().toISOString(),
      overall: this.HEALTH_STATUS.GOOD,
      indexedDB: await this.assessIndexedDBHealth(),
      chromeStorage: await this.assessChromeStorageHealth(),
      performance: await this.assessPerformance(),
      recommendations: [],
    };

    // Determine overall health
    assessment.overall = this.calculateOverallHealth(assessment);

    // Generate recommendations
    assessment.recommendations = this.generateRecommendations(assessment);

    // Store in history
    this.addToHistory(assessment);

    return assessment;
  }

  /**
   * IndexedDB health assessment
   */
  static async assessIndexedDBHealth() {
    const health = {
      status: this.HEALTH_STATUS.GOOD,
      available: false,
      quota: null,
      used: null,
      usagePercentage: 0,
      storeCount: 0,
      lastError: null,
      performance: null,
    };

    try {
      // Test basic availability
      const startTime = performance.now();
      const db = await dbHelper.openDB();
      const responseTime = performance.now() - startTime;

      health.available = true;
      health.performance = responseTime;
      health.storeCount = db.objectStoreNames.length;

      // Assess quota usage
      if ("storage" in navigator && "estimate" in navigator.storage) {
        try {
          const estimate = await navigator.storage.estimate();
          health.quota = estimate.quota;
          health.used = estimate.usage;
          health.usagePercentage = estimate.usage / estimate.quota;

          // Determine status based on usage
          if (health.usagePercentage >= this.QUOTA_THRESHOLDS.CRITICAL) {
            health.status = this.HEALTH_STATUS.CRITICAL;
          } else if (health.usagePercentage >= this.QUOTA_THRESHOLDS.WARNING) {
            health.status = this.HEALTH_STATUS.WARNING;
          } else if (health.usagePercentage <= this.QUOTA_THRESHOLDS.GOOD) {
            health.status = this.HEALTH_STATUS.EXCELLENT;
          }
        } catch (quotaError) {
          console.warn("Failed to get storage quota:", quotaError);
        }
      }

      // Factor in performance
      if (responseTime > this.PERFORMANCE_THRESHOLDS.CRITICAL) {
        health.status = this.HEALTH_STATUS.CRITICAL;
      } else if (
        responseTime > this.PERFORMANCE_THRESHOLDS.WARNING &&
        health.status === this.HEALTH_STATUS.EXCELLENT
      ) {
        health.status = this.HEALTH_STATUS.WARNING;
      }
    } catch (error) {
      health.available = false;
      health.status = this.HEALTH_STATUS.UNAVAILABLE;
      health.lastError = {
        message: error.message,
        timestamp: new Date().toISOString(),
      };
    }

    return health;
  }

  /**
   * Chrome Storage health assessment
   */
  static async assessChromeStorageHealth() {
    const health = {
      status: this.HEALTH_STATUS.GOOD,
      available: false,
      bytesInUse: 0,
      quota: 10 * 1024 * 1024, // 10MB limit
      usagePercentage: 0,
      itemCount: 0,
      lastError: null,
      performance: null,
    };

    try {
      // Test basic availability and measure performance
      const startTime = performance.now();
      await ChromeAPIErrorHandler.storageGetWithRetry(["test_key"]);
      const responseTime = performance.now() - startTime;

      health.available = true;
      health.performance = responseTime;

      // Get storage usage information
      const allData = await ChromeAPIErrorHandler.storageGetWithRetry(null);
      const serializedData = JSON.stringify(allData);
      health.bytesInUse = new Blob([serializedData]).size;
      health.itemCount = Object.keys(allData).length;
      health.usagePercentage = health.bytesInUse / health.quota;

      // Determine status based on usage
      if (health.usagePercentage >= this.QUOTA_THRESHOLDS.CRITICAL) {
        health.status = this.HEALTH_STATUS.CRITICAL;
      } else if (health.usagePercentage >= this.QUOTA_THRESHOLDS.WARNING) {
        health.status = this.HEALTH_STATUS.WARNING;
      } else if (health.usagePercentage <= this.QUOTA_THRESHOLDS.GOOD) {
        health.status = this.HEALTH_STATUS.EXCELLENT;
      }

      // Factor in performance
      if (
        responseTime > this.PERFORMANCE_THRESHOLDS.WARNING &&
        health.status === this.HEALTH_STATUS.EXCELLENT
      ) {
        health.status = this.HEALTH_STATUS.WARNING;
      }
    } catch (error) {
      health.available = false;
      health.status = this.HEALTH_STATUS.UNAVAILABLE;
      health.lastError = {
        message: error.message,
        timestamp: new Date().toISOString(),
      };
    }

    return health;
  }

  /**
   * Performance assessment across operations
   */
  static async assessPerformance() {
    const performance = {
      indexedDB: {
        read: await this.measureIndexedDBReadPerformance(),
        write: await this.measureIndexedDBWritePerformance(),
      },
      chromeStorage: {
        read: await this.measureChromeStorageReadPerformance(),
        write: await this.measureChromeStorageWritePerformance(),
      },
    };

    return performance;
  }

  /**
   * Performance measurement methods
   */
  static async measureIndexedDBReadPerformance() {
    try {
      const startTime = performance.now();
      const db = await dbHelper.openDB();

      // Test read from settings store
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(["settings"], "readonly");
        const store = transaction.objectStore("settings");
        const request = store.get("test_performance");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      return performance.now() - startTime;
    } catch (error) {
      return null;
    }
  }

  static async measureIndexedDBWritePerformance() {
    try {
      const startTime = performance.now();
      const db = await dbHelper.openDB();

      // Test write to settings store
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(["settings"], "readwrite");
        const store = transaction.objectStore("settings");
        const testData = {
          id: "test_performance",
          data: { timestamp: Date.now() },
          lastUpdated: new Date().toISOString(),
        };
        const request = store.put(testData);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return performance.now() - startTime;
    } catch (error) {
      return null;
    }
  }

  static async measureChromeStorageReadPerformance() {
    try {
      const startTime = performance.now();
      await ChromeAPIErrorHandler.storageGetWithRetry(["test_performance"]);
      return performance.now() - startTime;
    } catch (error) {
      return null;
    }
  }

  static async measureChromeStorageWritePerformance() {
    try {
      const startTime = performance.now();
      await ChromeAPIErrorHandler.storageSetWithRetry({
        test_performance: { timestamp: Date.now() },
      });
      return performance.now() - startTime;
    } catch (error) {
      return null;
    }
  }

  /**
   * Calculate overall health status
   */
  static calculateOverallHealth(assessment) {
    const { indexedDB, chromeStorage } = assessment;

    // If neither storage is available, system is unavailable
    if (!indexedDB.available && !chromeStorage.available) {
      return this.HEALTH_STATUS.UNAVAILABLE;
    }

    // If only one storage is available, status depends on which one
    if (!indexedDB.available) {
      return chromeStorage.status;
    }
    if (!chromeStorage.available) {
      return indexedDB.status;
    }

    // Both available - take the worse status
    const statusPriority = {
      [this.HEALTH_STATUS.EXCELLENT]: 5,
      [this.HEALTH_STATUS.GOOD]: 4,
      [this.HEALTH_STATUS.WARNING]: 3,
      [this.HEALTH_STATUS.CRITICAL]: 2,
      [this.HEALTH_STATUS.UNAVAILABLE]: 1,
    };

    const indexedDBPriority = statusPriority[indexedDB.status] || 1;
    const chromeStoragePriority = statusPriority[chromeStorage.status] || 1;

    const minPriority = Math.min(indexedDBPriority, chromeStoragePriority);

    return (
      Object.keys(statusPriority).find(
        (status) => statusPriority[status] === minPriority
      ) || this.HEALTH_STATUS.WARNING
    );
  }

  /**
   * Generate actionable recommendations
   */
  static generateRecommendations(assessment) {
    const recommendations = [];
    const { indexedDB, chromeStorage } = assessment;

    // IndexedDB recommendations
    if (!indexedDB.available) {
      recommendations.push({
        type: "critical",
        message:
          "IndexedDB is unavailable. Consider clearing browser data or using Chrome Storage fallback.",
        action: "switch_to_fallback",
      });
    } else if (indexedDB.status === this.HEALTH_STATUS.CRITICAL) {
      if (indexedDB.usagePercentage >= this.QUOTA_THRESHOLDS.CRITICAL) {
        recommendations.push({
          type: "critical",
          message:
            "IndexedDB storage is nearly full. Clean up old data immediately.",
          action: "cleanup_indexeddb",
        });
      }
    } else if (indexedDB.status === this.HEALTH_STATUS.WARNING) {
      recommendations.push({
        type: "warning",
        message: "IndexedDB performance is degraded. Consider data cleanup.",
        action: "optimize_indexeddb",
      });
    }

    // Chrome Storage recommendations
    if (!chromeStorage.available) {
      recommendations.push({
        type: "warning",
        message: "Chrome Storage is unavailable. Fallback options are limited.",
        action: "check_chrome_storage",
      });
    } else if (chromeStorage.status === this.HEALTH_STATUS.CRITICAL) {
      recommendations.push({
        type: "critical",
        message: "Chrome Storage is nearly full. Clean up cached data.",
        action: "cleanup_chrome_storage",
      });
    }

    // Performance recommendations
    if (indexedDB.performance > this.PERFORMANCE_THRESHOLDS.WARNING) {
      recommendations.push({
        type: "info",
        message: "IndexedDB performance is slow. Consider browser restart.",
        action: "restart_browser",
      });
    }

    return recommendations;
  }

  /**
   * History management
   */
  static addToHistory(assessment) {
    this.healthHistory.unshift({
      timestamp: assessment.timestamp,
      overall: assessment.overall,
      indexedDB: assessment.indexedDB.status,
      chromeStorage: assessment.chromeStorage.status,
    });

    // Trim history to max length
    if (this.healthHistory.length > this.maxHistoryLength) {
      this.healthHistory = this.healthHistory.slice(0, this.maxHistoryLength);
    }
  }

  static getHealthHistory(limit = 10) {
    return this.healthHistory.slice(0, limit);
  }

  static getHealthTrends() {
    if (this.healthHistory.length < 2) {
      return { trend: "insufficient_data", direction: null };
    }

    const recent = this.healthHistory.slice(0, 5);
    const older = this.healthHistory.slice(5, 10);

    const recentAvg = this.calculateAverageHealth(recent);
    const olderAvg = this.calculateAverageHealth(older);

    if (recentAvg > olderAvg) {
      return { trend: "improving", direction: "up" };
    } else if (recentAvg < olderAvg) {
      return { trend: "degrading", direction: "down" };
    } else {
      return { trend: "stable", direction: "neutral" };
    }
  }

  static calculateAverageHealth(healthRecords) {
    const statusValues = {
      [this.HEALTH_STATUS.EXCELLENT]: 5,
      [this.HEALTH_STATUS.GOOD]: 4,
      [this.HEALTH_STATUS.WARNING]: 3,
      [this.HEALTH_STATUS.CRITICAL]: 2,
      [this.HEALTH_STATUS.UNAVAILABLE]: 1,
    };

    const sum = healthRecords.reduce((total, record) => {
      return total + (statusValues[record.overall] || 1);
    }, 0);

    return sum / healthRecords.length;
  }

  /**
   * Automated cleanup suggestions
   */
  static async suggestCleanupActions() {
    const assessment = await this.assessStorageHealth();
    const actions = [];

    // IndexedDB cleanup suggestions
    if (assessment.indexedDB.usagePercentage > this.QUOTA_THRESHOLDS.WARNING) {
      actions.push({
        storage: "indexedDB",
        action: "cleanup_old_sessions",
        description: "Remove session data older than 30 days",
        estimatedSavings: "~2MB",
      });

      actions.push({
        storage: "indexedDB",
        action: "cleanup_analytics",
        description: "Remove detailed analytics older than 90 days",
        estimatedSavings: "~5MB",
      });
    }

    // Chrome Storage cleanup suggestions
    if (
      assessment.chromeStorage.usagePercentage > this.QUOTA_THRESHOLDS.WARNING
    ) {
      actions.push({
        storage: "chromeStorage",
        action: "cleanup_temp_data",
        description: "Remove temporary cached data",
        estimatedSavings: "~1MB",
      });
    }

    return actions;
  }

  /**
   * Real-time monitoring setup
   */
  static startRealTimeMonitoring(callback, interval = 30000) {
    const monitoringInterval = setInterval(async () => {
      try {
        const assessment = await this.assessStorageHealth();
        callback(assessment);
      } catch (error) {
        console.warn("Health monitoring failed:", error);
      }
    }, interval);

    return monitoringInterval;
  }

  static stopRealTimeMonitoring(monitoringInterval) {
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
    }
  }

  /**
   * Emergency health check
   */
  static async emergencyHealthCheck() {
    if (process.env.NODE_ENV === "development") {
      console.log("🚨 Performing emergency storage health check");
    }

    const assessment = await this.assessStorageHealth();

    // Report critical issues immediately
    if (
      assessment.overall === this.HEALTH_STATUS.CRITICAL ||
      assessment.overall === this.HEALTH_STATUS.UNAVAILABLE
    ) {
      await ErrorReportService.storeErrorReport({
        errorId: `storage_emergency_${Date.now()}`,
        message: `Critical storage health issue: ${assessment.overall}`,
        stack: JSON.stringify(assessment, null, 2),
        section: "Storage Health",
        errorType: "storage_critical",
        severity: "high",
        userContext: assessment,
      });
    }

    return assessment;
  }
}

export default StorageHealthMonitor;
