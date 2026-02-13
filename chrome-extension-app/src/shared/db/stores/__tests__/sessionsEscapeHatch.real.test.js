/**
 * Real tests for sessionsEscapeHatch.js
 *
 * Tests the three exported functions:
 *   - applyEscapeHatchLogic (pure state mutation, no DB)
 *   - checkForDemotion (calls getRecentSessionAnalytics, mocked)
 *   - analyzePerformanceTrend (pure function)
 */

// -- Mocks (before imports) --------------------------------------------------

jest.mock('../../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../sessionAnalytics.js', () => ({
  getRecentSessionAnalytics: jest.fn(),
}));

// -- Imports -----------------------------------------------------------------

import logger from '../../../utils/logging/logger.js';
import { getRecentSessionAnalytics } from '../sessionAnalytics.js';

import {
  applyEscapeHatchLogic,
  checkForDemotion,
  analyzePerformanceTrend,
} from '../sessionsEscapeHatch.js';

// -- Helpers -----------------------------------------------------------------

function makeSessionState(overrides = {}) {
  return {
    current_difficulty_cap: 'Easy',
    difficulty_time_stats: {
      easy: { problems: 0, total_time: 0, avg_time: 0 },
      medium: { problems: 0, total_time: 0, avg_time: 0 },
      hard: { problems: 0, total_time: 0, avg_time: 0 },
    },
    num_sessions_completed: 1,
    ...overrides,
  };
}

// -- applyEscapeHatchLogic ---------------------------------------------------

