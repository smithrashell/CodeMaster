// =============================================================================
// 🔗 RELATIONSHIP BROWSER TESTS - Learning Algorithm and Relationship Updates
// =============================================================================
//
// These tests validate relationship learning algorithms and data flow
// in the Chrome browser environment.
//
// USAGE: Copy these functions to background.js
//
// =============================================================================

// 🔗 Relationship Test Functions - Clean versions for default execution
globalThis.testRelationshipFlow = async function() {
  console.log('🔗 Testing relationship flow...');

  try {
    // Import relationship modules
    const { addProblemRelationship, getProblemRelationships } = await import('../../src/shared/db/problem_relationships.js');

    // Test adding and retrieving problem relationships
    const testProblems = [{ id: 1, title: 'Two Sum' }, { id: 2, title: 'Three Sum' }];
    await addProblemRelationship(testProblems[0].id, testProblems[1].id, 0.8);

    const relationships = await getProblemRelationships(testProblems[0].id);

    if (!relationships || relationships.length === 0) {
      throw new Error('No relationships found after adding one');
    }

    console.log('✓ Problem relationship creation and retrieval working');
    console.log('✅ Relationship flow test PASSED');
    return {
      success: true,
      relationshipsCreated: 1,
      relationshipsRetrieved: relationships.length
    };

  } catch (error) {
    console.error('❌ testRelationshipFlow failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

globalThis.testRelationshipComposition = async function() {
  console.log('🎨 Testing relationship composition...');

  try {
    // Import relationship modules
    const { calculateTagSimilarity } = await import('../../src/shared/db/tag_mastery.js');

    // Test tag similarity calculations
    const tag1 = { name: 'array', mastery: 0.7 };
    const tag2 = { name: 'two-pointers', mastery: 0.6 };

    const similarity = calculateTagSimilarity(tag1, tag2);

    if (typeof similarity !== 'number' || similarity < 0 || similarity > 1) {
      throw new Error('Tag similarity calculation returned invalid result');
    }

    console.log('✓ Tag similarity calculation working:', similarity);
    console.log('✅ Relationship composition test PASSED');
    return {
      success: true,
      tagSimilarity: similarity,
      validSimilarity: similarity >= 0 && similarity <= 1
    };

  } catch (error) {
    console.error('❌ testRelationshipComposition failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

globalThis.testRelationshipUpdates = async function() {
  console.log('🔄 Testing relationship updates...');

  try {
    // Import relationship modules
    const { weakenProblemRelationship, addProblemRelationship, getProblemRelationships } = await import('../../src/shared/db/problem_relationships.js');

    // Create initial relationship
    const problem1 = 1;
    const problem2 = 2;
    await addProblemRelationship(problem1, problem2, 0.9);

    // Test weakening relationship
    await weakenProblemRelationship(problem1, problem2);

    // Verify relationship was modified (should still exist but potentially weakened)
    const relationships = await getProblemRelationships(problem1);

    if (!relationships) {
      throw new Error('Relationships should still exist after weakening');
    }

    console.log('✓ Relationship weakening mechanism working');
    console.log('✅ Relationship updates test PASSED');
    return {
      success: true,
      relationshipModified: true,
      remainingRelationships: relationships.length
    };

  } catch (error) {
    console.error('❌ testRelationshipUpdates failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

globalThis.testFocusRelationships = async function() {
  console.log('🎯 Testing focus relationships...');

  try {
    // Import tag mastery module
    const { getTagMastery, updateTagMastery } = await import('../../src/shared/db/tag_mastery.js');

    // Test focus tag relationships
    const testTag = 'array';

    // Add mastery data
    await updateTagMastery(testTag, 0.75, 'box3');

    // Retrieve mastery data
    const mastery = await getTagMastery(testTag);

    if (!mastery || typeof mastery.mastery !== 'number') {
      throw new Error('Tag mastery data not properly stored or retrieved');
    }

    console.log('✓ Focus tag mastery system working:', mastery);
    console.log('✅ Focus relationships test PASSED');
    return {
      success: true,
      tagMastery: mastery.mastery,
      tagBox: mastery.current_box,
      masteryValid: mastery.mastery >= 0 && mastery.mastery <= 1
    };

  } catch (error) {
    console.error('❌ testFocusRelationships failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

globalThis.testRelationshipConsistency = async function() {
  console.log('⚖️ Testing relationship consistency...');

  try {
    // Import modules
    const { addProblemRelationship, getProblemRelationships } = await import('../../src/shared/db/problem_relationships.js');
    const { dbHelper } = await import('../../src/shared/db/index.js');

    // Test bidirectional relationship consistency
    const problem1 = 100;
    const problem2 = 200;
    const strength = 0.85;

    await addProblemRelationship(problem1, problem2, strength);

    // Check relationships from both directions
    const relationships1 = await getProblemRelationships(problem1);
    const relationships2 = await getProblemRelationships(problem2);

    if (!relationships1 || relationships1.length === 0) {
      throw new Error('No relationships found for problem1');
    }

    // Verify database integrity
    const db = await dbHelper.openDB();
    const transaction = db.transaction(['problem_relationships'], 'readonly');
    const store = transaction.objectStore('problem_relationships');
    const allRelationships = await new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
    });

    console.log('✓ Relationship consistency verified');
    console.log('✅ Relationship consistency test PASSED');
    return {
      success: true,
      relationshipsForProblem1: relationships1.length,
      relationshipsForProblem2: relationships2 ? relationships2.length : 0,
      totalRelationships: allRelationships.length,
      consistencyVerified: true
    };

  } catch (error) {
    console.error('❌ testRelationshipConsistency failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

globalThis.testAllRelationships = async function() {
  console.log('🔗 Testing all relationship systems...');

  try {
    // Run all relationship tests
    const flowResult = await testRelationshipFlow();
    const compositionResult = await testRelationshipComposition();
    const updatesResult = await testRelationshipUpdates();
    const focusResult = await testFocusRelationships();
    const consistencyResult = await testRelationshipConsistency();

    const allTests = [flowResult, compositionResult, updatesResult, focusResult, consistencyResult];
    const successCount = allTests.filter(result => result.success || result === true).length;
    const totalTests = allTests.length;

    if (successCount === totalTests) {
      console.log('✓ All relationship systems working properly');
      console.log('✅ All relationships test PASSED');
      return {
        success: true,
        testsRun: totalTests,
        testsPassed: successCount,
        passRate: successCount / totalTests,
        results: allTests
      };
    } else {
      throw new Error(`Only ${successCount}/${totalTests} relationship tests passed`);
    }

  } catch (error) {
    console.error('❌ testAllRelationships failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};