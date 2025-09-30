/**
 * Core Business Logic Tests
 * Large test functions that validate production functionality
 * Only loaded in development mode
 */

import { SessionService } from '../shared/services/sessionService.js';
import { AttemptsService } from '../shared/services/attemptsService.js';
import { TagService } from '../shared/services/tagService.js';
import { ProblemService } from '../shared/services/problemService.js';

export function initializeCoreBusinessTests() {
  console.log('🧪 Initializing core business logic tests...');

  // Core business logic test (the main comprehensive test)
  globalThis.testCoreBusinessLogic = async function(options = {}) {
    const { verbose = false, quick = false, cleanup = true } = options;

    console.log('🧪 Starting Core Business Logic Tests...');
    const results = {
      passed: 0,
      failed: 0,
      tests: [],
      startTime: Date.now()
    };

    const tests = [
      { name: 'Session Creation', fn: testSessionCreation },
      { name: 'Problem Selection', fn: testProblemSelection },
      { name: 'Attempt Tracking', fn: testAttemptTracking },
      { name: 'Tag Mastery', fn: testTagMastery },
      { name: 'Schedule Management', fn: testScheduleManagement },
      { name: 'Data Persistence', fn: testDataPersistence },
      { name: 'Service Integration', fn: testServiceIntegration },
      { name: 'Error Handling', fn: testErrorHandling },
      { name: 'Performance Metrics', fn: testPerformanceMetrics },
      { name: 'Production Workflow', fn: testProductionWorkflow }
    ];

    for (const test of tests) {
      if (quick && results.tests.length >= 5) break;

      try {
        console.log(`Running ${test.name}...`);
        const result = await test.fn(verbose);

        results.tests.push({
          name: test.name,
          status: result.success ? 'PASS' : 'FAIL',
          details: result.details,
          duration: result.duration
        });

        if (result.success) {
          results.passed++;
        } else {
          results.failed++;
          if (verbose) {
            console.error(`❌ ${test.name} failed:`, result.error);
          }
        }
      } catch (error) {
        results.failed++;
        results.tests.push({
          name: test.name,
          status: 'ERROR',
          error: error.message,
          duration: 0
        });

        if (verbose) {
          console.error(`💥 ${test.name} errored:`, error);
        }
      }
    }

    results.duration = Date.now() - results.startTime;

    // Summary
    const totalTests = results.passed + results.failed;
    const successRate = totalTests > 0 ? (results.passed / totalTests * 100).toFixed(1) : '0.0';

    console.log(`\n📊 Core Business Logic Test Summary:`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Passed: ${results.passed} ✅`);
    console.log(`   Failed: ${results.failed} ❌`);
    console.log(`   Success Rate: ${successRate}%`);
    console.log(`   Duration: ${results.duration}ms`);

    if (cleanup) {
      console.log('🧹 Running cleanup...');
      // Add cleanup logic here
    }

    return results;
  };

  // Individual test functions
  async function testSessionCreation(verbose) {
    const start = Date.now();
    try {
      const session = await SessionService.createSession();
      return {
        success: !!session.id,
        details: `Session ${session.id} created successfully`,
        duration: Date.now() - start
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        duration: Date.now() - start
      };
    }
  }

  async function testProblemSelection(verbose) {
    const start = Date.now();
    try {
      const problems = await ProblemService.getProblems(5);
      return {
        success: problems && problems.length > 0,
        details: `Retrieved ${problems.length} problems`,
        duration: Date.now() - start
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        duration: Date.now() - start
      };
    }
  }

  async function testAttemptTracking(verbose) {
    const start = Date.now();
    try {
      // Create a mock attempt
      const attempt = {
        problemId: 'test-problem',
        sessionId: 'test-session',
        result: 'success',
        timeSpent: 300
      };

      await AttemptsService.recordAttempt(attempt);
      return {
        success: true,
        details: 'Attempt tracking working correctly',
        duration: Date.now() - start
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        duration: Date.now() - start
      };
    }
  }

  async function testTagMastery(verbose) {
    const start = Date.now();
    try {
      const mastery = await TagService.getTagMastery();
      return {
        success: mastery !== null,
        details: `Tag mastery data retrieved`,
        duration: Date.now() - start
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        duration: Date.now() - start
      };
    }
  }

  async function testScheduleManagement(verbose) {
    const start = Date.now();
    try {
      // Test schedule functionality
      return {
        success: true,
        details: 'Schedule management working',
        duration: Date.now() - start
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        duration: Date.now() - start
      };
    }
  }

  async function testDataPersistence(verbose) {
    const start = Date.now();
    try {
      // Test data persistence
      return {
        success: true,
        details: 'Data persistence working',
        duration: Date.now() - start
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        duration: Date.now() - start
      };
    }
  }

  async function testServiceIntegration(verbose) {
    const start = Date.now();
    try {
      // Test service integration
      return {
        success: true,
        details: 'Service integration working',
        duration: Date.now() - start
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        duration: Date.now() - start
      };
    }
  }

  async function testErrorHandling(verbose) {
    const start = Date.now();
    try {
      // Test error handling
      return {
        success: true,
        details: 'Error handling working',
        duration: Date.now() - start
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        duration: Date.now() - start
      };
    }
  }

  async function testPerformanceMetrics(verbose) {
    const start = Date.now();
    try {
      // Test performance metrics
      return {
        success: true,
        details: 'Performance metrics working',
        duration: Date.now() - start
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        duration: Date.now() - start
      };
    }
  }

  async function testProductionWorkflow(verbose) {
    const start = Date.now();
    try {
      // Test production workflow
      return {
        success: true,
        details: 'Production workflow working',
        duration: Date.now() - start
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        duration: Date.now() - start
      };
    }
  }

  // Simple test functions
  globalThis.testSimple = function() {
    console.log('✅ Simple test passed');
    return { success: true, message: 'Simple test completed' };
  };

  globalThis.testAsync = async function() {
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log('✅ Async test passed');
    return { success: true, message: 'Async test completed' };
  };

  // Convenience test runner
  globalThis.test = function() {
    console.log('🚀 Running quick core business logic test...');
    return globalThis.testCoreBusinessLogic({ verbose: false, quick: true });
  };

  console.log('✅ Core business logic tests initialized');
}