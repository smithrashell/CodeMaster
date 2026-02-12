/**
 * Tests for recalibrationService.js
 * Covers passive decay, welcome-back strategy, diagnostic session creation,
 * and adaptive session completion processing.
 */

// Mock logger first, before all other imports
jest.mock('../../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

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
  classifyTopics: jest.fn(),
  createDiagnosticSummary: jest.fn(),
  prepareProblemsForRecalibration: jest.fn(),
}));

import {
  getWelcomeBackStrategy,
  applyPassiveDecay,
  checkAndApplyDecay,
  createDiagnosticSession,
  processAdaptiveSessionCompletion,
} from '../recalibrationService.js';
import { StorageService } from '../../storage/storageService.js';
import { openDatabase } from '../../../db/core/connectionUtils.js';
import {
  processDecayForProblem,
  applyBatchUpdates,
} from '../recalibrationHelpers.js';

// Helper to build a fake IndexedDB-like object for tests
// Supports both readonly getAll and readwrite transactions with put + oncomplete
function buildFakeDb(problems = []) {
  const allProblemsRequest = {
    onsuccess: null,
    onerror: null,
    result: problems,
    error: null,
  };

  const getAll = jest.fn().mockImplementation(() => {
    // Resolve on next tick
    setTimeout(() => {
      if (allProblemsRequest.onsuccess) {
        allProblemsRequest.onsuccess();
      }
    }, 0);
    return allProblemsRequest;
  });

  const put = jest.fn();

  // A transaction object that fires oncomplete after a short delay
  function makeTransaction() {
    const tx = {
      objectStore: jest.fn().mockReturnValue({ getAll, put }),
      oncomplete: null,
      onerror: null,
    };
    // Fire oncomplete asynchronously after onsuccess runs
    setTimeout(() => {
      if (tx.oncomplete) {
        tx.oncomplete();
      }
    }, 20);
    return tx;
  }

  const transaction = jest.fn().mockImplementation(() => makeTransaction());

  return { transaction, getAll, put, allProblemsRequest };
}

describe('getWelcomeBackStrategy', () => {
  it('returns normal type for 0 days since last use', () => {
    const result = getWelcomeBackStrategy(0);
    expect(result).toEqual({ type: 'normal' });
  });

  it('returns normal type for 29 days since last use (< 30 threshold)', () => {
    const result = getWelcomeBackStrategy(29);
    expect(result).toEqual({ type: 'normal' });
  });

  it('returns gentle_recal for exactly 30 days', () => {
    const result = getWelcomeBackStrategy(30);
    expect(result.type).toBe('gentle_recal');
    expect(result.approach).toBe('adaptive_first_session');
    expect(result.daysSinceLastUse).toBe(30);
    expect(result.message).toBeDefined();
  });

  it('returns gentle_recal for 60 days (boundary before 90)', () => {
    const result = getWelcomeBackStrategy(60);
    expect(result.type).toBe('gentle_recal');
    expect(result.daysSinceLastUse).toBe(60);
  });

  it('returns gentle_recal for 89 days (just under 90 threshold)', () => {
    const result = getWelcomeBackStrategy(89);
    expect(result.type).toBe('gentle_recal');
  });

  it('returns moderate_recal for exactly 90 days', () => {
    const result = getWelcomeBackStrategy(90);
    expect(result.type).toBe('moderate_recal');
    expect(result.daysSinceLastUse).toBe(90);
    expect(Array.isArray(result.options)).toBe(true);
    expect(result.options.length).toBeGreaterThan(0);
  });

  it('moderate_recal includes diagnostic and adaptive_first_session options', () => {
    const result = getWelcomeBackStrategy(180);
    expect(result.type).toBe('moderate_recal');
    const values = result.options.map(o => o.value);
    expect(values).toContain('diagnostic');
    expect(values).toContain('adaptive_first_session');
  });

  it('moderate_recal diagnostic option is recommended', () => {
    const result = getWelcomeBackStrategy(180);
    const diagnostic = result.options.find(o => o.value === 'diagnostic');
    expect(diagnostic.recommended).toBe(true);
  });

  it('returns moderate_recal for 364 days (just under 365)', () => {
    const result = getWelcomeBackStrategy(364);
    expect(result.type).toBe('moderate_recal');
  });

  it('returns major_recal for exactly 365 days', () => {
    const result = getWelcomeBackStrategy(365);
    expect(result.type).toBe('major_recal');
    expect(result.daysSinceLastUse).toBe(365);
    expect(result.recommendation).toBe('diagnostic');
  });

  it('major_recal includes reset option with warning', () => {
    const result = getWelcomeBackStrategy(400);
    expect(result.type).toBe('major_recal');
    const reset = result.options.find(o => o.value === 'reset');
    expect(reset).toBeDefined();
    expect(reset.warning).toBeDefined();
  });

  it('major_recal diagnostic option is recommended', () => {
    const result = getWelcomeBackStrategy(500);
    const diagnostic = result.options.find(o => o.value === 'diagnostic');
    expect(diagnostic.recommended).toBe(true);
  });

  it('major_recal has 3 options: diagnostic, reset, adaptive_first_session', () => {
    const result = getWelcomeBackStrategy(1000);
    expect(result.type).toBe('major_recal');
    expect(result.options.length).toBe(3);
    const values = result.options.map(o => o.value);
    expect(values).toContain('diagnostic');
    expect(values).toContain('reset');
    expect(values).toContain('adaptive_first_session');
  });
});

