// eslint-disable-next-line no-restricted-imports
import { dbHelper } from "../db/index.js";
import {  getMostRecentAttempt } from "../db/attempts.js";
import { SessionService } from "../services/sessionService.js";
import { calculateLeitnerBox } from "../utils/leitnerSystem";
import { createAttemptRecord } from "../utils/Utils.js";
import { saveSessionToStorage, updateSessionInDB } from "../db/sessions.js";
import { ProblemService } from "./problemService.js";
import FocusCoordinationService from "./focusCoordinationService.js";
import { debug, success, system } from "../utils/logger.js";

const openDB = dbHelper.openDB;
const _checkAndCompleteSession = SessionService.checkAndCompleteSession;

/**
 * Session Attribution Engine - Routes attempts to appropriate sessions
 * based on usage context (guided vs tracking)
 */
class SessionAttributionEngine {
  /**
   * Get active guided session that's currently in progress
   */
  static async getActiveGuidedSession() {
    return await SessionService.getLatestSessionByType(null, 'in_progress');
  }
  
  /**
   * Check if problem matches any scheduled problems in the guided session
   */
  static isMatchingProblem(session, problem) {
    if (!session?.problems || !problem) return false;
    
    return session.problems.some(p => 
      p.id === problem.id || 
      p.leetCodeID === problem.leetCodeID ||
      p.problemId === problem.id
    );
  }
  
