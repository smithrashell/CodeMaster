/**
 * 🧪 Test Database Manager
 * Manages shared test database instances with smart seeding and teardown
 */

import { createScenarioTestDb } from '../core/dbHelperFactory.js';

class TestDatabaseManager {
  constructor() {
    this.sharedTestDb = null;
    this.isSeeded = false;
    this.seedingPromise = null;
  }

  /**
   * Get or create a shared test database with production-like seeding
   * This database persists expensive seeded data across tests
   */
  async getSharedTestDb() {
    if (!this.sharedTestDb) {
      console.log('🧪 Creating shared test database...');
      this.sharedTestDb = createScenarioTestDb('production-like');

      // Ensure one-time seeding
      if (!this.isSeeded && !this.seedingPromise) {
        this.seedingPromise = this.performInitialSeeding();
      }

      if (this.seedingPromise) {
        await this.seedingPromise;
      }
    }

    return this.sharedTestDb;
  }

  async performInitialSeeding() {
    try {
      console.log('🌱 Performing one-time test database seeding...');
      const seedResults = await this.sharedTestDb.seedProductionLikeData();

      const successfulSeeds = Object.values(seedResults).filter(Boolean).length;
      console.log(`✅ Test database seeded: ${successfulSeeds}/5 components ready`);

      this.isSeeded = true;
      this.seedingPromise = null; // Clear the promise

      return seedResults;
    } catch (error) {
      console.error('❌ Test database seeding failed:', error);
      this.seedingPromise = null;
      throw error;
    }
  }

  /**
   * Prepare test database for a new test
   * Clears user data but preserves expensive seeded data
   */
  async prepareForTest(testName = 'unknown') {
    const testDb = await this.getSharedTestDb();

    console.log(`🧹 Preparing test database for: ${testName}`);

    // Smart teardown - preserve expensive seeded data
    const cleanupResults = await testDb.resetToCleanState();

    console.log(`✅ Test database ready for: ${testName} (preserved: ${cleanupResults.preserved.length} stores)`);

    return testDb;
  }

  /**
   * Get a completely fresh test database (for tests that need isolation)
   */
  getFreshTestDb(testName = 'isolated') {
    console.log(`🆕 Creating fresh isolated test database for: ${testName}`);
    return createScenarioTestDb('empty');
  }

  /**
   * Cleanup after all tests complete
   */
  async cleanupAll() {
    if (this.sharedTestDb) {
      try {
        console.log('🗑️ Cleaning up shared test database...');
        await this.sharedTestDb.deleteDB();
        console.log('✅ Shared test database deleted');
      } catch (error) {
        console.warn('⚠️ Failed to cleanup shared test database:', error.message);
      }

      this.sharedTestDb = null;
      this.isSeeded = false;
      this.seedingPromise = null;
    }
  }

  /**
   * Get database info for debugging
   */
  getStatus() {
    return {
      hasSharedDb: !!this.sharedTestDb,
      isSeeded: this.isSeeded,
      isSeeding: !!this.seedingPromise,
      dbInfo: this.sharedTestDb ? this.sharedTestDb.getInfo() : null
    };
  }
}

// Global test database manager instance
const testDbManager = new TestDatabaseManager();

export default testDbManager;

/**
 * Helper functions for tests
 */
export async function getTestDatabase(testName) {
  return await testDbManager.prepareForTest(testName);
}

export async function getFreshTestDatabase(testName) {
  return await testDbManager.getFreshTestDb(testName);
}

export async function cleanupTestDatabases() {
  return await testDbManager.cleanupAll();
}

/**
 * Test lifecycle helpers
 */
export function setupTestDatabase() {
  // Call this in beforeAll or similar
  return testDbManager.getSharedTestDb();
}

export function teardownTestDatabase() {
  // Call this in afterAll or similar
  return testDbManager.cleanupAll();
}