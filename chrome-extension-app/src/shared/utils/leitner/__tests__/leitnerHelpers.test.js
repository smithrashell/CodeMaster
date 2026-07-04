/**
 * Tests for leitnerHelpers - applyStabilityAdjustment & calculateTimePerformanceScore
 * Verifies the case sensitivity bug fix: attemptData.success (lowercase) is used correctly
 * Verifies time performance scoring based on difficulty and time_spent
 */

import { applyStabilityAdjustment, calculateTimePerformanceScore, calculateNextReviewDate } from "../leitnerHelpers.js";

describe("applyStabilityAdjustment", () => {
  const baseProblem = { stability: 2.0, box_level: 3 };

  it("should pass true to updateStabilityFSRS when attemptData.success is true (lowercase)", () => {
    const mockUpdateStability = jest.fn().mockReturnValue(2.5);
    const attemptData = { success: true, difficulty: 2, time_spent: 300 };

    applyStabilityAdjustment({ ...baseProblem }, attemptData, 1.2, mockUpdateStability);

    expect(mockUpdateStability).toHaveBeenCalledWith(2.0, true);
  });

  it("should multiply stability by timePerformanceScore on success", () => {
    const mockUpdateStability = jest.fn().mockReturnValue(2.5);
    const attemptData = { success: true, difficulty: 2, time_spent: 300 };

    const result = applyStabilityAdjustment({ ...baseProblem }, attemptData, 1.2, mockUpdateStability);

    expect(result.stability).toBeCloseTo(2.5 * 1.2);
  });

  it("should NOT multiply stability by timePerformanceScore on failure", () => {
    const mockUpdateStability = jest.fn().mockReturnValue(1.5);
    const attemptData = { success: false, difficulty: 2, time_spent: 300 };

    const result = applyStabilityAdjustment({ ...baseProblem }, attemptData, 1.2, mockUpdateStability);

    expect(mockUpdateStability).toHaveBeenCalledWith(2.0, false);
    expect(result.stability).toBe(1.5);
  });

  it("should pass false to updateStabilityFSRS when attemptData is null", () => {
    const mockUpdateStability = jest.fn().mockReturnValue(1.0);

    const result = applyStabilityAdjustment({ ...baseProblem }, null, 1.0, mockUpdateStability);

    expect(mockUpdateStability).toHaveBeenCalledWith(2.0, false);
    expect(result.stability).toBe(1.0);
  });

  it("should default timePerformanceScore to 1.0 when not provided", () => {
    const mockUpdateStability = jest.fn().mockReturnValue(2.5);
    const attemptData = { success: true, difficulty: 2, time_spent: 300 };

    const result = applyStabilityAdjustment({ ...baseProblem }, attemptData, undefined, mockUpdateStability);

    expect(result.stability).toBeCloseTo(2.5 * 1.0);
    expect(Number.isNaN(result.stability)).toBe(false);
  });
});

describe("calculateTimePerformanceScore", () => {
  it("should return neutral 1.0 when attemptData is null", () => {
    const { timePerformanceScore, exceededTimeLimit } = calculateTimePerformanceScore(null);

    expect(timePerformanceScore).toBe(1.0);
    expect(exceededTimeLimit).toBe(false);
  });

  // TIME_LIMITS_BY_DIFFICULTY: { 1: 15min, 2: 25min, 3: 40min }
  // difficulty 2 → 25min → 1500s recommended

  it("should return 1.2 (excellent) when time_spent is within recommended limit", () => {
    const attemptData = { difficulty: 2, time_spent: 1000 }; // 1000s < 1500s

    const { timePerformanceScore } = calculateTimePerformanceScore(attemptData);

    expect(timePerformanceScore).toBe(1.2);
  });

  it("should return 1.0 (good) when time_spent is within 1.5x recommended limit", () => {
    const attemptData = { difficulty: 2, time_spent: 2000 }; // 2000s < 2250s (1500 * 1.5)

    const { timePerformanceScore } = calculateTimePerformanceScore(attemptData);

    expect(timePerformanceScore).toBe(1.0);
  });

  it("should return 0.8 (slow) when time_spent is within 2x recommended limit", () => {
    const attemptData = { difficulty: 2, time_spent: 2500 }; // 2500s < 3000s (1500 * 2)

    const { timePerformanceScore } = calculateTimePerformanceScore(attemptData);

    expect(timePerformanceScore).toBe(0.8);
  });

  it("should return 0.6 and exceededTimeLimit when time_spent exceeds 2x recommended", () => {
    const attemptData = { difficulty: 2, time_spent: 3500 }; // 3500s > 3000s

    const { timePerformanceScore, exceededTimeLimit } = calculateTimePerformanceScore(attemptData);

    expect(timePerformanceScore).toBe(0.6);
    expect(exceededTimeLimit).toBe(true);
  });

  it("should apply 0.9 penalty when user_intent is 'stuck'", () => {
    const attemptData = { difficulty: 2, time_spent: 1000, user_intent: "stuck" };

    const { timePerformanceScore } = calculateTimePerformanceScore(attemptData);

    expect(timePerformanceScore).toBeCloseTo(1.2 * 0.9);
  });

  it("should apply 1.1 bonus when user_intent is 'solving' and time exceeded 2x limit", () => {
    // difficulty 2 → 1500s recommended, 3500s > 3000s (2x) → exceededTimeLimit=true, base=0.6
    const attemptData = { difficulty: 2, time_spent: 3500, user_intent: "solving" };

    const { timePerformanceScore, exceededTimeLimit } = calculateTimePerformanceScore(attemptData);

    expect(exceededTimeLimit).toBe(true);
    expect(timePerformanceScore).toBeCloseTo(0.6 * 1.1);
  });

  it("should NOT apply persistence bonus when user_intent is 'solving' but time is within limit", () => {
    // Within recommended time → exceededTimeLimit=false, so no bonus
    const attemptData = { difficulty: 2, time_spent: 1000, user_intent: "solving" };

    const { timePerformanceScore, exceededTimeLimit } = calculateTimePerformanceScore(attemptData);

    expect(exceededTimeLimit).toBe(false);
    expect(timePerformanceScore).toBe(1.2); // No 1.1 bonus applied
  });

  it("should default to 25min recommended time when difficulty is unknown", () => {
    const attemptData = { difficulty: 99, time_spent: 1000 }; // unknown difficulty → 25min → 1500s

    const { timePerformanceScore } = calculateTimePerformanceScore(attemptData);

    expect(timePerformanceScore).toBe(1.2); // 1000s < 1500s → excellent
  });
});

