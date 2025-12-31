/**
 * Tests for StillWorkingPrompt behavior
 *
 * This test suite specifically covers the "stale closure" bug fix where
 * the Still Working modal would immediately reappear after being dismissed
 * because the interval callback captured an old timeWarningLevel value.
 *
 * Bug scenario (before fix):
 * 1. Timer runs, reaches warning threshold, modal appears
 * 2. User clicks "Still Making Progress"
 * 3. Modal dismisses (setShowStillWorkingPrompt(false))
 * 4. BUT interval callback still has stale timeWarningLevel = 0
 * 5. On next tick, condition (timeWarningLevel < 2) is true
 * 6. Modal immediately reappears - BAD!
 *
 * Fix: Use a ref to track current timeWarningLevel so interval
 * always reads the latest value.
 */

import React, { useState, useRef } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Import the hook we're testing
import { useTimerOperations } from '../TimerOperations';

// Mock dependencies
jest.mock('../../../../shared/utils/logging/logger.js', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

/**
 * Test component that uses actual React state to properly test
 * the ref synchronization in useTimerOperations
 */
function TestHarness({ initialTimerRef, onPromptChange, onWarningLevelChange }) {
  // Use real React state so useEffect in the hook will trigger properly
  const [timeWarningLevel, setTimeWarningLevel] = useState(0);
  const [showStillWorkingPrompt, setShowStillWorkingPrompt] = useState(false);
  const [displayTime, setDisplayTime] = useState(0);

  const timerRef = useRef(initialTimerRef);
  const intervalIdRef = useRef(null);

  // Wrap setters to notify test of changes
  const wrappedSetShowStillWorkingPrompt = (val) => {
    setShowStillWorkingPrompt(val);
    onPromptChange?.(val);
  };

  const wrappedSetTimeWarningLevel = (val) => {
    setTimeWarningLevel(val);
    onWarningLevelChange?.(val);
  };

  const timerState = {
    timeWarningLevel,
    showStillWorkingPrompt,
    isUnlimitedMode: false,
    exceededRecommendedTime: false,
    displayTime,
    countdownVisible: false,
    countdownValue: null,
    userIntent: 'solving',
    interviewSignals: {},
    setIsTimerRunning: jest.fn(),
    setDisplayTime,
    setTimeWarningLevel: wrappedSetTimeWarningLevel,
    setExceededRecommendedTime: jest.fn(),
    setShowStillWorkingPrompt: wrappedSetShowStillWorkingPrompt,
    setCountdownVisible: jest.fn(),
    setCountdownValue: jest.fn(),
    setUserIntent: jest.fn(),
    setOpen: jest.fn(),
  };

  const options = {
    sessionType: 'standard',
    navigate: jest.fn(),
    state: { LeetCodeID: '1' },
  };

  const operations = useTimerOperations(timerRef, intervalIdRef, timerState, options);

  // Expose a way to dismiss the prompt (simulating user clicking "Still Making Progress")
  const dismissPrompt = () => {
    setShowStillWorkingPrompt(false);
  };

  return (
    <div>
      <button data-testid="start" onClick={operations.handleStart}>Start</button>
      <button data-testid="stop" onClick={operations.handleStop}>Stop</button>
      <button data-testid="reset" onClick={operations.handleReset}>Reset</button>
      <button data-testid="dismiss" onClick={dismissPrompt}>Dismiss Prompt</button>
      <div data-testid="warning-level">{timeWarningLevel}</div>
      <div data-testid="prompt-visible">{showStillWorkingPrompt ? 'visible' : 'hidden'}</div>
    </div>
  );
}

describe('StillWorkingPrompt - Stale Closure Bug Fix', () => {
  let mockTimer;
  let promptChanges;
  let warningLevelChanges;

  beforeEach(() => {
    jest.useFakeTimers();

    promptChanges = [];
    warningLevelChanges = [];

    // Create a mock timer object
    mockTimer = {
      start: jest.fn(() => true),
      pause: jest.fn(),
      reset: jest.fn(),
      isRunning: true,
      getElapsedTime: jest.fn(() => 0),
      recommendedLimit: 30, // 30 seconds for faster testing
      isInterviewMode: false,
      interviewConfig: null,
      isUnlimited: false,
    };
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('should show Still Working prompt when time exceeds threshold', () => {
    render(
      <MemoryRouter>
        <TestHarness
          initialTimerRef={mockTimer}
          onPromptChange={(val) => promptChanges.push(val)}
          onWarningLevelChange={(val) => warningLevelChanges.push(val)}
        />
      </MemoryRouter>
    );

    // Start the timer
    fireEvent.click(screen.getByTestId('start'));

    // Simulate time passing to 100% of recommended time (threshold for prompt)
    mockTimer.getElapsedTime.mockReturnValue(30);

    // Advance timer to trigger interval callback
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Prompt should now be visible
    expect(promptChanges).toContain(true);
    expect(warningLevelChanges).toContain(2);
    expect(screen.getByTestId('prompt-visible')).toHaveTextContent('visible');
  });

  it('should NOT reshow prompt after user dismisses it (stale closure fix)', async () => {
    render(
      <MemoryRouter>
        <TestHarness
          initialTimerRef={mockTimer}
          onPromptChange={(val) => promptChanges.push(val)}
          onWarningLevelChange={(val) => warningLevelChanges.push(val)}
        />
      </MemoryRouter>
    );

    // Start the timer
    fireEvent.click(screen.getByTestId('start'));

    // Simulate time at 100% threshold
    mockTimer.getElapsedTime.mockReturnValue(30);

    // First interval tick - should show prompt and set warning level to 2
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Verify prompt appeared
    expect(screen.getByTestId('prompt-visible')).toHaveTextContent('visible');
    expect(screen.getByTestId('warning-level')).toHaveTextContent('2');

    // Clear tracking arrays to monitor future changes
    promptChanges.length = 0;

    // Simulate user clicking "Still Making Progress" (dismiss the prompt)
    fireEvent.click(screen.getByTestId('dismiss'));

    // Verify prompt is now hidden
    expect(screen.getByTestId('prompt-visible')).toHaveTextContent('hidden');

    // Clear again to track only future changes
    promptChanges.length = 0;

    // Advance time by several more seconds - this is where the bug would occur
    // The old code would still see timeWarningLevel = 0 (stale closure)
    // and would call setShowStillWorkingPrompt(true) again
    mockTimer.getElapsedTime.mockReturnValue(35);
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    // With the fix, the prompt should NOT be shown again
    // because the ref now correctly reads timeWarningLevel = 2
    // and the condition (timeWarningLevel < 2) is false
    const promptShownAgain = promptChanges.includes(true);
    expect(promptShownAgain).toBe(false);
    expect(screen.getByTestId('prompt-visible')).toHaveTextContent('hidden');
  });

  it('should correctly track warning level progression through thresholds', () => {
    render(
      <MemoryRouter>
        <TestHarness
          initialTimerRef={mockTimer}
          onPromptChange={(val) => promptChanges.push(val)}
          onWarningLevelChange={(val) => warningLevelChanges.push(val)}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('start'));

    // Test warning level 1 (75% threshold = 22.5 seconds)
    mockTimer.getElapsedTime.mockReturnValue(22.5);
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('warning-level')).toHaveTextContent('1');

    // Test warning level 2 (100% threshold = 30 seconds)
    mockTimer.getElapsedTime.mockReturnValue(30);
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('warning-level')).toHaveTextContent('2');
    expect(screen.getByTestId('prompt-visible')).toHaveTextContent('visible');

    // Dismiss prompt to continue testing level 3
    fireEvent.click(screen.getByTestId('dismiss'));

    // Test warning level 3 (150% threshold = 45 seconds)
    mockTimer.getElapsedTime.mockReturnValue(45);
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('warning-level')).toHaveTextContent('3');
  });

  it('should reset prompt visibility and warning level on timer reset', () => {
    render(
      <MemoryRouter>
        <TestHarness
          initialTimerRef={mockTimer}
          onPromptChange={(val) => promptChanges.push(val)}
          onWarningLevelChange={(val) => warningLevelChanges.push(val)}
        />
      </MemoryRouter>
    );

    // Start timer and trigger prompt
    fireEvent.click(screen.getByTestId('start'));
    mockTimer.getElapsedTime.mockReturnValue(30);
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.getByTestId('prompt-visible')).toHaveTextContent('visible');
    expect(screen.getByTestId('warning-level')).toHaveTextContent('2');

    // Reset the timer
    fireEvent.click(screen.getByTestId('reset'));

    // Prompt should be hidden and warning level reset after reset
    expect(screen.getByTestId('prompt-visible')).toHaveTextContent('hidden');
    expect(screen.getByTestId('warning-level')).toHaveTextContent('0');
  });
});

