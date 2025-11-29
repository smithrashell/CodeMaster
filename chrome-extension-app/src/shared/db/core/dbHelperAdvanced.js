/**
 * 🎯 Database Helper Advanced Methods
 * Complex test isolation and snapshot management methods
 */

import { clear, clearStoreWithLogging, clearConfigStores, handleExpensiveDerivedData, openDB, put } from "./dbHelperMethods.js";

/**
 * Smart teardown for test databases
 */
export async function smartTeardown(helper, options = {}) {
  if (!helper.isTestMode) {
    throw new Error('🚨 SAFETY: Cannot teardown production database');
  }

  const {
    preserveSeededData = true,
    clearUserData = true
  } = options;

  if (helper.enableLogging) {
    console.log(`🧹 TEST DB: Starting smart teardown (preserve seeded: ${preserveSeededData})`);
  }

  const results = {
    preserved: [],
    cleared: [],
    errors: []
  };

  // Define data categories for snapshot-based isolation
  const DATA_CATEGORIES = {
    STATIC: [
      'standard_problems',    // Never changes, expensive to seed (~3000+ problems)
      'strategy_data',        // Static algorithm data
      'tag_relationships'     // Static tag graph data
    ],
    EXPENSIVE_DERIVED: [
      'pattern_ladders',      // Derived from static data but expensive to rebuild
      'problem_relationships' // Modified by tests but very expensive to rebuild
    ],
    TEST_SESSION: [
      'sessions',             // Test session data - clear between tests
      'attempts',             // Test attempt data - clear between tests
      'tag_mastery',          // Test progress data - clear between tests
      'problems'              // Test custom problems - clear between tests
    ],
    CONFIG: [
      'settings',             // User settings - preserve or reset to defaults
      'user_progress',        // User progress state
      'notifications'         // User notifications
    ]
  };

  try {
    // Always clear test session data (fast to recreate)
    for (const storeName of DATA_CATEGORIES.TEST_SESSION) {
      await clearStoreWithLogging(helper, storeName, results);
    }

    // Clear configuration data if requested
    if (clearUserData) {
      await clearConfigStores(helper, DATA_CATEGORIES.CONFIG, results);
    }

    // Handle expensive derived data based on test isolation level
    if (!preserveSeededData) {
      // Full teardown - clear everything including expensive data
      for (const storeName of [...DATA_CATEGORIES.STATIC, ...DATA_CATEGORIES.EXPENSIVE_DERIVED]) {
        await clearStoreWithLogging(helper, storeName, results, '(full teardown)');
      }
    } else {
      // Smart teardown - preserve expensive static data, conditionally clear derived data
      results.preserved = [...DATA_CATEGORIES.STATIC];

      // For expensive derived data, check if tests indicated they modified it
      await handleExpensiveDerivedData(helper, DATA_CATEGORIES.EXPENSIVE_DERIVED, results);

      if (helper.enableLogging) {
        console.log(`💾 TEST DB: Preserved static data: ${results.preserved.join(', ')}`);
      }
    }

    if (helper.enableLogging) {
      console.log(`🧹 TEST DB: Smart teardown complete - cleared: ${results.cleared.length}, preserved: ${results.preserved.length}, errors: ${results.errors.length}`);
    }

    return results;

  } catch (error) {
    if (helper.enableLogging) {
      console.error('❌ TEST DB: Smart teardown failed:', error);
    }
    throw error;
  }
}

/**
 * Create baseline snapshot of expensive derived data
 */
export async function createBaseline(helper) {
  if (!helper.isTestMode) {
    throw new Error('🚨 SAFETY: Baseline snapshots only available in test mode');
  }

  const DATA_CATEGORIES = {
    EXPENSIVE_DERIVED: ['pattern_ladders', 'problem_relationships']
  };

  if (helper.enableLogging) {
    console.log('📸 TEST DB: Creating baseline snapshot...');
  }

  const db = await openDB(helper);
  const snapshotId = `baseline_${Date.now()}`;
  const snapshotData = {};

  // Capture current state of expensive derived stores
  for (const storeName of DATA_CATEGORIES.EXPENSIVE_DERIVED) {
    try {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const data = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      snapshotData[storeName] = {
        data,
        count: data.length,
        timestamp: new Date().toISOString()
      };

      if (helper.enableLogging) {
        console.log(`📸 TEST DB: Captured ${data.length} records from ${storeName}`);
      }
    } catch (error) {
      if (helper.enableLogging) {
        console.error(`❌ TEST DB: Failed to snapshot ${storeName}:`, error.message);
      }
      throw error;
    }
  }

  // Store snapshot metadata
  globalThis._testBaseline = {
    id: snapshotId,
    data: snapshotData,
    created: new Date().toISOString(),
    stores: Object.keys(snapshotData)
  };

  if (helper.enableLogging) {
    const totalRecords = Object.values(snapshotData).reduce((sum, store) => sum + store.count, 0);
    console.log(`✅ TEST DB: Baseline snapshot created - ${totalRecords} records across ${Object.keys(snapshotData).length} stores`);
  }

  return globalThis._testBaseline;
}

/**
 * Restore expensive derived data from baseline snapshot
 */
