/**
 * Error Reporting Service for CodeMaster
 *
 * Manages error report collection, storage, and retrieval using IndexedDB
 * for comprehensive error tracking and user feedback collection.
 */

// eslint-disable-next-line no-restricted-imports
import { dbHelper } from "../../db/index.js";

/**
 * Detect if we're running in a content script context
 * Content scripts cannot access IndexedDB directly
 */
function isContentScriptContext() {
  try {
    return (
      typeof chrome !== "undefined" && 
      chrome.runtime && 
      chrome.runtime.sendMessage &&
      typeof document !== "undefined" &&
      (window.location.protocol === "http:" || window.location.protocol === "https:") &&
      !window.location.href.startsWith("chrome-extension://")
    );
  } catch (error) {
    return false;
  }
}

export class ErrorReportService {
  static STORE_NAME = "error_reports";
  static MAX_REPORTS = 100; // Keep last 100 error reports

  /**
   * Get URL safely across different contexts (service worker, extension page, content script)
   */
  static getSafeUrl() {
    try {
      if (typeof window !== 'undefined' && window.location) {
        return window.location.href;
      } else if (typeof globalThis !== 'undefined' && globalThis.location) {
        return globalThis.location.href;
      } else if (typeof chrome !== 'undefined' && chrome.runtime) {
        return `chrome-extension://${chrome.runtime.id}/background-script`;
      }
    } catch (error) {
      console.warn('Failed to get URL:', error);
    }
    return 'unknown-context';
  }

  /**
   * Get user agent safely across different contexts
   */
  static getSafeUserAgent() {
    try {
      if (typeof navigator !== 'undefined' && navigator.userAgent) {
        return navigator.userAgent;
      } else if (typeof globalThis !== 'undefined' && globalThis.navigator) {
        return globalThis.navigator.userAgent;
      }
    } catch (error) {
      console.warn('Failed to get user agent:', error);
    }
    return 'unknown-user-agent';
  }


  /**
   * Store an error report in IndexedDB
   */
  static async storeErrorReport({
    errorId,
    message,
    stack,
    componentStack,
    section = "unknown",
    url = ErrorReportService.getSafeUrl(),
    userAgent = ErrorReportService.getSafeUserAgent(),
    timestamp = new Date().toISOString(),
    userContext = {},
    reproductionSteps = [],
    userFeedback = "",
    errorType = "javascript",
    severity = "medium",
  }) {
    try {
      // Skip database operations in content script context
      if (isContentScriptContext()) {
        // eslint-disable-next-line no-console
        console.warn("🚫 ErrorReportService: Skipping database operation in content script context");
        return null;
      }
      
      const db = await dbHelper.openDB();

      const transaction = db.transaction([this.STORE_NAME], "readwrite");
      const store = transaction.objectStore(this.STORE_NAME);

      const errorReport = {
        errorId,
        message,
        stack,
        componentStack,
        section,
        url,
        userAgent,
        timestamp,
        userContext,
        reproductionSteps,
        userFeedback,
        errorType,
        severity,
        resolved: false,
        reportedAt: new Date().toISOString(),
      };

      const request = store.add(errorReport);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          // Clean up old reports to prevent storage bloat
          this.cleanupOldReports();
          resolve(request.result);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to store error report:", error);

      // Fallback to localStorage if IndexedDB fails
      this.fallbackToLocalStorage({
        errorId,
        message,
        stack,
        section,
        timestamp,
      });

      throw error;
    }
  }

  /**
   * Retrieve error reports with optional filtering
   */
  static async getErrorReports({
    limit = 20,
    section = null,
    errorType = null,
    since = null,
    resolved = null,
  } = {}) {
    try {
      // Skip database operations in content script context
      if (isContentScriptContext()) {
        console.warn("🚫 ErrorReportService: Skipping database operation in content script context");
        return [];
      }
      
      const db = await dbHelper.openDB();

      const transaction = db.transaction([this.STORE_NAME], "readonly");
      const store = transaction.objectStore(this.STORE_NAME);

      let request;
      if (section) {
        const index = store.index("by_section");
        request = index.getAll(section);
      } else if (errorType) {
        const index = store.index("by_error_type");
        request = index.getAll(errorType);
      } else {
        request = store.getAll();
      }

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          let reports = request.result;

          // Apply additional filters
          if (since) {
            reports = reports.filter(
              (report) => new Date(report.timestamp) >= new Date(since)
            );
          }

          if (resolved !== null) {
            reports = reports.filter((report) => report.resolved === resolved);
          }

          // Sort by timestamp (newest first) and limit
          reports.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

          if (limit) {
            reports = reports.slice(0, limit);
          }

          resolve(reports);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to retrieve error reports:", error);
      return [];
    }
  }

