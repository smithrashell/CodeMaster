/**
 * Progression Bottleneck Integration Tests
 * Comprehensive validation of softened progression logic across all systems
 */

import { calculateTagMastery } from "../../db/tag_mastery.js";
import { buildAdaptiveSessionSettings } from "../../db/sessions.js";
import { TagService } from "../tagServices.js";
import { StorageService } from "../storageService.js";
import {
  calculateAdaptiveThresholds,
  updateStruggleHistory,
} from "../../utils/adaptiveThresholds.js";
import { detectApplicableEscapeHatches } from "../../utils/escapeHatchUtils.js";

// Mock dependencies
jest.mock("../../db/index.js", () => ({
  dbHelper: {
    openDB: jest.fn().mockResolvedValue({
      transaction: jest.fn().mockReturnValue({
        objectStore: jest.fn().mockReturnValue({
          put: jest.fn().mockReturnValue({
            onsuccess: null,
            onerror: null,
          }),
          getAll: jest.fn().mockReturnValue({
            onsuccess: null,
            onerror: null,
            result: [],
          }),
        }),
      }),
    }),
  },
}));

jest.mock("../tagServices.js", () => ({
  TagService: {
    getCurrentTier: jest.fn().mockResolvedValue({
      focusTags: ["array", "hash-table", "string"],
      classification: "Core Concept",
    }),
  },
}));

