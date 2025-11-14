// Message Router (extracted handlers)
import { routeMessage } from "./messageRouter.js";

// Core Services (used by background script directly, not just message handlers)
import { StorageService } from "../shared/services/storageService.js";
import { ProblemService } from "../shared/services/problemService.js";
import { SessionService } from "../shared/services/sessionService.js";
import { AttemptsService } from "../shared/services/attemptsService.js";
import { TagService } from "../shared/services/tagServices.js";
import { HintInteractionService } from "../shared/services/hintInteractionService.js";
import { AlertingService } from "../shared/services/AlertingService.js";
import { NavigationService } from "../shared/services/navigationService.js";
import FocusCoordinationService from "../shared/services/focusCoordinationService.js";
import AccurateTimer from "../shared/utils/AccurateTimer.js";
import ChromeAPIErrorHandler from "../shared/services/ChromeAPIErrorHandler.js";
import { checkAndApplyDecay } from "../shared/services/recalibrationService.js";

// Database utilities (used in background script functions)
// eslint-disable-next-line no-restricted-imports
import { dbHelper } from "../shared/db/index.js";

// Onboarding (only functions passed as dependencies to messageRouter)
import {
  onboardUserIfNeeded,
  checkOnboardingStatus,
  completeOnboarding
} from "../shared/services/onboardingService.js";

// Test utilities removed - test framework files deleted
// testCoreBusinessLogic and Chrome extension integration tests are still available

// Hot reload
import { connect } from "chrome-extension-hot-reload";

connect(); // Re-enabled: hot-reload notifies when extension needs reload

// Mark this as background script context for database access
if (typeof globalThis !== 'undefined') {
  globalThis.IS_BACKGROUND_SCRIPT_CONTEXT = true;
}

// Service Worker Lifecycle Management for Manifest V3
// Add proper installation and activation handlers
self.addEventListener('install', (event) => {
  console.log('🔧 SERVICE WORKER: Installing background script...');
  console.log('🔧 SERVICE WORKER: Forcing immediate activation');
  // Skip waiting to activate immediately
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  console.log('🔧 SERVICE WORKER: Activated background script...');
  console.log('🔧 SERVICE WORKER: Claiming all clients');
  // Claim all clients immediately
  event.waitUntil(
    self.clients.claim().then(async () => {
      console.log('✅ SERVICE WORKER: All clients claimed, service worker active');

      // Automatic session cleanup removed per Issue #193
      // Sessions are only deleted manually via Settings UI

      // Phase 1: Apply passive decay for returning users (#206)
      // Runs silently in background, no user interaction required
      try {
        console.log('🔄 Checking if passive decay needed...');
        const decayResult = await checkAndApplyDecay();

        if (decayResult.decayApplied) {
          console.log(
            `✅ Passive decay applied: ${decayResult.problemsAffected} problems affected (${decayResult.daysSinceLastUse} days since last use)`
          );
        } else {
          console.log(`✅ No decay needed (${decayResult.daysSinceLastUse} days since last use)`);
        }
      } catch (error) {
        console.error('❌ Passive decay check failed:', error);
        // Don't block activation on decay failure
      }
    })
  );
});

// Add startup message to confirm service worker is running
// Track background script startup time for health monitoring
global.backgroundStartTime = Date.now();

console.log('🚀 SERVICE WORKER: Background script loaded and ready for messages');

// Test functions only available in development builds
if (process.env.NODE_ENV !== 'production') {
  // VERY SIMPLE TEST FUNCTIONS - Development only
  globalThis.testSimple = function() {
    console.log('✅ Simple test function works!');
    return { success: true, message: 'Simple test completed' };
  };

  globalThis.testAsync = function() {
    console.log('✅ Async test function works!');
    return { success: true, message: 'Async test completed' };
  };

  console.log('🧪 Test functions available:', {
    testSimple: typeof globalThis.testSimple,
    testAsync: typeof globalThis.testAsync,
    runTestsSilent: typeof globalThis.runTestsSilent,
    quickHealthCheck: typeof globalThis.quickHealthCheck
  });
}

// Force service worker to stay active by setting up a simple message listener early
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'PING') {
    console.log('🏓 SERVICE WORKER: PING received, sending PONG');
    sendResponse({ status: 'PONG', timestamp: Date.now() });
    return true;
  }
});

console.log('🏓 SERVICE WORKER: PING handler registered');

