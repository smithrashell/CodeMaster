import { dbHelper } from "./index.js";

const openDB = dbHelper.openDB;

/**
 * Stores a session analytics summary in the dedicated session_analytics store.
 * @param {Object} sessionSummary - Complete session performance summary
 * @returns {Promise<void>}
 */
export async function storeSessionAnalytics(sessionSummary) {
  console.log(`🔍 REAL SESSION ANALYTICS DEBUG: storeSessionAnalytics ENTRY`);
  console.log(`🔍 REAL SESSION ANALYTICS DEBUG: ACTUAL session ID: ${sessionSummary?.session_id}`);
  console.log(`🔍 REAL SESSION ANALYTICS DEBUG: Session ID is UUID? ${sessionSummary?.session_id?.length === 36 && sessionSummary?.session_id?.includes('-')}`);
  console.log(`🔍 REAL SESSION ANALYTICS DEBUG: Input sessionSummary:`, {
    session_id: sessionSummary?.session_id,
    completed_at: sessionSummary?.completed_at,
    hasPerformance: !!sessionSummary?.performance,
    hasAnalysis: !!sessionSummary?.difficulty_analysis,
    hasProgression: !!sessionSummary?.mastery_progression,
    hasInsights: !!sessionSummary?.insights
  });

  if (!sessionSummary) {
    console.error(`❌ ANALYTICS STORAGE DEBUG: sessionSummary is null/undefined`);
    throw new Error("sessionSummary is required");
  }

  if (!sessionSummary.session_id) {
    console.error(`❌ ANALYTICS STORAGE DEBUG: sessionSummary.session_id is missing`);
    throw new Error("sessionSummary.session_id is required");
  }

  const db = await openDB();
  console.log(`🔍 ANALYTICS STORAGE DEBUG: Database connection established`);

  // Debug: Check if session_analytics store exists and its structure
  console.log(`🔍 ANALYTICS STORAGE DEBUG: Database stores:`, Array.from(db.objectStoreNames));
  if (!db.objectStoreNames.contains("session_analytics")) {
    console.error(`❌ ANALYTICS STORAGE DEBUG: session_analytics store does not exist!`);
    throw new Error("session_analytics store not found in database");
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["session_analytics"], "readwrite");
    const store = transaction.objectStore("session_analytics");

    console.log(`🔍 ANALYTICS STORAGE DEBUG: Transaction and store created`);
    console.log(`🔍 ANALYTICS STORAGE DEBUG: Store info:`, {
      name: store.name,
      keyPath: store.keyPath,
      autoIncrement: store.autoIncrement,
      indexNames: Array.from(store.indexNames)
    });

    console.log(`🔍 ANALYTICS STORAGE DEBUG: Database state:`, {
      name: db.name,
      version: db.version,
      objectStoreNames: Array.from(db.objectStoreNames)
    });

    // Create analytics record optimized for querying
    const analyticsRecord = {
      session_id: sessionSummary.session_id,  // This is the keyPath field
      completed_at: sessionSummary.completed_at,

      // Performance metrics for easy querying
      accuracy: Math.round((sessionSummary.performance?.accuracy || 0) * 100) / 100,
      avg_time: Math.round(sessionSummary.performance?.avgTime || 0),

      // Difficulty analysis
      predominant_difficulty:
        sessionSummary.difficulty_analysis?.predominantDifficulty || 'Unknown',
      total_problems: sessionSummary.difficulty_analysis?.totalProblems || 0,
      difficulty_mix: sessionSummary.difficulty_analysis?.percentages || {},

      // Mastery progression
      new_masteries: sessionSummary.mastery_progression?.new_masteries || 0,
      decayed_masteries: sessionSummary.mastery_progression?.decayed_masteries || 0,
      mastery_deltas: sessionSummary.mastery_progression?.deltas || [],

      // Tag performance
      strong_tags: sessionSummary.performance?.strongTags || [],
      weak_tags: sessionSummary.performance?.weakTags || [],
      timing_feedback: sessionSummary.performance?.timingFeedback || {},

      // Insights for user feedback
      insights: sessionSummary.insights || {},

      // Full difficulty breakdown
      difficulty_breakdown: {
        easy: sessionSummary.performance?.easy || sessionSummary.performance?.Easy || { attempts: 0, correct: 0, time: 0, avg_time: 0 },
        medium: sessionSummary.performance?.medium || sessionSummary.performance?.Medium || { attempts: 0, correct: 0, time: 0, avg_time: 0 },
        hard: sessionSummary.performance?.hard || sessionSummary.performance?.Hard || { attempts: 0, correct: 0, time: 0, avg_time: 0 },
      },
    };

    // CRITICAL FIX: Ensure session_id is valid for IndexedDB
    if (!analyticsRecord.session_id || typeof analyticsRecord.session_id !== 'string') {
      console.error(`❌ CRITICAL: Invalid session_id for analytics storage:`, {
        session_id: analyticsRecord.session_id,
        type: typeof analyticsRecord.session_id,
        original: sessionSummary.session_id
      });
      throw new Error(`Invalid session_id: ${analyticsRecord.session_id}`);
    }

    console.log(`🔍 ANALYTICS STORAGE DEBUG: Analytics record created:`, {
      session_id: analyticsRecord.session_id,
      completed_at: analyticsRecord.completed_at,
      accuracy: analyticsRecord.accuracy,
      avg_time: analyticsRecord.avg_time,
      total_problems: analyticsRecord.total_problems,
      new_masteries: analyticsRecord.new_masteries,
      easyAttempts: analyticsRecord.difficulty_breakdown?.easy?.attempts || 0,
      mediumAttempts: analyticsRecord.difficulty_breakdown?.medium?.attempts || 0,
      hardAttempts: analyticsRecord.difficulty_breakdown?.hard?.attempts || 0
    });

    // Check if the record has the required keyPath field
    console.log(`🔍 ANALYTICS STORAGE DEBUG: KeyPath validation:`, {
      storeKeyPath: store.keyPath,
      recordHasKeyPath: Object.prototype.hasOwnProperty.call(analyticsRecord, store.keyPath),
      keyPathValue: analyticsRecord[store.keyPath],
      fullRecord: analyticsRecord
    });

    console.log(`🔍 ANALYTICS STORAGE DEBUG: About to call store.put()...`);
    const request = store.put(analyticsRecord);
    console.log(`🔍 ANALYTICS STORAGE DEBUG: store.put() called, request created:`, !!request);

    request.onsuccess = () => {
      console.log(`✅ ANALYTICS STORAGE DEBUG: Session analytics stored successfully for session ${sessionSummary.session_id}`);
      console.info(
        `📊 Session analytics stored for session ${sessionSummary.session_id}`
      );

      // Verify storage by reading back
      console.log(`🔍 ANALYTICS VERIFICATION: Reading back stored analytics...`);
      const verificationRequest = store.get(sessionSummary.session_id);
      verificationRequest.onsuccess = () => {
        const storedRecord = verificationRequest.result;
        if (storedRecord) {
          console.log(`✅ ANALYTICS VERIFICATION: Record successfully stored and retrieved:`, {
            session_id: storedRecord.session_id,
            completed_at: storedRecord.completed_at,
            accuracy: storedRecord.accuracy,
            total_problems: storedRecord.total_problems
          });
        } else {
          console.error(`❌ ANALYTICS VERIFICATION: No record found after storage!`);
        }
      };

      resolve(analyticsRecord);
    };

    request.onerror = () => {
      console.error(`❌ ANALYTICS STORAGE DEBUG: IndexedDB put operation failed:`, request.error);
      console.error(
        `❌ Failed to store session analytics for ${sessionSummary.session_id}:`,
        request.error
      );
      reject(request.error);
    };

    transaction.onerror = (event) => {
      console.error(`❌ ANALYTICS STORAGE DEBUG: Transaction failed:`, {
        error: transaction.error,
        target: event.target,
        type: event.type
      });
      reject(transaction.error || new Error("Transaction failed"));
    };

    transaction.onabort = (event) => {
      console.error(`❌ ANALYTICS STORAGE DEBUG: Transaction aborted:`, {
        error: transaction.error,
        target: event.target,
        type: event.type
      });
      reject(new Error("Transaction aborted"));
    };

    transaction.oncomplete = (event) => {
      console.log(`✅ ANALYTICS STORAGE DEBUG: Transaction completed successfully for session ${sessionSummary.session_id}`, {
        type: event.type,
        target: event.target
      });
    };
  });
}