describe('applyPassiveDecay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns no-op result for gap under 30 days', async () => {
    const result = await applyPassiveDecay(15);
    expect(result.applied).toBe(false);
    expect(result.problemsAffected).toBe(0);
    expect(result.message).toContain('15');
  });

  it('returns no-op result for gap of 0 days', async () => {
    const result = await applyPassiveDecay(0);
    expect(result.applied).toBe(false);
    expect(result.problemsAffected).toBe(0);
  });

  it('returns no-op result for gap of 29 days (just under threshold)', async () => {
    const result = await applyPassiveDecay(29);
    expect(result.applied).toBe(false);
    expect(result.problemsAffected).toBe(0);
  });

  it('returns already-applied result when decay was applied today', async () => {
    const today = new Date().toISOString().split('T')[0];
    StorageService.get.mockResolvedValue(today);

    const result = await applyPassiveDecay(60);
    expect(result.applied).toBe(false);
    expect(result.message).toContain('already applied today');
  });

  it('applies decay and returns affected count for 60-day gap', async () => {
    StorageService.get.mockResolvedValue('2020-01-01'); // Old date, not today
    StorageService.set.mockResolvedValue(undefined);

    const problems = [
      { id: 1, title: 'Two Sum', box_level: 3 },
      { id: 2, title: 'Add Two Numbers', box_level: 4 },
    ];

    const fakeDb = buildFakeDb(problems);
    openDatabase.mockResolvedValue(fakeDb);

    // processDecayForProblem returns updated problems
    processDecayForProblem
      .mockReturnValueOnce({ id: 1, box_level: 2 })
      .mockReturnValueOnce({ id: 2, box_level: 3 });

    applyBatchUpdates.mockResolvedValue(2);

    const result = await applyPassiveDecay(60);
    expect(result.applied).toBe(true);
    expect(result.problemsAffected).toBe(2);
    expect(result.message).toContain('60');
  });

  it('handles DB errors gracefully and returns applied=false', async () => {
    StorageService.get.mockResolvedValue('2020-01-01');
    StorageService.set.mockResolvedValue(undefined);
    openDatabase.mockRejectedValue(new Error('DB connection failed'));

    const result = await applyPassiveDecay(60);
    expect(result.applied).toBe(false);
    expect(result.message).toContain('Error');
  });

  it('excludes problems where processDecayForProblem returns null (no decay needed)', async () => {
    StorageService.get.mockResolvedValue('2020-01-01');
    StorageService.set.mockResolvedValue(undefined);

    const problems = [{ id: 1, box_level: 1 }];
    const fakeDb = buildFakeDb(problems);
    openDatabase.mockResolvedValue(fakeDb);

    processDecayForProblem.mockReturnValue(null); // No decay needed
    applyBatchUpdates.mockResolvedValue(0);

    const result = await applyPassiveDecay(60);
    expect(result.applied).toBe(true);
    expect(result.problemsAffected).toBe(0);
  });
});

