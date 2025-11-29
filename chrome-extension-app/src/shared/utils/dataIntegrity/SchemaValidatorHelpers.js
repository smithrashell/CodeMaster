/**
 * Schema Validator Helpers - Business Logic and Constraint Validators
 */

// Severity levels
export const SEVERITY = {
  ERROR: "error",
  WARNING: "warning",
  INFO: "info",
};

/**
 * Validate format constraints (date-time, email, etc.)
 */
export function validateFormat(value, format, result, fieldName, sanitizeForLogging) {
  if (typeof value !== "string") {
    return;
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
      result.warnings.push({
        type: "unknown_format",
        message: `Unknown format '${format}' for field '${fieldName}'`,
        severity: SEVERITY.WARNING,
        field: fieldName,
        value: sanitizeForLogging(value),
        format,
      });
      return;
  }

  if (!isValid) {
    result.valid = false;
    result.errors.push({
      type: "format_violation",
      message: `Field '${fieldName}': ${errorMessage}`,
      severity: SEVERITY.ERROR,
      field: fieldName,
      value: sanitizeForLogging(value),
      format,
    });
  }
}

/**
 * Validate numeric constraints
 */
export function validateNumericConstraints(value, schema, result, fieldName) {
  if (schema.minimum !== undefined && value < schema.minimum) {
    result.valid = false;
    result.errors.push({
      type: "minimum_violation",
      message: `Field '${fieldName}' must be >= ${schema.minimum}`,
      severity: SEVERITY.ERROR,
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
      severity: SEVERITY.ERROR,
      field: fieldName,
      value,
      maximum: schema.maximum,
    });
  }

  if (schema.type === "integer" && !Number.isInteger(value)) {
    result.valid = false;
    result.errors.push({
      type: "integer_violation",
      message: `Field '${fieldName}' must be an integer`,
      severity: SEVERITY.ERROR,
      field: fieldName,
      value,
    });
  }
}

/**
 * Validate string constraints
 */
export function validateStringConstraints(value, schema, result, fieldName, sanitizeForLogging) {
  if (schema.minLength !== undefined && value.length < schema.minLength) {
    result.valid = false;
    result.errors.push({
      type: "minlength_violation",
      message: `Field '${fieldName}' must have at least ${schema.minLength} characters`,
      severity: SEVERITY.ERROR,
      field: fieldName,
      value: sanitizeForLogging(value),
      minLength: schema.minLength,
      actualLength: value.length,
    });
  }

  if (schema.maxLength !== undefined && value.length > schema.maxLength) {
    result.valid = false;
    result.errors.push({
      type: "maxlength_violation",
      message: `Field '${fieldName}' must have at most ${schema.maxLength} characters`,
      severity: SEVERITY.ERROR,
      field: fieldName,
      value: sanitizeForLogging(value),
      maxLength: schema.maxLength,
      actualLength: value.length,
    });
  }
}

/**
 * Validate attempt-specific business logic
 */
export function validateAttemptBusinessLogic(data, result) {
  if (data.timeSpent && (data.timeSpent < 30 || data.timeSpent > 7200)) {
    result.warnings.push({
      type: "unusual_time_spent",
      message: `Time spent (${data.timeSpent}s) seems unusual for a problem attempt`,
      severity: SEVERITY.WARNING,
      field: "timeSpent",
      value: data.timeSpent,
      suggestion: "Verify time tracking accuracy",
    });
  }

  if (data.date) {
    const attemptDate = new Date(data.date);
    const now = new Date();
    if (attemptDate > now) {
      result.valid = false;
      result.errors.push({
        type: "future_date",
        message: "Attempt date cannot be in the future",
        severity: SEVERITY.ERROR,
        field: "date",
        value: data.date,
      });
    }
  }
}

/**
 * Validate problem-specific business logic
 */
export function validateProblemBusinessLogic(data, result) {
  if (data.attempt_stats) {
    const { total_attempts, successful_attempts } = data.attempt_stats;

    if (successful_attempts > total_attempts) {
      result.valid = false;
      result.errors.push({
        type: "impossible_success_rate",
        message: "Successful attempts cannot exceed total attempts",
        severity: SEVERITY.ERROR,
        field: "attempt_stats",
        value: { total_attempts, successful_attempts },
      });
    }

    if (
      data.BoxLevel !== undefined &&
      total_attempts === 0 &&
      data.BoxLevel > 0
    ) {
      result.warnings.push({
        type: "inconsistent_box_level",
        message: "Problem has box level > 0 but no attempts recorded",
        severity: SEVERITY.WARNING,
        field: "BoxLevel",
        value: data.BoxLevel,
        suggestion: "Verify box level calculation",
      });
    }
  }
}

/**
 * Validate tag mastery business logic
 */
export function validateTagMasteryBusinessLogic(data, result) {
  if (
    data.totalAttempts &&
    data.successfulAttempts &&
    data.successRate !== undefined
  ) {
    const calculatedRate = data.totalAttempts > 0 ? data.successfulAttempts / data.totalAttempts : 0;
    const tolerance = 0.01;

    if (Math.abs(calculatedRate - data.successRate) > tolerance) {
      result.warnings.push({
        type: "inconsistent_success_rate",
        message: "Success rate does not match calculated value from attempts",
        severity: SEVERITY.WARNING,
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
 */
export function validateSessionBusinessLogic(data, result) {
  if (
    data.problems &&
    (data.problems.length === 0 || data.problems.length > 20)
  ) {
    const severity =
      data.problems.length === 0
        ? SEVERITY.ERROR
        : SEVERITY.WARNING;
    const message =
      data.problems.length === 0
        ? "Session must have at least one problem"
        : `Session has unusually high number of problems (${data.problems.length})`;

    if (severity === SEVERITY.ERROR) {
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
 * Validate business logic specific to CodeMaster
 */
export function validateBusinessLogic(storeName, data, result) {
  switch (storeName) {
    case "attempts":
      validateAttemptBusinessLogic(data, result);
      break;
    case "problems":
      validateProblemBusinessLogic(data, result);
      break;
    case "tag_mastery":
      validateTagMasteryBusinessLogic(data, result);
      break;
    case "sessions":
      validateSessionBusinessLogic(data, result);
      break;
    default:
      break;
  }
}

/**
 * Validate array items
 */
export function validateArrayItems(value, schema, result, fieldName, validateProperty) {
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
        severity: SEVERITY.ERROR,
        field: fieldName,
        duplicateIndexes: duplicates,
      });
    }
  }

  for (let i = 0; i < value.length; i++) {
    const itemResult = validateProperty(
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
 * Get JSON schema type for a JavaScript value
 */
export function getJsonType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number" && Number.isInteger(value)) return "integer";
  return typeof value;
}

/**
 * Sanitize data for logging (remove sensitive information)
 */
export function sanitizeForLogging(data) {
  if (typeof data === "string" && data.length > 100) {
    return data.substring(0, 100) + "...[truncated]";
  }
  return data;
}

// Re-export core validation functions from SchemaValidatorCore
export {
  validateType,
  validateRequiredFields,
  validateProperties,
  validateProperty,
  validatePropertyType,
} from "./SchemaValidatorCore.js";
