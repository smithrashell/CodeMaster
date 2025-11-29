/**
 * Schema Validator Core - Core Validation Functions
 */

import {
  SEVERITY,
  validateFormat,
  validateNumericConstraints,
  validateStringConstraints,
  validateArrayItems,
  getJsonType,
  sanitizeForLogging,
} from "./SchemaValidatorHelpers.js";

/**
 * Validate data type
 */
export function validateType(value, expectedType, result) {
  const actualType = getJsonType(value);

  if (expectedType === actualType) {
    return true;
  }

  result.valid = false;
  result.errors.push({
    type: "type_mismatch",
    message: `Expected type ${expectedType}, got ${actualType}`,
    severity: SEVERITY.ERROR,
    field: "root",
    value: sanitizeForLogging(value),
    expected: expectedType,
    actual: actualType,
  });

  return false;
}

/**
 * Validate required fields
 */
export function validateRequiredFields(data, requiredFields, result) {
  for (const field of requiredFields) {
    if (!(field in data)) {
      result.valid = false;
      result.errors.push({
        type: "required_field_missing",
        message: `Required field '${field}' is missing`,
        severity: SEVERITY.ERROR,
        field,
        value: null,
      });
    } else if (data[field] === null || data[field] === undefined) {
      result.valid = false;
      result.errors.push({
        type: "required_field_null",
        message: `Required field '${field}' cannot be null or undefined`,
        severity: SEVERITY.ERROR,
        field,
        value: data[field],
      });
    }
  }
}

/**
 * Validate object properties
 */
export function validateProperties(data, properties, result, options = {}) {
  const { allowExtra = false, strict = true } = options;

  if (!allowExtra) {
    for (const key in data) {
      if (!(key in properties)) {
        const severity = strict ? SEVERITY.ERROR : SEVERITY.WARNING;
        const message = `Property '${key}' is not defined in schema`;

        if (strict) {
          result.valid = false;
          result.errors.push({
            type: "extra_property",
            message,
            severity,
            field: key,
            value: sanitizeForLogging(data[key]),
          });
        } else {
          result.warnings.push({
            type: "extra_property",
            message,
            severity,
            field: key,
            value: sanitizeForLogging(data[key]),
          });
        }
      }
    }
  }

  for (const [propName, propSchema] of Object.entries(properties)) {
    if (propName in data) {
      const propResult = validateProperty(data[propName], propSchema, propName);

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
 */
export function validateProperty(value, schema, fieldName) {
  const result = {
    valid: true,
    errors: [],
    warnings: [],
  };

  if (schema.type && !validatePropertyType(value, schema, result, fieldName)) {
    return result;
  }

  if (schema.format) {
    validateFormat(value, schema.format, result, fieldName, sanitizeForLogging);
  }

  if (schema.pattern && typeof value === "string") {
    const regex = new RegExp(schema.pattern);
    if (!regex.test(value)) {
      result.valid = false;
      result.errors.push({
        type: "pattern_mismatch",
        message: `Field '${fieldName}' does not match pattern: ${schema.pattern}`,
        severity: SEVERITY.ERROR,
        field: fieldName,
        value: sanitizeForLogging(value),
        pattern: schema.pattern,
      });
    }
  }

  if (schema.enum && !schema.enum.includes(value)) {
    result.valid = false;
    result.errors.push({
      type: "enum_violation",
      message: `Field '${fieldName}' must be one of: [${schema.enum.join(", ")}]`,
      severity: SEVERITY.ERROR,
      field: fieldName,
      value: sanitizeForLogging(value),
      allowedValues: schema.enum,
    });
  }

  if (typeof value === "number") {
    validateNumericConstraints(value, schema, result, fieldName);
  }

  if (typeof value === "string") {
    validateStringConstraints(value, schema, result, fieldName, sanitizeForLogging);
  }

  if (Array.isArray(value) && schema.items) {
    validateArrayItems(value, schema, result, fieldName, validateProperty);
  }

  if (typeof value === "object" && value !== null && schema.properties) {
    validateProperties(value, schema.properties, result);
  }

  return result;
}

/**
 * Validate property type including oneOf support
 */
export function validatePropertyType(value, schema, result, fieldName) {
  if (schema.oneOf) {
    for (const subSchema of schema.oneOf) {
      const subResult = validateProperty(value, subSchema, fieldName);
      if (subResult.valid) {
        return true;
      }
    }

    result.valid = false;
    result.errors.push({
      type: "oneof_violation",
      message: `Field '${fieldName}' does not match any of the allowed schemas`,
      severity: SEVERITY.ERROR,
      field: fieldName,
      value: sanitizeForLogging(value),
    });
    return false;
  }

  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  const actualType = getJsonType(value);

  if (!types.includes(actualType)) {
    result.valid = false;
    result.errors.push({
      type: "type_mismatch",
      message: `Field '${fieldName}' expected type(s) [${types.join(", ")}], got ${actualType}`,
      severity: SEVERITY.ERROR,
      field: fieldName,
      value: sanitizeForLogging(value),
      expected: types,
      actual: actualType,
    });
    return false;
  }

  return true;
}
