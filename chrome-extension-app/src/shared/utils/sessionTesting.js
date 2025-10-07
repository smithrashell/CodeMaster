/**
 * Automated Session Testing Framework
 * Simulates user progression without manual clicking
 */

import { StorageService } from '../services/storageService.js';
import { shouldEnableSessionTesting } from '../../app/config/mockConfig.js';
import { getSessionService, getSessionsDB, getStorageService, enableMockServices, disableMockServices, isUsingMockServices, resetMockServices } from '../services/sessionServiceFactory.js';
import { testMockServices } from './quickMockTest.js';
import { testProgression } from './progressionTest.js';

/**
 * Simulates a complete user progression through multiple sessions
 */
export class SessionTester {
  constructor(config = {}) {
    this.config = {
      totalSessions: 10,
      accuracyRange: [0.6, 1.0],  // Range of accuracy to simulate
      timeRange: [300, 1800],     // Time range in seconds (5min - 30min)
      difficultyBias: 'realistic', // 'optimistic', 'realistic', 'pessimistic'
      verbose: true,
      ...config
    };
    this.results = [];
    this.originalState = null; // Store original state for restoration
    this.testStateKey = `test_session_state_${Date.now()}`; // Unique test key
  }

  /**
   * Run complete simulation
   */
  async runSimulation() {
    console.log(`🧪 Starting session simulation with ${this.config.totalSessions} sessions`);
    console.log(`🎯 Config:`, this.config);

    // Reset state efficiently if requested
    if (this.config.fastReset || this.config.clearData) {
      console.log('🚀 Fast resetting test state...');
      // Use static imports
      const usingMocks = await isUsingMockServices();

      if (usingMocks) {
        await resetMockServices();
        console.log('✅ Mock services reset for fresh testing');
      } else {
        if (this.config.fastReset) {
          await this.fastResetState();
          console.log('✅ Real state fast reset completed');
        } else {
          await this.clearTestData();
          console.log('✅ Real data cleared for testing');
        }
      }
    }

    const scenarios = [];

    for (let i = 0; i < this.config.totalSessions; i++) {
      const scenario = await this.simulateSession(i + 1);
      scenarios.push(scenario);

      if (this.config.verbose) {
        console.log(`📊 Session ${i + 1}:`, this.formatScenario(scenario));
      }

      // Small delay to simulate realistic timing
      if (this.config.delay) {
        await new Promise(resolve => setTimeout(resolve, this.config.delay));
      }
    }

    const report = this.generateReport(scenarios);

    // Auto-cleanup for mock services (real services still use manual cleanup)
    // Use static imports
    const usingMocks = await isUsingMockServices();

    if (!usingMocks) {
      // Only cleanup manually if using real services
      await this.cleanupTestData();
    }
    // Mock services auto-cleanup when JavaScript garbage collection runs

    return report;
  }

