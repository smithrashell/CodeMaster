/**
 * Session Service - Core session lifecycle management.
 *
 * @module sessionService
 *
 * DATA CONTRACT DOCUMENTATION
 * ==========================
 * This module manages learning session creation, tracking, and completion.
 * Sessions contain problems, attempts, and analytics data.
 *
 * IMPORTANT: Field types and structures documented here are critical for
 * maintaining compatibility with consumers (content scripts, dashboard, etc).
 */

import {
  getSessionById,
  getLatestSession,
  getLatestSessionByType,
  saveSessionToStorage,
  saveNewSessionToDB,
  updateSessionInDB,
  deleteSessionFromDB,
  getOrCreateSessionAtomic,
} from "../../db/stores/sessions.js";
import { ProblemService } from "../problem/problemService.js";
import { normalizeProblem } from "../problem/problemNormalizer.js";
import { StorageService } from "../storage/storageService.js";
import { FocusCoordinationService } from "../focus/focusCoordinationService.js";
import { v4 as uuidv4 } from "uuid";
import performanceMonitor from "../../utils/performance/PerformanceMonitor.js";
import { IndexedDBRetryService } from "../storage/indexedDBRetryService.js";
import logger from "../../utils/logging/logger.js";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * @typedef {'standard'|'interview-like'|'full-interview'} SessionType
 * - 'standard': Regular guided session with full hints available
 * - 'interview-like': Limited hints, mild time pressure
 * - 'full-interview': No hints, strict timing, realistic conditions
 */

/**
 * @typedef {Object} SessionProblem
 * @property {number} id - Internal database ID.
 * @property {string} problem_id - UUID for the problem in database.
 * @property {number} leetcode_id - CRITICAL: LeetCode ID number (must be valid number).
 * @property {string} title - Problem title.
 * @property {string} slug - URL slug for the problem.
 * @property {string} difficulty - 'Easy', 'Medium', or 'Hard'.
 * @property {Array<string>} Tags - Array of topic tags.
 */

/**
 * @typedef {Object} SessionAttempt
 * @property {string} attempt_id - UUID for the attempt.
 * @property {number} leetcode_id - CRITICAL: Must match problem's leetcode_id.
 * @property {boolean} success - Whether the attempt was successful.
 * @property {number} time_spent - Time spent in seconds.
 * @property {string} attempt_date - ISO timestamp of attempt.
 */

/**
 * @typedef {Object} InterviewConfig
 * @property {boolean} hintsEnabled - Whether hints are available.
 * @property {number} timePressure - Time pressure level (0-100).
 * @property {boolean} strictTiming - Whether timing is enforced strictly.
 */

/**
 * @typedef {Object} Session
 * @property {string} id - UUID for the session.
 * @property {string} date - ISO timestamp of session creation.
 * @property {'in_progress'|'completed'} status - Current session status.
 * @property {'generator'|'tracking'} origin - How session was created.
 * @property {string} last_activity_time - ISO timestamp of last activity.
 * @property {Array<SessionProblem>} problems - Problems in the session.
 * @property {Array<SessionAttempt>} attempts - Recorded attempts.
 * @property {number} current_problem_index - Index of current problem.
 * @property {SessionType} session_type - Type of session.
 * @property {number} [accuracy] - Calculated on completion: successfulAttempts / totalAttempts.
 * @property {number} [duration] - Calculated on completion: total time in minutes.
 * @property {InterviewConfig} [interviewConfig] - Interview sessions only.
 * @property {Object} [interviewMetrics] - Interview sessions only.
 */

/**
 * @typedef {Object} SessionPerformanceSummary
 * @property {string} sessionId - The session ID.
 * @property {number} totalProblems - Number of problems in session.
 * @property {number} attemptedProblems - Number of problems attempted.
 * @property {number} successfulAttempts - Count of successful attempts.
 * @property {number} accuracy - Success rate (0-1).
 * @property {Object} difficultyBreakdown - Performance by difficulty.
 * @property {Object} tagPerformance - Performance by tag.
 * @property {Array<Object>} masteryDeltas - Changes in tag mastery.
 * @property {Object} insights - Generated insights about the session.
 */

/**
 * @typedef {Object} CheckAndCompleteResult
 * Return type varies based on session state:
 * - `false`: Invalid sessionId or session not found
 * - `[]`: Session completed (either already complete or just completed)
 * - `Array<SessionProblem>`: Unattempted problems remaining
 */

// ============================================================================
// IMPLEMENTATION
// ============================================================================

