import { dbHelper } from "../index.js";

const openDB = dbHelper.openDB;

/**
 * Save a hint interaction to the database
 * @param {Object} interactionData - The interaction data object
 * @returns {Promise<Object>} - Saved interaction with generated ID
 */
export const saveHintInteraction = async (interactionData) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("hint_interactions", "readwrite");
    const store = transaction.objectStore("hint_interactions");

    const request = store.add(interactionData);
    request.onsuccess = () => {
      resolve({ ...interactionData, id: request.result });
    };
    request.onerror = (event) => reject(event.target.error);
  });
};

/**
 * Get hint interactions by problem ID
 * @param {string} problemId - The problem ID
 * @returns {Promise<Array>} - Array of interactions for the problem
 */
export const getInteractionsByProblem = async (problemId) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("hint_interactions", "readonly");
    const store = transaction.objectStore("hint_interactions");
    let index;
    try {
      index = store.index("by_problem_id");
    } catch (error) {
      console.error(`❌ HINT INTERACTIONS INDEX ERROR: by_problem_id index not found in hint_interactions`, {
        error: error.message,
        availableIndexes: Array.from(store.indexNames),
        storeName: "hint_interactions"
      });
      reject(error);
      return;
    }

    const request = index.getAll(problemId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject(event.target.error);
  });
};

/**
 * Get hint interactions by session ID
 * @param {string} sessionId - The session ID
 * @returns {Promise<Array>} - Array of interactions for the session
 */
export const getInteractionsBySession = async (sessionId) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("hint_interactions", "readonly");
    const store = transaction.objectStore("hint_interactions");
    let index;
    try {
      index = store.index("by_session_id");
    } catch (error) {
      console.error(`❌ HINT INTERACTIONS INDEX ERROR: by_session_id index not found in hint_interactions`, {
        error: error.message,
        availableIndexes: Array.from(store.indexNames),
        storeName: "hint_interactions"
      });
      reject(error);
      return;
    }

    const request = index.getAll(sessionId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject(event.target.error);
  });
};

/**
 * Get hint interactions by hint type
 * @param {string} hintType - The hint type ('contextual', 'general', 'primer')
 * @returns {Promise<Array>} - Array of interactions for the hint type
 */
export const getInteractionsByHintType = async (hintType) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("hint_interactions", "readonly");
    const store = transaction.objectStore("hint_interactions");
    let index;
    try {
      index = store.index("by_hint_type");
    } catch (error) {
      console.error(`❌ HINT INTERACTIONS INDEX ERROR: by_hint_type index not found in hint_interactions`, {
        error: error.message,
        availableIndexes: Array.from(store.indexNames),
        storeName: "hint_interactions"
      });
      reject(error);
      return;
    }

    const request = index.getAll(hintType);
    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject(event.target.error);
  });
};

/**
 * Get hint interactions by user action
 * @param {string} userAction - The user action ('clicked', 'dismissed', 'expanded', 'copied')
 * @returns {Promise<Array>} - Array of interactions for the action
 */
export const getInteractionsByAction = async (userAction) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("hint_interactions", "readonly");
    const store = transaction.objectStore("hint_interactions");
    let index;
    try {
      index = store.index("by_user_action");
    } catch (error) {
      console.error(`❌ HINT INTERACTIONS INDEX ERROR: by_user_action index not found in hint_interactions`, {
        error: error.message,
        availableIndexes: Array.from(store.indexNames),
        storeName: "hint_interactions"
      });
      reject(error);
      return;
    }

    const request = index.getAll(userAction);
    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject(event.target.error);
  });
};

/**
 * Get hint interactions within a date range
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Array>} - Array of interactions within the date range
 */
export const getInteractionsByDateRange = async (startDate, endDate) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("hint_interactions", "readonly");
    const store = transaction.objectStore("hint_interactions");
    let index;
    try {
      index = store.index("by_timestamp");
    } catch (error) {
      console.error(`❌ HINT INTERACTIONS INDEX ERROR: by_timestamp index not found in hint_interactions`, {
        error: error.message,
        availableIndexes: Array.from(store.indexNames),
        storeName: "hint_interactions"
      });
      reject(error);
      return;
    }

    const range = IDBKeyRange.bound(
      startDate.toISOString(),
      endDate.toISOString()
    );
    const request = index.getAll(range);
    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject(event.target.error);
  });
};

/**
 * Get hint interactions by difficulty and hint type for analytics
 * @param {string} difficulty - Problem difficulty ('Easy', 'Medium', 'Hard')
 * @param {string} hintType - The hint type
 * @returns {Promise<Array>} - Array of interactions matching criteria
 */
