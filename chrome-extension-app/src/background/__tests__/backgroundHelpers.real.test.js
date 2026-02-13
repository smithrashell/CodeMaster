/**
 * backgroundHelpers.real.test.js
 *
 * Comprehensive tests for all exported functions in backgroundHelpers.js.
 * All service/DB dependencies are mocked.
 */

// ---------------------------------------------------------------------------
// 1. Mocks (hoisted)
// ---------------------------------------------------------------------------
jest.mock('../../shared/db/index.js', () => ({
  dbHelper: {
    openDB: jest.fn(),
  },
}));

jest.mock('../../shared/services/attempts/tagServices.js', () => ({
  TagService: {
    getCurrentTier: jest.fn(),
    getCurrentLearningState: jest.fn(),
  },
}));

jest.mock('../../shared/services/storage/storageService.js', () => ({
  StorageService: {
    set: jest.fn(),
  },
}));

jest.mock('../../shared/services/focus/onboardingService.js', () => ({
  onboardUserIfNeeded: jest.fn(),
}));

// ---------------------------------------------------------------------------
// 2. Imports
// ---------------------------------------------------------------------------
import {
  withTimeout,
  cleanupStalledSessions,
  getStrategyMapData,
  initializeInstallationOnboarding,
  initializeConsistencySystem,
  createBackgroundScriptHealth,
  setupDevTestFunctions,
} from '../backgroundHelpers.js';

// eslint-disable-next-line no-restricted-imports -- mock-based test needs direct dbHelper reference
import { dbHelper } from '../../shared/db/index.js';
import { TagService } from '../../shared/services/attempts/tagServices.js';
import { StorageService } from '../../shared/services/storage/storageService.js';
import { onboardUserIfNeeded } from '../../shared/services/focus/onboardingService.js';

// ---------------------------------------------------------------------------
// 3. Helpers
// ---------------------------------------------------------------------------
const _flush = () => new Promise((r) => setTimeout(r, 0));

