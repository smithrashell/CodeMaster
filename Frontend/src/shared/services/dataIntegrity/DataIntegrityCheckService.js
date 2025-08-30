/**
 * Data Integrity Check Service for CodeMaster
 *
 * Main orchestrator service that coordinates schema validation, referential integrity checking,
 * corruption detection, and periodic data health monitoring.
 */

import SchemaValidator from "../../utils/dataIntegrity/SchemaValidator.js";
import ReferentialIntegrityService from "./ReferentialIntegrityService.js";
import DataIntegritySchemas from "../../utils/dataIntegrity/DataIntegritySchemas.js";
import { dbHelper } from "../../db/index.js";
import StorageHealthMonitor from "../../utils/storageHealth.js";
import ErrorReportService from "../ErrorReportService.js";
import logger from "../../utils/logger.js";

export class DataIntegrityCheckService {
  // Check types
  static CHECK_TYPES = {
    SCHEMA: "schema",
    REFERENTIAL: "referential",
    BUSINESS_LOGIC: "business_logic",
    FULL: "full",
    QUICK: "quick",
  };

  // Check priorities
  static PRIORITIES = {
    CRITICAL: "critical",
    HIGH: "high",
    MEDIUM: "medium",
    LOW: "low",
  };

  // Monitoring intervals
  static INTERVALS = {
    REAL_TIME: 30 * 1000, // 30 seconds
    FREQUENT: 5 * 60 * 1000, // 5 minutes
    REGULAR: 30 * 60 * 1000, // 30 minutes
    DAILY: 24 * 60 * 60 * 1000, // 24 hours
  };

  static monitoringIntervals = new Map();
  static lastCheck = new Map();
  static checkHistory = [];
  static maxHistorySize = 100;

