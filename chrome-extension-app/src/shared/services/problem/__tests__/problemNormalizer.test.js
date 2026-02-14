/**
 * Tests for problemNormalizer.js
 * Validates the normalization and validation pipeline
 */

jest.mock('../../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

import { normalizeProblem, normalizeProblems, isNormalized } from '../problemNormalizer.js';

describe('normalizeProblem - validation (via validateRawProblem)', () => {
  it('should throw on null input', () => {
    expect(() => normalizeProblem(null)).toThrow('Problem is null or undefined');
  });

  it('should throw on undefined input', () => {
    expect(() => normalizeProblem(undefined)).toThrow('Problem is null or undefined');
  });

  it('should throw when both id and leetcode_id are missing', () => {
    expect(() => normalizeProblem({ title: 'Test', difficulty: 'Easy', tags: ['a'] }))
      .toThrow('missing both leetcode_id and id');
  });

  it('should throw when id is non-numeric', () => {
    expect(() => normalizeProblem({ id: 'abc', title: 'Test', difficulty: 'Easy', tags: ['a'] }))
      .toThrow('not a number');
  });

  it('should throw when title is missing', () => {
    expect(() => normalizeProblem({ id: 1, difficulty: 'Easy', tags: ['a'] }))
      .toThrow('missing title');
  });

  it('should throw when difficulty is missing', () => {
    expect(() => normalizeProblem({ id: 1, title: 'Test', tags: ['a'] }))
      .toThrow('missing difficulty');
  });

  it('should throw when tags are missing', () => {
    expect(() => normalizeProblem({ id: 1, title: 'Test', difficulty: 'Easy' }))
      .toThrow('missing tags');
  });
});

describe('normalizeProblem - normalization', () => {
  const validProblem = {
    leetcode_id: 42,
    title: 'two sum',
    slug: 'two-sum',
    difficulty: 'Easy',
    tags: ['array', 'hash-table']
  };

  it('should set id from leetcode_id as Number', () => {
    const result = normalizeProblem({ ...validProblem, leetcode_id: '42' });
    expect(result.id).toBe(42);
    expect(result.leetcode_id).toBe(42);
  });

  it('should use id when leetcode_id is missing', () => {
    const { leetcode_id: _, ...problemWithId } = validProblem;
    const result = normalizeProblem({ ...problemWithId, id: 42 });
    expect(result.id).toBe(42);
    expect(result.leetcode_id).toBe(42);
  });

  it('should set problem_id from input or null', () => {
    const withUuid = normalizeProblem({ ...validProblem, problem_id: 'uuid-123' });
    expect(withUuid.problem_id).toBe('uuid-123');

    const withoutUuid = normalizeProblem(validProblem);
    expect(withoutUuid.problem_id).toBeNull();
  });

  it('should title-case the title', () => {
    const result = normalizeProblem(validProblem);
    expect(result.title).toBe('Two Sum');
  });

  it('should title-case multi-word titles', () => {
    const result = normalizeProblem({ ...validProblem, title: 'LONGEST COMMON SUBSEQUENCE' });
    expect(result.title).toBe('Longest Common Subsequence');
  });

  it('should set _normalized to true', () => {
    const result = normalizeProblem(validProblem);
    expect(result._normalized).toBe(true);
  });

  it('should set _normalizedAt as ISO string', () => {
    const result = normalizeProblem(validProblem);
    expect(new Date(result._normalizedAt).toISOString()).toBe(result._normalizedAt);
  });

  it('should set _source', () => {
    const result = normalizeProblem(validProblem, 'standard_problem');
    expect(result._source).toBe('standard_problem');
  });

  it('should ensure id === leetcode_id in output', () => {
    const result = normalizeProblem(validProblem);
    expect(result.id).toBe(result.leetcode_id);
  });

  it('should keep tags as array', () => {
    const result = normalizeProblem(validProblem);
    expect(Array.isArray(result.tags)).toBe(true);
    expect(result.tags).toEqual(['array', 'hash-table']);
  });
});

describe('normalizeProblem - toTitleCase edge cases', () => {
  const baseProblem = { leetcode_id: 1, slug: 's', difficulty: 'Easy', tags: ['a'] };

  it('should handle null title gracefully via validation throw', () => {
    expect(() => normalizeProblem({ ...baseProblem, title: null })).toThrow('missing title');
  });

  it('should handle empty string title via validation throw', () => {
    expect(() => normalizeProblem({ ...baseProblem, title: '' })).toThrow('missing title');
  });
});

describe('normalizeProblems', () => {
  const validProblem = {
    leetcode_id: 1,
    title: 'test',
    slug: 'test',
    difficulty: 'Easy',
    tags: ['array']
  };

  it('should throw when input is not an array', () => {
    expect(() => normalizeProblems('not an array')).toThrow('Expected array');
    expect(() => normalizeProblems(null)).toThrow('Expected array');
  });

  it('should normalize all problems in array', () => {
    const result = normalizeProblems([
      { ...validProblem, leetcode_id: 1 },
      { ...validProblem, leetcode_id: 2 }
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(1);
    expect(result[1].id).toBe(2);
  });

  it('should wrap error with index context', () => {
    expect(() => normalizeProblems([
      validProblem,
      { id: 2 } // missing title
    ])).toThrow(/index 1/);
  });

  it('should handle empty array', () => {
    const result = normalizeProblems([]);
    expect(result).toEqual([]);
  });
});

describe('isNormalized', () => {
  it('should return true when _normalized is true', () => {
    expect(isNormalized({ _normalized: true })).toBe(true);
  });

  it('should return false when _normalized is missing', () => {
    expect(isNormalized({})).toBe(false);
  });

  it('should return false when _normalized is not true', () => {
    expect(isNormalized({ _normalized: 'yes' })).toBe(false);
  });

  it('should return falsy for null', () => {
    expect(isNormalized(null)).toBeFalsy();
  });
});
