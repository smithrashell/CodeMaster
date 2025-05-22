import { dbHelper } from "./index.js";
import { sessionService } from "../services/sessionService.js";
import { getProblem, saveUpdatedProblem } from "./problems.js";
import { calculateLeitnerBox } from "../utils/leitnerSystem.js";
import { SessionService } from "../services/sessionService.js";
import { createAttemptRecord } from "../utils/Utils.js";

const checkAndCompleteSession = SessionService.checkAndCompleteSession;

const openDB = dbHelper.openDB;

/**
 * Adds an attempt for a problem and updates session data.
 * @param {Object} attemptData - Attempt data including problem ID, success status, and time spent.
 * @returns {Promise<Object>} - Success message or error object.
 */
export async function addAttempt(attemptData) {
  try {
    const db = await openDB();

    // Retrieve or create an active session
    let session = await new Promise((resolve) => {
      chrome.storage.local.get(["currentSession"], (result) => {
        resolve(result.currentSession || null);
      });
    });

    if (!session) {
      console.log("No active session found. Creating a new session...");
      session = await getOrCreateSession();
      await saveSessionToStorage(session);
    }

    console.log("Active session:", session);

    // Associate the attempt with the session
    attemptData.SessionID = session.id;

    // Retrieve problem data
    let problem = await getProblem(attemptData.ProblemID);
    if (!problem) {
      console.error("AddAttempt: Problem not found");
      return { error: "Problem not found." };
    }

    // Update problem Leitner box logic
    problem = await calculateLeitnerBox(problem, attemptData);

    // Add or update the problem in session
    session = addOrUpdateProblemInSession(session, problem, attemptData.id);
    await saveSessionToStorage(session, true);

    // Open a transaction for database operations
    const transaction = db.transaction(
      ["problems", "attempts", "sessions"],
      "readwrite"
    );
    const problemStore = transaction.objectStore("problems");
    const attemptStore = transaction.objectStore("attempts");
    const sessionStore = transaction.objectStore("sessions");

    // Save attempt record
    const record = createAttemptRecord(attemptData);
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
    });

    // Update session record
    await putData(sessionStore, session);

    // Check if the session is complete
    await checkAndCompleteSession(session.id);

    console.log("Attempt added and problem updated successfully");
    return { message: "Attempt added and problem updated successfully" };
  } catch (error) {
    console.error("Error in addAttempt function:", error);
    throw error;
  }
}

/**
 * Fetches attempts by a specific problem ID.
 * @param {string} problemId - The problem ID to fetch attempts for.
 * @returns {Promise<Array>} - List of attempts for the given problem.
 */
export async function getAttemptsByProblem(problemId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("attempts", "readonly");
    const store = transaction.objectStore("attempts").index("by_problemId");

    const request = store.getAll(problemId);
    request.onsuccess = (event) => {
      resolve(event.target.result || []);
    };
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Fetches all attempts in the database.
 * @returns {Promise<Array>} - List of all attempts.
 */
export async function getAllAttempts() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("attempts", "readonly");
    const store = transaction.objectStore("attempts");

    const request = store.getAll();
    request.onsuccess = (event) => {
      resolve(event.target.result || []);
    };
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Fetches the most recent attempt for a given problem.
 * @param {string} problemId - The problem ID to fetch the latest attempt for.
 * @returns {Promise<Object|null>} - The most recent attempt or null if not found.
 */
export async function getMostRecentAttempt(problemId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("attempts", "readonly");
    let store;
    let request;
    if (!problemId) {
      store = transaction.objectStore("attempts").index("by_date");

      request = store.openCursor(null, "prev"); // Fetch most recent attempt
    } else {
      store = transaction.objectStore("attempts").index("by_problem_and_date");
      request = store.openCursor(problemId, "prev"); // Fetch most recent attempt
    }

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      resolve(cursor ? cursor.value : null);
    };
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Saves multiple attempts to the database.
 * @param {Array} attempts - List of attempt records to save.
 * @returns {Promise<void>}
 */
export async function saveAttempts(attempts) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("attempts", "readwrite");
    const store = transaction.objectStore("attempts");

    attempts.forEach((attempt) => {
      const request = store.put(attempt);
      request.onerror = (event) => {
        reject("Error saving attempt: " + event.target.errorCode);
      };
    });

    transaction.oncomplete = () => resolve();
    transaction.onerror = (event) =>
      reject("Transaction error: " + event.target.errorCode);
  });
}

/**
 * Evaluates all attempts and updates problem box levels.
 * @returns {Promise<void>}
 */
export async function updateProblemsWithAttemptStats() {
  const attempts = await getAllAttempts();
  for (const attempt of attempts) {
    const updatedProblem = await evaluateAttempts(attempt);
    await saveUpdatedProblem(updatedProblem);
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
