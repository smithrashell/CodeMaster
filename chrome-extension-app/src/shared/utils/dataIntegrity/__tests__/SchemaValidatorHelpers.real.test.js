/**
 * Tests for SchemaValidatorHelpers.js
 * Covers: SEVERITY, validateFormat, validateNumericConstraints,
 *   validateStringConstraints, validateAttemptBusinessLogic,
 *   validateProblemBusinessLogic, validateTagMasteryBusinessLogic,
 *   validateSessionBusinessLogic, validateBusinessLogic,
 *   validateArrayItems, getJsonType, sanitizeForLogging
 */

// No external dependencies to mock (SchemaValidatorCore re-exports are tested separately)

import {
  SEVERITY,
  validateFormat,
  validateNumericConstraints,
  validateStringConstraints,
  validateAttemptBusinessLogic,
  validateProblemBusinessLogic,
  validateTagMasteryBusinessLogic,
  validateSessionBusinessLogic,
  validateBusinessLogic,
  validateArrayItems,
  getJsonType,
  sanitizeForLogging,
} from '../SchemaValidatorHelpers.js';

function makeResult() {
  return { valid: true, errors: [], warnings: [] };
}

const sanitize = sanitizeForLogging;

// ---------------------------------------------------------------------------
// SEVERITY
// ---------------------------------------------------------------------------
describe('SEVERITY', () => {
  it('has error, warning, and info levels', () => {
    expect(SEVERITY.ERROR).toBe('error');
    expect(SEVERITY.WARNING).toBe('warning');
    expect(SEVERITY.INFO).toBe('info');
  });
});

// ---------------------------------------------------------------------------
// sanitizeForLogging
// ---------------------------------------------------------------------------
describe('sanitizeForLogging', () => {
  it('truncates strings longer than 100 characters', () => {
    const longStr = 'a'.repeat(150);
    const result = sanitizeForLogging(longStr);
    expect(result).toHaveLength(100 + '...[truncated]'.length);
    expect(result).toContain('...[truncated]');
  });

  it('returns short strings unchanged', () => {
    expect(sanitizeForLogging('hello')).toBe('hello');
  });

  it('returns non-string values unchanged', () => {
    expect(sanitizeForLogging(42)).toBe(42);
    expect(sanitizeForLogging(null)).toBe(null);
    expect(sanitizeForLogging(undefined)).toBe(undefined);
  });

  it('returns exactly 100-char strings unchanged', () => {
    const str = 'a'.repeat(100);
    expect(sanitizeForLogging(str)).toBe(str);
  });
});

// ---------------------------------------------------------------------------
// getJsonType
// ---------------------------------------------------------------------------
describe('getJsonType', () => {
  it('returns "null" for null', () => {
    expect(getJsonType(null)).toBe('null');
  });

  it('returns "array" for arrays', () => {
    expect(getJsonType([])).toBe('array');
    expect(getJsonType([1, 2])).toBe('array');
  });

  it('returns "integer" for integer numbers', () => {
    expect(getJsonType(42)).toBe('integer');
    expect(getJsonType(0)).toBe('integer');
    expect(getJsonType(-5)).toBe('integer');
  });

  it('returns "number" for non-integer numbers', () => {
    expect(getJsonType(3.14)).toBe('number');
    expect(getJsonType(0.5)).toBe('number');
  });

  it('returns "string" for strings', () => {
    expect(getJsonType('')).toBe('string');
    expect(getJsonType('hello')).toBe('string');
  });

  it('returns "boolean" for booleans', () => {
    expect(getJsonType(true)).toBe('boolean');
    expect(getJsonType(false)).toBe('boolean');
  });

  it('returns "object" for objects', () => {
    expect(getJsonType({})).toBe('object');
    expect(getJsonType({ a: 1 })).toBe('object');
  });

  it('returns "undefined" for undefined', () => {
    expect(getJsonType(undefined)).toBe('undefined');
  });
});