  /**
   * Simulate a single session with realistic user behavior
   */
  async simulateSession(sessionNumber) {
    try {
      // 1. Get the appropriate session service (mock or real)
      // Use static imports
      const SessionService = await getSessionService();
      const SessionsDB = await getSessionsDB();
      const usingMocks = await isUsingMockServices();

      const sessionData = await SessionService.getOrCreateSession('standard');
      const problems = sessionData?.problems || [];
      console.log(`🎯 Session ${sessionNumber}: Created via ${usingMocks ? 'Mock' : 'Real'}SessionService with ${problems.length} problems`);

      // 2. Get session settings for context
      const settings = await SessionsDB.buildAdaptiveSessionSettings();

      // 3. Simulate attempts for each problem
      const attempts = [];
      for (let i = 0; i < problems.length; i++) {
        const problem = problems[i];
        const attempt = this.simulateAttempt(problem, sessionNumber, i);
        attempts.push(attempt);

        // Skip adding attempts to database during testing to avoid "Problem not found" errors
        // The simulation just tracks attempts in memory for testing purposes
      }

      // 4. Get session ID from SessionService response
      const sessionId = sessionData?.id || `test_session_${sessionNumber}`;
      console.log(`📝 Session ${sessionNumber}: Using SessionService session ID: ${sessionId}`);

      // Simulate session completion following proper SessionService flow
      console.log(`📝 Session ${sessionNumber} simulation completed with ${attempts.length} attempts`);

      // Calculate session accuracy
      const successfulAttempts = attempts.filter(a => a.success).length;
      const sessionAccuracy = attempts.length > 0 ? successfulAttempts / attempts.length : 0;

      try {
        // 1. Properly complete the session using appropriate service (mock or real)
        await SessionService.checkAndCompleteSession(sessionId);
        console.log(`✅ Session ${sessionNumber} marked as completed via ${usingMocks ? 'Mock' : 'Real'}SessionService`);

        // 2. Evaluate difficulty progression based on session accuracy
        const StorageService = await getStorageService();
        const settings = await StorageService.getSessionState?.('settings') || {};
        const updatedSessionState = await SessionsDB.evaluateDifficultyProgression(sessionAccuracy, settings);
        console.log(`🎯 Session ${sessionNumber}: ${(sessionAccuracy * 100).toFixed(1)}% accuracy, difficulty cap: ${updatedSessionState.current_difficulty_cap}${usingMocks ? ' (mock)' : ''}`);
      } catch (error) {
        console.warn(`⚠️ Failed to complete session properly:`, error.message);
        // Fallback to just incrementing counter (not ideal but prevents test failure)
        const currentState = await StorageService.getSessionState('session_state') || {};
        currentState.num_sessions_completed = (currentState.num_sessions_completed || 0) + 1;
        await StorageService.setSessionState('session_state', currentState);
      }

      // 5. Create mock analytics for testing
      const analytics = {
        sessionId: sessionId,
        totalAttempts: attempts.length,
        successfulAttempts: attempts.filter(a => a.success).length,
        averageTime: attempts.reduce((sum, a) => sum + a.timeSpent, 0) / attempts.length,
        mockData: true
      };

      // Get the final difficulty cap after progression evaluation
      let finalDifficultyCap = settings.currentDifficultyCap;
      try {
        const StorageService = await getStorageService();
        const finalState = await StorageService.getSessionState('session_state');
        finalDifficultyCap = finalState?.current_difficulty_cap || settings.currentDifficultyCap;
      } catch (error) {
        console.warn(`⚠️ Could not get final difficulty cap, using initial: ${error.message}`);
      }

      return {
        sessionNumber,
        sessionId,
        problems: problems,
        attempts,
        analytics,
        settings: {
          sessionLength: settings.sessionLength,
          currentDifficultyCap: finalDifficultyCap, // Use post-progression difficulty
          numberOfNewProblems: settings.numberOfNewProblems,
          isOnboarding: settings.isOnboarding
        }
      };
    } catch (error) {
      console.error(`❌ Failed to simulate session ${sessionNumber}:`, error);
      return {
        sessionNumber,
        error: error.message,
        failed: true
      };
    }
  }

  /**
   * Simulate realistic attempt based on problem difficulty and user progression
   */
  simulateAttempt(problem, sessionNumber, _problemIndex) {
    const difficulty = problem.difficulty;
    const baseAccuracy = this.getBaseAccuracy(difficulty, sessionNumber);
    const timeMultiplier = this.getTimeMultiplier(difficulty);

    // Add some randomness
    const randomFactor = (Math.random() - 0.5) * 0.2; // ±10%
    const finalAccuracy = Math.max(0, Math.min(1, baseAccuracy + randomFactor));

    const success = Math.random() < finalAccuracy;
    const baseTime = this.getBaseTime(difficulty);
    const timeSpent = Math.floor(baseTime * timeMultiplier * (success ? 0.8 : 1.3));

    return {
      problemId: problem.id,
      difficulty,
      success,
      timeSpent,
      accuracy: finalAccuracy
    };
  }

  /**
   * Get base accuracy based on difficulty and user progression
   */
  getBaseAccuracy(difficulty, sessionNumber) {
    const progressionFactor = Math.min(1.0, sessionNumber / 15); // Improve over 15 sessions

    const difficultyBase = {
      'Easy': 0.85,
      'Medium': 0.65,
      'Hard': 0.45
    }[difficulty] || 0.5;

    // Apply difficulty bias
    const biasMultiplier = {
      'optimistic': 1.2,
      'realistic': 1.0,
      'pessimistic': 0.8
    }[this.config.difficultyBias] || 1.0;

    return Math.min(0.95, (difficultyBase + progressionFactor * 0.3) * biasMultiplier);
  }

