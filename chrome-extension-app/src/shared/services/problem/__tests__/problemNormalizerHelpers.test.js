/**
 * Tests for problemNormalizerHelpers.js
 * Pure functions — no mocks needed
 */

import {
  buildSessionMetadata,
  buildAttemptTracking,
  buildSpacedRepetitionData,
  buildLeetCodeAddressFields,
  buildAttemptsArray,
  buildInterviewModeFields,
  buildOptimalPathData
} from '../problemNormalizerHelpers.js';

describe('buildSessionMetadata', () => {
  it('should include selectionReason when present', () => {
    const result = buildSessionMetadata({ selectionReason: 'review' });
    expect(result).toEqual({ selectionReason: 'review' });
  });

  it('should include sessionIndex when present', () => {
    const result = buildSessionMetadata({ sessionIndex: 3 });
    expect(result).toEqual({ sessionIndex: 3 });
  });

  it('should return empty object when fields are absent', () => {
    const result = buildSessionMetadata({});
    expect(result).toEqual({});
  });

  it('should include sessionIndex when it is 0', () => {
    const result = buildSessionMetadata({ sessionIndex: 0 });
    expect(result).toEqual({ sessionIndex: 0 });
  });
});

describe('buildAttemptTracking', () => {
  it('should include both fields when present', () => {
    const result = buildAttemptTracking({ attempted: true, attempt_date: '2026-01-01' });
    expect(result).toEqual({ attempted: true, attempt_date: '2026-01-01' });
  });

  it('should return empty object when fields are absent', () => {
    const result = buildAttemptTracking({});
    expect(result).toEqual({});
  });

  it('should include attempted when false (explicit)', () => {
    const result = buildAttemptTracking({ attempted: false });
    expect(result).toEqual({ attempted: false });
  });
});

describe('buildSpacedRepetitionData', () => {
  it('should include all 8 optional fields when present', () => {
    const problem = {
      box_level: 3,
      review_schedule: '2026-02-01',
      perceived_difficulty: 0.7,
      consecutive_failures: 2,
      stability: 0.85,
      attempt_stats: { total_attempts: 5 },
      last_attempt_date: '2026-01-15',
      cooldown_status: true
    };
    const result = buildSpacedRepetitionData(problem);
    expect(result).toEqual(problem);
  });

  it('should return empty object when no fields present', () => {
    const result = buildSpacedRepetitionData({});
    expect(result).toEqual({});
  });

  it('should include box_level when it is 0', () => {
    const result = buildSpacedRepetitionData({ box_level: 0 });
    expect(result).toEqual({ box_level: 0 });
  });

  it('should include cooldown_status when false', () => {
    const result = buildSpacedRepetitionData({ cooldown_status: false });
    expect(result).toEqual({ cooldown_status: false });
  });
});

describe('buildLeetCodeAddressFields', () => {
  it('should include leetcode_address when present', () => {
    const result = buildLeetCodeAddressFields({ leetcode_address: 'https://leetcode.com/problems/two-sum' });
    expect(result).toEqual({ leetcode_address: 'https://leetcode.com/problems/two-sum' });
  });

  it('should return empty object when absent', () => {
    const result = buildLeetCodeAddressFields({});
    expect(result).toEqual({});
  });
});

describe('buildAttemptsArray', () => {
  it('should preserve existing attempts array', () => {
    const attempts = [{ count: 3 }, { count: 1 }];
    const result = buildAttemptsArray({ attempts });
    expect(result).toEqual({ attempts });
  });

  it('should build attempts from attempt_stats when total > 0', () => {
    const result = buildAttemptsArray({ attempt_stats: { total_attempts: 5 } });
    expect(result).toEqual({ attempts: [{ count: 5 }] });
  });

  it('should return empty attempts from attempt_stats when total is 0', () => {
    const result = buildAttemptsArray({ attempt_stats: { total_attempts: 0 } });
    expect(result).toEqual({ attempts: [] });
  });

  it('should return empty object when neither field present', () => {
    const result = buildAttemptsArray({});
    expect(result).toEqual({});
  });
});

describe('buildInterviewModeFields', () => {
  it('should include interview fields when present', () => {
    const result = buildInterviewModeFields({
      interviewMode: 'full',
      interviewConstraints: { timeLimit: 30 }
    });
    expect(result).toEqual({
      interviewMode: 'full',
      interviewConstraints: { timeLimit: 30 }
    });
  });

  it('should return empty object when absent', () => {
    const result = buildInterviewModeFields({});
    expect(result).toEqual({});
  });
});

describe('buildOptimalPathData', () => {
  it('should include path data when present', () => {
    const result = buildOptimalPathData({
      pathScore: 0.92,
      optimalPathData: { ladder: 'array', step: 3 }
    });
    expect(result).toEqual({
      pathScore: 0.92,
      optimalPathData: { ladder: 'array', step: 3 }
    });
  });

  it('should return empty object when absent', () => {
    const result = buildOptimalPathData({});
    expect(result).toEqual({});
  });

  it('should include pathScore when it is 0', () => {
    const result = buildOptimalPathData({ pathScore: 0 });
    expect(result).toEqual({ pathScore: 0 });
  });
});