// ---------------------------------------------------------------------------
// validateFormat
// ---------------------------------------------------------------------------
describe('validateFormat', () => {
  it('does nothing for non-string values', () => {
    const result = makeResult();
    validateFormat(42, 'date-time', result, 'field', sanitize);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('validates date-time format - valid', () => {
    const result = makeResult();
    validateFormat('2024-01-15T10:30:00Z', 'date-time', result, 'date', sanitize);
    expect(result.valid).toBe(true);
  });

  it('validates date-time format - invalid', () => {
    const result = makeResult();
    validateFormat('not-a-date', 'date-time', result, 'date', sanitize);
    expect(result.valid).toBe(false);
    expect(result.errors[0].type).toBe('format_violation');
  });

  it('validates email format - valid', () => {
    const result = makeResult();
    validateFormat('test@example.com', 'email', result, 'email', sanitize);
    expect(result.valid).toBe(true);
  });

  it('validates email format - invalid', () => {
    const result = makeResult();
    validateFormat('not-an-email', 'email', result, 'email', sanitize);
    expect(result.valid).toBe(false);
  });

  it('validates uuid format - valid', () => {
    const result = makeResult();
    validateFormat('550e8400-e29b-41d4-a716-446655440000', 'uuid', result, 'id', sanitize);
    expect(result.valid).toBe(true);
  });

  it('validates uuid format - invalid', () => {
    const result = makeResult();
    validateFormat('not-a-uuid', 'uuid', result, 'id', sanitize);
    expect(result.valid).toBe(false);
  });

  it('warns about unknown format', () => {
    const result = makeResult();
    validateFormat('something', 'custom-format', result, 'field', sanitize);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].type).toBe('unknown_format');
  });
});

// ---------------------------------------------------------------------------
// validateNumericConstraints
// ---------------------------------------------------------------------------
describe('validateNumericConstraints', () => {
  it('validates minimum constraint', () => {
    const result = makeResult();
    validateNumericConstraints(3, { minimum: 5 }, result, 'count');
    expect(result.valid).toBe(false);
    expect(result.errors[0].type).toBe('minimum_violation');
  });

  it('passes when value equals minimum', () => {
    const result = makeResult();
    validateNumericConstraints(5, { minimum: 5 }, result, 'count');
    expect(result.valid).toBe(true);
  });

  it('validates maximum constraint', () => {
    const result = makeResult();
    validateNumericConstraints(10, { maximum: 5 }, result, 'count');
    expect(result.valid).toBe(false);
    expect(result.errors[0].type).toBe('maximum_violation');
  });

  it('passes when value equals maximum', () => {
    const result = makeResult();
    validateNumericConstraints(5, { maximum: 5 }, result, 'count');
    expect(result.valid).toBe(true);
  });

  it('validates integer constraint', () => {
    const result = makeResult();
    validateNumericConstraints(3.5, { type: 'integer' }, result, 'count');
    expect(result.valid).toBe(false);
    expect(result.errors[0].type).toBe('integer_violation');
  });

  it('passes integer constraint for integers', () => {
    const result = makeResult();
    validateNumericConstraints(3, { type: 'integer' }, result, 'count');
    expect(result.valid).toBe(true);
  });

  it('can flag both minimum and maximum violations', () => {
    const result = makeResult();
    validateNumericConstraints(-1, { minimum: 0, maximum: 100 }, result, 'score');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].type).toBe('minimum_violation');
  });
});

// ---------------------------------------------------------------------------
// validateStringConstraints
// ---------------------------------------------------------------------------
describe('validateStringConstraints', () => {
  it('validates minLength', () => {
    const result = makeResult();
    validateStringConstraints('ab', { minLength: 3 }, result, 'name', sanitize);
    expect(result.valid).toBe(false);
    expect(result.errors[0].type).toBe('minlength_violation');
  });

  it('passes when length equals minLength', () => {
    const result = makeResult();
    validateStringConstraints('abc', { minLength: 3 }, result, 'name', sanitize);
    expect(result.valid).toBe(true);
  });

  it('validates maxLength', () => {
    const result = makeResult();
    validateStringConstraints('abcdefg', { maxLength: 5 }, result, 'name', sanitize);
    expect(result.valid).toBe(false);
    expect(result.errors[0].type).toBe('maxlength_violation');
  });

  it('passes when length equals maxLength', () => {
    const result = makeResult();
    validateStringConstraints('abcde', { maxLength: 5 }, result, 'name', sanitize);
    expect(result.valid).toBe(true);
  });

  it('validates both min and max', () => {
    const result = makeResult();
    validateStringConstraints('a', { minLength: 3, maxLength: 10 }, result, 'name', sanitize);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].type).toBe('minlength_violation');
  });
});

