import { SessionService } from '../sessionService';
import * as sessionDb from '../../db/sessions';
import * as tagMasteryDb from '../../db/tag_mastery';
import * as problemRelationships from '../../db/problem_relationships';

// Mock the database modules
jest.mock('../../db/sessions');
jest.mock('../../db/tag_mastery');
jest.mock('../../db/problem_relationships');
jest.mock('../problemService');
jest.mock('../storageService');

describe('SessionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkAndCompleteSession', () => {
    it('should return empty array when all problems are attempted', async () => {
      // Arrange
      const sessionId = 'test-session-123';
      const mockSession = {
        id: sessionId,
        status: 'in_progress',
        problems: [
          { id: 1, title: 'Problem 1' },
          { id: 2, title: 'Problem 2' },
          { id: 3, title: 'Problem 3' }
        ],
        attempts: [
          { problemId: 1 },
          { problemId: 2 },
          { problemId: 3 }
        ]
      };

      sessionDb.getSessionById.mockResolvedValue(mockSession);
      sessionDb.updateSessionInDB.mockResolvedValue();
      tagMasteryDb.calculateTagMastery.mockResolvedValue();
      problemRelationships.updateProblemRelationships.mockResolvedValue();

      // Act
      const result = await SessionService.checkAndCompleteSession(sessionId);

      // Assert
      expect(sessionDb.getSessionById).toHaveBeenCalledWith(sessionId);
      expect(sessionDb.updateSessionInDB).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed' })
      );
      expect(tagMasteryDb.calculateTagMastery).toHaveBeenCalled();
      expect(problemRelationships.updateProblemRelationships).toHaveBeenCalledWith(mockSession);
      expect(result).toEqual([]);
    });

    it('should return unattempted problems when not all problems are attempted', async () => {
      // Arrange
      const sessionId = 'test-session-456';
      const mockSession = {
        id: sessionId,
        status: 'in_progress',
        problems: [
          { id: 1, title: 'Problem 1' },
          { id: 2, title: 'Problem 2' },
          { id: 3, title: 'Problem 3' }
        ],
        attempts: [
          { problemId: 1 },
          { problemId: 3 }
        ]
      };

      sessionDb.getSessionById.mockResolvedValue(mockSession);

      // Act
      const result = await SessionService.checkAndCompleteSession(sessionId);

      // Assert
      expect(sessionDb.getSessionById).toHaveBeenCalledWith(sessionId);
      expect(sessionDb.updateSessionInDB).not.toHaveBeenCalled();
      expect(tagMasteryDb.calculateTagMastery).not.toHaveBeenCalled();
      expect(result).toEqual([{ id: 2, title: 'Problem 2' }]); // Problem 2 is not attempted
    });

    it('should return false when session not found', async () => {
      // Arrange
      const sessionId = 'non-existent-session';
      sessionDb.getSessionById.mockResolvedValue(null);

      // Act
      const result = await SessionService.checkAndCompleteSession(sessionId);

      // Assert
      expect(sessionDb.getSessionById).toHaveBeenCalledWith(sessionId);
      expect(result).toBe(false);
    });

    it('should return empty array for already completed session', async () => {
      // Arrange
      const sessionId = 'completed-session';
      const mockSession = {
        id: sessionId,
        status: 'completed',
        problems: [
          { id: 1, title: 'Problem 1' },
          { id: 2, title: 'Problem 2' }
        ],
        attempts: [
          { problemId: 1 },
          { problemId: 2 }
        ]
      };

      sessionDb.getSessionById.mockResolvedValue(mockSession);
      sessionDb.updateSessionInDB.mockResolvedValue();
      tagMasteryDb.calculateTagMastery.mockResolvedValue();
      problemRelationships.updateProblemRelationships.mockResolvedValue();

      // Act
      const result = await SessionService.checkAndCompleteSession(sessionId);

      // Assert
      expect(sessionDb.getSessionById).toHaveBeenCalledWith(sessionId);
      // Function will still process completion logic since all problems are attempted
      expect(result).toEqual([]);
    });
  });

  describe('resumeSession', () => {
    it('should resume an existing in-progress session with remaining problems', async () => {
      // Arrange
      const mockSession = {
        id: 'resume-session-123',
        status: 'in_progress',
        problems: [1, 2],
        attempts: [
          { problemId: 1 }
        ]
      };

      sessionDb.getLatestSession.mockResolvedValue(mockSession);
      sessionDb.saveSessionToStorage.mockResolvedValue();
      
      // Mock checkAndCompleteSession to return unattempted problems
      const mockCheckAndComplete = jest.spyOn(SessionService, 'checkAndCompleteSession')
        .mockResolvedValue([2]); // Problem 2 is not attempted

      // Act
      const result = await SessionService.resumeSession();

      // Assert
      expect(sessionDb.getLatestSession).toHaveBeenCalled();
      expect(mockCheckAndComplete).toHaveBeenCalledWith('resume-session-123');
      expect(sessionDb.saveSessionToStorage).toHaveBeenCalledWith(mockSession);
      expect(result).toEqual([2]);
    });

    it('should return null when no in-progress session exists', async () => {
      // Arrange
      sessionDb.getLatestSession.mockResolvedValue(null);

      // Act
      const result = await SessionService.resumeSession();

      // Assert
      expect(sessionDb.getLatestSession).toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should return null when session is completed', async () => {
      // Arrange
      const mockSession = {
        id: 'completed-session',
        status: 'completed',
        problems: [1, 2],
        attempts: [
          { problemId: 1 },
          { problemId: 2 }
        ]
      };

      sessionDb.getLatestSession.mockResolvedValue(mockSession);

      // Act
      const result = await SessionService.resumeSession();

      // Assert
      expect(sessionDb.getLatestSession).toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });
});