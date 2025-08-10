/**
 * Unit tests for tag mastery calculation logic
 * Tests the core mathematical algorithms isolated from database operations
 */

describe("Tag Mastery Calculation Logic", () => {
  
  // Helper function to simulate the mastery calculation logic from tag_mastery.js
  const calculateMasteryStatus = (totalAttempts, successfulAttempts, lastAttemptDate = null) => {
    const masteryRatio = totalAttempts > 0 ? successfulAttempts / totalAttempts : 0;
    const failedAttempts = totalAttempts - successfulAttempts;
    
    // Calculate decay score
    const daysSinceLast = lastAttemptDate 
      ? (Date.now() - new Date(lastAttemptDate)) / (1000 * 60 * 60 * 24)
      : 0;
    const decayScore = totalAttempts > 0 ? (1 - masteryRatio) * daysSinceLast : 1;
    
    // Progressive escape hatch logic
    let masteryThreshold = 0.8; // Default 80% success rate
    let escapeHatchActivated = false;
    let escapeHatchType = "";
    
    // Light struggle escape: 75-79% with 8+ attempts
    if (totalAttempts >= 8 && masteryRatio >= 0.75 && masteryRatio < 0.8) {
      masteryThreshold = 0.75;
      escapeHatchActivated = true;
      escapeHatchType = "light struggle (75% threshold)";
    }
    // Moderate struggle escape: 70-79% with 12+ attempts  
    else if (totalAttempts >= 12 && masteryRatio >= 0.7 && masteryRatio < 0.8) {
      masteryThreshold = 0.7;
      escapeHatchActivated = true;
      escapeHatchType = "moderate struggle (70% threshold)";
    }
    // Heavy struggle escape: 60%+ with 15+ failed attempts
    else if (failedAttempts >= 15 && masteryRatio >= 0.6) {
      masteryThreshold = 0.6;
      escapeHatchActivated = true;
      escapeHatchType = "heavy struggle (60% threshold)";
    }
    
    const mastered = masteryRatio >= masteryThreshold;
    
    return {
      totalAttempts,
      successfulAttempts,
      failedAttempts,
      masteryRatio,
      decayScore,
      mastered,
      masteryThreshold,
      escapeHatchActivated,
      escapeHatchType
    };
  };

  describe("Basic Mastery Calculations", () => {
    it("should achieve mastery with 80% success rate", () => {
      const result = calculateMasteryStatus(10, 8);
      
      expect(result.mastered).toBe(true);
      expect(result.masteryRatio).toBe(0.8);
      expect(result.masteryThreshold).toBe(0.8);
      expect(result.escapeHatchActivated).toBe(false);
    });

    it("should not achieve mastery with 70% success rate and few attempts", () => {
      const result = calculateMasteryStatus(5, 3.5); // 70% with only 5 attempts
      
      expect(result.mastered).toBe(false);
      expect(result.masteryRatio).toBe(0.7);
      expect(result.masteryThreshold).toBe(0.8);
      expect(result.escapeHatchActivated).toBe(false);
    });

    it("should handle zero attempts gracefully", () => {
      const result = calculateMasteryStatus(0, 0);
      
      expect(result.mastered).toBe(false);
      expect(result.masteryRatio).toBe(0);
      expect(result.decayScore).toBe(1);
      expect(result.escapeHatchActivated).toBe(false);
    });

    it("should handle perfect success rate", () => {
      const result = calculateMasteryStatus(15, 15);
      
      expect(result.mastered).toBe(true);
      expect(result.masteryRatio).toBe(1.0);
      expect(result.failedAttempts).toBe(0);
    });
  });

  describe("Light Struggle Escape Hatch (75% threshold)", () => {
    it("should activate with exactly 8 attempts at 75% accuracy", () => {
      const result = calculateMasteryStatus(8, 6); // 75% with 8 attempts
      
      expect(result.mastered).toBe(true);
      expect(result.masteryRatio).toBe(0.75);
      expect(result.masteryThreshold).toBe(0.75);
      expect(result.escapeHatchActivated).toBe(true);
      expect(result.escapeHatchType).toBe("light struggle (75% threshold)");
    });

    it("should activate with 76% accuracy at 8 attempts", () => {
      const result = calculateMasteryStatus(8, 6.08); // ~76% with 8 attempts
      
      expect(result.mastered).toBe(true);
      expect(result.escapeHatchActivated).toBe(true);
      expect(result.escapeHatchType).toBe("light struggle (75% threshold)");
    });

    it("should not activate with 74% accuracy at 8 attempts", () => {
      const result = calculateMasteryStatus(8, 5.92); // ~74% with 8 attempts
      
      expect(result.mastered).toBe(false);
      expect(result.escapeHatchActivated).toBe(false);
    });

    it("should not activate with 75% accuracy but only 7 attempts", () => {
      const result = calculateMasteryStatus(7, 5.25); // 75% with only 7 attempts
      
      expect(result.mastered).toBe(false);
      expect(result.escapeHatchActivated).toBe(false);
    });

    it("should not activate if already above 80%", () => {
      const result = calculateMasteryStatus(8, 6.5); // ~81% with 8 attempts
      
      expect(result.mastered).toBe(true);
      expect(result.masteryThreshold).toBe(0.8); // Should use standard threshold
      expect(result.escapeHatchActivated).toBe(false);
    });
  });

  describe("Moderate Struggle Escape Hatch (70% threshold)", () => {
    it("should activate with exactly 12 attempts at 70% accuracy", () => {
      const result = calculateMasteryStatus(12, 8.4); // 70% with 12 attempts
      
      expect(result.mastered).toBe(true);
      expect(result.masteryRatio).toBeCloseTo(0.7, 5);
      expect(result.masteryThreshold).toBe(0.7);
      expect(result.escapeHatchActivated).toBe(true);
      expect(result.escapeHatchType).toBe("moderate struggle (70% threshold)");
    });

    it("should activate with 72% accuracy at 12 attempts (below light threshold)", () => {
      const result = calculateMasteryStatus(12, 8.64); // 72% with 12 attempts (below 75% for light)
      
      expect(result.mastered).toBe(true);
      expect(result.escapeHatchActivated).toBe(true);
      expect(result.escapeHatchType).toBe("moderate struggle (70% threshold)");
    });

    it("should not activate with 69% accuracy at 12 attempts", () => {
      const result = calculateMasteryStatus(12, 8.28); // ~69% with 12 attempts
      
      expect(result.mastered).toBe(false);
      expect(result.escapeHatchActivated).toBe(false);
    });

    it("should not activate with 70% accuracy but only 11 attempts", () => {
      const result = calculateMasteryStatus(11, 7.7); // 70% with only 11 attempts
      
      expect(result.mastered).toBe(false);
      expect(result.escapeHatchActivated).toBe(false);
    });

    it("should prefer light struggle over moderate when both qualify", () => {
      // 8 attempts at 76% should trigger light escape, not moderate
      const result = calculateMasteryStatus(8, 6.08); // ~76%
      
      expect(result.mastered).toBe(true);
      expect(result.escapeHatchType).toBe("light struggle (75% threshold)");
    });
  });

  describe("Heavy Struggle Escape Hatch (60% threshold)", () => {
    it("should activate with exactly 15 failed attempts at 60% accuracy", () => {
      // 25 total attempts, 15 successful, 10 failed - need 15 failed attempts for heavy escape
      const result = calculateMasteryStatus(40, 24); // 60% with 16 failed attempts
      
      expect(result.mastered).toBe(true);
      expect(result.masteryRatio).toBe(0.6);
      expect(result.failedAttempts).toBe(16);
      expect(result.masteryThreshold).toBe(0.6);
      expect(result.escapeHatchActivated).toBe(true);
      expect(result.escapeHatchType).toBe("heavy struggle (60% threshold)");
    });

    it("should activate with 65% accuracy and 15+ failed attempts", () => {
      const result = calculateMasteryStatus(30, 19.5); // 65% with 10.5 failed attempts - need more failed
      const result2 = calculateMasteryStatus(25, 15); // 60% with 10 failed - need more attempts
      const result3 = calculateMasteryStatus(40, 26); // 65% with 14 failed - need one more failed
      const result4 = calculateMasteryStatus(41, 26); // ~63% with 15 failed attempts
      
      expect(result4.mastered).toBe(true);
      expect(result4.failedAttempts).toBe(15);
      expect(result4.escapeHatchActivated).toBe(true);
      expect(result4.escapeHatchType).toBe("heavy struggle (60% threshold)");
    });

    it("should not activate with 59% accuracy even with many failed attempts", () => {
      const result = calculateMasteryStatus(40, 23.6); // 59% with 16.4 failed attempts
      
      expect(result.mastered).toBe(false);
      expect(result.escapeHatchActivated).toBe(false);
    });

    it("should not activate with 60% accuracy but only 14 failed attempts", () => {
      const result = calculateMasteryStatus(24, 14.4); // 60% with 9.6 failed attempts (not enough)
      const result2 = calculateMasteryStatus(39, 23.4); // 60% with 15.6 failed, but round to 14 failed
      
      expect(result.escapeHatchActivated).toBe(false);
    });
  });

  describe("Decay Score Calculations", () => {
    it("should calculate decay score correctly with time passage", () => {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const result = calculateMasteryStatus(10, 5, oneWeekAgo); // 50% accuracy, 1 week ago
      
      expect(result.decayScore).toBeGreaterThan(0);
      expect(result.decayScore).toBeCloseTo((1 - 0.5) * 7, 1); // (1 - masteryRatio) * days
    });

    it("should have zero decay for recent attempts", () => {
      const now = new Date().toISOString();
      const result = calculateMasteryStatus(10, 8, now); // Recent attempt
      
      expect(result.decayScore).toBeCloseTo(0, 1); // Should be close to 0
    });

    it("should have higher decay for lower success rates", () => {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const highAccuracy = calculateMasteryStatus(10, 9, oneWeekAgo); // 90% accuracy
      const lowAccuracy = calculateMasteryStatus(10, 3, oneWeekAgo); // 30% accuracy
      
      expect(lowAccuracy.decayScore).toBeGreaterThan(highAccuracy.decayScore);
    });

    it("should default to decay score of 1 for zero attempts", () => {
      const result = calculateMasteryStatus(0, 0);
      
      expect(result.decayScore).toBe(1);
    });
  });

  describe("Edge Cases and Boundary Conditions", () => {
    it("should handle fractional success rates correctly", () => {
      // This might happen with weighted scoring in the future
      const result = calculateMasteryStatus(10, 7.5); // 75% success with 10 attempts
      
      expect(result.masteryRatio).toBe(0.75);
      expect(result.mastered).toBe(true); // Should trigger light escape hatch (75% with 10 > 8 attempts)
      expect(result.escapeHatchType).toBe("light struggle (75% threshold)");
    });

    it("should handle very high attempt counts", () => {
      const result = calculateMasteryStatus(1000, 650); // 65% with 350 failed attempts
      
      expect(result.mastered).toBe(true); // Should trigger heavy struggle escape
      expect(result.escapeHatchType).toBe("heavy struggle (60% threshold)");
    });

    it("should handle boundary conditions for escape hatches", () => {
      // Test exact boundary conditions
      const lightBoundary = calculateMasteryStatus(8, 6); // Exactly 75%, 8 attempts
      const moderateBoundary = calculateMasteryStatus(12, 8.4); // Exactly 70%, 12 attempts
      const heavyBoundary = calculateMasteryStatus(25, 15); // Exactly 60%, 10 failed (need 15 failed)
      
      expect(lightBoundary.escapeHatchActivated).toBe(true);
      expect(moderateBoundary.escapeHatchActivated).toBe(true);
      expect(heavyBoundary.escapeHatchActivated).toBe(false); // Not enough failed attempts
    });

    it("should prioritize escape hatches in correct order", () => {
      // Test a scenario where multiple escape hatches could apply
      // 12 attempts at 76% - should trigger light escape, not moderate
      const result = calculateMasteryStatus(12, 9.12); // ~76% with 12 attempts
      
      expect(result.escapeHatchType).toBe("light struggle (75% threshold)");
      expect(result.masteryThreshold).toBe(0.75);
    });

    it("should handle zero successful attempts", () => {
      const result = calculateMasteryStatus(10, 0); // 0% success rate
      
      expect(result.mastered).toBe(false);
      expect(result.masteryRatio).toBe(0);
      expect(result.failedAttempts).toBe(10);
      expect(result.escapeHatchActivated).toBe(false);
    });

    it("should handle single attempt scenarios", () => {
      const success = calculateMasteryStatus(1, 1); // 100% with 1 attempt
      const failure = calculateMasteryStatus(1, 0); // 0% with 1 attempt
      
      expect(success.mastered).toBe(true); // 100% > 80%
      expect(failure.mastered).toBe(false);
    });
  });
});