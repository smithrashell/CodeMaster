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
      it('should mark the current problem as attempted when problemSubmitted is received', () => {
        // Mock window.location.pathname using history.pushState
        window.history.pushState({}, '', '/problems/two-sum/description');

        const setters = createMockSetters();
        const sessionCreationAttempted = createMockSessionCreationAttempted();
        const setCacheClearedRecently = jest.fn();

        // Mock setProblems to capture the callback
        let problemsUpdater;
        setters.setProblems.mockImplementation((updater) => {
          if (typeof updater === 'function') {
            problemsUpdater = updater;
          }
        });

        renderHook(() =>
          useSessionCacheListener(setters, sessionCreationAttempted, setCacheClearedRecently)
        );

        // Simulate receiving problemSubmitted message
        const sendResponse = jest.fn();
        act(() => {
          mockMessageListener({ type: 'problemSubmitted' }, {}, sendResponse);
        });

        // Verify setProblems was called with an updater function
        expect(setters.setProblems).toHaveBeenCalled();
        expect(sendResponse).toHaveBeenCalledWith({ status: 'success' });

        // Test the updater function marks the correct problem
        const mockProblems = [
          { slug: 'two-sum', title: 'Two Sum', attempted: false },
          { slug: 'add-two-numbers', title: 'Add Two Numbers', attempted: false },
        ];
        const updatedProblems = problemsUpdater(mockProblems);

        expect(updatedProblems[0].attempted).toBe(true);
        expect(updatedProblems[0].attempt_date).toBeDefined();
        expect(updatedProblems[1].attempted).toBe(false);
      });

      it('should handle problem URLs with trailing slash', () => {
        window.history.pushState({}, '', '/problems/valid-parentheses/');

        const setters = createMockSetters();
        const sessionCreationAttempted = createMockSessionCreationAttempted();
        const setCacheClearedRecently = jest.fn();

        let problemsUpdater;
        setters.setProblems.mockImplementation((updater) => {
          if (typeof updater === 'function') {
            problemsUpdater = updater;
          }
        });

        renderHook(() =>
          useSessionCacheListener(setters, sessionCreationAttempted, setCacheClearedRecently)
        );

        const sendResponse = jest.fn();
        act(() => {
          mockMessageListener({ type: 'problemSubmitted' }, {}, sendResponse);
        });

        const mockProblems = [
          { slug: 'valid-parentheses', title: 'Valid Parentheses', attempted: false },
        ];
        const updatedProblems = problemsUpdater(mockProblems);

        expect(updatedProblems[0].attempted).toBe(true);
      });

      it('should not update problems when URL does not contain a problem slug', () => {
        window.history.pushState({}, '', '/explore/learn/');

        const setters = createMockSetters();
        const sessionCreationAttempted = createMockSessionCreationAttempted();
        const setCacheClearedRecently = jest.fn();

        renderHook(() =>
          useSessionCacheListener(setters, sessionCreationAttempted, setCacheClearedRecently)
        );

        // Simulate receiving problemSubmitted message on non-problem page
        const sendResponse = jest.fn();

        // Should not throw
        expect(() => {
          act(() => {
            mockMessageListener({ type: 'problemSubmitted' }, {}, sendResponse);
          });
        }).not.toThrow();

        // setProblems should NOT be called when no slug found
        expect(setters.setProblems).not.toHaveBeenCalled();
        expect(sendResponse).toHaveBeenCalledWith({ status: 'success' });
      });

      it('should not modify problems that do not match the current slug', () => {
        window.history.pushState({}, '', '/problems/two-sum/description');

        const setters = createMockSetters();
        const sessionCreationAttempted = createMockSessionCreationAttempted();
        const setCacheClearedRecently = jest.fn();

        let problemsUpdater;
        setters.setProblems.mockImplementation((updater) => {
          if (typeof updater === 'function') {
            problemsUpdater = updater;
          }
        });

        renderHook(() =>
          useSessionCacheListener(setters, sessionCreationAttempted, setCacheClearedRecently)
        );

        const sendResponse = jest.fn();
        act(() => {
          mockMessageListener({ type: 'problemSubmitted' }, {}, sendResponse);
        });

        // Test with problems that don't include the current slug
        const mockProblems = [
          { slug: 'add-two-numbers', title: 'Add Two Numbers', attempted: false },
          { slug: 'longest-substring', title: 'Longest Substring', attempted: false },
        ];
        const updatedProblems = problemsUpdater(mockProblems);

        // None should be marked as attempted since 'two-sum' isn't in the list
        expect(updatedProblems[0].attempted).toBe(false);
        expect(updatedProblems[1].attempted).toBe(false);
      });

      it('should preserve existing problem properties when marking as attempted', () => {
        window.history.pushState({}, '', '/problems/two-sum/description');

        const setters = createMockSetters();
        const sessionCreationAttempted = createMockSessionCreationAttempted();
        const setCacheClearedRecently = jest.fn();

        let problemsUpdater;
        setters.setProblems.mockImplementation((updater) => {
          if (typeof updater === 'function') {
            problemsUpdater = updater;
          }
        });

        renderHook(() =>
          useSessionCacheListener(setters, sessionCreationAttempted, setCacheClearedRecently)
        );

        const sendResponse = jest.fn();
        act(() => {
          mockMessageListener({ type: 'problemSubmitted' }, {}, sendResponse);
        });

        const mockProblems = [
          {
            slug: 'two-sum',
            title: 'Two Sum',
            difficulty: 'Easy',
            tags: ['Array', 'Hash Table'],
            attempted: false,
          },
        ];
        const updatedProblems = problemsUpdater(mockProblems);

        // Verify existing properties are preserved
        expect(updatedProblems[0].slug).toBe('two-sum');
        expect(updatedProblems[0].title).toBe('Two Sum');
        expect(updatedProblems[0].difficulty).toBe('Easy');
        expect(updatedProblems[0].tags).toEqual(['Array', 'Hash Table']);
        expect(updatedProblems[0].attempted).toBe(true);
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
