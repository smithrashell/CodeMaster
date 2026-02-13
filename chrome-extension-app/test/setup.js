import "@testing-library/jest-dom";
import "fake-indexeddb/auto";

// Allow real dbHelper.openDB() to work with fake-indexeddb in Jest:
// - IS_BACKGROUND_SCRIPT_CONTEXT bypasses the content-script access block in accessControl.js
// - _testDatabaseActive bypasses the "test accessing production DB" safety check
// These flags ONLY affect this Node.js process; they cannot reach Chrome's real IndexedDB.
globalThis.IS_BACKGROUND_SCRIPT_CONTEXT = true;
globalThis._testDatabaseActive = true;

// Global logger mock - fixes logger issues across all tests
// Must be declared before any imports to ensure proper hoisting
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
  fatal: jest.fn(),
  group: jest.fn(),
  groupEnd: jest.fn(),
  groupCollapsed: jest.fn(),
  log: jest.fn(),
  time: jest.fn(),
  timeEnd: jest.fn(),
  table: jest.fn(),
  count: jest.fn(),
  countReset: jest.fn(),
  clear: jest.fn(),
  assert: jest.fn(),
  dir: jest.fn(),
  dirxml: jest.fn(),
  setLogLevel: jest.fn(),
  getLogLevel: jest.fn(() => 'DEBUG'),
  _createLogEntry: jest.fn(),
  _log: jest.fn(),
  _storeCriticalLog: jest.fn(),
};

jest.mock("../src/shared/utils/logging/logger.js", () => ({
  __esModule: true,
  default: mockLogger,
  // Also export named exports if any modules use them
  trace: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
  fallback: jest.fn(),
}));

// Mock PerformanceMonitor to prevent initialization errors
jest.mock("../src/shared/utils/performance/PerformanceMonitor.js", () => ({
  default: {
    recordTiming: jest.fn(),
    recordEvent: jest.fn(),
    getMetrics: jest.fn(() => ({})),
    cleanup: jest.fn(),
    startQuery: jest.fn(() => ({
      end: jest.fn(),
      addTag: jest.fn(),
      addMetric: jest.fn(),
    })),
    endQuery: jest.fn(),
    logOperation: jest.fn(),
    recordMemoryUsage: jest.fn(),
  },
  // Also export the methods directly for named exports
  recordTiming: jest.fn(),
  recordEvent: jest.fn(),
  getMetrics: jest.fn(() => ({})),
  cleanup: jest.fn(),
  startQuery: jest.fn(() => ({
    end: jest.fn(),
    addTag: jest.fn(),
    addMetric: jest.fn(),
  })),
  endQuery: jest.fn(),
  logOperation: jest.fn(),
  recordMemoryUsage: jest.fn(),
}));

// Note: Window.location mocking causes JSDOM issues, skipping for now

// Mock Chrome Extension APIs
global.chrome = {
  storage: {
    local: {
      get: jest.fn((keys, callback) => {
        if (typeof keys === "function") {
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
      }),
    },
    sync: {
      get: jest.fn((keys, callback) => {
        if (typeof keys === "function") {
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
      }),
    },
  },
  runtime: {
    id: "test-extension-id",
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn(() => false),
    },
    sendMessage: jest.fn((message, callback) => {
      if (callback) callback();
      return Promise.resolve();
    }),
    connect: jest.fn(() => ({
      postMessage: jest.fn(),
      onMessage: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
      },
      onDisconnect: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
      },
    })),
    getManifest: jest.fn(() => ({
      version: "1.0.0",
      name: "CodeMaster Test",
    })),
    getURL: jest.fn((path) => `chrome-extension://test-extension-id/${path}`),
    lastError: null,
    onInstalled: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    onStartup: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    reload: jest.fn(),
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
      removeListener: jest.fn(),
    },
    create: jest.fn((createProperties, callback) => {
      const mockTab = { id: 1, url: createProperties.url };
      if (callback) callback(mockTab);
      return Promise.resolve(mockTab);
    }),
    get: jest.fn((tabId, callback) => {
      const mockTab = { id: tabId, url: "https://example.com" };
      if (callback) callback(mockTab);
      return Promise.resolve(mockTab);
    }),
  },
  action: {
    setBadgeText: jest.fn((details, callback) => {
      if (callback) callback();
      return Promise.resolve();
    }),
    setBadgeBackgroundColor: jest.fn((details, callback) => {
      if (callback) callback();
      return Promise.resolve();
    }),
    setTitle: jest.fn((details, callback) => {
      if (callback) callback();
      return Promise.resolve();
    }),
    setIcon: jest.fn((details, callback) => {
      if (callback) callback();
      return Promise.resolve();
    }),
  },
  scripting: {
    executeScript: jest.fn((injection, callback) => {
      if (callback) callback([]);
      return Promise.resolve([]);
    }),
  },
  alarms: {
    create: jest.fn(),
    clear: jest.fn((name, callback) => {
      if (callback) callback(true);
      return Promise.resolve(true);
    }),
    onAlarm: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
};

