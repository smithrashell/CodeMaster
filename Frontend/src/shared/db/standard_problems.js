import { dbHelper } from "./index.js";
import STANDARD_PROBLEMS from "../constants/LeetCode_Tags_Combined.json";
import logger from "../utils/logger.js";
const openDB = dbHelper.openDB;
export async function getProblemFromStandardProblems(slug) {
  try {
    logger.info("📌 getProblemFromStandardProblems called with:", {
      slug,
    });

    const db = await openDB();
    if (!db) throw new Error("❌ Failed to open IndexedDB.");

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["standard_problems"], "readonly");
      const objectStore = transaction.objectStore("standard_problems");

      if (!objectStore.indexNames.contains("by_slug")) {
        logger.error("❌ Index 'by_slug' not found in 'standard_problems'.");
        return reject(new Error("Index 'by_slug' not found."));
      }

      const index = objectStore.index("by_slug");

      logger.info("📌 Querying standard_problems with slug:", slug);
      const request = index.get(slug);

      request.onsuccess = (event) => {
        const problem = event.target.result;
        logger.info("🔍 Query Result:", problem);

        if (problem) {
          logger.info("✅ Found problem in standard_problems:", problem);
          resolve(problem); // ✅ Directly resolve the problem object
        } else {
          logger.warn("⚠️ Problem not found in standard_problems.");
          resolve(null); // ✅ Resolve null if not found
        }
      };

      request.onerror = (event) => {
        logger.error(
          "❌ Error querying standard_problems:",
          event.target.error
        );
        reject(new Error("Failed to retrieve the problem: " + event.target.error));
      };
    });
  } catch (error) {
    logger.error("❌ Error in getProblemFromStandardProblems:", error);
    throw error;
  }
}

export async function updateStandardProblemsFromData(problems) {
  try {
    if (!Array.isArray(problems)) {
      throw new Error("❌ Invalid data: expected an array.");
    }

    logger.info("📌 Loaded", problems.length, "problems from local JSON");

    const db = await openDB();
    if (!db) throw new Error("❌ Failed to open IndexedDB.");

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["standard_problems"], "readwrite");
      const store = transaction.objectStore("standard_problems");

      let updatedCount = 0;

      problems.forEach((problem) => {
        logger.info(problem);
        const request = store.put(problem);
        request.onsuccess = () => {
          updatedCount++;
        };

        request.onerror = (event) => {
          logger.error("❌ Error updating problem:", event.target.error);
        };
      });

      transaction.oncomplete = () => {
        logger.info(`✅ Successfully updated ${updatedCount} problems.`);
        resolve(updatedCount);
      };

      transaction.onerror = (event) => {
        logger.error("❌ Transaction failed:", event.target.error);
        reject(new Error("Transaction failed: " + event.target.error));
      };
    });
  } catch (error) {
    logger.error("❌ updateStandardProblemsFromData error:", error);
    throw error;
  }
}

export async function updateStandardProblems(jsonFilePath) {
  try {
    logger.info("📌 updateStandardProblems called with:", { jsonFilePath });

    // Fetch the JSON file
    const response = jsonFilePath;
    if (!response.ok) throw new Error("❌ Failed to fetch JSON file.");

    const problems = await response.json();

    logger.info("📌 Fetched problems data:", problems.length, "problems");

    const db = await openDB();
    if (!db) throw new Error("❌ Failed to open IndexedDB.");

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["standard_problems"], "readwrite");
      const store = transaction.objectStore("standard_problems");

      let updatedCount = 0;

      problems.forEach((problem) => {
        const request = store.put(problem);

        request.onsuccess = () => {
          updatedCount++;
        };

        request.onerror = (event) => {
          logger.error("❌ Error updating problem:", event.target.error);
        };
      });

      transaction.oncomplete = () => {
        logger.info(
          `✅ Successfully updated ${updatedCount} problems in IndexedDB.`
        );
        resolve(updatedCount);
      };

      transaction.onerror = (event) => {
        logger.error("❌ Transaction error:", event.target.error);
        reject(new Error("Transaction failed: " + event.target.error));
      };
    });
  } catch (error) {
    logger.error("❌ Error in updateStandardProblems:", error);
    throw error;
  }
}

export async function getAllStandardProblems() {
  const db = await openDB();
  const tx = db.transaction("standard_problems", "readonly");
  const store = tx.objectStore("standard_problems");
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function fetchProblemById(problemId) {
  try {
    const db = await openDB();
    const tx = db.transaction("standard_problems", "readonly"); // Adjust store name if needed
    const store = tx.objectStore("standard_problems");

    return new Promise((resolve, reject) => {
      const request = store.get(problemId);
      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result);
        } else {
          logger.warn(`⚠️ Problem with ID ${problemId} not found.`);
          resolve(null); // Return null if not found
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    logger.error(`❌ Error fetching problem ${problemId}:`, error);
    return null;
  }
}

export async function normalizeTagForStandardProblems() {
  let problems = await getAllStandardProblems();
  problems.forEach((problem) => {
    problem.tags = problem.tags.map((tag) => tag.trim().toLowerCase());
  });

  logger.info(problems);
  const db = await openDB();
  const tx = db.transaction("standard_problems", "readwrite");
  const store = tx.objectStore("standard_problems");
  problems.forEach((problem) => {
    store.put(problem);
  });
}

export async function insertStandardProblems() {
  const db = await openDB();
  const tx = db.transaction("standard_problems", "readwrite");
  const store = tx.objectStore("standard_problems");

  const existing = await store.getAll();
  if (existing.length > 0) {
    logger.info("📚 standard_problems already seeded.");
    return;
  }

  await Promise.all(
    STANDARD_PROBLEMS.map((problem) => {
      return new Promise((resolve, reject) => {
        logger.info("🧼 problem:", problem);
        const req = store.put(problem);
        req.onsuccess = resolve;
        req.onerror = () => reject(req.error);
      });
    })
  );

  logger.info(`✅ Inserted ${STANDARD_PROBLEMS.length} standard problems.`);
}
