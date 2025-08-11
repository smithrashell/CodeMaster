/**
 * Resilient Storage Service for CodeMaster
 *
 * Implements dual storage strategy with automatic fallback from IndexedDB to Chrome Storage
 * for critical data persistence when IndexedDB becomes unavailable or corrupted.
 */

import { dbHelper } from "../db/index.js";
import { ChromeAPIErrorHandler } from "./ChromeAPIErrorHandler.js";
import ErrorReportService from "./ErrorReportService.js";
import StorageCompression from "../utils/storageCompression.js";

export class ResilientStorage {
  static STORAGE_MODE = {
    INDEXEDDB_PRIMARY: "indexeddb_primary",
    CHROME_FALLBACK: "chrome_fallback",
    MIXED_MODE: "mixed_mode",
  };

  static DATA_TYPE = {
    CRITICAL: "critical",
    BULK: "bulk",
    METADATA: "metadata",
  };

  // Chrome Storage keys for fallback data
  static CHROME_KEYS = {
    STORAGE_MODE: "codemaster_storage_mode",
    CRITICAL_DATA: "codemaster_critical_data",
    METADATA: "codemaster_metadata",
    HEALTH_STATUS: "codemaster_health_status",
    SETTINGS: "codemaster_settings_backup",
    SESSION_STATE: "codemaster_session_backup",
    RECENT_ATTEMPTS: "codemaster_recent_attempts",
  };

  // Storage limits and thresholds
  static LIMITS = {
    CHROME_MAX_SIZE: 8 * 1024 * 1024, // 8MB (safe margin from 10MB limit)
    CHROME_ITEM_MAX_SIZE: 8 * 1024, // 8KB per item
    INDEXEDDB_QUOTA_THRESHOLD: 0.9, // Switch to fallback at 90% quota usage
    HEALTH_CHECK_INTERVAL: 5 * 60 * 1000, // 5 minutes
    SYNC_INTERVAL: 30 * 1000, // 30 seconds
  };

  // Current storage mode
  static currentMode = this.STORAGE_MODE.INDEXEDDB_PRIMARY;
  static healthCheckInterval = null;
  static syncInterval = null;

  /**
   * Initialize the resilient storage system
   */
  static async initialize() {
    try {
      // Check last known storage mode
      try {
        const savedMode = await ChromeAPIErrorHandler.storageGetWithRetry([
          this.CHROME_KEYS.STORAGE_MODE,
        ]);
        if (savedMode && savedMode[this.CHROME_KEYS.STORAGE_MODE]) {
          this.currentMode = savedMode[this.CHROME_KEYS.STORAGE_MODE];
        }
      } catch (storageError) {
        console.warn(
          "Failed to retrieve saved storage mode, using default:",
          storageError
        );
        // Continue with default mode
      }

      // Perform initial health check
      const healthStatus = await this.performHealthCheck();

      // Start monitoring intervals
      this.startHealthMonitoring();
      this.startDataSync();

      return {
        success: true,
        mode: this.currentMode,
        health: healthStatus,
      };
    } catch (error) {
      console.error("Failed to initialize ResilientStorage:", error);
      try {
        await this.handleStorageError("initialization", error);
      } catch (handlerError) {
        console.warn("Error handler failed:", handlerError);
      }
      return {
        success: false,
        error: error.message,
        mode: this.STORAGE_MODE.CHROME_FALLBACK,
      };
    }
  }

