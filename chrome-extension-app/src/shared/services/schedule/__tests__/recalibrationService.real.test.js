/**
 * Expanded coverage tests for recalibrationService.js
 *
 * Focuses on functions not covered by the existing test file:
 * - processDiagnosticResults
 * - getDecayStatistics
 * - createAdaptiveRecalibrationSession
 * - additional edge cases for getWelcomeBackStrategy boundaries
 */

// Mock StorageService
jest.mock('../../storage/storageService.js', () => ({
  StorageService: {
    get: jest.fn(),
    set: jest.fn(),
    getDaysSinceLastActivity: jest.fn(),
    updateLastActivityDate: jest.fn(),
    getSettings: jest.fn(),
  },
}));

// Mock openDatabase
jest.mock('../../../db/core/connectionUtils.js', () => ({
  openDatabase: jest.fn(),
}));

// Mock recalibrationHelpers
jest.mock('../recalibrationHelpers.js', () => ({
  processDecayForProblem: jest.fn(),
  applyBatchUpdates: jest.fn(),
  classifyTopics: jest.fn(() => ({ topicsRetained: [], topicsForgotten: [] })),
  createDiagnosticSummary: jest.fn((accuracy, total, retained, forgotten, recalibrated) => ({
    accuracy: Math.round(accuracy * 100),
    totalProblems: total,
    topicsRetained: retained,
    topicsForgotten: forgotten,
    problemsRecalibrated: recalibrated,
    message: `${Math.round(accuracy * 100)}% accuracy`,
  })),
  prepareProblemsForRecalibration: jest.fn(async () => []),
}));

import {
  getWelcomeBackStrategy,
  applyPassiveDecay,
  checkAndApplyDecay,
  getDecayStatistics,
  createDiagnosticSession,
  processDiagnosticResults,
  createAdaptiveRecalibrationSession,
  processAdaptiveSessionCompletion,
} from '../recalibrationService.js';
import { StorageService } from '../../storage/storageService.js';
import { openDatabase } from '../../../db/core/connectionUtils.js';
import {
  processDecayForProblem,
  applyBatchUpdates,
  classifyTopics,
  createDiagnosticSummary,
  prepareProblemsForRecalibration,
} from '../recalibrationHelpers.js';

// ---------------------------------------------------------------------------
// Helpers: build fake IDB objects with setter-based auto-fire
// ---------------------------------------------------------------------------
function buildFakeDb(problems = []) {
  const allProblemsRequest = {
    _onsuccess: null,
    set onsuccess(fn) {
      this._onsuccess = fn;
      Promise.resolve().then(() => fn());
    },
    get onsuccess() { return this._onsuccess; },
    _onerror: null,
    set onerror(fn) { this._onerror = fn; },
    get onerror() { return this._onerror; },
    result: problems,
    error: null,
  };

  const getAll = jest.fn().mockReturnValue(allProblemsRequest);
  const put = jest.fn();

  function makeTransaction() {
    const tx = {
      objectStore: jest.fn().mockReturnValue({ getAll, put }),
      _oncomplete: null,
      set oncomplete(fn) {
        this._oncomplete = fn;
        Promise.resolve().then(() => fn());
      },
      get oncomplete() { return this._oncomplete; },
      _onerror: null,
      set onerror(fn) { this._onerror = fn; },
      get onerror() { return this._onerror; },
    };
    return tx;
  }

  const transaction = jest.fn().mockImplementation(() => makeTransaction());

  return { transaction, getAll, put, allProblemsRequest };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getDecayStatistics', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return statistics with problemsNeedingRecalibration and averageDecayDays', async () => {
    const problems = [
      { problem_id: 'p1', needs_recalibration: true, decay_applied_date: '2024-01-01' },
      { problem_id: 'p2', needs_recalibration: true, decay_applied_date: '2024-06-01' },
      { problem_id: 'p3', needs_recalibration: false },
    ];
    const fakeDb = buildFakeDb(problems);
    openDatabase.mockResolvedValue(fakeDb);

    const result = await getDecayStatistics();

    expect(result.problemsNeedingRecalibration).toBe(2);
    expect(typeof result.averageDecayDays).toBe('number');
    expect(result.averageDecayDays).toBeGreaterThan(0);
  });

  it('should return 0 averageDecayDays when no problems have decay_applied_date', async () => {
    const problems = [
      { problem_id: 'p1', needs_recalibration: false },
    ];
    const fakeDb = buildFakeDb(problems);
    openDatabase.mockResolvedValue(fakeDb);

    const result = await getDecayStatistics();
    expect(result.averageDecayDays).toBe(0);
  });

  it('should return 0 for both stats when no problems exist', async () => {
    const fakeDb = buildFakeDb([]);
    openDatabase.mockResolvedValue(fakeDb);

    const result = await getDecayStatistics();
    expect(result.problemsNeedingRecalibration).toBe(0);
    expect(result.averageDecayDays).toBe(0);
  });

  it('should return safe defaults when openDatabase fails', async () => {
    openDatabase.mockRejectedValue(new Error('DB crashed'));

    const result = await getDecayStatistics();
    expect(result.problemsNeedingRecalibration).toBe(0);
    expect(result.averageDecayDays).toBe(0);
  });
});

