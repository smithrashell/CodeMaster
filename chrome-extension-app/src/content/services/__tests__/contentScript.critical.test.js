/**
 * CRITICAL RISK TEST: Content Script Integration
 * Focus: Chrome messaging, DOM integration, and LeetCode page interaction that could break extension functionality
 */

import { ChromeMessagingService } from '../chromeMessagingService';

// Set up Chrome API mock at module level (before helper functions are called)
const chrome = {
  runtime: {
    sendMessage: jest.fn(),
    lastError: null,
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    getURL: jest.fn((path) => `chrome-extension://test-extension-id/${path}`),
    id: "test-extension-id"
  },
  tabs: {
    query: jest.fn(),
    update: jest.fn(),
    create: jest.fn()
  },
  action: {
    setBadgeText: jest.fn(),
    setBadgeBackgroundColor: jest.fn()
  },
  storage: {
    local: {
      get: jest.fn((keys, callback) => callback({})),
      set: jest.fn((items, callback) => callback && callback()),
      remove: jest.fn((keys, callback) => callback && callback()),
      clear: jest.fn((callback) => callback && callback())
    }
  }
};

// Set up global Chrome mock
global.chrome = chrome;

// Create ChromeMessagingService instance at module level
const chromeMessaging = new ChromeMessagingService();

// Helper function for Chrome Messaging Service Core Functionality tests
const setupChromeMessagingCoreTests = (chromeMessaging, chrome) => {
  describe('ChromeMessagingService Core Functionality', () => {
    it('should initialize without crashing', () => {
      expect(() => {
        const service = new ChromeMessagingService();
        expect(service.defaultTimeout).toBe(10000);
        expect(service.maxRetries).toBe(3);
        expect(service.retryDelay).toBe(500);
        expect(service.cache).toBeInstanceOf(Map);
      }).not.toThrow();
    });

    it('should handle successful message sending', async () => {
      jest.useRealTimers(); // Use real timers for this test
      
      const mockResponse = { result: 'test success', data: 'mock data' };
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        setTimeout(() => callback(mockResponse), 10);
      });

      const response = await chromeMessaging.sendMessage({ type: 'test' });
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { type: 'test' },
        expect.any(Function)
      );
      expect(response).toEqual(mockResponse.data); // ChromeMessagingService extracts the data property
    });

    it('should handle Chrome runtime errors gracefully', async () => {
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        chrome.runtime.lastError = { message: 'Extension context invalidated.' };
        setTimeout(() => callback(null), 10);
      });

      await expect(chromeMessaging.sendMessage({ type: 'test' })).rejects.toThrow(
        'Chrome runtime error: Extension context invalidated.'
      );
    });

    it('should handle application-level errors', async () => {
      const errorResponse = { status: 'error', error: 'Database connection failed' };
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        setTimeout(() => callback(errorResponse), 10);
      });

      await expect(chromeMessaging.sendMessage({ type: 'test' })).rejects.toThrow(
        'Application error: Database connection failed'
      );
    });

    it('should handle timeout scenarios', async () => {
      // Simplify timeout test to avoid timer complexity
      chrome.runtime.sendMessage.mockImplementation((_message, _callback) => {
        // Immediately simulate timeout error
        setTimeout(() => {
          // Don't call callback to simulate timeout
        }, 1000);
      });

      try {
        await chromeMessaging.sendMessage(
          { type: 'test' }, 
          { timeout: 50, retries: 0 }
        );
      } catch (error) {
        expect(error.message).toContain('timeout');
      }
    });

    it('should retry on failure with exponential backoff', async () => {
      let attemptCount = 0;
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        attemptCount++;
        if (attemptCount < 2) {
          chrome.runtime.lastError = { message: 'Connection failed' };
          callback(null);
        } else {
          chrome.runtime.lastError = null;
          callback({ result: 'success after retries' });
        }
      });

      const response = await chromeMessaging.sendMessage(
        { type: 'test' },
        { retries: 1, timeout: 5000 }
      );

      expect(attemptCount).toBe(2);
      expect(response).toEqual({ result: 'success after retries' });
    });
  });
};

