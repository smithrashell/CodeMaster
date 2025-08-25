/**
 * Storage Failure Testing - Minimal Stub Implementation
 * 
 * Provides basic failure simulation for tests.
 * This is a lightweight stub to maintain test compatibility.
 */

export default class StorageFailureTesting {
  static isSimulatingFailure = false;

  /**
   * Simulate storage failure (stub)
   * @param {string} type - Failure type
   * @returns {Promise<void>}
   */
  static async simulateFailure(type = 'indexeddb') {
    this.isSimulatingFailure = true;
    console.log(`Simulating ${type} failure (stub)`);
  }

  /**
   * Reset failure simulation (stub)
   * @returns {Promise<void>}
   */
  static async resetSimulation() {
    this.isSimulatingFailure = false;
    console.log('Reset failure simulation (stub)');
  }

  /**
   * Check if failure is being simulated
   * @returns {boolean}
   */
  static isFailureSimulated() {
    return this.isSimulatingFailure;
  }
}