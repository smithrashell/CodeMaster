import logger from "../utils/logger.js";
import { CrashReporter } from "./CrashReporter.js";
import { AlertingService } from "./AlertingService.js";
import { UserActionTracker } from "./UserActionTracker.js";
import { ErrorReportService } from "./ErrorReportService.js";
import performanceMonitor from "../utils/PerformanceMonitor.js";

/**
 * Production Monitoring Initializer
 * Coordinates initialization of all monitoring and analytics services
 */
export class MonitoringInitializer {
  static isInitialized = false;
  static initializationStart = null;
  static services = {};

  /**
   * Initialize all production monitoring services
   */
  static async initialize(config = {}) {
    if (this.isInitialized) {
      logger.warn("Monitoring already initialized", {
        section: "monitoring_init",
      });
      return;
    }

    this.initializationStart = performance.now();
    logger.info("Initializing production monitoring services...", {
      section: "monitoring_init",
      environment: process.env.NODE_ENV || "development",
    });

    try {
      const monitoringConfig = this._buildConfig(config);

      // Initialize services in order
      await this._initializeErrorReporting(monitoringConfig);
      this._initializeCrashReporting(monitoringConfig);
      await this._initializeUserTracking(monitoringConfig);
      this._initializeAlerting(monitoringConfig);
      this._initializePerformanceMonitoring(monitoringConfig);

      // Setup global error handlers
      this._setupGlobalErrorHandlers();

      // Setup periodic health checks
      this._setupHealthChecks(monitoringConfig);

      // Track initialization
      await this._trackInitialization();

      const initTime = performance.now() - this.initializationStart;
      this.isInitialized = true;

      logger.info("Production monitoring initialized successfully", {
        section: "monitoring_init",
        initializationTime: `${initTime.toFixed(2)}ms`,
        services: Object.keys(this.services),
      });

      return this.getMonitoringStatus();
    } catch (error) {
      logger.fatal(
        "Failed to initialize production monitoring",
        {
          section: "monitoring_init",
        },
        error
      );
      throw error;
    }
  }

  /**
   * Build configuration with defaults
   */
  static _buildConfig(userConfig) {
    const defaults = {
      environment: process.env.NODE_ENV || "development",

      // Error reporting config
      errorReporting: {
        enabled: true,
        maxReports: 100,
      },

      // Crash reporting config
      crashReporting: {
        enabled: true,
        enableReactIntegration: true,
        enableResourceMonitoring: true,
      },

      // User tracking config
      userTracking: {
        enabled: true,
        batchSize: 50,
        maxActions: 5000,
      },

      // Alerting config
      alerting: {
        enabled: true,
        thresholds: {
          errorRate: 10,
          crashRate: 5,
          performanceDegraded: 2000,
          memoryUsage: 100 * 1024 * 1024,
        },
        channels: ["console", "localStorage"],
      },

      // Performance monitoring config
      performanceMonitoring: {
        enabled: true,
        slowQueryTime: 1000,
        maxMetricsHistory: 1000,
      },

      // Health check config
      healthCheck: {
        enabled: true,
        interval: 60000, // 1 minute
        metrics: ["performance", "errors", "memory"],
      },
    };

    return this._deepMerge(defaults, userConfig);
  }

  /**
   * Initialize error reporting service
   */
  static async _initializeErrorReporting(config) {
    if (!config.errorReporting.enabled) {
      logger.debug("Error reporting disabled", { section: "monitoring_init" });
      return;
    }

    try {
      // Error report store is now created in the main database schema
      this.services.errorReporting = "active";
      logger.debug("Error reporting service initialized", {
        section: "monitoring_init",
      });
    } catch (error) {
      logger.error(
        "Failed to initialize error reporting",
        {
          section: "monitoring_init",
        },
        error
      );
      throw error;
    }
  }

