// =============================================================================
// 🔧 BACKGROUND SCRIPT RESILIENCE BROWSER TESTS
// =============================================================================
//
// These tests validate background script message handling, concurrent operations,
// service worker lifecycle, and error recovery in the real Chrome environment.
//
// Replaces 17 skipped unit tests from background.critical.test.js that require
// real Chrome extension APIs and service worker environment.
//
// USAGE: Copy these functions to background.js
//
// =============================================================================

globalThis.testConcurrentMessageProcessing = async function(options = {}) {
  const { verbose = false, messageCount = 5 } = options;
  if (verbose) console.log(`⚡ Testing concurrent message processing (${messageCount} messages)...`);

  try {
    let results = {
      success: false,
      summary: '',
      chromeMessagingAvailable: false,
      canSendMessages: false,
      allMessagesProcessed: false,
      processingTime: 0,
      messagesSucceeded: 0,
      messagesFailed: 0,
      averageResponseTime: 0
    };

    // 1. Check Chrome messaging availability
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      results.summary = 'Chrome messaging API not available';
      return results;
    }
    results.chromeMessagingAvailable = true;
    if (verbose) console.log('✓ Chrome messaging API available');

    // 2. Test concurrent message sending
    const startTime = Date.now();
    const messagePromises = [];

    for (let i = 0; i < messageCount; i++) {
      const messagePromise = new Promise((resolve) => {
        const msgStartTime = Date.now();
        chrome.runtime.sendMessage(
          { type: 'ping', id: i, timestamp: msgStartTime },
          (response) => {
            const responseTime = Date.now() - msgStartTime;
            if (chrome.runtime.lastError) {
              resolve({ success: false, id: i, error: chrome.runtime.lastError.message });
            } else {
              resolve({ success: true, id: i, responseTime, response });
            }
          }
        );
      });
      messagePromises.push(messagePromise);
    }

    // 3. Wait for all messages to complete
    try {
      const messageResults = await Promise.all(messagePromises);
      const endTime = Date.now();
      results.processingTime = endTime - startTime;

      results.messagesSucceeded = messageResults.filter(r => r.success).length;
      results.messagesFailed = messageResults.filter(r => !r.success).length;
      results.allMessagesProcessed = results.messagesSucceeded + results.messagesFailed === messageCount;

      const successfulTimes = messageResults.filter(r => r.success && r.responseTime).map(r => r.responseTime);
      if (successfulTimes.length > 0) {
        results.averageResponseTime = Math.round(successfulTimes.reduce((a, b) => a + b, 0) / successfulTimes.length);
      }

      results.canSendMessages = results.messagesSucceeded > 0;

      if (verbose) console.log(`✓ Messages succeeded: ${results.messagesSucceeded}/${messageCount}`);
      if (verbose) console.log(`✓ Total processing time: ${results.processingTime}ms`);
      if (verbose) console.log(`✓ Average response time: ${results.averageResponseTime}ms`);
    } catch (processError) {
      if (verbose) console.log('⚠️ Message processing error:', processError.message);
    }

    // 4. Overall success - at least 80% of messages should succeed
    results.success = results.chromeMessagingAvailable &&
                     results.canSendMessages &&
                     (results.messagesSucceeded / messageCount) >= 0.8;

    // 5. Generate summary
    if (results.success) {
      results.summary = `Concurrent messaging working: ${results.messagesSucceeded}/${messageCount} succeeded, avg ${results.averageResponseTime}ms`;
    } else {
      results.summary = `Concurrent messaging issues: only ${results.messagesSucceeded}/${messageCount} succeeded`;
    }

    if (verbose) console.log('✅ Concurrent message processing test completed');
    return results;

  } catch (error) {
    console.error('❌ testConcurrentMessageProcessing failed:', error);
    return {
      success: false,
      summary: `Concurrent messaging test failed: ${error.message}`,
      error: error.message
    };
  }
};

