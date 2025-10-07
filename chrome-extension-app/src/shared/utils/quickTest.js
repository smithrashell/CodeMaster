/**
 * Quick Test - Verify session completion and onboarding progression
 */

import { SessionService } from '../services/sessionService.js';
import { StorageService } from '../services/storageService.js';
import { AttemptsService } from '../services/attemptsService.js';
import { FocusCoordinationService } from '../services/focusCoordinationService.js';

export class QuickTestRunner {
  async testSessionCompletionFlow() {
    console.log('🧪 Testing Session Completion Flow...');

    try {

      // Step 1: Check initial state
      console.log('\n📊 Step 1: Initial State Check');
      const initialState = await StorageService.getSessionState('session_state') || { num_sessions_completed: 0 };
      const initialFocus = await FocusCoordinationService.getFocusDecision('session_state');
      console.log(`Initial sessions completed: ${initialState.num_sessions_completed}`);
      console.log(`Initial onboarding status: ${initialFocus.onboarding}`);

      // Step 2: Create a new session
      console.log('\n🎯 Step 2: Creating New Session');
      const sessionData = await SessionService.getOrCreateSession('standard');
      console.log(`Created session: ${sessionData.id} with ${sessionData.problems.length} problems`);

      // Step 3: Simulate problem attempts
      console.log('\n⚡ Step 3: Simulating Problem Attempts');
      if (sessionData.problems && sessionData.problems.length > 0) {
        for (const problem of sessionData.problems) {
          const success = Math.random() > 0.5; // Random success

          // Create mock problem object for the attempt
          const mockProblem = {
            id: problem.id,
            leetcode_id: problem.id,
            title: problem.title || `Quick Test Problem ${problem.id}`,
            difficulty: problem.difficulty || 'Medium'
          };

          await AttemptsService.addAttempt({
            leetcode_id: problem.id,
            success,
            time_spent: 300,
            source: 'quick_test'
          }, mockProblem);
          console.log(`Attempted problem ${problem.id}: ${success ? 'Success' : 'Failed'}`);
        }
      }

      // Step 4: Complete the session
      console.log('\n✅ Step 4: Completing Session');
      await SessionService.checkAndCompleteSession(sessionData.id);
      console.log(`Session ${sessionData.id} marked as completed`);

      // Step 5: Check final state
      console.log('\n📈 Step 5: Final State Check');
      const finalState = await StorageService.getSessionState('session_state') || { num_sessions_completed: 0 };
      const finalFocus = await FocusCoordinationService.getFocusDecision('session_state');
      console.log(`Final sessions completed: ${finalState.num_sessions_completed}`);
      console.log(`Final onboarding status: ${finalFocus.onboarding}`);

      // Step 6: Verify progression
      console.log('\n🔍 Step 6: Results Analysis');
      const sessionIncremented = finalState.num_sessions_completed > initialState.num_sessions_completed;
      const onboardingChanged = initialFocus.onboarding !== finalFocus.onboarding;

      console.log(`Session counter incremented: ${sessionIncremented ? '✅ YES' : '❌ NO'}`);
      console.log(`Onboarding status changed: ${onboardingChanged ? '✅ YES' : '❌ NO'}`);

      if (finalState.num_sessions_completed >= 1 && finalFocus.onboarding) {
        console.log('⚠️ ISSUE: User has completed sessions but still in onboarding mode');
      } else {
        console.log('✅ Session completion flow working correctly');
      }

      return {
        success: sessionIncremented,
        testName: 'Session Completion Flow Test',
        summary: {
          initialSessions: initialState.num_sessions_completed,
          finalSessions: finalState.num_sessions_completed,
          sessionIncremented,
          initialOnboarding: initialFocus.onboarding,
          finalOnboarding: finalFocus.onboarding,
          onboardingChanged
        }
      };

    } catch (error) {
      console.error('❌ Quick test failed:', error);
      return {
        success: false,
        testName: 'Session Completion Flow Test',
        error: error.message
      };
    }
  }
}

// Export for browser console use
if (typeof globalThis !== 'undefined') {
  globalThis.QuickTestRunner = QuickTestRunner;
  globalThis.testQuick = () => new QuickTestRunner().testSessionCompletionFlow();
}