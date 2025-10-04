import {
  getSessionById,
  getLatestSession,
  getLatestSessionByType,
  saveSessionToStorage,
  saveNewSessionToDB,
  updateSessionInDB,
  getSessionPerformance,
  getOrCreateSessionAtomic,
  evaluateDifficultyProgression,
} from "../db/sessions.js";
import { updateProblemRelationships } from "../db/problem_relationships.js";
import { ProblemService } from "../services/problemService.js";
import { getTagMastery } from "../db/tag_mastery.js";
import { storeSessionAnalytics, debugGetAllSessionAnalytics } from "../db/sessionAnalytics.js";
import { StorageService } from "./storageService.js";
import { v4 as uuidv4 } from "uuid";
import performanceMonitor from "../utils/PerformanceMonitor.js";
import { IndexedDBRetryService } from "./IndexedDBRetryService.js";
import logger from "../utils/logger.js";
import { roundToPrecision } from "../utils/Utils.js";
import { openDatabase } from "../db/connectionUtils.js";

/**
 * Circuit Breaker for Enhanced Habit Learning Features
 * Provides automatic fallback to current system if enhanced features fail
 */
class HabitLearningCircuitBreaker {
  static isOpen = false;
  static failureCount = 0;
  static MAX_FAILURES = 3;
  static lastFailureTime = null;
  static RECOVERY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  /**
   * Safely execute enhanced habit learning function with fallback
   * @param {Function} enhancedFn - Enhanced habit learning function
   * @param {Function} fallbackFn - Fallback to current logic
   * @param {string} operationName - Name for logging
   * @returns {Promise} Result from enhanced function or fallback
   */
  static async safeExecute(enhancedFn, fallbackFn, operationName = "habit-learning") {
    // Check if circuit breaker should reset (after timeout)
    if (this.isOpen && this.lastFailureTime) {
      const timeSinceFailure = Date.now() - this.lastFailureTime;
      if (timeSinceFailure > this.RECOVERY_TIMEOUT) {
        logger.info(`🔄 Circuit breaker reset for ${operationName} - attempting enhanced logic again`);
        this.isOpen = false;
        this.failureCount = 0;
      }
    }

    // If circuit is open, use fallback immediately
    if (this.isOpen) {
      logger.info(`🚫 Circuit breaker open for ${operationName} - using fallback logic`);
      return await fallbackFn();
    }

    try {
      // Attempt enhanced functionality with timeout
      return await Promise.race([
        enhancedFn(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Enhanced function timeout')), 5000)
        )
      ]);
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      
      logger.warn(`⚠️ Enhanced ${operationName} failed (${this.failureCount}/${this.MAX_FAILURES}):`, error.message);
      
      // Open circuit breaker if failure threshold reached
      if (this.failureCount >= this.MAX_FAILURES) {
        this.isOpen = true;
        logger.error(`🚨 Circuit breaker opened for ${operationName} - enhanced features disabled`);
      }
      
      // Always fall back to current system
      return await fallbackFn();
    }
  }

  /**
   * Get current circuit breaker status for monitoring
   */
  static getStatus() {
    return {
      isOpen: this.isOpen,
      failureCount: this.failureCount,
      maxFailures: this.MAX_FAILURES,
      lastFailureTime: this.lastFailureTime
    };
  }
}