describe('applyEscapeHatchLogic', () => {
  const now = new Date('2026-02-10T12:00:00Z');
  const settings = {};

  it('initializes difficulty_time_stats and escape_hatches when missing', () => {
    const state = { num_sessions_completed: 1 };

    const result = applyEscapeHatchLogic(state, 0.5, settings, now);

    expect(result.difficulty_time_stats).toBeDefined();
    expect(result.current_difficulty_cap).toBe('Easy');
    expect(result.escape_hatches).toBeDefined();
    expect(result.escape_hatches.sessions_at_current_difficulty).toBeGreaterThanOrEqual(1);
  });

  it('does not promote when Easy problems < 4', () => {
    const state = makeSessionState({
      difficulty_time_stats: {
        easy: { problems: 2, total_time: 1000, avg_time: 500 },
        medium: { problems: 0, total_time: 0, avg_time: 0 },
        hard: { problems: 0, total_time: 0, avg_time: 0 },
      },
    });

    const result = applyEscapeHatchLogic(state, 0.9, settings, now);

    expect(result.current_difficulty_cap).toBe('Easy');
  });

  it('promotes Easy -> Medium via standard promotion (>= 4 problems, >= 80% accuracy)', () => {
    const state = makeSessionState({
      current_difficulty_cap: 'Easy',
      difficulty_time_stats: {
        easy: { problems: 5, total_time: 2500, avg_time: 500 },
        medium: { problems: 0, total_time: 0, avg_time: 0 },
        hard: { problems: 0, total_time: 0, avg_time: 0 },
      },
    });

    const result = applyEscapeHatchLogic(state, 0.85, settings, now);

    expect(result.current_difficulty_cap).toBe('Medium');
  });

  it('promotes Medium -> Hard via standard promotion', () => {
    const state = makeSessionState({
      current_difficulty_cap: 'Medium',
      difficulty_time_stats: {
        easy: { problems: 0, total_time: 0, avg_time: 0 },
        medium: { problems: 6, total_time: 6000, avg_time: 1000 },
        hard: { problems: 0, total_time: 0, avg_time: 0 },
      },
    });

    const result = applyEscapeHatchLogic(state, 0.9, settings, now);

    expect(result.current_difficulty_cap).toBe('Hard');
  });

  it('promotes via stagnation escape hatch when >= 8 problems regardless of accuracy', () => {
    const state = makeSessionState({
      current_difficulty_cap: 'Easy',
      difficulty_time_stats: {
        easy: { problems: 8, total_time: 8000, avg_time: 1000 },
        medium: { problems: 0, total_time: 0, avg_time: 0 },
        hard: { problems: 0, total_time: 0, avg_time: 0 },
      },
    });

    const result = applyEscapeHatchLogic(state, 0.3, settings, now);

    expect(result.current_difficulty_cap).toBe('Medium');
    expect(result.escape_hatches.activated_escape_hatches).toEqual([]);
    // escape hatches are cleared on promotion
  });

  it('does not promote Hard (stays at Hard)', () => {
    const state = makeSessionState({
      current_difficulty_cap: 'Hard',
      difficulty_time_stats: {
        easy: { problems: 0, total_time: 0, avg_time: 0 },
        medium: { problems: 0, total_time: 0, avg_time: 0 },
        hard: { problems: 10, total_time: 10000, avg_time: 1000 },
      },
    });

    const result = applyEscapeHatchLogic(state, 0.9, settings, now);

    expect(result.current_difficulty_cap).toBe('Hard');
  });

  it('does not promote when accuracy is below threshold and problems < 8', () => {
    const state = makeSessionState({
      current_difficulty_cap: 'Easy',
      difficulty_time_stats: {
        easy: { problems: 5, total_time: 2500, avg_time: 500 },
        medium: { problems: 0, total_time: 0, avg_time: 0 },
        hard: { problems: 0, total_time: 0, avg_time: 0 },
      },
    });

    const result = applyEscapeHatchLogic(state, 0.5, settings, now);

    expect(result.current_difficulty_cap).toBe('Easy');
  });

  it('increments sessions_at_current_difficulty each call', () => {
    const state = makeSessionState();
    state.escape_hatches = {
      sessions_at_current_difficulty: 3,
      last_difficulty_promotion: null,
      sessions_without_promotion: 1,
      activated_escape_hatches: [],
    };

    applyEscapeHatchLogic(state, 0.5, settings, now);

    expect(state.escape_hatches.sessions_at_current_difficulty).toBe(4);
  });

  it('tracks sessions_without_promotion when no promotion occurs', () => {
    const state = makeSessionState({
      current_difficulty_cap: 'Easy',
      difficulty_time_stats: {
        easy: { problems: 2, total_time: 1000, avg_time: 500 },
        medium: { problems: 0, total_time: 0, avg_time: 0 },
        hard: { problems: 0, total_time: 0, avg_time: 0 },
      },
    });

    const result = applyEscapeHatchLogic(state, 0.5, settings, now);

    expect(result.escape_hatches.sessions_without_promotion).toBeGreaterThanOrEqual(1);
  });

  it('resets sessions_without_promotion on promotion', () => {
    const state = makeSessionState({
      current_difficulty_cap: 'Easy',
      difficulty_time_stats: {
        easy: { problems: 5, total_time: 2500, avg_time: 500 },
        medium: { problems: 0, total_time: 0, avg_time: 0 },
        hard: { problems: 0, total_time: 0, avg_time: 0 },
      },
    });

    const result = applyEscapeHatchLogic(state, 0.85, settings, now);

    expect(result.current_difficulty_cap).toBe('Medium');
    expect(result.escape_hatches.sessions_without_promotion).toBe(0);
  });

  it('logs progress toward promotion when not promoted', () => {
    const state = makeSessionState({
      current_difficulty_cap: 'Easy',
      difficulty_time_stats: {
        easy: { problems: 2, total_time: 1000, avg_time: 500 },
        medium: { problems: 0, total_time: 0, avg_time: 0 },
        hard: { problems: 0, total_time: 0, avg_time: 0 },
      },
    });

    applyEscapeHatchLogic(state, 0.5, settings, now);

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Progress toward promotion')
    );
  });

  it('sets last_difficulty_promotion timestamp on promotion', () => {
    const state = makeSessionState({
      current_difficulty_cap: 'Easy',
      difficulty_time_stats: {
        easy: { problems: 5, total_time: 2500, avg_time: 500 },
        medium: { problems: 0, total_time: 0, avg_time: 0 },
        hard: { problems: 0, total_time: 0, avg_time: 0 },
      },
    });

    const result = applyEscapeHatchLogic(state, 0.85, settings, now);

    expect(result.escape_hatches.last_difficulty_promotion).toBe(now.toISOString());
  });

  it('records stagnation escape hatch activation before promotion clears it', () => {
    // With 8+ problems and low accuracy, stagnation escape is activated
    // but then promotion clears the activated_escape_hatches array
    const state = makeSessionState({
      current_difficulty_cap: 'Easy',
      difficulty_time_stats: {
        easy: { problems: 9, total_time: 9000, avg_time: 1000 },
        medium: { problems: 0, total_time: 0, avg_time: 0 },
        hard: { problems: 0, total_time: 0, avg_time: 0 },
      },
    });

    const result = applyEscapeHatchLogic(state, 0.4, settings, now);

    // After promotion, escape hatches are reset
    expect(result.current_difficulty_cap).toBe('Medium');
    expect(result.escape_hatches.activated_escape_hatches).toEqual([]);
  });
});