  /**
   * Get recent tracking session within optimal parameters
   * Uses updated parameters: 4-6 hours active time, 2+ hours inactivity threshold
   */
  static async getRecentTrackingSession() {
    const db = await openDB();
    const transaction = db.transaction('sessions', 'readonly');
    const store = transaction.objectStore('sessions');
    const index = store.index('by_origin_status');
    
    return new Promise((resolve) => {
      const request = index.openCursor(IDBKeyRange.only(['tracking', 'in_progress']), 'prev');
      
      request.onsuccess = async (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const session = cursor.value;
          const lastActivity = new Date(session.lastActivityTime || session.date);
          const hoursStale = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60);
          const attemptCount = session.attempts?.length || 0;
          
          // Check if session should be rotated based on optimal parameters
          const shouldRotate = this.shouldRotateTrackingSession(session, hoursStale, attemptCount);
          
          if (shouldRotate) {
            // Complete the session with focus determination before rotation
            await this.completeTrackingSessionWithFocus(session);
          }
          
          if (!shouldRotate && hoursStale <= 6) { // Within 6-hour active window
            resolve(session);
            return;
          }
        }
        resolve(null);
      };
      
      request.onerror = () => resolve(null);
    });
  }
  
  /**
   * Check if tracking session should be rotated based on optimal parameters
   * @param {Object} session - Current tracking session
   * @param {number} hoursStale - Hours since last activity
   * @param {number} attemptCount - Number of attempts in session
   * @returns {boolean} True if session should be rotated
   */
  static shouldRotateTrackingSession(session, hoursStale, attemptCount) {
    // Inactivity threshold: 2+ hours gap starts new session
    if (hoursStale >= 2) {
      system(`🔄 Rotating tracking session: ${hoursStale.toFixed(1)}h inactivity`);
      return true;
    }
    
    // Attempt limit: 12 attempts max (soft limit before rotation)
    if (attemptCount >= 12) {
      system(`🔄 Rotating tracking session: ${attemptCount} attempts reached limit`);
      return true;
    }
    
    // Daily boundary: New day = new session
    const sessionDate = new Date(session.date);
    const today = new Date();
    if (sessionDate.toDateString() !== today.toDateString()) {
      system('🔄 Rotating tracking session: Daily boundary crossed');
      return true;
    }
    
    // Topic coherence check: max 4 different problem categories
    const uniqueTags = new Set();
    session.attempts?.forEach(attempt => {
      if (attempt.tags) {
        attempt.tags.forEach(tag => uniqueTags.add(tag));
      }
    });
    
    if (uniqueTags.size > 4) {
      system(`🔄 Rotating tracking session: ${uniqueTags.size} different topics (max 4)`);
      return true;
    }
    
    return false;
  }
  
  /**
   * Complete tracking session with focus determination using FocusCoordinationService
   * Integrates with existing learning system patterns
   */
  static async completeTrackingSessionWithFocus(session) {
    try {
      system(`🎯 Completing tracking session ${session.id} with focus determination`);
      
      // Only complete sessions that have attempts and aren't already completed
      if (!session.attempts?.length || session.status === 'completed') {
        return;
      }
      
      // Get focus decision from FocusCoordinationService
      const focusDecision = await FocusCoordinationService.getFocusDecision('user'); // TODO: Get actual userId
      
      // Complete the session with focus data
      const completionData = {
        status: 'completed',
        completedAt: new Date().toISOString(),
        completionType: 'auto_completion_tracking',
        attemptCount: session.attempts.length,
        sessionFocus: {
          recommendedTags: focusDecision.recommendedTags || [],
          focusReasoning: focusDecision.reasoning || 'Tracking session auto-completion',
          focusCoordination: focusDecision
        }
      };
      
      // Update session in database
      const updatedSession = { ...session, ...completionData };
      await SessionService.updateSessionInDB(updatedSession);
      await saveSessionToStorage(updatedSession, true);
      
      success(`✅ Completed tracking session ${session.id} with focus`, { recommendedTags: completionData.sessionFocus.recommendedTags });
      
    } catch (error) {
      console.error('Error completing tracking session with focus:', error);
    }
  }

  /**
   * Create new tracking session for independent problem solving
   * Uses optimal parameters: 8-12 attempts, 4-6 hours active time
   */
  static async createTrackingSession() {
    const { v4: uuidv4 } = await import('uuid');
    const trackingSession = {
      id: uuidv4(),
      date: new Date().toISOString(), 
      status: 'in_progress',
      origin: 'tracking',
      startedBy: 'auto_inferred',
      lastActivityTime: new Date().toISOString(),
      problems: [], // Tracking sessions have no predefined problems
      attempts: [],
      sessionType: 'tracking',
      metadata: {
        optimalParameters: {
          maxAttempts: 12,
          maxActiveHours: 6,
          inactivityThreshold: 2,
          maxTopicCategories: 4
        }
      }
    };
    
    await SessionService.saveNewSessionToDB(trackingSession);
    await saveSessionToStorage(trackingSession);
    
    success('🆕 Created optimized tracking session', { sessionId: trackingSession.id });
    return trackingSession;
  }
  
  /**
   * Update session's last activity time
   */
  static async updateSessionActivity(session) {
    session.lastActivityTime = new Date().toISOString();
    await SessionService.updateSessionInDB(session);
    await saveSessionToStorage(session, true);
  }
  
  /**
   * Attach attempt to guided session
   */
  static async attachToGuidedSession(session, attemptData, problem) {
    debug('📚 Attaching to guided session', { sessionId: session.id });
    
    // If this is a draft session, transition it to in_progress on first attempt
    if (session.status === 'draft') {
      console.log('▶️ Transitioning draft session to in_progress:', session.id);
      session.status = 'in_progress';
      session.lastActivityTime = new Date().toISOString();
      
      // Update session in database with new status
      await updateSessionInDB(session);
      await saveSessionToStorage(session, true);
    } else {
      // Update session activity for already active sessions
      await this.updateSessionActivity(session);
    }
    
    // Associate attempt with session
    attemptData.SessionID = session.id;
    
    // Process attempt with existing session logic
    return this.processAttemptWithSession(session, attemptData, problem, 'session_problem');
  }
  
  /**
   * Attach attempt to tracking session
   */
  static async attachToTrackingSession(session, attemptData, problem) {
    console.log('📈 Attaching to tracking session:', session.id);
    
    // Update session activity
    await this.updateSessionActivity(session);
    
    // Associate attempt with session
    attemptData.SessionID = session.id;
    
    // Process attempt with existing session logic
    return this.processAttemptWithSession(session, attemptData, problem, 'ad_hoc');
  }
  
  /**
   * Process attempt with session using existing logic
   */
  static async processAttemptWithSession(session, attemptData, problem, source = 'session_problem') {
    const db = await openDB();
    
    // Update problem Leitner box logic
    problem = await calculateLeitnerBox(problem, attemptData);
    
    // Add or update the problem in session
    session = await ProblemService.addOrUpdateProblemInSession(
      session,
      problem,
      attemptData.id
    );

    // Open a transaction for database operations
    const transaction = db.transaction(
      ["problems", "attempts", "sessions"],
      "readwrite"
    );
    const problemStore = transaction.objectStore("problems");
    const attemptStore = transaction.objectStore("attempts");
    const sessionStore = transaction.objectStore("sessions");

    // Save attempt record with source tracking
    const record = createAttemptRecord({
      ...attemptData,
      source: source // Track attempt source for analytics
    });
    await putData(attemptStore, record);

    // Update problem record
    await putData(problemStore, problem);

    // Append attempt to session
    session.attempts = session.attempts || [];
    session.attempts.push({
      attemptId: record.id,
      problemId: attemptData.ProblemID,
      success: record.Success,
      timeSpent: record.TimeSpent,
      source: source
    });

    // Update session record
    await putData(sessionStore, session);

    // Check if guided session is complete (tracking sessions don't auto-complete)
    if (session.origin === 'generator') {
      await SessionService.checkAndCompleteSession(session.id);
    }
    
    return { message: "Attempt added and problem updated successfully", sessionId: session.id };
  }
}

