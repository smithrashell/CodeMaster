/**
 * Tests for scheduleService.js
 * Schedule logic for spaced repetition review system
 */

jest.mock('../../../db/stores/problems.js', () => ({
  fetchAllProblems: jest.fn()
}));

import { isDueForReview, isRecentlyAttempted, getDailyReviewSchedule } from '../scheduleService.js';
import { fetchAllProblems } from '../../../db/stores/problems.js';

describe('isDueForReview', () => {
  it('should return true for a past date', () => {
    const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(isDueForReview(pastDate)).toBe(true);
  });

  it('should return true for today (now)', () => {
    const now = new Date().toISOString();
    expect(isDueForReview(now)).toBe(true);
  });

  it('should return false for a future date', () => {
    const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(isDueForReview(futureDate)).toBe(false);
  });

  it('should return true for null/undefined (NaN date <= now)', () => {
    // new Date(null) => epoch, new Date(undefined) => Invalid Date
    // Invalid Date comparisons return false, epoch is in past => true
    expect(isDueForReview(null)).toBe(true);
  });

  it('should handle invalid date string', () => {
    // new Date('not-a-date') => Invalid Date, comparison returns false
    expect(isDueForReview('not-a-date')).toBe(false);
  });

  it('should return true for date exactly at midnight today', () => {
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    expect(isDueForReview(todayMidnight.toISOString())).toBe(true);
  });
});

describe('isRecentlyAttempted', () => {
  it('should return true when within skip interval', () => {
    const yesterday = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    // box_level 3 => skipInterval=2, with relaxation => 1 day, yesterday < 1 day is false
    // box_level 4 => skipInterval=4, with relaxation => 2 days, yesterday (1 day) < 2 => true
    expect(isRecentlyAttempted(yesterday, 4, true)).toBe(true);
  });

  it('should return false when old enough', () => {
    const longAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(isRecentlyAttempted(longAgo, 3, true)).toBe(false);
  });

  it('should scale interval with box level', () => {
    // Box level 1 => skip interval = 0 (or floor) => no skip
    // Box level 7 => skip interval = 30 days
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

    // Box 1: [0,1,2,...][0] = 0, but 0||14 = 14, relaxation=7 => daysSince(2) < 7 => true
    expect(isRecentlyAttempted(twoDaysAgo, 1, true)).toBe(true);

    // Box 7: interval=30, relaxation=15 => daysSince(2) < 15 => true
    expect(isRecentlyAttempted(twoDaysAgo, 7, true)).toBe(true);
  });

  it('should halve interval with relaxation enabled', () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    // Box 5: interval=7
    // With relaxation: 7/2 = 3.5 => 5 days > 3.5 => false
    expect(isRecentlyAttempted(fiveDaysAgo, 5, true)).toBe(false);
    // Without relaxation: 7 => 5 days < 7 => true
    expect(isRecentlyAttempted(fiveDaysAgo, 5, false)).toBe(true);
  });

  it('should use full interval without relaxation', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    // Box 4: interval=4, no relaxation => 3 < 4 => true
    expect(isRecentlyAttempted(threeDaysAgo, 4, false)).toBe(true);
  });

  it('should default to 14-day interval for unknown box levels', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    // Box 8 (out of array range): defaults to 14, with relaxation => 7 => 10 > 7 => false
    expect(isRecentlyAttempted(tenDaysAgo, 8, true)).toBe(false);
    // 5 days ago with box 8: 5 < 7 => true
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    expect(isRecentlyAttempted(fiveDaysAgo, 8, true)).toBe(true);
  });

  it('should handle boundary edge case', () => {
    // Box 6: interval=14, with relaxation => 7
    const exactlySevenDays = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    // daysSinceLastAttempt is ~7, skipInterval is 7 => 7 < 7 is false
    expect(isRecentlyAttempted(exactlySevenDays, 6, true)).toBe(false);
  });
});

describe('getDailyReviewSchedule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return all due problems when no limit', async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    fetchAllProblems.mockResolvedValue([
      { leetcode_id: 1, title: 'P1', review_schedule: pastDate },
      { leetcode_id: 2, title: 'P2', review_schedule: pastDate }
    ]);
    const result = await getDailyReviewSchedule(null);
    expect(result).toHaveLength(2);
  });

  it('should limit results when maxProblems is set', async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    fetchAllProblems.mockResolvedValue([
      { leetcode_id: 1, title: 'P1', review_schedule: pastDate },
      { leetcode_id: 2, title: 'P2', review_schedule: pastDate },
      { leetcode_id: 3, title: 'P3', review_schedule: pastDate }
    ]);
    const result = await getDailyReviewSchedule(2);
    expect(result).toHaveLength(2);
  });

  it('should sort most overdue first', async () => {
    const veryOld = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const recent = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    fetchAllProblems.mockResolvedValue([
      { leetcode_id: 1, title: 'Recent', review_schedule: recent },
      { leetcode_id: 2, title: 'Very Old', review_schedule: veryOld }
    ]);
    const result = await getDailyReviewSchedule(null);
    expect(result[0].leetcode_id).toBe(2); // most overdue first
  });

  it('should return empty when no problems are due', async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    fetchAllProblems.mockResolvedValue([
      { leetcode_id: 1, title: 'P1', review_schedule: futureDate }
    ]);
    const result = await getDailyReviewSchedule(null);
    expect(result).toHaveLength(0);
  });

  it('should return empty array on DB error', async () => {
    fetchAllProblems.mockRejectedValue(new Error('DB down'));
    const result = await getDailyReviewSchedule(null);
    expect(result).toEqual([]);
  });

  it('should handle empty problems array', async () => {
    fetchAllProblems.mockResolvedValue([]);
    const result = await getDailyReviewSchedule(null);
    expect(result).toEqual([]);
  });

  it('should handle non-array response from fetchAllProblems', async () => {
    fetchAllProblems.mockResolvedValue(null);
    const result = await getDailyReviewSchedule(null);
    expect(result).toEqual([]);
  });
});
