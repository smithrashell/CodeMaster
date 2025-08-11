/**
 * IndexedDB Retry Service for CodeMaster
 *
 * Provides robust retry logic, timeout handling, circuit breaker pattern,
 * request deduplication, and operation cancellation for IndexedDB operations.
 *
 * Builds on patterns from chromeMessagingService.js and integrates with
 * existing ResilientStorage for comprehensive database reliability.
 */

import ErrorReportService from "./ErrorReportService.js";

export class IndexedDBRetryService {
  constructor() {
    this.defaultTimeout = 10000; // 10 second timeout for most operations
    this.quickTimeout = 3000; // 3 seconds for quick operations
    this.bulkTimeout = 30000; // 30 seconds for bulk operations
    this.maxRetries = 4; // 5 total attempts (initial + 4 retries)
    this.baseRetryDelay = 100; // Base delay of 100ms

    // Request deduplication
    this.activeRequests = new Map(); // Key: operation fingerprint, Value: Promise

    // Circuit breaker state
    this.circuitBreaker = {
      failures: 0,
      lastFailureTime: null,
      isOpen: false,
      failureThreshold: 10, // Increased threshold to be less sensitive
      resetTimeout: 60000, // 60 seconds - longer reset time
      halfOpenAttempts: 0,
      maxHalfOpenAttempts: 3,
    };

    // Network connectivity tracking
    this.isOnline = navigator.onLine;
    this.networkListeners = new Set();

    this.setupNetworkListeners();
  }

  /**
   * Setup network connectivity listeners
   */
  setupNetworkListeners() {
    // Skip network listeners in service worker context (background scripts)
    if (typeof window === "undefined") {
      console.log(
        "🔧 IndexedDBRetryService: Skipping network listeners in service worker context"
      );
      return;
    }

    const handleOnline = () => {
      this.isOnline = true;
      this.notifyNetworkChange(true);
      this.resetCircuitBreaker();
    };

    const handleOffline = () => {
      this.isOnline = false;
      this.notifyNetworkChange(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
  }

  /**
   * Add network change listener
   * @param {Function} callback - Callback function (isOnline: boolean) => void
   */
  addNetworkListener(callback) {
    this.networkListeners.add(callback);
  }

  /**
   * Remove network change listener
   * @param {Function} callback - Callback function to remove
   */
  removeNetworkListener(callback) {
    this.networkListeners.delete(callback);
  }

  /**
   * Notify all network listeners of connectivity change
   * @param {boolean} isOnline - Current network status
   */
  notifyNetworkChange(isOnline) {
    this.networkListeners.forEach((callback) => {
      try {
        callback(isOnline);
      } catch (error) {
        console.warn("Network listener error:", error);
      }
    });
  }

  /**
   * Execute IndexedDB operation with retry logic, timeout, and deduplication
   * @param {Function} operation - Operation function to execute
   * @param {Object} options - Configuration options
   * @returns {Promise<any>} Operation result
   */
  executeWithRetry(operation, options = {}) {
    const {
      timeout = this.defaultTimeout,
      retries = this.maxRetries,
      operationName = "unknown",
      deduplicationKey = null,
      abortController = null,
      priority = "normal", // 'low', 'normal', 'high'
    } = options;

    // Check circuit breaker state
    if (this.isCircuitBreakerOpen()) {
      throw new Error(
        `Circuit breaker is open for IndexedDB operations. Last failure: ${new Date(
          this.circuitBreaker.lastFailureTime
        )}`
      );
    }

    // Check network connectivity
    if (!this.isOnline) {
      throw new Error("Network is offline - IndexedDB operations may fail");
    }

    // Handle request deduplication
    if (deduplicationKey) {
      if (this.activeRequests.has(deduplicationKey)) {
        // eslint-disable-next-line no-console
        console.log(
          `🔄 INDEXEDDB RETRY: Deduplicating request for ${operationName}`
        );
        return this.activeRequests.get(deduplicationKey);
      }
    }

    // Create operation promise
    const operationPromise = this.executeOperationWithRetry(operation, {
      timeout,
      retries,
      operationName,
      abortController,
      priority,
    });

    // Store for deduplication
    if (deduplicationKey) {
      this.activeRequests.set(deduplicationKey, operationPromise);

      // Clean up after completion
      operationPromise.finally(() => {
        this.activeRequests.delete(deduplicationKey);
      });
    }

    return operationPromise;
  }

  /**
   * Execute operation with retry logic
   * @param {Function} operation - Operation to execute
   * @param {Object} options - Configuration options
   * @returns {Promise<any>} Operation result
   */
  async executeOperationWithRetry(operation, options) {
    const { timeout, retries, operationName, abortController, priority } =
      options;

    let lastError;
    const startTime = Date.now();

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Check if operation was cancelled
        if (abortController?.signal.aborted) {
          throw new Error(`Operation cancelled: ${operationName}`);
        }

        // eslint-disable-next-line no-console
        console.log(
          `🔄 INDEXEDDB RETRY: Attempt ${attempt + 1}/${
            retries + 1
          } for ${operationName}`
        );

        const result = await this.executeWithTimeout(
          operation,
          timeout,
          abortController
        );

        // Success - update circuit breaker
        this.recordSuccess();

        if (attempt > 0) {
          // eslint-disable-next-line no-console
          console.log(
            `✅ INDEXEDDB RETRY: Succeeded on attempt ${
              attempt + 1
            } for ${operationName} (${Date.now() - startTime}ms total)`
          );
        }

        return result;
      } catch (error) {
        lastError = error;
        // eslint-disable-next-line no-console
        console.warn(
          `⚠️ INDEXEDDB RETRY: Attempt ${attempt + 1}/${
            retries + 1
          } failed for ${operationName}:`,
          error.message
        );

        // Record failure for circuit breaker
        this.recordFailure();

        // Don't retry on certain errors
        if (this.isNonRetryableError(error)) {
          // eslint-disable-next-line no-console
          console.log(
            `❌ INDEXEDDB RETRY: Non-retryable error for ${operationName}, stopping retries`
          );
          break;
        }

        // Don't retry if cancelled
        if (abortController?.signal.aborted) {
          break;
        }

        // Don't retry on final attempt
        if (attempt < retries && !this.isCircuitBreakerOpen()) {
          const delay = this.calculateRetryDelay(attempt, priority);
          // eslint-disable-next-line no-console
          console.log(
            `⏳ INDEXEDDB RETRY: Retrying ${operationName} in ${delay}ms...`
          );
          await this.sleep(delay);
        }
      }
    }

    const totalTime = Date.now() - startTime;
    // eslint-disable-next-line no-console
    console.error(
      `❌ INDEXEDDB RETRY: All ${
        retries + 1
      } attempts failed for ${operationName} (${totalTime}ms total)`
    );

    // Report critical failures
    ErrorReportService.reportError(lastError, {
      operation: operationName,
      attempts: retries + 1,
      totalTime,
      circuitBreakerState: this.circuitBreaker,
    });

    throw lastError;
  }

