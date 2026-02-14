/**
 * Unit tests for ErrorReportService
 * Tests error report storage, fallback, statistics, and export.
 */

// Mock logger first, before all other imports
jest.mock('../../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock dbHelper to avoid real IndexedDB
jest.mock('../../../db/index.js', () => ({
  dbHelper: {
    openDB: jest.fn(),
  },
}));

import { ErrorReportService } from '../ErrorReportService.js';
import { dbHelper } from '../../../db/index.js';

// Helper: build a fake IDB transaction/store chain
function _buildFakeDb({ addResult = 1, getAllResult = [] } = {}) {
  const addRequest = { onsuccess: null, onerror: null, result: addResult };
  const getAllRequest = { onsuccess: null, onerror: null, result: getAllResult };

  const fakeStore = {
    add: jest.fn().mockReturnValue(addRequest),
    getAll: jest.fn().mockReturnValue(getAllRequest),
    index: jest.fn().mockReturnValue({
      getAll: jest.fn().mockReturnValue(getAllRequest),
    }),
    put: jest.fn().mockReturnValue({ onsuccess: null, onerror: null }),
    delete: jest.fn(),
  };

  const fakeTx = { objectStore: jest.fn().mockReturnValue(fakeStore) };
  const fakeDb = { transaction: jest.fn().mockReturnValue(fakeTx) };

  return { fakeDb, fakeStore, addRequest, getAllRequest };
}

describe('ErrorReportService', () => {
  let originalSendMessage;

  beforeEach(() => {
    jest.clearAllMocks();
    // isContentScriptContext() returns true when chrome.runtime.sendMessage exists
    // AND window.location.protocol is http/https. In jsdom tests, window.location
    // is http://localhost, so we need to neutralize sendMessage to avoid the
    // content-script guard from short-circuiting all DB operations.
    originalSendMessage = global.chrome.runtime.sendMessage;
    global.chrome.runtime.sendMessage = undefined;
  });

  afterEach(() => {
    global.chrome.runtime.sendMessage = originalSendMessage;
  });

  // -----------------------------------------------------------------------
  // getSafeUrl
  // -----------------------------------------------------------------------
  describe('getSafeUrl', () => {
    it('returns a string', () => {
      const url = ErrorReportService.getSafeUrl();
      expect(typeof url).toBe('string');
    });

    it('returns a non-empty value', () => {
      expect(ErrorReportService.getSafeUrl().length).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // getSafeUserAgent
  // -----------------------------------------------------------------------
  describe('getSafeUserAgent', () => {
    it('returns a string', () => {
      const ua = ErrorReportService.getSafeUserAgent();
      expect(typeof ua).toBe('string');
    });
  });

  // -----------------------------------------------------------------------
  // storeErrorReport
  // -----------------------------------------------------------------------
  describe('storeErrorReport', () => {
    it('calls dbHelper.openDB when not in content script context', async () => {
      // Use a fake db that immediately resolves via the add request callback pattern
      const addRequest = { result: 42 };
      const fakeStore = {
        add: jest.fn().mockImplementation(() => {
          // The source code does: request.onsuccess = () => { ... }
          // We simulate immediate success by scheduling it via Promise.resolve
          return addRequest;
        }),
      };
      const fakeTx = { objectStore: jest.fn().mockReturnValue(fakeStore) };
      const fakeDb = { transaction: jest.fn().mockReturnValue(fakeTx) };
      dbHelper.openDB.mockResolvedValue(fakeDb);

      // Set up a spy on cleanupOldReports to prevent it from running
      jest.spyOn(ErrorReportService, 'cleanupOldReports').mockResolvedValue(undefined);

      // Start the storeErrorReport call
      const promise = ErrorReportService.storeErrorReport({
        errorId: 'err-1',
        message: 'test error',
        stack: 'at foo:1:1',
        section: 'test',
      });

      // Wait a tick for openDB to resolve and store.add to be called
      await Promise.resolve();
      await Promise.resolve();

      // Now fire the onsuccess that the source attached to addRequest
      if (typeof addRequest.onsuccess === 'function') {
        addRequest.onsuccess();
      }

      const result = await promise;
      expect(dbHelper.openDB).toHaveBeenCalledTimes(1);
      expect(fakeStore.add).toHaveBeenCalledTimes(1);
      // Result is the key from the store.add request
      expect(result).toBe(42);
    });

    it('falls back to localStorage and rethrows when db throws', async () => {
      dbHelper.openDB.mockRejectedValue(new Error('DB unavailable'));
      const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
      jest.spyOn(Storage.prototype, 'getItem').mockReturnValue('[]');

      await expect(
        ErrorReportService.storeErrorReport({
          errorId: 'err-2',
          message: 'db error',
          stack: '',
          section: 'test',
        })
      ).rejects.toThrow('DB unavailable');

      expect(setItemSpy).toHaveBeenCalled();
      setItemSpy.mockRestore();
    });
  });

  // -----------------------------------------------------------------------
  // fallbackToLocalStorage
  // -----------------------------------------------------------------------
  describe('fallbackToLocalStorage', () => {
    it('stores error data in localStorage', () => {
      const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
      jest.spyOn(Storage.prototype, 'getItem').mockReturnValue('[]');

      ErrorReportService.fallbackToLocalStorage({
        errorId: 'local-1',
        message: 'local error',
        stack: '',
        section: 'fallback',
        timestamp: new Date().toISOString(),
      });

      expect(setItemSpy).toHaveBeenCalledWith(
        'codemaster_errors',
        expect.stringContaining('local-1')
      );
      setItemSpy.mockRestore();
    });

    it('keeps only last 10 errors in localStorage', () => {
      const existing = Array.from({ length: 10 }, (_, i) => ({ errorId: `e${i}` }));
      jest.spyOn(Storage.prototype, 'getItem').mockReturnValue(JSON.stringify(existing));
      const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});

      ErrorReportService.fallbackToLocalStorage({
        errorId: 'newest',
        message: '',
        stack: '',
        section: '',
        timestamp: '',
      });

      const stored = JSON.parse(setItemSpy.mock.calls[0][1]);
      expect(stored).toHaveLength(10); // Old items trimmed
      setItemSpy.mockRestore();
    });
  });

  // -----------------------------------------------------------------------
  // getErrorStatistics
  // -----------------------------------------------------------------------
  describe('getErrorStatistics', () => {
    it('returns stats with correct shape', async () => {
      jest.spyOn(ErrorReportService, 'getErrorReports').mockResolvedValue([
        {
          timestamp: new Date().toISOString(),
          section: 'crash_reporter',
          errorType: 'javascript',
          message: 'boom',
          resolved: false,
        },
        {
          timestamp: new Date().toISOString(),
          section: 'crash_reporter',
          errorType: 'javascript',
          message: 'boom2',
          resolved: true,
        },
      ]);

      const stats = await ErrorReportService.getErrorStatistics(30);

      expect(stats).toMatchObject({
        totalErrors: 2,
        resolvedErrors: 1,
        errorsBySection: expect.any(Object),
        errorsByType: expect.any(Object),
        errorsByDay: expect.any(Object),
        topErrors: expect.any(Object),
      });
    });

    it('returns null when getErrorReports throws', async () => {
      jest.spyOn(ErrorReportService, 'getErrorReports').mockRejectedValue(new Error('fail'));

      const stats = await ErrorReportService.getErrorStatistics();

      expect(stats).toBeNull();
    });

    it('counts errors by section correctly', async () => {
      jest.spyOn(ErrorReportService, 'getErrorReports').mockResolvedValue([
        { timestamp: new Date().toISOString(), section: 'auth', errorType: 'js', message: 'e1', resolved: false },
        { timestamp: new Date().toISOString(), section: 'auth', errorType: 'js', message: 'e2', resolved: false },
        { timestamp: new Date().toISOString(), section: 'db', errorType: 'js', message: 'e3', resolved: false },
      ]);

      const stats = await ErrorReportService.getErrorStatistics();

      expect(stats.errorsBySection.auth).toBe(2);
      expect(stats.errorsBySection.db).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // exportErrorReports
  // -----------------------------------------------------------------------
  describe('exportErrorReports', () => {
    it('exports JSON format as valid JSON array', async () => {
      jest.spyOn(ErrorReportService, 'getErrorReports').mockResolvedValue([
        { errorId: 'x', message: 'test', resolved: false },
      ]);

      const result = await ErrorReportService.exportErrorReports('json');
      const parsed = JSON.parse(result);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].errorId).toBe('x');
    });

    it('exports CSV format with header row', async () => {
      jest.spyOn(ErrorReportService, 'getErrorReports').mockResolvedValue([
        {
          timestamp: '2024-01-01T00:00:00Z',
          section: 'test',
          errorType: 'javascript',
          message: 'err msg',
          resolved: false,
          userFeedback: '',
        },
      ]);

      const result = await ErrorReportService.exportErrorReports('csv');

      expect(result).toContain('Timestamp,Section,Error Type,Message,Resolved,User Feedback');
      expect(result).toContain('err msg');
    });

    it('throws for unsupported format', async () => {
      jest.spyOn(ErrorReportService, 'getErrorReports').mockResolvedValue([]);

      await expect(ErrorReportService.exportErrorReports('xml')).rejects.toThrow(
        'Unsupported export format'
      );
    });
  });

  // -----------------------------------------------------------------------
  // MAX_REPORTS constant
  // -----------------------------------------------------------------------
  describe('constants', () => {
    it('MAX_REPORTS is defined and positive', () => {
      expect(ErrorReportService.MAX_REPORTS).toBeGreaterThan(0);
    });

    it('STORE_NAME is a string', () => {
      expect(typeof ErrorReportService.STORE_NAME).toBe('string');
    });
  });
});
