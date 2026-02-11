/**
 * Tests for findPrerequisiteProblem
 *
 * Uses fake-indexeddb to create a real database with standard_problems
 * and problem_relationships stores, then tests the actual function
 * against seeded data.
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

// Mock dbHelper to use fake-indexeddb directly
jest.mock('../../index.js', () => {
  function openDB() {
    return new Promise((resolve, reject) => {
      const request = globalThis.indexedDB.open('TestDB', 1);

      request.onupgradeneeded = (event) => {
        const database = event.target.result;

        // standard_problems store (keyPath: "id")
        if (!database.objectStoreNames.contains('standard_problems')) {
          const spStore = database.createObjectStore('standard_problems', { keyPath: 'id' });
          spStore.createIndex('by_slug', 'slug', { unique: false });
        }

        // problem_relationships store (keyPath: "id", autoIncrement)
        if (!database.objectStoreNames.contains('problem_relationships')) {
          const prStore = database.createObjectStore('problem_relationships', {
            keyPath: 'id',
            autoIncrement: true,
          });
          prStore.createIndex('by_problem_id1', 'problem_id1', { unique: false });
          prStore.createIndex('by_problem_id2', 'problem_id2', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  return {
    __esModule: true,
    dbHelper: { openDB },
    dbHelperProxy: { openDB },
  };
});

// Import after mocks are set up
const { findPrerequisiteProblem } = require('../problem_relationships.js');
const { dbHelper } = require('../../index.js');

/**
 * Helper: seed standard_problems store
 */
