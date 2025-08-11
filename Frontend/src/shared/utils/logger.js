import { ErrorReportService } from "../services/ErrorReportService.js";

/**
 * Production-ready logging system with structured logging and level management
 * Integrates with error reporting and monitoring systems
 */

const LOG_LEVELS = {
  TRACE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
  FATAL: 5,
};

const LOG_LEVEL_NAMES = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"];

class ProductionLogger {
  constructor() {
    // Set log level based on environment
    this.currentLevel = this._getLogLevel();
    this.context = this._getAppContext();
    this.sessionId = this._generateSessionId();
  }

  /**
   * Get appropriate log level for current environment
   */
  _getLogLevel() {
    if (process.env.NODE_ENV === "production") {
      return LOG_LEVELS.WARN; // Only warnings and above in production
    } else if (process.env.NODE_ENV === "test") {
      return LOG_LEVELS.ERROR; // Reduce test output noise
    }
    return LOG_LEVELS.DEBUG; // Development mode
  }

  /**
   * Generate unique session identifier for log correlation
   */
  _generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get application context for structured logging
   */
  _getAppContext() {
    return {
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      version: "1.0.0", // Could be from package.json
      environment: process.env.NODE_ENV || "development",
    };
  }

  /**
   * Create structured log entry
   */
  _createLogEntry(level, message, context = {}, error = null) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: LOG_LEVEL_NAMES[level],
      sessionId: this.sessionId,
      message,
      context: {
        ...this.context,
        ...context,
      },
    };

    if (error) {
      logEntry.error = {
        message: error.message,
        stack: error.stack,
        name: error.name,
      };
    }

    return logEntry;
  }

  /**
   * Internal logging method
   */
  _log(level, message, context = {}, error = null) {
    if (level < this.currentLevel) {
      return; // Skip logs below current level
    }

    const logEntry = this._createLogEntry(level, message, context, error);
    const formattedMessage = `[${logEntry.level}] ${logEntry.timestamp} - ${message}`;

    // Console output with appropriate method
    switch (level) {
      case LOG_LEVELS.TRACE:
      case LOG_LEVELS.DEBUG:
        console.debug(formattedMessage, logEntry);
        break;
      case LOG_LEVELS.INFO:
        console.info(formattedMessage, logEntry);
        break;
      case LOG_LEVELS.WARN:
        console.warn(formattedMessage, logEntry);
        break;
      case LOG_LEVELS.ERROR:
      case LOG_LEVELS.FATAL:
        console.error(formattedMessage, logEntry);
        // Report errors to error tracking system
        if (error) {
          this._reportError(logEntry, error);
        }
        break;
    }

    // Store critical logs for monitoring
    if (level >= LOG_LEVELS.ERROR) {
      this._storeCriticalLog(logEntry);
    }
  }

  /**
   * Report errors to ErrorReportService
   */
  async _reportError(logEntry, error) {
    try {
      await ErrorReportService.storeErrorReport({
        errorId: `${logEntry.sessionId}_${Date.now()}`,
        message: error.message,
        stack: error.stack,
        componentStack: logEntry.context.componentStack,
        section: logEntry.context.section || "unknown",
        userContext: logEntry.context,
        errorType: "javascript",
        severity: logEntry.level === "FATAL" ? "high" : "medium",
      });
    } catch (reportError) {
      console.error("Failed to report error:", reportError);
    }
  }

  /**
   * Store critical logs in localStorage for debugging
   */
  _storeCriticalLog(logEntry) {
    try {
      const criticalLogs = JSON.parse(
        localStorage.getItem("codemaster_critical_logs") || "[]"
      );
      criticalLogs.push(logEntry);

      // Keep only last 50 critical logs
      const recentLogs = criticalLogs.slice(-50);
      localStorage.setItem(
        "codemaster_critical_logs",
        JSON.stringify(recentLogs)
      );
    } catch (storageError) {
      console.warn("Failed to store critical log:", storageError);
    }
  }

  // Public API methods
  trace(message, context = {}) {
    this._log(LOG_LEVELS.TRACE, message, context);
  }

  debug(message, context = {}) {
    this._log(LOG_LEVELS.DEBUG, message, context);
  }

  info(message, context = {}) {
    this._log(LOG_LEVELS.INFO, message, context);
  }

  warn(message, context = {}, error = null) {
    this._log(LOG_LEVELS.WARN, message, context, error);
  }

  error(message, context = {}, error = null) {
    this._log(LOG_LEVELS.ERROR, message, context, error);
  }

  fatal(message, context = {}, error = null) {
    this._log(LOG_LEVELS.FATAL, message, context, error);
  }

  /**
   * Set log level dynamically
   */
  setLogLevel(level) {
    if (typeof level === "string") {
      level = LOG_LEVELS[level.toUpperCase()];
    }
    if (level >= 0 && level <= 5) {
      this.currentLevel = level;
      this.info(`Log level changed to ${LOG_LEVEL_NAMES[level]}`);
    }
  }

  /**
   * Get current log level
   */
  getLogLevel() {
    return LOG_LEVEL_NAMES[this.currentLevel];
  }
}

// Create singleton instance
const logger = new ProductionLogger();

// Export both new API and legacy compatibility
export default logger;

// Legacy compatibility exports
export function logInfo(message, context = {}) {
  logger.info(message, context);
}

export function logError(message, context = {}, error = null) {
  logger.error(message, context, error);
}

// Enhanced exports
export const trace = logger.trace.bind(logger);
export const debug = logger.debug.bind(logger);
export const info = logger.info.bind(logger);
export const warn = logger.warn.bind(logger);
export const error = logger.error.bind(logger);
export const fatal = logger.fatal.bind(logger);
