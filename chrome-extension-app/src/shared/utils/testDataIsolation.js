/**
 * 🧪 Test Data Isolation System
 * Creates sandboxed environment for testing real system functions without affecting user data
 */

// Note: Using openDB directly to avoid import restrictions
// import { dbHelper } from '../db/index.js';

export class TestDataIsolation {
  static TEST_DB_NAME = 'codemaster_test_db';
  static ORIGINAL_DB_NAME = 'codemaster_db';
  static isTestMode = false;
  static testSession = null;

  /**
   * Simple openDB function for test isolation
   */
  static async openDB() {
    return new Promise((resolve, reject) => {
      const dbName = this.isTestMode ?
        `${this.TEST_DB_NAME}_${this.testSession}` :
        this.ORIGINAL_DB_NAME;

      const request = indexedDB.open(dbName, 22);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        // Create basic stores for testing
        const stores = [
          'problems', 'sessions', 'attempts', 'tag_mastery',
          'standard_problems', 'pattern_ladders', 'problem_relationships',
          'session_analytics', 'settings'
        ];
        stores.forEach(storeName => {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
          }
        });
      };
    });
  }

  /**
   * Enter test mode - switches to isolated test database
   */
  static async enterTestMode(testSessionId = null) {
    if (this.isTestMode) {
      console.warn('⚠️ Already in test mode. Call exitTestMode() first.');
      return;
    }

    this.testSession = testSessionId || `test_${Date.now()}`;
    this.isTestMode = true;

    // Store original database name
    // Note: We'll use our own openDB method instead of modifying dbHelper

    console.log(`🧪 Entered test mode. Using test session: ${this.testSession}`);

    // Initialize test database with clean schema
    await this.initializeTestDatabase();

    return this.testSession;
  }

  /**
   * Exit test mode - switches back to user database and optionally cleans up
   */
  static async exitTestMode(cleanupTestData = true) {
    if (!this.isTestMode) {
      console.warn('⚠️ Not in test mode.');
      return;
    }

    const testDbName = `${this.TEST_DB_NAME}_${this.testSession}`;

    // Switch back to original database
    this.isTestMode = false;

    console.log(`✅ Exited test mode. Restored to production database`);

    // Clean up test database if requested
    if (cleanupTestData) {
      await this.cleanupTestDatabase(testDbName);
    }

    this.testSession = null;
  }

  /**
   * Initialize clean test database with same schema as production
   */
  static async initializeTestDatabase() {
    try {
      // Force new database connection with test name
      // Use our own openDB method
      const testDb = await this.openDB();

      // Verify all required stores exist (they'll be created automatically by schema)
      const requiredStores = [
        'problems', 'sessions', 'attempts', 'tag_mastery',
        'standard_problems', 'pattern_ladders', 'problem_relationships',
        'session_analytics', 'settings'
      ];

      // Verify stores exist by attempting transaction
      try {
        testDb.transaction(requiredStores, 'readonly');
        console.log(`🏗️ Test database initialized with ${requiredStores.length} stores`);
      } catch (error) {
        console.warn(`⚠️ Some stores may not exist yet: ${error.message}`);
      }

      return testDb;
    } catch (error) {
      console.error('❌ Failed to initialize test database:', error);
      throw error;
    }
  }

  /**
   * Clean up test database after testing
   */
  static async cleanupTestDatabase(testDbName) {
    try {
      // Delete the test database
      const deleteRequest = indexedDB.deleteDatabase(testDbName);

      return new Promise((resolve, reject) => {
        deleteRequest.onsuccess = () => {
          console.log(`🗑️ Cleaned up test database: ${testDbName}`);
          resolve();
        };
        deleteRequest.onerror = () => {
          console.error(`❌ Failed to cleanup test database: ${testDbName}`);
          reject(deleteRequest.error);
        };
      });
    } catch (error) {
      console.error('❌ Error during database cleanup:', error);
    }
  }

  /**
   * Seed test database with realistic but fake data
   */
  static async seedTestData(scenario = 'default') {
    if (!this.isTestMode) {
      throw new Error('Must be in test mode to seed test data');
    }

    const testData = this.getTestDataScenario(scenario);

    const db = await this.openDB();

    // Seed problems
    if (testData.problems) {
      const problemsTransaction = db.transaction('problems', 'readwrite');
      const problemsStore = problemsTransaction.objectStore('problems');

      for (const problem of testData.problems) {
        await new Promise((resolve, reject) => {
          const request = problemsStore.add(problem);
          request.onsuccess = resolve;
          request.onerror = reject;
        });
      }
    }

    // Seed tag mastery
    if (testData.tagMastery) {
      const tagTransaction = db.transaction('tag_mastery', 'readwrite');
      const tagStore = tagTransaction.objectStore('tag_mastery');

      for (const tagData of testData.tagMastery) {
        await new Promise((resolve, reject) => {
          const request = tagStore.add(tagData);
          request.onsuccess = resolve;
          request.onerror = reject;
        });
      }
    }

    // Seed settings
    if (testData.settings) {
      const settingsTransaction = db.transaction('settings', 'readwrite');
      const settingsStore = settingsTransaction.objectStore('settings');

      await new Promise((resolve, reject) => {
        const request = settingsStore.add(testData.settings);
        request.onsuccess = resolve;
        request.onerror = reject;
      });
    }

    console.log(`🌱 Seeded test data for scenario: ${scenario}`);
  }

  /**
   * Get test data scenarios for different testing situations
   */
  static getTestDataScenario(scenario) {
    const scenarios = {
      'default': {
        problems: [
          {
            id: 1001,
            leetcode_id: 1001,
            title: "Test Array Problem",
            tags: ['array', 'two-pointers'],
            difficulty: 'Easy',
            acceptance_rate: 0.75
          },
          {
            id: 1002,
            leetcode_id: 1002,
            title: "Test Hash Table Problem",
            tags: ['hash-table', 'array'],
            difficulty: 'Medium',
            acceptance_rate: 0.60
          },
          {
            id: 1003,
            leetcode_id: 1003,
            title: "Test Tree Problem",
            tags: ['tree', 'dfs'],
            difficulty: 'Hard',
            acceptance_rate: 0.45
          }
        ],
        tagMastery: [
          {
            id: 1,
            tag: 'array',
            success_rate: 0.8,
            total_attempts: 10,
            current_box: 3,
            mastered: false
          },
          {
            id: 2,
            tag: 'hash-table',
            success_rate: 0.6,
            total_attempts: 5,
            current_box: 2,
            mastered: false
          }
        ],
        settings: {
          id: 1,
          focusAreas: ['array', 'hash-table'],
          sessionsPerWeek: 5,
          sessionLength: 5,
          reviewRatio: 40
        }
      },
      'experienced_user': {
        problems: [
          // More problems with higher difficulty distribution
          {
            id: 2001,
            leetcode_id: 2001,
            title: "Advanced Array Problem",
            tags: ['array', 'dynamic-programming'],
            difficulty: 'Hard',
            acceptance_rate: 0.35
          },
          {
            id: 2002,
            leetcode_id: 2002,
            title: "Complex Graph Problem",
            tags: ['graph', 'bfs', 'dfs'],
            difficulty: 'Hard',
            acceptance_rate: 0.25
          }
        ],
        tagMastery: [
          {
            id: 1,
            tag: 'array',
            success_rate: 0.95,
            total_attempts: 50,
            current_box: 5,
            mastered: true
          },
          {
            id: 2,
            tag: 'dynamic-programming',
            success_rate: 0.75,
            total_attempts: 20,
            current_box: 4,
            mastered: false
          }
        ],
        settings: {
          id: 1,
          focusAreas: ['dynamic-programming', 'graph'],
          sessionsPerWeek: 7,
          sessionLength: 8,
          reviewRatio: 30
        }
      }
    };

    return scenarios[scenario] || scenarios['default'];
  }

  /**
   * Verify test mode is active (safety check)
   */
  static ensureTestMode() {
    if (!this.isTestMode) {
      throw new Error('🚨 SAFETY: This function requires test mode to prevent data corruption');
    }
  }

  /**
   * Get current test session identifier
   */
  static getCurrentTestSession() {
    return this.testSession;
  }

  /**
   * Create isolated storage service for tests
   */
  static createTestStorageService() {
    this.ensureTestMode();

    // Return a storage service that automatically uses test database
    return {
      async getSessionState(key) {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction('sessions', 'readonly');
          const store = transaction.objectStore('sessions');
          const request = store.get(key);

          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      },

      async setSessionState(key, data) {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction('sessions', 'readwrite');
          const store = transaction.objectStore('sessions');

          const sessionData = { ...data, id: key };
          const request = store.put(sessionData);

          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      },

      async getSettings() {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction('settings', 'readonly');
          const store = transaction.objectStore('settings');
          const request = store.getAll();

          request.onsuccess = () => {
            const settings = request.result[0] || {};
            resolve(settings);
          };
          request.onerror = () => reject(request.error);
        });
      }
    };
  }
}

export default TestDataIsolation;