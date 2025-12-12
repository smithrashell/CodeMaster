/**
 * Tests for box level counting functions in problems.js
 * Regression tests for Issue #159: Incorrect box level statistics
 */

import { countProblemsByBoxLevel, countProblemsByBoxLevelWithRetry } from '../stores/problems.js';
import { dbHelper } from '../index.js';

// Mock the database helper
jest.mock('../index.js', () => ({
  dbHelper: {
    openDB: jest.fn(),
  },
}));

// Mock IndexedDB retry service
jest.mock('../../services/storage/indexedDBRetryService.js', () => {
  const mockInstance = {
    executeWithRetry: jest.fn((fn) => fn()),
    defaultTimeout: 5000,
    quickTimeout: 2000,
    bulkTimeout: 30000,
  };
  return {
    __esModule: true,
    IndexedDBRetryService: jest.fn().mockImplementation(() => mockInstance),
    indexedDBRetry: mockInstance,
    default: mockInstance,
  };
});

describe('countProblemsByBoxLevel', () => {
  it('should read box_level field (not box or BoxLevel)', async () => {
    const mockProblems = [
      { problem_id: '1', box_level: 1, title: 'Problem 1' },
      { problem_id: '2', box_level: 2, title: 'Problem 2' },
      { problem_id: '3', box_level: 3, title: 'Problem 3' },
    ];

    dbHelper.openDB.mockResolvedValue({
      transaction: jest.fn().mockReturnValue({
        objectStore: jest.fn().mockReturnValue({
          openCursor: jest.fn().mockReturnValue({
            onsuccess: null,
            onerror: null,
          }),
        }),
      }),
    });

    const promise = countProblemsByBoxLevel();

    // Get the cursor mock and simulate iteration
    const db = await dbHelper.openDB.mock.results[0].value;
    const transaction = db.transaction();
    const store = transaction.objectStore();
    const cursorRequest = store.openCursor();

    // Simulate cursor iteration
    setTimeout(() => {
      for (const problem of mockProblems) {
        cursorRequest.onsuccess({
          target: {
            result: {
              value: problem,
              continue: jest.fn(),
            },
          },
        });
      }
      cursorRequest.onsuccess({
        target: { result: null },
      });
    }, 0);

    const result = await promise;

    // Verify it counts by box_level field
    expect(result).toEqual({
      1: 1,
      2: 1,
      3: 1,
    });
  });

  it('should return object format (not array)', async () => {
    const mockProblems = [
      { problem_id: '1', box_level: 1 },
      { problem_id: '2', box_level: 1 },
      { problem_id: '3', box_level: 2 },
    ];

    dbHelper.openDB.mockResolvedValue({
      transaction: jest.fn().mockReturnValue({
        objectStore: jest.fn().mockReturnValue({
          openCursor: jest.fn().mockReturnValue({
            onsuccess: null,
            onerror: null,
          }),
        }),
      }),
    });

    const promise = countProblemsByBoxLevel();

    const db = await dbHelper.openDB.mock.results[0].value;
    const transaction = db.transaction();
    const store = transaction.objectStore();
    const cursorRequest = store.openCursor();

    setTimeout(() => {
      for (const problem of mockProblems) {
        cursorRequest.onsuccess({
          target: {
            result: {
              value: problem,
              continue: jest.fn(),
            },
          },
        });
      }
      cursorRequest.onsuccess({
        target: { result: null },
      });
    }, 0);

    const result = await promise;

    // CRITICAL: Must return object, not array
    expect(result).toEqual({
      1: 2,
      2: 1,
    });
    expect(Array.isArray(result)).toBe(false);
    expect(typeof result).toBe('object');
  });
});

