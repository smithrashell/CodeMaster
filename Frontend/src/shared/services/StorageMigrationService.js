/**
 * Storage Migration Service for CodeMaster
 *
 * Handles bidirectional data migration between IndexedDB and Chrome Storage
 * with comprehensive error handling, validation, and rollback capabilities.
 */

import { dbHelper } from "../db/index.js";
import { ChromeAPIErrorHandler } from "./ChromeAPIErrorHandler.js";
import ErrorReportService from "./ErrorReportService.js";
import StorageCompression from "../utils/storageCompression.js";
import migrationSafety from "../db/migrationSafety.js";

export class StorageMigrationService {
  // Migration types
  static MIGRATION_TYPE = {
    FULL_BACKUP: "full_backup",
    CRITICAL_ONLY: "critical_only",
    SELECTIVE: "selective",
    EMERGENCY_RESTORE: "emergency_restore",
  };

  // Migration states
  static MIGRATION_STATE = {
    PENDING: "pending",
    IN_PROGRESS: "in_progress",
    COMPLETED: "completed",
    FAILED: "failed",
    ROLLED_BACK: "rolled_back",
  };

  // Critical stores that must be migrated
  static CRITICAL_STORES = ["settings", "session_state"];

  // Optional stores for full migration
  static OPTIONAL_STORES = ["sessions", "attempts", "tag_mastery"];

  // Chrome Storage migration keys
  static MIGRATION_KEYS = {
    STATUS: "codemaster_migration_status",
    MANIFEST: "codemaster_migration_manifest",
    BACKUP_INDEX: "codemaster_backup_index",
  };

  /**
   * Migrate data from IndexedDB to Chrome Storage (fallback scenario)
   */
  static async migrateToChrome(options = {}) {
    const {
      migrationType = this.MIGRATION_TYPE.CRITICAL_ONLY,
      stores = this.CRITICAL_STORES,
      compress = true,
      validateAfter = true,
      createBackup = true,
    } = options;

    const migrationId = `idb_to_chrome_${Date.now()}`;
    let migrationStatus = {
      id: migrationId,
      type: migrationType,
      state: this.MIGRATION_STATE.PENDING,
      startTime: new Date().toISOString(),
      stores,
      progress: {},
      errors: {},
      totalItems: 0,
      migratedItems: 0,
    };

    try {
      console.log(`Starting migration to Chrome Storage: ${migrationId}`);

      // Update migration status
      migrationStatus.state = this.MIGRATION_STATE.IN_PROGRESS;
      await this.saveMigrationStatus(migrationStatus);

      // Create safety backup if requested
      if (createBackup) {
        migrationStatus.backupId = await migrationSafety.createMigrationBackup(
          stores
        );
      }

      const db = await dbHelper.openDB();

      // Phase 1: Collect and count data
      console.log("Phase 1: Collecting data from IndexedDB");
      const storeData = {};
      let totalItems = 0;

      for (const storeName of stores) {
        if (!db.objectStoreNames.contains(storeName)) {
          migrationStatus.errors[storeName] = "Store not found in IndexedDB";
          continue;
        }

        const transaction = db.transaction([storeName], "readonly");
        const store = transaction.objectStore(storeName);

        const data = await new Promise((resolve, reject) => {
          const request = store.getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });

        storeData[storeName] = data;
        totalItems += data.length;
        migrationStatus.progress[storeName] = {
          total: data.length,
          migrated: 0,
          status: "pending",
        };
      }

      migrationStatus.totalItems = totalItems;
      await this.saveMigrationStatus(migrationStatus);

      // Phase 2: Migrate data to Chrome Storage
      console.log("Phase 2: Migrating data to Chrome Storage");

      for (const [storeName, data] of Object.entries(storeData)) {
        try {
          migrationStatus.progress[storeName].status = "migrating";
          await this.saveMigrationStatus(migrationStatus);

          const migrationResult = await this.migrateStoreToChrome(
            storeName,
            data,
            { compress, migrationId }
          );

          migrationStatus.progress[storeName] = {
            ...migrationStatus.progress[storeName],
            status: "completed",
            migrated: migrationResult.migratedCount,
            size: migrationResult.totalSize,
            compressed: migrationResult.compressed,
          };

          migrationStatus.migratedItems += migrationResult.migratedCount;
        } catch (error) {
          console.error(`Failed to migrate store ${storeName}:`, error);
          migrationStatus.errors[storeName] = error.message;
          migrationStatus.progress[storeName].status = "failed";
        }

        await this.saveMigrationStatus(migrationStatus);
      }

      // Phase 3: Validation
      if (validateAfter) {
        console.log("Phase 3: Validating migrated data");
        const validationResult = await this.validateMigration(
          migrationId,
          storeData
        );
        migrationStatus.validation = validationResult;

        if (!validationResult.valid) {
          throw new Error("Migration validation failed");
        }
      }

      // Phase 4: Complete migration
      migrationStatus.state = this.MIGRATION_STATE.COMPLETED;
      migrationStatus.endTime = new Date().toISOString();
      migrationStatus.duration =
        new Date(migrationStatus.endTime) - new Date(migrationStatus.startTime);

      await this.saveMigrationStatus(migrationStatus);
      console.log(
        "Migration to Chrome Storage completed successfully:",
        migrationId
      );

      return {
        success: true,
        migrationId,
        status: migrationStatus,
      };
    } catch (error) {
      console.error("Migration to Chrome Storage failed:", error);

      migrationStatus.state = this.MIGRATION_STATE.FAILED;
      migrationStatus.error = error.message;
      migrationStatus.endTime = new Date().toISOString();

      await this.saveMigrationStatus(migrationStatus);

      // Store error report
      await ErrorReportService.storeErrorReport({
        errorId: `migration_error_${migrationId}`,
        message: error.message,
        stack: error.stack,
        section: "Storage Migration",
        errorType: "migration_failure",
        severity: "high",
        userContext: { migrationId, type: migrationType },
      });

      return {
        success: false,
        migrationId,
        error: error.message,
        status: migrationStatus,
      };
    }
  }

