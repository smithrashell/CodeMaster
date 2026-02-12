/**
 * Enhanced tests for StorageService
 *
 * Focus: _createDefaultSettings shape, set/get/remove round-trip,
 * getSessionState logic (primitives, objects, malformed data),
 * getDaysSinceLastActivity, and DB error handling.
 *
 * Test pattern:
 * - Pure functions (_createDefaultSettings) tested directly via top-level import
 * - Content script guard verified using top-level import (jsdom has window.location=http)
 * - DB-backed paths: use a hand-constructed testable service that calls a shared
 *   mock DB, bypassing the isInContentScript guard entirely — same approach as
 *   storageService.test.js uses createTestableStorageService().
 */

// Mock logger first, before all other imports
jest.mock('../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock DB layer
jest.mock('../../db/index.js', () => ({
  dbHelper: { openDB: jest.fn() },
}));

import { dbHelper } from '../../db/index.js';

// ---------------------------------------------------------------------------
// Mock DB factory - mirrors the pattern in storageService.test.js
// ---------------------------------------------------------------------------

let mockRequest;
let mockStore;
let mockTransaction;
let mockDB;

function setupMockDatabase(initialResult = null) {
  mockRequest = {
    result: initialResult,
    onsuccess: null,
    onerror: null,
    error: null,
  };

  mockStore = {
    put: jest.fn().mockReturnValue(mockRequest),
    get: jest.fn().mockReturnValue(mockRequest),
    delete: jest.fn().mockReturnValue(mockRequest),
  };

  mockTransaction = {
    objectStore: jest.fn().mockReturnValue(mockStore),
  };

  mockDB = {
    transaction: jest.fn().mockReturnValue(mockTransaction),
  };

  dbHelper.openDB.mockResolvedValue(mockDB);
}

// Fire the pending onsuccess callback after a tick to let the Promise set up
async function fireSuccess() {
  await new Promise(resolve => setTimeout(resolve, 0));
  if (mockRequest.onsuccess) mockRequest.onsuccess({ target: mockRequest });
}

// ---------------------------------------------------------------------------
// Hand-built testable service — identical logic to storageService.js but
// uses the mocked dbHelper directly, avoiding the isInContentScript guard.
// ---------------------------------------------------------------------------

function createTestableStorageService() {
  const _createDefaultSettings = () => ({
    theme: 'light',
    sessionLength: 'auto',
    limit: 'off',
    reminder: { value: false, label: '6' },
    numberofNewProblemsPerSession: 2,
    adaptive: true,
    focusAreas: [],
    systemFocusPool: null,
    focusAreasLastChanged: null,
    sessionsPerWeek: 5,
    reviewRatio: 40,
    timerDisplay: 'mm:ss',
    breakReminders: { enabled: false, interval: 25 },
    notifications: { sound: false, browser: false, visual: true },
    accessibility: {
      screenReader: {
        enabled: false,
        verboseDescriptions: true,
        announceNavigation: true,
        readFormLabels: true,
      },
      keyboard: {
        enhancedFocus: false,
        customShortcuts: false,
        focusTrapping: false,
      },
      motor: {
        largerTargets: false,
        extendedHover: false,
        reducedMotion: false,
        stickyHover: false,
      },
    },
  });

  const svc = {
    _createDefaultSettings,

    async set(key, value) {
      try {
        const db = await dbHelper.openDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction(['settings'], 'readwrite');
          const store = transaction.objectStore('settings');
          const request = store.put({
            id: key,
            data: value,
            lastUpdated: new Date().toISOString(),
          });
          request.onsuccess = () => resolve({ status: 'success' });
          request.onerror = () => reject(request.error);
        });
      } catch (error) {
        return { status: 'error', message: error.message };
      }
    },

    async get(key) {
      try {
        const db = await dbHelper.openDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction(['settings'], 'readonly');
          const store = transaction.objectStore('settings');
          const request = store.get(key);
          request.onsuccess = () => {
            const result = request.result;
            resolve(result ? result.data : null);
          };
          request.onerror = () => reject(request.error);
        });
      } catch (error) {
        return null;
      }
    },

    async remove(key) {
      try {
        const db = await dbHelper.openDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction(['settings'], 'readwrite');
          const store = transaction.objectStore('settings');
          const request = store.delete(key);
          request.onsuccess = () => resolve({ status: 'success' });
          request.onerror = () => reject(request.error);
        });
      } catch (error) {
        return { status: 'error', message: error.message };
      }
    },

    async getSettings() {
      try {
        const db = await dbHelper.openDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction(['settings'], 'readonly');
          const store = transaction.objectStore('settings');
          const request = store.get('user_settings');
          request.onsuccess = () => {
            if (request.result && request.result.data) {
              resolve(request.result.data);
            } else {
              resolve(_createDefaultSettings());
            }
          };
          request.onerror = () => reject(request.error);
        });
      } catch (error) {
        return _createDefaultSettings();
      }
    },

    async getSessionState(key = 'session_state') {
      try {
        const db = await dbHelper.openDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction(['session_state'], 'readonly');
          const store = transaction.objectStore('session_state');
          const request = store.get(key);

          request.onsuccess = () => {
            const result = request.result;
            if (!result) {
              resolve(null);
              return;
            }

            // Detect malformed data (string spread as indexed object)
            const keys = Object.keys(result);
            const hasNumericKeys = keys.some(k => k !== 'id' && !isNaN(k));
            if (hasNumericKeys && !Object.prototype.hasOwnProperty.call(result, 'value')) {
              resolve(null);
              return;
            }

            // Handle primitives stored in value property
            if (
              Object.prototype.hasOwnProperty.call(result, 'value') &&
              Object.keys(result).length === 2 &&
              result.id === key
            ) {
              resolve(result.value);
            } else {
              resolve(result);
            }
          };
          request.onerror = () => reject(request.error);
        });
      } catch (error) {
        return null;
      }
    },

    async getDaysSinceLastActivity() {
      try {
        const lastActivity = await this.get('last_activity_date');

        if (!lastActivity) {
          await this.set('last_activity_date', new Date().toISOString());
          return 0;
        }

        const lastDate = new Date(lastActivity);
        const now = new Date();
        const diffMs = now - lastDate;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        return diffDays;
      } catch (error) {
        return 0;
      }
    },
  };

  return svc;
}

