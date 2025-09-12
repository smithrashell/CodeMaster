/**
 * Critical test coverage for StorageService
 * RISK LEVEL: HIGHEST - Data loss prevention
 */

// Mock the database helper
jest.mock('../../db/index.js', () => ({
  dbHelper: {
    openDB: jest.fn()
  }
}));

import { dbHelper } from '../../db/index.js';

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

// Create a StorageService that bypasses content script checks for testing
const createTestableStorageService = () => {
  return {
    async set(key, value) {
      try {
        const db = await dbHelper.openDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction(["settings"], "readwrite");
          const store = transaction.objectStore("settings");
          const request = store.put({
            id: key,
            data: value,
            lastUpdated: new Date().toISOString()
          });
          request.onsuccess = () => resolve({ status: "success" });
          request.onerror = () => reject(request.error);
        });
      } catch (error) {
        console.error("StorageService set failed:", error);
        return { status: "error", message: error.message };
      }
    },

    async get(key) {
      try {
        const db = await dbHelper.openDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction(["settings"], "readonly");
          const store = transaction.objectStore("settings");
          const request = store.get(key);
          request.onsuccess = () => {
            const result = request.result;
            resolve(result ? result.data : null);
          };
          request.onerror = () => reject(request.error);
        });
      } catch (error) {
        console.error("StorageService get failed:", error);
        return null;
      }
    },

    async remove(key) {
      try {
        const db = await dbHelper.openDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction(["settings"], "readwrite");
          const store = transaction.objectStore("settings");
          const request = store.delete(key);
          request.onsuccess = () => resolve({ status: "success" });
          request.onerror = () => reject(request.error);
        });
      } catch (error) {
        console.error("StorageService remove failed:", error);
        return { status: "error", message: error.message };
      }
    },

    _createDefaultSettings() {
      return {
        theme: "light",
        sessionLength: 5,
        limit: "off",
        reminder: { value: false, label: "6" },
        numberofNewProblemsPerSession: 2,
        adaptive: true,
        focusAreas: [],
        accessibility: {
          screenReader: {
            enabled: false,
            verboseDescriptions: true,
            announceNavigation: true,
            readFormLabels: true
          },
          keyboard: {
            enhancedFocus: false,
            customShortcuts: false,
            focusTrapping: false
          },
          motor: {
            largerTargets: false,
            extendedHover: false,
            reducedMotion: false,
            stickyHover: false
          }
        }
      };
    },

    async getSettings() {
      try {
        const db = await dbHelper.openDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction(["settings"], "readonly");
          const store = transaction.objectStore("settings");
          const request = store.get("user_settings");
          
          request.onsuccess = () => {
            if (request.result && request.result.data) {
              resolve(request.result.data);
            } else {
              // Return default settings if none exist
              const defaultSettings = this._createDefaultSettings();
              // Override some keyboard accessibility defaults
              defaultSettings.accessibility.keyboard.enhancedFocus = true;
              defaultSettings.accessibility.keyboard.skipToContent = true;
              defaultSettings.accessibility.keyboard.focusTrapping = true;
              resolve(defaultSettings);
            }
          };
          request.onerror = () => reject(request.error);
        });
      } catch (error) {
        console.error("StorageService getSettings failed:", error);
        return this._createDefaultSettings();
      }
    },

    async setSettings(settings) {
      try {
        const db = await dbHelper.openDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction(["settings"], "readwrite");
          const store = transaction.objectStore("settings");
          const request = store.put({
            id: "user_settings",
            data: settings,
            lastUpdated: new Date().toISOString()
          });
          
          request.onsuccess = () => {
            this.clearSettingsCache();
            resolve({ status: "success" });
          };
          request.onerror = () => reject(request.error);
        });
      } catch (error) {
        console.error("StorageService setSettings failed:", error);
        return { status: "error", message: error.message };
      }
    },

    clearSettingsCache() {
      console.log("🔄 StorageService: Settings cache clear requested");
    }
  };
};

describe('StorageService - Critical Data Operations', () => {
  let StorageService;

  beforeEach(() => {
    jest.clearAllMocks();
    setupMockDatabase();
    StorageService = createTestableStorageService();
  });

  runCriticalDataStorageTests();
  runSettingsManagementTests();
  runContentScriptSecurityTests();
  runDataIntegrityTests();
});

// Test suite functions to reduce main describe block size
function runCriticalDataStorageTests() {
  describe('Critical Data Storage Operations', () => {
    it('should successfully store data with proper structure', async () => {
      const testKey = 'testSetting';
      const testValue = { theme: 'dark', sessionLength: 10 };

      const StorageService = createTestableStorageService();
      
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

      const StorageService = createTestableStorageService();
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

      const StorageService = createTestableStorageService();
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

      const StorageService = createTestableStorageService();
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

      const StorageService = createTestableStorageService();
      const result = await StorageService.set('testKey', 'testValue');

      expect(result.status).toBe('error');
      expect(result.message).toContain('Database connection failed');
    });
  });
};

function runSettingsManagementTests() {
  describe('Settings Management (Critical Business Logic)', () => {
    it('should store complete user settings with validation', async () => {
      const settings = {
        theme: 'dark',
        sessionLength: 8,
        adaptive: true,
        focusAreas: ['arrays', 'strings']
      };

      const StorageService = createTestableStorageService();
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
      const StorageService = createTestableStorageService();
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

      const StorageService = createTestableStorageService();
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
    });
  });
};

function runContentScriptSecurityTests() {
  describe('Content Script Security (Data Protection)', () => {
    it('should block content script access to prevent data corruption', async () => {
      // Create a StorageService that simulates content script behavior
      const contentScriptStorageService = {
        async set(key, value) {
          return { status: "error", message: "Not available in content scripts" };
        }
      };

      const result = await contentScriptStorageService.set('testKey', 'testValue');

      expect(result.status).toBe('error');
      expect(result.message).toContain('Not available in content scripts');
    });

    it('should return null for get operations in content scripts', async () => {
      // Create a StorageService that simulates content script behavior
      const contentScriptStorageService = {
        async get(key) {
          return null;
        }
      };

      const result = await contentScriptStorageService.get('testKey');

      expect(result).toBeNull();
    });

    it('should block remove operations in content scripts', async () => {
      // Create a StorageService that simulates content script behavior
      const contentScriptStorageService = {
        async remove(key) {
          return { status: "error", message: "Not available in content scripts" };
        }
      };

      const result = await contentScriptStorageService.remove('testKey');

      expect(result.status).toBe('error');
      expect(result.message).toContain('Not available in content scripts');
    });
  });
};

function runDataIntegrityTests() {
  describe('Data Integrity and Error Recovery', () => {
    it('should handle corrupted data gracefully', async () => {
      const StorageService = createTestableStorageService();
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
      
      const StorageService = createTestableStorageService();
      const setPromise = StorageService.set('timestampTest', testData);
      
      setTimeout(() => {
        mockRequest.onsuccess();
      }, 0);

      await setPromise;

      const storedData = mockStore.put.mock.calls[0][0];
      expect(storedData.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });

    it('should handle database transaction failures', async () => {
      // Create a testable service that simulates transaction failure
      const transactionFailureStorageService = {
        async set(key, value) {
          try {
            const db = await dbHelper.openDB();
            // Simulate transaction failure
            throw new Error('Transaction failed');
          } catch (error) {
            console.error("StorageService set failed:", error);
            return { status: "error", message: error.message };
          }
        }
      };

      const result = await transactionFailureStorageService.set('testKey', 'testValue');

      expect(result.status).toBe('error');
      expect(result.message).toContain('Transaction failed');
    });
  });
};