/**
 * Retrieves session analytics for a specific session.
 * @param {string} sessionId - Session ID to retrieve
 * @returns {Promise<Object|null>} Session analytics record or null if not found
 */
export async function getSessionAnalytics(sessionId) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["session_analytics"], "readonly");
    const store = transaction.objectStore("session_analytics");

    const request = store.get(sessionId);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieves session analytics within a date range for dashboard queries.
 * @param {Date} startDate - Start of date range
 * @param {Date} endDate - End of date range
 * @param {number} limit - Maximum number of records (default: 100)
 * @returns {Promise<Array>} Array of session analytics records
 */
export async function getSessionAnalyticsRange(
  startDate,
  endDate,
  limit = 100
) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["session_analytics"], "readonly");
    const store = transaction.objectStore("session_analytics");
    let index;
    try {
      index = store.index("by_date");
    } catch (error) {
      console.error(`❌ SESSION ANALYTICS INDEX ERROR: by_date index not found in session_analytics`, {
        error: error.message,
        availableIndexes: Array.from(store.indexNames),
        storeName: "session_analytics"
      });
      reject(error);
      return;
    }

    const range = IDBKeyRange.bound(
      startDate.toISOString(),
      endDate.toISOString()
    );
    const request = index.getAll(range, limit);

    request.onsuccess = () => {
      // Sort by date descending (most recent first)
      const results = request.result.sort(
        (a, b) => new Date(b.completed_at) - new Date(a.completed_at)
      );
      resolve(results);
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieves recent session analytics for dashboard overview.
 * @param {number} limit - Number of recent sessions to retrieve (default: 30)
 * @returns {Promise<Array>} Array of recent session analytics
 */
export async function getRecentSessionAnalytics(limit = 30) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["session_analytics"], "readonly");
    const store = transaction.objectStore("session_analytics");
    const index = store.index("by_date");

    // Get all records and sort by date
    const request = index.getAll();

    request.onsuccess = () => {
      const results = request.result
        .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))
        .slice(0, limit);
      resolve(results);
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieves session analytics with specific accuracy range for performance analysis.
 * @param {number} minAccuracy - Minimum accuracy (0-1)
 * @param {number} maxAccuracy - Maximum accuracy (0-1)
 * @param {number} limit - Maximum records to return
 * @returns {Promise<Array>} Filtered session analytics
 */
