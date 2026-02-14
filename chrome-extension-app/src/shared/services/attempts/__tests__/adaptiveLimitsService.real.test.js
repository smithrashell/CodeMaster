/**
 * Real IndexedDB tests for adaptiveLimitsService.js
 *
 * Uses fake-indexeddb via testDbHelper for getPerformanceData which reads
 * from the attempts store. Other methods are tested via mocked dependencies.
 */

// --- Mocks (must be declared before any imports) ---

jest.mock('../../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), group: jest.fn(), groupEnd: jest.fn() },
}));

jest.mock('../../../db/index.js', () => ({
  dbHelper: { openDB: jest.fn() },
}));

jest.mock('../../../db/stores/standard_problems.js', () => ({
  fetchProblemById: jest.fn(),
}));

jest.mock('../../../utils/timing/AccurateTimer.js', () => ({
  __esModule: true,
  default: {
    secondsToMinutes: jest.fn((s) => s / 60),
  },
}));

jest.mock('../../storage/storageService.js', () => ({
  StorageService: {
    getSettings: jest.fn(),
    setSettings: jest.fn(),
  },
}));

// --- Imports ---

import { dbHelper } from '../../../db/index.js';
import { fetchProblemById } from '../../../db/stores/standard_problems.js';
import { StorageService } from '../../storage/storageService.js';
import {
  AdaptiveLimitsService,
  LIMIT_MODES,
  BASE_LIMITS,
} from '../adaptiveLimitsService.js';
import { createTestDb, closeTestDb, seedStore } from '../../../../../test/testDbHelper.js';

// --- Test setup ---

let testDb;
let service;

beforeEach(async () => {
  testDb = await createTestDb();
  dbHelper.openDB.mockImplementation(() => Promise.resolve(testDb.db));
  service = new AdaptiveLimitsService();
  jest.clearAllMocks();
  // Re-bind after clearAllMocks so dbHelper.openDB still works
  dbHelper.openDB.mockImplementation(() => Promise.resolve(testDb.db));
});

afterEach(() => {
  closeTestDb(testDb);
});

