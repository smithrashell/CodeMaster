import {
  getSessionById,
  getLatestSession,
  getLatestSessionByType,
  saveSessionToStorage,
  saveNewSessionToDB,
  updateSessionInDB,
  getSessionPerformance,
} from "../db/sessions.js";
import { updateProblemRelationships } from "../db/problem_relationships.js";
import { ProblemService } from "../services/problemService.js";
import { calculateTagMastery, getTagMastery } from "../db/tag_mastery.js";
import { storeSessionAnalytics } from "../db/sessionAnalytics.js";
import { StorageService } from "./storageService.js";
import { fetchProblemById } from "../db/standard_problems.js";
import { v4 as uuidv4 } from "uuid";
import performanceMonitor from "../utils/PerformanceMonitor.js";
import { IndexedDBRetryService } from "./IndexedDBRetryService.js";
import { InterviewService } from "./interviewService.js";

export const SessionService = {
  // Simple session creation timing control to prevent rapid consecutive creation
  _lastSessionCreationTime: 0,
  _sessionCreationCooldown: 30000, // 30 seconds cooldown between session creation attempts
  
  // Session creation mutex to prevent race conditions
  _sessionCreationInProgress: false,
  _sessionCreationPromise: null,
  _sessionCreationStartTime: null, // Track when mutex was acquired
  
  // IndexedDB retry service for deduplication
  _retryService: new IndexedDBRetryService(),

  /**
   * Emergency method to reset session creation mutex in case of deadlock
   * Should only be used when mutex appears to be permanently stuck
   */
  resetSessionCreationMutex() {
    const wasInProgress = this._sessionCreationInProgress;
    const mutexAge = this._sessionCreationStartTime ? Date.now() - this._sessionCreationStartTime : 0;
    
    console.warn(`🚨 EMERGENCY: Resetting session creation mutex`, {
      wasInProgress,
      mutexAge: `${mutexAge}ms`,
      hadPromise: !!this._sessionCreationPromise
    });
    
    this._sessionCreationInProgress = false;
    this._sessionCreationPromise = null;
    this._sessionCreationStartTime = null;
    
    return { wasInProgress, mutexAge };
  },

  /**
   * Checks if a session type is compatible with current settings.
   * @param {Object} session - Session object to check
   * @param {string} expectedSessionType - Expected session type based on current settings
   * @returns {boolean} True if session is compatible with current settings
   */
  isSessionTypeCompatible(session, expectedSessionType) {
    if (!session) return false;
    
    // Normalize types - treat missing sessionType as 'standard'
    const sessionType = session.sessionType || 'standard';
    const expected = expectedSessionType || 'standard';
    
    // Simple exact match - only 3 types: 'standard', 'interview-like', 'full-interview'
    const compatible = sessionType === expected;
    
    if (!compatible) {
      console.info(`🔍 Session type incompatible: session=${sessionType} vs expected=${expected}`);
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
    
    const sessionType = session.sessionType || 'standard';
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

    console.info(`📊 Starting performance summary for session ${session.id}`);

    try {
      // 1️⃣ Capture pre-session state for delta calculations
      const preSessionTagMastery = await getTagMastery();
      const preSessionMasteryMap = new Map(
        (preSessionTagMastery || []).map((tm) => [tm.tag, tm])
      );

      // 2️⃣ Update problem relationships based on session attempts
      console.info("🔗 Updating problem relationships...");
      await updateProblemRelationships(session);

      // 3️⃣ Recalculate tag mastery with new session data
      console.info("🧠 Recalculating tag mastery...");
      await calculateTagMastery();

      // 4️⃣ Get updated tag mastery for delta calculation
      const postSessionTagMastery = await getTagMastery();
      const postSessionMasteryMap = new Map(
        (postSessionTagMastery || []).map((tm) => [tm.tag, tm])
      );

      // 5️⃣ Generate comprehensive session performance metrics
      console.info("📈 Generating session performance metrics...");
      const unmasteredTags = (postSessionTagMastery || [])
        .filter((tm) => !tm.mastered)
        .map((tm) => tm.tag);

      const performanceMetrics = (await getSessionPerformance({
        recentSessionsLimit: 1, // Focus on current session
        unmasteredTags,
      })) || {
        accuracy: 0,
        avgTime: 0,
        strongTags: [],
        weakTags: [],
        timingFeedback: {},
        Easy: { attempts: 0, correct: 0, time: 0, avgTime: 0 },
        Medium: { attempts: 0, correct: 0, time: 0, avgTime: 0 },
        Hard: { attempts: 0, correct: 0, time: 0, avgTime: 0 },
      };

      // 6️⃣ Calculate mastery progression deltas
      const masteryDeltas = this.calculateMasteryDeltas(
        preSessionMasteryMap,
        postSessionMasteryMap
      );

      // 7️⃣ Analyze session difficulty distribution
      const difficultyMix = await this.analyzeSessionDifficulty(session);

      // 8️⃣ Create comprehensive summary
      const sessionSummary = {
        sessionId: session.id,
        completedAt: new Date().toISOString(),
        performance: performanceMetrics,
        masteryProgression: {
          deltas: masteryDeltas,
          newMasteries: masteryDeltas.filter(
            (d) => d.masteredChanged && d.postMastered
          ).length,
          decayedMasteries: masteryDeltas.filter(
            (d) => d.masteredChanged && !d.postMastered
          ).length,
        },
        difficultyAnalysis: difficultyMix,
        insights: this.generateSessionInsights(
          performanceMetrics,
          masteryDeltas,
          difficultyMix
        ),
      };

      // 9️⃣ Store session analytics in dedicated IndexedDB store
      await storeSessionAnalytics(sessionSummary);

      // 🔟 Log structured analytics for dashboard integration (Chrome storage backup)
      this.logSessionAnalytics(sessionSummary);

      console.info(
        `✅ Session performance summary completed for ${session.id}`
      );

      performanceMonitor.endQuery(
        queryContext,
        true,
        Object.keys(sessionSummary).length
      );
      return sessionSummary;
    } catch (error) {
      console.error(
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
    const session = await getSessionById(sessionId);
    if (!session) {
      console.error(`❌ Session ${sessionId} not found.`);
      return false;
    }

    // Get all attempts related to this session - handle multiple ID formats
    const attemptedProblemIds = new Set(
      session.attempts.map((a) => a.problemId || a.leetCodeID || a.id)
    );

    // Check if all scheduled problems have been attempted - handle multiple ID formats
    const unattemptedProblems = session.problems.filter((problem) => {
      const problemId = problem.id || problem.leetCodeID || problem.problemId;
      return !attemptedProblemIds.has(problemId);
    });

    console.info("📎 Unattempted Problems:", unattemptedProblems);

    if (unattemptedProblems.length === 0) {
      // ✅ Mark session as completed
      session.status = "completed";
      await updateSessionInDB(session);

      console.info(`✅ Session ${sessionId} marked as completed.`);

      // ✅ Clear session cache since session status changed
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          chrome.runtime.sendMessage({ type: "clearSessionCache" });
        }
      } catch (error) {
        console.warn("Failed to clear session cache:", error);
      }

      // ✅ Run centralized session performance analysis
      await this.summarizeSessionPerformance(session);
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
        if (!latestSession || !latestSession.sessionType) {
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
      console.error("Error checking interview session frequency:", error);
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
        console.warn("No interview metrics available for session summary");
        return standardSummary;
      }

      // Add interview-specific analysis
      const interviewSummary = {
        ...standardSummary,
        interviewAnalysis: {
          mode: session.sessionType,
          transferReadinessScore: session.interviewMetrics.transferReadinessScore,
          interventionNeedScore: session.interviewMetrics.interventionNeedScore,
          overallMetrics: session.interviewMetrics.overallMetrics,
          feedback: session.interviewMetrics.feedbackGenerated,
          tagPerformance: Array.from(session.interviewMetrics.tagPerformance.entries())
        }
      };

      // Store interview analytics
      await this.storeInterviewAnalytics(interviewSummary);
      
      console.info("📊 Interview session analysis complete:", {
        sessionId: session.id,
        mode: session.sessionType,
        transferReadiness: session.interviewMetrics.transferReadinessScore,
        feedbackItems: session.interviewMetrics.feedbackGenerated
      });
      
      return interviewSummary;
      
    } catch (error) {
      console.error("Error summarizing interview performance:", error);
      // Fallback to standard summary
      return this.summarizeSessionPerformance(session);
    }
  },

  // NEW: Store interview analytics for dashboard
  async storeInterviewAnalytics(interviewSummary) {
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
      console.error("Error storing interview analytics:", error);
    }
  },

  // NEW: Get tag performance baselines for transfer metrics
  async getTagPerformanceBaselines() {
    try {
      // Get recent session performance data to establish baselines
      const recentPerformance = await getSessionPerformance({ 
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
      console.error("Error getting tag performance baselines:", error);
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
    console.info(`🔍 resumeSession ENTRY: sessionType=${sessionType}`);
    
    // Use efficient query to find in-progress session of specific type
    console.info(`🔍 Calling getLatestSessionByType(${sessionType}, "in_progress")...`);
    const latestSession = await getLatestSessionByType(sessionType, "in_progress");
    console.info(`🔍 resumeSession getLatestSessionByType result:`, {
      found: !!latestSession,
      id: latestSession?.id,
      sessionType: latestSession?.sessionType || 'undefined'
    });

    if (latestSession) {
      // ✨ NEW: Validate session type compatibility before resuming
      console.info(`🔍 Checking session compatibility for resume...`);
      const mismatchInfo = this.detectSessionTypeMismatch(latestSession, sessionType);
      console.info(`🔍 Resume compatibility result:`, mismatchInfo);
      
      if (mismatchInfo.hasMismatch) {
        console.info(`🚫 Cannot resume session due to type mismatch:`, mismatchInfo.details);
        console.info(`🔄 Session ${latestSession.id} (${mismatchInfo.sessionType}) incompatible with current mode (${mismatchInfo.expectedType})`);
        return null; // Fail fast instead of trying to resume incompatible session
      }
      
      console.info(`✅ Resuming existing ${sessionType || 'any'} session:`, latestSession.id);
      
      // Add currentProblemIndex to track progress if missing
      if (!latestSession.currentProblemIndex) {
        latestSession.currentProblemIndex = 0;
      }
      
      console.info(`🔍 Calling saveSessionToStorage...`);
      await saveSessionToStorage(latestSession);
      console.info(`✅ Session saved to storage successfully`);
      return latestSession; // Resume compatible sessions
    }

    console.info(`🔄 No resumable ${sessionType || 'any'} session found`);
    return null;
  },

  /**
   * Creates a new session with fresh problems.
   * @param {string} sessionType - Session type ('standard', 'interview-like', 'full-interview')
   * @returns {Promise<Object|null>} - Session object or null on failure
   */
  async createNewSession(sessionType = 'standard') {
    const queryContext = performanceMonitor.startQuery("createNewSession", {
      operation: "session_creation",
      sessionType
    });

    try {
      console.info(`📌 Creating new ${sessionType} session...`);

      // Use appropriate service based on session type
      console.info(`🎯 SESSION SERVICE: Creating ${sessionType} session`);
      let sessionData;
      if (sessionType === 'standard') {
        console.info("🎯 Calling ProblemService.createSession() for standard session");
        const problems = await ProblemService.createSession();
        sessionData = {
          problems: problems,
          sessionType: 'standard'
        };
        console.info("🎯 Standard session data created:", { problemCount: problems?.length });
      } else {
        console.info(`🎯 Calling ProblemService.createInterviewSession(${sessionType}) for interview session`);
        // Interview session returns structured data
        sessionData = await ProblemService.createInterviewSession(sessionType);
        console.info("🎯 Interview session data created:", {
          sessionType: sessionData?.sessionType,
          problemCount: sessionData?.problems?.length,
          hasConfig: !!sessionData?.interviewConfig
        });
      }
      
      console.info("📌 sessionData for new session:", sessionData);

      const problems = sessionData.problems || [];
      if (!problems || problems.length === 0) {
        console.error("❌ No problems fetched for the new session.");
        performanceMonitor.endQuery(queryContext, true, 0);
        return null;
      }

      const newSession = {
        id: uuidv4(),
        date: new Date().toISOString(),
        status: "in_progress",
        problems: problems,
        attempts: [],
        currentProblemIndex: 0,
        sessionType: sessionType,
        
        // Add interview-specific fields if it's an interview session
        ...(sessionType !== 'standard' && sessionData.interviewConfig && {
          interviewConfig: sessionData.interviewConfig,
          interviewMetrics: sessionData.interviewMetrics,
          createdAt: sessionData.createdAt
        })
      };

      console.info("📌 newSession:", newSession);

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
      this._lastSessionCreationTime = Date.now();

      console.info("✅ New session created and stored:", newSession);
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
    console.info(`🎯 getOrCreateSession called for ${sessionType}`);
    
    // FIRST: Quick check for existing compatible session to avoid unnecessary mutex locks
    const quickCheck = await this.resumeSession(sessionType);
    if (quickCheck) {
      console.info(`🚀 Found existing ${sessionType} session immediately, no mutex needed:`, quickCheck.id);
      return quickCheck;
    }
    
    // Check if session creation is already in progress
    if (this._sessionCreationInProgress) {
      console.info("🔒 Session creation already in progress, waiting for existing operation...");
      if (this._sessionCreationPromise) {
        // Wait for the existing promise with timeout protection
        const MUTEX_WAIT_TIMEOUT = 15000; // 15 seconds max wait
        const startTime = Date.now();
        
        try {
          console.info(`⏱️ Waiting for existing session creation (max ${MUTEX_WAIT_TIMEOUT / 1000}s)...`);
          
          // Race between the existing promise and a timeout
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Mutex wait timeout after ${MUTEX_WAIT_TIMEOUT}ms`)), MUTEX_WAIT_TIMEOUT)
          );
          
          const result = await Promise.race([this._sessionCreationPromise, timeoutPromise]);
          const waitTime = Date.now() - startTime;
          console.info(`✅ Mutex wait completed in ${waitTime}ms, checking session compatibility...`);
          
          // Check if the returned session is compatible with requested type
          if (result && this.isSessionTypeCompatible(result, sessionType)) {
            console.info(`✅ Existing session is compatible with ${sessionType}, returning it`);
            return result;
          } else {
            console.warn(`⚠️ Existing session incompatible with ${sessionType}, will retry after cooldown`);
            // Wait a brief moment and try again - but don't create duplicate
            await new Promise(resolve => setTimeout(resolve, 1000));
            return this.resumeSession(sessionType) || null;
          }
          
        } catch (error) {
          const waitTime = Date.now() - startTime;
          console.warn(`🚫 Mutex wait failed after ${waitTime}ms:`, error.message);
          
          // Try to get an existing session instead of creating a new one
          console.info(`🔍 Attempting to resume existing session instead of creating new...`);
          const existingSession = await this.resumeSession(sessionType);
          if (existingSession) {
            console.info(`✅ Found existing ${sessionType} session during mutex timeout recovery`);
            return existingSession;
          }
          
          console.warn(`🔧 No existing session found, resetting mutex for retry`);
          this.resetSessionCreationMutex();
          throw new Error(`Session creation mutex timeout - please retry the operation`);
        }
      } else {
        // No promise but mutex is set - this is an inconsistent state
        console.warn(`🚫 Inconsistent mutex state: in_progress=true but no promise. Resetting...`);
        this.resetSessionCreationMutex();
      }
    }
    
    // Set mutex lock
    this._sessionCreationInProgress = true;
    this._sessionCreationStartTime = Date.now();
    console.info(`🔒 Acquired session creation mutex for ${sessionType} at ${this._sessionCreationStartTime}`);
    
    // Store the promise so other calls can wait for it
    this._sessionCreationPromise = this._doGetOrCreateSession(sessionType);
    
    try {
      const result = await this._sessionCreationPromise;
      console.info(`✅ Session creation completed successfully for ${sessionType}`);
      return result;
    } catch (error) {
      console.error(`❌ Session creation failed for ${sessionType}:`, error);
      throw error;
    } finally {
      // Release mutex lock
      const mutexDuration = this._sessionCreationStartTime ? Date.now() - this._sessionCreationStartTime : 0;
      console.info(`🔓 Released session creation mutex for ${sessionType} after ${mutexDuration}ms`);
      this._sessionCreationInProgress = false;
      this._sessionCreationPromise = null;
      this._sessionCreationStartTime = null;
    }
  },

  async _doGetOrCreateSession(sessionType = 'standard') {
    console.info(`🔍 _doGetOrCreateSession ENTRY: sessionType=${sessionType}`);
    
    // Check if we're creating sessions too rapidly (prevent race conditions)
    const now = Date.now();
    const timeSinceLastCreation = now - this._lastSessionCreationTime;
    
    if (timeSinceLastCreation < this._sessionCreationCooldown) {
      console.info(`🔄 Session creation cooldown active (${Math.round(timeSinceLastCreation / 1000)}s/${this._sessionCreationCooldown / 1000}s)`);
      
      // Wait for cooldown to complete to prevent rapid session creation
      const remainingCooldown = this._sessionCreationCooldown - timeSinceLastCreation;
      console.info(`⏱️ Waiting ${Math.round(remainingCooldown / 1000)}s for session creation cooldown`);
      await new Promise(resolve => setTimeout(resolve, remainingCooldown));
    }

    console.info(`🔍 Getting settings...`);
    const settings = await StorageService.migrateSettingsToIndexedDB();
    if (!settings) {
      console.error("❌ Settings not found.");
      return null;
    }

    // Try to resume existing in-progress session first
    console.info(`🔍 Calling resumeSession(${sessionType})...`);
    const resumedSession = await this.resumeSession(sessionType);
    if (resumedSession) {
      console.info("✅ Resuming existing session:", resumedSession.id);
      return resumedSession;
    }
    console.info(`🔄 resumeSession returned null - no resumable session found`);

    console.info(`🆕 Creating new ${sessionType} session - no resumable session found`);
    this._lastSessionCreationTime = now; // Update creation time
    
    // Use single session creation path for all session types
    const newSession = await this.createNewSession(sessionType);
    
    console.info(`✅ New session created:`, newSession?.id);
    return newSession;
  },

  /**
   * Skips a problem from the session.
   */
  async skipProblem(leetCodeID) {
    const session = await getLatestSession();
    if (!session) return null;

    session.problems = session.problems.filter(
      (p) => p.leetCodeID !== leetCodeID
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

    for (const problem of session.problems) {
      // Get official difficulty from standard_problems
      const standardProblem = await fetchProblemById(
        problem.leetCodeID || problem.id
      );
      const difficulty = standardProblem?.difficulty || "Medium";

      if (Object.prototype.hasOwnProperty.call(difficultyCount, difficulty)) {
        difficultyCount[difficulty]++;
      }
    }

    return {
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
    const analyticsEvent = {
      timestamp: sessionSummary.completedAt,
      type: "session_completed",
      sessionId: sessionSummary.sessionId,
      metrics: {
        accuracy: Math.round(sessionSummary.performance.accuracy * 100) / 100,
        avgTime: Math.round(sessionSummary.performance.avgTime),
        problemsCompleted: sessionSummary.difficultyAnalysis.totalProblems,
        newMasteries: sessionSummary.masteryProgression.newMasteries,
        predominantDifficulty:
          sessionSummary.difficultyAnalysis.predominantDifficulty,
      },
      tags: {
        strong: sessionSummary.performance.strongTags,
        weak: sessionSummary.performance.weakTags,
      },
    };

    console.info(
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
};
