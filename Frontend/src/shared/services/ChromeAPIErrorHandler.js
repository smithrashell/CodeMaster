/**
 * Chrome API Error Handler for CodeMaster
 *
 * Provides robust error handling, retry mechanisms, and graceful degradation
 * for all Chrome extension API calls throughout the application.
 */

import ErrorReportService from "./ErrorReportService";
import {
  showErrorNotification,
  handleChromeAPIError,
} from "../utils/errorNotifications";

export class ChromeAPIErrorHandler {
  static DEFAULT_RETRY_COUNT = 3;
  static DEFAULT_RETRY_DELAY = 1000;
  static DEFAULT_TIMEOUT = 10000;

  /**
   * Wrapper for chrome.runtime.sendMessage with retry logic
   */
  static async sendMessageWithRetry(message, options = {}) {
    const {
      maxRetries = this.DEFAULT_RETRY_COUNT,
      retryDelay = this.DEFAULT_RETRY_DELAY,
      timeout = this.DEFAULT_TIMEOUT,
      showNotifications = true,
    } = options;

    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.sendMessageWithTimeout(message, timeout);

        // Success - return response
        return response;
      } catch (error) {
        lastError = error;

        // Don't retry on final attempt
        if (attempt === maxRetries) break;

        // Wait before retry with exponential backoff
        const delay = retryDelay * Math.pow(2, attempt);
        await this.sleep(delay);
      }
    }

    // All retries failed - handle error
    const errorData = {
      message: message,
      error: lastError.message,
      attempts: maxRetries + 1,
      timestamp: new Date().toISOString(),
    };

    // Store error report
    try {
      await ErrorReportService.storeErrorReport({
        errorId: `chrome_api_${Date.now()}`,
        message: lastError.message,
        stack: lastError.stack,
        section: "Chrome API",
        errorType: "chrome_extension_api",
        severity: "high",
        userContext: {
          messageType: message.action || "unknown",
          attempts: maxRetries + 1,
        },
      });
    } catch (storageError) {
      // eslint-disable-next-line no-console
      console.warn("Failed to store Chrome API error report:", storageError);
    }

    // Show user notification
    if (showNotifications) {
      handleChromeAPIError("Runtime Message", lastError, {
        onReport: () => this.showErrorReportDialog(errorData),
        onRetry: () => this.sendMessageWithRetry(message, options),
      });
    }

    throw new Error(
      `Chrome API failed after ${maxRetries + 1} attempts: ${lastError.message}`
    );
  }

  /**
   * Send message with timeout
   */
  static sendMessageWithTimeout(message, timeout) {
    return new Promise((resolve, reject) => {
      // Set timeout
      const timeoutId = setTimeout(() => {
        reject(
          new Error(
            "Chrome API timeout - background script may be unresponsive"
          )
        );
      }, timeout);

      try {
        chrome.runtime.sendMessage(message, (response) => {
          clearTimeout(timeoutId);

          // Check for Chrome runtime errors
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          // Check for response errors
          if (response && response.error) {
            reject(new Error(response.error));
            return;
          }

          resolve(response);
        });
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Wrapper for chrome.storage API calls with retry logic
   */
  static async storageGetWithRetry(keys, options = {}) {
    const { maxRetries = 2, retryDelay = 500 } = options;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await new Promise((resolve, reject) => {
          chrome.storage.local.get(keys, (result) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(result);
            }
          });
        });
      } catch (error) {
        if (attempt === maxRetries) {
          // Report storage error
          this.reportStorageError("get", error, { keys });
          throw error;
        }
        await this.sleep(retryDelay);
      }
    }
  }

  /**
   * Wrapper for chrome.storage.set with retry logic
   */
  static async storageSetWithRetry(items, options = {}) {
    const { maxRetries = 2, retryDelay = 500 } = options;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await new Promise((resolve, reject) => {
          chrome.storage.local.set(items, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve();
            }
          });
        });
      } catch (error) {
        if (attempt === maxRetries) {
          this.reportStorageError("set", error, { items });
          throw error;
        }
        await this.sleep(retryDelay);
      }
    }
  }

  /**
   * Wrapper for chrome.tabs API calls with error handling
   */
  static async tabsQueryWithRetry(queryInfo, options = {}) {
    const { maxRetries = 2 } = options;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await new Promise((resolve, reject) => {
          chrome.tabs.query(queryInfo, (tabs) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(tabs);
            }
          });
        });
      } catch (error) {
        if (attempt === maxRetries) {
          this.reportTabsError("query", error, { queryInfo });
          throw error;
        }
        await this.sleep(500);
      }
    }
  }

  /**
   * Report storage-related errors
   */
  static async reportStorageError(operation, error, context = {}) {
    try {
      await ErrorReportService.storeErrorReport({
        errorId: `chrome_storage_${Date.now()}`,
        message: error.message,
        stack: error.stack,
        section: "Chrome Storage API",
        errorType: "chrome_storage_api",
        severity: "medium",
        userContext: { operation, ...context },
      });
    } catch (storageError) {
      // eslint-disable-next-line no-console
      console.error("Failed to report storage error:", storageError);
    }

    showErrorNotification(error, {
      title: "Storage Access Issue",
      message: `Failed to ${operation} extension data. Your changes may not be saved.`,
      actions: [
        {
          label: "Retry",
          primary: true,
          onClick: () => window.location.reload(),
        },
      ],
    });
  }

  /**
   * Report tabs-related errors
   */
  static async reportTabsError(operation, error, context = {}) {
    try {
      await ErrorReportService.storeErrorReport({
        errorId: `chrome_tabs_${Date.now()}`,
        message: error.message,
        stack: error.stack,
        section: "Chrome Tabs API",
        errorType: "chrome_tabs_api",
        severity: "low",
        userContext: { operation, ...context },
      });
    } catch (storageError) {
      // eslint-disable-next-line no-console
      console.error("Failed to report tabs error:", storageError);
    }
  }

  /**
   * Show error report dialog
   */
  static showErrorReportDialog(errorData) {
    // Simple implementation using browser APIs
    // In production, this would show a proper modal dialog
    const userDescription = prompt(
      "Help us improve CodeMaster by describing what you were doing when this error occurred:"
    );

    if (userDescription) {
      // Store additional user feedback
      ErrorReportService.addUserFeedback(errorData.errorId, userDescription, [
        "Chrome API communication failure",
      ]).catch((error) => {
        // eslint-disable-next-line no-console
        console.warn("Failed to store user feedback:", error);
      });
    }
  }

  /**
   * Check if Chrome APIs are available
   */
  static areAPIsAvailable() {
    try {
      return !!(
        typeof chrome !== "undefined" &&
        chrome.runtime &&
        chrome.runtime.sendMessage
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Get Chrome extension context information
   */
  static getExtensionContext() {
    try {
      return {
        id: chrome.runtime.id,
        version: chrome.runtime.getManifest().version,
        context: chrome.runtime.getContexts
          ? "service_worker"
          : "background_page",
        available: this.areAPIsAvailable(),
      };
    } catch (error) {
      return {
        available: false,
        error: error.message,
      };
    }
  }

  /**
   * Utility method to sleep/wait
   */
  static sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Graceful degradation handler for when Chrome APIs fail
   */
  static handleGracefulDegradation(feature, fallbackAction = null) {
    const message = `${feature} is temporarily unavailable. CodeMaster is running in limited mode.`;

    showErrorNotification(new Error(message), {
      title: "Feature Unavailable",
      message: "Some features may be limited while the extension reconnects.",
      persistent: true,
      actions: fallbackAction
        ? [
            {
              label: "Use Fallback",
              primary: true,
              onClick: fallbackAction,
            },
            {
              label: "Refresh",
              onClick: () => window.location.reload(),
            },
          ]
        : [
            {
              label: "Refresh Page",
              primary: true,
              onClick: () => window.location.reload(),
            },
          ],
    });
  }

  /**
   * Monitor Chrome extension health
   */
  static async monitorExtensionHealth() {
    if (!this.areAPIsAvailable()) {
      this.handleGracefulDegradation("Chrome Extension APIs");
      return false;
    }

    try {
      // Simple health check by sending a ping message
      await this.sendMessageWithTimeout({ action: "ping" }, 2000);
      return true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("Chrome extension health check failed:", error);
      return false;
    }
  }
}

export default ChromeAPIErrorHandler;
