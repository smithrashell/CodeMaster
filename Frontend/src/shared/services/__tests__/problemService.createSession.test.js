// Mock all the database and service dependencies before importing
jest.mock('../../db/sessions');
jest.mock('../../db/problems'); 
jest.mock('../../db/problem_relationships');
jest.mock('../../db/tag_mastery');
jest.mock('../../db/attempts');
jest.mock('../../db/sessionAnalytics');
jest.mock('../scheduleService');
jest.mock('../tagServices');
jest.mock('../attemptsService');
jest.mock('../storageService');
jest.mock('../sessionService');
jest.mock('../relationshipService');

import { ProblemService } from '../problemService';
import * as sessions from '../../db/sessions';
import * as problems from '../../db/problems';
import { ScheduleService } from '../scheduleService';
import { TagService } from '../tagServices';
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-123')
}));

describe('ProblemService.createSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createSession()', () => {
    it('should create a session with default settings when user is new', async () => {
      // Arrange
      const mockSettings = {
        sessionLength: 5,
        numberOfNewProblems: 3,
        currentAllowedTags: ['array', 'string'],
        currentDifficultyCap: 'Easy'
      };
      
      const mockProblems = [
        { id: 1, title: 'Two Sum', difficulty: 'Easy', tags: ['array'] },
        { id: 2, title: 'Valid Parentheses', difficulty: 'Easy', tags: ['string'] },
        { id: 3, title: 'Merge Intervals', difficulty: 'Medium', tags: ['array'] }
      ];

      sessions.buildAdaptiveSessionSettings.mockResolvedValue(mockSettings);
      
      // Mock the fetchAndAssembleSessionProblems method
      const mockFetchAndAssemble = jest.spyOn(ProblemService, 'fetchAndAssembleSessionProblems')
        .mockResolvedValue(mockProblems);

      // Act
      const result = await ProblemService.createSession();

      // Assert
      expect(sessions.buildAdaptiveSessionSettings).toHaveBeenCalled();
      expect(mockFetchAndAssemble).toHaveBeenCalledWith(
        mockSettings.sessionLength,
        mockSettings.numberOfNewProblems,
        mockSettings.currentAllowedTags,
        mockSettings.currentDifficultyCap
      );
      expect(result).toEqual(mockProblems);
      expect(result).toHaveLength(3);
    });

    it('should handle empty session settings gracefully', async () => {
      // Arrange
      const mockSettings = {
        sessionLength: 0,
        numberOfNewProblems: 0,
        currentAllowedTags: [],
        currentDifficultyCap: 'Easy'
      };

      sessions.buildAdaptiveSessionSettings.mockResolvedValue(mockSettings);
      
      const mockFetchAndAssemble = jest.spyOn(ProblemService, 'fetchAndAssembleSessionProblems')
        .mockResolvedValue([]);

      // Act
      const result = await ProblemService.createSession();

      // Assert
      expect(sessions.buildAdaptiveSessionSettings).toHaveBeenCalled();
      expect(mockFetchAndAssemble).toHaveBeenCalledWith(0, 0, [], 'Easy');
      expect(result).toEqual([]);
    });

    it('should propagate errors from buildAdaptiveSessionSettings', async () => {
      // Arrange
      const error = new Error('Settings build failed');
      sessions.buildAdaptiveSessionSettings.mockRejectedValue(error);

      // Act & Assert
      await expect(ProblemService.createSession()).rejects.toThrow('Settings build failed');
      expect(sessions.buildAdaptiveSessionSettings).toHaveBeenCalled();
    });

    it('should propagate errors from fetchAndAssembleSessionProblems', async () => {
      // Arrange
      const mockSettings = {
        sessionLength: 5,
        numberOfNewProblems: 3,
        currentAllowedTags: ['array'],
        currentDifficultyCap: 'Medium'
      };

      sessions.buildAdaptiveSessionSettings.mockResolvedValue(mockSettings);
      
      const error = new Error('Problem fetching failed');
      const mockFetchAndAssemble = jest.spyOn(ProblemService, 'fetchAndAssembleSessionProblems')
        .mockRejectedValue(error);

      // Act & Assert
      await expect(ProblemService.createSession()).rejects.toThrow('Problem fetching failed');
      expect(sessions.buildAdaptiveSessionSettings).toHaveBeenCalled();
      expect(mockFetchAndAssemble).toHaveBeenCalledWith(5, 3, ['array'], 'Medium');
    });
  });

  describe('fetchAndAssembleSessionProblems()', () => {
    it('should assemble session with review and new problems', async () => {
      // Arrange
      const sessionLength = 6;
      const numberOfNewProblems = 4;
      const currentAllowedTags = ['array', 'string'];
      const currentDifficultyCap = 'Medium';

      const mockAllProblems = [
        { id: 1, leetCodeID: 1, title: 'Two Sum', difficulty: 'Easy', tags: ['array'] },
        { id: 2, leetCodeID: 2, title: 'Add Two Numbers', difficulty: 'Medium', tags: ['linked-list'] }
      ];

      const mockReviewProblems = [
        { id: 3, leetCodeID: 3, title: 'Longest Substring', difficulty: 'Medium', tags: ['string'] }
      ];

      const mockNewProblems = [
        { id: 4, leetCodeID: 4, title: 'Container Water', difficulty: 'Medium', tags: ['array'] },
        { id: 5, leetCodeID: 5, title: 'Valid Palindrome', difficulty: 'Easy', tags: ['string'] }
      ];

      problems.fetchAllProblems.mockResolvedValue(mockAllProblems);
      problems.fetchAdditionalProblems.mockResolvedValue(mockNewProblems);
      ScheduleService.getDailyReviewSchedule.mockResolvedValue(mockReviewProblems);

      // Act
      const result = await ProblemService.fetchAndAssembleSessionProblems(
        sessionLength,
        numberOfNewProblems,
        currentAllowedTags,
        currentDifficultyCap
      );

      // Assert
      expect(problems.fetchAllProblems).toHaveBeenCalled();
      expect(ScheduleService.getDailyReviewSchedule).toHaveBeenCalledWith(2); // 40% of 6 = 2.4 -> floor(2.4) = 2
      expect(problems.fetchAdditionalProblems).toHaveBeenCalledWith(
        5, // 6 - 1 review problem = 5
        new Set([1, 2]) // excludeIds from mockAllProblems
      );
      
      expect(result).toHaveLength(3); // 1 review + 2 new problems (limited by sessionLength)
      expect(result[0]).toEqual(mockReviewProblems[0]); // First should be review problem
    });

    it('should handle empty review schedule', async () => {
      // Arrange
      const sessionLength = 4;
      const numberOfNewProblems = 4;
      const currentAllowedTags = ['array'];
      const currentDifficultyCap = 'Easy';

      const mockAllProblems = [
        { id: 1, leetCodeID: 1, title: 'Two Sum', difficulty: 'Easy', tags: ['array'] }
      ];

      const mockNewProblems = [
        { id: 2, leetCodeID: 2, title: 'Best Time to Buy Stock', difficulty: 'Easy', tags: ['array'] },
        { id: 3, leetCodeID: 3, title: 'Contains Duplicate', difficulty: 'Easy', tags: ['array'] }
      ];

      problems.fetchAllProblems.mockResolvedValue(mockAllProblems);
      problems.fetchAdditionalProblems.mockResolvedValue(mockNewProblems);
      ScheduleService.getDailyReviewSchedule.mockResolvedValue([]); // No review problems

      // Act
      const result = await ProblemService.fetchAndAssembleSessionProblems(
        sessionLength,
        numberOfNewProblems,
        currentAllowedTags,
        currentDifficultyCap
      );

      // Assert
      expect(ScheduleService.getDailyReviewSchedule).toHaveBeenCalledWith(1); // 40% of 4 = 1.6 -> floor(1.6) = 1
      expect(problems.fetchAdditionalProblems).toHaveBeenCalledWith(
        4, // 4 - 0 review problems = 4
        new Set([1])
      );
      expect(result).toEqual(mockNewProblems);
      expect(result).toHaveLength(2);
    });

    it('should use fallback when session is short', async () => {
      // Arrange
      const sessionLength = 5;
      const numberOfNewProblems = 3;
      const currentAllowedTags = ['array'];
      const currentDifficultyCap = 'Medium';

      const mockAllProblems = [
        { id: 1, leetCodeID: 1, title: 'Two Sum', difficulty: 'Easy', tags: ['array'] },
        { id: 2, leetCodeID: 2, title: 'Add Two Numbers', difficulty: 'Medium', tags: ['linked-list'] },
        { id: 3, leetCodeID: 3, title: 'Longest Substring', difficulty: 'Medium', tags: ['string'] }
      ];

      const mockReviewProblems = [
        { id: 4, leetCodeID: 4, title: 'Review Problem', difficulty: 'Easy', tags: ['array'] }
      ];

      const mockNewProblems = []; // No new problems available

      problems.fetchAllProblems.mockResolvedValue(mockAllProblems);
      problems.fetchAdditionalProblems.mockResolvedValue(mockNewProblems);
      ScheduleService.getDailyReviewSchedule.mockResolvedValue(mockReviewProblems);

      // Act
      const result = await ProblemService.fetchAndAssembleSessionProblems(
        sessionLength,
        numberOfNewProblems,
        currentAllowedTags,
        currentDifficultyCap
      );

      // Assert
      expect(result).toHaveLength(3); // 1 review + 2 fallback problems (from allProblems)
      expect(result[0]).toEqual(mockReviewProblems[0]);
      // Should include fallback problems from allProblems (excluding the review problem)
      expect(result.slice(1)).toHaveLength(2);
    });

    it('should limit final session to sessionLength', async () => {
      // Arrange
      const sessionLength = 3;
      const numberOfNewProblems = 2;
      const currentAllowedTags = ['array'];
      const currentDifficultyCap = 'Easy';

      const mockAllProblems = [];

      const mockReviewProblems = [
        { id: 1, leetCodeID: 1, title: 'Review 1', difficulty: 'Easy', tags: ['array'] },
        { id: 2, leetCodeID: 2, title: 'Review 2', difficulty: 'Easy', tags: ['array'] }
      ];

      const mockNewProblems = [
        { id: 3, leetCodeID: 3, title: 'New 1', difficulty: 'Easy', tags: ['array'] },
        { id: 4, leetCodeID: 4, title: 'New 2', difficulty: 'Easy', tags: ['array'] },
        { id: 5, leetCodeID: 5, title: 'New 3', difficulty: 'Easy', tags: ['array'] }
      ];

      problems.fetchAllProblems.mockResolvedValue(mockAllProblems);
      problems.fetchAdditionalProblems.mockResolvedValue(mockNewProblems);
      ScheduleService.getDailyReviewSchedule.mockResolvedValue(mockReviewProblems);

      // Act
      const result = await ProblemService.fetchAndAssembleSessionProblems(
        sessionLength,
        numberOfNewProblems,
        currentAllowedTags,
        currentDifficultyCap
      );

      // Assert
      expect(result).toHaveLength(sessionLength); // Should be limited to 3
      expect(result.slice(0, 2)).toEqual(mockReviewProblems); // First 2 are review problems
      expect(result[2]).toEqual(mockNewProblems[0]); // Third is first new problem
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const sessionLength = 5;
      const numberOfNewProblems = 3;
      const currentAllowedTags = ['array'];
      const currentDifficultyCap = 'Medium';

      const error = new Error('Database connection failed');
      problems.fetchAllProblems.mockRejectedValue(error);

      // Act & Assert
      await expect(
        ProblemService.fetchAndAssembleSessionProblems(
          sessionLength,
          numberOfNewProblems,
          currentAllowedTags,
          currentDifficultyCap
        )
      ).rejects.toThrow('Database connection failed');
    });
  });
});