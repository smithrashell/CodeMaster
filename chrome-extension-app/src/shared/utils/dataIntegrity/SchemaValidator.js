/**
 * Schema Validator for CodeMaster Data Integrity
 *
 * Provides comprehensive validation of data objects against JSON schemas
 * with detailed error reporting and performance optimization.
 */

import DataIntegritySchemas from "./DataIntegritySchemas.js";
import ErrorReportService from "../../services/ErrorReportService.js";
import logger from "../logger.js";
import {
  SEVERITY,
  validateBusinessLogic,
  sanitizeForLogging,
  validateType,
  validateRequiredFields,
  validateProperties,
} from "./SchemaValidatorHelpers.js";

export class SchemaValidator {
  // Validation result severity levels
  static SEVERITY = SEVERITY;

  // Performance metrics
  static performanceMetrics = {
    validationCount: 0,
    totalValidationTime: 0,
    avgValidationTime: 0,
    errorCount: 0,
    successCount: 0,
  };

  /**
   * Validate a single data object against its store schema
   * @param {string} storeName - Name of the IndexedDB store
   * @param {Object} data - Data object to validate
   * @param {Object} options - Validation options
   * @returns {Object} - Validation result with success, errors, and warnings
   */
  static validateData(storeName, data, options = {}) {
    const startTime = performance.now();
    const {
      strict = true,
      allowExtraProperties = false,
      validateRequired = true,
      skipBusinessLogic = false,
    } = options;

    const result = {
      valid: true,
      errors: [],
      warnings: [],
      storeName,
      data: sanitizeForLogging(data),
      validationTime: 0,
      checksPerformed: [],
    };

    try {
      // Get schema for the store
      const schema = DataIntegritySchemas.getStoreSchema(storeName);
      if (!schema) {
        result.valid = false;
        result.errors.push({
          type: "schema_not_found",
          message: `No schema found for store: ${storeName}`,
          severity: this.SEVERITY.ERROR,
          field: null,
          value: null,
        });
        return result;
      }

      result.checksPerformed.push("schema_lookup");

      // Basic type validation
      if (!validateType(data, schema.type, result)) {
        return this.finalizeResult(result, startTime);
      }

      result.checksPerformed.push("type_validation");

      // Required fields validation
      if (validateRequired && schema.required) {
        validateRequiredFields(data, schema.required, result);
      }

      result.checksPerformed.push("required_fields");

      // Property validation
      if (schema.properties) {
        validateProperties(data, schema.properties, result, {
          allowExtra: allowExtraProperties,
          strict,
        });
      }

      result.checksPerformed.push("property_validation");

      // Business logic validation (CodeMaster-specific)
      if (!skipBusinessLogic) {
        validateBusinessLogic(storeName, data, result);
        result.checksPerformed.push("business_logic");
      }

      return this.finalizeResult(result, startTime);
    } catch (error) {
      result.valid = false;
      result.errors.push({
        type: "validation_exception",
        message: `Validation failed with exception: ${error.message}`,
        severity: this.SEVERITY.ERROR,
        field: null,
        value: null,
        stack: error.stack,
      });

      return this.finalizeResult(result, startTime);
    }
  }

  /**
   * Validate multiple data objects in batch
   * @param {string} storeName - Name of the IndexedDB store
   * @param {Array} dataArray - Array of data objects to validate
   * @param {Object} options - Validation options
   * @returns {Object} - Batch validation result
   */
  static validateBatch(storeName, dataArray, options = {}) {
    const startTime = performance.now();
    const {
      stopOnFirstError = false,
      maxErrors = 100,
      reportProgress = false,
    } = options;

    const batchResult = {
      valid: true,
      totalItems: dataArray.length,
      validItems: 0,
      invalidItems: 0,
      results: [],
      summary: {
        errors: 0,
        warnings: 0,
        totalValidationTime: 0,
      },
    };

    for (let i = 0; i < dataArray.length; i++) {
      if (reportProgress && i % 100 === 0) {
        logger.info("Validation batch progress", { progress: i, total: dataArray.length, context: 'schema_validation' });
      }

      const itemResult = this.validateData(storeName, dataArray[i], options);
      batchResult.results.push(itemResult);

      batchResult.summary.totalValidationTime += itemResult.validationTime;
      batchResult.summary.errors += itemResult.errors.length;
      batchResult.summary.warnings += itemResult.warnings.length;

      if (itemResult.valid) {
        batchResult.validItems++;
      } else {
        batchResult.invalidItems++;
        batchResult.valid = false;

        if (stopOnFirstError || batchResult.summary.errors >= maxErrors) {
          logger.warn("Stopping batch validation", { 
            reason: stopOnFirstError ? "first error encountered" : "max errors reached",
            context: 'schema_validation'
          });
          break;
        }
      }
    }

    const endTime = performance.now();
    batchResult.totalTime = endTime - startTime;
    batchResult.avgItemTime =
      batchResult.summary.totalValidationTime / batchResult.results.length;

    return batchResult;
  }

  /**
   * Finalize validation result with performance metrics
   * @param {Object} result - Validation result
   * @param {number} startTime - Start time for performance measurement
   * @returns {Object} - Finalized result
   */
  static finalizeResult(result, startTime) {
    const endTime = performance.now();
    result.validationTime = endTime - startTime;

    // Update performance metrics
    this.performanceMetrics.validationCount++;
    this.performanceMetrics.totalValidationTime += result.validationTime;
    this.performanceMetrics.avgValidationTime =
      this.performanceMetrics.totalValidationTime /
      this.performanceMetrics.validationCount;

    if (result.valid) {
      this.performanceMetrics.successCount++;
    } else {
      this.performanceMetrics.errorCount++;
    }

    // Report critical errors
    const criticalErrors = result.errors.filter(
      (error) => error.severity === SEVERITY.ERROR
    );

    if (criticalErrors.length > 0) {
      this.reportValidationErrors(
        result.storeName,
        criticalErrors,
        result.data
      );
    }

    return result;
  }

  /**
   * Report validation errors to error tracking service
   * @param {string} storeName - Store name
   * @param {Array} errors - Array of error objects
   * @param {Object} data - Original data (sanitized)
   */
  static async reportValidationErrors(storeName, errors, data) {
    try {
      await ErrorReportService.storeErrorReport({
        errorId: `validation_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`,
        message: `Data validation failed for ${storeName}`,
        stack: JSON.stringify(errors, null, 2),
        section: "Data Integrity",
        errorType: "validation_failure",
        severity: "high",
        userContext: {
          storeName,
          errorCount: errors.length,
          dataPreview: data,
        },
      });
    } catch (reportError) {
      logger.warn("Failed to report validation errors", { error: reportError, context: 'schema_validation' });
    }
  }

  /**
   * Get performance metrics
   * @returns {Object} - Performance metrics object
   */
  static getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }

  /**
   * Reset performance metrics
   */
  static resetPerformanceMetrics() {
    this.performanceMetrics = {
      validationCount: 0,
      totalValidationTime: 0,
      avgValidationTime: 0,
      errorCount: 0,
      successCount: 0,
    };
  }

  /**
   * Get validation summary for debugging
   * @returns {Object} - Validation summary
   */
  static getValidationSummary() {
    const metrics = this.getPerformanceMetrics();
    return {
      ...metrics,
      successRate:
        metrics.validationCount > 0
          ? metrics.successCount / metrics.validationCount
          : 0,
      avgValidationTimeMs: Number(metrics.avgValidationTime.toFixed(2)),
    };
  }
}

export default SchemaValidator;
