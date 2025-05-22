import { dbHelper } from "./index.js";

const openDB = dbHelper.openDB;
export async function getProblemFromStandardProblems(slug) {
  try {
    console.log("📌 getProblemFromStandardProblems called with:", {
      slug,
    });

    const db = await openDB();
    if (!db) throw new Error("❌ Failed to open IndexedDB.");

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["standard_problems"], "readonly");
      const objectStore = transaction.objectStore("standard_problems");

      if (!objectStore.indexNames.contains("by_slug")) {
        console.error("❌ Index 'by_slug' not found in 'standard_problems'.");
        return reject("Index 'by_slug' not found.");
      }

      const index = objectStore.index("by_slug");

      console.log("📌 Querying standard_problems with slug:", slug);
      const request = index.get(slug);

      request.onsuccess = (event) => {
        const problem = event.target.result;
        console.log("🔍 Query Result:", problem);

        if (problem) {
          console.log("✅ Found problem in standard_problems:", problem);
          resolve(problem); // ✅ Directly resolve the problem object
        } else {
          console.warn("⚠️ Problem not found in standard_problems.");
          resolve(null); // ✅ Resolve null if not found
        }
      };

      request.onerror = (event) => {
        console.error(
          "❌ Error querying standard_problems:",
          event.target.error
        );
        reject("Failed to retrieve the problem: " + event.target.error);
      };
    });
  } catch (error) {
    console.error("❌ Error in getProblemFromStandardProblems:", error);
    throw error;
  }
}

export async function updateStandardProblemsFromData(problems) {
  try {
    if (!Array.isArray(problems)) {
      throw new Error("❌ Invalid data: expected an array.");
    }

    console.log("📌 Loaded", problems.length, "problems from local JSON");

    const db = await openDB();
    if (!db) throw new Error("❌ Failed to open IndexedDB.");

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["standard_problems"], "readwrite");
      const store = transaction.objectStore("standard_problems");

      let updatedCount = 0;

      problems.forEach((problem) => {
        console.log(problem);
        let newProblem = {
          id: problem["Problem Number"],
          title: problem["Title"],
          difficulty: problem["Difficulty"],
          tags:
            problem["Official Tags"] == null
              ? problem["Tags"].split(",").map((tag) =>
                  tag
                    .trim()
                    .toLowerCase()
                    .split(" ")
                    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(" ")
                )
              : problem["Official Tags"].split(",").map((tag) =>
                  tag
                    .trim()
                    .toLowerCase()
                    .split(" ")
                    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(" ")
                ),
          slug: problem["Slug"],
        };

        const request = store.put(newProblem);
        request.onsuccess = () => {
          updatedCount++;
        };

        request.onerror = (event) => {
          console.error("❌ Error updating problem:", event.target.error);
        };
      });

      transaction.oncomplete = () => {
        console.log(`✅ Successfully updated ${updatedCount} problems.`);
        resolve(updatedCount);
      };

      transaction.onerror = (event) => {
        console.error("❌ Transaction failed:", event.target.error);
        reject("Transaction failed: " + event.target.error);
      };
    });
  } catch (error) {
    console.error("❌ updateStandardProblemsFromData error:", error);
    throw error;
  }
}

export async function updateStandardProblems(jsonFilePath) {
  try {
    console.log("📌 updateStandardProblems called with:", { jsonFilePath });

    // Fetch the JSON file
    const response = jsonFilePath;
    if (!response.ok) throw new Error("❌ Failed to fetch JSON file.");

    const problems = await response.json();

    console.log("📌 Fetched problems data:", problems.length, "problems");

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
          console.error("❌ Error updating problem:", event.target.error);
        };
      });

      transaction.oncomplete = () => {
        console.log(
          `✅ Successfully updated ${updatedCount} problems in IndexedDB.`
        );
        resolve(updatedCount);
      };

      transaction.onerror = (event) => {
        console.error("❌ Transaction error:", event.target.error);
        reject("Transaction failed: " + event.target.error);
      };
    });
  } catch (error) {
    console.error("❌ Error in updateStandardProblems:", error);
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
          console.warn(`⚠️ Problem with ID ${problemId} not found.`);
          resolve(null); // Return null if not found
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error(`❌ Error fetching problem ${problemId}:`, error);
    return null;
  }
}

export async function normalizeTagForStandardProblems() {
  let problems = await getAllStandardProblems();
  problems.forEach((problem) => {
    problem.tags = problem.tags.map((tag) => tag.trim().toLowerCase());
  });

  console.log(problems);
  const db = await openDB();
  const tx = db.transaction("standard_problems", "readwrite");
  const store = tx.objectStore("standard_problems");
  problems.forEach((problem) => {
    store.put(problem);
  });
}
