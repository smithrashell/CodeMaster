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
    console.warn('🔧 Database debugger already installed');
    return;
  }

  console.log('🔧 Installing global IndexedDB debugger...');
  
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
    
    console.group(`🗄️ GLOBAL INDEXEDDB INTERCEPT: ${name} v${version || 'default'}`);
    console.log('🕐 Timestamp:', timestamp);
    console.log('📍 Context:', context.type);
    console.log('🌐 Location:', context.location);
    console.log('🧵 First Stack Line:', stack.split('\n')[0]);
    
    // Count how many times this specific database has been opened
    const sameDbAttempts = dbCreationLog.filter(attempt => attempt.databaseName === name);
    if (sameDbAttempts.length > 1) {
      console.error(`🚨 DUPLICATE DATABASE ATTEMPT #${sameDbAttempts.length} for database: ${name}`);
      console.log('🔍 Previous attempts:', sameDbAttempts.slice(0, -1));
    }
    console.groupEnd();
    
    // Call original indexedDB.open
    const request = originalOpen.call(this, name, version);
    
    // Log when the database actually opens
    const originalOnSuccess = request.onsuccess;
    request.onsuccess = function(event) {
      console.log(`✅ Database '${name}' opened successfully at ${new Date().toISOString()}`);
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
  console.log('✅ Global IndexedDB debugger installed');
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

/**
 * Get database creation log
 */
export function getDatabaseCreationLog() {
  return [...dbCreationLog];
}

/**
 * Clear database creation log
 */
export function clearDatabaseCreationLog() {
  dbCreationLog = [];
}

/**
 * Get database creation summary
 */
export function getDatabaseCreationSummary() {
  const summary = {};
  
  dbCreationLog.forEach(attempt => {
    const key = attempt.databaseName;
    if (!summary[key]) {
      summary[key] = {
        databaseName: key,
        attemptCount: 0,
        contexts: new Set(),
        timestamps: []
      };
    }
    
    summary[key].attemptCount++;
    summary[key].contexts.add(attempt.context.type);
    summary[key].timestamps.push(attempt.timestamp);
  });
  
  // Convert Sets to arrays for JSON serialization
  Object.values(summary).forEach(db => {
    db.contexts = Array.from(db.contexts);
  });
  
  return summary;
}

// Auto-install debugger when this module is imported
if (typeof window !== 'undefined' && typeof indexedDB !== 'undefined') {
  installDatabaseDebugger();
}