/**
 * Tests for getLatestSessionByType date sorting
 *
 * Critical test: When multiple sessions exist with the same type and status,
 * the function must return the most recent one by date.
 *
 * This prevents the bug where attempts were associated with old sessions
 * instead of the current active session.
 *
 * SKIPPED: Duplicates browser integration test #20 (testSessionDateSorting)
 * which tests the exact same scenario with real IndexedDB. The browser
 * version is more authoritative. See GitHub issue for migration plan.
 */

import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";

// Reset IndexedDB before each test
beforeEach(() => {
  global.indexedDB = new IDBFactory();
});

// Mock logger
jest.mock('../../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe.skip('getLatestSessionByType - Date Sorting', () => {
  // Test the sorting logic in isolation since full DB integration is complex
  describe('date sorting algorithm', () => {
    it('should sort sessions by date descending and return the newest', () => {
      const sessions = [
        { id: 'old', date: '2026-01-01T10:00:00.000Z' },
        { id: 'newest', date: '2026-01-02T16:00:00.000Z' },
        { id: 'middle', date: '2026-01-02T10:00:00.000Z' },
      ];

      // This is the exact sorting logic used in getLatestSessionByType
      sessions.sort((a, b) => new Date(b.date) - new Date(a.date));
      const latest = sessions[0];

      expect(latest.id).toBe('newest');
    });

    it('should handle same-day sessions with different times', () => {
      const sessions = [
        { id: 'morning', date: '2026-01-02T09:00:00.000Z' },
        { id: 'evening', date: '2026-01-02T20:00:00.000Z' },
        { id: 'afternoon', date: '2026-01-02T14:00:00.000Z' },
      ];

      sessions.sort((a, b) => new Date(b.date) - new Date(a.date));
      const latest = sessions[0];

      expect(latest.id).toBe('evening');
    });

    it('should handle sessions across multiple days', () => {
      const sessions = [
        { id: 'day1', date: '2025-12-30T10:00:00.000Z' },
        { id: 'day3', date: '2026-01-01T10:00:00.000Z' },
        { id: 'day2', date: '2025-12-31T10:00:00.000Z' },
      ];

      sessions.sort((a, b) => new Date(b.date) - new Date(a.date));
      const latest = sessions[0];

      expect(latest.id).toBe('day3');
    });

    it('should return single session when only one exists', () => {
      const sessions = [
        { id: 'only-one', date: '2026-01-02T12:00:00.000Z' },
      ];

      sessions.sort((a, b) => new Date(b.date) - new Date(a.date));
      const latest = sessions[0];

      expect(latest.id).toBe('only-one');
    });

    it('should handle empty array gracefully', () => {
      const sessions = [];
      sessions.sort((a, b) => new Date(b.date) - new Date(a.date));
      const latest = sessions[0] || null;

      expect(latest).toBeNull();
    });
  });

  describe('real-world scenario simulation', () => {
    it('should correctly identify the current session over old ones - the bug we fixed', () => {
      // Simulating the exact bug scenario from user report:
      // - Old session created hours ago
      // - New session created recently
      // - Attempts should go to the NEW session

      const oldSessionFromMorning = {
        id: 'b4688d31-3dab-438e-b72a-fdff0e482406', // Old session ID from bug report
        session_type: 'standard',
        status: 'in_progress',
        date: '2026-01-02T10:00:00.000Z', // Created in morning
      };

      const currentSession = {
        id: '12ea5cb3-57d6-406c-a6ce-d9683b5a88c1', // New session ID from bug report
        session_type: 'standard',
        status: 'in_progress',
        date: '2026-01-02T16:25:36.718Z', // Created in afternoon
      };

      // Simulate IndexedDB returning sessions in arbitrary order
      const sessionsFromDB = [oldSessionFromMorning, currentSession];

      // Apply the sorting fix
      sessionsFromDB.sort((a, b) => new Date(b.date) - new Date(a.date));
      const latestSession = sessionsFromDB[0];

      // Should return the CURRENT session, not the old one
      expect(latestSession.id).toBe('12ea5cb3-57d6-406c-a6ce-d9683b5a88c1');
      expect(latestSession.date).toBe('2026-01-02T16:25:36.718Z');
    });
  });
});
