/**
 * Test suite to verify database functionality after refactoring
 */
import { dbHelper } from '../index.js';

// Mock environment for testing
global.globalThis = { IS_BACKGROUND_SCRIPT_CONTEXT: true };
global.indexedDB = require('fake-indexeddb');
global.IDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange');

describe('Database Refactoring Tests', () => {
  beforeEach(() => {
    // Clear any cached database
    dbHelper.db = null;
  });

  afterEach(() => {
    // Clean up database after each test
    if (dbHelper.db) {
      dbHelper.db.close();
      dbHelper.db = null;
    }
  });

  test('should open database successfully', async () => {
    const db = await dbHelper.openDB();
    
    expect(db).toBeDefined();
    expect(db.name).toBe('review');
    expect(db.version).toBe(36);
  });

  test('should return cached database on subsequent calls', async () => {
    const db1 = await dbHelper.openDB();
    const db2 = await dbHelper.openDB();
    
    expect(db1).toBe(db2);
  });

  test('should create all required object stores', async () => {
    const db = await dbHelper.openDB();
    
    const expectedStores = [
      'attempts',
      'limits',
      'session_state',
      'problem_relationships',
      'problems',
      'sessions',
      'standard_problems',
      'backup_storage',
      'tag_relationships',
      'tag_mastery',
      'settings',
      'pattern_ladders',
      'session_analytics',
      'strategy_data',
      'hint_interactions',
      'user_actions',
      'error_reports'
    ];
    
    expectedStores.forEach(storeName => {
      expect(Array.from(db.objectStoreNames)).toContain(storeName);
    });
  });

  test('should get store successfully', async () => {
    const store = await dbHelper.getStore('sessions');
    
    expect(store).toBeDefined();
    expect(store.name).toBe('sessions');
  });

  test('should handle ensureIndex method', async () => {
    const db = await dbHelper.openDB();
    const transaction = db.transaction(['sessions'], 'readonly');
    const store = transaction.objectStore('sessions');
    
    // This should not throw an error
    expect(() => {
      dbHelper.ensureIndex(store, 'test_index', 'test_field');
    }).not.toThrow();
  });
});

describe('Database Access Control Tests', () => {
  test('should block access from content scripts', () => {
    // Mock content script environment
    global.globalThis = {};
    global.window = {
      location: {
        protocol: 'https:',
        href: 'https://example.com'
      }
    };
    
    expect(() => {
      dbHelper.openDB();
    }).toThrow(/DATABASE ACCESS BLOCKED/);
  });
});