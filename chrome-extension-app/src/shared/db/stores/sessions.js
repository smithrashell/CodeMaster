import { dbHelper } from "./index.js";
import logger from "../../utils/logging/logger.js";

// Re-export escape hatch functions for backwards compatibility
export {
  applyEscapeHatchLogic,
  checkForDemotion,
  analyzePerformanceTrend
} from "./sessionsEscapeHatch.js";

// Re-export performance functions for backwards compatibility
export {
  filterSessions,
  processAttempts,
  calculateTagStrengths,
  calculateTimingFeedback,
  getSessionPerformance,
  getAllSessions,
  evaluateDifficultyProgression
} from "./sessionsPerformance.js";

// Re-export adaptive session functions for backwards compatibility
export {
  buildAdaptiveSessionSettings,
  computeSessionLength,
  normalizeSessionLengthForCalculation,
  applySessionLengthPreference
} from "./sessionsAdaptive.js";

// Re-export session state functions for backwards compatibility
export { initializeSessionState } from "./sessionsState.js";

const openDB = () => dbHelper.openDB();

/**
 * Retrieves a session by its ID.
 */
export const getSessionById = async (session_id) => {
  // Validate session_id before database operation
  if (!session_id) {
    console.error(`❌ getSessionById called with invalid session_id:`, session_id);
    return null;
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("sessions", "readonly");
    const store = transaction.objectStore("sessions");

    const request = store.get(session_id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Fetches the latest session by date.
 * @deprecated Use getLatestSessionByType() for better performance
 */
export const getLatestSession = async () => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("sessions", "readonly");
    const store = transaction.objectStore("sessions");
    
    // Use reliable getAll method to avoid index issues
    const request = store.getAll();
    request.onsuccess = (event) => {
      const allSessions = event.target.result || [];
      
      if (allSessions.length === 0) {
        resolve(null);
        return;
      }
      
      // Sort by date (newest first) - handle snake_case created_date first, then fallback to date/Date
      const sortedSessions = allSessions.sort((a, b) => {
        const dateA = new Date(a.date || a.created_date || a.Date || 0);
        const dateB = new Date(b.date || b.created_date || b.Date || 0);
        return dateB - dateA;
      });
      const result = sortedSessions[0];
      resolve(result);
    };
    request.onerror = (e) => {
      logger.error("❌ getLatestSession() error:", e.target.error);
      reject(e.target.error);
    };
  });
};

/**
 * Efficiently fetches the latest session by type and/or status using database indexes.
 * This is much more efficient than getLatestSession() as it uses cursors instead of loading all data.
 * 
 * @param {string|null} session_type - Filter by session type ('standard', 'interview-like', 'full-interview', etc.)
 * @param {string|null} status - Filter by status ('in_progress', 'completed', etc.)
 * @returns {Promise<Object|null>} Latest matching session or null if none found
 */