  /**
   * Get data with automatic fallback handling
   */
  static async get(key, dataType = this.DATA_TYPE.CRITICAL) {
    // Validate key
    if (key === undefined || key === null || key === "") {
      throw new Error("Key cannot be undefined, null, or empty");
    }

    try {
      switch (this.currentMode) {
        case this.STORAGE_MODE.INDEXEDDB_PRIMARY:
          try {
            return await this.getFromIndexedDB(key);
          } catch (error) {
            console.warn("IndexedDB get failed, trying Chrome Storage:", error);
            return await this.getFromChromeStorage(key, dataType);
          }

        case this.STORAGE_MODE.CHROME_FALLBACK:
          return await this.getFromChromeStorage(key, dataType);

        case this.STORAGE_MODE.MIXED_MODE:
          if (dataType === this.DATA_TYPE.CRITICAL) {
            return await this.getFromChromeStorage(key, dataType);
          } else {
            return await this.getFromIndexedDB(key);
          }

        default:
          throw new Error(`Unknown storage mode: ${this.currentMode}`);
      }
    } catch (error) {
      await this.handleStorageError("get", error, { key, dataType });
      throw error;
    }
  }

  /**
   * Set data with automatic fallback handling
   */
  static async set(key, value, dataType = this.DATA_TYPE.CRITICAL) {
    // Validate key
    if (key === undefined || key === null || key === "") {
      throw new Error("Key cannot be undefined, null, or empty");
    }

    try {
      const serializedValue = JSON.stringify(value);
      const sizeBytes = new Blob([serializedValue]).size;

      switch (this.currentMode) {
        case this.STORAGE_MODE.INDEXEDDB_PRIMARY:
          try {
            await this.setInIndexedDB(key, value);
            // Mirror critical data to Chrome Storage
            if (dataType === this.DATA_TYPE.CRITICAL) {
              await this.mirrorToChromeStorage(key, value, sizeBytes);
            }
            return;
          } catch (error) {
            console.warn(
              "IndexedDB set failed, switching to Chrome Storage:",
              error
            );
            await this.switchToFallbackMode();
            await this.setInChromeStorage(key, value, dataType, sizeBytes);
            return;
          }

        case this.STORAGE_MODE.CHROME_FALLBACK:
          await this.setInChromeStorage(key, value, dataType, sizeBytes);
          return;

        case this.STORAGE_MODE.MIXED_MODE:
          if (dataType === this.DATA_TYPE.CRITICAL) {
            await this.setInChromeStorage(key, value, dataType, sizeBytes);
          } else {
            await this.setInIndexedDB(key, value);
          }
          return;

        default:
          throw new Error(`Unknown storage mode: ${this.currentMode}`);
      }
    } catch (error) {
      await this.handleStorageError("set", error, { key, dataType });
      throw error;
    }
  }

  /**
   * Remove data from both storage systems
   */
  static async remove(key, dataType = this.DATA_TYPE.CRITICAL) {
    try {
      const promises = [];

      // Try to remove from IndexedDB
      if (this.currentMode !== this.STORAGE_MODE.CHROME_FALLBACK) {
        promises.push(
          this.removeFromIndexedDB(key).catch((error) => {
            console.warn("Failed to remove from IndexedDB:", error);
          })
        );
      }

      // Try to remove from Chrome Storage
      if (
        dataType === this.DATA_TYPE.CRITICAL ||
        this.currentMode === this.STORAGE_MODE.CHROME_FALLBACK
      ) {
        promises.push(
          this.removeFromChromeStorage(key).catch((error) => {
            console.warn("Failed to remove from Chrome Storage:", error);
          })
        );
      }

      await Promise.all(promises);
    } catch (error) {
      await this.handleStorageError("remove", error, { key, dataType });
      throw error;
    }
  }

  /**
   * IndexedDB operations
   */
  static async getFromIndexedDB(key) {
    // This would integrate with existing StorageService methods
    // For now, using a generic approach
    const db = await dbHelper.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["settings"], "readonly");
      const store = transaction.objectStore("settings");
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result?.data || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  static async setInIndexedDB(key, value) {
    const db = await dbHelper.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["settings"], "readwrite");
      const store = transaction.objectStore("settings");

      const settingsObject = {
        id: key,
        data: value,
        lastUpdated: new Date().toISOString(),
        source: "resilient_storage",
      };

