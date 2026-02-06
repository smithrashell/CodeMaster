/**
 * Tests for Session Balancing Guard Rails
 *
 * Tests Guard Rail 4 (poor performance protection) and backward compatibility
 * with existing guard rails 1-3.
 */

import { applySafetyGuardRails } from '../session/sessionBalancing.js';

// Mock logger to suppress console output during tests
jest.mock('../logging/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Session Balancing - Guard Rails', () => {
  // Helper to create mock problems with specified difficulty distribution
  const createProblems = (easy, medium, hard) => [
    ...Array(easy).fill(null).map((_, i) => ({
      id: i + 1,
      difficulty: 'Easy',
      title: `Easy Problem ${i + 1}`
    })),
    ...Array(medium).fill(null).map((_, i) => ({
      id: easy + i + 1,
      difficulty: 'Medium',
      title: `Medium Problem ${i + 1}`
    })),
    ...Array(hard).fill(null).map((_, i) => ({
      id: easy + medium + i + 1,
      difficulty: 'Hard',
      title: `Hard Problem ${i + 1}`
    }))
  ];

  describe('Guard Rail 4: Poor Performance Protection', () => {
    const stagnationPromotion = 'stagnation_escape_hatch';
    const standardPromotion = 'standard_volume_gate';
    const poorPerformance = { accuracy: 0.40, sessionsAnalyzed: 3 };
    const goodPerformance = { accuracy: 0.60, sessionsAnalyzed: 3 };

    it('triggers when all conditions met: Hard cap, stagnation, poor accuracy, multiple Hard', () => {
      const problems = createProblems(2, 2, 3); // 3 Hard problems
      const result = applySafetyGuardRails(problems, 'Hard', 5, poorPerformance, stagnationPromotion);

      expect(result.needsRebalance).toBe(true);
      expect(result.guardRailType).toBe('poor_performance_protection');
      expect(result.excessHard).toBe(2); // 3 - 1 = 2 excess
      expect(result.replacementDifficulty).toBe('Medium');
    });

    it('does NOT trigger when accuracy >= 50%', () => {
      const problems = createProblems(2, 2, 3);
      const result = applySafetyGuardRails(problems, 'Hard', 5, goodPerformance, stagnationPromotion);

      expect(result.needsRebalance).toBe(false);
    });

    it('does NOT trigger for standard_volume_gate promotion', () => {
      const problems = createProblems(2, 2, 3);
      const result = applySafetyGuardRails(problems, 'Hard', 5, poorPerformance, standardPromotion);

      expect(result.needsRebalance).toBe(false);
    });

    it('does NOT trigger Guard Rail 4 when Hard count is 1 or less', () => {
      // Note: With Hard count = 1, Guard Rail 2 may trigger (minimum 2 Hard for Hard cap)
      // This test verifies Guard Rail 4 specifically does not trigger
      const problems = createProblems(4, 2, 1); // Only 1 Hard
      const result = applySafetyGuardRails(problems, 'Hard', 5, poorPerformance, stagnationPromotion);

      // Guard Rail 4 should not trigger (it requires Hard > 1)
      // Guard Rail 2 may trigger instead (requiring minimum 2 Hard)
      expect(result.guardRailType).not.toBe('poor_performance_protection');
    });

    it('does NOT trigger when recentPerformance is null', () => {
      const problems = createProblems(2, 2, 3);
      const result = applySafetyGuardRails(problems, 'Hard', 5, null, stagnationPromotion);

      expect(result.needsRebalance).toBe(false);
    });

    it('does NOT trigger when difficulty cap is Medium', () => {
      const problems = createProblems(2, 2, 3);
      const result = applySafetyGuardRails(problems, 'Medium', 5, poorPerformance, stagnationPromotion);

      // May trigger other guard rails but not Guard Rail 4
      expect(result.guardRailType).not.toBe('poor_performance_protection');
    });

    it('does NOT trigger when difficulty cap is Easy', () => {
      const problems = createProblems(2, 2, 3);
      const result = applySafetyGuardRails(problems, 'Easy', 5, poorPerformance, stagnationPromotion);

      // Should not trigger Guard Rail 4 at Easy cap
      expect(result.guardRailType).not.toBe('poor_performance_protection');
    });

    it('handles boundary: exactly 50% accuracy does NOT trigger', () => {
      const problems = createProblems(2, 2, 3);
      const boundaryPerformance = { accuracy: 0.50, sessionsAnalyzed: 3 };
      const result = applySafetyGuardRails(problems, 'Hard', 5, boundaryPerformance, stagnationPromotion);

      // 50% is the threshold, so exactly 50% should NOT trigger
      expect(result.guardRailType).not.toBe('poor_performance_protection');
    });

    it('handles boundary: 49% accuracy triggers', () => {
      const problems = createProblems(2, 2, 3);
      const boundaryPerformance = { accuracy: 0.49, sessionsAnalyzed: 3 };
      const result = applySafetyGuardRails(problems, 'Hard', 5, boundaryPerformance, stagnationPromotion);

      expect(result.needsRebalance).toBe(true);
      expect(result.guardRailType).toBe('poor_performance_protection');
    });

    it('returns correct excessHard count for various Hard counts', () => {
      // Test with 4 Hard problems - should have 3 excess (4 - 1)
      const problems4Hard = createProblems(2, 1, 4);
      const result4 = applySafetyGuardRails(problems4Hard, 'Hard', 5, poorPerformance, stagnationPromotion);
      expect(result4.excessHard).toBe(3);

      // Test with 2 Hard problems - should have 1 excess (2 - 1)
      const problems2Hard = createProblems(3, 2, 2);
      const result2 = applySafetyGuardRails(problems2Hard, 'Hard', 5, poorPerformance, stagnationPromotion);
      expect(result2.excessHard).toBe(1);
    });

    it('does not trigger with null promotion type', () => {
      const problems = createProblems(2, 2, 3);
      const result = applySafetyGuardRails(problems, 'Hard', 5, poorPerformance, null);

      expect(result.needsRebalance).toBe(false);
    });

    it('does not trigger with undefined promotion type', () => {
      const problems = createProblems(2, 2, 3);
      const result = applySafetyGuardRails(problems, 'Hard', 5, poorPerformance, undefined);

      expect(result.needsRebalance).toBe(false);
    });
  });

  // Existing guard rails should still work
  describe('Guard Rails 1-3 backward compatibility', () => {
    describe('Guard Rail 1: Medium cap minimum Medium problems', () => {
      it('triggers when Medium cap but only 1 Medium problem (session >= 4)', () => {
        const problems = createProblems(5, 1, 0); // Only 1 Medium at Medium cap
        const result = applySafetyGuardRails(problems, 'Medium', 5, null, null);

        expect(result.needsRebalance).toBe(true);
        expect(result.target.Medium).toBe(2);
      });

      it('does NOT trigger when enough Medium problems exist', () => {
        const problems = createProblems(3, 3, 0); // 3 Medium problems
        const result = applySafetyGuardRails(problems, 'Medium', 5, null, null);

        expect(result.needsRebalance).toBe(false);
      });

      it('does NOT trigger when Medium count is 0 (handles case of no Medium problems gracefully)', () => {
        const problems = createProblems(6, 0, 0); // No Medium problems
        const result = applySafetyGuardRails(problems, 'Medium', 5, null, null);

        // Guard rail only triggers when Medium > 0 but < minMedium
        expect(result.needsRebalance).toBe(false);
      });

      it('does NOT trigger when session length is small (< 4)', () => {
        const problems = createProblems(2, 1, 0); // Small session
        const result = applySafetyGuardRails(problems, 'Medium', 5, null, null);

        expect(result.needsRebalance).toBe(false);
      });
    });

    describe('Guard Rail 2: Hard cap minimum Hard problems', () => {
      it('triggers when Hard cap but only 1 Hard problem (session >= 5)', () => {
        const problems = createProblems(3, 2, 1); // Only 1 Hard at Hard cap
        const result = applySafetyGuardRails(problems, 'Hard', 5, null, null);

        expect(result.needsRebalance).toBe(true);
        expect(result.target.Hard).toBe(2);
      });

      it('does NOT trigger when enough Hard problems exist', () => {
        const problems = createProblems(2, 2, 3); // 3 Hard problems
        const result = applySafetyGuardRails(problems, 'Hard', 5, null, null);

        expect(result.needsRebalance).toBe(false);
      });

      it('does NOT trigger when Hard count is 0', () => {
        const problems = createProblems(3, 3, 0); // No Hard problems
        const result = applySafetyGuardRails(problems, 'Hard', 5, null, null);

        // Guard rail only triggers when Hard > 0 but < minHard
        expect(result.needsRebalance).toBe(false);
      });
    });

    describe('Guard Rail 3: First sessions at new difficulty', () => {
      it('triggers when first session at Medium cap with insufficient Medium problems', () => {
        const problems = createProblems(4, 1, 0); // Only 1 Medium
        const result = applySafetyGuardRails(problems, 'Medium', 0, null, null); // sessionsAtCurrentDifficulty = 0

        expect(result.needsRebalance).toBe(true);
        expect(result.target.Medium).toBe(2);
      });

      it('triggers when first session at Hard cap with insufficient Hard problems', () => {
        const problems = createProblems(3, 2, 1); // Only 1 Hard
        const result = applySafetyGuardRails(problems, 'Hard', 0, null, null); // sessionsAtCurrentDifficulty = 0

        expect(result.needsRebalance).toBe(true);
        expect(result.target.Hard).toBe(2);
      });

      it('does NOT trigger at Easy cap (even for first session)', () => {
        const problems = createProblems(5, 0, 0);
        const result = applySafetyGuardRails(problems, 'Easy', 0, null, null);

        expect(result.needsRebalance).toBe(false);
      });

      it('does NOT trigger after 2+ sessions at current difficulty', () => {
        const problems = createProblems(4, 1, 0);
        const result = applySafetyGuardRails(problems, 'Medium', 2, null, null); // sessionsAtCurrentDifficulty = 2

        // Guard rail 3 doesn't apply, but guard rail 1 might
        // With 1 Medium and Medium cap at session length 5, guard rail 1 applies
        // This test just verifies guard rail 3 logic (sessionsAtCurrentDifficulty >= 2)
        expect(result.message).not.toContain('First session');
      });
    });
  });
});
