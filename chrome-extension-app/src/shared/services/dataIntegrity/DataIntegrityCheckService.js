/**
 * Data Integrity Check Service for CodeMaster
 *
 * Main orchestrator service that coordinates schema validation, referential integrity checking,
 * corruption detection, and periodic data health monitoring.
 */

import SchemaValidator from "../../utils/dataIntegrity/SchemaValidator.js";
import DataIntegritySchemas from "../../utils/dataIntegrity/DataIntegritySchemas.js";
// eslint-disable-next-line no-restricted-imports
import { dbHelper } from "../../db/index.js";
import ErrorReportService from "../ErrorReportService.js";
import logger from "../../utils/logger.js";
import {
  executeSchemaValidation,
  executeReferentialCheck,
  executeBusinessLogicCheck,
  executeStorageHealthCheck,
  initializeCheckReport,
  finalizeCheckReport,
  handlePostCheckOperations,
} from "./integrityCheckHelpers.js";
import {
  shouldPerformSchemaValidation,
  shouldPerformReferentialCheck,
  shouldPerformBusinessLogicCheck,
  validateAndNormalizeOptions,
  createCheckExecutionContext,
} from "./integrityCheckValidators.js";
import {
  performBusinessLogicValidation,
  getAllStoreData,
} from "./businessLogicValidation.js";
import {
  startPeriodicMonitoring,
  stopPeriodicMonitoring,
  getMonitoringStatus,
  notifyIntegrityIssues,
} from "./integrityMonitoring.js";
import {
  getCheckHistory,
  getIntegrityDashboardSummary,
  getDetailedMetrics,
  getHealthStatus,
  calculateTrends,
  calculateAverageScore,
  getChecksToday,
  getLastFullCheck,
  calculateOverallScore,
  generateRecommendations,
  addToHistory,
} from "./integrityMetrics.js";

export class DataIntegrityCheckService {
  static CHECK_TYPES = {
    SCHEMA: "schema",
    REFERENTIAL: "referential",
    BUSINESS_LOGIC: "business_logic",
    FULL: "full",
    QUICK: "quick",
  };

  static PRIORITIES = {
    CRITICAL: "critical",
    HIGH: "high",
    MEDIUM: "medium",
    LOW: "low",
  };

  static INTERVALS = {
    REAL_TIME: 30 * 1000,
    FREQUENT: 5 * 60 * 1000,
    REGULAR: 30 * 60 * 1000,
    DAILY: 24 * 60 * 60 * 1000,
  };

  static monitoringIntervals = new Map();
  static lastCheck = new Map();
  static checkHistory = [];
  static maxHistorySize = 100;

  static async performIntegrityCheck(options = {}) {
    const normalizedOptions = validateAndNormalizeOptions(options, {
      CHECK_TYPES: this.CHECK_TYPES,
      PRIORITIES: this.PRIORITIES,
      getStoreNames: DataIntegritySchemas.getStoreNames,
    });

    const { checkType, stores } = normalizedOptions;

    logger.info(`Starting ${checkType} data integrity check for ${stores.length} stores...`);
    const checkStartTime = performance.now();
    const report = initializeCheckReport(normalizedOptions);

    try {
      const executionContext = createCheckExecutionContext(this, normalizedOptions);

      if (shouldPerformSchemaValidation(checkType, this.CHECK_TYPES)) {
        await executeSchemaValidation(stores, executionContext, report);
      }

      if (shouldPerformReferentialCheck(checkType, this.CHECK_TYPES)) {
        await executeReferentialCheck(stores, executionContext, report);
      }

      if (shouldPerformBusinessLogicCheck(checkType, this.CHECK_TYPES)) {
        await executeBusinessLogicCheck(stores, executionContext, report);
      }

      await executeStorageHealthCheck(executionContext, report);
      finalizeCheckReport(report, executionContext);

      const checkEndTime = performance.now();
      report.performanceMetrics.totalTime = checkEndTime - checkStartTime;

      await handlePostCheckOperations(report, executionContext);
      return report;
    } catch (error) {
      logger.error("Data integrity check failed:", error);
      report.overall.valid = false;
      report.error = {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      };

      await this.reportIntegrityError("integrity_check", error, { checkType, stores, options });
      return report;
    }
  }