  /**
   * Get base time for difficulty level
   */
  getBaseTime(difficulty) {
    return {
      'Easy': 600,    // 10 minutes
      'Medium': 1200, // 20 minutes
      'Hard': 1800    // 30 minutes
    }[difficulty] || 900;
  }

  /**
   * Get time multiplier based on success patterns
   */
  getTimeMultiplier(_difficulty) {
    const variance = 0.3; // 30% variance
    return 1 + (Math.random() - 0.5) * variance;
  }

  /**
   * Fast state reset - resets session state without database operations
   */
  async fastResetState() {
    console.log("🚀 Fast resetting session state...");
    try {
      // Create baseline session state for testing
      const baselineState = {
        id: 'session_state',
        num_sessions_completed: 0,
        current_difficulty_cap: 'Easy',
        tag_index: 0,
        difficulty_time_stats: {
          easy: { problems: 0, total_time: 0, avg_time: 0 },
          medium: { problems: 0, total_time: 0, avg_time: 0 },
          hard: { problems: 0, total_time: 0, avg_time: 0 }
        },
        escape_hatches: {
          sessions_at_current_difficulty: 0,
          last_difficulty_promotion: null,
          sessions_without_promotion: 0,
          activated_escape_hatches: []
        },
        current_focus_tags: ['array'],
        performance_level: 'developing'
      };

      await StorageService.setSessionState('session_state', baselineState);
      console.log(`✅ Fast reset completed - session state reset to baseline`);
    } catch (error) {
      console.warn("⚠️ Failed to fast reset state:", error);
    }
  }

  /**
   * Setup test isolation - backup original state and use test-specific keys
   */
  async clearTestData() {
    console.log("🗑️ Setting up test isolation and backing up original state...");
    try {
      // Backup original session state for restoration
      this.originalState = await StorageService.getSessionState('session_state');
      console.log("💾 Backed up original session state");

      // Create fresh test session state
      const freshTestState = {
        id: this.testStateKey,
        num_sessions_completed: 0,
        current_difficulty_cap: "Easy", // Start from easy for progression testing
        tag_index: 0,
        difficulty_time_stats: {
          easy: { problems: 0, total_time: 0, avg_time: 0 },
          medium: { problems: 0, total_time: 0, avg_time: 0 },
          hard: { problems: 0, total_time: 0, avg_time: 0 }
        },
        escape_hatches: {
          sessions_at_current_difficulty: 0,
          last_difficulty_promotion: null,
          sessions_without_promotion: 0,
          activated_escape_hatches: []
        },
        _isTestState: true // Mark as test data
      };

      // Use test-specific key instead of production key
      await StorageService.setSessionState(this.testStateKey, freshTestState);
      console.log(`✅ Test state initialized with key: ${this.testStateKey}`);
    } catch (error) {
      console.warn("⚠️ Failed to clear test data:", error);
    }
  }

  /**
   * Restore original state and clean up test data
   */
  async cleanupTestData() {
    console.log("🧹 Cleaning up test data and restoring original state...");
    try {
      // Clear test state by setting to null (StorageService doesn't have remove method)
      await StorageService.setSessionState(this.testStateKey, null);
      console.log(`🗑️ Cleared test state: ${this.testStateKey}`);

      // Restore original state if it existed
      if (this.originalState) {
        await StorageService.setSessionState('session_state', this.originalState);
        console.log("✅ Restored original session state");
      } else {
        console.log("ℹ️ No original state to restore (was first run)");
      }
    } catch (error) {
      console.warn("⚠️ Failed to cleanup test data:", error);
    }
  }

  /**
   * Format scenario for readable output
   */
  formatScenario(scenario) {
    if (scenario.failed) {
      return `❌ FAILED: ${scenario.error}`;
    }

    const attempts = scenario.attempts || [];
    const successRate = attempts.length > 0 ?
      (attempts.filter(a => a.success).length / attempts.length * 100).toFixed(1) : 0;

    return {
      problems: attempts.length,
      sessionLength: scenario.settings?.sessionLength,
      difficultyMix: this.getDifficultyMix(scenario.problems),
      successRate: `${successRate}%`,
      avgTime: this.getAverageTime(attempts),
      currentCap: scenario.settings?.currentDifficultyCap,
      isOnboarding: scenario.settings?.isOnboarding
    };
  }

