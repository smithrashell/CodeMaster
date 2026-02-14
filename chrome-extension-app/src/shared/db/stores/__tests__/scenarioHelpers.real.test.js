/**
 * Tests for scenarioHelpers.js
 *
 * scenarioHelpers exports functions for seeding test databases with specific
 * scenarios. The functions use a testDb wrapper object with .put(storeName, data)
 * and .enableLogging properties. We provide a simple fake wrapper backed by
 * an in-memory Map for each store.
 */

// -- Mocks (before imports) --------------------------------------------------

jest.mock('../standard_problems.js', () => ({
  insertStandardProblems: jest.fn(),
}));

jest.mock('../../../services/focus/relationshipService.js', () => ({
  buildProblemRelationships: jest.fn(),
}));

// -- Imports -----------------------------------------------------------------

import { insertStandardProblems } from '../standard_problems.js';

import {
  seedBasicScenario,
  seedExperiencedScenario,
  seedProductionLikeData,
  createScenarioSeedFunction,
  activateGlobalContext,
  deactivateGlobalContext,
} from '../scenarioHelpers.js';

// -- Test database wrapper ---------------------------------------------------

/**
 * Creates a fake testDb object that mirrors the interface expected by
 * scenarioHelpers (testDb.put, testDb.enableLogging, testDb.dbName).
 */
function createFakeTestDb(enableLogging = false) {
  const stores = {};

  return {
    enableLogging,
    dbName: `test_scenario_${Date.now()}`,
    _stores: stores,
    async put(storeName, data) {
      if (!stores[storeName]) {
        stores[storeName] = [];
      }
      // Replace existing record with same id/tag if present
      const existingIndex = stores[storeName].findIndex(r => {
        if (data.id !== undefined && r.id !== undefined) return r.id === data.id;
        if (data.tag !== undefined && r.tag !== undefined) return r.tag === data.tag;
        return false;
      });
      if (existingIndex >= 0) {
        stores[storeName][existingIndex] = data;
      } else {
        stores[storeName].push(data);
      }
    },
    getStore(storeName) {
      return stores[storeName] || [];
    },
  };
}

// -- Lifecycle ---------------------------------------------------------------

let savedGlobalActive;
let savedGlobalHelper;

beforeEach(() => {
  jest.clearAllMocks();
  // Save global state before each test
  savedGlobalActive = globalThis._testDatabaseActive;
  savedGlobalHelper = globalThis._testDatabaseHelper;
});

afterEach(() => {
  // Restore global state after each test
  globalThis._testDatabaseActive = savedGlobalActive;
  globalThis._testDatabaseHelper = savedGlobalHelper;
});

// -- seedBasicScenario -------------------------------------------------------

describe('seedBasicScenario', () => {
  it('seeds a problem and settings record', async () => {
    const testDb = createFakeTestDb();

    await seedBasicScenario(testDb);

    const problems = testDb.getStore('problems');
    expect(problems).toHaveLength(1);
    expect(problems[0].title).toBe('Two Sum');
    expect(problems[0].difficulty).toBe('Easy');

    const settings = testDb.getStore('settings');
    expect(settings).toHaveLength(1);
    expect(settings[0].focusAreas).toEqual(['array']);
  });

  it('does not throw when put fails and logging is disabled', async () => {
    const testDb = createFakeTestDb(false);
    testDb.put = jest.fn().mockRejectedValue(new Error('put failed'));

    // Should not throw because error is caught
    await expect(seedBasicScenario(testDb)).resolves.toBeUndefined();
  });

  it('logs warning when put fails and logging is enabled', async () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const testDb = createFakeTestDb(true);
    testDb.put = jest.fn().mockRejectedValue(new Error('put failed'));

    await seedBasicScenario(testDb);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Test data seeding failed'),
      expect.any(String)
    );
    consoleSpy.mockRestore();
  });
});

// -- seedExperiencedScenario -------------------------------------------------

describe('seedExperiencedScenario', () => {
  it('seeds 3 problems with different difficulties', async () => {
    const testDb = createFakeTestDb();

    await seedExperiencedScenario(testDb);

    const problems = testDb.getStore('problems');
    expect(problems).toHaveLength(3);

    const difficulties = problems.map(p => p.difficulty);
    expect(difficulties).toContain('Easy');
    expect(difficulties).toContain('Medium');
    expect(difficulties).toContain('Hard');
  });

  it('seeds settings with multiple focus areas', async () => {
    const testDb = createFakeTestDb();

    await seedExperiencedScenario(testDb);

    const settings = testDb.getStore('settings');
    expect(settings).toHaveLength(1);
    expect(settings[0].focusAreas).toEqual(['array', 'linked-list']);
    expect(settings[0].sessionsPerWeek).toBe(7);
  });
});

