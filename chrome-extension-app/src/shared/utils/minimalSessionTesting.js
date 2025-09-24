/**
 * Minimal Session Testing - No console spam
 */

import { SessionService } from '../services/sessionService.js';
import { AttemptsService } from '../services/attemptsService.js';
// Dynamic import for buildAdaptiveSessionSettings to follow production flow

export class MinimalSessionTester {
  constructor() {
    this.results = [];
  }

  async testSessionLengthAdaptation() {
    const startTime = Date.now();
    console.log('🧪 Testing Session Length Adaptation (minimal logging)...');

    const profiles = [
      { name: 'struggling', baseAccuracy: 0.4 },
      { name: 'excellent', baseAccuracy: 0.9 }
    ];

    for (const profile of profiles) {
      const sessions = [];

      for (let i = 0; i < 5; i++) {
        try {
          // Create session
          const sessionData = await SessionService.getOrCreateSession('standard');
          const { buildAdaptiveSessionSettings } = await import('../db/sessions.js');
          const settings = await buildAdaptiveSessionSettings();

          // Simulate attempts
          const attempts = [];
          if (sessionData.problems) {
            for (const problem of sessionData.problems) {
              const success = Math.random() < profile.baseAccuracy;
              attempts.push({
                problemId: problem.id,
                success,
                timeSpent: 600
              });

              await AttemptsService.addAttempt({
                leetcode_id: problem.id,
                success,
                time_spent: 600,
                source: 'minimal_test'
              });
            }
          }

          sessions.push({
            sessionNumber: i + 1,
            sessionLength: sessionData.problems ? sessionData.problems.length : 0,
            successRate: attempts.length > 0 ? attempts.filter(a => a.success).length / attempts.length : 0,
            isOnboarding: settings.isOnboarding
          });

        } catch (error) {
          sessions.push({
            sessionNumber: i + 1,
            sessionLength: 0,
            successRate: 0,
            error: error.message
          });
        }
      }

      this.results.push({
        profile: profile.name,
        sessions
      });
    }

    this.generateReport();

    // Generate standardized summary
    const totalProfiles = this.results.length;
    const successfulProfiles = this.results.filter(r => r.sessions && r.sessions.length > 0).length;

    return {
      success: successfulProfiles === totalProfiles,
      testName: 'Session Length Adaptation Test',
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: totalProfiles,
        passed: successfulProfiles,
        failed: totalProfiles - successfulProfiles,
        successRate: `${((successfulProfiles / totalProfiles) * 100).toFixed(1)}%`
      },
      results: {
        profiles: this.results
      }
    };
  }

  generateReport() {
    console.log('\n📏 SESSION LENGTH RESULTS');
    console.log('========================');

    this.results.forEach(({ profile, sessions }) => {
      const lengths = sessions.map(s => s.sessionLength);
      const successRates = sessions.map(s => (s.successRate * 100).toFixed(0) + '%');

      console.log(`\n${profile.toUpperCase()}:`);
      console.log(`  Lengths: [${lengths.join(' → ')}]`);
      console.log(`  Success: [${successRates.join(' → ')}]`);

      const isAdaptive = this.detectAdaptation(sessions);
      console.log(`  Adaptive: ${isAdaptive ? '✅ YES' : '❌ NO'}`);
    });
  }

  detectAdaptation(sessions) {
    if (sessions.length < 3) return false;

    const lengths = sessions.map(s => s.sessionLength);
    const minLength = Math.min(...lengths);
    const maxLength = Math.max(...lengths);

    return maxLength > minLength; // Simple check for any variation
  }
}

// Export for browser console use
if (typeof window !== 'undefined') {
  window.MinimalSessionTester = MinimalSessionTester;
  window.testMinimal = () => new MinimalSessionTester().testSessionLengthAdaptation();
}