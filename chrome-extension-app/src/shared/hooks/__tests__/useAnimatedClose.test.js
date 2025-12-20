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

  it('should render when isOpen is true, not render when false', () => {
    const { result: openResult } = renderHook(() => useAnimatedClose(true));
    expect(openResult.current.shouldRender).toBe(true);
    expect(openResult.current.isClosing).toBe(false);

    const { result: closedResult } = renderHook(() => useAnimatedClose(false));
    expect(closedResult.current.shouldRender).toBe(false);
  });

  it('should set isClosing during close animation, then stop rendering', () => {
    const { result, rerender } = renderHook(
      ({ isOpen }) => useAnimatedClose(isOpen),
      { initialProps: { isOpen: true } }
    );

    // Transition to closed
    act(() => {
      rerender({ isOpen: false });
    });

    // During animation: still rendering but isClosing=true
    expect(result.current.shouldRender).toBe(true);
    expect(result.current.isClosing).toBe(true);

    // After animation: stops rendering
    act(() => {
      jest.advanceTimersByTime(SIDEBAR_CLOSE_DURATION_MS);
    });

    expect(result.current.shouldRender).toBe(false);
    expect(result.current.isClosing).toBe(false);
  });

  it('should cleanup timer on unmount to prevent memory leaks', () => {
    const { unmount, rerender } = renderHook(
      ({ isOpen }) => useAnimatedClose(isOpen),
      { initialProps: { isOpen: true } }
    );

    // Start closing animation
    act(() => {
      rerender({ isOpen: false });
    });

    // Unmount before animation completes - should not throw
    unmount();

    act(() => {
      jest.advanceTimersByTime(SIDEBAR_CLOSE_DURATION_MS);
    });
  });
});