// Mock browser global for WebExtensions API
global.browser = global.chrome;

// Mock service worker global 'self' for background script tests
global.self = {
  skipWaiting: jest.fn(() => Promise.resolve()),
  clients: {
    claim: jest.fn(() => Promise.resolve()),
    matchAll: jest.fn(() => Promise.resolve([])),
  },
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  registration: {
    update: jest.fn(() => Promise.resolve()),
    unregister: jest.fn(() => Promise.resolve()),
  },
};

// Polyfill structuredClone for Node.js environment (not available in older versions)
if (!global.structuredClone) {
  global.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

// Suppress JSDOM navigation warnings during tests
const originalError = console.error;
console.error = (...args) => {
  if (
    typeof args[0] === "string" &&
    args[0].includes("Not implemented: navigation")
  ) {
    return; // Suppress JSDOM navigation warnings
  }
  originalError.call(console, ...args);
};

// Mock console methods to reduce noise in tests, but preserve error handling
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  // Keep error handling functional for error boundary tests
  error: (...args) => {
    // Allow error boundary tests to work by not completely mocking console.error
    if (process.env.NODE_ENV === 'test') {
      // Only suppress during normal test execution, not error boundary tests
      return;
    }
    originalError.call(console, ...args);
  },
};

// Mock requestAnimationFrame and cancelAnimationFrame
global.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 0));
global.cancelAnimationFrame = jest.fn((id) => clearTimeout(id));

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock matchMedia (only in jsdom environments where window exists)
if (typeof window !== "undefined") Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock crypto.randomUUID
Object.defineProperty(global, "crypto", {
  value: {
    randomUUID: jest.fn(
      () => "test-uuid-" + Math.random().toString(36).substr(2, 9)
    ),
  },
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
    get: jest.fn((keys) =>
      Promise.resolve(
        typeof keys === "string"
          ? { [keys]: global.testUtils.data[keys] }
          : Array.isArray(keys)
          ? keys.reduce(
              (acc, key) => ({ ...acc, [key]: global.testUtils.data[key] }),
              {}
            )
          : global.testUtils.data
      )
    ),
    set: jest.fn((items) => {
      global.testUtils.data = { ...global.testUtils.data, ...items };
      return Promise.resolve();
    }),
    remove: jest.fn((keys) => {
      const keysArray = Array.isArray(keys) ? keys : [keys];
      keysArray.forEach((key) => delete global.testUtils.data[key]);
      return Promise.resolve();
    }),
  }),

  // Helper to wait for next tick
  waitForNextTick: () => new Promise((resolve) => setTimeout(resolve, 0)),

  // Helper to trigger fake timer advancement
  advanceTimers: (ms = 1000) => {
    if (jest.isMockFunction(setTimeout)) {
      jest.advanceTimersByTime(ms);
    }
  },
};
