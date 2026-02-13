/**
 * Tests for ChromeAPIErrorHandler
 *
 * Covers: sendMessageWithRetry, sendMessageWithTimeout, storageGetWithRetry,
 * storageSetWithRetry, tabsQueryWithRetry, areAPIsAvailable,
 * getExtensionContext, sleep, handleGracefulDegradation,
 * monitorExtensionHealth, reportStorageError, reportTabsError,
 * showErrorReportDialog.
 */

jest.mock('../../monitoring/ErrorReportService', () => ({
  __esModule: true,
  default: {
    storeErrorReport: jest.fn().mockResolvedValue(undefined),
    addUserFeedback: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../../utils/logging/errorNotifications', () => ({
  showErrorNotification: jest.fn(),
  handleChromeAPIError: jest.fn(),
}));

import { ChromeAPIErrorHandler } from '../chromeAPIErrorHandler.js';
import ErrorReportService from '../../monitoring/ErrorReportService';
import { showErrorNotification, handleChromeAPIError } from '../../../utils/logging/errorNotifications';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Set chrome.runtime.lastError for the current tick, then clear it */
function _setLastError(message) {
  chrome.runtime.lastError = { message };
}
function clearLastError() {
  chrome.runtime.lastError = null;
}

describe('ChromeAPIErrorHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearLastError();
    // Use fake timers selectively for sleep-based tests
  });

  // ========================================================================
  // areAPIsAvailable
  // ========================================================================
  describe('areAPIsAvailable', () => {
    it('should return false when chrome is undefined', () => {
      const original = global.chrome;
      delete global.chrome;
      global.chrome = undefined;
      expect(ChromeAPIErrorHandler.areAPIsAvailable()).toBe(false);
      global.chrome = original;
    });
  });

  // ========================================================================
  // getExtensionContext
  // ========================================================================
  describe('getExtensionContext', () => {
    it('should return context object with extension info', () => {
      const ctx = ChromeAPIErrorHandler.getExtensionContext();
      expect(ctx.id).toBe('test-extension-id');
      expect(ctx.version).toBe('1.0.0');
      expect(ctx.available).toBe(true);
    });

    it('should return available:false if chrome APIs throw', () => {
      const originalGetManifest = chrome.runtime.getManifest;
      chrome.runtime.getManifest = () => { throw new Error('no manifest'); };

      const ctx = ChromeAPIErrorHandler.getExtensionContext();
      expect(ctx.available).toBe(false);
      expect(ctx.error).toBe('no manifest');

      chrome.runtime.getManifest = originalGetManifest;
    });
  });

  // ========================================================================
  // sendMessageWithTimeout
  // ========================================================================
  describe('sendMessageWithTimeout', () => {
    it('should resolve with response on success', async () => {
      chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
        cb({ status: 'ok' });
      });

      const result = await ChromeAPIErrorHandler.sendMessageWithTimeout(
        { type: 'test' },
        5000
      );
      expect(result).toEqual({ status: 'ok' });
    });

    it('should reject when chrome.runtime.lastError is set', async () => {
      chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
        chrome.runtime.lastError = { message: 'Extension not found' };
        cb(undefined);
        chrome.runtime.lastError = null;
      });

      await expect(
        ChromeAPIErrorHandler.sendMessageWithTimeout({ type: 'test' }, 5000)
      ).rejects.toThrow('Extension not found');
    });

    it('should reject on timeout', async () => {
      jest.useFakeTimers();

      chrome.runtime.sendMessage.mockImplementation(() => {
        // Never calls the callback
      });

      const promise = ChromeAPIErrorHandler.sendMessageWithTimeout(
        { type: 'test' },
        1000
      );

      jest.advanceTimersByTime(1001);

      await expect(promise).rejects.toThrow('Chrome API timeout');

      jest.useRealTimers();
    });

    it('should reject when response contains error (non-emergency)', async () => {
      chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
        cb({ error: 'Something went wrong' });
      });

      await expect(
        ChromeAPIErrorHandler.sendMessageWithTimeout({ type: 'test' }, 5000)
      ).rejects.toThrow('Something went wrong');
    });

    it('should resolve when response is an emergency response', async () => {
      chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
        cb({ isEmergencyResponse: true, error: 'timeout', session: { id: 's1' } });
      });

      const result = await ChromeAPIErrorHandler.sendMessageWithTimeout(
        { type: 'test' },
        5000
      );
      expect(result.isEmergencyResponse).toBe(true);
    });

    it('should reject with context for session timeout errors', async () => {
      chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
        cb({ error: 'Operation timeout exceeded' });
      });

      await expect(
        ChromeAPIErrorHandler.sendMessageWithTimeout(
          { type: 'getOrCreateSession', sessionType: 'standard' },
          5000
        )
      ).rejects.toThrow('Operation timeout exceeded');
    });

    it('should reject when sendMessage throws synchronously', async () => {
      chrome.runtime.sendMessage.mockImplementation(() => {
        throw new Error('API not available');
      });

      await expect(
        ChromeAPIErrorHandler.sendMessageWithTimeout({ type: 'test' }, 5000)
      ).rejects.toThrow('API not available');
    });
  });

  // ========================================================================
  // sendMessageWithRetry
  // ========================================================================
  describe('sendMessageWithRetry', () => {
    it('should return response on first successful attempt', async () => {
      chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
        cb({ data: 'success' });
      });

      const result = await ChromeAPIErrorHandler.sendMessageWithRetry(
        { type: 'test' },
        { maxRetries: 2, retryDelay: 10, showNotifications: false }
      );
      expect(result).toEqual({ data: 'success' });
    });

    it('should retry on failure and succeed on later attempt', async () => {
      let callCount = 0;
      chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
        callCount++;
        if (callCount === 1) {
          chrome.runtime.lastError = { message: 'Temporary error' };
          cb(undefined);
          chrome.runtime.lastError = null;
        } else {
          cb({ data: 'recovered' });
        }
      });

      const result = await ChromeAPIErrorHandler.sendMessageWithRetry(
        { type: 'test' },
        { maxRetries: 2, retryDelay: 10, showNotifications: false }
      );
      expect(result).toEqual({ data: 'recovered' });
      expect(callCount).toBe(2);
    });

    it('should throw after all retries are exhausted', async () => {
      chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
        chrome.runtime.lastError = { message: 'Persistent error' };
        cb(undefined);
        chrome.runtime.lastError = null;
      });

      await expect(
        ChromeAPIErrorHandler.sendMessageWithRetry(
          { type: 'test', action: 'myAction' },
          { maxRetries: 1, retryDelay: 10, showNotifications: false }
        )
      ).rejects.toThrow('Chrome API failed after 2 attempts');
    });

    it('should store error report when all retries fail', async () => {
      chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
        chrome.runtime.lastError = { message: 'Broken' };
        cb(undefined);
        chrome.runtime.lastError = null;
      });

      try {
        await ChromeAPIErrorHandler.sendMessageWithRetry(
          { type: 'test' },
          { maxRetries: 0, retryDelay: 10, showNotifications: false }
        );
      } catch (e) {
        // expected
      }

      expect(ErrorReportService.storeErrorReport).toHaveBeenCalledWith(
        expect.objectContaining({
          section: 'Chrome API',
          errorType: 'chrome_extension_api',
          severity: 'high',
        })
      );
    });

    it('should call handleChromeAPIError when showNotifications is true', async () => {
      chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
        chrome.runtime.lastError = { message: 'Broken' };
        cb(undefined);
        chrome.runtime.lastError = null;
      });

      try {
        await ChromeAPIErrorHandler.sendMessageWithRetry(
          { type: 'test' },
          { maxRetries: 0, retryDelay: 10, showNotifications: true }
        );
      } catch (e) {
        // expected
      }

      expect(handleChromeAPIError).toHaveBeenCalledWith(
        'Runtime Message',
        expect.any(Error),
        expect.objectContaining({
          onReport: expect.any(Function),
          onRetry: expect.any(Function),
        })
      );
    });
  });

  // ========================================================================
  // storageGetWithRetry
  // ========================================================================
  describe('storageGetWithRetry', () => {
    it('should return storage data on success', async () => {
      chrome.storage.local.get.mockImplementation((keys, cb) => {
        cb({ myKey: 'myValue' });
      });

      const result = await ChromeAPIErrorHandler.storageGetWithRetry('myKey');
      expect(result).toEqual({ myKey: 'myValue' });
    });

    it('should reject with error from chrome.runtime.lastError', async () => {
      chrome.storage.local.get.mockImplementation((keys, cb) => {
        chrome.runtime.lastError = { message: 'Storage quota exceeded' };
        cb({});
        chrome.runtime.lastError = null;
      });

      await expect(
        ChromeAPIErrorHandler.storageGetWithRetry('key', { maxRetries: 0, retryDelay: 10 })
      ).rejects.toThrow('Storage quota exceeded');
    });

    it('should retry and succeed on second attempt', async () => {
      let callCount = 0;
      chrome.storage.local.get.mockImplementation((keys, cb) => {
        callCount++;
        if (callCount === 1) {
          chrome.runtime.lastError = { message: 'Temp fail' };
          cb({});
          chrome.runtime.lastError = null;
        } else {
          cb({ key: 'value' });
        }
      });

      const result = await ChromeAPIErrorHandler.storageGetWithRetry('key', {
        maxRetries: 2,
        retryDelay: 10,
      });
      expect(result).toEqual({ key: 'value' });
    });
  });

  // ========================================================================
  // storageSetWithRetry
  // ========================================================================
  describe('storageSetWithRetry', () => {
    it('should resolve on successful set', async () => {
      chrome.storage.local.set.mockImplementation((items, cb) => {
        cb();
      });

      await expect(
        ChromeAPIErrorHandler.storageSetWithRetry({ key: 'value' })
      ).resolves.toBeUndefined();
    });

    it('should reject with chrome.runtime.lastError on set failure', async () => {
      chrome.storage.local.set.mockImplementation((items, cb) => {
        chrome.runtime.lastError = { message: 'Write failed' };
        cb();
        chrome.runtime.lastError = null;
      });

      await expect(
        ChromeAPIErrorHandler.storageSetWithRetry({ key: 'val' }, { maxRetries: 0, retryDelay: 10 })
      ).rejects.toThrow('Write failed');
    });
  });

  // ========================================================================
  // tabsQueryWithRetry
  // ========================================================================
  describe('tabsQueryWithRetry', () => {
    it('should return tabs on success', async () => {
      chrome.tabs.query.mockImplementation((q, cb) => {
        cb([{ id: 1, url: 'https://leetcode.com' }]);
      });

      const result = await ChromeAPIErrorHandler.tabsQueryWithRetry({ active: true });
      expect(result).toEqual([{ id: 1, url: 'https://leetcode.com' }]);
    });

    it('should throw after all retries on persistent failure', async () => {
      chrome.tabs.query.mockImplementation((q, cb) => {
        chrome.runtime.lastError = { message: 'Tabs unavailable' };
        cb([]);
        chrome.runtime.lastError = null;
      });

      await expect(
        ChromeAPIErrorHandler.tabsQueryWithRetry({}, { maxRetries: 0 })
      ).rejects.toThrow('Tabs unavailable');
    });
  });

  // ========================================================================
  // reportStorageError
  // ========================================================================
  describe('reportStorageError', () => {
    it('should store error report and show notification', async () => {
      const error = new Error('Storage broken');
      await ChromeAPIErrorHandler.reportStorageError('get', error, { keys: ['k'] });

      expect(ErrorReportService.storeErrorReport).toHaveBeenCalledWith(
        expect.objectContaining({
          section: 'Chrome Storage API',
          errorType: 'chrome_storage_api',
          severity: 'medium',
        })
      );
      expect(showErrorNotification).toHaveBeenCalled();
    });

    it('should not throw if storeErrorReport fails', async () => {
      ErrorReportService.storeErrorReport.mockRejectedValueOnce(new Error('fail'));
      const error = new Error('Storage broken');

      // Should not throw
      await ChromeAPIErrorHandler.reportStorageError('set', error);
      expect(showErrorNotification).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // reportTabsError
  // ========================================================================
  describe('reportTabsError', () => {
    it('should store error report for tabs errors', async () => {
      const error = new Error('Tabs broken');
      await ChromeAPIErrorHandler.reportTabsError('query', error, { queryInfo: {} });

      expect(ErrorReportService.storeErrorReport).toHaveBeenCalledWith(
        expect.objectContaining({
          section: 'Chrome Tabs API',
          errorType: 'chrome_tabs_api',
          severity: 'low',
        })
      );
    });
  });

  // ========================================================================
  // handleGracefulDegradation
  // ========================================================================
  describe('handleGracefulDegradation', () => {
    it('should call showErrorNotification with feature name', () => {
      ChromeAPIErrorHandler.handleGracefulDegradation('Session Tracking');

      expect(showErrorNotification).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          title: 'Feature Unavailable',
          persistent: true,
        })
      );
    });

    it('should include fallback action when provided', () => {
      const fallback = jest.fn();
      ChromeAPIErrorHandler.handleGracefulDegradation('Analytics', fallback);

      expect(showErrorNotification).toHaveBeenCalled();
      const opts = showErrorNotification.mock.calls[0][1];
      expect(opts.actions.length).toBe(2);
      expect(opts.actions[0].label).toBe('Use Fallback');
    });

    it('should provide Refresh Page action when no fallback', () => {
      ChromeAPIErrorHandler.handleGracefulDegradation('Sync');

      const opts = showErrorNotification.mock.calls[0][1];
      expect(opts.actions.length).toBe(1);
      expect(opts.actions[0].label).toBe('Refresh Page');
    });
  });

  // ========================================================================
  // monitorExtensionHealth
  // ========================================================================
  describe('monitorExtensionHealth', () => {
    it('should return true when health check succeeds', async () => {
      chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
        cb({ status: 'healthy' });
      });

      const result = await ChromeAPIErrorHandler.monitorExtensionHealth();
      expect(result).toBe(true);
    });

    it('should return false when health check fails', async () => {
      chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
        chrome.runtime.lastError = { message: 'Not responding' };
        cb(undefined);
        chrome.runtime.lastError = null;
      });

      const result = await ChromeAPIErrorHandler.monitorExtensionHealth();
      expect(result).toBe(false);
    });

    it('should return false and degrade when APIs are not available', async () => {
      const origSendMessage = chrome.runtime.sendMessage;
      chrome.runtime.sendMessage = undefined;

      const result = await ChromeAPIErrorHandler.monitorExtensionHealth();
      expect(result).toBe(false);
      expect(showErrorNotification).toHaveBeenCalled();

      chrome.runtime.sendMessage = origSendMessage;
    });
  });

  // ========================================================================
  // showErrorReportDialog
  // ========================================================================
  describe('showErrorReportDialog', () => {
    it('should call prompt and store feedback when user provides input', () => {
      global.prompt = jest.fn(() => 'I was clicking a button');

      ChromeAPIErrorHandler.showErrorReportDialog({ errorId: 'err123' });

      expect(global.prompt).toHaveBeenCalled();
      expect(ErrorReportService.addUserFeedback).toHaveBeenCalledWith(
        'err123',
        'I was clicking a button',
        ['Chrome API communication failure']
      );
    });

    it('should not store feedback when user cancels prompt', () => {
      global.prompt = jest.fn(() => null);

      ChromeAPIErrorHandler.showErrorReportDialog({ errorId: 'err456' });

      expect(global.prompt).toHaveBeenCalled();
      expect(ErrorReportService.addUserFeedback).not.toHaveBeenCalled();
    });
  });

});
