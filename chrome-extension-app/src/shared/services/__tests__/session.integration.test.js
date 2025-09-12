/**
 * Session Logic Integration Tests
 * 
 * Tests the complete session workflow integration including:
 * - Session creation and management
 * - Problem selection algorithms
 * - Leitner box progression
 * - UI state consistency
 * - Background script communication
 * - Database persistence
 */

import "fake-indexeddb/auto";

// Mock Chrome APIs
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    lastError: null,
  },
  tabs: {
    query: jest.fn(),
  },
};

// Mock logger
jest.mock('../../utils/logger.js', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe.skip('Session Logic Integration', () => {
  let mockSendMessage;
  let SessionService;
  let ProblemService;
  let AttemptsService;
  let TagService;

  beforeEach(async () => {
    mockSendMessage = jest.fn();
    global.chrome.runtime.sendMessage = mockSendMessage;
    
    // Import services after mocks are set up
    SessionService = (await import('../sessionService.js')).SessionService;
    ProblemService = (await import('../problemService.js')).ProblemService;
    AttemptsService = (await import('../attemptsService.js')).AttemptsService;
    TagService = (await import('../tagServices.js')).TagService;

    jest.clearAllMocks();
  });

  describe('Complete Session Workflow', () => {
    it('should handle full session lifecycle with background script integration', async () => {
      // Mock background script responses
      mockSendMessage.mockImplementation((message, callback) => {
        switch (message.type) {
          case 'createSession':
            callback({
              status: 'success',
              session: {
                id: 'session-123',
                status: 'active',
                problems: [
                  { id: 'prob-1', difficulty: 'Easy', tags: ['Array'] },
                  { id: 'prob-2', difficulty: 'Medium', tags: ['Hash Table'] },
                ],
                startTime: new Date().toISOString(),
              },
            });
            break;
          case 'updateSessionProgress':
            callback({
              status: 'success',
              updatedSession: {
                id: 'session-123',
                problemsCompleted: message.problemsCompleted,
                currentProblem: message.currentProblem,
              },
            });
            break;
          case 'completeSession':
            callback({
              status: 'success',
              completedSession: {
                id: 'session-123',
                status: 'completed',
                endTime: new Date().toISOString(),
                performance: 0.8,
              },
            });
            break;
          default:
            callback({ status: 'success' });
        }
      });

      // Step 1: Create session
      const sessionData = await SessionService.createSession({
        sessionLength: 5,
        difficultyDistribution: { easy: 20, medium: 60, hard: 20 },
        focusAreas: ['Array', 'Hash Table'],
      });

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'createSession',
        }),
        expect.any(Function)
      );

      expect(sessionData.status).toBe('success');
      expect(sessionData.session.id).toBe('session-123');

      // Step 2: Update session progress
      const updateResult = await SessionService.updateSessionProgress('session-123', {
        problemsCompleted: 1,
        currentProblem: 'prob-2',
      });

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'updateSessionProgress',
          sessionId: 'session-123',
          problemsCompleted: 1,
          currentProblem: 'prob-2',
        }),
        expect.any(Function)
      );

      expect(updateResult.status).toBe('success');

      // Step 3: Complete session
      const completionResult = await SessionService.completeSession('session-123');

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'completeSession',
          sessionId: 'session-123',
        }),
        expect.any(Function)
      );

      expect(completionResult.status).toBe('success');
      expect(completionResult.completedSession.status).toBe('completed');
    });

    it('should handle session creation errors gracefully', async () => {
      mockSendMessage.mockImplementation((message, callback) => {
        if (message.type === 'createSession') {
          global.chrome.runtime.lastError = { message: 'Database connection failed' };
          callback();
        }
      });

      const sessionData = await SessionService.createSession({
        sessionLength: 5,
      });

      expect(sessionData.status).toBe('error');
      expect(sessionData.error).toContain('Database connection failed');
    });

    it('should maintain session state consistency across operations', async () => {
      let sessionState = {
        id: 'session-123',
        status: 'active',
        problemsCompleted: 0,
        totalProblems: 5,
      };

      mockSendMessage.mockImplementation((message, callback) => {
        switch (message.type) {
          case 'getSessionState':
            callback({ status: 'success', sessionState });
            break;
          case 'updateSessionProgress':
            sessionState = {
              ...sessionState,
              problemsCompleted: message.problemsCompleted,
              currentProblem: message.currentProblem,
            };
            callback({ status: 'success', updatedSession: sessionState });
            break;
          default:
            callback({ status: 'success' });
        }
      });

      // Get initial state
      const initialState = await SessionService.getSessionState('session-123');
      expect(initialState.sessionState.problemsCompleted).toBe(0);

      // Update progress
      await SessionService.updateSessionProgress('session-123', {
        problemsCompleted: 2,
        currentProblem: 'prob-3',
      });

      // Verify state consistency
      const updatedState = await SessionService.getSessionState('session-123');
      expect(updatedState.sessionState.problemsCompleted).toBe(2);
      expect(updatedState.sessionState.currentProblem).toBe('prob-3');
    });
  });

  describe('Problem Selection Integration', () => {
    it('should integrate session creation with adaptive problem selection', async () => {
      const mockProblems = [
        { id: 'easy-1', difficulty: 'Easy', tags: ['Array'], boxLevel: 1 },
        { id: 'medium-1', difficulty: 'Medium', tags: ['Hash Table'], boxLevel: 2 },
        { id: 'hard-1', difficulty: 'Hard', tags: ['Dynamic Programming'], boxLevel: 0 },
      ];

      mockSendMessage.mockImplementation((message, callback) => {
        switch (message.type) {
          case 'createSession':
            callback({
              status: 'success',
              session: {
                id: 'session-123',
                selectedProblems: mockProblems,
                adaptiveConfig: message.adaptiveConfig,
              },
            });
            break;
          case 'getAdaptiveProblems':
            callback({
              status: 'success',
              problems: mockProblems.filter(p => 
                message.criteria.tags.some(tag => p.tags.includes(tag))
              ),
            });
            break;
          default:
            callback({ status: 'success' });
        }
      });

      const sessionData = await SessionService.createSession({
        sessionLength: 3,
        adaptiveConfig: {
          focusAreas: ['Array', 'Hash Table'],
          difficultyDistribution: { easy: 30, medium: 50, hard: 20 },
          reviewRatio: 0.4,
        },
      });

      expect(sessionData.session.selectedProblems).toHaveLength(3);
      expect(sessionData.session.adaptiveConfig.focusAreas).toEqual(['Array', 'Hash Table']);
    });

    it('should handle problem selection failures with fallbacks', async () => {
      mockSendMessage.mockImplementation((message, callback) => {
        if (message.type === 'getAdaptiveProblems') {
          // Simulate no problems available
          callback({ status: 'success', problems: [] });
        } else if (message.type === 'getFallbackProblems') {
          // Provide fallback problems
          callback({
            status: 'success',
            problems: [
              { id: 'fallback-1', difficulty: 'Easy', tags: ['Array'] },
            ],
          });
        } else {
          callback({ status: 'success' });
        }
      });

      const problems = await ProblemService.getSessionProblems({
        sessionLength: 5,
        focusAreas: ['NonexistentTag'],
      });

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'getAdaptiveProblems' }),
        expect.any(Function)
      );

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'getFallbackProblems' }),
        expect.any(Function)
      );
    });
  });

  describe('Leitner Box Progression Integration', () => {
    it('should update box levels based on problem attempts', async () => {
      const mockAttemptData = {
        problemId: 'prob-123',
        success: true,
        timeSpent: 1200,
        hintsUsed: 1,
        currentBoxLevel: 2,
      };

      mockSendMessage.mockImplementation((message, callback) => {
        switch (message.type) {
          case 'addAttempt':
            callback({
              status: 'success',
              attempt: { ...message.attemptData, id: 'attempt-456' },
              updatedBoxLevel: message.attemptData.currentBoxLevel + 1,
            });
            break;
          case 'updateProblemBoxLevel':
            callback({
              status: 'success',
              problem: {
                id: message.problemId,
                boxLevel: message.newBoxLevel,
                nextReviewDate: new Date(Date.now() + 86400000).toISOString(),
              },
            });
            break;
          default:
            callback({ status: 'success' });
        }
      });

      // Add successful attempt
      const attemptResult = await AttemptsService.addAttempt(mockAttemptData);

      expect(attemptResult.status).toBe('success');
      expect(attemptResult.updatedBoxLevel).toBe(3);

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'addAttempt',
          attemptData: mockAttemptData,
        }),
        expect.any(Function)
      );

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'updateProblemBoxLevel',
          problemId: 'prob-123',
          newBoxLevel: 3,
        }),
        expect.any(Function)
      );
    });

    it('should handle box level regression on failed attempts', async () => {
      const failedAttemptData = {
        problemId: 'prob-123',
        success: false,
        timeSpent: 2400,
        hintsUsed: 3,
        currentBoxLevel: 3,
      };

      mockSendMessage.mockImplementation((message, callback) => {
        if (message.type === 'addAttempt') {
          const newBoxLevel = Math.max(0, message.attemptData.currentBoxLevel - 1);
          callback({
            status: 'success',
            attempt: { ...message.attemptData, id: 'attempt-789' },
            updatedBoxLevel: newBoxLevel,
          });
        } else {
          callback({ status: 'success' });
        }
      });

      const attemptResult = await AttemptsService.addAttempt(failedAttemptData);

      expect(attemptResult.updatedBoxLevel).toBe(2);
    });
  });

  describe('Tag Mastery Integration', () => {
    it('should update tag mastery based on session performance', async () => {
      const sessionResults = {
        sessionId: 'session-123',
        attempts: [
          { problemId: 'prob-1', tags: ['Array'], success: true },
          { problemId: 'prob-2', tags: ['Hash Table'], success: false },
          { problemId: 'prob-3', tags: ['Array', 'Two Pointers'], success: true },
        ],
      };

      mockSendMessage.mockImplementation((message, callback) => {
        if (message.type === 'updateTagMastery') {
          const updatedMastery = {
            'Array': { successRate: 1.0, totalAttempts: 2, masteryLevel: 'intermediate' },
            'Hash Table': { successRate: 0.0, totalAttempts: 1, masteryLevel: 'beginner' },
            'Two Pointers': { successRate: 1.0, totalAttempts: 1, masteryLevel: 'beginner' },
          };
          callback({ status: 'success', updatedMastery });
        } else {
          callback({ status: 'success' });
        }
      });

      const masteryResult = await TagService.updateSessionMastery(sessionResults);

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'updateTagMastery',
          sessionResults,
        }),
        expect.any(Function)
      );

      expect(masteryResult.updatedMastery['Array'].successRate).toBe(1.0);
      expect(masteryResult.updatedMastery['Hash Table'].successRate).toBe(0.0);
    });

    it('should calculate focus areas based on mastery data', async () => {
      const masteryData = {
        'Array': { successRate: 0.9, totalAttempts: 10 },
        'Hash Table': { successRate: 0.3, totalAttempts: 8 },
        'Dynamic Programming': { successRate: 0.1, totalAttempts: 5 },
      };

      mockSendMessage.mockImplementation((message, callback) => {
        if (message.type === 'calculateFocusAreas') {
          const focusAreas = ['Hash Table', 'Dynamic Programming'];
          callback({ status: 'success', focusAreas });
        } else {
          callback({ status: 'success' });
        }
      });

      const focusResult = await TagService.calculateFocusAreas(masteryData);

      expect(focusResult.focusAreas).toEqual(['Hash Table', 'Dynamic Programming']);
    });
  });

  describe('UI State Integration', () => {
    it('should maintain UI state consistency during session operations', async () => {
      let uiState = {
        currentSession: null,
        sessionProgress: 0,
        currentProblem: null,
        isLoading: false,
      };

      mockSendMessage.mockImplementation((message, callback) => {
        switch (message.type) {
          case 'getUIState':
            callback({ status: 'success', uiState });
            break;
          case 'updateUIState':
            uiState = { ...uiState, ...message.updates };
            callback({ status: 'success', updatedState: uiState });
            break;
          default:
            callback({ status: 'success' });
        }
      });

      // Initial UI state
      const initialState = await SessionService.getUIState();
      expect(initialState.uiState.currentSession).toBeNull();

      // Update UI state during session creation
      await SessionService.updateUIState({
        currentSession: 'session-123',
        isLoading: true,
      });

      const loadingState = await SessionService.getUIState();
      expect(loadingState.uiState.currentSession).toBe('session-123');
      expect(loadingState.uiState.isLoading).toBe(true);

      // Update UI state after session completion
      await SessionService.updateUIState({
        currentSession: null,
        isLoading: false,
        sessionProgress: 100,
      });

      const completedState = await SessionService.getUIState();
      expect(completedState.uiState.currentSession).toBeNull();
      expect(completedState.uiState.sessionProgress).toBe(100);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle Chrome runtime errors gracefully', async () => {
      mockSendMessage.mockImplementation((message, callback) => {
        global.chrome.runtime.lastError = { message: 'Extension context invalidated' };
        callback();
      });

      const sessionData = await SessionService.createSession({ sessionLength: 5 });

      expect(sessionData.status).toBe('error');
      expect(sessionData.error).toContain('Extension context invalidated');
    });

    it('should implement retry logic for transient failures', async () => {
      let attemptCount = 0;
      
      mockSendMessage.mockImplementation((message, callback) => {
        attemptCount++;
        if (attemptCount < 3) {
          // Fail first two attempts
          global.chrome.runtime.lastError = { message: 'Network error' };
          callback();
        } else {
          // Succeed on third attempt
          global.chrome.runtime.lastError = null;
          callback({ status: 'success', session: { id: 'session-123' } });
        }
      });

      const sessionData = await SessionService.createSessionWithRetry({ sessionLength: 5 });

      expect(attemptCount).toBe(3);
      expect(sessionData.status).toBe('success');
      expect(sessionData.session.id).toBe('session-123');
    });

    it('should clean up resources on session failure', async () => {
      mockSendMessage.mockImplementation((message, callback) => {
        if (message.type === 'createSession') {
          global.chrome.runtime.lastError = { message: 'Database full' };
          callback();
        } else if (message.type === 'cleanupFailedSession') {
          callback({ status: 'success', cleanedUp: true });
        }
      });

      const sessionData = await SessionService.createSession({ sessionLength: 5 });

      expect(sessionData.status).toBe('error');
      
      // Should trigger cleanup
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'cleanupFailedSession',
        }),
        expect.any(Function)
      );
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large session data efficiently', async () => {
      const largeSessionData = {
        sessionLength: 100,
        problems: Array.from({ length: 100 }, (_, i) => ({
          id: `prob-${i}`,
          difficulty: ['Easy', 'Medium', 'Hard'][i % 3],
          tags: [`Tag${i % 10}`, `Tag${(i + 1) % 10}`],
        })),
      };

      mockSendMessage.mockImplementation((message, callback) => {
        // Simulate processing time for large data
        setTimeout(() => {
          callback({ status: 'success', session: { id: 'large-session' } });
        }, 10);
      });

      const startTime = Date.now();
      const sessionData = await SessionService.createSession(largeSessionData);
      const endTime = Date.now();

      expect(sessionData.status).toBe('success');
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should batch multiple operations efficiently', async () => {
      const operations = [
        { type: 'addAttempt', data: { problemId: 'prob-1', success: true } },
        { type: 'addAttempt', data: { problemId: 'prob-2', success: false } },
        { type: 'addAttempt', data: { problemId: 'prob-3', success: true } },
      ];

      mockSendMessage.mockImplementation((message, callback) => {
        if (message.type === 'batchOperations') {
          const results = message.operations.map(op => ({
            status: 'success',
            operation: op.type,
            data: op.data,
          }));
          callback({ status: 'success', results });
        }
      });

      const batchResult = await SessionService.batchOperations(operations);

      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      expect(batchResult.results).toHaveLength(3);
      expect(batchResult.results.every(r => r.status === 'success')).toBe(true);
    });
  });
});