export async function getSessionAnalyticsByAccuracy(
  minAccuracy,
  maxAccuracy,
  limit = 50
) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["session_analytics"], "readonly");
    const store = transaction.objectStore("session_analytics");
    const index = store.index("by_accuracy");

    const range = IDBKeyRange.bound(minAccuracy, maxAccuracy);
    const request = index.getAll(range, limit);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Cleans up old session analytics beyond retention period.
 * @param {number} retentionDays - Days to retain (default: 365)
 * @returns {Promise<number>} Number of records deleted
 */
/**
 * Debug function to check what's actually in the session_analytics store
 * @returns {Promise<Array>} All records in the session_analytics store
 */
export async function debugGetAllSessionAnalytics() {
  console.log(`🔍 DEBUG: Getting ALL session analytics from store...`);
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["session_analytics"], "readonly");
    const store = transaction.objectStore("session_analytics");

    const request = store.getAll();

    request.onsuccess = () => {
      const allRecords = request.result || [];
      console.log(`🔍 DEBUG: Found ${allRecords.length} total session analytics records:`, allRecords);
      resolve(allRecords);
    };

    request.onerror = () => {
      console.error(`❌ DEBUG: Failed to get all session analytics:`, request.error);
      reject(request.error);
    };
  });
}

export async function cleanupOldSessionAnalytics(retentionDays = 365) {
  const db = await openDB();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["session_analytics"], "readwrite");
    const store = transaction.objectStore("session_analytics");
    const index = store.index("by_date");

    const range = IDBKeyRange.upperBound(cutoffDate.toISOString());
    const request = index.openCursor(range);

    let deleteCount = 0;

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        deleteCount++;
        cursor.continue();
      } else {
        console.info(
          `🧹 Cleaned up ${deleteCount} old session analytics records`
        );
        resolve(deleteCount);
      }
    };

    request.onerror = () => reject(request.error);
  });
}