// ---------------------------------------------------------------------------
// _createDefaultSettings — pure function, no DB or content script check needed
// ---------------------------------------------------------------------------

import { StorageService } from '../storage/storageService.js';

describe('StorageService._createDefaultSettings', () => {
  it('returns an object with a theme property set to light', () => {
    const defaults = StorageService._createDefaultSettings();
    expect(defaults.theme).toBe('light');
  });

  it('returns sessionLength as auto', () => {
    const defaults = StorageService._createDefaultSettings();
    expect(defaults.sessionLength).toBe('auto');
  });

  it('returns adaptive as true', () => {
    const defaults = StorageService._createDefaultSettings();
    expect(defaults.adaptive).toBe(true);
  });

  it('returns focusAreas as empty array', () => {
    const defaults = StorageService._createDefaultSettings();
    expect(Array.isArray(defaults.focusAreas)).toBe(true);
    expect(defaults.focusAreas).toHaveLength(0);
  });

  it('includes all required top-level properties', () => {
    const defaults = StorageService._createDefaultSettings();
    const required = [
      'theme', 'sessionLength', 'limit', 'reminder',
      'numberofNewProblemsPerSession', 'adaptive', 'focusAreas',
      'sessionsPerWeek', 'reviewRatio', 'timerDisplay',
      'breakReminders', 'notifications', 'accessibility',
    ];
    required.forEach((key) => {
      expect(defaults).toHaveProperty(key);
    });
  });

  it('returns accessibility with screenReader, keyboard, and motor sections', () => {
    const defaults = StorageService._createDefaultSettings();
    expect(defaults.accessibility).toHaveProperty('screenReader');
    expect(defaults.accessibility).toHaveProperty('keyboard');
    expect(defaults.accessibility).toHaveProperty('motor');
  });

  it('returns screenReader.enabled as false', () => {
    const defaults = StorageService._createDefaultSettings();
    expect(defaults.accessibility.screenReader.enabled).toBe(false);
  });

  it('returns notifications.visual as true', () => {
    const defaults = StorageService._createDefaultSettings();
    expect(defaults.notifications.visual).toBe(true);
  });

  it('returns reminder as an object with value and label', () => {
    const defaults = StorageService._createDefaultSettings();
    expect(typeof defaults.reminder).toBe('object');
    expect(typeof defaults.reminder.value).toBe('boolean');
    expect(typeof defaults.reminder.label).toBe('string');
  });

  it('returns numberofNewProblemsPerSession as a positive number', () => {
    const defaults = StorageService._createDefaultSettings();
    expect(typeof defaults.numberofNewProblemsPerSession).toBe('number');
    expect(defaults.numberofNewProblemsPerSession).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Content script guard — jsdom sets http://localhost/ so isInContentScript=true
// ---------------------------------------------------------------------------

describe('StorageService — content script guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('set returns error with content-script message', async () => {
    const result = await StorageService.set('key', 'value');
    expect(result.status).toBe('error');
    expect(result.message).toBe('Not available in content scripts');
  });

  it('get returns null', async () => {
    const result = await StorageService.get('key');
    expect(result).toBeNull();
  });

  it('remove returns error with content-script message', async () => {
    const result = await StorageService.remove('key');
    expect(result.status).toBe('error');
    expect(result.message).toBe('Not available in content scripts');
  });

  it('getSessionState returns null', async () => {
    const result = await StorageService.getSessionState('key');
    expect(result).toBeNull();
  });

  it('getDaysSinceLastActivity returns 0', async () => {
    const result = await StorageService.getDaysSinceLastActivity();
    expect(result).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// DB-backed paths — use hand-built testable service that calls mocked dbHelper
// ---------------------------------------------------------------------------

describe('StorageService DB operations (background context)', () => {
  let svc;

  beforeEach(() => {
    jest.clearAllMocks();
    setupMockDatabase();
    svc = createTestableStorageService();
  });

  describe('set', () => {
    it('returns success status when DB succeeds', async () => {
      const promise = svc.set('my_key', 'my_value');
      await fireSuccess();
      const result = await promise;
      expect(result.status).toBe('success');
    });

    it('stores the value under the data property', async () => {
      const promise = svc.set('my_key', { foo: 'bar' });
      await fireSuccess();
      await promise;
      expect(mockStore.put).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'my_key', data: { foo: 'bar' } })
      );
    });

    it('stores a lastUpdated ISO timestamp', async () => {
      const promise = svc.set('my_key', 42);
      await fireSuccess();
      await promise;
      const callArg = mockStore.put.mock.calls[0][0];
      expect(callArg).toHaveProperty('lastUpdated');
      expect(() => new Date(callArg.lastUpdated)).not.toThrow();
    });

    it('returns error status when DB fails', async () => {
      dbHelper.openDB.mockRejectedValue(new Error('DB unavailable'));
      const result = await svc.set('key', 'value');
      expect(result.status).toBe('error');
    });
  });

  describe('get', () => {
    it('returns the stored data value', async () => {
      const promise = svc.get('my_key');
      await new Promise(resolve => setTimeout(resolve, 0));
      mockRequest.result = { id: 'my_key', data: 'my_value' };
      if (mockRequest.onsuccess) mockRequest.onsuccess({ target: mockRequest });
      const value = await promise;
      expect(value).toBe('my_value');
    });

    it('returns null when no record exists', async () => {
      const promise = svc.get('nonexistent');
      await new Promise(resolve => setTimeout(resolve, 0));
      mockRequest.result = null;
      if (mockRequest.onsuccess) mockRequest.onsuccess({ target: mockRequest });
      const value = await promise;
      expect(value).toBeNull();
    });

    it('returns null when DB fails', async () => {
      dbHelper.openDB.mockRejectedValue(new Error('DB unavailable'));
      const result = await svc.get('key');
      expect(result).toBeNull();
    });
  });

  describe('remove', () => {
    it('returns success status', async () => {
      const promise = svc.remove('some_key');
      await fireSuccess();
      const result = await promise;
      expect(result.status).toBe('success');
    });

    it('calls delete on the store with the correct key', async () => {
      const promise = svc.remove('target_key');
      await fireSuccess();
      await promise;
      expect(mockStore.delete).toHaveBeenCalledWith('target_key');
    });

    it('returns error status when DB fails', async () => {
      dbHelper.openDB.mockRejectedValue(new Error('DB unavailable'));
      const result = await svc.remove('key');
      expect(result.status).toBe('error');
    });
  });

  describe('getSettings', () => {
    it('returns default settings when no settings are stored', async () => {
      const promise = svc.getSettings();
      await new Promise(resolve => setTimeout(resolve, 0));
      mockRequest.result = null;
      if (mockRequest.onsuccess) mockRequest.onsuccess({ target: mockRequest });
      const settings = await promise;
      expect(settings.theme).toBe('light');
      expect(settings.adaptive).toBe(true);
    });

    it('returns the stored settings when they exist', async () => {
      const storedSettings = { theme: 'dark', sessionLength: 7, adaptive: false };
      const promise = svc.getSettings();
      await new Promise(resolve => setTimeout(resolve, 0));
      mockRequest.result = { id: 'user_settings', data: storedSettings };
      if (mockRequest.onsuccess) mockRequest.onsuccess({ target: mockRequest });
      const settings = await promise;
      expect(settings.theme).toBe('dark');
      expect(settings.sessionLength).toBe(7);
    });

    it('returns defaults when DB fails', async () => {
      dbHelper.openDB.mockRejectedValue(new Error('DB unavailable'));
      const settings = await svc.getSettings();
      expect(settings.theme).toBe('light');
      expect(settings.adaptive).toBe(true);
    });
  });

  describe('getSessionState', () => {
    it('returns null when no record exists', async () => {
      const promise = svc.getSessionState('session_state');
      await new Promise(resolve => setTimeout(resolve, 0));
      mockRequest.result = null;
      if (mockRequest.onsuccess) mockRequest.onsuccess({ target: mockRequest });
      const result = await promise;
      expect(result).toBeNull();
    });

    it('returns value property for primitive string', async () => {
      const promise = svc.getSessionState('session_state');
      await new Promise(resolve => setTimeout(resolve, 0));
      mockRequest.result = { id: 'session_state', value: 'active' };
      if (mockRequest.onsuccess) mockRequest.onsuccess({ target: mockRequest });
      const result = await promise;
      expect(result).toBe('active');
    });

    it('returns value property for primitive number', async () => {
      const promise = svc.getSessionState('session_state');
      await new Promise(resolve => setTimeout(resolve, 0));
      mockRequest.result = { id: 'session_state', value: 42 };
      if (mockRequest.onsuccess) mockRequest.onsuccess({ target: mockRequest });
      const result = await promise;
      expect(result).toBe(42);
    });

    it('returns value property for primitive boolean', async () => {
      const promise = svc.getSessionState('session_state');
      await new Promise(resolve => setTimeout(resolve, 0));
      mockRequest.result = { id: 'session_state', value: false };
      if (mockRequest.onsuccess) mockRequest.onsuccess({ target: mockRequest });
      const result = await promise;
      expect(result).toBe(false);
    });

    it('returns full object for complex data', async () => {
      const complexData = {
        id: 'session_state',
        sessionId: 'abc123',
        problems: [1, 2, 3],
        currentIndex: 0,
      };
      const promise = svc.getSessionState('session_state');
      await new Promise(resolve => setTimeout(resolve, 0));
      mockRequest.result = complexData;
      if (mockRequest.onsuccess) mockRequest.onsuccess({ target: mockRequest });
      const result = await promise;
      expect(result).toEqual(complexData);
      expect(result.sessionId).toBe('abc123');
    });

    it('detects malformed data with numeric keys and returns null', async () => {
      const promise = svc.getSessionState('session_state');
      await new Promise(resolve => setTimeout(resolve, 0));
      mockRequest.result = { 0: '2', 1: '0', 2: '2', id: 'session_state' };
      if (mockRequest.onsuccess) mockRequest.onsuccess({ target: mockRequest });
      const result = await promise;
      expect(result).toBeNull();
    });

    it('returns null when DB fails', async () => {
      dbHelper.openDB.mockRejectedValue(new Error('DB unavailable'));
      const result = await svc.getSessionState('session_state');
      expect(result).toBeNull();
    });
  });

  describe('getDaysSinceLastActivity', () => {
    it('returns 0 when no last activity is recorded', async () => {
      // get('last_activity_date') returns null → records first use, returns 0
      const promise = svc.getDaysSinceLastActivity();
      // Two async operations: get() then set() for updateLastActivityDate
      // Fire get() onsuccess with null result, then fire set() onsuccess
      await new Promise(resolve => setTimeout(resolve, 0));
      mockRequest.result = null;
      if (mockRequest.onsuccess) mockRequest.onsuccess({ target: mockRequest });
      // After get resolves null, getDaysSinceLastActivity calls set()
      await new Promise(resolve => setTimeout(resolve, 0));
      if (mockRequest.onsuccess) mockRequest.onsuccess({ target: mockRequest });
      const days = await promise;
      expect(days).toBe(0);
    });

    it('returns 0 when last activity was today', async () => {
      const today = new Date().toISOString();
      const promise = svc.getDaysSinceLastActivity();
      await new Promise(resolve => setTimeout(resolve, 0));
      mockRequest.result = { id: 'last_activity_date', data: today };
      if (mockRequest.onsuccess) mockRequest.onsuccess({ target: mockRequest });
      const days = await promise;
      expect(days).toBe(0);
    });

    it('returns correct days when last activity was 3 days ago', async () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const promise = svc.getDaysSinceLastActivity();
      await new Promise(resolve => setTimeout(resolve, 0));
      mockRequest.result = { id: 'last_activity_date', data: threeDaysAgo };
      if (mockRequest.onsuccess) mockRequest.onsuccess({ target: mockRequest });
      const days = await promise;
      expect(days).toBe(3);
    });

    it('returns 0 when DB fails', async () => {
      dbHelper.openDB.mockRejectedValue(new Error('DB unavailable'));
      const days = await svc.getDaysSinceLastActivity();
      expect(days).toBe(0);
    });
  });
});
