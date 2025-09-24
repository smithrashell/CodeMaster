/**
 * Mock Session Service - Testing Only
 *
 * Provides complete session service simulation without database dependencies.
 * Follows the same interface as the real SessionService for drop-in replacement.
 */

// Use console directly to avoid import issues in background script
const logger = {
  info: (...args) => console.log('[MockSession]', ...args),
  warn: (...args) => console.warn('[MockSession]', ...args),
  error: (...args) => console.error('[MockSession]', ...args)
};

/**
 * Mock session service that simulates all session operations in memory
 * Following the same pattern as MockDashboardService
 */
export class MockSessionService {
  constructor() {
    this.mockState = {
      id: "session_state",
      num_sessions_completed: 0,
      current_difficulty_cap: "Easy",
      tag_index: 0,
      difficulty_time_stats: {
        easy: { problems: 0, total_time: 0, avg_time: 0 },
        medium: { problems: 0, total_time: 0, avg_time: 0 },
        hard: { problems: 0, total_time: 0, avg_time: 0 }
      },
      escape_hatches: {
        sessions_at_current_difficulty: 0,
        last_difficulty_promotion: null,
        sessions_without_promotion: 0,
        activated_escape_hatches: []
      },
      current_focus_tags: ["array"],
      performance_level: "developing",
      _isMock: true
    };

    this.mockSessions = new Map();
    this.mockAttempts = new Map();
    this.sessionCounter = 0;

    // Enhanced tracking for detailed results
    this.progressionHistory = [];
    this.thresholdEvents = [];
    this.performanceData = [];

    logger.info(`[MockSession] MockSessionService initialized with difficulty: ${this.mockState.current_difficulty_cap}`, {
      initialDifficulty: this.mockState.current_difficulty_cap,
      sessionsCompleted: this.mockState.num_sessions_completed,
      context: 'mock_session_service'
    });
  }

  /**
   * Mock implementation of getOrCreateSession
   * Returns realistic session data without database access
   */
  async getOrCreateSession(sessionType = 'standard') {
    this.sessionCounter++;

    const sessionId = `mock_session_${Date.now()}_${this.sessionCounter}`;
    const problems = this.generateMockProblems();

    const session = {
      id: sessionId,
      session_type: sessionType,
      status: 'active',
      problems: problems,
      attempts: [],
      created_date: new Date().toISOString(),
      difficulty_cap: this.mockState.current_difficulty_cap,
      _isMock: true
    };

    this.mockSessions.set(sessionId, session);

    logger.info("Mock session created", {
      sessionId,
      sessionType,
      problemCount: problems.length,
      difficulty: this.mockState.current_difficulty_cap,
      context: 'mock_session_service'
    });

    return session;
  }

  /**
   * Mock implementation of checkAndCompleteSession
   * Updates mock state without database writes
   */
  async checkAndCompleteSession(sessionId) {
    const session = this.mockSessions.get(sessionId);

    if (!session) {
      logger.warn("Mock session not found for completion", { sessionId, context: 'mock_session_service' });
      return { status: 'not_found' };
    }

    // Mark session as completed
    session.status = 'completed';
    session.completed_at = new Date().toISOString();

    // Increment session counter
    this.mockState.num_sessions_completed++;
    this.mockState.escape_hatches.sessions_at_current_difficulty++;

    logger.info("Mock session completed", {
      sessionId,
      totalSessions: this.mockState.num_sessions_completed,
      difficulty: this.mockState.current_difficulty_cap,
      context: 'mock_session_service'
    });

    return {
      status: 'completed',
      session_id: sessionId,
      total_sessions: this.mockState.num_sessions_completed
    };
  }

