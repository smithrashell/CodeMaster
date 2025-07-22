/**
 * Unit tests for SessionService.summarizeSessionPerformance function
 * Tests the comprehensive session performance analysis and tracking system
 */

// Mock all dependencies before importing to prevent circular dependency issues
jest.mock('../../db/sessions');
jest.mock('../../db/tag_mastery');
jest.mock('../../db/problem_relationships');
jest.mock('../../db/sessionAnalytics');
jest.mock('../../db/problems');
jest.mock('../../db/attempts');
jest.mock('../attemptsService');
jest.mock('../storageService');
jest.mock('../scheduleService');
jest.mock('../tagServices');
jest.mock('../problemService');
jest.mock('../relationshipService');

import { SessionService } from '../sessionService';
import * as sessions from '../../db/sessions';
import * as tagMastery from '../../db/tag_mastery';
import * as problemRelationships from '../../db/problem_relationships';
import * as sessionAnalytics from '../../db/sessionAnalytics';
import { MockDataFactories } from './mockDataFactories';

describe('SessionService.summarizeSessionPerformance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock console methods to avoid noise in tests
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock Chrome API if it exists
    if (typeof global.chrome !== 'undefined') {
      global.chrome.storage.local.get = jest.fn((keys, callback) => {
        callback({ sessionAnalytics: [] });
      });
      global.chrome.storage.local.set = jest.fn();
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('comprehensive session analysis', () => {
    it('should orchestrate full performance analysis workflow', async () => {
      // Arrange
      const mockSession = MockDataFactories.createCompletedSessionWithData({
        problemCount: 3
      });

      const mockPreTagMastery = [
        { tag: 'array', mastered: false, totalAttempts: 5, decayScore: 1.0 },
        { tag: 'string', mastered: true, totalAttempts: 10, decayScore: 0.95 }
      ];

      const mockPostTagMastery = [
        { tag: 'array', mastered: true, totalAttempts: 8, decayScore: 1.0 },
        { tag: 'string', mastered: true, totalAttempts: 13, decayScore: 0.98 },
        { tag: 'hash-table', mastered: false, totalAttempts: 2, decayScore: 1.0 }
      ];

      const mockPerformanceMetrics = {
        accuracy: 0.75,
        avgTime: 420,
        strongTags: ['array', 'string'],
        weakTags: ['hash-table'],
        timingFeedback: { efficient: ['array'], slow: ['hash-table'] },
        Easy: { attempts: 2, correct: 2, time: 600, avgTime: 300 },
        Medium: { attempts: 1, correct: 0, time: 840, avgTime: 840 },
        Hard: { attempts: 0, correct: 0, time: 0, avgTime: 0 }
      };

      // Mock all database calls
      tagMastery.getTagMastery
        .mockResolvedValueOnce(mockPreTagMastery)  // pre-session state
        .mockResolvedValueOnce(mockPostTagMastery); // post-session state
      
      problemRelationships.updateProblemRelationships.mockResolvedValue();
      tagMastery.calculateTagMastery.mockResolvedValue();
      sessions.getSessionPerformance.mockResolvedValue(mockPerformanceMetrics);
      sessionAnalytics.storeSessionAnalytics.mockResolvedValue();

      // Act
      const result = await SessionService.summarizeSessionPerformance(mockSession);

      // Assert workflow execution
      expect(tagMastery.getTagMastery).toHaveBeenCalledTimes(2);
      expect(problemRelationships.updateProblemRelationships).toHaveBeenCalledWith(mockSession);
      expect(tagMastery.calculateTagMastery).toHaveBeenCalled();
      expect(sessions.getSessionPerformance).toHaveBeenCalledWith({
        recentSessionsLimit: 1,
        unmasteredTags: ['hash-table']
      });
      expect(sessionAnalytics.storeSessionAnalytics).toHaveBeenCalledWith(result);

      // Assert result structure
      expect(result).toMatchObject({
        sessionId: mockSession.id,
        completedAt: expect.any(String),
        performance: mockPerformanceMetrics,
        masteryProgression: {
          deltas: expect.any(Array),
          newMasteries: expect.any(Number),
          decayedMasteries: expect.any(Number)
        },
        difficultyAnalysis: {
          counts: expect.any(Object),
          percentages: expect.any(Object),
          totalProblems: mockSession.problems.length,
          predominantDifficulty: expect.any(String)
        },
        insights: expect.any(Object)
      });
    });

    it('should handle errors gracefully and re-throw', async () => {
      // Arrange
      const mockSession = MockDataFactories.createMockSession();
      const error = new Error('Database connection failed');
      
      tagMastery.getTagMastery.mockRejectedValue(error);

      // Act & Assert
      await expect(SessionService.summarizeSessionPerformance(mockSession))
        .rejects.toThrow('Database connection failed');
        
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(`❌ Error summarizing session performance for ${mockSession.id}`),
        error
      );
    });
  });

  describe('calculateMasteryDeltas', () => {
    it('should calculate deltas for new tags', () => {
      // Arrange
      const preSessionMap = new Map([
        ['array', { mastered: false, totalAttempts: 5, decayScore: 1.0 }]
      ]);
      
      const postSessionMap = new Map([
        ['array', { mastered: true, totalAttempts: 8, decayScore: 1.0 }],
        ['string', { mastered: false, totalAttempts: 3, decayScore: 1.0 }] // New tag
      ]);

      // Act
      const deltas = SessionService.calculateMasteryDeltas(preSessionMap, postSessionMap);

      // Assert
      expect(deltas).toHaveLength(2);
      
      // Check existing tag delta
      const arrayDelta = deltas.find(d => d.tag === 'array');
      expect(arrayDelta).toMatchObject({
        tag: 'array',
        type: 'updated',
        preMastered: false,
        postMastered: true,
        masteredChanged: true,
        strengthDelta: 3,
        decayDelta: 0
      });

      // Check new tag delta
      const stringDelta = deltas.find(d => d.tag === 'string');
      expect(stringDelta).toMatchObject({
        tag: 'string',
        type: 'new',
        preMastered: false,
        postMastered: false,
        masteredChanged: false,
        strengthDelta: 3,
        decayDelta: 0
      });
    });

    it('should calculate deltas for mastery level changes', () => {
      // Arrange
      const preSessionMap = new Map([
        ['dynamic-programming', { mastered: true, totalAttempts: 15, decayScore: 0.8 }]
      ]);
      
      const postSessionMap = new Map([
        ['dynamic-programming', { mastered: false, totalAttempts: 16, decayScore: 0.6 }] // Decayed mastery
      ]);

      // Act
      const deltas = SessionService.calculateMasteryDeltas(preSessionMap, postSessionMap);

      // Assert
      expect(deltas).toHaveLength(1);
      expect(deltas[0]).toMatchObject({
        tag: 'dynamic-programming',
        type: 'updated',
        preMastered: true,
        postMastered: false,
        masteredChanged: true,
        strengthDelta: 1,
        decayDelta: -0.2
      });
    });

    it('should filter out unchanged tags with no activity', () => {
      // Arrange
      const preSessionMap = new Map([
        ['array', { mastered: false, totalAttempts: 5, decayScore: 1.0 }],
        ['string', { mastered: true, totalAttempts: 10, decayScore: 0.95 }]
      ]);
      
      const postSessionMap = new Map([
        ['array', { mastered: false, totalAttempts: 5, decayScore: 1.0 }], // No change
        ['string', { mastered: true, totalAttempts: 12, decayScore: 0.95 }] // Activity but no mastery change
      ]);

      // Act
      const deltas = SessionService.calculateMasteryDeltas(preSessionMap, postSessionMap);

      // Assert - Only tags with activity (strengthDelta > 0) or mastery changes should be included
      expect(deltas).toHaveLength(1);
      expect(deltas[0].tag).toBe('string');
      expect(deltas[0].strengthDelta).toBe(2);
    });
  });

  describe('analyzeSessionDifficulty', () => {
    it('should analyze difficulty distribution correctly', () => {
      // Arrange
      const mockSession = {
        problems: [
          { difficulty: 'Easy' },
          { difficulty: 'Easy' },
          { Rating: 'Medium' }, // Test Rating field alternative
          { difficulty: 'Hard' },
          { difficulty: 'Easy' }
        ]
      };

      // Act
      const analysis = SessionService.analyzeSessionDifficulty(mockSession);

      // Assert
      expect(analysis).toEqual({
        counts: { Easy: 3, Medium: 1, Hard: 1 },
        percentages: { Easy: 60, Medium: 20, Hard: 20 },
        totalProblems: 5,
        predominantDifficulty: 'Easy'
      });
    });

    it('should handle empty session', () => {
      // Arrange
      const emptySession = { problems: [] };

      // Act
      const analysis = SessionService.analyzeSessionDifficulty(emptySession);

      // Assert
      expect(analysis).toEqual({
        counts: { Easy: 0, Medium: 0, Hard: 0 },
        percentages: { Easy: 0, Medium: 0, Hard: 0 },
        totalProblems: 0,
        predominantDifficulty: 'Easy' // Default fallback
      });
    });

    it('should default unknown difficulties to Medium', () => {
      // Arrange
      const mockSession = {
        problems: [
          { difficulty: 'Unknown' },
          { difficulty: null },
          {} // No difficulty field
        ]
      };

      // Act
      const analysis = SessionService.analyzeSessionDifficulty(mockSession);

      // Assert
      expect(analysis).toEqual({
        counts: { Easy: 0, Medium: 3, Hard: 0 }, // All default to Medium
        percentages: { Easy: 0, Medium: 100, Hard: 0 },
        totalProblems: 3,
        predominantDifficulty: 'Medium'
      });
    });
  });

  describe('generateSessionInsights', () => {
    it('should generate comprehensive insights based on performance', () => {
      // Arrange
      const mockPerformance = {
        accuracy: 0.4, // Low accuracy
        avgTime: 900,
        strongTags: ['array'],
        weakTags: ['dynamic-programming', 'graph', 'tree', 'backtracking'] // > 3 weak tags
      };

      const mockMasteryDeltas = [
        { tag: 'array', masteredChanged: true, postMastered: true }, // New mastery
        { tag: 'string', masteredChanged: false, postMastered: false }
      ];

      const mockDifficultyMix = {
        predominantDifficulty: 'Medium'
      };

      // Act
      const insights = SessionService.generateSessionInsights(
        mockPerformance, 
        mockMasteryDeltas, 
        mockDifficultyMix
      );

      // Assert structure
      expect(insights).toHaveProperty('accuracy');
      expect(insights).toHaveProperty('efficiency');
      expect(insights).toHaveProperty('mastery');
      expect(insights).toHaveProperty('nextActions');
      expect(insights.nextActions).toBeInstanceOf(Array);

      // Should suggest focusing on fundamentals for low accuracy
      expect(insights.nextActions).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Focus on review problems')
        ])
      );

      // Should suggest prioritizing weak tags
      expect(insights.nextActions).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Prioritize improvement in: dynamic-programming, graph, tree')
        ])
      );

      // Should congratulate on progress
      expect(insights.nextActions).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Great progress!')
        ])
      );
    });
  });

  describe('insight helper methods', () => {
    describe('getAccuracyInsight', () => {
      it('should provide accurate feedback based on accuracy levels', () => {
        expect(SessionService.getAccuracyInsight(0.95)).toContain('Excellent accuracy');
        expect(SessionService.getAccuracyInsight(0.8)).toContain('Good accuracy');
        expect(SessionService.getAccuracyInsight(0.6)).toContain('Accuracy needs improvement');
        expect(SessionService.getAccuracyInsight(0.3)).toContain('Consider reviewing concepts');
      });
    });

    describe('getEfficiencyInsight', () => {
      it('should provide timing feedback based on difficulty', () => {
        const easyDifficultyMix = { predominantDifficulty: 'Easy' };
        const mediumDifficultyMix = { predominantDifficulty: 'Medium' };
        
        // Very efficient (< 80% of expected)
        expect(SessionService.getEfficiencyInsight(500, easyDifficultyMix))
          .toContain('Very efficient');
          
        // Good pacing (< 120% of expected)
        expect(SessionService.getEfficiencyInsight(800, easyDifficultyMix))
          .toContain('Good pacing');
          
        // Slow but acceptable (< 150% of expected)  
        expect(SessionService.getEfficiencyInsight(1500, mediumDifficultyMix))
          .toContain('Taking a bit longer');
          
        // Very slow (> 150% of expected)
        expect(SessionService.getEfficiencyInsight(2500, mediumDifficultyMix))
          .toContain('Focus on time management');
      });
    });

    describe('getMasteryInsight', () => {
      it('should provide mastery progression feedback', () => {
        // New masteries achieved
        const newMasteries = [
          { masteredChanged: true, postMastered: true },
          { masteredChanged: true, postMastered: true }
        ];
        expect(SessionService.getMasteryInsight(newMasteries))
          .toContain('Excellent! Mastered 2 new tag(s)');

        // Net positive with some decay
        const netPositive = [
          { masteredChanged: true, postMastered: true },
          { masteredChanged: true, postMastered: false }
        ];
        expect(SessionService.getMasteryInsight(netPositive))
          .toContain('Net positive progress');

        // Some decay
        const someDecay = [
          { masteredChanged: true, postMastered: false }
        ];
        expect(SessionService.getMasteryInsight(someDecay))
          .toContain('Some tags need review');

        // No changes
        const noChanges = [];
        expect(SessionService.getMasteryInsight(noChanges))
          .toContain('Maintained current mastery levels');
      });
    });
  });

  describe('logSessionAnalytics', () => {
    it('should log structured analytics for dashboard integration', () => {
      // Arrange
      const mockSessionSummary = {
        sessionId: 'test-session-123',
        completedAt: '2023-12-15T10:00:00Z',
        performance: {
          accuracy: 0.756789,
          avgTime: 456.789,
          strongTags: ['array', 'string'],
          weakTags: ['graph']
        },
        difficultyAnalysis: {
          totalProblems: 5,
          predominantDifficulty: 'Medium'
        },
        masteryProgression: {
          newMasteries: 2
        }
      };

      // Act
      SessionService.logSessionAnalytics(mockSessionSummary);

      // Assert console.info was called with structured data
      expect(console.info).toHaveBeenCalledWith(
        '📊 Session Analytics:',
        expect.stringContaining('"type":"session_completed"')
      );

      // Check that the logged data has correct structure and rounded values
      const loggedCall = console.info.mock.calls.find(call => 
        call[0] === '📊 Session Analytics:'
      );
      expect(loggedCall).toBeDefined();
      
      const analyticsData = JSON.parse(loggedCall[1]);
      expect(analyticsData).toMatchObject({
        type: 'session_completed',
        sessionId: 'test-session-123',
        metrics: {
          accuracy: 0.76, // Rounded
          avgTime: 457, // Rounded
          problemsCompleted: 5,
          newMasteries: 2,
          predominantDifficulty: 'Medium'
        },
        tags: {
          strong: ['array', 'string'],
          weak: ['graph']
        }
      });
    });

    it('should store analytics in Chrome storage when available', () => {
      // Arrange
      const mockSessionSummary = MockDataFactories.createMockPerformanceData();
      mockSessionSummary.sessionId = 'test-session';
      mockSessionSummary.completedAt = '2023-12-15T10:00:00Z';

      // Mock Chrome storage to simulate existing analytics
      const existingAnalytics = [{ sessionId: 'old-session' }];
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ sessionAnalytics: existingAnalytics });
      });

      // Act
      SessionService.logSessionAnalytics(mockSessionSummary);

      // Assert Chrome storage interactions
      expect(global.chrome.storage.local.get).toHaveBeenCalledWith(
        ['sessionAnalytics'], 
        expect.any(Function)
      );
      expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
        sessionAnalytics: expect.arrayContaining([
          expect.objectContaining({ sessionId: 'test-session' })
        ])
      });
    });
  });
});