  /**
   * Initialize crash reporting
   */
  static _initializeCrashReporting(config) {
    if (!config.crashReporting.enabled) {
      logger.debug("Crash reporting disabled", { section: "monitoring_init" });
      return;
    }

    try {
      CrashReporter.initialize();
      this.services.crashReporting = "active";
      logger.debug("Crash reporting service initialized", {
        section: "monitoring_init",
      });
    } catch (error) {
      logger.error(
        "Failed to initialize crash reporting",
        {
          section: "monitoring_init",
        },
        error
      );
      // Don't throw - crash reporting is not critical for app functionality
    }
  }

  /**
   * Initialize user action tracking
   */
  static async _initializeUserTracking(config) {
    if (!config.userTracking.enabled) {
      logger.debug("User tracking disabled", { section: "monitoring_init" });
      return;
    }

    try {
      // User action store is now created in the main database schema
      this.services.userTracking = "active";
      logger.debug("User action tracking initialized", {
        section: "monitoring_init",
      });

      // Track that monitoring was initialized
      await UserActionTracker.trackAction({
        action: "monitoring_initialized",
        category: UserActionTracker.CATEGORIES.SYSTEM_INTERACTION,
        context: {
          services: Object.keys(this.services),
          environment: config.environment,
        },
      });
    } catch (error) {
      logger.error(
        "Failed to initialize user tracking",
        {
          section: "monitoring_init",
        },
        error
      );
      // Don't throw - user tracking is not critical for app functionality
    }
  }

  /**
   * Initialize alerting service
   */
  static _initializeAlerting(config) {
    if (!config.alerting.enabled) {
      logger.debug("Alerting disabled", { section: "monitoring_init" });
      return;
    }

    try {
      AlertingService.initialize({
        thresholds: config.alerting.thresholds,
        channels: config.alerting.channels,
      });
      this.services.alerting = "active";
      logger.debug("Alerting service initialized", {
        section: "monitoring_init",
      });
    } catch (error) {
      logger.error(
        "Failed to initialize alerting",
        {
          section: "monitoring_init",
        },
        error
      );
      // Don't throw - alerting is not critical for app functionality
    }
  }

  /**
   * Initialize performance monitoring
   */
  static _initializePerformanceMonitoring(config) {
    if (!config.performanceMonitoring.enabled) {
      logger.debug("Performance monitoring disabled", {
        section: "monitoring_init",
      });
      return;
    }

    try {
      // Performance monitor is already a singleton, just verify it's working
      const summary = performanceMonitor.getPerformanceSummary();
      this.services.performanceMonitoring = "active";
      logger.debug("Performance monitoring initialized", {
        section: "monitoring_init",
        uptime: `${summary.uptime}s`,
      });
    } catch (error) {
      logger.error(
        "Failed to initialize performance monitoring",
        {
          section: "monitoring_init",
        },
        error
      );
      // Don't throw - performance monitoring is not critical for app functionality
    }
  }

  /**
   * Setup global error handlers that integrate with monitoring
   */
  static _setupGlobalErrorHandlers() {
    // Enhanced error boundary integration
    const originalReportReactError = window.reportReactError;
    window.reportReactError = (error, errorInfo) => {
      // Call original handler if exists
      if (originalReactError) {
        originalReactError(error, errorInfo);
      }

      // Log with our system
      logger.fatal(
        "React error boundary triggered",
        {
          section: "error_boundary",
          componentStack: errorInfo.componentStack,
        },
        error
      );

      // Track user action
      UserActionTracker.trackError(error, {
        context: "react_error_boundary",
        severity: "high",
      });
    };

    // Enhanced console error tracking
    const originalConsoleError = console.error;
    console.error = (...args) => {
      // Call original console.error
      originalConsoleError.apply(console, args);

      // Track significant console errors
      if (args[0] && typeof args[0] === "string" && args[0].includes("Error")) {
        UserActionTracker.trackAction({
          action: "console_error",
          category: UserActionTracker.CATEGORIES.ERROR_OCCURRENCE,
          context: {
            message: args[0].substring(0, 100),
            source: "console",
          },
        });
      }
    };
  }

