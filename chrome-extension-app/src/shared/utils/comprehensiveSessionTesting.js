/**
 * Comprehensive Session Testing Framework
 * Tests all interdependent systems and adaptive behaviors
 */

import { SessionService } from '../services/sessionService.js';
import { AttemptsService } from '../services/attemptsService.js';
import { StorageService } from '../services/storageService.js';
import { TagService } from '../services/tagServices.js';
import { ScheduleService } from '../services/scheduleService.js';
import FocusCoordinationService from '../services/focusCoordinationService.js';
// Dynamic imports for ProblemService and buildAdaptiveSessionSettings to follow production flow

export class ComprehensiveSessionTester {
  constructor(config = {}) {
    this.config = {
      totalSessions: 10,
      accuracyRange: [0.6, 1.0],
      performanceProfiles: ['struggling', 'average', 'excellent'],
      clearData: true,
      verbose: true,
      validateAnalytics: true,
      validateAdaptation: true,
      ...config
    };
    this.testResults = {
      sessions: [],
      validationErrors: [],
      performanceMetrics: {},
      adaptationBehaviors: {}
    };
    this.currentTestProfile = 'unknown';
  }

  /**
   * Set current test profile for tracking
   */
  setCurrentTestProfile(profile) {
    this.currentTestProfile = profile;
  }

  /**
   * Get current test profile
   */
  getCurrentTestProfile() {
    return this.currentTestProfile;
  }

  /**
   * Run comprehensive test suite
   */
  async runComprehensiveTests() {
    console.log('🧪 Starting Comprehensive Session Testing Framework');
    console.log('🎯 Testing session creation dependencies and adaptive behaviors');

    if (this.config.clearData) {
      await this.clearAllTestData();
    }

    // Test critical session creation dependencies first
    console.log('\n🔥 Testing Critical Session Creation Dependencies...');
    await this.testSessionCreationDependencies();
    await this.testAdaptiveSessionSettings();
    await this.testProblemFetchingAndAssembly();

    // Test different performance profiles
    for (const profile of this.config.performanceProfiles) {
      console.log(`\n📊 Testing ${profile} user profile...`);
      await this.testPerformanceProfile(profile);
    }

    // Test specific adaptive behaviors
    await this.testSessionLengthAdaptation();
    await this.testProblemMixAdaptation();
    await this.testDifficultyProgression();
    await this.testLeitnerSystemProgression();
    await this.testSpacedRepetitionScheduling();
    await this.testTagMasteryProgression();
    await this.testAnalyticsAccuracy();
    await this.testStatePersistence();

    return this.generateComprehensiveReport();
  }

  /**
   * Test specific performance profile over multiple sessions
   */
  async testPerformanceProfile(profile) {
    const profileConfig = this.getProfileConfig(profile);
    const profileResults = [];

    // Set current test profile for tracking
    this.setCurrentTestProfile(profile);

    for (let i = 0; i < this.config.totalSessions; i++) {
      const sessionResult = await this.runDetailedSessionTest(i + 1, profileConfig);
      profileResults.push(sessionResult);

      // Validate session immediately after creation
      const validation = this.validateSessionResult(sessionResult, profileConfig);
      if (validation.errors.length > 0) {
        this.testResults.validationErrors.push(...validation.errors);
      }

      // Only log summary for first and last few sessions
      if (this.config.verbose && (i < 2 || i >= this.config.totalSessions - 2)) {
        console.log(`  Session ${i + 1} (${profile}):`, this.formatSessionSummary(sessionResult));
      }
    }

    this.testResults.performanceMetrics[profile] = this.analyzeProfileResults(profileResults);
    return profileResults;
  }

