/**
 * 🔗 Problem Relationship System Integration Tests
 * Tests the complete relationship data flow through real system operations
 *
 * Focus: Testing how problem relationships are updated, stored, and used in session creation
 */

import { TestDataIsolation } from './testDataIsolation.js';
import { ProblemService } from '../services/problemService.js';
import { SessionService } from '../services/sessionService.js';
import { AttemptsService } from '../services/attemptsService.js';
import { FocusCoordinationService } from '../services/focusCoordinationService.js';
import {
  buildRelationshipMap,
  getAllRelationshipStrengths
} from '../db/problem_relationships.js';

export class RelationshipSystemTester {

  /**
   * Test complete relationship data flow across multiple sessions
   */
  static async testRelationshipDataFlow(options = {}) {
    const { sessions = 3, quiet = false } = options;

    if (!quiet) console.log('🔗 Testing Complete Relationship Data Flow...');

    try {
      const testSession = await TestDataIsolation.enterTestMode();
      await TestDataIsolation.seedTestData('default');

      const results = {
        testSession,
        sessions: [],
        relationshipEvolution: [],
        learningEffectiveness: {},
        success: false
      };

      // Track relationship evolution across sessions
      for (let sessionNum = 1; sessionNum <= sessions; sessionNum++) {
        if (!quiet) console.log(`🔄 Running relationship flow session ${sessionNum}/${sessions}...`);

        const sessionResult = await this.runRelationshipFlowSession(sessionNum, quiet);
        results.sessions.push(sessionResult);

        // Track relationship changes
        if (sessionResult.relationshipMap) {
          results.relationshipEvolution.push({
            sessionNum,
            relationshipCount: sessionResult.relationshipMap.size,
            averageStrength: this.calculateAverageRelationshipStrength(sessionResult.relationshipMap),
            timestamp: new Date().toISOString()
          });
        }
      }

      // Analyze learning effectiveness
      results.learningEffectiveness = this.analyzeLearningEffectiveness(results.sessions, results.relationshipEvolution);
      results.success = true;

      if (!quiet) {
        this.displayRelationshipFlowResults(results);
      }

      return results;

    } catch (error) {
      console.error('❌ Relationship data flow test failed:', error);
      return { error: error.message, testSession: TestDataIsolation.getCurrentTestSession() };
    } finally {
      await TestDataIsolation.exitTestMode(true);
    }
  }

  /**
   * Test relationship-based session composition in detail
   */
  static async testRelationshipSessionComposition(options = {}) {
    const { quiet = false } = options;

    if (!quiet) console.log('🎯 Testing Relationship-Based Session Composition...');

    try {
      const testSession = await TestDataIsolation.enterTestMode();
      await TestDataIsolation.seedTestData('experienced_user');

      // Create multiple sessions to test consistency
      const compositionResults = [];

      for (let i = 1; i <= 3; i++) {
        // Get current relationship state
        const relationshipMap = await buildRelationshipMap();

        // Create session using real relationship-based selection
        const sessionData = await SessionService.getOrCreateSession('standard');

        // Analyze how relationships influenced selection
        const compositionAnalysis = await this.analyzeRelationshipInfluence(
          sessionData,
          relationshipMap
        );

        compositionResults.push({
          sessionNum: i,
          sessionId: sessionData.sessionId,
          problemCount: sessionData.problems?.length || 0,
          relationshipInfluence: compositionAnalysis,
          relationshipMapSize: relationshipMap.size
        });

        if (!quiet) {
          console.log(`📊 Session ${i}: ${compositionAnalysis.influenceScore.toFixed(2)} relationship influence, ${compositionAnalysis.connectedProblems} connected problems`);
        }
      }

      return {
        testSession,
        compositionResults,
        averageInfluence: compositionResults.reduce((sum, r) => sum + r.relationshipInfluence.influenceScore, 0) / compositionResults.length,
        success: true
      };

    } catch (error) {
      console.error('❌ Relationship composition test failed:', error);
      return { error: error.message };
    } finally {
      await TestDataIsolation.exitTestMode(true);
    }
  }

