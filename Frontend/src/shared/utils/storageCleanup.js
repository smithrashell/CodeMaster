/**
 * Storage Cleanup Manager - Minimal Stub Implementation
 * 
 * Provides basic cleanup functionality for tests.
 * This is a lightweight stub to maintain test compatibility.
 */

export default class StorageCleanupManager {
  /**
   * Clean up old data (stub)
   * @param {number} daysOld - Days threshold
   * @returns {Promise<Object>} Cleanup result
   */
  static async cleanupOldData(daysOld = 30) {
    return {
      deletedCount: 0,
      freedBytes: 0,
      message: 'Cleanup stub - no actual cleanup performed'
    };
  }

  /**
   * Get cleanup recommendations (stub)
   * @returns {Promise<Array>} Recommendations array
   */
  static async getCleanupRecommendations() {
    return [];
  }
}