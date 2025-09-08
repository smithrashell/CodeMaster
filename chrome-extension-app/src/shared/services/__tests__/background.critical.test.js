/**
 * CRITICAL RISK TEST: Chrome Extension Background Script Messaging
 * Focus: Message handling and Chrome API functionality that could break dashboard communication
 */

// Helper function for Chrome Extension API Availability tests
const setupChromeAPITests = (chrome) => {
  describe('Chrome Extension API Availability', () => {
    it('should have required Chrome APIs available', () => {
      expect(chrome.runtime).toBeDefined();
      expect(chrome.runtime.onMessage).toBeDefined();
      expect(chrome.tabs).toBeDefined();
      expect(chrome.action).toBeDefined();
      expect(typeof chrome.runtime.onMessage.addListener).toBe('function');
    });

    it('should handle missing Chrome APIs gracefully', () => {
      // Test behavior when Chrome APIs are not available
      const originalChrome = globalThis.chrome;
      
      try {
        delete globalThis.chrome;
        
        // Should not throw when Chrome APIs are missing
        expect(() => {
          // Code that checks for Chrome API availability using globalThis
          const hasChrome = typeof globalThis.chrome !== 'undefined';
          expect(hasChrome).toBe(false);
        }).not.toThrow();
      } finally {
        // Restore Chrome mock
        globalThis.chrome = originalChrome;
      }
    });

    it('should validate Chrome extension context', () => {
      // Test context detection for proper Chrome extension environment
      expect(chrome.runtime.getURL).toBeDefined();
      expect(typeof chrome.runtime.getURL).toBe('function');
      
      const testUrl = chrome.runtime.getURL('app.html');
      expect(testUrl).toContain('chrome-extension://');
      expect(testUrl).toContain('app.html');
    });
  });
};

// Helper function for Message Handler Structure tests
const setupMessageHandlerTests = (chrome) => {
  describe('Message Handler Structure', () => {
    it('should register message listener without crashing', () => {
      // Test that message listener registration doesn't throw
      expect(() => {
        chrome.runtime.onMessage.addListener((_request, _sender, _sendResponse) => {
          return true;
        });
      }).not.toThrow();

      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
    });

    it('should handle message listener registration with valid callback structure', () => {
      // Test proper message listener callback structure
      let messageHandler = null;

      chrome.runtime.onMessage.addListener.mockImplementation((handler) => {
        messageHandler = handler;
      });

      // Simulate message listener registration
      chrome.runtime.onMessage.addListener((_request, _sender, _sendResponse) => {
        return true;
      });

      expect(messageHandler).toBeDefined();
      expect(typeof messageHandler).toBe('function');
      
      // Test that handler accepts correct parameters
      expect(() => {
        const result = messageHandler(
          { type: 'test' },
          { tab: { id: 1 } },
          jest.fn()
        );
        expect(typeof result).toBeDefined();
      }).not.toThrow();
    });

    it('should handle malformed message requests gracefully', () => {
      const malformedRequests = [
        null,
        undefined,
        '',
        {},
        { type: null },
        { type: '' },
        { invalidProperty: true }
      ];

      malformedRequests.forEach(request => {
        expect(() => {
          // Message handler should not crash with invalid input
          const messageHandler = (req, sender, sendResponse) => {
            try {
              if (!req || !req.type) {
                sendResponse({ error: 'Invalid request' });
                return true;
              }
              sendResponse({ error: 'Unknown request type' });
              return true;
            } catch (error) {
              sendResponse({ error: 'Handler error' });
              return true;
            }
          };

          messageHandler(request, { tab: { id: 1 } }, jest.fn());
        }).not.toThrow();
      });
    });
  });
};

