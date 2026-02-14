/**
 * Comprehensive tests for sessionAnalytics.js using real fake-indexeddb.
 *
 * Every test exercises real IndexedDB operations against the session_analytics
 * store (keyPath: 'session_id', indexes: by_date, by_accuracy, by_difficulty).
 * Uses seedStore/readAll helpers for data setup and verification.
 */

// ---------------------------------------------------------------------------
// 1. Mocks (must come before any imports that trigger module resolution)
// ---------------------------------------------------------------------------

jest.mock('../../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), group: jest.fn(), groupEnd: jest.fn() },
}));

jest.mock('../../index.js', () => ({
  dbHelper: { openDB: jest.fn() },
}));

// ---------------------------------------------------------------------------
// 2. Imports (after mocks are registered)
// ---------------------------------------------------------------------------
import { createTestDb, closeTestDb, seedStore, readAll } from '../../../../../test/testDbHelper.js';
import { dbHelper } from '../../index.js';
import {
  storeSessionAnalytics,
  getSessionAnalytics,
  getSessionAnalyticsRange,
  getRecentSessionAnalytics,
  getSessionAnalyticsByAccuracy,
  debugGetAllSessionAnalytics,
  cleanupOldSessionAnalytics,
} from '../sessionAnalytics.js';

// ---------------------------------------------------------------------------
// 3. Test data factories
// ---------------------------------------------------------------------------

function makeSessionSummary(overrides = {}) {
  return {
    session_id: 'sess-001',
    completed_at: '2026-01-15T10:00:00.000Z',
    performance: {
      accuracy: 0.85,
      avgTime: 200,
      strongTags: ['array'],
      weakTags: ['dp'],
      timingFeedback: { overall: 'Good pacing' },
      easy: { attempts: 3, correct: 3, time: 180, avg_time: 60 },
      medium: { attempts: 2, correct: 1, time: 240, avg_time: 120 },
      hard: { attempts: 0, correct: 0, time: 0, avg_time: 0 },
    },
    difficulty_analysis: {
      predominantDifficulty: 'Easy',
      totalProblems: 5,
      percentages: { easy: 60, medium: 40, hard: 0 },
    },
    mastery_progression: {
      new_masteries: 2,
      decayed_masteries: 0,
      deltas: [{ tag: 'array', delta: 0.1 }],
    },
    insights: { summary: 'Solid session' },
    ...overrides,
  };
}

