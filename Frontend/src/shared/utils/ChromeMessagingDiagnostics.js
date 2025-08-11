/**
 * Chrome Messaging Diagnostics
 *
 * Deep diagnostic tool to identify the root cause of Chrome messaging failures
 */

export class ChromeMessagingDiagnostics {
  constructor() {
    this.testResults = [];
    this.backgroundScriptStatus = "unknown";
  }

  /**
   * Run comprehensive diagnostics
   */
  async runFullDiagnostics() {
    console.log(
      "🔍 DIAGNOSTICS: Starting comprehensive Chrome messaging diagnostics..."
    );

    const results = {
      timestamp: Date.now(),
      tests: {},
      recommendations: [],
    };

    // Test 1: Check if background script is running
    results.tests.backgroundScript = await this.testBackgroundScript();

    // Test 2: Check basic Chrome runtime
    results.tests.chromeRuntime = await this.testChromeRuntime();

    // Test 3: Check if extension context is valid
    results.tests.extensionContext = await this.testExtensionContext();

    // Test 4: Test simple message passing
    results.tests.basicMessaging = await this.testBasicMessaging();

    // Test 5: Check IndexedDB access from background
    results.tests.backgroundDB = await this.testBackgroundDBAccess();

    // Test 6: Check if background script handlers exist
    results.tests.messageHandlers = await this.testMessageHandlers();

    // Generate recommendations
    results.recommendations = this.generateRecommendations(results.tests);

    console.log("🔍 DIAGNOSTICS: Complete results:", results);
    return results;
  }

  /**
   * Test if background script is running at all
   */
  async testBackgroundScript() {
    console.log("🔍 TEST 1: Checking if background script is running...");

    return new Promise((resolve) => {
      try {
        // Try to get background script info
        chrome.runtime.getBackgroundPage((backgroundPage) => {
          if (chrome.runtime.lastError) {
            resolve({
              success: false,
              error: chrome.runtime.lastError.message,
              issue: "Background script not accessible",
            });
            return;
          }

          resolve({
            success: true,
            backgroundExists: !!backgroundPage,
            issue: backgroundPage ? null : "Background page is null",
          });
        });
      } catch (error) {
        resolve({
          success: false,
          error: error.message,
          issue: "Exception accessing background script",
        });
      }
    });
  }

  /**
   * Test basic Chrome runtime functionality
   */
  async testChromeRuntime() {
    console.log("🔍 TEST 2: Testing Chrome runtime basics...");

    try {
      const manifest = chrome.runtime.getManifest();
      const extensionId = chrome.runtime.id;

      return {
        success: true,
        manifestVersion: manifest.manifest_version,
        extensionId,
        name: manifest.name,
        version: manifest.version,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        issue: "Chrome runtime not accessible",
      };
    }
  }

  /**
   * Test extension context validity
   */
  async testExtensionContext() {
    console.log("🔍 TEST 3: Testing extension context...");

    try {
      const url = chrome.runtime.getURL("manifest.json");
      const isValid = chrome.runtime.id && chrome.runtime.id.length > 0;

      return {
        success: isValid,
        extensionUrl: url,
        contextValid: isValid,
        issue: isValid ? null : "Extension context invalid",
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        issue: "Extension context error",
      };
    }
  }