export const getInteractionsByDifficultyAndType = async (
  difficulty,
  hintType
) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("hint_interactions", "readonly");
    const store = transaction.objectStore("hint_interactions");
    let index;
    try {
      index = store.index("by_hint_type_and_difficulty");
    } catch (error) {
      console.error(`❌ HINT INTERACTIONS INDEX ERROR: by_hint_type_and_difficulty index not found in hint_interactions`, {
        error: error.message,
        availableIndexes: Array.from(store.indexNames),
        storeName: "hint_interactions"
      });
      reject(error);
      return;
    }

    const request = index.getAll([hintType, difficulty]);
    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject(event.target.error);
  });
};

/**
 * Get all hint interactions (for full analytics)
 * @returns {Promise<Array>} - Array of all interactions
 */
export const getAllInteractions = async () => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("hint_interactions", "readonly");
    const store = transaction.objectStore("hint_interactions");

    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject(event.target.error);
  });
};

/**
 * Delete hint interactions older than a specified date (for cleanup)
 * @param {Date} cutoffDate - Date before which to delete interactions
 * @returns {Promise<number>} - Number of deleted interactions
 */
export const deleteOldInteractions = async (cutoffDate) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("hint_interactions", "readwrite");
    const store = transaction.objectStore("hint_interactions");
    let index;
    try {
      index = store.index("by_timestamp");
    } catch (error) {
      console.error(`❌ HINT INTERACTIONS INDEX ERROR: by_timestamp index not found in hint_interactions`, {
        error: error.message,
        availableIndexes: Array.from(store.indexNames),
        storeName: "hint_interactions"
      });
      reject(error);
      return;
    }

    const range = IDBKeyRange.upperBound(cutoffDate.toISOString());
    let deletedCount = 0;

    const request = index.openCursor(range);
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        deletedCount++;
        cursor.continue();
      } else {
        resolve(deletedCount);
      }
    };
    request.onerror = (event) => reject(event.target.error);
  });
};

/**
 * Get interaction statistics for analytics dashboard
 * @returns {Promise<Object>} - Statistics object with counts and metrics
 */
export const getInteractionStats = async () => {
  try {
    const allInteractions = await getAllInteractions();

    const stats = {
      totalInteractions: allInteractions.length,
      byAction: {},
      byHintType: {},
      byDifficulty: {},
      byBoxLevel: {},
      recentInteractions: allInteractions.filter(
        (i) =>
          new Date(i.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      ).length,
      uniqueProblems: new Set(allInteractions.map((i) => i.problem_id)).size,
      uniqueSessions: new Set(allInteractions.map((i) => i.session_id)).size,
    };

    // Count by action type
    allInteractions.forEach((interaction) => {
      stats.byAction[interaction.user_action] =
        (stats.byAction[interaction.user_action] || 0) + 1;
      stats.byHintType[interaction.hint_type] =
        (stats.byHintType[interaction.hint_type] || 0) + 1;
      stats.byDifficulty[interaction.problem_difficulty] =
        (stats.byDifficulty[interaction.problem_difficulty] || 0) + 1;
      stats.byBoxLevel[interaction.box_level] =
        (stats.byBoxLevel[interaction.box_level] || 0) + 1;
    });

    return stats;
  } catch (error) {
    console.error("Error getting interaction stats:", error);
    throw error;
  }
};

/**
 * Get hint effectiveness analytics
 * @returns {Promise<Object>} - Effectiveness analytics
 */
export const getHintEffectiveness = async () => {
  try {
    const allInteractions = await getAllInteractions();

    // Group by hint type and calculate engagement metrics
    const effectiveness = {};

    allInteractions.forEach((interaction) => {
      const key = `${interaction.hint_type}-${interaction.problem_difficulty}`;
      if (!effectiveness[key]) {
        effectiveness[key] = {
          hintType: interaction.hint_type,
          difficulty: interaction.problem_difficulty,
          totalInteractions: 0,
          expansions: 0,
          dismissals: 0,
          engagementRate: 0,
          problems: new Set(),
        };
      }

      effectiveness[key].totalInteractions++;
      effectiveness[key].problems.add(interaction.problem_id);

      if (interaction.user_action === "expand") {
        effectiveness[key].expansions++;
      } else if (interaction.user_action === "dismissed") {
        effectiveness[key].dismissals++;
      }
    });

    // Calculate engagement rates
    Object.values(effectiveness).forEach((metric) => {
      metric.engagementRate =
        metric.totalInteractions > 0
          ? metric.expansions / metric.totalInteractions
          : 0;
      metric.uniqueProblems = metric.problems.size;
      delete metric.problems; // Remove Set for JSON serialization
    });

    return effectiveness;
  } catch (error) {
    console.error("Error calculating hint effectiveness:", error);
    throw error;
  }
};