export const getLatestSessionByType = async (session_type = null, status = null) => {
  logger.info(`🔍 getLatestSessionByType ENTRY: session_type=${session_type}, status=${status}`);
  
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("sessions", "readonly");
    const store = transaction.objectStore("sessions");

    // Normalize session_type - treat null/undefined as 'standard'
    const normalizedSessionType = session_type || 'standard';

    // Debug: Log available indexes
    console.log(`🔍 INDEX DEBUG: Available indexes:`, {
      available: Array.from(store.indexNames),
      requestedType: normalizedSessionType,
      requestedStatus: status,
      targetIndex: status ? "by_session_type_status" : "by_session_type"
    });

    // Use appropriate index based on whether status is specified
    let index, keyRange;
    try {
      if (status) {
        // Use composite index for session_type + status queries
        index = store.index("by_session_type_status");
        keyRange = IDBKeyRange.only([normalizedSessionType, status]);
        console.log(`🔍 INDEX DEBUG: Using composite index with key:`, [normalizedSessionType, status]);
      } else {
        // Use session_type index for type-only queries
        index = store.index("by_session_type");
        keyRange = IDBKeyRange.only(normalizedSessionType);
        console.log(`🔍 INDEX DEBUG: Using session_type index with key:`, normalizedSessionType);
      }
    } catch (error) {
      console.error(`❌ INDEX ACCESS ERROR: Failed to access index, falling back to full scan:`, {
        indexName: status ? "by_session_type_status" : "by_session_type",
        error: error.message,
        availableIndexes: Array.from(store.indexNames)
      });
      logger.error(`❌ getLatestSessionByType() index error, using fallback:`, error);

      // Fallback to full table scan
      const fallbackRequest = store.getAll();
      fallbackRequest.onsuccess = () => {
        const allSessions = fallbackRequest.result || [];

        // Filter and sort manually
        const filteredSessions = allSessions
          .filter(session => {
            const matchesType = !normalizedSessionType || session.session_type === normalizedSessionType;
            const matchesStatus = !status || session.status === status;
            return matchesType && matchesStatus;
          })
          .sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date desc

        const latestSession = filteredSessions[0] || null;
        if (latestSession) {
          logger.info(`✅ Found matching ${normalizedSessionType} session via fallback: ${latestSession.id?.substring(0,8)}... status=${latestSession.status}`);
        } else {
          logger.info(`❌ No ${normalizedSessionType}/${status} sessions found via fallback`);
        }
        resolve(latestSession);
      };

      fallbackRequest.onerror = () => {
        logger.error(`❌ Fallback query also failed:`, fallbackRequest.error);
        reject(fallbackRequest.error);
      };

      return;
    }
    
    // Open cursor in reverse order (latest first) for efficiency
    const request = index.openCursor(keyRange, "prev");
    
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        const session = cursor.value;
        
        logger.info(`✅ Found matching ${normalizedSessionType} session: ${session.id?.substring(0,8)}... status=${session.status}`);
        resolve(session);
        return;
      } else {
        logger.info(`❌ No matching ${normalizedSessionType} session found with status=${status || 'any'}`);
        resolve(null);
      }
    };
    
    request.onerror = (e) => {
      logger.error("❌ getLatestSessionByType() error:", e.target.error);
      reject(e.target.error);
    };
  });
};

/**
 * Saves a new session to IndexedDB.
 */
export const saveNewSessionToDB = async (session) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("sessions", "readwrite");
    const store = transaction.objectStore("sessions");
    logger.info("session", session);
    const request = store.add(session);
    request.onsuccess = () => resolve(session);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Updates an existing session in IndexedDB.
 */
export const updateSessionInDB = async (session) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("sessions", "readwrite");
    const store = transaction.objectStore("sessions");

    const request = store.put(session);
    request.onsuccess = () => resolve(session);
    request.onerror = (event) => reject(event.target.error);
  });
};

/**
 * Deletes a session from IndexedDB by ID.
 * @param {string} sessionId - ID of the session to delete
 * @returns {Promise<void>}
 */
export const deleteSessionFromDB = async (sessionId) => {
  // Validate sessionId
  if (!sessionId) {
    throw new Error('deleteSessionFromDB requires a valid sessionId');
  }

  const db = await openDB();
  
  // Safety check: Get session first to verify and log what we're deleting
  const session = await getSessionById(sessionId);
  if (session) {
    // Log warning if attempting to delete completed or in_progress sessions
    if (session.status === 'completed') {
      console.warn(`⚠️ Deleting completed session ${sessionId} - verify this is intentional`);
    } else if (session.status === 'in_progress') {
      console.info(`🔄 Deleting in_progress session ${sessionId} (likely for regeneration)`);
    }
  }
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("sessions", "readwrite");
    const store = transaction.objectStore("sessions");

    const request = store.delete(sessionId);
    request.onsuccess = () => {
      console.info(`✅ Successfully deleted session ${sessionId}`);
      resolve();
    };
    request.onerror = (event) => reject(event.target.error);
  });
};

/**
 * Atomically gets latest session or creates new one if none exists.
 * Prevents race conditions by doing both operations in single transaction.
 * @param {string} sessionType - Type of session to get or create
 * @param {string} status - Status to check for ('in_progress')
 * @param {Object} newSessionData - Data for new session if creation needed
 * @returns {Promise<Object>} - Existing or newly created session
 */