describe('checkAndApplyDecay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns early when already checked today', async () => {
    const today = new Date().toISOString().split('T')[0];
    StorageService.get.mockResolvedValue(today);

    const result = await checkAndApplyDecay();
    expect(result.decayApplied).toBe(false);
    expect(result.message).toBe('Already checked today');
    expect(StorageService.getDaysSinceLastActivity).not.toHaveBeenCalled();
  });

  it('proceeds when last check date is different from today', async () => {
    StorageService.get.mockResolvedValue('2020-01-01'); // Old date
    StorageService.set.mockResolvedValue(undefined);
    StorageService.getDaysSinceLastActivity.mockResolvedValue(5); // < 30, no decay
    StorageService.updateLastActivityDate.mockResolvedValue(undefined);

    const result = await checkAndApplyDecay();
    expect(result.daysSinceLastUse).toBe(5);
  });

  it('applies decay when gap is >= 30 days', async () => {
    StorageService.get
      .mockResolvedValueOnce('2020-01-01') // last_decay_check_date
      .mockResolvedValueOnce('2020-01-01'); // last_decay_date (inside applyPassiveDecay)
    StorageService.set.mockResolvedValue(undefined);
    StorageService.getDaysSinceLastActivity.mockResolvedValue(45);
    StorageService.updateLastActivityDate.mockResolvedValue(undefined);

    const problems = [];
    const fakeDb = buildFakeDb(problems);
    openDatabase.mockResolvedValue(fakeDb);
    applyBatchUpdates.mockResolvedValue(0);

    const result = await checkAndApplyDecay();
    expect(result.daysSinceLastUse).toBe(45);
  });

  it('handles errors gracefully and returns safe defaults', async () => {
    StorageService.get.mockRejectedValue(new Error('Storage error'));

    const result = await checkAndApplyDecay();
    expect(result.decayApplied).toBe(false);
    expect(result.daysSinceLastUse).toBe(0);
    expect(result.problemsAffected).toBe(0);
    expect(result.message).toContain('Error');
  });

  it('returns correct shape with decayApplied, daysSinceLastUse, problemsAffected keys', async () => {
    const today = new Date().toISOString().split('T')[0];
    StorageService.get.mockResolvedValue(today);

    const result = await checkAndApplyDecay();
    expect(result).toHaveProperty('decayApplied');
    expect(result).toHaveProperty('daysSinceLastUse');
    expect(result).toHaveProperty('problemsAffected');
    expect(result).toHaveProperty('message');
  });
});

