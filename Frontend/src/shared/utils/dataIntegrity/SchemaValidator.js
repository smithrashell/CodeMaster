/**
 * Schema Validator for CodeMaster Data Integrity
 *
 * Provides comprehensive validation of data objects against JSON schemas
 * with detailed error reporting and performance optimization.
 */

import DataIntegritySchemas from "./DataIntegritySchemas.js";
import ErrorReportService from "../../services/ErrorReportService.js";

export class SchemaValidator {
  // Validation result severity levels
  static SEVERITY = {
    ERROR: "error",
    WARNING: "warning",
    INFO: "info",
  };

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
      data: this.sanitizeForLogging(data),
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
      if (!this.validateType(data, schema.type, result)) {
        return this.finalizeResult(result, startTime);
      }

      result.checksPerformed.push("type_validation");

      // Required fields validation
      if (validateRequired && schema.required) {
        this.validateRequiredFields(data, schema.required, result);
      }

      result.checksPerformed.push("required_fields");

      // Property validation
      if (schema.properties) {
        this.validateProperties(data, schema.properties, result, {
          allowExtra: allowExtraProperties,
          strict,
        });
      }

      result.checksPerformed.push("property_validation");

      // Business logic validation (CodeMaster-specific)
      if (!skipBusinessLogic) {
        this.validateBusinessLogic(storeName, data, result);
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
        console.log(`Validating batch progress: ${i}/${dataArray.length}`);
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
          console.warn(
            `Stopping batch validation: ${
              stopOnFirstError
                ? "first error encountered"
                : "max errors reached"
            }`
          );
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
   * Validate data type
   * @param {*} value - Value to validate
   * @param {string} expectedType - Expected JSON schema type
   * @param {Object} result - Result object to populate
   * @returns {boolean} - True if type is valid
   */
  static validateType(value, expectedType, result) {
    const actualType = this.getJsonType(value);

    if (expectedType === actualType) {
      return true;
    }

    result.valid = false;
    result.errors.push({
      type: "type_mismatch",
      message: `Expected type ${expectedType}, got ${actualType}`,
      severity: this.SEVERITY.ERROR,
      field: "root",
      value: this.sanitizeForLogging(value),
      expected: expectedType,
      actual: actualType,
    });

    return false;
  }

  /**
   * Validate required fields
   * @param {Object} data - Data object
   * @param {Array} requiredFields - Array of required field names
   * @param {Object} result - Result object to populate
   */
  static validateRequiredFields(data, requiredFields, result) {
    for (const field of requiredFields) {
      if (!(field in data)) {
        result.valid = false;
        result.errors.push({
          type: "required_field_missing",
          message: `Required field '${field}' is missing`,
          severity: this.SEVERITY.ERROR,
          field,
          value: null,
        });
      } else if (data[field] === null || data[field] === undefined) {
        result.valid = false;
        result.errors.push({
          type: "required_field_null",
          message: `Required field '${field}' cannot be null or undefined`,
          severity: this.SEVERITY.ERROR,
          field,
          value: data[field],
        });
      }
    }
  }

  /**
   * Validate object properties
   * @param {Object} data - Data object
   * @param {Object} properties - Schema properties definition
   * @param {Object} result - Result object to populate
   * @param {Object} options - Validation options
   */
  static validateProperties(data, properties, result, options = {}) {
    const { allowExtra = false, strict = true } = options;

    // Check for extra properties
    if (!allowExtra) {
      for (const key in data) {
        if (!(key in properties)) {
          const severity = strict ? this.SEVERITY.ERROR : this.SEVERITY.WARNING;
          const message = `Property '${key}' is not defined in schema`;

          if (strict) {
            result.valid = false;
            result.errors.push({
              type: "extra_property",
              message,
              severity,
              field: key,
              value: this.sanitizeForLogging(data[key]),
            });
          } else {
            result.warnings.push({
              type: "extra_property",
              message,
              severity,
              field: key,
              value: this.sanitizeForLogging(data[key]),
            });
          }
        }
      }
    }

    // Validate each property
    for (const [propName, propSchema] of Object.entries(properties)) {
      if (propName in data) {
        const propResult = this.validateProperty(
          data[propName],
          propSchema,
          propName
        );

        if (!propResult.valid) {
          result.valid = false;
          result.errors.push(...propResult.errors);
        }
        result.warnings.push(...propResult.warnings);
      }
    }
  }

  /**
   * Validate a single property
   * @param {*} value - Property value
   * @param {Object} schema - Property schema
   * @param {string} fieldName - Field name for error reporting
   * @returns {Object} - Property validation result
   */
  static validateProperty(value, schema, fieldName) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
    };