// ---------------------------------------------------------------------------
// Constructor & clearCache
// ---------------------------------------------------------------------------
describe('constructor and clearCache', () => {
  it('initializes with null state', () => {
    const s = new AdaptiveLimitsService();
    expect(s.userSettings).toBeNull();
    expect(s.performanceCache).toBeNull();
    expect(s.cacheExpiry).toBeNull();
  });

  it('clears all caches', () => {
    service.userSettings = { limit: 'off' };
    service.performanceCache = { Easy: {} };
    service.cacheExpiry = Date.now() + 99999;

    service.clearCache();

    expect(service.userSettings).toBeNull();
    expect(service.performanceCache).toBeNull();
    expect(service.cacheExpiry).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getDefaultLimits
// ---------------------------------------------------------------------------
describe('getDefaultLimits', () => {
  it('returns correct defaults for Easy difficulty', () => {
    const result = service.getDefaultLimits('Easy');

    expect(result.difficulty).toBe('Easy');
    expect(result.recommendedTime).toBe(BASE_LIMITS.Easy);
    expect(result.minimumTime).toBe(BASE_LIMITS.Easy);
    expect(result.maximumTime).toBe(BASE_LIMITS.Easy * 1.5);
    expect(result.mode).toBe('fallback');
    expect(result.isAdaptive).toBe(false);
    expect(result.isUnlimited).toBe(false);
  });

  it('returns correct defaults for Hard difficulty', () => {
    const result = service.getDefaultLimits('Hard');

    expect(result.difficulty).toBe('Hard');
    expect(result.recommendedTime).toBe(40);
    expect(result.maximumTime).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// calculateStatistics
// ---------------------------------------------------------------------------
describe('calculateStatistics', () => {
  it('computes correct stats from a list of times', () => {
    const times = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
    const stats = service.calculateStatistics(times);

    expect(stats.attempts).toBe(10);
    expect(stats.average).toBe(550);
    expect(stats.median).toBe(550); // (500+600)/2
    expect(stats.min).toBe(100);
    expect(stats.max).toBe(1000);
    expect(stats.percentile75).toBeDefined();
    expect(stats.percentile90).toBeDefined();
    expect(stats.recent).toHaveLength(10);
  });

  it('handles odd-length arrays correctly for median', () => {
    const times = [10, 20, 30, 40, 50];
    const stats = service.calculateStatistics(times);

    expect(stats.median).toBe(30);
    expect(stats.attempts).toBe(5);
  });

  it('returns default performance for empty array', () => {
    const stats = service.calculateStatistics([]);

    expect(stats.attempts).toBe(0);
    expect(stats.average).toBe(0);
  });

  it('handles single-element array', () => {
    const stats = service.calculateStatistics([120]);

    expect(stats.attempts).toBe(1);
    expect(stats.average).toBe(120);
    expect(stats.median).toBe(120);
    expect(stats.min).toBe(120);
    expect(stats.max).toBe(120);
  });
});

// ---------------------------------------------------------------------------
// getDefaultPerformance
// ---------------------------------------------------------------------------
describe('getDefaultPerformance', () => {
  it('returns zeroed performance object', () => {
    const perf = service.getDefaultPerformance();

    expect(perf.attempts).toBe(0);
    expect(perf.average).toBe(0);
    expect(perf.median).toBe(0);
    expect(perf.percentile75).toBe(0);
    expect(perf.percentile90).toBe(0);
    expect(perf.min).toBe(0);
    expect(perf.max).toBe(0);
    expect(perf.recent).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getPerformanceData (real DB)
// ---------------------------------------------------------------------------
describe('getPerformanceData', () => {
  it('returns default performance when no attempts exist', async () => {
    const result = await service.getPerformanceData('Easy');

    expect(result.attempts).toBe(0);
  });

  it('calculates performance from successful Easy attempts', async () => {
    // Difficulty "1" maps to "Easy" per the internal difficultyMap
    await seedStore(testDb.db, 'attempts', [
      { id: 'a1', Difficulty: 1, Success: true, TimeSpent: 300, attempt_date: '2025-01-01' },
      { id: 'a2', Difficulty: 1, Success: true, TimeSpent: 400, attempt_date: '2025-01-02' },
      { id: 'a3', Difficulty: 1, Success: true, TimeSpent: 500, attempt_date: '2025-01-03' },
      { id: 'a4', Difficulty: 1, Success: true, TimeSpent: 600, attempt_date: '2025-01-04' },
      { id: 'a5', Difficulty: 1, Success: true, TimeSpent: 700, attempt_date: '2025-01-05' },
      { id: 'a6', Difficulty: 1, Success: true, TimeSpent: 800, attempt_date: '2025-01-06' },
    ]);

    const result = await service.getPerformanceData('Easy');

    expect(result.attempts).toBe(6);
    expect(result.average).toBeGreaterThan(0);
    expect(result.median).toBeGreaterThan(0);
  });

  it('filters out failed attempts', async () => {
    await seedStore(testDb.db, 'attempts', [
      { id: 'a1', Difficulty: 2, Success: true, TimeSpent: 500, attempt_date: '2025-01-01' },
      { id: 'a2', Difficulty: 2, Success: false, TimeSpent: 1000, attempt_date: '2025-01-02' },
    ]);

    const result = await service.getPerformanceData('Medium');

    // Only 1 successful attempt
    expect(result.attempts).toBeLessThanOrEqual(1);
  });

  it('filters out outliers above 4 hours (14400s)', async () => {
    await seedStore(testDb.db, 'attempts', [
      { id: 'a1', Difficulty: 3, Success: true, TimeSpent: 1000, attempt_date: '2025-01-01' },
      { id: 'a2', Difficulty: 3, Success: true, TimeSpent: 99999, attempt_date: '2025-01-02' },
    ]);

    const result = await service.getPerformanceData('Hard');

    expect(result.attempts).toBeLessThanOrEqual(1);
  });

  it('uses cache when available and not expired', async () => {
    service.performanceCache = { Easy: { attempts: 42, average: 999, median: 888, percentile75: 777, percentile90: 666, min: 100, max: 2000, recent: [] } };
    service.cacheExpiry = Date.now() + 60 * 60 * 1000;

    const result = await service.getPerformanceData('Easy');

    expect(result.attempts).toBe(42);
    // openDB should not have been called
    expect(dbHelper.openDB).not.toHaveBeenCalled();
  });

  it('returns default performance when cache exists but difficulty not cached', async () => {
    service.performanceCache = { Easy: { attempts: 5 } };
    service.cacheExpiry = Date.now() + 60 * 60 * 1000;

    const result = await service.getPerformanceData('Hard');

    expect(result.attempts).toBe(0);
  });

  it('returns default performance on DB error', async () => {
    dbHelper.openDB.mockRejectedValue(new Error('DB failure'));

    const result = await service.getPerformanceData('Medium');

    expect(result.attempts).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateAdaptiveLimit
// ---------------------------------------------------------------------------
describe('calculateAdaptiveLimit', () => {
  it('returns base limit * 1.1 when not enough attempts', async () => {
    // No attempts seeded -> performance.attempts < 5
    const result = await service.calculateAdaptiveLimit('Easy');

    expect(result).toBeCloseTo(BASE_LIMITS.Easy * 1.1, 1);
  });

  it('computes adaptive limit from real performance data', async () => {
    await seedStore(testDb.db, 'attempts', [
      { id: 'a1', Difficulty: 2, Success: true, TimeSpent: 600, attempt_date: '2025-01-01' },
      { id: 'a2', Difficulty: 2, Success: true, TimeSpent: 700, attempt_date: '2025-01-02' },
      { id: 'a3', Difficulty: 2, Success: true, TimeSpent: 800, attempt_date: '2025-01-03' },
      { id: 'a4', Difficulty: 2, Success: true, TimeSpent: 900, attempt_date: '2025-01-04' },
      { id: 'a5', Difficulty: 2, Success: true, TimeSpent: 1000, attempt_date: '2025-01-05' },
    ]);

    const result = await service.calculateAdaptiveLimit('Medium');

    // Result is constrained between BASE * 0.8 and BASE * 1.8
    expect(result).toBeGreaterThanOrEqual(BASE_LIMITS.Medium * 0.8);
    expect(result).toBeLessThanOrEqual(BASE_LIMITS.Medium * 1.8);
  });
});

// ---------------------------------------------------------------------------
// getUserSettings
// ---------------------------------------------------------------------------
describe('getUserSettings', () => {
  it('returns cached settings when available', async () => {
    service.userSettings = { limit: 'Auto', adaptive: true, sessionLength: 5, reminder: {} };

    const result = await service.getUserSettings();

    expect(result.limit).toBe('Auto');
    expect(StorageService.getSettings).not.toHaveBeenCalled();
  });

  it('fetches from StorageService when not cached', async () => {
    StorageService.getSettings.mockResolvedValue({
      limit: 'Fixed',
      adaptive: false,
      sessionLength: 8,
      reminder: { value: true, label: '10' },
    });

    const result = await service.getUserSettings();

    expect(StorageService.getSettings).toHaveBeenCalled();
    expect(result.limit).toBe('Fixed');
    expect(result.sessionLength).toBe(8);
    expect(result.lastUpdated).toBeDefined();
  });

  it('returns fallback settings on error', async () => {
    StorageService.getSettings.mockRejectedValue(new Error('Storage error'));

    const result = await service.getUserSettings();

    expect(result.limit).toBe(LIMIT_MODES.OFF);
    expect(result.adaptive).toBe(true);
    expect(result.sessionLength).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// updateUserSettings
// ---------------------------------------------------------------------------
describe('updateUserSettings', () => {
  it('merges and saves settings successfully', async () => {
    StorageService.getSettings.mockResolvedValue({ limit: 'off', sessionLength: 5 });
    StorageService.setSettings.mockResolvedValue({ status: 'success' });

    const result = await service.updateUserSettings({ limit: 'Auto' });

    expect(result).toBe(true);
    expect(StorageService.setSettings).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 'Auto', sessionLength: 5 })
    );
    // Cache should be cleared
    expect(service.userSettings).toBeNull();
    expect(service.performanceCache).toBeNull();
  });

  it('returns false on error', async () => {
    StorageService.getSettings.mockRejectedValue(new Error('fail'));

    const result = await service.updateUserSettings({ limit: 'Auto' });

    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getLimits
// ---------------------------------------------------------------------------
describe('getLimits', () => {
  it('returns default limits for invalid problemId (null)', async () => {
    const result = await service.getLimits(null);

    expect(result.difficulty).toBe('Medium');
    expect(result.mode).toBe('fallback');
  });

  it('returns default limits for invalid problemId (boolean)', async () => {
    const result = await service.getLimits(true);

    expect(result.difficulty).toBe('Medium');
    expect(result.mode).toBe('fallback');
  });

  it('handles Off mode with unlimited values', async () => {
    fetchProblemById.mockResolvedValue({ difficulty: 'Easy' });
    StorageService.getSettings.mockResolvedValue({ limit: 'off' });

    const result = await service.getLimits(1);

    expect(result.isUnlimited).toBe(true);
    expect(result.recommendedTime).toBe(999);
    expect(result.mode).toBe('off');
  });

  it('handles Fixed mode with default fixed times for difficulty', async () => {
    fetchProblemById.mockResolvedValue({ difficulty: 'Hard' });
    StorageService.getSettings.mockResolvedValue({ limit: 'Fixed' });

    const result = await service.getLimits(5);

    // DEFAULT_FIXED_TIMES.Hard = 30 (getUserSettings strips fixedTimes)
    expect(result.recommendedTime).toBe(30);
    expect(result.minimumTime).toBe(30);
    expect(result.maximumTime).toBe(Math.round(30 * 1.5));
    expect(result.isAdaptive).toBe(false);
  });

  it('handles legacy Fixed_15 mode', async () => {
    fetchProblemById.mockResolvedValue({ difficulty: 'Medium' });
    StorageService.getSettings.mockResolvedValue({ limit: '15' });

    const result = await service.getLimits(2);

    expect(result.recommendedTime).toBe(15);
    expect(result.minimumTime).toBe(15);
  });

  it('handles legacy Fixed_20 mode', async () => {
    fetchProblemById.mockResolvedValue({ difficulty: 'Medium' });
    StorageService.getSettings.mockResolvedValue({ limit: '20' });

    const result = await service.getLimits(2);

    expect(result.recommendedTime).toBe(20);
  });

  it('handles legacy Fixed_30 mode', async () => {
    fetchProblemById.mockResolvedValue({ difficulty: 'Medium' });
    StorageService.getSettings.mockResolvedValue({ limit: '30' });

    const result = await service.getLimits(2);

    expect(result.recommendedTime).toBe(30);
  });

  it('defaults to Medium when fetchProblemById returns no difficulty', async () => {
    fetchProblemById.mockResolvedValue({});
    StorageService.getSettings.mockResolvedValue({ limit: 'off' });

    const result = await service.getLimits(99);

    expect(result.difficulty).toBe('Medium');
  });

  it('defaults to Medium when fetchProblemById throws', async () => {
    fetchProblemById.mockRejectedValue(new Error('not found'));
    StorageService.getSettings.mockResolvedValue({ limit: 'off' });

    const result = await service.getLimits(99);

    expect(result.difficulty).toBe('Medium');
  });

  it('returns fallback result when getUserSettings throws', async () => {
    fetchProblemById.mockResolvedValue({ difficulty: 'Easy' });
    StorageService.getSettings.mockRejectedValue(new Error('settings boom'));
    // Force userSettings to null so getUserSettings is called
    service.userSettings = null;

    const result = await service.getLimits(1);

    // The outer catch in getLimits should still return a valid result
    expect(result).toHaveProperty('difficulty');
    expect(result).toHaveProperty('recommendedTime');
    expect(result).toHaveProperty('baseTime');
  });

  it('handles unknown mode by falling back to base limits', async () => {
    fetchProblemById.mockResolvedValue({ difficulty: 'Easy' });
    StorageService.getSettings.mockResolvedValue({ limit: 'unknown_mode_xyz' });

    const result = await service.getLimits(1);

    expect(result.recommendedTime).toBe(BASE_LIMITS.Easy);
    expect(result.isAdaptive).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// _calculateTimeConfigByMode
// ---------------------------------------------------------------------------
describe('_calculateTimeConfigByMode', () => {
  it('returns adaptive config for Auto mode', async () => {
    // With no attempts, calculateAdaptiveLimit returns base * 1.1
    const config = await service._calculateTimeConfigByMode('Auto', 'Medium', {});

    expect(config.isAdaptive).toBe(true);
    expect(config.recommendedTime).toBeCloseTo(BASE_LIMITS.Medium * 1.1, 1);
    expect(config.minimumTime).toBe(BASE_LIMITS.Medium);
  });

  it('returns Fixed config with default fixed times when no fixedTimes in settings', async () => {
    const config = await service._calculateTimeConfigByMode('Fixed', 'Easy', {});

    expect(config.recommendedTime).toBe(15); // DEFAULT_FIXED_TIMES.Easy
    expect(config.minimumTime).toBe(15);
    expect(config.maximumTime).toBe(22.5);
    expect(config.isAdaptive).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// LIMIT_MODES and BASE_LIMITS exports
// ---------------------------------------------------------------------------
describe('exported constants', () => {
  it('LIMIT_MODES has expected keys', () => {
    expect(LIMIT_MODES.AUTO).toBe('Auto');
    expect(LIMIT_MODES.OFF).toBe('off');
    expect(LIMIT_MODES.FIXED).toBe('Fixed');
    expect(LIMIT_MODES.FIXED_15).toBe('15');
    expect(LIMIT_MODES.FIXED_20).toBe('20');
    expect(LIMIT_MODES.FIXED_30).toBe('30');
  });

  it('BASE_LIMITS has standard values', () => {
    expect(BASE_LIMITS.Easy).toBe(15);
    expect(BASE_LIMITS.Medium).toBe(25);
    expect(BASE_LIMITS.Hard).toBe(40);
  });
});