  /**
   * Test basic message passing without complex handlers
   */
  async testBasicMessaging() {
    console.log("🔍 TEST 4: Testing basic message passing...");

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({
          success: false,
          issue: "Message never returned (background script not responding)",
          error: "Timeout after 10 seconds",
        });
      }, 10000);

      try {
        chrome.runtime.sendMessage({ type: "ping", test: true }, (response) => {
          clearTimeout(timeout);

          if (chrome.runtime.lastError) {
            resolve({
              success: false,
              error: chrome.runtime.lastError.message,
              issue: "Chrome runtime error on message send",
            });
            return;
          }

          resolve({
            success: true,
            response: response,
            issue: response ? null : "No response from background",
          });
        });
      } catch (error) {
        clearTimeout(timeout);
        resolve({
          success: false,
          error: error.message,
          issue: "Exception sending message",
        });
      }
    });
  }

  /**
   * Test IndexedDB access from background script
   */
  async testBackgroundDBAccess() {
    console.log("🔍 TEST 5: Testing background script database access...");

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({
          success: false,
          issue: "Database test message timeout",
          error: "Background script not responding to DB test",
        });
      }, 15000);

      try {
        chrome.runtime.sendMessage(
          {
            type: "dbTest",
            test: "checkDBAccess",
          },
          (response) => {
            clearTimeout(timeout);

            if (chrome.runtime.lastError) {
              resolve({
                success: false,
                error: chrome.runtime.lastError.message,
                issue: "Runtime error on DB test message",
              });
              return;
            }

            resolve({
              success: !!response,
              response: response,
              issue: response ? null : "No response to DB test",
            });
          }
        );
      } catch (error) {
        clearTimeout(timeout);
        resolve({
          success: false,
          error: error.message,
          issue: "Exception sending DB test message",
        });
      }
    });
  }

  /**
   * Test specific message handlers
   */
  async testMessageHandlers() {
    console.log("🔍 TEST 6: Testing specific message handlers...");

    const handlersToTest = [
      "isStrategyDataLoaded",
      "getStrategyForTag",
      "getStorage",
    ];

    const results = {};

    for (const handlerType of handlersToTest) {
      results[handlerType] = await this.testSpecificHandler(handlerType);
    }

    return {
      success: Object.values(results).some((r) => r.success),
      handlers: results,
      issue: Object.values(results).every((r) => !r.success)
        ? "No message handlers responding"
        : null,
    };
  }

  /**
   * Test a specific message handler
   */
  async testSpecificHandler(type) {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({
          success: false,
          error: `Handler ${type} timeout`,
          issue: `Handler ${type} not responding`,
        });
      }, 8000);

      const testMessage = {
        type,
        ...(type === "getStrategyForTag" ? { tag: "array" } : {}),
        ...(type === "getStorage" ? { key: "test" } : {}),
      };

      try {
        chrome.runtime.sendMessage(testMessage, (response) => {
          clearTimeout(timeout);

          if (chrome.runtime.lastError) {
            resolve({
              success: false,
              error: chrome.runtime.lastError.message,
              issue: `Runtime error for ${type}`,
            });
            return;
          }

          resolve({
            success: true,
            response: response,
            issue: null,
          });
        });
      } catch (error) {
        clearTimeout(timeout);
        resolve({
          success: false,
          error: error.message,
          issue: `Exception testing ${type}`,
        });
      }
    });
  }

  /**
   * Generate recommendations based on test results
   */
  generateRecommendations(tests) {
    const recommendations = [];

    if (!tests.backgroundScript.success) {
      recommendations.push({
        severity: "critical",
        issue: "Background script not running",
        solution: "Check if background.js is properly loaded in manifest.json",
      });
    }

    if (!tests.chromeRuntime.success) {
      recommendations.push({
        severity: "critical",
        issue: "Chrome runtime not accessible",
        solution: "Extension may not be properly installed or enabled",
      });
    }

    if (!tests.extensionContext.success) {
      recommendations.push({
        severity: "critical",
        issue: "Extension context invalid",
        solution: "Try reloading the extension or restarting Chrome",
      });
    }

    if (!tests.basicMessaging.success) {
      recommendations.push({
        severity: "high",
        issue: "Basic messaging failing",
        solution: "Background script may not have message listeners set up",
      });
    }

    if (!tests.backgroundDB.success) {
      recommendations.push({
        severity: "high",
        issue: "Background script database access failing",
        solution: "Check IndexedDB permissions and background script DB code",
      });
    }

    if (!tests.messageHandlers.success) {
      recommendations.push({
        severity: "high",
        issue: "Message handlers not responding",
        solution: "Verify message handler implementations in background.js",
      });
    }

    return recommendations;
  }

  /**
   * Quick emergency bypass test
   */
  async testDirectDBAccess() {
    console.log(
      "🔍 EMERGENCY: Testing direct IndexedDB access from content script..."
    );

    try {
      const request = indexedDB.open("review", 32);

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({
            success: false,
            error: "Direct DB access timeout",
            issue: "IndexedDB not accessible from content script",
          });
        }, 5000);

        request.onsuccess = (event) => {
          clearTimeout(timeout);
          const db = event.target.result;

          resolve({
            success: true,
            dbName: db.name,
            version: db.version,
            stores: Array.from(db.objectStoreNames),
          });

          db.close();
        };

        request.onerror = () => {
          clearTimeout(timeout);
          resolve({
            success: false,
            error: request.error,
            issue: "Direct IndexedDB access failed",
          });
        };
      });
    } catch (error) {
      return {
        success: false,
        error: error.message,
        issue: "Exception accessing IndexedDB directly",
      };
    }
  }
}

// Global diagnostic instance
window.chromeDiagnostics = new ChromeMessagingDiagnostics();

// Quick diagnostic function for console
window.runChromeDiagnostics = async () => {
  const results = await window.chromeDiagnostics.runFullDiagnostics();
  console.table(results.tests);
  console.log("📋 Recommendations:", results.recommendations);
  return results;
};

// Emergency bypass test
window.testDirectDB = async () => {
  return await window.chromeDiagnostics.testDirectDBAccess();
};

export default ChromeMessagingDiagnostics;