      const request = store.put(settingsObject);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  static async removeFromIndexedDB(key) {
    const db = await dbHelper.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["settings"], "readwrite");
      const store = transaction.objectStore("settings");
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Chrome Storage operations
   */
  static async getFromChromeStorage(key, dataType) {
    const chromeKey = this.getChromeStorageKey(key, dataType);
    const result = await ChromeAPIErrorHandler.storageGetWithRetry([chromeKey]);
    return (result && result[chromeKey]) || null;
  }

  static async setInChromeStorage(key, value, dataType, sizeBytes) {
    const chromeKey = this.getChromeStorageKey(key, dataType);

    // Check size limits
    if (sizeBytes > this.LIMITS.CHROME_ITEM_MAX_SIZE) {
      console.warn(`Data too large for Chrome Storage: ${sizeBytes} bytes`);
      // Could implement compression here
      throw new Error("Data too large for Chrome Storage");
    }

    const items = { [chromeKey]: value };
    await ChromeAPIErrorHandler.storageSetWithRetry(items);
  }

  static async removeFromChromeStorage(key) {
    const chromeKeys = [
      this.getChromeStorageKey(key, this.DATA_TYPE.CRITICAL),
      this.getChromeStorageKey(key, this.DATA_TYPE.METADATA),
    ];

    return new Promise((resolve) => {
      chrome.storage.local.remove(chromeKeys, () => resolve());
    });
  }

  /**
   * Mirror critical data to Chrome Storage for redundancy
   */
  static async mirrorToChromeStorage(key, value, sizeBytes) {
    try {
      if (sizeBytes <= this.LIMITS.CHROME_ITEM_MAX_SIZE) {
        await this.setInChromeStorage(
          key,
          value,
          this.DATA_TYPE.CRITICAL,
          sizeBytes
        );
      }
    } catch (error) {
      console.warn("Failed to mirror to Chrome Storage:", error);
      // Don't throw - mirroring is best effort
    }
  }

  /**
   * Health monitoring
   */
  static async performHealthCheck() {
    const healthStatus = {
      timestamp: new Date().toISOString(),
      indexedDB: { available: false, quota: null, used: null },
      chromeStorage: { available: false, quota: null, used: null },
      recommendedMode: this.STORAGE_MODE.INDEXEDDB_PRIMARY,
    };

    // Check IndexedDB
    try {
      await dbHelper.openDB();
      healthStatus.indexedDB.available = true;

      // Check quota if available
      if ("storage" in navigator && "estimate" in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        healthStatus.indexedDB.quota = estimate.quota;
        healthStatus.indexedDB.used = estimate.usage;

        const usageRatio = estimate.usage / estimate.quota;
        if (usageRatio > this.LIMITS.INDEXEDDB_QUOTA_THRESHOLD) {
          healthStatus.recommendedMode = this.STORAGE_MODE.CHROME_FALLBACK;
        }
      }
    } catch (error) {
      console.warn("IndexedDB health check failed:", error);
      healthStatus.recommendedMode = this.STORAGE_MODE.CHROME_FALLBACK;
    }

    // Check Chrome Storage
    try {
      await ChromeAPIErrorHandler.storageGetWithRetry([
        this.CHROME_KEYS.HEALTH_STATUS,
      ]);
      healthStatus.chromeStorage.available = true;

      // Estimate Chrome Storage usage
      const allData = await ChromeAPIErrorHandler.storageGetWithRetry(null);
      const totalSize = JSON.stringify(allData).length;
      healthStatus.chromeStorage.used = totalSize;
      healthStatus.chromeStorage.quota = this.LIMITS.CHROME_MAX_SIZE;
    } catch (error) {
      console.warn("Chrome Storage health check failed:", error);
    }

    // Store health status
    try {
      await ChromeAPIErrorHandler.storageSetWithRetry({
        [this.CHROME_KEYS.HEALTH_STATUS]: healthStatus,
      });
    } catch (error) {
      console.warn("Failed to store health status:", error);
    }

    return healthStatus;
  }

