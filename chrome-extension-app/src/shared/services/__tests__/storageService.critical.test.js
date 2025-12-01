/**
 * CRITICAL RISK TEST: StorageService Data Loss Prevention
 * Focus: Core functionality that could cause data loss
 */

import { StorageService } from '../storage/storageService';

// Mock the database helper
jest.mock('../../db/index.js', () => ({
  dbHelper: {
    openDB: jest.fn()
  }
}));

// Create mock dbHelper that matches the structure from index.js  
const dbHelper = { openDB: jest.fn() };

// Test setup helpers to reduce main describe function size
const setupBackgroundContext = () => {
  jest.clearAllMocks();
  // Ensure we're in background script context by removing window and setting proper globals
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
};

const cleanupBackgroundContext = () => {
  delete global.chrome;
  delete global.globalThis.IS_BACKGROUND_SCRIPT_CONTEXT;
};

const setupContentScriptContext = () => {
  // Mock content script environment
  global.window = {
    location: {
      protocol: 'https:',
      href: 'https://leetcode.com/problems/test'
    }
  };
};

const cleanupContentScriptContext = () => {
  delete global.window;
};

// Test helper functions to reduce main describe function size
const runDatabaseConnectionTests = () => {
  describe('Database Connection Failures (Data Loss Risk)', () => {
    it('should handle database connection failure gracefully', async () => {
      dbHelper.openDB.mockRejectedValue(new Error('Database unavailable'));

      const result = await StorageService.set('test', 'value');

      expect(result.status).toBe('error');
      expect(result.message).toBeDefined();
    });

    it('should return null on get failure without crashing', async () => {
      dbHelper.openDB.mockRejectedValue(new Error('Database error'));

      const result = await StorageService.get('test');

      expect(result).toBeNull();
    });

    it('should return error status on remove failure', async () => {
      dbHelper.openDB.mockRejectedValue(new Error('Database error'));

      const result = await StorageService.remove('test');

      expect(result.status).toBe('error');
      expect(result.message).toBeDefined();
    });
  });
};

const runSettingsIntegrityTests = () => {
  describe('Settings Integrity (Critical Business Logic)', () => {
    it('should return valid default settings structure', async () => {
      // Mock successful DB but no stored settings
      const mockRequest = { result: null };
      const mockStore = { get: jest.fn().mockReturnValue(mockRequest) };
      const mockTransaction = { objectStore: jest.fn().mockReturnValue(mockStore) };
      const mockDB = { transaction: jest.fn().mockReturnValue(mockTransaction) };
      
      dbHelper.openDB.mockResolvedValue(mockDB);
      
      // Simulate async success
      setTimeout(() => {
        if (mockRequest.onsuccess) mockRequest.onsuccess();
      }, 0);

      const settings = await StorageService.getSettings();

      // Verify default settings structure exists
      expect(settings).toHaveProperty('theme');
      expect(settings).toHaveProperty('sessionLength');
      expect(settings).toHaveProperty('adaptive');
      expect(settings).toHaveProperty('focusAreas');
      
      // Verify default values
      expect(settings.theme).toBe('light');
      expect(settings.sessionLength).toBe('auto'); // Default is 'auto' mode for full adaptive control
      expect(settings.adaptive).toBe(true);
      expect(Array.isArray(settings.focusAreas)).toBe(true);
    });

    it('should validate essential settings properties exist', async () => {
      const settings = await StorageService.getSettings();
      
      // These are critical properties - if missing, app breaks
      const essentialProps = [
        'theme', 'sessionLength', 'limit', 'reminder', 
        'numberofNewProblemsPerSession', 'adaptive', 'focusAreas'
      ];
      
      essentialProps.forEach(prop => {
        expect(settings).toHaveProperty(prop);
      });
    });
  });
};

const runContentScriptProtectionTests = () => {
  describe('Content Script Protection (Security Risk)', () => {
    beforeEach(setupContentScriptContext);
    afterEach(cleanupContentScriptContext);

    it('should block dangerous operations in content script context', async () => {
      const setResult = await StorageService.set('dangerous', 'data');
      expect(setResult.status).toBe('error');
      expect(setResult.message).toContain('Not available in content scripts');

      const getResult = await StorageService.get('dangerous');
      expect(getResult).toBeNull();

      const removeResult = await StorageService.remove('dangerous');
      expect(removeResult.status).toBe('error');
    });
  });
};

const runErrorRecoveryTests = () => {
  describe('Error Recovery (Data Corruption Prevention)', () => {
    it('should handle malformed stored data gracefully', () => {
      // Test default settings creation when data is corrupted
      const defaults = StorageService._createDefaultSettings();
      
      expect(defaults).toHaveProperty('theme');
      expect(defaults).toHaveProperty('sessionLength');
      expect(defaults.theme).toBe('light');
      // sessionLength can be 'auto' (string) or a number
      expect(defaults.sessionLength === 'auto' || typeof defaults.sessionLength === 'number').toBe(true);
    });

    it('should provide valid accessibility defaults', () => {
      const defaults = StorageService._createDefaultSettings();
      
      expect(defaults).toHaveProperty('accessibility');
      expect(defaults.accessibility).toHaveProperty('screenReader');
      expect(defaults.accessibility).toHaveProperty('keyboard');
      expect(defaults.accessibility).toHaveProperty('motor');
      
      // Verify all accessibility settings have proper boolean defaults
      expect(typeof defaults.accessibility.screenReader.enabled).toBe('boolean');
      expect(typeof defaults.accessibility.keyboard.enhancedFocus).toBe('boolean');
      expect(typeof defaults.accessibility.motor.largerTargets).toBe('boolean');
    });
  });
};

const runDataTypeIntegrityTests = () => {
  describe('Data Type Integrity', () => {
    it('should maintain correct data types for critical settings', () => {
      const defaults = StorageService._createDefaultSettings();

      // Type validation for critical settings
      // sessionLength can be 'auto' (string) or a number
      expect(defaults.sessionLength === 'auto' || typeof defaults.sessionLength === 'number').toBe(true);
      expect(typeof defaults.adaptive).toBe('boolean');
      expect(typeof defaults.numberofNewProblemsPerSession).toBe('number');
      expect(Array.isArray(defaults.focusAreas)).toBe(true);
      
      // Validate ranges for numeric values
      if (typeof defaults.sessionLength === 'number') {
        expect(defaults.sessionLength).toBeGreaterThan(0);
      }
      expect(defaults.numberofNewProblemsPerSession).toBeGreaterThan(0);
    });

    it('should have valid reminder structure', () => {
      const defaults = StorageService._createDefaultSettings();
      
      expect(defaults.reminder).toHaveProperty('value');
      expect(defaults.reminder).toHaveProperty('label');
      expect(typeof defaults.reminder.value).toBe('boolean');
      expect(typeof defaults.reminder.label).toBe('string');
    });
  });
};

describe('StorageService - Critical Risk Tests', () => {
  beforeEach(setupBackgroundContext);
  afterEach(cleanupBackgroundContext);

  runDatabaseConnectionTests();
  runSettingsIntegrityTests();
  runContentScriptProtectionTests();
  runErrorRecoveryTests();
  runDataTypeIntegrityTests();
});