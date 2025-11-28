/**
 * Integrity Metrics and Dashboard Functions
 * Extracted from DataIntegrityCheckService
 */

import SchemaValidator from "../../utils/dataIntegrity/SchemaValidator.js";
import ReferentialIntegrityService from "./ReferentialIntegrityService.js";

/**
 * Get integrity check history
 */
export function getCheckHistory(checkHistory, limit = 10) {
  return checkHistory
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
}

/**
 * Get data integrity dashboard summary
 */
export function getIntegrityDashboardSummary(service) {
  const recentCheck =
    service.checkHistory.length > 0
      ? service.checkHistory[service.checkHistory.length - 1]
      : null;

  const summary = {
    lastCheck: recentCheck?.timestamp || null,
    overallScore: recentCheck?.overall.score || null,
    status: getHealthStatus(recentCheck?.overall.score),
    activeMonitoring: service.monitoringIntervals.size > 0,
    recentIssues: recentCheck?.overall.errors || 0,
    totalChecks: service.checkHistory.length,
    trends: calculateTrends(service.checkHistory),
    quickStats: {
      averageScore: calculateAverageScore(service.checkHistory),
      checksToday: getChecksToday(service.checkHistory),
      lastFullCheck: getLastFullCheck(service.checkHistory, service.CHECK_TYPES),
    },
  };

  return summary;
}

/**
 * Get detailed integrity metrics for monitoring
 */
export function getDetailedMetrics(service) {
  return {
    monitoring: {
      active: service.monitoringIntervals.size > 0,
      intervals: Array.from(service.monitoringIntervals.keys()),
      lastChecks: Object.fromEntries(service.lastCheck),
      historySize: service.checkHistory.length,
    },
    performance: SchemaValidator.getValidationSummary(),
    referentialCache: ReferentialIntegrityService.getCacheStats(),
    history: {
      totalChecks: service.checkHistory.length,
      recentChecks: service.checkHistory.slice(-5),
      averageScore: calculateAverageScore(service.checkHistory),
      trends: calculateTrends(service.checkHistory),
    },
  };
}

/**
 * Get health status from score
 */
export function getHealthStatus(score) {
  if (score === null) return "unknown";
  if (score >= 95) return "excellent";
  if (score >= 85) return "good";
  if (score >= 70) return "warning";
  return "critical";
}

/**
 * Calculate trends from check history
 */
export function calculateTrends(checkHistory) {
  if (checkHistory.length < 2) return { trend: "insufficient_data" };

  const recent = checkHistory.slice(-5);
  const older = checkHistory.slice(-10, -5);

  if (older.length === 0) return { trend: "insufficient_data" };

  const recentAvg =
    recent.reduce((sum, check) => sum + check.overall.score, 0) /
    recent.length;
  const olderAvg =
    older.reduce((sum, check) => sum + check.overall.score, 0) / older.length;

  const difference = recentAvg - olderAvg;

  if (Math.abs(difference) < 2) return { trend: "stable", difference: 0 };
  return difference > 0
    ? { trend: "improving", difference: Math.round(difference) }
    : { trend: "declining", difference: Math.round(difference) };
}

/**
 * Calculate average score from check history
 */
export function calculateAverageScore(checkHistory) {
  if (checkHistory.length === 0) return null;
  const sum = checkHistory.reduce(
    (sum, check) => sum + check.overall.score,
    0
  );
  return Math.round(sum / checkHistory.length);
}

/**
 * Get number of checks today
 */
export function getChecksToday(checkHistory) {
  const today = new Date().toDateString();
  return checkHistory.filter(
    (check) => new Date(check.timestamp).toDateString() === today
  ).length;
}

/**
 * Get last full check timestamp
 */
export function getLastFullCheck(checkHistory, CHECK_TYPES) {
  const fullCheck = checkHistory
    .filter((check) => check.checkType === CHECK_TYPES.FULL)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

  return fullCheck?.timestamp || null;
}

/**
 * Calculate overall integrity score
 */
export function calculateOverallScore(report) {
  let score = 100;
  let factors = 0;

  if (report.results.schema) {
    const schemaScore =
      report.results.schema.totalRecords > 0
        ? (report.results.schema.validRecords /
            report.results.schema.totalRecords) *
          100
        : 100;
    score += schemaScore;
    factors++;
  }

  if (report.results.referential) {
    score += report.results.referential.integrityScore || 50;
    factors++;
  }

  if (report.results.businessLogic) {
    const businessScore = Math.max(
      0,
      100 -
        report.results.businessLogic.errorCount * 10 -
        report.results.businessLogic.warningCount * 5
    );
    score += businessScore;
    factors++;
  }

  if (report.results.storageHealth) {
    let healthScore = 100;
    if (report.results.storageHealth.overall === "critical") healthScore = 20;
    else if (report.results.storageHealth.overall === "warning")
      healthScore = 60;
    else if (report.results.storageHealth.overall === "good")
      healthScore = 90;
    score += healthScore;
    factors++;
  }

  return factors > 0 ? Math.round(score / factors) : 0;
}

/**
 * Generate actionable recommendations based on check results
 */
export function generateRecommendations(report) {
  const recommendations = [];

  if (report.results.schema && !report.results.schema.valid) {
    recommendations.push({
      type: "schema_issues",
      priority: "high",
      title: "Fix Schema Validation Issues",
      description: `Found ${report.results.schema.errorCount} schema validation errors across your data`,
      action: "Review and fix invalid data records",
      automated: false,
      estimatedTime: "30 minutes",
    });
  }

  if (
    report.results.referential &&
    !report.results.referential.overall.valid
  ) {
    const violations = report.results.referential.overall.violationCount;
    recommendations.push({
      type: "referential_issues",
      priority: violations > 10 ? "high" : "medium",
      title: "Resolve Referential Integrity Violations",
      description: `Found ${violations} referential integrity violations`,
      action: "Run automated repair or manual review",
      automated: true,
      estimatedTime: violations > 10 ? "1 hour" : "15 minutes",
    });
  }

  if (report.performanceMetrics.totalTime > 10000) {
    recommendations.push({
      type: "performance",
      priority: "medium",
      title: "Optimize Data Integrity Check Performance",
      description: "Integrity checks are taking longer than expected",
      action: "Consider database optimization or reducing check frequency",
      automated: false,
      estimatedTime: "1 hour",
    });
  }

  if (
    report.results.storageHealth &&
    ["warning", "critical"].includes(report.results.storageHealth.overall)
  ) {
    recommendations.push({
      type: "storage_health",
      priority:
        report.results.storageHealth.overall === "critical"
          ? "high"
          : "medium",
      title: "Address Storage Health Issues",
      description: `Storage system health is ${report.results.storageHealth.overall}`,
      action: "Review storage health recommendations",
      automated: false,
      estimatedTime: "20 minutes",
    });
  }

  const priorityOrder = { high: 3, medium: 2, low: 1 };
  recommendations.sort(
    (a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]
  );

  return recommendations;
}

/**
 * Add check result to history
 */
export function addToHistory(checkHistory, report, maxHistorySize) {
  const summary = {
    checkId: report.checkId,
    timestamp: report.timestamp,
    checkType: report.checkType,
    overall: { ...report.overall },
    performanceMetrics: {
      totalTime: report.performanceMetrics.totalTime,
    },
  };

  checkHistory.push(summary);

  if (checkHistory.length > maxHistorySize) {
    checkHistory.splice(0, checkHistory.length - maxHistorySize);
  }
}
