/**
 * PerformanceMonitor - Enhanced utility for tracking critical operation performance
 */

import logger from "./logger.js";
import {
  recordLongTask,
  recordLayoutShift,
  checkMemoryLeaks as checkMemoryLeaksHelper,
  sanitizeProps,
  estimateResultSize,
  getSystemHealth,
  getPerformanceSummary as getPerformanceSummaryHelper,
  getQueryStatsByOperation,
  getCriticalOperationSummary,
  getRenderPerformanceSummary,
  generateReport,
  checkPerformanceAlerts as checkPerformanceAlertsHelper,
  logAlerts,
  isTestEnvironment,
  getDefaultMetrics,
  getDefaultThresholds,
  getDefaultCriticalOperations,
} from "./PerformanceMonitorHelpers.js";

class PerformanceMonitor {
  constructor() {
    this.metrics = getDefaultMetrics();
    const isTest = isTestEnvironment();
    this.thresholds = getDefaultThresholds(isTest);

    if (isTest) {
      logger.info("PerformanceMonitor: Using relaxed thresholds for test environment", {
        slowQueryTime: this.thresholds.slowQueryTime,
        criticalOperationTime: this.thresholds.criticalOperationTime,
        context: 'performance_monitor'
      });
    }

    this.criticalOperations = getDefaultCriticalOperations();
    this.lastMemoryCheck = (typeof window !== 'undefined' && performance.memory) ? performance.memory.usedJSHeapSize : 0;
    this.startTime = Date.now();
    this.initializePerformanceObservers();
    logger.info("Enhanced PerformanceMonitor initialized", { context: 'performance_monitor' });
  }

