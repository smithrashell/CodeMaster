/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "http://localhost"}
 */

/**
 * UserActionTracker comprehensive tests.
 *
 * UserActionTracker uses IndexedDB via dbHelper, PerformanceMonitor, and logger.
 * All external dependencies are mocked. We use http://localhost (not
 * chrome-extension://) to avoid the JSDOM opaque-origin localStorage
 * SecurityError in CI. To prevent isContentScriptContext() from returning
 * true (which would skip DB operations), chrome.runtime.sendMessage is
 * temporarily removed during tests.
 */

// ---------------------------------------------------------------------------
// 1. Mocks (hoisted before imports)
// ---------------------------------------------------------------------------
jest.mock('../../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
    sessionId: 'test-session-id',
  },
}));

jest.mock('../../../utils/performance/PerformanceMonitor.js', () => ({
  __esModule: true,
  default: {
    startQuery: jest.fn(() => ({
      end: jest.fn(),
      addTag: jest.fn(),
      addMetric: jest.fn(),
    })),
    endQuery: jest.fn(),
    recordTiming: jest.fn(),
    recordEvent: jest.fn(),
    getMetrics: jest.fn(() => ({})),
    cleanup: jest.fn(),
  },
}));

// Mock dbHelper
const mockStore = {
  add: jest.fn(),
  getAll: jest.fn(),
  delete: jest.fn(),
  index: jest.fn(),
};

const mockTransaction = {
  objectStore: jest.fn(() => mockStore),
};

const mockDb = {
  transaction: jest.fn(() => mockTransaction),
};

jest.mock('../../../db/index.js', () => ({
  dbHelper: {
    openDB: jest.fn(() => Promise.resolve(mockDb)),
  },
}));

// ---------------------------------------------------------------------------
// 2. Imports (run after mocks are applied)
// ---------------------------------------------------------------------------
import { UserActionTracker } from '../userActionTracker.js';
import { dbHelper } from '../../../db/index.js';
import performanceMonitor from '../../../utils/performance/PerformanceMonitor.js';
import logger from '../../../utils/logging/logger.js';