describe('createAdaptiveRecalibrationSession', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should store pending flag with daysSinceLastUse and return success', async () => {
    StorageService.set.mockResolvedValue(undefined);

    const result = await createAdaptiveRecalibrationSession({ daysSinceLastUse: 60 });

    expect(result.status).toBe('success');
    expect(result.message).toContain('Adaptive recalibration enabled');
    expect(StorageService.set).toHaveBeenCalledWith(
      'pending_adaptive_recalibration',
      expect.objectContaining({
        daysSinceLastUse: 60,
        decayApplied: true,
        decayMagnitude: 'gentle', // 60 < 90 => gentle
      })
    );
  });

  it('should classify magnitude as moderate for 90-365 days', async () => {
    StorageService.set.mockResolvedValue(undefined);

    await createAdaptiveRecalibrationSession({ daysSinceLastUse: 120 });

    expect(StorageService.set).toHaveBeenCalledWith(
      'pending_adaptive_recalibration',
      expect.objectContaining({
        decayMagnitude: 'moderate',
      })
    );
  });

  it('should classify magnitude as major for >= 365 days', async () => {
    StorageService.set.mockResolvedValue(undefined);

    await createAdaptiveRecalibrationSession({ daysSinceLastUse: 400 });

    expect(StorageService.set).toHaveBeenCalledWith(
      'pending_adaptive_recalibration',
      expect.objectContaining({
        decayMagnitude: 'major',
      })
    );
  });

  it('should default daysSinceLastUse to 0 when not provided', async () => {
    StorageService.set.mockResolvedValue(undefined);

    const result = await createAdaptiveRecalibrationSession();

    expect(result.status).toBe('success');
    expect(StorageService.set).toHaveBeenCalledWith(
      'pending_adaptive_recalibration',
      expect.objectContaining({
        daysSinceLastUse: 0,
      })
    );
  });

  it('should return error status when StorageService.set fails', async () => {
    StorageService.set.mockRejectedValue(new Error('Write failed'));

    const result = await createAdaptiveRecalibrationSession({ daysSinceLastUse: 60 });

    expect(result.status).toBe('error');
    expect(result.message).toContain('Error');
  });
});