// ---------------------------------------------------------------------------
// validateAttemptBusinessLogic
// ---------------------------------------------------------------------------
describe('validateAttemptBusinessLogic', () => {
  it('warns for unusual time spent (< 30s)', () => {
    const result = makeResult();
    validateAttemptBusinessLogic({ timeSpent: 10 }, result);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].type).toBe('unusual_time_spent');
  });

  it('warns for unusual time spent (> 7200s)', () => {
    const result = makeResult();
    validateAttemptBusinessLogic({ timeSpent: 8000 }, result);
    expect(result.warnings[0].type).toBe('unusual_time_spent');
  });

  it('does not warn for normal time', () => {
    const result = makeResult();
    validateAttemptBusinessLogic({ timeSpent: 600 }, result);
    expect(result.warnings).toHaveLength(0);
  });

  it('errors for future date', () => {
    const result = makeResult();
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    validateAttemptBusinessLogic({ date: futureDate }, result);
    expect(result.valid).toBe(false);
    expect(result.errors[0].type).toBe('future_date');
  });

  it('passes for past date', () => {
    const result = makeResult();
    validateAttemptBusinessLogic({ date: '2023-01-01T00:00:00Z' }, result);
    expect(result.valid).toBe(true);
  });

  it('does not check date when absent', () => {
    const result = makeResult();
    validateAttemptBusinessLogic({}, result);
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateProblemBusinessLogic
// ---------------------------------------------------------------------------
describe('validateProblemBusinessLogic', () => {
  it('errors when successful attempts exceed total', () => {
    const result = makeResult();
    validateProblemBusinessLogic({
      attempt_stats: { total_attempts: 5, successful_attempts: 10 },
    }, result);
    expect(result.valid).toBe(false);
    expect(result.errors[0].type).toBe('impossible_success_rate');
  });

  it('warns for inconsistent box level', () => {
    const result = makeResult();
    validateProblemBusinessLogic({
      attempt_stats: { total_attempts: 0, successful_attempts: 0 },
      BoxLevel: 3,
    }, result);
    expect(result.warnings[0].type).toBe('inconsistent_box_level');
  });

  it('does not warn when box level is 0 with no attempts', () => {
    const result = makeResult();
    validateProblemBusinessLogic({
      attempt_stats: { total_attempts: 0, successful_attempts: 0 },
      BoxLevel: 0,
    }, result);
    expect(result.warnings).toHaveLength(0);
  });

  it('does nothing when attempt_stats is absent', () => {
    const result = makeResult();
    validateProblemBusinessLogic({}, result);
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateTagMasteryBusinessLogic
// ---------------------------------------------------------------------------
describe('validateTagMasteryBusinessLogic', () => {
  it('warns when success rate does not match calculated value', () => {
    const result = makeResult();
    validateTagMasteryBusinessLogic({
      totalAttempts: 10,
      successfulAttempts: 7,
      successRate: 0.5, // should be 0.7
    }, result);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].type).toBe('inconsistent_success_rate');
  });

  it('does not warn when success rate matches within tolerance', () => {
    const result = makeResult();
    validateTagMasteryBusinessLogic({
      totalAttempts: 10,
      successfulAttempts: 7,
      successRate: 0.7,
    }, result);
    expect(result.warnings).toHaveLength(0);
  });

  it('does nothing when fields are missing', () => {
    const result = makeResult();
    validateTagMasteryBusinessLogic({}, result);
    expect(result.warnings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// validateSessionBusinessLogic
// ---------------------------------------------------------------------------
describe('validateSessionBusinessLogic', () => {
  it('errors when session has 0 problems', () => {
    const result = makeResult();
    validateSessionBusinessLogic({ problems: [] }, result);
    expect(result.valid).toBe(false);
    expect(result.errors[0].type).toBe('invalid_problem_count');
  });

  it('warns when session has > 20 problems', () => {
    const result = makeResult();
    validateSessionBusinessLogic({ problems: Array(25).fill({}) }, result);
    expect(result.valid).toBe(true);
    expect(result.warnings[0].type).toBe('unusual_problem_count');
  });

  it('does nothing for normal problem count', () => {
    const result = makeResult();
    validateSessionBusinessLogic({ problems: Array(5).fill({}) }, result);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('does nothing when problems is absent', () => {
    const result = makeResult();
    validateSessionBusinessLogic({}, result);
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateBusinessLogic (dispatcher)
// ---------------------------------------------------------------------------
describe('validateBusinessLogic', () => {
  it('dispatches to attempts logic', () => {
    const result = makeResult();
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    validateBusinessLogic('attempts', { date: futureDate }, result);
    expect(result.valid).toBe(false);
  });

  it('dispatches to problems logic', () => {
    const result = makeResult();
    validateBusinessLogic('problems', {
      attempt_stats: { total_attempts: 1, successful_attempts: 5 },
    }, result);
    expect(result.valid).toBe(false);
  });

  it('dispatches to tag_mastery logic', () => {
    const result = makeResult();
    validateBusinessLogic('tag_mastery', {
      totalAttempts: 10, successfulAttempts: 5, successRate: 0.1,
    }, result);
    expect(result.warnings).toHaveLength(1);
  });

  it('dispatches to sessions logic', () => {
    const result = makeResult();
    validateBusinessLogic('sessions', { problems: [] }, result);
    expect(result.valid).toBe(false);
  });

  it('does nothing for unknown store', () => {
    const result = makeResult();
    validateBusinessLogic('unknown_store', {}, result);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// validateArrayItems
// ---------------------------------------------------------------------------
describe('validateArrayItems', () => {
  it('validates uniqueItems constraint', () => {
    const result = makeResult();
    const mockValidateProperty = jest.fn(() => ({ valid: true, errors: [], warnings: [] }));
    validateArrayItems([1, 2, 1], { uniqueItems: true, items: { type: 'integer' } }, result, 'arr', mockValidateProperty);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.type === 'unique_items_violation')).toBe(true);
  });

  it('passes uniqueItems with unique items', () => {
    const result = makeResult();
    const mockValidateProperty = jest.fn(() => ({ valid: true, errors: [], warnings: [] }));
    validateArrayItems([1, 2, 3], { uniqueItems: true, items: { type: 'integer' } }, result, 'arr', mockValidateProperty);
    expect(result.valid).toBe(true);
  });

  it('validates each item using validateProperty callback', () => {
    const result = makeResult();
    const mockValidateProperty = jest.fn(() => ({
      valid: false,
      errors: [{ type: 'type_mismatch', message: 'bad' }],
      warnings: [],
    }));

    validateArrayItems(['a', 'b'], { items: { type: 'integer' } }, result, 'arr', mockValidateProperty);

    expect(mockValidateProperty).toHaveBeenCalledTimes(2);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
  });

  it('collects warnings from item validation', () => {
    const result = makeResult();
    const mockValidateProperty = jest.fn(() => ({
      valid: true,
      errors: [],
      warnings: [{ type: 'warn', message: 'w' }],
    }));

    validateArrayItems([1], { items: { type: 'integer' } }, result, 'arr', mockValidateProperty);
    expect(result.warnings).toHaveLength(1);
  });

  it('handles empty arrays', () => {
    const result = makeResult();
    const mockValidateProperty = jest.fn();
    validateArrayItems([], { items: { type: 'integer' } }, result, 'arr', mockValidateProperty);
    expect(mockValidateProperty).not.toHaveBeenCalled();
    expect(result.valid).toBe(true);
  });
});
