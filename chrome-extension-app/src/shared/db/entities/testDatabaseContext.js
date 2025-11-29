/**
 * 🔄 Test Database Context Manager
 * Temporarily overrides the global database helper to redirect to test database
 * This allows existing services to work unchanged but write to test database
 */

import { createTestDbHelper } from '../core/dbHelperFactory.js';
import { dbHelper } from '../index.js';

class TestDatabaseContext {
  constructor() {
    this.originalDbHelper = null;
    this.testDbHelper = null;
    this.isActive = false;
  }

  /**
   * Activate test database context
   * All database operations will now use test database
   */
  activate(testName = 'default') {
    if (this.isActive) {
      console.warn('⚠️ Test database context already active');
      return this.testDbHelper;
    }

    // Store original methods for restoration - make a deep copy to avoid references
    this.originalDbHelper = {
      dbName: dbHelper.dbName,
      openDB: dbHelper.openDB.bind(dbHelper), // Bind to maintain context
      version: dbHelper.version,
      db: dbHelper.db,
      pendingConnection: dbHelper.pendingConnection,
      // Store all other essential properties
      validateDatabaseIntegrity: dbHelper.validateDatabaseIntegrity,
      repairDatabase: dbHelper.repairDatabase,
      ensureIndex: dbHelper.ensureIndex,
      getStore: dbHelper.getStore
    };

    // Create test database helper
    this.testDbHelper = createTestDbHelper(`test_${testName}_${Date.now()}`);

    // Set global flags FIRST to ensure all interception works
    globalThis._testDatabaseActive = true;
    globalThis._testDatabaseHelper = this.testDbHelper;

    // Override the primary database access method and properties with safer approach
    const originalDbHelper = dbHelper;

    // Create a safer wrapper that preserves the original object structure
    originalDbHelper.dbName = this.testDbHelper.dbName;
    originalDbHelper.isTestMode = true;
    originalDbHelper._testDatabaseHelper = this.testDbHelper;
    originalDbHelper.version = this.testDbHelper.version;
    originalDbHelper.db = null; // Clear cached connection
    originalDbHelper.pendingConnection = null; // Clear pending connection

    // Wrap the openDB method with proper error handling
    const originalOpenDB = originalDbHelper.openDB;
    originalDbHelper.openDB = function() {
      try {
        console.log(`🔄 Context switching: Redirecting to test database: ${this.testDbHelper?.dbName || 'unknown'}`);

        if (!globalThis._testDatabaseHelper) {
          console.error('❌ Test database helper not available in global context');
          throw new Error('Test database helper not available');
        }

        return globalThis._testDatabaseHelper.openDB();
      } catch (error) {
        console.error('❌ Test database context error:', error);
        // Fallback to original method if test context fails
        return originalOpenDB.call(this);
      }
    };

    this.isActive = true;

    console.log(`✅ Test database context activated: ${this.testDbHelper.dbName}`);
    return this.testDbHelper;
  }

  /**
   * Deactivate test database context
   * Restore original database helper
   */
  async deactivate() {
    if (!this.isActive) {
      console.warn('⚠️ Test database context not active');
      return;
    }

    try {
      // Clean up test database
      if (this.testDbHelper) {
        await this.testDbHelper.deleteDB();
        console.log(`🗑️ Test database deleted: ${this.testDbHelper.dbName}`);
      }
    } catch (error) {
      console.warn('⚠️ Failed to cleanup test database:', error.message);
    }

    // Clean up global flags FIRST
    delete globalThis._testDatabaseActive;
    delete globalThis._testDatabaseHelper;

    // Restore original database helper
    if (this.originalDbHelper) {
      const originalDbHelper = dbHelper;

      // Safely restore all original properties and methods
      originalDbHelper.dbName = this.originalDbHelper.dbName;
      originalDbHelper.openDB = this.originalDbHelper.openDB;
      originalDbHelper.version = this.originalDbHelper.version;
      originalDbHelper.db = this.originalDbHelper.db;
      originalDbHelper.pendingConnection = this.originalDbHelper.pendingConnection;

      // Restore other methods
      if (this.originalDbHelper.validateDatabaseIntegrity) {
        originalDbHelper.validateDatabaseIntegrity = this.originalDbHelper.validateDatabaseIntegrity;
      }
      if (this.originalDbHelper.repairDatabase) {
        originalDbHelper.repairDatabase = this.originalDbHelper.repairDatabase;
      }
      if (this.originalDbHelper.ensureIndex) {
        originalDbHelper.ensureIndex = this.originalDbHelper.ensureIndex;
      }
      if (this.originalDbHelper.getStore) {
        originalDbHelper.getStore = this.originalDbHelper.getStore;
      }

      // Remove test mode flags and test database references
      delete originalDbHelper.isTestMode;
      delete originalDbHelper._testDatabaseHelper;

      console.log('✅ Original database context restored');
    }

    this.isActive = false;
    this.originalDbHelper = null;
    this.testDbHelper = null;
  }

  /**
   * Get current test database helper
   */
  getTestDb() {
    if (!this.isActive) {
      throw new Error('Test database context not active');
    }
    return this.testDbHelper;
  }

  /**
   * Check if test context is active
   */
  isTestContextActive() {
    return this.isActive;
  }
}

// Global instance
const testDbContext = new TestDatabaseContext();

export default testDbContext;

/**
 * Helper functions for tests
 */
export async function withTestDatabase(testName, callback) {
  let testDb;
  try {
    testDb = await testDbContext.activate(testName);
    return await callback(testDb);
  } finally {
    await testDbContext.deactivate();
  }
}

export async function activateTestDatabase(testName) {
  return await testDbContext.activate(testName);
}

export async function deactivateTestDatabase() {
  return await testDbContext.deactivate();
}