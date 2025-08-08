/**
 * PerformanceMonitor - Utility for tracking strategy system performance
 * 
 * Features:
 * - Query time measurement
 * - Memory usage tracking
 * - Performance alerts and thresholds
 * - Development dashboard integration
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      queries: [],
      alerts: [],
      systemMetrics: {
        totalQueries: 0,
        averageQueryTime: 0,
        slowQueries: 0,
        errorRate: 0,
        memoryUsage: 0
      }
    };
    
    this.thresholds = {
      slowQueryTime: 1000, // 1 second
      highMemoryUsage: 50 * 1024 * 1024, // 50MB
      errorRateThreshold: 5, // 5%
      maxMetricsHistory: 1000
    };

    this.startTime = Date.now();
    // eslint-disable-next-line no-console
    console.log('📊 PerformanceMonitor initialized');
  }

  /**
   * Start timing a query operation
   * @param {string} operation - Operation name
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Query context for ending measurement
   */
  startQuery(operation, metadata = {}) {
    const queryId = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = performance.now();
    
    const queryContext = {
      id: queryId,
      operation,
      startTime,
      metadata
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
      error: error ? error.message : null
    };

    // Add to metrics history
    this.metrics.queries.push(queryMetric);
    
    // Trim history if too large
    if (this.metrics.queries.length > this.thresholds.maxMetricsHistory) {
      this.metrics.queries = this.metrics.queries.slice(-this.thresholds.maxMetricsHistory);
    }

    // Update system metrics
    this.updateSystemMetrics();
    
    // Check for performance alerts
    this.checkPerformanceAlerts(queryMetric);

    // Log performance info
    const level = duration > this.thresholds.slowQueryTime ? 'warn' : 'log';
    // eslint-disable-next-line no-console
    console[level](`⏱️ ${queryContext.operation}: ${duration.toFixed(2)}ms ${success ? '✅' : '❌'}`);

    return queryMetric;
  }

  /**
   * Update system-wide metrics
   */
  updateSystemMetrics() {
    const queries = this.metrics.queries;
    const recentQueries = queries.slice(-100); // Last 100 queries
    
    this.metrics.systemMetrics.totalQueries = queries.length;
    
    if (queries.length > 0) {
      // Calculate average query time
      const totalTime = queries.reduce((sum, q) => sum + q.duration, 0);
      this.metrics.systemMetrics.averageQueryTime = totalTime / queries.length;
      
      // Count slow queries
      this.metrics.systemMetrics.slowQueries = queries.filter(
        q => q.duration > this.thresholds.slowQueryTime
      ).length;
      
      // Calculate error rate (last 100 queries)
      const errors = recentQueries.filter(q => !q.success).length;
      this.metrics.systemMetrics.errorRate = (errors / recentQueries.length) * 100;
    }
  }

  /**
   * Check for performance alerts and add them to alert queue
   * @param {Object} queryMetric - Query metric to check
   */
  checkPerformanceAlerts(queryMetric) {
    const alerts = [];

    // Slow query alert
    if (queryMetric.duration > this.thresholds.slowQueryTime) {
      alerts.push({
        type: 'SLOW_QUERY',
        message: `Slow query detected: ${queryMetric.operation} took ${queryMetric.duration.toFixed(2)}ms`,
        severity: 'warning',
        timestamp: Date.now(),
        data: queryMetric
      });
    }

    // High error rate alert
    if (this.metrics.systemMetrics.errorRate > this.thresholds.errorRateThreshold) {
      alerts.push({
        type: 'HIGH_ERROR_RATE',
        message: `High error rate: ${this.metrics.systemMetrics.errorRate.toFixed(2)}%`,
        severity: 'error',
        timestamp: Date.now(),
        data: { errorRate: this.metrics.systemMetrics.errorRate }
      });
    }

    // Add alerts to queue
    this.metrics.alerts.push(...alerts);
    
    // Trim alert history
    if (this.metrics.alerts.length > 100) {
      this.metrics.alerts = this.metrics.alerts.slice(-100);
    }

    // Log critical alerts
    alerts.forEach(alert => {
      if (alert.severity === 'error') {
        console.error(`🚨 ${alert.message}`);
      } else {
        console.warn(`⚠️ ${alert.message}`);
      }
    });
  }

  /**
   * Record memory usage
   * @param {number} memoryUsage - Memory usage in bytes
   * @param {string} source - Source of memory usage (e.g., 'cache', 'components')
   */
  recordMemoryUsage(memoryUsage, source = 'unknown') {
    this.metrics.systemMetrics.memoryUsage = memoryUsage;
    
    if (memoryUsage > this.thresholds.highMemoryUsage) {
      this.metrics.alerts.push({
        type: 'HIGH_MEMORY_USAGE',
        message: `High memory usage: ${(memoryUsage / 1024 / 1024).toFixed(2)}MB from ${source}`,
        severity: 'warning',
        timestamp: Date.now(),
        data: { memoryUsage, source }
      });
      
      console.warn(`⚠️ High memory usage: ${(memoryUsage / 1024 / 1024).toFixed(2)}MB from ${source}`);
    }
  }

  /**
   * Get performance summary
   * @returns {Object} Performance metrics summary
   */
  getPerformanceSummary() {
    const uptime = Date.now() - this.startTime;
    const recentQueries = this.metrics.queries.slice(-20);
    const recentAlerts = this.metrics.alerts.slice(-10);

    return {
      uptime: Math.round(uptime / 1000), // seconds
      systemMetrics: {
        ...this.metrics.systemMetrics,
        averageQueryTime: Math.round(this.metrics.systemMetrics.averageQueryTime * 100) / 100,
        errorRate: Math.round(this.metrics.systemMetrics.errorRate * 100) / 100,
        memoryUsageMB: Math.round(this.metrics.systemMetrics.memoryUsage / 1024 / 1024 * 100) / 100
      },
      recentQueries: recentQueries.map(q => ({
        operation: q.operation,
        duration: Math.round(q.duration * 100) / 100,
        success: q.success,
        timestamp: new Date(q.timestamp).toLocaleTimeString()
      })),
      recentAlerts: recentAlerts.map(a => ({
        type: a.type,
        message: a.message,
        severity: a.severity,
        timestamp: new Date(a.timestamp).toLocaleTimeString()
      })),
      health: this.getSystemHealth()
    };
  }

  /**
   * Get system health status
   * @returns {string} Health status: 'good', 'warning', 'critical'
   */
  getSystemHealth() {
    const errorRate = this.metrics.systemMetrics.errorRate;
    const avgQueryTime = this.metrics.systemMetrics.averageQueryTime;
    const recentAlerts = this.metrics.alerts.filter(a => Date.now() - a.timestamp < 5 * 60 * 1000); // Last 5 minutes

    if (errorRate > 10 || avgQueryTime > 2000 || recentAlerts.filter(a => a.severity === 'error').length > 0) {
      return 'critical';
    } else if (errorRate > 2 || avgQueryTime > 1000 || recentAlerts.length > 3) {
      return 'warning';
    }
    return 'good';
  }

  /**
   * Get query statistics by operation
   * @returns {Object} Statistics grouped by operation
   */
  getQueryStatsByOperation() {
    const stats = {};
    
    this.metrics.queries.forEach(query => {
      const op = query.operation;
      if (!stats[op]) {
        stats[op] = {
          count: 0,
          totalTime: 0,
          averageTime: 0,
          successRate: 0,
          errors: 0
        };
      }
      
      stats[op].count++;
      stats[op].totalTime += query.duration;
      if (!query.success) stats[op].errors++;
    });

    // Calculate derived metrics
    Object.keys(stats).forEach(op => {
      const stat = stats[op];
      stat.averageTime = Math.round(stat.totalTime / stat.count * 100) / 100;
      stat.successRate = Math.round((stat.count - stat.errors) / stat.count * 100 * 100) / 100;
    });

    return stats;
  }

  /**
   * Clear all metrics and alerts
   */
  reset() {
    this.metrics = {
      queries: [],
      alerts: [],
      systemMetrics: {
        totalQueries: 0,
        averageQueryTime: 0,
        slowQueries: 0,
        errorRate: 0,
        memoryUsage: 0
      }
    };
    this.startTime = Date.now();
    // eslint-disable-next-line no-console
    console.log('📊 Performance metrics reset');
  }

  /**
   * Export metrics for debugging
   * @returns {Object} Full metrics data
   */
  exportMetrics() {
    return {
      ...this.metrics,
      uptime: Date.now() - this.startTime,
      exportTime: new Date().toISOString()
    };
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

// Add global access for debugging
if (typeof window !== 'undefined') {
  window.performanceMonitor = performanceMonitor;
}

export default performanceMonitor;