// -- checkForDemotion --------------------------------------------------------

describe('checkForDemotion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns unchanged state when current cap is Easy', async () => {
    const state = { current_difficulty_cap: 'Easy' };

    const result = await checkForDemotion(state);

    expect(result.current_difficulty_cap).toBe('Easy');
    expect(getRecentSessionAnalytics).not.toHaveBeenCalled();
  });

  it('returns unchanged state when fewer than 3 recent sessions', async () => {
    getRecentSessionAnalytics.mockResolvedValue([
      { accuracy: 0.3 },
    ]);

    const state = { current_difficulty_cap: 'Medium' };

    const result = await checkForDemotion(state);

    expect(result.current_difficulty_cap).toBe('Medium');
  });

  it('demotes Hard -> Medium when 3 sessions have accuracy < 0.5', async () => {
    getRecentSessionAnalytics.mockResolvedValue([
      { accuracy: 0.4 },
      { accuracy: 0.3 },
      { accuracy: 0.2 },
    ]);

    const state = {
      current_difficulty_cap: 'Hard',
      escape_hatches: { sessions_at_current_difficulty: 5 },
    };

    const result = await checkForDemotion(state);

    expect(result.current_difficulty_cap).toBe('Medium');
    expect(result.escape_hatches.sessions_at_current_difficulty).toBe(0);
  });

  it('demotes Medium -> Easy when 3 sessions have accuracy < 0.5', async () => {
    getRecentSessionAnalytics.mockResolvedValue([
      { accuracy: 0.4 },
      { accuracy: 0.3 },
      { accuracy: 0.45 },
    ]);

    const state = { current_difficulty_cap: 'Medium' };

    const result = await checkForDemotion(state);

    expect(result.current_difficulty_cap).toBe('Easy');
  });

  it('does not demote when fewer than 3 sessions have low accuracy', async () => {
    getRecentSessionAnalytics.mockResolvedValue([
      { accuracy: 0.4 },
      { accuracy: 0.8 },
      { accuracy: 0.3 },
    ]);

    const state = { current_difficulty_cap: 'Hard' };

    const result = await checkForDemotion(state);

    expect(result.current_difficulty_cap).toBe('Hard');
  });

  it('treats missing accuracy as 0', async () => {
    getRecentSessionAnalytics.mockResolvedValue([
      {},
      {},
      {},
    ]);

    const state = { current_difficulty_cap: 'Hard' };

    const result = await checkForDemotion(state);

    // All accuracies are 0 < 0.5, so all 3 count
    expect(result.current_difficulty_cap).toBe('Medium');
  });

  it('returns unchanged state when getRecentSessionAnalytics throws', async () => {
    getRecentSessionAnalytics.mockRejectedValue(new Error('DB error'));

    const state = { current_difficulty_cap: 'Hard' };

    const result = await checkForDemotion(state);

    expect(result.current_difficulty_cap).toBe('Hard');
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error in demotion check'),
      expect.any(Error)
    );
  });

  it('logs demotion details when demotion occurs', async () => {
    getRecentSessionAnalytics.mockResolvedValue([
      { accuracy: 0.1 },
      { accuracy: 0.2 },
      { accuracy: 0.3 },
    ]);

    const state = { current_difficulty_cap: 'Hard' };

    await checkForDemotion(state);

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Difficulty Demotion')
    );
  });

  it('handles missing escape_hatches when demoting', async () => {
    getRecentSessionAnalytics.mockResolvedValue([
      { accuracy: 0.1 },
      { accuracy: 0.2 },
      { accuracy: 0.3 },
    ]);

    const state = { current_difficulty_cap: 'Medium' };
    // no escape_hatches property

    const result = await checkForDemotion(state);

    expect(result.current_difficulty_cap).toBe('Easy');
    // Should not throw even without escape_hatches
  });

  it('defaults current cap to Easy when missing', async () => {
    const state = {};

    const result = await checkForDemotion(state);

    // current_difficulty_cap defaults to "Easy", so no demotion is possible
    expect(getRecentSessionAnalytics).not.toHaveBeenCalled();
  });
});