export const getOrCreateSessionAtomic = async (sessionType = 'standard', status = 'in_progress', newSessionData = null) => {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction("sessions", "readwrite");
    const store = transaction.objectStore("sessions");

    // Check for existing session within this transaction
    let index;
    try {
      index = store.index("by_session_type_status");
    } catch (error) {
      console.error(`❌ INDEX ACCESS ERROR: by_session_type_status index not found`, {
        error: error.message,
        availableIndexes: Array.from(store.indexNames)
      });
      reject(error);
      return;
    }

    const normalizedSessionType = sessionType || 'standard';
    const existingCheck = index.get([normalizedSessionType, status]);

    existingCheck.onsuccess = () => {
      const existingSession = existingCheck.result;

      if (existingSession) {
        logger.info("🔍 Atomic check: Found existing session", existingSession.id);
        resolve(existingSession);
      } else if (newSessionData) {
        // Create new session within same transaction
        logger.info("🔍 Atomic check: No existing session, creating new one");
        const addRequest = store.add(newSessionData);
        addRequest.onsuccess = () => {
          logger.info("✅ Atomic creation: New session created", newSessionData.id);
          resolve(newSessionData);
        };
        addRequest.onerror = () => {
          logger.error("❌ Atomic creation failed:", addRequest.error);
          reject(addRequest.error);
        };
      } else {
        // No existing session and no data to create new one
        logger.info("🔍 Atomic check: No existing session, no creation data provided");
        resolve(null);
      }
    };

    existingCheck.onerror = () => {
      logger.error("❌ Atomic check failed:", existingCheck.error);
      reject(existingCheck.error);
    };
  });
};

/**
 * Saves session to Chrome Storage with fallback handling (optional: updates IndexedDB if needed).
 * Implements graceful degradation when Chrome APIs are unavailable.
 */
export const saveSessionToStorage = (session, updateDatabase = false) => {
  return new Promise((resolve, reject) => {
    try {
      // Check if Chrome API is available
      if (typeof chrome !== "undefined" && chrome?.storage?.local?.set) {
        chrome.storage.local.set({ currentSession: session }, async () => {
          if (chrome.runtime?.lastError) {
            logger.warn("Chrome storage error:", chrome.runtime.lastError);
            // Continue with IndexedDB update even if Chrome storage fails
          }

          if (updateDatabase) {
            try {
              await updateSessionInDB(session);
            } catch (error) {
              logger.warn(
                "IndexedDB update failed after Chrome storage save:",
                error
              );
              // Don't reject - Chrome storage succeeded
            }
          }
          resolve();
        });
      } else {
        // Chrome API unavailable - log warning and continue
        logger.warn(
          "Chrome storage API unavailable, skipping session storage to Chrome"
        );

        // Still update IndexedDB if requested
        if (updateDatabase) {
          updateSessionInDB(session)
            .then(() => {
              logger.info(
                "Session saved to IndexedDB (Chrome storage unavailable)"
              );
              resolve();
            })
            .catch((error) => {
              logger.error(
                "Both Chrome storage and IndexedDB unavailable:",
                error
              );
              reject(new Error("No storage mechanism available"));
            });
          return;
        }

        // Resolve even without Chrome storage - system can continue
        resolve();
      }
    } catch (error) {
      logger.error("Error in saveSessionToStorage:", error);

      // Try IndexedDB as fallback
      if (updateDatabase) {
        updateSessionInDB(session)
          .then(() => {
            logger.info("Fallback to IndexedDB successful");
            resolve();
          })
          .catch((dbError) => {
            logger.error("All storage mechanisms failed:", {
              chromeError: error,
              dbError,
            });
            reject(new Error("All storage mechanisms unavailable"));
          });
      } else {
        // No fallback requested, but don't fail the entire operation
        logger.warn("Chrome storage failed, but continuing without storage");
        resolve();
      }
    }
  });
};