  static async performSchemaValidation(stores, options = {}) {
    const { priority = this.PRIORITIES.MEDIUM, quick = false } = options;

    const result = {
      valid: true,
      stores: {},
      errorCount: 0,
      warningCount: 0,
      totalRecords: 0,
      validRecords: 0,
      performanceMetrics: {
        totalTime: 0,
        avgRecordTime: 0,
        storeBreakdown: {},
      },
    };

    const db = await dbHelper.openDB();

    for (const storeName of stores) {
      if (!db.objectStoreNames.contains(storeName)) {
        logger.warn(`Schema validation: Store '${storeName}' does not exist`);
        continue;
      }

      const storeStartTime = performance.now();
      logger.info(`Validating schema for store: ${storeName}`);

      try {
        const storeData = await getAllStoreData(db, storeName);
        result.totalRecords += storeData.length;

        const storeResult = {
          valid: true,
          recordCount: storeData.length,
          errors: [],
          warnings: [],
          sampleSize: quick ? Math.min(10, storeData.length) : storeData.length,
          performanceMetrics: { validationTime: 0, avgRecordTime: 0 },
        };

        const recordsToValidate = quick
          ? this.getSampleRecords(storeData, 10)
          : storeData;

        if (recordsToValidate.length > 0) {
          const batchResult = SchemaValidator.validateBatch(storeName, recordsToValidate, {
            strict: priority === this.PRIORITIES.CRITICAL,
            stopOnFirstError: false,
            maxErrors: quick ? 5 : 50,
            reportProgress: !quick && recordsToValidate.length > 100,
          });

          storeResult.valid = batchResult.valid;
          storeResult.performanceMetrics.validationTime = batchResult.totalTime;
          storeResult.performanceMetrics.avgRecordTime = batchResult.avgItemTime;

          this._collectValidationErrors(batchResult.results, result, storeResult);

          result.validRecords += batchResult.validItems;
          result.errorCount += storeResult.errors.length;
          result.warningCount += storeResult.warnings.length;
        }

        result.stores[storeName] = storeResult;

        const storeEndTime = performance.now();
        result.performanceMetrics.storeBreakdown[storeName] = storeEndTime - storeStartTime;

        logger.info(`${storeName}: ${storeResult.recordCount} records, ${storeResult.errors.length} errors, ${storeResult.warnings.length} warnings`);
      } catch (error) {
        logger.error(`Schema validation failed for store ${storeName}:`, error);
        result.valid = false;
        result.stores[storeName] = {
          valid: false,
          error: { message: error.message, stack: error.stack },
        };
      }
    }

    result.performanceMetrics.totalTime = Object.values(
      result.performanceMetrics.storeBreakdown
    ).reduce((sum, time) => sum + time, 0);
    result.performanceMetrics.avgRecordTime =
      result.totalRecords > 0
        ? result.performanceMetrics.totalTime / result.totalRecords
        : 0;

    return result;
  }

  static performBusinessLogicValidation(stores, options = {}) {
    return performBusinessLogicValidation(stores, {
      ...options,
      PRIORITIES: this.PRIORITIES,
    }, this);
  }

  static calculateOverallScore(report) {
    return calculateOverallScore(report);
  }

  static generateRecommendations(report) {
    return generateRecommendations(report);
  }

  static startPeriodicMonitoring(config = {}) {
    startPeriodicMonitoring(this, config);
  }

  static stopPeriodicMonitoring() {
    stopPeriodicMonitoring(this);
  }

  static getMonitoringStatus() {
    return getMonitoringStatus(this);
  }

  static getCheckHistory(limit = 10) {
    return getCheckHistory(this.checkHistory, limit);
  }

  static getIntegrityDashboardSummary() {
    return getIntegrityDashboardSummary(this);
  }

  static getAllStoreData(db, storeName) {
    return getAllStoreData(db, storeName);
  }

  static getSampleRecords(records, sampleSize) {
    if (records.length <= sampleSize) return records;

    const step = Math.floor(records.length / sampleSize);
    const sample = [];
    for (let i = 0; i < records.length && sample.length < sampleSize; i += step) {
      sample.push(records[i]);
    }
    return sample;
  }

