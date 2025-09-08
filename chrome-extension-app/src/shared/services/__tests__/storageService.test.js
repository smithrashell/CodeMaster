/**
 * Critical test coverage for StorageService
 * RISK LEVEL: HIGHEST - Data loss prevention
 */

// StorageService will be dynamically imported to ensure proper context setup

// Mock the database helper
jest.mock('../../db/index.js', () => ({
  dbHelper: {
    openDB: jest.fn()
  }
}));

// Create mock dbHelper that matches the structure from index.js
const dbHelper = { openDB: jest.fn() };
import { StorageService } from '../storageService.js';

// Global test state
let mockDB;
let mockTransaction;
let mockStore;
let mockRequest;

// Test setup helper functions
const setupMockDatabase = () => {
  // Setup mock IndexedDB structure
  mockRequest = {
    onsuccess: null,
    onerror: null,
    result: null,
    error: null
  };

  mockStore = {
    put: jest.fn().mockReturnValue(mockRequest),
    get: jest.fn().mockReturnValue(mockRequest),
    delete: jest.fn().mockReturnValue(mockRequest)
  };

  mockTransaction = {
    objectStore: jest.fn().mockReturnValue(mockStore)
  };

  mockDB = {
    transaction: jest.fn().mockReturnValue(mockTransaction)
  };

  dbHelper.openDB.mockResolvedValue(mockDB);
};

const setupBackgroundContext = () => {
  jest.clearAllMocks();
  
  // Ensure we're NOT in content script context for most tests
  delete global.window;
  delete global.location;
  
  // Mock Chrome extension environment
  global.chrome = {
    runtime: { getURL: jest.fn() },
    tabs: { query: jest.fn() }
  };
  
  // Set background script context flag that StorageService checks for
  global.globalThis = global.globalThis || {};
  global.globalThis.IS_BACKGROUND_SCRIPT_CONTEXT = true;
  
  // Clear module cache to ensure StorageService re-evaluates context
  jest.resetModules();
  
  setupMockDatabase();
};

describe('StorageService - Critical Data Operations', () => {
  beforeEach(setupBackgroundContext);

  runCriticalDataStorageTests();
  runSettingsManagementTests();
  runContentScriptSecurityTests();
  runDataIntegrityTests();
});

// Test suite functions to reduce main describe block size
const runCriticalDataStorageTests = () => {
  describe('Critical Data Storage Operations', () => {
    it('should successfully store data with proper structure', async () => {
      const testKey = 'testSetting';
      const testValue = { theme: 'dark', sessionLength: 10 };

      // Dynamically import StorageService after context setup
      const { StorageService } = await import('../storageService');
      
      // Start the operation
      const setPromise = StorageService.set(testKey, testValue);
      
      // Wait a tick for the promise setup, then simulate success
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Simulate successful storage
      if (mockRequest.onsuccess) {
        mockRequest.onsuccess();
      }

      const result = await setPromise;

      expect(result.status).toBe('success');
      expect(mockDB.transaction).toHaveBeenCalledWith(['settings'], 'readwrite');
      expect(mockStore.put).toHaveBeenCalledWith({
        id: testKey,
        data: testValue,
        lastUpdated: expect.any(String)
      });
    });

    it('should handle storage errors gracefully to prevent data loss', async () => {
      const testKey = 'testSetting';
      const testValue = { theme: 'dark' };

      const setPromise = StorageService.set(testKey, testValue);
      
      // Simulate storage error
      setTimeout(() => {
        mockRequest.error = new Error('Database write failed');
        mockRequest.onerror();
      }, 0);

      await expect(setPromise).rejects.toThrow('Database write failed');
      expect(mockDB.transaction).toHaveBeenCalledWith(['settings'], 'readwrite');
    });

    it('should retrieve stored data correctly', async () => {
      const testKey = 'testSetting';
      const expectedData = { theme: 'light', sessionLength: 5 };

      const getPromise = StorageService.get(testKey);
      
      // Simulate successful retrieval
      setTimeout(() => {
        mockRequest.result = {
          id: testKey,
          data: expectedData,
          lastUpdated: '2024-01-01T00:00:00Z'
        };
        mockRequest.onsuccess();
      }, 0);

      const result = await getPromise;

      expect(result).toEqual(expectedData);
      expect(mockDB.transaction).toHaveBeenCalledWith(['settings'], 'readonly');
      expect(mockStore.get).toHaveBeenCalledWith(testKey);
    });

    it('should return null for non-existent keys', async () => {
      const testKey = 'nonExistentSetting';

      const getPromise = StorageService.get(testKey);
      
      // Simulate key not found
      setTimeout(() => {
        mockRequest.result = null;
        mockRequest.onsuccess();
      }, 0);

      const result = await getPromise;

      expect(result).toBeNull();
    });

    it('should handle database connection failures', async () => {
      dbHelper.openDB.mockRejectedValue(new Error('Database connection failed'));

      const result = await StorageService.set('testKey', 'testValue');

      expect(result.status).toBe('error');
      expect(result.message).toContain('Database connection failed');
    });
  });
};