/**
 * Enhanced addAttempt with Session Attribution Engine
 * Routes attempts to appropriate sessions based on context
 *
 * @param {Object} attemptData - The attempt data object.
 * @param {Object} problem - The problem object.
 * @returns {Promise<Object>} - A success message or an error.
 */
async function addAttempt(attemptData, problem) {
  console.log("📌 SAE addAttempt called");
  try {
    if (!problem) {
      console.error("AddAttempt: Problem not found");
      return { error: "Problem not found." };
    }

    // 1. Check for active guided session with matching problem
    const guidedSession = await SessionAttributionEngine.getActiveGuidedSession();
    if (guidedSession && SessionAttributionEngine.isMatchingProblem(guidedSession, problem)) {
      const result = await SessionAttributionEngine.attachToGuidedSession(guidedSession, attemptData, problem);
      
      // Notify UI to refresh focus area eligibility
      try {
        window.dispatchEvent(new CustomEvent("cm:attempt-recorded"));
      } catch (err) {
        // Silent fail - window might not be available in background context
      }
      
      return result;
    }

    // 2. Get or create tracking session for independent attempts (using optimal parameters)
    let trackingSession = await SessionAttributionEngine.getRecentTrackingSession();
    if (!trackingSession) {
      trackingSession = await SessionAttributionEngine.createTrackingSession();
    }

    const result = await SessionAttributionEngine.attachToTrackingSession(trackingSession, attemptData, problem);
    
    // Notify UI to refresh focus area eligibility
    try {
      window.dispatchEvent(new CustomEvent("cm:attempt-recorded"));
    } catch (err) {
      // Silent fail - window might not be available in background context
    }
    
    return result;
    
  } catch (error) {
    console.error("Error in addAttempt function:", error);
    throw error;
  }
}

/**
 * Utility function to store data in IndexedDB.
 * @param {IDBObjectStore} store - The object store.
 * @param {Object} data - Data to store.
 * @returns {Promise<void>}
 */
function putData(store, data) {
  return new Promise((resolve, reject) => {
    const request = store.put(data);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
}

export const AttemptsService = {
  addAttempt,
  getMostRecentAttempt,
};