// Import extracted helpers
import {
  createEmptySessionSummary,
  createAdHocSessionSummary,
  getMasteryDeltas,
  updateRelationshipsAndGetPostMastery,
  getPerformanceMetrics,
  storeSessionSummary
} from "./sessionSummaryHelpers.js";
import {
  calculateMasteryDeltas,
  analyzeSessionDifficulty,
  generateSessionInsights,
  logSessionAnalytics,
  updateSessionStateWithPerformance
} from "./sessionAnalyticsHelpers.js";
// Note: Classification, Tracking, Interview, and HabitLearning helpers should be imported
// directly by callers - see sessionClassificationHelpers.js, sessionTrackingHelpers.js,
// sessionInterviewHelpers.js, and sessionHabitLearning.js

// Session Creation Lock - Prevents race conditions
const sessionCreationLocks = new Map();
// Session Refresh Lock - Prevents race conditions during regeneration
const sessionRefreshLocks = new Map();

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
   *
   * Used by: checkAndCompleteSession() after marking session complete.
   *
   * NOTE: This is the actual analytics function (not "getSessionStats" which
   * does not exist). Use this for comprehensive session performance data.
   *
   * BEHAVIOR:
   * - Handles edge cases: empty attempts, ad-hoc sessions without problems
   * - Calculates mastery deltas for all attempted tags
   * - Updates tag relationships based on co-occurrence
   * - Generates insights about session performance
   * - Stores summary for historical tracking
   *
   * @param {Session} session - The completed session object with attempts.
   * @returns {Promise<SessionPerformanceSummary>} Comprehensive performance summary.
   *
   * @example
   * const summary = await SessionService.summarizeSessionPerformance(session);
   * // summary.accuracy === 0.75 (number 0-1)
   * // summary.masteryDeltas === [{tag: 'Array', delta: 0.1}, ...]
   * // summary.insights === {strengths: [...], improvements: [...]}
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

    // Handle edge cases
    if (!session.attempts || session.attempts.length === 0) {
      logger.warn(`⚠️ Session ${session.id} has no attempts - skipping performance summary`);
      performanceMonitor.endQuery(queryContext, true, 0);
      return createEmptySessionSummary(session.id);
    }

    if (!session.problems || session.problems.length === 0) {
      logger.warn(`⚠️ Session ${session.id} has attempts but no problems (ad-hoc session) - using simplified analytics`);
      performanceMonitor.endQuery(queryContext, true, 0);
      return createAdHocSessionSummary(session);
    }

    try {
      console.log(`🔍 DEBUG: Starting comprehensive session analysis for ${session.id}...`);

      // Get mastery state before and after
      const { preSessionMasteryMap } = await getMasteryDeltas();
      const { postSessionTagMastery, postSessionMasteryMap } = await updateRelationshipsAndGetPostMastery(session);

      // Get performance metrics
      const performanceMetrics = await getPerformanceMetrics(session, postSessionTagMastery);

      // Calculate mastery deltas
      const masteryDeltas = this.calculateMasteryDeltas(preSessionMasteryMap, postSessionMasteryMap);

      // Analyze difficulty distribution
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

      // Create comprehensive summary
      const sessionSummary = {
        session_id: session.id,
        completed_at: new Date().toISOString(),
        performance: performanceMetrics,
        mastery_progression: {
          deltas: masteryDeltas,
          new_masteries: masteryDeltas.filter((d) => d.masteredChanged && d.postMastered).length,
          decayed_masteries: masteryDeltas.filter((d) => d.masteredChanged && !d.postMastered).length,
        },
        difficulty_analysis: difficultyMix,
        insights: this.generateSessionInsights(performanceMetrics, masteryDeltas, difficultyMix),
      };

      // Update session state with performance data
      try {
        await this.updateSessionStateWithPerformance(session, sessionSummary);
        console.log(`✅ REAL SESSION DEBUG: updateSessionStateWithPerformance completed successfully for session ${session.id}`);
      } catch (stateUpdateError) {
        console.error(`❌ REAL SESSION DEBUG: updateSessionStateWithPerformance failed for session ${session.id}:`, stateUpdateError);
        logger.error(`❌ Failed to update session state for session ${session.id}:`, stateUpdateError);
      }

      // Store session analytics
      await storeSessionSummary(session, sessionSummary);

      // Log analytics for dashboard
      console.log(`🔍 REAL SESSION DEBUG: About to call logSessionAnalytics for session ${session.id}`);
      this.logSessionAnalytics(sessionSummary);
      console.log(`🔍 REAL SESSION DEBUG: logSessionAnalytics completed for session ${session.id}`);

      logger.info(`✅ Session performance summary completed for ${session.id}`);
      performanceMonitor.endQuery(queryContext, true, Object.keys(sessionSummary).length);

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
   * Helper to update session state after session completion
   */
  async updateSessionStateOnCompletion(session) {
    try {
      const sessionState = await StorageService.getSessionState("session_state") || {
        id: "session_state",
        num_sessions_completed: 0
      };
      sessionState.num_sessions_completed = (sessionState.num_sessions_completed || 0) + 1;
      sessionState.last_session_date = new Date().toISOString();

      // Update session state with performance metrics for focus expansion
      const previousAccuracy = sessionState.last_performance?.accuracy || 0;
      const currentAccuracy = session.accuracy || 0;

      sessionState.last_performance = {
        accuracy: currentAccuracy,
        efficiency_score: currentAccuracy // Use accuracy as proxy for efficiency
      };

      // Track last_progress_date when meaningful progress occurs
      const hasProgress = currentAccuracy > previousAccuracy || currentAccuracy >= 0.8;
      if (hasProgress) {
        sessionState.last_progress_date = new Date().toISOString();
      }

      // Call FocusCoordinationService to update focus tags based on performance
      try {
        const focusDecision = await FocusCoordinationService.getFocusDecision(sessionState);
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
  },

  /**
   * Checks if all session problems are attempted and marks the session as complete.
   *
   * Used by: attemptsService.js after recording an attempt, background handlers.
   *
   * SIDE EFFECTS:
   * - Updates session.status to "completed" if all problems attempted
   * - Calculates and sets session.accuracy and session.duration
   * - Calls updateSessionStateOnCompletion() for session count tracking
   * - Triggers cache invalidation via Chrome message
   * - Calls summarizeSessionPerformance() for analytics
   *
   * CRITICAL:
   * - All problems MUST have valid leetcode_id (throws if missing)
   * - Uses strict number comparison for leetcode_id matching
   *
   * @param {string} sessionId - The UUID of the session to check.
   * @returns {Promise<boolean|Array<SessionProblem>>} Returns:
   *   - `false`: Invalid sessionId or session not found
   *   - `[]`: Session completed (already complete or just completed now)
   *   - `Array<SessionProblem>`: List of unattempted problems remaining
   * @throws {Error} If any problem is missing a valid leetcode_id.
   *
   * @example
   * const result = await SessionService.checkAndCompleteSession(sessionId);
   * if (result === false) {
   *   // Session not found
   * } else if (result.length === 0) {
   *   // Session complete!
   * } else {
   *   // result contains unattempted problems
   * }
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

    // Get all attempts related to this session - strict number comparison
    const attemptedLeetcodeIds = new Set(
      session.attempts
        .map((a) => Number(a.leetcode_id))
        .filter(id => !isNaN(id))
    );

    // Check if all scheduled problems have been attempted
    // All problems should be normalized with leetcode_id field
    const unattemptedProblems = session.problems.filter((problem) => {
      const problemLeetcodeId = Number(problem.leetcode_id);

      if (isNaN(problemLeetcodeId)) {
        logger.error(`❌ Problem missing valid leetcode_id:`, {
          problem,
          title: problem.title
        });
        throw new Error(`Problem "${problem.title}" missing valid leetcode_id - normalization failed`);
      }

      const isUnattempted = !attemptedLeetcodeIds.has(problemLeetcodeId);

      if (isUnattempted) {
        logger.info(`📎 Unattempted problem found:`, {
          leetcode_id: problemLeetcodeId,
          title: problem.title,
          problem_id: problem.problem_id
        });
      }

      return isUnattempted;
    });

    logger.info("📎 Unattempted Problems Count:", unattemptedProblems.length);

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
      await this.updateSessionStateOnCompletion(session);

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

      // Clear interview mode from storage since session is complete
      try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          chrome.storage.local.set({
            currentInterviewMode: { sessionType: 'standard', interviewConfig: null }
          }, () => {
            logger.info('Cleared interview mode from storage (session completed)');
          });
        }
      } catch (error) {
        logger.warn("Failed to clear interview mode from storage:", error);
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

  /**
   * Attempts to resume an existing in-progress session using efficient database queries.
   * Now includes session type compatibility validation to prevent hanging behavior.
   * @param {string} [sessionType] - Optional session type to filter by ('interview-like', 'full-interview', etc.)
   * @returns {Promise<Object|null>} - Session object or null if no resumable session
   */
  async resumeSession(sessionType = null) {
    logger.info(`🔍 resumeSession ENTRY: sessionType=${sessionType}`);

    // Look for in_progress sessions
    logger.info(`🔍 Calling getLatestSessionByType for in_progress sessions...`);
    let latestSession = await getLatestSessionByType(sessionType, "in_progress");

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
   *
   * Used by: getOrCreateSession(), refreshSession(), background handlers.
   *
   * BEHAVIOR:
   * - Enforces one active session per type policy
   * - Marks existing in_progress sessions of same type as completed
   * - Uses ProblemService.createSession() for standard sessions
   * - Uses ProblemService.createInterviewSession() for interview sessions
   *
   * SIDE EFFECTS:
   * - Marks existing in_progress sessions as completed
   * - Saves new session to database and storage
   * - Uses retry service with deduplication for reliability
   *
   * RACE CONDITION PREVENTION:
   * - Uses sessionCreationLocks Map to prevent concurrent creation
   * - If creation is already in progress, waits for existing promise
   *
   * @param {SessionType} [sessionType='standard'] - Type of session to create.
   * @returns {Promise<Session|null>} The created session object, or null if no problems available.
   *
   * @example
   * // Create standard session
   * const session = await SessionService.createNewSession();
   *
   * // Create interview session
   * const interviewSession = await SessionService.createNewSession('interview-like');
   * // interviewSession.interviewConfig will be present
   */
  async createNewSession(sessionType = 'standard') {
    const queryContext = performanceMonitor.startQuery("createNewSession", {
      operation: "session_creation",
      sessionType
    });

    try {
      logger.info(`📌 Creating new ${sessionType} session with status: in_progress`);

      // Enforce one active session per type: mark existing in_progress sessions as completed
      logger.info(`🔍 Checking for existing active ${sessionType} sessions to mark as completed...`);

      const existingInProgress = await getLatestSessionByType(sessionType, "in_progress");
      if (existingInProgress) {
        logger.info(`⏹️ Marking existing in_progress ${sessionType} session as completed:`, existingInProgress.id.substring(0, 8));
        existingInProgress.status = "completed";
        // Don't update last_activity_time - it should reflect when user last worked on it
        await updateSessionInDB(existingInProgress);
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
        status: "in_progress", // All new sessions start as in_progress
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

      // 🔍 NORMALIZATION DEBUG: Check if normalized fields are present before saving
      if (newSession.problems.length > 0) {
        logger.info(`🔍 NORMALIZATION CHECK - First problem in newSession before DB save:`, {
          id: newSession.problems[0].id,
          leetcode_id: newSession.problems[0].leetcode_id,
          problem_id: newSession.problems[0].problem_id,
          hasAttempts: !!newSession.problems[0].attempts,
          attemptsLength: newSession.problems[0].attempts?.length,
          attemptsContent: newSession.problems[0].attempts,
          hasAttemptStats: !!newSession.problems[0].attempt_stats
        });
      }

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

    // 🔒 RACE CONDITION FIX: Check if another request is already creating a session for this type
    if (sessionCreationLocks.has(sessionType)) {
      logger.info(`⏳ Another request is creating ${sessionType} session, waiting...`);
      const existingPromise = sessionCreationLocks.get(sessionType);
      return await existingPromise;
    }

    // Create placeholder promise and set lock IMMEDIATELY to prevent race condition
    let resolveCreation;
    let rejectCreation;
    const creationPromise = new Promise((resolve, reject) => {
      resolveCreation = resolve;
      rejectCreation = reject;
    });

    // Store promise to block concurrent requests BEFORE starting async work
    sessionCreationLocks.set(sessionType, creationPromise);
    logger.info(`🔒 Set session creation lock for ${sessionType}`);

    // Now perform the actual async session creation
    try {
      logger.info(`🔍 Getting settings...`);
      const _settings = await StorageService.getSettings();
      logger.info(`✅ Settings loaded successfully`);

      // Try atomic resume/create to prevent race conditions
      logger.info(`🔍 Attempting atomic resume or create for ${sessionType}...`);

      // First try to find existing in_progress sessions using atomic operation
      let session = await getOrCreateSessionAtomic(sessionType, 'in_progress', null);
      if (session) {
        logger.info("✅ Found existing in_progress session:", session.id);
        resolveCreation(session);
        return session;
      }

      logger.info(`🆕 No existing session found, creating new ${sessionType} session`);

      // Create new session as in_progress
      const newSession = await this.createNewSession(sessionType);

      logger.info(`✅ New session created:`, newSession?.id);
      resolveCreation(newSession);
      return newSession;
    } catch (error) {
      logger.error(`❌ Error in session creation for ${sessionType}:`, error);
      rejectCreation(error);
      throw error;
    } finally {
      // Release lock after creation completes (success or failure)
      sessionCreationLocks.delete(sessionType);
      logger.info(`🔓 Released session creation lock for ${sessionType}`);
    }
  },

  // Removed getDraftSession and startSession - sessions auto-start immediately now
  // Session Classification, Tracking, and Habit delegations removed - import directly from helper files

  /**
   * Refresh/regenerate current session with new problems
   */
  // eslint-disable-next-line require-await
  async refreshSession(sessionType = 'standard', forceNew = false) {
    logger.info(`🔄 Refreshing ${sessionType} session (forceNew: ${forceNew})`);
    
    // Acquire lock to prevent race conditions during regeneration
    const lockKey = `refresh_${sessionType}`;
    if (sessionRefreshLocks.has(lockKey)) {
      logger.info(`⏳ Waiting for existing refresh operation to complete for ${sessionType}`);
      return sessionRefreshLocks.get(lockKey);
    }

    const refreshPromise = (async () => {
      try {
        // Delete current session immediately if it exists (no longer need to mark as expired)
        const currentSession = await this.resumeSession(sessionType);

        // Guard: If forceNew=true (regeneration), we MUST have an existing session to replace
        // This prevents accidentally creating a new session of the wrong type
        // (e.g., creating a standard session when we meant to regenerate an interview session)
        if (forceNew && !currentSession) {
          logger.warn(`⚠️ Cannot regenerate ${sessionType} session - no existing session of this type found`);
          return null;
        }

        if (currentSession && forceNew) {
          await deleteSessionFromDB(currentSession.id);
          logger.info(`Deleted session ${currentSession.id} (type: ${sessionType}, status: ${currentSession.status}) for regeneration`);
        }

        // Create fresh session
        const newSession = await this.createNewSession(sessionType);
        logger.info(`✅ Created fresh ${sessionType} session: ${newSession.id}`);

        return newSession;
      } finally {
        // Always release lock
        sessionRefreshLocks.delete(lockKey);
      }
    })();

    sessionRefreshLocks.set(lockKey, refreshPromise);
    return refreshPromise;
  },

  /**
   * Skips a problem from the session, optionally replacing it with another.
   * @param {number} leetCodeID - The LeetCode ID of the problem to skip
   * @param {Object|null} replacementProblem - Optional problem to add as replacement
   * @returns {Promise<Object|null>} The updated session or null
   */
  async skipProblem(leetCodeID, replacementProblem = null) {
    const session = await getLatestSession();
    if (!session) return null;

    // Remove the skipped problem
    session.problems = session.problems.filter(
      (p) => p.leetcode_id !== leetCodeID
    );

    // Add replacement problem if provided
    if (replacementProblem) {
      const problemWithReason = {
        ...replacementProblem,
        selectionReason: {
          type: 'prerequisite',
          details: { skippedProblemId: leetCodeID },
          shortText: 'Prerequisite',
          fullText: 'Easier problem to help understand skipped concept'
        }
      };
      const normalizedReplacement = normalizeProblem(problemWithReason, 'prerequisite');
      session.problems.push(normalizedReplacement);
      logger.info(`➕ Added prerequisite to session: ${normalizedReplacement.title}`);
    }

    await saveSessionToStorage(session, true);
    return session;
  },

  // Session Analytics delegations - delegate to sessionAnalyticsHelpers
  calculateMasteryDeltas(preSessionMap, postSessionMap) {
    return calculateMasteryDeltas(preSessionMap, postSessionMap);
  },

  analyzeSessionDifficulty(session) {
    return analyzeSessionDifficulty(session);
  },

  generateSessionInsights(performance, masteryDeltas, difficultyMix) {
    return generateSessionInsights(performance, masteryDeltas, difficultyMix);
  },

  logSessionAnalytics(sessionSummary) {
    return logSessionAnalytics(sessionSummary);
  },

  async updateSessionStateWithPerformance(session, sessionSummary) {
    return await updateSessionStateWithPerformance(session, sessionSummary);
  },

};
