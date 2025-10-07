
// Copy this into Chrome DevTools Console on a LeetCode page

// Comprehensive Test Runner Functions

// runComprehensiveTests
async function runComprehensiveTests() {
  return await runTestSuite(['testExtensionLoadOnLeetCode', 'testBackgroundScriptCommunication', 'testTimerStartStop', 'testSessionGeneration', 'testContentScriptInjection', 'testSettingsPersistence', 'testHintInteraction', 'testProblemNavigation', 'testFocusAreaSelection', 'testFirstUserOnboarding', 'testProblemSubmissionTracking', 'testOnboardingDetection', 'testAccurateTimer', 'testInterviewLikeSessions', 'testDifficultyProgression', 'testEscapeHatches', 'testFullInterviewSessions', 'testPathOptimization', 'testPatternLearning', 'testPlateauRecovery', 'testMultiSessionPaths', 'testRealLearningFlow', 'testRelationshipFlow', 'testRelationshipComposition', 'testRelationshipUpdates', 'testFocusRelationships', 'testRelationshipConsistency', 'testTagIntegration', 'testTagLadderPathfinding', 'testSessionBlending', 'testLearningJourney', 'testCoreSessionValidation', 'testProblemSelection', 'testQuick', 'testRealFocusCoordination', 'testRealSessionCreation', 'testOnboarding', 'testProgression', 'testStruggling', 'testComprehensive', 'testQuickComprehensive', 'testDataPersistenceReliability', 'testCrossPageCommunication', 'testUIResponsiveness', 'testAccessibilityCompliance', 'testCoreServiceAvailability', 'testMemoryLeakPrevention', 'testCoreIntegrationCheck', 'testDataPersistenceReliability', 'testCrossPageCommunication', 'testUIResponsiveness', 'testPerformanceBenchmarks', 'testSystemStressConditions', 'testProductionReadiness'], 'runComprehensiveTests');
}

// runCriticalTests
async function runCriticalTests() {
  return await runTestSuite(['testExtensionLoadOnLeetCode', 'testBackgroundScriptCommunication', 'testTimerStartStop', 'testSessionGeneration', 'testContentScriptInjection', 'testCoreServiceAvailability', 'testCoreIntegrationCheck', 'testPerformanceBenchmarks', 'testProductionReadiness'], 'runCriticalTests');
}

// runProductionTests
async function runProductionTests() {
  return await runTestSuite(['testDataPersistenceReliability', 'testCoreServiceAvailability', 'testCoreIntegrationCheck', 'testUIResponsiveness', 'testAccessibilityCompliance', 'testMemoryLeakPrevention', 'testPerformanceBenchmarks', 'testSystemStressConditions', 'testProductionReadiness'], 'runProductionTests');
}


// Phase 0 - Browser Integration
async function runPhase0Tests() {
  return await runTestSuite(['testExtensionLoadOnLeetCode', 'testBackgroundScriptCommunication', 'testTimerStartStop', 'testSessionGeneration', 'testContentScriptInjection', 'testSettingsPersistence'], 'Phase 0 - Browser Integration');
}

// Phase 1 - User Workflows
async function runPhase1Tests() {
  return await runTestSuite(['testHintInteraction', 'testProblemNavigation', 'testFocusAreaSelection', 'testFirstUserOnboarding', 'testProblemSubmissionTracking'], 'Phase 1 - User Workflows');
}

// Phase 2 - Algorithm & Learning
async function runPhase2Tests() {
  return await runTestSuite(['testOnboardingDetection', 'testAccurateTimer', 'testInterviewLikeSessions', 'testDifficultyProgression', 'testEscapeHatches', 'testFullInterviewSessions', 'testPathOptimization', 'testPatternLearning', 'testPlateauRecovery', 'testMultiSessionPaths', 'testRealLearningFlow', 'testRelationshipFlow', 'testRelationshipComposition', 'testRelationshipUpdates', 'testFocusRelationships', 'testRelationshipConsistency', 'testTagIntegration', 'testTagLadderPathfinding', 'testSessionBlending', 'testLearningJourney', 'testCoreSessionValidation', 'testProblemSelection', 'testQuick', 'testRealFocusCoordination', 'testRealSessionCreation', 'testOnboarding', 'testProgression', 'testStruggling', 'testComprehensive', 'testQuickComprehensive'], 'Phase 2 - Algorithm & Learning');
}

// Phase 3 - Experience Quality
async function runPhase3Tests() {
  return await runTestSuite(['testDataPersistenceReliability', 'testCrossPageCommunication', 'testUIResponsiveness', 'testAccessibilityCompliance'], 'Phase 3 - Experience Quality');
}

// Phase 4 - Defensive Testing
async function runPhase4Tests() {
  return await runTestSuite(['testCoreServiceAvailability', 'testMemoryLeakPrevention'], 'Phase 4 - Defensive Testing');
}

// Phase 5 - Performance & Production
async function runPhase5Tests() {
  return await runTestSuite(['testCoreIntegrationCheck', 'testDataPersistenceReliability', 'testCrossPageCommunication', 'testUIResponsiveness'], 'Phase 5 - Performance & Production');
}