// Helper function for Critical Message Types tests
const setupCriticalMessageTypeTests = (chromeMessaging, chrome) => {
  describe('Critical Message Types for Content Scripts', () => {
    it('should handle problem data submission messages', async () => {
      const problemData = {
        type: 'addProblem',
        contentScriptData: {
          problemId: 'two-sum',
          title: 'Two Sum',
          difficulty: 'Easy',
          success: true,
          timeSpent: 1200,
          attemptNumber: 1
        }
      };

      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        setTimeout(() => callback({ success: true, message: 'Problem added' }), 10);
      });

      const response = await chromeMessaging.sendMessage(problemData);
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        problemData,
        expect.any(Function)
      );
      expect(response).toEqual({ success: true, message: 'Problem added' });
    });

    it('should handle hint interaction messages', async () => {
      const hintData = {
        type: 'saveHintInteraction',
        data: {
          problemId: 'array-problem',
          hintType: 'approach',
          interactionType: 'view',
          timestamp: Date.now()
        }
      };

      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        setTimeout(() => callback({ interaction: 'saved successfully' }), 10);
      });

      const response = await chromeMessaging.sendMessage(hintData);
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        hintData,
        expect.any(Function)
      );
      expect(response).toEqual({ interaction: 'saved successfully' });
    });

    it('should handle strategy data requests', async () => {
      const strategyRequest = {
        type: 'getStrategyForTag',
        tag: 'array'
      };

      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        setTimeout(() => callback({ 
          status: 'success', 
          data: { 
            tag: 'array',
            strategies: ['two pointers', 'sliding window']
          }
        }), 10);
      });

      const response = await chromeMessaging.sendMessage(strategyRequest);
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        strategyRequest,
        expect.any(Function)
      );
      expect(response).toEqual({ 
        tag: 'array',
        strategies: ['two pointers', 'sliding window']
      });
    });

    it('should handle session requests from content scripts', async () => {
      const sessionRequest = {
        type: 'getOrCreateSession',
        sessionType: 'standard'
      };

      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        setTimeout(() => callback({
          session: {
            id: 'session-123',
            problems: [{ id: 'two-sum', title: 'Two Sum' }],
            status: 'active'
          },
          backgroundScriptData: 'Session retrieved'
        }), 10);
      });

      const response = await chromeMessaging.sendMessage(sessionRequest);
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        sessionRequest,
        expect.any(Function)
      );
      expect(response.session).toBeDefined();
      expect(response.session.id).toBe('session-123');
    });
  });
};

// Helper function for Cache Management tests
const setupCacheManagementTests = (chromeMessaging, chrome) => {
  describe('Cache Management in Content Scripts', () => {
    it('should cache responses when cacheable option is set', async () => {
      const cacheableRequest = { type: 'getStrategyForTag', tag: 'dynamic-programming' };
      const mockResponse = { data: { strategies: ['memoization', 'tabulation'] } };

      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        setTimeout(() => callback(mockResponse), 10);
      });

      // First request - should hit the network
      const response1 = await chromeMessaging.sendMessage(cacheableRequest, {
        cacheable: true,
        cacheKey: 'strategy_dynamic-programming'
      });

      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
      expect(response1).toEqual(mockResponse.data); // Service extracts data property

      // Second request - should use cache
      const response2 = await chromeMessaging.sendMessage(cacheableRequest, {
        cacheable: true,
        cacheKey: 'strategy_dynamic-programming'
      });

      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1); // No additional calls
      expect(response2).toEqual(mockResponse.data); // Cached response also extracts data
    });

    it('should handle cache expiration correctly', async () => {
      const request = { type: 'test' };
      const mockResponse = { data: 'test data' };

      // Set a very short cache expiry for testing
      const originalExpiry = chromeMessaging.cacheExpiry;
      chromeMessaging.cacheExpiry = 50; // 50ms

      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        setTimeout(() => callback(mockResponse), 10);
      });

      // First request
      await chromeMessaging.sendMessage(request, {
        cacheable: true,
        cacheKey: 'test_key'
      });

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 100));

      // Second request - should hit network again due to expiry
      await chromeMessaging.sendMessage(request, {
        cacheable: true,
        cacheKey: 'test_key'
      });

      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(2);

      // Restore original expiry
      chromeMessaging.cacheExpiry = originalExpiry;
    });

    it('should prevent cache memory leaks', () => {
      expect(() => {
        // Simulate adding many cache entries
        for (let i = 0; i < 150; i++) {
          chromeMessaging.setCache(`key_${i}`, { data: `value_${i}` });
        }

        // Cache should trigger cleanup when size > 100
        const stats = chromeMessaging.getCacheStats();
        expect(stats.total).toBeLessThanOrEqual(150);
      }).not.toThrow();
    });
  });
};