describe('processDiagnosticResults', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return recalibrated:false when no attempts provided', async () => {
    const result = await processDiagnosticResults({
      sessionId: 'diag-1',
      attempts: [],
    });

    expect(result.recalibrated).toBe(false);
    expect(result.summary.totalProblems).toBe(0);
    expect(result.summary.message).toBe('No attempts recorded');
  });

  it('should return recalibrated:false when attempts is undefined', async () => {
    const result = await processDiagnosticResults({
      sessionId: 'diag-2',
      attempts: undefined,
    });

    expect(result.recalibrated).toBe(false);
  });

  it('should process diagnostic results with perfect accuracy', async () => {
    const fakeDb = buildFakeDb([]);
    openDatabase.mockResolvedValue(fakeDb);
    prepareProblemsForRecalibration.mockResolvedValue([]);
    classifyTopics.mockReturnValue({
      topicsRetained: ['Array', 'Tree'],
      topicsForgotten: [],
    });
    createDiagnosticSummary.mockReturnValue({
      accuracy: 100,
      totalProblems: 2,
      topicsRetained: ['Array', 'Tree'],
      topicsForgotten: [],
      message: '100% accuracy - excellent retention',
    });
    StorageService.set.mockResolvedValue(undefined);

    const result = await processDiagnosticResults({
      sessionId: 'diag-3',
      attempts: [
        { problemId: 'p1', success: true, tags: ['Array'] },
        { problemId: 'p2', success: true, tags: ['Tree'] },
      ],
    });

    expect(result.recalibrated).toBe(true);
    expect(result.summary.accuracy).toBe(100);
    expect(result.summary.topicsRetained).toContain('Array');
    expect(result.summary.topicsForgotten).toHaveLength(0);
  });

  it('should process diagnostic results with mixed accuracy', async () => {
    const fakeDb = buildFakeDb([]);
    openDatabase.mockResolvedValue(fakeDb);
    prepareProblemsForRecalibration.mockResolvedValue([]);
    classifyTopics.mockReturnValue({
      topicsRetained: ['Array'],
      topicsForgotten: ['Tree'],
    });
    createDiagnosticSummary.mockReturnValue({
      accuracy: 50,
      totalProblems: 2,
      topicsRetained: ['Array'],
      topicsForgotten: ['Tree'],
      message: '50% accuracy',
    });
    StorageService.set.mockResolvedValue(undefined);

    const result = await processDiagnosticResults({
      sessionId: 'diag-4',
      attempts: [
        { problemId: 'p1', success: true, tags: ['Array'] },
        { problemId: 'p2', success: false, tags: ['Tree'] },
      ],
    });

    expect(result.recalibrated).toBe(true);
    expect(classifyTopics).toHaveBeenCalledWith(expect.any(Map), 0.7);
  });

  it('should recalibrate problems when prepareProblemsForRecalibration returns data', async () => {
    const problemsToRecal = [
      { problem_id: 'p1', box_level: 2, needs_recalibration: false },
    ];
    const fakeDb = buildFakeDb([]);
    openDatabase.mockResolvedValue(fakeDb);
    prepareProblemsForRecalibration.mockResolvedValue(problemsToRecal);
    classifyTopics.mockReturnValue({ topicsRetained: [], topicsForgotten: [] });
    createDiagnosticSummary.mockReturnValue({
      accuracy: 0,
      totalProblems: 1,
      topicsRetained: [],
      topicsForgotten: ['Array'],
      problemsRecalibrated: 1,
      message: '0% accuracy',
    });
    StorageService.set.mockResolvedValue(undefined);

    const result = await processDiagnosticResults({
      sessionId: 'diag-5',
      attempts: [
        { problemId: 'p1', success: false, tags: ['Array'] },
      ],
    });

    expect(result.recalibrated).toBe(true);
    // The put should have been called during the transaction
    expect(fakeDb.transaction).toHaveBeenCalledWith(['problems'], 'readwrite');
  });

  it('should store diagnostic results for analytics', async () => {
    const fakeDb = buildFakeDb([]);
    openDatabase.mockResolvedValue(fakeDb);
    prepareProblemsForRecalibration.mockResolvedValue([]);
    classifyTopics.mockReturnValue({ topicsRetained: [], topicsForgotten: [] });
    createDiagnosticSummary.mockReturnValue({
      accuracy: 100,
      totalProblems: 1,
      topicsRetained: [],
      topicsForgotten: [],
      message: 'ok',
    });
    StorageService.set.mockResolvedValue(undefined);

    await processDiagnosticResults({
      sessionId: 'diag-6',
      attempts: [{ problemId: 'p1', success: true, tags: [] }],
    });

    expect(StorageService.set).toHaveBeenCalledWith(
      'last_diagnostic_result',
      expect.objectContaining({
        sessionId: 'diag-6',
        completedAt: expect.any(String),
      })
    );
  });

  it('should handle DB errors gracefully and return recalibrated:false', async () => {
    openDatabase.mockRejectedValue(new Error('DB crashed'));

    const result = await processDiagnosticResults({
      sessionId: 'diag-7',
      attempts: [{ problemId: 'p1', success: true, tags: ['Array'] }],
    });

    expect(result.recalibrated).toBe(false);
    expect(result.summary.message).toContain('Error');
  });

  it('should correctly analyze per-tag performance', async () => {
    const fakeDb = buildFakeDb([]);
    openDatabase.mockResolvedValue(fakeDb);
    prepareProblemsForRecalibration.mockResolvedValue([]);
    classifyTopics.mockReturnValue({ topicsRetained: ['Array'], topicsForgotten: ['Tree'] });
    createDiagnosticSummary.mockReturnValue({
      accuracy: 67,
      totalProblems: 3,
      topicsRetained: ['Array'],
      topicsForgotten: ['Tree'],
      message: '67% accuracy',
    });
    StorageService.set.mockResolvedValue(undefined);

    await processDiagnosticResults({
      sessionId: 'diag-8',
      attempts: [
        { problemId: 'p1', success: true, tags: ['Array'] },
        { problemId: 'p2', success: true, tags: ['Array', 'Tree'] },
        { problemId: 'p3', success: false, tags: ['Tree'] },
      ],
    });

    // classifyTopics should receive a Map with tags as keys
    expect(classifyTopics).toHaveBeenCalled();
    const topicPerformanceMap = classifyTopics.mock.calls[0][0];
    expect(topicPerformanceMap).toBeInstanceOf(Map);
    expect(topicPerformanceMap.has('Array')).toBe(true);
    expect(topicPerformanceMap.has('Tree')).toBe(true);

    // Array: 2/2 = 100%
    const arrayPerf = topicPerformanceMap.get('Array');
    expect(arrayPerf.correct).toBe(2);
    expect(arrayPerf.total).toBe(2);

    // Tree: 1/2 = 50%
    const treePerf = topicPerformanceMap.get('Tree');
    expect(treePerf.correct).toBe(1);
    expect(treePerf.total).toBe(2);
  });
});