describe("calculateTimePerformanceScore → applyStabilityAdjustment integration", () => {
  it("should scale stability by time performance for successful fast attempts", () => {
    const mockUpdateStability = jest.fn().mockReturnValue(2.5);
    const attemptData = { success: true, difficulty: 2, time_spent: 1000 };

    const { timePerformanceScore } = calculateTimePerformanceScore(attemptData);
    const result = applyStabilityAdjustment({ stability: 2.0, box_level: 3 }, attemptData, timePerformanceScore, mockUpdateStability);

    expect(timePerformanceScore).toBe(1.2);
    expect(result.stability).toBeCloseTo(2.5 * 1.2);
  });

  it("should penalize stability for successful slow attempts", () => {
    const mockUpdateStability = jest.fn().mockReturnValue(2.5);
    const attemptData = { success: true, difficulty: 2, time_spent: 3500 };

    const { timePerformanceScore } = calculateTimePerformanceScore(attemptData);
    const result = applyStabilityAdjustment({ stability: 2.0, box_level: 3 }, attemptData, timePerformanceScore, mockUpdateStability);

    expect(timePerformanceScore).toBe(0.6);
    expect(result.stability).toBeCloseTo(2.5 * 0.6);
  });
});

describe("applyStabilityAdjustment — user_intent handling", () => {
  const baseProblem = { stability: 2.0, box_level: 3 };

  it("should reduce stability by 0.85 when user_intent is 'stuck' and attempt failed", () => {
    const mockUpdateStability = jest.fn().mockReturnValue(1.5);
    const attemptData = { success: false, difficulty: 2, time_spent: 300, user_intent: "stuck" };

    const result = applyStabilityAdjustment({ ...baseProblem }, attemptData, 1.0, mockUpdateStability);

    expect(result.stability).toBeCloseTo(1.5 * 0.85);
  });

  it("should NOT reduce stability when user_intent is 'stuck' but attempt succeeded", () => {
    const mockUpdateStability = jest.fn().mockReturnValue(2.5);
    const attemptData = { success: true, difficulty: 2, time_spent: 300, user_intent: "stuck" };

    const result = applyStabilityAdjustment({ ...baseProblem }, attemptData, 1.0, mockUpdateStability);

    // Success path: stability * timePerformanceScore, no 0.85 penalty
    expect(result.stability).toBeCloseTo(2.5 * 1.0);
  });

  it("should leave stability unchanged when user_intent is 'solving'", () => {
    const mockUpdateStability = jest.fn().mockReturnValue(1.5);
    const attemptData = { success: false, difficulty: 2, time_spent: 300, user_intent: "solving" };

    const result = applyStabilityAdjustment({ ...baseProblem }, attemptData, 1.0, mockUpdateStability);

    // No penalty for "solving" intent
    expect(result.stability).toBe(1.5);
  });
});

describe("calculateNextReviewDate — user_intent handling", () => {
  it("should cap review days at 7 when user_intent is 'stuck' and attempt failed", () => {
    // box_level 5 → base 30 days, stability 2.0 → multiplier 1.0 → 30 days before cap
    const problem = { box_level: 5, stability: 2.0, cooldown_status: false };
    const attemptData = { success: false, user_intent: "stuck", attempt_date: new Date() };

    const { nextReviewDays } = calculateNextReviewDate(problem, attemptData);

    expect(nextReviewDays).toBeLessThanOrEqual(7);
  });

  it("should NOT cap review days when user_intent is 'stuck' but attempt succeeded", () => {
    // box_level 5 → base 30 days, stability 2.0 → multiplier 1.0 → 30 days
    const problem = { box_level: 5, stability: 2.0, cooldown_status: false };
    const attemptData = { success: true, user_intent: "stuck", attempt_date: new Date() };

    const { nextReviewDays } = calculateNextReviewDate(problem, attemptData);

    expect(nextReviewDays).toBeGreaterThan(7);
  });
});
