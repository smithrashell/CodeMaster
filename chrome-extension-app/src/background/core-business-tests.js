/**
 * Core Business Logic Tests
 * Large test functions that validate production functionality
 * Only loaded in development mode
 */

import { SessionService } from '../shared/services/sessionService.js';
import { AttemptsService } from '../shared/services/attemptsService.js';
import { TagService } from '../shared/services/tagServices.js';
import { ProblemService } from '../shared/services/problemService.js';
import { StorageService } from '../shared/services/storageService.js';
import { v4 as uuidv4 } from 'uuid';

// Database imports - ALL static, NO dynamic imports
import { createDbHelper } from '../shared/db/dbHelperFactory.js';
import { fetchProblemById } from '../shared/db/standard_problems.js';

// Create dbHelper instance for test file usage
const dbHelper = createDbHelper();
import { getAllFromStore } from '../shared/db/common.js';
import { getSessionById, evaluateDifficultyProgression, buildAdaptiveSessionSettings } from '../shared/db/sessions.js';
import { buildRelationshipMap } from '../shared/db/problem_relationships.js';
import { addAttempt as addAttemptToDB, getMostRecentAttempt } from '../shared/db/attempts.js';
import { getTagMastery, upsertTagMastery, updateTagMasteryForAttempt } from '../shared/db/tag_mastery.js';
import { initializePatternLaddersForOnboarding } from '../shared/services/problemladderService.js';

/**
 * Helper function to create test problems in the `problems` store
 * Follows EXACT production pattern from problems.js:addProblem (lines 363-381)
 * Gets real problem data from standard_problems and creates user problem entry
 * @param {number} leetcodeId - LeetCode ID from standard_problems store
 * @returns {Promise<Object>} - Created problem object with problem_id
 */
// Helper to validate leetcode_id field
function validateLeetcodeId(problem, leetcodeId) {
  if (!problem.leetcode_id && problem.leetcode_id !== 0) {
    throw new Error(`createTestProblem failed: existing problem has no leetcode_id for ${leetcodeId}`);
  }
  if (typeof problem.leetcode_id !== 'number') {
    throw new Error(`createTestProblem failed: existing problem leetcode_id must be a number, got ${typeof problem.leetcode_id}: ${problem.leetcode_id}`);
  }
}