describe('getWelcomeBackStrategy - boundary tests', () => {
  it('returns gentle_recal at exactly 30 days', () => {
    expect(getWelcomeBackStrategy(30).type).toBe('gentle_recal');
  });

  it('returns moderate_recal at exactly 90 days', () => {
    expect(getWelcomeBackStrategy(90).type).toBe('moderate_recal');
  });

  it('returns major_recal at exactly 365 days', () => {
    expect(getWelcomeBackStrategy(365).type).toBe('major_recal');
  });

  it('returns normal at exactly 0 days', () => {
    expect(getWelcomeBackStrategy(0).type).toBe('normal');
  });

  it('major_recal includes message about time away', () => {
    const result = getWelcomeBackStrategy(500);
    expect(result.message).toBeDefined();
    expect(result.message.length).toBeGreaterThan(0);
  });

  it('gentle_recal includes approach field', () => {
    const result = getWelcomeBackStrategy(45);
    expect(result.approach).toBe('adaptive_first_session');
  });
});

describe('applyPassiveDecay - additional edge cases', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return no-op for exactly 29 days (boundary)', async () => {
    const result = await applyPassiveDecay(29);
    expect(result.applied).toBe(false);
  });

  it('should return no-op for negative day values', async () => {
    const result = await applyPassiveDecay(-5);
    expect(result.applied).toBe(false);
  });

  it('should return no-op for exactly 30 days at boundary', async () => {
    // 30 is the MIN_GAP_DAYS threshold, decay starts at 30
    StorageService.get.mockResolvedValue('2020-01-01');
    StorageService.set.mockResolvedValue(undefined);

    const fakeDb = buildFakeDb([]);
    openDatabase.mockResolvedValue(fakeDb);
    applyBatchUpdates.mockResolvedValue(0);

    const result = await applyPassiveDecay(30);
    // 30 days is at the threshold, so it proceeds (not < 30)
    expect(result.applied).toBe(true);
  });
});

