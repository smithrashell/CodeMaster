/**
 * Tests for problemServiceHelpers.js
 * Validates enrichment fix, normalization, and filtering
 */

jest.mock('../../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

import {
  enrichReviewProblem,
  normalizeReviewProblem,
  filterValidReviewProblems
} from '../problemServiceHelpers.js';

describe('enrichReviewProblem', () => {
  let mockFetchProblemById;

  beforeEach(() => {
    mockFetchProblemById = jest.fn();
  });

  it('should return original when leetcode_id is missing', async () => {
    const problem = { title: 'No ID Problem' };
    const result = await enrichReviewProblem(problem, mockFetchProblemById);
    expect(result).toBe(problem);
    expect(mockFetchProblemById).not.toHaveBeenCalled();
  });

  it('should use id as fallback when leetcode_id is missing', async () => {
    const problem = { id: 42, title: 'Has ID' };
    mockFetchProblemById.mockResolvedValue({ difficulty: 'Easy', tags: ['array'], slug: 'has-id', title: 'Has ID' });
    const result = await enrichReviewProblem(problem, mockFetchProblemById);
    expect(mockFetchProblemById).toHaveBeenCalledWith(42);
    expect(result.difficulty).toBe('Easy');
  });

  it('should return original when fetchProblemById returns null', async () => {
    const problem = { leetcode_id: 999 };
    mockFetchProblemById.mockResolvedValue(null);
    const result = await enrichReviewProblem(problem, mockFetchProblemById);
    expect(result).toBe(problem);
  });

  it('should enrich with difficulty from standard problem', async () => {
    const problem = { leetcode_id: 1 };
    mockFetchProblemById.mockResolvedValue({ difficulty: 'Medium', tags: ['dp'], slug: 'two-sum', title: 'Two Sum' });
    const result = await enrichReviewProblem(problem, mockFetchProblemById);
    expect(result.difficulty).toBe('Medium');
  });

  it('should enrich with tags from standard problem', async () => {
    const problem = { leetcode_id: 1 };
    mockFetchProblemById.mockResolvedValue({ difficulty: 'Easy', tags: ['array', 'hash-table'], slug: 'two-sum', title: 'Two Sum' });
    const result = await enrichReviewProblem(problem, mockFetchProblemById);
    expect(result.tags).toEqual(['array', 'hash-table']);
  });

  it('should enrich with slug from standard problem', async () => {
    const problem = { leetcode_id: 1 };
    mockFetchProblemById.mockResolvedValue({ difficulty: 'Easy', tags: ['array'], slug: 'two-sum', title: 'Two Sum' });
    const result = await enrichReviewProblem(problem, mockFetchProblemById);
    expect(result.slug).toBe('two-sum');
  });

  it('should enrich with title from standard problem', async () => {
    const problem = { leetcode_id: 1 };
    mockFetchProblemById.mockResolvedValue({ difficulty: 'Easy', tags: ['array'], slug: 'two-sum', title: 'Two Sum' });
    const result = await enrichReviewProblem(problem, mockFetchProblemById);
    expect(result.title).toBe('Two Sum');
  });

  it('should preserve existing fields on the review problem', async () => {
    const problem = { leetcode_id: 1, difficulty: 'Hard', tags: ['graph'], slug: 'my-slug', title: 'My Title' };
    mockFetchProblemById.mockResolvedValue({ difficulty: 'Easy', tags: ['array'], slug: 'two-sum', title: 'Two Sum' });
    const result = await enrichReviewProblem(problem, mockFetchProblemById);
    expect(result.difficulty).toBe('Hard');
    expect(result.tags).toEqual(['graph']);
    expect(result.slug).toBe('my-slug');
    expect(result.title).toBe('My Title');
  });

  it('should coerce IDs to Number', async () => {
    const problem = { leetcode_id: '42' };
    mockFetchProblemById.mockResolvedValue({ difficulty: 'Easy', tags: ['array'], slug: 'test', title: 'Test' });
    const result = await enrichReviewProblem(problem, mockFetchProblemById);
    expect(mockFetchProblemById).toHaveBeenCalledWith(42);
    expect(result.id).toBe(42);
    expect(result.leetcode_id).toBe(42);
  });

  it('should set both id and leetcode_id on enriched result', async () => {
    const problem = { leetcode_id: 7 };
    mockFetchProblemById.mockResolvedValue({ difficulty: 'Easy', tags: ['array'], slug: 'test', title: 'Test' });
    const result = await enrichReviewProblem(problem, mockFetchProblemById);
    expect(result.id).toBe(7);
    expect(result.leetcode_id).toBe(7);
  });

  it('should partially enrich when some fields already exist', async () => {
    const problem = { leetcode_id: 1, difficulty: 'Medium' };
    mockFetchProblemById.mockResolvedValue({ difficulty: 'Easy', tags: ['tree'], slug: 'lca', title: 'LCA' });
    const result = await enrichReviewProblem(problem, mockFetchProblemById);
    expect(result.difficulty).toBe('Medium');
    expect(result.tags).toEqual(['tree']);
    expect(result.slug).toBe('lca');
  });
});

describe('normalizeReviewProblem', () => {
  it('should set id from leetcode_id when id is missing', () => {
    const result = normalizeReviewProblem({ leetcode_id: 42, title: 'Test' });
    expect(result.id).toBe(42);
  });

  it('should use title_slug as slug fallback', () => {
    const result = normalizeReviewProblem({ id: 1, title_slug: 'two-sum' });
    expect(result.slug).toBe('two-sum');
  });

  it('should use titleSlug as slug fallback', () => {
    const result = normalizeReviewProblem({ id: 1, titleSlug: 'two-sum' });
    expect(result.slug).toBe('two-sum');
  });

  it('should use TitleSlug as slug fallback', () => {
    const result = normalizeReviewProblem({ id: 1, TitleSlug: 'two-sum' });
    expect(result.slug).toBe('two-sum');
  });

  it('should generate slug from title as last resort', () => {
    const result = normalizeReviewProblem({ id: 1, title: 'Two Sum' });
    expect(result.slug).toBe('two-sum');
  });

  it('should convert attempt_stats to attempts array', () => {
    const result = normalizeReviewProblem({
      id: 1, attempt_stats: { total_attempts: 3 }
    });
    expect(result.attempts).toEqual([{ count: 3 }]);
  });

  it('should set empty attempts when attempt_stats has 0 total', () => {
    const result = normalizeReviewProblem({
      id: 1, attempt_stats: { total_attempts: 0 }
    });
    expect(result.attempts).toEqual([]);
  });

  it('should default to empty attempts array', () => {
    const result = normalizeReviewProblem({ id: 1 });
    expect(result.attempts).toEqual([]);
  });

  it('should preserve existing slug', () => {
    const result = normalizeReviewProblem({ id: 1, slug: 'existing-slug', title_slug: 'other' });
    expect(result.slug).toBe('existing-slug');
  });
});

describe('filterValidReviewProblems', () => {
  it('should filter out problems with no id', () => {
    const result = filterValidReviewProblems([{ title: 'No ID', difficulty: 'Easy', tags: ['a'] }]);
    expect(result).toHaveLength(0);
  });

  it('should filter out problems with no title', () => {
    const result = filterValidReviewProblems([{ id: 1, difficulty: 'Easy', tags: ['a'] }]);
    expect(result).toHaveLength(0);
  });

  it('should filter out problems with no difficulty', () => {
    const result = filterValidReviewProblems([{ id: 1, title: 'Test', tags: ['a'] }]);
    expect(result).toHaveLength(0);
  });

  it('should filter out problems with no tags', () => {
    const result = filterValidReviewProblems([{ id: 1, title: 'Test', difficulty: 'Easy' }]);
    expect(result).toHaveLength(0);
  });

  it('should pass valid problems', () => {
    const valid = { id: 1, title: 'Test', difficulty: 'Easy', tags: ['array'] };
    const result = filterValidReviewProblems([valid]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(valid);
  });

  it('should accept leetcode_id as alternative to id', () => {
    const valid = { leetcode_id: 1, title: 'Test', difficulty: 'Easy', tags: ['array'] };
    const result = filterValidReviewProblems([valid]);
    expect(result).toHaveLength(1);
  });

  it('should handle null input', () => {
    const result = filterValidReviewProblems(null);
    expect(result).toEqual([]);
  });
});