// Development-only: Expose testing framework globally for browser console access
if (process.env.NODE_ENV !== 'production') {
  // Expose core services globally for testing access
  globalThis.ProblemService = ProblemService;
  globalThis.SessionService = SessionService;
  globalThis.AttemptsService = AttemptsService;
  globalThis.TagService = TagService;
  globalThis.HintInteractionService = HintInteractionService;
  globalThis.AlertingService = AlertingService;
  globalThis.NavigationService = NavigationService;
  globalThis.AccurateTimer = AccurateTimer;
  globalThis.ChromeAPIErrorHandler = ChromeAPIErrorHandler;
  globalThis.FocusCoordinationService = FocusCoordinationService;

  // Only include test helper functions in development builds
  if (process.env.ENABLE_TESTING === 'true') {
    /**
     * CRITICAL SAFETY: Test wrapper that ensures test database is active
     * All tests MUST use this wrapper to prevent production database corruption
     */
    globalThis.withTestDatabase = async function(testFn, testName = 'Unknown Test') {
      console.warn(`🧪 [${testName}] Starting test with database protection...`);

      // Check if test database is already active
      if (!globalThis._testDatabaseActive) {
        console.warn(`⚠️ [${testName}] Test database NOT active - activating now...`);

        // testCoreBusinessLogic will be loaded by core-business-tests.js
        if (typeof globalThis.enableTesting !== 'function') {
          throw new Error(
            `🚨 SAFETY ERROR: enableTesting() not available. ` +
            `This test cannot run safely. Use testCoreBusinessLogic() instead.`
          );
        }

        await globalThis.enableTesting();
        console.log(`✅ [${testName}] Test database activated: CodeMaster_test`);
      } else {
        console.log(`✅ [${testName}] Test database already active`);
      }

      // Run the actual test
      try {
        return await testFn();
      } catch (error) {
        console.error(`❌ [${testName}] Test failed:`, error);
        throw error;
      }
    };
    /**
     * Service Worker Safe Mode - Ultra-quiet testing for service workers
     */
    globalThis.runTestsSilent = async function() {
      try {
        if (typeof globalThis.testCoreBusinessLogic === 'function') {
          return await globalThis.testCoreBusinessLogic({ verbose: false });
        } else {
          console.log('⚠️ testCoreBusinessLogic not available yet, running basic check');
          return await globalThis.quickHealthCheck();
        }
      } catch (error) {
        console.error('runTestsSilent failed:', error);
        return { success: false, error: error.message };
      }
    };

    // Simple test to verify functions are available
    globalThis.quickHealthCheck = function() {
    console.log('🏥 CodeMaster Quick Health Check');
    console.log('================================');

    const results = {
      servicesAvailable: 0,
      servicesTotal: 0,
      functionsAvailable: 0,
      functionsTotal: 0
    };

    // Check core services
    const services = ['ProblemService', 'SessionService', 'TagService', 'HintInteractionService'];
    services.forEach(service => {
      results.servicesTotal++;
      if (typeof globalThis[service] !== 'undefined') {
        results.servicesAvailable++;
        console.log(`✓ ${service} available`);
      } else {
        console.log(`❌ ${service} missing`);
      }
    });

    // Check test functions
    const functions = ['testCoreBusinessLogic'];
    functions.forEach(func => {
      results.functionsTotal++;
      if (typeof globalThis[func] === 'function') {
        results.functionsAvailable++;
        console.log(`✓ ${func} available`);
      } else {
        console.log(`❌ ${func} missing`);
    }
  });

  const serviceHealth = (results.servicesAvailable / results.servicesTotal * 100).toFixed(1);
  const functionHealth = (results.functionsAvailable / results.functionsTotal * 100).toFixed(1);

  console.log('');
  console.log(`📊 Services: ${results.servicesAvailable}/${results.servicesTotal} (${serviceHealth}%)`);
  console.log(`🔧 Functions: ${results.functionsAvailable}/${results.functionsTotal} (${functionHealth}%)`);

  return results;
};

    // Display testing framework info
    console.log('🧪 Background session testing functions enabled');

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('🧪 TESTING FRAMEWORK');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('✅ MAIN TEST (Uses CodeMaster_test database):');
    console.log('   await testCoreBusinessLogic({ verbose: true })');
    console.log('   - 19 comprehensive integration tests');
    console.log('   - Tests real IndexedDB behavior');
    console.log('   - Safe, isolated test database');
    console.log('');
    console.log('📋 Available Options:');
    console.log('   await testCoreBusinessLogic({ verbose: true })  // Detailed output');
    console.log('   await testCoreBusinessLogic({ quick: true })    // Run first 5 tests');
    console.log('   await testCoreBusinessLogic({ cleanup: false }) // Skip cleanup');
    console.log('   await testCoreBusinessLogic({ timeout: 60000 }) // 60s timeout per test (default: 30s)');
    console.log('');
    console.log('🛠️  Helper Functions:');
    console.log('   await quickHealthCheck()  // Check service availability');
    console.log('   await withTestDatabase(() => yourTest())  // Wrap custom tests');
    console.log('');
    console.log('💡 For unit tests, use: npm test');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');
  } // End of ENABLE_TESTING block
}
const withTimeout = (promise, timeoutMs, operationName = 'Operation') => {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
};

