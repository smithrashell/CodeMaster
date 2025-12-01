/**
 * Helper functions for data integrity checking operations
 * Extracted from performIntegrityCheck to reduce complexity
 */

import ReferentialIntegrityService from "./ReferentialIntegrityService.js";
import StorageHealthMonitor from "../../utils/storage/storageHealth.js";
import logger from "../../utils/logging/logger.js";

/**
 * Execute schema validation check
 */
export async function executeSchemaValidation(stores, options, report) {
  const { priority, checkType, CHECK_TYPES } = options;
  
  const schemaStartTime = performance.now();
  logger.info("📋 Running schema validation...");

  const performSchemaValidation = options.performSchemaValidation;
  report.results.schema = await performSchemaValidation(stores, {
    priority,
    quick: checkType === CHECK_TYPES.QUICK,
  });

  if (!report.results.schema.valid) {
    report.overall.valid = false;
    report.overall.errors += report.results.schema.errorCount;
    report.overall.warnings += report.results.schema.warningCount;
  }

  const schemaEndTime = performance.now();
  report.performanceMetrics.checkBreakdown.schema = schemaEndTime - schemaStartTime;
}

/**
 * Execute referential integrity check
 */
export async function executeReferentialCheck(stores, options, report) {
  const { checkType, priority, CHECK_TYPES, PRIORITIES } = options;
  
  const refStartTime = performance.now();
  logger.info("🔗 Running referential integrity check...");

  report.results.referential = await ReferentialIntegrityService.checkAllReferentialIntegrity({
    stores,
    includeOrphans: true,
    includeMissing: true,
    deepCheck: checkType === CHECK_TYPES.FULL,
    useCache: priority !== PRIORITIES.CRITICAL,
  });

  if (!report.results.referential.overall.valid) {
    report.overall.valid = false;
    report.overall.errors += report.results.referential.overall.violationCount;
  }

  const refEndTime = performance.now();
  report.performanceMetrics.checkBreakdown.referential = refEndTime - refStartTime;
}

/**
 * Execute business logic validation check
 */
export async function executeBusinessLogicCheck(stores, options, report) {
  const { priority } = options;
  
  const businessStartTime = performance.now();
  logger.info("🧠 Running business logic validation...");

  const performBusinessLogicValidation = options.performBusinessLogicValidation;
  report.results.businessLogic = await performBusinessLogicValidation(stores, { priority });

  if (!report.results.businessLogic.valid) {
    report.overall.valid = false;
    report.overall.errors += report.results.businessLogic.errorCount;
    report.overall.warnings += report.results.businessLogic.warningCount;
  }

  const businessEndTime = performance.now();
  report.performanceMetrics.checkBreakdown.businessLogic = businessEndTime - businessStartTime;
}

/**
 * Execute storage health check
 */
export async function executeStorageHealthCheck(options, report) {
  const { includePerformanceMetrics, checkType, CHECK_TYPES } = options;
  
  if (!includePerformanceMetrics || checkType === CHECK_TYPES.QUICK) {
    return;
  }

  const healthStartTime = performance.now();
  logger.info("💾 Running storage health check...");

  report.results.storageHealth = await StorageHealthMonitor.assessStorageHealth();

  const healthEndTime = performance.now();
  report.performanceMetrics.checkBreakdown.storageHealth = healthEndTime - healthStartTime;
}

/**
 * Initialize integrity check report structure
 */
export function initializeCheckReport(options) {
  const { checkType, priority } = options;
  
  return {
    checkId: generateCheckId(),
    timestamp: new Date().toISOString(),
    checkType,
    priority,
    overall: {
      valid: true,
      score: 0,
      issues: 0,
      warnings: 0,
      errors: 0,
    },
    results: {
      schema: null,
      referential: null,
      businessLogic: null,
      storageHealth: null,
    },
    stores: {},
    recommendations: [],
    performanceMetrics: {
      totalTime: 0,
      checkBreakdown: {},
    },
  };
}

/**
 * Finalize check report with scores and recommendations
 */
export function finalizeCheckReport(report, options) {
  const { calculateOverallScore, generateRecommendations } = options;
  
  report.overall.score = calculateOverallScore(report);
  report.recommendations = generateRecommendations(report);
  
  return report;
}

/**
 * Handle post-check operations
 */
export async function handlePostCheckOperations(report, options) {
  const { saveToHistory, addToHistory, lastCheck, checkType, reportCriticalIssues } = options;
  
  // Save to history
  if (saveToHistory) {
    addToHistory(report);
  }

  // Update last check timestamp
  lastCheck.set(checkType, Date.now());

  logger.info(
    `✅ Data integrity check completed in ${report.performanceMetrics.totalTime.toFixed(2)}ms`
  );
  logger.info(
    `📊 Overall Score: ${report.overall.score}% (${report.overall.errors} errors, ${report.overall.warnings} warnings)`
  );

  // Report critical issues immediately
  if (report.overall.errors > 0 || report.overall.score < 70) {
    await reportCriticalIssues(report);
  }
}

/**
 * Generate unique check ID
 */
function generateCheckId() {
  return `check_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}