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
import { adaptiveLimitsService } from "../shared/services/adaptiveLimitsService.js";
import AccurateTimer from "../shared/utils/AccurateTimer.js";
import { InterviewService } from "../shared/services/interviewService.js";
import ChromeAPIErrorHandler from "../shared/services/ChromeAPIErrorHandler.js";
import StorageCleanupManager from "../shared/utils/storageCleanup.js";

// Database utilities (used in background script functions)
// eslint-disable-next-line no-restricted-imports
import { dbHelper } from "../shared/db/index.js";
import { getAllFromStore } from "../shared/db/common.js";
import { updateSessionInDB, evaluateDifficultyProgression, applyEscapeHatchLogic } from "../shared/db/sessions.js";

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
  // Claim all clients immediately and start periodic cleanup
  event.waitUntil(
    self.clients.claim().then(() => {
      console.log('✅ SERVICE WORKER: All clients claimed, service worker active');

      // Start 24-hour periodic cleanup (runs immediately + every 24h)
      StorageCleanupManager.startPeriodicCleanup();
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

  // Check if session testing should be enabled and conditionally expose functions
  (() => {
    let sessionTestingEnabled = false;
    // Always enable session testing - no imports needed
    sessionTestingEnabled = true;

    if (sessionTestingEnabled) {
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
  }
  })();
}