// eslint-disable-next-line max-lines-per-function -- Comprehensive regression test for box level field normalization (Issue #159)
describe('countProblemsByBoxLevelWithRetry', () => {
  it('should read box_level field (not box or BoxLevel) - Regression test for #159', async () => {
    const mockProblems = [
      { problem_id: '1', box_level: 2, title: 'Problem 1' },
      { problem_id: '2', box_level: 2, title: 'Problem 2' },
      { problem_id: '3', box_level: 2, title: 'Problem 3' },
      { problem_id: '4', box_level: 3, title: 'Problem 4' },
      { problem_id: '5', box_level: 3, title: 'Problem 5' },
      { problem_id: '6', box_level: 3, title: 'Problem 6' },
      { problem_id: '7', box_level: 3, title: 'Problem 7' },
    ];

    dbHelper.openDB.mockResolvedValue({
      transaction: jest.fn().mockReturnValue({
        objectStore: jest.fn().mockReturnValue({
          getAll: jest.fn().mockReturnValue({
            onsuccess: null,
            onerror: null,
            result: mockProblems,
          }),
        }),
      }),
    });

    const promise = countProblemsByBoxLevelWithRetry();

    const db = await dbHelper.openDB.mock.results[0].value;
    const transaction = db.transaction();
    const store = transaction.objectStore();
    const getAllRequest = store.getAll();

    setTimeout(() => {
      getAllRequest.onsuccess();
    }, 0);

    const result = await promise;

    // CRITICAL REGRESSION TEST: Must read box_level, not problem.box
    // Expected: Box 2: 3 problems, Box 3: 4 problems
    expect(result).toEqual({
      2: 3,
      3: 4,
    });

    // Verify it's NOT reading wrong field (would show all in box 1)
    expect(result[1]).toBeUndefined();
  });

  it('should return object format (not array) - Regression test for #159', async () => {
    const mockProblems = [
      { problem_id: '1', box_level: 1 },
      { problem_id: '2', box_level: 1 },
      { problem_id: '3', box_level: 2 },
    ];

    dbHelper.openDB.mockResolvedValue({
      transaction: jest.fn().mockReturnValue({
        objectStore: jest.fn().mockReturnValue({
          getAll: jest.fn().mockReturnValue({
            onsuccess: null,
            onerror: null,
            result: mockProblems,
          }),
        }),
      }),
    });

    const promise = countProblemsByBoxLevelWithRetry();

    const db = await dbHelper.openDB.mock.results[0].value;
    const transaction = db.transaction();
    const store = transaction.objectStore();
    const getAllRequest = store.getAll();

    setTimeout(() => {
      getAllRequest.onsuccess();
    }, 0);

    const result = await promise;

    // CRITICAL REGRESSION TEST: Must return object {1: 2, 2: 1}, not array [0, 2, 1, 0, 0]
    expect(result).toEqual({
      1: 2,
      2: 1,
    });
    expect(Array.isArray(result)).toBe(false);
    expect(typeof result).toBe('object');
  });

  it('should handle problems distributed across multiple box levels', async () => {
    const mockProblems = [
      { problem_id: '1', box_level: 1 },
      { problem_id: '2', box_level: 1 },
      { problem_id: '3', box_level: 1 },
      { problem_id: '4', box_level: 2 },
      { problem_id: '5', box_level: 2 },
      { problem_id: '6', box_level: 3 },
      { problem_id: '7', box_level: 4 },
      { problem_id: '8', box_level: 4 },
      { problem_id: '9', box_level: 4 },
    ];

    dbHelper.openDB.mockResolvedValue({
      transaction: jest.fn().mockReturnValue({
        objectStore: jest.fn().mockReturnValue({
          getAll: jest.fn().mockReturnValue({
            onsuccess: null,
            onerror: null,
            result: mockProblems,
          }),
        }),
      }),
    });

    const promise = countProblemsByBoxLevelWithRetry();

    const db = await dbHelper.openDB.mock.results[0].value;
    const transaction = db.transaction();
    const store = transaction.objectStore();
    const getAllRequest = store.getAll();

    setTimeout(() => {
      getAllRequest.onsuccess();
    }, 0);

    const result = await promise;

    expect(result).toEqual({
      1: 3,
      2: 2,
      3: 1,
      4: 3,
    });
  });

  it('should use fallback value of 1 for missing box_level', async () => {
    const mockProblems = [
      { problem_id: '1', box_level: 2 },
      { problem_id: '2' }, // Missing box_level
      { problem_id: '3' }, // Missing box_level
    ];

    dbHelper.openDB.mockResolvedValue({
      transaction: jest.fn().mockReturnValue({
        objectStore: jest.fn().mockReturnValue({
          getAll: jest.fn().mockReturnValue({
            onsuccess: null,
            onerror: null,
            result: mockProblems,
          }),
        }),
      }),
    });

    const promise = countProblemsByBoxLevelWithRetry();

    const db = await dbHelper.openDB.mock.results[0].value;
    const transaction = db.transaction();
    const store = transaction.objectStore();
    const getAllRequest = store.getAll();

    setTimeout(() => {
      getAllRequest.onsuccess();
    }, 0);

    const result = await promise;

    // Problems without box_level should default to 1
    expect(result).toEqual({
      1: 2,
      2: 1,
    });
  });

  it('should return empty object for no problems', async () => {
    dbHelper.openDB.mockResolvedValue({
      transaction: jest.fn().mockReturnValue({
        objectStore: jest.fn().mockReturnValue({
          getAll: jest.fn().mockReturnValue({
            onsuccess: null,
            onerror: null,
            result: [],
          }),
        }),
      }),
    });

    const promise = countProblemsByBoxLevelWithRetry();

    const db = await dbHelper.openDB.mock.results[0].value;
    const transaction = db.transaction();
    const store = transaction.objectStore();
    const getAllRequest = store.getAll();

    setTimeout(() => {
      getAllRequest.onsuccess();
    }, 0);

    const result = await promise;

    expect(result).toEqual({});
    expect(Array.isArray(result)).toBe(false);
  });
});
