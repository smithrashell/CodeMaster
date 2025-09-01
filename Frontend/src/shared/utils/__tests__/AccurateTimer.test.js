/**
 * @jest-environment jsdom
 */
import AccurateTimer from "../AccurateTimer";

// Shared test setup
beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(global.Date, "now").mockImplementation(() => 1000000);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("AccurateTimer - Basic Operations", () => {
  test("should initialize with correct time", () => {
      const timer = new AccurateTimer(300); // 5 minutes in seconds
      expect(timer.totalTimeInSeconds).toBe(300);
      expect(timer.isRunning).toBe(false);
      expect(timer.getRemainingTime()).toBe(300);
      expect(timer.getElapsedTime()).toBe(0);
    });

    test("should handle invalid initialization values", () => {
      const timer1 = new AccurateTimer(-50);
      expect(timer1.totalTimeInSeconds).toBe(0);

      const timer2 = new AccurateTimer("invalid");
      expect(timer2.totalTimeInSeconds).toBe(0);

      const timer3 = new AccurateTimer(null);
      expect(timer3.totalTimeInSeconds).toBe(0);
    });

    test("should start and stop correctly", () => {
      const timer = new AccurateTimer(300);

      expect(timer.start()).toBe(true);
      expect(timer.isRunning).toBe(true);
      expect(timer.startTimestamp).toBe(1000000);

      // Can't start twice
      expect(timer.start()).toBe(false);

      expect(timer.stop()).toBe(0); // No time elapsed
      expect(timer.isRunning).toBe(false);
    });

    test("should calculate elapsed time correctly", () => {
      const timer = new AccurateTimer(300);

      timer.start();
      Date.now.mockReturnValue(1005000); // 5 seconds later

      expect(timer.getElapsedTime()).toBe(5);
      expect(timer.getRemainingTime()).toBe(295);

      timer.stop();
      expect(timer.getElapsedTime()).toBe(5); // Should preserve elapsed time
    });

    test("should handle pause and resume", () => {
      const timer = new AccurateTimer(300);

      timer.start();
      Date.now.mockReturnValue(1005000); // 5 seconds elapsed

      expect(timer.pause()).toBe(true);
      expect(timer.isPaused).toBe(true);
      expect(timer.isRunning).toBe(false);
      expect(timer.accumulatedTime).toBe(5);

      // Simulate more time passing while paused
      Date.now.mockReturnValue(1010000);
      expect(timer.getElapsedTime()).toBe(5); // Should not increase while paused

      expect(timer.resume()).toBe(true);
      expect(timer.isRunning).toBe(true);
      expect(timer.isPaused).toBe(false);

      Date.now.mockReturnValue(1013000); // 3 more seconds
      expect(timer.getElapsedTime()).toBe(8); // 5 + 3
    });
});

describe("AccurateTimer - Time Formatting and Conversion", () => {
    test("should format time correctly", () => {
      expect(AccurateTimer.formatTime(0)).toBe("00:00");
      expect(AccurateTimer.formatTime(65)).toBe("01:05");
      expect(AccurateTimer.formatTime(3661)).toBe("61:01");
      expect(AccurateTimer.formatTime(-30)).toBe("-00:30");
    });

    test("should convert minutes to seconds", () => {
      expect(AccurateTimer.minutesToSeconds(5)).toBe(300);
      expect(AccurateTimer.minutesToSeconds(2.5)).toBe(150);
      expect(AccurateTimer.minutesToSeconds(0)).toBe(0);
      expect(AccurateTimer.minutesToSeconds(-5)).toBe(300); // Should handle negatives
    });

    test("should convert seconds to minutes", () => {
      expect(AccurateTimer.secondsToMinutes(300)).toBe(5);
      expect(AccurateTimer.secondsToMinutes(90, 1)).toBe(1.5);
      expect(AccurateTimer.secondsToMinutes(0)).toBe(0);
    });

    test("should normalize time input correctly", () => {
      expect(AccurateTimer.normalizeTimeInput(5, "minutes")).toBe(300);
      expect(AccurateTimer.normalizeTimeInput(300, "seconds")).toBe(300);
      expect(AccurateTimer.normalizeTimeInput("5", "minutes")).toBe(300);
      expect(AccurateTimer.normalizeTimeInput(-5, "minutes")).toBe(0);
      expect(AccurateTimer.normalizeTimeInput("invalid", "seconds")).toBe(0);
    });
});

