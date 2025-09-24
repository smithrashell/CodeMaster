/**
 * Difficulty Progression Test
 * Quick test to verify progression works correctly
 */

import { getSessionService, getSessionsDB, isUsingMockServices, resetMockServices } from '../services/sessionServiceFactory.js';

/**
 * Test progression with high accuracy to ensure it progresses
 */
export async function testProgression() {
  console.log('🧪 Testing difficulty progression...');

  try {
    // Check if using mocks and reset if so
    const usingMocks = await isUsingMockServices();
    console.log(`🎭 Using ${usingMocks ? 'Mock' : 'Real'} services`);

    if (usingMocks) {
      await resetMockServices();
      console.log('✅ Mock services reset');
    }

    const SessionService = await getSessionService();
    const SessionsDB = await getSessionsDB();

    // Test 3 sessions with high accuracy (90%+) to trigger progression
    for (let i = 1; i <= 3; i++) {
      console.log(`\n--- Session ${i} ---`);

      // Create session
      const session = await SessionService.getOrCreateSession('standard');
      console.log(`📝 Session created with ${session.problems?.length || 0} problems`);

      // Complete session
      await SessionService.checkAndCompleteSession(session.id);
      console.log(`✅ Session ${i} completed`);

      // Evaluate progression with high accuracy (95%)
      const progressResult = await SessionsDB.evaluateDifficultyProgression(0.95, {});
      console.log(`🎯 Session ${i}: 95% accuracy → difficulty cap: ${progressResult.current_difficulty_cap}`);
      console.log(`📊 Sessions completed: ${progressResult.num_sessions_completed}`);
    }

    console.log('\n✅ Difficulty progression test completed!');
    return true;

  } catch (error) {
    console.error('❌ Progression test failed:', error);
    return false;
  }
}

// Make function available in browser console
if (typeof window !== 'undefined') {
  window.testProgression = testProgression;
}