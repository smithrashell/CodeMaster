/**
 * PerformanceMonitor Helpers - Observers, Summaries, and Reporting
 */

import logger from "../logging/logger.js";

/**
 * Record long task performance issue
 */
export function recordLongTask(entry, metrics) {
  const duration = entry.duration;
  metrics.alerts.push({
    type: "LONG_TASK",
    message: `Long task detected: ${duration.toFixed(2)}ms`,
    severity: duration > 1000 ? "error" : "warning",
    timestamp: Date.now(),
    data: { duration, startTime: entry.startTime, name: entry.name },
  });
}

/**
 * Record layout shift performance issue
 */
export function recordLayoutShift(entry, metrics) {
  if (entry.value > 0.1) {
    metrics.alerts.push({
      type: "LAYOUT_SHIFT",
      message: `Significant layout shift detected: ${entry.value.toFixed(3)}`,
      severity: entry.value > 0.25 ? "error" : "warning",
      timestamp: Date.now(),
      data: { value: entry.value, hadRecentInput: entry.hadRecentInput },
    });
  }
}

/**
 * Check for potential memory leaks
 */
export function checkMemoryLeaks(metrics, thresholds, lastMemoryCheck) {
  if (typeof window === 'undefined' || !performance.memory) return lastMemoryCheck;

  const currentMemory = performance.memory.usedJSHeapSize;
  const memoryGrowth = currentMemory - lastMemoryCheck;

  if (memoryGrowth > thresholds.memoryLeakThreshold) {
    metrics.alerts.push({
      type: "POTENTIAL_MEMORY_LEAK",
      message: `Significant memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`,
      severity: "warning",
      timestamp: Date.now(),
      data: { currentMemory, previousMemory: lastMemoryCheck, growth: memoryGrowth },
    });
  }

  metrics.systemMetrics.memoryUsage = currentMemory;
  return currentMemory;
}

/**
 * Sanitize props for logging (remove sensitive data)
 */