// -- analyzePerformanceTrend -------------------------------------------------

describe('analyzePerformanceTrend', () => {
  it('returns "stable" for null input', () => {
    expect(analyzePerformanceTrend(null)).toBe('stable');
  });

  it('returns "stable" for empty array', () => {
    expect(analyzePerformanceTrend([])).toBe('stable');
  });

  it('returns "stable" for single session', () => {
    expect(analyzePerformanceTrend([{ accuracy: 0.5 }])).toBe('stable');
  });

  it('returns "improving" when last 3 accuracies consistently increase by > 0.05', () => {
    const analytics = [
      { accuracy: 0.5 },
      { accuracy: 0.6 },
      { accuracy: 0.7 },
    ];

    expect(analyzePerformanceTrend(analytics)).toBe('improving');
  });

  it('returns "declining" when last 3 accuracies consistently decrease by > 0.05', () => {
    const analytics = [
      { accuracy: 0.8 },
      { accuracy: 0.7 },
      { accuracy: 0.5 },
    ];

    expect(analyzePerformanceTrend(analytics)).toBe('declining');
  });

  it('returns "stable" when changes are small (<= 0.05)', () => {
    const analytics = [
      { accuracy: 0.5 },
      { accuracy: 0.52 },
      { accuracy: 0.54 },
    ];

    expect(analyzePerformanceTrend(analytics)).toBe('stable');
  });

  it('returns "stable" when trend is mixed', () => {
    const analytics = [
      { accuracy: 0.5 },
      { accuracy: 0.7 },
      { accuracy: 0.55 },
    ];

    expect(analyzePerformanceTrend(analytics)).toBe('stable');
  });

  it('uses only the last 3 sessions from a longer array', () => {
    const analytics = [
      { accuracy: 0.1 }, // ignored (beyond last 3)
      { accuracy: 0.2 }, // ignored (beyond last 3)
      { accuracy: 0.5 },
      { accuracy: 0.6 },
      { accuracy: 0.7 },
    ];

    expect(analyzePerformanceTrend(analytics)).toBe('improving');
  });

  it('treats missing accuracy as 0', () => {
    const analytics = [
      { accuracy: 0.5 },
      {},
      {},
    ];

    // 0.5 -> 0 (decline of 0.5), 0 -> 0 (no change)
    // Only 1 declining, 0 improving => stable
    expect(analyzePerformanceTrend(analytics)).toBe('stable');
  });

  it('returns "declining" when 2+ consecutive drops exceed 0.05', () => {
    const analytics = [
      { accuracy: 0.9 },
      { accuracy: 0.7 },
      { accuracy: 0.4 },
    ];

    expect(analyzePerformanceTrend(analytics)).toBe('declining');
  });

  it('handles exactly 2 sessions', () => {
    const analytics = [
      { accuracy: 0.3 },
      { accuracy: 0.8 },
    ];

    // Only 1 improving step, need >= 2 for 'improving'
    expect(analyzePerformanceTrend(analytics)).toBe('stable');
  });
});