  /**
   * Migrate data from Chrome Storage back to IndexedDB (recovery scenario)
   */
  static async migrateFromChrome(options = {}) {
    const {
      migrationId = null,
      overwriteExisting = false,
      validateBefore = true,
      createBackup = true,
    } = options;

    const recoveryId = `chrome_to_idb_${Date.now()}`;
    let migrationStatus = {
      id: recoveryId,
      type: "recovery",
      state: this.MIGRATION_STATE.PENDING,
      startTime: new Date().toISOString(),
      sourceMigrationId: migrationId,
      overwriteExisting,
      progress: {},
      errors: {},
      totalItems: 0,
      restoredItems: 0,
    };

    try {
      console.log(`Starting migration from Chrome Storage: ${recoveryId}`);

      migrationStatus.state = this.MIGRATION_STATE.IN_PROGRESS;
      await this.saveMigrationStatus(migrationStatus);

      // Phase 1: Discover available migrations in Chrome Storage
      console.log("Phase 1: Discovering available data in Chrome Storage");
      const availableMigrations = await this.discoverChromeMigrations(
        migrationId
      );

      if (availableMigrations.length === 0) {
        throw new Error("No migration data found in Chrome Storage");
      }

      // Use the most recent migration if none specified
      const targetMigration = availableMigrations[0];
      migrationStatus.sourceMigrationId = targetMigration.id;

      // Create backup if requested
      if (createBackup) {
        migrationStatus.backupId =
          await migrationSafety.createMigrationBackup();
      }

      // Phase 2: Validate Chrome Storage data
      if (validateBefore) {
        console.log("Phase 2: Validating Chrome Storage data");
        const validation = await this.validateChromeStorageData(
          targetMigration.id
        );
        migrationStatus.validation = validation;

        if (!validation.valid) {
          throw new Error("Chrome Storage data validation failed");
        }
      }

      // Phase 3: Restore data to IndexedDB
      console.log("Phase 3: Restoring data to IndexedDB");
      const db = await dbHelper.openDB();

      for (const storeName of targetMigration.stores) {
        try {
          migrationStatus.progress[storeName] = { status: "restoring" };
          await this.saveMigrationStatus(migrationStatus);

          const restoreResult = await this.restoreStoreFromChrome(
            db,
            storeName,
            targetMigration.id,
            { overwriteExisting }
          );

          migrationStatus.progress[storeName] = {
            status: "completed",
            restored: restoreResult.restoredCount,
            skipped: restoreResult.skippedCount,
            size: restoreResult.totalSize,
          };

          migrationStatus.restoredItems += restoreResult.restoredCount;
        } catch (error) {
          console.error(`Failed to restore store ${storeName}:`, error);
          migrationStatus.errors[storeName] = error.message;
          migrationStatus.progress[storeName].status = "failed";
        }

        await this.saveMigrationStatus(migrationStatus);
      }

      // Phase 4: Post-restoration validation
      console.log("Phase 4: Validating restored data");
      const postValidation = await this.validateRestoredData(
        db,
        targetMigration.stores
      );
      migrationStatus.postValidation = postValidation;

      migrationStatus.state = this.MIGRATION_STATE.COMPLETED;
      migrationStatus.endTime = new Date().toISOString();
      migrationStatus.duration =
        new Date(migrationStatus.endTime) - new Date(migrationStatus.startTime);

      await this.saveMigrationStatus(migrationStatus);
      console.log(
        "Migration from Chrome Storage completed successfully:",
        recoveryId
      );

      return {
        success: true,
        migrationId: recoveryId,
        status: migrationStatus,
      };
    } catch (error) {
      console.error("Migration from Chrome Storage failed:", error);

      migrationStatus.state = this.MIGRATION_STATE.FAILED;
      migrationStatus.error = error.message;
      migrationStatus.endTime = new Date().toISOString();

      await this.saveMigrationStatus(migrationStatus);

      return {
        success: false,
        migrationId: recoveryId,
        error: error.message,
        status: migrationStatus,
      };
    }
  }

