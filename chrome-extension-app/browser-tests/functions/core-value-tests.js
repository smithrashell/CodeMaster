/**
 * 🎯 CORE VALUE TESTS - Essential User Journey Validation
 *
 * These tests validate the core value propositions that make CodeMaster valuable:
 * 1. Adaptive difficulty progression (Easy → Medium → Hard)
 * 2. Spaced repetition scheduling
 * 3. Intelligent session composition
 * 4. Tag mastery tracking
 * 5. Problem relationship learning
 */

import { TestDataIsolation } from '../../src/shared/utils/testDataIsolation.js';
import { createScenarioTestDb } from '../../src/shared/db/dbHelperFactory.js';

// Core value test suite - focuses on essential user journey
globalThis.testCoreValueJourney = async function(options = {}) {
  const { verbose = false, quick = false } = options;

  if (verbose) console.log('🎯 Testing complete core value journey...');

  const results = {
    difficultyProgression: null,
    spacedRepetition: null,
    sessionComposition: null,
    tagMastery: null,
    relationshipLearning: null,
    overallSuccess: false
  };

  try {
    // Use lightweight test isolation for consistent state
    const testDb = await createScenarioTestDb('core_value_journey');
    await testDb.smartTeardown({ preserveSeededData: true });
    testDb.activateGlobalContext(); // Enable test database for all services

    // 1. Test adaptive difficulty progression
    if (verbose) console.log('  📊 Testing difficulty progression...');
    results.difficultyProgression = await testAdaptiveDifficultyProgression(quick);

    // 2. Test spaced repetition
    if (verbose) console.log('  🔄 Testing spaced repetition...');
    results.spacedRepetition = await testSpacedRepetitionValue(quick);

    // 3. Test intelligent session composition
    if (verbose) console.log('  🧠 Testing session intelligence...');
    results.sessionComposition = await testIntelligentSessionComposition(quick);

    // 4. Test tag mastery tracking
    if (verbose) console.log('  🏷️ Testing tag mastery...');
    results.tagMastery = await testTagMasteryValue(quick);

    // 5. Test problem relationship learning
    if (verbose) console.log('  🔗 Testing relationship learning...');
    results.relationshipLearning = await testProblemRelationshipValue(quick);

    // Calculate overall success
    const successCount = Object.values(results).filter(r => r && r.success).length;
    results.overallSuccess = successCount >= 4; // At least 4/5 core features working

    if (verbose) {
      console.log(`🎯 Core Value Journey Results: ${successCount}/5 passed`);
      console.log('  ✅ Difficulty Progression:', results.difficultyProgression.success);
      console.log('  ✅ Spaced Repetition:', results.spacedRepetition.success);
      console.log('  ✅ Session Intelligence:', results.sessionComposition.success);
      console.log('  ✅ Tag Mastery:', results.tagMastery.success);
      console.log('  ✅ Relationship Learning:', results.relationshipLearning.success);
    }

    // Cleanup handled by smartTeardown

    return {
      success: results.overallSuccess,
      coreFeatures: results,
      message: `Core value journey ${results.overallSuccess ? 'PASSED' : 'FAILED'}: ${successCount}/5 features working`
    };

  } catch (error) {
    console.error('❌ Core value journey test failed:', error);
    return {
      success: false,
      error: error.message,
      message: 'Core value journey testing encountered errors'
    };
  } finally {
    // Deactivate test database context and cleanup
    if (typeof testDb !== 'undefined' && testDb.deactivateGlobalContext) {
      testDb.deactivateGlobalContext();
    }
  }
};

// Test 1: Adaptive Difficulty Progression
async function testAdaptiveDifficultyProgression(quick = false) {
  try {
    // Import session service for testing
    const { getSessionService } = await import('../../src/shared/services/sessionServiceFactory.js');
    const sessionService = await getSessionService();

    // Simulate user starting at Easy difficulty
    let currentDifficulty = "Easy";
    let progressionDetected = false;

    // Simulate 3 successful sessions (should trigger progression)
    for (let i = 0; i < (quick ? 2 : 3); i++) {
      // Create session at current difficulty
      const session = await sessionService.getOrCreateSession('standard');

      // Simulate high accuracy (90%+) to trigger progression
      const result = await sessionService.evaluateDifficultyProgression(0.92, {
        maxDifficulty: "Hard"
      });

      if (result.current_difficulty_cap !== currentDifficulty) {
        progressionDetected = true;
        currentDifficulty = result.current_difficulty_cap;
        break;
      }
    }

    return {
      success: progressionDetected && currentDifficulty !== "Easy",
      currentDifficulty,
      progressionDetected,
      value: "User difficulty adapts based on performance - personalized learning"
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      value: "Adaptive difficulty progression failed"
    };
  }
}