// -- seedProductionLikeData --------------------------------------------------

describe('seedProductionLikeData', () => {
  it('seeds all 5 components and returns results object', async () => {
    insertStandardProblems.mockResolvedValue();
    const { buildProblemRelationships } = require('../../../services/focus/relationshipService.js');
    buildProblemRelationships.mockResolvedValue();

    const testDb = createFakeTestDb();

    const results = await seedProductionLikeData(testDb);

    expect(results).toBeDefined();
    expect(results.standardProblems).toBe(true);
    expect(results.strategyData).toBe(true);
    expect(results.tagRelationships).toBe(true);
    expect(results.userSetup).toBe(true);
  });

  it('sets global test context for standard problems insertion and restores it', async () => {
    insertStandardProblems.mockResolvedValue();
    const { buildProblemRelationships } = require('../../../services/focus/relationshipService.js');
    buildProblemRelationships.mockResolvedValue();

    const testDb = createFakeTestDb();
    const originalActive = globalThis._testDatabaseActive;
    const originalHelper = globalThis._testDatabaseHelper;

    await seedProductionLikeData(testDb);

    // After completion, global context should be restored
    expect(globalThis._testDatabaseActive).toBe(originalActive);
    expect(globalThis._testDatabaseHelper).toBe(originalHelper);
  });

  it('seeds strategy_data store', async () => {
    insertStandardProblems.mockResolvedValue();
    const { buildProblemRelationships } = require('../../../services/focus/relationshipService.js');
    buildProblemRelationships.mockResolvedValue();

    const testDb = createFakeTestDb();

    await seedProductionLikeData(testDb);

    const strategies = testDb.getStore('strategy_data');
    expect(strategies.length).toBeGreaterThanOrEqual(1);
    expect(strategies[0].id).toBe('array');
  });

  it('seeds tag_relationships store', async () => {
    insertStandardProblems.mockResolvedValue();
    const { buildProblemRelationships } = require('../../../services/focus/relationshipService.js');
    buildProblemRelationships.mockResolvedValue();

    const testDb = createFakeTestDb();

    await seedProductionLikeData(testDb);

    const tagRels = testDb.getStore('tag_relationships');
    expect(tagRels.length).toBeGreaterThanOrEqual(1);
  });

  it('seeds tag_mastery and settings stores', async () => {
    insertStandardProblems.mockResolvedValue();
    const { buildProblemRelationships } = require('../../../services/focus/relationshipService.js');
    buildProblemRelationships.mockResolvedValue();

    const testDb = createFakeTestDb();

    await seedProductionLikeData(testDb);

    const mastery = testDb.getStore('tag_mastery');
    expect(mastery.length).toBeGreaterThanOrEqual(1);
    expect(mastery[0].id).toBe('array');

    const settings = testDb.getStore('settings');
    expect(settings.length).toBeGreaterThanOrEqual(1);
  });

  it('handles insertStandardProblems failure gracefully', async () => {
    insertStandardProblems.mockRejectedValue(new Error('insert failed'));
    const { buildProblemRelationships } = require('../../../services/focus/relationshipService.js');
    buildProblemRelationships.mockResolvedValue();

    const testDb = createFakeTestDb();

    // Should still complete without throwing
    const results = await seedProductionLikeData(testDb);

    expect(results.standardProblems).toBe(false);
    // Other components should still succeed
    expect(results.strategyData).toBe(true);
  });

  it('handles buildProblemRelationships failure gracefully', async () => {
    insertStandardProblems.mockResolvedValue();
    const { buildProblemRelationships } = require('../../../services/focus/relationshipService.js');
    buildProblemRelationships.mockRejectedValue(new Error('build failed'));

    const testDb = createFakeTestDb();

    const results = await seedProductionLikeData(testDb);

    expect(results.problemRelationships).toBe(false);
    expect(results.standardProblems).toBe(true);
  });

  it('logs progress when enableLogging is true', async () => {
    insertStandardProblems.mockResolvedValue();
    const { buildProblemRelationships } = require('../../../services/focus/relationshipService.js');
    buildProblemRelationships.mockResolvedValue();

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const testDb = createFakeTestDb(true);

    await seedProductionLikeData(testDb);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Starting production-like seeding')
    );
    consoleSpy.mockRestore();
  });
});