  /**
   * Test real-time relationship updates from session completions
   */
  static async testRelationshipUpdates(options = {}) {
    const { quiet = false } = options;

    if (!quiet) console.log('🧠 Testing Real-Time Relationship Updates...');

    try {
      const testSession = await TestDataIsolation.enterTestMode();
      await TestDataIsolation.seedTestData('default');

      // Get initial relationship state
      const initialRelationships = await buildRelationshipMap();
      const initialStrengths = await getAllRelationshipStrengths();

      if (!quiet) {
        console.log(`📊 Initial state: ${initialRelationships.size} relationships, ${initialStrengths.size} strengths`);
      }

      // Create and complete session with high performance
      const sessionData = await SessionService.getOrCreateSession('standard');
      const attempts = await this.simulateHighPerformanceAttempts(sessionData);

      // Complete session (this should trigger updateSuccessPatterns)
      await SessionService.completeSession(sessionData.sessionId, attempts);

      // Get updated relationship state
      const updatedRelationships = await buildRelationshipMap();
      const updatedStrengths = await getAllRelationshipStrengths();

      // Analyze the changes
      const updateAnalysis = {
        relationshipGrowth: updatedRelationships.size - initialRelationships.size,
        strengthChanges: updatedStrengths.size - initialStrengths.size,
        updateEffectiveness: this.analyzeStrengthChanges(initialStrengths, updatedStrengths),
        sessionPerformance: attempts.filter(a => a.success).length / attempts.length
      };

      if (!quiet) {
        console.log(`🔄 Updates: +${updateAnalysis.relationshipGrowth} relationships, ${updateAnalysis.updateEffectiveness.significantChanges} significant changes`);
      }

      return {
        testSession,
        initialState: { relationships: initialRelationships.size, strengths: initialStrengths.size },
        updatedState: { relationships: updatedRelationships.size, strengths: updatedStrengths.size },
        updateAnalysis,
        attempts: attempts.length,
        success: true
      };

    } catch (error) {
      console.error('❌ Relationship updates test failed:', error);
      return { error: error.message };
    } finally {
      await TestDataIsolation.exitTestMode(true);
    }
  }

  /**
   * Test focus coordination integration with relationship system
   */
  static async testFocusRelationshipIntegration(options = {}) {
    const { quiet = false } = options;

    if (!quiet) console.log('🎯 Testing Focus + Relationship Integration...');

    try {
      const testSession = await TestDataIsolation.enterTestMode();
      await TestDataIsolation.seedTestData('experienced_user');

      const integrationResults = [];

      // Test with different focus scenarios
      const focusScenarios = [
        { name: 'single_focus', tags: ['array'] },
        { name: 'dual_focus', tags: ['array', 'hash-table'] },
        { name: 'broad_focus', tags: ['array', 'hash-table', 'tree'] }
      ];

      for (const scenario of focusScenarios) {
        // Set up focus context
        const testStorageService = TestDataIsolation.createTestStorageService();
        await testStorageService.setSessionState('test_user', {
          num_sessions_completed: 10,
          current_focus_tags: scenario.tags
        });

        // Get focus decision
        const focusDecision = await FocusCoordinationService.getFocusDecision('test_user');

        // Create session with focus + relationship integration
        const sessionData = await SessionService.getOrCreateSession('standard');

        // Analyze integration effectiveness
        const integrationAnalysis = this.analyzeFocusRelationshipAlignment(
          sessionData,
          focusDecision,
          scenario.tags
        );

        integrationResults.push({
          scenario: scenario.name,
          focusTags: scenario.tags,
          focusDecision,
          sessionProblems: sessionData.problems?.length || 0,
          integrationAnalysis
        });

        if (!quiet) {
          console.log(`🎯 ${scenario.name}: ${integrationAnalysis.alignmentScore.toFixed(2)} alignment, ${integrationAnalysis.focusCompliance} compliance`);
        }
      }

      return {
        testSession,
        integrationResults,
        averageAlignment: integrationResults.reduce((sum, r) => sum + r.integrationAnalysis.alignmentScore, 0) / integrationResults.length,
        success: true
      };

    } catch (error) {
      console.error('❌ Focus-relationship integration test failed:', error);
      return { error: error.message };
    } finally {
      await TestDataIsolation.exitTestMode(true);
    }
  }

