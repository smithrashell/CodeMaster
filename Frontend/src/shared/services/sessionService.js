import {
  getSessionById,
  getLatestSession,
  saveSessionToStorage,
  saveNewSessionToDB,
  updateSessionInDB,
} from "../db/sessions.js";
import { updateProblemRelationships, determineNextProblem } from "../db/problem_relationships.js";
import { ProblemService } from "../services/problemService.js";
import { calculateTagMastery } from "../db/tag_mastery.js";
import { StorageService } from "./storageService.js";
import { v4 as uuidv4 } from "uuid";


export const SessionService = {
  /**
   * Checks if all session problems are attempted and marks the session as complete.
   */
  async checkAndCompleteSession(sessionId) {
    const session = await getSessionById(sessionId);
    if (!session) {
      console.error(`❌ Session ${sessionId} not found.`);
        return false;
    }

    // Get all attempts related to this session
    const attemptedProblemIds = new Set(session.attempts.map((a) => a.problemId));

    // Check if all scheduled problems have been attempted
    const unattemptedProblems = session.problems.filter(
        (problem) => !attemptedProblemIds.has(problem.id)
    );

    console.log("📎 Unattempted Problems:", unattemptedProblems);

    if (unattemptedProblems.length === 0) {
        // ✅ Update problem relationships before marking session complete
        await updateProblemRelationships(session);

        // ✅ Mark session as completed
        session.status = "completed";
        await updateSessionInDB(session);

        console.log(`✅ Session ${sessionId} marked as completed.`);

        // ✅ Now update weak tags for this specific session
        // await updateSessionWithWeakTags(sessionId);
        await calculateTagMastery();
        

    }
    return unattemptedProblems;
  },

  /**
   * Retrieves an existing session or creates a new one if none exists.
   */
  async getOrCreateSession() {
    console.log("📌 getOrCreateSession called");

    // First try to migrate settings from Chrome storage if needed
    let settings = await StorageService.migrateSettingsToIndexedDB();
    
    if (!settings) {
      console.error("❌ Settings not found.");
      return null;
    }

    const sessionLength = settings.sessionLength;


    const latestSession = await getLatestSession();
    console.log("✅ latestSession:", latestSession);

    if (latestSession && latestSession.status === "in_progress") {
      console.log("📌 Found ongoing session. Checking attempts...");


      let problems = await this.checkAndCompleteSession(
        latestSession.id
      );
      console.log("✅ isSessionCompleted:", problems);


        if (problems.length > 0 ) {
       
        console.log("📌 Returning unattempted problems:", problems);
        await saveSessionToStorage(latestSession);
        return problems;
      }
    }


    console.log("📌 No ongoing session found, creating a new one...");

    // Fetch new problems for the session
    const problems = await ProblemService.createSession();


    console.log("📌 problems for new session:", problems);

    if (!problems || problems.length === 0) {
      console.error("❌ No problems fetched for the new session.");
      return null;
    }

    const newSession = {
      id: uuidv4(),
      date: new Date().toISOString(),
      status: "in_progress",
      problems: problems,
      attempts: [],
    };

    console.log("📌 newSession:", newSession);

    // Save the new session
    await saveNewSessionToDB(newSession);
    await saveSessionToStorage(newSession);

    console.log("✅ New session created and stored:", newSession);
    return newSession.problems;
  },
  
  /**
   * Skips a problem from the session.
   */
  async skipProblem(leetCodeID) {
    const session = await getLatestSession();
    if (!session) return null;

    session.problems = session.problems.filter(
      (p) => p.leetCodeID !== leetCodeID
    );
    await saveSessionToStorage(session, true);
    return session;
  },
};
