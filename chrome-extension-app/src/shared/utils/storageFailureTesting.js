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
  static simulateFailure(_type = 'indexeddb') {
    this.isSimulatingFailure = true;
  }

  /**
   * Reset failure simulation (stub)
   * @returns {Promise<void>}
   */
  static resetSimulation() {
    this.isSimulatingFailure = false;
  }

  /**
   * Check if failure is being simulated
   * @returns {boolean}
   */
  static isFailureSimulated() {
    return this.isSimulatingFailure;
  }
}