    // Type validation
    if (
      schema.type &&
      !this.validatePropertyType(value, schema, result, fieldName)
    ) {
      return result;
    }

    // Format validation
    if (schema.format) {
      this.validateFormat(value, schema.format, result, fieldName);
    }

    // Pattern validation
    if (schema.pattern && typeof value === "string") {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(value)) {
        result.valid = false;
        result.errors.push({
          type: "pattern_mismatch",
          message: `Field '${fieldName}' does not match pattern: ${schema.pattern}`,
          severity: this.SEVERITY.ERROR,
          field: fieldName,
          value: this.sanitizeForLogging(value),
          pattern: schema.pattern,
        });
      }
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(value)) {
      result.valid = false;
      result.errors.push({
        type: "enum_violation",
        message: `Field '${fieldName}' must be one of: [${schema.enum.join(
          ", "
        )}]`,
        severity: this.SEVERITY.ERROR,
        field: fieldName,
        value: this.sanitizeForLogging(value),
        allowedValues: schema.enum,
      });
    }

    // Numeric validations
    if (typeof value === "number") {
      this.validateNumericConstraints(value, schema, result, fieldName);
    }

    // String validations
    if (typeof value === "string") {
      this.validateStringConstraints(value, schema, result, fieldName);
    }

    // Array validations
    if (Array.isArray(value) && schema.items) {
      this.validateArrayItems(value, schema, result, fieldName);
    }

    // Object validations
    if (typeof value === "object" && value !== null && schema.properties) {
      this.validateProperties(value, schema.properties, result);
    }

    return result;
  }

  /**
   * Validate property type including oneOf support
   * @param {*} value - Value to validate
   * @param {Object} schema - Property schema
   * @param {Object} result - Result object
   * @param {string} fieldName - Field name
   * @returns {boolean} - True if type is valid
   */
  static validatePropertyType(value, schema, result, fieldName) {
    // Handle oneOf schemas (union types)
    if (schema.oneOf) {
      for (const subSchema of schema.oneOf) {
        const subResult = this.validateProperty(value, subSchema, fieldName);
        if (subResult.valid) {
          return true; // Valid against at least one sub-schema
        }
      }

      result.valid = false;
      result.errors.push({
        type: "oneof_violation",
        message: `Field '${fieldName}' does not match any of the allowed schemas`,
        severity: this.SEVERITY.ERROR,
        field: fieldName,
        value: this.sanitizeForLogging(value),
      });
      return false;
    }

    // Handle array of types
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actualType = this.getJsonType(value);

    if (!types.includes(actualType)) {
      result.valid = false;
      result.errors.push({
        type: "type_mismatch",
        message: `Field '${fieldName}' expected type(s) [${types.join(
          ", "
        )}], got ${actualType}`,
        severity: this.SEVERITY.ERROR,
        field: fieldName,
        value: this.sanitizeForLogging(value),
        expected: types,
        actual: actualType,
      });
      return false;
    }

    return true;
  }

  /**
   * Validate format constraints (date-time, email, etc.)
   * @param {*} value - Value to validate
   * @param {string} format - Expected format
   * @param {Object} result - Result object
   * @param {string} fieldName - Field name
   */
  static validateFormat(value, format, result, fieldName) {
    if (typeof value !== "string") {
      return; // Format validation only applies to strings
    }

    let isValid = true;
    let errorMessage = "";

    switch (format) {
      case "date-time":
        isValid =
          !isNaN(Date.parse(value)) &&
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
        errorMessage = "Invalid date-time format (expected ISO 8601)";
        break;
      case "email":
        isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        errorMessage = "Invalid email format";
        break;
      case "uuid":
        isValid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            value
          );
        errorMessage = "Invalid UUID format";
        break;
      default:
        // Unknown format, issue warning
        result.warnings.push({
          type: "unknown_format",
          message: `Unknown format '${format}' for field '${fieldName}'`,
          severity: this.SEVERITY.WARNING,
          field: fieldName,
          value: this.sanitizeForLogging(value),
          format,
        });
        return;
    }

    if (!isValid) {
      result.valid = false;
      result.errors.push({
        type: "format_violation",
        message: `Field '${fieldName}': ${errorMessage}`,
        severity: this.SEVERITY.ERROR,
        field: fieldName,
        value: this.sanitizeForLogging(value),
        format,
      });
    }
  }

  /**
   * Validate numeric constraints
   * @param {number} value - Numeric value
   * @param {Object} schema - Property schema
   * @param {Object} result - Result object
   * @param {string} fieldName - Field name
   */
  static validateNumericConstraints(value, schema, result, fieldName) {
    if (schema.minimum !== undefined && value < schema.minimum) {
      result.valid = false;
      result.errors.push({
        type: "minimum_violation",
        message: `Field '${fieldName}' must be >= ${schema.minimum}`,
        severity: this.SEVERITY.ERROR,
        field: fieldName,
        value,
        minimum: schema.minimum,
      });
    }

    if (schema.maximum !== undefined && value > schema.maximum) {
      result.valid = false;
      result.errors.push({
        type: "maximum_violation",
        message: `Field '${fieldName}' must be <= ${schema.maximum}`,
        severity: this.SEVERITY.ERROR,
        field: fieldName,
        value,
        maximum: schema.maximum,
      });
    }

    // Integer type check
    if (schema.type === "integer" && !Number.isInteger(value)) {
      result.valid = false;
      result.errors.push({
        type: "integer_violation",
        message: `Field '${fieldName}' must be an integer`,
        severity: this.SEVERITY.ERROR,
        field: fieldName,
        value,
      });
    }
  }

  /**
   * Validate string constraints
   * @param {string} value - String value
   * @param {Object} schema - Property schema
   * @param {Object} result - Result object
   * @param {string} fieldName - Field name
   */
  static validateStringConstraints(value, schema, result, fieldName) {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      result.valid = false;
      result.errors.push({
        type: "minlength_violation",
        message: `Field '${fieldName}' must have at least ${schema.minLength} characters`,
        severity: this.SEVERITY.ERROR,
        field: fieldName,
        value: this.sanitizeForLogging(value),
        minLength: schema.minLength,
        actualLength: value.length,
      });
    }

    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      result.valid = false;
      result.errors.push({
        type: "maxlength_violation",
        message: `Field '${fieldName}' must have at most ${schema.maxLength} characters`,
        severity: this.SEVERITY.ERROR,
        field: fieldName,
        value: this.sanitizeForLogging(value),
        maxLength: schema.maxLength,
        actualLength: value.length,
      });
    }
  }

  /**
   * Validate array items
   * @param {Array} value - Array value
   * @param {Object} schema - Array schema
   * @param {Object} result - Result object
   * @param {string} fieldName - Field name
   */
  static validateArrayItems(value, schema, result, fieldName) {
    // Unique items validation
    if (schema.uniqueItems) {
      const seen = new Set();
      const duplicates = [];

      for (let i = 0; i < value.length; i++) {
        const item = JSON.stringify(value[i]);
        if (seen.has(item)) {
          duplicates.push(i);
        } else {
          seen.add(item);
        }
      }

      if (duplicates.length > 0) {
        result.valid = false;
        result.errors.push({
          type: "unique_items_violation",
          message: `Field '${fieldName}' must have unique items`,
          severity: this.SEVERITY.ERROR,
          field: fieldName,
          duplicateIndexes: duplicates,
        });
      }
    }

    // Validate each item against the items schema
    for (let i = 0; i < value.length; i++) {
      const itemResult = this.validateProperty(
        value[i],
        schema.items,
        `${fieldName}[${i}]`
      );
      if (!itemResult.valid) {
        result.valid = false;
        result.errors.push(...itemResult.errors);
      }
      result.warnings.push(...itemResult.warnings);
    }
  }

  /**
   * Validate business logic specific to CodeMaster
   * @param {string} storeName - Store name
   * @param {Object} data - Data object
   * @param {Object} result - Result object
   */
  static validateBusinessLogic(storeName, data, result) {
    switch (storeName) {
      case "attempts":
        this.validateAttemptBusinessLogic(data, result);
        break;
      case "problems":
        this.validateProblemBusinessLogic(data, result);
        break;
      case "tag_mastery":
        this.validateTagMasteryBusinessLogic(data, result);
        break;
      case "sessions":
        this.validateSessionBusinessLogic(data, result);
        break;
      default:
        // No specific business logic for this store
        break;
    }
  }

  /**
   * Validate attempt-specific business logic
   * @param {Object} data - Attempt data
   * @param {Object} result - Result object
   */
  static validateAttemptBusinessLogic(data, result) {
    // Time spent should be reasonable (between 30 seconds and 2 hours)
    if (data.timeSpent && (data.timeSpent < 30 || data.timeSpent > 7200)) {
      result.warnings.push({
        type: "unusual_time_spent",
        message: `Time spent (${data.timeSpent}s) seems unusual for a problem attempt`,
        severity: this.SEVERITY.WARNING,
        field: "timeSpent",
        value: data.timeSpent,
        suggestion: "Verify time tracking accuracy",
      });
    }

    // Date should not be in the future
    if (data.date) {
      const attemptDate = new Date(data.date);
      const now = new Date();
      if (attemptDate > now) {
        result.valid = false;
        result.errors.push({
          type: "future_date",
          message: "Attempt date cannot be in the future",
          severity: this.SEVERITY.ERROR,
          field: "date",
          value: data.date,
        });
      }
    }
  }

  /**
   * Validate problem-specific business logic
   * @param {Object} data - Problem data
   * @param {Object} result - Result object
   */
  static validateProblemBusinessLogic(data, result) {
    // Success rate should be consistent with attempt stats
    if (data.AttemptStats) {
      const { TotalAttempts, SuccessfulAttempts } = data.AttemptStats;

      if (SuccessfulAttempts > TotalAttempts) {
        result.valid = false;
        result.errors.push({
          type: "impossible_success_rate",
          message: "Successful attempts cannot exceed total attempts",
          severity: this.SEVERITY.ERROR,
          field: "AttemptStats",
          value: { TotalAttempts, SuccessfulAttempts },
        });
      }

      // Box level should be reasonable based on attempts
      if (
        data.BoxLevel !== undefined &&
        TotalAttempts === 0 &&
        data.BoxLevel > 0
      ) {
        result.warnings.push({
          type: "inconsistent_box_level",
          message: "Problem has box level > 0 but no attempts recorded",
          severity: this.SEVERITY.WARNING,
          field: "BoxLevel",
          value: data.BoxLevel,
          suggestion: "Verify box level calculation",
        });
      }
    }
  }

  /**
   * Validate tag mastery business logic
   * @param {Object} data - Tag mastery data
   * @param {Object} result - Result object
   */
  static validateTagMasteryBusinessLogic(data, result) {
    // Success rate calculation consistency
    if (
      data.totalAttempts &&
      data.successfulAttempts &&
      data.successRate !== undefined
    ) {
      const calculatedRate = data.successfulAttempts / data.totalAttempts;
      const tolerance = 0.01; // 1% tolerance for floating point errors

      if (Math.abs(calculatedRate - data.successRate) > tolerance) {
        result.warnings.push({
          type: "inconsistent_success_rate",
          message: "Success rate does not match calculated value from attempts",
          severity: this.SEVERITY.WARNING,
          field: "successRate",
          value: data.successRate,
          calculated: calculatedRate,
          suggestion: "Recalculate success rate from attempts",
        });
      }
    }
  }

  /**
   * Validate session business logic
   * @param {Object} data - Session data
   * @param {Object} result - Result object
   */
  static validateSessionBusinessLogic(data, result) {
    // Session should have reasonable number of problems
    if (
      data.problems &&
      (data.problems.length === 0 || data.problems.length > 20)
    ) {
      const severity =
        data.problems.length === 0
          ? this.SEVERITY.ERROR
          : this.SEVERITY.WARNING;
      const message =
        data.problems.length === 0
          ? "Session must have at least one problem"
          : `Session has unusually high number of problems (${data.problems.length})`;

      if (severity === this.SEVERITY.ERROR) {
        result.valid = false;
        result.errors.push({
          type: "invalid_problem_count",
          message,
          severity,
          field: "problems",
          value: data.problems.length,
        });
      } else {
        result.warnings.push({
          type: "unusual_problem_count",
          message,
          severity,
          field: "problems",
          value: data.problems.length,
        });
      }
    }
  }

  /**
   * Get JSON schema type for a JavaScript value
   * @param {*} value - Value to get type for
   * @returns {string} - JSON schema type
   */
  static getJsonType(value) {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    if (typeof value === "number" && Number.isInteger(value)) return "integer";
    return typeof value;
  }

  /**
   * Sanitize data for logging (remove sensitive information)
   * @param {*} data - Data to sanitize
   * @returns {*} - Sanitized data
   */
  static sanitizeForLogging(data) {
    if (typeof data === "string" && data.length > 100) {
      return data.substring(0, 100) + "...[truncated]";
    }
    return data;
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
      (error) => error.severity === this.SEVERITY.ERROR
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
      console.warn("Failed to report validation errors:", reportError);
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
