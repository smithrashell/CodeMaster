/**
 * Storage Migration Service - Minimal Stub Implementation
 * 
 * Provides basic migration functionality for tests and UI compatibility.
 * This is a lightweight stub to maintain test compatibility.
 */

export default class StorageMigrationService {
  /**
   * List recent migrations (stub)
   * @returns {Promise<Array>} Migration history array
   */
  static listMigrations() {
    return Promise.resolve([]);
  }

  /**
   * Perform migration (stub)
   * @param {string} _targetVersion - Target version
   * @returns {Promise<Object>} Migration result
   */
  static performMigration(_targetVersion) {
    return Promise.resolve({
      success: true,
      message: 'Migration stub - no actual migration performed',
      version: _targetVersion
    });
  }

  /**
   * Check if migration is needed (stub)
   * @returns {Promise<boolean>} Whether migration is needed
   */
  static isMigrationNeeded() {
    return Promise.resolve(false);
  }
}