  /**
   * Migrate individual store to Chrome Storage
   */
  static async migrateStoreToChrome(storeName, data, options = {}) {
    const { compress = true, migrationId } = options;

    const chromeKey = `migration_${migrationId}_${storeName}`;
    const result = {
      migratedCount: 0,
      totalSize: 0,
      compressed: false,
    };

    try {
      if (data.length === 0) return result;

      // Prepare data for Chrome Storage
      if (compress) {
        const compressionResult =
          await StorageCompression.prepareForChromeStorage(
            chromeKey,
            data,
            { optimize: true, maxItemSize: 7000 } // Leave margin for metadata
          );

        if (compressionResult.success) {
          await ChromeAPIErrorHandler.storageSetWithRetry(
            compressionResult.items
          );
          result.compressed = true;
        } else {
          throw new Error(compressionResult.error);
        }
      } else {
        // Store without compression (may fail for large data)
        const dataString = JSON.stringify(data);
        const dataSize = new Blob([dataString]).size;

        if (dataSize > 8000) {
          throw new Error(
            "Data too large for Chrome Storage without compression"
          );
        }

        await ChromeAPIErrorHandler.storageSetWithRetry({
          [chromeKey]: data,
        });
      }

      // Store metadata
      await ChromeAPIErrorHandler.storageSetWithRetry({
        [`${chromeKey}_info`]: {
          storeName,
          itemCount: data.length,
          migrationId,
          timestamp: new Date().toISOString(),
          compressed: result.compressed,
        },
      });

      result.migratedCount = data.length;
      result.totalSize = JSON.stringify(data).length;

      return result;
    } catch (error) {
      console.error(`Store migration failed for ${storeName}:`, error);
      throw error;
    }
  }