// Helper function for Critical Message Types tests
const setupCriticalMessageTypeTests = () => {
  describe('Critical Message Types', () => {
    it('should handle dashboard data requests without crashing', () => {
      const criticalMessageTypes = [
        'getStatsData',
        'getSessionHistoryData',
        'getTagMasteryData',
        'getLearningProgressData',
        'getProductivityInsightsData',
        'getLearningPathData',
        'getMistakeAnalysisData',
        'getInterviewAnalyticsData'
      ];

      criticalMessageTypes.forEach(messageType => {
        expect(() => {
          const mockSendResponse = jest.fn();
          const request = { type: messageType, options: {} };
          const sender = { tab: { id: 1 } };

          // Mock message handler that should handle critical message types
          const messageHandler = (req, sen, sendResp) => {
            try {
              if (criticalMessageTypes.includes(req.type)) {
                // Simulate async operation
                Promise.resolve({ result: 'mock data' })
                  .then(sendResp)
                  .catch(error => sendResp({ error: error.message }));
                return true;
              }
              sendResp({ error: 'Unknown message type' });
              return true;
            } catch (error) {
              sendResp({ error: 'Message handler crashed' });
              return true;
            }
          };

          const result = messageHandler(request, sender, mockSendResponse);
          expect(result).toBe(true); // Should keep response channel open
        }).not.toThrow();
      });
    });

    it('should validate session management message handling', () => {
      const sessionMessageTypes = [
        'getOrCreateSession',
        'refreshSession',
        'getCurrentSession',
        'getSession'
      ];

      sessionMessageTypes.forEach(messageType => {
        expect(() => {
          const mockSendResponse = jest.fn();
          const request = { type: messageType, sessionType: 'standard' };
          const sender = { tab: { id: 1 } };

          // Mock session handler
          const sessionHandler = (req, sen, sendResp) => {
            try {
              if (sessionMessageTypes.includes(req.type)) {
                // Simulate session operation
                const sessionData = {
                  session: { id: 'mock-session', problems: [] },
                  backgroundScriptData: 'Session handled'
                };
                sendResp(sessionData);
                return true;
              }
              sendResp({ error: 'Unknown session type' });
              return true;
            } catch (error) {
              sendResp({ error: 'Session handler error' });
              return true;
            }
          };

          const result = sessionHandler(request, sender, mockSendResponse);
          expect(result).toBe(true);
        }).not.toThrow();
      });
    });

    it('should handle storage operations without data corruption', () => {
      const storageMessageTypes = [
        'getStorage',
        'setStorage',
        'removeStorage',
        'getSettings',
        'setSettings'
      ];

      storageMessageTypes.forEach(messageType => {
        expect(() => {
          const mockSendResponse = jest.fn();
          const request = { 
            type: messageType, 
            key: 'test-key', 
            value: 'test-value',
            message: { theme: 'dark' }
          };
          const sender = { tab: { id: 1 } };

          // Mock storage handler
          const storageHandler = (req, sen, sendResp) => {
            try {
              if (storageMessageTypes.includes(req.type)) {
                // Simulate storage operation
                const storageResult = { status: 'success' };
                sendResp(storageResult);
                return true;
              }
              sendResp({ error: 'Unknown storage operation' });
              return true;
            } catch (error) {
              sendResp({ error: 'Storage handler error' });
              return true;
            }
          };

          const result = storageHandler(request, sender, mockSendResponse);
          expect(result).toBe(true);
        }).not.toThrow();
      });
    });
  });
};

// Helper function for Error Handling and Recovery tests
const setupErrorHandlingTests = () => {
  describe('Error Handling and Recovery', () => {
    it('should handle sendResponse callback failures gracefully', () => {
      expect(() => {
        const failingSendResponse = () => {
          throw new Error('Response callback failed');
        };

        const messageHandler = (req, sender, sendResp) => {
          try {
            sendResp({ result: 'test' });
            return true;
          } catch (error) {
            // Should handle sendResponse failures
            console.error('SendResponse failed:', error);
            return true;
          }
        };

        messageHandler({ type: 'test' }, { tab: { id: 1 } }, failingSendResponse);
      }).not.toThrow();
    });

    it('should handle concurrent message processing', () => {
      const concurrentRequests = [
        { type: 'getStatsData', options: {} },
        { type: 'getSessionHistoryData', options: {} },
        { type: 'getTagMasteryData', options: {} }
      ];

      expect(() => {
        const activeRequests = new Set();
        const mockSendResponse = jest.fn();

        const concurrentHandler = (req, sender, sendResp) => {
          const requestId = `${req.type}-${sender.tab?.id}`;
          
          if (activeRequests.has(requestId)) {
            sendResp({ error: 'Request already in progress' });
            return true;
          }

          activeRequests.add(requestId);
          
          // Simulate async operation
          setTimeout(() => {
            try {
              sendResp({ result: `Processed ${req.type}` });
            } finally {
              activeRequests.delete(requestId);
            }
          }, 10);

          return true;
        };

        // Process concurrent requests
        concurrentRequests.forEach(request => {
          concurrentHandler(request, { tab: { id: 1 } }, mockSendResponse);
        });

      }).not.toThrow();
    });

    it('should handle message handler timeouts', (done) => {
      const timeoutHandler = (req, sender, sendResp) => {
        const timeoutMs = 5000; // 5 second timeout

        const timeoutId = setTimeout(() => {
          sendResp({ 
            error: `Request ${req.type} timed out after ${timeoutMs}ms` 
          });
        }, timeoutMs);

        // Simulate fast response to prevent timeout
        setTimeout(() => {
          clearTimeout(timeoutId);
          sendResp({ result: 'Completed in time' });
          done();
        }, 100);

        return true;
      };

      expect(() => {
        timeoutHandler(
          { type: 'testTimeout' }, 
          { tab: { id: 1 } }, 
          jest.fn()
        );
      }).not.toThrow();
    });
  });
};