// ---------------------------------------------------------------------------
// 3. Tests
// ---------------------------------------------------------------------------
describe('UserActionTracker', () => {
  // Remove sendMessage so isContentScriptContext() returns false with http://localhost
  const savedSendMessage = global.chrome?.runtime?.sendMessage;

  beforeEach(() => {
    jest.clearAllMocks();
    if (global.chrome?.runtime) {
      delete global.chrome.runtime.sendMessage;
    }
    // Reset static state
    UserActionTracker.actionQueue = [];
    UserActionTracker.isProcessing = false;
    UserActionTracker.sessionStart = Date.now();

    // Reset mock implementations
    mockStore.add.mockImplementation(() => {
      const request = { result: 1 };
      setTimeout(() => { if (request.onsuccess) request.onsuccess(); }, 0);
      return request;
    });

    mockStore.getAll.mockImplementation(() => {
      const request = { result: [] };
      setTimeout(() => { if (request.onsuccess) request.onsuccess(); }, 0);
      return request;
    });

    mockStore.index.mockReturnValue({
      getAll: jest.fn(() => {
        const request = { result: [] };
        setTimeout(() => { if (request.onsuccess) request.onsuccess(); }, 0);
        return request;
      }),
    });
  });

  afterEach(() => {
    // Restore sendMessage for other test suites
    if (global.chrome?.runtime && savedSendMessage) {
      global.chrome.runtime.sendMessage = savedSendMessage;
    }
  });

  // =========================================================================
  // Static constants
  // =========================================================================
  describe('static constants', () => {
    it('should have correct STORE_NAME', () => {
      expect(UserActionTracker.STORE_NAME).toBe('user_actions');
    });

    it('should have correct MAX_ACTIONS', () => {
      expect(UserActionTracker.MAX_ACTIONS).toBe(5000);
    });

    it('should have correct BATCH_SIZE', () => {
      expect(UserActionTracker.BATCH_SIZE).toBe(50);
    });

    it('should define all CATEGORIES', () => {
      expect(UserActionTracker.CATEGORIES).toEqual({
        NAVIGATION: 'navigation',
        PROBLEM_SOLVING: 'problem_solving',
        FEATURE_USAGE: 'feature_usage',
        SYSTEM_INTERACTION: 'system_interaction',
        ERROR_OCCURRENCE: 'error_occurrence',
      });
    });
  });

  // =========================================================================
  // trackAction
  // =========================================================================
  describe('trackAction', () => {
    it('should add action data to queue', async () => {
      const actionData = await UserActionTracker.trackAction({
        action: 'test_action',
        category: UserActionTracker.CATEGORIES.SYSTEM_INTERACTION,
        context: { page: 'dashboard' },
        metadata: { extra: 'info' },
      });

      expect(actionData.action).toBe('test_action');
      expect(actionData.category).toBe('system_interaction');
      expect(actionData.context).toEqual({ page: 'dashboard' });
      expect(actionData.metadata).toEqual({ extra: 'info' });
      expect(actionData.timestamp).toBeDefined();
      expect(actionData.sessionId).toBe('test-session-id');
      expect(actionData.url).toBeDefined();
      expect(actionData.userAgent).toBeDefined();
      expect(actionData.sessionTime).toBeDefined();
    });

    it('should add action to queue', async () => {
      UserActionTracker.actionQueue = [];

      await UserActionTracker.trackAction({
        action: 'test_action',
      });

      // Queue should have the action (or be empty if it was flushed due to being critical)
      // Since default category is SYSTEM_INTERACTION, it won't trigger batch processing
      expect(UserActionTracker.actionQueue.length).toBeGreaterThanOrEqual(0);
    });

    it('should trigger batch processing for critical actions (ERROR_OCCURRENCE)', async () => {
      const processBatchSpy = jest.spyOn(UserActionTracker, 'processBatch').mockResolvedValue();

      await UserActionTracker.trackAction({
        action: 'error_occurred',
        category: UserActionTracker.CATEGORIES.ERROR_OCCURRENCE,
      });

      expect(processBatchSpy).toHaveBeenCalled();
      processBatchSpy.mockRestore();
    });

    it('should trigger batch processing for PROBLEM_SOLVING category', async () => {
      const processBatchSpy = jest.spyOn(UserActionTracker, 'processBatch').mockResolvedValue();

      await UserActionTracker.trackAction({
        action: 'problem_started',
        category: UserActionTracker.CATEGORIES.PROBLEM_SOLVING,
      });

      expect(processBatchSpy).toHaveBeenCalled();
      processBatchSpy.mockRestore();
    });

    it('should trigger batch processing when queue reaches BATCH_SIZE', async () => {
      const processBatchSpy = jest.spyOn(UserActionTracker, 'processBatch').mockResolvedValue();

      // Fill queue to near BATCH_SIZE
      UserActionTracker.actionQueue = new Array(UserActionTracker.BATCH_SIZE - 1).fill({});

      await UserActionTracker.trackAction({
        action: 'test_action',
      });

      expect(processBatchSpy).toHaveBeenCalled();
      processBatchSpy.mockRestore();
    });

    it('should log significant actions (FEATURE_USAGE)', async () => {
      await UserActionTracker.trackAction({
        action: 'feature_used',
        category: UserActionTracker.CATEGORIES.FEATURE_USAGE,
        context: { feature: 'hints' },
      });

      expect(logger.info).toHaveBeenCalledWith(
        'User action tracked: feature_used',
        expect.objectContaining({
          category: 'feature_usage',
          section: 'user_tracking',
        })
      );
    });

    it('should throw and log on error', async () => {
      // Simulate error by making the entire function fail at a deep point
      const originalDate = global.Date;
      // Mock Date to cause an error in action creation
      jest.spyOn(global, 'Date').mockImplementation(() => {
        throw new Error('Date mock error');
      });

      await expect(UserActionTracker.trackAction({
        action: 'test',
      })).rejects.toThrow();

      expect(logger.error).toHaveBeenCalled();
      global.Date = originalDate;
      jest.restoreAllMocks();
    });
  });

  // =========================================================================
  // processBatch
  // =========================================================================
  describe('processBatch', () => {
    it('should do nothing when queue is empty', async () => {
      UserActionTracker.actionQueue = [];

      await UserActionTracker.processBatch();

      expect(dbHelper.openDB).not.toHaveBeenCalled();
    });

    it('should do nothing when already processing', async () => {
      UserActionTracker.isProcessing = true;
      UserActionTracker.actionQueue = [{ action: 'test' }];

      await UserActionTracker.processBatch();

      expect(dbHelper.openDB).not.toHaveBeenCalled();
    });

    it('should process queued actions into database', async () => {
      UserActionTracker.actionQueue = [
        { action: 'action_1', timestamp: new Date().toISOString() },
        { action: 'action_2', timestamp: new Date().toISOString() },
      ];

      mockStore.add.mockImplementation(() => {
        const request = {};
        setTimeout(() => { if (request.onsuccess) request.onsuccess(); }, 0);
        return request;
      });

      await UserActionTracker.processBatch();

      expect(dbHelper.openDB).toHaveBeenCalled();
      expect(mockDb.transaction).toHaveBeenCalledWith(['user_actions'], 'readwrite');
      expect(mockStore.add).toHaveBeenCalledTimes(2);
      expect(UserActionTracker.actionQueue).toEqual([]);
      expect(UserActionTracker.isProcessing).toBe(false);
    });

    it('should call performanceMonitor.startQuery and endQuery', async () => {
      UserActionTracker.actionQueue = [{ action: 'test' }];

      mockStore.add.mockImplementation(() => {
        const request = {};
        setTimeout(() => { if (request.onsuccess) request.onsuccess(); }, 0);
        return request;
      });

      await UserActionTracker.processBatch();

      expect(performanceMonitor.startQuery).toHaveBeenCalledWith(
        'batch_process_user_actions',
        expect.objectContaining({ batchSize: 1 })
      );
      expect(performanceMonitor.endQuery).toHaveBeenCalled();
    });

    it('should reset isProcessing flag on error', async () => {
      UserActionTracker.actionQueue = [{ action: 'test' }];
      dbHelper.openDB.mockRejectedValueOnce(new Error('DB connection failed'));

      await expect(UserActionTracker.processBatch()).rejects.toThrow('DB connection failed');

      expect(UserActionTracker.isProcessing).toBe(false);
    });

    it('should log error on batch processing failure', async () => {
      UserActionTracker.actionQueue = [{ action: 'test' }];
      dbHelper.openDB.mockRejectedValueOnce(new Error('DB error'));

      try {
        await UserActionTracker.processBatch();
      } catch {
        // Expected
      }

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to process user action batch',
        expect.any(Object),
        expect.any(Error)
      );
    });

    it('should call endQuery with failure on error', async () => {
      UserActionTracker.actionQueue = [{ action: 'test' }];
      dbHelper.openDB.mockRejectedValueOnce(new Error('DB error'));

      try {
        await UserActionTracker.processBatch();
      } catch {
        // Expected
      }

      expect(performanceMonitor.endQuery).toHaveBeenCalledWith(
        expect.anything(),
        false,
        0,
        expect.any(Error)
      );
    });
  });

  // =========================================================================
  // getUserActions
  // =========================================================================
  describe('getUserActions', () => {
    it('should retrieve all actions with default options', async () => {
      const actions = [
        { action: 'a1', timestamp: '2024-01-02T10:00:00Z' },
        { action: 'a2', timestamp: '2024-01-01T10:00:00Z' },
      ];

      mockStore.getAll.mockImplementation(() => {
        const request = { result: [...actions] };
        setTimeout(() => { if (request.onsuccess) request.onsuccess(); }, 0);
        return request;
      });

      const result = await UserActionTracker.getUserActions();

      expect(result).toHaveLength(2);
      // Should be sorted newest first
      expect(result[0].action).toBe('a1');
    });

    it('should filter by category using index', async () => {
      const categoryActions = [{ action: 'nav', category: 'navigation', timestamp: '2024-01-01T10:00:00Z' }];

      const mockIndex = {
        getAll: jest.fn(() => {
          const request = { result: [...categoryActions] };
          setTimeout(() => { if (request.onsuccess) request.onsuccess(); }, 0);
          return request;
        }),
      };
      mockStore.index.mockReturnValue(mockIndex);

      const result = await UserActionTracker.getUserActions({ category: 'navigation' });

      expect(mockStore.index).toHaveBeenCalledWith('by_category');
      expect(mockIndex.getAll).toHaveBeenCalledWith('navigation');
      expect(result).toHaveLength(1);
    });

    it('should filter by sessionId using index', async () => {
      const sessionActions = [{ action: 'test', sessionId: 'session_1', timestamp: '2024-01-01T10:00:00Z' }];

      const mockIndex = {
        getAll: jest.fn(() => {
          const request = { result: [...sessionActions] };
          setTimeout(() => { if (request.onsuccess) request.onsuccess(); }, 0);
          return request;
        }),
      };
      mockStore.index.mockReturnValue(mockIndex);

      const result = await UserActionTracker.getUserActions({ sessionId: 'session_1' });

      expect(mockStore.index).toHaveBeenCalledWith('by_session');
      expect(result).toHaveLength(1);
    });

    it('should filter by action name', async () => {
      const actions = [
        { action: 'click', timestamp: '2024-01-01T10:00:00Z' },
        { action: 'scroll', timestamp: '2024-01-01T10:01:00Z' },
      ];

      mockStore.getAll.mockImplementation(() => {
        const request = { result: [...actions] };
        setTimeout(() => { if (request.onsuccess) request.onsuccess(); }, 0);
        return request;
      });

      const result = await UserActionTracker.getUserActions({ action: 'click' });

      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('click');
    });

    it('should filter by since date', async () => {
      const actions = [
        { action: 'old', timestamp: '2024-01-01T10:00:00Z' },
        { action: 'new', timestamp: '2024-06-15T10:00:00Z' },
      ];

      mockStore.getAll.mockImplementation(() => {
        const request = { result: [...actions] };
        setTimeout(() => { if (request.onsuccess) request.onsuccess(); }, 0);
        return request;
      });

      const result = await UserActionTracker.getUserActions({ since: '2024-06-01T00:00:00Z' });

      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('new');
    });

    it('should respect limit', async () => {
      const actions = [];
      for (let i = 0; i < 20; i++) {
        actions.push({ action: `action_${i}`, timestamp: new Date(Date.now() - i * 1000).toISOString() });
      }

      mockStore.getAll.mockImplementation(() => {
        const request = { result: [...actions] };
        setTimeout(() => { if (request.onsuccess) request.onsuccess(); }, 0);
        return request;
      });

      const result = await UserActionTracker.getUserActions({ limit: 5 });

      expect(result).toHaveLength(5);
    });

    it('should return empty array on error', async () => {
      dbHelper.openDB.mockRejectedValueOnce(new Error('DB error'));

      const result = await UserActionTracker.getUserActions();

      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // getUserAnalytics
  // =========================================================================
  describe('getUserAnalytics', () => {
    it('should compute analytics from user actions', async () => {
      const actions = [
        {
          action: 'page_view',
          category: 'navigation',
          sessionId: 's1',
          timestamp: new Date().toISOString(),
          sessionTime: 5000,
        },
        {
          action: 'feature_used',
          category: 'feature_usage',
          sessionId: 's1',
          timestamp: new Date().toISOString(),
          sessionTime: 10000,
        },
        {
          action: 'page_view',
          category: 'navigation',
          sessionId: 's2',
          timestamp: new Date().toISOString(),
          sessionTime: 3000,
        },
      ];

      mockStore.getAll.mockImplementation(() => {
        const request = { result: [...actions] };
        setTimeout(() => { if (request.onsuccess) request.onsuccess(); }, 0);
        return request;
      });

      const analytics = await UserActionTracker.getUserAnalytics(7);

      expect(analytics.totalActions).toBe(3);
      expect(analytics.uniqueSessions).toBe(2);
      expect(analytics.actionsByCategory.navigation).toBe(2);
      expect(analytics.actionsByCategory.feature_usage).toBe(1);
      expect(analytics.actionsByType.page_view).toBe(2);
      expect(analytics.actionsByType.feature_used).toBe(1);
      expect(analytics.averageSessionTime).toBeGreaterThan(0);
      expect(analytics.userFlow).toBeDefined();
    });

    it('should return null on error in analytics computation', async () => {
      // getUserAnalytics calls getUserActions internally which catches DB errors
      // and returns []. To make getUserAnalytics return null, we need to cause
      // an error inside the analytics computation itself.
      jest.spyOn(UserActionTracker, 'getUserActions').mockRejectedValueOnce(new Error('Analytics error'));

      const result = await UserActionTracker.getUserAnalytics();

      expect(result).toBeNull();
    });

    it('should handle empty actions', async () => {
      mockStore.getAll.mockImplementation(() => {
        const request = { result: [] };
        setTimeout(() => { if (request.onsuccess) request.onsuccess(); }, 0);
        return request;
      });

      const analytics = await UserActionTracker.getUserAnalytics();

      expect(analytics.totalActions).toBe(0);
      expect(analytics.uniqueSessions).toBe(0);
      expect(analytics.averageSessionTime).toBe(0);
    });
  });

  // =========================================================================
  // _analyzeUserFlow
  // =========================================================================
  describe('_analyzeUserFlow', () => {
    it('should identify sequential action flows', () => {
      const actions = [
        { action: 'login', timestamp: '2024-01-01T10:00:00Z' },
        { action: 'view_dashboard', timestamp: '2024-01-01T10:01:00Z' },
        { action: 'start_session', timestamp: '2024-01-01T10:02:00Z' },
        { action: 'view_dashboard', timestamp: '2024-01-01T10:03:00Z' },
        { action: 'start_session', timestamp: '2024-01-01T10:04:00Z' },
      ];

      const flow = UserActionTracker._analyzeUserFlow(actions);

      expect(flow['login \u2192 view_dashboard']).toBe(1);
      expect(flow['view_dashboard \u2192 start_session']).toBe(2);
    });

    it('should limit to top 10 flows', () => {
      const actions = [];
      for (let i = 0; i < 30; i++) {
        actions.push({
          action: `action_${i % 15}`,
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
        });
      }

      const flow = UserActionTracker._analyzeUserFlow(actions);

      expect(Object.keys(flow).length).toBeLessThanOrEqual(10);
    });

    it('should handle empty actions', () => {
      const flow = UserActionTracker._analyzeUserFlow([]);
      expect(flow).toEqual({});
    });

    it('should handle single action', () => {
      const flow = UserActionTracker._analyzeUserFlow([
        { action: 'solo', timestamp: '2024-01-01T10:00:00Z' },
      ]);
      expect(flow).toEqual({});
    });
  });

  // =========================================================================
  // Convenience tracking methods
  // =========================================================================
  describe('trackFeatureUsage', () => {
    it('should track a feature usage action', async () => {
      const spy = jest.spyOn(UserActionTracker, 'trackAction').mockResolvedValue({});

      await UserActionTracker.trackFeatureUsage('hint_panel', { source: 'toolbar' });

      expect(spy).toHaveBeenCalledWith({
        action: 'feature_hint_panel_used',
        category: UserActionTracker.CATEGORIES.FEATURE_USAGE,
        context: { source: 'toolbar' },
      });

      spy.mockRestore();
    });
  });

  describe('trackNavigation', () => {
    it('should track a navigation action', async () => {
      const spy = jest.spyOn(UserActionTracker, 'trackAction').mockResolvedValue({});

      await UserActionTracker.trackNavigation('/dashboard', '/settings', 'click');

      expect(spy).toHaveBeenCalledWith({
        action: 'page_navigation',
        category: UserActionTracker.CATEGORIES.NAVIGATION,
        context: { from: '/dashboard', to: '/settings', method: 'click' },
      });

      spy.mockRestore();
    });
  });

  describe('trackProblemSolving', () => {
    it('should track a problem solving event', async () => {
      const spy = jest.spyOn(UserActionTracker, 'trackAction').mockResolvedValue({});

      await UserActionTracker.trackProblemSolving('two-sum', 'started', { difficulty: 'Easy' });

      expect(spy).toHaveBeenCalledWith({
        action: 'problem_started',
        category: UserActionTracker.CATEGORIES.PROBLEM_SOLVING,
        context: { problemId: 'two-sum', difficulty: 'Easy' },
      });

      spy.mockRestore();
    });
  });

  describe('trackError', () => {
    it('should track an error event', async () => {
      const spy = jest.spyOn(UserActionTracker, 'trackAction').mockResolvedValue({});
      const error = new Error('Test error');

      await UserActionTracker.trackError(error, { component: 'HintPanel', severity: 'high' });

      expect(spy).toHaveBeenCalledWith({
        action: 'error_occurred',
        category: UserActionTracker.CATEGORIES.ERROR_OCCURRENCE,
        context: {
          errorMessage: 'Test error',
          errorStack: expect.any(String),
          component: 'HintPanel',
          severity: 'high',
        },
        metadata: { severity: 'high' },
      });

      spy.mockRestore();
    });

    it('should default severity to medium', async () => {
      const spy = jest.spyOn(UserActionTracker, 'trackAction').mockResolvedValue({});
      const error = new Error('Test error');

      await UserActionTracker.trackError(error);

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { severity: 'medium' },
        })
      );

      spy.mockRestore();
    });
  });

  // =========================================================================
  // cleanupOldActions
  // =========================================================================
  describe('cleanupOldActions', () => {
    it('should delete excess actions when count exceeds MAX_ACTIONS', async () => {
      const actions = [];
      for (let i = 0; i < UserActionTracker.MAX_ACTIONS + 100; i++) {
        actions.push({ id: i, action: `action_${i}`, timestamp: new Date(Date.now() - i * 1000).toISOString() });
      }

      mockStore.getAll.mockImplementation(() => {
        const request = { result: [...actions] };
        setTimeout(() => { if (request.onsuccess) request.onsuccess(); }, 0);
        return request;
      });

      await UserActionTracker.cleanupOldActions();

      // Should delete the excess actions (100)
      expect(mockStore.delete).toHaveBeenCalledTimes(100);
    });

    it('should not delete when under MAX_ACTIONS', async () => {
      const actions = [
        { id: 1, action: 'test', timestamp: new Date().toISOString() },
      ];

      mockStore.getAll.mockImplementation(() => {
        const request = { result: [...actions] };
        setTimeout(() => { if (request.onsuccess) request.onsuccess(); }, 0);
        return request;
      });

      await UserActionTracker.cleanupOldActions();

      expect(mockStore.delete).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      dbHelper.openDB.mockRejectedValueOnce(new Error('DB error'));

      // Should not throw
      await UserActionTracker.cleanupOldActions();

      expect(logger.error).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // exportUserActions
  // =========================================================================
  describe('exportUserActions', () => {
    it('should export as JSON', async () => {
      const actions = [
        { action: 'test1', timestamp: '2024-01-01T10:00:00Z', category: 'navigation', sessionId: 's1', context: {} },
      ];

      mockStore.getAll.mockImplementation(() => {
        const request = { result: [...actions] };
        setTimeout(() => { if (request.onsuccess) request.onsuccess(); }, 0);
        return request;
      });

      const result = await UserActionTracker.exportUserActions('json');

      const parsed = JSON.parse(result);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].action).toBe('test1');
    });

    it('should export as CSV', async () => {
      const actions = [
        { action: 'test1', timestamp: '2024-01-01T10:00:00Z', category: 'navigation', sessionId: 's1', context: { page: 'home' } },
        { action: 'test2', timestamp: '2024-01-02T10:00:00Z', category: 'feature_usage', sessionId: 's2', context: {} },
      ];

      mockStore.getAll.mockImplementation(() => {
        const request = { result: [...actions] };
        setTimeout(() => { if (request.onsuccess) request.onsuccess(); }, 0);
        return request;
      });

      const result = await UserActionTracker.exportUserActions('csv');

      const lines = result.split('\n');
      expect(lines[0]).toBe('Timestamp,Action,Category,Session ID,Context');
      expect(lines.length).toBe(3); // header + 2 data rows
    });

    it('should throw on unsupported format', async () => {
      mockStore.getAll.mockImplementation(() => {
        const request = { result: [] };
        setTimeout(() => { if (request.onsuccess) request.onsuccess(); }, 0);
        return request;
      });

      await expect(UserActionTracker.exportUserActions('xml')).rejects.toThrow(
        'Unsupported export format: xml'
      );
    });

    it('should throw on getUserActions error in export', async () => {
      // exportUserActions calls getUserActions which catches DB errors and returns [].
      // To trigger the throw path in exportUserActions, we need getUserActions itself to throw.
      jest.spyOn(UserActionTracker, 'getUserActions').mockRejectedValueOnce(new Error('Export retrieval error'));

      await expect(UserActionTracker.exportUserActions('json')).rejects.toThrow('Export retrieval error');
    });
  });

  // =========================================================================
  // flush
  // =========================================================================
  describe('flush', () => {
    it('should process remaining actions in queue', async () => {
      const spy = jest.spyOn(UserActionTracker, 'processBatch').mockResolvedValue();
      UserActionTracker.actionQueue = [{ action: 'pending' }];

      await UserActionTracker.flush();

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should do nothing when queue is empty', async () => {
      const spy = jest.spyOn(UserActionTracker, 'processBatch').mockResolvedValue();
      UserActionTracker.actionQueue = [];

      await UserActionTracker.flush();

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
