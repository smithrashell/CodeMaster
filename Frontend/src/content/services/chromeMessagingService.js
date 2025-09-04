/**
 * Robust Chrome Extension Messaging Service
 * Handles timeouts, retries, and fallback strategies
 */

export class ChromeMessagingService {
  constructor() {
    this.defaultTimeout = 10000; // 10 second timeout for safety margin
    this.maxRetries = 3;
    this.retryDelay = 500; // Base retry delay in ms
    this.cache = new Map(); // Simple in-memory cache
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes cache expiry
  }

  /**
   * Send message with timeout, retry, and caching
   * @param {Object} message - Message to send
   * @param {Object} options - Configuration options
   * @returns {Promise<any>} Response data
   */
  async sendMessage(message, options = {}) {
    const {
      timeout = this.defaultTimeout,
      retries = this.maxRetries,
      cacheable = false,
      cacheKey = null,
    } = options;

    // Check cache first if cacheable
    if (cacheable && cacheKey) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        // Using cached response
        return cached;
      }
    }

    let lastError;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await this.sendSingleMessage(message, timeout);

        // Cache successful responses if cacheable
        if (cacheable && cacheKey && result) {
          this.setCache(cacheKey, result);
        }

        if (attempt > 0) {
          // Succeeded on retry ${attempt}
        }

        return result;
      } catch (error) {
        lastError = error;
        console.warn(
          `⚠️ CHROME MSG: Attempt ${attempt + 1}/${retries + 1} failed for ${
            message.type
          }:`,
          error.message
        );

        // Don't retry on the last attempt
        if (attempt < retries) {
          const delay = this.retryDelay * Math.pow(2, attempt); // Exponential backoff
          // Retrying in ${delay}ms
          await this.sleep(delay);
        }
      }
    }

    console.error(
      `❌ CHROME MSG: All ${retries + 1} attempts failed for ${message.type}`
    );
    throw lastError;
  }

  /**
   * Send a single message with timeout
   * @param {Object} message - Message to send
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<any>} Response data
   */
  sendSingleMessage(message, timeout) {
    return new Promise((resolve, reject) => {
      // Extended timeout to test if operations can complete
      const timer = setTimeout(() => {
        reject(
          new Error(
            `Message timeout after ${timeout}ms for type: ${message.type}`
          )
        );
      }, timeout);

      try {
        chrome.runtime.sendMessage(message, (response) => {
          clearTimeout(timer);

          // Check for runtime errors
          if (chrome.runtime.lastError) {
            reject(
              new Error(
                `Chrome runtime error: ${chrome.runtime.lastError.message}`
              )
            );
            return;
          }

          // Check for application-level errors
          if (response && response.status === "error") {
            reject(new Error(`Application error: ${response.error}`));
            return;
          }

          // Return successful response data
          resolve(response?.data || response);
        });
      } catch (error) {
        clearTimeout(timer);
        reject(new Error(`Failed to send message: ${error.message}`));
      }
    });
  }

  /**
   * Get item from cache if not expired
   * @param {string} key - Cache key
   * @returns {any} Cached value or null
   */
  getFromCache(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  /**
   * Set item in cache with expiry
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   */
  setCache(key, data) {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.cacheExpiry,
    });

    // Clean expired items periodically
    if (this.cache.size > 100) {
      this.cleanExpiredCache();
    }
  }

  /**
   * Clean expired cache entries
   */
  cleanExpiredCache() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cached data
   */
  clearCache() {
    this.cache.clear();
    // Cache cleared
  }

  /**
   * Sleep utility for retry delays
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise}
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    const now = Date.now();
    let expired = 0;
    let valid = 0;

    for (const item of this.cache.values()) {
      if (now > item.expiry) {
        expired++;
      } else {
        valid++;
      }
    }

    return {
      total: this.cache.size,
      valid,
      expired,
      memoryUsage: this.estimateCacheSize(),
    };
  }

  /**
   * Estimate cache memory usage
   * @returns {string} Estimated size in KB
   */
  estimateCacheSize() {
    const jsonString = JSON.stringify([...this.cache.values()]);
    const sizeInBytes = new Blob([jsonString]).size;
    return `${(sizeInBytes / 1024).toFixed(2)} KB`;
  }
}

// Export singleton instance
export const chromeMessaging = new ChromeMessagingService();
export default chromeMessaging;