export function sanitizeProps(props) {
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
 * Estimate result size for performance tracking
 */
export function estimateResultSize(result) {
  if (Array.isArray(result)) return result.length;
  if (typeof result === "object" && result !== null) return Object.keys(result).length;
  if (typeof result === "string") return result.length;
  return 1;
}

/**
 * Get system health status
 */
export function getSystemHealth(metrics) {
  const { errorRate, criticalErrorRate = 0, averageQueryTime, averageCriticalTime = 0, renderPerformance = 0 } = metrics.systemMetrics;
  const recentAlerts = metrics.alerts.filter((a) => Date.now() - a.timestamp < 5 * 60 * 1000);

  const hasCriticalAlerts = recentAlerts.filter((a) => a.severity === "critical").length > 0;
  const highCriticalErrorRate = criticalErrorRate > 5;
  const severePerformanceDegradation = averageQueryTime > 3000 || averageCriticalTime > 4000;
  const systemOverloaded = errorRate > 15 || renderPerformance > 1000;

  if (hasCriticalAlerts || highCriticalErrorRate || severePerformanceDegradation || systemOverloaded) {
    return "critical";
  }

  const moderateErrorRate = errorRate > 3 || criticalErrorRate > 1;
  const performanceDegraded = averageQueryTime > 1000 || averageCriticalTime > 2000;
  const someAlerts = recentAlerts.filter((a) => a.severity === "error").length > 0;
  const slowRenders = renderPerformance > 200;
  const multipleWarnings = recentAlerts.length > 3;

  if (moderateErrorRate || performanceDegraded || someAlerts || slowRenders || multipleWarnings) {
    return "warning";
  }

  return "good";
}

/**
 * Get performance summary
 */
export function getPerformanceSummary(metrics, startTime) {
  const uptime = Date.now() - startTime;
  const recentQueries = metrics.queries.slice(-20);
  const recentCriticalOps = metrics.criticalOperations.slice(-10);
  const recentAlerts = metrics.alerts.slice(-10);
  const recentRenders = metrics.componentRenders.slice(-10);

  return {
    uptime: Math.round(uptime / 1000),
    systemMetrics: {
      ...metrics.systemMetrics,
      averageQueryTime: Math.round(metrics.systemMetrics.averageQueryTime * 100) / 100,
      averageCriticalTime: Math.round((metrics.systemMetrics.averageCriticalTime || 0) * 100) / 100,
      criticalErrorRate: Math.round((metrics.systemMetrics.criticalErrorRate || 0) * 100) / 100,
      errorRate: Math.round(metrics.systemMetrics.errorRate * 100) / 100,
      renderPerformance: Math.round((metrics.systemMetrics.renderPerformance || 0) * 100) / 100,
      memoryUsageMB: Math.round((metrics.systemMetrics.memoryUsage / 1024 / 1024) * 100) / 100,
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
    health: getSystemHealth(metrics),
  };
}

/**
 * Get query statistics by operation
 */
export function getQueryStatsByOperation(queries) {
  const stats = {};

  queries.forEach((query) => {
    const op = query.operation;
    if (!stats[op]) {
      stats[op] = { count: 0, totalTime: 0, averageTime: 0, successRate: 0, errors: 0 };
    }
    stats[op].count++;
    stats[op].totalTime += query.duration;
    if (!query.success) stats[op].errors++;
  });

  Object.keys(stats).forEach((op) => {
    const stat = stats[op];
    stat.averageTime = Math.round((stat.totalTime / stat.count) * 100) / 100;
    stat.successRate = Math.round(((stat.count - stat.errors) / stat.count) * 100 * 100) / 100;
  });

  return stats;
}

/**
 * Get critical operation performance summary
 */
export function getCriticalOperationSummary(criticalOperations) {
  const last24h = criticalOperations.filter((op) => Date.now() - op.timestamp < 24 * 60 * 60 * 1000);

  if (last24h.length === 0) {
    return { totalOperations: 0, averageTime: 0, successRate: 100, failures: [] };
  }

  const totalTime = last24h.reduce((sum, op) => sum + op.duration, 0);
  const failures = last24h.filter((op) => !op.success);
  const successRate = ((last24h.length - failures.length) / last24h.length) * 100;

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
 */
export function getRenderPerformanceSummary(componentRenders, componentRenderThreshold) {
  const last24h = componentRenders.filter((r) => Date.now() - r.timestamp < 24 * 60 * 60 * 1000);

  if (last24h.length === 0) {
    return { totalRenders: 0, averageTime: 0, slowRenders: 0, byComponent: {} };
  }

  const totalTime = last24h.reduce((sum, r) => sum + r.duration, 0);
  const slowRenders = last24h.filter((r) => r.duration > componentRenderThreshold);

  const byComponent = {};
  last24h.forEach((render) => {
    const comp = render.component;
    if (!byComponent[comp]) {
      byComponent[comp] = { count: 0, totalTime: 0, averageTime: 0 };
    }
    byComponent[comp].count++;
    byComponent[comp].totalTime += render.duration;
  });

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
 * Generate performance report for debugging/analysis
 */
export function generateReport(summary, criticalOps, renderPerf) {
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
${summary.recentAlerts.map((a) => `• [${a.severity.toUpperCase()}] ${a.message}`).join("\n")}
  `.trim();
}

/**
 * Check for performance alerts and return them
 */
export function checkPerformanceAlerts(queryMetric, metrics, thresholds) {
  const alerts = [];

  const threshold = queryMetric.isCritical ? thresholds.criticalOperationTime : thresholds.slowQueryTime;
  if (queryMetric.duration > threshold) {
    alerts.push({
      type: queryMetric.isCritical ? "CRITICAL_OPERATION_SLOW" : "SLOW_QUERY",
      message: `${queryMetric.isCritical ? "Critical operation" : "Query"} slow: ${queryMetric.operation} took ${queryMetric.duration.toFixed(2)}ms`,
      severity: queryMetric.isCritical ? "error" : "warning",
      timestamp: Date.now(),
      data: queryMetric,
    });
  }

  if (queryMetric.isCritical && !queryMetric.success) {
    alerts.push({
      type: "CRITICAL_OPERATION_FAILED",
      message: `Critical operation failed: ${queryMetric.operation}`,
      severity: "critical",
      timestamp: Date.now(),
      data: queryMetric,
    });
  }

  if (metrics.systemMetrics.errorRate > thresholds.errorRateThreshold) {
    alerts.push({
      type: "HIGH_ERROR_RATE",
      message: `High error rate: ${metrics.systemMetrics.errorRate.toFixed(2)}%`,
      severity: "error",
      timestamp: Date.now(),
      data: { errorRate: metrics.systemMetrics.errorRate },
    });
  }

  if (metrics.systemMetrics.criticalErrorRate > 2) {
    alerts.push({
      type: "CRITICAL_ERROR_RATE",
      message: `Critical operations error rate: ${metrics.systemMetrics.criticalErrorRate.toFixed(2)}%`,
      severity: "critical",
      timestamp: Date.now(),
      data: { criticalErrorRate: metrics.systemMetrics.criticalErrorRate },
    });
  }

  const avgTime = metrics.systemMetrics.averageQueryTime;
  const avgCriticalTime = metrics.systemMetrics.averageCriticalTime;

  if (avgTime > thresholds.slowQueryTime * 2) {
    alerts.push({
      type: "SYSTEM_PERFORMANCE_DEGRADED",
      message: `System performance degraded: Average query time ${avgTime.toFixed(2)}ms`,
      severity: "warning",
      timestamp: Date.now(),
      data: { averageQueryTime: avgTime },
    });
  }

  if (avgCriticalTime > thresholds.criticalOperationTime * 1.5) {
    alerts.push({
      type: "CRITICAL_PERFORMANCE_DEGRADED",
      message: `Critical operations performance degraded: Average time ${avgCriticalTime.toFixed(2)}ms`,
      severity: "error",
      timestamp: Date.now(),
      data: { averageCriticalTime: avgCriticalTime },
    });
  }

  return alerts;
}

/**
 * Log performance alerts
 */
export function logAlerts(alerts) {
  alerts.forEach((alert) => {
    if (alert.severity === "critical" || alert.severity === "error") {
      logger.error("Performance alert", { message: alert.message, severity: 'error', context: 'performance_monitor' });
    } else {
      logger.warn("Performance alert", { message: alert.message, severity: 'warning', context: 'performance_monitor' });
    }
  });
}

/**
 * Detect if we're running in a test environment
 */
export function isTestEnvironment() {
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.NODE_ENV === 'test' ||
        process.env.NODE_ENV === 'development' ||
        process.env.JEST_WORKER_ID ||
        process.env.ENABLE_TESTING === 'true') {
      return true;
    }
  }

  if (typeof globalThis !== 'undefined' &&
      (globalThis._testDbHelper || globalThis._testDatabaseActive)) {
    return true;
  }

  if (typeof window !== 'undefined') {
    if (window.location && window.location.search.includes('test=true')) {
      return true;
    }

    const hostname = window.location?.hostname;
    if (hostname && (hostname.includes('localhost') ||
                    hostname.includes('127.0.0.1') ||
                    hostname.includes('dev') ||
                    hostname.includes('staging') ||
                    hostname.includes('test'))) {
      return true;
    }
  }

  return false;
}

/**
 * Get default metrics structure
 */
export function getDefaultMetrics() {
  return {
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
}

/**
 * Get default thresholds based on environment
 */
export function getDefaultThresholds(isTest = false) {
  const testMultiplier = isTest ? 3 : 1;
  return {
    slowQueryTime: 1000 * testMultiplier,
    criticalOperationTime: 2000 * testMultiplier,
    highMemoryUsage: 50 * 1024 * 1024,
    memoryLeakThreshold: 10 * 1024 * 1024,
    errorRateThreshold: 5,
    maxMetricsHistory: 1000,
    componentRenderThreshold: 100 * testMultiplier,
    slowRenderThreshold: 500 * testMultiplier,
  };
}

/**
 * Get default critical operations set
 */
export function getDefaultCriticalOperations() {
  return new Set([
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
}
