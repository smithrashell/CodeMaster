// eslint-disable-next-line no-restricted-imports
import { dbHelper } from "../db/index.js";
import {  getMostRecentAttempt } from "../db/attempts.js";
import { SessionService } from "../services/sessionService.js";
import { getLatestSessionByType } from "../db/sessions.js";
import { calculateLeitnerBox } from "../utils/leitnerSystem.js";
import { createAttemptRecord } from "../utils/Utils.js";
import { saveSessionToStorage, updateSessionInDB, saveNewSessionToDB } from "../db/sessions.js";
import { ProblemService } from "./problemService.js";
import FocusCoordinationService from "./focusCoordinationService.js";
import { debug, success, system } from "../utils/logger.js";
import { v4 as uuidv4 } from "uuid";
import { updateTagMasteryForAttempt } from "../db/tag_mastery.js";
import { updateProblemRelationships } from "../db/problem_relationships.js";
import { updatePatternLaddersOnAttempt } from "./problemladderService.js";

const openDB = dbHelper.openDB;
// Removed circular dependency: const _checkAndCompleteSession = SessionService.checkAndCompleteSession;

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

    // Debug: Log session structure to understand ID issue
    if (session) {
      console.log(`🔍 SESSION STRUCTURE DEBUG:`, {
        hasId: !!session.id,
        idValue: session.id,
        idType: typeof session.id,
        sessionKeys: Object.keys(session),
        sessionType: session.session_type,
        status: session.status
      });
    }

    return session;
  }
  
  /**
   * Check if problem matches any scheduled problems in the guided session
   * Enhanced matching with normalized ID comparison and debugging
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
    
    console.log("🔍 isMatchingProblem: Starting normalized match check");
    console.log("🔍 Raw problem object:", {
      id: problem.id,
      leetcode_id: problem.leetcode_id,
      problem_id: problem.problem_id,
      title: problem.title,
      allKeys: Object.keys(problem)
    });
    
    // Normalize current problem IDs for comparison
    const problemIds = [
      problem.id,
      problem.leetcode_id,
      problem.problem_id
    ].filter(id => id != null).map(id => String(id));
    
    console.log("🔍 Current problem normalized IDs:", problemIds);
    
    for (let i = 0; i < session.problems.length; i++) {
      const sessionProblem = session.problems[i];
      
      // Session problems use LeetCode numeric IDs, database problems use UUIDs
      // Match by LeetCode ID: session.id (268) should equal problem.leetcode_id (268)
      const sessionLeetCodeId = String(sessionProblem.id); // Session stores LeetCode ID as 'id'
      const problemLeetCodeId = String(problem.leetcode_id); // Database problem has leetcode_id field
      
      console.log(`🔍 Comparing session problem ${i}:`, {
        sessionLeetCodeId,
        problemLeetCodeId,
        match: sessionLeetCodeId === problemLeetCodeId,
        sessionProblem: {
          id: sessionProblem.id,
          title: sessionProblem.title,
          slug: sessionProblem.slug
        },
        databaseProblem: {
          problem_id: problem.problem_id, // UUID primary key
          leetcode_id: problem.leetcode_id, // LeetCode reference
          title: problem.title
        }
      });
      
      // Match by LeetCode ID only
      const hasMatch = sessionLeetCodeId === problemLeetCodeId;
      
      if (hasMatch) {
        console.log(`✅ Found matching problem at index ${i}:`, {
          matchedLeetCodeId: sessionLeetCodeId,
          sessionProblem: {
            id: sessionProblem.id,
            title: sessionProblem.title,
            slug: sessionProblem.slug
          },
          databaseProblem: {
            problem_id: problem.problem_id,
            leetcode_id: problem.leetcode_id,
            title: problem.title
          }
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
    
    // Look for tracking sessions using session_type
    const request = store.openCursor(null, 'prev');
    
    return new Promise((resolve) => {
      
      request.onsuccess = async (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const session = cursor.value;
          
          // Filter for tracking sessions that are in progress
          if (session.session_type !== 'tracking' || session.status !== 'in_progress') {
            cursor.continue();
            return;
          }
          const lastActivity = new Date(session.last_activity_time || session.date);
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
      const focusDecision = await FocusCoordinationService.getFocusDecision("session_state");
      
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
      last_activity_time: new Date().toISOString(),
      problems: [], // Tracking sessions have no predefined problems
      attempts: [],
      session_type: 'tracking',
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
    session.last_activity_time = new Date().toISOString();
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
      session.last_activity_time = new Date().toISOString();
      
      // Update session in database with new status
      await updateSessionInDB(session);
      await saveSessionToStorage(session, true);
    } else {
      // Update session activity for already active sessions
      await this.updateSessionActivity(session);
    }
    
    // Associate attempt with session
    attemptData.session_id = session.id; // Standardized snake_case for database
    
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
    attemptData.session_id = session.id; // Standardized snake_case for database
    
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
    if ((attemptData.Success || attemptData.success) && session.problems && Array.isArray(session.problems)) {
      console.log(`🎯 Attempting to remove completed problem from session`, {
        problemId: problem.id,
        problemLeetcode_id: problem.leetcode_id,
        sessionId: session.id,
        success: attemptData.Success || attemptData.success,
        currentProblemCount: session.problems.length
      });
      
      // Instead of destructively removing problems, mark them as attempted
      session.problems = session.problems.map(p => {
        const isAttempted = String(p.id) === String(problem.leetcode_id);
        console.log(`🔍 Problem attempt marking:`, {
          sessionProblemId: p.id,
          sessionProblemTitle: p.title,
          databaseProblemLeetcodeId: problem.leetcode_id,
          isAttempted,
          previouslyAttempted: p.attempted || false
        });

        if (isAttempted) {
          return { ...p, attempted: true, attempt_date: new Date().toISOString() };
        }
        return p;
      });

      const attemptedCount = session.problems.filter(p => p.attempted).length;
      console.log(`✅ Problem attempt marking result: ${attemptedCount}/${session.problems.length} problems attempted`);
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
    const attemptSource = 'test_attempt'; // Default source for attempt tracking

    // Add UID prefix for forensic database tracking during tests
    const baseAttemptData = {
      ...attemptData,
      problem_id: problem.problem_id || problem.id, // Include problem UUID
      leetcode_id: problem.leetcode_id, // Include LeetCode ID for session processing
      source: attemptSource // Track attempt source for analytics
    };

    // Add test UID prefix to attempt ID if test database is active
    if (globalThis._testDatabaseActive && globalThis._testDatabaseHelper?.testSessionUID) {
      const originalId = baseAttemptData.id || uuidv4();
      baseAttemptData.id = `${globalThis._testDatabaseHelper.testSessionUID}_${originalId}`;
    }

    const record = createAttemptRecord(baseAttemptData);
    await putData(attemptStore, record);

    // Update problem record - ensure correct key field for database
    // The problems store uses keyPath: "problem_id", but problem objects sometimes have "id"
    if (problem.id && !problem.problem_id) {
      problem.problem_id = problem.id;
    }
    await putData(problemStore, problem);

    // Append attempt to session - store LeetCode ID for proper session completion matching
    session.attempts = session.attempts || [];
    session.attempts.push({
      attempt_id: record.id,
      problem_id: record.problem_id, // Database UUID (snake_case)
      leetcode_id: problem.leetcode_id, // LeetCode ID for lookups (snake_case)
      success: record.success,
      time_spent: record.time_spent,
      difficulty: record.difficulty, // User-assessed difficulty from form
      source: source
    });

    // Update session record
    await putData(sessionStore, session);

    // Update tag mastery incrementally for this specific attempt
    try {
      // Find the session problem that has the complete tag data
      const sessionProblem = session.problems?.find(p =>
        String(p.id) === String(problem.leetcode_id)
      );

      if (sessionProblem && sessionProblem.tags) {
        console.log(`🧠 Using session problem with ${sessionProblem.tags.length} tags:`, sessionProblem.tags);
        await updateTagMasteryForAttempt(sessionProblem, record);
        console.log("✅ Tag mastery updated for attempt");
      } else {
        console.warn("⚠️ Session problem not found or missing tags, falling back to database problem");
        await updateTagMasteryForAttempt(problem, record);
        console.log("✅ Tag mastery updated for attempt (fallback)");
      }
    } catch (error) {
      console.error("❌ Error updating tag mastery for attempt:", error);
    }

    // Update problem relationships incrementally for this specific attempt
    try {
      await updateProblemRelationships(session);
      console.log("✅ Problem relationships updated for attempt");
    } catch (error) {
      console.error("❌ Error updating problem relationships for attempt:", error);
    }

    // Check if guided session is complete (tracking sessions don't auto-complete)
    console.log(`🔍 POST-ATTEMPT: Session completion check for ${session.id}:`, {
      sessionType: session.session_type,
      willCheckCompletion: session.session_type !== 'tracking',
      totalProblemsInSession: session.problems?.length || 0,
      totalAttemptsInSession: session.attempts?.length || 0,
      latestAttemptProblemId: session.attempts?.[session.attempts.length - 1]?.problem_id
    });
    
    if (session.session_type !== 'tracking') {
      if (!session.id) {
        console.error(`❌ Session has no ID, cannot check completion:`, {
          sessionId: session.id,
          sessionType: session.session_type,
          hasProblems: !!session.problems,
          problemsLength: session.problems?.length || 0
        });
      } else {
        console.log(`🔍 CALLING checkAndCompleteSession for session ${session.id}`);
        const completionResult = await SessionService.checkAndCompleteSession(session.id);
        console.log(`🔍 COMPLETION RESULT:`, completionResult);
      }
    } else {
      console.log(`⏭️ SKIPPING completion check - session type is 'tracking'`);
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

    // Validate attempt data
    if (!attemptData || typeof attemptData !== 'object' || Array.isArray(attemptData)) {
      console.error("AddAttempt: Invalid attempt data", attemptData);
      return { error: "Invalid attempt data provided." };
    }

    // Validate required structure - attempt should have some meaningful data
    const hasValidProperties = Object.keys(attemptData).length > 0 &&
      (Object.prototype.hasOwnProperty.call(attemptData, 'success') ||
       Object.prototype.hasOwnProperty.call(attemptData, 'timeSpent') ||
       Object.prototype.hasOwnProperty.call(attemptData, 'difficulty') ||
       Object.prototype.hasOwnProperty.call(attemptData, 'timestamp'));

    if (!hasValidProperties) {
      console.error("AddAttempt: Attempt data missing required properties", attemptData);
      return { error: "Attempt data missing required properties." };
    }
    // Debug: Log current problem structure
    console.log("🔍 Current problem object:", {
      id: problem.id,
      leetcode_id: problem.leetcode_id,
      title: problem.title,
      problem_id: problem.problem_id,
      allKeys: Object.keys(problem)
    });

    // 1. Check for active guided session first
    console.log("🔍 ATTEMPT CREATION FLOW - Starting session attribution");
    console.log("🔍 Problem data for matching:", {
      problem_id: problem.problem_id, // UUID
      leetcode_id: problem.leetcode_id, // LeetCode number
      title: problem.title
    });

    const guidedSession = await SessionAttributionEngine.getActiveGuidedSession();
    if (!guidedSession) {
      console.log("❌ No active guided session found - will create tracking session");
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
      console.log(`🔍 Found guided session: ${guidedSession.session_type} (${guidedSession.status})`);
      
      // Debug: Log session problems structure
      console.log("🔍 Session problems array:", {
        problemsCount: guidedSession.problems.length,
        problems: guidedSession.problems.map(p => ({
          id: p.id,
          leetcode_id: p.leetcode_id,
          problem_id: p.problem_id,
          title: p.title,
          allKeys: Object.keys(p || {})
        }))
      });
      
      // 2. Check if this problem matches any problems in the guided session
      console.log(`🔍 Checking if problem matches session ${guidedSession.id}...`);
      if (SessionAttributionEngine.isMatchingProblem(guidedSession, problem)) {
        console.log(`✅ MATCH FOUND! Problem leetcode_id=${problem.leetcode_id} matches guided session ${guidedSession.id}`);
        const result = await SessionAttributionEngine.attachToGuidedSession(guidedSession, attemptData, problem);
        console.log(`✅ Successfully attached attempt to guided session:`, {
          attemptId: result.sessionId ? 'created' : 'failed',
          sessionId: guidedSession.id,
          problemLeetCodeId: problem.leetcode_id,
          userDifficulty: attemptData.difficulty
        });

        // Update pattern ladders for this attempted problem
        try {
          await updatePatternLaddersOnAttempt(problem.leetcode_id || problem.id);
        } catch (error) {
          console.error("❌ Error updating pattern ladders after guided session attempt:", error);
          // Don't fail the attempt if pattern ladder update fails
        }

        // Notify UI to refresh focus area eligibility
        try {
          window.dispatchEvent(new CustomEvent("cm:attempt-recorded"));
        } catch (err) {
          // Silent fail - window might not be available in background context
        }

        return result;
      }
      
      console.log(`❌ Problem ${problem.id || problem.leetcode_id} does not match any problems in guided session ${guidedSession.id}`);
      console.log("🔍 Detailed matching check failed - problem not found in session");
    }

    // 3. Fall back to tracking session (independent problem solving)
    console.log("🔄 Routing to tracking session for independent problem solving");
    let trackingSession = await SessionAttributionEngine.getRecentTrackingSession();
    if (!trackingSession) {
      trackingSession = await SessionAttributionEngine.createTrackingSession();
    }

    const result = await SessionAttributionEngine.attachToTrackingSession(trackingSession, attemptData, problem);

    // Update pattern ladders for this attempted problem
    try {
      await updatePatternLaddersOnAttempt(problem.leetcode_id || problem.id);
    } catch (error) {
      console.error("❌ Error updating pattern ladders after attempt:", error);
      // Don't fail the attempt if pattern ladder update fails
    }

    // Notify UI to refresh focus area eligibility
    try {
      window.dispatchEvent(new CustomEvent("cm:attempt-recorded"));
    } catch (err) {
      // Silent fail - window might not be available in background context
    }

    // Cache invalidation no longer needed - real-time dashboard data bypasses cache

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
    // Debug logging to identify keyPath evaluation issues
    console.log(`🔍 putData called for store: ${store.name}`);
    console.log(`🔍 Data being inserted:`, {
      id: data.id,
      idType: typeof data.id,
      hasId: 'id' in data,
      allKeys: Object.keys(data),
      storeKeyPath: store.keyPath
    });

    const request = store.put(data);
    request.onsuccess = resolve;
    request.onerror = () => {
      console.error(`❌ IndexedDB put error for store ${store.name}:`, {
        error: request.error,
        data: data,
        keyPath: store.keyPath,
        dataId: data.id
      });
      reject(request.error);
    };
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
          // Check both problem_id (UUID) and leetcode_id for compatibility
          attempt.problem_id?.toString() === problemId?.toString() ||
          attempt.leetcode_id?.toString() === problemId?.toString()
        );
        
        const successfulAttempts = problemAttempts.filter(attempt => attempt.success === true);
        const successful = successfulAttempts.length;
        const total = problemAttempts.length;

        // Find the most recent successful attempt
        let lastSolved = null;
        if (successfulAttempts.length > 0) {
          const mostRecentSuccess = successfulAttempts
            .sort((a, b) => new Date(b.attempt_date || b.date) - new Date(a.attempt_date || a.date))[0];
          lastSolved = mostRecentSuccess.attempt_date || mostRecentSuccess.date;
        }

        // Find the most recent attempt (successful or not)
        let lastAttempted = null;
        if (problemAttempts.length > 0) {
          const mostRecentAttempt = problemAttempts
            .sort((a, b) => new Date(b.attempt_date || b.date) - new Date(a.attempt_date || a.date))[0];
          lastAttempted = mostRecentAttempt.attempt_date || mostRecentAttempt.date;
        }

        resolve({ successful, total, lastSolved, lastAttempted });
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