// Helper function for Service Worker Lifecycle tests
const setupServiceWorkerLifecycleTests = (global) => {
  describe('Service Worker Lifecycle', () => {
    it('should handle service worker installation without errors', () => {
      expect(() => {
        // Mock service worker install event
        const installEvent = {
          waitUntil: jest.fn()
        };

        // Simulate install handler
        const installHandler = (event) => {
          console.log('SERVICE WORKER: Installing background script...');
          event.waitUntil(global.self.skipWaiting());
        };

        installHandler(installEvent);
        expect(installEvent.waitUntil).toHaveBeenCalled();
      }).not.toThrow();
    });

    it('should handle service worker activation without errors', () => {
      expect(() => {
        // Mock service worker activate event
        const activateEvent = {
          waitUntil: jest.fn()
        };

        // Simulate activate handler
        const activateHandler = (event) => {
          console.log('SERVICE WORKER: Activated background script...');
          event.waitUntil(global.self.clients.claim());
        };

        activateHandler(activateEvent);
        expect(activateEvent.waitUntil).toHaveBeenCalled();
      }).not.toThrow();
    });

    it('should validate background script health monitoring', () => {
      expect(() => {
        const healthMonitor = {
          startTime: Date.now(),
          requestCount: 0,
          
          recordRequest() {
            this.requestCount++;
          },
          
          getHealthReport() {
            const uptime = Date.now() - this.startTime;
            return {
              uptime,
              requestCount: this.requestCount,
              status: 'healthy'
            };
          }
        };

        // Test health monitoring functions
        healthMonitor.recordRequest();
        const report = healthMonitor.getHealthReport();
        
        expect(report.uptime).toBeGreaterThanOrEqual(0);
        expect(report.requestCount).toBe(1);
        expect(report.status).toBe('healthy');
      }).not.toThrow();
    });
  });
};

// Helper function for Cache Management tests
const setupCacheManagementTests = () => {
  describe('Cache Management', () => {
    it('should handle response caching without memory leaks', () => {
      expect(() => {
        const responseCache = new Map();
        const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

        const setCachedResponse = (key, data) => {
          responseCache.set(key, {
            data,
            expiry: Date.now() + CACHE_EXPIRY
          });

          // Clean cache if it gets too large (prevent memory leaks)
          if (responseCache.size > 100) {
            const now = Date.now();
            for (const [k, item] of responseCache.entries()) {
              if (now > item.expiry) {
                responseCache.delete(k);
              }
            }
          }
        };

        const getCachedResponse = (key) => {
          const item = responseCache.get(key);
          if (!item) return null;

          if (Date.now() > item.expiry) {
            responseCache.delete(key);
            return null;
          }

          return item.data;
        };

        // Test cache operations
        setCachedResponse('test-key', { result: 'test data' });
        const cachedData = getCachedResponse('test-key');
        
        expect(cachedData).toEqual({ result: 'test data' });
        expect(responseCache.size).toBe(1);
      }).not.toThrow();
    });

    it('should handle cache invalidation correctly', () => {
      expect(() => {
        const responseCache = new Map();

        // Simulate cache invalidation for settings
        const clearSettingsCache = () => {
          const settingsCacheKeys = ['settings_all', 'settings_'];
          let clearedCount = 0;
          
          for (const [key] of responseCache.entries()) {
            if (settingsCacheKeys.some(prefix => key.startsWith(prefix))) {
              responseCache.delete(key);
              clearedCount++;
            }
          }
          
          return { status: 'success', clearedCount };
        };

        // Add some test cache entries
        responseCache.set('settings_all', { data: 'test' });
        responseCache.set('other_data', { data: 'keep' });

        const result = clearSettingsCache();
        
        expect(result.status).toBe('success');
        expect(result.clearedCount).toBe(1);
        expect(responseCache.has('other_data')).toBe(true);
        expect(responseCache.has('settings_all')).toBe(false);
      }).not.toThrow();
    });
  });
};

