/**
 * Bidirectional Difficulty Cap Test
 * Tests both promotion and demotion logic for dynamic difficulty progression
 *
 * Test scenarios:
 * 1. Promotion: Easy → Medium → Hard (4 problems at 80%+ accuracy)
 * 2. Escape hatch promotion: 8 problems regardless of accuracy
 * 3. Demotion: 3 consecutive sessions <50% accuracy
 * 4. Edge cases: Can't demote from Easy, escape hatches reset
 */

import { evaluateDifficultyProgression } from '../../db/sessions.js';
import { StorageService } from '../../services/storage/storageService.js';
import { getRecentSessionAnalytics, saveSessionAnalytics } from '../../db/sessionAnalytics.js';

/**
 * Helper to create a session analytics record
 */
function createSessionAnalytics(sessionId, accuracy, completedAt) {
  return {
    session_id: sessionId,
    completed_at: completedAt,
    accuracy: accuracy,
    difficulty_breakdown: {
      Easy: { attempted: 2, successful: accuracy >= 0.5 ? 2 : 0 },
      Medium: { attempted: 2, successful: accuracy >= 0.5 ? 2 : 0 },
      Hard: { attempted: 1, successful: accuracy >= 0.5 ? 1 : 0 }
    },
    total_problems: 5,
    successful_problems: Math.round(5 * accuracy),
    total_time_spent: 1000000,
    hints_used: 2,
    tags_attempted: ['Array', 'String']
  };
}

/**
 * Test 1: Normal Promotion (Easy → Medium)
 */