export const SessionService = {
  // IndexedDB retry service for deduplication
  _retryService: new IndexedDBRetryService(),

  /**
   * Checks if a session type is compatible with current settings.
   * @param {Object} session - Session object to check
   * @param {string} expectedSessionType - Expected session type based on current settings
   * @returns {boolean} True if session is compatible with current settings
   */
  isSessionTypeCompatible(session, expectedSessionType) {
    if (!session) return false;
    
    // Normalize types - treat missing sessionType as 'standard'
    const sessionType = session.session_type || 'standard';
    const expected = expectedSessionType || 'standard';
    
    // Define compatibility groups
    const standardModes = ['standard', 'tracking']; // Standard modes (including tracking sessions)
    
    // Interview modes are NOT compatible with each other - each has different constraints
    // interview-like: Limited hints, mild time pressure  
    // full-interview: No hints, strict timing, realistic conditions
    // Each interview mode should create its own dedicated session
    
    // Check if both are in the same compatibility group
    const bothStandard = standardModes.includes(sessionType) && standardModes.includes(expected);
    const exactInterviewMatch = (sessionType === expected) && !standardModes.includes(sessionType);
    
    // Allow mixed compatibility for common cases:
    // - Any session can be resumed as 'standard' (fallback behavior)
    // - 'standard' sessions can be resumed for any request (existing behavior)
    const allowMixedStandard = (sessionType === 'standard' || expected === 'standard');
    
    const compatible = bothStandard || exactInterviewMatch || allowMixedStandard;
    
    if (!compatible) {
      logger.info(`🔍 Session type incompatible: session=${sessionType} vs expected=${expected} (standard: ${bothStandard}, exactInterview: ${exactInterviewMatch}, mixed: ${allowMixedStandard})`);
    } else {
      logger.info(`✅ Session types compatible: ${sessionType} ↔ ${expected} (standard: ${bothStandard}, exactInterview: ${exactInterviewMatch}, mixed: ${allowMixedStandard})`);
    }
    
    return compatible;
  },

  /**
   * Detects session type mismatches that could cause hanging behavior.
   * @param {Object} session - Session to check
   * @param {string} expectedSessionType - Expected type based on current settings
   * @returns {Object} Mismatch info with details for debugging
   */
  detectSessionTypeMismatch(session, expectedSessionType) {
    if (!session) {
      return { hasMismatch: false, reason: 'no_session' };
    }
    
    const sessionType = session.session_type || 'standard';
    const expected = expectedSessionType || 'standard';
    const isCompatible = this.isSessionTypeCompatible(session, expected);
    
    if (!isCompatible) {
      return {
        hasMismatch: true,
        reason: 'type_mismatch',
        sessionType,
        expectedType: expected,
        sessionId: session.id,
        sessionStatus: session.status,
        details: `Session type mismatch: ${sessionType} !== ${expected}`
      };
    }
    
    return { hasMismatch: false, reason: 'compatible' };
  },


  /**
   * Centralizes session performance analysis and tracking.
   * Orchestrates tag mastery, problem relationships, and session metrics.
   * @param {Object} session - The completed session object
   * @returns {Object} Comprehensive session performance summary
   */
  async summarizeSessionPerformance(session) {
    const queryContext = performanceMonitor.startQuery(
      "session_performance_summary",
      {
        operation: "session_creation",
        sessionId: session.id,
        attemptCount: session.attempts?.length || 0,
      }
    );

    logger.info(`📊 Starting performance summary for session ${session.id}`);
    console.log(`🔍 DEBUG: summarizeSessionPerformance ENTRY for session ${session.id}`);

    // Validate session has attempts before processing
    if (!session.attempts || session.attempts.length === 0) {
      logger.warn(`⚠️ Session ${session.id} has no attempts - skipping performance summary`);
      performanceMonitor.endQuery(queryContext, true, 0);
      return {
        session_id: session.id,
        completed_at: new Date().toISOString(),
        performance: {
          accuracy: 0,
          avgTime: 0,
          strongTags: [],
          weakTags: [],
          timingFeedback: {},
          easy: { attempts: 0, correct: 0, time: 0, avgTime: 0 },
          medium: { attempts: 0, correct: 0, time: 0, avgTime: 0 },
          hard: { attempts: 0, correct: 0, time: 0, avgTime: 0 },
        },
        mastery_progression: {
          deltas: [],
          new_masteries: 0,
          decayed_masteries: 0,
        },
        difficulty_analysis: { predominantDifficulty: 'Unknown', totalProblems: 0 },
        insights: { message: 'No attempts recorded in this session' }
      };
    }

    // CRITICAL FIX: Handle ad-hoc sessions with empty problems arrays
    if (!session.problems || session.problems.length === 0) {
      logger.warn(`⚠️ Session ${session.id} has attempts but no problems (ad-hoc session) - using simplified analytics`);

      // Calculate basic metrics from attempts only
      const totalAttempts = session.attempts.length;
      const successfulAttempts = session.attempts.filter(a => a.success).length;
      const accuracy = totalAttempts > 0 ? successfulAttempts / totalAttempts : 0;
      const avgTime = totalAttempts > 0 ?
        session.attempts.reduce((sum, a) => sum + (a.time_spent || 0), 0) / totalAttempts : 0;

      performanceMonitor.endQuery(queryContext, true, 0);
      return {
        session_id: session.id,
        completed_at: new Date().toISOString(),
        performance: {
          accuracy: Math.round(accuracy * 100) / 100,
          avgTime: Math.round(avgTime),
          strongTags: [],
          weakTags: [],
          timingFeedback: {},
          easy: { attempts: 0, correct: 0, time: 0, avgTime: 0 },
          medium: { attempts: 0, correct: 0, time: 0, avgTime: 0 },
          hard: { attempts: 0, correct: 0, time: 0, avgTime: 0 },
        },
        mastery_progression: {
          deltas: [],
          new_masteries: 0,
          decayed_masteries: 0,
        },
        difficulty_analysis: {
          predominantDifficulty: 'Mixed',
          totalProblems: totalAttempts, // Use attempts count as proxy
          percentages: {},
        },
        insights: {
          sessionType: 'ad_hoc',
          message: `Completed ${totalAttempts} ad-hoc problem${totalAttempts !== 1 ? 's' : ''} with ${Math.round(accuracy * 100)}% accuracy`
        },
      };
    }

    try {
      console.log(`🔍 DEBUG: Starting comprehensive session analysis for ${session.id}...`);

      // 1️⃣ Capture pre-session state for delta calculations
      console.log(`🔍 DEBUG: Step 1 - Getting pre-session tag mastery...`);
      const preSessionTagMastery = await getTagMastery();
      const preSessionMasteryMap = new Map(
        (preSessionTagMastery || []).map((tm) => [tm.tag, tm])
      );

      // 2️⃣ Update problem relationships based on session attempts
      logger.info("🔗 Updating problem relationships...");
      await updateProblemRelationships(session);

      // 3️⃣ Get updated tag mastery for delta calculation (mastery updated incrementally per attempt)
      const postSessionTagMastery = await getTagMastery();
      const postSessionMasteryMap = new Map(
        (postSessionTagMastery || []).map((tm) => [tm.tag, tm])
      );

      // 5️⃣ Generate comprehensive session performance metrics
      logger.info("📈 Generating session performance metrics...");
      const unmasteredTags = (postSessionTagMastery || [])
        .filter((tm) => !tm.mastered)
        .map((tm) => tm.tag);

      let performanceMetrics;
      try {
        console.log(`🔍 DEBUG: Calling getSessionPerformance for session ${session.id}...`);
        // Use the fixed getSessionPerformance that now uses the combined index properly
        performanceMetrics = await getSessionPerformance({
          recentSessionsLimit: 1,
          unmasteredTags
        });
        console.log(`✅ DEBUG: getSessionPerformance completed successfully`);
      } catch (performanceError) {
        console.error(`❌ DEBUG: getSessionPerformance failed:`, performanceError);
        logger.warn(`⚠️ Session performance calculation failed, using fallback:`, performanceError);
        performanceMetrics = null;
      }

      // Ensure fallback metrics if performance calculation failed
      performanceMetrics = performanceMetrics || {
        accuracy: 0,
        avgTime: 0,
        strongTags: [],
        weakTags: [],
        timingFeedback: {},
        easy: { attempts: 0, correct: 0, time: 0, avgTime: 0 },
        medium: { attempts: 0, correct: 0, time: 0, avgTime: 0 },
        hard: { attempts: 0, correct: 0, time: 0, avgTime: 0 },
      };

      console.log(`🔍 DEBUG: Performance metrics retrieved:`, {
        accuracy: performanceMetrics.accuracy,
        avgTime: performanceMetrics.avgTime,
        hasStrongTags: !!performanceMetrics.strongTags?.length,
        hasWeakTags: !!performanceMetrics.weakTags?.length,
        easyAttempts: performanceMetrics.easy?.attempts || 0,
        mediumAttempts: performanceMetrics.medium?.attempts || 0,
        hardAttempts: performanceMetrics.hard?.attempts || 0
      });

      // 6️⃣ Calculate mastery progression deltas
      const masteryDeltas = this.calculateMasteryDeltas(
        preSessionMasteryMap,
        postSessionMasteryMap
      );

      // 7️⃣ Analyze session difficulty distribution
      console.log(`🔍 DEBUG: Step 7 - Analyzing session difficulty distribution...`);
      let difficultyMix;
      try {
        difficultyMix = await this.analyzeSessionDifficulty(session);
        console.log(`✅ DEBUG: Difficulty analysis completed`);
      } catch (difficultyError) {
        console.error(`❌ DEBUG: Difficulty analysis failed:`, difficultyError);
        difficultyMix = {
          predominantDifficulty: 'Unknown',
          totalProblems: session.attempts?.length || 0,
          percentages: {}
        };
      }

      // 8️⃣ Create comprehensive summary with snake_case properties
      const sessionSummary = {
        session_id: session.id,
        completed_at: new Date().toISOString(),
        performance: performanceMetrics,
        mastery_progression: {
          deltas: masteryDeltas,
          new_masteries: masteryDeltas.filter(
            (d) => d.masteredChanged && d.postMastered
          ).length,
          decayed_masteries: masteryDeltas.filter(
            (d) => d.masteredChanged && !d.postMastered
          ).length,
        },
        difficulty_analysis: difficultyMix,
        insights: this.generateSessionInsights(
          performanceMetrics,
          masteryDeltas,
          difficultyMix
        ),
      };

      // 9️⃣ Store session analytics in dedicated IndexedDB store
      console.log(`🔍 REAL SESSION DEBUG: About to call storeSessionAnalytics for ACTUAL session ${session.id}`);
      console.log(`🔍 REAL SESSION DEBUG: SessionSummary structure:`, {
        session_id: sessionSummary.session_id,
        completed_at: sessionSummary.completed_at,
        performance: {
          accuracy: sessionSummary.performance?.accuracy,
          avgTime: sessionSummary.performance?.avgTime,
          hasEasy: !!sessionSummary.performance?.Easy,
          hasMedium: !!sessionSummary.performance?.Medium,
          hasHard: !!sessionSummary.performance?.Hard
        },
        mastery_progression: {
          new_masteries: sessionSummary.mastery_progression?.new_masteries,
          decayed_masteries: sessionSummary.mastery_progression?.decayed_masteries,
          deltasCount: sessionSummary.mastery_progression?.deltas?.length || 0
        },
        difficulty_analysis: {
          predominantDifficulty: sessionSummary.difficulty_analysis?.predominantDifficulty,
          totalProblems: sessionSummary.difficulty_analysis?.totalProblems
        }
      });

      // 🔟 Update session state with performance data FIRST (before analytics to ensure it happens)
      try {
        await this.updateSessionStateWithPerformance(session, sessionSummary);
        console.log(`✅ REAL SESSION DEBUG: updateSessionStateWithPerformance completed successfully for session ${session.id}`);
      } catch (stateUpdateError) {
        console.error(`❌ REAL SESSION DEBUG: updateSessionStateWithPerformance failed for session ${session.id}:`, stateUpdateError);
        logger.error(`❌ Failed to update session state for session ${session.id}:`, stateUpdateError);
      }

      try {
        await storeSessionAnalytics(sessionSummary);
        console.log(`✅ REAL SESSION DEBUG: storeSessionAnalytics completed successfully for ACTUAL session ${session.id}`);

        // Verify storage by checking all analytics
        await debugGetAllSessionAnalytics();
        console.log(`🔍 REAL SESSION DEBUG: debugGetAllSessionAnalytics completed, continuing to next step...`);
      } catch (analyticsError) {
        logger.error(`❌ Failed to store session analytics for session ${session.id}:`, analyticsError);
        logger.error(`❌ SessionSummary data:`, {
          session_id: sessionSummary?.session_id,
          completed_at: sessionSummary?.completed_at,
          hasPerformance: !!sessionSummary?.performance,
          performanceKeys: sessionSummary?.performance ? Object.keys(sessionSummary.performance) : [],
          hasDifficulty: !!sessionSummary?.difficulty_analysis,
          hasMastery: !!sessionSummary?.mastery_progression
        });
        // Continue execution - don't fail entire session completion for analytics errors
      }

      // 🔟 Log structured analytics for dashboard integration (Chrome storage backup)
      console.log(`🔍 REAL SESSION DEBUG: About to call logSessionAnalytics for session ${session.id}`);
      this.logSessionAnalytics(sessionSummary);
      console.log(`🔍 REAL SESSION DEBUG: logSessionAnalytics completed for session ${session.id}`);

      logger.info(
        `✅ Session performance summary completed for ${session.id}`
      );

      performanceMonitor.endQuery(
        queryContext,
        true,
        Object.keys(sessionSummary).length
      );


      return sessionSummary;
    } catch (error) {
      logger.error(
        `❌ Error summarizing session performance for ${session.id}:`,
        error
      );
      performanceMonitor.endQuery(queryContext, false, 0, error);
      throw error;
    }
  },

  /**
   * Checks if all session problems are attempted and marks the session as complete.
   */
  async checkAndCompleteSession(sessionId) {
    // Validate sessionId before database call
    if (!sessionId) {
      logger.error(`❌ checkAndCompleteSession called with invalid sessionId:`, sessionId);
      return false;
    }

    const session = await getSessionById(sessionId);
    if (!session) {
      logger.error(`❌ Session ${sessionId} not found.`);
      return false;
    }

    // If session is already completed, return empty array immediately
    if (session.status === "completed") {
      logger.info(`✅ Session ${sessionId} already completed.`);
      return [];
    }

    // Get all attempts related to this session - handle multiple ID formats
    const attemptedProblemIds = new Set(
      session.attempts.map((a) => a.problemId || a.leetcode_id || a.id)
    );

    // Check if all scheduled problems have been attempted - handle multiple ID formats
    const unattemptedProblems = session.problems.filter((problem) => {
      const problemId = problem.problem_id || problem.leetcode_id || problem.id;
      return !attemptedProblemIds.has(problemId);
    });

    logger.info("📎 Unattempted Problems:", unattemptedProblems);

    if (unattemptedProblems.length === 0) {
      // ✅ Mark session as completed and calculate accuracy
      session.status = "completed";

      // Calculate and store accuracy: successful attempts / total attempts
      const totalAttempts = session.attempts.length;
      const successfulAttempts = session.attempts.filter(a => a.success).length;
      session.accuracy = totalAttempts > 0 ? successfulAttempts / totalAttempts : 0;

      // Calculate total time spent
      session.duration = session.attempts.reduce((sum, a) => sum + (a.time_spent || 0), 0) / 60; // Convert to minutes

      // 🐛 DEBUG: Log accuracy calculation details
      console.log(`🎯 ACCURACY CALCULATION DEBUG:`, {
        sessionId: sessionId,
        totalAttempts: totalAttempts,
        successfulAttempts: successfulAttempts,
        calculatedAccuracy: session.accuracy,
        percentageAccuracy: Math.round(session.accuracy * 100) + '%',
        attemptsDetails: session.attempts.map(a => ({
          attempt_id: a.attempt_id,
          leetcode_id: a.leetcode_id,
          success: a.success,
          success_type: typeof a.success
        }))
      });

      await updateSessionInDB(session);

      logger.info(`✅ Session ${sessionId} marked as completed with ${Math.round(session.accuracy * 100)}% accuracy.`);

      // ✅ CRITICAL FIX: Update session state to increment numSessionsCompleted
      try {
        const sessionState = await StorageService.getSessionState("session_state") || {
          id: "session_state",
          num_sessions_completed: 0
        };
        sessionState.num_sessions_completed = (sessionState.num_sessions_completed || 0) + 1;
        sessionState.last_session_date = new Date().toISOString();

        // ✅ Update session state with performance metrics for focus expansion
        const previousAccuracy = sessionState.last_performance?.accuracy || 0;
        const currentAccuracy = session.accuracy || 0;

        sessionState.last_performance = {
          accuracy: currentAccuracy,
          efficiency_score: currentAccuracy // Use accuracy as proxy for efficiency
        };

        // ✅ Track last_progress_date when meaningful progress occurs
        const hasProgress = currentAccuracy > previousAccuracy || currentAccuracy >= 0.8;
        if (hasProgress) {
          sessionState.last_progress_date = new Date().toISOString();
        }

        // ✅ Call FocusCoordinationService to update focus tags based on performance
        try {
          const { FocusCoordinationService } = await import('./focusCoordinationService.js');
          const focusDecision = await FocusCoordinationService.getFocusDecision("session_state");
          const updatedSessionState = FocusCoordinationService.updateSessionState(sessionState, focusDecision);

          await StorageService.setSessionState("session_state", updatedSessionState);
          logger.info(`✅ Session state updated: num_sessions_completed = ${updatedSessionState.num_sessions_completed}, focus_tags = ${updatedSessionState.current_focus_tags?.join(', ')}, performance_level = ${updatedSessionState.performance_level}, progress = ${hasProgress}`);
        } catch (focusError) {
          logger.error("❌ Failed to update focus tags, using basic session state:", focusError);
          await StorageService.setSessionState("session_state", sessionState);
          logger.info(`✅ Session state updated (without focus update): num_sessions_completed = ${sessionState.num_sessions_completed}`);
        }
      } catch (error) {
        logger.error("❌ Failed to update session state:", error);
      }

      // ✅ Clear session cache since session status changed
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          // Handle both sync errors and async promise rejections
          const result = chrome.runtime.sendMessage({ type: "clearSessionCache" });
          if (result && typeof result.catch === 'function') {
            result.catch((error) => {
              logger.warn("Failed to clear session cache (async):", error);
            });
          }
        }
      } catch (error) {
        logger.warn("Failed to clear session cache (sync):", error);
      }

      // Clear cached data for functions that still use caching (focus areas, learning paths)
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          const result = chrome.runtime.sendMessage({ type: "invalidateDashboardOnSessionComplete" });
          if (result && typeof result.catch === 'function') {
            result.catch((error) => {
              logger.warn("Failed to clear cached analytics (async):", error);
            });
          }
          logger.info(`📊 Cached analytics cleared for completed session ${sessionId}`);
        }
      } catch (error) {
        logger.warn("Failed to clear cached analytics (sync):", error);
      }

      // ✅ Run centralized session performance analysis
      console.log(`🔍 DEBUG: About to call summarizeSessionPerformance for session ${session.id}`);
      try {
        await this.summarizeSessionPerformance(session);
        console.log(`✅ DEBUG: summarizeSessionPerformance completed successfully for session ${session.id}`);
      } catch (performanceError) {
        logger.error(`❌ Failed to summarize session performance for session ${session.id}:`, performanceError);
        logger.error(`❌ Session data:`, {
          sessionId: session?.id,
          hasAttempts: !!session?.attempts,
          attemptCount: session?.attempts?.length || 0,
          sessionStatus: session?.status
        });
        // Continue execution - don't fail session completion for performance analysis errors
      }
    }
    return unattemptedProblems;
  },

  // NOTE: checkAndCompleteInterviewSession removed - using unified checkAndCompleteSession for all session types

  // NEW: Check if interview session should be created based on frequency
  async shouldCreateInterviewSession(frequency, _mode) {
    if (!frequency || frequency === "manual") {
      return false; // Manual frequency never auto-creates
    }

    try {
      const latestSession = await getLatestSession();
      
      if (frequency === "weekly") {
        // Check if 7+ days have passed since last interview session
        if (!latestSession || !latestSession.session_type) {
          return true; // No previous interview session
        }
        
        const lastInterviewDate = new Date(latestSession.date);
        const daysSinceLastInterview = (Date.now() - lastInterviewDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceLastInterview >= 7;
      }
      
      if (frequency === "level-up") {
        // TODO: Check for recent tag mastery improvements
        // For now, return false to prevent auto-creation
        // This should be triggered by mastery achievement events
        return false;
      }
      
      return false;
    } catch (error) {
      logger.error("Error checking interview session frequency:", error);
      return false;
    }
  },

  // NOTE: createInterviewSession removed - using unified createNewSession() instead

  // NEW: Interview performance summary (extends standard performance analysis)
  async summarizeInterviewPerformance(session) {
    try {
      // Get standard session summary first
      const standardSummary = await this.summarizeSessionPerformance(session);
      
      if (!session.interviewMetrics) {
        logger.warn("No interview metrics available for session summary");
        return standardSummary;
      }

      // Add interview-specific analysis
      const interviewSummary = {
        ...standardSummary,
        interviewAnalysis: {
          mode: session.session_type,
          transferReadinessScore: session.interviewMetrics.transferReadinessScore,
          interventionNeedScore: session.interviewMetrics.interventionNeedScore,
          overallMetrics: session.interviewMetrics.overallMetrics,
          feedback: session.interviewMetrics.feedbackGenerated,
          tagPerformance: Array.from(session.interviewMetrics.tagPerformance.entries())
        }
      };

      // Store interview analytics
      await this.storeInterviewAnalytics(interviewSummary);
      
      logger.info("📊 Interview session analysis complete:", {
        sessionId: session.id,
        mode: session.session_type,
        transferReadiness: session.interviewMetrics.transferReadinessScore,
        feedbackItems: session.interviewMetrics.feedbackGenerated
      });
      
      return interviewSummary;
      
    } catch (error) {
      logger.error("Error summarizing interview performance:", error);
      // Fallback to standard summary
      return this.summarizeSessionPerformance(session);
    }
  },

  // NEW: Store interview analytics for dashboard
  storeInterviewAnalytics(interviewSummary) {
    try {
      if (typeof chrome !== "undefined" && chrome.storage) {
        chrome.storage.local.get(["interviewAnalytics"], (result) => {
          const analytics = result.interviewAnalytics || [];
          
          const interviewEvent = {
            timestamp: interviewSummary.completedAt,
            type: "interview_session_completed",
            sessionId: interviewSummary.sessionId,
            mode: interviewSummary.interviewAnalysis.mode,
            transferMetrics: interviewSummary.interviewAnalysis.overallMetrics,
            readinessScore: interviewSummary.interviewAnalysis.transferReadinessScore,
            feedback: interviewSummary.interviewAnalysis.feedback
          };
          
          analytics.push(interviewEvent);
          
          // Keep only last 30 interview analytics
          const recentAnalytics = analytics.slice(-30);
          chrome.storage.local.set({ interviewAnalytics: recentAnalytics });
        });
      }
    } catch (error) {
      logger.error("Error storing interview analytics:", error);
    }
  },

  // NEW: Get tag performance baselines for transfer metrics
  async getTagPerformanceBaselines() {
    try {
      // Get recent session performance data to establish baselines
      const _recentPerformance = await getSessionPerformance({ 
        recentSessionsLimit: 10 
      });
      
      const tagMastery = await getTagMastery();
      const baselines = {};
      
      // Build baselines from tag mastery data
      tagMastery.forEach(tm => {
        if (tm.totalAttempts > 0) {
          baselines[tm.tag] = {
            avgTime: tm.avgTime || 1200000, // Default 20 minutes if no data
            successRate: tm.successfulAttempts / tm.totalAttempts,
            attempts: tm.totalAttempts
          };
        }
      });
      
      return baselines;
    } catch (error) {
      logger.error("Error getting tag performance baselines:", error);
      return {};
    }
  },

  /**
   * Attempts to resume an existing in-progress session using efficient database queries.
   * Now includes session type compatibility validation to prevent hanging behavior.
   * @param {string} [sessionType] - Optional session type to filter by ('interview-like', 'full-interview', etc.)
   * @returns {Promise<Object|null>} - Session object or null if no resumable session
   */
  async resumeSession(sessionType = null) {
    logger.info(`🔍 resumeSession ENTRY: sessionType=${sessionType}`);
    
    // Look for both in_progress and draft sessions (guided sessions can be in draft status)
    logger.info(`🔍 Calling getLatestSessionByType for in_progress sessions...`);
    let latestSession = await getLatestSessionByType(sessionType, "in_progress");
    
    // If no in_progress session, look for draft sessions (for guided sessions)
    if (!latestSession) {
      logger.info(`🔍 No in_progress session found, checking for draft sessions...`);
      latestSession = await getLatestSessionByType(sessionType, "draft");
    }
    logger.info(`🔍 resumeSession getLatestSessionByType result:`, {
      found: !!latestSession,
      id: latestSession?.id?.substring(0, 8) + '...',
      session_type: latestSession?.session_type || 'undefined',
      status: latestSession?.status || 'undefined',
      lastActivity: latestSession?.last_activity_time || latestSession?.date || 'undefined'
    });

    if (latestSession) {
      // ✨ NEW: Validate session type compatibility before resuming
      logger.info(`🔍 Checking session compatibility for resume...`);
      const mismatchInfo = this.detectSessionTypeMismatch(latestSession, sessionType);
      logger.info(`🔍 Resume compatibility result:`, mismatchInfo);
      
      if (mismatchInfo.hasMismatch) {
        logger.warn(`🚫 BLOCKING SESSION RESUME due to type mismatch:`, {
          details: mismatchInfo.details,
          sessionId: latestSession.id?.substring(0, 8) + '...',
          currentSessionType: mismatchInfo.sessionType,
          expectedType: mismatchInfo.expectedType,
          reason: mismatchInfo.reason
        });
        logger.info(`🔄 Will create NEW session instead of resuming existing incompatible session`);
        return null; // Fail fast instead of trying to resume incompatible session
      }
      
      logger.info(`✅ Resuming existing ${sessionType || 'any'} session:`, latestSession.id);
      
      // Add currentProblemIndex to track progress if missing
      if (!latestSession.currentProblemIndex) {
        latestSession.currentProblemIndex = 0;
      }
      
      logger.info(`🔍 Calling saveSessionToStorage...`);
      await saveSessionToStorage(latestSession);
      logger.info(`✅ Session saved to storage successfully`);
      return latestSession; // Resume compatible sessions
    }

    logger.info(`🔄 No resumable ${sessionType || 'any'} session found`);
    return null;
  },

  /**
   * Creates a new session with fresh problems.
   * @param {string} sessionType - Session type ('standard', 'interview-like', 'full-interview')
   * @param {string} status - Initial status ('in_progress' for user-initiated, 'draft' for auto-generated)
   * @returns {Promise<Object|null>} - Session object or null on failure
   */
  async createNewSession(sessionType = 'standard', status = 'in_progress') {
    const queryContext = performanceMonitor.startQuery("createNewSession", {
      operation: "session_creation",
      sessionType,
      initialStatus: status
    });

    try {
      logger.info(`📌 Creating new ${sessionType} session with status: ${status}`);

      // Enforce one active session per type: mark existing in_progress/draft sessions as completed
      logger.info(`🔍 Checking for existing active ${sessionType} sessions to mark as completed...`);
      
      const existingInProgress = await getLatestSessionByType(sessionType, "in_progress");
      if (existingInProgress) {
        logger.info(`⏹️ Marking existing in_progress ${sessionType} session as completed:`, existingInProgress.id.substring(0, 8));
        existingInProgress.status = "completed";
        existingInProgress.last_activity_time = new Date().toISOString();
        await updateSessionInDB(existingInProgress);
      }

      const existingDraft = await getLatestSessionByType(sessionType, "draft");
      if (existingDraft && existingDraft.id !== existingInProgress?.id) {
        logger.info(`⏹️ Marking existing draft ${sessionType} session as completed:`, existingDraft.id.substring(0, 8));
        existingDraft.status = "completed";
        existingDraft.last_activity_time = new Date().toISOString();
        await updateSessionInDB(existingDraft);
      }

      // Use appropriate service based on session type
      logger.info(`🎯 SESSION SERVICE: Creating ${sessionType} session`);
      let sessionData;
      if (sessionType === 'standard') {
        logger.info("🎯 Calling ProblemService.createSession() for standard session");
        const problems = await ProblemService.createSession();
        sessionData = {
          problems: problems,
          session_type: 'standard'
        };
        logger.info("🎯 Standard session data created:", { problemCount: problems?.length });
      } else {
        logger.info(`🎯 Calling ProblemService.createInterviewSession(${sessionType}) for interview session`);
        // Interview session returns structured data
        sessionData = await ProblemService.createInterviewSession(sessionType);
        logger.info("🎯 Interview session data created:", {
          session_type: sessionData?.session_type,
          problemCount: sessionData?.problems?.length,
          hasConfig: !!sessionData?.interviewConfig
        });
      }
      
      logger.info("📌 sessionData for new session:", sessionData);

      const problems = sessionData.problems || [];
      if (!problems || problems.length === 0) {
        logger.error("❌ No problems fetched for the new session.");
        performanceMonitor.endQuery(queryContext, true, 0);
        return null;
      }

      const newSession = {
        id: uuidv4(),
        date: new Date().toISOString(),
        status: status, // Use provided status (draft or in_progress)
        origin: "generator", // Always generator for guided sessions
        last_activity_time: new Date().toISOString(),
        problems: problems,
        attempts: [],
        current_problem_index: 0,
        session_type: sessionType,
        
        // Add interview-specific fields if it's an interview session
        ...(sessionType !== 'standard' && sessionData.interviewConfig && {
          interviewConfig: sessionData.interviewConfig,
          interviewMetrics: sessionData.interviewMetrics,
          createdAt: sessionData.createdAt
        })
      };

      logger.info("📌 newSession:", newSession);

      // Use retry service with deduplication for session creation
      await this._retryService.executeWithRetry(
        () => saveNewSessionToDB(newSession),
        {
          operationName: "saveNewSessionToDB",
          deduplicationKey: `session-creation-${newSession.id}`,
          timeout: this._retryService.quickTimeout
        }
      );
      
      await this._retryService.executeWithRetry(
        () => saveSessionToStorage(newSession),
        {
          operationName: "saveSessionToStorage", 
          deduplicationKey: `session-storage-${newSession.id}`,
          timeout: this._retryService.quickTimeout
        }
      );

      // Update session creation timestamp for cooldown management

      logger.info("✅ New session created and stored:", newSession);
      performanceMonitor.endQuery(
        queryContext,
        true,
        newSession.problems.length
      );
      return newSession; // Return full session object
    } catch (error) {
      performanceMonitor.endQuery(queryContext, false, 0, error);
      throw error;
    }
  },

  /**
   * Retrieves an existing session or creates a new one if none exists.
   * @param {string} sessionType - Type of session ('standard', 'interview-like', 'full-interview')
   * @returns {Promise<Object|null>} Session object or null on failure
   */
  async getOrCreateSession(sessionType = 'standard') {
    logger.info(`🎯 getOrCreateSession called for ${sessionType}`);
    return await this._doGetOrCreateSession(sessionType);
  },

  async _doGetOrCreateSession(sessionType = 'standard') {
    logger.info(`🔍 _doGetOrCreateSession ENTRY: sessionType=${sessionType}`);
    
    logger.info(`🔍 Getting settings...`);
    // Skip migration - just get settings directly (has built-in fallbacks and defaults)
    const _settings = await StorageService.getSettings();
    logger.info(`✅ Settings loaded successfully`);
    // StorageService.getSettings() always returns settings (defaults if needed), no null check required

    // Try atomic resume/create to prevent race conditions
    logger.info(`🔍 Attempting atomic resume or create for ${sessionType}...`);

    // First try to find existing in_progress sessions
    let session = await getOrCreateSessionAtomic(sessionType, 'in_progress', null);
    if (session) {
      logger.info("✅ Found existing in_progress session:", session.id);
      return session;
    }

    // Then try draft sessions
    session = await getOrCreateSessionAtomic(sessionType, 'draft', null);
    if (session) {
      logger.info("✅ Found existing draft session:", session.id);
      return session;
    }

    logger.info(`🆕 No existing session found, creating new ${sessionType} session`);

    // Generated/Guided sessions should start as draft - they only become in_progress after first problem completion
    const newSession = await this.createNewSession(sessionType, 'draft');

    logger.info(`✅ New session created:`, newSession?.id);
    return newSession;
  },

  // Removed getDraftSession and startSession - sessions auto-start immediately now

  /**
   * Helper method to classify interview sessions
   */
  _classifyInterviewSession(hoursStale, attemptCount) {
    if (hoursStale > 3) {
      if (attemptCount === 0 && hoursStale > 6) {
        return 'interview_abandoned';
      }
      return 'interview_stale';
    }
    return 'interview_active';
  },

  /**
   * Helper method to classify tracking sessions
   */
  _classifyTrackingSession(hoursStale) {
    if (hoursStale > 6) {
      return 'tracking_stale';
    }
    return 'tracking_active';
  },

  /**
   * Helper method to classify generator sessions
   */
  _classifyGeneratorSession(session, metrics) {
    const { hoursStale, attemptCount, progressRatio, sessionProblemsAttempted, outsideSessionAttempts } = metrics;
    if (session.status === 'draft' && hoursStale > 2) {
      return 'draft_expired';
    }
    
    if (attemptCount === 0 && hoursStale > 24) {
      return 'abandoned_at_start';
    }
    
    if (progressRatio >= 0.8 && hoursStale > 12) {
      return 'auto_complete_candidate';
    }
    
    if (attemptCount > 0 && hoursStale > 48) {
      return 'stalled_with_progress';
    }
    
    if (outsideSessionAttempts > 0 && sessionProblemsAttempted === 0 && hoursStale > 12) {
      return 'tracking_only_user';
    }
    
    return null;
  },

  /**
   * Multi-factor session classification for intelligent cleanup
   * Determines session health and appropriate actions based on multiple factors
   */
  classifySessionState(session) {
    const now = Date.now();
    const lastActivity = new Date(session.last_activity_time || session.date);
    const hoursStale = (now - lastActivity.getTime()) / (1000 * 60 * 60);
    
    const attemptCount = session.attempts?.length || 0;
    const totalProblems = session.problems?.length || 0;
    const progressRatio = totalProblems > 0 ? attemptCount / totalProblems : 0;
    
    // Get attempts that match session problems vs independent attempts
    const sessionProblemsAttempted = session.attempts?.filter(attempt => 
      session.problems?.some(p => 
        p.id === attempt.problemId || 
        p.leetcode_id === attempt.problemId ||
        p.problem_id === attempt.problemId
      )
    ).length || 0;
    const outsideSessionAttempts = attemptCount - sessionProblemsAttempted;
    
    logger.info(`🔍 Classifying session ${session.id}:`, {
      origin: session.origin,
      status: session.status,
      hoursStale: Math.round(hoursStale * 10) / 10,
      attemptCount,
      sessionProblemsAttempted,
      outsideSessionAttempts,
      progressRatio: roundToPrecision(progressRatio)
    });
    
    // Active sessions - use interview-aware thresholds
    const activeThreshold = (session.session_type === 'interview-like' || session.session_type === 'full-interview') ? 3 : 6;
    if (hoursStale < activeThreshold || session.status === "completed") {
      return "active";
    }
    
    // Interview session classification - different thresholds for time-sensitive practice
    if (session.session_type && (session.session_type === 'interview-like' || session.session_type === 'full-interview')) {
      return this._classifyInterviewSession(hoursStale, attemptCount);
    }
    
    // Tracking session classification
    if (session.origin === 'tracking') {
      return this._classifyTrackingSession(hoursStale);
    }
    
    // Guided session classification
    if (session.origin === 'generator') {
      const result = this._classifyGeneratorSession(session, { 
        hoursStale, attemptCount, progressRatio, sessionProblemsAttempted, outsideSessionAttempts 
      });
      if (result) {
        return result;
      }
    }
    
    return 'unclear';
  },

  /**
   * Detect all stalled sessions using classification
   */
  async detectStalledSessions() {
    logger.info('🔍 Detecting stalled sessions...');
    
    const allSessions = await this.getAllSessionsFromDB();
    const stalledSessions = [];
    
    for (const session of allSessions) {
      const classification = this.classifySessionState(session);
      
      if (!['active', 'unclear'].includes(classification)) {
        stalledSessions.push({
          session,
          classification,
          action: this.getRecommendedAction(classification)
        });
      }
    }
    
    logger.info(`Found ${stalledSessions.length} stalled sessions:`, 
      stalledSessions.map(s => `${s.session.id.substring(0,8)}:${s.classification}`)
    );
    
    return stalledSessions;
  },

  /**
   * Get recommended action for each classification
   */
  getRecommendedAction(classification) {
    const actions = {
      'draft_expired': 'expire',
      'abandoned_at_start': 'expire', 
      'auto_complete_candidate': 'auto_complete',
      'stalled_with_progress': 'flag_for_user_choice',
      'tracking_stale': 'create_new_tracking',
      'tracking_only_user': 'refresh_guided_session',
      // Interview-specific actions
      'interview_stale': 'flag_for_user_choice', // Show regeneration banner
      'interview_abandoned': 'expire' // Clean up abandoned interview sessions
    };
    
    return actions[classification] || 'no_action';
  },

  /**
   * Helper to get all sessions from database
   */
  async getAllSessionsFromDB() {
    try {
      const db = await openDatabase();
      if (!db) {
        logger.error('❌ Database not initialized');
        return [];
      }
      
      const transaction = db.transaction(['sessions'], 'readonly');
      const store = transaction.objectStore('sessions');
      
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => {
          logger.error('❌ Failed to get sessions from DB:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      logger.error('❌ Error accessing sessions DB:', error);
      return [];
    }
  },

  /**
   * Generate adaptive session from recent tracking attempts
   * Used to create personalized guided sessions based on actual usage patterns
   * Now creates sessions that auto-start when accessed
   */
  async generateSessionFromTrackingActivity(recentAttempts) {
    logger.info(`🎯 Generating session from ${recentAttempts.length} recent tracking attempts`);
    
    // Analyze attempt patterns to build adaptive config
    const problemIds = [...new Set(recentAttempts.map(a => a.problemId))];
    const difficulties = recentAttempts.map(a => a.difficulty || 'Medium');
    const tags = recentAttempts.flatMap(a => a.tags || []);
    
    // Build difficulty distribution
    const difficultyCount = difficulties.reduce((acc, d) => {
      acc[d] = (acc[d] || 0) + 1;
      return acc;
    }, {});
    
    // Build tag frequency for focus areas
    const tagFrequency = tags.reduce((acc, tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {});
    
    const topTags = Object.entries(tagFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([tag]) => tag);
    
    logger.info('Tracking activity analysis:', {
      uniqueProblems: problemIds.length,
      topDifficulty: Object.keys(difficultyCount).reduce((a, b) => 
        difficultyCount[a] > difficultyCount[b] ? a : b
      ),
      topTags
    });
    
    // Use existing adaptive session logic but seed with tracking patterns
    const adaptiveConfig = {
      sessionLength: Math.min(Math.max(5, problemIds.length), 12), // 5-12 problems (optimal range)
      difficultyDistribution: difficultyCount,
      focusAreas: topTags,
      seedFromAttempts: problemIds
    };
    
    // Generate problems using existing ProblemService logic
    const sessionProblems = await ProblemService.createSessionWithConfig(adaptiveConfig);
    
    // Generate session ID with UID prefix for forensic database tracking during tests
    const baseSessionId = uuidv4();
    const sessionId = (globalThis._testDatabaseActive && globalThis._testDatabaseHelper?.testSessionUID)
      ? `${globalThis._testDatabaseHelper.testSessionUID}_${baseSessionId}`
      : baseSessionId;

    const generatedSession = {
      id: sessionId,
      date: new Date().toISOString(),
      ...sessionProblems,
      status: 'in_progress', // Auto-start generated sessions
      origin: 'generator',
      last_activity_time: new Date().toISOString(),
      attempts: [],
      current_problem_index: 0,
      session_type: 'standard',
      metadata: {
        generatedFromTracking: true,
        sourceAttempts: problemIds,
        analysisData: {
          attemptCount: recentAttempts.length,
          uniqueProblems: problemIds.length,
          topDifficulty: Object.keys(difficultyCount).reduce((a, b) => 
            difficultyCount[a] > difficultyCount[b] ? a : b
          ),
          topTags
        }
      }
    };
    
    await saveNewSessionToDB(generatedSession);
    logger.info(`🆕 Generated in_progress session from tracking: ${generatedSession.id}`);
    
    return generatedSession;
  },

  /**
   * Check if we should generate a session from recent tracking activity
   * Called periodically to monitor for auto-generation opportunities
   */
  async checkAndGenerateFromTracking() {
    logger.info('🔍 Checking for session generation opportunities from tracking activity');
    
    try {
      // Get recent attempts from tracking sessions (last 48 hours)
      const recentAttempts = await this.getRecentTrackingAttempts(48);
      
      if (recentAttempts.length < 4) {
        logger.info(`Not enough tracking activity: ${recentAttempts.length} attempts (need ≥4)`);
        return null;
      }
      
      // Check if there's already an active session to avoid creating duplicates
      const existingSession = await this.resumeSession('standard');
      if (existingSession) {
        logger.info('Active session already exists, skipping auto-generation');
        return null;
      }
      
      // Generate session from tracking patterns
      const generatedSession = await this.generateSessionFromTrackingActivity(recentAttempts);
      
      logger.info('✅ Auto-generated guided session from tracking activity');
      return generatedSession;
      
    } catch (error) {
      logger.error('❌ Failed to check/generate session from tracking:', error);
      return null;
    }
  },

  /**
   * Get recent attempts from tracking sessions within specified hours
   */
  async getRecentTrackingAttempts(withinHours = 48) {
    const cutoffTime = new Date(Date.now() - (withinHours * 60 * 60 * 1000));
    
    const db = await openDatabase();
    const transaction = db.transaction(['attempts', 'sessions'], 'readonly');
    const attemptStore = transaction.objectStore('attempts');
    const sessionStore = transaction.objectStore('sessions');
    
    // Get all attempts within time window
    const allAttempts = await new Promise((resolve, reject) => {
      const request = attemptStore.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    // Get all sessions to identify tracking sessions
    const allSessions = await new Promise((resolve, reject) => {
      const request = sessionStore.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    // Filter to tracking sessions
    const trackingSessionIds = new Set(
      allSessions
        .filter(s => s.origin === 'tracking')
        .map(s => s.id)
    );
    
    // Filter attempts to recent tracking attempts only
    const recentTrackingAttempts = allAttempts.filter(attempt => {
      const attemptDate = new Date(attempt.date);
      return attemptDate >= cutoffTime && 
             trackingSessionIds.has(attempt.SessionID);
    });
    
    logger.info(`Found ${recentTrackingAttempts.length} recent tracking attempts`);
    return recentTrackingAttempts;
  },

  /**
   * Refresh/regenerate current session with new problems
   */
  async refreshSession(sessionType = 'standard', forceNew = false) {
    logger.info(`🔄 Refreshing ${sessionType} session (forceNew: ${forceNew})`);
    
    // Mark current session as expired if it exists
    const currentSession = await this.resumeSession(sessionType);
    if (currentSession && forceNew) {
      currentSession.status = 'expired';
      currentSession.last_activity_time = new Date().toISOString();
      await updateSessionInDB(currentSession);
      logger.info(`Marked session ${currentSession.id} as expired`);
    }
    
    // Create fresh session
    const newSession = await this.createNewSession(sessionType);
    logger.info(`✅ Created fresh ${sessionType} session: ${newSession.id}`);
    
    return newSession;
  },

  /**
   * Skips a problem from the session.
   */
  async skipProblem(leetCodeID) {
    const session = await getLatestSession();
    if (!session) return null;

    session.problems = session.problems.filter(
      (p) => p.leetcode_id !== leetCodeID
    );
    await saveSessionToStorage(session, true);
    return session;
  },

  /**
   * Calculates mastery progression deltas between pre and post session states.
   * @param {Map} preSessionMap - Tag mastery before session
   * @param {Map} postSessionMap - Tag mastery after session
   * @returns {Array} Array of mastery delta objects
   */
  calculateMasteryDeltas(preSessionMap, postSessionMap) {
    const deltas = [];

    // Check all tags that exist in either pre or post session
    const allTags = new Set([
      ...preSessionMap.keys(),
      ...postSessionMap.keys(),
    ]);

    for (const tag of allTags) {
      const preData = preSessionMap.get(tag);
      const postData = postSessionMap.get(tag);

      if (!preData && postData) {
        // New tag discovered
        deltas.push({
          tag,
          type: "new",
          preMastered: false,
          postMastered: postData.mastered || false,
          masteredChanged: postData.mastered || false,
          strengthDelta: postData.totalAttempts || 0,
          decayDelta: (postData.decayScore || 1) - 1,
        });
      } else if (preData && postData) {
        // Existing tag updated
        const masteredChanged =
          (preData.mastered || false) !== (postData.mastered || false);
        deltas.push({
          tag,
          type: "updated",
          preMastered: preData.mastered || false,
          postMastered: postData.mastered || false,
          masteredChanged,
          strengthDelta:
            (postData.totalAttempts || 0) - (preData.totalAttempts || 0),
          decayDelta: (postData.decayScore || 1) - (preData.decayScore || 1),
        });
      }
    }

    return deltas.filter((d) => d.strengthDelta > 0 || d.masteredChanged);
  },

  /**
   * Analyzes the difficulty distribution of problems in the session.
   * @param {Object} session - The session object
   * @returns {Object} Difficulty analysis with counts and percentages
   */
  async analyzeSessionDifficulty(session) {
    const difficultyCount = { Easy: 0, Medium: 0, Hard: 0 };
    const totalProblems = session.problems.length;

    console.log(`🔍 DIFFICULTY ANALYSIS: Starting analysis for ${totalProblems} problems`);

    for (const problem of session.problems) {
      // Use difficulty directly from session problem object - no database lookup needed
      const difficulty = problem.difficulty || "Medium";

      console.log(`🔍 DIFFICULTY ANALYSIS: Problem ${problem.title} - difficulty: ${difficulty}`);

      if (Object.prototype.hasOwnProperty.call(difficultyCount, difficulty)) {
        difficultyCount[difficulty]++;
      } else {
        console.warn(`⚠️ DIFFICULTY ANALYSIS: Unknown difficulty '${difficulty}' for problem ${problem.title}`);
        difficultyCount.Medium++; // Default to Medium for unknown difficulties
      }
    }

    const result = {
      counts: difficultyCount,
      percentages: {
        Easy:
          totalProblems > 0 ? (difficultyCount.Easy / totalProblems) * 100 : 0,
        Medium:
          totalProblems > 0
            ? (difficultyCount.Medium / totalProblems) * 100
            : 0,
        Hard:
          totalProblems > 0 ? (difficultyCount.Hard / totalProblems) * 100 : 0,
      },
      totalProblems,
      predominantDifficulty: Object.entries(difficultyCount).reduce((a, b) =>
        difficultyCount[a[0]] > difficultyCount[b[0]] ? a : b
      )[0],
    };

    console.log(`✅ DIFFICULTY ANALYSIS: Final result:`, result);
    return result;
  },

  /**
   * Generates actionable insights based on session performance.
   * @param {Object} performance - Session performance metrics
   * @param {Array} masteryDeltas - Mastery progression deltas
   * @param {Object} difficultyMix - Session difficulty analysis
   * @returns {Object} Structured insights for user feedback
   */
  generateSessionInsights(performance, masteryDeltas, difficultyMix) {
    const insights = {
      accuracy: this.getAccuracyInsight(performance.accuracy),
      efficiency: this.getEfficiencyInsight(performance.avgTime, difficultyMix),
      mastery: this.getMasteryInsight(masteryDeltas),
      nextActions: [],
    };

    // Generate next action recommendations
    if (performance.accuracy < 0.6) {
      insights.nextActions.push(
        "Focus on review problems to solidify fundamentals"
      );
    }

    if (performance.weakTags.length > 3) {
      insights.nextActions.push(
        `Prioritize improvement in: ${performance.weakTags
          .slice(0, 3)
          .join(", ")}`
      );
    }

    if (
      masteryDeltas.filter((d) => d.masteredChanged && d.postMastered).length >
      0
    ) {
      insights.nextActions.push(
        "Great progress! Consider exploring more advanced patterns"
      );
    }

    return insights;
  },

  /**
   * Logs structured session analytics for dashboard integration.
   * @param {Object} sessionSummary - Complete session summary
   */
  logSessionAnalytics(sessionSummary) {
    // 🛡️ Safe access with fallbacks to prevent crashes
    const performance = sessionSummary.performance || {};
    const difficultyAnalysis = sessionSummary.difficultyAnalysis || {};
    const masteryProgression = sessionSummary.masteryProgression || {};

    const analyticsEvent = {
      timestamp: sessionSummary.completedAt || new Date().toISOString(),
      type: "session_completed",
      sessionId: sessionSummary.sessionId || sessionSummary.session_id || "unknown",
      metrics: {
        accuracy: roundToPrecision(performance.accuracy || 0),
        avgTime: Math.round(performance.avgTime || 0),
        problemsCompleted: difficultyAnalysis.totalProblems || 0,
        newMasteries: masteryProgression.newMasteries || 0,
        predominantDifficulty: difficultyAnalysis.predominantDifficulty || "Unknown",
      },
      tags: {
        strong: performance.strongTags || [],
        weak: performance.weakTags || [],
      },
    };

    logger.info(
      "📊 Session Analytics:",
      JSON.stringify(analyticsEvent, null, 2)
    );

    // Store analytics for future dashboard queries (could be enhanced with IndexedDB storage)
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.get(["sessionAnalytics"], (result) => {
        const analytics = result.sessionAnalytics || [];
        analytics.push(analyticsEvent);

        // Keep only last 50 session analytics to prevent storage bloat
        const recentAnalytics = analytics.slice(-50);

        chrome.storage.local.set({ sessionAnalytics: recentAnalytics });
      });
    }
  },

  /**
   * Helper methods for generating insights
   */
  getAccuracyInsight(accuracy) {
    if (accuracy >= 0.9)
      return "Excellent accuracy! Ready for harder challenges.";
    if (accuracy >= 0.7)
      return "Good accuracy. Keep practicing to reach mastery.";
    if (accuracy >= 0.5)
      return "Accuracy needs improvement. Focus on fundamentals.";
    return "Consider reviewing concepts before attempting new problems.";
  },

  getEfficiencyInsight(avgTime, difficultyMix) {
    const expectedTimes = { Easy: 750, Medium: 1350, Hard: 1950 };
    const expected = expectedTimes[difficultyMix.predominantDifficulty] || 1350;

    if (avgTime < expected * 0.8)
      return "Very efficient solving! Good time management.";
    if (avgTime < expected * 1.2)
      return "Good pacing. Well within expected time ranges.";
    if (avgTime < expected * 1.5)
      return "Taking a bit longer than expected. Practice for speed.";
    return "Focus on time management and pattern recognition for efficiency.";
  },

  getMasteryInsight(masteryDeltas) {
    const newMasteries = masteryDeltas.filter(
      (d) => d.masteredChanged && d.postMastered
    ).length;
    const decayed = masteryDeltas.filter(
      (d) => d.masteredChanged && !d.postMastered
    ).length;

    if (newMasteries > 0 && decayed === 0)
      return `Excellent! Mastered ${newMasteries} new tag(s).`;
    if (newMasteries > decayed)
      return `Net positive progress: +${newMasteries - decayed} tag masteries.`;
    if (decayed > 0)
      return `Some tags need review. ${decayed} mastery level(s) decreased.`;
    return "Maintained current mastery levels. Consistent performance.";
  },

  /**
   * Update session state with performance data from completed session
   * @param {Object} session - Completed session object
   * @param {Object} sessionSummary - Session performance summary
   */
  async updateSessionStateWithPerformance(session, sessionSummary) {
    try {
      console.log(`🔍 REAL SESSION DEBUG: updateSessionStateWithPerformance ENTRY for ACTUAL session ${session.id}`);
      console.log(`🔍 REAL SESSION DEBUG: Session ID is UUID? ${session.id.length === 36 && session.id.includes('-')}`);
      logger.info(`📊 Updating session state with performance data for session ${session.id}`);

      console.log(`🔍 DEBUG: Getting current session state...`);
      const sessionState = await StorageService.getSessionState("session_state") || {
        id: "session_state",
        num_sessions_completed: 0,
        difficulty_time_stats: {
          easy: { problems: 0, total_time: 0, avg_time: 0 },
          medium: { problems: 0, total_time: 0, avg_time: 0 },
          hard: { problems: 0, total_time: 0, avg_time: 0 },
        },
        last_performance: {
          accuracy: null,
          efficiency_score: null,
        }
      };

      // Ensure difficulty_time_stats exists (may be missing in old session states)
      if (!sessionState.difficulty_time_stats) {
        sessionState.difficulty_time_stats = {
          easy: { problems: 0, total_time: 0, avg_time: 0 },
          medium: { problems: 0, total_time: 0, avg_time: 0 },
          hard: { problems: 0, total_time: 0, avg_time: 0 },
        };
      }

      // NOTE: Session count is incremented in checkAndCompleteSession, not here
      // sessionState.num_sessions_completed is managed by the session completion flow

      console.log(`🔍 DEBUG: Current session state before performance updates:`, {
        id: sessionState.id,
        num_sessions_completed: sessionState.num_sessions_completed,
        difficulty_time_stats: sessionState.difficulty_time_stats,
        last_performance: sessionState.last_performance,
        last_session_date: sessionState.last_session_date
      });

      // Update difficulty time stats from session summary performance data
      console.log(`🔍 DEBUG: Updating difficulty time stats from session summary...`);
      // CRITICAL FIX: Use difficulty_breakdown instead of performance for difficulty stats
      const difficultyData = sessionSummary.difficulty_breakdown || sessionSummary.performance;

      if (difficultyData) {
        // Map difficulty breakdown data to session state (using snake_case)
        const difficultyMappings = [
          { perfKey: 'easy', stateKey: 'easy' },
          { perfKey: 'medium', stateKey: 'medium' },
          { perfKey: 'hard', stateKey: 'hard' }
        ];

        for (const { perfKey, stateKey } of difficultyMappings) {
          const perfStats = difficultyData[perfKey];
          if (perfStats && perfStats.attempts > 0) {
            console.log(`🔍 DEBUG: Processing ${perfKey} difficulty - attempts: ${perfStats.attempts}, time: ${perfStats.time}`);

            // Update session state difficulty stats
            sessionState.difficulty_time_stats[stateKey].problems += perfStats.attempts;
            sessionState.difficulty_time_stats[stateKey].total_time += perfStats.time;
            sessionState.difficulty_time_stats[stateKey].avg_time =
              sessionState.difficulty_time_stats[stateKey].total_time /
              sessionState.difficulty_time_stats[stateKey].problems;

            console.log(`🔍 DEBUG: Updated ${stateKey} stats:`, sessionState.difficulty_time_stats[stateKey]);
          }
        }
      }

      // Update last performance from session summary
      console.log(`🔍 DEBUG: Updating last performance from session summary...`);
      if (sessionSummary.performance) {
        const newAccuracy = roundToPrecision(sessionSummary.performance.accuracy || 0);
        const newEfficiency = roundToPrecision(sessionSummary.performance.avgTime ?
          Math.max(0, 1 - (sessionSummary.performance.avgTime / 1800000)) : 0);

        console.log(`🔍 DEBUG: New performance values - accuracy: ${newAccuracy}, efficiency: ${newEfficiency}`);

        sessionState.last_performance = {
          accuracy: newAccuracy,
          efficiency_score: newEfficiency
        };
      }

      // Update last session date
      sessionState.last_session_date = new Date().toISOString();
      console.log(`🔍 DEBUG: Set last_session_date to: ${sessionState.last_session_date}`);

      console.log(`🔍 DEBUG: Final session state before saving:`, {
        id: sessionState.id,
        num_sessions_completed: sessionState.num_sessions_completed,
        difficulty_time_stats: sessionState.difficulty_time_stats,
        last_performance: sessionState.last_performance,
        last_session_date: sessionState.last_session_date
      });

      console.log(`🔍 DEBUG: Calling StorageService.setSessionState...`);
      const saveResult = await StorageService.setSessionState("session_state", sessionState);
      console.log(`🔍 DEBUG: StorageService.setSessionState result:`, saveResult);

      // Verify the update by reading it back
      console.log(`🔍 DEBUG: Verifying save by reading back from database...`);
      const verificationState = await StorageService.getSessionState("session_state");
      console.log(`🔍 DEBUG: Verification read result:`, {
        id: verificationState?.id,
        num_sessions_completed: verificationState?.num_sessions_completed,
        difficulty_time_stats: verificationState?.difficulty_time_stats,
        last_performance: verificationState?.last_performance,
        last_session_date: verificationState?.last_session_date
      });

      if (!verificationState || verificationState.last_session_date !== sessionState.last_session_date) {
        console.error(`❌ DEBUG: Session state verification FAILED! Data not persisted correctly`);
        logger.error(`❌ Session state update verification failed - data not persisted`);
      } else {
        console.log(`✅ DEBUG: Session state verification PASSED! Data persisted correctly`);
      }

      logger.info(`✅ Session state updated with performance data:`, {
        difficulty_problems: sessionState.difficulty_time_stats ?
          Object.entries(sessionState.difficulty_time_stats).map(([diff, stats]) =>
            `${diff}: ${stats.problems} problems`).join(', ') : 'no difficulty stats available',
        last_accuracy: sessionState.last_performance?.accuracy,
        last_efficiency: sessionState.last_performance?.efficiency_score
      });

      // 🎯 Evaluate difficulty progression after session completion (non-blocking)
      console.log(`🔍 DEBUG: Evaluating difficulty progression after session completion...`);
      try {
        const settings = await StorageService.getSettings();
        const accuracy = sessionSummary.performance?.accuracy || 0;

        // Validate accuracy value to prevent downstream errors
        if (typeof accuracy !== 'number' || isNaN(accuracy) || accuracy < 0 || accuracy > 1) {
          console.warn(`⚠️ Invalid accuracy value: ${accuracy}, skipping difficulty progression`);
          logger.warn(`⚠️ Invalid accuracy value for difficulty progression: ${accuracy}`);
          return; // Don't fail the entire session for this
        }

        console.log(`🔍 DEBUG: Calling evaluateDifficultyProgression with accuracy: ${(accuracy * 100).toFixed(1)}%`);
        const updatedSessionState = await evaluateDifficultyProgression(accuracy, settings);
        console.log(`✅ DEBUG: Difficulty progression evaluated. Current cap: ${updatedSessionState.current_difficulty_cap}`);
      } catch (difficultyError) {
        // Log the error but don't fail the session - difficulty progression is not critical to session completion
        console.error(`❌ DEBUG: Difficulty progression evaluation failed (non-critical):`, difficultyError);
        logger.error("❌ Failed to evaluate difficulty progression (session completion continues):", {
          error: difficultyError.message,
          stack: difficultyError.stack,
          sessionId: sessionSummary.session_id
        });
        // Continue with session completion - this is not a blocking error
      }

    } catch (error) {
      console.error(`❌ DEBUG: updateSessionStateWithPerformance ERROR:`, error);
      logger.error("❌ Failed to update session state with performance:", error);
    }
  },

  /**
   * Session Consistency & Habit-Based Analysis Methods
   * These methods analyze user session patterns for smart reminder timing
   */

  /**
   * Gets user's current practice streak (consecutive days with sessions)
   * @returns {Promise<number>} Current streak in days
   */
  async getCurrentStreak() {
    try {
      // Get recent sessions ordered by date (newest first)
      const db = await openDatabase();
      const transaction = db.transaction(["sessions"], "readonly");
      const store = transaction.objectStore("sessions");
      
      const sessions = [];
      return new Promise((resolve) => {
        const request = store.openCursor(null, "prev"); // Newest first
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor && cursor.value.status === "completed") {
            sessions.push(cursor.value);
            cursor.continue();
          } else {
            resolve(this._calculateStreak(sessions));
          }
        };
        request.onerror = () => resolve(0);
      });
    } catch (error) {
      logger.error("Error calculating current streak:", error);
      return 0;
    }
  },

  /**
   * Calculates streak from session list
   * @private
   */
  _calculateStreak(sessions) {
    if (!sessions || sessions.length === 0) return 0;
    
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < sessions.length; i++) {
      const sessionDate = new Date(sessions[i].date);
      sessionDate.setHours(0, 0, 0, 0);
      
      const expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() - streak);
      
      if (sessionDate.getTime() === expectedDate.getTime()) {
        streak++;
      } else if (sessionDate.getTime() < expectedDate.getTime()) {
        break; // Gap found, streak ends
      }
    }
    
    return streak;
  },

  /**
   * Analyzes user's typical cadence between practice sessions
   * @returns {Promise<Object>} Cadence analysis with average gap and pattern
   */
  async getTypicalCadence() {
    // Use circuit breaker to safely execute enhanced pattern analysis
    return await HabitLearningCircuitBreaker.safeExecute(
      // Enhanced analysis function
      async () => {
        const sessions = await this._getSessionsFromPeriod(30);
        return this._analyzeCadence(sessions);
      },
      // Fallback to simple legacy logic
      () => {
        // Using fallback cadence analysis
        return {
          averageGapDays: 2,
          pattern: "daily",
          reliability: "low",
          totalSessions: 0,
          learningPhase: true,
          fallbackMode: true
        };
      },
      "cadence-analysis"
    );
  },

  /**
   * Helper method to get sessions from a period (used by circuit breaker)
   * @private
   */
  async _getSessionsFromPeriod(days) {
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - days);
    
    const db = await openDatabase();
    const transaction = db.transaction(["sessions"], "readonly");
    const store = transaction.objectStore("sessions");
    
    const sessions = [];
    return new Promise((resolve, reject) => {
      const request = store.openCursor();
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const session = cursor.value;
          if (session.status === "completed" && 
              new Date(session.date) >= periodStart) {
            sessions.push(session);
          }
          cursor.continue();
        } else {
          resolve(sessions);
        }
      };
      request.onerror = () => reject(new Error("Database query failed"));
    });
  },

  /**
   * Analyzes session cadence patterns
   * @private
   */
  _analyzeCadence(sessions) {
    // Enhanced reliability requirements - need at least 5 sessions for reliable patterns
    if (!sessions || sessions.length < 5) {
      return {
        averageGapDays: 2,
        pattern: "insufficient_data",
        reliability: "low",
        totalSessions: sessions?.length || 0,
        learningPhase: true,
        sessionsNeeded: Math.max(0, 5 - (sessions?.length || 0))
      };
    }
    
    // Sort sessions by date
    sessions.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const gaps = [];
    for (let i = 1; i < sessions.length; i++) {
      const prevDate = new Date(sessions[i - 1].date);
      const currDate = new Date(sessions[i].date);
      const gapDays = (currDate - prevDate) / (1000 * 60 * 60 * 24);
      if (gapDays > 0 && gapDays < 14) { // Ignore very large gaps (vacations, etc.)
        gaps.push(gapDays);
      }
    }
    
    if (gaps.length === 0) {
      return {
        averageGapDays: 2,
        pattern: "insufficient_data",
        reliability: "low",
        totalSessions: sessions.length,
        learningPhase: true
      };
    }
    
    const averageGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    const variance = gaps.reduce((sum, gap) => sum + Math.pow(gap - averageGap, 2), 0) / gaps.length;
    const stdDev = Math.sqrt(variance);
    
    // Progressive confidence scoring based on data quality and consistency
    const sessionCountFactor = Math.min(sessions.length / 10, 1); // Higher confidence with more sessions
    const consistencyFactor = Math.max(0, 1 - (stdDev / 3)); // Lower std dev = higher confidence
    const confidenceScore = (sessionCountFactor * 0.6) + (consistencyFactor * 0.4);
    
    // Determine pattern consistency with enhanced logic
    let pattern = "inconsistent";
    let reliability = "low";
    
    // Enhanced pattern detection with confidence thresholds
    if (confidenceScore >= 0.7) {
      if (stdDev < 1) {
        pattern = "daily";
        reliability = "high";
      } else if (averageGap >= 1.5 && averageGap <= 2.5 && stdDev < 1.5) {
        pattern = "every_other_day";
        reliability = "high";
      } else if (averageGap >= 6 && averageGap <= 8 && stdDev < 2) {
        pattern = "weekly";
        reliability = "high";
      }
    } else if (confidenceScore >= 0.5) {
      if (stdDev < 1.5) {
        pattern = averageGap <= 1.5 ? "daily" : averageGap <= 3 ? "every_other_day" : "weekly";
        reliability = "medium";
      }
    }
    
    // Check learning period - first 2 weeks of data
    const firstSession = new Date(sessions[0].date);
    const lastSession = new Date(sessions[sessions.length - 1].date);
    const dataSpanDays = (lastSession - firstSession) / (1000 * 60 * 60 * 24);
    const learningPhase = dataSpanDays < 14; // Still in 2-week learning phase
    
    return {
      averageGapDays: Math.round(averageGap * 10) / 10,
      pattern,
      reliability,
      totalSessions: sessions.length,
      consistency: stdDev < 2 ? "consistent" : "variable",
      confidenceScore: roundToPrecision(confidenceScore),
      learningPhase,
      dataSpanDays: Math.round(dataSpanDays),
      standardDeviation: Math.round(stdDev * 10) / 10
    };
  },

  /**
   * Gets current week's session progress vs typical weekly goal
   * @returns {Promise<Object>} Weekly progress analysis
   */
  async getWeeklyProgress() {
    try {
      // Calculate current week boundaries (Monday to Sunday)
      const today = new Date();
      const currentWeekStart = new Date(today);
      const dayOfWeek = today.getDay();
      const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Handle Sunday (0)
      currentWeekStart.setDate(today.getDate() + daysToMonday);
      currentWeekStart.setHours(0, 0, 0, 0);
      
      const currentWeekEnd = new Date(currentWeekStart);
      currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
      currentWeekEnd.setHours(23, 59, 59, 999);
      
      // Get sessions from current week
      const db = await openDatabase();
      const transaction = db.transaction(["sessions"], "readonly");
      const store = transaction.objectStore("sessions");
      
      const currentWeekSessions = [];
      return new Promise((resolve) => {
        const request = store.openCursor();
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            const session = cursor.value;
            const sessionDate = new Date(session.date);
            if (session.status === "completed" && 
                sessionDate >= currentWeekStart && 
                sessionDate <= currentWeekEnd) {
              currentWeekSessions.push(session);
            }
            cursor.continue();
          } else {
            resolve(this._calculateWeeklyProgress(currentWeekSessions));
          }
        };
        request.onerror = () => resolve({
          completed: 0,
          goal: 3,
          percentage: 0,
          daysLeft: 0
        });
      });
    } catch (error) {
      logger.error("Error calculating weekly progress:", error);
      return {
        completed: 0,
        goal: 3,
        percentage: 0,
        daysLeft: 0
      };
    }
  },

  /**
   * Calculates weekly progress metrics
   * @private
   */
  _calculateWeeklyProgress(sessions) {
    const completed = sessions.length;
    
    // Estimate goal based on user's historical average (default to 3)
    const goal = Math.max(3, Math.ceil(completed * 1.2)); // Slightly aspirational
    
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysLeft = dayOfWeek === 0 ? 0 : 7 - dayOfWeek; // Days until Sunday
    
    return {
      completed,
      goal,
      percentage: goal > 0 ? Math.round((completed / goal) * 100) : 0,
      daysLeft,
      isOnTrack: completed >= Math.floor((7 - daysLeft) / 7 * goal)
    };
  },

  /**
   * Determines when to send streak risk alerts based on user patterns
   * @returns {Promise<Object>} Timing recommendation for streak alerts
   */
  async getStreakRiskTiming() {
    try {
      const [currentStreak, cadence] = await Promise.all([
        this.getCurrentStreak(),
        this.getTypicalCadence()
      ]);
      
      if (currentStreak === 0) {
        return {
          shouldAlert: false,
          reason: "no_current_streak",
          daysUntilAlert: null
        };
      }
      
      // Get last session date
      const lastSession = await getLatestSession();
      if (!lastSession) {
        return {
          shouldAlert: false,
          reason: "no_session_data",
          daysUntilAlert: null
        };
      }
      
      const lastSessionDate = new Date(lastSession.date);
      const daysSinceLastSession = (Date.now() - lastSessionDate.getTime()) / (1000 * 60 * 60 * 24);
      
      // Alert threshold: user's typical gap + 1 day (with minimum of 2 days)
      const alertThreshold = Math.max(2, Math.ceil(cadence.averageGapDays + 1));
      const shouldAlert = daysSinceLastSession >= alertThreshold && currentStreak >= 3;
      
      return {
        shouldAlert,
        reason: shouldAlert ? "streak_at_risk" : "streak_safe",
        currentStreak,
        daysSinceLastSession: Math.floor(daysSinceLastSession),
        alertThreshold,
        daysUntilAlert: shouldAlert ? 0 : Math.max(0, alertThreshold - daysSinceLastSession)
      };
    } catch (error) {
      logger.error("Error calculating streak risk timing:", error);
      return {
        shouldAlert: false,
        reason: "error",
        daysUntilAlert: null
      };
    }
  },

  /**
   * Determines when to send re-engagement prompts with escalating gentleness
   * @returns {Promise<Object>} Re-engagement timing and message type
   */
  async getReEngagementTiming() {
    try {
      const lastSession = await getLatestSession();
      if (!lastSession) {
        return {
          shouldPrompt: false,
          reason: "no_session_data",
          messageType: null
        };
      }
      
      const lastSessionDate = new Date(lastSession.date);
      const daysSinceLastSession = (Date.now() - lastSessionDate.getTime()) / (1000 * 60 * 60 * 24);
      
      let messageType = null;
      let shouldPrompt = false;
      
      if (daysSinceLastSession >= 30) {
        messageType = "gentle_monthly";
        shouldPrompt = true;
      } else if (daysSinceLastSession >= 14) {
        messageType = "supportive_biweekly";
        shouldPrompt = true;
      } else if (daysSinceLastSession >= 7) {
        messageType = "friendly_weekly";
        shouldPrompt = true;
      }
      
      return {
        shouldPrompt,
        reason: shouldPrompt ? "extended_absence" : "recent_activity",
        messageType,
        daysSinceLastSession: Math.floor(daysSinceLastSession),
        lastSessionDate: lastSession.date
      };
    } catch (error) {
      logger.error("Error calculating re-engagement timing:", error);
      return {
        shouldPrompt: false,
        reason: "error",
        messageType: null
      };
    }
  },

  /**
   * Comprehensive consistency check that determines all reminder needs
   * Used by background script for daily consistency health check
   * @param {Object} reminderSettings - User's reminder preferences
   * @returns {Promise<Object>} Complete consistency analysis and alerts needed
   */
  async checkConsistencyAlerts(reminderSettings) {
    try {
      logger.info("🔍 Running comprehensive consistency check...");
      
      if (!reminderSettings?.enabled) {
        return {
          hasAlerts: false,
          reason: "reminders_disabled",
          alerts: []
        };
      }
      
      const [streakTiming, cadence, weeklyProgress, reEngagement] = await Promise.all([
        reminderSettings.streakAlerts ? this.getStreakRiskTiming() : Promise.resolve(null),
        reminderSettings.cadenceNudges ? this.getTypicalCadence() : Promise.resolve(null),
        reminderSettings.weeklyGoals ? this.getWeeklyProgress() : Promise.resolve(null),
        reminderSettings.reEngagement ? this.getReEngagementTiming() : Promise.resolve(null)
      ]);
      
      const alerts = [];
      
      // Check streak alerts
      if (streakTiming?.shouldAlert) {
        alerts.push({
          type: "streak_alert",
          priority: "high",
          message: `🔥 Keep your ${streakTiming.currentStreak}-day streak alive! Start a quick session?`,
          data: { currentStreak: streakTiming.currentStreak }
        });
      }
      
      // Check cadence nudges with enhanced learning phase awareness
      if (cadence && reminderSettings.cadenceNudges) {
        // Skip cadence nudges if still in learning phase or insufficient data
        if (cadence.learningPhase || cadence.pattern === "insufficient_data") {
          logger.info("⏸️ Skipping cadence nudges - still in learning phase or insufficient data");
        } else {
          const lastSession = await getLatestSession();
          if (lastSession) {
            const daysSince = (Date.now() - new Date(lastSession.date).getTime()) / (1000 * 60 * 60 * 24);
            const threshold = cadence.averageGapDays + 0.5;
            
            // Enhanced reliability check - now requires medium+ reliability and good confidence
            this._addCadenceNudgeIfNeeded(alerts, cadence, daysSince, threshold);
          }
        }
      }
      
      // Check weekly goals with learning phase awareness (only Wednesday or Saturday)
      if (weeklyProgress && reminderSettings.weeklyGoals) {
        this._addWeeklyGoalAlertIfNeeded(alerts, weeklyProgress, cadence);
      }
      
      // Check re-engagement prompts
      if (reEngagement?.shouldPrompt) {
        this._addReEngagementAlert(alerts, reEngagement);
      }
      
      logger.info(`✅ Consistency check complete: ${alerts.length} alerts found`);
      
      return {
        hasAlerts: alerts.length > 0,
        reason: alerts.length > 0 ? "consistency_issues_detected" : "all_good",
        alerts,
        analysis: {
          streak: streakTiming,
          cadence,
          weeklyProgress,
          reEngagement
        }
      };
      
    } catch (error) {
      logger.error("Error in consistency check:", error);
      return {
        hasAlerts: false,
        reason: "check_failed",
        alerts: [],
        error: error.message
      };
    }
  },

  /**
   * Add cadence nudge alert if conditions are met
   * @private
   */
  _addCadenceNudgeIfNeeded(alerts, cadence, daysSince, threshold) {
    if (daysSince >= threshold && 
        cadence.reliability !== "low" && 
        cadence.confidenceScore >= 0.5) {
      
      alerts.push({
        type: "cadence_nudge", 
        priority: "medium",
        message: `📅 You usually practice every ${Math.round(cadence.averageGapDays)} days — it's been ${Math.floor(daysSince)}. Quick session?`,
        data: { 
          typicalGap: cadence.averageGapDays, 
          actualGap: Math.floor(daysSince),
          typicalCadence: cadence.pattern
        }
      });
    }
  },

  /**
   * Add weekly goal alert if conditions are met
   * @private
   */
  _addWeeklyGoalAlertIfNeeded(alerts, weeklyProgress, cadence) {
    // Require at least 2 weeks of data before sending weekly goal reminders
    const hasEnoughHistoryForWeeklyGoals = cadence && 
      !cadence.learningPhase && 
      cadence.totalSessions >= 3;
      
    if (hasEnoughHistoryForWeeklyGoals) {
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 = Sunday, 3 = Wednesday, 6 = Saturday
      
      if ((dayOfWeek === 3 || dayOfWeek === 6) && weeklyProgress.percentage < 50) {
        const isWednesday = dayOfWeek === 3;
        const message = isWednesday 
          ? `⚡ Halfway through the week! ${weeklyProgress.completed} of ${weeklyProgress.goal} sessions completed`
          : `🎯 Weekend check: ${weeklyProgress.daysLeft} days left to hit your ${weeklyProgress.goal}-session goal`;
          
        alerts.push({
          type: "weekly_goal",
          priority: "low",
          message,
          data: { 
            completedSessions: weeklyProgress.completed,
            targetSessions: weeklyProgress.goal,
            remainingDays: weeklyProgress.daysLeft
          }
        });
      }
    } else {
      logger.info("⏸️ Skipping weekly goal reminders - insufficient data for reliable weekly patterns");
    }
  },

  /**
   * Add re-engagement alert
   * @private
   */
  _addReEngagementAlert(alerts, reEngagement) {
    const messages = {
      friendly_weekly: "👋 Ready to jump back in? Your progress is waiting",
      supportive_biweekly: "💪 No pressure — start with just one problem when you're ready", 
      gentle_monthly: "🌟 We're here when you want to continue your coding journey"
    };
    
    alerts.push({
      type: "re_engagement",
      priority: "low",
      message: messages[reEngagement.messageType],
      data: { 
        daysSinceLastSession: reEngagement.daysSinceLastSession,
        messageType: reEngagement.messageType
      }
    });
  },
};