function makeAnalyticsRecord(overrides = {}) {
  return {
    session_id: 'sess-001',
    completed_at: '2026-01-15T10:00:00.000Z',
    accuracy: 0.85,
    avg_time: 200,
    predominant_difficulty: 'Easy',
    total_problems: 5,
    difficulty_mix: { easy: 60, medium: 40, hard: 0 },
    new_masteries: 2,
    decayed_masteries: 0,
    mastery_deltas: [{ tag: 'array', delta: 0.1 }],
    strong_tags: ['array'],
    weak_tags: ['dp'],
    timing_feedback: { overall: 'Good pacing' },
    insights: { summary: 'Solid session' },
    difficulty_breakdown: {
      easy: { attempts: 3, correct: 3, time: 180, avg_time: 60 },
      medium: { attempts: 2, correct: 1, time: 240, avg_time: 120 },
      hard: { attempts: 0, correct: 0, time: 0, avg_time: 0 },
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 4. Test suite
// ---------------------------------------------------------------------------
describe('sessionAnalytics.js (real fake-indexeddb)', () => {
  let testDb;

  beforeEach(async () => {
    testDb = await createTestDb();
    dbHelper.openDB.mockImplementation(() => Promise.resolve(testDb.db));
  });

  afterEach(() => closeTestDb(testDb));

  // =========================================================================
  // storeSessionAnalytics
  // =========================================================================
  describe('storeSessionAnalytics', () => {
    it('stores a valid session summary and persists it to the DB', async () => {
      const summary = makeSessionSummary();
      await storeSessionAnalytics(summary);

      const stored = await readAll(testDb.db, 'session_analytics');
      expect(stored).toHaveLength(1);
      expect(stored[0].session_id).toBe('sess-001');
      expect(stored[0].accuracy).toBe(0.85);
      expect(stored[0].avg_time).toBe(200);
      expect(stored[0].predominant_difficulty).toBe('Easy');
      expect(stored[0].total_problems).toBe(5);
    });

    it('correctly maps performance fields into the analytics record', async () => {
      const summary = makeSessionSummary({
        performance: {
          accuracy: 0.72,
          avgTime: 350,
          strongTags: ['tree'],
          weakTags: ['graph'],
          timingFeedback: { overall: 'Slow' },
          Easy: { attempts: 2, correct: 2, time: 100, avg_time: 50 },
          Medium: { attempts: 3, correct: 1, time: 450, avg_time: 150 },
          hard: { attempts: 1, correct: 0, time: 200, avg_time: 200 },
        },
      });

      await storeSessionAnalytics(summary);

      const stored = await readAll(testDb.db, 'session_analytics');
      expect(stored[0].accuracy).toBe(0.72);
      expect(stored[0].avg_time).toBe(350);
      expect(stored[0].strong_tags).toEqual(['tree']);
      expect(stored[0].weak_tags).toEqual(['graph']);
      // Should pick up Easy (capital) via fallback
      expect(stored[0].difficulty_breakdown.easy.attempts).toBe(2);
      // Should pick up Medium (capital) via fallback
      expect(stored[0].difficulty_breakdown.medium.attempts).toBe(3);
    });

    it('defaults missing performance fields to zeros/empty', async () => {
      const summary = makeSessionSummary({
        performance: null,
        difficulty_analysis: null,
        mastery_progression: null,
        insights: null,
      });

      await storeSessionAnalytics(summary);

      const stored = await readAll(testDb.db, 'session_analytics');
      expect(stored[0].accuracy).toBe(0);
      expect(stored[0].avg_time).toBe(0);
      expect(stored[0].predominant_difficulty).toBe('Unknown');
      expect(stored[0].total_problems).toBe(0);
      expect(stored[0].new_masteries).toBe(0);
      expect(stored[0].decayed_masteries).toBe(0);
    });

    it('throws when sessionSummary is null', async () => {
      await expect(storeSessionAnalytics(null)).rejects.toThrow('sessionSummary is required');
    });

    it('throws when session_id is missing', async () => {
      await expect(storeSessionAnalytics({ completed_at: '2026-01-01' }))
        .rejects.toThrow('sessionSummary.session_id is required');
    });

    it('throws when session_id is not a string', async () => {
      await expect(storeSessionAnalytics({ session_id: 12345, completed_at: '2026-01-01' }))
        .rejects.toThrow('Invalid session_id');
    });

    it('overwrites an existing record with the same session_id (upsert)', async () => {
      await storeSessionAnalytics(makeSessionSummary({ session_id: 'upsert-1' }));
      await storeSessionAnalytics(makeSessionSummary({
        session_id: 'upsert-1',
        performance: { accuracy: 0.99, avgTime: 50 },
      }));

      const stored = await readAll(testDb.db, 'session_analytics');
      expect(stored).toHaveLength(1);
      expect(stored[0].accuracy).toBe(0.99);
    });

    it('stores multiple distinct sessions', async () => {
      await storeSessionAnalytics(makeSessionSummary({ session_id: 'multi-1' }));
      await storeSessionAnalytics(makeSessionSummary({ session_id: 'multi-2' }));
      await storeSessionAnalytics(makeSessionSummary({ session_id: 'multi-3' }));

      const stored = await readAll(testDb.db, 'session_analytics');
      expect(stored).toHaveLength(3);
    });

    it('throws when session_analytics store does not exist in DB', async () => {
      // Create a minimal DB without session_analytics store
      const minimalDb = await new Promise((resolve, reject) => {
        const req = indexedDB.open(`no_analytics_${Date.now()}`, 1);
        req.onupgradeneeded = (e) => {
          e.target.result.createObjectStore('sessions', { keyPath: 'id' });
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
      });

      dbHelper.openDB.mockImplementation(() => Promise.resolve(minimalDb));

      await expect(storeSessionAnalytics(makeSessionSummary()))
        .rejects.toThrow('session_analytics store not found');

      minimalDb.close();
    });
  });

  // =========================================================================
  // getSessionAnalytics
  // =========================================================================
  describe('getSessionAnalytics', () => {
    it('returns null for a non-existent session_id', async () => {
      const result = await getSessionAnalytics('nonexistent');
      expect(result).toBeNull();
    });

    it('retrieves a stored analytics record by session_id', async () => {
      await seedStore(testDb.db, 'session_analytics', [
        makeAnalyticsRecord({ session_id: 'get-1', accuracy: 0.92 }),
      ]);

      const result = await getSessionAnalytics('get-1');
      expect(result).not.toBeNull();
      expect(result.session_id).toBe('get-1');
      expect(result.accuracy).toBe(0.92);
    });

    it('retrieves the correct record among multiple', async () => {
      await seedStore(testDb.db, 'session_analytics', [
        makeAnalyticsRecord({ session_id: 'r1', accuracy: 0.5 }),
        makeAnalyticsRecord({ session_id: 'r2', accuracy: 0.7 }),
        makeAnalyticsRecord({ session_id: 'r3', accuracy: 0.9 }),
      ]);

      const result = await getSessionAnalytics('r2');
      expect(result.accuracy).toBe(0.7);
    });
  });

  // =========================================================================
  // getSessionAnalyticsRange
  // =========================================================================
  describe('getSessionAnalyticsRange', () => {
    it('returns empty array when no records exist', async () => {
      const result = await getSessionAnalyticsRange(
        new Date('2026-01-01'),
        new Date('2026-12-31')
      );
      expect(result).toEqual([]);
    });

    it('returns records within the specified date range', async () => {
      await seedStore(testDb.db, 'session_analytics', [
        makeAnalyticsRecord({ session_id: 'range-1', completed_at: '2026-01-05T10:00:00.000Z' }),
        makeAnalyticsRecord({ session_id: 'range-2', completed_at: '2026-01-15T10:00:00.000Z' }),
        makeAnalyticsRecord({ session_id: 'range-3', completed_at: '2026-02-15T10:00:00.000Z' }),
      ]);

      const result = await getSessionAnalyticsRange(
        new Date('2026-01-01'),
        new Date('2026-01-31')
      );
      expect(result).toHaveLength(2);
      const ids = result.map(r => r.session_id);
      expect(ids).toContain('range-1');
      expect(ids).toContain('range-2');
      expect(ids).not.toContain('range-3');
    });

    it('returns results sorted by date descending (most recent first)', async () => {
      await seedStore(testDb.db, 'session_analytics', [
        makeAnalyticsRecord({ session_id: 'sort-1', completed_at: '2026-01-05T10:00:00.000Z' }),
        makeAnalyticsRecord({ session_id: 'sort-2', completed_at: '2026-01-20T10:00:00.000Z' }),
        makeAnalyticsRecord({ session_id: 'sort-3', completed_at: '2026-01-10T10:00:00.000Z' }),
      ]);

      const result = await getSessionAnalyticsRange(
        new Date('2026-01-01'),
        new Date('2026-01-31')
      );
      expect(result[0].session_id).toBe('sort-2');
      expect(result[1].session_id).toBe('sort-3');
      expect(result[2].session_id).toBe('sort-1');
    });

    it('respects the limit parameter', async () => {
      await seedStore(testDb.db, 'session_analytics', [
        makeAnalyticsRecord({ session_id: 'lim-1', completed_at: '2026-01-05T10:00:00.000Z' }),
        makeAnalyticsRecord({ session_id: 'lim-2', completed_at: '2026-01-10T10:00:00.000Z' }),
        makeAnalyticsRecord({ session_id: 'lim-3', completed_at: '2026-01-15T10:00:00.000Z' }),
        makeAnalyticsRecord({ session_id: 'lim-4', completed_at: '2026-01-20T10:00:00.000Z' }),
      ]);

      const result = await getSessionAnalyticsRange(
        new Date('2026-01-01'),
        new Date('2026-01-31'),
        2
      );
      expect(result).toHaveLength(2);
    });

    it('excludes records outside the date range', async () => {
      await seedStore(testDb.db, 'session_analytics', [
        makeAnalyticsRecord({ session_id: 'out-1', completed_at: '2025-12-15T10:00:00.000Z' }),
        makeAnalyticsRecord({ session_id: 'in-1', completed_at: '2026-01-15T10:00:00.000Z' }),
        makeAnalyticsRecord({ session_id: 'out-2', completed_at: '2026-03-01T10:00:00.000Z' }),
      ]);

      const result = await getSessionAnalyticsRange(
        new Date('2026-01-01'),
        new Date('2026-01-31')
      );
      expect(result).toHaveLength(1);
      expect(result[0].session_id).toBe('in-1');
    });
  });

  // =========================================================================
  // getRecentSessionAnalytics
  // =========================================================================
  describe('getRecentSessionAnalytics', () => {
    it('returns empty array when store is empty', async () => {
      const result = await getRecentSessionAnalytics();
      expect(result).toEqual([]);
    });

    it('returns all records sorted by date descending when fewer than limit', async () => {
      await seedStore(testDb.db, 'session_analytics', [
        makeAnalyticsRecord({ session_id: 'rec-1', completed_at: '2026-01-01T10:00:00.000Z' }),
        makeAnalyticsRecord({ session_id: 'rec-2', completed_at: '2026-01-10T10:00:00.000Z' }),
      ]);

      const result = await getRecentSessionAnalytics(30);
      expect(result).toHaveLength(2);
      expect(result[0].session_id).toBe('rec-2');
      expect(result[1].session_id).toBe('rec-1');
    });

    it('limits results to the specified count', async () => {
      const records = [];
      for (let i = 1; i <= 10; i++) {
        records.push(makeAnalyticsRecord({
          session_id: `bulk-${i}`,
          completed_at: `2026-01-${String(i).padStart(2, '0')}T10:00:00.000Z`,
        }));
      }
      await seedStore(testDb.db, 'session_analytics', records);

      const result = await getRecentSessionAnalytics(3);
      expect(result).toHaveLength(3);
      // Most recent first
      expect(result[0].session_id).toBe('bulk-10');
      expect(result[1].session_id).toBe('bulk-9');
      expect(result[2].session_id).toBe('bulk-8');
    });

    it('defaults limit to 30', async () => {
      const records = [];
      for (let i = 1; i <= 35; i++) {
        records.push(makeAnalyticsRecord({
          session_id: `def-${i}`,
          completed_at: `2026-01-${String(Math.min(i, 28)).padStart(2, '0')}T${String(i % 24).padStart(2, '0')}:00:00.000Z`,
        }));
      }
      await seedStore(testDb.db, 'session_analytics', records);

      const result = await getRecentSessionAnalytics();
      expect(result).toHaveLength(30);
    });
  });

  // =========================================================================
  // getSessionAnalyticsByAccuracy
  // =========================================================================
  describe('getSessionAnalyticsByAccuracy', () => {
    it('returns empty array when no records match the accuracy range', async () => {
      await seedStore(testDb.db, 'session_analytics', [
        makeAnalyticsRecord({ session_id: 'acc-1', accuracy: 0.3 }),
      ]);

      const result = await getSessionAnalyticsByAccuracy(0.8, 1.0);
      expect(result).toEqual([]);
    });

    it('returns records within the accuracy range', async () => {
      await seedStore(testDb.db, 'session_analytics', [
        makeAnalyticsRecord({ session_id: 'acc-low', accuracy: 0.3 }),
        makeAnalyticsRecord({ session_id: 'acc-mid', accuracy: 0.65 }),
        makeAnalyticsRecord({ session_id: 'acc-high', accuracy: 0.9 }),
      ]);

      const result = await getSessionAnalyticsByAccuracy(0.5, 0.8);
      expect(result).toHaveLength(1);
      expect(result[0].session_id).toBe('acc-mid');
    });

    it('includes boundary values in the range', async () => {
      await seedStore(testDb.db, 'session_analytics', [
        makeAnalyticsRecord({ session_id: 'bound-low', accuracy: 0.5 }),
        makeAnalyticsRecord({ session_id: 'bound-high', accuracy: 0.8 }),
      ]);

      const result = await getSessionAnalyticsByAccuracy(0.5, 0.8);
      expect(result).toHaveLength(2);
    });

    it('respects the limit parameter', async () => {
      await seedStore(testDb.db, 'session_analytics', [
        makeAnalyticsRecord({ session_id: 'al-1', accuracy: 0.6 }),
        makeAnalyticsRecord({ session_id: 'al-2', accuracy: 0.65 }),
        makeAnalyticsRecord({ session_id: 'al-3', accuracy: 0.7 }),
        makeAnalyticsRecord({ session_id: 'al-4', accuracy: 0.75 }),
      ]);

      const result = await getSessionAnalyticsByAccuracy(0.5, 0.8, 2);
      expect(result).toHaveLength(2);
    });

    it('returns all matching records when no limit given', async () => {
      const records = [];
      for (let i = 0; i < 10; i++) {
        records.push(makeAnalyticsRecord({
          session_id: `all-acc-${i}`,
          accuracy: 0.5 + i * 0.03,
        }));
      }
      await seedStore(testDb.db, 'session_analytics', records);

      const result = await getSessionAnalyticsByAccuracy(0.5, 0.8);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // debugGetAllSessionAnalytics
  // =========================================================================
  describe('debugGetAllSessionAnalytics', () => {
    it('returns empty array when store is empty', async () => {
      const result = await debugGetAllSessionAnalytics();
      expect(result).toEqual([]);
    });

    it('returns all records in the store', async () => {
      await seedStore(testDb.db, 'session_analytics', [
        makeAnalyticsRecord({ session_id: 'debug-1' }),
        makeAnalyticsRecord({ session_id: 'debug-2' }),
        makeAnalyticsRecord({ session_id: 'debug-3' }),
      ]);

      const result = await debugGetAllSessionAnalytics();
      expect(result).toHaveLength(3);
    });
  });

  // =========================================================================
  // cleanupOldSessionAnalytics
  // =========================================================================
  describe('cleanupOldSessionAnalytics', () => {
    it('returns 0 when store is empty', async () => {
      const count = await cleanupOldSessionAnalytics(30);
      expect(count).toBe(0);
    });

    it('deletes records older than the retention period', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 400);
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10);

      await seedStore(testDb.db, 'session_analytics', [
        makeAnalyticsRecord({ session_id: 'old-1', completed_at: oldDate.toISOString() }),
        makeAnalyticsRecord({ session_id: 'old-2', completed_at: oldDate.toISOString() }),
        makeAnalyticsRecord({ session_id: 'recent-1', completed_at: recentDate.toISOString() }),
      ]);

      const deleteCount = await cleanupOldSessionAnalytics(365);
      expect(deleteCount).toBe(2);

      const remaining = await readAll(testDb.db, 'session_analytics');
      expect(remaining).toHaveLength(1);
      expect(remaining[0].session_id).toBe('recent-1');
    });

    it('does not delete records within the retention period', async () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 5);

      await seedStore(testDb.db, 'session_analytics', [
        makeAnalyticsRecord({ session_id: 'keep-1', completed_at: recentDate.toISOString() }),
        makeAnalyticsRecord({ session_id: 'keep-2', completed_at: new Date().toISOString() }),
      ]);

      const deleteCount = await cleanupOldSessionAnalytics(30);
      expect(deleteCount).toBe(0);

      const remaining = await readAll(testDb.db, 'session_analytics');
      expect(remaining).toHaveLength(2);
    });

    it('respects custom retention days', async () => {
      const eightDaysAgo = new Date();
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      await seedStore(testDb.db, 'session_analytics', [
        makeAnalyticsRecord({ session_id: 'ret-old', completed_at: eightDaysAgo.toISOString() }),
        makeAnalyticsRecord({ session_id: 'ret-new', completed_at: threeDaysAgo.toISOString() }),
      ]);

      const deleteCount = await cleanupOldSessionAnalytics(5);
      expect(deleteCount).toBe(1);

      const remaining = await readAll(testDb.db, 'session_analytics');
      expect(remaining).toHaveLength(1);
      expect(remaining[0].session_id).toBe('ret-new');
    });

    it('defaults to 365 days retention', async () => {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

      await seedStore(testDb.db, 'session_analytics', [
        makeAnalyticsRecord({ session_id: 'ancient', completed_at: twoYearsAgo.toISOString() }),
        makeAnalyticsRecord({ session_id: 'fresh', completed_at: new Date().toISOString() }),
      ]);

      const deleteCount = await cleanupOldSessionAnalytics();
      expect(deleteCount).toBe(1);

      const remaining = await readAll(testDb.db, 'session_analytics');
      expect(remaining).toHaveLength(1);
      expect(remaining[0].session_id).toBe('fresh');
    });
  });

  // =========================================================================
  // Integration: store then retrieve
  // =========================================================================
  describe('integration: store then retrieve', () => {
    it('stores via storeSessionAnalytics then retrieves with getSessionAnalytics', async () => {
      const summary = makeSessionSummary({ session_id: 'int-1' });
      await storeSessionAnalytics(summary);

      const result = await getSessionAnalytics('int-1');
      expect(result).not.toBeNull();
      expect(result.session_id).toBe('int-1');
      expect(result.accuracy).toBe(0.85);
      expect(result.total_problems).toBe(5);
    });

    it('stores multiple then retrieves by range', async () => {
      await storeSessionAnalytics(makeSessionSummary({
        session_id: 'int-r1',
        completed_at: '2026-01-05T10:00:00.000Z',
      }));
      await storeSessionAnalytics(makeSessionSummary({
        session_id: 'int-r2',
        completed_at: '2026-01-15T10:00:00.000Z',
      }));
      await storeSessionAnalytics(makeSessionSummary({
        session_id: 'int-r3',
        completed_at: '2026-02-01T10:00:00.000Z',
      }));

      const result = await getSessionAnalyticsRange(
        new Date('2026-01-01'),
        new Date('2026-01-31')
      );
      expect(result).toHaveLength(2);
    });

    it('stores then retrieves recent analytics sorted correctly', async () => {
      await storeSessionAnalytics(makeSessionSummary({
        session_id: 'int-recent-1',
        completed_at: '2026-01-01T10:00:00.000Z',
      }));
      await storeSessionAnalytics(makeSessionSummary({
        session_id: 'int-recent-2',
        completed_at: '2026-01-20T10:00:00.000Z',
      }));
      await storeSessionAnalytics(makeSessionSummary({
        session_id: 'int-recent-3',
        completed_at: '2026-01-10T10:00:00.000Z',
      }));

      const result = await getRecentSessionAnalytics(10);
      expect(result).toHaveLength(3);
      expect(result[0].session_id).toBe('int-recent-2');
      expect(result[2].session_id).toBe('int-recent-1');
    });

    it('stores then queries by accuracy', async () => {
      await storeSessionAnalytics(makeSessionSummary({
        session_id: 'int-acc-1',
        performance: { accuracy: 0.3, avgTime: 100 },
      }));
      await storeSessionAnalytics(makeSessionSummary({
        session_id: 'int-acc-2',
        performance: { accuracy: 0.7, avgTime: 100 },
      }));
      await storeSessionAnalytics(makeSessionSummary({
        session_id: 'int-acc-3',
        performance: { accuracy: 0.95, avgTime: 100 },
      }));

      const high = await getSessionAnalyticsByAccuracy(0.8, 1.0);
      expect(high).toHaveLength(1);
      expect(high[0].session_id).toBe('int-acc-3');
    });

    it('stores then cleans up old records preserving recent ones', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 50);

      await storeSessionAnalytics(makeSessionSummary({
        session_id: 'int-clean-old',
        completed_at: oldDate.toISOString(),
      }));
      await storeSessionAnalytics(makeSessionSummary({
        session_id: 'int-clean-recent',
        completed_at: new Date().toISOString(),
      }));

      const deleteCount = await cleanupOldSessionAnalytics(30);
      expect(deleteCount).toBe(1);

      const remaining = await readAll(testDb.db, 'session_analytics');
      expect(remaining).toHaveLength(1);
      expect(remaining[0].session_id).toBe('int-clean-recent');
    });

    it('debugGetAllSessionAnalytics returns everything after multiple stores', async () => {
      await storeSessionAnalytics(makeSessionSummary({ session_id: 'dbg-1' }));
      await storeSessionAnalytics(makeSessionSummary({ session_id: 'dbg-2' }));

      const all = await debugGetAllSessionAnalytics();
      expect(all).toHaveLength(2);
      const ids = all.map(r => r.session_id);
      expect(ids).toContain('dbg-1');
      expect(ids).toContain('dbg-2');
    });
  });
});
