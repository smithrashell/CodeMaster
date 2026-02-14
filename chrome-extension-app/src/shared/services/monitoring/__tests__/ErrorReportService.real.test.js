/**
 * Tests for ErrorReportService.js (163 lines, 37% coverage - needs more)
 * Covers storeErrorReport, getErrorReports, resolveErrorReport,
 * addUserFeedback, getErrorStatistics, cleanupOldReports,
 * fallbackToLocalStorage, exportErrorReports, getSafeUrl, getSafeUserAgent
 */

jest.mock('../../../db/index.js', () => ({
  dbHelper: {
    openDB: jest.fn(),
  },
}));

import { ErrorReportService } from '../ErrorReportService.js';
import { dbHelper } from '../../../db/index.js';

/**
 * Helper: create a mock IDB request that auto-fires onsuccess/onerror.
 */
function createAutoRequest(resultVal, errorVal) {
  const req = { result: resultVal, error: errorVal || null };
  let _onsuccess;
  let _onerror;
  Object.defineProperty(req, 'onsuccess', {
    get: () => _onsuccess,
    set: (fn) => {
      _onsuccess = fn;
      if (!errorVal) Promise.resolve().then(() => fn());
    },
  });
  Object.defineProperty(req, 'onerror', {
    get: () => _onerror,
    set: (fn) => {
      _onerror = fn;
      if (errorVal) Promise.resolve().then(() => fn());
    },
  });
  return req;
}

function createMockStoreAndDb(storeOverrides = {}) {
  const store = {
    add: jest.fn(() => createAutoRequest(1)),
    get: jest.fn(() => createAutoRequest(null)),
    put: jest.fn(() => createAutoRequest(null)),
    delete: jest.fn(),
    getAll: jest.fn(() => createAutoRequest([])),
    index: jest.fn(() => ({ getAll: jest.fn(() => createAutoRequest([])) })),
    ...storeOverrides,
  };
  const tx = { objectStore: jest.fn(() => store) };
  const db = { transaction: jest.fn(() => tx) };
  return { db, tx, store };
}