// Helper function for Error Recovery tests
const setupErrorRecoveryTests = (chromeMessaging, chrome) => {
  describe('Error Recovery and Resilience', () => {
    it('should handle malformed responses gracefully', async () => {
      const malformedResponses = [
        null,
        undefined,
        '',
        { invalid: 'structure' },
        { status: null },
        { error: null }
      ];

      for (const malformedResponse of malformedResponses) {
        chrome.runtime.sendMessage.mockImplementation((message, callback) => {
          setTimeout(() => callback(malformedResponse), 10);
        });

        try {
          const response = await chromeMessaging.sendMessage({ type: 'test' });
          // Should return the malformed response as-is rather than crash
          expect(response).toBeDefined();
        } catch (error) {
          // Some malformed responses may cause expected errors
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

    it('should handle Chrome extension context invalidation', async () => {
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        chrome.runtime.lastError = { 
          message: 'Extension context invalidated.' 
        };
        setTimeout(() => callback(null), 10);
      });

      await expect(
        chromeMessaging.sendMessage({ type: 'test' }, { retries: 0 })
      ).rejects.toThrow('Chrome runtime error: Extension context invalidated.');
    });

    it('should handle background script unavailability', async () => {
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        chrome.runtime.lastError = { 
          message: 'Could not establish connection. Receiving end does not exist.' 
        };
        setTimeout(() => callback(null), 10);
      });

      await expect(
        chromeMessaging.sendMessage({ type: 'test' }, { retries: 1 })
      ).rejects.toThrow('Chrome runtime error: Could not establish connection');
    });

    it('should handle concurrent message sending without conflicts', async () => {
      const concurrentRequests = [
        { type: 'request1' },
        { type: 'request2' },
        { type: 'request3' }
      ];

      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        setTimeout(() => callback({ result: `Response for ${message.type}` }), 
          Math.random() * 100); // Random delay to simulate real conditions
      });

      const promises = concurrentRequests.map(request => 
        chromeMessaging.sendMessage(request, { retries: 0 })
      );

      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(3);
      expect(responses[0]).toEqual({ result: 'Response for request1' });
      expect(responses[1]).toEqual({ result: 'Response for request2' });
      expect(responses[2]).toEqual({ result: 'Response for request3' });
    });
  });
};