export async function restoreFromBaseline(helper) {
  if (!helper.isTestMode) {
    throw new Error('🚨 SAFETY: Baseline restoration only available in test mode');
  }

  if (!globalThis._testBaseline) {
    throw new Error('❌ TEST DB: No baseline snapshot available - call createBaseline() first');
  }

  if (helper.enableLogging) {
    console.log('🔄 TEST DB: Restoring from baseline snapshot...');
  }

  const db = await openDB(helper);
  const baseline = globalThis._testBaseline;
  const results = {
    restored: [],
    errors: [],
    totalRecords: 0
  };

  // Restore each snapshotted store
  for (const [storeName, storeSnapshot] of Object.entries(baseline.data)) {
    try {
      // Clear the store first
      await clear(helper, storeName);

      // Restore data from snapshot
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      for (const record of storeSnapshot.data) {
        store.put(record);
      }

      // Wait for transaction to complete
      await new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });

      results.restored.push(storeName);
      results.totalRecords += storeSnapshot.count;

      if (helper.enableLogging) {
        console.log(`✅ TEST DB: Restored ${storeSnapshot.count} records to ${storeName}`);
      }
    } catch (error) {
      results.errors.push({ store: storeName, error: error.message });
      if (helper.enableLogging) {
        console.error(`❌ TEST DB: Failed to restore ${storeName}:`, error.message);
      }
    }
  }

  if (helper.enableLogging) {
    console.log(`🔄 TEST DB: Restoration complete - ${results.totalRecords} records restored to ${results.restored.length} stores`);
  }

  return results;
}

/**
 * Smart test isolation using snapshots
 */
export async function smartTestIsolation(helper, options = {}) {
  const { useSnapshots = true, fullReset = false } = options;

  if (!helper.isTestMode) {
    throw new Error('🚨 SAFETY: Test isolation only available in test mode');
  }

  const DATA_CATEGORIES = {
    TEST_SESSION: ['sessions', 'attempts', 'tag_mastery', 'problems'],
    CONFIG: ['settings', 'user_progress', 'notifications']
  };

  if (helper.enableLogging) {
    console.log(`🧹 TEST DB: Starting smart isolation (snapshots: ${useSnapshots}, full: ${fullReset})`);
  }

  const results = {
    cleared: [],
    restored: [],
    errors: []
  };

  try {
    // Always clear test session data (fast)
    for (const storeName of DATA_CATEGORIES.TEST_SESSION) {
      try {
        await clear(helper, storeName);
        results.cleared.push(storeName);
      } catch (error) {
        results.errors.push({ store: storeName, error: error.message });
      }
    }

    if (fullReset) {
      // Clear config data too
      for (const storeName of DATA_CATEGORIES.CONFIG) {
        try {
          await clear(helper, storeName);
          results.cleared.push(storeName);
        } catch (error) {
          results.errors.push({ store: storeName, error: error.message });
        }
      }
    }

    // Handle expensive derived data
    if (useSnapshots && globalThis._testBaseline) {
      // Fast: restore from snapshot
      const restoreResults = await restoreFromBaseline(helper);
      results.restored = restoreResults.restored;
      results.errors.push(...restoreResults.errors);
    } else if (fullReset) {
      // Slow: clear everything (will need re-seeding)
      const DATA_CATEGORIES_ALL = {
        STATIC: ['standard_problems', 'strategy_data', 'tag_relationships'],
        EXPENSIVE_DERIVED: ['pattern_ladders', 'problem_relationships']
      };

      for (const storeName of [...DATA_CATEGORIES_ALL.STATIC, ...DATA_CATEGORIES_ALL.EXPENSIVE_DERIVED]) {
        try {
          await clear(helper, storeName);
          results.cleared.push(storeName);
        } catch (error) {
          results.errors.push({ store: storeName, error: error.message });
        }
      }
    }

    if (helper.enableLogging) {
      console.log(`✅ TEST DB: Smart isolation complete - cleared: ${results.cleared.length}, restored: ${results.restored.length}, errors: ${results.errors.length}`);
    }

    return results;
  } catch (error) {
    if (helper.enableLogging) {
      console.error(`❌ TEST DB: Smart isolation failed:`, error);
    }
    throw error;
  }
}

/**
 * Reset to clean state
 */
export async function resetToCleanState(helper) {
  if (!helper.isTestMode) {
    throw new Error('🚨 SAFETY: Cannot reset production database');
  }

  // Smart teardown preserving expensive seeded data
  const teardownResults = await smartTeardown(helper, { preserveSeededData: true });

  // Add fresh user baseline data
  try {
    await put(helper, 'tag_mastery', {
      id: 'array',
      mastery_level: 0,
      confidence_score: 0.5,
      last_practiced: new Date().toISOString(),
      practice_count: 0
    });

    await put(helper, 'settings', {
      id: 'user_preferences',
      focus_areas: ['array', 'hash-table'],
      sessions_per_week: 3,
      difficulty_preference: 'Medium',
      last_updated: new Date().toISOString()
    });

    // Rebuild problem relationships using production algorithm
    try {
      if (helper.enableLogging) {
        console.log('🔁 TEST DB: Rebuilding problem relationships...');
      }
      const { buildProblemRelationships } = require('../../services/relationshipService.js');
      await buildProblemRelationships();
      if (helper.enableLogging) {
        console.log('✅ TEST DB: Problem relationships rebuilt successfully');
      }
    } catch (error) {
      if (helper.enableLogging) {
        console.warn('⚠️ TEST DB: Problem relationships rebuild failed:', error.message);
      }
    }

    if (helper.enableLogging) {
      console.log('✅ TEST DB: Reset to clean state with baseline data and fresh relationships');
    }

    return {
      ...teardownResults,
      baselineDataAdded: true,
      relationshipsRebuilt: true
    };

  } catch (error) {
    if (helper.enableLogging) {
      console.warn('⚠️ TEST DB: Failed to add baseline data:', error.message);
    }

    return {
      ...teardownResults,
      baselineDataAdded: false,
      baselineError: error.message
    };
  }
}
