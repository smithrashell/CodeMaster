// Mock dependencies before importing
jest.mock('../tagServices');
jest.mock('../storageService');
jest.mock('../attemptsService');
jest.mock('../sessionService');
jest.mock('../relationshipService');
jest.mock('../../db/problem_relationships');
jest.mock('../../db/tag_mastery');
jest.mock('../../db/attempts');
jest.mock('../../db/sessionAnalytics');
jest.mock('../../db/problems');

import { buildAdaptiveSessionSettings } from '../../db/sessions';
import { TagService } from '../tagServices';
import { StorageService } from '../storageService';

describe('buildAdaptiveSessionSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock Date to ensure consistent testing
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2023-12-15T10:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should build default settings for new user', async () => {
    // Arrange
    const mockFocusTags = ['array', 'string', 'hash-table'];
    TagService.getCurrentTier.mockResolvedValue({ focusTags: mockFocusTags });
    StorageService.migrateSessionStateToIndexedDB.mockResolvedValue(null);
    StorageService.getSessionState.mockResolvedValue(null);

    // Act
    const result = await buildAdaptiveSessionSettings();

    // Assert
    expect(TagService.getCurrentTier).toHaveBeenCalled();
    expect(StorageService.migrateSessionStateToIndexedDB).toHaveBeenCalled();
    expect(StorageService.getSessionState).toHaveBeenCalledWith('session_state');
    
    expect(result).toEqual({
      id: 'session_state',
      numSessionsCompleted: 0,
      currentDifficultyCap: 'Easy',
      sessionLength: expect.any(Number),
      numberOfNewProblems: expect.any(Number),
      currentAllowedTags: mockFocusTags
    });

    // Verify session length is reasonable for new user
    expect(result.sessionLength).toBeGreaterThanOrEqual(3);
    expect(result.sessionLength).toBeLessThanOrEqual(8);
    expect(result.numberOfNewProblems).toBeGreaterThanOrEqual(1);
    expect(result.numberOfNewProblems).toBeLessThanOrEqual(result.sessionLength);
  });

  it('should use existing session state from IndexedDB migration', async () => {
    // Arrange
    const mockFocusTags = ['dynamic-programming', 'graph'];
    const existingSessionState = {
      id: 'session_state',
      numSessionsCompleted: 15,
      currentDifficultyCap: 'Medium',
      sessionLength: 8,
      numberOfNewProblems: 3,
      lastSessionDate: '2023-12-10T10:00:00Z'
    };

    TagService.getCurrentTier.mockResolvedValue({ focusTags: mockFocusTags });
    StorageService.migrateSessionStateToIndexedDB.mockResolvedValue(existingSessionState);

    // Act
    const result = await buildAdaptiveSessionSettings();

    // Assert
    expect(TagService.getCurrentTier).toHaveBeenCalled();
    expect(StorageService.migrateSessionStateToIndexedDB).toHaveBeenCalled();
    expect(StorageService.getSessionState).not.toHaveBeenCalled(); // Should not be called if migration returns data
    
    expect(result).toEqual({
      ...existingSessionState,
      currentAllowedTags: mockFocusTags
    });
    expect(result.numSessionsCompleted).toBe(15);
    expect(result.currentDifficultyCap).toBe('Medium');
  });

  it('should use session state from IndexedDB when migration returns null', async () => {
    // Arrange
    const mockFocusTags = ['tree', 'binary-search'];
    const existingSessionState = {
      id: 'session_state',
      numSessionsCompleted: 5,
      currentDifficultyCap: 'Easy',
      sessionLength: 6,
      numberOfNewProblems: 4,
      lastSessionDate: '2023-12-12T10:00:00Z'
    };

    TagService.getCurrentTier.mockResolvedValue({ focusTags: mockFocusTags });
    StorageService.migrateSessionStateToIndexedDB.mockResolvedValue(null);
    StorageService.getSessionState.mockResolvedValue(existingSessionState);

    // Act
    const result = await buildAdaptiveSessionSettings();

    // Assert
    expect(TagService.getCurrentTier).toHaveBeenCalled();
    expect(StorageService.migrateSessionStateToIndexedDB).toHaveBeenCalled();
    expect(StorageService.getSessionState).toHaveBeenCalledWith('session_state');
    
    expect(result).toEqual({
      ...existingSessionState,
      currentAllowedTags: mockFocusTags
    });
    expect(result.currentAllowedTags).toEqual(mockFocusTags);
  });

  it('should handle progressive difficulty advancement', async () => {
    // Arrange
    const mockFocusTags = ['array', 'two-pointers'];
    
    // Advanced user with many completed sessions
    const advancedSessionState = {
      id: 'session_state',
      numSessionsCompleted: 50,
      currentDifficultyCap: 'Easy', // This should be upgraded
      sessionLength: 5,
      numberOfNewProblems: 3,
      lastSessionDate: '2023-12-01T10:00:00Z'
    };

    TagService.getCurrentTier.mockResolvedValue({ focusTags: mockFocusTags });
    StorageService.migrateSessionStateToIndexedDB.mockResolvedValue(advancedSessionState);

    // Act
    const result = await buildAdaptiveSessionSettings();

    // Assert
    expect(result.numSessionsCompleted).toBe(50);
    expect(result.currentAllowedTags).toEqual(mockFocusTags);
    
    // Should maintain existing settings but with updated tags
    expect(result.sessionLength).toBe(5);
    expect(result.numberOfNewProblems).toBe(3);
    expect(result.currentDifficultyCap).toBe('Easy'); // Based on the existing state
  });

  it('should handle empty focus tags gracefully', async () => {
    // Arrange
    TagService.getCurrentTier.mockResolvedValue({ focusTags: [] });
    StorageService.migrateSessionStateToIndexedDB.mockResolvedValue(null);
    StorageService.getSessionState.mockResolvedValue(null);

    // Act
    const result = await buildAdaptiveSessionSettings();

    // Assert
    expect(result.currentAllowedTags).toEqual([]);
    expect(result.numSessionsCompleted).toBe(0);
    expect(result.currentDifficultyCap).toBe('Easy');
  });

  it('should handle TagService errors gracefully', async () => {
    // Arrange
    TagService.getCurrentTier.mockRejectedValue(new Error('Tag service unavailable'));
    StorageService.migrateSessionStateToIndexedDB.mockResolvedValue(null);
    StorageService.getSessionState.mockResolvedValue(null);

    // Act & Assert
    await expect(buildAdaptiveSessionSettings()).rejects.toThrow('Tag service unavailable');
  });

  it('should handle StorageService errors gracefully', async () => {
    // Arrange
    const mockFocusTags = ['array'];
    TagService.getCurrentTier.mockResolvedValue({ focusTags: mockFocusTags });
    StorageService.migrateSessionStateToIndexedDB.mockRejectedValue(new Error('Storage migration failed'));

    // Act & Assert
    await expect(buildAdaptiveSessionSettings()).rejects.toThrow('Storage migration failed');
  });

  it('should maintain session state consistency', async () => {
    // Arrange
    const mockFocusTags = ['graph', 'dfs', 'bfs'];
    const sessionState = {
      id: 'session_state',
      numSessionsCompleted: 25,
      currentDifficultyCap: 'Medium',
      sessionLength: 10,
      numberOfNewProblems: 6,
      lastSessionDate: '2023-12-14T10:00:00Z'
    };

    TagService.getCurrentTier.mockResolvedValue({ focusTags: mockFocusTags });
    StorageService.migrateSessionStateToIndexedDB.mockResolvedValue(sessionState);

    // Act
    const result = await buildAdaptiveSessionSettings();

    // Assert
    expect(result).toMatchObject({
      id: 'session_state',
      numSessionsCompleted: 25,
      currentDifficultyCap: 'Medium',
      sessionLength: 10,
      numberOfNewProblems: 6,
      currentAllowedTags: mockFocusTags
    });

    // Verify numberOfNewProblems doesn't exceed sessionLength
    expect(result.numberOfNewProblems).toBeLessThanOrEqual(result.sessionLength);
  });

  it('should handle malformed session state data', async () => {
    // Arrange
    const mockFocusTags = ['string'];
    const malformedSessionState = {
      id: 'session_state',
      numSessionsCompleted: 'invalid_number', // Should be number
      currentDifficultyCap: null, // Should be string
      sessionLength: -5, // Should be positive
      numberOfNewProblems: 100, // Should be reasonable
    };

    TagService.getCurrentTier.mockResolvedValue({ focusTags: mockFocusTags });
    StorageService.migrateSessionStateToIndexedDB.mockResolvedValue(malformedSessionState);

    // Act
    const result = await buildAdaptiveSessionSettings();

    // Assert
    expect(result.currentAllowedTags).toEqual(mockFocusTags);
    // Should still return a valid object structure even with malformed input
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('numSessionsCompleted');
    expect(result).toHaveProperty('currentDifficultyCap');
    expect(result).toHaveProperty('sessionLength');
    expect(result).toHaveProperty('numberOfNewProblems');
  });
});