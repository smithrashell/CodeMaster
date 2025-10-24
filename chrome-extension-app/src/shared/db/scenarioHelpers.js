/**
 * 🌱 Test Scenario Helpers
 * Functions for seeding test databases with specific scenarios
 */

import { insertStandardProblems } from "./standard_problems.js";

/**
 * Seed basic scenario with minimal test data
 */
export async function seedBasicScenario(testDb) {
  try {
    await testDb.put('problems', {
      id: 1,
      title: "Two Sum",
      difficulty: "Easy",
      tags: ['array', 'hash-table']
    });
    await testDb.put('settings', {
      id: 1,
      focusAreas: ['array'],
      sessionsPerWeek: 3
    });
  } catch (error) {
    if (testDb.enableLogging) {
      console.warn('⚠️  Test data seeding failed (non-critical):', error.message);
    }
  }
}

/**
 * Seed experienced user scenario with multiple problems
 */
export async function seedExperiencedScenario(testDb) {
  const problems = [
    { id: 1, title: "Two Sum", difficulty: "Easy", tags: ['array', 'hash-table'] },
    { id: 2, title: "Add Two Numbers", difficulty: "Medium", tags: ['linked-list', 'math'] },
    { id: 3, title: "Median of Arrays", difficulty: "Hard", tags: ['array', 'binary-search'] }
  ];

  for (const problem of problems) {
    await testDb.put('problems', problem);
  }

  await testDb.put('settings', {
    id: 1,
    focusAreas: ['array', 'linked-list'],
    sessionsPerWeek: 7
  });
}

/**
 * Seed production-like data for realistic testing
 */
export async function seedProductionLikeData(testDb) {
  if (testDb.enableLogging) {
    console.log('🌱 DATABASE TEST: Starting production-like seeding...');
  }
  console.log('🌱 DATABASE TEST: Starting production-like seeding (forced log)...');

  const results = {
    standardProblems: false,
    strategyData: false,
    tagRelationships: false,
    problemRelationships: false,
    userSetup: false
  };

  try {
    // Load standard problems
    await loadStandardProblems(testDb, results);

    // Seed basic data
    await seedStrategyData(testDb, results);
    await seedTagRelationships(testDb, results);
    await buildProblemRelationships(testDb, results);
    await setupUserData(testDb, results);

    const successCount = Object.values(results).filter(Boolean).length;
    if (testDb.enableLogging) {
      console.log(`🌱 DATABASE TEST: Production-like seeding complete: ${successCount}/5 components seeded`);
    }

    return results;

  } catch (error) {
    if (testDb.enableLogging) {
      console.error('❌ TEST DB: Production-like seeding failed:', error);
    }
    throw error;
  }
}

/**
 * Load comprehensive standard problems dataset
 */
async function loadStandardProblems(testDb, results) {
  try {
    const originalActive = globalThis._testDatabaseActive;
    const originalHelper = globalThis._testDatabaseHelper;

    // Temporarily set test context
    globalThis._testDatabaseActive = true;
    globalThis._testDatabaseHelper = testDb;

    await insertStandardProblems();

    // Restore original context
    globalThis._testDatabaseActive = originalActive;
    globalThis._testDatabaseHelper = originalHelper;

    results.standardProblems = true;
    if (testDb.enableLogging) {
      console.log('✅ TEST DB: Comprehensive standard problems loaded from production dataset');
    }
    console.log('✅ TEST DB: Comprehensive standard problems loaded from production dataset (forced log)');
  } catch (error) {
    if (testDb.enableLogging) {
      console.warn('⚠️ TEST DB: Basic test problems seeding failed:', error.message);
    }
    console.error('❌ TEST DB: Basic test problems seeding failed (forced log):', error);
  }
}

/**
 * Seed basic strategy data
 */
