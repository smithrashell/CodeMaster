/**
 * Fixed comprehensive test suite for DataIntegrityCheckService
 * 
 * Tests all major functionality with proper async cleanup to prevent hanging
 */

import { jest } from '@jest/globals';

// Mock dependencies first
jest.mock('../../../db/index.js');
jest.mock('../../../utils/dataIntegrity/SchemaValidator.js');
jest.mock('../ReferentialIntegrityService.js');
jest.mock('../../../utils/dataIntegrity/DataIntegritySchemas.js');
jest.mock('../../../utils/storageHealth.js');
jest.mock('../../ErrorReportService.js');

// Import after mocking
import DataIntegrityCheckService from '../DataIntegrityCheckService.js';
import SchemaValidator from '../../../utils/dataIntegrity/SchemaValidator.js';
import ReferentialIntegrityService from '../ReferentialIntegrityService.js';
import DataIntegritySchemas from '../../../utils/dataIntegrity/DataIntegritySchemas.js';
import { dbHelper } from '../../../db/index.js';

describe('DataIntegrityCheckService', () => {
  let mockDb;
  let mockTransaction;
  let mockObjectStore;
  let activeTimers = [];
  let activePromises = [];

  // Helper to create properly resolved mock requests
  const createMockRequest = (result = []) => {
    const mockRequest = {
      onsuccess: null,
      onerror: null,
      result
    };

    // Use immediate resolution instead of setTimeout
    const promise = Promise.resolve().then(() => {
      if (mockRequest.onsuccess) {
        mockRequest.onsuccess();
      }
    });
    
    activePromises.push(promise);
    return mockRequest;
  };

  beforeEach(() => {
    // Clear all mocks and active operations
    jest.clearAllMocks();
    activeTimers = [];
    activePromises = [];
    
    // Setup mock database with proper cleanup
    mockObjectStore = {
      getAll: jest.fn(() => createMockRequest([
        { id: '1', name: 'test1' },
        { id: '2', name: 'test2' },
        { id: '3', name: 'test3' }
      ])),
      get: jest.fn(() => createMockRequest({ id: '1', name: 'test' })),
      put: jest.fn(() => createMockRequest()),
      delete: jest.fn(() => createMockRequest())
    };

    mockTransaction = {
      objectStore: jest.fn(() => mockObjectStore),
      oncomplete: null,
      onerror: null
    };

    mockDb = {
      transaction: jest.fn(() => mockTransaction),
      objectStoreNames: {
        contains: jest.fn(() => true)
      }
    };

    dbHelper.openDB.mockResolvedValue(mockDb);

    // Setup schema mocks
    DataIntegritySchemas.getStoreNames.mockReturnValue(['problems', 'attempts', 'sessions']);
    DataIntegritySchemas.getStoreSchema.mockReturnValue({
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string' } }
    });

    // Setup validator mocks with immediate resolution
    SchemaValidator.validateBatch.mockReturnValue({
      valid: true,
      totalItems: 5,
      validItems: 5,
      invalidItems: 0,
      results: Array(5).fill({ valid: true, errors: [], warnings: [] }),
      totalTime: 100,
      avgItemTime: 20
    });

    // Setup referential integrity mocks
    ReferentialIntegrityService.checkAllReferentialIntegrity.mockResolvedValue({
      overall: { valid: true, violationCount: 0 },
      integrityScore: 100
    });

    // Mock performance.now()
    global.performance = { now: jest.fn(() => Date.now()) };
  });

  afterEach(async () => {
    // Ensure all monitoring is stopped
    try {
      DataIntegrityCheckService.stopPeriodicMonitoring();
    } catch (error) {
      // Ignore errors during cleanup
    }

    // Clear any active timers
    activeTimers.forEach(timer => {
      if (timer && typeof timer === 'number') {
        clearTimeout(timer);
        clearInterval(timer);
      }
    });
    
    // Wait for all active promises to resolve
    if (activePromises.length > 0) {
      await Promise.allSettled(activePromises);
    }

    // Use fake timers to ensure cleanup
    if (jest.isMockFunction(setTimeout)) {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    }

    // Clear any service-level state
    if (DataIntegrityCheckService.checkHistory) {
      DataIntegrityCheckService.checkHistory = [];
    }
  });

  describe('performIntegrityCheck', () => {
    it('should perform a full integrity check successfully', async () => {
      const result = await DataIntegrityCheckService.performIntegrityCheck({
        checkType: 'full',
        stores: ['problems', 'attempts'],
        priority: 'high'
      });

      expect(result).toMatchObject({
        checkType: 'full',
        priority: 'high',
        overall: {
          valid: expect.any(Boolean),
          score: expect.any(Number)
        },
        performanceMetrics: {
          totalTime: expect.any(Number)
        }
      });

      expect(result.checkId).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should perform a quick check with limited validation', async () => {
      const result = await DataIntegrityCheckService.performIntegrityCheck({
        checkType: 'quick',
        stores: ['problems'],
        priority: 'low'
      });

      expect(result.checkType).toBe('quick');
      expect(result.overall).toBeDefined();
      expect(result.performanceMetrics).toBeDefined();
    });

    it('should handle database errors gracefully', async () => {
      dbHelper.openDB.mockRejectedValue(new Error('Database connection failed'));

      const result = await DataIntegrityCheckService.performIntegrityCheck({
        checkType: 'full',
        stores: ['problems']
      });

      expect(result.overall.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Monitoring (with proper cleanup)', () => {
    beforeEach(() => {
      // Use fake timers for monitoring tests
      jest.useFakeTimers('modern');
    });

    afterEach(() => {
      // Ensure real timers are restored
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it('should start and stop periodic monitoring', () => {
      const config = {
        quickCheckInterval: 1000,
        fullCheckInterval: 5000,
        autoRepair: false
      };

      // Start monitoring
      DataIntegrityCheckService.startPeriodicMonitoring(config);

      let status = DataIntegrityCheckService.getMonitoringStatus();
      expect(status.active).toBe(true);

      // Stop monitoring
      DataIntegrityCheckService.stopPeriodicMonitoring();

      status = DataIntegrityCheckService.getMonitoringStatus();
      expect(status.active).toBe(false);
    });

    it('should handle monitoring intervals correctly', async () => {
      const performIntegrityCheckSpy = jest.spyOn(
        DataIntegrityCheckService, 
        'performIntegrityCheck'
      ).mockResolvedValue({ overall: { valid: true, errors: 0 } });

      DataIntegrityCheckService.startPeriodicMonitoring({
        quickCheckInterval: 1000,
        fullCheckInterval: 10000
      });

      // Fast-forward time
      jest.advanceTimersByTime(1000);
      
      // Allow promises to resolve
      await Promise.resolve();

      expect(performIntegrityCheckSpy).toHaveBeenCalled();

      performIntegrityCheckSpy.mockRestore();
    });
  });

  describe('History Management', () => {
    it('should maintain check history', async () => {
      // Run a few checks
      await DataIntegrityCheckService.performIntegrityCheck({
        checkType: 'quick',
        stores: ['problems'],
        saveToHistory: true
      });

      const history = DataIntegrityCheckService.getCheckHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    it('should get dashboard summary', async () => {
      const summary = await DataIntegrityCheckService.getIntegrityDashboardSummary();
      
      expect(summary).toBeDefined();
      expect(typeof summary).toBe('object');
      // The service returns null for overallScore when no checks have been run
      if (summary.overallScore !== null) {
        expect(typeof summary.overallScore).toBe('number');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle validator exceptions', async () => {
      SchemaValidator.validateBatch.mockImplementation(() => {
        throw new Error('Validator crashed');
      });

      const result = await DataIntegrityCheckService.performIntegrityCheck({
        checkType: 'schema',
        stores: ['problems']
      });

      expect(result.overall.valid).toBe(false);
    });

    it('should handle referential integrity service errors', async () => {
      ReferentialIntegrityService.checkAllReferentialIntegrity
        .mockRejectedValue(new Error('Referential check failed'));

      const result = await DataIntegrityCheckService.performIntegrityCheck({
        checkType: 'referential',
        stores: ['problems']
      });

      expect(result.overall.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});