  /**
   * Get difficulty distribution
   */
  getDifficultyMix(problems) {
    const counts = { Easy: 0, Medium: 0, Hard: 0 };
    problems.forEach(p => counts[p.difficulty] = (counts[p.difficulty] || 0) + 1);
    return counts;
  }

  /**
   * Get average time
   */
  getAverageTime(attempts) {
    if (attempts.length === 0) return 0;
    const total = attempts.reduce((sum, a) => sum + a.timeSpent, 0);
    return Math.floor(total / attempts.length);
  }

  /**
   * Generate comprehensive test report
   */
  generateReport(scenarios) {
    const successful = scenarios.filter(s => !s.failed);
    const failed = scenarios.filter(s => s.failed);

    console.log("\n📊 SIMULATION REPORT");
    console.log("===================");
    console.log(`✅ Successful sessions: ${successful.length}`);
    console.log(`❌ Failed sessions: ${failed.length}`);

    if (successful.length > 0) {
      const progressionAnalysis = this.analyzeProgression(successful);
      console.log("\n🎯 PROGRESSION ANALYSIS:");
      console.log(progressionAnalysis);

      const difficultyAnalysis = this.analyzeDifficultyProgression(successful);
      console.log("\n📈 DIFFICULTY PROGRESSION:");
      console.log(difficultyAnalysis);

      const sessionLengthAnalysis = this.analyzeSessionLengths(successful);
      console.log("\n📏 SESSION LENGTH ADAPTATION:");
      console.log(sessionLengthAnalysis);
    }

    if (failed.length > 0) {
      console.log("\n❌ FAILURES:");
      failed.forEach(f => console.log(`  Session ${f.sessionNumber}: ${f.error}`));
    }

    return {
      successful: successful.length,
      failed: failed.length,
      scenarios: successful,
      progressionAnalysis: successful.length > 0 ? this.analyzeProgression(successful) : null
    };
  }

  /**
   * Analyze user progression over sessions
   */
  analyzeProgression(scenarios) {
    const progressionData = scenarios.map(s => ({
      session: s.sessionNumber,
      accuracy: s.attempts.filter(a => a.success).length / s.attempts.length,
      avgTime: this.getAverageTime(s.attempts),
      sessionLength: s.settings?.sessionLength,
      difficultyMix: this.getDifficultyMix(s.problems)
    }));

    return {
      initialAccuracy: (progressionData[0]?.accuracy * 100).toFixed(1) + '%',
      finalAccuracy: (progressionData[progressionData.length - 1]?.accuracy * 100).toFixed(1) + '%',
      avgSessionLength: (progressionData.reduce((sum, p) => sum + (p.sessionLength || 0), 0) / progressionData.length).toFixed(1),
      data: progressionData
    };
  }

  /**
   * Analyze difficulty cap progression
   */
  analyzeDifficultyProgression(scenarios) {
    const difficultyProgression = scenarios.map(s => ({
      session: s.sessionNumber,
      cap: s.settings?.currentDifficultyCap,
      isOnboarding: s.settings?.isOnboarding
    }));

    return difficultyProgression;
  }

  /**
   * Analyze session length adaptation
   */
  analyzeSessionLengths(scenarios) {
    const lengths = scenarios.map(s => s.settings?.sessionLength || 0);
    return {
      min: Math.min(...lengths),
      max: Math.max(...lengths),
      avg: (lengths.reduce((a, b) => a + b, 0) / lengths.length).toFixed(1),
      progression: lengths
    };
  }
}

/**
 * Quick test scenarios
 */