  /**
   * Setup periodic health checks
   */
  static _setupHealthChecks(config) {
    if (!config.healthCheck.enabled) {
      return;
    }

    const healthCheckInterval = setInterval(() => {
      this._performHealthCheck(config.healthCheck.metrics);
    }, config.healthCheck.interval);

    // Store interval for cleanup
    this.services.healthCheckInterval = healthCheckInterval;

    logger.debug("Health checks scheduled", {
      section: "monitoring_init",
      interval: `${config.healthCheck.interval}ms`,
      metrics: config.healthCheck.metrics,
    });
  }

  /**
   * Perform comprehensive health check
   */
  static async _performHealthCheck(metrics) {
    try {
      const healthData = {};

      if (metrics.includes("performance")) {
        healthData.performance = performanceMonitor.getSystemHealth();
      }

      if (metrics.includes("errors")) {
        const errorStats = await ErrorReportService.getErrorStatistics(1); // Last day
        healthData.errors = {
          totalErrors: errorStats?.totalErrors || 0,
          resolvedErrors: errorStats?.resolvedErrors || 0,
        };
      }

      if (metrics.includes("memory")) {
        healthData.memory = performance.memory
          ? {
              used: performance.memory.usedJSHeapSize,
              percentage:
                (performance.memory.usedJSHeapSize /
                  performance.memory.jsHeapSizeLimit) *
                100,
            }
          : null;
      }

      // Log health status
      const overallHealth = this._calculateOverallHealth(healthData);
      if (overallHealth !== "good") {
        logger.warn(`System health check: ${overallHealth}`, {
          section: "health_check",
          healthData,
        });
      }
    } catch (error) {
      logger.error("Health check failed", { section: "health_check" }, error);
    }
  }

  /**
   * Calculate overall system health
   */
  static _calculateOverallHealth(healthData) {
    const issues = [];

    if (healthData.performance && healthData.performance === "critical") {
      issues.push("performance");
    }

    if (healthData.errors && healthData.errors.totalErrors > 10) {
      issues.push("errors");
    }

    if (healthData.memory && healthData.memory.percentage > 80) {
      issues.push("memory");
    }

    if (issues.length > 1) return "critical";
    if (issues.length === 1) return "warning";
    return "good";
  }

  /**
   * Track the initialization process
   */
  static async _trackInitialization() {
    try {
      const initTime = performance.now() - this.initializationStart;

      await UserActionTracker.trackAction({
        action: "monitoring_system_initialized",
        category: UserActionTracker.CATEGORIES.SYSTEM_INTERACTION,
        context: {
          initializationTime: initTime,
          services: Object.keys(this.services),
          environment: process.env.NODE_ENV || "development",
        },
        performance: {
          duration: initTime,
          success: true,
        },
      });
    } catch (error) {
      logger.warn(
        "Failed to track initialization",
        { section: "monitoring_init" },
        error
      );
    }
  }