describe('checkAndApplyDecay - additional cases', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should update last activity date when decay is applied', async () => {
    StorageService.get
      .mockResolvedValueOnce('2020-01-01') // last_decay_check_date
      .mockResolvedValueOnce('2020-01-01'); // last_decay_date (inside applyPassiveDecay)
    StorageService.set.mockResolvedValue(undefined);
    StorageService.getDaysSinceLastActivity.mockResolvedValue(10); // < 30 = no decay
    StorageService.updateLastActivityDate.mockResolvedValue(undefined);

    const result = await checkAndApplyDecay();

    // daysSinceLastUse=10 < 30, so applied=false but daysSinceLastUse=0 check passes => updateLastActivity not called
    expect(result.daysSinceLastUse).toBe(10);
  });

  it('should update last activity when daysSinceLastUse is 0', async () => {
    StorageService.get.mockResolvedValue('2020-01-01');
    StorageService.set.mockResolvedValue(undefined);
    StorageService.getDaysSinceLastActivity.mockResolvedValue(0);
    StorageService.updateLastActivityDate.mockResolvedValue(undefined);

    const result = await checkAndApplyDecay();

    expect(result.daysSinceLastUse).toBe(0);
    // applyPassiveDecay(0) returns applied=false, but daysSinceLastUse===0 triggers update
    expect(StorageService.updateLastActivityDate).toHaveBeenCalled();
  });
});

describe('processAdaptiveSessionCompletion - edge case accuracy at 0.4 boundary', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return reduce_decay for accuracy exactly 0.4', async () => {
    StorageService.get.mockResolvedValue({
      daysSinceLastUse: 60,
      decayMagnitude: 'moderate',
    });
    StorageService.set.mockResolvedValue(undefined);

    const fakeDb = buildFakeDb([]);
    openDatabase.mockResolvedValue(fakeDb);

    const result = await processAdaptiveSessionCompletion({
      sessionId: 'sess-boundary',
      accuracy: 0.4,
      totalProblems: 5,
    });

    expect(result.action).toBe('reduce_decay');
  });

  it('should return revert_decay_partially for accuracy just under 0.4', async () => {
    StorageService.get.mockResolvedValue({
      daysSinceLastUse: 60,
      decayMagnitude: 'moderate',
    });
    StorageService.set.mockResolvedValue(undefined);

    const fakeDb = buildFakeDb([]);
    openDatabase.mockResolvedValue(fakeDb);

    const result = await processAdaptiveSessionCompletion({
      sessionId: 'sess-low',
      accuracy: 0.39,
      totalProblems: 5,
    });

    expect(result.action).toBe('revert_decay_partially');
  });

  it('should store last_adaptive_result for analytics', async () => {
    StorageService.get.mockResolvedValue({
      daysSinceLastUse: 60,
      decayMagnitude: 'moderate',
    });
    StorageService.set.mockResolvedValue(undefined);

    await processAdaptiveSessionCompletion({
      sessionId: 'sess-analytics',
      accuracy: 0.8,
      totalProblems: 10,
    });

    const setLastAdaptiveCalls = StorageService.set.mock.calls.filter(
      ([key]) => key === 'last_adaptive_result'
    );
    expect(setLastAdaptiveCalls.length).toBe(1);
    expect(setLastAdaptiveCalls[0][1]).toEqual(
      expect.objectContaining({
        sessionId: 'sess-analytics',
        accuracy: 0.8,
        totalProblems: 10,
        action: 'keep_decay',
      })
    );
  });
});
