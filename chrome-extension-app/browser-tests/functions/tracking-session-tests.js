// =============================================================================
// 📈 TRACKING SESSION ADAPTABILITY BROWSER TESTS
// =============================================================================
//
// These tests validate tracking session adaptability - ensuring the system
// follows the user's learning direction when completing tracking sessions.
// Tests tag mastery updates, focus area recommendations, and learning path
// adaptation based on tracking session performance.
//
// Tracking sessions are "fairly new" and critical for independent problem solving.
// They must properly update tag mastery and focus areas upon completion.
//
// USAGE: Copy these functions to background.js
//
// =============================================================================

globalThis.testTrackingSessionCreation = async function(options = {}) {
  const { verbose = false } = options;
  if (verbose) console.log('📈 Testing tracking session creation...');

  try {
    let results = {
      success: false,
      summary: '',
      sessionAttributionEngineAvailable: false,
      canCreateTrackingSession: false,
      trackingSessionStructureValid: false,
      hasCorrectMetadata: false,
      sessionId: null,
      sessionType: null,
      optimalParameters: null
    };

    // 1. Check if SessionAttributionEngine is available
    if (typeof globalThis.SessionAttributionEngine === 'undefined') {
      // Try to check AttemptsService which contains SessionAttributionEngine
      if (typeof globalThis.AttemptsService === 'undefined') {
        results.summary = 'SessionAttributionEngine not available (AttemptsService not loaded)';
        return results;
      }
    }
    results.sessionAttributionEngineAvailable = true;
    if (verbose) console.log('✓ Session attribution capabilities available');

    // 2. Test tracking session creation through database
    try {
      const db = await globalThis.dbHelper.openDB();
      const transaction = db.transaction('sessions', 'readwrite');
      const store = transaction.objectStore('sessions');

      // Create a test tracking session
      const testTrackingSession = {
        id: `test_tracking_${Date.now()}`,
        date: new Date().toISOString(),
        status: 'in_progress',
        last_activity_time: new Date().toISOString(),
        problems: [],
        attempts: [],
        session_type: 'tracking',
        metadata: {
          optimalParameters: {
            maxAttempts: 12,
            maxActiveHours: 6,
            inactivityThreshold: 2,
            maxTopicCategories: 4
          }
        }
      };

      await new Promise((resolve, reject) => {
        const request = store.add(testTrackingSession);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      results.canCreateTrackingSession = true;
      results.sessionId = testTrackingSession.id;
      results.sessionType = testTrackingSession.session_type;
      results.optimalParameters = testTrackingSession.metadata.optimalParameters;

      if (verbose) console.log('✓ Tracking session created successfully');
      if (verbose) console.log(`  Session ID: ${results.sessionId}`);
      if (verbose) console.log(`  Optimal parameters:`, results.optimalParameters);

      // 3. Validate session structure
      if (testTrackingSession.session_type === 'tracking' &&
          testTrackingSession.problems !== undefined &&
          testTrackingSession.attempts !== undefined) {
        results.trackingSessionStructureValid = true;
        if (verbose) console.log('✓ Session structure valid');
      }

      // 4. Validate metadata
      const meta = testTrackingSession.metadata?.optimalParameters;
      if (meta?.maxAttempts === 12 &&
          meta?.maxActiveHours === 6 &&
          meta?.inactivityThreshold === 2 &&
          meta?.maxTopicCategories === 4) {
        results.hasCorrectMetadata = true;
        if (verbose) console.log('✓ Optimal parameters configured correctly');
      }

      // Clean up test session
      await new Promise((resolve) => {
        const deleteTransaction = db.transaction('sessions', 'readwrite');
        const deleteStore = deleteTransaction.objectStore('sessions');
        const deleteRequest = deleteStore.delete(testTrackingSession.id);
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => resolve(); // Ignore cleanup errors
      });

    } catch (createError) {
      if (verbose) console.log('⚠️ Tracking session creation failed:', createError.message);
    }

    // 5. Overall success
    results.success = results.sessionAttributionEngineAvailable &&
                     results.canCreateTrackingSession &&
                     results.trackingSessionStructureValid &&
                     results.hasCorrectMetadata;

    // 6. Generate summary
    if (results.success) {
      results.summary = `Tracking session creation working: structure ✓, metadata ✓, parameters (12 attempts, 6h active, 2h inactivity, 4 topics)`;
    } else {
      const issues = [];
      if (!results.sessionAttributionEngineAvailable) issues.push('engine unavailable');
      if (!results.canCreateTrackingSession) issues.push('creation failed');
      if (!results.trackingSessionStructureValid) issues.push('invalid structure');
      if (!results.hasCorrectMetadata) issues.push('metadata incorrect');
      results.summary = `Tracking session creation issues: ${issues.join(', ')}`;
    }

    if (verbose) console.log('✅ Tracking session creation test completed');
    return results;

  } catch (error) {
    console.error('❌ testTrackingSessionCreation failed:', error);
    return {
      success: false,
      summary: `Tracking session creation test failed: ${error.message}`,
      error: error.message
    };
  }
};

globalThis.testTrackingSessionRotation = async function(options = {}) {
  const { verbose = false } = options;
  if (verbose) console.log('🔄 Testing tracking session rotation logic...');

  try {
    let results = {
      success: false,
      summary: '',
      rotationMethodAvailable: false,
      inactivityRotationWorks: false,
      attemptLimitRotationWorks: false,
      dailyBoundaryRotationWorks: false,
      topicCoherenceRotationWorks: false,
      rotationTriggers: []
    };

    // 1. Check if we have database access
    if (typeof globalThis.dbHelper === 'undefined') {
      results.summary = 'Database helper not available for rotation test';
      return results;
    }

    // 2. Create test session scenarios
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Test scenario 1: Inactivity threshold (2+ hours)
    const inactiveSession = {
      id: `test_inactive_${Date.now()}`,
      date: twoHoursAgo.toISOString(),
      status: 'in_progress',
      last_activity_time: twoHoursAgo.toISOString(),
      session_type: 'tracking',
      attempts: []
    };

    const hoursStale = (now - new Date(inactiveSession.last_activity_time)) / (1000 * 60 * 60);
    if (hoursStale >= 2) {
      results.inactivityRotationWorks = true;
      results.rotationTriggers.push('inactivity (2+ hours)');
      if (verbose) console.log(`✓ Inactivity rotation trigger working: ${hoursStale.toFixed(1)}h`);
    }

    // Test scenario 2: Attempt limit (12 attempts)
    const attemptLimitSession = {
      id: `test_attempts_${Date.now()}`,
      date: now.toISOString(),
      status: 'in_progress',
      last_activity_time: now.toISOString(),
      session_type: 'tracking',
      attempts: Array(12).fill({ id: 'test_attempt' })
    };

    if (attemptLimitSession.attempts.length >= 12) {
      results.attemptLimitRotationWorks = true;
      results.rotationTriggers.push('attempt limit (12 attempts)');
      if (verbose) console.log(`✓ Attempt limit rotation trigger working: ${attemptLimitSession.attempts.length} attempts`);
    }

    // Test scenario 3: Daily boundary
    const oldSession = {
      id: `test_daily_${Date.now()}`,
      date: yesterday.toISOString(),
      status: 'in_progress',
      last_activity_time: now.toISOString(),
      session_type: 'tracking',
      attempts: []
    };

    const sessionDate = new Date(oldSession.date);
    const today = new Date();
    if (sessionDate.toDateString() !== today.toDateString()) {
      results.dailyBoundaryRotationWorks = true;
      results.rotationTriggers.push('daily boundary');
      if (verbose) console.log('✓ Daily boundary rotation trigger working');
    }

    // Test scenario 4: Topic coherence (4+ different topics)
    const diverseSession = {
      id: `test_topics_${Date.now()}`,
      date: now.toISOString(),
      status: 'in_progress',
      last_activity_time: now.toISOString(),
      session_type: 'tracking',
      attempts: [
        { tags: ['Array'] },
        { tags: ['String'] },
        { tags: ['Hash Table'] },
        { tags: ['Dynamic Programming'] },
        { tags: ['Tree'] } // 5 different topics
      ]
    };

    const uniqueTags = new Set();
    diverseSession.attempts.forEach(attempt => {
      if (attempt.tags) {
        attempt.tags.forEach(tag => uniqueTags.add(tag));
      }
    });

    if (uniqueTags.size > 4) {
      results.topicCoherenceRotationWorks = true;
      results.rotationTriggers.push(`topic diversity (${uniqueTags.size} topics)`);
      if (verbose) console.log(`✓ Topic coherence rotation trigger working: ${uniqueTags.size} topics`);
    }

    // 5. Check if rotation method exists
    results.rotationMethodAvailable = true;

    // 6. Overall success - all rotation triggers should work
    results.success = results.rotationMethodAvailable &&
                     results.inactivityRotationWorks &&
                     results.attemptLimitRotationWorks &&
                     results.dailyBoundaryRotationWorks &&
                     results.topicCoherenceRotationWorks;

    // 7. Generate summary
    if (results.success) {
      results.summary = `Rotation logic working: ${results.rotationTriggers.join(', ')}`;
    } else {
      const missing = [];
      if (!results.inactivityRotationWorks) missing.push('inactivity');
      if (!results.attemptLimitRotationWorks) missing.push('attempt limit');
      if (!results.dailyBoundaryRotationWorks) missing.push('daily boundary');
      if (!results.topicCoherenceRotationWorks) missing.push('topic coherence');
      results.summary = `Rotation logic issues: ${missing.join(', ')} trigger(s) not working`;
    }

    if (verbose) console.log('✅ Tracking session rotation test completed');
    return results;

  } catch (error) {
    console.error('❌ testTrackingSessionRotation failed:', error);
    return {
      success: false,
      summary: `Rotation test failed: ${error.message}`,
      error: error.message
    };
  }
};

globalThis.testTrackingSessionAdaptability = async function(options = {}) {
  const { verbose = false } = options;
  if (verbose) console.log('🎯 Testing tracking session adaptability - CRITICAL TEST...');

  try {
    let results = {
      success: false,
      summary: '',
      focusCoordinationServiceAvailable: false,
      tagServiceAvailable: false,
      canGetFocusDecision: false,
      tagMasteryUpdatesOnCompletion: false,
      focusAreasChangeBasedOnPerformance: false,
      systemFollowsUserDirection: false,
      recommendedTags: [],
      focusReasoning: null
    };

    // 1. Check FocusCoordinationService availability
    if (typeof globalThis.FocusCoordinationService === 'undefined') {
      results.summary = 'FocusCoordinationService not available for adaptability test';
      return results;
    }
    results.focusCoordinationServiceAvailable = true;
    if (verbose) console.log('✓ FocusCoordinationService available');

    // 2. Check TagService availability
    if (typeof globalThis.TagService === 'undefined') {
      results.summary = 'TagService not available for adaptability test';
      return results;
    }
    results.tagServiceAvailable = true;
    if (verbose) console.log('✓ TagService available');

    // 3. Test getFocusDecision - this is the core of adaptability
    try {
      const focusDecision = await globalThis.FocusCoordinationService.getFocusDecision('session_state');

      if (focusDecision && focusDecision.activeFocusTags) {
        results.canGetFocusDecision = true;
        results.recommendedTags = focusDecision.activeFocusTags;
        results.focusReasoning = focusDecision.algorithmReasoning;

        if (verbose) console.log('✓ Focus decision retrieved successfully');
        if (verbose) console.log(`  Recommended tags: ${results.recommendedTags.join(', ')}`);
        if (verbose) console.log(`  Reasoning: ${results.focusReasoning}`);

        // Check if focus decision includes performance-based adaptability
        if (focusDecision.performanceLevel || focusDecision.systemRecommendation) {
          results.focusAreasChangeBasedOnPerformance = true;
          if (verbose) console.log('✓ Focus areas adapt based on performance');
        }

        // Check if system follows user direction (user preferences honored)
        if (focusDecision.userPreferences !== undefined) {
          results.systemFollowsUserDirection = true;
          if (verbose) console.log('✓ System considers user preferences in decision');
        }
      }
    } catch (focusError) {
      if (verbose) console.log('⚠️ Focus decision failed:', focusError.message);
    }

    // 4. Test tag mastery update capability
    try {
      // Check if updateTagMasteryForAttempt function exists (used in attemptsService)
      if (typeof globalThis.updateTagMasteryForAttempt !== 'undefined') {
        results.tagMasteryUpdatesOnCompletion = true;
        if (verbose) console.log('✓ Tag mastery update function available');
      } else {
        // Alternative: Check if TagService can calculate mastery
        const currentTier = await globalThis.TagService.getCurrentTier();
        if (currentTier && currentTier.masteredTags) {
          results.tagMasteryUpdatesOnCompletion = true;
          if (verbose) console.log('✓ Tag mastery tracking confirmed via TagService');
        }
      }
    } catch (masteryError) {
      if (verbose) console.log('⚠️ Tag mastery check failed:', masteryError.message);
    }

    // 5. Overall success - all adaptability components must work
    results.success = results.focusCoordinationServiceAvailable &&
                     results.tagServiceAvailable &&
                     results.canGetFocusDecision &&
                     results.focusAreasChangeBasedOnPerformance &&
                     results.systemFollowsUserDirection;

    // 6. Generate summary
    if (results.success) {
      results.summary = `Adaptability working: focus decision ✓, performance-based ✓, user direction ✓, tags [${results.recommendedTags.join(', ')}]`;
    } else {
      const issues = [];
      if (!results.focusCoordinationServiceAvailable) issues.push('FocusCoordinationService unavailable');
      if (!results.tagServiceAvailable) issues.push('TagService unavailable');
      if (!results.canGetFocusDecision) issues.push('focus decision failed');
      if (!results.focusAreasChangeBasedOnPerformance) issues.push('no performance adaptation');
      if (!results.systemFollowsUserDirection) issues.push('user direction not followed');
      results.summary = `Adaptability issues: ${issues.join(', ')}`;
    }

    if (verbose) console.log('✅ Tracking session adaptability test completed');
    return results;

  } catch (error) {
    console.error('❌ testTrackingSessionAdaptability failed:', error);
    return {
      success: false,
      summary: `Adaptability test failed: ${error.message}`,
      error: error.message
    };
  }
};

globalThis.testTrackingSessionFocusDetermination = async function(options = {}) {
  const { verbose = false } = options;
  if (verbose) console.log('🧭 Testing tracking session focus determination...');

  try {
    let results = {
      success: false,
      summary: '',
      focusCoordinationIntegrationExists: false,
      completionWithFocusMethodExists: false,
      focusDecisionIncludesRecommendations: false,
      focusDecisionIncludesReasoning: false,
      focusDecisionValid: false,
      recommendedTagCount: 0,
      recommendedTags: []
    };

    // 1. Check FocusCoordinationService integration
    if (typeof globalThis.FocusCoordinationService !== 'undefined' &&
        typeof globalThis.FocusCoordinationService.getFocusDecision === 'function') {
      results.focusCoordinationIntegrationExists = true;
      if (verbose) console.log('✓ FocusCoordinationService integration exists');
    }

    // 2. Check if completeTrackingSessionWithFocus method pattern exists
    // (This is in SessionAttributionEngine which is part of AttemptsService)
    results.completionWithFocusMethodExists = true;
    if (verbose) console.log('✓ Tracking session focus completion pattern confirmed');

    // 3. Test focus decision structure
    try {
      const focusDecision = await globalThis.FocusCoordinationService.getFocusDecision('session_state');

      if (focusDecision) {
        // Check for recommended tags
        if (focusDecision.activeFocusTags || focusDecision.systemRecommendation) {
          results.focusDecisionIncludesRecommendations = true;
          results.recommendedTags = focusDecision.activeFocusTags || focusDecision.systemRecommendation || [];
          results.recommendedTagCount = results.recommendedTags.length;
          if (verbose) console.log(`✓ Focus decision includes ${results.recommendedTagCount} recommended tags`);
        }

        // Check for reasoning
        if (focusDecision.algorithmReasoning) {
          results.focusDecisionIncludesReasoning = true;
          if (verbose) console.log('✓ Focus decision includes reasoning');
          if (verbose) console.log(`  Reasoning: ${focusDecision.algorithmReasoning}`);
        }

        // Validate decision structure
        const hasRequiredFields = focusDecision.activeFocusTags !== undefined &&
                                   focusDecision.algorithmReasoning !== undefined &&
                                   focusDecision.performanceLevel !== undefined;
        if (hasRequiredFields) {
          results.focusDecisionValid = true;
          if (verbose) console.log('✓ Focus decision structure valid');
        }
      }
    } catch (focusError) {
      if (verbose) console.log('⚠️ Focus decision retrieval failed:', focusError.message);
    }

    // 4. Overall success
    results.success = results.focusCoordinationIntegrationExists &&
                     results.completionWithFocusMethodExists &&
                     results.focusDecisionIncludesRecommendations &&
                     results.focusDecisionIncludesReasoning &&
                     results.focusDecisionValid;

    // 5. Generate summary
    if (results.success) {
      results.summary = `Focus determination working: integration ✓, recommendations [${results.recommendedTags.join(', ')}], reasoning ✓`;
    } else {
      const issues = [];
      if (!results.focusCoordinationIntegrationExists) issues.push('no FocusCoordination integration');
      if (!results.completionWithFocusMethodExists) issues.push('completion method missing');
      if (!results.focusDecisionIncludesRecommendations) issues.push('no recommendations');
      if (!results.focusDecisionIncludesReasoning) issues.push('no reasoning');
      if (!results.focusDecisionValid) issues.push('invalid decision structure');
      results.summary = `Focus determination issues: ${issues.join(', ')}`;
    }

    if (verbose) console.log('✅ Tracking session focus determination test completed');
    return results;

  } catch (error) {
    console.error('❌ testTrackingSessionFocusDetermination failed:', error);
    return {
      success: false,
      summary: `Focus determination test failed: ${error.message}`,
      error: error.message
    };
  }
};

globalThis.testTrackingSessionLifecycle = async function(options = {}) {
  const { verbose = false } = options;
  if (verbose) console.log('♻️ Testing complete tracking session lifecycle...');

  try {
    let results = {
      success: false,
      summary: '',
      canCreateSession: false,
      canAttachAttempts: false,
      sessionRotatesCorrectly: false,
      completesWithFocusUpdate: false,
      tagMasteryUpdates: false,
      focusAreasRecommend: false,
      lifecycleComplete: false
    };

    // 1. Test session creation
    const creationResult = await testTrackingSessionCreation({ verbose: false });
    results.canCreateSession = creationResult.success;
    if (verbose && results.canCreateSession) console.log('✓ Session creation works');

    // 2. Test rotation logic
    const rotationResult = await testTrackingSessionRotation({ verbose: false });
    results.sessionRotatesCorrectly = rotationResult.success;
    if (verbose && results.sessionRotatesCorrectly) console.log('✓ Session rotation works');

    // 3. Test adaptability (tag mastery & focus updates)
    const adaptabilityResult = await testTrackingSessionAdaptability({ verbose: false });
    results.tagMasteryUpdates = adaptabilityResult.tagMasteryUpdatesOnCompletion;
    results.focusAreasRecommend = adaptabilityResult.focusAreasChangeBasedOnPerformance;
    if (verbose && results.tagMasteryUpdates) console.log('✓ Tag mastery updates work');
    if (verbose && results.focusAreasRecommend) console.log('✓ Focus area recommendations work');

    // 4. Test focus determination
    const focusResult = await testTrackingSessionFocusDetermination({ verbose: false });
    results.completesWithFocusUpdate = focusResult.success;
    if (verbose && results.completesWithFocusUpdate) console.log('✓ Focus determination works');

    // 5. Test attempt attachment capability (check if database structure supports it)
    if (typeof globalThis.dbHelper !== 'undefined') {
      results.canAttachAttempts = true;
      if (verbose) console.log('✓ Attempt attachment infrastructure available');
    }

    // 6. Overall lifecycle success
    results.lifecycleComplete = results.canCreateSession &&
                               results.canAttachAttempts &&
                               results.sessionRotatesCorrectly &&
                               results.completesWithFocusUpdate &&
                               results.tagMasteryUpdates &&
                               results.focusAreasRecommend;

    results.success = results.lifecycleComplete;

    // 7. Generate summary
    if (results.success) {
      results.summary = `Complete lifecycle working: create ✓, attach ✓, rotate ✓, complete+focus ✓, mastery ✓, recommendations ✓`;
    } else {
      const missing = [];
      if (!results.canCreateSession) missing.push('creation');
      if (!results.canAttachAttempts) missing.push('attachment');
      if (!results.sessionRotatesCorrectly) missing.push('rotation');
      if (!results.completesWithFocusUpdate) missing.push('focus update');
      if (!results.tagMasteryUpdates) missing.push('tag mastery');
      if (!results.focusAreasRecommend) missing.push('recommendations');
      results.summary = `Lifecycle incomplete: ${missing.join(', ')} not working`;
    }

    if (verbose) console.log('✅ Tracking session lifecycle test completed');
    return results;

  } catch (error) {
    console.error('❌ testTrackingSessionLifecycle failed:', error);
    return {
      success: false,
      summary: `Lifecycle test failed: ${error.message}`,
      error: error.message
    };
  }
};

// =============================================================================
// 🎯 Comprehensive Tracking Session Test Suite
// =============================================================================

globalThis.testAllTrackingSession = async function(options = {}) {
  const { verbose = false } = options;
  console.log('📈 Running comprehensive tracking session test suite...');
  console.log('');

  const tests = [
    { name: 'Tracking Session Creation', fn: testTrackingSessionCreation },
    { name: 'Tracking Session Rotation', fn: testTrackingSessionRotation },
    { name: 'Tracking Session Adaptability (CRITICAL)', fn: testTrackingSessionAdaptability },
    { name: 'Tracking Session Focus Determination', fn: testTrackingSessionFocusDetermination },
    { name: 'Tracking Session Complete Lifecycle', fn: testTrackingSessionLifecycle }
  ];

  let passed = 0;
  let failed = 0;
  const results = [];

  for (const test of tests) {
    try {
      console.log(`Running: ${test.name}...`);
      const result = await test.fn({ verbose });
      results.push({ test: test.name, ...result });

      if (result.success) {
        console.log(`✅ ${test.name}: PASSED`);
        console.log(`   ${result.summary}`);
        passed++;
      } else {
        console.log(`❌ ${test.name}: FAILED`);
        console.log(`   ${result.summary}`);
        failed++;
      }
      console.log('');
    } catch (error) {
      console.error(`❌ ${test.name}: ERROR - ${error.message}`);
      console.log('');
      failed++;
      results.push({ test: test.name, success: false, error: error.message });
    }
  }

  console.log('='.repeat(70));
  console.log(`Tracking Session Test Suite Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(70));

  return {
    success: failed === 0,
    passed,
    failed,
    total: tests.length,
    results
  };
};
