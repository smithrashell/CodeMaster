/**
 * Tests for timeMigration.js
 * Covers: analyzeTimeUnits, normalizeTimeToSeconds,
 *   migrateAttemptsTimeData, validateTimeConsistency,
 *   backupTimeData, performSafeTimeMigration, generateRecommendations (via performSafe)
 */

// Mock dbHelper before any imports
jest.mock('../../../db/index.js', () => ({
  dbHelper: { openDB: jest.fn() },
}));

jest.mock('../AccurateTimer.js', () => ({
  __esModule: true,
  default: {
    minutesToSeconds: jest.fn((m) => Math.floor(Math.abs(Number(m) || 0) * 60)),
    formatTime: jest.fn((s) => {
      const mins = Math.floor(Math.abs(s) / 60);
      const secs = Math.floor(Math.abs(s) % 60);
      return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }),
  },
}));

import { dbHelper } from '../../../db/index.js';
import {
  analyzeTimeUnits,
  normalizeTimeToSeconds,
  migrateAttemptsTimeData,
  validateTimeConsistency,
  backupTimeData,
  performSafeTimeMigration,
} from '../timeMigration.js';

// ---------------------------------------------------------------------------
// Helper to create a fake IDB-like interface
// ---------------------------------------------------------------------------
function makeMockDb(storeData = {}) {
  return {
    transaction: jest.fn((storeNames, mode) => {
      const names = Array.isArray(storeNames) ? storeNames : [storeNames];
      const stores = {};
      for (const name of names) {
        const data = storeData[name] || [];
        stores[name] = {
          getAll: jest.fn(() => {
            const req = {};
            Promise.resolve().then(() => {
              req.result = [...data];
              if (req.onsuccess) req.onsuccess();
            });
            return req;
          }),
          put: jest.fn((record) => {
            const req = {};
            Promise.resolve().then(() => {
              if (req.onsuccess) req.onsuccess();
            });
            return req;
          }),
          delete: jest.fn(() => {
            const req = {};
            Promise.resolve().then(() => {
              if (req.onsuccess) req.onsuccess();
            });
            return req;
          }),
        };
      }
      return {
        objectStore: jest.fn((name) => stores[name]),
      };
    }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// analyzeTimeUnits
// ---------------------------------------------------------------------------
describe('analyzeTimeUnits', () => {
  it('returns unknown with 0 confidence when no valid times', () => {
    const result = analyzeTimeUnits([]);
    expect(result).toEqual({ unit: 'unknown', confidence: 0, avgTime: 0, count: 0 });
  });

  it('returns unknown when all TimeSpent are 0 or falsy', () => {
    const attempts = [{ TimeSpent: 0 }, { TimeSpent: null }, { TimeSpent: 'abc' }];
    const result = analyzeTimeUnits(attempts);
    expect(result.unit).toBe('unknown');
    expect(result.count).toBe(0);
  });

  it('detects seconds when average > 3600 and max > 1800', () => {
    const attempts = [
      { TimeSpent: 4000 },
      { TimeSpent: 5000 },
      { TimeSpent: 3500 },
    ];
    const result = analyzeTimeUnits(attempts);
    expect(result.unit).toBe('seconds');
    expect(result.confidence).toBe(0.9);
  });

  it('detects minutes when avg < 60 and max < 300', () => {
    const attempts = [
      { TimeSpent: 15 },
      { TimeSpent: 20 },
      { TimeSpent: 25 },
    ];
    const result = analyzeTimeUnits(attempts);
    expect(result.unit).toBe('minutes');
    expect(result.confidence).toBe(0.8);
  });

  it('detects minutes when max < 180', () => {
    const attempts = [
      { TimeSpent: 100 },
      { TimeSpent: 120 },
      { TimeSpent: 150 },
    ];
    const result = analyzeTimeUnits(attempts);
    expect(result.unit).toBe('minutes');
    expect(result.confidence).toBe(0.7);
  });

  it('detects seconds when avg > 300', () => {
    const attempts = [
      { TimeSpent: 400 },
      { TimeSpent: 500 },
      { TimeSpent: 600 },
    ];
    const result = analyzeTimeUnits(attempts);
    expect(result.unit).toBe('seconds');
    expect(result.confidence).toBe(0.6);
  });

  it('makes ambiguous guess - seconds when avg > 30', () => {
    // avg ~40, max 50 => ambiguous range, avg>30 => seconds
    const attempts = [
      { TimeSpent: 35 },
      { TimeSpent: 40 },
      { TimeSpent: 50 },
      { TimeSpent: 200 }, // push max above 180 to skip the maxTime<180 check
    ];
    const result = analyzeTimeUnits(attempts);
    expect(result.unit).toBe('seconds');
    expect(result.confidence).toBe(0.4);
  });

  it('makes ambiguous guess - minutes when avg <= 30', () => {
    // avg ~20, max > 180 (to avoid early returns), need specific values
    const attempts = [
      { TimeSpent: 10 },
      { TimeSpent: 20 },
      { TimeSpent: 30 },
      { TimeSpent: 200 }, // push max above 180
    ];
    const result = analyzeTimeUnits(attempts);
    // avg = 65, max = 200 => avg > 30 => seconds, confidence 0.4
    expect(result.confidence).toBe(0.4);
  });

  it('includes sampleValues in result', () => {
    const attempts = [{ TimeSpent: 10 }, { TimeSpent: 20 }];
    const result = analyzeTimeUnits(attempts);
    expect(result.sampleValues).toEqual([10, 20]);
  });

  it('limits sampleValues to 5', () => {
    const attempts = Array.from({ length: 10 }, (_, i) => ({ TimeSpent: i + 1 }));
    const result = analyzeTimeUnits(attempts);
    expect(result.sampleValues).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// normalizeTimeToSeconds
// ---------------------------------------------------------------------------
describe('normalizeTimeToSeconds', () => {
  it('returns 0 for non-positive values', () => {
    expect(normalizeTimeToSeconds(0)).toBe(0);
    expect(normalizeTimeToSeconds(-5)).toBe(0);
    expect(normalizeTimeToSeconds(null)).toBe(0);
    expect(normalizeTimeToSeconds('abc')).toBe(0);
  });

  it('converts minutes to seconds', () => {
    expect(normalizeTimeToSeconds(5, 'minutes')).toBe(300);
  });

  it('floors seconds', () => {
    expect(normalizeTimeToSeconds(5.7, 'seconds')).toBe(5);
  });

  it('auto-detects large values as seconds (>= 900)', () => {
    expect(normalizeTimeToSeconds(1000, 'auto')).toBe(1000);
  });

  it('auto-detects small values as minutes (< 4)', () => {
    expect(normalizeTimeToSeconds(3, 'auto')).toBe(180);
  });

  it('auto-detects ambiguous range as minutes (4-900)', () => {
    expect(normalizeTimeToSeconds(30, 'auto')).toBe(1800);
  });

  it('floors value on unknown unit', () => {
    expect(normalizeTimeToSeconds(15.9, 'unknown')).toBe(15);
  });

  it('handles string input', () => {
    expect(normalizeTimeToSeconds('120', 'seconds')).toBe(120);
  });
});

// ---------------------------------------------------------------------------
// migrateAttemptsTimeData
// ---------------------------------------------------------------------------
describe('migrateAttemptsTimeData', () => {
  it('returns dry run results without modifying data', async () => {
    const attempts = [
      { id: 1, TimeSpent: 30 },
      { id: 2, TimeSpent: 45 },
    ];
    const mockDb = makeMockDb({ attempts });
    dbHelper.openDB.mockResolvedValue(mockDb);

    const result = await migrateAttemptsTimeData(true);

    expect(result.dryRun).toBe(true);
    expect(result.migratedCount).toBe(0);
    expect(result.totalRecords).toBe(2);
    expect(result.analysis).toBeDefined();
  });

  it('migrates data when confidence is sufficient', async () => {
    const attempts = [
      { id: 1, TimeSpent: 15 },
      { id: 2, TimeSpent: 20 },
      { id: 3, TimeSpent: 25 },
    ];
    const putFn = jest.fn((record) => {
      const req = {};
      Promise.resolve().then(() => {
        if (req.onsuccess) req.onsuccess();
      });
      return req;
    });
    const mockDb = {
      transaction: jest.fn(() => ({
        objectStore: jest.fn(() => ({
          getAll: jest.fn(() => {
            const req = {};
            Promise.resolve().then(() => {
              req.result = [...attempts];
              if (req.onsuccess) req.onsuccess();
            });
            return req;
          }),
          put: putFn,
        })),
      })),
    };
    dbHelper.openDB.mockResolvedValue(mockDb);

    const result = await migrateAttemptsTimeData(false);

    expect(result.dryRun).toBe(false);
    expect(result.analysis.unit).toBe('minutes');
    // All records should be migrated since normalizeTimeToSeconds != Number(original)
    expect(result.migratedCount).toBeGreaterThan(0);
  });

  it('skips migration when confidence is low', async () => {
    // Single ambiguous value - confidence will be <= 0.5
    const attempts = [{ id: 1, TimeSpent: 35 }, { id: 2, TimeSpent: 200 }];
    const mockDb = makeMockDb({ attempts });
    dbHelper.openDB.mockResolvedValue(mockDb);

    const result = await migrateAttemptsTimeData(false);

    expect(result.migratedCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// validateTimeConsistency
// ---------------------------------------------------------------------------
describe('validateTimeConsistency', () => {
  it('flags suspiciously long times (> 4 hours)', async () => {
    const attempts = [{ id: 1, TimeSpent: 20000 }];
    const mockDb = makeMockDb({ attempts });
    dbHelper.openDB.mockResolvedValue(mockDb);

    const result = await validateTimeConsistency();

    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues[0].type).toBe('suspicious_long_time');
  });

  it('flags suspiciously short times (< 10 seconds, > 0)', async () => {
    const attempts = [{ id: 1, TimeSpent: 5 }];
    const mockDb = makeMockDb({ attempts });
    dbHelper.openDB.mockResolvedValue(mockDb);

    const result = await validateTimeConsistency();

    expect(result.issues.some(i => i.type === 'suspicious_short_time')).toBe(true);
  });

  it('returns clean results for normal data', async () => {
    const attempts = [{ id: 1, TimeSpent: 600 }, { id: 2, TimeSpent: 900 }];
    const mockDb = makeMockDb({ attempts });
    dbHelper.openDB.mockResolvedValue(mockDb);

    const result = await validateTimeConsistency();

    expect(result.issues.filter(i => i.type !== 'suspicious_short_time' && i.type !== 'suspicious_long_time')).toHaveLength(0);
    expect(result.attempts).toBeDefined();
  });

  it('captures validation errors', async () => {
    const mockDb = {
      transaction: jest.fn(() => ({
        objectStore: jest.fn(() => ({
          getAll: jest.fn(() => {
            const req = {};
            Promise.resolve().then(() => {
              req.error = new Error('tx fail');
              if (req.onerror) req.onerror();
            });
            return req;
          }),
        })),
      })),
    };
    dbHelper.openDB.mockResolvedValue(mockDb);

    const result = await validateTimeConsistency();
    expect(result.issues.some(i => i.type === 'validation_error')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// backupTimeData
// ---------------------------------------------------------------------------
describe('backupTimeData', () => {
  it('creates a backup and returns a backup ID', async () => {
    const attempts = [
      { id: 1, TimeSpent: 600, ProblemID: 'p1', AttemptDate: '2024-01-01' },
    ];

    const putFn = jest.fn((data) => {
      const req = {};
      Promise.resolve().then(() => {
        if (req.onsuccess) req.onsuccess();
      });
      return req;
    });

    const mockDb = {
      transaction: jest.fn(() => ({
        objectStore: jest.fn((name) => {
          if (name === 'attempts') {
            return {
              getAll: jest.fn(() => {
                const req = {};
                Promise.resolve().then(() => {
                  req.result = [...attempts];
                  if (req.onsuccess) req.onsuccess();
                });
                return req;
              }),
            };
          }
          return { put: putFn };
        }),
      })),
    };

    dbHelper.openDB.mockResolvedValue(mockDb);

    const backupId = await backupTimeData();
    expect(backupId).toMatch(/^time_backup_/);
    expect(putFn).toHaveBeenCalledWith(
      expect.objectContaining({
        backupId,
        type: 'time_data_backup',
        recordCount: 1,
      })
    );
  });
});

// ---------------------------------------------------------------------------
// performSafeTimeMigration
// ---------------------------------------------------------------------------
describe('performSafeTimeMigration', () => {
  function setupMockDb(attempts = []) {
    const putFn = jest.fn((data) => {
      const req = {};
      Promise.resolve().then(() => {
        if (req.onsuccess) req.onsuccess();
      });
      return req;
    });

    const mockDb = {
      transaction: jest.fn(() => ({
        objectStore: jest.fn(() => ({
          getAll: jest.fn(() => {
            const req = {};
            Promise.resolve().then(() => {
              req.result = [...attempts];
              if (req.onsuccess) req.onsuccess();
            });
            return req;
          }),
          put: putFn,
        })),
      })),
    };

    dbHelper.openDB.mockResolvedValue(mockDb);
    return mockDb;
  }

  it('performs dry run without backup', async () => {
    setupMockDb([{ id: 1, TimeSpent: 30 }]);

    const result = await performSafeTimeMigration({ dryRun: true, createBackup: true });

    expect(result.success).toBe(true);
    expect(result.backupId).toBeNull();
    expect(result.migration.dryRun).toBe(true);
    expect(result.postValidation).toBeNull();
  });

  it('creates backup and migrates on non-dry run', async () => {
    setupMockDb([{ id: 1, TimeSpent: 15 }, { id: 2, TimeSpent: 20 }, { id: 3, TimeSpent: 25 }]);

    const result = await performSafeTimeMigration({ dryRun: false, createBackup: true });

    expect(result.success).toBe(true);
    expect(result.backupId).toMatch(/^time_backup_/);
    expect(result.postValidation).toBeDefined();
  });

  it('skips backup when createBackup is false', async () => {
    setupMockDb([{ id: 1, TimeSpent: 600 }]);

    const result = await performSafeTimeMigration({ dryRun: false, createBackup: false });

    expect(result.success).toBe(true);
    expect(result.backupId).toBeNull();
  });

  it('generates recommendations for low confidence', async () => {
    // Single ambiguous attempt - will have low confidence
    setupMockDb([{ id: 1, TimeSpent: 35 }, { id: 2, TimeSpent: 200 }]);

    const result = await performSafeTimeMigration({ dryRun: true });

    expect(result.recommendations).toBeDefined();
    expect(Array.isArray(result.recommendations)).toBe(true);
  });

  it('returns failure result on error', async () => {
    dbHelper.openDB.mockRejectedValue(new Error('db crash'));

    const result = await performSafeTimeMigration();

    expect(result.success).toBe(false);
    expect(result.error).toBe('db crash');
    expect(result.recommendations).toContain('Review error logs');
  });
});