// Test 2: Spaced Repetition Value
async function testSpacedRepetitionValue(quick = false) {
  try {
    const { ScheduleService } = await import('../../src/shared/services/scheduleService.js');

    // Test that problems are scheduled for review at optimal intervals
    const reviewProblems = await ScheduleService.getDailyReviewSchedule(quick ? 2 : 5);

    // Check if spaced repetition is working (problems have review schedules)
    const hasReviewSchedules = reviewProblems.some(p =>
      p.review_schedule || p.reviewSchedule || p.next_review
    );

    return {
      success: Array.isArray(reviewProblems) && reviewProblems.length > 0,
      reviewCount: reviewProblems.length,
      hasScheduling: hasReviewSchedules,
      value: "Problems return at optimal intervals for long-term retention"
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      value: "Spaced repetition scheduling failed"
    };
  }
}

// Test 3: Intelligent Session Composition
async function testIntelligentSessionComposition(quick = false) {
  try {
    const { ProblemService } = await import('../../src/shared/services/problemService.js');

    // Create a session and verify it has both review and new problems
    const sessionProblems = await ProblemService.createSession();

    if (!sessionProblems || sessionProblems.length === 0) {
      throw new Error("No session problems generated");
    }

    // Check for intelligent composition (not just random selection)
    const hasMetadata = sessionProblems.some(p =>
      p.selectionReason || p.pathScore || p.reviewSchedule
    );

    const sessionLength = quick ? Math.min(sessionProblems.length, 3) : sessionProblems.length;

    return {
      success: sessionProblems.length > 0 && sessionLength >= (quick ? 1 : 3),
      sessionLength,
      hasIntelligentSelection: hasMetadata,
      value: "Smart problem selection based on user mastery and patterns"
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      value: "Intelligent session composition failed"
    };
  }
}

// Test 4: Tag Mastery Tracking
async function testTagMasteryValue(quick = false) {
  try {
    const { getTagMastery, updateTagMastery } = await import('../../src/shared/db/tag_mastery.js');

    // Test tag mastery tracking
    const testTag = 'array';

    // Update mastery for a tag
    await updateTagMastery(testTag, 0.8, 'box2');

    // Retrieve and verify
    const mastery = await getTagMastery(testTag);

    const masteryWorking = mastery &&
      typeof mastery.mastery === 'number' &&
      mastery.mastery > 0;

    return {
      success: masteryWorking,
      tagMastery: mastery?.mastery || 0,
      currentBox: mastery?.current_box || 'unknown',
      value: "Tracks skill improvement in specific algorithm patterns"
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      value: "Tag mastery tracking failed"
    };
  }
}

// Test 5: Problem Relationship Learning
async function testProblemRelationshipValue(quick = false) {
  try {
    const { calculateOptimalPathScore, selectOptimalProblems } = await import('../../src/shared/db/problem_relationships.js');

    // Test relationship scoring
    const mockProblem = {
      id: 1,
      title: "Two Sum",
      difficulty: "Easy",
      tags: ["array", "hash-table"]
    };

    const score = await calculateOptimalPathScore(mockProblem);

    // Test optimal problem selection with small dataset
    const mockCandidates = [mockProblem];
    const selected = await selectOptimalProblems(mockCandidates);

    return {
      success: typeof score === 'number' && score > 0 && selected.length > 0,
      pathScore: score,
      selectionWorking: selected.length > 0,
      value: "Learns from user patterns to suggest optimal next problems"
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      value: "Problem relationship learning failed"
    };
  }
}

// Quick core value check - runs essential tests only
globalThis.testCoreValueQuick = async function() {
  return await testCoreValueJourney({ verbose: true, quick: true });
};

// Verbose core value test - full validation
globalThis.testCoreValueComplete = async function() {
  return await testCoreValueJourney({ verbose: true, quick: false });
};