  initializePerformanceObservers() {
    if (typeof window === 'undefined') {
      logger.warn("PerformanceMonitor window not available, skipping observers", { context: 'performance_monitor' });
      return;
    }

    if ("PerformanceObserver" in window && "PerformanceLongTaskTiming" in window) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            recordLongTask(entry, this.metrics);
          }
        });
        longTaskObserver.observe({ type: "longtask", buffered: true });
      } catch (error) { /* Long Task API not supported */ }
    }

    if ("PerformanceObserver" in window && "LayoutShift" in window) {
      try {
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            recordLayoutShift(entry, this.metrics);
          }
        });
        clsObserver.observe({ type: "layout-shift", buffered: true });
      } catch (error) { /* Layout Shift API not supported */ }
    }

    if (typeof window !== 'undefined' && performance.memory) {
      setInterval(() => this.checkMemoryLeaks(), 30000);
    }
  }

  checkMemoryLeaks() {
    this.lastMemoryCheck = checkMemoryLeaksHelper(this.metrics, this.thresholds, this.lastMemoryCheck);
  }

  startQuery(operation, metadata = {}) {
    const queryId = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return { id: queryId, operation, startTime: performance.now(), metadata };
  }

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

    this.metrics.queries.push(queryMetric);
    if (queryMetric.isCritical) {
      this.metrics.criticalOperations.push(queryMetric);
      this.metrics.systemMetrics.criticalOperationCount++;
    }

    if (this.metrics.queries.length > this.thresholds.maxMetricsHistory) {
      this.metrics.queries = this.metrics.queries.slice(-this.thresholds.maxMetricsHistory);
    }
    if (this.metrics.criticalOperations.length > Math.floor(this.thresholds.maxMetricsHistory / 2)) {
      this.metrics.criticalOperations = this.metrics.criticalOperations.slice(-Math.floor(this.thresholds.maxMetricsHistory / 2));
    }

    this.updateSystemMetrics();
    this.checkPerformanceAlerts(queryMetric);

    const threshold = queryMetric.isCritical ? this.thresholds.criticalOperationTime : this.thresholds.slowQueryTime;
    const level = duration > threshold ? "warn" : "log";
    const icon = queryMetric.isCritical ? "🚨" : "⏱️";
    // eslint-disable-next-line no-console
    console[level](`${icon} ${queryContext.operation}: ${duration.toFixed(2)}ms ${success ? "✅" : "❌"}${queryMetric.isCritical ? " [CRITICAL]" : ""}`);

    return queryMetric;
  }

  startComponentRender(componentName, props = {}) {
    const renderId = `render_${componentName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = performance.now();

    return (success = true, error = null) => {
      const duration = performance.now() - startTime;
      const renderMetric = {
        id: renderId,
        component: componentName,
        duration,
        success,
        timestamp: Date.now(),
        props: sanitizeProps(props),
        error: error ? error.message : null,
      };

      this.metrics.componentRenders.push(renderMetric);
      this.updateRenderPerformance();

      if (duration > this.thresholds.componentRenderThreshold) {
        this.metrics.alerts.push({
          type: "SLOW_COMPONENT_RENDER",
          message: `Slow component render: ${componentName} took ${duration.toFixed(2)}ms`,
          severity: duration > this.thresholds.slowRenderThreshold ? "error" : "warning",
          timestamp: Date.now(),
          data: renderMetric,
        });
      }

      if (this.metrics.componentRenders.length > 500) {
        this.metrics.componentRenders = this.metrics.componentRenders.slice(-500);
      }

      return renderMetric;
    };
  }

  updateRenderPerformance() {
    const renders = this.metrics.componentRenders.slice(-100);
    if (renders.length > 0) {
      const totalTime = renders.reduce((sum, r) => sum + r.duration, 0);
      this.metrics.systemMetrics.renderPerformance = totalTime / renders.length;
    }
  }

  wrapDbOperation(dbOperation, operationName) {
    return async (...args) => {
      const queryContext = this.startQuery(`db_${operationName}`, { operationType: "database", operation: operationName });
      try {
        const result = await dbOperation(...args);
        this.endQuery(queryContext, true, Array.isArray(result) ? result.length : 1);
        return result;
      } catch (error) {
        this.endQuery(queryContext, false, 0, error);
        throw error;
      }
    };
  }

  wrapAsyncOperation(asyncOperation, operationName, isCritical = false) {
    if (isCritical) this.criticalOperations.add(operationName);
    return async (...args) => {
      const queryContext = this.startQuery(operationName, { operationType: "async", isCritical });
      try {
        const result = await asyncOperation(...args);
        this.endQuery(queryContext, true, estimateResultSize(result));
        return result;
      } catch (error) {
        this.endQuery(queryContext, false, 0, error);
        throw error;
      }
    };
  }

  updateSystemMetrics() {
    const queries = this.metrics.queries;
    const recentQueries = queries.slice(-100);
    const criticalOps = this.metrics.criticalOperations;

    this.metrics.systemMetrics.totalQueries = queries.length;

    if (queries.length > 0) {
      const totalTime = queries.reduce((sum, q) => sum + q.duration, 0);
      this.metrics.systemMetrics.averageQueryTime = totalTime / queries.length;
      this.metrics.systemMetrics.slowQueries = queries.filter((q) => q.duration > this.thresholds.slowQueryTime).length;

      const errors = recentQueries.filter((q) => !q.success).length;
      this.metrics.systemMetrics.errorRate = recentQueries.length > 0 ? (errors / recentQueries.length) * 100 : 0;

      if (criticalOps.length > 0) {
        const recentCritical = criticalOps.slice(-50);
        const criticalErrors = recentCritical.filter((q) => !q.success).length;
        this.metrics.systemMetrics.criticalErrorRate = recentCritical.length > 0 ? (criticalErrors / recentCritical.length) * 100 : 0;
        const criticalTime = recentCritical.reduce((sum, q) => sum + q.duration, 0);
        this.metrics.systemMetrics.averageCriticalTime = recentCritical.length > 0 ? criticalTime / recentCritical.length : 0;
      }
    }
  }

  checkPerformanceAlerts(queryMetric) {
    const alerts = checkPerformanceAlertsHelper(queryMetric, this.metrics, this.thresholds);
    this.metrics.alerts.push(...alerts);
    if (this.metrics.alerts.length > 200) {
      this.metrics.alerts = this.metrics.alerts.slice(-200);
    }
    logAlerts(alerts);
  }

  recordMemoryUsage(memoryUsage, source = "unknown") {
    this.metrics.systemMetrics.memoryUsage = memoryUsage;
    if (memoryUsage > this.thresholds.highMemoryUsage) {
      this.metrics.alerts.push({
        type: "HIGH_MEMORY_USAGE",
        message: `High memory usage: ${(memoryUsage / 1024 / 1024).toFixed(2)}MB from ${source}`,
        severity: "warning",
        timestamp: Date.now(),
        data: { memoryUsage, source },
      });
      logger.warn("High memory usage detected", { memoryUsageMB: (memoryUsage / 1024 / 1024).toFixed(2), source, context: 'performance_monitor' });
    }
  }

  getPerformanceSummary() {
    return getPerformanceSummaryHelper(this.metrics, this.startTime);
  }

  getSystemHealth() {
    return getSystemHealth(this.metrics);
  }

  getQueryStatsByOperation() {
    return getQueryStatsByOperation(this.metrics.queries);
  }

  getCriticalOperationSummary() {
    return getCriticalOperationSummary(this.metrics.criticalOperations);
  }

  getRenderPerformanceSummary() {
    return getRenderPerformanceSummary(this.metrics.componentRenders, this.thresholds.componentRenderThreshold);
  }

  reset() {
    this.metrics = getDefaultMetrics();
    this.startTime = Date.now();
    this.lastMemoryCheck = (typeof window !== 'undefined' && performance.memory) ? performance.memory.usedJSHeapSize : 0;
    logger.info("Enhanced performance metrics reset", { context: 'performance_monitor' });
  }

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

  generateReport() {
    return generateReport(this.getPerformanceSummary(), this.getCriticalOperationSummary(), this.getRenderPerformanceSummary());
  }
}

const performanceMonitor = new PerformanceMonitor();

if (typeof window !== "undefined") {
  window.performanceMonitor = performanceMonitor;
  window.perfReport = () => logger.info("Performance report", { report: performanceMonitor.generateReport(), context: 'performance_debug' });
  window.perfExport = () => logger.info("Performance metrics export", { metrics: performanceMonitor.exportMetrics(), context: 'performance_debug' });
  window.perfReset = () => performanceMonitor.reset();
}

export default performanceMonitor;
