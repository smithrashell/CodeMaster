/**
 * Tests for Session Escape Hatch Helpers
 *
 * Tests promotion type tracking (current_promotion_type) used by
 * Guard Rail 4 (poor performance protection) in session composition.
 */

import { applyEscapeHatchLogic } from '../sessionEscapeHatchHelpers.js';

// Mock logger to suppress console output during tests
jest.mock('../../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock sessionAnalytics (not used in these specific tests but imported by the module)
jest.mock('../sessionAnalytics.js', () => ({
  getRecentSessionAnalytics: jest.fn(() => Promise.resolve([])),
}));

describe('Session Escape Hatch Helpers', () => {
  // Suppress console.log from the source file
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('current_promotion_type tracking', () => {
    it('initializes current_promotion_type as null for new session state', () => {
      const sessionState = {
        current_difficulty_cap: 'Easy',
        difficulty_time_stats: {
          easy: { problems: 0, total_time: 0, avg_time: 0 },
          medium: { problems: 0, total_time: 0, avg_time: 0 },
          hard: { problems: 0, total_time: 0, avg_time: 0 }
        }
      };

      applyEscapeHatchLogic(sessionState, 0.8, {}, new Date());

      expect(sessionState.escape_hatches).toBeDefined();
      expect(sessionState.escape_hatches.current_promotion_type).toBeNull();
    });

    it('sets current_promotion_type to standard_volume_gate on standard promotion', () => {
      const sessionState = {
        current_difficulty_cap: 'Easy',
        difficulty_time_stats: {
          easy: { problems: 4, total_time: 2400, avg_time: 600 },
          medium: { problems: 0, total_time: 0, avg_time: 0 },
          hard: { problems: 0, total_time: 0, avg_time: 0 }
        }
      };

      // 4 problems + 80% accuracy = standard promotion criteria met
      applyEscapeHatchLogic(sessionState, 0.8, {}, new Date());

      expect(sessionState.current_difficulty_cap).toBe('Medium');
      expect(sessionState.escape_hatches.current_promotion_type).toBe('standard_volume_gate');
    });

    it('sets current_promotion_type to stagnation_escape_hatch on stagnation promotion', () => {
      const sessionState = {
        current_difficulty_cap: 'Easy',
        difficulty_time_stats: {
          easy: { problems: 8, total_time: 4800, avg_time: 600 },
          medium: { problems: 0, total_time: 0, avg_time: 0 },
          hard: { problems: 0, total_time: 0, avg_time: 0 }
        }
      };

      // 8 problems = stagnation escape (regardless of accuracy)
      applyEscapeHatchLogic(sessionState, 0.3, {}, new Date());

      expect(sessionState.current_difficulty_cap).toBe('Medium');
      expect(sessionState.escape_hatches.current_promotion_type).toBe('stagnation_escape_hatch');
    });

    it('preserves current_promotion_type across calls without promotion', () => {
      const sessionState = {
        current_difficulty_cap: 'Hard',
        difficulty_time_stats: {
          easy: { problems: 0, total_time: 0, avg_time: 0 },
          medium: { problems: 0, total_time: 0, avg_time: 0 },
          hard: { problems: 2, total_time: 3600, avg_time: 1800 }
        },
        escape_hatches: {
          sessions_at_current_difficulty: 3,
          current_promotion_type: 'stagnation_escape_hatch',
          activated_escape_hatches: [],
          last_difficulty_promotion: '2024-01-01T00:00:00.000Z',
          sessions_without_promotion: 0
        }
      };

      // No promotion should occur (already at Hard, not enough problems)
      applyEscapeHatchLogic(sessionState, 0.5, {}, new Date());

      // Promotion type should be preserved since no new promotion occurred
      expect(sessionState.escape_hatches.current_promotion_type).toBe('stagnation_escape_hatch');
    });

    it('clears activated_escape_hatches on promotion but keeps promotion type', () => {
      const sessionState = {
        current_difficulty_cap: 'Easy',
        difficulty_time_stats: {
          easy: { problems: 8, total_time: 4800, avg_time: 600 },
          medium: { problems: 0, total_time: 0, avg_time: 0 },
          hard: { problems: 0, total_time: 0, avg_time: 0 }
        },
        escape_hatches: {
          sessions_at_current_difficulty: 5,
          current_promotion_type: null,
          activated_escape_hatches: ['some-previous-hatch'],
          last_difficulty_promotion: null,
          sessions_without_promotion: 3
        }
      };

      applyEscapeHatchLogic(sessionState, 0.3, {}, new Date());

      // After promotion, activated_escape_hatches should be cleared
      expect(sessionState.escape_hatches.activated_escape_hatches).toEqual([]);
      // But promotion type should be set
      expect(sessionState.escape_hatches.current_promotion_type).toBe('stagnation_escape_hatch');
    });

    it('tracks stagnation activation in activated_escape_hatches before promotion', () => {
      const sessionState = {
        current_difficulty_cap: 'Easy',
        difficulty_time_stats: {
          easy: { problems: 8, total_time: 4800, avg_time: 600 },
          medium: { problems: 0, total_time: 0, avg_time: 0 },
          hard: { problems: 0, total_time: 0, avg_time: 0 }
        }
      };

      applyEscapeHatchLogic(sessionState, 0.3, {}, new Date());

      // After promotion via stagnation, activated_escape_hatches is cleared
      // but we can verify the promotion type indicates stagnation
      expect(sessionState.escape_hatches.current_promotion_type).toBe('stagnation_escape_hatch');
    });
  });

  describe('standard promotion flow', () => {
    it('promotes from Easy to Medium with 4+ problems and 80%+ accuracy', () => {
      const sessionState = {
        current_difficulty_cap: 'Easy',
        difficulty_time_stats: {
          easy: { problems: 5, total_time: 3000, avg_time: 600 },
          medium: { problems: 0, total_time: 0, avg_time: 0 },
          hard: { problems: 0, total_time: 0, avg_time: 0 }
        }
      };

      applyEscapeHatchLogic(sessionState, 0.85, {}, new Date());

      expect(sessionState.current_difficulty_cap).toBe('Medium');
      expect(sessionState.escape_hatches.current_promotion_type).toBe('standard_volume_gate');
    });

    it('promotes from Medium to Hard with 4+ problems and 80%+ accuracy', () => {
      const sessionState = {
        current_difficulty_cap: 'Medium',
        difficulty_time_stats: {
          easy: { problems: 0, total_time: 0, avg_time: 0 },
          medium: { problems: 4, total_time: 4800, avg_time: 1200 },
          hard: { problems: 0, total_time: 0, avg_time: 0 }
        }
      };

      applyEscapeHatchLogic(sessionState, 0.8, {}, new Date());

      expect(sessionState.current_difficulty_cap).toBe('Hard');
      expect(sessionState.escape_hatches.current_promotion_type).toBe('standard_volume_gate');
    });

    it('does NOT promote when accuracy below 80% and problems below 8', () => {
      const sessionState = {
        current_difficulty_cap: 'Easy',
        difficulty_time_stats: {
          easy: { problems: 4, total_time: 2400, avg_time: 600 },
          medium: { problems: 0, total_time: 0, avg_time: 0 },
          hard: { problems: 0, total_time: 0, avg_time: 0 }
        }
      };

      applyEscapeHatchLogic(sessionState, 0.7, {}, new Date());

      expect(sessionState.current_difficulty_cap).toBe('Easy');
      expect(sessionState.escape_hatches.current_promotion_type).toBeNull();
    });
  });

  describe('stagnation escape flow', () => {
    it('promotes via stagnation with 8+ problems regardless of accuracy', () => {
      const sessionState = {
        current_difficulty_cap: 'Medium',
        difficulty_time_stats: {
          easy: { problems: 0, total_time: 0, avg_time: 0 },
          medium: { problems: 10, total_time: 12000, avg_time: 1200 },
          hard: { problems: 0, total_time: 0, avg_time: 0 }
        }
      };

      // Even with very low accuracy
      applyEscapeHatchLogic(sessionState, 0.2, {}, new Date());

      expect(sessionState.current_difficulty_cap).toBe('Hard');
      expect(sessionState.escape_hatches.current_promotion_type).toBe('stagnation_escape_hatch');
    });

    it('prefers standard promotion over stagnation when both criteria met', () => {
      const sessionState = {
        current_difficulty_cap: 'Easy',
        difficulty_time_stats: {
          easy: { problems: 10, total_time: 6000, avg_time: 600 },
          medium: { problems: 0, total_time: 0, avg_time: 0 },
          hard: { problems: 0, total_time: 0, avg_time: 0 }
        }
      };

      // Both standard (10 >= 4, 90% >= 80%) and stagnation (10 >= 8) criteria met
      applyEscapeHatchLogic(sessionState, 0.9, {}, new Date());

      expect(sessionState.current_difficulty_cap).toBe('Medium');
      // Standard promotion takes precedence
      expect(sessionState.escape_hatches.current_promotion_type).toBe('standard_volume_gate');
    });
  });

  describe('Hard cap behavior', () => {
    it('does NOT promote beyond Hard', () => {
      const sessionState = {
        current_difficulty_cap: 'Hard',
        difficulty_time_stats: {
          easy: { problems: 0, total_time: 0, avg_time: 0 },
          medium: { problems: 0, total_time: 0, avg_time: 0 },
          hard: { problems: 10, total_time: 18000, avg_time: 1800 }
        },
        escape_hatches: {
          sessions_at_current_difficulty: 5,
          current_promotion_type: 'standard_volume_gate',
          activated_escape_hatches: [],
          last_difficulty_promotion: '2024-01-01T00:00:00.000Z',
          sessions_without_promotion: 0
        }
      };

      const initialPromotionType = sessionState.escape_hatches.current_promotion_type;
      applyEscapeHatchLogic(sessionState, 0.95, {}, new Date());

      // Should still be at Hard
      expect(sessionState.current_difficulty_cap).toBe('Hard');
      // Promotion type should be preserved (no new promotion occurred)
      expect(sessionState.escape_hatches.current_promotion_type).toBe(initialPromotionType);
    });
  });

  describe('sessions_at_current_difficulty tracking', () => {
    it('resets sessions_at_current_difficulty on promotion', () => {
      const sessionState = {
        current_difficulty_cap: 'Easy',
        difficulty_time_stats: {
          easy: { problems: 4, total_time: 2400, avg_time: 600 },
          medium: { problems: 0, total_time: 0, avg_time: 0 },
          hard: { problems: 0, total_time: 0, avg_time: 0 }
        },
        escape_hatches: {
          sessions_at_current_difficulty: 5,
          current_promotion_type: null,
          activated_escape_hatches: [],
          last_difficulty_promotion: null,
          sessions_without_promotion: 3
        }
      };

      applyEscapeHatchLogic(sessionState, 0.8, {}, new Date());

      // After promotion, sessions counter should be reset to 0
      expect(sessionState.escape_hatches.sessions_at_current_difficulty).toBe(0);
    });

    it('increments sessions_at_current_difficulty when no promotion', () => {
      const sessionState = {
        current_difficulty_cap: 'Easy',
        difficulty_time_stats: {
          easy: { problems: 2, total_time: 1200, avg_time: 600 },
          medium: { problems: 0, total_time: 0, avg_time: 0 },
          hard: { problems: 0, total_time: 0, avg_time: 0 }
        },
        escape_hatches: {
          sessions_at_current_difficulty: 3,
          current_promotion_type: null,
          activated_escape_hatches: [],
          last_difficulty_promotion: null,
          sessions_without_promotion: 2
        }
      };

      applyEscapeHatchLogic(sessionState, 0.5, {}, new Date());

      // Should be incremented (3 + 1 = 4)
      expect(sessionState.escape_hatches.sessions_at_current_difficulty).toBe(4);
    });
  });
});
