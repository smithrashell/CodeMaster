// eslint-disable-next-line no-restricted-imports
import { dbHelper } from "../db/index.js";
import {  getMostRecentAttempt } from "../db/attempts.js";
import { SessionService } from "../services/sessionService.js";
import { getLatestSessionByType } from "../db/sessions.js";
import { calculateLeitnerBox } from "../utils/leitnerSystem";
import { createAttemptRecord } from "../utils/Utils.js";
import { saveSessionToStorage, updateSessionInDB, saveNewSessionToDB } from "../db/sessions.js";
import { ProblemService } from "./problemService.js";
import FocusCoordinationService from "./focusCoordinationService.js";
import { debug, success, system } from "../utils/logger.js";
import { v4 as uuidv4 } from "uuid";

const openDB = dbHelper.openDB;
const _checkAndCompleteSession = SessionService.checkAndCompleteSession;

/**
 * Session Attribution Engine - Routes attempts to appropriate sessions
 * based on usage context (guided vs tracking)
 */
class SessionAttributionEngine {
  /**
   * Get active guided session (standard, interview-like, or full-interview)
   * Checks both draft and in_progress status
   */
  static async getActiveGuidedSession() {
    // First try in_progress sessions
    let session = await getLatestSessionByType('standard', 'in_progress') ||
                  await getLatestSessionByType('interview-like', 'in_progress') ||
                  await getLatestSessionByType('full-interview', 'in_progress');
    
    // If no in_progress found, check draft sessions
    if (!session) {
      session = await getLatestSessionByType('standard', 'draft') ||
                await getLatestSessionByType('interview-like', 'draft') ||
                await getLatestSessionByType('full-interview', 'draft');
    }
    
    return session;
  }
  
  /**
   * Check if problem matches any scheduled problems in the guided session
   * Enhanced matching with comprehensive property checks and debugging
   */
  static isMatchingProblem(session, problem) {
    if (!session?.problems || !problem) {
      console.log("🔍 isMatchingProblem: Missing session.problems or problem", {
        hasSession: !!session,
        hasProblems: !!session?.problems,
        problemsLength: session?.problems?.length || 0,
        hasProblem: !!problem
      });
      return false;
    }
    
    console.log("🔍 isMatchingProblem: Starting detailed match check");
    
    for (let i = 0; i < session.problems.length; i++) {
      const sessionProblem = session.problems[i];
      
      // Comprehensive matching logic covering all possible property combinations
      const matches = [
        // Direct ID matches
        sessionProblem.id === problem.id,
        sessionProblem.leetCodeID === problem.leetCodeID,
        sessionProblem.problemId === problem.id,
        sessionProblem.problemId === problem.leetCodeID,
        sessionProblem.id === problem.leetCodeID,
        sessionProblem.leetCodeID === problem.id,
        
        // Cross-property matches for different naming conventions
        sessionProblem.id === problem.problemId,
        sessionProblem.leetCodeID === problem.problemId,
        sessionProblem.problemId === problem.problemId,
        
        // String comparison for LeetCode IDs (handle number vs string)
        String(sessionProblem.leetCodeID) === String(problem.leetCodeID),
        String(sessionProblem.id) === String(problem.id),
        String(sessionProblem.problemId) === String(problem.problemId || problem.id || problem.leetCodeID)
      ];
      
      const hasMatch = matches.some(match => match && match !== false);
      
      if (hasMatch) {
        console.log(`✅ Found matching problem at index ${i}:`, {
          sessionProblem: {
            id: sessionProblem.id,
            leetCodeID: sessionProblem.leetCodeID,
            problemId: sessionProblem.problemId
          },
          currentProblem: {
            id: problem.id,
            leetCodeID: problem.leetCodeID,
            problemId: problem.problemId
          },
          matchResults: matches.map((match, idx) => ({ idx, match })).filter(r => r.match)
        });
        return true;
      }
    }
    
    console.log("❌ No matching problem found in session");
    return false;
  }
  
