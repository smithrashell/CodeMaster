/**
 * Tests for escapeHatchUtils.js (67 lines, 0% coverage)
 */

jest.mock('../../leitner/Utils.js', () => ({
  calculateSuccessRate: jest.fn((s, t) => (t > 0 ? s / t : 0)),
  calculateFailedAttempts: jest.fn((s, t) => t - s),
}));

import {
  detectApplicableEscapeHatches,
  calculateAdjustedThreshold,
  updateEscapeHatchTracking,
  generateEscapeHatchMessages,
} from '../escapeHatchUtils.js';

describe('escapeHatchUtils', () => {
  describe('detectApplicableEscapeHatches', () => {
    it('detects session-based escape hatch after 10+ sessions', () => {
      const sessionState = {
        escapeHatches: { sessions_at_current_difficulty: 12 },
        current_difficulty_cap: 'Medium',
      };
      const result = detectApplicableEscapeHatches(sessionState, [], []);
      expect(result.sessionBased.applicable).toBe(true);
      expect(result.sessionBased.threshold).toBe(0.8);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('does not trigger session-based under 10 sessions', () => {
      const sessionState = { escapeHatches: { sessions_at_current_difficulty: 5 } };
      const result = detectApplicableEscapeHatches(sessionState, [], []);
      expect(result.sessionBased.applicable).toBe(false);
      expect(result.sessionBased.threshold).toBe(0.9);
    });

    it('detects attempt-based escape hatch for struggling tags', () => {
      const masteryData = [
        { tag: 'dp', totalAttempts: 25, successfulAttempts: 17 }, // 68% success, 8 failed
      ];
      // Actually we need 15+ failed attempts. 25-17=8, not enough
      const masteryData2 = [
        { tag: 'dp', totalAttempts: 50, successfulAttempts: 35 }, // 70%, 15 failed
      ];
      const sessionState = { escapeHatches: { sessions_at_current_difficulty: 0 } };
      const result = detectApplicableEscapeHatches(sessionState, masteryData2, ['dp']);
      expect(result.attemptBased).toHaveLength(1);
      expect(result.attemptBased[0].tag).toBe('dp');
    });

    it('detects time-based escape hatch for stagnant tags', () => {
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 20);
      const masteryData = [
        { tag: 'graph', totalAttempts: 20, successfulAttempts: 14, lastAttemptDate: twoWeeksAgo.toISOString() },
      ];
      const sessionState = { escapeHatches: { sessions_at_current_difficulty: 0 } };
      const result = detectApplicableEscapeHatches(sessionState, masteryData, ['graph']);
      expect(result.timeBased).toHaveLength(1);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('uses default escapeHatches when missing', () => {
      const result = detectApplicableEscapeHatches({}, [], []);
      expect(result.sessionBased.applicable).toBe(false);
    });

    it('skips tags not in tierTags', () => {
      const masteryData = [
        { tag: 'array', totalAttempts: 50, successfulAttempts: 35 },
      ];
      const sessionState = { escapeHatches: { sessions_at_current_difficulty: 0 } };
      const result = detectApplicableEscapeHatches(sessionState, masteryData, ['dp']); // array not in tier
      expect(result.attemptBased).toHaveLength(0);
    });
  });

  describe('calculateAdjustedThreshold', () => {
    it('returns 0.8 for difficulty when session-based is applicable', () => {
      const results = { sessionBased: { applicable: true }, attemptBased: [], timeBased: [] };
      expect(calculateAdjustedThreshold(results, 'difficulty')).toBe(0.8);
    });

    it('returns 0.9 for difficulty when session-based not applicable', () => {
      const results = { sessionBased: { applicable: false }, attemptBased: [], timeBased: [] };
      expect(calculateAdjustedThreshold(results, 'difficulty')).toBe(0.9);
    });

    it('returns adjusted threshold for attempt-based tag', () => {
      const results = {
        sessionBased: { applicable: false },
        attemptBased: [{ tag: 'dp', adjustedThreshold: 0.6 }],
        timeBased: [],
      };
      expect(calculateAdjustedThreshold(results, 'mastery', 'dp')).toBe(0.6);
    });

    it('returns adjusted threshold for time-based tag', () => {
      const results = {
        sessionBased: { applicable: false },
        attemptBased: [],
        timeBased: [{ tag: 'graph', adjustedThreshold: 0.6 }],
      };
      expect(calculateAdjustedThreshold(results, 'mastery', 'graph')).toBe(0.6);
    });

    it('returns default 0.8 for mastery without matching tag', () => {
      const results = { sessionBased: { applicable: false }, attemptBased: [], timeBased: [] };
      expect(calculateAdjustedThreshold(results, 'mastery', 'unknown')).toBe(0.8);
    });
  });

  describe('updateEscapeHatchTracking', () => {
    it('initializes escapeHatches if missing', () => {
      const state = {};
      const results = { sessionBased: { applicable: false }, attemptBased: [], timeBased: [] };
      updateEscapeHatchTracking(state, results);
      expect(state.escapeHatches).toBeDefined();
      expect(state.escapeHatches.activated_escape_hatches).toEqual([]);
    });

    it('tracks session-based activation', () => {
      const state = { escapeHatches: { activated_escape_hatches: [] } };
      const results = { sessionBased: { applicable: true }, attemptBased: [], timeBased: [] };
      updateEscapeHatchTracking(state, results);
      expect(state.escapeHatches.activated_escape_hatches).toContain('session-based');
    });

    it('tracks attempt-based activation', () => {
      const state = { escapeHatches: { activated_escape_hatches: [] } };
      const results = { sessionBased: { applicable: false }, attemptBased: [{ tag: 'dp' }], timeBased: [] };
      updateEscapeHatchTracking(state, results);
      expect(state.escapeHatches.activated_escape_hatches).toContain('attempt-based-dp');
    });

    it('tracks time-based activation', () => {
      const state = { escapeHatches: { activated_escape_hatches: [] } };
      const results = { sessionBased: { applicable: false }, attemptBased: [], timeBased: [{ tag: 'graph' }] };
      updateEscapeHatchTracking(state, results);
      expect(state.escapeHatches.activated_escape_hatches).toContain('time-based-graph');
    });

    it('does not duplicate activations', () => {
      const state = { escapeHatches: { activated_escape_hatches: ['session-based'] } };
      const results = { sessionBased: { applicable: true }, attemptBased: [], timeBased: [] };
      updateEscapeHatchTracking(state, results);
      expect(state.escapeHatches.activated_escape_hatches.filter(h => h === 'session-based')).toHaveLength(1);
    });
  });

  describe('generateEscapeHatchMessages', () => {
    it('generates messages from recommendations', () => {
      const results = {
        recommendations: [
          { type: 'session-based', message: 'Lowering threshold', impact: 'Reduced' },
        ],
      };
      const messages = generateEscapeHatchMessages(results);
      expect(messages).toHaveLength(1);
      expect(messages[0].title).toBe('Learning Assistance Activated');
    });

    it('returns empty for no recommendations', () => {
      expect(generateEscapeHatchMessages({ recommendations: [] })).toEqual([]);
    });
  });
});