let activeRequests = {};
let requestQueue = [];
let isProcessing = false;

// Simplified background script health monitoring
const backgroundScriptHealth = {
  startTime: Date.now(),
  requestCount: 0,
  timeoutCount: 0,

  recordRequest() {
    this.requestCount++;
  },

  recordTimeout(duration) {
    this.timeoutCount++;
    console.warn(`⏰ Request timeout recorded: ${duration}ms (total timeouts: ${this.timeoutCount})`);
  },

  emergencyReset() {
    this.startTime = Date.now();
    this.requestCount = 0;
    this.timeoutCount = 0;
    console.info("🔄 Background script health monitor reset");
  },

  getHealthReport() {
    const uptime = Date.now() - this.startTime;
    return {
      uptime,
      requestCount: this.requestCount,
      timeoutCount: this.timeoutCount,
      activeRequests: Object.keys(activeRequests).length,
      queueLength: requestQueue.length,
      isProcessing
    };
  }
};


const processNextRequest = () => {
  if (requestQueue.length === 0) {
    isProcessing = false;
    return;
  }
  isProcessing = true;
  const { request, sender, sendResponse } = requestQueue.shift();
  handleRequest(request, sender, sendResponse).finally(() => {
    processNextRequest();
  });
};

// Strategy Map data aggregation function
// Stub: cleanupStalledSessions - automatic cleanup removed per Issue #193
const cleanupStalledSessions = async () => {
  console.log('✅ Session cleanup: Manual only (automatic cleanup disabled per Issue #193)');
  return { cleaned: 0, actions: [] };
};

/**
 * Initialize database and onboarding during extension installation
 * This ensures all data is ready before users can interact with the extension
 */
const initializeInstallationOnboarding = async function() {
  try {
    console.log("🎯 Installation onboarding: Starting database initialization...");

    // Set initial loading badge
    try {
      await chrome.action.setBadgeText({ text: '...' });
      await chrome.action.setBadgeBackgroundColor({ color: '#FFA500' }); // Orange for setup
      await chrome.action.setTitle({ title: 'CodeMaster - Setting up database...' });
    } catch (badgeError) {
      console.warn("⚠️ Could not set initial loading badge:", badgeError);
    }

    // Run the full onboarding process
    const result = await onboardUserIfNeeded();

    if (result.success) {
      // Mark installation onboarding as complete
      await StorageService.set('installation_onboarding_complete', {
        completed: true,
        timestamp: new Date().toISOString(),
        version: chrome.runtime.getManifest().version
      });

      // Clear loading badge and set ready state
      try {
        await chrome.action.setBadgeText({ text: '' });
        await chrome.action.setTitle({ title: 'CodeMaster - Algorithm Learning Assistant' });
      } catch (badgeError) {
        console.warn("⚠️ Could not clear loading badge:", badgeError);
      }

      console.log("✅ Installation onboarding completed successfully");
      if (result.warning) {
        console.warn("⚠️ Installation onboarding completed with warnings:", result.message);
      }
    } else {
      console.error("❌ Installation onboarding failed:", result.message);

      // Set error badge
      try {
        await chrome.action.setBadgeText({ text: '!' });
        await chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
        await chrome.action.setTitle({ title: 'CodeMaster - Setup failed. Click to try again.' });
      } catch (badgeError) {
        console.warn("⚠️ Could not set error badge:", badgeError);
      }
    }

  } catch (error) {
    console.error("❌ Error during installation onboarding:", error);

    // Still mark as complete to avoid blocking the extension
    await StorageService.set('installation_onboarding_complete', {
      completed: true,
      timestamp: new Date().toISOString(),
      version: chrome.runtime.getManifest().version,
      error: error.message
    });

    // Clear loading badge since we're marking as complete anyway
    try {
      await chrome.action.setBadgeText({ text: '' });
      await chrome.action.setTitle({ title: 'CodeMaster - Algorithm Learning Assistant' });
    } catch (badgeError) {
      console.warn("⚠️ Could not clear badge after error:", badgeError);
    }

    console.warn("⚠️ Installation onboarding marked complete despite error to avoid blocking extension");
  }
};

