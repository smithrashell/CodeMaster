import logger from "../utils/logger.js";

/**
 * Enhanced context detection for debugging and test safety
 */
export function getExecutionContext() {
  const context = {
    timestamp: new Date().toISOString(),
    location: typeof window !== 'undefined' ? window.location.href : 'no-window',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 100) : 'no-navigator',
    chromeRuntime: typeof chrome !== 'undefined' && chrome.runtime ? 'available' : 'unavailable',
    chromeExtension: typeof chrome !== 'undefined' && chrome.extension ? 'available' : 'unavailable',
    documentState: typeof document !== 'undefined' ? document.readyState : 'no-document',
    contextType: 'unknown',
    isTest: isTestEnvironment()
  };
  
  try {
    if (typeof window !== 'undefined') {
      if (window.location.protocol === 'chrome-extension:') {
        context.contextType = 'extension-page';
      } else if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
        context.contextType = 'content-script-or-web-page';
      } else {
        context.contextType = 'other-protocol';
      }
    } else {
      context.contextType = 'no-window-context';
    }
    
    // Try to determine if this is background script vs content script
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      if (chrome.runtime.getBackgroundPage) {
        context.contextType += '-background-script';
      } else if (chrome.tabs && chrome.tabs.query) {
        context.contextType += '-with-tabs-api';
      }
    }
  } catch (error) {
    context.error = error.message;
  }
  
  return context;
}

/**
 * Get stack trace for debugging
 */
export function getStackTrace() {
  const error = new Error();
  const stack = error.stack || '';
  return stack.split('\n').slice(2).join('\n'); // Remove Error and getStackTrace from stack
}

/**
 * Validates whether the current context is allowed to access IndexedDB
 * @param {Object} context - Execution context from getExecutionContext()
 * @param {string} stack - Stack trace from getStackTrace()
 * @throws {Error} If access is not allowed
 */
export function validateDatabaseAccess(context, stack) {
  // 🚨 CRITICAL SAFETY NET: Block database access from content scripts
  // BUT allow access from marked background script context

  if (typeof globalThis !== 'undefined' && globalThis.IS_BACKGROUND_SCRIPT_CONTEXT) {
    return;
  }

  if (typeof window !== "undefined" && window.location) {
    const isWebPage = window.location.protocol === "http:" || window.location.protocol === "https:";
    const isNotExtensionPage = !window.location.href.startsWith("chrome-extension://");

    if (isWebPage && isNotExtensionPage) {
      logger.groupEnd();
      const error = new Error(`🚫 DATABASE ACCESS BLOCKED: Content scripts cannot access IndexedDB directly. Context: ${context.contextType}, URL: ${context.location}`);
      console.error(error.message);
      console.error('📚 Blocked Call Stack:', stack);
      throw error;
    }
  }

  // Additional safety check for chrome extension context
  // BUT allow access from marked background script context
  if (typeof chrome !== "undefined" && chrome.runtime && !(typeof globalThis !== 'undefined' && globalThis.IS_BACKGROUND_SCRIPT_CONTEXT)) {
    const hasTabsAPI = !!(chrome.tabs && chrome.tabs.query);

    if (!hasTabsAPI && typeof window !== "undefined" &&
        (window.location.protocol === "http:" || window.location.protocol === "https:")) {
      const error = new Error(`🚫 DATABASE ACCESS BLOCKED: Detected content script context without tabs API. Context: ${context.contextType}`);
      console.error(error.message);
      throw error;
    }
  }
}

/**
 * Logs database access attempt with full context
 * @param {Object} context - Execution context
 * @param {string} stack - Stack trace
 */
export function logDatabaseAccess(context, stack) {
  // Verbose logging removed to prevent console pollution
  // Use logger.debug() if debugging is needed
}

/**
 * Detect if we're running in a test environment
 */
export function isTestEnvironment() {
  // Check multiple test indicators
  const testIndicators = [
    // Jest environment
    typeof jest !== 'undefined',
    typeof global !== 'undefined' && global.jest,
    typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test',

    // Test function names in stack (actual test execution)
    typeof Error !== 'undefined' && Error().stack && (
      Error().stack.includes('jest') ||
      Error().stack.includes('simulateRealisticAttempts') ||
      Error().stack.includes('testRealLearningFlow') ||
      Error().stack.includes('runComprehensiveTests') ||
      Error().stack.includes('withTestDatabase')
    ),

    // Active test database context (more specific than just function existence)
    typeof globalThis !== 'undefined' && globalThis._testDatabaseActive === true
  ];

  return testIndicators.some(Boolean);
}

/**
 * Check if production database access should be blocked
 * @param {string} dbName - Database name being accessed
 * @param {Object} context - Execution context
 */
export function checkProductionDatabaseAccess(dbName, context) {
  // If we're in test mode but trying to access production database
  // Note: Skip this check if global test database redirection is active
  if (context.isTest && dbName === 'CodeMaster' && !globalThis._testDatabaseActive) {
    const error = new Error(
      `🚨 SAFETY VIOLATION: Test code attempted to access production database '${dbName}'. ` +
      `Use createTestDbHelper() instead of the production dbHelper.`
    );

    console.error('🚨 PRODUCTION DATABASE PROTECTION:', {
      dbName,
      isTest: context.isTest,
      contextType: context.contextType,
      violation: 'test-accessing-production-db',
      stack: Error().stack
    });

    throw error;
  }
}