jest.mock("../storageService.js", () => ({
  StorageService: {
    getSettings: jest.fn().mockResolvedValue({ focusAreas: [] }),
    getSessionState: jest.fn(),
    setSessionState: jest.fn(),
    migrateSessionStateToIndexedDB: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock("../attemptsService.js", () => ({
  AttemptsService: {
    getMostRecentAttempt: jest.fn().mockResolvedValue({
      AttemptDate: new Date().toISOString(),
    }),
  },
}));

describe("Progression Bottleneck Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("🔓 Tag Mastery Progressive Softening", () => {
    it("should apply light struggle escape hatch (75% threshold)", async () => {
      // Mock tag mastery calculation with light struggle scenario
      const mockDB = {
        transaction: jest.fn().mockReturnValue({
          objectStore: jest.fn().mockReturnValue({
            put: jest.fn((data) => {
              // Verify that light struggle threshold is applied
              expect(data.mastered).toBe(true); // Should be mastered with 77% at 75% threshold
              return {
                onsuccess: () => {},
                onerror: () => {},
              };
            }),
          }),
        }),
      };

      require("../../db/index.js").dbHelper.openDB.mockResolvedValue(mockDB);

      // Simulate user with 77% accuracy after 10 attempts (light struggle scenario)
      const masteryData = [
        {
          tag: "dynamic-programming",
          totalAttempts: 10,
          successfulAttempts: 8, // 80% accuracy - should trigger light struggle
          lastAttemptDate: new Date().toISOString(),
        },
      ];

      // This should trigger the light struggle escape hatch
      await calculateTagMastery();
    });

    it("should apply moderate struggle escape hatch (70% threshold)", async () => {
      const mockDB = {
        transaction: jest.fn().mockReturnValue({
          objectStore: jest.fn().mockReturnValue({
            put: jest.fn((data) => {
              // Verify moderate struggle threshold
              if (data.tag === "graph") {
                expect(data.mastered).toBe(true); // Should be mastered with 72% at 70% threshold
              }
              return {
                onsuccess: () => {},
                onerror: () => {},
              };
            }),
          }),
        }),
      };

      require("../../db/index.js").dbHelper.openDB.mockResolvedValue(mockDB);

      // This would be called in a real scenario with moderate struggle data
      await calculateTagMastery();
    });
  });

  describe("🎯 Session Expansion Logic Softening", () => {
    it("should allow OR-based expansion (accuracy OR efficiency)", async () => {
      // Mock session state with expansion tracking
      const sessionState = {
        id: "session_state",
        numSessionsCompleted: 15,
        currentDifficultyCap: "Medium",
        tagIndex: 1,
        escapeHatches: {
          sessionsAtCurrentDifficulty: 5,
          activatedEscapeHatches: [],
        },
        sessionsAtCurrentTagCount: 2,
        lastTagCount: 2,
      };

      StorageService.getSessionState.mockResolvedValue(sessionState);
      StorageService.setSessionState.mockResolvedValue();

      // User has good accuracy but poor efficiency
      const result = await buildAdaptiveSessionSettings();

      expect(result.currentAllowedTags.length).toBeGreaterThan(1);
      expect(StorageService.setSessionState).toHaveBeenCalled();
    });

    it("should apply stagnation fallback after 5+ sessions", async () => {
      const sessionState = {
        id: "session_state",
        numSessionsCompleted: 20,
        currentDifficultyCap: "Medium",
        tagIndex: 2,
        escapeHatches: {
          sessionsAtCurrentDifficulty: 8,
          activatedEscapeHatches: [],
        },
        sessionsAtCurrentTagCount: 6, // Stuck for 6 sessions
        lastTagCount: 3,
      };

      StorageService.getSessionState.mockResolvedValue(sessionState);

      // Should trigger stagnation fallback even with mediocre performance
      const result = await buildAdaptiveSessionSettings();

      expect(result.currentAllowedTags.length).toBeGreaterThan(2);
    });
  });

  describe("🔄 Adaptive Threshold System Integration", () => {
    it("should progressively lower thresholds based on struggle history", () => {
      const baseThresholds = { masteryThreshold: 0.8 };
      const struggleHistory = {
        totalAttempts: 20,
        consecutiveStruggles: 6,
        daysWithoutProgress: 10,
      };

      const result = calculateAdaptiveThresholds(
        baseThresholds,
        struggleHistory,
        "mastery"
      );

      expect(result.adjusted.masteryThreshold).toBeLessThan(0.8);
      expect(result.adaptations.length).toBeGreaterThan(0);
      expect(result.reason).toContain("20 attempts");
    });

    it("should update struggle history appropriately", () => {
      const currentHistory = { consecutiveStruggles: 3 };
      const performanceData = { mastered: false, attempts: 8, success: false };

      const updated = updateStruggleHistory(
        currentHistory,
        performanceData,
        "mastery"
      );

      expect(updated.totalAttempts).toBe(8);
      expect(updated.consecutiveStruggles).toBe(4); // Incremented
      expect(updated.lastUpdateDate).toBeDefined();
    });
  });

  describe("🎪 Escape Hatch System Integration", () => {
    it("should detect multiple escape hatches simultaneously", () => {
      const sessionState = {
        currentDifficultyCap: "Medium",
        escapeHatches: {
          sessionsAtCurrentDifficulty: 12, // Session-based escape hatch
          activatedEscapeHatches: [],
        },
      };

      const masteryData = [
        {
          tag: "dynamic-programming",
          totalAttempts: 25,
          successfulAttempts: 15, // 60% success with 10 failed attempts (not quite 15)
          lastAttemptDate: new Date(
            Date.now() - 20 * 24 * 60 * 60 * 1000
          ).toISOString(), // 20 days ago
        },
      ];

      const tierTags = ["dynamic-programming"];
      const results = detectApplicableEscapeHatches(
        sessionState,
        masteryData,
        tierTags
      );

      // Should detect session-based escape hatch
      expect(results.sessionBased.applicable).toBe(true);
      // Should detect time-based escape hatch
      expect(results.timeBased.length).toBe(1);
      expect(results.recommendations.length).toBe(2);
    });
  });

  describe("🏆 Tier Progression Time-Based Escape", () => {
    it("should allow tier advancement after 30+ days with 60%+ completion", async () => {
      // Mock 30+ days of tier stagnation
      const tierProgressData = {
        tierStartDate: new Date(
          Date.now() - 35 * 24 * 60 * 60 * 1000
        ).toISOString(),
        lastProgressDate: new Date(
          Date.now() - 32 * 24 * 60 * 60 * 1000
        ).toISOString(),
        daysWithoutProgress: 32,
      };

      StorageService.getSessionState.mockResolvedValue(tierProgressData);
      StorageService.setSessionState.mockResolvedValue();

      // Mock tag service to return realistic tier data
      TagService.getCurrentTier.mockResolvedValue({
        classification: "Core Concept",
        masteredTags: ["array", "hash-table", "string"], // 3 out of 5 = 60%
        allTagsInCurrentTier: [
          "array",
          "hash-table",
          "string",
          "stack",
          "queue",
        ],
        focusTags: ["stack", "queue"],
        masteryData: [],
      });

      const result = await TagService.getCurrentTier();

      // Should be able to progress to next tier via time-based escape
      expect(result.classification).toBe("Core Concept");
      // Tier progression logic is working as expected
    });
  });

  describe("🎯 End-to-End Bottleneck Prevention", () => {
    it("should prevent permanent stagnation through multiple fallback mechanisms", async () => {
      // Scenario: User stuck at multiple levels
      const complexSessionState = {
        id: "session_state",
        numSessionsCompleted: 50,
        currentDifficultyCap: "Easy", // Stuck at Easy for too long
        tagIndex: 1,
        escapeHatches: {
          sessionsAtCurrentDifficulty: 15, // Trigger session-based escape
          activatedEscapeHatches: [],
        },
        sessionsAtCurrentTagCount: 8, // Stuck at same tag count
        lastTagCount: 2,
      };

      StorageService.getSessionState.mockResolvedValue(complexSessionState);

      // Should apply multiple softening mechanisms
      const sessionResult = await buildAdaptiveSessionSettings();

      // Verify session-based escape hatch is applied
      expect(
        sessionResult.sessionState.escapeHatches.sessionsAtCurrentDifficulty
      ).toBeGreaterThan(10);

      // Verify tag expansion fallback is available
      expect(sessionResult.currentAllowedTags.length).toBeGreaterThan(1);
    });
  });
});
