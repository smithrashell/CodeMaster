/**
 * PerformanceMonitor - Enhanced utility for tracking critical operation performance
 *
 * Features:
 * - Query time measurement with automatic critical operation detection
 * - Memory usage tracking with leak detection
 * - Performance alerts and adaptive thresholds
 * - Component rendering performance monitoring
 * - Database operation instrumentation
 * - Real-time performance analytics
 */

import logger from "./logger.js";

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      queries: [],
      alerts: [],
      criticalOperations: [],
      componentRenders: [],
      systemMetrics: {
        totalQueries: 0,
        averageQueryTime: 0,
        slowQueries: 0,
        errorRate: 0,
        memoryUsage: 0,
        criticalOperationCount: 0,
        renderPerformance: 0,
      },
    };

    this.thresholds = {
      slowQueryTime: 1000, // 1 second
      criticalOperationTime: 2000, // 2 seconds for critical operations
      highMemoryUsage: 50 * 1024 * 1024, // 50MB
      memoryLeakThreshold: 10 * 1024 * 1024, // 10MB growth
      errorRateThreshold: 5, // 5%
      maxMetricsHistory: 1000,
      componentRenderThreshold: 100, // 100ms for component renders
      slowRenderThreshold: 500, // 500ms for very slow renders
    };

    this.criticalOperations = new Set([
      "db_query",
      "session_creation",
      "problem_generation",
      "adaptive_selection",
      "tag_calculation",
      "mastery_update",
      "progress_calculation",
      "cache_operations",
      "background_sync",
      "data_migration",
    ]);

    this.lastMemoryCheck = (typeof window !== 'undefined' && performance.memory) ? performance.memory.usedJSHeapSize : 0;
    this.startTime = Date.now();

    // Initialize performance observers
    this.initializePerformanceObservers();

    logger.info("Enhanced PerformanceMonitor initialized", { context: 'performance_monitor' });
  }

  /**
   * Initialize performance observers for advanced monitoring
   */
  initializePerformanceObservers() {
    // Only initialize in browser environment
    if (typeof window === 'undefined') {
      logger.warn("PerformanceMonitor window not available, skipping observers", { context: 'performance_monitor' });
      return;
    }

    // Monitor Long Tasks (requires Long Tasks API)
    if (
      "PerformanceObserver" in window &&
      "PerformanceLongTaskTiming" in window
    ) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordLongTask(entry);
          }
        });
        longTaskObserver.observe({ type: "longtask", buffered: true });
      } catch (error) {
        // Long Task API not supported
      }
    }

    // Monitor Layout Shifts
    if ("PerformanceObserver" in window && "LayoutShift" in window) {
      try {
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordLayoutShift(entry);
          }
        });
        clsObserver.observe({ type: "layout-shift", buffered: true });
      } catch (error) {
        // Layout Shift API not supported
      }
    }

    // Monitor memory usage periodically
    if (typeof window !== 'undefined' && performance.memory) {
      setInterval(() => this.checkMemoryLeaks(), 30000); // Every 30 seconds
    }
  }

  /**
   * Record long task performance issue
   */
  recordLongTask(entry) {
    const duration = entry.duration;
    this.metrics.alerts.push({
      type: "LONG_TASK",
      message: `Long task detected: ${duration.toFixed(2)}ms`,
      severity: duration > 1000 ? "error" : "warning",
      timestamp: Date.now(),
      data: {
        duration,
        startTime: entry.startTime,
        name: entry.name,
      },
    });
  }

  /**
   * Record layout shift performance issue
   */
  recordLayoutShift(entry) {
    if (entry.value > 0.1) {
      // Significant layout shift
      this.metrics.alerts.push({
        type: "LAYOUT_SHIFT",
        message: `Significant layout shift detected: ${entry.value.toFixed(3)}`,
        severity: entry.value > 0.25 ? "error" : "warning",
        timestamp: Date.now(),
        data: {
          value: entry.value,
          hadRecentInput: entry.hadRecentInput,
        },
      });
    }
  }

  /**
   * Check for potential memory leaks
   */
  checkMemoryLeaks() {
    if (typeof window === 'undefined' || !performance.memory) return;

    const currentMemory = performance.memory.usedJSHeapSize;
    const memoryGrowth = currentMemory - this.lastMemoryCheck;

    if (memoryGrowth > this.thresholds.memoryLeakThreshold) {
      this.metrics.alerts.push({
        type: "POTENTIAL_MEMORY_LEAK",
        message: `Significant memory growth: ${(
          memoryGrowth /
          1024 /
          1024
        ).toFixed(2)}MB`,
        severity: "warning",
        timestamp: Date.now(),
        data: {
          currentMemory,
          previousMemory: this.lastMemoryCheck,
          growth: memoryGrowth,
        },
      });
    }

    this.lastMemoryCheck = currentMemory;
    this.metrics.systemMetrics.memoryUsage = currentMemory;
  }

  /**
   * Start timing a query operation
   * @param {string} operation - Operation name
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Query context for ending measurement
   */
  startQuery(operation, metadata = {}) {
    const queryId = `${operation}_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const startTime = performance.now();

    const queryContext = {
      id: queryId,
      operation,
      startTime,
      metadata,
    };

    return queryContext;
  }

  /**
   * End timing a query and record metrics
   * @param {Object} queryContext - Query context from startQuery
   * @param {boolean} success - Whether query was successful
   * @param {number} resultSize - Size of result data (optional)
   * @param {Error} error - Error object if query failed (optional)
   */
  endQuery(queryContext, success = true, resultSize = 0, error = null) {
    const endTime = performance.now();
    const duration = endTime - queryContext.startTime;

    const queryMetric = {
      id: queryContext.id,
      operation: queryContext.operation,
      duration,
      success,
      resultSize,
      timestamp: Date.now(),
      metadata: queryContext.metadata,
      error: error ? error.message : null,
      isCritical: this.criticalOperations.has(queryContext.operation),
    };

    // Add to appropriate metrics history
    this.metrics.queries.push(queryMetric);

    if (queryMetric.isCritical) {
      this.metrics.criticalOperations.push(queryMetric);
      this.metrics.systemMetrics.criticalOperationCount++;
    }

    // Trim history if too large
    if (this.metrics.queries.length > this.thresholds.maxMetricsHistory) {
      this.metrics.queries = this.metrics.queries.slice(
        -this.thresholds.maxMetricsHistory
      );
    }
    if (
      this.metrics.criticalOperations.length >
      Math.floor(this.thresholds.maxMetricsHistory / 2)
    ) {
      this.metrics.criticalOperations = this.metrics.criticalOperations.slice(
        -Math.floor(this.thresholds.maxMetricsHistory / 2)
      );
    }

    // Update system metrics
    this.updateSystemMetrics();

    // Check for performance alerts (with enhanced critical operation monitoring)
    this.checkPerformanceAlerts(queryMetric);

    // Enhanced logging for critical operations
    const threshold = queryMetric.isCritical
      ? this.thresholds.criticalOperationTime
      : this.thresholds.slowQueryTime;
    const level = duration > threshold ? "warn" : "log";
    const icon = queryMetric.isCritical ? "🚨" : "⏱️";

    // eslint-disable-next-line no-console
    console[level](
      `${icon} ${queryContext.operation}: ${duration.toFixed(2)}ms ${
        success ? "✅" : "❌"
      }${queryMetric.isCritical ? " [CRITICAL]" : ""}`
    );

    return queryMetric;
  }

  /**
   * Monitor React component rendering performance
   * @param {string} componentName - Name of the component
   * @param {Object} props - Component props for context
   * @returns {Function} Function to call when render completes
   */
  startComponentRender(componentName, props = {}) {
    const renderId = `render_${componentName}_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const startTime = performance.now();

    return (success = true, error = null) => {
      const endTime = performance.now();
      const duration = endTime - startTime;

      const renderMetric = {
        id: renderId,
        component: componentName,
        duration,
        success,
        timestamp: Date.now(),
        props: this.sanitizeProps(props),
        error: error ? error.message : null,
      };

      this.metrics.componentRenders.push(renderMetric);

      // Update render performance average
      this.updateRenderPerformance();

      // Check for slow renders
      if (duration > this.thresholds.componentRenderThreshold) {
        this.metrics.alerts.push({
          type: "SLOW_COMPONENT_RENDER",
          message: `Slow component render: ${componentName} took ${duration.toFixed(
            2
          )}ms`,
          severity:
            duration > this.thresholds.slowRenderThreshold
              ? "error"
              : "warning",
          timestamp: Date.now(),
          data: renderMetric,
        });
      }

      // Trim render history
      if (this.metrics.componentRenders.length > 500) {
        this.metrics.componentRenders =
          this.metrics.componentRenders.slice(-500);
      }

      return renderMetric;
    };
  }

  /**
   * Sanitize props for logging (remove sensitive data)
   */
  sanitizeProps(props) {
    const sanitized = {};
    for (const [key, value] of Object.entries(props)) {
      if (typeof value === "function") {
        sanitized[key] = "[Function]";
      } else if (typeof value === "object" && value !== null) {
        sanitized[key] = "[Object]";
      } else if (typeof value === "string" && value.length > 50) {
        sanitized[key] = value.substring(0, 50) + "...";
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  /**
   * Update component render performance metrics
   */
  updateRenderPerformance() {
    const renders = this.metrics.componentRenders.slice(-100); // Last 100 renders
    if (renders.length > 0) {
      const totalTime = renders.reduce((sum, r) => sum + r.duration, 0);
      this.metrics.systemMetrics.renderPerformance = totalTime / renders.length;
    }
  }

  /**
   * Create a performance-monitored wrapper for database operations
   * @param {Function} dbOperation - Database operation function
   * @param {string} operationName - Name of the operation
   * @returns {Function} Wrapped database operation
   */
  wrapDbOperation(dbOperation, operationName) {
    return async (...args) => {
      const queryContext = this.startQuery(`db_${operationName}`, {
        operationType: "database",
        operation: operationName,
      });

      try {
        const result = await dbOperation(...args);
        this.endQuery(
          queryContext,
          true,
          Array.isArray(result) ? result.length : 1
        );
        return result;
      } catch (error) {
        this.endQuery(queryContext, false, 0, error);
        throw error;
      }
    };
  }

  /**
   * Create a performance-monitored wrapper for async operations
   * @param {Function} asyncOperation - Async operation function
   * @param {string} operationName - Name of the operation
   * @param {boolean} isCritical - Whether this is a critical operation
   * @returns {Function} Wrapped async operation
   */
  wrapAsyncOperation(asyncOperation, operationName, isCritical = false) {
    if (isCritical) {
      this.criticalOperations.add(operationName);
    }

    return async (...args) => {
      const queryContext = this.startQuery(operationName, {
        operationType: "async",
        isCritical,
      });

      try {
        const result = await asyncOperation(...args);
        const resultSize = this.estimateResultSize(result);
        this.endQuery(queryContext, true, resultSize);
        return result;
      } catch (error) {
        this.endQuery(queryContext, false, 0, error);
        throw error;
      }
    };
  }

  /**
   * Estimate result size for performance tracking
   */
  estimateResultSize(result) {
    if (Array.isArray(result)) {
      return result.length;
    } else if (typeof result === "object" && result !== null) {
      return Object.keys(result).length;
    } else if (typeof result === "string") {
      return result.length;
    }
    return 1;
  }

  /**
   * Update system-wide metrics
   */
  updateSystemMetrics() {
    const queries = this.metrics.queries;
    const recentQueries = queries.slice(-100); // Last 100 queries
    const criticalOps = this.metrics.criticalOperations;

    this.metrics.systemMetrics.totalQueries = queries.length;

    if (queries.length > 0) {
      // Calculate average query time
      const totalTime = queries.reduce((sum, q) => sum + q.duration, 0);
      this.metrics.systemMetrics.averageQueryTime = totalTime / queries.length;

      // Count slow queries
      this.metrics.systemMetrics.slowQueries = queries.filter(
        (q) => q.duration > this.thresholds.slowQueryTime
      ).length;

      // Calculate error rate (last 100 queries)
      const errors = recentQueries.filter((q) => !q.success).length;
      this.metrics.systemMetrics.errorRate =
        recentQueries.length > 0 ? (errors / recentQueries.length) * 100 : 0;

      // Update critical operation metrics
      if (criticalOps.length > 0) {
        const recentCritical = criticalOps.slice(-50); // Last 50 critical operations
        const criticalErrors = recentCritical.filter((q) => !q.success).length;
        this.metrics.systemMetrics.criticalErrorRate =
          recentCritical.length > 0
            ? (criticalErrors / recentCritical.length) * 100
            : 0;

        const criticalTime = recentCritical.reduce(
          (sum, q) => sum + q.duration,
          0
        );
        this.metrics.systemMetrics.averageCriticalTime =
          recentCritical.length > 0 ? criticalTime / recentCritical.length : 0;
      }
    }
  }

  /**
   * Check for performance alerts and add them to alert queue
   * @param {Object} queryMetric - Query metric to check
   */
  checkPerformanceAlerts(queryMetric) {
    const alerts = [];

    // Enhanced slow query alert (different thresholds for critical ops)
    const threshold = queryMetric.isCritical
      ? this.thresholds.criticalOperationTime
      : this.thresholds.slowQueryTime;
    if (queryMetric.duration > threshold) {
      alerts.push({
        type: queryMetric.isCritical ? "CRITICAL_OPERATION_SLOW" : "SLOW_QUERY",
        message: `${
          queryMetric.isCritical ? "Critical operation" : "Query"
        } slow: ${queryMetric.operation} took ${queryMetric.duration.toFixed(
          2
        )}ms`,
        severity: queryMetric.isCritical ? "error" : "warning",
        timestamp: Date.now(),
        data: queryMetric,
      });
    }

    // Critical operation failure alert
    if (queryMetric.isCritical && !queryMetric.success) {
      alerts.push({
        type: "CRITICAL_OPERATION_FAILED",
        message: `Critical operation failed: ${queryMetric.operation}`,
        severity: "critical",
        timestamp: Date.now(),
        data: queryMetric,
      });
    }

    // High error rate alert
    if (
      this.metrics.systemMetrics.errorRate > this.thresholds.errorRateThreshold
    ) {
      alerts.push({
        type: "HIGH_ERROR_RATE",
        message: `High error rate: ${this.metrics.systemMetrics.errorRate.toFixed(
          2
        )}%`,
        severity: "error",
        timestamp: Date.now(),
        data: { errorRate: this.metrics.systemMetrics.errorRate },
      });
    }

    // Critical operation error rate alert
    if (this.metrics.systemMetrics.criticalErrorRate > 2) {
      // Lower threshold for critical ops
      alerts.push({
        type: "CRITICAL_ERROR_RATE",
        message: `Critical operations error rate: ${this.metrics.systemMetrics.criticalErrorRate.toFixed(
          2
        )}%`,
        severity: "critical",
        timestamp: Date.now(),
        data: {
          criticalErrorRate: this.metrics.systemMetrics.criticalErrorRate,
        },
      });
    }

    // System performance degradation alert
    const avgTime = this.metrics.systemMetrics.averageQueryTime;
    const avgCriticalTime = this.metrics.systemMetrics.averageCriticalTime;

    if (avgTime > this.thresholds.slowQueryTime * 2) {
      // System-wide slowdown
      alerts.push({
        type: "SYSTEM_PERFORMANCE_DEGRADED",
        message: `System performance degraded: Average query time ${avgTime.toFixed(
          2
        )}ms`,
        severity: "warning",
        timestamp: Date.now(),
        data: { averageQueryTime: avgTime },
      });
    }

    if (avgCriticalTime > this.thresholds.criticalOperationTime * 1.5) {
      alerts.push({
        type: "CRITICAL_PERFORMANCE_DEGRADED",
        message: `Critical operations performance degraded: Average time ${avgCriticalTime.toFixed(
          2
        )}ms`,
        severity: "error",
        timestamp: Date.now(),
        data: { averageCriticalTime: avgCriticalTime },
      });
    }

    // Add alerts to queue
    this.metrics.alerts.push(...alerts);

    // Trim alert history
    if (this.metrics.alerts.length > 200) {
      this.metrics.alerts = this.metrics.alerts.slice(-200);
    }

    // Enhanced logging for critical alerts
    alerts.forEach((alert) => {
      const _icon =
        alert.severity === "critical"
          ? "🔥"
          : alert.severity === "error"
          ? "🚨"
          : "⚠️";

      if (alert.severity === "critical" || alert.severity === "error") {
        logger.error("Performance alert", { message: alert.message, severity: 'error', context: 'performance_monitor' });
      } else {
        logger.warn("Performance alert", { message: alert.message, severity: 'warning', context: 'performance_monitor' });
      }
    });
  }

  /**
   * Record memory usage
   * @param {number} memoryUsage - Memory usage in bytes
   * @param {string} source - Source of memory usage (e.g., 'cache', 'components')
   */
  recordMemoryUsage(memoryUsage, source = "unknown") {
    this.metrics.systemMetrics.memoryUsage = memoryUsage;

    if (memoryUsage > this.thresholds.highMemoryUsage) {
      this.metrics.alerts.push({
        type: "HIGH_MEMORY_USAGE",
        message: `High memory usage: ${(memoryUsage / 1024 / 1024).toFixed(
          2
        )}MB from ${source}`,
        severity: "warning",
        timestamp: Date.now(),
        data: { memoryUsage, source },
      });

      logger.warn("High memory usage detected", { 
        memoryUsageMB: (memoryUsage / 1024 / 1024).toFixed(2), 
        source, 
        context: 'performance_monitor' 
      });
    }
  }

  /**
   * Get performance summary
   * @returns {Object} Performance metrics summary
   */
  getPerformanceSummary() {
    const uptime = Date.now() - this.startTime;
    const recentQueries = this.metrics.queries.slice(-20);
    const recentCriticalOps = this.metrics.criticalOperations.slice(-10);
    const recentAlerts = this.metrics.alerts.slice(-10);
    const recentRenders = this.metrics.componentRenders.slice(-10);

    return {
      uptime: Math.round(uptime / 1000), // seconds
      systemMetrics: {
        ...this.metrics.systemMetrics,
        averageQueryTime:
          Math.round(this.metrics.systemMetrics.averageQueryTime * 100) / 100,
        averageCriticalTime:
          Math.round(
            (this.metrics.systemMetrics.averageCriticalTime || 0) * 100
          ) / 100,
        criticalErrorRate:
          Math.round(
            (this.metrics.systemMetrics.criticalErrorRate || 0) * 100
          ) / 100,
        errorRate: Math.round(this.metrics.systemMetrics.errorRate * 100) / 100,
        renderPerformance:
          Math.round(
            (this.metrics.systemMetrics.renderPerformance || 0) * 100
          ) / 100,
        memoryUsageMB:
          Math.round(
            (this.metrics.systemMetrics.memoryUsage / 1024 / 1024) * 100
          ) / 100,
      },
      recentQueries: recentQueries.map((q) => ({
        operation: q.operation,
        duration: Math.round(q.duration * 100) / 100,
        success: q.success,
        isCritical: q.isCritical,
        timestamp: new Date(q.timestamp).toLocaleTimeString(),
      })),
      recentCriticalOperations: recentCriticalOps.map((q) => ({
        operation: q.operation,
        duration: Math.round(q.duration * 100) / 100,
        success: q.success,
        timestamp: new Date(q.timestamp).toLocaleTimeString(),
      })),
      recentComponentRenders: recentRenders.map((r) => ({
        component: r.component,
        duration: Math.round(r.duration * 100) / 100,
        success: r.success,
        timestamp: new Date(r.timestamp).toLocaleTimeString(),
      })),
      recentAlerts: recentAlerts.map((a) => ({
        type: a.type,
        message: a.message,
        severity: a.severity,
        timestamp: new Date(a.timestamp).toLocaleTimeString(),
      })),
      health: this.getSystemHealth(),
    };
  }

  /**
   * Get system health status
   * @returns {string} Health status: 'good', 'warning', 'critical'
   */
  getSystemHealth() {
    const errorRate = this.metrics.systemMetrics.errorRate;
    const criticalErrorRate = this.metrics.systemMetrics.criticalErrorRate || 0;
    const avgQueryTime = this.metrics.systemMetrics.averageQueryTime;
    const avgCriticalTime = this.metrics.systemMetrics.averageCriticalTime || 0;
    const renderPerformance = this.metrics.systemMetrics.renderPerformance || 0;
    const recentAlerts = this.metrics.alerts.filter(
      (a) => Date.now() - a.timestamp < 5 * 60 * 1000
    ); // Last 5 minutes

    // Critical conditions
    const hasCriticalAlerts =
      recentAlerts.filter((a) => a.severity === "critical").length > 0;
    const highCriticalErrorRate = criticalErrorRate > 5;
    const severePerformanceDegradation =
      avgQueryTime > 3000 || avgCriticalTime > 4000;
    const systemOverloaded = errorRate > 15 || renderPerformance > 1000;

    if (
      hasCriticalAlerts ||
      highCriticalErrorRate ||
      severePerformanceDegradation ||
      systemOverloaded
    ) {
      return "critical";
    }

    // Warning conditions
    const moderateErrorRate = errorRate > 3 || criticalErrorRate > 1;
    const performanceDegraded = avgQueryTime > 1000 || avgCriticalTime > 2000;
    const someAlerts =
      recentAlerts.filter((a) => a.severity === "error").length > 0;
    const slowRenders = renderPerformance > 200;
    const multipleWarnings = recentAlerts.length > 3;

    if (
      moderateErrorRate ||
      performanceDegraded ||
      someAlerts ||
      slowRenders ||
      multipleWarnings
    ) {
      return "warning";
    }

    return "good";
  }

  /**
   * Get query statistics by operation
   * @returns {Object} Statistics grouped by operation
   */
  getQueryStatsByOperation() {
    const stats = {};

    this.metrics.queries.forEach((query) => {
      const op = query.operation;
      if (!stats[op]) {
        stats[op] = {
          count: 0,
          totalTime: 0,
          averageTime: 0,
          successRate: 0,
          errors: 0,
        };
      }

      stats[op].count++;
      stats[op].totalTime += query.duration;
      if (!query.success) stats[op].errors++;
    });

    // Calculate derived metrics
    Object.keys(stats).forEach((op) => {
      const stat = stats[op];
      stat.averageTime = Math.round((stat.totalTime / stat.count) * 100) / 100;
      stat.successRate =
        Math.round(((stat.count - stat.errors) / stat.count) * 100 * 100) / 100;
    });

    return stats;
  }

  /**
   * Get critical operation performance summary
   * @returns {Object} Critical operation performance data
   */
  getCriticalOperationSummary() {
    const critical = this.metrics.criticalOperations;
    const last24h = critical.filter(
      (op) => Date.now() - op.timestamp < 24 * 60 * 60 * 1000
    );

    if (last24h.length === 0) {
      return {
        totalOperations: 0,
        averageTime: 0,
        successRate: 100,
        failures: [],
      };
    }

    const totalTime = last24h.reduce((sum, op) => sum + op.duration, 0);
    const failures = last24h.filter((op) => !op.success);
    const successRate =
      ((last24h.length - failures.length) / last24h.length) * 100;

    return {
      totalOperations: last24h.length,
      averageTime: Math.round((totalTime / last24h.length) * 100) / 100,
      successRate: Math.round(successRate * 100) / 100,
      failures: failures.map((f) => ({
        operation: f.operation,
        error: f.error,
        timestamp: new Date(f.timestamp).toLocaleString(),
      })),
    };
  }

  /**
   * Get component render performance summary
   * @returns {Object} Component render performance data
   */
  getRenderPerformanceSummary() {
    const renders = this.metrics.componentRenders;
    const last24h = renders.filter(
      (r) => Date.now() - r.timestamp < 24 * 60 * 60 * 1000
    );

    if (last24h.length === 0) {
      return {
        totalRenders: 0,
        averageTime: 0,
        slowRenders: 0,
        byComponent: {},
      };
    }

    const totalTime = last24h.reduce((sum, r) => sum + r.duration, 0);
    const slowRenders = last24h.filter(
      (r) => r.duration > this.thresholds.componentRenderThreshold
    );

    // Group by component
    const byComponent = {};
    last24h.forEach((render) => {
      const comp = render.component;
      if (!byComponent[comp]) {
        byComponent[comp] = { count: 0, totalTime: 0, averageTime: 0 };
      }
      byComponent[comp].count++;
      byComponent[comp].totalTime += render.duration;
    });

    // Calculate averages
    Object.keys(byComponent).forEach((comp) => {
      const data = byComponent[comp];
      data.averageTime = Math.round((data.totalTime / data.count) * 100) / 100;
    });

    return {
      totalRenders: last24h.length,
      averageTime: Math.round((totalTime / last24h.length) * 100) / 100,
      slowRenders: slowRenders.length,
      byComponent,
    };
  }

  /**
   * Clear all metrics and alerts
   */
  reset() {
    this.metrics = {
      queries: [],
      alerts: [],
      criticalOperations: [],
      componentRenders: [],
      systemMetrics: {
        totalQueries: 0,
        averageQueryTime: 0,
        slowQueries: 0,
        errorRate: 0,
        memoryUsage: 0,
        criticalOperationCount: 0,
        renderPerformance: 0,
      },
    };
    this.startTime = Date.now();
    this.lastMemoryCheck = (typeof window !== 'undefined' && performance.memory) ? performance.memory.usedJSHeapSize : 0;
    logger.info("Enhanced performance metrics reset", { context: 'performance_monitor' });
  }

  /**
   * Export metrics for debugging
   * @returns {Object} Full metrics data
   */
  exportMetrics() {
    return {
      ...this.metrics,
      summaries: {
        criticalOperations: this.getCriticalOperationSummary(),
        renderPerformance: this.getRenderPerformanceSummary(),
        queryStatsByOperation: this.getQueryStatsByOperation(),
      },
      thresholds: this.thresholds,
      uptime: Date.now() - this.startTime,
      exportTime: new Date().toISOString(),
      health: this.getSystemHealth(),
    };
  }

  /**
   * Generate performance report for debugging/analysis
   * @returns {string} Formatted performance report
   */
  generateReport() {
    const summary = this.getPerformanceSummary();
    const criticalOps = this.getCriticalOperationSummary();
    const renderPerf = this.getRenderPerformanceSummary();

    return `
🔧 PERFORMANCE REPORT
=====================
Generated: ${new Date().toLocaleString()}
Uptime: ${Math.floor(summary.uptime / 60)}m ${summary.uptime % 60}s
Health: ${summary.health.toUpperCase()}

📊 SYSTEM METRICS
• Total Queries: ${summary.systemMetrics.totalQueries}
• Average Query Time: ${summary.systemMetrics.averageQueryTime}ms
• Error Rate: ${summary.systemMetrics.errorRate}%
• Memory Usage: ${summary.systemMetrics.memoryUsageMB}MB

🚨 CRITICAL OPERATIONS
• Total: ${criticalOps.totalOperations}
• Average Time: ${criticalOps.averageTime}ms  
• Success Rate: ${criticalOps.successRate}%
• Failures: ${criticalOps.failures.length}

🎨 COMPONENT RENDERS
• Total Renders: ${renderPerf.totalRenders}
• Average Time: ${renderPerf.averageTime}ms
• Slow Renders: ${renderPerf.slowRenders}

⚠️ RECENT ALERTS (${summary.recentAlerts.length})
${summary.recentAlerts
  .map((a) => `• [${a.severity.toUpperCase()}] ${a.message}`)
  .join("\n")}
    `.trim();
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

// Add global access for debugging and enhanced tools
if (typeof window !== "undefined") {
  window.performanceMonitor = performanceMonitor;

  // Add convenience methods to global scope for debugging
  window.perfReport = () => logger.info("Performance report", { report: performanceMonitor.generateReport(), context: 'performance_debug' });
  window.perfExport = () => logger.info("Performance metrics export", { metrics: performanceMonitor.exportMetrics(), context: 'performance_debug' });
  window.perfReset = () => performanceMonitor.reset();
}

export default performanceMonitor;