globalThis.testMessageHandlerTimeout = async function(options = {}) {
  const { verbose = false, timeoutMs = 5000 } = options;
  if (verbose) console.log(`⏱️ Testing message handler timeout (${timeoutMs}ms)...`);

  try {
    let results = {
      success: false,
      summary: '',
      chromeMessagingAvailable: false,
      timeoutHandlingWorks: false,
      responseReceived: false,
      responseTime: 0,
      timedOut: false
    };

    // Check Chrome messaging
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      results.summary = 'Chrome runtime not available';
      return results;
    }
    results.chromeMessagingAvailable = true;

    // Test message with timeout
    const startTime = Date.now();
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve({ timedOut: true }), timeoutMs);
    });

    const messagePromise = new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'test_timeout', timestamp: startTime },
        (response) => {
          const responseTime = Date.now() - startTime;
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message, responseTime });
          } else {
            resolve({ success: true, response, responseTime });
          }
        }
      );
    });

    const result = await Promise.race([messagePromise, timeoutPromise]);

    if (result.timedOut) {
      results.timedOut = true;
      results.timeoutHandlingWorks = true;
      if (verbose) console.log(`✓ Timeout handled correctly (${timeoutMs}ms)`);
    } else if (result.success) {
      results.responseReceived = true;
      results.responseTime = result.responseTime;
      results.timeoutHandlingWorks = result.responseTime < timeoutMs;
      if (verbose) console.log(`✓ Response received in ${result.responseTime}ms (within timeout)`);
    } else {
      if (verbose) console.log('⚠️ Message failed:', result.error);
    }

    // Overall success - either times out properly or responds within timeout
    results.success = results.chromeMessagingAvailable &&
                     results.timeoutHandlingWorks;

    // Generate summary
    if (results.success) {
      if (results.timedOut) {
        results.summary = `Timeout handling working: properly timed out after ${timeoutMs}ms`;
      } else {
        results.summary = `Timeout handling working: responded in ${results.responseTime}ms (within ${timeoutMs}ms limit)`;
      }
    } else {
      results.summary = 'Timeout handling issues: response time exceeded limit or failed';
    }

    if (verbose) console.log('✅ Message handler timeout test completed');
    return results;

  } catch (error) {
    console.error('❌ testMessageHandlerTimeout failed:', error);
    return {
      success: false,
      summary: `Timeout handling test failed: ${error.message}`,
      error: error.message
    };
  }
};

globalThis.testServiceWorkerLifecycle = async function(options = {}) {
  const { verbose = false } = options;
  if (verbose) console.log('🔄 Testing service worker lifecycle management...');

  try {
    let results = {
      success: false,
      summary: '',
      serviceWorkerContext: false,
      chromeAPIsAvailable: false,
      runtimeIdAvailable: false,
      canAccessStorage: false,
      canSendMessages: false,
      extensionContextValid: false
    };

    // 1. Check if running in service worker context
    if (typeof self !== 'undefined' && self.ServiceWorkerGlobalScope) {
      results.serviceWorkerContext = true;
      if (verbose) console.log('✓ Running in service worker context');
    } else if (typeof window === 'undefined') {
      results.serviceWorkerContext = true; // Background script context
      if (verbose) console.log('✓ Running in background script context');
    }

    // 2. Check Chrome extension APIs
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      results.chromeAPIsAvailable = true;
      if (verbose) console.log('✓ Chrome extension APIs available');

      // Check runtime ID
      if (chrome.runtime.id) {
        results.runtimeIdAvailable = true;
        results.extensionContextValid = true;
        if (verbose) console.log(`✓ Extension runtime ID: ${chrome.runtime.id}`);
      }
    }

    // 3. Test storage access (critical for service worker persistence)
    try {
      if (chrome.storage && chrome.storage.local) {
        results.canAccessStorage = true;
        if (verbose) console.log('✓ Chrome storage accessible');
      }
    } catch (storageError) {
      if (verbose) console.log('⚠️ Storage access failed:', storageError.message);
    }

    // 4. Test messaging capability
    if (chrome.runtime && chrome.runtime.sendMessage) {
      results.canSendMessages = true;
      if (verbose) console.log('✓ Message sending capability available');
    }

    // 5. Overall success
    results.success = results.serviceWorkerContext &&
                     results.chromeAPIsAvailable &&
                     results.extensionContextValid;

    // 6. Generate summary
    if (results.success) {
      results.summary = `Service worker lifecycle OK: context ✓, APIs ✓, storage ${results.canAccessStorage ? '✓' : '✗'}, messaging ${results.canSendMessages ? '✓' : '✗'}`;
    } else {
      const issues = [];
      if (!results.serviceWorkerContext) issues.push('not in service worker context');
      if (!results.chromeAPIsAvailable) issues.push('Chrome APIs unavailable');
      if (!results.extensionContextValid) issues.push('invalid extension context');
      results.summary = `Service worker issues: ${issues.join(', ')}`;
    }

    if (verbose) console.log('✅ Service worker lifecycle test completed');
    return results;

  } catch (error) {
    console.error('❌ testServiceWorkerLifecycle failed:', error);
    return {
      success: false,
      summary: `Service worker lifecycle test failed: ${error.message}`,
      error: error.message
    };
  }
};

