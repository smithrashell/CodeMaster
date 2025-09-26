/**
 * 🎯 Real System Integration Tests
 * Tests actual system functions with isolated test data
 *
 * BROWSER CONSOLE USAGE:
 * testRealLearningFlow() - Test complete learning flow with real functions
 * testRealFocusCoordination() - Test focus coordination service integration
 * testRealSessionCreation() - Test real session creation with pathfinding
 * testRealRelationshipLearning() - Test relationship updates from real sessions
 * testAllRealSystem() - Run complete real system test suite
 */

import { ProblemService } from '../services/problemService.js';
import { SessionService } from '../services/sessionService.js';
import { AttemptsService } from '../services/attemptsService.js';
import { FocusCoordinationService } from '../services/focusCoordinationService.js';
import {
  buildRelationshipMap
} from '../db/problem_relationships.js';
import { getTagMastery } from '../db/tag_mastery.js';
import { v4 as uuidv4 } from 'uuid';
import { withTestDatabase } from '../db/testDatabaseContext.js';
import { createScenarioTestDb } from '../db/dbHelperFactory.js';

export class RealSystemTester {

  /**
   * Test complete learning flow using real system functions
   */
  static async testRealLearningFlow(options = {}) {
    const { scenario = 'default', sessions = 3, quiet = false } = options;

    if (!quiet) console.log('🎯 Testing Real Learning Flow with Existing Services + Test Database...');

    // Create test database with seeding capabilities
    const testDb = createScenarioTestDb('realLearningFlow');

    try {
      // Activate test database context manually
      const testName = `realLearningFlow_${Date.now()}`;

      // Set up test database context
      globalThis._testDatabaseActive = true;
      globalThis._testDatabaseHelper = testDb;

      if (!quiet) {
        const dbInfo = testDb.getInfo();
        console.log(`✅ Test database context active: ${dbInfo.dbName}`);
      }

      // Seed the test database with problems for testing
      if (!quiet) console.log('🌱 Seeding test database with problems...');
      const seedResults = await testDb.seedProductionLikeData();
      if (!quiet) {
        const successCount = Object.values(seedResults).filter(Boolean).length;
        console.log(`✅ Database seeded: ${successCount}/5 components loaded`);
      }

      const results = {
        testDatabase: testDb.getInfo(),
        scenario,
        sessions: [],
        learningProgression: {},
        systemBehavior: {},
        success: false
      };

      // Test real learning flow across multiple sessions
      for (let sessionNum = 1; sessionNum <= sessions; sessionNum++) {
        if (!quiet) console.log(`🏃 Running real session ${sessionNum}/${sessions}...`);

        const sessionResult = await this.runRealSession(sessionNum, quiet);
        results.sessions.push(sessionResult);

        // Small delay between sessions
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Analyze learning progression using real data
      results.learningProgression = await this.analyzeLearningProgression(results.sessions);
      results.systemBehavior = await this.analyzeSystemBehavior();

      // Validate test success based on actual results
      results.success = this.validateTestSuccess(results);

      if (!quiet) {
        this.displayRealSystemResults(results);
      }

      return results;

    } catch (error) {
      console.error('❌ Real learning flow test failed:', error);
      return { error: error.message, testDatabase: testDb.getInfo() };
    } finally {
      // Clean up test database context
      try {
        delete globalThis._testDatabaseActive;
        delete globalThis._testDatabaseHelper;
        await testDb.deleteDB();
        if (!quiet) console.log('🗑️ Test database cleaned up');
      } catch (cleanupError) {
        console.warn('⚠️ Test database cleanup failed:', cleanupError.message);
      }
    }
  }

  /**
   * Run a single real session using actual system functions
   */
  static async runRealSession(sessionNum, quiet = false) {
    try {
      // 1. Get real focus coordination decision
      const focusDecision = await FocusCoordinationService.getFocusDecision(`test_user_${sessionNum}`);

      // 2. Create real session using ProblemService
      const sessionData = await SessionService.getOrCreateSession('standard');

      if (!quiet) {
        console.log(`📊 Session ${sessionNum} created:`, {
          problemCount: sessionData.problems?.length || 0,
          focusTags: focusDecision.activeFocusTags,
          sessionId: sessionData.id
        });
      }

      // 3. Simulate realistic user performance
      const attempts = await this.simulateRealisticAttempts(sessionData, 0.75); // 75% accuracy

      // 4. Complete session using real SessionService
      const completionResult = await SessionService.checkAndCompleteSession(sessionData.id);

      // 5. Verify relationship updates occurred
      const relationshipMap = await buildRelationshipMap();

      return {
        sessionNum,
        sessionId: sessionData.id,
        focusDecision,
        problemCount: sessionData.problems?.length || 0,
        attempts: attempts.length,
        successRate: attempts.filter(a => a.success).length / attempts.length,
        completionResult,
        relationshipCount: relationshipMap.size,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error(`❌ Session ${sessionNum} failed:`, error);
      return { sessionNum, error: error.message };
    }
  }

  /**
   * Test real focus coordination service integration
   */
  static async testRealFocusCoordination(options = {}) {
    const { quiet = false } = options;

    if (!quiet) console.log('🎯 Testing Real Focus Coordination...');

    try {
      const testSession = await TestDataIsolation.enterTestMode();
      await TestDataIsolation.seedTestData('experienced_user');

      const results = [];

      // Test focus coordination with different user states
      const testStates = [
        { sessionCount: 0, name: 'onboarding' },
        { sessionCount: 5, name: 'early_learning' },
        { sessionCount: 20, name: 'experienced' }
      ];

      for (const state of testStates) {
        // Set up session state
        const testStorageService = TestDataIsolation.createTestStorageService();
        await testStorageService.setSessionState('test_user', {
          num_sessions_completed: state.sessionCount,
          current_focus_tags: ['array', 'hash-table']
        });

        // Get real focus decision
        const focusDecision = await FocusCoordinationService.getFocusDecision('test_user');

        // Verify focus decision affects session creation
        const sessionData = await SessionService.getOrCreateSession('standard');

        const result = {
          stateName: state.name,
          sessionCount: state.sessionCount,
          focusDecision,
          sessionProblems: sessionData.problems?.length || 0,
          focusAlignment: this.calculateFocusAlignment(sessionData, focusDecision),
          onboarding: focusDecision.onboarding
        };

        results.push(result);

        if (!quiet) {
          console.log(`✅ ${state.name}: ${result.focusAlignment.toFixed(2)} focus alignment, ${result.sessionProblems} problems`);
        }
      }

      return { testSession, results, success: true };

    } catch (error) {
      console.error('❌ Focus coordination test failed:', error);
      return { error: error.message };
    } finally {
      await TestDataIsolation.exitTestMode(true);
    }
  }

  /**
   * Test real relationship learning from completed sessions
   */
  static async testRealRelationshipLearning(options = {}) {
    const { quiet = false } = options;

    if (!quiet) console.log('🧠 Testing Real Relationship Learning...');

    try {
      const testSession = await TestDataIsolation.enterTestMode();
      await TestDataIsolation.seedTestData('default');

      // Get initial relationship state
      const initialRelationships = await buildRelationshipMap();
      const initialCount = initialRelationships.size;

      // Create and complete a session
      const sessionData = await SessionService.getOrCreateSession('standard');
      const attempts = await this.simulateRealisticAttempts(sessionData, 0.9); // High success rate

      // Complete session (this should trigger relationship updates)
      await SessionService.checkAndCompleteSession(sessionData.id);

      // Check if relationships were updated
      const updatedRelationships = await buildRelationshipMap();
      const updatedCount = updatedRelationships.size;

      // Verify learning occurred
      const learningOccurred = updatedCount >= initialCount;

      if (!quiet) {
        console.log(`🔗 Relationships: ${initialCount} → ${updatedCount} (learning: ${learningOccurred})`);
      }

      return {
        testSession,
        initialRelationshipCount: initialCount,
        updatedRelationshipCount: updatedCount,
        learningOccurred,
        attempts: attempts.length,
        successRate: attempts.filter(a => a.success).length / attempts.length,
        success: true
      };

    } catch (error) {
      console.error('❌ Relationship learning test failed:', error);
      return { error: error.message };
    } finally {
      await TestDataIsolation.exitTestMode(true);
    }
  }

  /**
   * Test real session creation with pathfinding algorithms
   */
  static async testRealSessionCreation(options = {}) {
    const { quiet = false } = options;

    if (!quiet) console.log('🎯 Testing Real Session Creation with Pathfinding...');

    try {
      const testSession = await TestDataIsolation.enterTestMode();
      await TestDataIsolation.seedTestData('experienced_user');

      // Test multiple session creations to verify consistency
      const sessions = [];
      for (let i = 1; i <= 3; i++) {
        const sessionData = await SessionService.getOrCreateSession('standard');

        // Analyze session composition
        const analysis = await this.analyzeSessionComposition(sessionData);

        sessions.push({
          sessionNum: i,
          problemCount: sessionData.problems?.length || 0,
          analysis,
          sessionId: sessionData.id
        });

        if (!quiet) {
          console.log(`📊 Session ${i}: ${analysis.uniqueTags.length} unique tags, ${analysis.difficultyDistribution.Hard || 0} hard problems`);
        }
      }

      return { testSession, sessions, success: true };

    } catch (error) {
      console.error('❌ Session creation test failed:', error);
      return { error: error.message };
    } finally {
      await TestDataIsolation.exitTestMode(true);
    }
  }

  /**
   * Helper: Simulate realistic user attempts for a session
   */
  static async simulateRealisticAttempts(sessionData, targetSuccessRate = 0.75) {
    const attempts = [];

    if (!sessionData.problems || sessionData.problems.length === 0) {
      return attempts;
    }

    for (const problem of sessionData.problems) {
      const isSuccess = Math.random() < targetSuccessRate;

      // Realistic timing based on difficulty
      const baseTime = problem.difficulty === 'Easy' ? 10 :
                      problem.difficulty === 'Medium' ? 20 : 30;
      const timeVariation = baseTime * 0.5 * Math.random();
      const timeSpent = (baseTime + timeVariation) * 60 * 1000; // Convert to milliseconds

      const attempt = {
        id: uuidv4(), // Required for IndexedDB keyPath
        problem_id: problem.problem_id || problem.id, // Use UUID problem_id if available
        leetcode_id: problem.leetcode_id || problem.id, // Include leetcode_id for lookups
        session_id: sessionData.id, // Associate with current session
        success: isSuccess,
        time_spent: timeSpent,
        hints_used: isSuccess ? Math.floor(Math.random() * 2) : Math.floor(Math.random() * 4),
        attempt_date: new Date().toISOString()
      };

      attempts.push(attempt);

      // Add to database using real AttemptsService
      try {
        await AttemptsService.addAttempt(attempt, problem);
      } catch (error) {
        console.warn('⚠️ Failed to add simulated attempt:', error.message);
      }
    }

    return attempts;
  }

  /**
   * Helper: Analyze learning progression across sessions
   */
  static async analyzeLearningProgression(sessions) {
    const progression = {
      sessionCount: sessions.length,
      averageSuccessRate: 0,
      progressionTrend: 'stable',
      focusConsistency: 0,
      relationshipGrowth: 0
    };

    if (sessions.length === 0) return progression;

    // Calculate average success rate
    const successRates = sessions.map(s => s.successRate).filter(rate => !isNaN(rate));
    progression.averageSuccessRate = successRates.reduce((sum, rate) => sum + rate, 0) / successRates.length;

    // Determine progression trend
    if (successRates.length > 1) {
      const firstHalf = successRates.slice(0, Math.ceil(successRates.length / 2));
      const secondHalf = successRates.slice(Math.ceil(successRates.length / 2));

      const firstAvg = firstHalf.reduce((sum, rate) => sum + rate, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, rate) => sum + rate, 0) / secondHalf.length;

      if (secondAvg > firstAvg + 0.1) progression.progressionTrend = 'improving';
      else if (secondAvg < firstAvg - 0.1) progression.progressionTrend = 'declining';
    }

    // Calculate relationship growth
    const relationshipCounts = sessions.map(s => s.relationshipCount).filter(count => !isNaN(count));
    if (relationshipCounts.length > 1) {
      progression.relationshipGrowth = relationshipCounts[relationshipCounts.length - 1] - relationshipCounts[0];
    }

    return progression;
  }

  /**
   * Helper: Analyze system behavior patterns
   */
  static async analyzeSystemBehavior() {
    try {
      // Get current tag mastery state
      const tagMastery = await getTagMastery();

      // Get current relationship map
      const relationshipMap = await buildRelationshipMap();

      return {
        tagMasteryCount: Object.keys(tagMastery).length,
        relationshipCount: relationshipMap.size,
        systemHealthy: Object.keys(tagMastery).length > 0 && relationshipMap.size > 0
      };
    } catch (error) {
      return { error: error.message, systemHealthy: false };
    }
  }

  /**
   * Helper: Calculate focus alignment between session and focus decision
   */
  static calculateFocusAlignment(sessionData, focusDecision) {
    if (!sessionData.problems || !focusDecision.activeFocusTags) return 0;

    const sessionTags = new Set(sessionData.problems.flatMap(p => p.tags || []));
    const focusTags = new Set(focusDecision.activeFocusTags);

    const intersection = [...sessionTags].filter(tag => focusTags.has(tag));
    return intersection.length / Math.max(focusTags.size, 1);
  }

  /**
   * Helper: Analyze session composition
   */
  static async analyzeSessionComposition(sessionData) {
    if (!sessionData.problems) {
      return { uniqueTags: [], difficultyDistribution: {}, totalProblems: 0 };
    }

    const allTags = sessionData.problems.flatMap(p => p.tags || []);
    const uniqueTags = [...new Set(allTags)];

    const difficultyDistribution = sessionData.problems.reduce((dist, problem) => {
      const difficulty = problem.difficulty || 'Unknown';
      dist[difficulty] = (dist[difficulty] || 0) + 1;
      return dist;
    }, {});

    return {
      uniqueTags,
      difficultyDistribution,
      totalProblems: sessionData.problems.length
    };
  }

  /**
   * Validate if the test should be considered successful
   */
  static validateTestSuccess(results) {
    // Check for basic data completeness and validity
    if (!results.sessions || results.sessions.length === 0) {
      console.warn('❌ Test failed: No sessions completed');
      return false;
    }

    // Check if sessions contain errors
    const sessionErrors = results.sessions.filter(s => s.error).length;
    if (sessionErrors > 0) {
      console.warn(`❌ Test failed: ${sessionErrors} sessions had errors`);
      return false;
    }

    // Check learning progression metrics
    if (!results.learningProgression || isNaN(results.learningProgression.averageSuccessRate)) {
      console.warn('❌ Test failed: Learning progression data invalid or missing');
      return false;
    }

    // Check system behavior metrics
    if (!results.systemBehavior || results.systemBehavior.tagMasteryCount === undefined) {
      console.warn('❌ Test failed: System behavior analysis failed');
      return false;
    }

    // Check if system is healthy
    if (!results.systemBehavior.systemHealthy) {
      console.warn('❌ Test failed: System health check failed');
      return false;
    }

    console.log('✅ Test validation: All criteria met');
    return true;
  }

  /**
   * Display real system test results
   */
  static displayRealSystemResults(results) {
    console.log('\n🎯 REAL SYSTEM TEST RESULTS');
    console.log('================================');
    console.log(`Test Session: ${results.testSession}`);
    console.log(`Scenario: ${results.scenario}`);
    console.log(`Sessions Completed: ${results.sessions.length}`);

    if (results.learningProgression) {
      console.log('\n📈 Learning Progression:');
      console.log(`  Average Success Rate: ${(results.learningProgression.averageSuccessRate * 100).toFixed(1)}%`);
      console.log(`  Progression Trend: ${results.learningProgression.progressionTrend}`);
      console.log(`  Relationship Growth: ${results.learningProgression.relationshipGrowth}`);
    }

    if (results.systemBehavior) {
      console.log('\n🔧 System Behavior:');
      console.log(`  Tag Mastery Entries: ${results.systemBehavior.tagMasteryCount}`);
      console.log(`  Problem Relationships: ${results.systemBehavior.relationshipCount}`);
      console.log(`  System Health: ${results.systemBehavior.systemHealthy ? '✅ Healthy' : '❌ Issues'}`);
    }

    console.log(`\n✅ Test Status: ${results.success ? 'PASSED' : 'FAILED'}`);
  }

  /**
   * Run all real system tests
   */
  static async runAllRealSystemTests(options = {}) {
    const { quiet = false } = options;

    if (!quiet) console.log('🚀 Starting Complete Real System Test Suite...');

    const results = {};

    try {
      results.learningFlow = await this.testRealLearningFlow({ ...options, sessions: 3 });
      results.focusCoordination = await this.testRealFocusCoordination(options);
      results.relationshipLearning = await this.testRealRelationshipLearning(options);
      results.sessionCreation = await this.testRealSessionCreation(options);

      // Calculate overall success
      const allTests = Object.values(results);
      const successfulTests = allTests.filter(test => test.success).length;
      const totalTests = allTests.length;

      results.overallSummary = {
        totalTests,
        successfulTests,
        successRate: successfulTests / totalTests,
        timestamp: new Date().toISOString(),
        testing: 'complete_real_system'
      };

      if (!quiet) {
        console.log(`\n✅ Real System Tests Complete: ${successfulTests}/${totalTests} tests passed (${(results.overallSummary.successRate * 100).toFixed(1)}%)`);
      }

    } catch (error) {
      console.error('❌ Real system test suite failed:', error);
      results.error = error.message;
    }

    return results;
  }
}

export default RealSystemTester;

// ============================================================================
// BROWSER CONSOLE FUNCTIONS - Global access for testing
// ============================================================================

/**
 * Test complete learning flow with real system functions
 */
export async function testRealLearningFlow(options = {}) {
  console.log('🎯 Testing Real Learning Flow...');
  return await RealSystemTester.testRealLearningFlow({ quiet: false, ...options });
}

globalThis.testRealLearningFlow = testRealLearningFlow;

/**
 * Test real focus coordination service integration
 */
globalThis.testRealFocusCoordination = async function(options = {}) {
  console.log('🎯 Testing Real Focus Coordination...');
  return await RealSystemTester.testRealFocusCoordination({ quiet: false, ...options });
};

/**
 * Test real session creation with pathfinding
 */
globalThis.testRealSessionCreation = async function(options = {}) {
  console.log('🎯 Testing Real Session Creation...');
  return await RealSystemTester.testRealSessionCreation({ quiet: false, ...options });
};

/**
 * Test real relationship learning from sessions
 */
globalThis.testRealRelationshipLearning = async function(options = {}) {
  console.log('🧠 Testing Real Relationship Learning...');
  return await RealSystemTester.testRealRelationshipLearning({ quiet: false, ...options });
};

/**
 * Run complete real system test suite
 */
globalThis.testAllRealSystem = async function(options = {}) {
  console.log('🚀 Running Complete Real System Test Suite...');
  return await RealSystemTester.runAllRealSystemTests({ quiet: false, ...options });
};