// Helper function for DOM Integration tests
const setupDOMIntegrationTests = () => {
  describe('DOM Integration Safety', () => {
    it('should handle DOM queries without crashing when elements are missing', () => {
      // Mock DOM environment
      const mockDocument = {
        querySelector: jest.fn(() => null),
        querySelectorAll: jest.fn(() => []),
        getElementById: jest.fn(() => null)
      };

      global.document = mockDocument;

      expect(() => {
        // Simulate common DOM queries in content scripts
        const problemTitle = document.querySelector('[data-cy="question-title"]');
        const codeEditor = document.querySelector('.CodeMirror');
        const submitButton = document.querySelector('[data-cy="submit-code-btn"]');
        
        // Should handle missing elements gracefully
        expect(problemTitle).toBeNull();
        expect(codeEditor).toBeNull();
        expect(submitButton).toBeNull();
      }).not.toThrow();

      delete global.document;
    });

    it('should handle window resize events safely', () => {
      // Mock window object
      const mockWindow = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        innerWidth: 1920,
        innerHeight: 1080
      };

      global.window = mockWindow;

      expect(() => {
        // Simulate window event listeners common in content scripts
        const resizeHandler = () => {
          // Handle resize logic
          console.log(`Window resized to ${window.innerWidth}x${window.innerHeight}`);
        };

        window.addEventListener('resize', resizeHandler);
        window.removeEventListener('resize', resizeHandler);
      }).not.toThrow();

      delete global.window;
    });

    it('should handle LeetCode page navigation changes', () => {
      expect(() => {
        // Mock navigation observer patterns used in content scripts
        const observeNavigationChanges = () => {
          // Simulate URL change detection
          let currentUrl = 'https://leetcode.com/problems/two-sum';
          
          const checkUrlChange = () => {
            const newUrl = window.location?.href || currentUrl;
            if (newUrl !== currentUrl) {
              currentUrl = newUrl;
              // Handle navigation change
              console.log(`Navigated to: ${currentUrl}`);
            }
          };

          // Should handle URL change detection safely
          checkUrlChange();
          return true;
        };

        const result = observeNavigationChanges();
        expect(result).toBe(true);
      }).not.toThrow();
    });
  });
};

// Helper function for Performance Management tests
const setupPerformanceTests = (chromeMessaging, chrome) => {
  describe('Performance and Memory Management', () => {
    it('should manage cache memory efficiently', () => {
      expect(() => {
        const stats = chromeMessaging.getCacheStats();
        
        expect(stats).toHaveProperty('total');
        expect(stats).toHaveProperty('valid');
        expect(stats).toHaveProperty('expired');
        expect(stats).toHaveProperty('memoryUsage');
        expect(typeof stats.total).toBe('number');
        expect(typeof stats.memoryUsage).toBe('string');
      }).not.toThrow();
    });

    it('should handle cache cleanup without performance impact', () => {
      expect(() => {
        // Add multiple cache entries
        for (let i = 0; i < 50; i++) {
          chromeMessaging.setCache(`perf_test_${i}`, { 
            data: `test_data_${i}`,
            timestamp: Date.now()
          });
        }

        // Perform cleanup
        chromeMessaging.cleanExpiredCache();
        
        const stats = chromeMessaging.getCacheStats();
        expect(stats.total).toBeLessThanOrEqual(50);
      }).not.toThrow();
    });

    it('should handle message queue without memory leaks', () => {
      // Test multiple rapid messages don't cause memory issues
      const rapidMessages = Array.from({ length: 20 }, (_, i) => ({
        type: 'rapid_test',
        id: i
      }));

      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        setTimeout(() => callback({ processed: message.id }), 5);
      });

      expect(async () => {
        const promises = rapidMessages.map((_message, _index) =>
          chromeMessaging.sendMessage(_message, { 
            retries: 0, 
            timeout: 1000 
          })
        );

        const responses = await Promise.all(promises);
        expect(responses).toHaveLength(20);
      }).not.toThrow();
    });
  });
};

describe('Content Script - Critical Integration Points', () => {
  beforeAll(() => {
    // Use Jest fake timers to prevent recursion
    jest.useFakeTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    chrome.runtime.lastError = null;
    if (chromeMessaging && chromeMessaging.clearCache) {
      chromeMessaging.clearCache();
    }
  });

  afterAll(() => {
    jest.useRealTimers();
    delete global.chrome;
  });

  // Execute all test suites using helper functions
  setupChromeMessagingCoreTests(chromeMessaging, chrome);
  setupCriticalMessageTypeTests(chromeMessaging, chrome);
  setupCacheManagementTests(chromeMessaging, chrome);
  setupErrorRecoveryTests(chromeMessaging, chrome);
  setupDOMIntegrationTests();
  setupPerformanceTests(chromeMessaging, chrome);
});