  /**
   * Storage mode management
   */
  static async switchToFallbackMode() {
    console.log("Switching to Chrome Storage fallback mode");
    this.currentMode = this.STORAGE_MODE.CHROME_FALLBACK;

    try {
      await ChromeAPIErrorHandler.storageSetWithRetry({
        [this.CHROME_KEYS.STORAGE_MODE]: this.currentMode,
      });
    } catch (error) {
      console.warn("Failed to save storage mode:", error);
    }

    // Trigger emergency data backup
    await this.createEmergencyBackup();
  }

  static async switchToPrimaryMode() {
    console.log("Switching back to IndexedDB primary mode");
    this.currentMode = this.STORAGE_MODE.INDEXEDDB_PRIMARY;

    try {
      await ChromeAPIErrorHandler.storageSetWithRetry({
        [this.CHROME_KEYS.STORAGE_MODE]: this.currentMode,
      });
    } catch (error) {
      console.warn("Failed to save storage mode:", error);
    }
  }

  /**
   * Emergency backup creation
   */
  static async createEmergencyBackup() {
    try {
      console.log("Creating emergency backup to Chrome Storage");

      // Backup critical stores from IndexedDB
      const db = await dbHelper.openDB();
      const criticalStores = ["settings", "session_state"];
      const backup = {
        timestamp: new Date().toISOString(),
        stores: {},
      };

      for (const storeName of criticalStores) {
        try {
          if (db.objectStoreNames.contains(storeName)) {
            const transaction = db.transaction([storeName], "readonly");
            const store = transaction.objectStore(storeName);
            const data = await new Promise((resolve, reject) => {
              const request = store.getAll();
              request.onsuccess = () => resolve(request.result);
              request.onerror = () => reject(request.error);
            });
            backup.stores[storeName] = data.slice(-10); // Keep last 10 items
          }
        } catch (error) {
          console.warn(`Failed to backup store ${storeName}:`, error);
        }
      }

      await ChromeAPIErrorHandler.storageSetWithRetry({
        [this.CHROME_KEYS.CRITICAL_DATA]: backup,
      });
    } catch (error) {
      console.error("Emergency backup failed:", error);
    }
  }

  /**
   * Utility methods
   */
  static getChromeStorageKey(key, dataType) {
    return `${key}_${dataType}`;
  }

  static startHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      const health = await this.performHealthCheck();