  /**
   * Restore individual store from Chrome Storage
   */
  static async restoreStoreFromChrome(
    db,
    storeName,
    migrationId,
    options = {}
  ) {
    const { overwriteExisting = false } = options;

    const chromeKey = `migration_${migrationId}_${storeName}`;
    const result = {
      restoredCount: 0,
      skippedCount: 0,
      totalSize: 0,
    };

    try {
      // Get store info
      const storeInfo = await ChromeAPIErrorHandler.storageGetWithRetry([
        `${chromeKey}_info`,
      ]);
      const info = storeInfo[`${chromeKey}_info`];

      if (!info) {
        throw new Error(`No migration info found for store ${storeName}`);
      }

      // Get store data
      let storeData;
      if (info.compressed) {
        const compressionData = await ChromeAPIErrorHandler.storageGetWithRetry(
          [chromeKey, `${chromeKey}_metadata`]
        );

        const retrievalResult =
          await StorageCompression.retrieveFromChromeStorage(
            chromeKey,
            compressionData
          );

        if (!retrievalResult.success) {
          throw new Error(retrievalResult.error);
        }
        storeData = retrievalResult.data;
      } else {
        const rawData = await ChromeAPIErrorHandler.storageGetWithRetry([
          chromeKey,
        ]);
        storeData = rawData[chromeKey];
      }

      if (!Array.isArray(storeData)) {
        throw new Error("Invalid store data format");
      }

      // Restore to IndexedDB
      if (!db.objectStoreNames.contains(storeName)) {
        throw new Error(
          `Target store ${storeName} does not exist in IndexedDB`
        );
      }

      const transaction = db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);

      // Clear existing data if overwrite is enabled
      if (overwriteExisting) {
        await new Promise((resolve, reject) => {
          const clearRequest = store.clear();
          clearRequest.onsuccess = () => resolve();
          clearRequest.onerror = () => reject(clearRequest.error);
        });
      }

      // Restore each item
      for (const item of storeData) {
        try {
          await new Promise((resolve, reject) => {
            const putRequest = store.put(item);
            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(putRequest.error);
          });
          result.restoredCount++;
        } catch (itemError) {
          console.warn(`Failed to restore item in ${storeName}:`, itemError);
          result.skippedCount++;
        }
      }

      result.totalSize = JSON.stringify(storeData).length;
      return result;
    } catch (error) {
      console.error(`Store restoration failed for ${storeName}:`, error);
      throw error;
    }
  }

  /**
   * Discover available migrations in Chrome Storage
   */
  static async discoverChromeMigrations(specificMigrationId = null) {
    try {
      const allData = await ChromeAPIErrorHandler.storageGetWithRetry(null);
      const migrations = [];

      for (const [key, value] of Object.entries(allData)) {
        if (key.startsWith("migration_") && key.endsWith("_info")) {
          const migrationMatch = key.match(/migration_(.+?)_(.+)_info/);
          if (migrationMatch) {
            const [, migrationId, storeName] = migrationMatch;

            if (specificMigrationId && migrationId !== specificMigrationId) {
              continue;
            }

            let migration = migrations.find((m) => m.id === migrationId);
            if (!migration) {
              migration = {
                id: migrationId,
                timestamp: value.timestamp,
                stores: [],
                totalItems: 0,
              };
              migrations.push(migration);
            }

            migration.stores.push(storeName);
            migration.totalItems += value.itemCount || 0;
          }
        }
      }

      // Sort by timestamp (most recent first)
      migrations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      return migrations;
    } catch (error) {
      console.error("Failed to discover Chrome migrations:", error);
      return [];
    }
  }

  /**
   * Validate migration data integrity
   */
  static async validateMigration(migrationId, originalData) {
    const validation = {
      valid: true,
      errors: [],
      storeValidation: {},
    };

    try {
      for (const [storeName, originalItems] of Object.entries(originalData)) {
        const storeValidation = {
          valid: true,
          originalCount: originalItems.length,
          migratedCount: 0,
          dataIntegrity: true,
        };

        try {
          // Get migrated data
          const chromeKey = `migration_${migrationId}_${storeName}`;
          const storeInfo = await ChromeAPIErrorHandler.storageGetWithRetry([
            `${chromeKey}_info`,
          ]);
          const info = storeInfo[`${chromeKey}_info`];

          if (!info) {
            storeValidation.valid = false;
            validation.errors.push(`No migration info for store ${storeName}`);
          } else {
            storeValidation.migratedCount = info.itemCount;

            // Check counts match
            if (
              storeValidation.originalCount !== storeValidation.migratedCount
            ) {
              storeValidation.valid = false;
              validation.errors.push(`Count mismatch in store ${storeName}`);
            }
          }
        } catch (error) {
          storeValidation.valid = false;
          validation.errors.push(
            `Validation failed for store ${storeName}: ${error.message}`
          );
        }

        validation.storeValidation[storeName] = storeValidation;
        if (!storeValidation.valid) {
          validation.valid = false;
        }
      }
    } catch (error) {
      validation.valid = false;
      validation.errors.push(`Validation failed: ${error.message}`);
    }

    return validation;
  }

  /**
   * Validate Chrome Storage data before restoration
   */
  static async validateChromeStorageData(migrationId) {
    const validation = {
      valid: true,
      errors: [],
      stores: {},
    };

    try {
      const discoveries = await this.discoverChromeMigrations(migrationId);
      const migration = discoveries.find((m) => m.id === migrationId);

      if (!migration) {
        validation.valid = false;
        validation.errors.push("Migration not found");
        return validation;
      }

      // Validate each store
      for (const storeName of migration.stores) {
        const storeValidation = await this.validateChromeStore(
          migrationId,
          storeName
        );
        validation.stores[storeName] = storeValidation;

        if (!storeValidation.valid) {
          validation.valid = false;
          validation.errors.push(...storeValidation.errors);
        }
      }
    } catch (error) {
      validation.valid = false;
      validation.errors.push(error.message);
    }

    return validation;
  }

  /**
   * Validate individual store in Chrome Storage
   */
  static async validateChromeStore(migrationId, storeName) {
    const validation = {
      valid: true,
      errors: [],
      hasData: false,
      hasMetadata: false,
      itemCount: 0,
    };

    try {
      const chromeKey = `migration_${migrationId}_${storeName}`;

      // Check for store info
      const storeInfo = await ChromeAPIErrorHandler.storageGetWithRetry([
        `${chromeKey}_info`,
      ]);
      validation.hasMetadata = !!storeInfo[`${chromeKey}_info`];

      if (validation.hasMetadata) {
        validation.itemCount = storeInfo[`${chromeKey}_info`].itemCount || 0;
      }

      // Check for actual data
      const storeData = await ChromeAPIErrorHandler.storageGetWithRetry([
        chromeKey,
      ]);
      validation.hasData = !!storeData[chromeKey];

      if (!validation.hasMetadata) {
        validation.valid = false;
        validation.errors.push(`Missing metadata for store ${storeName}`);
      }

      if (!validation.hasData) {
        validation.valid = false;
        validation.errors.push(`Missing data for store ${storeName}`);
      }
    } catch (error) {
      validation.valid = false;
      validation.errors.push(error.message);
    }

    return validation;
  }

  /**
   * Validate restored data in IndexedDB
   */
  static async validateRestoredData(db, storeNames) {
    const validation = {
      valid: true,
      errors: [],
      stores: {},
    };

    try {
      for (const storeName of storeNames) {
        if (!db.objectStoreNames.contains(storeName)) {
          validation.stores[storeName] = {
            valid: false,
            error: "Store not found in IndexedDB",
          };
          validation.valid = false;
          continue;
        }

        const transaction = db.transaction([storeName], "readonly");
        const store = transaction.objectStore(storeName);

        const count = await new Promise((resolve, reject) => {
          const request = store.count();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });

        validation.stores[storeName] = {
          valid: count > 0,
          itemCount: count,
        };

        if (count === 0) {
          validation.valid = false;
        }
      }
    } catch (error) {
      validation.valid = false;
      validation.errors.push(error.message);
    }

    return validation;
  }

  /**
   * Save migration status to Chrome Storage
   */
  static async saveMigrationStatus(status) {
    try {
      await ChromeAPIErrorHandler.storageSetWithRetry({
        [this.MIGRATION_KEYS.STATUS]: status,
        [`${this.MIGRATION_KEYS.STATUS}_${status.id}`]: status,
      });
    } catch (error) {
      console.warn("Failed to save migration status:", error);
    }
  }

  /**
   * Get migration status
   */
  static async getMigrationStatus(migrationId = null) {
    try {
      if (migrationId) {
        const statusData = await ChromeAPIErrorHandler.storageGetWithRetry([
          `${this.MIGRATION_KEYS.STATUS}_${migrationId}`,
        ]);
        return (
          statusData[`${this.MIGRATION_KEYS.STATUS}_${migrationId}`] || null
        );
      } else {
        const statusData = await ChromeAPIErrorHandler.storageGetWithRetry([
          this.MIGRATION_KEYS.STATUS,
        ]);
        return statusData[this.MIGRATION_KEYS.STATUS] || null;
      }
    } catch (error) {
      console.error("Failed to get migration status:", error);
      return null;
    }
  }

  /**
   * List all completed migrations
   */
  static async listMigrations() {
    try {
      const allData = await ChromeAPIErrorHandler.storageGetWithRetry(null);
      const migrations = [];

      for (const [key, value] of Object.entries(allData)) {
        if (key.startsWith(`${this.MIGRATION_KEYS.STATUS}_`)) {
          migrations.push(value);
        }
      }

      // Sort by start time (most recent first)
      migrations.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

      return migrations;
    } catch (error) {
      console.error("Failed to list migrations:", error);
      return [];
    }
  }

  /**
   * Clean up old migration data
   */
  static async cleanupOldMigrations(maxAge = 7) {
    // 7 days
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxAge);

      const allData = await ChromeAPIErrorHandler.storageGetWithRetry(null);
      const keysToRemove = [];

      for (const [key, value] of Object.entries(allData)) {
        if (key.startsWith("migration_")) {
          const timestamp = value.timestamp || value.startTime;
          if (timestamp && new Date(timestamp) < cutoffDate) {
            keysToRemove.push(key);
          }
        }
      }

      if (keysToRemove.length > 0) {
        await new Promise((resolve) => {
          chrome.storage.local.remove(keysToRemove, () => resolve());
        });

        console.log(`Cleaned up ${keysToRemove.length} old migration records`);
      }

      return keysToRemove.length;
    } catch (error) {
      console.error("Failed to cleanup old migrations:", error);
      return 0;
    }
  }
}

export default StorageMigrationService;
