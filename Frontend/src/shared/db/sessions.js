import { dbHelper } from "./index.js";
import { v4 as uuidv4 } from "uuid";

const openDB = dbHelper.openDB;

/**
 * Retrieves a session by its ID.
 */
export const getSessionById = async (sessionId) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("sessions", "readonly");
    const store = transaction.objectStore("sessions");

    const request = store.get(sessionId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Fetches the latest session by date.
 */
export const getLatestSession = async () => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("sessions", "readonly");
    const store = transaction.objectStore("sessions");
    const index = store.index("by_date");

    const request = index.openCursor(null, "prev"); // Get latest session
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      resolve(cursor ? cursor.value : null);
    };
    request.onerror = (e) => reject(e.target.error);
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
    console.log("session", session);
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
 * Saves session to Chrome Storage (optional: updates IndexedDB if needed).
 */
export const saveSessionToStorage = async (session, updateDatabase = false) => {
  return new Promise(async (resolve, reject) => {
    chrome.storage.local.set({ currentSession: session }, async () => {
      if (updateDatabase) {
        try {
          await updateSessionInDB(session);
        } catch (error) {
          reject(error);
        }
      }
      resolve();
    });
  });
};

export const recreateSessions = async () => {
  const db = await openDB();

  const transaction = db.transaction(
    ["attempts", "problems", "sessions"],
    "readonly"
  );
  const attemptStore = transaction.objectStore("attempts");
  const problemStore = transaction.objectStore("problems");

  // Pull all attempts & problems
  const attempts = await new Promise((resolve, reject) => {
    const request = attemptStore.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const problems = await new Promise((resolve, reject) => {
    const request = problemStore.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  console.log("📥 Total Attempts:", attempts.length);
  console.log("📚 Total Problems:", problems.length);

  const sessions = [];

  /** ------------------------ **/
  /** 1. Handle attempts WITH SessionID **/
  /** ------------------------ **/

  const sessionMap = new Map();

  attempts.forEach((attempt) => {
    if (attempt.SessionID) {
      const sessionId = attempt.SessionID;
      if (!sessionMap.has(sessionId)) {
        sessionMap.set(sessionId, []);
      }
      sessionMap.get(sessionId).push(attempt);
    }
  });

  console.log(
    "📦 Found sessions to rebuild (with SessionID):",
    sessionMap.size
  );

  for (let [sessionId, sessionAttempts] of sessionMap.entries()) {
    const problemIds = [
      ...new Set(sessionAttempts.map((a) => String(a.ProblemID))),
    ];
    const sessionProblems = problems.filter((problem) =>
      problemIds.includes(String(problem.id))
    );

    const isCompleted = sessionProblems.every((problem) =>
      sessionAttempts.some((attempt) => attempt.ProblemID === problem.id)
    );

    const cleanedAttempts = sessionAttempts.map((attempt) => ({
      attemptId: attempt.AttemptID || uuidv4(),
      problemId: attempt.ProblemID,
      success: attempt.Success,
      timeSpent: attempt.TimeSpent,
      AttemptDate: attempt.AttemptDate,
    }));

    const sortedAttempts = [...cleanedAttempts].sort(
      (a, b) => new Date(a.AttemptDate) - new Date(b.AttemptDate)
    );

    const sessionDate =
      sortedAttempts[0]?.AttemptDate || new Date().toISOString();

    const session = {
      id: sessionId,
      Date: sessionDate,
      attempts: cleanedAttempts.map(({ AttemptDate, ...rest }) => rest),
      problems: sessionProblems,
      status: isCompleted ? "completed" : "in_progress",
    };

    console.log("🔁 Rebuilt session:", sessionId);
    console.log(
      "➡️ Problems in session:",
      sessionProblems.map((p) => p.id)
    );
    console.log(
      "🧪 Attempts in session:",
      cleanedAttempts.map((a) => a.problemId)
    );

    sessions.push(session);
  }

  /** ------------------------ **/
  /** 2. Handle attempts WITHOUT SessionID **/
  /** ------------------------ **/

  const attemptsWithoutSessionID = attempts.filter((a) => !a.SessionID);

  console.log(
    "🧩 Orphan attempts without SessionID:",
    attemptsWithoutSessionID.length
  );

  const dateMap = new Map();

  attemptsWithoutSessionID.forEach((attempt) => {
    let dateValue;
    if (attempt.AttemptDate && !isNaN(new Date(attempt.AttemptDate))) {
      dateValue = new Date(attempt.AttemptDate);
    } else {
      console.warn("⚠️ Missing or invalid AttemptDate:", attempt);
      dateValue = new Date();
    }

    const dateKey = dateValue.toISOString().split("T")[0];

    if (!dateMap.has(dateKey)) {
      dateMap.set(dateKey, []);
    }
    dateMap.get(dateKey).push(attempt);
  });

  for (let [dateKey, dateAttempts] of dateMap.entries()) {
    const sessionId = uuidv4();

    const problemIds = [
      ...new Set(dateAttempts.map((a) => String(a.ProblemID))),
    ];
    const sessionProblems = problems.filter((problem) =>
      problemIds.includes(String(problem.id))
    );

    const cleanedAttempts = dateAttempts.map((attempt) => ({
      attemptId: attempt.AttemptID || uuidv4(),
      problemId: attempt.ProblemID,
      success: attempt.Success,
      timeSpent: attempt.TimeSpent,
      AttemptDate: attempt.AttemptDate,
    }));

    const sortedAttempts = [...cleanedAttempts].sort(
      (a, b) => new Date(a.AttemptDate) - new Date(b.AttemptDate)
    );

    const sessionDate =
      sortedAttempts[0]?.AttemptDate || `${dateKey}T00:00:00.000Z`;

    const session = {
      id: sessionId,
      Date: sessionDate,
      attempts: cleanedAttempts.map(({ AttemptDate, ...rest }) => rest),
      problems: sessionProblems,
      status: "completed",
    };

    console.log("🆕 Created new session from orphaned attempts on", dateKey);
    console.log(
      "➡️ Problems:",
      sessionProblems.map((p) => p.id)
    );
    console.log(
      "🧪 Attempts:",
      cleanedAttempts.map((a) => a.problemId)
    );

    sessions.push(session);
  }

  /** ------------------------ **/
  /** 3. Save sessions **/
  /** ------------------------ **/

  await Promise.all(sessions.map((session) => updateSessionInDB(session)));

  console.log("✅ Rebuilt and stored all sessions:", sessions.length);
  return sessions;
};

// export async function getSessionPerformance() {
//   const db = await openDB();

//   // 1️⃣ Fetch all sessions
//   const sessionStore = db
//     .transaction("sessions", "readonly")
//     .objectStore("sessions");
//   const sessionRequest = sessionStore.getAll();
//   const sessions = await new Promise((resolve, reject) => {
//     sessionRequest.onsuccess = () => resolve(sessionRequest.result);
//     sessionRequest.onerror = () => reject(sessionRequest.error);
//   });

//   // 2️⃣ Fetch ALL problems (user-specific)
//   const problemStore = db
//     .transaction("problems", "readonly")
//     .objectStore("problems");
//   const allProblemRequest = problemStore.getAll();
//   const allProblems = await new Promise((resolve, reject) => {
//     allProblemRequest.onsuccess = () => resolve(allProblemRequest.result);
//     allProblemRequest.onerror = () => reject(allProblemRequest.error);
//   });
//   console.log("🔍 allProblems:", allProblems);
//   const problemMap = new Map(allProblems.map((p) => [p.id, p])); // User's problems

//   // 3️⃣ Fetch ALL standard problems
//   const standardProblemStore = db
//     .transaction("standard_problems", "readonly")
//     .objectStore("standard_problems");
//   const allStandardRequest = standardProblemStore.getAll();
//   const allStandardProblems = await new Promise((resolve, reject) => {
//     allStandardRequest.onsuccess = () => resolve(allStandardRequest.result);
//     allStandardRequest.onerror = () => reject(allStandardRequest.error);
//   });
//   console.log("🔍 allStandardProblems:", allStandardProblems);
//   const standardProblemMap = new Map(
//     allStandardProblems.map((p) => [p.id, p])
//   ); // leetCodeID based
// console.log("🔍 standardProblemMap Keys:", [...standardProblemMap.keys()]);
//   // 4️⃣ Initialize aggregation
//   const performance = {
//     Easy: { attempts: 0, correct: 0 },
//     Medium: { attempts: 0, correct: 0 },
//     Hard: { attempts: 0, correct: 0 },
//   };

//   // 5️⃣ Loop sessions
//   for (let session of sessions) {
//     if (!session.attempts) continue;

//     for (let attempt of session.attempts) {
//       console.log("🔍 attempt:", attempt);
//       const problemEntry = problemMap.get(attempt.problemId);
//    console.log("🔍 problemEntry:", problemEntry);
//       if (!problemEntry) {
//         console.warn(
//           `⚠️ Problem not found in problemMap: ${attempt.ProblemID}`
//         );
//         continue;
//       }

//       const standardProblem = standardProblemMap.get(problemEntry.leetCodeID);
//       console.log("🔍 standardProblem:", standardProblem);
//       if (!standardProblem) {
//         console.warn(
//           `⚠️ Standard problem not found for leetCodeID: ${problemEntry.leetCodeID}`
//         );
//         continue;
//       }

//       if (standardProblem && standardProblem.difficulty) {
//         const difficulty = standardProblem.difficulty; // "Easy", "Medium", "Hard"
//         if (performance[difficulty]) {
//           performance[difficulty].attempts += 1;
//           if (attempt.success) {
//             performance[difficulty].correct += 1;
//           }
//         }
//       }
//     }
//   }

//   console.log("📊 Aggregated Session Performance:", performance);

//   return performance;
// }
export async function getSessionPerformance({
  recentSessionsLimit = 5,
  daysBack = null,
  unmasteredTags = [],
} = {}) {
  console.log("🔍 getSessionPerformance", unmasteredTags);
  const db = await openDB();
  const unmasteredTagSet = new Set(unmasteredTags);

  // 1️⃣ Fetch all sessions
  const sessionStore = db
    .transaction("sessions", "readonly")
    .objectStore("sessions");
  const allSessions = await new Promise((resolve, reject) => {
    const req = sessionStore.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  // 2️⃣ Apply filtering by time or recent count
  const now = new Date();
  let sessions = allSessions;

  if (daysBack) {
    sessions = allSessions.filter((s) => {
      const date = new Date(s.Date);
      return (now - date) / (1000 * 60 * 60 * 24) <= daysBack;
    });
  } else {
    allSessions.sort((a, b) => new Date(a.Date) - new Date(b.Date));
    sessions = allSessions.slice(-recentSessionsLimit);
  }
  console.log("🔍 sessions", sessions);
  const performance = {
    Easy: { attempts: 0, correct: 0, time: 0 },
    Medium: { attempts: 0, correct: 0, time: 0 },
    Hard: { attempts: 0, correct: 0, time: 0 },
  };

  const tagStats = {};
  let totalAttempts = 0;
  let totalCorrect = 0;
  let totalTime = 0;

  for (let session of sessions) {
    const attempts = session.attempts || [];
    const problems = session.problems || [];

    const problemMap = new Map(problems.map((p) => [p.id, p]));

    for (let attempt of attempts) {
      const problem = problemMap.get(attempt.problemId);
      if (!problem) continue;

      const rating = problem.Rating || "Medium"; // fallback
      const tags = problem.Tags || [];

      performance[rating].attempts += 1;
      performance[rating].time += attempt.timeSpent || 0;
      if (attempt.success) performance[rating].correct += 1;

      // Tag stats
      for (let tag of tags) {
        if (!tagStats[tag]) {
          tagStats[tag] = { attempts: 0, correct: 0, time: 0 };
        }
        tagStats[tag].attempts += 1;
        tagStats[tag].time += attempt.timeSpent || 0;
        if (attempt.success) tagStats[tag].correct += 1;
      }

      totalAttempts += 1;
      totalTime += attempt.timeSpent || 0;
      if (attempt.success) totalCorrect += 1;
    }
  }

  // 🧠 Derive strong + weak tags
  const strongTags = [];
  const weakTags = [];
    console.log("unmasteredTagSet", unmasteredTagSet);
  for (let tag in tagStats) {
    if (!unmasteredTagSet.has(tag)) continue;

    const { attempts, correct } = tagStats[tag];
    const acc = correct / attempts;

    // Optional: Debug line
    console.log(
      `🧪 Evaluating ${tag} — acc: ${acc.toFixed(
        2
      )},correct: ${correct}, attempts: ${attempts}`
    );

    if (acc >= 0.8 && attempts >= 2) {
      strongTags.push(tag);
    } else if (acc < 0.7 ) {
      weakTags.push(tag);
    }
  }

  // ⏱️ Expected time ranges
  const expected = {
    Easy: [600, 900],
    Medium: [1200, 1500],
    Hard: [1800, 2100],
  };

  const timingFeedback = {};
  for (let diff of ["Easy", "Medium", "Hard"]) {
    const { attempts, time } = performance[diff];
    if (attempts === 0) {
      timingFeedback[diff] = "noData";
    } else {
      const avg = time / attempts;
      const [min, max] = expected[diff];
      if (avg < min) timingFeedback[diff] = "tooFast";
      else if (avg > max) timingFeedback[diff] = "tooSlow";
      else timingFeedback[diff] = "onTarget";
    }
  }

  return {
    accuracy: totalAttempts ? totalCorrect / totalAttempts : 0,
    avgTime: totalAttempts ? totalTime / totalAttempts : 0,
    strongTags,
    weakTags,
    timingFeedback,
    Easy: {
      ...performance.Easy,
      avgTime: performance.Easy.attempts
        ? performance.Easy.time / performance.Easy.attempts
        : 0,
    },
    Medium: {
      ...performance.Medium,
      avgTime: performance.Medium.attempts
        ? performance.Medium.time / performance.Medium.attempts
        : 0,
    },
    Hard: {
      ...performance.Hard,
      avgTime: performance.Hard.attempts
        ? performance.Hard.time / performance.Hard.attempts
        : 0,
    },
  };
}

export async function getAllSessions() {
  const db = await openDB();
  const sessionStore = db
    .transaction("sessions", "readonly")
    .objectStore("sessions");
  const sessionRequest = sessionStore.getAll();
  const sessions = await new Promise((resolve, reject) => {
    sessionRequest.onsuccess = () => resolve(sessionRequest.result);
    sessionRequest.onerror = () => reject(sessionRequest.error);
  });
  return sessions;
}

// later should edit to just update one session at a time
// async function updateSessionWithWeakTags(sessionId) {
//   try {
//     const db = await openDB("LearningDatabase");

//     // ✅ Fetch the session by ID
//     const sessionTransaction = db.transaction(["sessions"], "readwrite");
//     const sessionStore = sessionTransaction.objectStore("sessions");

//     const session = await new Promise((resolve, reject) => {
//       const request = sessionStore.get(sessionId);
//       request.onsuccess = () => resolve(request.result);
//       request.onerror = () => reject(request.error);
//     });

//     if (!session) {
//       console.error(`❌ Session ${sessionId} not found.`);
//       return;
//     }

//     // ✅ Fetch all problems in the session from the problems store
//     const problemTransaction = db.transaction(["problems"], "readonly");
//     const problemStore = problemTransaction.objectStore("problems");

//     const problems = await new Promise((resolve, reject) => {
//       const request = problemStore.getAll();
//       request.onsuccess = () => resolve(request.result);
//       request.onerror = () => reject(request.error);
//     });

//     if (!Array.isArray(problems)) {
//       throw new Error("❌ Problems store returned an invalid response.");
//     }

//     // Create a quick lookup map for problems by ID
//     let problemMap = new Map(problems.map((problem) => [problem.id, problem]));

//     let weakTags = new Map();

//     // ✅ Iterate over attempts to find failed ones
//     for (const attempt of session.attempts) {
//       if (!attempt.Success) {
//         // Only track failed attempts
//         let problem = problemMap.get(attempt.problemId);

//         if (problem && Array.isArray(problem.Tags)) {
//           for (const tag of problem.Tags) {
//             weakTags.set(tag, (weakTags.get(tag) || 0) + 1);
//           }
//         }
//       }
//     }

//     // ✅ Determine the most frequently failed tags (top 5)
//     let sortedWeakTags = [...weakTags.entries()]
//       .sort((a, b) => b[1] - a[1]) // Sort by failure count
//       .map((entry) => entry[0])
//       .slice(0, 5); // Take top 5 weakest tags

//     // ✅ Update the session with `currentWeakTags`
//     session.currentWeakTags = sortedWeakTags;

//     // ✅ Save updated session back to IndexedDB
//     await sessionStore.put(session);

//     console.log(
//       `✅ Weak tags updated for Session ${sessionId}:`,
//       sortedWeakTags
//     );
//   } catch (error) {
//     console.error("❌ Error updating session with weak tags:", error);
//   }
// }
