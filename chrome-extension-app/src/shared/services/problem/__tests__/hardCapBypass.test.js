import { addFallbackProblems } from '../problemServiceSession.js';
import { enrichReviewProblem, normalizeReviewProblem } from '../problemServiceHelpers.js';
import { fetchProblemById } from '../../../db/stores/standard_problems.js';

// Mock logger
jest.mock('../../../utils/logging/logger.js', () => ({
    __esModule: true,
    default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

// Mock helpers
jest.mock('../problemServiceHelpers.js', () => ({
    enrichReviewProblem: jest.fn(),
    normalizeReviewProblem: jest.fn(p => ({
        ...p,
        id: p.id || p.leetcode_id,
        difficulty: p.difficulty || 'Easy',
        _normalized: true
    }))
}));

// Mock DB stores
jest.mock('../../../db/stores/standard_problems.js', () => ({
    fetchProblemById: jest.fn()
}));

describe('addFallbackProblems Hard Cap Enforcement', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should strictly limit Hard problems in fallback even if raw objects lack difficulty field', async () => {
        // Scenario: Session has 0 problems. maxHardProblems is 1.
        const sessionProblems = [];
        const sessionLength = 5;
        const maxHardProblems = 1;

        const allProblems = [
            // Problem 1: Hard (using 'difficulty')
            { id: 1, leetcode_id: 1, title: 'Hard 1', difficulty: 'Hard', tags: ['array'], review_schedule: '2025-01-01' },
            // Problem 2: Hard (using 'difficulty') - Previously used 'Rating' which caused a bypass
            { id: 2, leetcode_id: 2, title: 'Hard 2', difficulty: 'Hard', tags: ['array'], review_schedule: '2025-01-02' },
            // Problem 3: Hard (using difficulty: 3)
            { id: 3, leetcode_id: 3, title: 'Hard 3', difficulty: 3, tags: ['array'], review_schedule: '2025-01-03' },
            // Problem 4: Easy
            { id: 4, leetcode_id: 4, title: 'Easy 1', difficulty: 'Easy', tags: ['array'], review_schedule: '2025-01-04' },
            // Problem 5: Easy
            { id: 5, leetcode_id: 5, title: 'Easy 2', difficulty: 'Easy', tags: ['array'], review_schedule: '2025-01-05' }
        ];

        // Mock enrichment
        enrichReviewProblem.mockImplementation(p => Promise.resolve({
            ...p,
            difficulty: p.difficulty || 'Easy',
            tags: p.tags || ['array']
        }));

        await addFallbackProblems(sessionProblems, sessionLength, allProblems, maxHardProblems);

        // Verify count of Hard problems
        const hardProblemsAdded = sessionProblems.filter(p =>
            p.difficulty === 'Hard' || p.difficulty === 3
        );

        expect(hardProblemsAdded.length).toBeLessThanOrEqual(maxHardProblems);
        expect(sessionProblems.length).toBeGreaterThan(0);

        // Verify specifically that NO MORE THAN 1 Hard was added
        const hardIds = sessionProblems.filter(p => [1, 2, 3].includes(p.id)).map(p => p.id);
        expect(hardIds.length).toBe(1);
        expect(hardIds[0]).toBe(1); // Since they are sorted by review_schedule and 1 is earliest
    });

    it('should handle already full hard cap from previous priorities', async () => {
        // Scenario: Session already has 1 Hard problem from Priority 1. maxHardProblems is 1.
        const sessionProblems = [
            { id: 10, leetcode_id: 10, title: 'Triggered Hard', difficulty: 'Hard' }
        ];
        const sessionLength = 5;
        const maxHardProblems = 1;

        const allProblems = [
            { id: 1, leetcode_id: 1, title: 'Hard 1', difficulty: 'Hard', tags: ['array'], review_schedule: '2025-01-01' },
            { id: 2, leetcode_id: 2, title: 'Easy 1', difficulty: 'Easy', tags: ['array'], review_schedule: '2025-01-02' }
        ];

        enrichReviewProblem.mockImplementation(p => Promise.resolve({ ...p }));

        await addFallbackProblems(sessionProblems, sessionLength, allProblems, maxHardProblems);

        const extraHardAdded = sessionProblems.slice(1).filter(p => p.difficulty === 'Hard');
        expect(extraHardAdded.length).toBe(0);
        // Should have added the easy one
        expect(sessionProblems.find(p => p.id === 2)).toBeDefined();
    });
});
