import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';

// Custom render function that includes providers
export function renderWithProviders(ui, options = {}) {
  function Wrapper({ children }) {
    return (
      <MantineProvider theme={options.theme || {}}>
        {children}
      </MantineProvider>
    );
  }
  
  return render(ui, { wrapper: Wrapper, ...options });
}

// Mock IndexedDB helpers
export const mockIndexedDBHelpers = {
  createMockDB: (stores = []) => {
    const mockDB = {
      version: 22,
      name: 'CodeMasterTestDB',
      objectStoreNames: stores,
      transaction: jest.fn(() => ({
        objectStore: jest.fn(() => ({
          add: jest.fn(),
          put: jest.fn(),
          get: jest.fn(),
          delete: jest.fn(),
          getAll: jest.fn(),
          count: jest.fn(),
          clear: jest.fn(),
          index: jest.fn(() => ({
            get: jest.fn(),
            getAll: jest.fn()
          }))
        })),
        oncomplete: null,
        onerror: null,
        onabort: null
      })),
      close: jest.fn()
    };
    return mockDB;
  },

  createMockStore: (name, data = []) => ({
    name,
    data: [...data],
    add: jest.fn((item) => Promise.resolve(item)),
    put: jest.fn((item) => Promise.resolve(item)),
    get: jest.fn((key) => Promise.resolve(data.find(item => item.id === key))),
    getAll: jest.fn(() => Promise.resolve([...data])),
    delete: jest.fn((key) => {
      const index = data.findIndex(item => item.id === key);
      if (index > -1) data.splice(index, 1);
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      data.length = 0;
      return Promise.resolve();
    })
  })
};

// Session test data factory
export const createMockSession = (overrides = {}) => ({
  id: 'test-session-' + Date.now(),
  status: 'in_progress',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  settings: {
    sessionLength: 'medium',
    difficultyRange: ['easy', 'medium'],
    focusTags: ['array', 'string'],
    adaptiveMode: true
  },
  problems: [
    {
      id: 1,
      title: 'Two Sum',
      difficulty: 'easy',
      tags: ['array', 'hash-table'],
      attempted: false,
      correct: false,
      time_spent: 0
    },
    {
      id: 2,
      title: 'Add Two Numbers',
      difficulty: 'medium',
      tags: ['linked-list', 'math'],
      attempted: false,
      correct: false,
      time_spent: 0
    }
  ],
  performance: {
    total_problems: 2,
    attempted_problems: 0,
    correct_problems: 0,
    total_time: 0,
    avg_time_per_problem: 0
  },
  ...overrides
});

// Problem test data factory
export const createMockProblem = (overrides = {}) => ({
  id: Math.floor(Math.random() * 10000),
  title: 'Test Problem',
  difficulty: 'medium',
  tags: ['array'],
  description: 'Test problem description',
  examples: [],
  constraints: [],
  hints: [],
  leetcode_id: Math.floor(Math.random() * 3000),
  acceptance_rate: 0.5,
  created_at: new Date().toISOString(),
  ...overrides
});

// Tag mastery test data factory
export const createMockTagMastery = (overrides = {}) => ({
  tag: 'array',
  mastery_score: 0.75,
  total_attempts: 10,
  successful_attempts: 8,
  avg_time: 1500,
  difficulty_breakdown: {
    easy: { attempts: 5, success: 5, avg_time: 800 },
    medium: { attempts: 4, success: 3, avg_time: 2000 },
    hard: { attempts: 1, success: 0, avg_time: 3000 }
  },
  last_updated: new Date().toISOString(),
  decay_score: 0.9,
  learning_rate: 0.15,
  ...overrides
});

// Chrome extension API helpers
export const mockChromeApi = {
  resetMocks: () => {
    Object.values(global.chrome.storage.local).forEach(mock => {
      if (jest.isMockFunction(mock)) mock.mockClear();
    });
    Object.values(global.chrome.storage.sync).forEach(mock => {
      if (jest.isMockFunction(mock)) mock.mockClear();
    });
    Object.values(global.chrome.runtime).forEach(mock => {
      if (jest.isMockFunction(mock)) mock.mockClear();
    });
  },

  mockStorageGet: (data) => {
    global.chrome.storage.local.get.mockImplementation((keys, callback) => {
      const result = typeof keys === 'string' 
        ? { [keys]: data[keys] }
        : Array.isArray(keys)
        ? keys.reduce((acc, key) => ({ ...acc, [key]: data[key] }), {})
        : data;
      
      if (callback) callback(result);
      return Promise.resolve(result);
    });
  },

  mockStorageSet: () => {
    global.chrome.storage.local.set.mockImplementation((items, callback) => {
      if (callback) callback();
      return Promise.resolve();
    });
  }
};

// Test assertion helpers
export const assertSessionStructure = (session) => {
  expect(session).toHaveProperty('id');
  expect(session).toHaveProperty('status');
  expect(session).toHaveProperty('created_at');
  expect(session).toHaveProperty('problems');
  expect(Array.isArray(session.problems)).toBe(true);
};

export const assertProblemStructure = (problem) => {
  expect(problem).toHaveProperty('id');
  expect(problem).toHaveProperty('title');
  expect(problem).toHaveProperty('difficulty');
  expect(problem).toHaveProperty('tags');
  expect(Array.isArray(problem.tags)).toBe(true);
};

export const assertTagMasteryStructure = (tagMastery) => {
  expect(tagMastery).toHaveProperty('tag');
  expect(tagMastery).toHaveProperty('mastery_score');
  expect(tagMastery).toHaveProperty('total_attempts');
  expect(tagMastery).toHaveProperty('successful_attempts');
  expect(typeof tagMastery.mastery_score).toBe('number');
  expect(tagMastery.mastery_score).toBeGreaterThanOrEqual(0);
  expect(tagMastery.mastery_score).toBeLessThanOrEqual(1);
};