describe('createDiagnosticSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws when no mastered problems (box level < 3) exist', async () => {
    const problems = [
      { id: 1, box_level: 1 },
      { id: 2, box_level: 2 },
    ];
    const fakeDb = buildFakeDb(problems);
    openDatabase.mockResolvedValue(fakeDb);

    await expect(createDiagnosticSession({ problemCount: 5 })).rejects.toThrow(
      'No mastered problems available'
    );
  });

  it('returns selected problems and metadata when mastered problems exist', async () => {
    const problems = [
      { id: 1, box_level: 3, topicTags: ['Array'], difficulty: 'Easy' },
      { id: 2, box_level: 4, topicTags: ['Hash Table'], difficulty: 'Medium' },
      { id: 3, box_level: 5, topicTags: ['Dynamic Programming'], difficulty: 'Hard' },
      { id: 4, box_level: 3, topicTags: ['Tree'], difficulty: 'Medium' },
      { id: 5, box_level: 4, topicTags: ['Graph'], difficulty: 'Hard' },
    ];
    const fakeDb = buildFakeDb(problems);
    openDatabase.mockResolvedValue(fakeDb);

    const result = await createDiagnosticSession({ problemCount: 5, daysSinceLastUse: 90 });

    expect(result).toHaveProperty('problems');
    expect(result).toHaveProperty('metadata');
    expect(result.problems.length).toBeGreaterThan(0);
    expect(result.problems.length).toBeLessThanOrEqual(5);
  });

  it('metadata has correct shape with type=diagnostic', async () => {
    const problems = [
      { id: 1, box_level: 3, topicTags: ['Array'], difficulty: 'Easy' },
    ];
    const fakeDb = buildFakeDb(problems);
    openDatabase.mockResolvedValue(fakeDb);

    const result = await createDiagnosticSession({ problemCount: 1, daysSinceLastUse: 100 });

    expect(result.metadata.type).toBe('diagnostic');
    expect(result.metadata.daysSinceLastUse).toBe(100);
    expect(result.metadata.problemCount).toBeDefined();
    expect(result.metadata.createdAt).toBeDefined();
  });

  it('prioritizes problems marked with needs_recalibration', async () => {
    const problems = [
      { id: 1, box_level: 3, topicTags: ['Array'], difficulty: 'Easy', needs_recalibration: true },
      { id: 2, box_level: 3, topicTags: ['Array'], difficulty: 'Easy', needs_recalibration: false },
    ];
    const fakeDb = buildFakeDb(problems);
    openDatabase.mockResolvedValue(fakeDb);

    const result = await createDiagnosticSession({ problemCount: 1 });

    // needs_recalibration problem should be selected first
    expect(result.problems[0].id).toBe(1);
  });

  it('uses default problemCount of 5 when not specified', async () => {
    const problems = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      box_level: 3 + (i % 3),
      topicTags: [`Topic${i}`],
      difficulty: 'Easy',
    }));
    const fakeDb = buildFakeDb(problems);
    openDatabase.mockResolvedValue(fakeDb);

    const result = await createDiagnosticSession();
    expect(result.problems.length).toBeLessThanOrEqual(5);
  });

  it('includes sampledFromMastered count in metadata', async () => {
    const problems = [
      { id: 1, box_level: 3, topicTags: ['Array'], difficulty: 'Easy' },
      { id: 2, box_level: 4, topicTags: ['Hash Table'], difficulty: 'Medium' },
    ];
    const fakeDb = buildFakeDb(problems);
    openDatabase.mockResolvedValue(fakeDb);

    const result = await createDiagnosticSession({ problemCount: 2 });
    expect(result.metadata.sampledFromMastered).toBe(2);
  });

  it('handles DB errors by throwing', async () => {
    openDatabase.mockRejectedValue(new Error('DB unavailable'));

    await expect(createDiagnosticSession()).rejects.toThrow('DB unavailable');
  });
});

