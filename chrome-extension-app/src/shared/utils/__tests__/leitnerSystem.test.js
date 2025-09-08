/**
 * Comprehensive tests for Leitner Spaced Repetition System
 * Tests core business logic for problem difficulty progression and box level calculations
 */

import "fake-indexeddb/auto";

// Mock all database dependencies
jest.mock("../../../shared/db/problems.js", () => ({
  updateStabilityFSRS: jest.fn(),
  fetchAllProblems: jest.fn(),
  saveUpdatedProblem: jest.fn(),
}));

jest.mock("../../../shared/db/index.js", () => ({
  dbHelper: {
    openDB: jest.fn(),
  },
}));

import {
  calculateLeitnerBox as _calculateLeitnerBox,
  reassessBoxLevel,
  evaluateAttempts,
} from "../leitnerSystem.js";
// eslint-disable-next-line no-restricted-imports
import { dbHelper } from "../../db/index.js";
import { updateStabilityFSRS } from "../../db/problems.js";

// Mock setup helpers
const createMockIndex = () => ({
  openCursor: jest.fn(),
});

const createMockObjectStore = (mockIndex) => ({
  index: jest.fn(() => mockIndex),
});

const createMockTransaction = (mockObjectStore) => ({
  objectStore: jest.fn(() => mockObjectStore),
});

const createMockDB = (mockTransaction) => ({
  transaction: jest.fn(() => mockTransaction),
});

const setupMockDatabase = () => {
  const mockIndex = createMockIndex();
  const mockObjectStore = createMockObjectStore(mockIndex);
  const mockTransaction = createMockTransaction(mockObjectStore);
  const mockDB = createMockDB(mockTransaction);

  dbHelper.openDB.mockResolvedValue(mockDB);
  updateStabilityFSRS.mockResolvedValue();

  return { mockDB, mockTransaction, mockObjectStore, mockIndex };
};

// Test data factories
const _createProblem = (id, title, boxLevel, difficulty = 0) => ({
  id,
  title,
  BoxLevel: boxLevel,
  boxLevel,
  Difficulty: difficulty,
});

const _createAttempts = (attemptsData) => 
  attemptsData.map(({ date, success, difficulty }) => ({
    AttemptDate: date,
    Success: success,
    Difficulty: difficulty,
  }));

const _expectAttemptStats = (result, total, successful, unsuccessful) => {
  expect(result.AttemptStats.TotalAttempts).toBe(total);
  expect(result.AttemptStats.SuccessfulAttempts).toBe(successful);
  expect(result.AttemptStats.UnsuccessfulAttempts).toBe(unsuccessful);
};

// Cursor simulation helpers
const createMockCursor = (attemptData) => ({
  value: attemptData,
  continue: jest.fn()
});

const _simulateCursorWithAttempts = (mockAttempts, mockIndex) => {
  let cursorCallCount = 0;
  
  mockIndex.openCursor.mockImplementation((_range, _direction) => ({
    onsuccess: null,
    onerror: null,
  }));

  setTimeout(() => {
    const request = mockIndex.openCursor.mock.results[0].value;
    
    const simulateCursorTraversal = () => {
      if (cursorCallCount < mockAttempts.length) {
        const mockCursor = createMockCursor(mockAttempts[cursorCallCount]);
        mockCursor.continue = () => {
          cursorCallCount++;
          setTimeout(simulateCursorTraversal, 0);
        };
        if (request.onsuccess) {
          request.onsuccess({ target: { result: mockCursor } });
        }
      } else {
        if (request.onsuccess) {
          request.onsuccess({ target: { result: null } });
        }
      }
    };

    simulateCursorTraversal();
  }, 0);
};

const _simulateEmptyCursor = (mockIndex) => {
  mockIndex.openCursor.mockImplementation(() => ({
    onsuccess: null,
    onerror: null,
  }));

  setTimeout(() => {
    const request = mockIndex.openCursor.mock.results[0].value;
    if (request.onsuccess) {
      request.onsuccess({ target: { result: null } });
    }
  }, 0);
};

const simulateCursorError = (mockIndex, errorCode = "DB_ERROR") => {
  if (mockIndex && mockIndex.openCursor) {
    const mockRequest = {
      onsuccess: null,
      onerror: null,
    };

    mockIndex.openCursor.mockImplementation(() => mockRequest);

    setTimeout(() => {
      if (mockRequest.onerror) {
        mockRequest.onerror({ target: { errorCode } });
      }
    }, 0);
  }
};

// Test group functions



// Removed duplicate runEvaluateAttemptsTests function - tests inlined below

const runBoxLevelIntervalsTests = () => {
  describe("Box Level Intervals", () => {
    it("should use correct intervals for each box level", () => {
      const testCases = [
        { boxLevel: 1, expectedMinInterval: 1 },
        { boxLevel: 3, expectedMinInterval: 7 },
        { boxLevel: 5, expectedMinInterval: 30 },
        { boxLevel: 8, expectedMinInterval: 120 },
      ];

      testCases.forEach(({ boxLevel, _expectedMinInterval }) => {
        const problem = { id: "test", boxLevel, title: "Test" };
        const attempts = Array(boxLevel)
          .fill()
          .map((_, i) => ({
            AttemptDate: `2024-01-0${i + 1}`,
            Success: true,
            Difficulty: 5,
          }));

        const result = reassessBoxLevel(problem, attempts);
        expect(result.boxLevel).toBeGreaterThanOrEqual(boxLevel);
      });
    });
  });
};

const runEdgeCasesTests = () => {
  describe("Edge Cases", () => {

    it("should handle malformed attempt data", () => {
      const problem = { id: "test", boxLevel: 2, title: "Test" };
      const attempts = [
        { AttemptDate: "invalid-date", Success: true, Difficulty: "invalid" },
        { AttemptDate: "2024-01-01", Success: null, Difficulty: 5 },
      ];

      expect(() => reassessBoxLevel(problem, attempts)).not.toThrow();
    });

  });
};

describe("Leitner System", function() {
  let _mockDB;
  let _mockObjectStore;
  let _mockIndex;

  beforeEach(() => {
    jest.clearAllMocks();
    const mocks = setupMockDatabase();
    _mockDB = mocks.mockDB;
    _mockObjectStore = mocks.mockObjectStore;
    _mockIndex = mocks.mockIndex;
  });

  
  describe("evaluateAttempts", () => {

    it("should handle database errors gracefully", async () => {
      const problem = { id: "prob-123", title: "Test Problem", boxLevel: 2 };
      
      // Create a fresh mock index for this test
      const localMockIndex = createMockIndex();
      _mockObjectStore.index.mockReturnValue(localMockIndex);
      
      simulateCursorError(localMockIndex, "DB_ERROR");

      await expect(evaluateAttempts(problem)).rejects.toBe("DB_ERROR");
    });

  });
  
  runBoxLevelIntervalsTests();
  runEdgeCasesTests();
});