// Phase 6 - Advanced Production
async function runPhase6Tests() {
  return await runTestSuite(['testPerformanceBenchmarks', 'testSystemStressConditions', 'testProductionReadiness'], 'Phase 6 - Advanced Production');
}

// Individual phase runners
async function runPhaseTests(phaseNumber) {
  const phases = {
  "Phase 0 - Browser Integration": [
    "testExtensionLoadOnLeetCode",
    "testBackgroundScriptCommunication",
    "testTimerStartStop",
    "testSessionGeneration",
    "testContentScriptInjection",
    "testSettingsPersistence"
  ],
  "Phase 1 - User Workflows": [
    "testHintInteraction",
    "testProblemNavigation",
    "testFocusAreaSelection",
    "testFirstUserOnboarding",
    "testProblemSubmissionTracking"
  ],
  "Phase 2 - Algorithm & Learning": [
    "testOnboardingDetection",
    "testAccurateTimer",
    "testInterviewLikeSessions",
    "testDifficultyProgression",
    "testEscapeHatches",
    "testFullInterviewSessions",
    "testPathOptimization",
    "testPatternLearning",
    "testPlateauRecovery",
    "testMultiSessionPaths",
    "testRealLearningFlow",
    "testRelationshipFlow",
    "testRelationshipComposition",
    "testRelationshipUpdates",
    "testFocusRelationships",
    "testRelationshipConsistency",
    "testTagIntegration",
    "testTagLadderPathfinding",
    "testSessionBlending",
    "testLearningJourney",
    "testCoreSessionValidation",
    "testProblemSelection",
    "testQuick",
    "testRealFocusCoordination",
    "testRealSessionCreation",
    "testOnboarding",
    "testProgression",
    "testStruggling",
    "testComprehensive",
    "testQuickComprehensive"
  ],
  "Phase 3 - Experience Quality": [
    "testDataPersistenceReliability",
    "testCrossPageCommunication",
    "testUIResponsiveness",
    "testAccessibilityCompliance"
  ],
  "Phase 4 - Defensive Testing": [
    "testCoreServiceAvailability",
    "testMemoryLeakPrevention"
  ],
  "Phase 5 - Performance & Production": [
    "testCoreIntegrationCheck",
    "testDataPersistenceReliability",
    "testCrossPageCommunication",
    "testUIResponsiveness"
  ],
  "Phase 6 - Advanced Production": [
    "testPerformanceBenchmarks",
    "testSystemStressConditions",
    "testProductionReadiness"
  ]
};
  const phaseKey = Object.keys(phases)[phaseNumber];
  if (!phaseKey) {
    console.error('❌ Invalid phase number. Use 0-6');
    return;
  }

  console.log(`🎯 Running ${phaseKey}`);
  return await runTestSuite(phases[phaseKey], phaseKey);
}

// Helper function to run any test suite
async function runTestSuite(tests, suiteName = 'Test Suite') {
  console.log(`\n🧪 ${suiteName.toUpperCase()}`);
  console.log('='.repeat(suiteName.length + 5));

  const results = { total: tests.length, passed: 0, failed: 0, errors: 0 };
  const startTime = Date.now();

  for (const testName of tests) {
    try {
      console.log(`\n⚡ Running ${testName}...`);

      if (typeof globalThis[testName] !== 'function') {
        console.log(`❌ ${testName} - NOT FOUND`);
        results.errors++;
        continue;
      }

      const testResult = await globalThis[testName]();

      if (testResult === true || (testResult && testResult.success)) {
        console.log(`✅ ${testName} - PASSED`);
        results.passed++;
      } else {
        console.log(`❌ ${testName} - FAILED`);
        console.log('   Details:', testResult);
        results.failed++;
      }
    } catch (error) {
      console.log(`💥 ${testName} - ERROR: ${error.message}`);
      results.errors++;
    }
  }

  const duration = Date.now() - startTime;

  console.log(`\n📊 ${suiteName} RESULTS:`);
  console.log(`✅ Passed: ${results.passed}/${results.total}`);
  console.log(`❌ Failed: ${results.failed}/${results.total}`);
  console.log(`💥 Errors: ${results.errors}/${results.total}`);
  console.log(`⏱️  Duration: ${duration}ms`);
  console.log(`🎯 Success Rate: ${Math.round((results.passed / results.total) * 100)}%`);

  return results;
}

console.log('🚀 CodeMaster Test Runner Loaded!');
console.log('📖 Available commands:');
console.log('   - runComprehensiveTests()     // All 55+ tests');
console.log('   - runCriticalTests()          // Critical tests only');
console.log('   - runProductionTests()        // Production readiness');
console.log('   - runPhaseTests(0-6)          // Specific phase tests');
console.log('   - runPhase0Tests()           // Phase 0 - Browser Integration');
console.log('   - runPhase1Tests()           // Phase 1 - User Workflows');
console.log('   - runPhase2Tests()           // Phase 2 - Algorithm & Learning');
console.log('   - runPhase3Tests()           // Phase 3 - Experience Quality');
console.log('   - runPhase4Tests()           // Phase 4 - Defensive Testing');
console.log('   - runPhase5Tests()           // Phase 5 - Performance & Production');
console.log('   - runPhase6Tests()           // Phase 6 - Advanced Production');