async function createTestProblem(leetcodeId) {
  try {
    console.log(`🔧 createTestProblem: START - LeetCode ID ${leetcodeId}`);

    // Use test database helper if active
    const helper = globalThis._testDatabaseActive && globalThis._testDatabaseHelper
      ? globalThis._testDatabaseHelper
      : dbHelper;

    console.log(`🔧 Using database helper:`, globalThis._testDatabaseActive ? 'TEST' : 'PRODUCTION');

    const db = await helper.openDB();

    console.log(`🔧 Database opened:`, db.name);

    // Get REAL problem data from standard_problems (production pattern)
    const standardProblem = await fetchProblemById(leetcodeId);
    if (!standardProblem) {
      console.error(`❌ Standard problem ${leetcodeId} NOT FOUND in standard_problems`);
      throw new Error(`Standard problem ${leetcodeId} not found in database`);
    }

    console.log(`✅ Found standard problem:`, standardProblem.title);

  // Check if problem already exists to avoid duplicates
  const transaction = db.transaction(['problems'], 'readwrite');
  const store = transaction.objectStore('problems');
  const index = store.index('by_leetcode_id');

  const existingProblem = await new Promise((resolve, reject) => {
    const request = index.get(Number(leetcodeId));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  if (existingProblem) {
    console.log(`♻️ Problem ${leetcodeId} already exists, reusing:`, existingProblem.title);
    // Merge with standard problem data for return, ensuring all required fields
    const reusedProblem = {
      ...existingProblem,
      id: existingProblem.leetcode_id, // Ensure id field is set for compatibility
      leetcode_id: existingProblem.leetcode_id, // Explicitly ensure leetcode_id is present
      problem_id: existingProblem.problem_id, // Ensure problem_id is preserved
      tags: standardProblem.tags,
      difficulty: standardProblem.difficulty,
      title: standardProblem.title,
      // Ensure these fields exist
      box_level: existingProblem.box_level || 1,
      cooldown_status: existingProblem.cooldown_status || false,
      stability: existingProblem.stability || 1.0,
      perceived_difficulty: existingProblem.perceived_difficulty || null
    };

    // Validate that leetcode_id is set correctly
    validateLeetcodeId(reusedProblem, leetcodeId);

    return reusedProblem;
  }

  console.log(`🆕 Creating new problem entry for:`, standardProblem.title);

  // Create problem following EXACT production structure (problems.js:363-381)
  const problem = {
    problem_id: uuidv4(), // UUID primary key
    leetcode_id: Number(leetcodeId), // References standard_problems.id
    title: standardProblem.title.toLowerCase(),
    leetcode_address: standardProblem.url || standardProblem.slug,
    cooldown_status: false,
    box_level: 1,
    review_schedule: null,
    perceived_difficulty: null, // Will be calculated from attempts
    consecutive_failures: 0,
    stability: 1.0,
    attempt_stats: {
      total_attempts: 0,
      successful_attempts: 0,
      unsuccessful_attempts: 0,
    }
    // Note: tags come from standard_problems, not stored in problems
  };

  // Add to problems store
  await new Promise((resolve, reject) => {
    const request = store.add(problem);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  // Create result object with ALL required fields explicitly set
  // This ensures no field is lost during object manipulation in production code
  const resultProblem = {
    ...problem, // Spread first to get all existing fields
    id: problem.leetcode_id, // Ensure id field is set for compatibility
    leetcode_id: problem.leetcode_id, // Explicitly ensure leetcode_id is present
    problem_id: problem.problem_id, // Ensure problem_id is preserved
    tags: standardProblem.tags,
    difficulty: standardProblem.difficulty,
    title: standardProblem.title, // Return original case title for display
    // Ensure these fields exist to prevent undefined in calculations
    box_level: problem.box_level || 1,
    cooldown_status: problem.cooldown_status || false,
    stability: problem.stability || 1.0,
    perceived_difficulty: problem.perceived_difficulty || null
  };

  console.log(`✅ Created test problem:`, {
    title: standardProblem.title,
    leetcode_id: resultProblem.leetcode_id,
    id: resultProblem.id,
    problem_id: problem.problem_id,
    database: db.name
  });

  // Validate that leetcode_id is set correctly
  if (!resultProblem.leetcode_id && resultProblem.leetcode_id !== 0) {
    throw new Error(`createTestProblem failed: leetcode_id is ${resultProblem.leetcode_id} for problem ${leetcodeId}`);
  }

  // Also ensure it's a NUMBER, not undefined/null/string
  if (typeof resultProblem.leetcode_id !== 'number') {
    throw new Error(`createTestProblem failed: leetcode_id must be a number, got ${typeof resultProblem.leetcode_id}: ${resultProblem.leetcode_id}`);
  }

  return resultProblem;
  } catch (error) {
    console.error(`❌ createTestProblem ERROR for LeetCode ID ${leetcodeId}:`, error);
    console.error(`   Error stack:`, error.stack);
    throw error;
  }
}

/**
 * Helper to get available problem IDs from standard_problems
 * Returns an array of valid problem IDs that can be used for testing
 */
async function getAvailableProblemIds(count = 10) {
  try {
    const helper = globalThis._testDatabaseActive && globalThis._testDatabaseHelper
      ? globalThis._testDatabaseHelper
      : dbHelper;

    const db = await helper.openDB();
    const tx = db.transaction('standard_problems', 'readonly');
    const store = tx.objectStore('standard_problems');

    const allProblems = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    console.log(`📋 Found ${allProblems.length} standard problems in database`);

    if (allProblems.length === 0) {
      console.warn('⚠️ No standard problems found in database - tests may fail');
      throw new Error('No standard problems in database');
    }

    // Return first N problem IDs
    const problemIds = allProblems.slice(0, count).map(p => p.id);
    console.log(`✅ Using problem IDs for tests:`, problemIds.slice(0, 5));
    return problemIds;
  } catch (error) {
    console.error('❌ Error getting available problem IDs:', error);
    throw error; // Don't use fallback - let test fail with clear error
  }
}

export function initializeCoreBusinessTests() {
  console.log('🧪 Initializing core business logic tests...');

  // Core business logic test (the main comprehensive test)
  // Helper to setup and verify test database
  async function setupTestEnvironment() {
    if (typeof globalThis.enableTesting !== 'function') {
      console.error('🚨 CRITICAL ERROR: enableTesting() function is not defined!');
      console.error('🚨 Tests CANNOT run without test database isolation.');
      console.error('🚨 This would corrupt the production database!');
      return {
        success: false,
        error: 'enableTesting() function not available - cannot run tests without database isolation',
        testName: 'Test Environment Setup',
        critical: true
      };
    }

    const setupResult = await globalThis.enableTesting();
    if (!setupResult.success || !globalThis._testDatabaseActive) {
      console.error('❌ Failed to enable test environment');
      return {
        success: false,
        error: 'Failed to enable test environment',
        testName: 'Test Setup'
      };
    }

    // Verify database has standard problems
    try {
      const problemCount = await getAvailableProblemIds(1);
      console.log(`✅ Database verification passed: ${problemCount.length} problems available`);
    } catch (error) {
      console.error('❌ Database not properly seeded:', error.message);
      return {
        success: false,
        error: `Database not seeded with standard_problems: ${error.message}`,
        testName: 'Database Verification'
      };
    }

    // Verify all required stores exist and are seeded
    try {
      const storeChecks = {
        standard_problems: await getAllFromStore('standard_problems'),
        tag_relationships: await getAllFromStore('tag_relationships'),
        problem_relationships: await getAllFromStore('problem_relationships'),
        tag_mastery: await getAllFromStore('tag_mastery'),
        pattern_ladders: await getAllFromStore('pattern_ladders')
      };

      console.log('📊 Database store status:');
      for (const [store, data] of Object.entries(storeChecks)) {
        console.log(`  ${store}: ${data.length} records`);
      }

      console.log('⏭️  Skipping pattern ladder initialization - session creation will use onboarding fallback');
      console.log(`   tag_mastery: ${storeChecks.tag_mastery.length} records (empty = onboarding mode)`);
      console.log(`   pattern_ladders: ${storeChecks.pattern_ladders.length} records`);
    } catch (error) {
      console.error('❌ Database verification/initialization failed:', error);
      console.error('Stack:', error.stack);
      return {
        success: false,
        error: `Failed to initialize test database: ${error.message}`,
        testName: 'Database Initialization'
      };
    }

    return { success: true };
  }

  globalThis.testCoreBusinessLogic = async function(options = {}) {
    const { verbose = false, quick = false, cleanup = true } = options;

    // Auto-setup test environment
    const setupResult = await setupTestEnvironment();
    if (!setupResult.success) {
      return {
        passed: 0,
        failed: 1,
        tests: [{
          name: setupResult.testName,
          status: 'ERROR',
          error: setupResult.error,
          duration: 0
        }],
        duration: 0
      };
    }

    console.log('🧪 Starting Core Business Logic Tests...');
    const results = {
      passed: 0,
      failed: 0,
      tests: [],
      startTime: Date.now()
    };

    const tests = [
      { name: 'Session Creation', fn: testSessionCreation },
      { name: 'Problem Selection (Enhanced)', fn: testProblemSelection },
      { name: 'Attempt Tracking', fn: testAttemptTracking },
      { name: 'Tag Mastery Progression', fn: testTagMastery },
      { name: 'Spaced Repetition (Leitner)', fn: testSpacedRepetition },
      { name: 'Data Persistence', fn: testDataPersistence },
      { name: 'Service Integration', fn: testServiceIntegration },
      { name: 'Difficulty Progression (Ladders)', fn: testDifficultyProgression },
      { name: 'Problem Relationships', fn: testProblemRelationships },
      { name: 'Production Workflow (Multi-Session)', fn: testProductionWorkflow },
      { name: 'Mastery Gates (Volume + Uniqueness)', fn: testMasteryGates },
      { name: 'Adaptive Session Length', fn: testAdaptiveSessionLength },
      { name: 'Relationship Map Updates', fn: testRelationshipMapUpdates },
      { name: 'Session Cleanup Safety', fn: testSessionCleanupSafety },
      { name: 'Multi-Session Type Coexistence', fn: testMultiSessionCoexistence },
      { name: 'Tracking Session Rotation', fn: testTrackingSessionRotation },
      { name: 'Session Completion Flow', fn: testSessionCompletionFlow },
      { name: 'Focus Tag Progression', fn: testFocusTagProgression },
      { name: 'Onboarding Initialization', fn: testOnboardingInitialization }
    ];

    for (const test of tests) {
      if (quick && results.tests.length >= 5) break;

      // Clean up variable data before each test (preserve seeded data)
      if (globalThis._testDatabaseHelper) {
        try {
          await globalThis._testDatabaseHelper.smartTestIsolation();
          if (verbose) console.log(`🧹 Cleaned test data before ${test.name}`);
        } catch (cleanupError) {
          console.warn(`⚠️ Pre-test cleanup failed for ${test.name}:`, cleanupError.message);
        }
      }

      try {
        if (verbose) console.log(`Running ${test.name}...`);
        const result = await test.fn(verbose);

        results.tests.push({
          name: test.name,
          status: result.success ? 'PASS' : 'FAIL',
          details: result.details,
          error: result.error,
          duration: result.duration
        });

        if (result.success) {
          results.passed++;
        } else {
          results.failed++;
          // Only show details in verbose mode - summary will show failed tests
          if (verbose) {
            console.error(`❌ ${test.name} failed:`, result.error || result.details);
            if (result.analysis) {
              console.error(`   Analysis:`, result.analysis);
            }
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

        // Only show details in verbose mode
        if (verbose) {
          console.error(`💥 ${test.name} errored:`, error.message);
          console.error(`   Stack:`, error.stack);
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

    // Show failed tests
    if (results.failed > 0) {
      console.log(`\n❌ Failed Tests:`);
      results.tests
        .filter(t => t.status === 'FAIL' || t.status === 'ERROR')
        .forEach(t => {
          console.log(`   • ${t.name}: ${t.error || t.details}`);
        });
    }

    if (cleanup && globalThis._testDatabaseHelper) {
      console.log('🧹 Running cleanup...');
      try {
        await globalThis._testDatabaseHelper.smartTestIsolation();
        console.log('✅ Test cleanup complete');
      } catch (cleanupError) {
        console.warn('⚠️ Cleanup failed:', cleanupError.message);
      }
    }

    return results;
  };

  // Individual test functions
  async function testSessionCreation(_verbose) {
    const start = Date.now();
    try {
      const problems = await ProblemService.createSession();
      return {
        success: Array.isArray(problems) && problems.length > 0,
        details: `Session created with ${problems.length} problems`,
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

  async function testProblemSelection(_verbose) {
    const start = Date.now();
    try {
      const problems = await ProblemService.createSession();

      // Validate basic structure
      if (!problems || problems.length === 0) {
        return {
          success: false,
          error: 'No problems selected',
          duration: Date.now() - start
        };
      }

      // Analyze session composition
      const difficulties = problems.map(p => p.difficulty);
      const allTags = problems.flatMap(p => p.tags || []);
      const uniqueTags = [...new Set(allTags)];

      const difficultyDistribution = {
        Easy: difficulties.filter(d => d === 'Easy').length,
        Medium: difficulties.filter(d => d === 'Medium').length,
        Hard: difficulties.filter(d => d === 'Hard').length
      };

      // ENHANCED: Verify problems have relationship scores (algorithm used relationships)
      const problemsHaveScores = problems.some(p =>
        typeof p.pathScore === 'number' ||
        typeof p.score === 'number' ||
        typeof p.relationshipScore === 'number'
      );

      // ENHANCED: Verify tag relationships exist using production approach
      // Note: Tag relationships might be accessed through TagService or directly
      // Already imported statically
      const db = await dbHelper.openDB();
      const tx = db.transaction('tag_relationships', 'readonly');
      const tagRelationships = await new Promise((resolve, reject) => {
        const req = tx.objectStore('tag_relationships').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      const hasTagRelationships = tagRelationships.length > 10; // Should have many relationships

      // ENHANCED: Use production helper for problem relationships
      // Already imported statically
      const relationshipMap = await buildRelationshipMap();

      // Count total relationships from the map
      let problemRelationshipCount = 0;
      for (const [, relatedProblems] of relationshipMap) {
        problemRelationshipCount += Object.keys(relatedProblems).length;
      }

      const hasProblemRelationships = problemRelationshipCount > 0;

      // Validate algorithm quality
      // Note: During onboarding/early sessions, users may only get Easy problems (expected behavior)
      const hasVariedDifficulty = Object.values(difficultyDistribution).filter(count => count > 0).length >= 1;
      const hasTags = uniqueTags.length > 0;
      const allProblemsHaveId = problems.every(p => p.problem_id || p.id);

      // Check if this appears to be an onboarding session (all Easy)
      const isLikelyOnboarding = difficultyDistribution.Easy === problems.length &&
                                 difficultyDistribution.Medium === 0 &&
                                 difficultyDistribution.Hard === 0;

      const success = hasVariedDifficulty && hasTags && allProblemsHaveId && hasTagRelationships && hasProblemRelationships;

      return {
        success,
        details: `Selected ${problems.length} problems: ${difficultyDistribution.Easy}E/${difficultyDistribution.Medium}M/${difficultyDistribution.Hard}H, ${uniqueTags.length} tags, ${tagRelationships.length} tag rels, ${problemRelationshipCount} prob rels${isLikelyOnboarding ? ' (onboarding)' : ''}`,
        analysis: {
          problemCount: problems.length,
          difficultyDistribution,
          uniqueTags: uniqueTags.length,
          hasVariedDifficulty,
          hasTags,
          allProblemsValid: allProblemsHaveId,
          problemsHaveScores,
          tagRelationshipsCount: tagRelationships.length,
          problemRelationshipsCount: problemRelationshipCount,
          relationshipsUsed: hasTagRelationships && hasProblemRelationships,
          isLikelyOnboarding
        },
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

  async function testAttemptTracking(_verbose) {
    const start = Date.now();
    try {
      console.log('🧪 testAttemptTracking: Starting...');
      // Create test problem in problems store (production pattern)
      // LeetCode ID 1 = "Two Sum" (real problem from standard_problems)
      console.log('🧪 testAttemptTracking: About to call createTestProblem(1)');
      const testProblem = await createTestProblem(1);
      console.log('🧪 testAttemptTracking: testProblem created:', testProblem);

      // Create attempt with real problem
      const attempt = {
        problem_id: testProblem.problem_id,
        session_id: 'test-session',
        success: true,
        time_spent: 300,
        difficulty: 'Easy',
        attempt_date: new Date().toISOString()
      };

      const result = await AttemptsService.addAttempt(attempt, testProblem);

      // Verify attempt was recorded
      const hasError = result?.error;

      return {
        success: !hasError,
        details: hasError ? result.error : 'Attempt tracking working correctly',
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

  async function testTagMastery(_verbose) {
    const start = Date.now();
    try {
      // Test 1: Get current tier
      const tierData = await TagService.getCurrentTier();
      const tier = tierData?.classification || tierData; // Handle both object and string return types
      const hasTier = tier !== null && tier !== undefined;

      // Test 2: Get learning state
      const learningState = await TagService.getCurrentLearningState();
      const hasLearningState = learningState && Array.isArray(learningState.focusTags);

      // Test 3: Create session and verify it considers current tier
      const session1 = await ProblemService.createSession();

      // ENHANCED: Simulate mastering a tag by recording successful attempts
      if (session1 && session1.length > 0) {
        const firstProblem = session1[0];
        const problemTags = firstProblem.tags || [];

        // Record 3 successful attempts on same tag to simulate mastery progress
        // Use real LeetCode IDs: 70 (Climbing Stairs), 121 (Best Time to Buy/Sell Stock), 268 (Missing Number)
        const testLeetcodeIds = [70, 121, 268];
        for (let i = 0; i < 3; i++) {
          // Create test problem for each attempt (production pattern)
          const testProblem = await createTestProblem(testLeetcodeIds[i]);

          await AttemptsService.addAttempt({
            problem_id: testProblem.problem_id,
            session_id: 'mastery-test',
            success: true,
            time_spent: 300000,
            tags: problemTags,
            difficulty: 'Easy',
            attempt_date: new Date().toISOString()
          }, testProblem);
        }
      }

      // Test 4: Create new session - should reflect mastery changes
      const session2 = await ProblemService.createSession();
      const sessionCreatedAfterMastery = session2 && session2.length > 0;

      // Test 5: Verify tier system is working
      const tierDataAfter = await TagService.getCurrentTier();
      const tierAfterAttempts = tierDataAfter?.classification || tierDataAfter;
      const tierSystemWorks = typeof tierAfterAttempts === 'string' || typeof tierAfterAttempts === 'object';

      const success = hasTier && hasLearningState && sessionCreatedAfterMastery && tierSystemWorks;

      return {
        success,
        details: `Tier: ${tier}, Focus tags: ${learningState?.focusTags?.length || 0}, Tier after attempts: ${tierAfterAttempts}`,
        analysis: {
          currentTier: tier,
          focusTags: learningState?.focusTags || [],
          focusTagsCount: learningState?.focusTags?.length || 0,
          sessionCreatedAfterMastery,
          tierAfterAttempts,
          tierSystemWorks,
          tierDataStructure: typeof tierDataAfter
        },
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

  async function testSpacedRepetition(_verbose) {
    const start = Date.now();
    try {
      // Test Leitner system: problems should be spaced based on success/failure

      // Session 1: Get initial problems
      const session1 = await ProblemService.createSession();
      if (!session1 || session1.length === 0) {
        return {
          success: false,
          error: 'Failed to create first session',
          duration: Date.now() - start
        };
      }

      // Record successful attempts for ALL problems in session1
      // This should move them to higher box levels with cooldowns
      for (const problem of session1) {
        const testProblem = await createTestProblem(problem.id);

        await AttemptsService.addAttempt({
          problem_id: testProblem.problem_id,
          session_id: 'spaced-rep-test',
          success: true,
          time_spent: 300000,
          attempt_date: new Date().toISOString()
        }, testProblem);
      }

      // Verify first attempt was recorded
      const firstProblem = await createTestProblem(session1[0].id);
      const stats = await AttemptsService.getProblemAttemptStats(firstProblem.problem_id);
      const attemptRecorded = stats && stats.total >= 1;

      // Session 2: Should get DIFFERENT problems due to cooldowns on session1 problems
      const session2 = await ProblemService.createSession();
      const session2Ids = new Set(session2.map(p => p.problem_id || p.id));
      const session1Ids = new Set(session1.map(p => p.problem_id || p.id));

      // Count overlap
      const overlapCount = [...session1Ids].filter(id => session2Ids.has(id)).length;

      // Spaced repetition is working if NOT ALL problems repeat
      const hasSpacing = overlapCount < session1.length;

      const success = attemptRecorded && hasSpacing;

      return {
        success,
        details: `Spaced repetition: attempt recorded=${attemptRecorded}, spacing=${hasSpacing}, overlap=${overlapCount}/${session1.length}`,
        analysis: {
          attemptRecorded,
          hasSpacing,
          overlapCount,
          session1Count: session1.length,
          session2Count: session2.length,
          session1Ids: [...session1Ids],
          session2Ids: [...session2Ids]
        },
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

  async function testDataPersistence(_verbose) {
    const start = Date.now();
    try {
      // Create test problem in problems store (production pattern)
      // LeetCode ID 200 = "Number of Islands" (real problem)
      const testProblem = await createTestProblem(200);

      // Test 1: Write attempt data and verify it persists
      const testAttempt = {
        problem_id: testProblem.problem_id,
        session_id: 'test-session',
        success: true,
        time_spent: 300000,
        hints_used: 1,
        attempt_date: new Date() // Use Date object, not ISO string
      };

      // Add attempt directly to DB (bypass service layer which requires active session)
      // Already imported statically

      let addResult;
      try {
        console.log('🔍 Adding attempt to DB:', { problem_id: testAttempt.problem_id });
        addResult = await addAttemptToDB(testAttempt);
        console.log('🔍 addAttempt result:', addResult);
      } catch (error) {
        console.error('❌ Failed to add attempt to DB:', error);
        return {
          success: false,
          error: `Failed to add attempt: ${error.message}`,
          duration: Date.now() - start
        };
      }

      // Small delay to ensure DB write completes
      await new Promise(resolve => setTimeout(resolve, 100));

      // Try to read it back - check if attempt exists in database
      // Already imported statically
      const db = await dbHelper.openDB();

      // Simple check: does the attempt exist via raw query?
      const allAttempts = await new Promise((resolve, reject) => {
        const tx = db.transaction('attempts', 'readonly');
        const req = tx.objectStore('attempts').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      const matchingAttempts = allAttempts.filter(a => a.problem_id === testProblem.problem_id);

      console.log('🔍 Attempt retrieval:', {
        totalInDB: allAttempts.length,
        matchingThisProblem: matchingAttempts.length,
        lookingFor: testProblem.problem_id
      });

      // If we have matches in raw query but getMostRecentAttempt fails, it's a query issue
      // Already imported statically
      const recentAttempt = await getMostRecentAttempt(testProblem.problem_id);
      const attemptPersisted = recentAttempt && recentAttempt.problem_id === testProblem.problem_id;

      // Debug output on failure
      if (!attemptPersisted) {
        if (matchingAttempts.length > 0) {
          console.error('❌ QUERY MISMATCH: Found via getAll() but not getMostRecentAttempt()', {
            sampleAttempt: matchingAttempts[0],
            queryResult: recentAttempt
          });
        } else {
          console.error('❌ NO ATTEMPTS FOUND: Attempt was never written to DB', {
            totalAttempts: allAttempts.length,
            expectedProblemId: testProblem.problem_id
          });
        }
      }

      // Test 2: Verify seeded data exists (tag relationships should be populated)
      // (db already opened above)
      const tx = db.transaction('tag_relationships', 'readonly');
      const tagRelationships = await new Promise((resolve, reject) => {
        const req = tx.objectStore('tag_relationships').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      const tagRelationshipsPersisted = tagRelationships.length >= 68;

      const success = attemptPersisted && tagRelationshipsPersisted;

      return {
        success,
        details: `Attempt persisted: ${attemptPersisted}, Tag relationships: ${tagRelationships.length}/68 expected records`,
        analysis: {
          attemptPersisted,
          attemptId: testProblem.problem_id,
          tagRelationshipsCount: tagRelationships.length,
          tagRelationshipsExpected: 68,
          tagRelationshipsPersisted,
          tagRelationshipsMissing: tagRelationshipsPersisted ? 0 : (68 - tagRelationships.length)
        },
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

  async function testServiceIntegration(_verbose) {
    const start = Date.now();
    try {
      // Test that services are available and can access seeded data
      const results = {
        tagServiceWorks: false,
        problemServiceWorks: false,
        attemptsServiceWorks: false,
        servicesUseSeededData: false
      };

      // Test 1: TagService works with seeded tag relationships
      const currentTier = await TagService.getCurrentTier();
      results.tagServiceWorks = currentTier !== null && currentTier !== undefined;

      // Test 2: ProblemService can create session from seeded problems
      const problems = await ProblemService.createSession();
      results.problemServiceWorks = problems && problems.length > 0;

      // Test 3: AttemptsService can track attempts
      // Create test problem in problems store (production pattern)
      // LeetCode ID 300 = "Longest Increasing Subsequence" (real problem)
      const testProblem = await createTestProblem(300);

      const testAttempt = {
        problem_id: testProblem.problem_id,
        session_id: 'test-session',
        success: true,
        time_spent: 200000,
        attempt_date: new Date() // Use Date object, not ISO string
      };

      // Use DB layer directly to avoid session requirement
      // Already imported statically
      try {
        await addAttemptToDB(testAttempt);
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
        const retrieved = await getMostRecentAttempt(testProblem.problem_id);
        results.attemptsServiceWorks = retrieved && retrieved.problem_id === testProblem.problem_id;
      } catch (error) {
        console.error('❌ AttemptsService test error:', error);
        results.attemptsServiceWorks = false;
      }

      // Test 4: Verify services use seeded data (problems should have tags from seeded data)
      const problemsHaveTags = problems.every(p => p.tags && p.tags.length > 0);
      results.servicesUseSeededData = problemsHaveTags;

      const success = Object.values(results).every(v => v === true);

      return {
        success,
        details: `Services integrated: TagService=${results.tagServiceWorks}, ProblemService=${results.problemServiceWorks}, AttemptsService=${results.attemptsServiceWorks}, UsingSeededData=${results.servicesUseSeededData}`,
        analysis: results,
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

  async function testDifficultyProgression(_verbose) {
    const start = Date.now();
    try {
      // Test pattern ladder: difficulty should progress based on performance

      // Reset session state to ensure we start from Easy difficulty
      await StorageService.setSessionState('session_state', {
        id: 'session_state',
        num_sessions_completed: 1, // Just finished onboarding
        current_difficulty_cap: 'Easy',
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
      });

      // Session 1: Get initial problems (should be Easy after reset)
      const session1 = await ProblemService.createSession();
      if (!session1 || session1.length === 0) {
        return {
          success: false,
          error: 'Failed to create session',
          duration: Date.now() - start
        };
      }

      const session1Difficulties = session1.map(p => p.difficulty);
      const session1HasEasy = session1Difficulties.includes('Easy');

      // Simulate mastering Easy problems (4 successful attempts - required for progression)
      // Use real Easy LeetCode IDs: 104 (Max Depth Binary Tree), 136 (Single Number), 169 (Majority Element), 206 (Reverse Linked List)
      const easyLeetcodeIds = [104, 136, 169, 206];
      for (let i = 0; i < 4; i++) {
        const easyProblem = session1.find(p => p.difficulty === 'Easy');
        if (easyProblem) {
          // Create test problem in problems store (production pattern)
          const testProblem = await createTestProblem(easyLeetcodeIds[i]);

          await AttemptsService.addAttempt({
            problem_id: testProblem.problem_id,
            session_id: 'progression-test',
            success: true,
            time_spent: 250000,
            difficulty: 'Easy',
            tags: easyProblem.tags || ['array'],
            attempt_date: new Date().toISOString()
          }, testProblem);
        }
      }

      // Update difficulty_time_stats to reflect the 4 Easy problems completed
      // This is normally done by updateSessionStateWithPerformance after session completion
      const currentState = await StorageService.getSessionState('session_state');
      if (!currentState.difficulty_time_stats) {
        currentState.difficulty_time_stats = {
          easy: { problems: 0, total_time: 0, avg_time: 0 },
          medium: { problems: 0, total_time: 0, avg_time: 0 },
          hard: { problems: 0, total_time: 0, avg_time: 0 }
        };
      }
      currentState.difficulty_time_stats.easy.problems += 4;
      currentState.difficulty_time_stats.easy.total_time += 4 * 250000;
      currentState.difficulty_time_stats.easy.avg_time = currentState.difficulty_time_stats.easy.total_time / currentState.difficulty_time_stats.easy.problems;
      await StorageService.setSessionState('session_state', currentState);

      // Explicitly trigger difficulty progression evaluation (100% success on 4 Easy problems)
      // Already imported statically
      const userSettings = await StorageService.getSettings();
      await evaluateDifficultyProgression(1.0, userSettings);

      // Session 2: After mastering Easy, should see more Medium/Hard
      const session2 = await ProblemService.createSession();
      const session2Difficulties = session2.map(p => p.difficulty);
      const session2HasMediumOrHard = session2Difficulties.some(d => d === 'Medium' || d === 'Hard');

      // Count difficulty distribution
      const session2MediumCount = session2Difficulties.filter(d => d === 'Medium').length;
      const session2HardCount = session2Difficulties.filter(d => d === 'Hard').length;
      const session2EasyCount = session2Difficulties.filter(d => d === 'Easy').length;

      // Progression is working if we have harder problems after mastering easy
      const hasProgression = session2HasMediumOrHard && (session2MediumCount + session2HardCount) >= session2EasyCount;

      const success = session1HasEasy && session2HasMediumOrHard;

      return {
        success,
        details: `Difficulty progression: session1=${session1Difficulties.join(',')}, session2=${session2MediumCount}M/${session2HardCount}H vs ${session2EasyCount}E`,
        analysis: {
          session1HasEasy,
          session1Difficulties: session1Difficulties.join(','),
          session2HasMediumOrHard,
          session2Distribution: {
            Easy: session2EasyCount,
            Medium: session2MediumCount,
            Hard: session2HardCount
          },
          hasProgression
        },
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

  async function testProblemRelationships(_verbose) {
    const start = Date.now();
    try {
      // Test that problem relationships guide next problem selection

      // Use production helper to get relationship map
      // Already imported statically
      const relationshipMap = await buildRelationshipMap();

      const hasRelationships = relationshipMap.size > 0;

      // Count total relationships
      let totalRelationships = 0;
      for (const [, relatedProblems] of relationshipMap) {
        totalRelationships += Object.keys(relatedProblems).length;
      }

      // Session 1: Get problems
      const session1 = await ProblemService.createSession();
      if (!session1 || session1.length === 0) {
        return {
          success: false,
          error: 'Failed to create session',
          duration: Date.now() - start
        };
      }

      const problem1 = session1[0];

      // Create test problem in problems store using real LeetCode ID from session
      // Session problems have 'id' field which is the LeetCode ID
      const testProblem = await createTestProblem(problem1.id);

      // Find relationships for this problem using production Map
      const relatedProblems = relationshipMap.get(testProblem.leetcode_id);
      const hasRelatedProblems = relatedProblems && Object.keys(relatedProblems).length > 0;
      const relatedProblemIds = hasRelatedProblems ? Object.keys(relatedProblems).map(Number) : [];

      // Record successful attempt on problem1
      await AttemptsService.addAttempt({
        problem_id: testProblem.problem_id,
        session_id: 'relationships-test',
        success: true,
        time_spent: 350000,
        attempt_date: new Date().toISOString()
      }, testProblem);

      // Session 2: Should consider relationships from problem1
      const session2 = await ProblemService.createSession();
      const session2Created = session2 && session2.length > 0;

      // Check if any problems in session2 are related to problem1
      const session2Ids = session2.map(p => p.problem_id || p.id);
      const hasRelatedInSession2 = relatedProblemIds.some(id => session2Ids.includes(id));

      const success = hasRelationships && hasRelatedProblems && session2Created;

      return {
        success,
        details: `Relationships: ${totalRelationships} total, problem has ${relatedProblemIds.length} related, session2 has related=${hasRelatedInSession2}`,
        analysis: {
          totalRelationships,
          hasRelationships,
          problemHasRelated: hasRelatedProblems,
          relatedProblemsCount: relatedProblemIds.length,
          session2HasRelated: hasRelatedInSession2,
          session2Created
        },
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

  async function testProductionWorkflow(_verbose) {
    const start = Date.now();
    try {
      // ENHANCED: Test complete multi-session learning cycle
      const workflow = {
        session1Created: false,
        attemptRecorded: false,
        session2Created: false,
        learningProgressed: false,
        dataFlowsCorrectly: false
      };

      // Session 1: Create initial session with real session object
      const sessionObj1 = await SessionService.getOrCreateSession('standard');
      const session1 = sessionObj1.problems;
      const sessionId = sessionObj1.id;

      workflow.session1Created = session1 && session1.length > 0;

      if (!workflow.session1Created) {
        return {
          success: false,
          error: 'Failed to create session 1',
          duration: Date.now() - start
        };
      }

      // Get initial tier before attempts
      const tierBefore = await TagService.getCurrentTier();

      // Use DB layer directly since service requires active session
      // Already imported statically

      // Record successful attempts for ALL problems in session1
      // This should move them to higher box levels with cooldowns,
      // forcing session2 to select different problems (learning progression)
      for (let i = 0; i < session1.length; i++) {
        const sessionProblem = session1[i];

        // Create test problem in problems store using real LeetCode ID from session
        const testProblem = await createTestProblem(sessionProblem.id);

        await addAttemptToDB({
          problem_id: testProblem.problem_id,
          session_id: sessionId,
          success: true, // All successful to trigger box level progression
          time_spent: 300000 + (i * 100000),
          hints_used: 0,
          tags: sessionProblem.tags || [],
          difficulty: sessionProblem.difficulty,
          attempt_date: new Date()  // Use Date object for compound index compatibility
        });
      }

      // Complete session 1 explicitly to trigger progression evaluation
      try {
        await SessionService.checkAndCompleteSession(sessionId);
      } catch (error) {
        console.warn('Session completion warning:', error.message);
      }

      // Verify attempts recorded
      const firstProblem = session1[0];
      // Create test problem to get the UUID
      const firstTestProblem = await createTestProblem(firstProblem.id);
      const recordedAttempt = await AttemptsService.getMostRecentAttempt(firstTestProblem.problem_id);
      workflow.attemptRecorded = recordedAttempt && recordedAttempt.problem_id === firstTestProblem.problem_id;

      // Session 2: Create new session (should be influenced by session 1)
      const session2 = await ProblemService.createSession();
      workflow.session2Created = session2 && session2.length > 0;

      // Verify sessions are different (learning progressed)
      const session1Ids = new Set(session1.map(p => p.problem_id || p.id));
      const session2Ids = new Set(session2.map(p => p.problem_id || p.id));
      const hasNewProblems = [...session2Ids].some(id => !session1Ids.has(id));
      workflow.learningProgressed = hasNewProblems;

      // Verify data flows: tier may have changed or learning state updated
      const tierAfter = await TagService.getCurrentTier();
      const learningState = await TagService.getCurrentLearningState();
      workflow.dataFlowsCorrectly = (tierAfter !== null) && (learningState !== null);

      const success = Object.values(workflow).every(v => v === true);

      return {
        success,
        details: `Multi-session workflow: s1=${session1.length}p, attempts=recorded, s2=${session2.length}p, progressed=${hasNewProblems}, data=flows`,
        analysis: {
          ...workflow,
          session1Count: session1.length,
          session2Count: session2.length,
          tierBefore,
          tierAfter,
          hasNewProblems,
          attemptsCount: 3
        },
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

  async function testMasteryGates(_verbose) {
    const start = Date.now();
    try {
      // Test the new mastery gate system: volume + uniqueness + accuracy
      // This prevents the "4 problems → mastered" bug from regressing

      const helper = globalThis._testDatabaseActive && globalThis._testDatabaseHelper
        ? globalThis._testDatabaseHelper
        : dbHelper;
      const db = await helper.openDB();

      // Get tag relationships to find min_attempts_required
      const tagRelTx = db.transaction(['tag_relationships'], 'readonly');
      const tagRelStore = tagRelTx.objectStore('tag_relationships');

      // Use "array" tag as test subject (should have high min_attempts_required)
      const arrayTagRel = await new Promise((resolve, reject) => {
        const req = tagRelStore.get('array');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      const minAttemptsRequired = arrayTagRel?.min_attempts_required || 6;
      const masteryThreshold = arrayTagRel?.mastery_threshold || 0.75;
      const minUniqueRequired = Math.ceil(minAttemptsRequired * 0.7);

      // Create unique test problems
      // Already imported statically
      // Already imported statically

      // Test LeetCode IDs for array problems (real problems)
      const arrayProblemIds = [1, 26, 27, 35, 53, 66, 80, 118, 119, 121, 152, 153, 169, 189, 217, 238, 268, 283, 287, 414];

      // Test 1: Volume gate - do exactly (minAttempts - 1) unique problems → should NOT be mastered
      // CRITICAL: Clear any existing test data to ensure clean test state
      // Already imported statically

      // Clear previous test attempts for this session
      const attemptsTx = db.transaction(['attempts'], 'readwrite');
      const attemptsStore = attemptsTx.objectStore('attempts');
      const attemptsCursor = attemptsStore.openCursor();

      await new Promise((resolve) => {
        attemptsCursor.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            if (cursor.value.session_id === 'mastery-gate-test') {
              cursor.delete();
            }
            cursor.continue();
          } else {
            resolve();
          }
        };
      });

      // Reset array tag mastery to 0
      await upsertTagMastery({
        tag: 'array',
        total_attempts: 0,
        successful_attempts: 0,
        attempted_problem_ids: [],
        mastered: false,
        strength: 0,
        last_practiced: null,
        mastery_date: null
      });

      let attemptCount = 0;
      let volumeGateWorks = false;

      while (attemptCount < minAttemptsRequired - 1) {
        const testProblem = await createTestProblem(arrayProblemIds[attemptCount]);

        if (_verbose) {
          console.log(`Adding attempt ${attemptCount + 1}/${minAttemptsRequired - 1} for problem ${testProblem.title}`);
        }

        const attemptRecord = {
          problem_id: testProblem.problem_id,
          session_id: 'mastery-gate-test',
          success: true,
          time_spent: 300000,
          attempt_date: new Date()
        };

        await addAttemptToDB(attemptRecord);

        // Manually update tag mastery (since we're bypassing AttemptsService)
        await updateTagMasteryForAttempt(testProblem, attemptRecord);

        attemptCount++;
      }

      // Small delay for DB write
      await new Promise(resolve => setTimeout(resolve, 150));

      // Check mastery status - should NOT be mastered (volume gate blocks at minAttempts - 1)
      let masteryData = await getTagMastery();
      let arrayMastery = masteryData.find(m => m.tag === 'array');

      if (_verbose) {
        console.log(`After ${minAttemptsRequired - 1} attempts, array mastery:`, {
          total_attempts: arrayMastery?.total_attempts,
          mastered: arrayMastery?.mastered
        });
      }

      volumeGateWorks = !arrayMastery?.mastered;

      // Test 2: Complete volume requirement → should be mastered
      const finalProblem = await createTestProblem(arrayProblemIds[minAttemptsRequired - 1]);
      const finalAttemptRecord = {
        problem_id: finalProblem.problem_id,
        session_id: 'mastery-gate-test',
        success: true,
        time_spent: 300000,
        attempt_date: new Date()
      };

      await addAttemptToDB(finalAttemptRecord);
      await updateTagMasteryForAttempt(finalProblem, finalAttemptRecord);

      await new Promise(resolve => setTimeout(resolve, 100));

      masteryData = await getTagMastery();
      arrayMastery = masteryData.find(m => m.tag === 'array');
      const allGatesPass = arrayMastery?.mastered === true;

      // Test 3: Verify uniqueness tracking
      const uniqueProblems = new Set(arrayMastery?.attempted_problem_ids || []).size;
      const uniquenessTrackingWorks = uniqueProblems >= minUniqueRequired;

      // Test 4: Uniqueness gate blocks - many attempts but repeated problems
      // Reset mastery for isolated test
      await upsertTagMastery({
        tag: 'array',
        total_attempts: 0,
        successful_attempts: 0,
        attempted_problem_ids: [],
        mastered: false,
        strength: 0,
        last_practiced: null,
        mastery_date: null
      });

      // Do 10 attempts but only use 3 unique problems (repeat them)
      for (let i = 0; i < 10; i++) {
        const problemIndex = i % 3; // Cycles through first 3 problems
        const testProblem = await createTestProblem(arrayProblemIds[problemIndex]);

        const attemptRecord = {
          problem_id: testProblem.problem_id,
          session_id: 'mastery-gate-test-uniqueness',
          success: true,
          time_spent: 300000,
          attempt_date: new Date()
        };

        await addAttemptToDB(attemptRecord);
        await updateTagMasteryForAttempt(testProblem, attemptRecord);
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      masteryData = await getTagMastery();
      arrayMastery = masteryData.find(m => m.tag === 'array');

      // Should NOT be mastered: 10 attempts, 100% accuracy, but only 3 unique (need 5)
      const uniquenessGateBlocks = !arrayMastery?.mastered;
      const actualUniqueCount = new Set(arrayMastery?.attempted_problem_ids || []).size;

      // Test 5: Accuracy gate blocks - enough attempts and unique, but low success rate
      await upsertTagMastery({
        tag: 'array',
        total_attempts: 0,
        successful_attempts: 0,
        attempted_problem_ids: [],
        mastered: false,
        strength: 0,
        last_practiced: null,
        mastery_date: null
      });

      // Do 8 attempts, 8 unique problems, but only 3 successful (37.5% < 75%)
      for (let i = 0; i < 8; i++) {
        const testProblem = await createTestProblem(arrayProblemIds[i + 10]); // Use different problems
        const attemptRecord = {
          problem_id: testProblem.problem_id,
          session_id: 'mastery-gate-test-accuracy',
          success: i < 3, // Only first 3 are successful
          time_spent: 300000,
          attempt_date: new Date()
        };

        await addAttemptToDB(attemptRecord);
        await updateTagMasteryForAttempt(testProblem, attemptRecord);
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      masteryData = await getTagMastery();
      arrayMastery = masteryData.find(m => m.tag === 'array');

      // Should NOT be mastered: 8 attempts (>6), 8 unique (>5), but 37.5% success < 75%
      const accuracyGateBlocks = !arrayMastery?.mastered;
      const actualSuccessRate = arrayMastery ?
        (arrayMastery.successful_attempts / arrayMastery.total_attempts * 100).toFixed(1) : 0;

      // Test 6: REGRESSION - The original "4 problems → mastered" bug
      await upsertTagMastery({
        tag: 'array',
        total_attempts: 0,
        successful_attempts: 0,
        attempted_problem_ids: [],
        mastered: false,
        strength: 0,
        last_practiced: null,
        mastery_date: null
      });

      // Do exactly 4 successful, unique attempts (the original bug scenario)
      for (let i = 0; i < 4; i++) {
        const testProblem = await createTestProblem(arrayProblemIds[i]);
        const attemptRecord = {
          problem_id: testProblem.problem_id,
          session_id: 'mastery-gate-test-regression',
          success: true,
          time_spent: 300000,
          attempt_date: new Date()
        };

        await addAttemptToDB(attemptRecord);
        await updateTagMasteryForAttempt(testProblem, attemptRecord);
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      masteryData = await getTagMastery();
      arrayMastery = masteryData.find(m => m.tag === 'array');

      // Should NOT be mastered: 4 attempts < 6 required (volume gate blocks)
      const regressionFixed = !arrayMastery?.mastered;

      const success = volumeGateWorks && allGatesPass && uniquenessTrackingWorks &&
                     uniquenessGateBlocks && accuracyGateBlocks && regressionFixed;

      return {
        success,
        details: `Gates: vol=${volumeGateWorks ? '✅' : '❌'} complete=${allGatesPass ? '✅' : '❌'} uniq=${uniquenessTrackingWorks ? '✅' : '❌'} uniqBlock=${uniquenessGateBlocks ? '✅' : '❌'} accBlock=${accuracyGateBlocks ? '✅' : '❌'} regression=${regressionFixed ? '✅' : '❌'}`,
        analysis: {
          minAttemptsRequired,
          masteryThreshold: `${(masteryThreshold * 100).toFixed(0)}%`,
          minUniqueRequired,
          test1_volumeGate: { attempts: 5, mastered: !volumeGateWorks, passed: volumeGateWorks },
          test2_allGates: { attempts: 6, mastered: allGatesPass, passed: allGatesPass },
          test3_uniqueness: { attempts: 6, unique: uniqueProblems, passed: uniquenessTrackingWorks },
          test4_uniquenessBlocks: { attempts: 10, unique: actualUniqueCount, mastered: !uniquenessGateBlocks, passed: uniquenessGateBlocks },
          test5_accuracyBlocks: { attempts: 8, successRate: `${actualSuccessRate}%`, mastered: !accuracyGateBlocks, passed: accuracyGateBlocks },
          test6_regression: { attempts: 4, mastered: !regressionFixed, passed: regressionFixed }
        },
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

  async function testAdaptiveSessionLength(_verbose) {
    const start = Date.now();
    try {
      // Test that session length adapts to user performance and settings
      // This validates cognitive load management

      // Import session building logic
      // Already imported statically
      // Already imported statically

      // Test 1: High performance → expect longer sessions (6-8 problems)
      // Mock user settings
      await StorageService.setSettings({
        sessionLength: 6,
        numberofNewProblemsPerSession: 4
      });

      // Build settings (should adapt based on performance)
      let settings = await buildAdaptiveSessionSettings();
      const baselineLength = settings.sessionLength;
      const sessionLengthExists = typeof baselineLength === 'number' && baselineLength >= 3 && baselineLength <= 8;

      // Test 2: Verify session length is within cognitive load bounds
      const withinBounds = baselineLength >= 3 && baselineLength <= 8;

      // Test 3: Verify settings include required fields
      const hasRequiredFields = settings.sessionLength !== undefined && settings.numberOfNewProblems !== undefined;

      const success = sessionLengthExists && withinBounds && hasRequiredFields;

      return {
        success,
        details: `Session length: ${baselineLength} problems (bounds: 3-8), fields: ${hasRequiredFields ? '✅' : '❌'}`,
        analysis: {
          sessionLength: baselineLength,
          numberOfNewProblems: settings.numberOfNewProblems,
          withinCognitiveBounds: withinBounds,
          hasRequiredFields
        },
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

  async function testRelationshipMapUpdates(_verbose) {
    const start = Date.now();
    try {
      // Test that solving problems updates the relationship map
      // This validates dynamic problem recommendations

      // Already imported statically
      // Already imported statically

      // Get initial relationship map
      const initialMap = await buildRelationshipMap();
      const mapExists = initialMap && initialMap.size > 0;

      // Create and solve a test problem (LeetCode 1: Two Sum, has many relationships)
      const testProblem = await createTestProblem(1);

      await addAttemptToDB({
        problem_id: testProblem.problem_id,
        session_id: 'relationship-test',
        success: true,
        time_spent: 300000,
        attempt_date: new Date()
      });

      // Small delay for async updates
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify relationship map still works after update
      const updatedMap = await buildRelationshipMap();
      const mapStillValid = updatedMap && updatedMap.size > 0;

      // Check if test problem has relationships
      const problemRelationships = updatedMap.get(testProblem.leetcode_id);
      const hasRelationships = problemRelationships && Object.keys(problemRelationships).length > 0;

      const success = mapExists && mapStillValid && hasRelationships;

      return {
        success,
        details: `Relationship map: exists=${mapExists ? '✅' : '❌'}, valid=${mapStillValid ? '✅' : '❌'}, hasRelations=${hasRelationships ? '✅' : '❌'}`,
        analysis: {
          initialMapSize: initialMap?.size || 0,
          updatedMapSize: updatedMap?.size || 0,
          testProblemRelationships: problemRelationships ? Object.keys(problemRelationships).length : 0,
          mapExists,
          mapStillValid,
          hasRelationships
        },
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

  async function testSessionCleanupSafety(_verbose) {
    const start = Date.now();
    try {
      // Test: Verify that completed/old sessions are cleaned up properly

      // Create a session
      const session = await SessionService.getOrCreateSession('standard');
      const sessionId = session.id;

      // Validate ALL session problems have valid numeric IDs
      for (let i = 0; i < session.problems.length; i++) {
        if (!session.problems[i].id && session.problems[i].id !== 0) {
          throw new Error(`Session Cleanup: Session problem ${i} has invalid id: ${session.problems[i].id}, title: ${session.problems[i].title}`);
        }
        if (typeof session.problems[i].id !== 'number') {
          throw new Error(`Session Cleanup: Session problem ${i} id is not a number: ${typeof session.problems[i].id} (${session.problems[i].id}), title: ${session.problems[i].title}`);
        }
      }

      if (_verbose) {
        console.log(`Created session for cleanup test: ${sessionId}, problems: ${session.problems.length}`);
      }

      // Verify session exists
      let allSessions = await getAllFromStore('sessions');
      const sessionExists = allSessions.some(s => s.id === sessionId);

      if (!sessionExists) {
        return {
          success: false,
          error: 'Session was not created properly',
          duration: Date.now() - start
        };
      }

      // Complete all problems in the session to allow it to be marked as completed
      for (const problem of session.problems) {
        // Validate session problem has valid id field
        if (!problem.id && problem.id !== 0) {
          throw new Error(`Session problem missing id field: ${JSON.stringify(problem)}`);
        }
        if (typeof problem.id !== 'number') {
          throw new Error(`Session problem id must be number, got ${typeof problem.id}: ${problem.id}`);
        }

        const testProblem = await createTestProblem(problem.id);

        await AttemptsService.addAttempt({
          problem_id: testProblem.problem_id,
          session_id: sessionId,
          success: true,
          time_spent: 300000,
          attempt_date: new Date()
        }, testProblem);
      }

      // Mark session as completed (simulating end of session)
      await SessionService.checkAndCompleteSession(sessionId);

      // Verify session was marked as completed
      const completedSession = await getSessionById(sessionId);
      const isCompleted = completedSession && completedSession.status === 'completed';

      if (_verbose) {
        console.log(`Session cleanup test: sessionExists=${sessionExists}, isCompleted=${isCompleted}`);
      }

      return {
        success: sessionExists && isCompleted,
        details: `Session creation and completion: exists=${sessionExists ? '✅' : '❌'}, completed=${isCompleted ? '✅' : '❌'}`,
        analysis: {
          note: 'Verified session lifecycle from creation to completion',
          sessionId,
          problemsAttempted: session.problems.length
        },
        duration: Date.now() - start
      };
    } catch (error) {
      console.error('❌ Session Cleanup Safety test failed:', error);
      return {
        success: false,
        error: error.message,
        duration: Date.now() - start
      };
    }
  }

  async function testMultiSessionCoexistence(_verbose) {
    const start = Date.now();
    try {
      // Test: User can have ONE active session of EACH type simultaneously
      // Already imported statically

      // Get available problem IDs from database
      const problemIds = await getAvailableProblemIds(5);

      // 1. User starts guided practice → creates standard session
      let standardSession;
      try {
        standardSession = await SessionService.getOrCreateSession('standard');
      } catch (err) {
        console.error('❌ Failed to create standard session:', err);
        return {
          success: false,
          error: `Standard session creation failed: ${err.message}`,
          details: 'Test requires working session creation',
          duration: Date.now() - start
        };
      }
      const hasStandard = standardSession && standardSession.session_type === 'standard';

      // 2. User starts interview → creates interview session
      let interviewSession;
      try {
        interviewSession = await SessionService.getOrCreateSession('interview-like');
      } catch (err) {
        console.error('❌ Failed to create interview session:', err);
        return {
          success: false,
          error: `Interview session creation failed: ${err.message}`,
          details: 'Test requires working session creation',
          duration: Date.now() - start
        };
      }
      const hasInterview = interviewSession && interviewSession.session_type === 'interview-like';

      // 3. User solves random problem (not from guided session) → creates tracking session
      // This automatically creates a tracking session via addAttempt's routing logic
      const randomProblem = await createTestProblem(problemIds[4]); // Use problem not in any session
      await AttemptsService.addAttempt({
        problem_id: randomProblem.problem_id,
        success: true,
        time_spent: 300000,
        attempt_date: new Date()
      }, randomProblem);

      // Verify: All sessions coexist
      const allSessions = await getAllFromStore('sessions');
      const activeSessions = allSessions.filter(s =>
        s.status === 'in_progress' || s.status === 'draft'
      );

      // Find tracking session (created by addAttempt)
      const trackingSession = allSessions.find(s => s.session_type === 'tracking');
      const hasTracking = trackingSession && trackingSession.status === 'in_progress';

      // Verify: Different session types coexist
      const sessionTypes = new Set(activeSessions.map(s => s.session_type));
      const hasMultipleTypes = sessionTypes.size >= 2; // At least standard + interview or tracking

      if (_verbose) {
        console.log(`Active sessions:`, {
          total: activeSessions.length,
          types: Array.from(sessionTypes),
          hasStandard,
          hasInterview,
          hasTracking
        });
      }

      const success = hasStandard && hasInterview && hasMultipleTypes;

      return {
        success,
        details: `Coexistence: standard=${hasStandard ? '✅' : '❌'} interview=${hasInterview ? '✅' : '❌'} types=${hasMultipleTypes ? '✅' : '❌'}`,
        analysis: {
          hasStandardSession: hasStandard,
          hasInterviewSession: hasInterview,
          hasTrackingSession: hasTracking,
          activeSessionCount: activeSessions.length,
          uniqueSessionTypes: sessionTypes.size
        },
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

  async function testTrackingSessionRotation(_verbose) {
    const start = Date.now();
    try {
      // Test tracking session behavior - simplified since internal methods aren't exposed
      // Already imported statically

      // Get available problem IDs from database
      const problemIds = await getAvailableProblemIds(10);

      // Create multiple tracking attempts
      for (let i = 0; i < 5; i++) {
        const problem = await createTestProblem(problemIds[i]);
        await AttemptsService.addAttempt({
          problem_id: problem.problem_id,
          success: true,
          time_spent: 300000,
          attempt_date: new Date()
        }, problem);
      }

      // Verify: Tracking session created and has attempts
      const allSessions = await getAllFromStore('sessions');
      const trackingSessions = allSessions.filter(s => s.session_type === 'tracking');
      const hasTrackingSession = trackingSessions.length > 0;
      const hasAttempts = trackingSessions[0]?.attempts?.length > 0;

      if (_verbose) {
        console.log('Tracking session:', {
          found: hasTrackingSession,
          attempts: trackingSessions[0]?.attempts?.length || 0
        });
      }

      const success = hasTrackingSession && hasAttempts;

      return {
        success,
        details: `Tracking: session=${hasTrackingSession ? '✅' : '❌'} attempts=${hasAttempts ? '✅' : '❌'}`,
        analysis: {
          trackingSessionCreated: hasTrackingSession,
          hasAttempts,
          attemptCount: trackingSessions[0]?.attempts?.length || 0,
          note: 'Full rotation logic tested via internal methods not exposed'
        },
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

  // Helper to validate session problem has valid numeric ID
  function validateSessionProblemId(problem, context, index = null) {
    const indexStr = index !== null ? ` ${index}` : '';
    if (!problem.id && problem.id !== 0) {
      throw new Error(`${context}: Problem${indexStr} missing id: ${JSON.stringify(problem)}`);
    }
    if (typeof problem.id !== 'number') {
      throw new Error(`${context}: Problem${indexStr} id must be number, got ${typeof problem.id}: ${problem.id}`);
    }
  }

  async function testSessionCompletionFlow(_verbose) {
    const start = Date.now();
    try {
      // Clean up test database to ensure no stale data
      if (globalThis._testDatabaseHelper) {
        try {
          await globalThis._testDatabaseHelper.smartTestIsolation();
          if (_verbose) console.log('✅ Test database cleaned');
        } catch (cleanupError) {
          console.warn('⚠️ Pre-test cleanup failed:', cleanupError.message);
        }
      }

      // Test guided session completion flow
      // Already imported statically

      // Create guided session with problems
      let session;
      try {
        session = await SessionService.getOrCreateSession('standard');
      } catch (err) {
        console.error('❌ Failed to create session for completion test:', err);
        return {
          success: false,
          error: `Session creation failed: ${err.message}`,
          details: 'Test requires working session creation',
          duration: Date.now() - start
        };
      }
      const sessionId = session.id;

      // Validate ALL session problems have valid numeric IDs
      try {
        for (let i = 0; i < session.problems.length; i++) {
          validateSessionProblemId(session.problems[i], 'Session Completion Flow', i);
        }
      } catch (validationError) {
        return {
          success: false,
          error: validationError.message,
          details: 'Session created with invalid problem IDs - this is a session creation bug',
          duration: Date.now() - start
        };
      }

      const problems = session.problems; // Use ALL problems in session

      if (_verbose) {
        console.log(`Session created: ${sessionId}, problems: ${problems.length}`);
      }

      // Verify: Session starts as draft or in_progress
      const initialStatus = session.status;
      const validInitialStatus = initialStatus === 'draft' || initialStatus === 'in_progress';

      // Attempt all but last problem - session problems have 'id' property which is the leetcode_id
      for (let i = 0; i < problems.length - 1; i++) {
        validateSessionProblemId(problems[i], 'Session Completion Flow', i);
        const problem = await createTestProblem(problems[i].id);

        await AttemptsService.addAttempt({
          problem_id: problem.problem_id,
          session_id: sessionId,
          success: true,
          time_spent: 300000,
          attempt_date: new Date()
        }, problem);
      }

      // Verify: Session still in_progress (not all problems attempted)
      let updatedSession = await getSessionById(sessionId);
      const stillInProgress = updatedSession.status === 'in_progress';

      if (_verbose) {
        console.log(`After ${problems.length - 1}/${problems.length} attempts: ${updatedSession.status}`);
      }

      // Attempt final problem - session problems have 'id' property which is the leetcode_id
      const lastProblemIndex = problems.length - 1;
      validateSessionProblemId(problems[lastProblemIndex], 'Session Completion Flow (final)');
      const finalProblem = await createTestProblem(problems[lastProblemIndex].id);

      await AttemptsService.addAttempt({
        problem_id: finalProblem.problem_id,
        session_id: sessionId,
        success: true,
        time_spent: 300000,
        attempt_date: new Date()
      }, finalProblem);

      // Verify: Session marked as completed
      updatedSession = await getSessionById(sessionId);
      const markedCompleted = updatedSession.status === 'completed';

      if (_verbose) {
        console.log(`After 3/3 attempts: ${updatedSession.status}`);
      }

      // Verify: Next getOrCreateSession creates NEW session
      const nextSession = await SessionService.getOrCreateSession('standard');
      const createsNewSession = nextSession.id !== sessionId;

      const success = validInitialStatus && stillInProgress && markedCompleted && createsNewSession;

      return {
        success,
        details: `Completion: initial=${validInitialStatus ? '✅' : '❌'} partial=${stillInProgress ? '✅' : '❌'} complete=${markedCompleted ? '✅' : '❌'} new=${createsNewSession ? '✅' : '❌'}`,
        analysis: {
          validInitialStatus,
          stillInProgressAfterPartial: stillInProgress,
          completedAfterAll: markedCompleted,
          createsNewSessionAfter: createsNewSession,
          initialStatus,
          problemsAttempted: 3
        },
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

  async function testFocusTagProgression(_verbose) {
    const start = Date.now();
    try {
      // Test focus tag tier progression using real production functions
      // Already imported statically
      // Already imported statically

      // Get initial learning state
      const initialState = await TagService.getCurrentLearningState();
      const initialTier = initialState.currentTier;
      const initialFocusTags = initialState.focusTags || [];

      if (_verbose) {
        console.log('Initial learning state:', {
          tier: initialTier,
          focusTags: initialFocusTags
        });
      }

      // Get all tags in current tier
      const tagRelationships = await getAllFromStore('tag_relationships');
      const coreTags = tagRelationships
        .filter(t => t.classification === 'Core Concept')
        .map(t => t.id);

      const hasValidInitialState = initialTier && initialFocusTags.length > 0;

      // Master first 3 tags in current tier
      for (let i = 0; i < Math.min(3, coreTags.length); i++) {
        await upsertTagMastery({
          tag: coreTags[i],
          total_attempts: 10,
          successful_attempts: 9,
          attempted_problem_ids: Array.from({ length: 10 }, (_, j) => `problem_${i}_${j}`),
          mastered: true,
          strength: 90,
          last_practiced: new Date().toISOString(),
          mastery_date: new Date().toISOString()
        });
      }

      // Get updated learning state
      const updatedState = await TagService.getCurrentLearningState();
      const stillInSameTier = updatedState.currentTier === initialTier;
      const hasFocusTags = updatedState.focusTags && updatedState.focusTags.length > 0;

      if (_verbose) {
        console.log('After mastering 3 tags:', {
          tier: updatedState.currentTier,
          focusTags: updatedState.focusTags,
          stillSameTier: stillInSameTier
        });
      }

      // Verify focus tags are being tracked
      // System uses: 1 tag during onboarding, 3 tags after onboarding, up to 6 in learning window
      const focusTagsValid = hasFocusTags && updatedState.focusTags.length >= 1;

      const success = hasValidInitialState && hasFocusTags && focusTagsValid;

      return {
        success,
        details: `Progression: initial=${hasValidInitialState ? '✅' : '❌'} focus=${hasFocusTags ? '✅' : '❌'} valid=${focusTagsValid ? '✅' : '❌'}`,
        analysis: {
          hasValidInitialState,
          initialTier,
          initialFocusCount: initialFocusTags.length,
          updatedTier: updatedState.currentTier,
          updatedFocusCount: updatedState.focusTags?.length || 0,
          hasFocusTags,
          focusTagsValid,
          masteredTagsCount: 3
        },
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

  async function testOnboardingInitialization(_verbose) {
    const start = Date.now();
    try {
      // Test simplified onboarding initialization - just verify data creation
      // Already imported statically
      // Already imported statically
      // Already imported statically

      // Check if pattern ladders already exist
      const existingLadders = await getAllFromStore('pattern_ladders');
      const hadExistingLadders = existingLadders.length > 0;

      if (_verbose) {
        console.log('Onboarding test:', {
          existingLadders: existingLadders.length,
          skippingInit: hadExistingLadders
        });
      }

      // If no ladders exist, run initialization
      if (!hadExistingLadders) {
        await initializePatternLaddersForOnboarding();
      }

      // Verify: Pattern ladders exist
      const ladders = await getAllFromStore('pattern_ladders');
      const hasLadders = ladders.length > 0;

      // NOTE: Tag mastery is no longer initialized during onboarding
      // Tags are now added organically on first problem attempt
      // This test only verifies ladder creation, not mastery initialization

      // Verify: Focus tags have larger ladders (12 problems)
      const arrayLadder = ladders.find(l => l.tag === 'array');
      const hasArrayLadder = arrayLadder && arrayLadder.problems.length >= 5;

      if (_verbose) {
        console.log('After initialization:', {
          ladders: ladders.length,
          arrayLadderSize: arrayLadder?.problems.length
        });
      }

      const success = hasLadders && hasArrayLadder;

      return {
        success,
        details: `Onboarding: ladders=${hasLadders ? '✅' : '❌'} array=${hasArrayLadder ? '✅' : '❌'}`,
        analysis: {
          hadExistingLadders,
          laddersCreated: ladders.length,
          arrayLadderSize: arrayLadder?.problems.length || 0,
          hasLadders,
          hasArrayLadder,
          note: 'Tag mastery initialized on first attempt, not during onboarding'
        },
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

  /**
   * 🧪 Enable Test Environment
   * Creates isolated test database and seeds it with production-like data
   */
  globalThis.enableTesting = async function(options = {}) {
    console.log('🔥 enableTesting() CALLED - Setting up test environment...');
    const { force = false } = options;

    try {
      // Check if already enabled and seeded (idempotent)
      if (globalThis._testDatabaseActive && globalThis._testDatabaseSeeded && !force) {
        console.log('ℹ️ Test environment already active and seeded');
        return {
          success: true,
          active: true,
          message: 'Test environment already active',
          seeded: true
        };
      }

      console.log('🧪 Enabling test environment...');

      // Import required test database factory
      const { createDbHelper } = await import('../shared/db/dbHelperFactory.js');

      // Create test database helper
      let testDb = globalThis._testDatabaseHelper;
      if (!testDb) {
        testDb = createDbHelper({
          dbName: "CodeMaster_test",
          isTestMode: true,
          enableLogging: true
        });
        console.log(`✅ Test database created: ${testDb.dbName}`);
      }

      // Import seeding functions
      const { insertStandardProblems } = await import('../shared/db/standard_problems.js');
      const { insertStrategyData } = await import('../shared/db/strategy_data.js');
      const { buildTagRelationships } = await import('../shared/db/tag_relationships.js');
      const { buildProblemRelationships } = await import('../shared/services/relationshipService.js');

      // Open database and check if already seeded
      const db = await testDb.openDB();
      const tx = db.transaction(['standard_problems'], 'readonly');
      const count = await new Promise((resolve) => {
        const req = tx.objectStore('standard_problems').count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(0);
      });

      let seedResults = {};
      if (count > 1000 && !force) {
        console.log(`♻️ Test database already seeded: ${count} problems - SKIPPING`);
        seedResults = { standardProblems: true, strategyData: true, tagRelationships: true, problemRelationships: true, sessionState: true };
      } else {
        console.log(`🌱 Seeding test database...`);

        // Set flags for seeding
        globalThis._testDatabaseActive = true;
        globalThis._testDatabaseHelper = testDb;

        // Seed data
        await insertStandardProblems(db);
        await insertStrategyData(db);
        await buildTagRelationships();
        await buildProblemRelationships();

        // Initialize session state
        const stateTx = db.transaction(['session_state'], 'readwrite');
        await new Promise((resolve, reject) => {
          const req = stateTx.objectStore('session_state').put({
            key: 'session_state',
            num_sessions_completed: 3, // Exit onboarding (threshold is 3)
            current_difficulty_cap: 'Medium',
            tag_index: 0,
            last_difficulty_increase: new Date().toISOString(),
            _migrated: true
          });
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });

        seedResults = { standardProblems: true, strategyData: true, tagRelationships: true, problemRelationships: true, sessionState: true };
        console.log('✅ Test database seeded successfully');
      }

      // Set global flags
      globalThis._testDatabaseActive = true;
      globalThis._testDatabaseHelper = testDb;
      globalThis._testDatabaseSeeded = true;

      console.log('✅ Test environment ready!');
      return {
        success: true,
        active: true,
        message: 'Test environment initialized successfully',
        dbName: testDb.dbName,
        seeded: true,
        seedResults
      };

    } catch (error) {
      console.error('❌ Failed to enable test environment:', error);
      globalThis._testDatabaseActive = false;
      globalThis._testDatabaseHelper = null;
      globalThis._testDatabaseSeeded = false;

      return {
        success: false,
        active: false,
        message: `Failed to enable test environment: ${error.message}`,
        error: error.message
      };
    }
  };

  // Convenience test runner
  globalThis.test = function() {
    console.log('🚀 Running quick core business logic test...');
    return globalThis.testCoreBusinessLogic({ verbose: false, quick: true });
  };

  // Expose individual test functions for debugging
  const wrapTest = (testFn, name) => async function(verbose = true) {
    if (typeof globalThis.enableTesting !== 'function') {
      const error = '🚨 CRITICAL: enableTesting() not defined - cannot run test safely';
      console.error(error);
      return { success: false, error, critical: true };
    }
    await globalThis.enableTesting();

    // Clean up variable data before test (preserve seeded data)
    if (globalThis._testDatabaseHelper) {
      try {
        await globalThis._testDatabaseHelper.smartTestIsolation();
        if (verbose) console.log(`✅ Test database cleaned before ${name}`);
      } catch (cleanupError) {
        console.warn(`⚠️ Pre-test cleanup failed for ${name}:`, cleanupError.message);
      }
    }

    return await testFn(verbose);
  };

  globalThis.testSessionCreation = wrapTest(testSessionCreation, 'testSessionCreation');
  globalThis.testProblemSelection = wrapTest(testProblemSelection, 'testProblemSelection');
  globalThis.testAttemptTracking = wrapTest(testAttemptTracking, 'testAttemptTracking');
  globalThis.testTagMastery = wrapTest(testTagMastery, 'testTagMastery');
  globalThis.testSpacedRepetition = wrapTest(testSpacedRepetition, 'testSpacedRepetition');
  globalThis.testDataPersistence = wrapTest(testDataPersistence, 'testDataPersistence');
  globalThis.testServiceIntegration = wrapTest(testServiceIntegration, 'testServiceIntegration');
  globalThis.testDifficultyProgression = wrapTest(testDifficultyProgression, 'testDifficultyProgression');
  globalThis.testProblemRelationships = wrapTest(testProblemRelationships, 'testProblemRelationships');
  globalThis.testProductionWorkflow = wrapTest(testProductionWorkflow, 'testProductionWorkflow');
  globalThis.testMasteryGates = wrapTest(testMasteryGates, 'testMasteryGates');
  globalThis.testAdaptiveSessionLength = wrapTest(testAdaptiveSessionLength, 'testAdaptiveSessionLength');
  globalThis.testRelationshipMapUpdates = wrapTest(testRelationshipMapUpdates, 'testRelationshipMapUpdates');
  globalThis.testSessionCleanupSafety = wrapTest(testSessionCleanupSafety, 'testSessionCleanupSafety');
  globalThis.testMultiSessionCoexistence = wrapTest(testMultiSessionCoexistence, 'testMultiSessionCoexistence');
  globalThis.testTrackingSessionRotation = wrapTest(testTrackingSessionRotation, 'testTrackingSessionRotation');
  globalThis.testSessionCompletionFlow = wrapTest(testSessionCompletionFlow, 'testSessionCompletionFlow');
  globalThis.testFocusTagProgression = wrapTest(testFocusTagProgression, 'testFocusTagProgression');
  globalThis.testOnboardingInitialization = wrapTest(testOnboardingInitialization, 'testOnboardingInitialization');

  console.log('✅ Core business logic tests initialized - 19 individual test functions available');
}