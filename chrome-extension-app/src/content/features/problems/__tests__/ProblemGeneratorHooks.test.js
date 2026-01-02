/**
 * Tests for ProblemGeneratorHooks
 *
 * Critical tests for message listeners that handle:
 * - sessionCacheCleared: Resets session state when cache is cleared
 * - problemSubmitted: Marks problems as attempted when user submits a solution
 *
 * These tests prevent regression of the bug where problems weren't being
 * removed from the list after submission.
 */

import { renderHook, act } from '@testing-library/react';
import { useSessionCacheListener } from '../ProblemGeneratorHooks.js';

// Mock logger to prevent console noise
jest.mock('../../../../shared/utils/logging/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('ProblemGeneratorHooks', () => {
  let mockMessageListener;
  let originalChrome;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Store original chrome
    originalChrome = global.chrome;

    // Mock Chrome runtime API
    mockMessageListener = null;
    global.chrome = {
      runtime: {
        onMessage: {
          addListener: jest.fn((listener) => {
            mockMessageListener = listener;
          }),
          removeListener: jest.fn(),
        },
      },
    };
  });

  afterEach(() => {
    // Restore original chrome
    global.chrome = originalChrome;
    jest.useRealTimers();
  });

  describe('useSessionCacheListener', () => {
    const createMockSetters = () => ({
      setSessionData: jest.fn(),
      setProblems: jest.fn(),
      setShowInterviewBanner: jest.fn(),
      setShowRegenerationBanner: jest.fn(),
    });

    const createMockSessionCreationAttempted = () => ({
      current: true,
    });

    describe('sessionCacheCleared message', () => {
      it('should reset all session state when sessionCacheCleared is received', () => {
        const setters = createMockSetters();
        const sessionCreationAttempted = createMockSessionCreationAttempted();
        const setCacheClearedRecently = jest.fn();

        renderHook(() =>
          useSessionCacheListener(setters, sessionCreationAttempted, setCacheClearedRecently)
        );

        // Verify listener was added
        expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
        expect(mockMessageListener).toBeDefined();

        // Simulate receiving sessionCacheCleared message
        const sendResponse = jest.fn();
        act(() => {
          mockMessageListener({ type: 'sessionCacheCleared' }, {}, sendResponse);
        });

        // Verify all state was reset
        expect(sessionCreationAttempted.current).toBe(false);
        expect(setters.setSessionData).toHaveBeenCalledWith(null);
        expect(setters.setProblems).toHaveBeenCalledWith([]);
        expect(setters.setShowInterviewBanner).toHaveBeenCalledWith(false);
        expect(setters.setShowRegenerationBanner).toHaveBeenCalledWith(false);
        expect(setCacheClearedRecently).toHaveBeenCalledWith(true);
        expect(sendResponse).toHaveBeenCalledWith({ status: 'success' });
      });

      it('should set cacheClearedRecently back to false after timeout', () => {
        const setters = createMockSetters();
        const sessionCreationAttempted = createMockSessionCreationAttempted();
        const setCacheClearedRecently = jest.fn();

        renderHook(() =>
          useSessionCacheListener(setters, sessionCreationAttempted, setCacheClearedRecently)
        );

        const sendResponse = jest.fn();
        act(() => {
          mockMessageListener({ type: 'sessionCacheCleared' }, {}, sendResponse);
        });

        // First call sets to true
        expect(setCacheClearedRecently).toHaveBeenCalledWith(true);

        // Fast-forward 2 seconds
        act(() => {
          jest.advanceTimersByTime(2000);
        });

        // Should be called with false after timeout
        expect(setCacheClearedRecently).toHaveBeenCalledWith(false);
      });

      it('should cleanup listener on unmount', () => {
        const setters = createMockSetters();
        const sessionCreationAttempted = createMockSessionCreationAttempted();
        const setCacheClearedRecently = jest.fn();

        const { unmount } = renderHook(() =>
          useSessionCacheListener(setters, sessionCreationAttempted, setCacheClearedRecently)
        );

        unmount();

        expect(chrome.runtime.onMessage.removeListener).toHaveBeenCalled();
      });
    });

    describe('problemSubmitted message', () => {
      it('should trigger session refresh when problemSubmitted is received', () => {
        const setters = createMockSetters();
        const sessionCreationAttempted = createMockSessionCreationAttempted();
        const setCacheClearedRecently = jest.fn();
        const triggerSessionRefresh = jest.fn();

        renderHook(() =>
          useSessionCacheListener(setters, sessionCreationAttempted, setCacheClearedRecently, triggerSessionRefresh)
        );

        // Simulate receiving problemSubmitted message
        const sendResponse = jest.fn();
        act(() => {
          mockMessageListener({ type: 'problemSubmitted' }, {}, sendResponse);
        });

        // Verify triggerSessionRefresh was called to fetch fresh data
        expect(triggerSessionRefresh).toHaveBeenCalled();
        expect(sendResponse).toHaveBeenCalledWith({ status: 'success' });
      });

      it('should handle missing triggerSessionRefresh gracefully', () => {
        const setters = createMockSetters();
        const sessionCreationAttempted = createMockSessionCreationAttempted();
        const setCacheClearedRecently = jest.fn();

        // No triggerSessionRefresh passed
        renderHook(() =>
          useSessionCacheListener(setters, sessionCreationAttempted, setCacheClearedRecently, null)
        );

        const sendResponse = jest.fn();

        // Should not throw
        expect(() => {
          act(() => {
            mockMessageListener({ type: 'problemSubmitted' }, {}, sendResponse);
          });
        }).not.toThrow();

        expect(sendResponse).toHaveBeenCalledWith({ status: 'success' });
      });
    });

    describe('unhandled messages', () => {
      it('should not respond to unhandled message types', () => {
        const setters = createMockSetters();
        const sessionCreationAttempted = createMockSessionCreationAttempted();
        const setCacheClearedRecently = jest.fn();

        renderHook(() =>
          useSessionCacheListener(setters, sessionCreationAttempted, setCacheClearedRecently)
        );

        const sendResponse = jest.fn();
        act(() => {
          mockMessageListener({ type: 'unknownMessageType' }, {}, sendResponse);
        });

        // Should not call sendResponse for unhandled messages
        expect(sendResponse).not.toHaveBeenCalled();
        // Should not modify any state
        expect(setters.setProblems).not.toHaveBeenCalled();
        expect(setters.setSessionData).not.toHaveBeenCalled();
      });
    });

    describe('Chrome API availability', () => {
      it('should handle missing Chrome API gracefully', () => {
        // Remove Chrome API
        delete global.chrome;

        const setters = createMockSetters();
        const sessionCreationAttempted = createMockSessionCreationAttempted();
        const setCacheClearedRecently = jest.fn();

        // Should not throw when Chrome API is missing
        expect(() => {
          renderHook(() =>
            useSessionCacheListener(setters, sessionCreationAttempted, setCacheClearedRecently)
          );
        }).not.toThrow();
      });

      it('should handle Chrome runtime being undefined', () => {
        global.chrome = {};

        const setters = createMockSetters();
        const sessionCreationAttempted = createMockSessionCreationAttempted();
        const setCacheClearedRecently = jest.fn();

        // Should not throw when Chrome runtime is undefined
        expect(() => {
          renderHook(() =>
            useSessionCacheListener(setters, sessionCreationAttempted, setCacheClearedRecently)
          );
        }).not.toThrow();
      });
    });
  });
});
