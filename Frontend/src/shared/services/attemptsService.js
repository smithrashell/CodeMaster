import { dbHelper } from "../db/index.js";
import { attempts } from "../db/attempts.js";
import { getProblem, saveUpdatedProblem } from "../db/problems.js";
import { SessionService } from "../services/sessionService.js";
import { calculateLeitnerBox } from "../utils/leitnerSystem";
import { createAttemptRecord } from "../utils/Utils.js";
import { problemService } from "./problemService.js";
import { saveSessionToStorage } from "../db/sessions.js";
import { ProblemService } from "./problemService.js";

const openDB = dbHelper.openDB;
const checkAndCompleteSession = SessionService.checkAndCompleteSession;

/**

 * Adds a new attempt record to the database and updates problem progress.

 * @param {Object} attemptData - The attempt data object.
 * @returns {Promise<Object>} - A success message or an error.
 */
async function addAttempt(attemptData, problem) {
  console.log("📌 addAttempt called");
  try {
    const db = await openDB();


    // Retrieve or create session
    let session = await new Promise((resolve) => {
      chrome.storage.local.get(["currentSession"], (result) => {
        resolve(result.currentSession || null);
      });
    });

    if (!session) {
      console.log("No active session found. Creating a new session...");
      session = await SessionService.getOrCreateSession();
      await saveSessionToStorage(session);
    }

    console.log("Active session:", session);

    // Associate the attempt with the session
    attemptData.SessionID = session.id;


    if (!problem) {
      console.error("AddAttempt: Problem not found");
      return { error: "Problem not found." };
    }

    // Update problem Leitner box logic
    problem = await calculateLeitnerBox(problem, attemptData);

    // Add or update the problem in session
    session = await ProblemService.addOrUpdateProblemInSession(session, problem, attemptData.id);
    
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
    await SessionService.checkAndCompleteSession(session.id);

    console.log("Attempt added and problem updated successfully");
    return { message: "Attempt added and problem updated successfully" };
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
};