/**
 * Initialize the complete consistency system with API safety checks
 * Per Issue #193: Automatic cleanup disabled, only onboarding runs here
 */
const initializeConsistencySystem = function() {
  try {
    console.log("🔧 Initializing system (automatic cleanup disabled per Issue #193)...");

    // Initialize database and onboarding during extension installation
    console.log("🚀 Starting installation-time onboarding...");
    initializeInstallationOnboarding();

    console.log("✅ System initialization complete");
  } catch (error) {
    console.error("❌ Error initializing system:", error);
    console.warn("⚠️ Some features may not work properly");
  }
};

const getStrategyMapData = async () => {
  try {
    // Get current tier and learning state from TagService
    const currentTierData = await TagService.getCurrentTier();
    const _learningState = await TagService.getCurrentLearningState();

    // Get all tag relationships to build tier structure
    // dbHelper is now statically imported at the top
    const db = await dbHelper.openDB();

    const tagRelationships = await new Promise((resolve, reject) => {
      const tx = db.transaction("tag_relationships", "readonly");
      const store = tx.objectStore("tag_relationships");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    // Get tag mastery data
    const tagMastery = await new Promise((resolve, reject) => {
      const tx = db.transaction("tag_mastery", "readonly");
      const store = tx.objectStore("tag_mastery");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    // Organize tags by tier with mastery information
    const tierData = {};
    const tiers = [
      "Core Concept",
      "Fundamental Technique",
      "Advanced Technique",
    ];

    tiers.forEach((tier) => {
      const tierTags = tagRelationships
        .filter((tag) => tag.classification === tier)
        .map((tag) => {
          const masteryInfo = tagMastery.find((m) => m.tag === tag.id) || {};
          const successRate =
            masteryInfo.totalAttempts > 0
              ? masteryInfo.successfulAttempts / masteryInfo.totalAttempts
              : 0;

          return {
            tag: tag.id,
            mastery: successRate,
            unlocked: successRate > 0 || tier === "Core Concept", // Core concepts always unlocked
            attempts: masteryInfo.totalAttempts || 0,
            successful: masteryInfo.successfulAttempts || 0,
          };
        });

      tierData[tier] = tierTags;
    });

    return {
      currentTier: currentTierData.classification || "Core Concept",
      focusTags: currentTierData.focusTags || [],
      tierData,
      masteryData: tagMastery,
    };
  } catch (error) {
    console.error("❌ Error getting Strategy Map data:", error);
    throw error;
  }
};

const handleRequest = async (request, sender, sendResponse) => {
  // Record request for health monitoring
  backgroundScriptHealth.recordRequest();
  const requestStartTime = Date.now();
  
  // Generate unique request ID, including tag parameter for strategy requests
  let requestId = `${request.type}-${sender.tab?.id || "background"}`;
  if (request.type === "getStrategyForTag" && request.tag) {
    requestId = `${request.type}-${request.tag}-${sender.tab?.id || "background"}`;
  }

  if (activeRequests[requestId]) return;
  activeRequests[requestId] = true;
  
  const finishRequest = () => {
    delete activeRequests[requestId];
    const duration = Date.now() - requestStartTime;
    
    // Record timeout if request took too long
    if (duration > 10000) { // 10 second threshold
      backgroundScriptHealth.recordTimeout(duration);
      console.warn(`⏰ Slow request detected: ${request.type} took ${duration}ms`);
    }
    
    processNextRequest();
  };

  try {
    /* ──────────────── Message Routing (extracted to messageRouter.js) ──────────────── */

    // Delegate to message router with all necessary dependencies
    return await routeMessage(request, sendResponse, finishRequest, {
      backgroundScriptHealth,
      withTimeout,
      cleanupStalledSessions,
      getStrategyMapData,
      checkOnboardingStatus,
      completeOnboarding
    });

  } catch (error) {
    sendResponse({ error: "Failed to handle request" });
    finishRequest();
  }
};

const _contentPorts = {};

chrome.action.onClicked.addListener(async (_tab) => {
  try {
    // Check if installation onboarding is complete first
    const onboardingStatus = await StorageService.get('installation_onboarding_complete');
    console.log("🔍 Extension icon clicked - onboarding status:", onboardingStatus);

    // Check if onboarding is complete (can be boolean true or object with completed: true)
    const isOnboardingComplete = onboardingStatus === true || (onboardingStatus && onboardingStatus.completed === true);

    if (!isOnboardingComplete) {
      // Show notification that setup is in progress
      console.log("⏳ Dashboard not ready yet - showing setup notification");
      
      try {
        await chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon128.png',
          title: 'CodeMaster Setup',
          message: 'CodeMaster is still setting up your database. Please wait a moment and try again.',
          priority: 1
        });
      } catch (notificationError) {
        console.warn("⚠️ Could not show notification:", notificationError);
      }
      
      // Update icon to show loading state
      try {
        await chrome.action.setBadgeText({ text: '...' });
        await chrome.action.setBadgeBackgroundColor({ color: '#3498db' });
        await chrome.action.setTitle({ title: 'CodeMaster - Setting up...' });
      } catch (badgeError) {
        console.warn("⚠️ Could not update badge:", badgeError);
      }
      
      return;
    }
    
    // Clear any loading indicators
    try {
      await chrome.action.setBadgeText({ text: '' });
      await chrome.action.setTitle({ title: 'CodeMaster - Algorithm Learning Assistant' });
    } catch (clearError) {
      console.warn("⚠️ Could not clear badge:", clearError);
    }
    
    // Check for existing dashboard tabs first
    const existingTabs = await chrome.tabs.query({ url: chrome.runtime.getURL("app.html") });
    
    if (existingTabs.length > 0) {
      // Focus the existing dashboard tab instead of creating a new one
      const existingTab = existingTabs[0];
      console.log("📱 Focusing existing dashboard tab:", existingTab.id);
      
      // Update and focus the existing tab
      await chrome.tabs.update(existingTab.id, { active: true });
      
      // Move to the window containing the tab if needed
      if (existingTab.windowId) {
        await chrome.windows.update(existingTab.windowId, { focused: true });
      }
    } else {
      // No existing dashboard tab found, create a new one
      console.log("📱 Creating new dashboard tab");
      chrome.tabs.create({ url: "app.html" });
    }
  } catch (error) {
    console.error("❌ Error handling dashboard tab:", error);
    // Fallback: create new tab anyway (but only if onboarding seems complete)
    try {
      const fallbackStatus = await StorageService.get('installation_onboarding_complete');
      const isComplete = fallbackStatus === true || (fallbackStatus && fallbackStatus.completed === true);
      if (isComplete) {
        chrome.tabs.create({ url: "app.html" });
      }
    } catch (fallbackError) {
      console.error("❌ Fallback error:", fallbackError);
    }
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("🔍 BACKGROUND DEBUG: Received request:", { 
    type: request?.type, 
    requestType: typeof request,
    isString: typeof request === 'string',
    requestKeys: typeof request === 'object' ? Object.keys(request || {}) : 'not-object',
    fullRequest: request 
  });

  // Enhanced health check handler for service worker diagnostics
  if (request.type === 'HEALTH_CHECK') {
    console.log('💚 SERVICE WORKER: Health check received');
    const healthData = {
      status: 'healthy', 
      timestamp: Date.now(),
      activeRequests: Object.keys(activeRequests).length,
      queueLength: requestQueue.length,
      isProcessing: isProcessing,
      uptime: Date.now() - (global.backgroundStartTime || Date.now()),
      memory: performance.memory ? {
        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
      } : null,
      activeRequestTypes: Object.keys(activeRequests)
    };
    console.log('📊 SERVICE WORKER Health Details:', healthData);
    sendResponse(healthData);
    return true;
  }

  requestQueue.push({ request, sender, sendResponse });
  if (!isProcessing) processNextRequest();

  return true; // Keep response channel open
});

/** ──────────────── Session Consistency Alarm System ──────────────── **/

// Initialize consistency check alarm on startup
chrome.runtime.onStartup.addListener(() => {
  console.log("🚀 Background script startup - initializing consistency system");
  initializeConsistencySystem();
});

chrome.runtime.onInstalled.addListener((details) => {
  console.log("🚀 Extension installed/updated - initializing system");
  initializeConsistencySystem();

  // Dashboard opening disabled - manual open only
  if (details.reason === 'install') {
    console.log("🎉 First-time install - onboarding will run automatically");
  } else if (details.reason === 'update') {
    console.log("⬆️ Extension updated");
  }
});
