import logger from '../utils/logger.js';
import { ErrorReportService } from './ErrorReportService.js';
import { UserActionTracker } from './UserActionTracker.js';
import performanceMonitor from '../utils/PerformanceMonitor.js';

/**
 * Crash Reporting Service for production monitoring
 * Handles application crashes, uncaught exceptions, and critical errors
 */
export class CrashReporter {
  static isInitialized = false;
  static crashCount = 0;
  static lastCrashTime = null;
  static recentErrors = [];

  // Crash severity levels
  static SEVERITY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
  };

  /**
   * Initialize crash reporting with global error handlers
   */
  static initialize() {
    if (this.isInitialized) {
      return;
    }

    // Handle uncaught JavaScript errors
    window.addEventListener('error', (event) => {
      this.handleJavaScriptError(event.error, {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handlePromiseRejection(event.reason, {
        promise: event.promise,
        type: 'unhandledrejection'
      });
    });

    // Handle React error boundaries (if using React)
    this.setupReactErrorHandling();

    // Monitor critical system resources
    this.startResourceMonitoring();

    this.isInitialized = true;
    logger.info('Crash reporting initialized', { section: 'crash_reporter' });
  }

  /**
   * Handle JavaScript runtime errors
   */
  static async handleJavaScriptError(error, context = {}) {
    try {
      const severity = this.determineSeverity(error, context);
      const crashData = await this.collectCrashData(error, context, severity);
      
      // Track this error
      await UserActionTracker.trackError(error, {
        severity,
        context: context.filename || context.message || 'unknown'
      });

      // Report to error service
      await this.reportCrash('javascript_error', crashData);
      
      // Log with appropriate level
      if (severity === this.SEVERITY.CRITICAL) {
        logger.fatal('JavaScript error occurred', { 
          section: 'crash_reporter',
          ...context 
        }, error);
      } else {
        logger.error('JavaScript error occurred', { 
          section: 'crash_reporter',
          ...context 
        }, error);
      }

      return crashData;
      
    } catch (reportError) {
      console.error('Failed to report JavaScript error:', reportError);
    }
  }

  /**
   * Handle unhandled promise rejections
   */
  static async handlePromiseRejection(reason, context = {}) {
    try {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      const severity = this.SEVERITY.MEDIUM; // Unhandled promises are usually medium severity
      
      const crashData = await this.collectCrashData(error, {
        ...context,
        type: 'promise_rejection',
        reason: String(reason)
      }, severity);

      await UserActionTracker.trackError(error, {
        severity,
        context: 'promise_rejection'
      });

      await this.reportCrash('promise_rejection', crashData);
      
      logger.error('Unhandled promise rejection', { 
        section: 'crash_reporter',
        reason: String(reason),
        ...context 
      }, error);

      return crashData;
      
    } catch (reportError) {
      console.error('Failed to report promise rejection:', reportError);
    }
  }

  /**
   * Setup React-specific error handling
   */
  static setupReactErrorHandling() {
    // This will be called from React Error Boundaries
    window.reportReactError = (error, errorInfo) => {
      this.handleReactError(error, errorInfo);
    };
  }

  /**
   * Handle React component errors
   */
  static async handleReactError(error, errorInfo) {
    try {
      const severity = this.SEVERITY.HIGH; // React errors are usually high severity
      
      const crashData = await this.collectCrashData(error, {
        type: 'react_error',
        componentStack: errorInfo.componentStack,
        errorBoundary: errorInfo.errorBoundary || 'unknown'
      }, severity);

      await UserActionTracker.trackError(error, {
        severity,
        context: 'react_component'
      });

      await this.reportCrash('react_error', crashData);
      
      logger.fatal('React component error', { 
        section: 'crash_reporter',
        componentStack: errorInfo.componentStack
      }, error);

      return crashData;
      
    } catch (reportError) {
      console.error('Failed to report React error:', reportError);
    }
  }

  /**
   * Determine error severity based on error type and context
   */
  static determineSeverity(error, context = {}) {
    // Critical errors that likely crash the app
    if (error.name === 'ReferenceError' || 
        error.name === 'TypeError' && error.message.includes('Cannot read property') ||
        context.filename && context.filename.includes('background.js')) {
      return this.SEVERITY.CRITICAL;
    }
    
    // High severity errors
    if (error.name === 'TypeError' || 
        error.name === 'RangeError' ||
        error.message.includes('IndexedDB') ||
        error.message.includes('Extension context')) {
      return this.SEVERITY.HIGH;
    }
    
    // Medium severity for most other errors
    if (error.name === 'Error' || error.name === 'SyntaxError') {
      return this.SEVERITY.MEDIUM;
    }
    
    return this.SEVERITY.LOW;
  }

  /**
   * Collect comprehensive crash data
   */
  static async collectCrashData(error, context = {}, severity = this.SEVERITY.MEDIUM) {
    const crashData = {
      timestamp: new Date().toISOString(),
      crashId: `crash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      severity,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context,
      environment: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        memory: this.getMemoryInfo(),
        performance: await this.getPerformanceSnapshot()
      },
      user: {
        sessionId: logger.sessionId,
        recentActions: await this.getRecentUserActions(),
        sessionDuration: Date.now() - UserActionTracker.sessionStart
      },
      system: {
        crashCount: ++this.crashCount,
        lastCrashTime: this.lastCrashTime,
        timeSinceLastCrash: this.lastCrashTime ? 
          Date.now() - this.lastCrashTime : null
      }
    };

    this.lastCrashTime = Date.now();
    return crashData;
  }

  /**
   * Get memory usage information
   */
  static getMemoryInfo() {
    try {
      if (performance.memory) {
        return {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        };
      }
    } catch (e) {
      // Memory API might not be available
    }
    return null;
  }

  /**
   * Get performance snapshot
   */
  static async getPerformanceSnapshot() {
    try {
      return {
        systemMetrics: performanceMonitor.getPerformanceSummary().systemMetrics,
        recentAlerts: performanceMonitor.getPerformanceSummary().recentAlerts.slice(0, 5),
        health: performanceMonitor.getSystemHealth()
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Get recent user actions for context
   */
  static async getRecentUserActions() {
    try {
      const actions = await UserActionTracker.getUserActions({ limit: 10 });
      return actions.map(action => ({
        action: action.action,
        category: action.category,
        timestamp: action.timestamp,
        context: action.context
      }));
    } catch (error) {
      return [];
    }
  }

  /**
   * Report crash to error tracking service
   */
  static async reportCrash(type, crashData) {
    try {
      await ErrorReportService.storeErrorReport({
        errorId: crashData.crashId,
        message: crashData.error.message,
        stack: crashData.error.stack,
        componentStack: crashData.context.componentStack,
        section: 'crash_reporter',
        userContext: crashData.user,
        errorType: type,
        severity: crashData.severity,
        timestamp: crashData.timestamp
      });

      // Add to recent errors for pattern detection
      this.recentErrors.push({
        type,
        severity: crashData.severity,
        timestamp: crashData.timestamp,
        message: crashData.error.message
      });

      // Keep only last 10 errors
      this.recentErrors = this.recentErrors.slice(-10);

      return crashData;
      
    } catch (error) {
      console.error('Failed to report crash:', error);
      throw error;
    }
  }

  /**
   * Check for crash patterns that might indicate systemic issues
   */
  static getCrashPatterns() {
    const patterns = {
      rapidCrashes: 0,
      repeatingErrors: {},
      highSeverityCrashes: 0
    };

    const last5Minutes = Date.now() - (5 * 60 * 1000);
    const recentCrashes = this.recentErrors.filter(e => 
      new Date(e.timestamp).getTime() > last5Minutes
    );

    patterns.rapidCrashes = recentCrashes.length;

    // Count repeating error messages
    this.recentErrors.forEach(error => {
      const key = error.message.substring(0, 50); // First 50 chars
      patterns.repeatingErrors[key] = (patterns.repeatingErrors[key] || 0) + 1;
    });

    // Count high severity crashes
    patterns.highSeverityCrashes = this.recentErrors.filter(e => 
      e.severity === this.SEVERITY.HIGH || e.severity === this.SEVERITY.CRITICAL
    ).length;

    return patterns;
  }

  /**
   * Start monitoring critical system resources
   */
  static startResourceMonitoring() {
    // Monitor memory usage every 30 seconds
    setInterval(() => {
      const memInfo = this.getMemoryInfo();
      if (memInfo && memInfo.usedJSHeapSize > 50 * 1024 * 1024) { // 50MB
        logger.warn('High memory usage detected', {
          section: 'crash_reporter',
          memoryUsage: memInfo
        });
      }
    }, 30000);

    // Monitor error rate
    setInterval(() => {
      const patterns = this.getCrashPatterns();
      if (patterns.rapidCrashes > 3) {
        logger.fatal('Rapid crash pattern detected', {
          section: 'crash_reporter',
          patterns
        });
      }
    }, 60000); // Check every minute
  }

  /**
   * Manually report a critical issue
   */
  static async reportCriticalIssue(description, context = {}) {
    const error = new Error(description);
    error.name = 'CriticalIssue';
    
    await this.handleJavaScriptError(error, {
      ...context,
      type: 'manual_report',
      severity: this.SEVERITY.CRITICAL
    });
  }

  /**
   * Get crash statistics for dashboard
   */
  static getCrashStatistics() {
    return {
      totalCrashes: this.crashCount,
      lastCrashTime: this.lastCrashTime,
      recentErrors: this.recentErrors.length,
      patterns: this.getCrashPatterns(),
      isHealthy: this.crashCount < 5 && this.recentErrors.length < 3
    };
  }
}

export default CrashReporter;