  /**
   * Mock implementation of difficulty progression evaluation
   * Simulates progression logic without database dependencies
   */
  async evaluateDifficultyProgression(accuracy, settings = {}) {
    const previousDifficulty = this.mockState.current_difficulty_cap;
    const now = new Date();

    logger.info(`[MockSession] Evaluating progression: ${(accuracy * 100).toFixed(1)}% accuracy, current: ${previousDifficulty}`, {
      accuracy,
      previousDifficulty,
      sessionsCompleted: this.mockState.num_sessions_completed,
      sessionsAtDifficulty: this.mockState.escape_hatches.sessions_at_current_difficulty
    });

    // Record threshold event for detailed tracking
    this.thresholdEvents.push({
      timestamp: now.toISOString(),
      currentDifficulty: previousDifficulty,
      accuracy,
      thresholdMet: accuracy >= 0.9,
      session: this.mockState.num_sessions_completed
    });

    // Apply mock progression logic (same as real logic)
    let promotionThreshold = 0.9;
    let escapeHatchActivated = false;

    // Check for escape hatch activation
    if (this.mockState.escape_hatches.sessions_at_current_difficulty >= 10) {
      promotionThreshold = 0.8;
      escapeHatchActivated = true;

      if (!this.mockState.escape_hatches.activated_escape_hatches.includes("session-based")) {
        this.mockState.escape_hatches.activated_escape_hatches.push("session-based");
        logger.info("Mock escape hatch activated - threshold lowered to 80%", { context: 'mock_session_service' });
      }
    }

    // Apply difficulty progression
    const userMaxDifficulty = settings.maxDifficulty || "Hard";
    let progressionMade = false;

    if (accuracy >= promotionThreshold && previousDifficulty === "Easy" &&
        this.getDifficultyOrder(userMaxDifficulty) >= this.getDifficultyOrder("Medium")) {

      this.mockState.current_difficulty_cap = "Medium";
      this.mockState.escape_hatches.sessions_at_current_difficulty = 0;
      this.mockState.escape_hatches.activated_escape_hatches = [];
      progressionMade = true;

      this.progressionHistory.push({
        from: "Easy",
        to: "Medium",
        trigger: escapeHatchActivated ? `escape_hatch_${(accuracy * 100).toFixed(0)}%` : `accuracy_${(accuracy * 100).toFixed(0)}%`,
        session: this.mockState.num_sessions_completed,
        timestamp: now.toISOString()
      });

    } else if (accuracy >= promotionThreshold && previousDifficulty === "Medium" &&
               this.getDifficultyOrder(userMaxDifficulty) >= this.getDifficultyOrder("Hard")) {

      this.mockState.current_difficulty_cap = "Hard";
      this.mockState.escape_hatches.sessions_at_current_difficulty = 0;
      this.mockState.escape_hatches.activated_escape_hatches = [];
      progressionMade = true;

      this.progressionHistory.push({
        from: "Medium",
        to: "Hard",
        trigger: escapeHatchActivated ? `escape_hatch_${(accuracy * 100).toFixed(0)}%` : `accuracy_${(accuracy * 100).toFixed(0)}%`,
        session: this.mockState.num_sessions_completed,
        timestamp: now.toISOString()
      });
    }

    if (progressionMade) {
      logger.info(`[MockSession] PROGRESSION MADE: ${previousDifficulty} → ${this.mockState.current_difficulty_cap}`, {
        accuracy: (accuracy * 100).toFixed(1) + '%',
        escapeHatch: escapeHatchActivated,
        threshold: (promotionThreshold * 100).toFixed(0) + '%',
        context: 'mock_session_service'
      });
    } else {
      logger.info(`[MockSession] No progression: ${previousDifficulty} stays ${this.mockState.current_difficulty_cap}`, {
        accuracy: (accuracy * 100).toFixed(1) + '%',
        threshold: (promotionThreshold * 100).toFixed(0) + '%',
        meetsThreshold: accuracy >= promotionThreshold,
        context: 'mock_session_service'
      });
    }

    // Update session tracking
    if (this.mockState.current_difficulty_cap === previousDifficulty) {
      this.mockState.escape_hatches.sessions_without_promotion++;
    } else {
      this.mockState.escape_hatches.sessions_without_promotion = 0;
      this.mockState.escape_hatches.last_difficulty_promotion = now.toISOString();
    }

    return this.mockState;
  }

  /**
   * Generate realistic mock problems based on current difficulty
   */
  generateMockProblems() {
    const difficulty = this.mockState.current_difficulty_cap;
    const baseCount = this.calculateSessionLength();

    const problems = [];
    for (let i = 0; i < baseCount; i++) {
      problems.push({
        id: Math.floor(Math.random() * 3000) + 1,
        leetcode_id: Math.floor(Math.random() * 3000) + 1,
        title: this.generateProblemTitle(),
        difficulty: difficulty,
        tags: this.generateProblemTags(),
        _isMock: true
      });
    }

    return problems;
  }

  /**
   * Calculate session length based on mock performance
   */
  calculateSessionLength() {
    // Base length calculation (simplified version of real logic)
    const baseLength = 4;
    const sessionsCompleted = this.mockState.num_sessions_completed;

    // Simulate adaptive length based on "performance"
    if (sessionsCompleted < 3) {
      return 3; // Onboarding length
    } else if (sessionsCompleted < 10) {
      return baseLength;
    } else {
      return Math.min(baseLength + Math.floor(sessionsCompleted / 10), 8);
    }
  }