  static generateCheckId() {
    return `check_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static addToHistory(report) {
    addToHistory(this.checkHistory, report, this.maxHistorySize);
  }

  static async reportCriticalIssues(report) {
    try {
      await ErrorReportService.storeErrorReport({
        errorId: `critical_integrity_${report.checkId}`,
        message: `Critical data integrity issues detected: ${report.overall.errors} errors, score: ${report.overall.score}%`,
        stack: JSON.stringify(report.recommendations, null, 2),
        section: "Data Integrity",
        errorType: "integrity_critical",
        severity: "high",
        userContext: {
          checkId: report.checkId,
          checkType: report.checkType,
          overallScore: report.overall.score,
          errorCount: report.overall.errors,
          warningCount: report.overall.warnings,
        },
      });
    } catch (error) {
      logger.warn("Failed to report critical integrity issues:", error);
    }
  }

  static notifyIntegrityIssues(checkType, result) {
    notifyIntegrityIssues(checkType, result);
  }

  static async reportIntegrityError(operation, error, context) {
    try {
      await ErrorReportService.storeErrorReport({
        errorId: `integrity_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        message: `Data integrity ${operation} failed: ${error.message}`,
        stack: error.stack,
        section: "Data Integrity",
        errorType: "integrity_system",
        severity: "high",
        userContext: context,
      });
    } catch (reportError) {
      logger.warn("Failed to report integrity system error:", reportError);
    }
  }

  static getHealthStatus(score) {
    return getHealthStatus(score);
  }

  static calculateTrends() {
    return calculateTrends(this.checkHistory);
  }

  static calculateAverageScore() {
    return calculateAverageScore(this.checkHistory);
  }

  static getChecksToday() {
    return getChecksToday(this.checkHistory);
  }

  static getLastFullCheck() {
    return getLastFullCheck(this.checkHistory, this.CHECK_TYPES);
  }

  static getNextScheduledCheck() {
    const lastQuick = this.lastCheck.get(this.CHECK_TYPES.QUICK) || 0;
    const lastFull = this.lastCheck.get(this.CHECK_TYPES.FULL) || 0;

    return {
      nextQuick: new Date(lastQuick + this.INTERVALS.FREQUENT).toISOString(),
      nextFull: new Date(lastFull + this.INTERVALS.DAILY).toISOString(),
    };
  }

  static async triggerManualCheck(checkType = this.CHECK_TYPES.FULL, options = {}) {
    logger.info(`Manual integrity check triggered: ${checkType}`);
    return await this.performIntegrityCheck({
      checkType,
      priority: this.PRIORITIES.HIGH,
      saveToHistory: true,
      generateReport: true,
      ...options,
    });
  }

  static getDetailedMetrics() {
    return getDetailedMetrics(this);
  }

  static _collectValidationErrors(batchResults, result, storeResult) {
    for (const itemResult of batchResults) {
      if (!itemResult.valid) {
        result.valid = false;
        storeResult.errors.push(...itemResult.errors);
        storeResult.warnings.push(...itemResult.warnings);
      }
    }
  }

  static _checkAttemptStatsMismatch(result, problem, storedStats, actualStats) {
    const { total_attempts, successful_attempts } = storedStats;
    const { actualTotal, actualSuccessful } = actualStats;

    if (total_attempts !== actualTotal || successful_attempts !== actualSuccessful) {
      result.valid = false;
      result.errorCount++;
      result.checks.push({
        type: "cross_store_inconsistency",
        severity: "error",
        message: `Problem ${problem.leetcode_id} attempt stats mismatch`,
        details: {
          stored: { total_attempts, successful_attempts },
          calculated: { total_attempts: actualTotal, successful_attempts: actualSuccessful },
        },
      });
    }
  }

  static _checkMissingAttemptReference(result, session, sessionAttempt, attemptExists) {
    if (!attemptExists) {
      result.valid = false;
      result.warningCount++;
      result.checks.push({
        type: "missing_attempt_reference",
        severity: "warning",
        message: `Session ${session.id} references non-existent attempt ${sessionAttempt.attemptId}`,
        details: { sessionId: session.id, attemptId: sessionAttempt.attemptId },
      });
    }
  }
}

export default DataIntegrityCheckService;
