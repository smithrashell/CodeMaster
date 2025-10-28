import { renderHook, act } from '@testing-library/react';
import { useAnimatedClose } from '../useAnimatedClose';
import { SIDEBAR_CLOSE_DURATION_MS } from '../../constants/animations';

describe('useAnimatedClose', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Initial State', () => {
    it('should render component when isOpen is true', () => {
      const { result } = renderHook(() => useAnimatedClose(true));

      expect(result.current.shouldRender).toBe(true);
      expect(result.current.isClosing).toBe(false);
    });

    it('should not render component when isOpen is false', () => {
      const { result } = renderHook(() => useAnimatedClose(false));

      expect(result.current.shouldRender).toBe(false);
      expect(result.current.isClosing).toBe(false);
    });
  });

  describe('Opening Animation', () => {
    it('should immediately render when transitioning from closed to open', () => {
      const { result, rerender } = renderHook(
        ({ isOpen }) => useAnimatedClose(isOpen),
        { initialProps: { isOpen: false } }
      );

      expect(result.current.shouldRender).toBe(false);

      // Transition to open
      act(() => {
        rerender({ isOpen: true });
      });

      expect(result.current.shouldRender).toBe(true);
      expect(result.current.isClosing).toBe(false);
    });

    it('should not have isClosing state when opening', () => {
      const { result, rerender } = renderHook(
        ({ isOpen }) => useAnimatedClose(isOpen),
        { initialProps: { isOpen: false } }
      );

      act(() => {
        rerender({ isOpen: true });
      });

      expect(result.current.isClosing).toBe(false);
    });
  });

  describe('Closing Animation', () => {
    it('should set isClosing to true when transitioning from open to closed', () => {
      const { result, rerender } = renderHook(
        ({ isOpen }) => useAnimatedClose(isOpen),
        { initialProps: { isOpen: true } }
      );

      expect(result.current.shouldRender).toBe(true);
      expect(result.current.isClosing).toBe(false);

      // Transition to closed
      act(() => {
        rerender({ isOpen: false });
      });

      expect(result.current.shouldRender).toBe(true);
      expect(result.current.isClosing).toBe(true);
    });

    it('should set shouldRender to false after animation duration', () => {
      const { result, rerender } = renderHook(
        ({ isOpen }) => useAnimatedClose(isOpen),
        { initialProps: { isOpen: true } }
      );

      // Transition to closed
      act(() => {
        rerender({ isOpen: false });
      });

      expect(result.current.shouldRender).toBe(true);

      // Fast-forward past animation duration
      act(() => {
        jest.advanceTimersByTime(SIDEBAR_CLOSE_DURATION_MS);
      });

      expect(result.current.shouldRender).toBe(false);
      expect(result.current.isClosing).toBe(false);
    });

    it('should respect custom animation duration', () => {
      const customDuration = 500;
      const { result, rerender } = renderHook(
        ({ isOpen }) => useAnimatedClose(isOpen, customDuration),
        { initialProps: { isOpen: true } }
      );

      act(() => {
        rerender({ isOpen: false });
      });

      // Should still be rendering before custom duration
      act(() => {
        jest.advanceTimersByTime(customDuration - 1);
      });
      expect(result.current.shouldRender).toBe(true);

      // Should finish after custom duration
      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(result.current.shouldRender).toBe(false);
    });
  });

  describe('Rapid State Changes', () => {
    it('should handle rapid open/close transitions without memory leaks', () => {
      const { result, rerender } = renderHook(
        ({ isOpen }) => useAnimatedClose(isOpen),
        { initialProps: { isOpen: true } }
      );

      // Close
      act(() => {
        rerender({ isOpen: false });
      });
      expect(result.current.isClosing).toBe(true);

      // Reopen before animation completes
      act(() => {
        rerender({ isOpen: true });
      });
      expect(result.current.shouldRender).toBe(true);
      expect(result.current.isClosing).toBe(false);

      // Timer should be cleaned up, advancing time should have no effect
      act(() => {
        jest.advanceTimersByTime(SIDEBAR_CLOSE_DURATION_MS);
      });
      expect(result.current.shouldRender).toBe(true);
    });

    it('should cleanup timers on unmount', () => {
      const { unmount, rerender } = renderHook(
        ({ isOpen }) => useAnimatedClose(isOpen),
        { initialProps: { isOpen: true } }
      );

      // Start closing animation
      act(() => {
        rerender({ isOpen: false });
      });

      // Unmount before animation completes
      unmount();

      // This should not throw or cause issues
      act(() => {
        jest.advanceTimersByTime(SIDEBAR_CLOSE_DURATION_MS);
      });
    });

    it('should handle multiple rapid close attempts', () => {
      const { result, rerender } = renderHook(
        ({ isOpen }) => useAnimatedClose(isOpen),
        { initialProps: { isOpen: true } }
      );

      // First close
      act(() => {
        rerender({ isOpen: false });
      });

      // Advance halfway through animation
      act(() => {
        jest.advanceTimersByTime(SIDEBAR_CLOSE_DURATION_MS / 2);
      });

      // Reopen
      act(() => {
        rerender({ isOpen: true });
      });

      // Close again
      act(() => {
        rerender({ isOpen: false });
      });

      // Should complete properly with new timer
      act(() => {
        jest.advanceTimersByTime(SIDEBAR_CLOSE_DURATION_MS);
      });

      expect(result.current.shouldRender).toBe(false);
      expect(result.current.isClosing).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle isOpen starting as undefined (falsy)', () => {
      const { result } = renderHook(() => useAnimatedClose(undefined));

      // undefined is falsy, so shouldRender starts as undefined
      // This is acceptable as it's coerced to false in conditionals
      expect(result.current.shouldRender).toBeUndefined();
      expect(result.current.isClosing).toBe(false);
    });

    it('should handle animation duration of 0', () => {
      const { result, rerender } = renderHook(
        ({ isOpen }) => useAnimatedClose(isOpen, 0),
        { initialProps: { isOpen: true } }
      );

      act(() => {
        rerender({ isOpen: false });
      });

      // With 0 duration, should unmount immediately
      act(() => {
        jest.advanceTimersByTime(0);
      });

      expect(result.current.shouldRender).toBe(false);
    });

    it('should maintain state consistency during animation', () => {
      const { result, rerender } = renderHook(
        ({ isOpen }) => useAnimatedClose(isOpen),
        { initialProps: { isOpen: true } }
      );

      // Start closing
      act(() => {
        rerender({ isOpen: false });
      });

      // During animation, should be rendering and closing
      expect(result.current.shouldRender).toBe(true);
      expect(result.current.isClosing).toBe(true);

      // Advance partway through animation
      act(() => {
        jest.advanceTimersByTime(SIDEBAR_CLOSE_DURATION_MS / 2);
      });

      // State should remain consistent
      expect(result.current.shouldRender).toBe(true);
      expect(result.current.isClosing).toBe(true);

      // Complete animation
      act(() => {
        jest.advanceTimersByTime(SIDEBAR_CLOSE_DURATION_MS / 2);
      });

      // Should be fully unmounted
      expect(result.current.shouldRender).toBe(false);
      expect(result.current.isClosing).toBe(false);
    });
  });

  describe('Integration Scenarios', () => {
    it('should simulate realistic user workflow: open -> navigate -> close', () => {
      const { result, rerender } = renderHook(
        ({ isOpen }) => useAnimatedClose(isOpen),
        { initialProps: { isOpen: false } }
      );

      // User opens sidebar
      act(() => {
        rerender({ isOpen: true });
      });
      expect(result.current.shouldRender).toBe(true);
      expect(result.current.isClosing).toBe(false);

      // User navigates (sidebar stays open - tested elsewhere)
      // ...

      // User closes sidebar
      act(() => {
        rerender({ isOpen: false });
      });
      expect(result.current.isClosing).toBe(true);

      // Animation completes
      act(() => {
        jest.advanceTimersByTime(SIDEBAR_CLOSE_DURATION_MS);
      });
      expect(result.current.shouldRender).toBe(false);
    });
  });
});