  /**
   * Get current monitoring status
   */
  static getMonitoringStatus() {
    return {
      initialized: this.isInitialized,
      initializationTime: this.initializationStart
        ? performance.now() - this.initializationStart
        : null,
      services: this.services,
      environment: process.env.NODE_ENV || "development",
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Shutdown monitoring services
   */
  static shutdown() {
    try {
      // Clear health check interval
      if (this.services.healthCheckInterval) {
        clearInterval(this.services.healthCheckInterval);
      }

      // Flush remaining user actions
      UserActionTracker.flush();

      // Clear alerting
      if (AlertingService.isActive) {
        AlertingService.setActive(false);
      }

      this.isInitialized = false;
      this.services = {};

      logger.info("Monitoring services shutdown", {
        section: "monitoring_init",
      });
    } catch (error) {
      console.error("Error during monitoring shutdown:", error);
    }
  }

  /**
   * Deep merge utility for configuration
   */
  static _deepMerge(target, source) {
    const output = { ...target };

    Object.keys(source).forEach((key) => {
      if (
        source[key] &&
        typeof source[key] === "object" &&
        !Array.isArray(source[key])
      ) {
        output[key] = this._deepMerge(target[key] || {}, source[key]);
      } else {
        output[key] = source[key];
      }
    });

    return output;
  }
}

/**
 * Detect if we're running in a content script context
 * Content scripts MUST NOT access IndexedDB directly and should not initialize monitoring
 * This detection is CRITICAL to prevent duplicate database creation
 */
function isContentScriptContext() {
  try {
    // 🚨 CRITICAL: Multiple layers of detection to ensure we catch content scripts
    
    // Layer 1: URL-based detection - content scripts run on web pages
    if (typeof window !== "undefined" && window.location) {
      const isWebPage = window.location.protocol === "http:" || window.location.protocol === "https:";
      const isNotExtensionPage = !window.location.href.startsWith("chrome-extension://");
      
      if (isWebPage && isNotExtensionPage) {
        console.log("🚫 CONTENT SCRIPT DETECTED: Web page URL detected", window.location.href);
        return true;
      }
    }
    
    // Layer 2: Chrome API availability check - content scripts lack certain APIs
    if (typeof chrome !== "undefined" && chrome.runtime) {
      // Content scripts don't have access to chrome.tabs API
      const hasTabsAPI = !!(chrome.tabs && chrome.tabs.query);
      // Content scripts don't have access to chrome.management API  
      const hasManagementAPI = !!(chrome.management && chrome.management.getSelf);
      // Content scripts don't have access to chrome.storage.local directly in some contexts
      const hasStorageAPI = !!(chrome.storage && chrome.storage.local);
      
      // If we're missing critical background/popup APIs, likely a content script
      if (!hasTabsAPI || !hasManagementAPI) {
        console.log("🚫 CONTENT SCRIPT DETECTED: Missing extension APIs", {
          hasTabsAPI,
          hasManagementAPI,
          hasStorageAPI
        });
        return true;
      }
    }
    
    // Layer 3: Document injection detection - content scripts inject into existing pages
    if (typeof document !== "undefined") {
      // Content scripts inject into pages that already have content
      const hasExistingContent = document.body && document.body.children.length > 1;
      const hasLeetCodeElements = document.querySelector('[data-track-load]') || 
                                  document.querySelector('.content-wrapper') ||
                                  document.querySelector('#app') ||
                                  document.title.includes('LeetCode');
      
      if (hasExistingContent && hasLeetCodeElements) {
        console.log("🚫 CONTENT SCRIPT DETECTED: LeetCode page elements found");
        return true;
      }
    }
    
    // Layer 4: Execution context check - content scripts have different global context
    if (typeof window !== "undefined") {
      // Extension pages have chrome-extension:// protocol
      if (window.location.protocol === "chrome-extension:") {
        console.log("✅ EXTENSION PAGE DETECTED: chrome-extension:// protocol");
        return false;
      }
      
      // Background scripts often don't have a visible document
      if (document.visibilityState === "hidden" && window.location.href === "about:blank") {
        console.log("✅ BACKGROUND SCRIPT DETECTED: Hidden document");
        return false;
      }
    }
    
    // If we're here with chrome.runtime but on a web page, it's definitely a content script
    if (typeof chrome !== "undefined" && chrome.runtime && 
        typeof window !== "undefined" && 
        (window.location.protocol === "http:" || window.location.protocol === "https:")) {
      console.log("🚫 CONTENT SCRIPT DETECTED: chrome.runtime on web page");
      return true;
    }
    
    // Default: if we can't determine, err on the side of caution
    console.log("🔍 CONTEXT DETECTION: Defaulting to false (allow monitoring)");
    return false;
    
  } catch (error) {
    // If there's an error checking, assume we're not in content script to be safe
    console.warn("⚠️ Error in content script detection, defaulting to false:", error);
    return false;
  }
}

// Auto-initialize in production, but NOT in content scripts
if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
  if (isContentScriptContext()) {
    // eslint-disable-next-line no-console
    console.log("🚫 MonitoringInitializer: Skipping initialization in content script context to prevent duplicate databases");
  } else {
    // Initialize after DOM is loaded for background scripts and app contexts
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        MonitoringInitializer.initialize();
      });
    } else {
      MonitoringInitializer.initialize();
    }
  }
}

// Auto-shutdown on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    MonitoringInitializer.shutdown();
  });
}

export default MonitoringInitializer;