  /**
   * Test relationship learning consistency across user types
   */
  static async testRelationshipLearningConsistency(options = {}) {
    const { quiet = false } = options;

    if (!quiet) console.log('📈 Testing Relationship Learning Consistency...');

    try {
      const consistencyResults = [];

      // Test with different user scenarios
      const scenarios = ['default', 'experienced_user'];

      for (const scenario of scenarios) {
        await TestDataIsolation.enterTestMode(`${scenario}_test`);
        await TestDataIsolation.seedTestData(scenario);

        // Run learning session
        const learningResult = await this.runLearningConsistencyTest(scenario, quiet);
        consistencyResults.push(learningResult);

        await TestDataIsolation.exitTestMode(true);
      }

      // Analyze consistency across scenarios
      const consistencyAnalysis = this.analyzeConsistencyAcrossScenarios(consistencyResults);

      if (!quiet) {
        console.log(`📊 Consistency: ${consistencyAnalysis.consistencyScore.toFixed(2)} across ${scenarios.length} scenarios`);
      }

      return {
        scenarios,
        consistencyResults,
        consistencyAnalysis,
        success: true
      };

    } catch (error) {
      console.error('❌ Relationship learning consistency test failed:', error);
      return { error: error.message };
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Run a single session focused on relationship flow
   */
  static async runRelationshipFlowSession(sessionNum, quiet = false) {
    try {
      // Get pre-session relationship state
      const preRelationshipMap = await buildRelationshipMap();

      // Get focus decision
      const focusDecision = await FocusCoordinationService.getFocusDecision(`test_user_${sessionNum}`);

      // Create session using real relationship-based selection
      const sessionData = await SessionService.getOrCreateSession('standard');

      // Simulate realistic performance with some variation
      const performanceVariation = 0.75 + (Math.random() * 0.2 - 0.1); // 65-85% range
      const attempts = await this.simulateRealisticAttempts(sessionData, performanceVariation);

      // Complete session (triggers updateSuccessPatterns)
      await SessionService.completeSession(sessionData.sessionId, attempts);

      // Get post-session relationship state
      const postRelationshipMap = await buildRelationshipMap();

      return {
        sessionNum,
        sessionId: sessionData.sessionId,
        focusDecision,
        problemCount: sessionData.problems?.length || 0,
        attempts: attempts.length,
        successRate: attempts.filter(a => a.success).length / attempts.length,
        preRelationshipCount: preRelationshipMap.size,
        postRelationshipCount: postRelationshipMap.size,
        relationshipMap: postRelationshipMap,
        relationshipGrowth: postRelationshipMap.size - preRelationshipMap.size
      };

    } catch (error) {
      return { sessionNum, error: error.message };
    }
  }

  /**
   * Simulate realistic user attempts with varied performance
   */
  static async simulateRealisticAttempts(sessionData, targetSuccessRate = 0.75) {
    const attempts = [];

    if (!sessionData.problems || sessionData.problems.length === 0) {
      return attempts;
    }

    for (const problem of sessionData.problems) {
      const isSuccess = Math.random() < targetSuccessRate;

      // Realistic timing based on difficulty and success
      const difficultyMultiplier = problem.difficulty === 'Easy' ? 1.0 :
                                  problem.difficulty === 'Medium' ? 1.5 : 2.0;
      const successMultiplier = isSuccess ? 1.0 : 1.3; // Longer time for failures

      const baseTime = 15 * difficultyMultiplier * successMultiplier; // minutes
      const timeVariation = baseTime * 0.3 * Math.random();
      const timeSpent = (baseTime + timeVariation) * 60 * 1000; // Convert to milliseconds

      const attempt = {
        problem_id: problem.id || problem.leetcode_id,
        success: isSuccess,
        time_spent: timeSpent,
        hints_used: isSuccess ? Math.floor(Math.random() * 2) : Math.floor(Math.random() * 4),
        attempt_date: new Date().toISOString()
      };

      attempts.push(attempt);

      // Add to database
      try {
        await AttemptsService.addAttempt(attempt);
      } catch (error) {
        console.warn('⚠️ Failed to add simulated attempt:', error.message);
      }
    }

    return attempts;
  }

  /**
   * Simulate high-performance attempts to test relationship strengthening
   */
  static async simulateHighPerformanceAttempts(sessionData) {
    return await this.simulateRealisticAttempts(sessionData, 0.9); // 90% success rate
  }

  /**
   * Analyze how relationships influenced session composition
   */
  static async analyzeRelationshipInfluence(sessionData, relationshipMap) {
    if (!sessionData.problems || sessionData.problems.length === 0) {
      return { influenceScore: 0, connectedProblems: 0, analysisComplete: false };
    }

    let connectedProblems = 0;
    let totalConnectionStrength = 0;
    let connectionCount = 0;

    // Analyze connections between selected problems
    for (let i = 0; i < sessionData.problems.length; i++) {
      for (let j = i + 1; j < sessionData.problems.length; j++) {
        const problem1Id = sessionData.problems[i].id || sessionData.problems[i].leetcode_id;
        const problem2Id = sessionData.problems[j].id || sessionData.problems[j].leetcode_id;

        const connections = relationshipMap.get(problem1Id);
        if (connections && connections[problem2Id]) {
          connectedProblems++;
          totalConnectionStrength += connections[problem2Id];
          connectionCount++;
        }
      }
    }

    const averageConnectionStrength = connectionCount > 0 ? totalConnectionStrength / connectionCount : 0;
    const influenceScore = (connectedProblems / Math.max(sessionData.problems.length - 1, 1)) * averageConnectionStrength;

    return {
      influenceScore,
      connectedProblems,
      averageConnectionStrength,
      analysisComplete: true
    };
  }

  /**
   * Calculate average relationship strength from relationship map
   */
  static calculateAverageRelationshipStrength(relationshipMap) {
    let totalStrength = 0;
    let relationshipCount = 0;

    for (const [_problemId, connections] of relationshipMap.entries()) {
      for (const [_targetId, strength] of Object.entries(connections)) {
        totalStrength += strength;
        relationshipCount++;
      }
    }

    return relationshipCount > 0 ? totalStrength / relationshipCount : 0;
  }

  /**
   * Analyze changes in relationship strengths
   */
  static analyzeStrengthChanges(initialStrengths, updatedStrengths) {
    let significantChanges = 0;
    let totalChangesMagnitude = 0;

    for (const [key, updatedStrength] of updatedStrengths.entries()) {
      const initialStrength = initialStrengths.get(key) || 2.0; // Default neutral
      const change = Math.abs(updatedStrength - initialStrength);

      if (change > 0.1) { // Significant change threshold
        significantChanges++;
      }
      totalChangesMagnitude += change;
    }

    return {
      significantChanges,
      averageChangeMagnitude: totalChangesMagnitude / Math.max(updatedStrengths.size, 1),
      newRelationships: updatedStrengths.size - initialStrengths.size
    };
  }

  /**
   * Analyze focus and relationship alignment
   */
  static analyzeFocusRelationshipAlignment(sessionData, focusDecision, expectedFocusTags) {
    if (!sessionData.problems || !focusDecision.activeFocusTags) {
      return { alignmentScore: 0, focusCompliance: false };
    }

    const sessionTags = new Set(sessionData.problems.flatMap(p => p.tags || []));
    const activeFocusTags = new Set(focusDecision.activeFocusTags);
    const expectedTags = new Set(expectedFocusTags);

    // Calculate alignment between session tags and focus tags
    const focusIntersection = [...sessionTags].filter(tag => activeFocusTags.has(tag));
    const alignmentScore = focusIntersection.length / Math.max(activeFocusTags.size, 1);

    // Check compliance with expected focus
    const expectedIntersection = [...activeFocusTags].filter(tag => expectedTags.has(tag));
    const focusCompliance = expectedIntersection.length >= Math.ceil(expectedTags.size * 0.8);

    return {
      alignmentScore,
      focusCompliance,
      sessionTagCount: sessionTags.size,
      focusTagCount: activeFocusTags.size
    };
  }

  /**
   * Analyze learning effectiveness across sessions
   */
  static analyzeLearningEffectiveness(sessions, relationshipEvolution) {
    if (sessions.length === 0) {
      return { effectiveness: 0, trend: 'no_data' };
    }

    // Calculate success rate progression
    const successRates = sessions.map(s => s.successRate).filter(rate => !isNaN(rate));
    const avgSuccessRate = successRates.reduce((sum, rate) => sum + rate, 0) / successRates.length;

    // Calculate relationship growth trend
    const relationshipGrowth = relationshipEvolution.length > 1 ?
      relationshipEvolution[relationshipEvolution.length - 1].relationshipCount - relationshipEvolution[0].relationshipCount : 0;

    // Determine learning trend
    let trend = 'stable';
    if (successRates.length > 2) {
      const firstHalf = successRates.slice(0, Math.ceil(successRates.length / 2));
      const secondHalf = successRates.slice(Math.ceil(successRates.length / 2));

      const firstAvg = firstHalf.reduce((sum, rate) => sum + rate, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, rate) => sum + rate, 0) / secondHalf.length;

      if (secondAvg > firstAvg + 0.05) trend = 'improving';
      else if (secondAvg < firstAvg - 0.05) trend = 'declining';
    }

    return {
      effectiveness: avgSuccessRate,
      trend,
      relationshipGrowth,
      sessionCount: sessions.length
    };
  }

  /**
   * Run learning consistency test for a scenario
   */
  static async runLearningConsistencyTest(scenario, quiet = false) {
    const sessions = [];

    for (let i = 1; i <= 2; i++) {
      const sessionResult = await this.runRelationshipFlowSession(i, quiet);
      sessions.push(sessionResult);
    }

    return {
      scenario,
      sessions,
      consistency: this.calculateConsistencyMetrics(sessions)
    };
  }

  /**
   * Calculate consistency metrics for sessions
   */
  static calculateConsistencyMetrics(sessions) {
    if (sessions.length < 2) return { score: 0 };

    const successRates = sessions.map(s => s.successRate).filter(rate => !isNaN(rate));
    const variance = this.calculateVariance(successRates);

    return {
      score: Math.max(0, 1 - variance), // Lower variance = higher consistency
      variance,
      averageSuccessRate: successRates.reduce((sum, rate) => sum + rate, 0) / successRates.length
    };
  }

  /**
   * Analyze consistency across different scenarios
   */
  static analyzeConsistencyAcrossScenarios(consistencyResults) {
    const consistencyScores = consistencyResults.map(r => r.consistency.score);
    const averageConsistency = consistencyScores.reduce((sum, score) => sum + score, 0) / consistencyScores.length;

    return {
      consistencyScore: averageConsistency,
      scenarios: consistencyResults.length,
      varianceAcrossScenarios: this.calculateVariance(consistencyScores)
    };
  }

  /**
   * Calculate variance of an array of numbers
   */
  static calculateVariance(numbers) {
    if (numbers.length === 0) return 0;

    const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / numbers.length;
  }

  /**
   * Display relationship flow test results
   */
  static displayRelationshipFlowResults(results) {
    console.log('\n🔗 RELATIONSHIP SYSTEM TEST RESULTS');
    console.log('=====================================');
    console.log(`Test Session: ${results.testSession}`);
    console.log(`Sessions Completed: ${results.sessions.length}`);

    if (results.relationshipEvolution.length > 0) {
      const evolution = results.relationshipEvolution;
      console.log('\n📈 Relationship Evolution:');
      console.log(`  Initial Relationships: ${evolution[0]?.relationshipCount || 0}`);
      console.log(`  Final Relationships: ${evolution[evolution.length - 1]?.relationshipCount || 0}`);
      console.log(`  Growth: +${(evolution[evolution.length - 1]?.relationshipCount || 0) - (evolution[0]?.relationshipCount || 0)}`);
    }

    if (results.learningEffectiveness) {
      console.log('\n🎯 Learning Effectiveness:');
      console.log(`  Average Success Rate: ${(results.learningEffectiveness.effectiveness * 100).toFixed(1)}%`);
      console.log(`  Learning Trend: ${results.learningEffectiveness.trend}`);
      console.log(`  Relationship Growth: ${results.learningEffectiveness.relationshipGrowth}`);
    }

    console.log(`\n✅ Test Status: ${results.success ? 'PASSED' : 'FAILED'}`);
  }

  /**
   * Run all relationship system tests
   */
  static async runAllRelationshipTests(options = {}) {
    const { quiet = false } = options;

    if (!quiet) console.log('🔗 Starting Complete Relationship System Test Suite...');

    const results = {};

    try {
      results.dataFlow = await this.testRelationshipDataFlow({ ...options, sessions: 3 });
      results.composition = await this.testRelationshipSessionComposition(options);
      results.updates = await this.testRelationshipUpdates(options);
      results.focusIntegration = await this.testFocusRelationshipIntegration(options);
      results.consistency = await this.testRelationshipLearningConsistency(options);

      // Calculate overall success
      const allTests = Object.values(results);
      const successfulTests = allTests.filter(test => test.success).length;
      const totalTests = allTests.length;

      results.overallSummary = {
        totalTests,
        successfulTests,
        successRate: successfulTests / totalTests,
        timestamp: new Date().toISOString(),
        testing: 'complete_relationship_system'
      };

      if (!quiet) {
        console.log(`\n✅ Relationship System Tests Complete: ${successfulTests}/${totalTests} tests passed (${(results.overallSummary.successRate * 100).toFixed(1)}%)`);
      }

    } catch (error) {
      console.error('❌ Relationship system test suite failed:', error);
      results.error = error.message;
    }

    return results;
  }
}

export default RelationshipSystemTester;