  /**
   * Perform comprehensive data integrity check
   * @param {Object} options - Check configuration options
   * @returns {Promise<Object>} - Comprehensive integrity report
   */
  static async performIntegrityCheck(options = {}) {
    const {
      checkType = this.CHECK_TYPES.FULL,
      stores = DataIntegritySchemas.getStoreNames(),
      includePerformanceMetrics = true,
      priority = this.PRIORITIES.MEDIUM,
      saveToHistory = true,
      _generateReport = true,
    } = options;

    logger.info(
      `🔍 Starting ${checkType} data integrity check for ${stores.length} stores...`
    );
    const checkStartTime = performance.now();

    const report = {
      checkId: this.generateCheckId(),
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

    try {
      // Schema validation
      if (
        [
          this.CHECK_TYPES.FULL,
          this.CHECK_TYPES.SCHEMA,
          this.CHECK_TYPES.QUICK,
        ].includes(checkType)
      ) {
        const schemaStartTime = performance.now();
        logger.info("📋 Running schema validation...");

        report.results.schema = await this.performSchemaValidation(stores, {
          priority,
          quick: checkType === this.CHECK_TYPES.QUICK,
        });

        if (!report.results.schema.valid) {
          report.overall.valid = false;
          report.overall.errors += report.results.schema.errorCount;
          report.overall.warnings += report.results.schema.warningCount;
        }

        const schemaEndTime = performance.now();
        report.performanceMetrics.checkBreakdown.schema =
          schemaEndTime - schemaStartTime;
      }

      // Referential integrity checking
      if (
        [this.CHECK_TYPES.FULL, this.CHECK_TYPES.REFERENTIAL].includes(
          checkType
        )
      ) {
        const refStartTime = performance.now();
        logger.info("🔗 Running referential integrity check...");

        report.results.referential =
          await ReferentialIntegrityService.checkAllReferentialIntegrity({
            stores,
            includeOrphans: true,
            includeMissing: true,
            deepCheck: checkType === this.CHECK_TYPES.FULL,
            useCache: priority !== this.PRIORITIES.CRITICAL,
          });

        if (!report.results.referential.overall.valid) {
          report.overall.valid = false;
          report.overall.errors +=
            report.results.referential.overall.violationCount;
        }

        const refEndTime = performance.now();
        report.performanceMetrics.checkBreakdown.referential =
          refEndTime - refStartTime;
      }

      // Business logic validation
      if (
        [this.CHECK_TYPES.FULL, this.CHECK_TYPES.BUSINESS_LOGIC].includes(
          checkType
        )
      ) {
        const businessStartTime = performance.now();
        logger.info("🧠 Running business logic validation...");

        report.results.businessLogic =
          await this.performBusinessLogicValidation(stores, { priority });

        if (!report.results.businessLogic.valid) {
          report.overall.valid = false;
          report.overall.errors += report.results.businessLogic.errorCount;
          report.overall.warnings += report.results.businessLogic.warningCount;
        }

        const businessEndTime = performance.now();
        report.performanceMetrics.checkBreakdown.businessLogic =
          businessEndTime - businessStartTime;
      }

      // Storage health check
      if (includePerformanceMetrics && checkType !== this.CHECK_TYPES.QUICK) {
        const healthStartTime = performance.now();
        logger.info("💾 Running storage health check...");

        report.results.storageHealth =
          await StorageHealthMonitor.assessStorageHealth();

        const healthEndTime = performance.now();
        report.performanceMetrics.checkBreakdown.storageHealth =
          healthEndTime - healthStartTime;
      }

      // Calculate overall score and generate recommendations
      report.overall.score = this.calculateOverallScore(report);
      report.recommendations = this.generateRecommendations(report);

      const checkEndTime = performance.now();
      report.performanceMetrics.totalTime = checkEndTime - checkStartTime;

      // Save to history
      if (saveToHistory) {
        this.addToHistory(report);
      }

      // Update last check timestamp
      this.lastCheck.set(checkType, Date.now());

      logger.info(
        `✅ Data integrity check completed in ${report.performanceMetrics.totalTime.toFixed(
          2
        )}ms`
      );
      logger.info(
        `📊 Overall Score: ${report.overall.score}% (${report.overall.errors} errors, ${report.overall.warnings} warnings)`
      );

      // Report critical issues immediately
      if (report.overall.errors > 0 || report.overall.score < 70) {
        await this.reportCriticalIssues(report);
      }

      return report;
    } catch (error) {
      logger.error("❌ Data integrity check failed:", error);
      report.overall.valid = false;
      report.error = {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      };

      await this.reportIntegrityError("integrity_check", error, {
        checkType,
        stores,
        options,
      });
      return report;
    }
  }

  /**
   * Perform schema validation across specified stores
   * @param {Array} stores - Store names to validate
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} - Schema validation results
   */
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
      logger.info(`📋 Validating schema for store: ${storeName}`);

      try {
        const storeData = await this.getAllStoreData(db, storeName);
        result.totalRecords += storeData.length;

        const storeResult = {
          valid: true,
          recordCount: storeData.length,
          errors: [],
          warnings: [],
          sampleSize: quick ? Math.min(10, storeData.length) : storeData.length,
          performanceMetrics: {
            validationTime: 0,
            avgRecordTime: 0,
          },
        };

        // For quick checks, only validate a sample
        const recordsToValidate = quick
          ? this.getSampleRecords(storeData, 10)
          : storeData;

        if (recordsToValidate.length > 0) {
          const batchResult = SchemaValidator.validateBatch(
            storeName,
            recordsToValidate,
            {
              strict: priority === this.PRIORITIES.CRITICAL,
              stopOnFirstError: false,
              maxErrors: quick ? 5 : 50,
              reportProgress: !quick && recordsToValidate.length > 100,
            }
          );

          storeResult.valid = batchResult.valid;
          storeResult.performanceMetrics.validationTime = batchResult.totalTime;
          storeResult.performanceMetrics.avgRecordTime =
            batchResult.avgItemTime;

          // Collect errors and warnings
          for (const itemResult of batchResult.results) {
            if (!itemResult.valid) {
              result.valid = false;
              storeResult.errors.push(...itemResult.errors);
              storeResult.warnings.push(...itemResult.warnings);
            }
          }

          result.validRecords += batchResult.validItems;
          result.errorCount += storeResult.errors.length;
          result.warningCount += storeResult.warnings.length;
        }

        result.stores[storeName] = storeResult;

        const storeEndTime = performance.now();
        result.performanceMetrics.storeBreakdown[storeName] =
          storeEndTime - storeStartTime;

        logger.info(
          `✅ ${storeName}: ${storeResult.recordCount} records, ${storeResult.errors.length} errors, ${storeResult.warnings.length} warnings`
        );
      } catch (error) {
        logger.error(
          `❌ Schema validation failed for store ${storeName}:`,
          error
        );
        result.valid = false;
        result.stores[storeName] = {
          valid: false,
          error: {
            message: error.message,
            stack: error.stack,
          },
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

  /**
   * Perform business logic validation
   * @param {Array} stores - Store names to validate
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} - Business logic validation results
   */
  static async performBusinessLogicValidation(stores, options = {}) {
    const { priority = this.PRIORITIES.MEDIUM } = options;

    const result = {
      valid: true,
      checks: [],
      errorCount: 0,
      warningCount: 0,
      performanceMetrics: {
        totalTime: 0,
        checkBreakdown: {},
      },
    };

    const startTime = performance.now();

    // Cross-store consistency checks
    await this.checkCrossStoreConsistency(result);

    // Data freshness checks
    await this.checkDataFreshness(result, stores);

    // Statistical anomaly detection
    if (priority === this.PRIORITIES.CRITICAL) {
      await this.checkStatisticalAnomalies(result, stores);
    }

    const endTime = performance.now();
    result.performanceMetrics.totalTime = endTime - startTime;

    return result;
  }

  /**
   * Check cross-store data consistency
   * @param {Object} result - Result object to populate
   */
  static async checkCrossStoreConsistency(result) {
    const startTime = performance.now();
    const db = await dbHelper.openDB();

    try {
      // Check problems vs attempts consistency
      const problems = await this.getAllStoreData(db, "problems");
      const attempts = await this.getAllStoreData(db, "attempts");

      const problemsWithAttempts = new Set(attempts.map((a) => a.problemId));
      const problemsInDb = new Set(problems.map((p) => p.leetCodeID));

      // Find problems with attempts but zero attempt stats
      for (const problem of problems) {
        if (problemsWithAttempts.has(problem.leetCodeID)) {
          const problemAttempts = attempts.filter(
            (a) => a.problemId === problem.leetCodeID
          );
          const actualTotal = problemAttempts.length;
          const actualSuccessful = problemAttempts.filter(
            (a) => a.success
          ).length;

          if (problem.AttemptStats) {
            const { TotalAttempts, SuccessfulAttempts } = problem.AttemptStats;

            if (
              TotalAttempts !== actualTotal ||
              SuccessfulAttempts !== actualSuccessful
            ) {
              result.valid = false;
              result.errorCount++;
              result.checks.push({
                type: "cross_store_inconsistency",
                severity: "error",
                message: `Problem ${problem.leetCodeID} attempt stats mismatch`,
                details: {
                  stored: { TotalAttempts, SuccessfulAttempts },
                  calculated: {
                    TotalAttempts: actualTotal,
                    SuccessfulAttempts: actualSuccessful,
                  },
                },
              });
            }
          }
        }
      }

      // Check sessions vs attempts consistency
      const sessions = await this.getAllStoreData(db, "sessions");
      for (const session of sessions) {
        if (session.attempts) {
          for (const sessionAttempt of session.attempts) {
            const attemptExists = attempts.some(
              (a) => a.id === sessionAttempt.attemptId
            );
            if (!attemptExists) {
              result.valid = false;
              result.warningCount++;
              result.checks.push({
                type: "missing_attempt_reference",
                severity: "warning",
                message: `Session ${session.id} references non-existent attempt ${sessionAttempt.attemptId}`,
                details: {
                  sessionId: session.id,
                  attemptId: sessionAttempt.attemptId,
                },
              });
            }
          }
        }
      }
    } catch (error) {
      result.checks.push({
        type: "cross_store_check_error",
        severity: "error",
        message: `Cross-store consistency check failed: ${error.message}`,
        error: error.stack,
      });
      result.errorCount++;
    }

    const endTime = performance.now();
    result.performanceMetrics.checkBreakdown.crossStoreConsistency =
      endTime - startTime;
  }

  /**
   * Check data freshness and staleness
   * @param {Object} result - Result object to populate
   * @param {Array} stores - Store names to check
   */
  static async checkDataFreshness(result, stores) {
    const startTime = performance.now();
    const db = await dbHelper.openDB();
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    try {
      // Check for stale sessions (incomplete sessions older than 24 hours)
      if (stores.includes("sessions")) {
        const sessions = await this.getAllStoreData(db, "sessions");
        const staleSessions = sessions.filter((session) => {
          if (session.isCompleted) return false;

          const sessionDate = new Date(session.Date);
          const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          return sessionDate < oneDayAgo;
        });

        if (staleSessions.length > 0) {
          result.warningCount += staleSessions.length;
          result.checks.push({
            type: "stale_sessions",
            severity: "warning",
            message: `Found ${staleSessions.length} incomplete sessions older than 24 hours`,
            details: {
              count: staleSessions.length,
              sessions: staleSessions.map((s) => s.id),
            },
          });
        }
      }

      // Check for outdated tag mastery calculations
      if (stores.includes("tag_mastery")) {
        const tagMastery = await this.getAllStoreData(db, "tag_mastery");
        const outdatedMastery = tagMastery.filter((tm) => {
          if (!tm.lastAttemptDate) return false;
          const lastAttempt = new Date(tm.lastAttemptDate);
          return lastAttempt < oneWeekAgo && tm.decayScore > 0.1;
        });

        if (outdatedMastery.length > 0) {
          result.warningCount++;
          result.checks.push({
            type: "outdated_mastery",
            severity: "warning",
            message: `Found ${outdatedMastery.length} tag mastery records that may need decay score updates`,
            details: {
              count: outdatedMastery.length,
              tags: outdatedMastery.map((tm) => tm.tag),
            },
          });
        }
      }
    } catch (error) {
      result.checks.push({
        type: "data_freshness_error",
        severity: "error",
        message: `Data freshness check failed: ${error.message}`,
        error: error.stack,
      });
      result.errorCount++;
    }

    const endTime = performance.now();
    result.performanceMetrics.checkBreakdown.dataFreshness =
      endTime - startTime;
  }

  /**
   * Check for statistical anomalies in the data
   * @param {Object} result - Result object to populate
   * @param {Array} stores - Store names to check
   */
  static async checkStatisticalAnomalies(result, stores) {
    const startTime = performance.now();
    const db = await dbHelper.openDB();

    try {
      // Check for unusual success rates
      if (stores.includes("tag_mastery")) {
        const tagMastery = await this.getAllStoreData(db, "tag_mastery");

        // Find tags with 100% success rate but low attempt count (suspicious)
        const suspiciousHighRates = tagMastery.filter(
          (tm) =>
            tm.successRate >= 1.0 &&
            tm.totalAttempts > 0 &&
            tm.totalAttempts < 3
        );

        if (suspiciousHighRates.length > 0) {
          result.warningCount++;
          result.checks.push({
            type: "suspicious_success_rates",
            severity: "warning",
            message: `Found ${suspiciousHighRates.length} tags with 100% success rate but very few attempts`,
            details: {
              count: suspiciousHighRates.length,
              tags: suspiciousHighRates.map((tm) => ({
                tag: tm.tag,
                attempts: tm.totalAttempts,
              })),
            },
          });
        }
      }

      // Check for unusual time patterns in attempts
      if (stores.includes("attempts")) {
        const attempts = await this.getAllStoreData(db, "attempts");
        const recentAttempts = attempts.filter((a) => {
          const attemptDate = new Date(a.date);
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          return attemptDate > oneDayAgo;
        });

        // Check for extremely fast completion times (< 30 seconds)
        const suspiciouslyFast = recentAttempts.filter((a) => a.timeSpent < 30);
        if (suspiciouslyFast.length > 5) {
          // Only flag if there are many
          result.warningCount++;
          result.checks.push({
            type: "suspicious_completion_times",
            severity: "warning",
            message: `Found ${suspiciouslyFast.length} attempts completed in under 30 seconds in the last 24 hours`,
            details: { count: suspiciouslyFast.length },
          });
        }

        // Check for extremely long completion times (> 2 hours)
        const suspiciouslySlow = recentAttempts.filter(
          (a) => a.timeSpent > 7200
        );
        if (suspiciouslySlow.length > 0) {
          result.warningCount++;
          result.checks.push({
            type: "unusual_long_attempts",
            severity: "warning",
            message: `Found ${suspiciouslySlow.length} attempts taking over 2 hours in the last 24 hours`,
            details: { count: suspiciouslySlow.length },
          });
        }
      }
    } catch (error) {
      result.checks.push({
        type: "statistical_anomaly_error",
        severity: "error",
        message: `Statistical anomaly check failed: ${error.message}`,
        error: error.stack,
      });
      result.errorCount++;
    }

    const endTime = performance.now();
    result.performanceMetrics.checkBreakdown.statisticalAnomalies =
      endTime - startTime;
  }

  /**
   * Calculate overall integrity score
   * @param {Object} report - Integrity check report
   * @returns {number} - Score from 0-100
   */
  static calculateOverallScore(report) {
    let score = 100;
    let factors = 0;

    // Schema validation score
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

    // Referential integrity score
    if (report.results.referential) {
      score += report.results.referential.integrityScore || 50;
      factors++;
    }

    // Business logic score
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

    // Storage health score
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
   * @param {Object} report - Integrity check report
   * @returns {Array} - Array of recommendation objects
   */
  static generateRecommendations(report) {
    const recommendations = [];

    // Schema validation recommendations
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

    // Referential integrity recommendations
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

    // Performance recommendations
    if (report.performanceMetrics.totalTime > 10000) {
      // More than 10 seconds
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

    // Storage health recommendations
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

    // Sort recommendations by priority
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    recommendations.sort(
      (a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]
    );

    return recommendations;
  }

  /**
   * Start periodic integrity monitoring
   * @param {Object} config - Monitoring configuration
   */
  static startPeriodicMonitoring(config = {}) {
    const {
      quickCheckInterval = this.INTERVALS.FREQUENT,
      fullCheckInterval = this.INTERVALS.DAILY,
      realTimeInterval = this.INTERVALS.REAL_TIME,
      autoRepair = false,
    } = config;

    logger.info("🕐 Starting periodic data integrity monitoring...");

    // Quick checks (schema validation only)
    if (!this.monitoringIntervals.has("quick")) {
      const quickInterval = setInterval(async () => {
        try {
          logger.info("⚡ Running quick integrity check...");
          const result = await this.performIntegrityCheck({
            checkType: this.CHECK_TYPES.QUICK,
            priority: this.PRIORITIES.LOW,
            saveToHistory: true,
          });

          if (!result.overall.valid && result.overall.errors > 0) {
            logger.warn(
              `⚠️ Quick check found ${result.overall.errors} errors`
            );
            await this.notifyIntegrityIssues("quick_check", result);
          }
        } catch (error) {
          logger.error("❌ Quick integrity check failed:", error);
        }
      }, quickCheckInterval);

      this.monitoringIntervals.set("quick", quickInterval);
      logger.info(
        `✅ Quick checks scheduled every ${
          quickCheckInterval / 1000 / 60
        } minutes`
      );
    }

    // Full checks (all validations)
    if (!this.monitoringIntervals.has("full")) {
      const fullInterval = setInterval(async () => {
        try {
          logger.info("🔍 Running full integrity check...");
          const result = await this.performIntegrityCheck({
            checkType: this.CHECK_TYPES.FULL,
            priority: this.PRIORITIES.MEDIUM,
            saveToHistory: true,
          });

          if (result.overall.score < 80) {
            logger.warn(`⚠️ Full check score: ${result.overall.score}%`);
            await this.notifyIntegrityIssues("full_check", result);
          }

          // Auto-repair if enabled and safe
          if (autoRepair && result.results.referential?.repairSuggestions) {
            const safeRepairs =
              result.results.referential.repairSuggestions.filter(
                (s) => s.automated && s.risk === "low"
              );

            if (safeRepairs.length > 0) {
              logger.info(
                `🔧 Auto-repairing ${safeRepairs.length} low-risk issues...`
              );
              await ReferentialIntegrityService.executeRepairs(safeRepairs, {
                automatedOnly: true,
                createBackup: true,
              });
            }
          }
        } catch (error) {
          logger.error("❌ Full integrity check failed:", error);
        }
      }, fullCheckInterval);

      this.monitoringIntervals.set("full", fullInterval);
      logger.info(
        `✅ Full checks scheduled every ${
          fullCheckInterval / 1000 / 60 / 60
        } hours`
      );
    }

    logger.info("✅ Periodic integrity monitoring started");
  }

  /**
   * Stop periodic monitoring
   */
  static stopPeriodicMonitoring() {
    logger.info("🛑 Stopping periodic integrity monitoring...");

    for (const [type, interval] of this.monitoringIntervals) {
      clearInterval(interval);
      logger.info(`✅ Stopped ${type} monitoring`);
    }

    this.monitoringIntervals.clear();
    logger.info("✅ All periodic monitoring stopped");
  }

  /**
   * Get monitoring status
   * @returns {Object} - Current monitoring status
   */
  static getMonitoringStatus() {
    return {
      active: this.monitoringIntervals.size > 0,
      intervals: Array.from(this.monitoringIntervals.keys()),
      lastChecks: Object.fromEntries(this.lastCheck),
      historySize: this.checkHistory.length,
      nextScheduledCheck: this.getNextScheduledCheck(),
    };
  }

  /**
   * Get integrity check history
   * @param {number} limit - Number of recent checks to return
   * @returns {Array} - Array of check reports
   */
  static getCheckHistory(limit = 10) {
    return this.checkHistory
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  /**
   * Get data integrity dashboard summary
   * @returns {Promise<Object>} - Dashboard summary data
   */
  static async getIntegrityDashboardSummary() {
    const recentCheck =
      this.checkHistory.length > 0
        ? this.checkHistory[this.checkHistory.length - 1]
        : null;

    const summary = {
      lastCheck: recentCheck?.timestamp || null,
      overallScore: recentCheck?.overall.score || null,
      status: this.getHealthStatus(recentCheck?.overall.score),
      activeMonitoring: this.monitoringIntervals.size > 0,
      recentIssues: recentCheck?.overall.errors || 0,
      totalChecks: this.checkHistory.length,
      trends: this.calculateTrends(),
      quickStats: {
        averageScore: this.calculateAverageScore(),
        checksToday: this.getChecksToday(),
        lastFullCheck: this.getLastFullCheck(),
      },
    };

    return summary;
  }

  // Helper methods

  static async getAllStoreData(db, storeName) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], "readonly");
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  static getSampleRecords(records, sampleSize) {
    if (records.length <= sampleSize) return records;

    const step = Math.floor(records.length / sampleSize);
    const sample = [];
    for (
      let i = 0;
      i < records.length && sample.length < sampleSize;
      i += step
    ) {
      sample.push(records[i]);
    }
    return sample;
  }

  static generateCheckId() {
    return `check_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static addToHistory(report) {
    // Create a lightweight summary for history
    const summary = {
      checkId: report.checkId,
      timestamp: report.timestamp,
      checkType: report.checkType,
      overall: { ...report.overall },
      performanceMetrics: {
        totalTime: report.performanceMetrics.totalTime,
      },
    };

    this.checkHistory.push(summary);

    // Trim history if it gets too large
    if (this.checkHistory.length > this.maxHistorySize) {
      this.checkHistory = this.checkHistory.slice(-this.maxHistorySize);
    }
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

  static async notifyIntegrityIssues(checkType, result) {
    // This could integrate with notification systems
    // For now, just console logging
    logger.warn(`🚨 Integrity issues detected in ${checkType}:`, {
      score: result.overall.score,
      errors: result.overall.errors,
      warnings: result.overall.warnings,
    });
  }

  static async reportIntegrityError(operation, error, context) {
    try {
      await ErrorReportService.storeErrorReport({
        errorId: `integrity_error_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`,
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
    if (score === null) return "unknown";
    if (score >= 95) return "excellent";
    if (score >= 85) return "good";
    if (score >= 70) return "warning";
    return "critical";
  }

  static calculateTrends() {
    if (this.checkHistory.length < 2) return { trend: "insufficient_data" };

    const recent = this.checkHistory.slice(-5);
    const older = this.checkHistory.slice(-10, -5);

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

  static calculateAverageScore() {
    if (this.checkHistory.length === 0) return null;
    const sum = this.checkHistory.reduce(
      (sum, check) => sum + check.overall.score,
      0
    );
    return Math.round(sum / this.checkHistory.length);
  }

  static getChecksToday() {
    const today = new Date().toDateString();
    return this.checkHistory.filter(
      (check) => new Date(check.timestamp).toDateString() === today
    ).length;
  }

  static getLastFullCheck() {
    const fullCheck = this.checkHistory
      .filter((check) => check.checkType === this.CHECK_TYPES.FULL)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

    return fullCheck?.timestamp || null;
  }

  static getNextScheduledCheck() {
    const lastQuick = this.lastCheck.get(this.CHECK_TYPES.QUICK) || 0;
    const lastFull = this.lastCheck.get(this.CHECK_TYPES.FULL) || 0;

    const nextQuick = lastQuick + this.INTERVALS.FREQUENT;
    const nextFull = lastFull + this.INTERVALS.DAILY;

    return {
      nextQuick: new Date(nextQuick).toISOString(),
      nextFull: new Date(nextFull).toISOString(),
    };
  }

  /**
   * Manual trigger for immediate integrity check
   * @param {string} checkType - Type of check to perform
   * @param {Object} options - Check options
   * @returns {Promise<Object>} - Check result
   */
  static async triggerManualCheck(
    checkType = this.CHECK_TYPES.FULL,
    options = {}
  ) {
    logger.info(`🔧 Manual integrity check triggered: ${checkType}`);

    return await this.performIntegrityCheck({
      checkType,
      priority: this.PRIORITIES.HIGH,
      saveToHistory: true,
      generateReport: true,
      ...options,
    });
  }

  /**
   * Get detailed integrity metrics for monitoring
   * @returns {Object} - Detailed metrics
   */
  static getDetailedMetrics() {
    return {
      monitoring: this.getMonitoringStatus(),
      performance: SchemaValidator.getValidationSummary(),
      referentialCache: ReferentialIntegrityService.getCacheStats(),
      history: {
        totalChecks: this.checkHistory.length,
        recentChecks: this.checkHistory.slice(-5),
        averageScore: this.calculateAverageScore(),
        trends: this.calculateTrends(),
      },
    };
  }
}

export default DataIntegrityCheckService;