const runSettingsManagementTests = () => {
  describe('Settings Management (Critical Business Logic)', () => {
    it('should store complete user settings with validation', async () => {
      const settings = {
        theme: 'dark',
        sessionLength: 8,
        adaptive: true,
        focusAreas: ['arrays', 'strings']
      };

      const setPromise = StorageService.setSettings(settings);
      
      setTimeout(() => {
        mockRequest.onsuccess();
      }, 0);

      const result = await setPromise;

      expect(result.status).toBe('success');
      expect(mockStore.put).toHaveBeenCalledWith({
        id: 'user_settings',
        data: settings,
        lastUpdated: expect.any(String)
      });
    });

    it('should return default settings when no settings exist', async () => {
      const getPromise = StorageService.getSettings();
      
      setTimeout(() => {
        mockRequest.result = null; // No settings found
        mockRequest.onsuccess();
      }, 0);

      const result = await getPromise;

      // Should return default settings structure
      expect(result).toHaveProperty('theme');
      expect(result).toHaveProperty('sessionLength');
      expect(result).toHaveProperty('adaptive');
      expect(result.theme).toBe('light'); // Default theme
      expect(result.sessionLength).toBe(5); // Default session length
    });

    it('should merge user settings with defaults', async () => {
      const partialSettings = { theme: 'dark' };

      const getPromise = StorageService.getSettings();
      
      setTimeout(() => {
        mockRequest.result = {
          id: 'user_settings',
          data: partialSettings
        };
        mockRequest.onsuccess();
      }, 0);

      const result = await getPromise;

      expect(result.theme).toBe('dark'); // User setting
      expect(result.sessionLength).toBe(5); // Default setting
      expect(result.adaptive).toBe(true); // Default setting
    });
  });
};

const runContentScriptSecurityTests = () => {
  describe('Content Script Security (Data Protection)', () => {
    let _originalWindow;

    beforeEach(() => {
      // Save original window if it exists
      _originalWindow = global.window;
      
      // Mock content script context
      global.window = {
        location: {
          protocol: 'https:',
          href: 'https://leetcode.com/problems/two-sum'
        }
      };
      
      // Re-import StorageService to pick up the new window context
      jest.resetModules();
    });

    afterEach(() => {
      // Cleanup globals  
      delete global.chrome;
      delete global.globalThis?.IS_BACKGROUND_SCRIPT_CONTEXT;
      delete global.window;
      delete global.location;
      jest.resetModules();
    });

    it('should block content script access to prevent data corruption', async () => {
      const result = await StorageService.set('testKey', 'testValue');

      expect(result.status).toBe('error');
      expect(result.message).toContain('Not available in content scripts');
      expect(mockDB.transaction).not.toHaveBeenCalled();
    });

    it('should return null for get operations in content scripts', async () => {
      const result = await StorageService.get('testKey');

      expect(result).toBeNull();
      expect(mockDB.transaction).not.toHaveBeenCalled();
    });

    it('should block remove operations in content scripts', async () => {
      const result = await StorageService.remove('testKey');

      expect(result.status).toBe('error');
      expect(result.message).toContain('Not available in content scripts');
      expect(mockDB.transaction).not.toHaveBeenCalled();
    });
  });
};

const runDataIntegrityTests = () => {
  describe('Data Integrity and Error Recovery', () => {
    it('should handle corrupted data gracefully', async () => {
      const getPromise = StorageService.get('corruptedKey');
      
      setTimeout(() => {
        mockRequest.result = {
          id: 'corruptedKey',
          data: null, // Corrupted data
          lastUpdated: 'invalid-date'
        };
        mockRequest.onsuccess();
      }, 0);

      const result = await getPromise;
      expect(result).toBeNull(); // Should handle corruption gracefully
    });

    it('should validate timestamp format in stored data', async () => {
      const testData = { theme: 'dark' };
      
      const setPromise = StorageService.set('timestampTest', testData);
      
      setTimeout(() => {
        mockRequest.onsuccess();
      }, 0);

      await setPromise;

      const storedData = mockStore.put.mock.calls[0][0];
      expect(storedData.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });

    it('should handle database transaction failures', async () => {
      mockDB.transaction.mockImplementation(() => {
        throw new Error('Transaction failed');
      });

      const result = await StorageService.set('testKey', 'testValue');

      expect(result.status).toBe('error');
      expect(result.message).toContain('Transaction failed');
    });
  });
};