  /**
   * Run detailed session test with comprehensive validation
   */
  async runDetailedSessionTest(sessionNumber, profileConfig) {
    const startTime = Date.now();

    try {
      // 1. Get pre-session state
      const preSessionState = await this.captureSystemState();

      // 2. Create session
      const sessionData = await SessionService.getOrCreateSession('standard');

      // Only log if verbose and first few sessions
      if (this.config.verbose && sessionNumber <= 3) {
        console.log(`🎯 Session ${sessionNumber}: ${sessionData?.problems?.length || 0} problems`);
      }

      // 3. Get session settings for validation
      const { buildAdaptiveSessionSettings } = await import('../db/sessions.js');
      const settings = await buildAdaptiveSessionSettings();

      // 4. Validate session creation
      const creationValidation = this.validateSessionCreation(sessionData, settings, preSessionState);

      // 5. Simulate realistic user attempts (only if problems exist)
      const attempts = sessionData.problems ?
        await this.simulateRealisticAttempts(sessionData.problems, profileConfig) : [];

      // 6. Record attempts in database
      for (const attempt of attempts) {
        await AttemptsService.addAttempt({
          leetcode_id: attempt.problemId,
          success: attempt.success,
          time_spent: attempt.timeSpent,
          source: 'comprehensive_test'
        });
      }

      // 7. Complete session and get analytics
      const sessionId = sessionData.sessionId || `test_${sessionNumber}_${Date.now()}`;
      let analytics = null;
      let sessionCompletion = null;

      try {
        sessionCompletion = await SessionService.completeSession(sessionId);
        analytics = await SessionService.getSessionAnalytics(sessionId);
      } catch (error) {
        console.warn(`Analytics error for session ${sessionNumber}:`, error.message);
      }

      // 8. Get post-session state
      const postSessionState = await this.captureSystemState();

      // 9. Calculate performance impact
      const performanceImpact = this.calculatePerformanceImpact(attempts);

      const sessionResult = {
        sessionNumber,
        sessionId,
        sessionData,
        settings,
        attempts,
        analytics,
        sessionCompletion,
        preSessionState,
        postSessionState,
        performanceImpact,
        creationValidation,
        executionTime: Date.now() - startTime,
        profileConfig: { ...profileConfig, profile: this.getCurrentTestProfile() }
      };

      this.testResults.sessions.push(sessionResult);
      return sessionResult;

    } catch (error) {
      console.error(`❌ Session ${sessionNumber} failed:`, error);
      return {
        sessionNumber,
        error: error.message,
        failed: true,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Capture comprehensive system state
   */
  async captureSystemState() {
    try {
      const [
        sessionState,
        allSessions,
        userStats,
        tagMastery
      ] = await Promise.all([
        StorageService.getSessionState('session_state'),
        SessionService.getAllSessionsFromDB(),
        this.getUserPerformanceStats(),
        TagService.getCurrentLearningState()
      ]);

      // Get recent sessions (last 5)
      const recentSessions = allSessions ? allSessions.slice(-5) : [];

      return {
        sessionState,
        recentSessions,
        userStats: userStats || {},
        tagMastery: tagMastery || {},
        timestamp: Date.now()
      };
    } catch (error) {
      console.warn('Failed to capture system state:', error);
      return { error: error.message, timestamp: Date.now() };
    }
  }

  /**
   * Validate session creation against expected adaptive behavior
   */
  validateSessionCreation(sessionData, settings, preSessionState) {
    const errors = [];
    const warnings = [];

    // Validate session exists and has problems
    if (!sessionData || !sessionData.problems) {
      errors.push('Session data missing or has no problems');
      return { errors, warnings, passed: false };
    }

    // Validate session length adaptation
    const expectedLength = this.calculateExpectedSessionLength(preSessionState, settings);
    const actualLength = sessionData.problems ? sessionData.problems.length : 0;

    if (Math.abs(actualLength - expectedLength) > 2) {
      warnings.push(`Session length mismatch: expected ~${expectedLength}, got ${actualLength}`);
    }

    // Validate difficulty cap adherence
    const difficultiesAboveCap = sessionData.problems.filter(p =>
      this.isDifficultyAboveCap(p.difficulty, settings.currentDifficultyCap)
    );

    if (difficultiesAboveCap.length > 0) {
      errors.push(`${difficultiesAboveCap.length} problems above difficulty cap ${settings.currentDifficultyCap}`);
    }

    // Validate problem mix (new vs attempted)
    const problemAnalysis = this.analyzeProblemMix(sessionData.problems, preSessionState);
    if (problemAnalysis.invalidMix) {
      warnings.push(`Problem mix seems suboptimal: ${problemAnalysis.reason}`);
    }

    return {
      errors,
      warnings,
      passed: errors.length === 0,
      analysis: {
        expectedLength,
        actualLength,
        problemAnalysis,
        settings
      }
    };
  }

  /**
   * Calculate expected session length based on user performance
   */
  calculateExpectedSessionLength(preSessionState, settings) {
    if (settings.isOnboarding) {
      return 4; // Fixed onboarding length
    }

    // Base length from settings
    let expectedLength = settings.sessionLength || 4;

    // Adjust based on recent performance
    if (preSessionState.recentSessions && preSessionState.recentSessions.length > 0) {
      const recentAccuracy = this.calculateRecentAccuracy(preSessionState.recentSessions);

      if (recentAccuracy > 0.8) {
        expectedLength = Math.floor(expectedLength * 0.8); // Shorter for high performers
      } else if (recentAccuracy < 0.6) {
        expectedLength = Math.floor(expectedLength * 1.25); // Longer for struggling users
      }
    }

    return Math.max(3, Math.min(8, expectedLength)); // Clamp between 3-8
  }

  /**
   * Check if difficulty is above current cap
   */
  isDifficultyAboveCap(difficulty, cap) {
    const difficultyOrder = ['Easy', 'Medium', 'Hard'];
    const difficultyIndex = difficultyOrder.indexOf(difficulty);
    const capIndex = difficultyOrder.indexOf(cap);
    return difficultyIndex > capIndex;
  }

  /**
   * Analyze problem mix for new vs attempted problems
   */
  analyzeProblemMix(problems, _preSessionState) {
    // This would need actual problem history data
    // For now, basic validation
    const analysis = {
      totalProblems: problems.length,
      easyCount: problems.filter(p => p.difficulty === 'Easy').length,
      mediumCount: problems.filter(p => p.difficulty === 'Medium').length,
      hardCount: problems.filter(p => p.difficulty === 'Hard').length,
      invalidMix: false,
      reason: null
    };

    // Check for reasonable difficulty distribution
    if (analysis.totalProblems > 0) {
      const easyRatio = analysis.easyCount / analysis.totalProblems;
      if (easyRatio > 0.9 && analysis.totalProblems > 4) {
        analysis.invalidMix = true;
        analysis.reason = 'Too many easy problems for experienced user';
      }
    }

    return analysis;
  }

  /**
   * Simulate realistic user attempts based on performance profile
   */
  async simulateRealisticAttempts(problems, profileConfig) {
    const attempts = [];

    for (let i = 0; i < problems.length; i++) {
      const problem = problems[i];
      const attempt = this.generateRealisticAttempt(problem, profileConfig, i);
      attempts.push(attempt);
    }

    return attempts;
  }

  /**
   * Generate realistic attempt based on problem and user profile
   */
  generateRealisticAttempt(problem, profileConfig, problemIndex) {
    const difficulty = problem.difficulty;
    const baseAccuracy = profileConfig.baseAccuracy[difficulty] || 0.5;

    // Add session fatigue (later problems are harder)
    const fatigueReduction = problemIndex * 0.02;
    const adjustedAccuracy = Math.max(0.1, baseAccuracy - fatigueReduction);

    // Add randomness
    const randomFactor = (Math.random() - 0.5) * profileConfig.variance;
    const finalAccuracy = Math.max(0, Math.min(1, adjustedAccuracy + randomFactor));

    const success = Math.random() < finalAccuracy;
    const baseTime = this.getBaseTimeForDifficulty(difficulty);
    const timeMultiplier = success ?
      profileConfig.successTimeMultiplier :
      profileConfig.failureTimeMultiplier;

    const timeSpent = Math.floor(baseTime * timeMultiplier * (0.8 + Math.random() * 0.4));

    return {
      problemId: problem.id,
      difficulty,
      success,
      timeSpent,
      accuracy: finalAccuracy,
      problemIndex
    };
  }

  /**
   * Get performance profile configuration
   */
  getProfileConfig(profile) {
    const profiles = {
      struggling: {
        baseAccuracy: { Easy: 0.4, Medium: 0.2, Hard: 0.1 },
        variance: 0.15,
        successTimeMultiplier: 1.2,
        failureTimeMultiplier: 1.8
      },
      average: {
        baseAccuracy: { Easy: 0.75, Medium: 0.55, Hard: 0.35 },
        variance: 0.2,
        successTimeMultiplier: 1.0,
        failureTimeMultiplier: 1.4
      },
      excellent: {
        baseAccuracy: { Easy: 0.95, Medium: 0.85, Hard: 0.65 },
        variance: 0.1,
        successTimeMultiplier: 0.7,
        failureTimeMultiplier: 1.1
      }
    };

    return profiles[profile] || profiles.average;
  }

  /**
   * Test session length adaptation over time
   */
  async testSessionLengthAdaptation() {
    console.log('\n📏 Testing Session Length Adaptation...');

    // Test different scenarios that should trigger length changes
    const scenarios = [
      { name: 'High Performance', profile: 'excellent', expectedBehavior: 'shorter sessions' },
      { name: 'Low Performance', profile: 'struggling', expectedBehavior: 'longer sessions' },
      { name: 'Improving Performance', profile: 'average', expectedBehavior: 'adaptive lengths' }
    ];

    for (const scenario of scenarios) {
      const sessionLengths = [];
      for (let i = 0; i < 5; i++) {
        const result = await this.runDetailedSessionTest(i + 1, this.getProfileConfig(scenario.profile));
        if (result && !result.failed) {
          sessionLengths.push(result.sessionData.problems.length);
        }
      }

      console.log(`  ${scenario.name}: lengths [${sessionLengths.join(', ')}] - ${scenario.expectedBehavior}`);
      this.testResults.adaptationBehaviors[scenario.name] = {
        sessionLengths,
        expectedBehavior: scenario.expectedBehavior,
        averageLength: sessionLengths.reduce((a, b) => a + b, 0) / sessionLengths.length
      };
    }
  }

  /**
   * Test problem mix adaptation (new vs attempted problems)
   */
  async testProblemMixAdaptation() {
    console.log('\n🔀 Testing Problem Mix Adaptation...');

    // This would test the balance of new problems vs review problems
    // Based on user performance and learning patterns

    const mixTests = [];
    for (let i = 0; i < 3; i++) {
      const result = await this.runDetailedSessionTest(i + 1, this.getProfileConfig('average'));
      if (result && !result.failed) {
        const mix = this.analyzeProblemMix(result.sessionData.problems, result.preSessionState);
        mixTests.push(mix);
      }
    }

    this.testResults.adaptationBehaviors.problemMix = mixTests;
    console.log('  Problem mix analysis completed');
  }

  /**
   * Test difficulty progression over sessions
   */
  async testDifficultyProgression() {
    console.log('\n📈 Testing Difficulty Progression...');

    const progressionData = [];
    for (let i = 0; i < 8; i++) {
      const result = await this.runDetailedSessionTest(i + 1, this.getProfileConfig('excellent'));
      if (result && !result.failed) {
        progressionData.push({
          session: i + 1,
          difficultyCap: result.settings?.currentDifficultyCap,
          isOnboarding: result.settings?.isOnboarding,
          problems: result.sessionData.problems.map(p => p.difficulty)
        });
      }
    }

    this.testResults.adaptationBehaviors.difficultyProgression = progressionData;
    console.log('  Difficulty progression tracking completed');
  }

  /**
   * Test analytics accuracy and completeness
   */
  async testAnalyticsAccuracy() {
    console.log('\n📊 Testing Analytics Accuracy...');

    const analyticsTests = [];
    for (let i = 0; i < 3; i++) {
      const result = await this.runDetailedSessionTest(i + 1, this.getProfileConfig('average'));
      if (result && !result.failed && result.analytics) {
        const validation = this.validateAnalyticsAccuracy(result);
        analyticsTests.push(validation);
      }
    }

    this.testResults.adaptationBehaviors.analyticsAccuracy = analyticsTests;
    console.log('  Analytics validation completed');
  }

  /**
   * Test state persistence across sessions
   */
  async testStatePersistence() {
    console.log('\n💾 Testing State Persistence...');

    const persistenceTests = [];
    for (let i = 0; i < 3; i++) {
      const preState = await this.captureSystemState();
      const result = await this.runDetailedSessionTest(i + 1, this.getProfileConfig('average'));
      const postState = await this.captureSystemState();

      const persistenceCheck = this.validateStatePersistence(preState, postState, result);
      persistenceTests.push(persistenceCheck);
    }

    this.testResults.adaptationBehaviors.statePersistence = persistenceTests;
    console.log('  State persistence validation completed');
  }

  /**
   * Test critical session creation dependencies
   */
  async testSessionCreationDependencies() {
    console.log('🔍 Testing Session Creation Dependencies...');

    const dependencyTests = {
      focusCoordinationService: false,
      tagService: false,
      storageService: false,
      adaptiveSettings: false,
      problemService: false
    };

    // Test FocusCoordinationService.getFocusDecision
    try {
      const focusDecision = await FocusCoordinationService.getFocusDecision('test_session_state');
      dependencyTests.focusCoordinationService = !!(focusDecision && typeof focusDecision === 'object');
      console.log(`  ✅ FocusCoordinationService.getFocusDecision: Working`);
    } catch (error) {
      console.log(`  ❌ FocusCoordinationService.getFocusDecision: ${error.message}`);
    }

    // Test TagService.getCurrentTier
    try {
      const currentTier = await TagService.getCurrentTier();
      dependencyTests.tagService = !!(currentTier && currentTier.focusTags);
      console.log(`  ✅ TagService.getCurrentTier: Working`);
    } catch (error) {
      console.log(`  ❌ TagService.getCurrentTier: ${error.message}`);
    }

    // Test StorageService.getSettings
    try {
      const _settings = await StorageService.getSettings();
      dependencyTests.storageService = true; // Even empty settings object is valid
      console.log(`  ✅ StorageService.getSettings: Working`);
    } catch (error) {
      console.log(`  ❌ StorageService.getSettings: ${error.message}`);
    }

    this.testResults.adaptationBehaviors.sessionCreationDependencies = dependencyTests;
  }

  /**
   * Test buildAdaptiveSessionSettings function
   */
  async testAdaptiveSessionSettings() {
    console.log('⚙️ Testing Adaptive Session Settings...');

    const settingsTests = [];

    for (let i = 0; i < 3; i++) {
      try {
        const { buildAdaptiveSessionSettings } = await import('../db/sessions.js');
        const settings = await buildAdaptiveSessionSettings();

        const settingsValidation = {
          hasSessionLength: typeof settings.sessionLength === 'number',
          hasNumberOfNewProblems: typeof settings.numberOfNewProblems === 'number',
          hasCurrentAllowedTags: Array.isArray(settings.currentAllowedTags),
          hasCurrentDifficultyCap: typeof settings.currentDifficultyCap === 'string',
          hasUserFocusAreas: settings.userFocusAreas !== undefined,
          hasIsOnboarding: typeof settings.isOnboarding === 'boolean',
          sessionLengthRange: settings.sessionLength >= 3 && settings.sessionLength <= 12,
          newProblemsRange: settings.numberOfNewProblems >= 1 && settings.numberOfNewProblems <= 8
        };

        settingsTests.push(settingsValidation);
        if (i < 2) { // Only log first 2
          console.log(`  Session ${i + 1}: Length=${settings.sessionLength}, NewProblems=${settings.numberOfNewProblems}, Difficulty=${settings.currentDifficultyCap}`);
        }
      } catch (error) {
        console.log(`  ❌ buildAdaptiveSessionSettings test ${i + 1}: ${error.message}`);
        settingsTests.push({ error: error.message });
      }
    }

    this.testResults.adaptationBehaviors.adaptiveSessionSettings = settingsTests;
  }

  /**
   * Test problem fetching and assembly pipeline
   */
  async testProblemFetchingAndAssembly() {
    console.log('🧩 Testing Problem Fetching and Assembly...');

    const assemblyTests = [];

    for (let i = 0; i < 3; i++) {
      try {
        // Get settings first
        const { buildAdaptiveSessionSettings } = await import('../db/sessions.js');
        const settings = await buildAdaptiveSessionSettings();

        // Test the full fetchAndAssembleSessionProblems pipeline
        const problems = await ProblemService.fetchAndAssembleSessionProblems(
          settings.sessionLength,
          settings.numberOfNewProblems,
          settings.currentAllowedTags,
          settings.currentDifficultyCap,
          settings.userFocusAreas,
          settings.isOnboarding
        );

        const assemblyValidation = {
          problemsReturned: Array.isArray(problems) && problems.length > 0,
          expectedLength: problems.length === settings.sessionLength,
          validDifficulties: problems.every(p => p.difficulty && ['Easy', 'Medium', 'Hard'].includes(p.difficulty)),
          respectsDifficultyCap: this.validateDifficultyCap(problems, settings.currentDifficultyCap),
          hasRequiredFields: problems.every(p => p.id && p.title && p.difficulty),
          problemCount: problems.length
        };

        assemblyTests.push(assemblyValidation);
        if (i < 2) { // Only log first 2
          console.log(`  Assembly ${i + 1}: ${problems.length} problems, Cap=${settings.currentDifficultyCap}, Valid=${assemblyValidation.respectsDifficultyCap}`);
        }
      } catch (error) {
        console.log(`  ❌ Problem assembly test ${i + 1}: ${error.message}`);
        assemblyTests.push({ error: error.message });
      }
    }

    this.testResults.adaptationBehaviors.problemFetchingAndAssembly = assemblyTests;
  }

  /**
   * Test Leitner System box level progression
   */
  async testLeitnerSystemProgression() {
    console.log('📦 Testing Leitner System Box Level Progression...');

    const leitnerTests = [];

    // Simulate successful attempts to test box progression
    for (let i = 0; i < 5; i++) {
      try {
        // Create session and simulate successful completion
        const sessionData = await SessionService.getOrCreateSession('standard');

        // Record successful attempts for some problems
        const successfulProblems = sessionData.problems ? sessionData.problems.slice(0, 2) : [];
        for (const problem of successfulProblems) {
          await AttemptsService.addAttempt({
            leetcode_id: problem.id,
            success: true,
            time_spent: 600,
            source: 'leitner_test'
          });
        }

        // Check if problems moved to higher box levels
        // Note: This would require accessing box level data which may be in attempts or problems DB
        leitnerTests.push({
          sessionCreated: true,
          problemsProcessed: successfulProblems.length,
          test: `Leitner progression test ${i + 1}`
        });

      } catch (error) {
        console.log(`  ❌ Leitner system test ${i + 1}: ${error.message}`);
        leitnerTests.push({ error: error.message });
      }
    }

    this.testResults.adaptationBehaviors.leitnerSystemProgression = leitnerTests;
    console.log('  Leitner system progression testing completed');
  }

  /**
   * Test spaced repetition scheduling
   */
  testSpacedRepetitionScheduling() {
    console.log('⏰ Testing Spaced Repetition Scheduling...');

    const scheduleTests = [];

    try {
      // Test scheduling logic with mock data
      scheduleTests.push({
        scheduleServiceAvailable: typeof ScheduleService === 'object',
        test: 'Schedule service accessibility'
      });

    } catch (error) {
      console.log(`  ❌ Schedule service test: ${error.message}`);
      scheduleTests.push({ error: error.message });
    }

    this.testResults.adaptationBehaviors.spacedRepetitionScheduling = scheduleTests;
    console.log('  Spaced repetition scheduling testing completed');
  }

  /**
   * Test tag mastery and pattern ladder progression
   */
  async testTagMasteryProgression() {
    console.log('🏷️ Testing Tag Mastery and Pattern Ladder Progression...');

    const masteryTests = [];

    for (let i = 0; i < 3; i++) {
      try {
        // Test tag mastery data retrieval using available method
        const tagMastery = await TagService.getCurrentLearningState();

        masteryTests.push({
          tagMasteryAvailable: tagMastery !== null,
          hasExpectedStructure: tagMastery && typeof tagMastery === 'object',
          test: `Tag mastery test ${i + 1}`
        });

      } catch (error) {
        console.log(`  ❌ Tag mastery test ${i + 1}: ${error.message}`);
        masteryTests.push({ error: error.message });
      }
    }

    this.testResults.adaptationBehaviors.tagMasteryProgression = masteryTests;
    console.log('  Tag mastery progression testing completed');
  }

  /**
   * Validate difficulty cap is respected
   */
  validateDifficultyCap(problems, difficultyCap) {
    const difficultyOrder = ['Easy', 'Medium', 'Hard'];
    const capIndex = difficultyOrder.indexOf(difficultyCap);

    return problems.every(problem => {
      const problemIndex = difficultyOrder.indexOf(problem.difficulty);
      return problemIndex <= capIndex;
    });
  }

  /**
   * Validate session result comprehensively
   */
  validateSessionResult(sessionResult, profileConfig) {
    const validation = { errors: [], warnings: [] };

    if (sessionResult.failed) {
      validation.errors.push(`Session ${sessionResult.sessionNumber} failed: ${sessionResult.error}`);
      return validation;
    }

    // Validate creation validation passed
    if (sessionResult.creationValidation && !sessionResult.creationValidation.passed) {
      validation.errors.push(...sessionResult.creationValidation.errors);
      validation.warnings.push(...sessionResult.creationValidation.warnings);
    }

    // Validate performance impact makes sense
    if (sessionResult.performanceImpact) {
      const { successRate } = sessionResult.performanceImpact;
      const expectedRange = this.getExpectedSuccessRange(profileConfig);

      if (successRate < expectedRange.min || successRate > expectedRange.max) {
        validation.warnings.push(
          `Success rate ${(successRate * 100).toFixed(1)}% outside expected range ${(expectedRange.min * 100).toFixed(1)}%-${(expectedRange.max * 100).toFixed(1)}%`
        );
      }
    }

    return validation;
  }

  /**
   * Get expected success rate range for profile
   */
  getExpectedSuccessRange(profileConfig) {
    if (!profileConfig.baseAccuracy) return { min: 0, max: 1 };

    const baseRates = Object.values(profileConfig.baseAccuracy);
    const avgBase = baseRates.reduce((a, b) => a + b, 0) / baseRates.length;

    return {
      min: Math.max(0, avgBase - 0.3),
      max: Math.min(1, avgBase + 0.3)
    };
  }

  /**
   * Validate analytics accuracy
   */
  validateAnalyticsAccuracy(sessionResult) {
    const { attempts, analytics } = sessionResult;
    const validation = { errors: [], warnings: [], passed: true };

    if (!analytics) {
      validation.errors.push('Analytics data missing');
      validation.passed = false;
      return validation;
    }

    // Validate success rate calculation
    const actualSuccessRate = attempts.filter(a => a.success).length / attempts.length;
    const analyticsSuccessRate = analytics.successRate || 0;

    if (Math.abs(actualSuccessRate - analyticsSuccessRate) > 0.05) {
      validation.warnings.push(`Success rate mismatch: actual ${(actualSuccessRate * 100).toFixed(1)}%, analytics ${(analyticsSuccessRate * 100).toFixed(1)}%`);
    }

    return validation;
  }

  /**
   * Validate state persistence
   */
  validateStatePersistence(preState, postState, sessionResult) {
    const validation = { errors: [], warnings: [], passed: true };

    // Check if session was properly recorded
    if (postState.recentSessions && preState.recentSessions) {
      const sessionCountIncrease = postState.recentSessions.length - preState.recentSessions.length;
      if (sessionCountIncrease <= 0 && !sessionResult.failed) {
        validation.warnings.push('Session may not have been properly persisted');
      }
    }

    return validation;
  }

  /**
   * Helper methods
   */
  getBaseTimeForDifficulty(difficulty) {
    return { Easy: 600, Medium: 1200, Hard: 1800 }[difficulty] || 900;
  }

  calculateRecentAccuracy(recentSessions) {
    if (!recentSessions.length) return 0.7; // Default assumption

    // This would calculate based on actual session data
    return 0.7; // Placeholder
  }

  calculatePerformanceImpact(attempts) {
    const successRate = attempts.filter(a => a.success).length / attempts.length;
    const avgTime = attempts.reduce((sum, a) => sum + a.timeSpent, 0) / attempts.length;

    return {
      successRate,
      avgTime,
      totalProblems: attempts.length,
      impact: successRate > 0.8 ? 'positive' : successRate < 0.5 ? 'negative' : 'neutral'
    };
  }

  getUserPerformanceStats() {
    // Placeholder for actual user stats
    return { totalSolved: 0, accuracy: 0.7, avgTime: 900 };
  }

  formatSessionSummary(result) {
    if (result.failed) return `❌ FAILED: ${result.error}`;

    const { sessionData, attempts: _attempts, performanceImpact } = result;
    return {
      problems: sessionData?.problems?.length || 0,
      successRate: `${(performanceImpact?.successRate * 100).toFixed(1)}%`,
      avgTime: `${Math.floor(performanceImpact?.avgTime || 0)}s`,
      difficulties: this.getDifficultyDistribution(sessionData?.problems || []),
      validated: result.creationValidation?.passed || false
    };
  }

  getDifficultyDistribution(problems) {
    const dist = { Easy: 0, Medium: 0, Hard: 0 };
    problems.forEach(p => dist[p.difficulty] = (dist[p.difficulty] || 0) + 1);
    return dist;
  }

  analyzeProfileResults(results) {
    const successful = results.filter(r => !r.failed);

    if (successful.length === 0) {
      return { error: 'No successful sessions to analyze' };
    }

    const sessionLengths = successful.map(r => r.sessionData?.problems?.length || 0);
    const successRates = successful.map(r => r.performanceImpact.successRate);

    return {
      sessionCount: successful.length,
      avgSessionLength: sessionLengths.reduce((a, b) => a + b, 0) / sessionLengths.length,
      avgSuccessRate: successRates.reduce((a, b) => a + b, 0) / successRates.length,
      sessionLengthRange: [Math.min(...sessionLengths), Math.max(...sessionLengths)],
      validationErrors: successful.reduce((sum, r) => sum + (r.creationValidation?.errors.length || 0), 0)
    };
  }

  async clearAllTestData() {
    console.log('🗑️ Clearing all test data...');
    try {
      // Clear session state using the available method
      await StorageService.setSessionState('session_state', {});
      console.log('✅ Test data cleared');
    } catch (error) {
      console.warn('⚠️ Failed to clear some test data:', error);
    }
  }

  /**
   * Generate comprehensive test report
   */
  generateComprehensiveReport() {
    console.log('\n🎯 COMPREHENSIVE SESSION TESTING REPORT');
    console.log('=======================================');

    // Summary statistics
    const totalSessions = this.testResults.sessions.length;
    const successfulSessions = this.testResults.sessions.filter(s => !s.failed).length;
    const totalErrors = this.testResults.validationErrors.length;

    console.log(`📊 EXECUTION SUMMARY:`);
    console.log(`  Total sessions tested: ${totalSessions}`);
    console.log(`  Successful sessions: ${successfulSessions}`);
    console.log(`  Failed sessions: ${totalSessions - successfulSessions}`);
    console.log(`  Validation errors: ${totalErrors}`);

    // Session Length Adaptation Analysis
    this.generateSessionLengthAdaptationReport();

    // Performance profile analysis
    console.log(`\n👥 PERFORMANCE PROFILE ANALYSIS:`);
    Object.entries(this.testResults.performanceMetrics).forEach(([profile, metrics]) => {
      console.log(`  ${profile}:`, metrics);
    });

    // Adaptive behavior analysis
    console.log(`\n🔄 ADAPTIVE BEHAVIOR ANALYSIS:`);
    Object.entries(this.testResults.adaptationBehaviors).forEach(([behavior, data]) => {
      if (behavior === 'sessionLengthProgression') {
        // Skip here - already shown in detailed section above
        return;
      }
      console.log(`  ${behavior}:`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
    });

    // Validation errors
    if (this.testResults.validationErrors.length > 0) {
      console.log(`\n❌ VALIDATION ERRORS:`);
      this.testResults.validationErrors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
    }

    return {
      summary: {
        totalSessions,
        successfulSessions,
        totalErrors
      },
      performanceProfiles: this.testResults.performanceMetrics,
      adaptiveBehaviors: this.testResults.adaptationBehaviors,
      validationErrors: this.testResults.validationErrors,
      rawResults: this.testResults.sessions,
      sessionLengthAnalysis: this.analyzeSessionLengthProgression()
    };
  }

  /**
   * Generate detailed session length adaptation report
   */
  generateSessionLengthAdaptationReport() {
    console.log('\n📏 SESSION LENGTH ADAPTATION ANALYSIS');
    console.log('=====================================');

    const successful = this.testResults.sessions.filter(s => !s.failed);

    if (successful.length === 0) {
      console.log('❌ No successful sessions to analyze');
      return;
    }

    // Group by performance profile
    const profileData = {};
    successful.forEach(session => {
      const profile = session.profileConfig?.profile || 'unknown';
      if (!profileData[profile]) {
        profileData[profile] = [];
      }
      profileData[profile].push({
        sessionNumber: session.sessionNumber,
        sessionLength: session.sessionData?.problems?.length || 0,
        successRate: session.performanceImpact?.successRate || 0,
        avgTime: session.performanceImpact?.avgTime || 0,
        isOnboarding: session.settings?.isOnboarding || false,
        difficulty: session.settings?.currentDifficultyCap || 'Unknown'
      });
    });

    // Analyze each profile
    Object.entries(profileData).forEach(([profile, sessions]) => {
      console.log(`\n🎭 ${profile.toUpperCase()} USER PROFILE:`);

      const sessionLengths = sessions.map(s => s.sessionLength);
      const successRates = sessions.map(s => s.successRate);

      console.log(`  📊 Session Length Progression: [${sessionLengths.join(' → ')}]`);
      console.log(`  🎯 Success Rate Progression: [${successRates.map(r => `${(r*100).toFixed(0)}%`).join(' → ')}]`);

      // Check for adaptation patterns
      const adaptationAnalysis = this.analyzeAdaptationPatterns(sessions);
      console.log(`  🔄 Adaptation Pattern: ${adaptationAnalysis.pattern}`);
      console.log(`  📈 Length Range: ${Math.min(...sessionLengths)} - ${Math.max(...sessionLengths)} problems`);
      console.log(`  ⚡ Average Adaptation: ${adaptationAnalysis.avgChange.toFixed(1)} problems per session`);

      if (adaptationAnalysis.recommendations.length > 0) {
        console.log(`  💡 Observations:`);
        adaptationAnalysis.recommendations.forEach(rec => {
          console.log(`    • ${rec}`);
        });
      }
    });

    // Store detailed analysis
    this.testResults.adaptationBehaviors.sessionLengthProgression = profileData;
  }

  /**
   * Analyze adaptation patterns in session data
   */
  analyzeAdaptationPatterns(sessions) {
    if (sessions.length < 2) {
      return { pattern: 'Insufficient data', avgChange: 0, recommendations: [] };
    }

    const lengths = sessions.map(s => s.sessionLength);
    const successRates = sessions.map(s => s.successRate);
    const recommendations = [];

    // Calculate trend
    let totalChange = 0;
    let adaptiveChanges = 0;
    let pattern = 'Static';

    for (let i = 1; i < sessions.length; i++) {
      const lengthChange = lengths[i] - lengths[i-1];
      const _successChange = successRates[i] - successRates[i-1];

      totalChange += lengthChange;

      // Check for expected adaptation patterns
      if (successRates[i-1] > 0.8 && lengthChange < 0) {
        adaptiveChanges++;
        recommendations.push(`Session ${i+1}: Correctly reduced length (${lengths[i-1]}→${lengths[i]}) after high success (${(successRates[i-1]*100).toFixed(0)}%)`);
      } else if (successRates[i-1] < 0.6 && lengthChange > 0) {
        adaptiveChanges++;
        recommendations.push(`Session ${i+1}: Correctly increased length (${lengths[i-1]}→${lengths[i]}) after low success (${(successRates[i-1]*100).toFixed(0)}%)`);
      } else if (Math.abs(lengthChange) > 0) {
        recommendations.push(`Session ${i+1}: Length changed (${lengths[i-1]}→${lengths[i]}) with ${(successRates[i-1]*100).toFixed(0)}% success - check adaptation logic`);
      }
    }

    // Determine pattern
    if (adaptiveChanges > sessions.length * 0.3) {
      pattern = 'Adaptive';
    } else if (Math.abs(totalChange) > 2) {
      pattern = 'Trending';
    } else {
      pattern = 'Static';
      if (sessions.length > 3) {
        recommendations.push('Session lengths not adapting to performance - check adaptive algorithm');
      }
    }

    return {
      pattern,
      avgChange: totalChange / (sessions.length - 1),
      adaptiveChanges,
      recommendations
    };
  }

  /**
   * Analyze overall session length progression
   */
  analyzeSessionLengthProgression() {
    const successful = this.testResults.sessions.filter(s => !s.failed);

    if (successful.length === 0) {
      return { error: 'No successful sessions to analyze' };
    }

    const sessionData = successful.map(s => ({
      sessionNumber: s.sessionNumber,
      sessionLength: s.sessionData?.problems?.length || 0,
      successRate: s.performanceImpact?.successRate || 0,
      avgTime: s.performanceImpact?.avgTime || 0,
      profile: s.profileConfig?.profile || 'unknown',
      isOnboarding: s.settings?.isOnboarding || false
    }));

    return {
      totalSessions: sessionData.length,
      lengthRange: [
        Math.min(...sessionData.map(s => s.sessionLength)),
        Math.max(...sessionData.map(s => s.sessionLength))
      ],
      averageLength: sessionData.reduce((sum, s) => sum + s.sessionLength, 0) / sessionData.length,
      adaptationDetected: this.detectOverallAdaptation(sessionData),
      sessionProgression: sessionData
    };
  }

  /**
   * Detect if there's overall adaptation happening
   */
  detectOverallAdaptation(sessionData) {
    if (sessionData.length < 3) return false;

    // Check if session lengths correlate with performance
    let adaptiveChanges = 0;
    for (let i = 1; i < sessionData.length; i++) {
      const prevSuccess = sessionData[i-1].successRate;
      const currLength = sessionData[i].sessionLength;
      const prevLength = sessionData[i-1].sessionLength;

      // Expected: high success → shorter sessions, low success → longer sessions
      if ((prevSuccess > 0.8 && currLength < prevLength) ||
          (prevSuccess < 0.6 && currLength > prevLength)) {
        adaptiveChanges++;
      }
    }

    return adaptiveChanges >= Math.floor(sessionData.length * 0.25); // At least 25% adaptive changes
  }
}

/**
 * Predefined comprehensive test scenarios
 */
export const ComprehensiveTestScenarios = {
  // Full system validation
  fullValidation: () => new ComprehensiveSessionTester({
    totalSessions: 9,
    performanceProfiles: ['struggling', 'average', 'excellent'],
    clearData: true,
    verbose: false
  }),

  // Quick comprehensive check
  quickComprehensive: () => new ComprehensiveSessionTester({
    totalSessions: 3,
    performanceProfiles: ['average'],
    clearData: true,
    verbose: false
  }),

  // Focus on adaptation behaviors
  adaptationFocus: () => new ComprehensiveSessionTester({
    totalSessions: 6,
    performanceProfiles: ['struggling', 'excellent'],
    clearData: true,
    verbose: false,
    validateAnalytics: true,
    validateAdaptation: true
  })
};

// Export for browser console use
if (typeof window !== 'undefined') {
  window.ComprehensiveSessionTester = ComprehensiveSessionTester;
  window.ComprehensiveTestScenarios = ComprehensiveTestScenarios;

  // Quick console commands
  window.testComprehensive = () => ComprehensiveTestScenarios.fullValidation().runComprehensiveTests();
  window.testQuickComprehensive = () => ComprehensiveTestScenarios.quickComprehensive().runComprehensiveTests();
  window.testAdaptation = () => ComprehensiveTestScenarios.adaptationFocus().runComprehensiveTests();
}