  /**
   * Get recent tracking session within optimal parameters
   * Uses updated parameters: 4-6 hours active time, 2+ hours inactivity threshold
   */
  static async getRecentTrackingSession() {
    const db = await openDB();
    const transaction = db.transaction('sessions', 'readonly');
    const store = transaction.objectStore('sessions');
    
    // Look for tracking sessions using sessionType
    const request = store.openCursor(null, 'prev');
    
    return new Promise((resolve) => {
      
      request.onsuccess = async (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const session = cursor.value;
          
          // Filter for tracking sessions that are in progress
          if (session.sessionType !== 'tracking' || session.status !== 'in_progress') {
            cursor.continue();
            return;
          }
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
      await updateSessionInDB(updatedSession);
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
    const trackingSession = {
      id: uuidv4(),
      date: new Date().toISOString(), 
      status: 'in_progress',
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
    
    await saveNewSessionToDB(trackingSession);
    await saveSessionToStorage(trackingSession);
    
    success('🆕 Created optimized tracking session', { sessionId: trackingSession.id });
    return trackingSession;
  }
  
  /**
   * Update session's last activity time
   */
  static async updateSessionActivity(session) {
    session.lastActivityTime = new Date().toISOString();
    await updateSessionInDB(session);
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

    // Remove completed problems from session (successful attempts)
    if (attemptData.Success && session.problems && Array.isArray(session.problems)) {
      console.log(`🎯 Attempting to remove completed problem from session`, {
        problemId: problem.id,
        problemLeetCodeID: problem.leetCodeID,
        sessionId: session.id,
        success: attemptData.Success,
        currentProblemCount: session.problems.length
      });
      
      const initialCount = session.problems.length;
      session.problems = session.problems.filter(p => {
        const shouldKeep = !(
          (p.id && p.id === problem.id) || 
          (p.leetCodeID && p.leetCodeID === problem.leetCodeID) ||
          (p.problemId && p.problemId === problem.id)
        );
        return shouldKeep;
      });
      
      console.log(`✅ Problem removal result: ${initialCount} → ${session.problems.length} problems`);
    }

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
    if (session.sessionType !== 'tracking') {
      await _checkAndCompleteSession(session.id);
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

    // Debug: Log current problem structure
    console.log("🔍 Current problem object:", {
      id: problem.id,
      leetCodeID: problem.leetCodeID,
      ProblemDescription: problem.ProblemDescription,
      problemId: problem.problemId,
      allKeys: Object.keys(problem)
    });

    // 1. Check for active guided session first
    const guidedSession = await SessionAttributionEngine.getActiveGuidedSession();
    if (!guidedSession) {
      console.log("❌ No active guided session found");
    } else if (!guidedSession.problems || !Array.isArray(guidedSession.problems)) {
      console.log(`⚠️ Guided session ${guidedSession.id} has invalid problems array:`, {
        hasProblems: !!guidedSession.problems,
        isArray: Array.isArray(guidedSession.problems),
        type: typeof guidedSession.problems
      });
      console.log("🔄 Session invalid - falling back to tracking session");
    } else if (guidedSession.problems.length === 0) {
      console.log(`⚠️ Guided session ${guidedSession.id} has empty problems array - likely a draft session`);
      console.log("🔄 Session has no problems - falling back to tracking session");
    } else {
      console.log(`🔍 Found guided session: ${guidedSession.sessionType} (${guidedSession.status})`);
      
      // Debug: Log session problems structure
      console.log("🔍 Session problems array:", {
        problemsCount: guidedSession.problems.length,
        problems: guidedSession.problems.map(p => ({
          id: p.id,
          leetCodeID: p.leetCodeID,
          problemId: p.problemId,
          ProblemDescription: p.ProblemDescription,
          allKeys: Object.keys(p || {})
        }))
      });
      
      // 2. Check if this problem matches any problems in the guided session
      if (SessionAttributionEngine.isMatchingProblem(guidedSession, problem)) {
        console.log(`✅ Problem ${problem.id || problem.leetCodeID} matches guided session ${guidedSession.id}`);
        const result = await SessionAttributionEngine.attachToGuidedSession(guidedSession, attemptData, problem);
        
        // Notify UI to refresh focus area eligibility
        try {
          window.dispatchEvent(new CustomEvent("cm:attempt-recorded"));
        } catch (err) {
          // Silent fail - window might not be available in background context
        }
        
        return result;
      }
      
      console.log(`❌ Problem ${problem.id || problem.leetCodeID} does not match any problems in guided session ${guidedSession.id}`);
      console.log("🔍 Detailed matching check failed - problem not found in session");
    }

    // 3. Fall back to tracking session (independent problem solving)
    console.log("🔄 Routing to tracking session for independent problem solving");
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

/**
 * Get attempt statistics for a specific problem
 * @param {string|number} problemId - The problem ID to get stats for
 * @returns {Promise<{successful: number, total: number}>}
 */
async function getProblemAttemptStats(problemId) {
  try {
    const db = await openDB();
    const transaction = db.transaction("attempts", "readonly");
    const store = transaction.objectStore("attempts");
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      
      request.onsuccess = () => {
        const allAttempts = request.result || [];
        const problemAttempts = allAttempts.filter(attempt => 
          attempt.problemID?.toString() === problemId?.toString()
        );
        
        const successfulAttempts = problemAttempts.filter(attempt => attempt.success === true);
        const successful = successfulAttempts.length;
        const total = problemAttempts.length;
        
        // Find the most recent successful attempt
        let lastSolved = null;
        if (successfulAttempts.length > 0) {
          const mostRecentSuccess = successfulAttempts
            .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
          lastSolved = mostRecentSuccess.date;
        }
        
        resolve({ successful, total, lastSolved });
      };
      
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Error getting problem attempt stats:", error);
    throw error;
  }
}

export const AttemptsService = {
  addAttempt,
  getMostRecentAttempt,
  getProblemAttemptStats,
};
