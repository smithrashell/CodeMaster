/**
 * Session State Functions
 * Extracted from sessions.js - session state initialization and migration
 */

import { dbHelper } from "../index.js";
import { StorageService } from "../services/storageService.js";
import logger from "../../utils/logging/logger.js";

const openDB = () => dbHelper.openDB();

/**
 * Initialize session state with default values
 */
export async function initializeSessionState(sessionStateKey) {
  console.log(`🔍 SESSION STATE DEBUG: initializeSessionState ENTRY with key: ${sessionStateKey}`);

  const migratedState = await StorageService.migrateSessionStateToIndexedDB();
  const storedState = await StorageService.getSessionState(sessionStateKey);

  console.log(`🔍 SESSION STATE DEBUG: State loading results:`, {
    hasMigratedState: !!migratedState,
    hasStoredState: !!storedState,
    migratedSessionsCompleted: migratedState?.num_sessions_completed,
    storedSessionsCompleted: storedState?.num_sessions_completed
  });

  let sessionState = migratedState || storedState || {
    id: sessionStateKey,
    num_sessions_completed: 0,
    current_difficulty_cap: "Easy",
    tag_index: 0,
    difficulty_time_stats: {
      easy: { problems: 0, total_time: 0, avg_time: 0 },
      medium: { problems: 0, total_time: 0, avg_time: 0 },
      hard: { problems: 0, total_time: 0, avg_time: 0 },
    },
    last_performance: {
      accuracy: null,
      efficiency_score: null,
    },
    escape_hatches: {
      sessions_at_current_difficulty: 0,
      last_difficulty_promotion: null,
      sessions_without_promotion: 0,
      activated_escape_hatches: [],
    },
    last_session_date: null,
  };

  console.log(`🔍 SESSION STATE DEBUG: Initial session state:`, {
    id: sessionState.id,
    num_sessions_completed: sessionState.num_sessions_completed,
    current_difficulty_cap: sessionState.current_difficulty_cap,
    hasLegacyFields: !!(sessionState.numSessionsCompleted || sessionState.currentDifficultyCap)
  });

  sessionState = migrateCamelCaseFields(sessionState);
  sessionState = await migrateSessionCount(sessionState, sessionStateKey);

  return sessionState;
}

/**
 * Migrate camelCase fields to snake_case for backwards compatibility
 */
function migrateCamelCaseFields(sessionState) {
  if (sessionState.numSessionsCompleted !== undefined) {
    sessionState.num_sessions_completed = sessionState.numSessionsCompleted;
    delete sessionState.numSessionsCompleted;
  }
  if (sessionState.currentDifficultyCap !== undefined) {
    sessionState.current_difficulty_cap = sessionState.currentDifficultyCap;
    delete sessionState.currentDifficultyCap;
  }
  if (sessionState.lastPerformance !== undefined) {
    sessionState.last_performance = sessionState.lastPerformance;
    delete sessionState.lastPerformance;
  }
  if (sessionState.escapeHatches !== undefined) {
    sessionState.escape_hatches = sessionState.escapeHatches;
    delete sessionState.escapeHatches;
  }
  if (sessionState.tagIndex !== undefined) {
    sessionState.tag_index = sessionState.tagIndex;
    delete sessionState.tagIndex;
  }
  if (sessionState.difficultyTimeStats !== undefined) {
    sessionState.difficulty_time_stats = sessionState.difficultyTimeStats;
    delete sessionState.difficultyTimeStats;
  }
  return sessionState;
}

/**
 * One-time migration to correct num_sessions_completed from existing data
 */
async function migrateSessionCount(sessionState, sessionStateKey) {
  if (sessionState.num_sessions_completed === 0 && !sessionState._migrated) {
    try {
      const db = await openDB();
      const transaction = db.transaction("sessions", "readonly");
      const store = transaction.objectStore("sessions");
      const request = store.getAll();

      const sessions = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const completedSessions = sessions.filter(s => s.status === "completed");
      if (completedSessions.length > 0) {
        sessionState.num_sessions_completed = completedSessions.length;
        sessionState._migrated = true;
        await StorageService.setSessionState(sessionStateKey, sessionState);
        logger.info(`🔄 Migrated session state: found ${completedSessions.length} completed sessions`);
      }
    } catch (error) {
      logger.error("❌ Session state migration failed:", error);
    }
  }
  return sessionState;
}