// ---------------------------------------------------------------------------
// 4. Tests
// ---------------------------------------------------------------------------
describe('backgroundHelpers', () => {
  afterEach(() => jest.clearAllMocks());

  // -----------------------------------------------------------------------
  // withTimeout
  // -----------------------------------------------------------------------
  describe('withTimeout', () => {
    it('resolves when promise completes before timeout', async () => {
      const result = await withTimeout(Promise.resolve('done'), 5000, 'test op');
      expect(result).toBe('done');
    });

    it('rejects when promise takes too long', async () => {
      jest.useFakeTimers();
      const slowPromise = new Promise(() => {}); // never resolves

      const promise = withTimeout(slowPromise, 100, 'slow op');
      jest.advanceTimersByTime(100);

      await expect(promise).rejects.toThrow('slow op timed out after 100ms');
      jest.useRealTimers();
    });

    it('rejects when the original promise rejects before timeout', async () => {
      await expect(
        withTimeout(Promise.reject(new Error('fail fast')), 5000)
      ).rejects.toThrow('fail fast');
    });

    it('uses default operation name', async () => {
      jest.useFakeTimers();
      const slowPromise = new Promise(() => {});
      const promise = withTimeout(slowPromise, 50);
      jest.advanceTimersByTime(50);

      await expect(promise).rejects.toThrow('Operation timed out after 50ms');
      jest.useRealTimers();
    });
  });

  // -----------------------------------------------------------------------
  // cleanupStalledSessions
  // -----------------------------------------------------------------------
  describe('cleanupStalledSessions', () => {
    it('returns no-op result (stub per Issue #193)', () => {
      const result = cleanupStalledSessions();
      expect(result).toEqual({ cleaned: 0, actions: [] });
    });
  });

  // -----------------------------------------------------------------------
  // getStrategyMapData
  // -----------------------------------------------------------------------
  describe('getStrategyMapData', () => {
    it('aggregates tier, learning state, and mastery data', async () => {
      TagService.getCurrentTier.mockResolvedValue({
        classification: 'Fundamental Technique',
        focusTags: ['BFS', 'DFS'],
      });
      TagService.getCurrentLearningState.mockResolvedValue({
        masteryData: [],
      });

      // Mock IndexedDB transaction
      const mockTagRelationships = [
        { id: 'BFS', classification: 'Core Concept' },
        { id: 'DFS', classification: 'Core Concept' },
        { id: 'Topo Sort', classification: 'Fundamental Technique' },
      ];
      const mockTagMastery = [
        { tag: 'BFS', totalAttempts: 10, successfulAttempts: 8 },
        { tag: 'DFS', totalAttempts: 5, successfulAttempts: 2 },
      ];

      const _mockStore = (data) => ({
        getAll: jest.fn().mockReturnValue({
          result: data,
          onerror: null,
          set onsuccess(fn) { this._onsuccess = fn; },
          get onsuccess() { return this._onsuccess; },
        }),
      });

      const tagRelStore = {
        getAll: jest.fn(),
      };
      const tagMasteryStore = {
        getAll: jest.fn(),
      };

      const mockDB = {
        transaction: jest.fn((storeName) => ({
          objectStore: jest.fn(() => {
            if (storeName === 'tag_relationships') {
              return tagRelStore;
            }
            return tagMasteryStore;
          }),
        })),
      };

      dbHelper.openDB.mockResolvedValue(mockDB);

      // Simulate IDB request pattern via mock implementation
      tagRelStore.getAll.mockReturnValue({
        set onsuccess(fn) { setTimeout(() => { fn(); }, 0); },
        set onerror(_fn) { /* no-op */ },
        get result() { return mockTagRelationships; },
      });

      tagMasteryStore.getAll.mockReturnValue({
        set onsuccess(fn) { setTimeout(() => { fn(); }, 0); },
        set onerror(_fn) { /* no-op */ },
        get result() { return mockTagMastery; },
      });

      const data = await getStrategyMapData();

      expect(data.currentTier).toBe('Fundamental Technique');
      expect(data.focusTags).toEqual(['BFS', 'DFS']);
      expect(data.masteryData).toEqual(mockTagMastery);
      expect(data.tierData).toHaveProperty('Core Concept');
      expect(data.tierData).toHaveProperty('Fundamental Technique');
      expect(data.tierData).toHaveProperty('Advanced Technique');
    });

    it('uses default tier when classification missing', async () => {
      TagService.getCurrentTier.mockResolvedValue({});
      TagService.getCurrentLearningState.mockResolvedValue({});

      const emptyReq = {
        result: [],
        set onsuccess(fn) { setTimeout(() => fn(), 0); },
        set onerror(fn) { /* no-op */ },
      };

      const mockDB = {
        transaction: jest.fn(() => ({
          objectStore: jest.fn(() => ({
            getAll: jest.fn().mockReturnValue(emptyReq),
          })),
        })),
      };

      dbHelper.openDB.mockResolvedValue(mockDB);

      const data = await getStrategyMapData();
      expect(data.currentTier).toBe('Core Concept');
      expect(data.focusTags).toEqual([]);
    });

    it('throws on error', async () => {
      TagService.getCurrentTier.mockRejectedValue(new Error('tier fail'));

      await expect(getStrategyMapData()).rejects.toThrow('tier fail');
    });
  });

  // -----------------------------------------------------------------------
  // initializeInstallationOnboarding
  // -----------------------------------------------------------------------
  describe('initializeInstallationOnboarding', () => {
    it('completes onboarding successfully', async () => {
      onboardUserIfNeeded.mockResolvedValue({ success: true });
      StorageService.set.mockResolvedValue();

      await initializeInstallationOnboarding();

      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '...' });
      expect(onboardUserIfNeeded).toHaveBeenCalled();
      expect(StorageService.set).toHaveBeenCalledWith(
        'installation_onboarding_complete',
        expect.objectContaining({
          completed: true,
          version: '1.0.0',
        })
      );
      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '' });
    });

    it('logs warning when onboarding succeeds with warning', async () => {
      onboardUserIfNeeded.mockResolvedValue({
        success: true,
        warning: true,
        message: 'Some data missing',
      });
      StorageService.set.mockResolvedValue();

      await initializeInstallationOnboarding();

      expect(StorageService.set).toHaveBeenCalledWith(
        'installation_onboarding_complete',
        expect.objectContaining({ completed: true })
      );
    });

    it('sets error badge when onboarding fails', async () => {
      onboardUserIfNeeded.mockResolvedValue({
        success: false,
        message: 'Initialization failed',
      });

      await initializeInstallationOnboarding();

      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '!' });
      expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#FF0000' });
    });

    it('marks complete despite error in outer catch', async () => {
      onboardUserIfNeeded.mockRejectedValue(new Error('outer crash'));
      StorageService.set.mockResolvedValue();

      await initializeInstallationOnboarding();

      expect(StorageService.set).toHaveBeenCalledWith(
        'installation_onboarding_complete',
        expect.objectContaining({
          completed: true,
          error: 'outer crash',
        })
      );
      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '' });
    });

    it('handles badge API errors gracefully', async () => {
      chrome.action.setBadgeText.mockRejectedValueOnce(new Error('badge fail'));
      onboardUserIfNeeded.mockResolvedValue({ success: true });
      StorageService.set.mockResolvedValue();

      // Should not throw
      await initializeInstallationOnboarding();

      expect(onboardUserIfNeeded).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // initializeConsistencySystem
  // -----------------------------------------------------------------------
  describe('initializeConsistencySystem', () => {
    it('calls initializeInstallationOnboarding', () => {
      onboardUserIfNeeded.mockResolvedValue({ success: true });
      StorageService.set.mockResolvedValue();

      // initializeConsistencySystem is synchronous and calls initializeInstallationOnboarding
      // without awaiting. It should not throw.
      expect(() => initializeConsistencySystem()).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // createBackgroundScriptHealth
  // -----------------------------------------------------------------------
  describe('createBackgroundScriptHealth', () => {
    it('creates a health monitor with initial values', () => {
      const health = createBackgroundScriptHealth({}, [], { value: false });

      expect(health.requestCount).toBe(0);
      expect(health.timeoutCount).toBe(0);
      expect(typeof health.startTime).toBe('number');
    });

    it('records requests', () => {
      const health = createBackgroundScriptHealth({}, [], { value: false });

      health.recordRequest();
      health.recordRequest();

      expect(health.requestCount).toBe(2);
    });

    it('records timeouts', () => {
      const health = createBackgroundScriptHealth({}, [], { value: false });

      health.recordTimeout(5000);
      health.recordTimeout(10000);

      expect(health.timeoutCount).toBe(2);
    });

    it('resets health on emergency reset', () => {
      const health = createBackgroundScriptHealth({}, [], { value: false });

      health.recordRequest();
      health.recordRequest();
      health.recordTimeout(1000);

      health.emergencyReset();

      expect(health.requestCount).toBe(0);
      expect(health.timeoutCount).toBe(0);
    });

    it('returns health report with current state', () => {
      const activeRequests = { req1: true, req2: true };
      const requestQueue = [1, 2, 3];
      const isProcessingRef = { value: true };

      const health = createBackgroundScriptHealth(activeRequests, requestQueue, isProcessingRef);
      health.recordRequest();
      health.recordRequest();
      health.recordTimeout(5000);

      const report = health.getHealthReport();

      expect(report.requestCount).toBe(2);
      expect(report.timeoutCount).toBe(1);
      expect(report.activeRequests).toBe(2);
      expect(report.queueLength).toBe(3);
      expect(report.isProcessing).toBe(true);
      expect(typeof report.uptime).toBe('number');
      expect(report.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  // -----------------------------------------------------------------------
  // setupDevTestFunctions
  // -----------------------------------------------------------------------
  describe('setupDevTestFunctions', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
      delete globalThis.testSimple;
      delete globalThis.testAsync;
      delete globalThis.MyService;
    });

    it('sets up test functions in non-production environment', () => {
      process.env.NODE_ENV = 'test';
      const services = { MyService: { doStuff: jest.fn() } };

      setupDevTestFunctions(services);

      expect(typeof globalThis.testSimple).toBe('function');
      expect(typeof globalThis.testAsync).toBe('function');
      expect(globalThis.MyService).toBe(services.MyService);
    });

    it('testSimple returns success', () => {
      process.env.NODE_ENV = 'test';
      setupDevTestFunctions({});

      const result = globalThis.testSimple();
      expect(result).toEqual({ success: true, message: 'Simple test completed' });
    });

    it('testAsync returns success', () => {
      process.env.NODE_ENV = 'test';
      setupDevTestFunctions({});

      const result = globalThis.testAsync();
      expect(result).toEqual({ success: true, message: 'Async test completed' });
    });

    it('does nothing in production environment', () => {
      process.env.NODE_ENV = 'production';
      setupDevTestFunctions({ MyService: {} });

      expect(globalThis.testSimple).toBeUndefined();
      expect(globalThis.testAsync).toBeUndefined();
    });

    it('exposes multiple services globally', () => {
      process.env.NODE_ENV = 'test';
      const svc1 = { a: 1 };
      const svc2 = { b: 2 };
      setupDevTestFunctions({ svc1, svc2 });

      expect(globalThis.svc1).toBe(svc1);
      expect(globalThis.svc2).toBe(svc2);

      delete globalThis.svc1;
      delete globalThis.svc2;
    });
  });
});