describe('StillWorkingPrompt - Unlimited Mode', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('should not show prompt or update warning levels in unlimited mode', () => {
    const promptChanges = [];
    const warningLevelChanges = [];

    const mockTimer = {
      start: jest.fn(() => true),
      pause: jest.fn(),
      reset: jest.fn(),
      isRunning: true,
      getElapsedTime: jest.fn(() => 60), // Well past any threshold
      recommendedLimit: 30,
      isInterviewMode: false,
      isUnlimited: false,
    };

    // Custom harness for unlimited mode
    function UnlimitedModeHarness() {
      const [timeWarningLevel, setTimeWarningLevel] = useState(0);
      const [showStillWorkingPrompt, setShowStillWorkingPrompt] = useState(false);

      const timerRef = useRef(mockTimer);
      const intervalIdRef = useRef(null);

      const timerState = {
        timeWarningLevel,
        showStillWorkingPrompt,
        isUnlimitedMode: true, // Unlimited mode enabled
        exceededRecommendedTime: false,
        displayTime: 0,
        countdownVisible: false,
        countdownValue: null,
        userIntent: 'solving',
        interviewSignals: {},
        setIsTimerRunning: jest.fn(),
        setDisplayTime: jest.fn(),
        setTimeWarningLevel: (val) => {
          setTimeWarningLevel(val);
          warningLevelChanges.push(val);
        },
        setExceededRecommendedTime: jest.fn(),
        setShowStillWorkingPrompt: (val) => {
          setShowStillWorkingPrompt(val);
          promptChanges.push(val);
        },
        setCountdownVisible: jest.fn(),
        setCountdownValue: jest.fn(),
        setUserIntent: jest.fn(),
        setOpen: jest.fn(),
      };

      const options = {
        sessionType: 'standard',
        navigate: jest.fn(),
        state: { LeetCodeID: '1' },
      };

      const operations = useTimerOperations(timerRef, intervalIdRef, timerState, options);

      return (
        <div>
          <button data-testid="start" onClick={operations.handleStart}>Start</button>
          <div data-testid="warning-level">{timeWarningLevel}</div>
          <div data-testid="prompt-visible">{showStillWorkingPrompt ? 'visible' : 'hidden'}</div>
        </div>
      );
    }

    render(
      <MemoryRouter>
        <UnlimitedModeHarness />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('start'));

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    // In unlimited mode, neither warning level nor prompt should change
    expect(warningLevelChanges.length).toBe(0);
    expect(promptChanges.length).toBe(0);
    expect(screen.getByTestId('warning-level')).toHaveTextContent('0');
    expect(screen.getByTestId('prompt-visible')).toHaveTextContent('hidden');
  });
});