export async function testNormalPromotion() {
  console.log('\n🧪 Test 1: Normal Promotion (Easy → Medium)');

  try {
    // Reset to Easy with proper escape hatch structure
    await StorageService.setSessionState('session_state', {
      id: 'session_state',
      num_sessions_completed: 5,
      current_difficulty_cap: 'Easy',
      difficulty_time_stats: {
        easy: { problems: 4, total_time: 1000000, avg_time: 250000 },
        medium: { problems: 0, total_time: 0, avg_time: 0 },
        hard: { problems: 0, total_time: 0, avg_time: 0 }
      },
      escape_hatches: {
        sessions_at_current_difficulty: 0,
        last_difficulty_promotion: null,
        sessions_without_promotion: 0,
        activated_escape_hatches: []
      }
    });

    // Trigger promotion with 85% accuracy
    const result = await evaluateDifficultyProgression(0.85, {});

    const success = result.current_difficulty_cap === 'Medium';
    console.log(`   ${success ? '✅' : '❌'} Result: ${result.current_difficulty_cap} (expected: Medium)`);
    console.log(`   📊 Sessions at difficulty: ${result.escape_hatches?.sessions_at_current_difficulty || 0}`);

    return { success, result };
  } catch (error) {
    console.error('   ❌ Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test 2: Full Promotion Chain (Easy → Medium → Hard)
 */
export async function testFullPromotionChain() {
  console.log('\n🧪 Test 2: Full Promotion Chain (Easy → Medium → Hard)');

  try {
    // Start at Easy
    await StorageService.setSessionState('session_state', {
      id: 'session_state',
      num_sessions_completed: 5,
      current_difficulty_cap: 'Easy',
      difficulty_time_stats: {
        easy: { problems: 4, total_time: 1000000, avg_time: 250000 },
        medium: { problems: 0, total_time: 0, avg_time: 0 },
        hard: { problems: 0, total_time: 0, avg_time: 0 }
      },
      escape_hatches: {
        sessions_at_current_difficulty: 0,
        last_difficulty_promotion: null,
        sessions_without_promotion: 0,
        activated_escape_hatches: []
      }
    });

    // Step 1: Easy → Medium (90% accuracy)
    const step1 = await evaluateDifficultyProgression(0.90, {});
    console.log(`   Step 1: ${step1.current_difficulty_cap} (expected: Medium)`);

    // Step 2: Medium → Hard (90% accuracy)
    const state = await StorageService.getSessionState('session_state');
    state.difficulty_time_stats.medium.problems = 4;
    state.difficulty_time_stats.medium.total_time = 1200000;
    state.difficulty_time_stats.medium.avg_time = 300000;
    await StorageService.setSessionState('session_state', state);

    const step2 = await evaluateDifficultyProgression(0.90, {});
    console.log(`   Step 2: ${step2.current_difficulty_cap} (expected: Hard)`);

    const success = step1.current_difficulty_cap === 'Medium' &&
                    step2.current_difficulty_cap === 'Hard';
    console.log(`   ${success ? '✅' : '❌'} Full chain completed: Easy → Medium → Hard`);

    return { success, step1, step2 };
  } catch (error) {
    console.error('   ❌ Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test 3: Escape Hatch Promotion (8 problems, low accuracy)
 */
export async function testEscapeHatchPromotion() {
  console.log('\n🧪 Test 3: Escape Hatch Promotion (8 problems, low accuracy)');

  try {
    // Set up state with 8 problems at Easy
    await StorageService.setSessionState('session_state', {
      id: 'session_state',
      num_sessions_completed: 5,
      current_difficulty_cap: 'Easy',
      difficulty_time_stats: {
        easy: { problems: 8, total_time: 2000000, avg_time: 250000 },
        medium: { problems: 0, total_time: 0, avg_time: 0 },
        hard: { problems: 0, total_time: 0, avg_time: 0 }
      },
      escape_hatches: {
        sessions_at_current_difficulty: 2,
        last_difficulty_promotion: null,
        sessions_without_promotion: 2,
        activated_escape_hatches: []
      }
    });

    // Trigger with low accuracy (45%) but escape hatch should still promote
    const result = await evaluateDifficultyProgression(0.45, {});

    const success = result.current_difficulty_cap === 'Medium';
    console.log(`   ${success ? '✅' : '❌'} Result: ${result.current_difficulty_cap} (expected: Medium)`);
    console.log(`   📊 Accuracy: 45% (below threshold, but escape hatch activated)`);

    return { success, result };
  } catch (error) {
    console.error('   ❌ Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test 4: Demotion after 3 Low-Accuracy Sessions (Hard → Medium)
 */
export async function testDemotionHardToMedium() {
  console.log('\n🧪 Test 4: Demotion (Hard → Medium) after 3 low-accuracy sessions');

  try {
    // Set up at Hard difficulty
    await StorageService.setSessionState('session_state', {
      id: 'session_state',
      num_sessions_completed: 10,
      current_difficulty_cap: 'Hard',
      difficulty_time_stats: {
        easy: { problems: 4, total_time: 1000000, avg_time: 250000 },
        medium: { problems: 4, total_time: 1200000, avg_time: 300000 },
        hard: { problems: 4, total_time: 1500000, avg_time: 375000 }
      },
      escape_hatches: {
        sessions_at_current_difficulty: 3,
        last_difficulty_promotion: new Date().toISOString(),
        sessions_without_promotion: 0,
        activated_escape_hatches: []
      }
    });

    // Create 3 low-accuracy session records
    const now = Date.now();
    await saveSessionAnalytics(createSessionAnalytics('session-1', 0.40, now - 3000));
    await saveSessionAnalytics(createSessionAnalytics('session-2', 0.45, now - 2000));
    await saveSessionAnalytics(createSessionAnalytics('session-3', 0.35, now - 1000));

    // Verify we have 3 recent sessions
    const recentSessions = await getRecentSessionAnalytics(3);
    console.log(`   📋 Recent sessions: ${recentSessions.length} (expected: 3)`);
    console.log(`   📊 Accuracies: ${recentSessions.map(s => `${Math.round(s.accuracy * 100)}%`).join(', ')}`);

    // Trigger evaluation with another low accuracy
    const result = await evaluateDifficultyProgression(0.42, {});

    const success = result.current_difficulty_cap === 'Medium';
    console.log(`   ${success ? '✅' : '❌'} Result: ${result.current_difficulty_cap} (expected: Medium)`);
    console.log(`   🔽 Demotion triggered: Hard → Medium`);

    return { success, result };
  } catch (error) {
    console.error('   ❌ Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test 5: Demotion Chain (Hard → Medium → Easy)
 */
export async function testFullDemotionChain() {
  console.log('\n🧪 Test 5: Full Demotion Chain (Hard → Medium → Easy)');

  try {
    // Start at Hard
    await StorageService.setSessionState('session_state', {
      id: 'session_state',
      num_sessions_completed: 20,
      current_difficulty_cap: 'Hard',
      difficulty_time_stats: {
        easy: { problems: 4, total_time: 1000000, avg_time: 250000 },
        medium: { problems: 4, total_time: 1200000, avg_time: 300000 },
        hard: { problems: 4, total_time: 1500000, avg_time: 375000 }
      },
      escape_hatches: {
        sessions_at_current_difficulty: 3,
        last_difficulty_promotion: new Date().toISOString(),
        sessions_without_promotion: 0,
        activated_escape_hatches: []
      }
    });

    // Create 3 low-accuracy sessions for Hard → Medium demotion
    let now = Date.now();
    await saveSessionAnalytics(createSessionAnalytics('hard-1', 0.40, now - 3000));
    await saveSessionAnalytics(createSessionAnalytics('hard-2', 0.42, now - 2000));
    await saveSessionAnalytics(createSessionAnalytics('hard-3', 0.38, now - 1000));

    const step1 = await evaluateDifficultyProgression(0.40, {});
    console.log(`   Step 1: ${step1.current_difficulty_cap} (expected: Medium)`);

    // Create 3 more low-accuracy sessions for Medium → Easy demotion
    now = Date.now();
    await saveSessionAnalytics(createSessionAnalytics('medium-1', 0.35, now - 3000));
    await saveSessionAnalytics(createSessionAnalytics('medium-2', 0.48, now - 2000));
    await saveSessionAnalytics(createSessionAnalytics('medium-3', 0.42, now - 1000));

    const step2 = await evaluateDifficultyProgression(0.45, {});
    console.log(`   Step 2: ${step2.current_difficulty_cap} (expected: Easy)`);

    const success = step1.current_difficulty_cap === 'Medium' &&
                    step2.current_difficulty_cap === 'Easy';
    console.log(`   ${success ? '✅' : '❌'} Full chain completed: Hard → Medium → Easy`);

    return { success, step1, step2 };
  } catch (error) {
    console.error('   ❌ Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test 6: No Demotion with Only 2 Low Sessions
 */
export async function testNoDemotionWithTwoLowSessions() {
  console.log('\n🧪 Test 6: No Demotion with only 2 low-accuracy sessions');

  try {
    await StorageService.setSessionState('session_state', {
      id: 'session_state',
      num_sessions_completed: 10,
      current_difficulty_cap: 'Hard',
      difficulty_time_stats: {
        easy: { problems: 4, total_time: 1000000, avg_time: 250000 },
        medium: { problems: 4, total_time: 1200000, avg_time: 300000 },
        hard: { problems: 4, total_time: 1500000, avg_time: 375000 }
      },
      escape_hatches: {
        sessions_at_current_difficulty: 2,
        last_difficulty_promotion: new Date().toISOString(),
        sessions_without_promotion: 0,
        activated_escape_hatches: []
      }
    });

    // Create only 2 low-accuracy sessions (not enough for demotion)
    const now = Date.now();
    await saveSessionAnalytics(createSessionAnalytics('session-1', 0.40, now - 2000));
    await saveSessionAnalytics(createSessionAnalytics('session-2', 0.45, now - 1000));

    const result = await evaluateDifficultyProgression(0.42, {});

    const success = result.current_difficulty_cap === 'Hard';
    console.log(`   ${success ? '✅' : '❌'} Result: ${result.current_difficulty_cap} (expected: Hard - no demotion)`);
    console.log(`   📊 Only 2 low sessions - demotion requires 3 consecutive`);

    return { success, result };
  } catch (error) {
    console.error('   ❌ Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test 7: Can't Demote from Easy
 */
export async function testCannotDemoteFromEasy() {
  console.log('\n🧪 Test 7: Cannot demote from Easy difficulty');

  try {
    await StorageService.setSessionState('session_state', {
      id: 'session_state',
      num_sessions_completed: 10,
      current_difficulty_cap: 'Easy',
      difficulty_time_stats: {
        easy: { problems: 4, total_time: 1000000, avg_time: 250000 },
        medium: { problems: 0, total_time: 0, avg_time: 0 },
        hard: { problems: 0, total_time: 0, avg_time: 0 }
      },
      escape_hatches: {
        sessions_at_current_difficulty: 5,
        last_difficulty_promotion: null,
        sessions_without_promotion: 5,
        activated_escape_hatches: []
      }
    });

    // Create 3 low-accuracy sessions at Easy
    const now = Date.now();
    await saveSessionAnalytics(createSessionAnalytics('easy-1', 0.30, now - 3000));
    await saveSessionAnalytics(createSessionAnalytics('easy-2', 0.35, now - 2000));
    await saveSessionAnalytics(createSessionAnalytics('easy-3', 0.40, now - 1000));

    const result = await evaluateDifficultyProgression(0.38, {});

    const success = result.current_difficulty_cap === 'Easy';
    console.log(`   ${success ? '✅' : '❌'} Result: ${result.current_difficulty_cap} (expected: Easy - no demotion possible)`);
    console.log(`   🛑 Easy is the minimum difficulty`);

    return { success, result };
  } catch (error) {
    console.error('   ❌ Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test 8: Escape Hatches Reset After Demotion
 */
export async function testEscapeHatchesResetAfterDemotion() {
  console.log('\n🧪 Test 8: Escape hatches reset after demotion');

  try {
    await StorageService.setSessionState('session_state', {
      id: 'session_state',
      num_sessions_completed: 10,
      current_difficulty_cap: 'Hard',
      difficulty_time_stats: {
        easy: { problems: 4, total_time: 1000000, avg_time: 250000 },
        medium: { problems: 4, total_time: 1200000, avg_time: 300000 },
        hard: { problems: 8, total_time: 3000000, avg_time: 375000 }
      },
      escape_hatches: {
        sessions_at_current_difficulty: 3,
        last_difficulty_promotion: new Date().toISOString(),
        sessions_without_promotion: 0,
        activated_escape_hatches: ['high_problem_count']
      }
    });

    // Create 3 low-accuracy sessions
    const now = Date.now();
    await saveSessionAnalytics(createSessionAnalytics('session-1', 0.40, now - 3000));
    await saveSessionAnalytics(createSessionAnalytics('session-2', 0.42, now - 2000));
    await saveSessionAnalytics(createSessionAnalytics('session-3', 0.38, now - 1000));

    const result = await evaluateDifficultyProgression(0.40, {});

    const resetSuccess = result.escape_hatches?.sessions_at_current_difficulty === 0;
    const demotionSuccess = result.current_difficulty_cap === 'Medium';
    const success = demotionSuccess && resetSuccess;

    console.log(`   ${demotionSuccess ? '✅' : '❌'} Demoted: ${result.current_difficulty_cap} (expected: Medium)`);
    console.log(`   ${resetSuccess ? '✅' : '❌'} Escape hatches reset: ${result.escape_hatches?.sessions_at_current_difficulty} (expected: 0)`);
    console.log(`   ${success ? '✅' : '❌'} Overall test passed`);

    return { success, result };
  } catch (error) {
    console.error('   ❌ Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Run all bidirectional difficulty cap tests
 */
export async function runAllBidirectionalTests() {
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║  Bidirectional Difficulty Cap Test Suite            ║');
  console.log('╚═══════════════════════════════════════════════════════╝');

  const results = {
    promotion: {},
    demotion: {},
    edgeCases: {}
  };

  // Promotion tests
  results.promotion.normal = await testNormalPromotion();
  results.promotion.fullChain = await testFullPromotionChain();
  results.promotion.escapeHatch = await testEscapeHatchPromotion();

  // Demotion tests
  results.demotion.hardToMedium = await testDemotionHardToMedium();
  results.demotion.fullChain = await testFullDemotionChain();
  results.demotion.twoLowSessions = await testNoDemotionWithTwoLowSessions();

  // Edge case tests
  results.edgeCases.cannotDemoteEasy = await testCannotDemoteFromEasy();
  results.edgeCases.escapeHatchReset = await testEscapeHatchesResetAfterDemotion();

  // Summary
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║  Test Summary                                        ║');
  console.log('╚═══════════════════════════════════════════════════════╝');

  const allResults = [
    ...Object.values(results.promotion),
    ...Object.values(results.demotion),
    ...Object.values(results.edgeCases)
  ];

  const passed = allResults.filter(r => r.success).length;
  const failed = allResults.filter(r => !r.success).length;

  console.log(`\n📊 Results: ${passed}/${allResults.length} tests passed`);
  if (failed > 0) {
    console.log(`❌ ${failed} test(s) failed`);
  } else {
    console.log('✅ All tests passed!');
  }

  return results;
}

// Make available in browser console
if (typeof window !== 'undefined') {
  window.testBidirectionalDifficulty = runAllBidirectionalTests;
  window.testNormalPromotion = testNormalPromotion;
  window.testDemotionHardToMedium = testDemotionHardToMedium;
}
