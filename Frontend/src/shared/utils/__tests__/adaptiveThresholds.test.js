/**
 * Adaptive Thresholds Tests
 * Tests the progressive threshold softening system
 */

import {
  calculateAdaptiveThresholds,
  updateStruggleHistory,
  generateAdaptationMessages,
  resetStruggleHistory,
} from "../adaptiveThresholds.js";

describe("Adaptive Thresholds System", () => {
  describe("calculateAdaptiveThresholds", () => {
    describe("difficulty context", () => {
      it("should maintain original thresholds with no struggle history", () => {
        const baseThresholds = { promotionAccuracy: 0.9 };
        const result = calculateAdaptiveThresholds(
          baseThresholds,
          {},
          "difficulty"
        );

        expect(result.adjusted.promotionAccuracy).toBe(0.9);
        expect(result.adaptations).toHaveLength(0);
        expect(result.reason).toBe("No adaptations needed");
      });

      it("should reduce threshold to 80% after 10+ sessions", () => {
        const baseThresholds = { promotionAccuracy: 0.9 };
        const struggleHistory = { sessionsAtCurrentLevel: 12 };

        const result = calculateAdaptiveThresholds(
          baseThresholds,
          struggleHistory,
          "difficulty"
        );

        expect(result.adjusted.promotionAccuracy).toBe(0.8);
        expect(result.adaptations).toContain(
          "Moderate struggle: 80% accuracy threshold"
        );
        expect(result.reason).toContain("12 sessions without promotion");
      });

      it("should reduce threshold to 75% after 15+ sessions", () => {
        const baseThresholds = { promotionAccuracy: 0.9 };
        const struggleHistory = { sessionsAtCurrentLevel: 18 };

        const result = calculateAdaptiveThresholds(
          baseThresholds,
          struggleHistory,
          "difficulty"
        );

        expect(result.adjusted.promotionAccuracy).toBe(0.75);
        expect(result.adaptations).toContain(
          "Heavy struggle: 75% accuracy threshold"
        );
      });
    });

    describe("mastery context", () => {
      it("should apply progressive mastery threshold reductions", () => {
        const baseThresholds = { masteryThreshold: 0.8 };
        const struggleHistory = {
          totalAttempts: 10,
          consecutiveStruggles: 0,
          daysWithoutProgress: 0,
        };

        const result = calculateAdaptiveThresholds(
          baseThresholds,
          struggleHistory,
          "mastery"
        );

        expect(result.adjusted.masteryThreshold).toBe(0.75); // Light struggle
        expect(result.adaptations).toContain(
          "Light struggle: 75% mastery threshold"
        );
      });

      it("should apply time-based threshold reduction after 14+ days", () => {
        const baseThresholds = { masteryThreshold: 0.8 };
        const struggleHistory = {
          totalAttempts: 5,
          consecutiveStruggles: 0,
          daysWithoutProgress: 16,
        };

        const result = calculateAdaptiveThresholds(
          baseThresholds,
          struggleHistory,
          "mastery"
        );

        expect(result.adjusted.masteryThreshold).toBe(0.7); // Time-based reduction
        expect(result.adaptations).toContain(
          "Time-based: 70% threshold after 2+ weeks"
        );
      });

      it("should apply extreme struggle threshold after heavy attempts", () => {
        const baseThresholds = { masteryThreshold: 0.8 };
        const struggleHistory = {
          totalAttempts: 25,
          consecutiveStruggles: 10,
          daysWithoutProgress: 5,
        };

        const result = calculateAdaptiveThresholds(
          baseThresholds,
          struggleHistory,
          "mastery"
        );

        expect(result.adjusted.masteryThreshold).toBe(0.65); // Extreme struggle
        expect(result.adaptations).toContain(
          "Extreme struggle: 65% mastery threshold"
        );
      });
    });

    describe("expansion context", () => {
      it("should maintain original thresholds with minimal stagnation", () => {
        const baseThresholds = {
          accuracyThreshold: 0.75,
          efficiencyThreshold: 0.6,
        };
        const struggleHistory = { sessionsAtSameTagCount: 2 };

        const result = calculateAdaptiveThresholds(
          baseThresholds,
          struggleHistory,
          "expansion"
        );

        expect(result.adjusted.accuracyThreshold).toBe(0.75);
        expect(result.adjusted.efficiencyThreshold).toBe(0.6);
        expect(result.adaptations).toHaveLength(0);
      });

      it("should reduce thresholds after 5+ sessions at same tag count", () => {
        const baseThresholds = {
          accuracyThreshold: 0.75,
          efficiencyThreshold: 0.6,
        };
        const struggleHistory = { sessionsAtSameTagCount: 6 };

        const result = calculateAdaptiveThresholds(
          baseThresholds,
          struggleHistory,
          "expansion"
        );

        expect(result.adjusted.accuracyThreshold).toBe(0.65);
        expect(result.adjusted.efficiencyThreshold).toBe(0.5);
        expect(result.adaptations).toContain(
          "Expansion struggle: 65% accuracy OR 50% efficiency"
        );
      });

      it("should apply stagnation thresholds after 8+ sessions", () => {
        const baseThresholds = {
          accuracyThreshold: 0.75,
          efficiencyThreshold: 0.6,
        };
        const struggleHistory = { sessionsAtSameTagCount: 10 };

        const result = calculateAdaptiveThresholds(
          baseThresholds,
          struggleHistory,
          "expansion"
        );

        expect(result.adjusted.accuracyThreshold).toBe(0.6);
        expect(result.adjusted.efficiencyThreshold).toBe(0.4);
        expect(result.adaptations).toContain(
          "Expansion stagnation: 60% accuracy OR 40% efficiency"
        );
      });
    });
  });

  describe("updateStruggleHistory", () => {
    describe("difficulty struggle tracking", () => {
      it("should track sessions at current level", () => {
        const history = {};
        const performanceData = { promoted: false, sessionsAtLevel: 5 };

        const updated = updateStruggleHistory(
          history,
          performanceData,
          "difficulty"
        );

        expect(updated.sessionsAtCurrentLevel).toBe(5);
        expect(updated.consecutiveFailedPromotions).toBe(1);
        expect(updated.firstStruggleDate).toBeDefined();
      });

      it("should reset consecutive failures on promotion", () => {
        const history = { consecutiveFailedPromotions: 3 };
        const performanceData = { promoted: true, sessionsAtLevel: 8 };

        const updated = updateStruggleHistory(
          history,
          performanceData,
          "difficulty"
        );

        expect(updated.consecutiveFailedPromotions).toBe(0);
        expect(updated.lastPromotionDate).toBeDefined();
      });
    });

    describe("mastery struggle tracking", () => {
      it("should track consecutive struggles", () => {
        const history = {};
        const performanceData = {
          mastered: false,
          attempts: 5,
          success: false,
        };

        const updated = updateStruggleHistory(
          history,
          performanceData,
          "mastery"
        );

        expect(updated.totalAttempts).toBe(5);
        expect(updated.consecutiveStruggles).toBe(1);
      });

      it("should reset struggles on mastery achievement", () => {
        const history = { consecutiveStruggles: 4 };
        const performanceData = { mastered: true, attempts: 8, success: true };

        const updated = updateStruggleHistory(
          history,
          performanceData,
          "mastery"
        );

        expect(updated.consecutiveStruggles).toBe(0);
        expect(updated.lastMasteryDate).toBeDefined();
      });
    });

    describe("expansion struggle tracking", () => {
      it("should track sessions at same tag count", () => {
        const history = { sessionsAtSameTagCount: 2 };
        const performanceData = {
          expanded: false,
          tagCount: 3,
          previousTagCount: 3,
        };

        const updated = updateStruggleHistory(
          history,
          performanceData,
          "expansion"
        );

        expect(updated.sessionsAtSameTagCount).toBe(3);
        expect(updated.expansionFailures).toBe(1);
      });

      it("should reset count on successful expansion", () => {
        const history = { sessionsAtSameTagCount: 5 };
        const performanceData = {
          expanded: true,
          tagCount: 4,
          previousTagCount: 3,
        };

        const updated = updateStruggleHistory(
          history,
          performanceData,
          "expansion"
        );

        expect(updated.sessionsAtSameTagCount).toBe(0);
        expect(updated.lastExpansionDate).toBeDefined();
      });
    });
  });

  describe("generateAdaptationMessages", () => {
    it("should return empty array when no adaptations", () => {
      const adaptiveThresholds = {
        adaptations: [],
        reason: "No adaptations needed",
      };
      const messages = generateAdaptationMessages(adaptiveThresholds);

      expect(messages).toHaveLength(0);
    });

    it("should generate user-friendly messages for adaptations", () => {
      const adaptiveThresholds = {
        adaptations: [
          "Heavy struggle: 75% accuracy threshold",
          "Time-based: 70% threshold",
        ],
        reason: "15 sessions without promotion",
      };

      const messages = generateAdaptationMessages(adaptiveThresholds);

      expect(messages).toHaveLength(2);
      expect(messages[0].type).toBe("adaptive-threshold");
      expect(messages[0].title).toBe("Learning Assistance Activated");
      expect(messages[0].message).toContain(
        "Heavy struggle: 75% accuracy threshold"
      );
      expect(messages[0].reason).toBe("15 sessions without promotion");
    });
  });

  describe("resetStruggleHistory", () => {
    it("should preserve history while clearing struggle counters", () => {
      const history = {
        consecutiveFailedPromotions: 5,
        consecutiveStruggles: 3,
        sessionsAtCurrentLevel: 12,
        firstStruggleDate: "2025-01-01T00:00:00.000Z",
        lastPromotionDate: "2025-01-15T00:00:00.000Z",
      };

      const reset = resetStruggleHistory(history, "tier_advancement");

      expect(reset.consecutiveFailedPromotions).toBeUndefined();
      expect(reset.consecutiveStruggles).toBeUndefined();
      expect(reset.sessionsAtCurrentLevel).toBeUndefined();
      expect(reset.firstStruggleDate).toBe("2025-01-01T00:00:00.000Z"); // Preserved
      expect(reset.lastPromotionDate).toBe("2025-01-15T00:00:00.000Z"); // Preserved
      expect(reset.resetDate).toBeDefined();
      expect(reset.resetReason).toBe("tier_advancement");
      expect(reset.previousStruggles).toEqual(history);
    });
  });
});