describe('StillWorkingPrompt - Multiple Dismissals Stress Test', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('should stay dismissed through many interval ticks after user dismisses', () => {
    const promptChanges = [];
    const mockTimer = {
      start: jest.fn(() => true),
      pause: jest.fn(),
      reset: jest.fn(),
      isRunning: true,
      getElapsedTime: jest.fn(() => 0),
      recommendedLimit: 30,
      isInterviewMode: false,
      isUnlimited: false,
    };

    render(
      <MemoryRouter>
        <TestHarness
          initialTimerRef={mockTimer}
          onPromptChange={(val) => promptChanges.push(val)}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('start'));

    // Trigger the prompt
    mockTimer.getElapsedTime.mockReturnValue(30);
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.getByTestId('prompt-visible')).toHaveTextContent('visible');

    // User dismisses the prompt
    fireEvent.click(screen.getByTestId('dismiss'));
    expect(screen.getByTestId('prompt-visible')).toHaveTextContent('hidden');

    // Track future prompt changes
    const dismissIndex = promptChanges.length;

    // Simulate 10 more interval ticks with increasing time
    for (let i = 0; i < 10; i++) {
      mockTimer.getElapsedTime.mockReturnValue(31 + i);
      act(() => {
        jest.advanceTimersByTime(1000);
      });
    }

    // Check that no `true` values were added after dismissal
    const changesAfterDismiss = promptChanges.slice(dismissIndex);
    const promptShownAgain = changesAfterDismiss.includes(true);

    expect(promptShownAgain).toBe(false);
    expect(screen.getByTestId('prompt-visible')).toHaveTextContent('hidden');
  });
});