// -- createScenarioSeedFunction ----------------------------------------------

describe('createScenarioSeedFunction', () => {
  it('returns a function', () => {
    const testDb = createFakeTestDb();
    const seedFn = createScenarioSeedFunction(testDb);
    expect(typeof seedFn).toBe('function');
  });

  it('seeds basic scenario by default for unknown scenario name', async () => {
    const testDb = createFakeTestDb();
    const seedFn = createScenarioSeedFunction(testDb);

    await seedFn('unknown-scenario');

    const problems = testDb.getStore('problems');
    expect(problems).toHaveLength(1); // basic scenario seeds one problem
  });

  it('seeds empty scenario without adding data', async () => {
    const testDb = createFakeTestDb();
    const seedFn = createScenarioSeedFunction(testDb);

    await seedFn('empty');

    const problems = testDb.getStore('problems');
    expect(problems).toHaveLength(0);
  });

  it('seeds basic scenario', async () => {
    const testDb = createFakeTestDb();
    const seedFn = createScenarioSeedFunction(testDb);

    await seedFn('basic');

    const problems = testDb.getStore('problems');
    expect(problems).toHaveLength(1);
    expect(problems[0].title).toBe('Two Sum');
  });

  it('seeds experienced scenario', async () => {
    const testDb = createFakeTestDb();
    const seedFn = createScenarioSeedFunction(testDb);

    await seedFn('experienced');

    const problems = testDb.getStore('problems');
    expect(problems).toHaveLength(3);
  });

  it('seeds production-like scenario', async () => {
    insertStandardProblems.mockResolvedValue();
    const { buildProblemRelationships } = require('../../../services/focus/relationshipService.js');
    buildProblemRelationships.mockResolvedValue();

    const testDb = createFakeTestDb();
    const seedFn = createScenarioSeedFunction(testDb);

    await seedFn('production-like');

    const strategies = testDb.getStore('strategy_data');
    expect(strategies.length).toBeGreaterThanOrEqual(1);
  });

  it('logs scenario name when enableLogging is true', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const testDb = createFakeTestDb(true);
    const seedFn = createScenarioSeedFunction(testDb);

    await seedFn('basic');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Seeded scenario 'basic'")
    );
    consoleSpy.mockRestore();
  });
});

// -- activateGlobalContext / deactivateGlobalContext --------------------------

describe('activateGlobalContext', () => {
  it('sets global test database context', () => {
    const testDb = createFakeTestDb();

    activateGlobalContext(testDb);

    expect(globalThis._testDatabaseActive).toBe(true);
    expect(globalThis._testDatabaseHelper).toBe(testDb);
  });

  it('stores original context on testDb for later restoration', () => {
    globalThis._testDatabaseActive = 'original-active';
    globalThis._testDatabaseHelper = 'original-helper';

    const testDb = createFakeTestDb();
    activateGlobalContext(testDb);

    expect(testDb._originalActive).toBe('original-active');
    expect(testDb._originalHelper).toBe('original-helper');
  });

  it('logs when enableLogging is true', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const testDb = createFakeTestDb(true);

    activateGlobalContext(testDb);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Activated global context')
    );
    consoleSpy.mockRestore();
  });
});

describe('deactivateGlobalContext', () => {
  it('restores original global context', () => {
    const testDb = createFakeTestDb();
    testDb._originalActive = 'was-active';
    testDb._originalHelper = 'was-helper';

    deactivateGlobalContext(testDb);

    expect(globalThis._testDatabaseActive).toBe('was-active');
    expect(globalThis._testDatabaseHelper).toBe('was-helper');
  });

  it('logs when enableLogging is true', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const testDb = createFakeTestDb(true);
    testDb._originalActive = undefined;
    testDb._originalHelper = undefined;

    deactivateGlobalContext(testDb);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Deactivated global context')
    );
    consoleSpy.mockRestore();
  });

  it('round-trips correctly with activateGlobalContext', () => {
    const originalActive = globalThis._testDatabaseActive;
    const originalHelper = globalThis._testDatabaseHelper;

    const testDb = createFakeTestDb();

    activateGlobalContext(testDb);
    expect(globalThis._testDatabaseActive).toBe(true);
    expect(globalThis._testDatabaseHelper).toBe(testDb);

    deactivateGlobalContext(testDb);
    expect(globalThis._testDatabaseActive).toBe(originalActive);
    expect(globalThis._testDatabaseHelper).toBe(originalHelper);
  });
});