describe("AccurateTimer - Calculation Bug Fixes", () => {
    test("should calculate accurate time spent", () => {
      // Test the original bug: limit/60 - Math.round(time/60)
      const originalLimit = 1800; // 30 minutes in seconds
      const remainingTime = 600; // 10 minutes remaining

      const timeSpent = AccurateTimer.calculateTimeSpent(
        originalLimit,
        remainingTime
      );
      expect(timeSpent).toBe(1200); // Should be 20 minutes (1200 seconds)

      // Edge cases
      expect(AccurateTimer.calculateTimeSpent(300, 300)).toBe(0); // No time used
      expect(AccurateTimer.calculateTimeSpent(300, 0)).toBe(300); // All time used
      expect(AccurateTimer.calculateTimeSpent(300, 400)).toBe(0); // Over time (shouldn't be negative)
    });

    test("should handle the original problematic calculation", () => {
      // Original problematic code was: limit/60 - Math.round(time/60)
      // Where limit was already in seconds but divided by 60 again
      // And time was remaining time, not elapsed time

      const limitInSeconds = 1800; // 30 minutes
      const remainingSeconds = 600; // 10 minutes remaining

      // What the old buggy code would have calculated:
      // (1800/60) - Math.round(600/60) = 30 - 10 = 20 minutes
      // But this was logically wrong because:
      // 1. It mixed units (seconds and minutes)
      // 2. It calculated remaining time, not time spent

      // What our fixed code calculates:
      const correctTimeSpent = AccurateTimer.calculateTimeSpent(
        limitInSeconds,
        remainingSeconds
      );
      expect(correctTimeSpent).toBe(1200); // 20 minutes in seconds (correct)

      // Verify it matches the expected business logic
      const expectedMinutes = 20;
      expect(AccurateTimer.secondsToMinutes(correctTimeSpent)).toBe(
        expectedMinutes
      );
    });
});

describe("AccurateTimer - Edge Cases and Error Handling", () => {
    test("should handle countdown to zero", () => {
      const timer = new AccurateTimer(5); // 5 seconds

      timer.start();
      Date.now.mockReturnValue(1005000); // 5 seconds elapsed

      expect(timer.isTimeUp()).toBe(true);
      expect(timer.getRemainingTime()).toBe(0);
    });

    test("should handle overtime gracefully", () => {
      const timer = new AccurateTimer(5);

      timer.start();
      Date.now.mockReturnValue(1010000); // 10 seconds elapsed (overtime)

      expect(timer.isTimeUp()).toBe(true);
      expect(timer.getRemainingTime()).toBe(0); // Should not go negative
      expect(timer.getElapsedTime()).toBe(10); // Should track actual elapsed time
    });

    test("should reset correctly", () => {
      const timer = new AccurateTimer(300);

      timer.start();
      Date.now.mockReturnValue(1005000); // 5 seconds elapsed

      timer.reset(600); // Reset to 10 minutes
      expect(timer.totalTimeInSeconds).toBe(600);
      expect(timer.getElapsedTime()).toBe(0);
      expect(timer.isRunning).toBe(true); // Should restart if was running before

      // Test reset when not running
      timer.stop();
      timer.reset(900);
      expect(timer.totalTimeInSeconds).toBe(900);
      expect(timer.isRunning).toBe(false); // Should not start if wasn't running
    });

    test("should provide accurate status", () => {
      const timer = new AccurateTimer(300);

      const initialStatus = timer.getStatus();
      expect(initialStatus).toEqual({
        isRunning: false,
        isPaused: false,
        elapsedTime: 0,
        remainingTime: 300,
        totalTime: 300,
        isTimeUp: false,
      });

      timer.start();
      Date.now.mockReturnValue(1005000);

      const runningStatus = timer.getStatus();
      expect(runningStatus).toEqual({
        isRunning: true,
        isPaused: false,
        elapsedTime: 5,
        remainingTime: 295,
        totalTime: 300,
        isTimeUp: false,
      });
    });
});

describe("AccurateTimer - Factory Methods", () => {
    test("should create timer from different time formats", () => {
      const timer1 = AccurateTimer.createFromTime(5, "minutes");
      expect(timer1.totalTimeInSeconds).toBe(300);

      const timer2 = AccurateTimer.createFromTime(300, "seconds");
      expect(timer2.totalTimeInSeconds).toBe(300);

      const timer3 = AccurateTimer.createFromTime("10", "minutes");
      expect(timer3.totalTimeInSeconds).toBe(600);
  });
});
