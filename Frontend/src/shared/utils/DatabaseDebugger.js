/**
 * Global Database Debugging Interceptor
 * This hooks into indexedDB.open globally to trace ALL database creation attempts
 */

let interceptorInstalled = false;
let dbCreationLog = [];

/**
 * Install global IndexedDB interceptor
 */
export function installDatabaseDebugger() {
  if (interceptorInstalled) {
    return;
  }
  
  // Store original indexedDB.open
  const originalOpen = indexedDB.open;
  
  // Override indexedDB.open globally
  indexedDB.open = function(name, version) {
    const timestamp = new Date().toISOString();
    const context = getDetailedContext();
    const stack = getCallStack();
    
    // Log this database creation attempt
    const dbAttempt = {
      timestamp,
      databaseName: name,
      version: version || 'default',
      context,
      stack
    };
    
    dbCreationLog.push(dbAttempt);
    
    // Database intercept: ${name} v${version || 'default'}
    
    // Count how many times this specific database has been opened
    const sameDbAttempts = dbCreationLog.filter(attempt => attempt.databaseName === name);
    if (sameDbAttempts.length > 1) {
      console.error(`🚨 DUPLICATE DATABASE ATTEMPT #${sameDbAttempts.length} for database: ${name}`);
    }
    
    // Call original indexedDB.open
    const request = originalOpen.call(this, name, version);
    
    // Log when the database actually opens
    const originalOnSuccess = request.onsuccess;
    request.onsuccess = function(event) {
      if (originalOnSuccess) {
        originalOnSuccess.call(this, event);
      }
    };
    
    const originalOnError = request.onerror;
    request.onerror = function(event) {
      console.error(`❌ Database '${name}' failed to open at ${new Date().toISOString()}:`, event.target.error);
      if (originalOnError) {
        originalOnError.call(this, event);
      }
    };
    
    return request;
  };
  
  interceptorInstalled = true;
}

/**
 * Get detailed execution context
 */
function getDetailedContext() {
  const context = {
    timestamp: new Date().toISOString(),
    type: 'unknown',
    location: 'unknown',
    protocol: 'unknown',
    chromeApis: {}
  };
  
  try {
    // Basic window/location info
    if (typeof window !== 'undefined') {
      context.location = window.location.href;
      context.protocol = window.location.protocol;
      
      // Determine context type
      if (window.location.protocol === 'chrome-extension:') {
        context.type = 'extension-page';
      } else if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
        context.type = 'web-page-or-content-script';
      } else {
        context.type = 'other-protocol';
      }
    } else {
      context.type = 'no-window';
    }
    
    // Chrome extension API availability
    if (typeof chrome !== 'undefined') {
      context.chromeApis = {
        runtime: !!chrome.runtime,
        tabs: !!chrome.tabs,
        storage: !!chrome.storage,
        extension: !!chrome.extension,
        getBackgroundPage: !!(chrome.runtime && chrome.runtime.getBackgroundPage)
      };
      
      // More specific context detection
      if (chrome.runtime && chrome.runtime.getBackgroundPage) {
        context.type += '-background-capable';
      }
      if (chrome.tabs) {
        context.type += '-with-tabs-api';
      }
    }
    
    // Document state
    if (typeof document !== 'undefined') {
      context.documentReady = document.readyState;
      context.documentTitle = document.title.substring(0, 50);
    }
    
  } catch (error) {
    context.error = error.message;
  }
  
  return context;
}

/**
 * Get call stack for debugging
 */
function getCallStack() {
  const error = new Error();
  const stack = error.stack || '';
  return stack.split('\n').slice(3).join('\n'); // Remove Error, getCallStack, and indexedDB.open from stack
}


// Auto-install debugger when this module is imported
if (typeof window !== 'undefined' && typeof indexedDB !== 'undefined') {
  installDatabaseDebugger();
}