  /**
   * Mark an error report as resolved
   */
  static async resolveErrorReport(reportId, resolution = "") {
    try {
      // Skip database operations in content script context
      if (isContentScriptContext()) {
        console.warn("🚫 ErrorReportService: Skipping database operation in content script context");
        return null;
      }
      
      const db = await dbHelper.openDB();

      const transaction = db.transaction([this.STORE_NAME], "readwrite");
      const store = transaction.objectStore(this.STORE_NAME);

      const getRequest = store.get(reportId);

      return new Promise((resolve, reject) => {
        getRequest.onsuccess = () => {
          const report = getRequest.result;
          if (report) {
            report.resolved = true;
            report.resolution = resolution;
            report.resolvedAt = new Date().toISOString();

            const updateRequest = store.put(report);
            updateRequest.onsuccess = () => resolve(report);
            updateRequest.onerror = () => reject(updateRequest.error);
          } else {
            reject(new Error("Error report not found"));
          }
        };
        getRequest.onerror = () => reject(getRequest.error);
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to resolve error report:", error);
      throw error;
    }
  }

  /**
   * Add user feedback to an existing error report
   */
  static async addUserFeedback(reportId, feedback, reproductionSteps = []) {
    try {
      // Skip database operations in content script context
      if (isContentScriptContext()) {
        console.warn("🚫 ErrorReportService: Skipping database operation in content script context");
        return null;
      }
      
      const db = await dbHelper.openDB();

      const transaction = db.transaction([this.STORE_NAME], "readwrite");
      const store = transaction.objectStore(this.STORE_NAME);

      const getRequest = store.get(reportId);

      return new Promise((resolve, reject) => {
        getRequest.onsuccess = () => {
          const report = getRequest.result;
          if (report) {
            report.userFeedback = feedback;
            report.reproductionSteps = reproductionSteps;
            report.feedbackAt = new Date().toISOString();

            const updateRequest = store.put(report);
            updateRequest.onsuccess = () => resolve(report);
            updateRequest.onerror = () => reject(updateRequest.error);
          } else {
            reject(new Error("Error report not found"));
          }
        };
        getRequest.onerror = () => reject(getRequest.error);
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to add user feedback:", error);
      throw error;
    }
  }

  /**
   * Get error statistics for dashboard/analytics
   */
  static async getErrorStatistics(days = 30) {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const reports = await this.getErrorReports({
        since: since.toISOString(),
      });

      const stats = {
        totalErrors: reports.length,
        resolvedErrors: reports.filter((r) => r.resolved).length,
        errorsBySection: {},
        errorsByType: {},
        errorsByDay: {},
        topErrors: {},
      };

      reports.forEach((report) => {
        // Count by section
        stats.errorsBySection[report.section] =
          (stats.errorsBySection[report.section] || 0) + 1;

        // Count by error type
        stats.errorsByType[report.errorType] =
          (stats.errorsByType[report.errorType] || 0) + 1;

        // Count by day
        const day = new Date(report.timestamp).toDateString();
        stats.errorsByDay[day] = (stats.errorsByDay[day] || 0) + 1;

        // Count by error message for top errors
        const errorKey = report.message.substring(0, 100); // First 100 chars
        stats.topErrors[errorKey] = (stats.topErrors[errorKey] || 0) + 1;
      });

      return stats;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to generate error statistics:", error);
      return null;
    }
  }

  /**
   * Clean up old error reports to prevent storage bloat
   */
  static async cleanupOldReports() {
    try {
      // Skip database operations in content script context
      if (isContentScriptContext()) {
        console.warn("🚫 ErrorReportService: Skipping database operation in content script context");
        return;
      }
      
      const reports = await this.getErrorReports({ limit: null });

      if (reports.length > this.MAX_REPORTS) {
        const excessReports = reports.slice(this.MAX_REPORTS);
        const db = await dbHelper.openDB();

        const transaction = db.transaction([this.STORE_NAME], "readwrite");
        const store = transaction.objectStore(this.STORE_NAME);

        for (const report of excessReports) {
          store.delete(report.id);
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to cleanup old error reports:", error);
    }
  }

  /**
   * Fallback to localStorage if IndexedDB is unavailable
   */
  static fallbackToLocalStorage(errorData) {
    try {
      const existingErrors = JSON.parse(
        localStorage.getItem("codemaster_errors") || "[]"
      );
      existingErrors.push(errorData);

      // Keep only last 10 errors in localStorage
      const recentErrors = existingErrors.slice(-10);
      localStorage.setItem("codemaster_errors", JSON.stringify(recentErrors));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("Failed to store error in localStorage:", error);
    }
  }

  /**
   * Export error reports for external analysis
   */
  static async exportErrorReports(format = "json") {
    try {
      // Skip database operations in content script context
      if (isContentScriptContext()) {
        console.warn("🚫 ErrorReportService: Skipping database operation in content script context");
        return format === "json" ? "[]" : "";
      }
      
      const reports = await this.getErrorReports({ limit: null });

      if (format === "json") {
        return JSON.stringify(reports, null, 2);
      } else if (format === "csv") {
        const headers = [
          "Timestamp",
          "Section",
          "Error Type",
          "Message",
          "Resolved",
          "User Feedback",
        ];
        const csvRows = [headers.join(",")];

        reports.forEach((report) => {
          const row = [
            report.timestamp,
            report.section,
            report.errorType,
            `"${report.message.replace(/"/g, '""')}"`,
            report.resolved,
            `"${(report.userFeedback || "").replace(/"/g, '""')}"`,
          ];
          csvRows.push(row.join(","));
        });

        return csvRows.join("\n");
      }

      throw new Error(`Unsupported export format: ${format}`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to export error reports:", error);
      throw error;
    }
  }
}

export default ErrorReportService;
