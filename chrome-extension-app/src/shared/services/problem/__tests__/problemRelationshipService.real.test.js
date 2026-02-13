/**
 * Tests for ProblemRelationshipService (84 lines, 0% coverage)
 */

jest.mock('../../../db/index.js', () => ({
  dbHelper: {
    openDB: jest.fn(),
  },
}));

jest.mock('../../../db/stores/problem_relationships.js', () => ({
  buildRelationshipMap: jest.fn(),
}));

import { ProblemRelationshipService } from '../problemRelationshipService.js';
import { dbHelper } from '../../../db/index.js';
import { buildRelationshipMap } from '../../../db/stores/problem_relationships.js';

describe('ProblemRelationshipService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------
  // getSimilarProblems
  // -------------------------------------------------------------------
  describe('getSimilarProblems', () => {
    it('returns sorted similar problems up to limit', async () => {
      const map = new Map();
      map.set(1, { 2: 0.9, 3: 0.5, 4: 0.7 });
      buildRelationshipMap.mockResolvedValue(map);

      const result = await ProblemRelationshipService.getSimilarProblems(1, 2);
      expect(result).toEqual([
        { problemId: 2, weight: 0.9 },
        { problemId: 4, weight: 0.7 },
      ]);
    });

    it('returns empty array when no relationships exist', async () => {
      const map = new Map();
      buildRelationshipMap.mockResolvedValue(map);

      const result = await ProblemRelationshipService.getSimilarProblems(99);
      expect(result).toEqual([]);
    });

    it('returns empty array when relationships object is empty', async () => {
      const map = new Map();
      map.set(1, {});
      buildRelationshipMap.mockResolvedValue(map);

      const result = await ProblemRelationshipService.getSimilarProblems(1);
      expect(result).toEqual([]);
    });

    it('uses default limit of 10', async () => {
      const relationships = {};
      for (let i = 1; i <= 15; i++) {
        relationships[i + 100] = i * 0.1;
      }
      const map = new Map();
      map.set(1, relationships);
      buildRelationshipMap.mockResolvedValue(map);

      const result = await ProblemRelationshipService.getSimilarProblems(1);
      expect(result.length).toBe(10);
    });

    it('returns empty array on error', async () => {
      buildRelationshipMap.mockRejectedValue(new Error('DB error'));

      const result = await ProblemRelationshipService.getSimilarProblems(1);
      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------
  // getProblemMetadata
  // -------------------------------------------------------------------
  describe('getProblemMetadata', () => {
    it('returns existing problem data if provided', async () => {
      const existingData = { id: 1, name: 'Two Sum', tags: ['array'] };
      const result = await ProblemRelationshipService.getProblemMetadata(1, existingData);
      expect(result).toBe(existingData);
      expect(dbHelper.openDB).not.toHaveBeenCalled();
    });

    it('returns problem from problems store', async () => {
      const mockResult = { id: 1, name: 'Two Sum' };
      const mockGetRequest = { result: mockResult };
      const mockStore = {
        get: jest.fn(() => mockGetRequest),
      };
      const mockTx = {
        objectStore: jest.fn(() => mockStore),
      };
      const mockDb = {
        transaction: jest.fn(() => mockTx),
      };
      dbHelper.openDB.mockResolvedValue(mockDb);

      // Simulate the IDB get success
      const promise = ProblemRelationshipService.getProblemMetadata(1);
      // Wait for the openDB call and transaction setup
      await new Promise(r => setTimeout(r, 0));
      // Trigger the onsuccess
      mockGetRequest.onsuccess();

      const result = await promise;
      expect(result).toEqual(mockResult);
    });

    it('falls back to standard_problems if problems store throws', async () => {
      let callCount = 0;
      const mockStandardResult = { id: 1, name: 'Standard Two Sum' };
      const mockStandardGetRequest = { result: mockStandardResult };

      const mockDb = {
        transaction: jest.fn(() => {
          callCount++;
          if (callCount === 1) {
            // First call (problems store) throws
            throw new Error('Store not found');
          }
          // Second call (standard_problems store) succeeds
          return {
            objectStore: jest.fn(() => ({
              get: jest.fn(() => mockStandardGetRequest),
            })),
          };
        }),
      };
      dbHelper.openDB.mockResolvedValue(mockDb);

      const promise = ProblemRelationshipService.getProblemMetadata(1);
      await new Promise(r => setTimeout(r, 0));
      mockStandardGetRequest.onsuccess();

      const result = await promise;
      expect(result).toEqual(mockStandardResult);
    });

    it('returns null on error', async () => {
      dbHelper.openDB.mockRejectedValue(new Error('DB error'));

      const result = await ProblemRelationshipService.getProblemMetadata(1);
      expect(result).toBeNull();
    });

    it('returns value property if result has it', async () => {
      const mockResult = { value: { id: 1, name: 'Two Sum' } };
      const mockGetRequest = { result: mockResult };
      const mockStore = {
        get: jest.fn(() => mockGetRequest),
      };
      const mockTx = {
        objectStore: jest.fn(() => mockStore),
      };
      const mockDb = {
        transaction: jest.fn(() => mockTx),
      };
      dbHelper.openDB.mockResolvedValue(mockDb);

      const promise = ProblemRelationshipService.getProblemMetadata(1);
      await new Promise(r => setTimeout(r, 0));
      mockGetRequest.onsuccess();

      const result = await promise;
      expect(result).toEqual({ id: 1, name: 'Two Sum' });
    });

    it('returns null when result is null in both stores', async () => {
      const mockGetRequest1 = { result: null };
      const mockGetRequest2 = { result: null };
      let callCount = 0;

      const mockDb = {
        transaction: jest.fn(() => {
          callCount++;
          if (callCount === 1) {
            return {
              objectStore: jest.fn(() => ({
                get: jest.fn(() => mockGetRequest1),
              })),
            };
          }
          return {
            objectStore: jest.fn(() => ({
              get: jest.fn(() => mockGetRequest2),
            })),
          };
        }),
      };
      dbHelper.openDB.mockResolvedValue(mockDb);

      const promise = ProblemRelationshipService.getProblemMetadata(1);
      await new Promise(r => setTimeout(r, 0));
      mockGetRequest1.onsuccess();
      await new Promise(r => setTimeout(r, 0));
      mockGetRequest2.onsuccess();

      const result = await promise;
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------
  // calculateRelationshipBonuses
  // -------------------------------------------------------------------
  describe('calculateRelationshipBonuses', () => {
    it('calculates bonuses for tag pairs based on weighted scores', () => {
      const tagAnalysis = {
        tagWeightedScore: { array: 0.8, 'hash table': 0.6 },
      };
      const result = ProblemRelationshipService.calculateRelationshipBonuses(
        ['Array', 'Hash Table'],
        tagAnalysis,
        []
      );
      // scoreA=0.8, scoreB=0.6, bonus = min((0.8+0.6)*100, 150) = min(140, 150) = 140
      expect(result['array+hash table']).toBe(140);
    });

    it('caps bonus at 150', () => {
      const tagAnalysis = {
        tagWeightedScore: { array: 1.0, dp: 1.0 },
      };
      const result = ProblemRelationshipService.calculateRelationshipBonuses(
        ['Array', 'DP'],
        tagAnalysis,
        []
      );
      // (1.0+1.0)*100 = 200, capped at 150
      expect(result['array+dp']).toBe(150);
    });

    it('returns 0 bonus for unknown tags', () => {
      const tagAnalysis = {
        tagWeightedScore: {},
      };
      const result = ProblemRelationshipService.calculateRelationshipBonuses(
        ['Array', 'Graph'],
        tagAnalysis,
        []
      );
      expect(result['array+graph']).toBe(0);
    });

    it('returns empty object for single tag', () => {
      const tagAnalysis = { tagWeightedScore: { array: 0.9 } };
      const result = ProblemRelationshipService.calculateRelationshipBonuses(
        ['Array'],
        tagAnalysis,
        []
      );
      expect(result).toEqual({});
    });

    it('creates sorted pair keys', () => {
      const tagAnalysis = {
        tagWeightedScore: { zebra: 0.5, apple: 0.3 },
      };
      const result = ProblemRelationshipService.calculateRelationshipBonuses(
        ['Zebra', 'Apple'],
        tagAnalysis,
        []
      );
      expect(result).toHaveProperty('apple+zebra');
    });
  });

  // -------------------------------------------------------------------
  // calculateContextStrength
  // -------------------------------------------------------------------
  describe('calculateContextStrength', () => {
    it('returns 0 for empty array', () => {
      expect(ProblemRelationshipService.calculateContextStrength([])).toBe(0);
    });

    it('calculates strength for single problem', () => {
      const problems = [{ problemId: 1, weight: 0.8 }];
      const result = ProblemRelationshipService.calculateContextStrength(problems);
      // countFactor = min(1/10, 1) = 0.1
      // avgWeight = 0.8, maxWeight = 0.8, weightFactor = 1.0
      // strength = 0.1 * 0.4 + 1.0 * 0.6 = 0.04 + 0.6 = 0.64
      expect(result).toBeCloseTo(0.64, 2);
    });

    it('calculates strength for multiple problems', () => {
      const problems = [
        { problemId: 1, weight: 1.0 },
        { problemId: 2, weight: 0.5 },
        { problemId: 3, weight: 0.5 },
      ];
      const result = ProblemRelationshipService.calculateContextStrength(problems);
      // countFactor = min(3/10, 1) = 0.3
      // avgWeight = (1.0+0.5+0.5)/3 = 0.667
      // maxWeight = 1.0, weightFactor = 0.667
      // strength = 0.3 * 0.4 + 0.667 * 0.6 = 0.12 + 0.4 = 0.52
      expect(result).toBeCloseTo(0.52, 1);
    });

    it('caps count factor at 1.0 for 10+ problems', () => {
      const problems = Array.from({ length: 10 }, (_, i) => ({
        problemId: i,
        weight: 0.5,
      }));
      const result = ProblemRelationshipService.calculateContextStrength(problems);
      // countFactor = 1.0, avgWeight = 0.5, maxWeight = 0.5, weightFactor = 1.0
      // strength = 1.0 * 0.4 + 1.0 * 0.6 = 1.0
      expect(result).toBeCloseTo(1.0, 2);
    });
  });

  // -------------------------------------------------------------------
  // analyzeProblemContext
  // -------------------------------------------------------------------
  describe('analyzeProblemContext', () => {
    it('returns tag-based hints when no similar problems found', async () => {
      buildRelationshipMap.mockResolvedValue(new Map());

      const result = await ProblemRelationshipService.analyzeProblemContext(1, ['array']);
      expect(result).toEqual({ useTagBasedHints: true, similarProblems: [] });
    });

    it('returns full analysis when similar problems found', async () => {
      const map = new Map();
      map.set(1, { 2: 0.9 });
      buildRelationshipMap.mockResolvedValue(map);

      // Mock getProblemMetadata
      jest.spyOn(ProblemRelationshipService, 'getProblemMetadata').mockResolvedValue({
        id: 2, tags: ['array', 'hash table'],
      });

      const result = await ProblemRelationshipService.analyzeProblemContext(1, ['array'], 5);
      expect(result.useTagBasedHints).toBe(false);
      expect(result.similarProblems.length).toBe(1);
      expect(result.tagAnalysis).toBeDefined();
      expect(result.relationshipBonuses).toBeDefined();
      expect(result.contextStrength).toBeDefined();

      ProblemRelationshipService.getProblemMetadata.mockRestore();
    });

    it('returns tag-based hints on error', async () => {
      buildRelationshipMap.mockRejectedValue(new Error('DB error'));

      const result = await ProblemRelationshipService.analyzeProblemContext(1, ['array']);
      expect(result).toEqual({ useTagBasedHints: true, similarProblems: [] });
    });
  });

  // -------------------------------------------------------------------
  // analyzeSimilarProblemTags
  // -------------------------------------------------------------------
  describe('analyzeSimilarProblemTags', () => {
    it('analyzes tags of similar problems', async () => {
      jest.spyOn(ProblemRelationshipService, 'getProblemMetadata')
        .mockResolvedValueOnce({ id: 2, tags: ['Array', 'Hash Table'] })
        .mockResolvedValueOnce({ id: 3, tags: ['Array', 'Sorting'] });

      const similar = [
        { problemId: 2, weight: 0.8 },
        { problemId: 3, weight: 0.6 },
      ];
      const result = await ProblemRelationshipService.analyzeSimilarProblemTags(similar);

      expect(result.tagFrequency['array']).toBe(2);
      expect(result.tagFrequency['hash table']).toBe(1);
      expect(result.tagFrequency['sorting']).toBe(1);
      expect(result.totalProblemsAnalyzed).toBe(2);
      // Verify normalized scores exist
      expect(result.tagWeightedScore['array']).toBeDefined();

      ProblemRelationshipService.getProblemMetadata.mockRestore();
    });

    it('handles problems without metadata or tags', async () => {
      jest.spyOn(ProblemRelationshipService, 'getProblemMetadata')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 3 }); // no tags

      const similar = [
        { problemId: 2, weight: 0.8 },
        { problemId: 3, weight: 0.6 },
      ];
      const result = await ProblemRelationshipService.analyzeSimilarProblemTags(similar);

      expect(result.tagFrequency).toEqual({});
      expect(result.totalProblemsAnalyzed).toBe(2);

      ProblemRelationshipService.getProblemMetadata.mockRestore();
    });
  });

  // -------------------------------------------------------------------
  // areProblemRelationshipsLoaded
  // -------------------------------------------------------------------
  describe('areProblemRelationshipsLoaded', () => {
    it('returns true when relationship map is non-empty', async () => {
      const map = new Map();
      map.set(1, { 2: 0.9 });
      buildRelationshipMap.mockResolvedValue(map);

      const result = await ProblemRelationshipService.areProblemRelationshipsLoaded();
      expect(result).toBe(true);
    });

    it('returns false when relationship map is empty', async () => {
      buildRelationshipMap.mockResolvedValue(new Map());

      const result = await ProblemRelationshipService.areProblemRelationshipsLoaded();
      expect(result).toBe(false);
    });

    it('returns falsy when relationship map is null', async () => {
      buildRelationshipMap.mockResolvedValue(null);

      const result = await ProblemRelationshipService.areProblemRelationshipsLoaded();
      expect(result).toBeFalsy();
    });

    it('returns false on error', async () => {
      buildRelationshipMap.mockRejectedValue(new Error('DB error'));

      const result = await ProblemRelationshipService.areProblemRelationshipsLoaded();
      expect(result).toBe(false);
    });
  });
});