  /**
   * Generate realistic problem titles
   */
  generateProblemTitle() {
    const titles = [
      "Two Sum", "Add Two Numbers", "Longest Substring Without Repeating Characters",
      "Median of Two Sorted Arrays", "Longest Palindromic Substring", "Zigzag Conversion",
      "Reverse Integer", "String to Integer (atoi)", "Palindrome Number", "Regular Expression Matching",
      "Container With Most Water", "Integer to Roman", "Roman to Integer", "Longest Common Prefix",
      "3Sum", "3Sum Closest", "Letter Combinations of a Phone Number", "4Sum", "Remove Nth Node From End of List"
    ];
    return titles[Math.floor(Math.random() * titles.length)];
  }

  /**
   * Generate realistic problem tags
   */
  generateProblemTags() {
    const allTags = ["array", "hash-table", "two-pointers", "string", "math", "dynamic-programming",
                     "sorting", "greedy", "depth-first-search", "binary-search", "tree", "breadth-first-search"];
    const numTags = Math.floor(Math.random() * 3) + 1;
    const tags = [];

    for (let i = 0; i < numTags; i++) {
      const tag = allTags[Math.floor(Math.random() * allTags.length)];
      if (!tags.includes(tag)) {
        tags.push(tag);
      }
    }

    return tags;
  }

  /**
   * Helper function for difficulty ordering
   */
  getDifficultyOrder(difficulty) {
    const order = { "Easy": 1, "Medium": 2, "Hard": 3 };
    return order[difficulty] || 1;
  }

  /**
   * Get enhanced results for detailed testing analysis
   */
  getEnhancedResults() {
    return {
      mockState: { ...this.mockState },
      progressionHistory: [...this.progressionHistory],
      thresholdEvents: [...this.thresholdEvents],
      performanceData: [...this.performanceData],
      totalSessions: this.mockSessions.size,
      completedSessions: Array.from(this.mockSessions.values()).filter(s => s.status === 'completed').length
    };
  }

  /**
   * Mock implementation of buildAdaptiveSessionSettings
   */
  async buildAdaptiveSessionSettings() {
    return {
      sessionLength: this.calculateSessionLength(),
      numberOfNewProblems: Math.floor(this.calculateSessionLength() * 0.7),
      currentDifficultyCap: this.mockState.current_difficulty_cap,
      isOnboarding: this.mockState.num_sessions_completed < 1,
      currentFocusTags: this.mockState.current_focus_tags,
      _isMock: true
    };
  }

  /**
   * Mock implementation of getSessionPerformance
   */
  async getSessionPerformance(options = {}) {
    // Return mock performance data based on current state
    const { recentSessionsLimit: _recentSessionsLimit = 5 } = options;

    return {
      accuracy: 0.75, // Mock accuracy
      avgTime: 600, // Mock average time
      totalAttempts: this.mockState.num_sessions_completed * 4,
      totalCorrect: Math.floor(this.mockState.num_sessions_completed * 4 * 0.75),
      performance: {
        Easy: { attempts: 10, correct: 8, time: 300 },
        Medium: { attempts: 8, correct: 6, time: 600 },
        Hard: { attempts: 2, correct: 1, time: 900 }
      },
      _isMock: true
    };
  }

  /**
   * Reset mock state for fresh testing
   */
  reset() {
    this.mockState = {
      id: "session_state",
      num_sessions_completed: 0,
      current_difficulty_cap: "Easy",
      tag_index: 0,
      difficulty_time_stats: {
        easy: { problems: 0, total_time: 0, avg_time: 0 },
        medium: { problems: 0, total_time: 0, avg_time: 0 },
        hard: { problems: 0, total_time: 0, avg_time: 0 }
      },
      escape_hatches: {
        sessions_at_current_difficulty: 0,
        last_difficulty_promotion: null,
        sessions_without_promotion: 0,
        activated_escape_hatches: []
      },
      current_focus_tags: ["array"],
      performance_level: "developing",
      _isMock: true
    };

    this.mockSessions.clear();
    this.mockAttempts.clear();
    this.sessionCounter = 0;
    this.progressionHistory = [];
    this.thresholdEvents = [];
    this.performanceData = [];

    logger.info(`[MockSession] Mock session service reset to difficulty: ${this.mockState.current_difficulty_cap}`, {
      resetDifficulty: this.mockState.current_difficulty_cap,
      resetSessions: this.mockState.num_sessions_completed,
      context: 'mock_session_service'
    });
  }
}

// Create singleton instance
export const mockSessionService = new MockSessionService();

// Export individual functions for compatibility
export const getOrCreateSession = (...args) => mockSessionService.getOrCreateSession(...args);
export const checkAndCompleteSession = (...args) => mockSessionService.checkAndCompleteSession(...args);
export const evaluateDifficultyProgression = (...args) => mockSessionService.evaluateDifficultyProgression(...args);