import { dbHelper } from "./index.js";

const openDB = dbHelper.openDB;

/**
 * Stores a session analytics summary in the dedicated session_analytics store.
 * @param {Object} sessionSummary - Complete session performance summary
 * @returns {Promise<void>}
 */
export async function storeSessionAnalytics(sessionSummary) {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["session_analytics"], "readwrite");
    const store = transaction.objectStore("session_analytics");
    
    // Create analytics record optimized for querying
    const analyticsRecord = {
      sessionId: sessionSummary.sessionId,
      completedAt: sessionSummary.completedAt,
      
      // Performance metrics for easy querying
      accuracy: Math.round(sessionSummary.performance.accuracy * 100) / 100,
      avgTime: Math.round(sessionSummary.performance.avgTime),
      
      // Difficulty analysis
      predominantDifficulty: sessionSummary.difficultyAnalysis.predominantDifficulty,
      totalProblems: sessionSummary.difficultyAnalysis.totalProblems,
      difficultyMix: sessionSummary.difficultyAnalysis.percentages,
      
      // Mastery progression
      newMasteries: sessionSummary.masteryProgression.newMasteries,
      decayedMasteries: sessionSummary.masteryProgression.decayedMasteries,
      masteryDeltas: sessionSummary.masteryProgression.deltas,
      
      // Tag performance
      strongTags: sessionSummary.performance.strongTags,
      weakTags: sessionSummary.performance.weakTags,
      timingFeedback: sessionSummary.performance.timingFeedback,
      
      // Insights for user feedback
      insights: sessionSummary.insights,
      
      // Full difficulty breakdown
      difficultyBreakdown: {
        Easy: sessionSummary.performance.Easy,
        Medium: sessionSummary.performance.Medium,
        Hard: sessionSummary.performance.Hard
      }
    };
    
    const request = store.put(analyticsRecord);
    
    request.onsuccess = () => {
      console.info(`📊 Session analytics stored for session ${sessionSummary.sessionId}`);
      resolve(analyticsRecord);
    };
    
    request.onerror = () => {
      console.error(`❌ Failed to store session analytics for ${sessionSummary.sessionId}:`, request.error);
      reject(request.error);
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
export async function getSessionAnalyticsRange(startDate, endDate, limit = 100) {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["session_analytics"], "readonly");
    const store = transaction.objectStore("session_analytics");
    const index = store.index("by_date");
    
    const range = IDBKeyRange.bound(startDate.toISOString(), endDate.toISOString());
    const request = index.getAll(range, limit);
    
    request.onsuccess = () => {
      // Sort by date descending (most recent first)
      const results = request.result.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
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
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
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
export async function getSessionAnalyticsByAccuracy(minAccuracy, maxAccuracy, limit = 50) {
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
        console.info(`🧹 Cleaned up ${deleteCount} old session analytics records`);
        resolve(deleteCount);
      }
    };
    
    request.onerror = () => reject(request.error);
  });
}