async function seedStandardProblems(problems) {
  const db = await dbHelper.openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('standard_problems', 'readwrite');
    const store = tx.objectStore('standard_problems');
    for (const p of problems) {
      store.put(p);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Helper: seed problem_relationships store
 */
async function seedRelationships(relationships) {
  const db = await dbHelper.openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('problem_relationships', 'readwrite');
    const store = tx.objectStore('problem_relationships');
    for (const r of relationships) {
      store.add(r);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

describe('findPrerequisiteProblem', () => {
  it('returns null for falsy problemId', async () => {
    const result = await findPrerequisiteProblem(null);
    expect(result).toBeNull();
  });

  it('returns null for undefined problemId', async () => {
    const result = await findPrerequisiteProblem(undefined);
    expect(result).toBeNull();
  });

  it('returns null when skipped problem not found in standard_problems', async () => {
    // Don't seed any problems - DB is empty
    await dbHelper.openDB(); // ensure DB is created
    const result = await findPrerequisiteProblem(999);
    expect(result).toBeNull();
  });

  it('returns null when no related problems in graph', async () => {
    await seedStandardProblems([
      { id: 1, title: 'Two Sum', difficulty: 'Easy', tags: ['array', 'hash-table'] },
    ]);
    // No relationships seeded

    const result = await findPrerequisiteProblem(1);
    expect(result).toBeNull();
  });

  it('returns best candidate from graph', async () => {
    await seedStandardProblems([
      { id: 10, title: 'Skipped Problem', difficulty: 'Medium', tags: ['array', 'two-pointers'] },
      { id: 20, title: 'Candidate A', difficulty: 'Easy', tags: ['array'] },
      { id: 30, title: 'Candidate B', difficulty: 'Medium', tags: ['array', 'two-pointers'] },
      { id: 40, title: 'Candidate C', difficulty: 'Easy', tags: ['array', 'two-pointers'] },
    ]);

    await seedRelationships([
      { problem_id1: 10, problem_id2: 20, strength: 2.0 },
      { problem_id1: 10, problem_id2: 30, strength: 3.0 },
      { problem_id1: 10, problem_id2: 40, strength: 4.0 },
    ]);

    const result = await findPrerequisiteProblem(10);
    expect(result).not.toBeNull();
    // Candidate C (id=40): strength 4/5*0.5 + 2/2*0.3 + 0.2(easier) + 0.2 = 0.4+0.3+0.2+0.2 = 1.1
    // Candidate B (id=30): strength 3/5*0.5 + 2/2*0.3 + 0(same diff) + 0.2 = 0.3+0.3+0+0.2 = 0.8
    // Candidate A (id=20): strength 2/5*0.5 + 1/2*0.3 + 0.2(easier) + 0.2 = 0.2+0.15+0.2+0.2 = 0.75
    expect(result.id).toBe(40);
  });

  it('filters out harder difficulty problems', async () => {
    await seedStandardProblems([
      { id: 10, title: 'Skipped Problem', difficulty: 'Medium', tags: ['array'] },
      { id: 20, title: 'Hard Candidate', difficulty: 'Hard', tags: ['array'] },
      { id: 30, title: 'Easy Candidate', difficulty: 'Easy', tags: ['array'] },
    ]);

    await seedRelationships([
      { problem_id1: 10, problem_id2: 20, strength: 5.0 },
      { problem_id1: 10, problem_id2: 30, strength: 1.0 },
    ]);

    const result = await findPrerequisiteProblem(10);
    expect(result).not.toBeNull();
    // Hard candidate (id=20) should be filtered out, only Easy (id=30) remains
    expect(result.id).toBe(30);
  });

  it('respects excludeIds', async () => {
    await seedStandardProblems([
      { id: 10, title: 'Skipped Problem', difficulty: 'Medium', tags: ['array'] },
      { id: 20, title: 'Candidate A', difficulty: 'Easy', tags: ['array'] },
      { id: 30, title: 'Candidate B', difficulty: 'Easy', tags: ['array'] },
    ]);

    await seedRelationships([
      { problem_id1: 10, problem_id2: 20, strength: 5.0 },
      { problem_id1: 10, problem_id2: 30, strength: 3.0 },
    ]);

    // Exclude the best candidate (id=20)
    const result = await findPrerequisiteProblem(10, [20]);
    expect(result).not.toBeNull();
    expect(result.id).toBe(30);
  });

  it('scores by relationship strength as primary weight', async () => {
    await seedStandardProblems([
      { id: 10, title: 'Skipped Problem', difficulty: 'Medium', tags: ['array', 'dp'] },
      { id: 20, title: 'Weak Relationship', difficulty: 'Medium', tags: ['array', 'dp'] },
      { id: 30, title: 'Strong Relationship', difficulty: 'Medium', tags: ['array'] },
    ]);

    await seedRelationships([
      { problem_id1: 10, problem_id2: 20, strength: 1.0 },
      { problem_id1: 10, problem_id2: 30, strength: 5.0 },
    ]);

    const result = await findPrerequisiteProblem(10);
    expect(result).not.toBeNull();
    // id=30: strength 5/5*0.5 + 1/2*0.3 + 0 + 0.2 = 0.5+0.15+0+0.2 = 0.85
    // id=20: strength 1/5*0.5 + 2/2*0.3 + 0 + 0.2 = 0.1+0.3+0+0.2 = 0.6
    // Strong relationship wins despite fewer tag overlaps
    expect(result.id).toBe(30);
  });

  it('gives difficulty bonus to easier problems', async () => {
    await seedStandardProblems([
      { id: 10, title: 'Skipped Problem', difficulty: 'Medium', tags: ['array'] },
      { id: 20, title: 'Same Difficulty', difficulty: 'Medium', tags: ['array'] },
      { id: 30, title: 'Easier Problem', difficulty: 'Easy', tags: ['array'] },
    ]);

    // Give both the same relationship strength
    await seedRelationships([
      { problem_id1: 10, problem_id2: 20, strength: 3.0 },
      { problem_id1: 10, problem_id2: 30, strength: 3.0 },
    ]);

    const result = await findPrerequisiteProblem(10);
    expect(result).not.toBeNull();
    // id=30 (Easy): 3/5*0.5 + 1/1*0.3 + 0.2 + 0.2 = 0.3+0.3+0.2+0.2 = 1.0
    // id=20 (Medium): 3/5*0.5 + 1/1*0.3 + 0 + 0.2 = 0.3+0.3+0+0.2 = 0.8
    // Easier problem gets the 0.2 bonus
    expect(result.id).toBe(30);
  });

  it('finds prerequisite via bidirectional relationship', async () => {
    await seedStandardProblems([
      { id: 10, title: 'Skipped Problem', difficulty: 'Medium', tags: ['graph'] },
      { id: 20, title: 'Related Problem', difficulty: 'Easy', tags: ['graph'] },
    ]);

    // Relationship stored in reverse direction (problem_id1=20, problem_id2=10)
    await seedRelationships([
      { problem_id1: 20, problem_id2: 10, strength: 4.0 },
    ]);

    const result = await findPrerequisiteProblem(10);
    expect(result).not.toBeNull();
    expect(result.id).toBe(20);
  });

  it('returns null when all candidates are excluded', async () => {
    await seedStandardProblems([
      { id: 10, title: 'Skipped Problem', difficulty: 'Medium', tags: ['array'] },
      { id: 20, title: 'Only Candidate', difficulty: 'Easy', tags: ['array'] },
    ]);

    await seedRelationships([
      { problem_id1: 10, problem_id2: 20, strength: 3.0 },
    ]);

    const result = await findPrerequisiteProblem(10, [20]);
    expect(result).toBeNull();
  });
});