describe('ErrorReportService', () => {
  let savedSendMessage;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    // Disable chrome.runtime.sendMessage so isContentScriptContext() returns false
    // (it requires sendMessage to be truthy)
    savedSendMessage = chrome.runtime.sendMessage;
    chrome.runtime.sendMessage = undefined;
  });

  afterEach(() => {
    chrome.runtime.sendMessage = savedSendMessage;
  });

  // -------------------------------------------------------------------
  // getSafeUrl
  // -------------------------------------------------------------------
  describe('getSafeUrl', () => {
    it('returns a string URL', () => {
      const url = ErrorReportService.getSafeUrl();
      expect(typeof url).toBe('string');
      expect(url.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------
  // getSafeUserAgent
  // -------------------------------------------------------------------
  describe('getSafeUserAgent', () => {
    it('returns a string user agent', () => {
      const ua = ErrorReportService.getSafeUserAgent();
      expect(typeof ua).toBe('string');
      expect(ua.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------
  // storeErrorReport
  // -------------------------------------------------------------------
  describe('storeErrorReport', () => {
    it('stores an error report in IndexedDB and returns the key', async () => {
      jest.spyOn(ErrorReportService, 'cleanupOldReports').mockResolvedValue();
      const { db, store } = createMockStoreAndDb({
        add: jest.fn(() => createAutoRequest(42)),
      });
      dbHelper.openDB.mockResolvedValue(db);

      const result = await ErrorReportService.storeErrorReport({
        errorId: 'err-1',
        message: 'Test error',
        stack: 'Error: Test\n  at ...',
        section: 'Dashboard',
      });

      expect(result).toBe(42);
      expect(store.add).toHaveBeenCalledWith(
        expect.objectContaining({
          errorId: 'err-1',
          message: 'Test error',
          section: 'Dashboard',
          resolved: false,
        })
      );
      ErrorReportService.cleanupOldReports.mockRestore();
    });

    it('falls back to localStorage when IndexedDB fails', async () => {
      dbHelper.openDB.mockRejectedValue(new Error('IDB error'));

      await expect(
        ErrorReportService.storeErrorReport({
          errorId: 'err-1',
          message: 'Test error',
          stack: 'stack',
        })
      ).rejects.toThrow('IDB error');

      const stored = JSON.parse(localStorage.getItem('codemaster_errors'));
      expect(stored).toHaveLength(1);
      expect(stored[0].errorId).toBe('err-1');
    });

    it('rejects when add request fails', async () => {
      const { db } = createMockStoreAndDb({
        add: jest.fn(() => createAutoRequest(null, new Error('Add failed'))),
      });
      dbHelper.openDB.mockResolvedValue(db);

      await expect(
        ErrorReportService.storeErrorReport({
          errorId: 'err-1',
          message: 'Test error',
          stack: 'stack',
        })
      ).rejects.toEqual(new Error('Add failed'));
    });
  });

  // -------------------------------------------------------------------
  // getErrorReports
  // -------------------------------------------------------------------
  describe('getErrorReports', () => {
    it('returns all reports sorted by timestamp (newest first)', async () => {
      const reports = [
        { timestamp: '2024-01-01T00:00:00Z' },
        { timestamp: '2024-01-03T00:00:00Z' },
        { timestamp: '2024-01-02T00:00:00Z' },
      ];
      const { db } = createMockStoreAndDb({
        getAll: jest.fn(() => createAutoRequest(reports)),
      });
      dbHelper.openDB.mockResolvedValue(db);

      const result = await ErrorReportService.getErrorReports();
      expect(result[0].timestamp).toBe('2024-01-03T00:00:00Z');
      expect(result[1].timestamp).toBe('2024-01-02T00:00:00Z');
      expect(result[2].timestamp).toBe('2024-01-01T00:00:00Z');
    });

    it('filters by section using index', async () => {
      const sectionReq = createAutoRequest([{ section: 'Timer', timestamp: '2024-01-01T00:00:00Z' }]);
      const mockIndex = { getAll: jest.fn(() => sectionReq) };
      const { db, store } = createMockStoreAndDb();
      store.index = jest.fn(() => mockIndex);
      dbHelper.openDB.mockResolvedValue(db);

      const result = await ErrorReportService.getErrorReports({ section: 'Timer' });
      expect(store.index).toHaveBeenCalledWith('by_section');
      expect(result).toHaveLength(1);
    });

    it('filters by errorType using index', async () => {
      const typeReq = createAutoRequest([{ errorType: 'react', timestamp: '2024-01-01T00:00:00Z' }]);
      const mockIndex = { getAll: jest.fn(() => typeReq) };
      const { db, store } = createMockStoreAndDb();
      store.index = jest.fn(() => mockIndex);
      dbHelper.openDB.mockResolvedValue(db);

      const result = await ErrorReportService.getErrorReports({ errorType: 'react' });
      expect(store.index).toHaveBeenCalledWith('by_error_type');
      expect(result).toHaveLength(1);
    });

    it('filters by since date', async () => {
      const reports = [
        { timestamp: '2024-01-01T00:00:00Z' },
        { timestamp: '2024-06-01T00:00:00Z' },
      ];
      const { db } = createMockStoreAndDb({ getAll: jest.fn(() => createAutoRequest(reports)) });
      dbHelper.openDB.mockResolvedValue(db);

      const result = await ErrorReportService.getErrorReports({ since: '2024-03-01T00:00:00Z' });
      expect(result).toHaveLength(1);
      expect(result[0].timestamp).toBe('2024-06-01T00:00:00Z');
    });

    it('filters by resolved status', async () => {
      const reports = [
        { timestamp: '2024-01-01T00:00:00Z', resolved: true },
        { timestamp: '2024-01-02T00:00:00Z', resolved: false },
      ];
      const { db } = createMockStoreAndDb({ getAll: jest.fn(() => createAutoRequest(reports)) });
      dbHelper.openDB.mockResolvedValue(db);

      const result = await ErrorReportService.getErrorReports({ resolved: false });
      expect(result).toHaveLength(1);
      expect(result[0].resolved).toBe(false);
    });

    it('applies limit', async () => {
      const reports = Array.from({ length: 50 }, (_, i) => ({
        timestamp: new Date(2024, 0, i + 1).toISOString(),
      }));
      const { db } = createMockStoreAndDb({ getAll: jest.fn(() => createAutoRequest(reports)) });
      dbHelper.openDB.mockResolvedValue(db);

      const result = await ErrorReportService.getErrorReports({ limit: 5 });
      expect(result).toHaveLength(5);
    });

    it('returns empty array on DB error', async () => {
      dbHelper.openDB.mockRejectedValue(new Error('DB error'));
      const result = await ErrorReportService.getErrorReports();
      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------
  // resolveErrorReport
  // -------------------------------------------------------------------
  describe('resolveErrorReport', () => {
    it('marks a report as resolved', async () => {
      const report = { id: 1, message: 'err', resolved: false };
      const getReq = createAutoRequest(report);
      const putReq = createAutoRequest(null);

      const { db } = createMockStoreAndDb({ get: jest.fn(() => getReq), put: jest.fn(() => putReq) });
      dbHelper.openDB.mockResolvedValue(db);

      const result = await ErrorReportService.resolveErrorReport(1, 'Fixed it');
      expect(result.resolved).toBe(true);
      expect(result.resolution).toBe('Fixed it');
      expect(result.resolvedAt).toBeDefined();
    });

    it('rejects when report not found', async () => {
      const getReq = createAutoRequest(null);
      const { db } = createMockStoreAndDb({ get: jest.fn(() => getReq) });
      dbHelper.openDB.mockResolvedValue(db);

      await expect(ErrorReportService.resolveErrorReport(999)).rejects.toThrow('Error report not found');
    });

    it('throws on DB error', async () => {
      dbHelper.openDB.mockRejectedValue(new Error('DB error'));
      await expect(ErrorReportService.resolveErrorReport(1)).rejects.toThrow('DB error');
    });
  });

  // -------------------------------------------------------------------
  // addUserFeedback
  // -------------------------------------------------------------------
  describe('addUserFeedback', () => {
    it('adds feedback and reproduction steps to an existing report', async () => {
      const report = { id: 1, message: 'err' };
      const getReq = createAutoRequest(report);
      const putReq = createAutoRequest(null);

      const { db } = createMockStoreAndDb({ get: jest.fn(() => getReq), put: jest.fn(() => putReq) });
      dbHelper.openDB.mockResolvedValue(db);

      const result = await ErrorReportService.addUserFeedback(1, 'Happens on page load', ['Step 1']);
      expect(result.userFeedback).toBe('Happens on page load');
      expect(result.reproductionSteps).toEqual(['Step 1']);
      expect(result.feedbackAt).toBeDefined();
    });

    it('rejects when report not found', async () => {
      const getReq = createAutoRequest(null);
      const { db } = createMockStoreAndDb({ get: jest.fn(() => getReq) });
      dbHelper.openDB.mockResolvedValue(db);

      await expect(ErrorReportService.addUserFeedback(999, 'feedback')).rejects.toThrow('Error report not found');
    });

    it('throws on DB error', async () => {
      dbHelper.openDB.mockRejectedValue(new Error('DB error'));
      await expect(ErrorReportService.addUserFeedback(1, 'fb')).rejects.toThrow('DB error');
    });
  });

  // -------------------------------------------------------------------
  // getErrorStatistics
  // -------------------------------------------------------------------
  describe('getErrorStatistics', () => {
    it('computes statistics from recent reports', async () => {
      jest.spyOn(ErrorReportService, 'getErrorReports').mockResolvedValue([
        { message: 'Error A happened', section: 'Dashboard', errorType: 'javascript', timestamp: new Date().toISOString(), resolved: true },
        { message: 'Error B occurred', section: 'Timer', errorType: 'react', timestamp: new Date().toISOString(), resolved: false },
      ]);

      const stats = await ErrorReportService.getErrorStatistics(30);
      expect(stats.totalErrors).toBe(2);
      expect(stats.resolvedErrors).toBe(1);
      expect(stats.errorsBySection.Dashboard).toBe(1);
      expect(stats.errorsByType.javascript).toBe(1);

      ErrorReportService.getErrorReports.mockRestore();
    });

    it('returns null on error', async () => {
      jest.spyOn(ErrorReportService, 'getErrorReports').mockRejectedValue(new Error('fail'));
      const stats = await ErrorReportService.getErrorStatistics();
      expect(stats).toBeNull();
      ErrorReportService.getErrorReports.mockRestore();
    });
  });

  // -------------------------------------------------------------------
  // cleanupOldReports
  // -------------------------------------------------------------------
  describe('cleanupOldReports', () => {
    it('deletes excess reports beyond MAX_REPORTS', async () => {
      const reports = Array.from({ length: 105 }, (_, i) => ({
        id: i,
        timestamp: new Date(2024, 0, i + 1).toISOString(),
      }));
      jest.spyOn(ErrorReportService, 'getErrorReports').mockResolvedValue(reports);

      const mockDeleteFn = jest.fn();
      const mockStore = { delete: mockDeleteFn };
      const mockTx = { objectStore: jest.fn(() => mockStore) };
      const mockDb = { transaction: jest.fn(() => mockTx) };
      dbHelper.openDB.mockResolvedValue(mockDb);

      await ErrorReportService.cleanupOldReports();
      expect(mockDeleteFn).toHaveBeenCalledTimes(5);

      ErrorReportService.getErrorReports.mockRestore();
    });

    it('does nothing if report count is under MAX_REPORTS', async () => {
      jest.spyOn(ErrorReportService, 'getErrorReports').mockResolvedValue([{ id: 1 }]);
      await ErrorReportService.cleanupOldReports();
      expect(dbHelper.openDB).not.toHaveBeenCalled();
      ErrorReportService.getErrorReports.mockRestore();
    });

    it('handles errors gracefully', async () => {
      jest.spyOn(ErrorReportService, 'getErrorReports').mockRejectedValue(new Error('fail'));
      await ErrorReportService.cleanupOldReports();
      ErrorReportService.getErrorReports.mockRestore();
    });
  });

  // -------------------------------------------------------------------
  // fallbackToLocalStorage
  // -------------------------------------------------------------------
  describe('fallbackToLocalStorage', () => {
    it('stores error data in localStorage', () => {
      ErrorReportService.fallbackToLocalStorage({ errorId: 'e1', message: 'test' });
      const stored = JSON.parse(localStorage.getItem('codemaster_errors'));
      expect(stored).toHaveLength(1);
      expect(stored[0].errorId).toBe('e1');
    });

    it('appends to existing errors', () => {
      localStorage.setItem('codemaster_errors', JSON.stringify([{ errorId: 'e0' }]));
      ErrorReportService.fallbackToLocalStorage({ errorId: 'e1' });
      const stored = JSON.parse(localStorage.getItem('codemaster_errors'));
      expect(stored).toHaveLength(2);
    });

    it('keeps only last 10 errors', () => {
      const existing = Array.from({ length: 12 }, (_, i) => ({ errorId: `e${i}` }));
      localStorage.setItem('codemaster_errors', JSON.stringify(existing));
      ErrorReportService.fallbackToLocalStorage({ errorId: 'new' });
      const stored = JSON.parse(localStorage.getItem('codemaster_errors'));
      expect(stored).toHaveLength(10);
      expect(stored[stored.length - 1].errorId).toBe('new');
    });
  });

  // -------------------------------------------------------------------
  // exportErrorReports
  // -------------------------------------------------------------------
  describe('exportErrorReports', () => {
    it('exports as JSON', async () => {
      jest.spyOn(ErrorReportService, 'getErrorReports').mockResolvedValue([
        { errorId: 'e1', message: 'test', section: 'Dashboard' },
      ]);

      const result = await ErrorReportService.exportErrorReports('json');
      const parsed = JSON.parse(result);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].errorId).toBe('e1');
      ErrorReportService.getErrorReports.mockRestore();
    });

    it('exports as CSV with proper escaping', async () => {
      jest.spyOn(ErrorReportService, 'getErrorReports').mockResolvedValue([
        { timestamp: '2024-01-01', section: 'Timer', errorType: 'javascript', message: 'Something "broke"', resolved: false, userFeedback: 'It crashed' },
      ]);

      const result = await ErrorReportService.exportErrorReports('csv');
      const lines = result.split('\n');
      expect(lines[0]).toBe('Timestamp,Section,Error Type,Message,Resolved,User Feedback');
      expect(lines[1]).toContain('Timer');
      ErrorReportService.getErrorReports.mockRestore();
    });

    it('throws on unsupported format', async () => {
      jest.spyOn(ErrorReportService, 'getErrorReports').mockResolvedValue([]);
      await expect(ErrorReportService.exportErrorReports('xml')).rejects.toThrow('Unsupported export format: xml');
      ErrorReportService.getErrorReports.mockRestore();
    });
  });
});