describe('processAdaptiveSessionCompletion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns action=none when no adaptive flag exists', async () => {
    StorageService.get.mockResolvedValue(null);

    const result = await processAdaptiveSessionCompletion({
      sessionId: 'sess-1',
      accuracy: 0.8,
      totalProblems: 5,
    });

    expect(result.status).toBe('success');
    expect(result.action).toBe('none');
  });

  it('returns keep_decay when accuracy >= 0.7', async () => {
    StorageService.get.mockResolvedValue({
      daysSinceLastUse: 60,
      decayMagnitude: 'moderate',
    });
    StorageService.set.mockResolvedValue(undefined);

    // Mock openDatabase for reduceDecayMagnitude (not called for keep_decay)
    openDatabase.mockResolvedValue(buildFakeDb([]));

    const result = await processAdaptiveSessionCompletion({
      sessionId: 'sess-1',
      accuracy: 0.75,
      totalProblems: 5,
    });

    expect(result.status).toBe('success');
    expect(result.action).toBe('keep_decay');
    expect(result.summary.accuracy).toBe(75);
  });

  it('returns keep_decay for accuracy exactly 0.7', async () => {
    StorageService.get.mockResolvedValue({
      daysSinceLastUse: 60,
      decayMagnitude: 'moderate',
    });
    StorageService.set.mockResolvedValue(undefined);

    const result = await processAdaptiveSessionCompletion({
      sessionId: 'sess-2',
      accuracy: 0.7,
      totalProblems: 5,
    });

    expect(result.action).toBe('keep_decay');
  });

  it('returns reduce_decay when 0.4 <= accuracy < 0.7', async () => {
    StorageService.get.mockResolvedValue({
      daysSinceLastUse: 60,
      decayMagnitude: 'moderate',
    });
    StorageService.set.mockResolvedValue(undefined);

    // Build DB for reduceDecayMagnitude
    const problems = [
      { id: 1, box_level: 2, original_box_level: 4, decay_applied_date: '2023-01-01' },
    ];
    const fakeDb = buildFakeDb(problems);
    openDatabase.mockResolvedValue(fakeDb);

    const result = await processAdaptiveSessionCompletion({
      sessionId: 'sess-3',
      accuracy: 0.5,
      totalProblems: 5,
    });

    expect(result.action).toBe('reduce_decay');
    expect(result.summary.accuracy).toBe(50);
  });

  it('returns revert_decay_partially when accuracy < 0.4', async () => {
    StorageService.get.mockResolvedValue({
      daysSinceLastUse: 60,
      decayMagnitude: 'moderate',
    });
    StorageService.set.mockResolvedValue(undefined);

    const problems = [
      { id: 1, box_level: 2, original_box_level: 4, decay_applied_date: '2023-01-01' },
    ];
    const fakeDb = buildFakeDb(problems);
    openDatabase.mockResolvedValue(fakeDb);

    const result = await processAdaptiveSessionCompletion({
      sessionId: 'sess-4',
      accuracy: 0.2,
      totalProblems: 5,
    });

    expect(result.action).toBe('revert_decay_partially');
  });

  it('summary includes accuracy, totalProblems, daysSinceLastUse and message', async () => {
    StorageService.get.mockResolvedValue({
      daysSinceLastUse: 30,
      decayMagnitude: 'gentle',
    });
    StorageService.set.mockResolvedValue(undefined);

    const result = await processAdaptiveSessionCompletion({
      sessionId: 'sess-5',
      accuracy: 0.9,
      totalProblems: 7,
    });

    expect(result.summary).toHaveProperty('accuracy');
    expect(result.summary).toHaveProperty('totalProblems');
    expect(result.summary).toHaveProperty('daysSinceLastUse');
    expect(result.summary).toHaveProperty('message');
    expect(result.summary.totalProblems).toBe(7);
  });

  it('handles errors gracefully and returns status=error', async () => {
    StorageService.get.mockRejectedValue(new Error('Storage exploded'));

    const result = await processAdaptiveSessionCompletion({
      sessionId: 'sess-6',
      accuracy: 0.8,
      totalProblems: 5,
    });

    expect(result.status).toBe('error');
    expect(result.action).toBe('none');
  });

  it('clears the adaptive flag after processing', async () => {
    StorageService.get.mockResolvedValue({
      daysSinceLastUse: 60,
      decayMagnitude: 'moderate',
    });
    StorageService.set.mockResolvedValue(undefined);

    await processAdaptiveSessionCompletion({
      sessionId: 'sess-7',
      accuracy: 0.8,
      totalProblems: 5,
    });

    // StorageService.set should be called with null to clear the flag
    const setCalls = StorageService.set.mock.calls;
    const clearCall = setCalls.find(
      ([key, value]) => key === 'pending_adaptive_recalibration' && value === null
    );
    expect(clearCall).toBeDefined();
  });
});