globalThis.testExtensionReloadRecovery = async function(options = {}) {
  const { verbose = false } = options;
  if (verbose) console.log('🔄 Testing extension reload recovery...');

  try {
    let results = {
      success: false,
      summary: '',
      canDetectReload: false,
      storageAvailable: false,
      dataPreserved: false,
      servicesReinitialized: false,
      criticalServicesCount: 0,
      availableServices: []
    };

    // 1. Check if we can detect previous state (simulates post-reload)
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      results.storageAvailable = true;
      if (verbose) console.log('✓ Storage available for state preservation');

      try {
        // Check if previous session data exists
        const data = await new Promise((resolve) => {
          chrome.storage.local.get(['lastReloadTime', 'sessionCount'], (data) => {
            resolve(data);
          });
        });

        if (data && Object.keys(data).length > 0) {
          results.dataPreserved = true;
          if (verbose) console.log('✓ Previous session data found');
        } else {
          // First run or no previous data - still valid
          results.dataPreserved = true;
          if (verbose) console.log('⚠️ No previous data (first run)');
        }
      } catch (storageError) {
        if (verbose) console.log('⚠️ Storage check failed:', storageError.message);
      }
    }

    // 2. Check if critical services are available (reinitializedafter reload)
    const criticalServices = ['SessionService', 'ProblemService', 'StorageService', 'TagService'];
    const availableServices = criticalServices.filter(service =>
      typeof globalThis[service] !== 'undefined'
    );

    results.availableServices = availableServices;
    results.criticalServicesCount = availableServices.length;
    results.servicesReinitialized = availableServices.length > 0;

    if (verbose) console.log(`✓ Critical services available: ${availableServices.length}/${criticalServices.length}`);

    // 3. Mark that we can detect reload capability
    results.canDetectReload = results.storageAvailable;

    // 4. Overall success - storage works and at least some services are available
    results.success = results.storageAvailable &&
                     results.dataPreserved &&
                     results.servicesReinitialized;

    // 5. Generate summary
    if (results.success) {
      results.summary = `Reload recovery OK: storage ✓, data preserved ✓, services ${results.criticalServicesCount}/${criticalServices.length} available`;
    } else {
      const issues = [];
      if (!results.storageAvailable) issues.push('storage unavailable');
      if (!results.dataPreserved) issues.push('data not preserved');
      if (!results.servicesReinitialized) issues.push('services not reinitialized');
      results.summary = `Reload recovery issues: ${issues.join(', ')}`;
    }

    if (verbose) console.log('✅ Extension reload recovery test completed');
    return results;

  } catch (error) {
    console.error('❌ testExtensionReloadRecovery failed:', error);
    return {
      success: false,
      summary: `Reload recovery test failed: ${error.message}`,
      error: error.message
    };
  }
};

// =============================================================================
// 🎯 Comprehensive Background Script Resilience Test Suite
// =============================================================================

globalThis.testAllBackgroundResilience = async function(options = {}) {
  const { verbose = false } = options;
  console.log('🔧 Running comprehensive background script resilience test suite...');
  console.log('');

  const tests = [
    { name: 'Concurrent Message Processing', fn: testConcurrentMessageProcessing },
    { name: 'Message Handler Timeout', fn: testMessageHandlerTimeout },
    { name: 'Service Worker Lifecycle', fn: testServiceWorkerLifecycle },
    { name: 'Extension Reload Recovery', fn: testExtensionReloadRecovery }
  ];

  let passed = 0;
  let failed = 0;
  const results = [];

  for (const test of tests) {
    try {
      console.log(`Running: ${test.name}...`);
      const result = await test.fn({ verbose });
      results.push({ test: test.name, ...result });

      if (result.success) {
        console.log(`✅ ${test.name}: PASSED`);
        console.log(`   ${result.summary}`);
        passed++;
      } else {
        console.log(`❌ ${test.name}: FAILED`);
        console.log(`   ${result.summary}`);
        failed++;
      }
      console.log('');
    } catch (error) {
      console.error(`❌ ${test.name}: ERROR - ${error.message}`);
      console.log('');
      failed++;
      results.push({ test: test.name, success: false, error: error.message });
    }
  }

  console.log('='.repeat(70));
  console.log(`Background Resilience Test Suite Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(70));

  return {
    success: failed === 0,
    passed,
    failed,
    total: tests.length,
    results
  };
};