      // Auto-switch modes based on health
      if (health.recommendedMode !== this.currentMode) {
        if (health.recommendedMode === this.STORAGE_MODE.CHROME_FALLBACK) {
          await this.switchToFallbackMode();
        } else if (
          health.indexedDB.available &&
          this.currentMode === this.STORAGE_MODE.CHROME_FALLBACK
        ) {
          await this.switchToPrimaryMode();
        }
      }
    }, this.LIMITS.HEALTH_CHECK_INTERVAL);
  }

  static startDataSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      if (this.currentMode === this.STORAGE_MODE.INDEXEDDB_PRIMARY) {
        // Sync metadata to Chrome Storage
        await this.syncMetadata();
      }
    }, this.LIMITS.SYNC_INTERVAL);
  }

  static async syncMetadata() {
    try {
      const metadata = {
        lastSync: new Date().toISOString(),
        mode: this.currentMode,
        version: "1.0",
      };

      await ChromeAPIErrorHandler.storageSetWithRetry({
        [this.CHROME_KEYS.METADATA]: metadata,
      });
    } catch (error) {
      console.warn("Metadata sync failed:", error);
    }
  }

  static async handleStorageError(operation, error, context = {}) {
    console.error(`ResilientStorage ${operation} error:`, error);

    try {
      await ErrorReportService.storeErrorReport({
        errorId: `resilient_storage_${Date.now()}`,
        message: error.message,
        stack: error.stack,
        section: "Resilient Storage",
        errorType: "storage_operation",
        severity: "high",
        userContext: { operation, ...context },
      });
    } catch (reportError) {
      console.warn("Failed to report storage error:", reportError);
    }
  }

  /**
   * Get current storage status
   */
  static async getStorageStatus() {
    const health = await this.performHealthCheck();
    return {
      mode: this.currentMode,
      health,
      isIndexedDBAvailable: health.indexedDB.available,
      isChromeStorageAvailable: health.chromeStorage.available,
      quotaWarning:
        health.indexedDB.quota &&
        health.indexedDB.used / health.indexedDB.quota > 0.8,
    };
  }

  /**
   * Data Synchronization Methods
   */

  /**
   * Sync critical data from IndexedDB to Chrome Storage
   */
  static async syncToFallback(options = {}) {
    const {
      stores = ["settings", "session_state"],
      compress = true,
      maxItems = 10,
    } = options;

    try {
      console.log("Starting sync to Chrome Storage fallback");
      const syncResults = {
        timestamp: new Date().toISOString(),
        synced: {},
        errors: {},
        totalSynced: 0,
      };

      const db = await dbHelper.openDB();

      for (const storeName of stores) {
        try {
          if (!db.objectStoreNames.contains(storeName)) {
            syncResults.errors[storeName] = "Store does not exist in IndexedDB";
            continue;
          }

          // Get recent data from IndexedDB store
          const transaction = db.transaction([storeName], "readonly");
          const store = transaction.objectStore(storeName);

          const data = await new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });

          // Limit data to most recent items
          const recentData = data.slice(-maxItems);

          // Prepare data for Chrome Storage
          const chromeKey = `${this.CHROME_KEYS.CRITICAL_DATA}_${storeName}`;

          if (compress) {
            const compressionResult =
              await StorageCompression.prepareForChromeStorage(
                chromeKey,
                recentData,
                { optimize: true }
              );

            if (compressionResult.success) {
              await ChromeAPIErrorHandler.storageSetWithRetry(
                compressionResult.items
              );
              syncResults.synced[storeName] = {
                items: recentData.length,
                compressed: true,
                size: JSON.stringify(recentData).length,
              };
            } else {
              throw new Error(compressionResult.error);
            }
          } else {
            // Direct storage without compression
            await ChromeAPIErrorHandler.storageSetWithRetry({
              [chromeKey]: recentData,
            });
            syncResults.synced[storeName] = {
              items: recentData.length,
              compressed: false,
              size: JSON.stringify(recentData).length,
            };
          }

          syncResults.totalSynced++;
        } catch (error) {
          console.warn(`Failed to sync store ${storeName}:`, error);
          syncResults.errors[storeName] = error.message;
        }
      }

      // Store sync metadata
      await ChromeAPIErrorHandler.storageSetWithRetry({
        [this.CHROME_KEYS.METADATA]: {
          lastSync: syncResults.timestamp,
          mode: this.currentMode,
          syncResults,
        },
      });

      console.log("Sync to fallback completed:", syncResults);
      return syncResults;
    } catch (error) {
      console.error("Sync to fallback failed:", error);
      throw error;
    }
  }

  /**
   * Restore data from Chrome Storage to IndexedDB
   */
  static async restoreFromFallback(options = {}) {
    const {
      stores = ["settings", "session_state"],
      overwrite = false,
      validate = true,
    } = options;

    try {
      console.log("Starting restore from Chrome Storage fallback");
      const restoreResults = {
        timestamp: new Date().toISOString(),
        restored: {},
        errors: {},
        totalRestored: 0,
      };

      const db = await dbHelper.openDB();

      for (const storeName of stores) {
        try {
          const chromeKey = `${this.CHROME_KEYS.CRITICAL_DATA}_${storeName}`;

          // Get data from Chrome Storage
          const chromeData = await ChromeAPIErrorHandler.storageGetWithRetry([
            chromeKey,
            `${chromeKey}_metadata`,
          ]);

          let dataToRestore;

          // Check if data was compressed
          if (chromeData[`${chromeKey}_metadata`]) {
            // Decompress data
            const retrievalResult =
              await StorageCompression.retrieveFromChromeStorage(
                chromeKey,
                chromeData
              );

            if (!retrievalResult.success) {
              throw new Error(retrievalResult.error);
            }
            dataToRestore = retrievalResult.data;
          } else {
            // Direct data
            dataToRestore = chromeData[chromeKey];
          }

          if (!dataToRestore || !Array.isArray(dataToRestore)) {
            restoreResults.errors[storeName] =
              "No valid data found in Chrome Storage";
            continue;
          }

          // Validate data if requested
          if (validate && !this.validateStoreData(storeName, dataToRestore)) {
            throw new Error("Data validation failed");
          }

          // Restore to IndexedDB
          if (!db.objectStoreNames.contains(storeName)) {
            restoreResults.errors[storeName] =
              "Target store does not exist in IndexedDB";
            continue;
          }

          const transaction = db.transaction([storeName], "readwrite");
          const store = transaction.objectStore(storeName);

          // Clear existing data if overwrite is enabled
          if (overwrite) {
            await new Promise((resolve, reject) => {
              const clearRequest = store.clear();
              clearRequest.onsuccess = () => resolve();
              clearRequest.onerror = () => reject(clearRequest.error);
            });
          }

          // Restore each item
          let restoredCount = 0;
          for (const item of dataToRestore) {
            try {
              await new Promise((resolve, reject) => {
                const putRequest = store.put(item);
                putRequest.onsuccess = () => resolve();
                putRequest.onerror = () => reject(putRequest.error);
              });
              restoredCount++;
            } catch (itemError) {
              console.warn(
                `Failed to restore item in ${storeName}:`,
                itemError
              );
            }
          }

          restoreResults.restored[storeName] = {
            totalItems: dataToRestore.length,
            restoredItems: restoredCount,
            overwritten: overwrite,
          };
          restoreResults.totalRestored++;
        } catch (error) {
          console.warn(`Failed to restore store ${storeName}:`, error);
          restoreResults.errors[storeName] = error.message;
        }
      }

      console.log("Restore from fallback completed:", restoreResults);
      return restoreResults;
    } catch (error) {
      console.error("Restore from fallback failed:", error);
      throw error;
    }
  }

  /**
   * Bidirectional synchronization
   */
  static async performBidirectionalSync(options = {}) {
    const {
      direction = "auto", // 'auto', 'to_fallback', 'from_fallback'
      conflictResolution = "timestamp", // 'timestamp', 'indexeddb_wins', 'chrome_wins'
    } = options;

    try {
      console.log("Starting bidirectional synchronization");

      const health = await this.performHealthCheck();
      let actualDirection = direction;

      if (direction === "auto") {
        // Determine sync direction based on health and current mode
        if (!health.indexedDB.available) {
          // Can't sync to IndexedDB, only from it if we have fallback data
          actualDirection = "from_fallback";
        } else if (!health.chromeStorage.available) {
          // Can't sync to Chrome Storage
          actualDirection = "to_fallback";
        } else if (this.currentMode === this.STORAGE_MODE.CHROME_FALLBACK) {
          // Currently in fallback mode, try to restore to IndexedDB
          actualDirection = "from_fallback";
        } else {
          // Normal mode, sync to fallback
          actualDirection = "to_fallback";
        }
      }

      let syncResult;
      switch (actualDirection) {
        case "to_fallback":
          syncResult = await this.syncToFallback(options);
          break;
        case "from_fallback":
          syncResult = await this.restoreFromFallback(options);
          break;
        default:
          throw new Error(`Invalid sync direction: ${actualDirection}`);
      }

      return {
        direction: actualDirection,
        result: syncResult,
        health,
      };
    } catch (error) {
      console.error("Bidirectional sync failed:", error);
      throw error;
    }
  }

  /**
   * Resolve synchronization conflicts
   */
  static async resolveConflicts(
    indexedDBData,
    chromeStorageData,
    strategy = "timestamp"
  ) {
    switch (strategy) {
      case "timestamp":
        return this.resolveByTimestamp(indexedDBData, chromeStorageData);
      case "indexeddb_wins":
        return indexedDBData;
      case "chrome_wins":
        return chromeStorageData;
      default:
        console.warn("Unknown conflict resolution strategy, using timestamp");
        return this.resolveByTimestamp(indexedDBData, chromeStorageData);
    }
  }

  /**
   * Resolve conflicts by timestamp
   */
  static resolveByTimestamp(indexedDBData, chromeStorageData) {
    if (!indexedDBData) return chromeStorageData;
    if (!chromeStorageData) return indexedDBData;

    const getTimestamp = (data) => {
      if (data.lastUpdated) return new Date(data.lastUpdated);
      if (data.timestamp) return new Date(data.timestamp);
      if (data.Date) return new Date(data.Date);
      return new Date(0); // Fallback to epoch
    };

    const indexedDBTime = getTimestamp(indexedDBData);
    const chromeStorageTime = getTimestamp(chromeStorageData);

    return indexedDBTime >= chromeStorageTime
      ? indexedDBData
      : chromeStorageData;
  }

  /**
   * Validate store data integrity
   */
  static validateStoreData(storeName, data) {
    if (!Array.isArray(data)) return false;

    // Store-specific validation
    switch (storeName) {
      case "settings":
        return data.every((item) => item.id && typeof item.data === "object");
      case "session_state":
        return data.every((item) => item.id && item.id !== undefined);
      case "attempts":
        return data.every(
          (item) => item.id && item.problemId && item.sessionId
        );
      default:
        // Basic validation - each item should be an object
        return data.every((item) => typeof item === "object" && item !== null);
    }
  }

  /**
   * Enhanced sync metadata management
   */
  static async syncMetadata() {
    try {
      const health = await this.performHealthCheck();
      const metadata = {
        lastSync: new Date().toISOString(),
        mode: this.currentMode,
        version: "1.1",
        health: {
          indexedDB: health.indexedDB.status,
          chromeStorage: health.chromeStorage.status,
        },
        syncHistory: this.getSyncHistory(),
      };

      await ChromeAPIErrorHandler.storageSetWithRetry({
        [this.CHROME_KEYS.METADATA]: metadata,
      });

      return metadata;
    } catch (error) {
      console.warn("Enhanced metadata sync failed:", error);
      throw error;
    }
  }

  /**
   * Get synchronization history
   */
  static getSyncHistory() {
    // In a real implementation, this would retrieve sync history from storage
    // For now, returning a placeholder structure
    return {
      lastBidirectionalSync: null,
      lastFallbackSync: null,
      lastRestoreSync: null,
      totalSyncs: 0,
      errors: [],
    };
  }

  /**
   * Enhanced data sync with better intervals
   */
  static startDataSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      try {
        if (this.currentMode === this.STORAGE_MODE.INDEXEDDB_PRIMARY) {
          // Sync critical data to Chrome Storage for redundancy
          await this.syncToFallback({
            stores: ["settings", "session_state"],
            compress: true,
            maxItems: 5,
          });
        } else if (this.currentMode === this.STORAGE_MODE.CHROME_FALLBACK) {
          // Periodically try to restore to IndexedDB
          const health = await this.performHealthCheck();
          if (health.indexedDB.available) {
            console.log("IndexedDB available again, attempting restore");
            await this.restoreFromFallback({ overwrite: false });
            await this.switchToPrimaryMode();
          }
        }

        // Update metadata
        await this.syncMetadata();
      } catch (error) {
        console.warn("Periodic sync failed:", error);
      }
    }, this.LIMITS.SYNC_INTERVAL);
  }

  /**
   * Cleanup resources
   */
  static cleanup() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
}

export default ResilientStorage;
