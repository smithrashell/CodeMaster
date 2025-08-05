/**
 * Mock Data Factories for Session Service Testing
 * Provides consistent test data across session service tests
 */

import { v4 as uuidv4 } from "uuid";

// This is a utility file, not a test file
// Adding a dummy test to prevent Jest from complaining
if (process.env.NODE_ENV === "test") {
  describe("MockDataFactories", () => {
    it("should export factory functions", () => {
      expect(typeof MockDataFactories.createMockSession).toBe("function");
      expect(typeof MockDataFactories.createMockProblem).toBe("function");
    });
  });
}

export const MockDataFactories = {
  /**
   * Creates a mock session object
   * @param {Object} overrides - Properties to override defaults
   * @returns {Object} Mock session object
   */
  createMockSession: (overrides = {}) => ({
    id: uuidv4(),
    date: new Date().toISOString(),
    status: "in_progress",
    problems: [],
    attempts: [],
    ...overrides,
  }),

  /**
   * Creates a mock problem object
   * @param {Object} overrides - Properties to override defaults
   * @returns {Object} Mock problem object
   */
  createMockProblem: (overrides = {}) => ({
    id: Math.floor(Math.random() * 1000),
    leetCodeID: Math.floor(Math.random() * 3000),
    title: "Sample Problem",
    difficulty: "Easy",
    tags: ["array"],
    description: "Sample problem description",
    acceptance: 50.5,
    boxLevel: 1,
    ...overrides,
  }),

  /**
   * Creates a mock attempt object
   * @param {Object} overrides - Properties to override defaults
   * @returns {Object} Mock attempt object
   */
  createMockAttempt: (overrides = {}) => ({
    attemptId: uuidv4(),
    problemId: 1,
    success: true,
    timeSpent: 300, // 5 minutes in seconds
    AttemptDate: new Date().toISOString(),
    ...overrides,
  }),

  /**
   * Creates mock session settings
   * @param {Object} overrides - Properties to override defaults
   * @returns {Object} Mock session settings
   */
  createMockSessionSettings: (overrides = {}) => ({
    id: "session_state",
    numSessionsCompleted: 0,
    currentDifficultyCap: "Easy",
    sessionLength: 5,
    numberOfNewProblems: 3,
    currentAllowedTags: ["array", "string"],
    lastSessionDate: new Date().toISOString(),
    ...overrides,
  }),

  /**
   * Creates an array of mock problems with various characteristics
   * @param {number} count - Number of problems to create
   * @param {Object} options - Configuration options
   * @returns {Array} Array of mock problems
   */
  createMockProblems: (count = 5, options = {}) => {
    const difficulties = options.difficulties || ["Easy", "Medium", "Hard"];
    const tags = options.tags || [
      "array",
      "string",
      "hash-table",
      "dynamic-programming",
      "tree",
    ];

    return Array.from({ length: count }, (_, index) => ({
      id: index + 1,
      leetCodeID: (index + 1) * 10,
      title: `Problem ${index + 1}`,
      difficulty: difficulties[index % difficulties.length],
      tags: [tags[index % tags.length]],
      description: `Description for problem ${index + 1}`,
      acceptance: 40 + ((index * 5) % 60),
      boxLevel: Math.floor(index / 3) + 1,
      ...options.overrides,
    }));
  },

  /**
   * Creates a mock completed session with problems and attempts
   * @param {Object} options - Configuration options
   * @returns {Object} Complete mock session
   */
  createCompletedSessionWithData: (options = {}) => {
    const problems = MockDataFactories.createMockProblems(
      options.problemCount || 3,
      { difficulties: ["Easy", "Medium"] }
    );

    const attempts = problems.map((problem, index) =>
      MockDataFactories.createMockAttempt({
        problemId: problem.id,
        success: index < 2, // First 2 attempts successful
        timeSpent: 180 + index * 60, // Varying time spent
      })
    );

    return MockDataFactories.createMockSession({
      status: "completed",
      problems,
      attempts,
      date:
        options.date ||
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
      ...options.overrides,
    });
  },

  /**
   * Creates mock tag mastery data
   * @param {Array} tags - Tags to create mastery data for
   * @returns {Object} Mock tag mastery mapping
   */
  createMockTagMastery: (tags = ["array", "string", "hash-table"]) => {
    return tags.reduce((mastery, tag, index) => {
      mastery[tag] = {
        tag,
        totalAttempts: 10 + index * 5,
        successfulAttempts: 6 + index * 3,
        averageTime: 240 + index * 30,
        difficultyProgress: {
          Easy: index > 0 ? "mastered" : "learning",
          Medium: index > 1 ? "learning" : "locked",
          Hard: "locked",
        },
        lastAttemptDate: new Date(
          Date.now() - index * 24 * 60 * 60 * 1000
        ).toISOString(),
        masteryScore: 0.6 + index * 0.1,
        decayScore: 1.0 - index * 0.05,
      };
      return mastery;
    }, {});
  },

  /**
   * Creates mock user performance data
   * @param {Object} overrides - Properties to override defaults
   * @returns {Object} Mock performance data
   */
  createMockPerformanceData: (overrides = {}) => ({
    totalSessions: 15,
    completedSessions: 12,
    averageSessionTime: 1800, // 30 minutes
    overallAccuracy: 0.75,
    tagPerformance: MockDataFactories.createMockTagMastery(),
    difficultyProgression: {
      Easy: { attempted: 45, successful: 38, accuracy: 0.84 },
      Medium: { attempted: 20, successful: 12, accuracy: 0.6 },
      Hard: { attempted: 3, successful: 1, accuracy: 0.33 },
    },
    recentTrend: {
      last7Days: { accuracy: 0.8, averageTime: 1680 },
      last30Days: { accuracy: 0.75, averageTime: 1800 },
    },
    ...overrides,
  }),

  /**
   * Creates mock Chrome storage data
   * @param {Object} data - Storage data to mock
   * @returns {Object} Mock storage helper functions
   */
  createMockStorage: (data = {}) => ({
    get: jest.fn((keys) => {
      if (typeof keys === "string") {
        return Promise.resolve({ [keys]: data[keys] });
      }
      if (Array.isArray(keys)) {
        return Promise.resolve(
          keys.reduce((acc, key) => ({ ...acc, [key]: data[key] }), {})
        );
      }
      return Promise.resolve(data);
    }),
    set: jest.fn((items) => {
      Object.assign(data, items);
      return Promise.resolve();
    }),
    remove: jest.fn((keys) => {
      const keysArray = Array.isArray(keys) ? keys : [keys];
      keysArray.forEach((key) => delete data[key]);
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      Object.keys(data).forEach((key) => delete data[key]);
      return Promise.resolve();
    }),
  }),

  /**
   * Creates mock IndexedDB transaction results
   * @param {Array} data - Data to return from transaction
   * @returns {Object} Mock transaction result
   */
  createMockDBResult: (data = []) => ({
    result: data,
    error: null,
    transaction: {
      objectStore: jest.fn(() => ({
        get: jest.fn((key) => ({
          result: data.find((item) => item.id === key),
        })),
        getAll: jest.fn(() => ({ result: data })),
        add: jest.fn(() => ({ result: true })),
        put: jest.fn(() => ({ result: true })),
        delete: jest.fn(() => ({ result: true })),
        index: jest.fn(() => ({
          openCursor: jest.fn((range, direction) => ({ result: null })),
        })),
      })),
    },
  }),

  /**
   * Creates scenario-specific test data sets
   */
  scenarios: {
    newUser: () => ({
      sessionSettings: MockDataFactories.createMockSessionSettings({
        numSessionsCompleted: 0,
        currentDifficultyCap: "Easy",
        currentAllowedTags: ["array", "string"],
      }),
      problems: MockDataFactories.createMockProblems(3, {
        difficulties: ["Easy"],
        tags: ["array", "string"],
      }),
      tagMastery: {},
    }),

    intermediateUser: () => ({
      sessionSettings: MockDataFactories.createMockSessionSettings({
        numSessionsCompleted: 25,
        currentDifficultyCap: "Medium",
        sessionLength: 7,
        numberOfNewProblems: 4,
        currentAllowedTags: ["array", "string", "dynamic-programming"],
      }),
      problems: MockDataFactories.createMockProblems(7, {
        difficulties: ["Easy", "Medium"],
        tags: ["array", "string", "dynamic-programming"],
      }),
      tagMastery: MockDataFactories.createMockTagMastery([
        "array",
        "string",
        "dynamic-programming",
      ]),
    }),

    expertUser: () => ({
      sessionSettings: MockDataFactories.createMockSessionSettings({
        numSessionsCompleted: 100,
        currentDifficultyCap: "Hard",
        sessionLength: 10,
        numberOfNewProblems: 3,
        currentAllowedTags: [
          "graph",
          "tree",
          "dynamic-programming",
          "backtracking",
        ],
      }),
      problems: MockDataFactories.createMockProblems(10, {
        difficulties: ["Medium", "Hard"],
        tags: ["graph", "tree", "dynamic-programming", "backtracking"],
      }),
      tagMastery: MockDataFactories.createMockTagMastery([
        "graph",
        "tree",
        "dynamic-programming",
        "backtracking",
      ]),
    }),
  },
};

export default MockDataFactories;
