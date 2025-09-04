import { dbHelper } from "../db/index.js";

const { openDB } = dbHelper;

/**
 * Migrates problems data to use perceivedDifficulty instead of Difficulty/Rating
 * - Renames Difficulty → perceivedDifficulty
 * - Removes Rating property (was duplicate of standard_problems.difficulty)
 * @returns {Promise<{migrated: number, errors: number}>}
 */
export async function migrateProblemsToPerceivedDifficulty() {
  const db = await openDB();
  const transaction = db.transaction(["problems"], "readwrite");
  const store = transaction.objectStore("problems");

  let migrated = 0;
  let errors = 0;

  return new Promise((resolve, reject) => {
    const request = store.openCursor();

    request.onsuccess = (event) => {
      const cursor = event.target.result;

      if (cursor) {
        const problem = cursor.value;
        let needsUpdate = false;

        // Migrate Difficulty → perceivedDifficulty
        if (problem.Difficulty !== undefined) {
          problem.perceivedDifficulty = problem.Difficulty;
          delete problem.Difficulty;
          needsUpdate = true;
        }

        // Remove Rating property (was from standard_problems)
        if (problem.Rating !== undefined) {
          delete problem.Rating;
          needsUpdate = true;
        }

        if (needsUpdate) {
          try {
            cursor.update(problem);
            migrated++;
          } catch (error) {
            errors++;
          }
        }

        cursor.continue();
      } else {
        // Migration complete
        resolve({ migrated, errors });
      }
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Utility to check migration status - counts problems with old vs new properties
 * @returns {Promise<{oldFormat: number, newFormat: number, total: number}>}
 */
export async function checkMigrationStatus() {
  const db = await openDB();
  const transaction = db.transaction(["problems"], "readonly");
  const store = transaction.objectStore("problems");

  return new Promise((resolve, reject) => {
    const request = store.getAll();

    request.onsuccess = (event) => {
      const problems = event.target.result;
      let oldFormat = 0;
      let newFormat = 0;

      problems.forEach((problem) => {
        if (problem.Difficulty !== undefined || problem.Rating !== undefined) {
          oldFormat++;
        }
        if (problem.perceivedDifficulty !== undefined) {
          newFormat++;
        }
      });

      resolve({
        oldFormat,
        newFormat,
        total: problems.length,
      });
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}
