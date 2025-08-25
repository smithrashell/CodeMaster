import {
  getSessionById,
  getLatestSession,
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

export const SessionService = {
  // Simple session creation timing control to prevent rapid consecutive creation
  _lastSessionCreationTime: 0,
  _sessionCreationCooldown: 30000, // 30 seconds cooldown between session creation attempts
  
  // Session creation mutex to prevent race conditions
  _sessionCreationInProgress: false,
  _sessionCreationPromise: null,
  
  // IndexedDB retry service for deduplication
  _retryService: new IndexedDBRetryService(),

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

  /**
   * Attempts to resume an existing in-progress session.
   * @returns {Promise<Object|null>} - Session object or null if no resumable session
   */
  async resumeSession() {
    const latestSession = await getLatestSession();

    if (latestSession && latestSession.status === "in_progress") {
      console.info("✅ Resuming existing session:", latestSession.id);
      
      // Add currentProblemIndex to track progress if missing
      if (!latestSession.currentProblemIndex) {
        latestSession.currentProblemIndex = 0;
      }
      
      await saveSessionToStorage(latestSession);
      return latestSession; // Always resume in_progress sessions
    }

    if (latestSession) {
      console.error("❌❌❌ SESSION EXISTS BUT STATUS IS NOT in_progress:", latestSession.status);
    } else {
      console.error("❌❌❌ NO SESSION FOUND - will create new session");
    }
    return null;
  },

  /**
   * Creates a new session with fresh problems.
   * @returns {Promise<Object|null>} - Session object or null on failure
   */
  async createNewSession() {
    const queryContext = performanceMonitor.startQuery("createNewSession", {
      operation: "session_creation",
    });

    try {
      console.info("📌 No ongoing session found, creating a new one...");

      const problems = await ProblemService.createSession();
      console.info("📌 problems for new session:", problems);

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
        currentProblemIndex: 0, // Track current problem for dashboard
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
   */
  async getOrCreateSession() {
    console.error("🎯🎯🎯 getOrCreateSession called - DEBUGGING SESSION CREATION");
    console.trace("📍 Session creation call stack:");  // Shows where this was called from
    
    // Check if session creation is already in progress
    if (this._sessionCreationInProgress) {
      console.info("🔒 Session creation already in progress, waiting for existing operation...");
      if (this._sessionCreationPromise) {
        return await this._sessionCreationPromise;
      }
    }
    
    // Set mutex lock
    this._sessionCreationInProgress = true;
    
    // Store the promise so other calls can wait for it
    this._sessionCreationPromise = this._doGetOrCreateSession();
    
    try {
      const result = await this._sessionCreationPromise;
      return result;
    } finally {
      // Release mutex lock
      this._sessionCreationInProgress = false;
      this._sessionCreationPromise = null;
    }
  },

  async _doGetOrCreateSession() {
    // Log current session state for debugging
    const currentLatest = await getLatestSession();
    console.info("🔍 Current latest session before getOrCreateSession:", currentLatest?.id, currentLatest?.status);

    // Check if we're creating sessions too rapidly (prevent race conditions)
    const now = Date.now();
    const timeSinceLastCreation = now - this._lastSessionCreationTime;
    
    if (timeSinceLastCreation < this._sessionCreationCooldown) {
      console.info(`🔄 Session creation cooldown active (${Math.round(timeSinceLastCreation / 1000)}s/${this._sessionCreationCooldown / 1000}s)`);
      
      // Instead of creating a new session, try to resume existing one
      const resumedSession = await this.resumeSession();
      if (resumedSession) {
        return resumedSession;
      }
      
      // If no resumable session, wait for cooldown to complete
      const remainingCooldown = this._sessionCreationCooldown - timeSinceLastCreation;
      console.info(`⏱️ Waiting ${Math.round(remainingCooldown / 1000)}s for session creation cooldown`);
      await new Promise(resolve => setTimeout(resolve, remainingCooldown));
    }

    const settings = await StorageService.migrateSettingsToIndexedDB();
    if (!settings) {
      console.error("❌ Settings not found.");
      return null;
    }

    const resumedSession = await this.resumeSession();
    if (resumedSession) {
      console.info("✅ Resuming existing session:", resumedSession.id);
      return resumedSession;
    }

    console.info("🆕 Creating new session - no resumable session found");
    this._lastSessionCreationTime = now; // Update creation time
    return await this.createNewSession();
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
