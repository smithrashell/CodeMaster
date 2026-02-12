/**
 * Enhanced tests for problems.js
 *
 * Focus:
 * - updateStabilityFSRS: pure function, no DB needed
 * - checkDatabaseForProblem: input validation (throws before reaching DB)
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

// Mock DB layer so imports don't fail; individual tests override as needed
jest.mock('../../index.js', () => ({
  dbHelper: { openDB: jest.fn() },
}));

// Mock heavy transitive deps that problems.js imports
jest.mock('../standard_problems.js', () => ({
  getAllStandardProblems: jest.fn().mockResolvedValue([]),
  fetchProblemById: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../../services/attempts/attemptsService.js', () => ({
  AttemptsService: { addAttempt: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../../../services/session/sessionService.js', () => ({
  SessionService: {
    resumeSession: jest.fn().mockResolvedValue(null),
    getOrCreateSession: jest.fn().mockResolvedValue({ id: 'mock-session' }),
  },
}));

jest.mock('../problemSelectionHelpers.js', () => ({
  normalizeTags: jest.fn((t) => t),
  getDifficultyScore: jest.fn(() => 1),
  getSingleLadder: jest.fn(),
  filterProblemsByDifficultyCap: jest.fn((p) => p),
  loadProblemSelectionContext: jest.fn().mockResolvedValue({}),
  logProblemSelectionStart: jest.fn(),
  calculateTagDifficultyAllowances: jest.fn(() => ({})),
  logSelectedProblems: jest.fn(),
  selectProblemsForTag: jest.fn().mockResolvedValue([]),
  addExpansionProblems: jest.fn(),
  selectPrimaryAndExpansionProblems: jest.fn().mockResolvedValue({ selectedProblems: [], usedProblemIds: new Set() }),
  expandWithRemainingFocusTags: jest.fn().mockResolvedValue(undefined),
  fillRemainingWithRandomProblems: jest.fn(),
}));

jest.mock('../problemsRetryHelpers.js', () => ({
  getProblemWithRetry: jest.fn(),
  checkDatabaseForProblemWithRetry: jest.fn(),
  addProblemWithRetry: jest.fn(),
  saveUpdatedProblemWithRetry: jest.fn(),
  countProblemsByBoxLevelWithRetry: jest.fn(),
  fetchAllProblemsWithRetry: jest.fn(),
  getProblemWithOfficialDifficultyWithRetry: jest.fn(),
}));

import { updateStabilityFSRS, checkDatabaseForProblem } from '../problems.js';
import { dbHelper } from '../../index.js';

// ---------------------------------------------------------------------------
// Helper: create a mock request that auto-fires onsuccess
// ---------------------------------------------------------------------------
function createMockRequest(result) {
  const req = { result, onsuccess: null, onerror: null };
  Promise.resolve().then(() => {
    if (req.onsuccess) req.onsuccess({ target: req });
  });
  return req;
}

function createMockDBWithIndex(indexResult) {
  const mockIndex = {
    get: jest.fn(() => createMockRequest(indexResult)),
  };
  const mockStore = {
    index: jest.fn(() => mockIndex),
    indexNames: { contains: jest.fn(() => true) },
  };
  const mockTx = {
    objectStore: jest.fn(() => mockStore),
  };
  const mockDB = {
    transaction: jest.fn(() => mockTx),
  };
  return { mockDB, mockStore, mockIndex };
}

// ---------------------------------------------------------------------------
// updateStabilityFSRS — pure function
// ---------------------------------------------------------------------------

describe('updateStabilityFSRS', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('correct answer (wasCorrect = true)', () => {
    it('applies stability * 1.2 + 0.5 when correct and no lastAttemptDate', () => {
      const result = updateStabilityFSRS(1.0, true);
      expect(result).toBe(parseFloat((1.0 * 1.2 + 0.5).toFixed(2)));
    });

    it('applies correct formula for stability 2.0', () => {
      const result = updateStabilityFSRS(2.0, true);
      expect(result).toBe(parseFloat((2.0 * 1.2 + 0.5).toFixed(2)));
    });

    it('applies correct formula for stability 0.5', () => {
      const result = updateStabilityFSRS(0.5, true);
      expect(result).toBe(parseFloat((0.5 * 1.2 + 0.5).toFixed(2)));
    });
  });

  describe('wrong answer (wasCorrect = false)', () => {
    it('applies stability * 0.7 when wrong and no lastAttemptDate', () => {
      const result = updateStabilityFSRS(1.0, false);
      expect(result).toBe(parseFloat((1.0 * 0.7).toFixed(2)));
    });

    it('applies correct formula for stability 3.0', () => {
      const result = updateStabilityFSRS(3.0, false);
      expect(result).toBe(parseFloat((3.0 * 0.7).toFixed(2)));
    });
  });

  describe('rounding to 2 decimal places', () => {
    it('rounds result to 2 decimal places for correct answer', () => {
      const result = updateStabilityFSRS(1.0, true);
      const str = result.toString();
      const decimalPart = str.includes('.') ? str.split('.')[1] : '';
      expect(decimalPart.length).toBeLessThanOrEqual(2);
    });

    it('rounds result to 2 decimal places for wrong answer', () => {
      const result = updateStabilityFSRS(1.0, false);
      const str = result.toString();
      const decimalPart = str.includes('.') ? str.split('.')[1] : '';
      expect(decimalPart.length).toBeLessThanOrEqual(2);
    });
  });

  describe('with lastAttemptDate within 30 days', () => {
    it('does NOT apply forgetting factor when lastAttemptDate is today', () => {
      const today = new Date().toISOString();
      const result = updateStabilityFSRS(1.0, true, today);
      // <= 30 days: no forgetting factor applied
      expect(result).toBe(parseFloat((1.0 * 1.2 + 0.5).toFixed(2)));
    });

    it('does NOT apply forgetting factor when lastAttemptDate is 30 days ago', () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const result = updateStabilityFSRS(1.0, true, thirtyDaysAgo);
      expect(result).toBe(parseFloat((1.0 * 1.2 + 0.5).toFixed(2)));
    });
  });

  describe('with lastAttemptDate > 30 days ago', () => {
    it('applies forgetting factor exp(-days/90) when > 30 days', () => {
      const daysAgo = 60;
      const pastDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
      const rawStability = 1.0 * 1.2 + 0.5; // correct = true
      const forgettingFactor = Math.exp(-daysAgo / 90);
      const expected = parseFloat((rawStability * forgettingFactor).toFixed(2));

      const result = updateStabilityFSRS(1.0, true, pastDate);
      expect(result).toBe(expected);
    });

    it('applies forgetting factor for wrong answer at 90 days ago', () => {
      const daysAgo = 90;
      const pastDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
      const rawStability = 1.0 * 0.7; // wrong answer
      const forgettingFactor = Math.exp(-daysAgo / 90); // exp(-1) ≈ 0.368
      const expected = parseFloat((rawStability * forgettingFactor).toFixed(2));

      const result = updateStabilityFSRS(1.0, false, pastDate);
      expect(result).toBe(expected);
    });

    it('reduces stability more for 180 days than 60 days', () => {
      const date60 = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      const date180 = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();

      const result60 = updateStabilityFSRS(2.0, true, date60);
      const result180 = updateStabilityFSRS(2.0, true, date180);

      expect(result180).toBeLessThan(result60);
    });
  });

  describe('invalid lastAttemptDate', () => {
    it('returns without extra decay for invalid date string', () => {
      const result = updateStabilityFSRS(1.0, true, 'not-a-date');
      // Invalid date causes NaN in date arithmetic, so daysSinceLastAttempt is NaN
      // NaN > 30 is false, so no forgetting factor is applied
      expect(result).toBe(parseFloat((1.0 * 1.2 + 0.5).toFixed(2)));
    });

    it('handles null lastAttemptDate (defaults to null)', () => {
      const result = updateStabilityFSRS(1.0, true, null);
      expect(result).toBe(parseFloat((1.0 * 1.2 + 0.5).toFixed(2)));
    });
  });
});

// ---------------------------------------------------------------------------
// checkDatabaseForProblem — input validation
// ---------------------------------------------------------------------------

describe('checkDatabaseForProblem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('invalid inputs — throws before reaching DB', () => {
    it('throws for null leetcodeId', async () => {
      await expect(checkDatabaseForProblem(null)).rejects.toThrow(
        'Invalid leetcodeId'
      );
    });

    it('throws for undefined leetcodeId', async () => {
      await expect(checkDatabaseForProblem(undefined)).rejects.toThrow(
        'Invalid leetcodeId'
      );
    });

    it('throws for NaN leetcodeId', async () => {
      await expect(checkDatabaseForProblem(NaN)).rejects.toThrow(
        'Invalid leetcodeId'
      );
    });

    it('throws for non-numeric string leetcodeId', async () => {
      await expect(checkDatabaseForProblem('abc')).rejects.toThrow(
        'Invalid leetcodeId'
      );
    });

    it('does NOT call openDB for null input', async () => {
      await expect(checkDatabaseForProblem(null)).rejects.toThrow();
      expect(dbHelper.openDB).not.toHaveBeenCalled();
    });
  });

  describe('valid inputs — reaches DB', () => {
    it('calls openDB for a valid numeric string leetcodeId', async () => {
      const { mockDB, mockIndex } = createMockDBWithIndex({ leetcode_id: 1 });
      dbHelper.openDB.mockResolvedValue(mockDB);

      await checkDatabaseForProblem('1');

      expect(dbHelper.openDB).toHaveBeenCalledTimes(1);
      expect(mockIndex.get).toHaveBeenCalledWith(1); // converted to Number
    });

    it('calls openDB for a numeric leetcodeId', async () => {
      const { mockDB } = createMockDBWithIndex(null);
      dbHelper.openDB.mockResolvedValue(mockDB);

      await checkDatabaseForProblem(42);

      expect(dbHelper.openDB).toHaveBeenCalledTimes(1);
    });

    it('returns the problem object when found', async () => {
      const problem = { leetcode_id: 1, title: 'two sum' };
      const { mockDB } = createMockDBWithIndex(problem);
      dbHelper.openDB.mockResolvedValue(mockDB);

      const result = await checkDatabaseForProblem(1);
      expect(result).toEqual(problem);
    });

    it('returns undefined when problem not found in DB', async () => {
      const { mockDB } = createMockDBWithIndex(undefined);
      dbHelper.openDB.mockResolvedValue(mockDB);

      const result = await checkDatabaseForProblem(999);
      expect(result).toBeUndefined();
    });
  });
});
