/**
 * Tests for SchemaValidator.js
 * Covers: validateData, validateBatch, finalizeResult,
 *   reportValidationErrors, getPerformanceMetrics,
 *   resetPerformanceMetrics, getValidationSummary
 *
 * NOTE: SchemaValidator.js has import paths relative to itself that resolve to
 * non-existent files in test context. We use jest.config moduleNameMapper
 * via manual resolution to handle this.
 */

// SchemaValidator.js imports "../../services/ErrorReportService.js" relative to
// its own location (src/shared/utils/dataIntegrity/), resolving to
// src/shared/services/ErrorReportService.js which doesn't exist on disk.
// From our test file (src/shared/utils/dataIntegrity/__tests__/), that same
// absolute path is reached via "../../../services/ErrorReportService.js".
// We use {virtual: true} since the file doesn't actually exist.
jest.mock('../../../services/ErrorReportService.js', () => ({
  __esModule: true,
  default: {
    storeErrorReport: jest.fn().mockResolvedValue(),
  },
}), { virtual: true });

// SchemaValidator.js also imports "../logger.js" relative to its location,
// resolving to src/shared/utils/logger.js which doesn't exist.
// From our test file that's "../../logger.js".
jest.mock('../../logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}), { virtual: true });

jest.mock('../DataIntegritySchemas.js', () => ({
  __esModule: true,
  default: {
    getStoreSchema: jest.fn(),
  },
}));

import { SchemaValidator } from '../SchemaValidator.js';
import DataIntegritySchemas from '../DataIntegritySchemas.js';
// Import from the virtual mock path to get a reference to the mock
import ErrorReportService from '../../../services/ErrorReportService.js';

beforeEach(() => {
  jest.clearAllMocks();
  SchemaValidator.resetPerformanceMetrics();
});

// ---------------------------------------------------------------------------
// validateData
// ---------------------------------------------------------------------------
describe('SchemaValidator.validateData', () => {
  it('returns error when no schema is found', () => {
    DataIntegritySchemas.getStoreSchema.mockReturnValue(null);

    const result = SchemaValidator.validateData('unknown_store', {});
    expect(result.valid).toBe(false);
    expect(result.errors[0].type).toBe('schema_not_found');
  });

  it('validates a simple object successfully', () => {
    DataIntegritySchemas.getStoreSchema.mockReturnValue({
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
      },
    });

    const result = SchemaValidator.validateData('test', { id: 1, name: 'hello' });
    expect(result.valid).toBe(true);
    expect(result.checksPerformed).toContain('schema_lookup');
    expect(result.checksPerformed).toContain('type_validation');
    expect(result.checksPerformed).toContain('required_fields');
    expect(result.checksPerformed).toContain('property_validation');
    expect(result.checksPerformed).toContain('business_logic');
  });

  it('fails on type mismatch', () => {
    DataIntegritySchemas.getStoreSchema.mockReturnValue({
      type: 'array',
    });

    const result = SchemaValidator.validateData('test', { not: 'array' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.type === 'type_mismatch')).toBe(true);
  });

  it('validates required fields', () => {
    DataIntegritySchemas.getStoreSchema.mockReturnValue({
      type: 'object',
      required: ['id', 'name'],
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
      },
    });

    const result = SchemaValidator.validateData('test', { id: 1 });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.type === 'required_field_missing')).toBe(true);
  });

  it('skips required validation when validateRequired=false', () => {
    DataIntegritySchemas.getStoreSchema.mockReturnValue({
      type: 'object',
      required: ['id', 'name'],
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
      },
    });

    const result = SchemaValidator.validateData('test', { id: 1 }, { validateRequired: false });
    // Should not fail for missing 'name'
    expect(result.errors.filter(e => e.type === 'required_field_missing')).toHaveLength(0);
  });

  it('skips business logic when skipBusinessLogic=true', () => {
    DataIntegritySchemas.getStoreSchema.mockReturnValue({
      type: 'object',
      properties: {},
    });

    const result = SchemaValidator.validateData('attempts', {}, { skipBusinessLogic: true, allowExtraProperties: true });
    expect(result.checksPerformed).not.toContain('business_logic');
  });

  it('allows extra properties when allowExtraProperties=true', () => {
    DataIntegritySchemas.getStoreSchema.mockReturnValue({
      type: 'object',
      properties: { id: { type: 'integer' } },
    });

    const result = SchemaValidator.validateData('test', { id: 1, extra: 'field' }, { allowExtraProperties: true });
    expect(result.errors.filter(e => e.type === 'extra_property')).toHaveLength(0);
  });

  it('handles exceptions during validation', () => {
    DataIntegritySchemas.getStoreSchema.mockImplementation(() => {
      throw new Error('schema crash');
    });

    const result = SchemaValidator.validateData('test', {});
    expect(result.valid).toBe(false);
    expect(result.errors[0].type).toBe('validation_exception');
    expect(result.errors[0].message).toContain('schema crash');
  });

  it('tracks validation time', () => {
    DataIntegritySchemas.getStoreSchema.mockReturnValue({
      type: 'object',
      properties: {},
    });

    const result = SchemaValidator.validateData('test', {}, { allowExtraProperties: true });
    expect(result.validationTime).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// validateBatch
// ---------------------------------------------------------------------------
describe('SchemaValidator.validateBatch', () => {
  beforeEach(() => {
    DataIntegritySchemas.getStoreSchema.mockReturnValue({
      type: 'object',
      properties: { id: { type: 'integer' } },
    });
  });

  it('validates a batch of items', () => {
    const items = [
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ];

    const result = SchemaValidator.validateBatch('test', items, { allowExtraProperties: true });
    expect(result.totalItems).toBe(3);
    expect(result.validItems).toBe(3);
    expect(result.invalidItems).toBe(0);
    expect(result.valid).toBe(true);
  });

  it('counts invalid items', () => {
    DataIntegritySchemas.getStoreSchema.mockReturnValue({
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'integer' } },
    });

    const items = [
      { id: 1 },
      {}, // missing required id
    ];

    const result = SchemaValidator.validateBatch('test', items);
    expect(result.invalidItems).toBe(1);
    expect(result.valid).toBe(false);
  });

  it('stops on first error when stopOnFirstError=true', () => {
    DataIntegritySchemas.getStoreSchema.mockReturnValue({
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'integer' } },
    });

    const items = [{}, {}, {}]; // all invalid
    const result = SchemaValidator.validateBatch('test', items, { stopOnFirstError: true });
    expect(result.results).toHaveLength(1);
  });

  it('stops when maxErrors is reached', () => {
    DataIntegritySchemas.getStoreSchema.mockReturnValue({
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'integer' } },
    });

    const items = Array(10).fill({});
    const result = SchemaValidator.validateBatch('test', items, { maxErrors: 3 });
    // Should stop after accumulating ~3 errors
    expect(result.results.length).toBeLessThanOrEqual(10);
    expect(result.summary.errors).toBeGreaterThanOrEqual(3);
  });

  it('reports progress during batch validation', () => {
    const items = Array(150).fill({ id: 1 });
    const result = SchemaValidator.validateBatch('test', items, { reportProgress: true, allowExtraProperties: true });
    expect(result.totalItems).toBe(150);
  });

  it('calculates total and average time', () => {
    const items = [{ id: 1 }, { id: 2 }];
    const result = SchemaValidator.validateBatch('test', items, { allowExtraProperties: true });
    expect(result.totalTime).toBeGreaterThanOrEqual(0);
    expect(result.avgItemTime).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// finalizeResult & reportValidationErrors
// ---------------------------------------------------------------------------
describe('SchemaValidator.finalizeResult', () => {
  it('updates performance metrics for success', () => {
    SchemaValidator.resetPerformanceMetrics();
    DataIntegritySchemas.getStoreSchema.mockReturnValue({
      type: 'object',
      properties: {},
    });

    SchemaValidator.validateData('test', {}, { allowExtraProperties: true });

    const metrics = SchemaValidator.getPerformanceMetrics();
    expect(metrics.validationCount).toBe(1);
    expect(metrics.successCount).toBe(1);
    expect(metrics.errorCount).toBe(0);
  });

  it('updates performance metrics for failure', () => {
    SchemaValidator.resetPerformanceMetrics();
    // Use a schema that triggers a type mismatch so it goes through finalizeResult
    DataIntegritySchemas.getStoreSchema.mockReturnValue({
      type: 'array',
    });

    SchemaValidator.validateData('test', { not: 'array' });

    const metrics = SchemaValidator.getPerformanceMetrics();
    expect(metrics.errorCount).toBe(1);
  });

  it('reports critical errors to ErrorReportService', () => {
    // Trigger a validation failure that goes through finalizeResult
    DataIntegritySchemas.getStoreSchema.mockReturnValue({
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'integer' } },
    });

    SchemaValidator.validateData('test', {});

    expect(ErrorReportService.storeErrorReport).toHaveBeenCalledWith(
      expect.objectContaining({
        section: 'Data Integrity',
        errorType: 'validation_failure',
      })
    );
  });

  it('handles ErrorReportService failure gracefully', () => {
    ErrorReportService.storeErrorReport.mockRejectedValueOnce(new Error('report fail'));
    DataIntegritySchemas.getStoreSchema.mockReturnValue({
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'integer' } },
    });

    // Should not throw
    const result = SchemaValidator.validateData('test', {});
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getPerformanceMetrics / resetPerformanceMetrics / getValidationSummary
// ---------------------------------------------------------------------------
describe('Performance metrics', () => {
  beforeEach(() => {
    SchemaValidator.resetPerformanceMetrics();
  });

  it('returns initial metrics after reset', () => {
    const metrics = SchemaValidator.getPerformanceMetrics();
    expect(metrics.validationCount).toBe(0);
    expect(metrics.totalValidationTime).toBe(0);
    expect(metrics.avgValidationTime).toBe(0);
    expect(metrics.errorCount).toBe(0);
    expect(metrics.successCount).toBe(0);
  });

  it('getPerformanceMetrics returns a copy', () => {
    const m1 = SchemaValidator.getPerformanceMetrics();
    const m2 = SchemaValidator.getPerformanceMetrics();
    expect(m1).toEqual(m2);
    expect(m1).not.toBe(m2); // different object reference
  });

  it('getValidationSummary includes successRate', () => {
    DataIntegritySchemas.getStoreSchema.mockReturnValue({
      type: 'object',
      properties: {},
    });

    SchemaValidator.validateData('test', {}, { allowExtraProperties: true });
    SchemaValidator.validateData('test', {}, { allowExtraProperties: true });

    const summary = SchemaValidator.getValidationSummary();
    expect(summary.successRate).toBe(1);
    expect(summary.validationCount).toBe(2);
    expect(summary.avgValidationTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('getValidationSummary returns 0 successRate when no validations', () => {
    const summary = SchemaValidator.getValidationSummary();
    expect(summary.successRate).toBe(0);
  });
});
