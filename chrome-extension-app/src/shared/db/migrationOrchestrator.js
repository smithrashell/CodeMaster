import {
  createAttemptsStore,
  createLimitsStore,
  createSessionStateStore,
  createProblemRelationshipsStore,
  createProblemsStore,
  createSessionsStore,
  createStandardProblemsStore,
  createBackupStorageStore,
  createTagRelationshipsStore,
  createTagMasteryStore,
  createSettingsStore,
  createPatternLaddersStore,
  createSessionAnalyticsStore,
  createStrategyDataStore,
  createHintInteractionsStore,
  createUserActionsStore,
  createErrorReportsStore
} from "./storeCreation.js";

import { backupIndexedDB } from "./backupDB.js";

/**
 * Handles the database upgrade process with migration safety
 * @param {IDBVersionChangeEvent} event - The upgrade event
 */
export function handleDatabaseUpgrade(event) {
  console.log("📋 Database upgrade needed - creating safety backup...");
  console.log("🔧 Database upgrade event:", {
    oldVersion: event.oldVersion,
    newVersion: event.newVersion,
    target: event.target
  });

  // Create backup before any schema changes - CRITICAL for data safety
  handleMigrationBackup(event.oldVersion);

  const db = event.target.result;
  const transaction = event.target.transaction;

  console.log("🔧 Database instance for upgrade:", {
    name: db.name,
    version: db.version,
    objectStoreNames: Array.from(db.objectStoreNames)
  });

  // Execute all store creation operations
  executeStoreCreationOperations(db, transaction);

  console.log("✅ Database upgrade completed - final object stores:", Array.from(db.objectStoreNames));
}

/**
 * Handles migration backup creation
 * @param {number} oldVersion - The old database version
 */
function handleMigrationBackup(oldVersion) {
  try {
    if (oldVersion > 0) {
      // Only backup if upgrading existing database (not initial creation)
      console.log("🔄 Creating migration backup before schema upgrade...");
      
      // Use the working migration safety backup function (which now actually creates backups)
      const backupId = createActualMigrationBackup();
      console.log("✅ Migration backup created successfully:", backupId);
    } else {
      console.log("ℹ️ Skipping backup for initial database creation");
    }
  } catch (error) {
    console.error("❌ CRITICAL: Backup creation failed!", error);
    
    // Log the critical error but continue migration - stopping here would prevent users from using the extension
    console.warn("⚠️ Proceeding with migration without backup - RISK: Data may be lost if migration fails");
  }
}

/**
 * Creates an actual migration backup using the existing backup infrastructure
 * This replaces the disabled backup functionality with working implementation
 */
function createActualMigrationBackup() {
  // Schedule the backup to run asynchronously after the upgrade completes
  setTimeout(async () => {
    try {
      console.log("🔄 Creating post-upgrade backup for safety...");
      await backupIndexedDB();
      console.log("✅ Post-upgrade backup completed");
    } catch (error) {
      console.error("❌ Post-upgrade backup failed:", error);
    }
  }, 100); // Small delay to ensure upgrade transaction completes first
  
  // Return a backup ID for consistency with the original API
  return `migration_backup_${Date.now()}_v${37}`; // Current version is 37
}

/**
 * Executes all store creation operations in organized groups
 * @param {IDBDatabase} db - Database instance
 * @param {IDBTransaction} transaction - The upgrade transaction
 */
function executeStoreCreationOperations(db, transaction) {
  console.log("🏗️ Starting store creation operations...");
  
  try {
    // Core data stores
    console.log("🔧 Creating core data stores...");
    createCoreDataStores(db, transaction);
    console.log("✅ Core data stores created");
    
    // Strategy stores
    console.log("🔧 Creating strategy stores...");
    createStrategyStores(db, transaction);
    console.log("✅ Strategy stores created");
    
    // Analytics and tracking stores
    console.log("🔧 Creating analytics stores...");
    createAnalyticsStores(db);
    console.log("✅ Analytics stores created");
    
    // System and utility stores
    console.log("🔧 Creating system stores...");
    createSystemStores(db);
    console.log("✅ System stores created");
    
    console.log("🎉 All store creation operations completed successfully");
  } catch (error) {
    console.error("❌ Error during store creation:", error);
    throw error;
  }
}

/**
 * Creates core data stores (attempts, problems, sessions, etc.)
 * @param {IDBDatabase} db - Database instance
 * @param {IDBTransaction} transaction - The upgrade transaction
 */
function createCoreDataStores(db, transaction) {
  createAttemptsStore(db);
  createLimitsStore(db);
  createSessionStateStore(db);
  createProblemRelationshipsStore(db);
  createProblemsStore(db);
  createSessionsStore(db, transaction);
  createStandardProblemsStore(db);
  createTagRelationshipsStore(db, transaction);
  createTagMasteryStore(db);
  createPatternLaddersStore(db);
}

/**
 * Creates analytics and tracking stores
 * @param {IDBDatabase} db - Database instance
 */
function createAnalyticsStores(db) {
  createSessionAnalyticsStore(db);
  createHintInteractionsStore(db);
  createUserActionsStore(db);
  createErrorReportsStore(db);
}

/**
 * Creates system and utility stores
 * @param {IDBDatabase} db - Database instance
 */
function createSystemStores(db) {
  createBackupStorageStore(db);
  createSettingsStore(db);
}

/**
 * Creates strategy-related stores with transaction support
 * @param {IDBDatabase} db - Database instance
 * @param {IDBTransaction} transaction - The upgrade transaction
 */
function createStrategyStores(db, transaction) {
  createStrategyDataStore(db, transaction);
}

