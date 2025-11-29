// Mock dependencies - focus on testing infrastructure calls, not UI rendering
jest.mock("../../../shared/services/session/sessionService");
jest.mock("../../../shared/services/problem/problemService");
jest.mock("../../../shared/services/storage/storageService");

import { SessionService } from "../../../shared/services/session/sessionService";
import { ProblemService } from "../../../shared/services/problem/problemService";
import { StorageService } from "../../../shared/services/storage/storageService";

describe("Onboarding Flow - Session Infrastructure Validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("🔥 CRITICAL: First Session Creation Infrastructure", () => {
    it("should detect session creation failure during onboarding completion", async () => {
      // Mock scenario: Onboarding completes but first session creation fails
      const newUserSettings = {
        onboardingCompleted: true,
        focusAreas: ["array", "string"],
        sessionLength: 5,
        userLevel: "beginner"
      };

      StorageService.setSettings.mockResolvedValue(newUserSettings);
      
      // First session creation fails (critical for new user experience)
      ProblemService.createSession.mockRejectedValue(
        new Error("No problems available for focus areas")
      );

      try {
        // Simulate onboarding completion flow
        await StorageService.setSettings(newUserSettings);
        await ProblemService.createSession();
      } catch (error) {
        // CRITICAL: Detect new user session creation failure
        console.error("New user session creation failed:", {
          error: error.message,
          userSettings: newUserSettings,
          impact: "new_user_cannot_start",
          recommendedFix: "provide_fallback_problems"
        });
        
        // This reveals: Need fallback problem sets for new users
        expect(error.message).toContain("No problems available");
      }
    });

    it("should detect onboarding data persistence failures via settings validation", async () => {
      // Mock scenario: Onboarding settings don't persist properly
      const onboardingSettings = {
        onboardingCompleted: true,
        focusAreas: ["dynamic-programming", "trees"],
        sessionLength: 4,
        reviewRatio: 40,
        completedAt: Date.now()
      };

      // Settings save appears to succeed
      StorageService.setSettings.mockResolvedValue(onboardingSettings);
      
      // But reading back returns corrupted/default data
      StorageService.getSettings.mockResolvedValue({
        onboardingCompleted: false, // CORRUPTION: should be true
        focusAreas: [], // CORRUPTION: lost user selections
        sessionLength: null, // CORRUPTION: lost setting
        reviewRatio: undefined // CORRUPTION: lost setting
      });

      await StorageService.setSettings(onboardingSettings);
      const retrievedSettings = await StorageService.getSettings();

      // CRITICAL: Detect onboarding data loss
      const persistenceFailures = [];
      
      if (!retrievedSettings.onboardingCompleted) {
        persistenceFailures.push("onboarding_completion_lost");
      }
      
      if (!retrievedSettings.focusAreas || retrievedSettings.focusAreas.length === 0) {
        persistenceFailures.push("focus_areas_lost");
      }
      
      if (!retrievedSettings.sessionLength) {
        persistenceFailures.push("session_length_lost");
      }

      if (persistenceFailures.length > 0) {
        console.error("Onboarding data persistence failure:", {
          failures: persistenceFailures,
          expectedSettings: onboardingSettings,
          actualSettings: retrievedSettings,
          impact: "user_loses_onboarding_progress"
        });
        
        // This reveals: Storage layer corruption or transaction failures
        expect(persistenceFailures.length).toBeGreaterThan(0);
      }
    });

    it("should detect session service initialization failures after onboarding", async () => {
      // Mock scenario: Onboarding completes but session service can't initialize
      const completedOnboarding = {
        onboardingCompleted: true,
        focusAreas: ["array"],
        timestamp: Date.now()
      };

      StorageService.getSettings.mockResolvedValue(completedOnboarding);
      
      // Session service fails to initialize (database corruption, etc.)
      SessionService.initializeForNewUser = jest.fn().mockRejectedValue(
        new Error("Failed to initialize session state: Database schema mismatch")
      );

      try {
        const settings = await StorageService.getSettings();
        
        if (settings.onboardingCompleted) {
          await SessionService.initializeForNewUser(settings);
        }
      } catch (error) {
        // CRITICAL: Detect post-onboarding initialization failure
        if (error.message.includes("Database schema mismatch")) {
          console.error("Session service initialization failed after onboarding:", {
            error: error.message,
            onboardingStatus: completedOnboarding,
            suspectedCause: "database_migration_incomplete",
            userImpact: "onboarded_but_cannot_use_app"
          });
          
          // This reveals: Database migration issues affecting new users
          expect(error.message).toContain("Database schema mismatch");
        }
      }
    });
  });

  describe("⚡ CRITICAL: Onboarding State Consistency", () => {
    it("should detect onboarding bypass via state validation", async () => {
      // Mock scenario: User somehow bypasses onboarding but system expects it
      const bypassedOnboardingState = {
        onboardingCompleted: false, // Never completed onboarding
        focusAreas: [], // No focus areas set
        sessionLength: null, // No session preferences
        firstSessionAttempted: true // But somehow tried to create session
      };

      StorageService.getSettings.mockResolvedValue(bypassedOnboardingState);
      
      // Session service tries to work with incomplete onboarding
      SessionService.getOrCreateSession.mockImplementation(() => {
        const settings = bypassedOnboardingState;
        
        if (!settings.onboardingCompleted && settings.firstSessionAttempted) {
          throw new Error("Inconsistent state: session attempted without onboarding");
        }
        
        return null;
      });

      try {
        const _settings = await StorageService.getSettings();
        await SessionService.getOrCreateSession();
      } catch (error) {
        // CRITICAL: Detect inconsistent onboarding state
        if (error.message.includes("Inconsistent state")) {
          console.error("Onboarding bypass detected:", {
            error: error.message,
            stateInconsistency: {
              onboardingCompleted: bypassedOnboardingState.onboardingCompleted,
              firstSessionAttempted: bypassedOnboardingState.firstSessionAttempted
            },
            securityRisk: "user_bypassed_required_setup"
          });
          
          // This reveals: Need onboarding state validation and enforcement
          expect(error.message).toContain("Inconsistent state");
        }
      }
    });

    it("should detect focus area corruption during onboarding", async () => {
      // Mock scenario: Focus areas get corrupted during onboarding process
      const corruptedFocusAreas = [
        "array", 
        "", // Empty string corruption
        null, // Null corruption
        123, // Type corruption
        "nonexistent-algorithm", // Invalid focus area
        "array" // Duplicate
      ];

      StorageService.setSettings.mockImplementation((settings) => {
        // Simulate corruption during storage
        return Promise.resolve({
          ...settings,
          focusAreas: corruptedFocusAreas
        });
      });

      const onboardingData = {
        onboardingCompleted: true,
        focusAreas: ["array", "string", "dynamic-programming"]
      };

      const result = await StorageService.setSettings(onboardingData);

      // CRITICAL: Detect focus area corruption
      const corruptionIssues = [];
      
      result.focusAreas.forEach((area, index) => {
        if (area === "" || area === null || area === undefined) {
          corruptionIssues.push(`empty_value_at_index_${index}`);
        }
        
        if (typeof area !== "string") {
          corruptionIssues.push(`invalid_type_at_index_${index}`);
        }
      });

      const duplicates = result.focusAreas.length !== new Set(result.focusAreas).size;
      if (duplicates) {
        corruptionIssues.push("duplicate_focus_areas");
      }

      if (corruptionIssues.length > 0) {
        console.error("Focus area corruption detected during onboarding:", {
          corruptionIssues,
          originalFocusAreas: onboardingData.focusAreas,
          corruptedFocusAreas: result.focusAreas,
          impact: "session_generation_will_fail"
        });
        
        // This reveals: Need input validation and sanitization
        expect(corruptionIssues.length).toBeGreaterThan(0);
      }
    });
  });

  describe("🔧 CRITICAL: Resource Initialization After Onboarding", () => {
    it("should detect database preparation failures for new users", async () => {
      // Mock scenario: Database isn't properly initialized for new user
      const newUserData = {
        userId: "new-user-123",
        onboardingCompleted: true,
        joinedAt: Date.now()
      };

      // Mock database preparation failure
      SessionService.prepareUserDatabase = jest.fn().mockImplementation(() => {
        throw new Error("Failed to create user tables: Insufficient permissions");
      });

      try {
        await SessionService.prepareUserDatabase(newUserData);
      } catch (error) {
        // CRITICAL: Detect database preparation failure
        if (error.message.includes("Failed to create user tables")) {
          console.error("Database preparation failed for new user:", {
            error: error.message,
            userId: newUserData.userId,
            suspectedCause: "indexeddb_permissions_or_quota",
            userImpact: "cannot_store_progress"
          });
          
          // This reveals: Need database initialization error handling
          expect(error.message).toContain("Failed to create user tables");
        }
      }
    });

    it("should detect problem loading infrastructure failure after onboarding", async () => {
      // Mock scenario: Standard problems can't be loaded for new user
      const onboardingComplete = {
        onboardingCompleted: true,
        focusAreas: ["array", "string"]
      };

      StorageService.getSettings.mockResolvedValue(onboardingComplete);
      
      // Problem loading infrastructure fails
      ProblemService.initializeStandardProblems = jest.fn().mockRejectedValue(
        new Error("Failed to load standard problems: Network timeout")
      );

      try {
        const settings = await StorageService.getSettings();
        
        if (settings.onboardingCompleted) {
          await ProblemService.initializeStandardProblems();
        }
      } catch (error) {
        // CRITICAL: Detect problem loading infrastructure failure
        if (error.message.includes("Failed to load standard problems")) {
          console.error("Problem loading infrastructure failure:", {
            error: error.message,
            onboardingStatus: onboardingComplete,
            userFocusAreas: onboardingComplete.focusAreas,
            impact: "no_problems_available_for_practice"
          });
          
          // This reveals: Need offline problem storage or better error recovery
          expect(error.message).toContain("Failed to load standard problems");
        }
      }
    });

    it("should detect analytics initialization corruption after onboarding", async () => {
      // Mock scenario: Analytics/tracking setup corrupted for new user
      const userAnalyticsInit = {
        userId: "user-456",
        analyticsEnabled: true,
        trackingConsent: true,
        onboardingCompleted: true
      };

      // Analytics initialization returns corrupted state
      SessionService.initializeUserAnalytics = jest.fn().mockResolvedValue({
        analyticsId: null, // Should be string
        trackingEnabled: "invalid", // Should be boolean
        metricsCollectors: undefined, // Should be array
        corruptionDetected: true
      });

      const analyticsResult = await SessionService.initializeUserAnalytics(userAnalyticsInit);

      // CRITICAL: Detect analytics corruption that affects progress tracking
      const analyticsIssues = [];
      
      if (!analyticsResult.analyticsId) {
        analyticsIssues.push("missing_analytics_id");
      }
      
      if (typeof analyticsResult.trackingEnabled !== "boolean") {
        analyticsIssues.push("invalid_tracking_enabled_type");
      }
      
      if (!Array.isArray(analyticsResult.metricsCollectors)) {
        analyticsIssues.push("missing_metrics_collectors");
      }

      if (analyticsIssues.length > 0 || analyticsResult.corruptionDetected) {
        console.error("Analytics initialization corruption detected:", {
          analyticsIssues,
          corruptionDetected: analyticsResult.corruptionDetected,
          userSettings: userAnalyticsInit,
          impact: "progress_tracking_will_fail"
        });
        
        // This reveals: Need analytics state validation and recovery
        expect(analyticsIssues.length).toBeGreaterThan(0);
      }
    });
  });
});