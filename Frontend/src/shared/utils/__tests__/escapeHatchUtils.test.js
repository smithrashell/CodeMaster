/**
 * Escape Hatch Utilities Tests
 * Tests the core escape hatch detection and activation logic
 */

import { 
  detectApplicableEscapeHatches, 
  calculateAdjustedThreshold,
  updateEscapeHatchTracking,
  generateEscapeHatchMessages 
} from '../escapeHatchUtils.js';

describe('Escape Hatch Utilities', () => {
  describe('detectApplicableEscapeHatches', () => {
    it('should detect session-based escape hatch after 10+ sessions', () => {
      const sessionState = {
        currentDifficultyCap: 'Easy',
        escapeHatches: {
          sessionsAtCurrentDifficulty: 12,
          lastDifficultyPromotion: null,
          sessionsWithoutPromotion: 12,
          activatedEscapeHatches: []
        }
      };
      const masteryData = [];
      const tierTags = ['array', 'hash-table'];

      const results = detectApplicableEscapeHatches(sessionState, masteryData, tierTags);

      expect(results.sessionBased.applicable).toBe(true);
      expect(results.sessionBased.threshold).toBe(0.8);
      expect(results.sessionBased.sessionsStuck).toBe(12);
      expect(results.recommendations).toHaveLength(1);
      expect(results.recommendations[0].type).toBe('session-based');
    });

    it('should detect attempt-based escape hatch after 15+ failed attempts', () => {
      const sessionState = { escapeHatches: { activatedEscapeHatches: [] } };
      const masteryData = [
        {
          tag: 'dynamic-programming',
          totalAttempts: 40,
          successfulAttempts: 24, // 60% success rate (16 failed attempts)
          lastAttemptDate: new Date().toISOString()
        }
      ];
      const tierTags = ['dynamic-programming'];

      const results = detectApplicableEscapeHatches(sessionState, masteryData, tierTags);

      expect(results.attemptBased).toHaveLength(1);
      expect(results.attemptBased[0].tag).toBe('dynamic-programming');
      expect(results.attemptBased[0].failedAttempts).toBe(16);
      expect(results.attemptBased[0].adjustedThreshold).toBe(0.6);
    });

    it('should detect time-based escape hatch after 2+ weeks without progress', () => {
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 16);

      const sessionState = { escapeHatches: { activatedEscapeHatches: [] } };
      const masteryData = [
        {
          tag: 'graph',
          totalAttempts: 10,
          successfulAttempts: 7, // 70% success rate
          lastAttemptDate: twoWeeksAgo.toISOString()
        }
      ];
      const tierTags = ['graph'];

      const results = detectApplicableEscapeHatches(sessionState, masteryData, tierTags);

      expect(results.timeBased).toHaveLength(1);
      expect(results.timeBased[0].tag).toBe('graph');
      expect(results.timeBased[0].adjustedThreshold).toBe(0.6);
      expect(results.timeBased[0].daysSinceLastAttempt).toBeGreaterThan(14);
    });

    it('should not activate escape hatches when conditions are not met', () => {
      const sessionState = {
        escapeHatches: {
          sessionsAtCurrentDifficulty: 5, // Less than 10
          activatedEscapeHatches: []
        }
      };
      const masteryData = [
        {
          tag: 'array',
          totalAttempts: 10,
          successfulAttempts: 9, // 90% success rate - already mastered
          lastAttemptDate: new Date().toISOString()
        }
      ];
      const tierTags = ['array'];

      const results = detectApplicableEscapeHatches(sessionState, masteryData, tierTags);

      expect(results.sessionBased.applicable).toBe(false);
      expect(results.attemptBased).toHaveLength(0);
      expect(results.timeBased).toHaveLength(0);
      expect(results.recommendations).toHaveLength(0);
    });
  });

  describe('calculateAdjustedThreshold', () => {
    it('should return reduced difficulty threshold when session-based escape hatch is active', () => {
      const escapeHatchResults = {
        sessionBased: { applicable: true, threshold: 0.8 },
        attemptBased: [],
        timeBased: []
      };

      const threshold = calculateAdjustedThreshold(escapeHatchResults, 'difficulty');
      expect(threshold).toBe(0.8);
    });

    it('should return reduced mastery threshold for attempt-based escape hatch', () => {
      const escapeHatchResults = {
        sessionBased: { applicable: false },
        attemptBased: [
          { tag: 'dynamic-programming', adjustedThreshold: 0.6 }
        ],
        timeBased: []
      };

      const threshold = calculateAdjustedThreshold(escapeHatchResults, 'mastery', 'dynamic-programming');
      expect(threshold).toBe(0.6);
    });

    it('should return default thresholds when no escape hatches are active', () => {
      const escapeHatchResults = {
        sessionBased: { applicable: false },
        attemptBased: [],
        timeBased: []
      };

      expect(calculateAdjustedThreshold(escapeHatchResults, 'difficulty')).toBe(0.9);
      expect(calculateAdjustedThreshold(escapeHatchResults, 'mastery', 'array')).toBe(0.8);
    });
  });

  describe('updateEscapeHatchTracking', () => {
    it('should track newly activated escape hatches', () => {
      const sessionState = {
        escapeHatches: {
          activatedEscapeHatches: []
        }
      };
      const escapeHatchResults = {
        sessionBased: { applicable: true },
        attemptBased: [{ tag: 'graph' }],
        timeBased: [{ tag: 'tree' }]
      };

      const updatedState = updateEscapeHatchTracking(sessionState, escapeHatchResults);

      expect(updatedState.escapeHatches.activatedEscapeHatches).toContain('session-based');
      expect(updatedState.escapeHatches.activatedEscapeHatches).toContain('attempt-based-graph');
      expect(updatedState.escapeHatches.activatedEscapeHatches).toContain('time-based-tree');
    });

    it('should not duplicate escape hatch tracking entries', () => {
      const sessionState = {
        escapeHatches: {
          activatedEscapeHatches: ['session-based', 'attempt-based-graph']
        }
      };
      const escapeHatchResults = {
        sessionBased: { applicable: true },
        attemptBased: [{ tag: 'graph' }],
        timeBased: []
      };

      const updatedState = updateEscapeHatchTracking(sessionState, escapeHatchResults);
      const activatedCount = updatedState.escapeHatches.activatedEscapeHatches.filter(h => h === 'session-based').length;

      expect(activatedCount).toBe(1); // Should not duplicate
    });
  });

  describe('generateEscapeHatchMessages', () => {
    it('should generate user-friendly messages for all active escape hatches', () => {
      const escapeHatchResults = {
        recommendations: [
          {
            type: 'session-based',
            message: 'Session-based escape hatch activated',
            impact: 'Difficulty threshold reduced'
          },
          {
            type: 'attempt-based',
            message: 'Attempt-based escape hatch activated for dynamic-programming',
            impact: 'Tag mastery threshold reduced'
          }
        ]
      };

      const messages = generateEscapeHatchMessages(escapeHatchResults);

      expect(messages).toHaveLength(2);
      expect(messages[0].type).toBe('session-based');
      expect(messages[0].level).toBe('info');
      expect(messages[0].title).toBe('Learning Assistance Activated');
      expect(messages[1].type).toBe('attempt-based');
    });

    it('should return empty array when no escape hatches are active', () => {
      const escapeHatchResults = { recommendations: [] };
      const messages = generateEscapeHatchMessages(escapeHatchResults);
      expect(messages).toHaveLength(0);
    });
  });
});