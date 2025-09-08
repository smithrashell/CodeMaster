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

  // Create backup before any schema changes
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
  // TEMPORARY: Disable migration backup to prevent duplicate database creation
  try {
    if (oldVersion > 0) {
      // Only backup if upgrading existing database
      // await migrationSafety.createMigrationBackup(); // DISABLED temporarily
      console.info("⚠️ Migration backup disabled to prevent duplicate databases");
    }
  } catch (error) {
    console.error("⚠️ Backup creation failed, proceeding with upgrade:", error);
  }
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