async function seedStrategyData(testDb, results) {
  try {
    await testDb.put('strategy_data', {
      id: 'array',
      strategies: ['two-pointer', 'sliding-window'],
      difficulty_levels: ['Easy', 'Medium']
    });
    results.strategyData = true;
    if (testDb.enableLogging) {
      console.log('✅ TEST DB: Basic strategy data seeded');
    }
  } catch (error) {
    if (testDb.enableLogging) {
      console.warn('⚠️ TEST DB: Basic strategy data seeding failed:', error.message);
    }
  }
}

/**
 * Seed basic tag relationships
 */
async function seedTagRelationships(testDb, results) {
  try {
    await testDb.put('tag_relationships', {
      id: 'array-fundamentals',
      related_tags: [
        { tag: 'hash-table', strength: 0.8 },
        { tag: 'two-pointer', strength: 0.7 }
      ]
    });
    results.tagRelationships = true;
    if (testDb.enableLogging) {
      console.log('✅ TEST DB: Basic tag relationships built');
    }
  } catch (error) {
    if (testDb.enableLogging) {
      console.warn('⚠️ TEST DB: Basic tag relationships failed:', error.message);
    }
  }
}

/**
 * Build problem relationships using production algorithm
 */
async function buildProblemRelationships(testDb, results) {
  try {
    if (testDb.enableLogging) {
      console.log('🔁 TEST DB: Building problem relationships using production algorithm...');
    }

    const { buildProblemRelationships: buildRelationships } = require('../services/relationshipService.js');
    await buildRelationships();

    results.problemRelationships = true;
    if (testDb.enableLogging) {
      console.log('✅ TEST DB: Problem relationships built successfully using production algorithm');
    }
  } catch (error) {
    if (testDb.enableLogging) {
      console.warn('⚠️ TEST DB: Problem relationships building failed:', error.message);
    }
    results.problemRelationships = false;
  }
}

/**
 * Setup basic user data
 */
async function setupUserData(testDb, results) {
  try {
    await testDb.put('tag_mastery', {
      id: 'array',
      mastery_level: 0,
      confidence_score: 0.5,
      last_practiced: new Date().toISOString(),
      practice_count: 0
    });

    await testDb.put('settings', {
      id: 'user_preferences',
      focus_areas: ['array', 'hash-table'],
      sessions_per_week: 3,
      difficulty_preference: 'Medium',
      last_updated: new Date().toISOString()
    });

    results.userSetup = true;
    if (testDb.enableLogging) {
      console.log('✅ TEST DB: User data setup complete');
    }
  } catch (error) {
    if (testDb.enableLogging) {
      console.warn('⚠️ TEST DB: User data setup failed:', error.message);
    }
  }
}

/**
 * Create scenario seed function for a test database
 */
export function createScenarioSeedFunction(testDb) {
  return async (scenarioName) => {
    const scenarios = {
      'empty': async () => {
        // Just ensure clean database - no seeding
      },
      'basic': async () => await seedBasicScenario(testDb),
      'production-like': async () => await seedProductionLikeData(testDb),
      'experienced': async () => await seedExperiencedScenario(testDb)
    };

    const seedFunction = scenarios[scenarioName] || scenarios['basic'];
    await seedFunction();

    if (testDb.enableLogging) {
      console.log(`🌱 DATABASE TEST: Seeded scenario '${scenarioName}' in ${testDb.dbName}`);
    }
  };
}

/**
 * Activate global test database context
 */
export function activateGlobalContext(testDb) {
  // Store original context for restoration
  testDb._originalActive = globalThis._testDatabaseActive;
  testDb._originalHelper = globalThis._testDatabaseHelper;

  // Set global test database context
  globalThis._testDatabaseActive = true;
  globalThis._testDatabaseHelper = testDb;

  if (testDb.enableLogging) {
    console.log('🔄 TEST DB: Activated global context - all services will now use test database');
  }
}

/**
 * Deactivate global test database context
 */
export function deactivateGlobalContext(testDb) {
  // Restore original context
  globalThis._testDatabaseActive = testDb._originalActive;
  globalThis._testDatabaseHelper = testDb._originalHelper;

  if (testDb.enableLogging) {
    console.log('🔄 TEST DB: Deactivated global context - services restored to main database');
  }
}
