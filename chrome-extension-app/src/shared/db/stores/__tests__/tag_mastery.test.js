/**
 * Tests for tag_mastery.js
 *
 * Focus: calculateTagSimilarity pure function (exported)
 * DB functions (getTagMastery, upsertTagMastery) tested with mocked openDB.
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

// Mock the DB index
jest.mock('../../index.js', () => ({
  dbHelper: { openDB: jest.fn() },
}));

import { calculateTagSimilarity, getTagMastery, upsertTagMastery } from '../tag_mastery.js';
import { dbHelper } from '../../index.js';

// ---------------------------------------------------------------------------
// Helper: create a fake IDB store + transaction that auto-fires onsuccess
// ---------------------------------------------------------------------------
function createMockRequest(result) {
  const req = { result, onsuccess: null, onerror: null };
  Promise.resolve().then(() => {
    if (req.onsuccess) req.onsuccess({ target: req });
  });
  return req;
}

function createMockDB({ getAllResult = [] } = {}) {
  const mockStore = {
    getAll: jest.fn(() => createMockRequest(getAllResult)),
    get: jest.fn((key) => createMockRequest(key)),
    put: jest.fn(() => createMockRequest(undefined)),
  };
  const mockTx = {
    objectStore: jest.fn(() => mockStore),
    oncomplete: null,
    onerror: null,
    complete: Promise.resolve(),
  };
  return {
    db: { transaction: jest.fn(() => mockTx) },
    store: mockStore,
    tx: mockTx,
  };
}

// ---------------------------------------------------------------------------
// calculateTagSimilarity — pure function tests
// ---------------------------------------------------------------------------

describe('calculateTagSimilarity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Direct match ---
  describe('direct tag match', () => {
    it('adds 2 to similarity for each directly matching tag', () => {
      const result = calculateTagSimilarity({
        tags1: ['array'],
        tags2: ['array'],
        tagGraph: {},
        tagMastery: {},
        difficulty1: 'Medium',
        difficulty2: 'Medium',
      });
      // direct match: +2, difficulty same: *1.2 → 2.4
      expect(result).toBeCloseTo(2.4, 5);
    });

    it('adds 2 for each matching tag pair (two matches)', () => {
      const result = calculateTagSimilarity({
        tags1: ['array', 'hash-table'],
        tags2: ['array', 'hash-table'],
        tagGraph: {},
        tagMastery: {},
        difficulty1: 'Easy',
        difficulty2: 'Easy',
      });
      // 2 direct matches: 4, difficulty same: *1.2 → 4.8
      expect(result).toBeCloseTo(4.8, 5);
    });

    it('counts each pair — cross-product logic', () => {
      // tags1 has 'array', tags2 has 'array' + 'tree': only 1 match
      const result = calculateTagSimilarity({
        tags1: ['array'],
        tags2: ['array', 'tree'],
        tagGraph: {},
        tagMastery: {},
        difficulty1: 'Medium',
        difficulty2: 'Medium',
      });
      // 1 direct match: 2, same difficulty: *1.2 → 2.4
      expect(result).toBeCloseTo(2.4, 5);
    });

    it('returns 0 similarity when no tags match and no graph relations', () => {
      const result = calculateTagSimilarity({
        tags1: ['array'],
        tags2: ['tree'],
        tagGraph: {},
        tagMastery: {},
        difficulty1: 'Medium',
        difficulty2: 'Medium',
      });
      expect(result).toBe(0);
    });

    it('handles empty tags arrays', () => {
      const result = calculateTagSimilarity({
        tags1: [],
        tags2: [],
        tagGraph: {},
        tagMastery: {},
        difficulty1: 'Easy',
        difficulty2: 'Easy',
      });
      expect(result).toBe(0);
    });

    it('handles one empty tags array', () => {
      const result = calculateTagSimilarity({
        tags1: ['array'],
        tags2: [],
        tagGraph: {},
        tagMastery: {},
        difficulty1: 'Medium',
        difficulty2: 'Easy',
      });
      expect(result).toBe(0);
    });
  });

  // --- Indirect match via tagGraph ---
  describe('indirect match via tagGraph', () => {
    it('uses log10 scaling for indirect relationships', () => {
      const associationScore = 9; // log10(9+1) = 1, scaled by 0.5 → 0.5
      const tagGraph = { array: { 'two-pointers': associationScore } };
      const result = calculateTagSimilarity({
        tags1: ['array'],
        tags2: ['two-pointers'],
        tagGraph,
        tagMastery: {},
        difficulty1: 'Medium',
        difficulty2: 'Medium',
      });
      // indirect score: log10(10) * 0.5 = 0.5, same difficulty: *1.2 → 0.6
      expect(result).toBeCloseTo(0.6, 5);
    });

    it('uses log10 scaling with association score of 99', () => {
      const associationScore = 99; // log10(100) = 2, scaled by 0.5 → 1.0
      const tagGraph = { array: { tree: associationScore } };
      const result = calculateTagSimilarity({
        tags1: ['array'],
        tags2: ['tree'],
        tagGraph,
        tagMastery: {},
        difficulty1: 'Hard',
        difficulty2: 'Hard',
      });
      // indirect: log10(100)*0.5 = 1.0, same difficulty: *1.2 → 1.2
      expect(result).toBeCloseTo(1.2, 5);
    });

    it('does not apply indirect score when tagGraph entry missing for tag1', () => {
      const tagGraph = { tree: { array: 5 } }; // tag1='array' not in graph as source
      const result = calculateTagSimilarity({
        tags1: ['array'],
        tags2: ['tree'],
        tagGraph,
        tagMastery: {},
        difficulty1: 'Medium',
        difficulty2: 'Medium',
      });
      expect(result).toBe(0);
    });

    it('does not apply indirect score when tag2 not in tagGraph[tag1]', () => {
      const tagGraph = { array: { 'hash-table': 5 } }; // tag2='tree' not in graph[array]
      const result = calculateTagSimilarity({
        tags1: ['array'],
        tags2: ['tree'],
        tagGraph,
        tagMastery: {},
        difficulty1: 'Medium',
        difficulty2: 'Medium',
      });
      expect(result).toBe(0);
    });
  });

  // --- Tag mastery decay effect ---
  describe('tag mastery decay effect', () => {
    it('increases similarity for unmastered tags with decayScore', () => {
      const tagMastery = {
        array: { mastered: false, decayScore: 2.0 },
      };
      const result = calculateTagSimilarity({
        tags1: ['array'],
        tags2: ['tree'],
        tagGraph: {},
        tagMastery,
        difficulty1: 'Medium',
        difficulty2: 'Medium',
      });
      // mastery boost: 2.0 * 0.5 = 1.0, no match: base=1.0, same difficulty: *1.2 → 1.2
      expect(result).toBeCloseTo(1.2, 5);
    });

    it('does not boost similarity for mastered tags', () => {
      const tagMastery = {
        array: { mastered: true, decayScore: 2.0 },
      };
      const result = calculateTagSimilarity({
        tags1: ['array'],
        tags2: ['tree'],
        tagGraph: {},
        tagMastery,
        difficulty1: 'Medium',
        difficulty2: 'Medium',
      });
      // mastered tag — no boost applied
      expect(result).toBe(0);
    });

    it('accumulates decay boosts from both tags1 and tags2', () => {
      const tagMastery = {
        array: { mastered: false, decayScore: 1.0 },
        tree: { mastered: false, decayScore: 1.0 },
      };
      const result = calculateTagSimilarity({
        tags1: ['array'],
        tags2: ['tree'],
        tagGraph: {},
        tagMastery,
        difficulty1: 'Medium',
        difficulty2: 'Medium',
      });
      // array boost: 0.5, tree boost: 0.5 → base=1.0, same difficulty: *1.2 → 1.2
      expect(result).toBeCloseTo(1.2, 5);
    });

    it('skips tags not found in tagMastery', () => {
      const tagMastery = {};
      const result = calculateTagSimilarity({
        tags1: ['array'],
        tags2: ['tree'],
        tagGraph: {},
        tagMastery,
        difficulty1: 'Medium',
        difficulty2: 'Medium',
      });
      expect(result).toBe(0);
    });
  });

  // --- getDifficultyWeight ---
  describe('difficulty weight', () => {
    it('applies 1.2x multiplier when difficulties are the same', () => {
      const result = calculateTagSimilarity({
        tags1: ['array'],
        tags2: ['array'],
        tagGraph: {},
        tagMastery: {},
        difficulty1: 'Easy',
        difficulty2: 'Easy',
      });
      expect(result).toBeCloseTo(2 * 1.2, 5);
    });

    it('applies 1.0x multiplier when difficulty gap is 1', () => {
      const result = calculateTagSimilarity({
        tags1: ['array'],
        tags2: ['array'],
        tagGraph: {},
        tagMastery: {},
        difficulty1: 'Easy',
        difficulty2: 'Medium',
      });
      expect(result).toBeCloseTo(2 * 1.0, 5);
    });

    it('applies 0.7x multiplier when difficulty gap is 2 (Easy vs Hard)', () => {
      const result = calculateTagSimilarity({
        tags1: ['array'],
        tags2: ['array'],
        tagGraph: {},
        tagMastery: {},
        difficulty1: 'Easy',
        difficulty2: 'Hard',
      });
      expect(result).toBeCloseTo(2 * 0.7, 5);
    });

    it('falls back to Medium (2) for unknown difficulty strings', () => {
      // Both unknown → gap = 0 → 1.2
      const result = calculateTagSimilarity({
        tags1: ['array'],
        tags2: ['array'],
        tagGraph: {},
        tagMastery: {},
        difficulty1: 'Unknown',
        difficulty2: 'Unknown',
      });
      expect(result).toBeCloseTo(2 * 1.2, 5);
    });

    it('treats null difficulty as Medium', () => {
      const result = calculateTagSimilarity({
        tags1: ['array'],
        tags2: ['array'],
        tagGraph: {},
        tagMastery: {},
        difficulty1: null,
        difficulty2: null,
      });
      // Both null → Medium (2) gap = 0 → 1.2
      expect(result).toBeCloseTo(2 * 1.2, 5);
    });
  });

  // --- Combined scenarios ---
  describe('combined direct match + decay + difficulty', () => {
    it('combines direct match and mastery decay correctly', () => {
      const tagMastery = {
        array: { mastered: false, decayScore: 1.0 },
      };
      const result = calculateTagSimilarity({
        tags1: ['array'],
        tags2: ['array'],
        tagGraph: {},
        tagMastery,
        difficulty1: 'Medium',
        difficulty2: 'Medium',
      });
      // direct: 2, decay from array (in both tags1+tags2 concat) → 0.5 + 0.5 = 1.0
      // base before difficulty = 3.0, * 1.2 → 3.6
      expect(result).toBeCloseTo(3.6, 5);
    });
  });
});

// ---------------------------------------------------------------------------
// getTagMastery — DB function tests
// ---------------------------------------------------------------------------

describe('getTagMastery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns records from the tag_mastery store on success', async () => {
    const mockRecords = [
      { tag: 'array', mastered: false, decay_score: 0.8 },
      { tag: 'tree', mastered: true, decay_score: 0.2 },
    ];
    const { db, store } = createMockDB({ getAllResult: mockRecords });
    dbHelper.openDB.mockResolvedValue(db);

    const result = await getTagMastery();
    expect(result).toEqual(mockRecords);
    expect(store.getAll).toHaveBeenCalledTimes(1);
  });

  it('returns empty array when tag_mastery store is empty', async () => {
    const { db } = createMockDB({ getAllResult: [] });
    dbHelper.openDB.mockResolvedValue(db);

    const result = await getTagMastery();
    expect(result).toEqual([]);
  });

  it('returns empty array as fallback when openDB rejects', async () => {
    dbHelper.openDB.mockRejectedValue(new Error('DB unavailable'));

    const result = await getTagMastery();
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// upsertTagMastery — DB function tests
// ---------------------------------------------------------------------------

describe('upsertTagMastery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes the tag to lowercase before storing', async () => {
    const { db, store } = createMockDB();
    dbHelper.openDB.mockResolvedValue(db);

    await upsertTagMastery({ tag: 'ARRAY', mastered: false, decay_score: 1.0 });

    expect(store.put).toHaveBeenCalledWith(
      expect.objectContaining({ tag: 'array' })
    );
  });

  it('normalizes the tag by trimming whitespace', async () => {
    const { db, store } = createMockDB();
    dbHelper.openDB.mockResolvedValue(db);

    await upsertTagMastery({ tag: '  hash-table  ', mastered: true });

    expect(store.put).toHaveBeenCalledWith(
      expect.objectContaining({ tag: 'hash-table' })
    );
  });

  it('passes all fields through to the store', async () => {
    const { db, store } = createMockDB();
    dbHelper.openDB.mockResolvedValue(db);

    const record = { tag: 'tree', mastered: true, decay_score: 0.5, strength: 80 };
    await upsertTagMastery(record);

    expect(store.put).toHaveBeenCalledWith(
      expect.objectContaining({ mastered: true, decay_score: 0.5, strength: 80 })
    );
  });

  it('opens a readwrite transaction on tag_mastery', async () => {
    const { db } = createMockDB();
    dbHelper.openDB.mockResolvedValue(db);

    await upsertTagMastery({ tag: 'graph', mastered: false });

    expect(db.transaction).toHaveBeenCalledWith('tag_mastery', 'readwrite');
  });
});
