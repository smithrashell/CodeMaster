/**
 * Storage Health Monitor - Minimal Stub Implementation
 * 
 * Provides basic storage health assessment without detailed monitoring.
 * This is a lightweight stub to maintain compatibility after cleanup.
 */

export default class StorageHealthMonitor {
  static healthHistory = [];

  /**
   * Assess storage health (stub - basic check)
   * @returns {Promise<Object>} Basic health status
   */
  static assessStorageHealth() {
    const timestamp = new Date().toISOString();
    
    // Basic health assessment
    const health = {
      timestamp,
      status: 'healthy',
      indexedDBAvailable: typeof indexedDB !== 'undefined',
      chromeStorageAvailable: typeof chrome?.storage !== 'undefined',
      memoryUsage: 'unknown',
      diskSpace: 'unknown'
    };

    // Add to history (keep last 10 entries)
    this.healthHistory.push(health);
    if (this.healthHistory.length > 10) {
      this.healthHistory.shift();
    }

    return health;
  }

  /**
   * Get health history
   * @returns {Array} Health history array
   */
  static getHealthHistory() {
    return [...this.healthHistory];
  }

  /**
   * Get health trends (stub)
   * @returns {Object} Basic trends object
   */
  static getHealthTrends() {
    return {
      overallTrend: 'stable',
      recentStatus: this.healthHistory.length > 0 ? this.healthHistory[this.healthHistory.length - 1]?.status : 'unknown',
      totalChecks: this.healthHistory.length
    };
  }
}