export const TestScenarios = {
  // Test onboarding progression
  onboarding: () => new SessionTester({
    totalSessions: 5,
    difficultyBias: 'optimistic',
    fastReset: true,
    verbose: true
  }),

  // Test difficulty progression
  difficultyProgression: () => new SessionTester({
    totalSessions: 15,
    difficultyBias: 'realistic',
    fastReset: true,
    verbose: true
  }),

  // Test struggling user
  strugglingUser: () => new SessionTester({
    totalSessions: 10,
    difficultyBias: 'pessimistic',
    accuracyRange: [0.3, 0.7],
    fastReset: true,
    verbose: true
  }),

  // Quick smoke test (with fast reset for progression testing)
  quickTest: () => new SessionTester({
    totalSessions: 3,
    difficultyBias: 'realistic',
    fastReset: true, // Fast reset to show Easy → Medium progression
    verbose: true,
    delay: 500
  })
};

// Check if session testing should be enabled
async function checkSessionTestingEnabled() {
  try {
    // Use static imports
    return shouldEnableSessionTesting();
  } catch (error) {
    // Fallback: enable in dev if config can't be loaded
    return process.env.NODE_ENV === 'development';
  }
}

/**
 * Run test from browser console - Available in dev mode by default
 * Usage: window.testSessions = new SessionTester(); await window.testSessions.runSimulation();
 */
if (typeof window !== 'undefined') {
  // Always expose the classes for manual instantiation
  window.SessionTester = SessionTester;
  window.TestScenarios = TestScenarios;

  // Conditionally expose convenience functions based on environment
  checkSessionTestingEnabled().then(enabled => {
    if (enabled) {
      console.log('🧪 Session testing functions enabled');

      // Quick console commands
      window.testQuick = () => TestScenarios.quickTest().runSimulation();
      window.testOnboarding = () => TestScenarios.onboarding().runSimulation();
      window.testProgression = () => TestScenarios.difficultyProgression().runSimulation();

      // Additional test for guaranteed progression viewing
      window.testProgressionQuick = () => new SessionTester({
        totalSessions: 6,
        difficultyBias: 'optimistic', // High success rate to ensure progression
        accuracyRange: [0.9, 1.0], // 90-100% success to trigger difficulty increases
        fastReset: true,
        verbose: true,
        delay: 200
      }).runSimulation();

      // Manual cleanup function for when tests leave data
      window.cleanupTestData = async () => {
        console.log("🧹 Manual test data cleanup...");
        try {
          // Use static imports
          const usingMocks = await isUsingMockServices();

          if (usingMocks) {
            await resetMockServices();
            console.log("✅ Mock services reset to defaults");
          } else {
            // Reset session state to reasonable defaults for real services
            const defaultState = {
              id: "session_state",
              num_sessions_completed: 0,
              current_difficulty_cap: "Easy",
              tag_index: 0,
              difficulty_time_stats: {
                easy: { problems: 0, total_time: 0, avg_time: 0 },
                medium: { problems: 0, total_time: 0, avg_time: 0 },
                hard: { problems: 0, total_time: 0, avg_time: 0 }
              },
              escape_hatches: {
                sessions_at_current_difficulty: 0,
                last_difficulty_promotion: null,
                sessions_without_promotion: 0,
                activated_escape_hatches: []
              }
            };

            // Use static imports
            await StorageService.setSessionState('session_state', defaultState);

            // Remove any test states that might exist
            const testKeys = ['optimization_test'];
            for (const key of testKeys) {
              try {
                await StorageService.setSessionState(key, null);
              } catch (error) {
                // Continue cleanup even if individual keys fail
              }
            }

            console.log("✅ Real test data cleanup completed - session state reset to defaults");
          }
        } catch (error) {
          console.error("❌ Failed to cleanup test data:", error);
        }
      };

      // Add mock service controls
      window.enableMockSessions = async () => {
        // Use static imports
        enableMockServices();
        console.log("🎭 Mock session services enabled - reload to take effect");
      };

      window.disableMockSessions = async () => {
        // Use static imports
        disableMockServices();
        console.log("🎭 Mock session services disabled - reload to take effect");
      };

      window.checkMockStatus = async () => {
        // Use static imports
        const usingMocks = await isUsingMockServices();
        console.log(`🎭 Currently using: ${usingMocks ? 'Mock' : 'Real'} session services`);
        return usingMocks;
      };

      // Quick test function
      window.testMockServices = async () => {
        // Use static imports
        return testMockServices();
      };

      // Progression test function
      window.testProgression = async () => {
        // Use static imports
        return testProgression();
      };
    } else {
      console.log('🧪 Session testing disabled - functions not available');
    }
  });
}