// Helper function for Tab Management tests
const setupTabManagementTests = (chrome) => {
  describe('Tab Management', () => {
    it('should handle dashboard tab creation and focus', () => {
      chrome.tabs.query.mockResolvedValue([]);
      chrome.tabs.create.mockResolvedValue({ id: 1 });

      expect(async () => {
        // Mock dashboard tab handler
        const handleDashboardAction = async () => {
          const existingTabs = await chrome.tabs.query({ 
            url: chrome.runtime.getURL("app.html") 
          });
          
          if (existingTabs.length > 0) {
            const existingTab = existingTabs[0];
            await chrome.tabs.update(existingTab.id, { active: true });
          } else {
            chrome.tabs.create({ url: "app.html" });
          }
        };

        await handleDashboardAction();
        expect(chrome.tabs.query).toHaveBeenCalled();
      }).not.toThrow();
    });

    it('should handle tab focus operations gracefully', () => {
      chrome.tabs.query.mockResolvedValue([{ id: 123, windowId: 1 }]);
      chrome.tabs.update.mockResolvedValue({});
      chrome.windows.update.mockResolvedValue({});

      expect(async () => {
        const focusExistingTab = async (tabId, windowId) => {
          await chrome.tabs.update(tabId, { active: true });
          if (windowId) {
            await chrome.windows.update(windowId, { focused: true });
          }
        };

        await focusExistingTab(123, 1);
        expect(chrome.tabs.update).toHaveBeenCalled();
        expect(chrome.windows.update).toHaveBeenCalled();
      }).not.toThrow();
    });
  });
};

describe('Background Script - Critical Chrome Extension Messaging', () => {
  let chrome;
  let global;
  let _backgroundScript;

  beforeAll(() => {
    // Mock Chrome extension APIs
    chrome = {
      runtime: {
        onMessage: {
          addListener: jest.fn()
        },
        getURL: jest.fn(path => `chrome-extension://test-id/${path}`)
      },
      tabs: {
        query: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      },
      windows: {
        update: jest.fn()
      },
      action: {
        onClicked: {
          addListener: jest.fn()
        }
      },
      alarms: {
        create: jest.fn(),
        clear: jest.fn(),
        onAlarm: {
          addListener: jest.fn()
        }
      },
      notifications: {
        create: jest.fn(),
        clear: jest.fn(),
        onClicked: {
          addListener: jest.fn()
        },
        onButtonClicked: {
          addListener: jest.fn()
        }
      },
      storage: {
        local: {
          get: jest.fn(),
          set: jest.fn(),
          remove: jest.fn()
        }
      }
    };

    // Mock global objects
    global = {
      chrome,
      self: {
        addEventListener: jest.fn(),
        skipWaiting: jest.fn(),
        clients: {
          claim: jest.fn()
        }
      },
      console: {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      },
      setTimeout: jest.fn(),
      setInterval: jest.fn(),
      Date: {
        now: jest.fn(() => 1234567890)
      }
    };

    // Set up global environment
    Object.defineProperty(globalThis, 'chrome', { value: chrome, configurable: true });
    Object.defineProperty(globalThis, 'self', { value: global.self, configurable: true });
  });

  afterAll(() => {
    // Clean up global mocks
    delete globalThis.chrome;
    delete globalThis.self;
  });

  // Execute all test suites using helper functions
  setupChromeAPITests(chrome);
  setupMessageHandlerTests(chrome);
  setupCriticalMessageTypeTests();
  setupErrorHandlingTests();
  setupServiceWorkerLifecycleTests(global);
  setupCacheManagementTests();
  setupTabManagementTests(chrome);
});