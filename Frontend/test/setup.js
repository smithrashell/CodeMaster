import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';

// Mock Chrome Extension APIs
global.chrome = {
  storage: {
    local: {
      get: jest.fn((keys, callback) => {
        if (typeof keys === 'function') {
          keys({});
        } else if (callback) {
          callback({});
        }
        return Promise.resolve({});
      }),
      set: jest.fn((items, callback) => {
        if (callback) callback();
        return Promise.resolve();
      }),
      remove: jest.fn((keys, callback) => {
        if (callback) callback();
        return Promise.resolve();
      }),
      clear: jest.fn((callback) => {
        if (callback) callback();
        return Promise.resolve();
      })
    },
    sync: {
      get: jest.fn((keys, callback) => {
        if (typeof keys === 'function') {
          keys({});
        } else if (callback) {
          callback({});
        }
        return Promise.resolve({});
      }),
      set: jest.fn((items, callback) => {
        if (callback) callback();
        return Promise.resolve();
      }),
      remove: jest.fn((keys, callback) => {
        if (callback) callback();
        return Promise.resolve();
      }),
      clear: jest.fn((callback) => {
        if (callback) callback();
        return Promise.resolve();
      })
    }
  },
  runtime: {
    id: 'test-extension-id',
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn(() => false)
    },
    sendMessage: jest.fn((message, callback) => {
      if (callback) callback();
      return Promise.resolve();
    }),
    connect: jest.fn(() => ({
      postMessage: jest.fn(),
      onMessage: {
        addListener: jest.fn(),
        removeListener: jest.fn()
      },
      onDisconnect: {
        addListener: jest.fn(),
        removeListener: jest.fn()
      }
    })),
    getManifest: jest.fn(() => ({
      version: '1.0.0',
      name: 'CodeMaster Test'
    }))
  },
  tabs: {
    query: jest.fn((query, callback) => {
      if (callback) callback([]);
      return Promise.resolve([]);
    }),
    sendMessage: jest.fn((tabId, message, callback) => {
      if (callback) callback();
      return Promise.resolve();
    }),
    onUpdated: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  }
};

// Mock browser global for WebExtensions API
global.browser = global.chrome;

// Suppress JSDOM navigation warnings during tests
const originalError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('Not implemented: navigation')) {
    return; // Suppress JSDOM navigation warnings
  }
  originalError.call(console, ...args);
};

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock requestAnimationFrame and cancelAnimationFrame
global.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 0));
global.cancelAnimationFrame = jest.fn((id) => clearTimeout(id));

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  }))
});

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: jest.fn(() => 'test-uuid-' + Math.random().toString(36).substr(2, 9))
  }
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  
  // Reset IndexedDB state
  if (global.indexedDB && global.indexedDB._databases) {
    global.indexedDB._databases.clear();
  }
});

// Global test utilities
global.testUtils = {
  // Helper to create mock chrome storage
  createMockStorage: (initialData = {}) => ({
    data: { ...initialData },
    get: jest.fn((keys) => Promise.resolve(
      typeof keys === 'string' 
        ? { [keys]: global.testUtils.data[keys] }
        : Array.isArray(keys)
        ? keys.reduce((acc, key) => ({ ...acc, [key]: global.testUtils.data[key] }), {})
        : global.testUtils.data
    )),
    set: jest.fn((items) => {
      global.testUtils.data = { ...global.testUtils.data, ...items };
      return Promise.resolve();
    }),
    remove: jest.fn((keys) => {
      const keysArray = Array.isArray(keys) ? keys : [keys];
      keysArray.forEach(key => delete global.testUtils.data[key]);
      return Promise.resolve();
    })
  }),
  
  // Helper to wait for next tick
  waitForNextTick: () => new Promise(resolve => setTimeout(resolve, 0)),
  
  // Helper to trigger fake timer advancement
  advanceTimers: (ms = 1000) => {
    if (jest.isMockFunction(setTimeout)) {
      jest.advanceTimersByTime(ms);
    }
  }
};