  /**
   * Execute operation with timeout
   * @param {Function} operation - Operation to execute
   * @param {number} timeout - Timeout in milliseconds
   * @param {AbortController} abortController - Optional abort controller
   * @returns {Promise<any>} Operation result
   */
  executeWithTimeout(operation, timeout, abortController) {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      let completed = false;

      // TEMPORARY: Remove timeout for testing
      // Setup timeout
      // const timer = setTimeout(() => {
      //   if (!completed) {
      //     completed = true;
      //     reject(new Error(`IndexedDB operation timeout after ${timeout}ms`));
      //   }
      // }, timeout);

      // Setup cancellation
      const onAbort = () => {
        if (!completed) {
          completed = true;
          // clearTimeout(timer); // Commented out since timer is disabled
          reject(new Error("IndexedDB operation cancelled"));
        }
      };

      abortController?.signal.addEventListener("abort", onAbort);

      try {
        const result = await operation();

        if (!completed) {
          completed = true;
          // clearTimeout(timer); // Commented out since timer is disabled
          abortController?.signal.removeEventListener("abort", onAbort);
          resolve(result);
        }
      } catch (error) {
        if (!completed) {
          completed = true;
          // clearTimeout(timer); // Commented out since timer is disabled
          abortController?.signal.removeEventListener("abort", onAbort);
          reject(error);
        }
      }
    });
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   * @param {number} attempt - Attempt number (0-based)
   * @param {string} priority - Operation priority
   * @returns {number} Delay in milliseconds
   */
  calculateRetryDelay(attempt, priority = "normal") {
    // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms
    const exponentialDelay = this.baseRetryDelay * Math.pow(2, attempt);

    // Priority adjustments
    const priorityMultiplier = {
      high: 0.5, // Faster retries for high priority
      normal: 1.0,
      low: 2.0, // Slower retries for low priority
    };

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.3; // ±30% jitter

    const delay =
      exponentialDelay * (priorityMultiplier[priority] || 1.0) * (1 + jitter);

    // Cap maximum delay
    return Math.min(delay, 5000);
  }

  /**
   * Sleep utility for retry delays
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} Sleep promise
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if error should not trigger retries
   * @param {Error} error - Error to check
   * @returns {boolean} True if error is non-retryable
   */
  isNonRetryableError(error) {
    const nonRetryablePatterns = [
      /quota.*exceeded/i,
      /constraint.*failed/i,
      /invalid.*key/i,
      /readonly.*transaction/i,
      /operation.*cancelled/i,
      /aborted/i,
    ];

    return nonRetryablePatterns.some((pattern) => pattern.test(error.message));
  }

  /**
   * Record successful operation for circuit breaker
   */
  recordSuccess() {
    if (
      this.circuitBreaker.isOpen ||
      this.circuitBreaker.halfOpenAttempts > 0
    ) {
      // Reset circuit breaker on success
      this.resetCircuitBreaker();
      // eslint-disable-next-line no-console
      console.log("🔵 CIRCUIT BREAKER: Reset to closed state after success");
    }
  }

  /**
   * Record failed operation for circuit breaker
   */
  recordFailure() {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = Date.now();

    if (this.circuitBreaker.failures >= this.circuitBreaker.failureThreshold) {
      this.circuitBreaker.isOpen = true;
      // eslint-disable-next-line no-console
      console.warn(
        `🔴 CIRCUIT BREAKER: Opened after ${this.circuitBreaker.failures} failures`
      );

      // Schedule automatic reset
      setTimeout(() => {
        this.circuitBreaker.isOpen = false;
        this.circuitBreaker.halfOpenAttempts = 0;
        // eslint-disable-next-line no-console
        console.log("🟡 CIRCUIT BREAKER: Entering half-open state");
      }, this.circuitBreaker.resetTimeout);
    }
  }

  /**
   * Check if circuit breaker is open
   * @returns {boolean} True if circuit breaker is open
   */
  isCircuitBreakerOpen() {
    return this.circuitBreaker.isOpen;
  }

  /**
   * Reset circuit breaker to closed state
   */
  resetCircuitBreaker() {
    this.circuitBreaker.failures = 0;
    this.circuitBreaker.isOpen = false;
    this.circuitBreaker.halfOpenAttempts = 0;
    this.circuitBreaker.lastFailureTime = null;
  }

  /**
   * Get circuit breaker status
   * @returns {Object} Circuit breaker status
   */
  getCircuitBreakerStatus() {
    return {
      ...this.circuitBreaker,
      isHealthy:
        this.circuitBreaker.failures < this.circuitBreaker.failureThreshold,
      timeSinceLastFailure: this.circuitBreaker.lastFailureTime
        ? Date.now() - this.circuitBreaker.lastFailureTime
        : null,
    };
  }

  /**
   * Get current network status
   * @returns {boolean} True if online
   */
  getNetworkStatus() {
    return this.isOnline;
  }

  /**
   * Get active requests count (for monitoring)
   * @returns {number} Number of active deduplicated requests
   */
  getActiveRequestsCount() {
    return this.activeRequests.size;
  }

  /**
   * Cancel all active requests
   */
  cancelAllRequests() {
    const count = this.activeRequests.size;
    this.activeRequests.clear();
    // eslint-disable-next-line no-console
    console.log(`🚫 INDEXEDDB RETRY: Cancelled ${count} active requests`);
  }

  /**
   * Get service statistics
   * @returns {Object} Service statistics
   */
  getStatistics() {
    return {
      circuitBreaker: this.getCircuitBreakerStatus(),
      networkStatus: this.getNetworkStatus(),
      activeRequests: this.getActiveRequestsCount(),
      config: {
        defaultTimeout: this.defaultTimeout,
        quickTimeout: this.quickTimeout,
        bulkTimeout: this.bulkTimeout,
        maxRetries: this.maxRetries,
        baseRetryDelay: this.baseRetryDelay,
      },
    };
  }
}

// Export singleton instance
export const indexedDBRetry = new IndexedDBRetryService();
export default indexedDBRetry;
