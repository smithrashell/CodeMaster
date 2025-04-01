import { v4 as uuidv4 } from "uuid";
import { dbHelper } from "./db/index.js";
let db = null; // Ensure this is declared at the top-most scope of your script/module.

async function getDatabase() {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open("review", 10); // Assuming version 3 for new stores

    request.onsuccess = async (event) => {
      db = event.target.result;
      console.log("Database opened successfully");
      // await updateNextProblemForOneProblem(db);
      // Load CSV data if it's the first run (or as needed)
      // await loadCSVData(db, "./CSV2.csv");
      // await buildRelationships(db);
      // verifyStandardProblems(db);
      // validateGraph(db);

      //  const transaction = db.transaction("sessions", "readwrite");
      //   const sessionsStore = transaction.objectStore("sessions");

      //   const request = sessionsStore.put(sessionObject);
      //   await new Promise((resolve, reject) => {
      //     request.onsuccess = resolve;
      //     request.onerror = (event) => {
      //       console.error("Error adding/updating session:", event.target.error);
      //       reject(event.target.error);
      //     };
      //   });

      resolve(db);
    };

    request.onerror = (event) => {
      console.error("Database error:", event.target.error);
      reject(event.target.error);
    };

    request.onupgradeneeded = (event) => {
      console.log("Upgrading database...");

      try {
        const db = event.target.result;

        // Open the "attempts" store
        // let attemptsStore;
        // let problemsStore = event.target.transaction.objectStore("problems");
        // if (db.objectStoreNames.contains("attempts")) {
        //   attemptsStore = event.target.transaction.objectStore("attempts");
        // } else {
        //   attemptsStore = db.createObjectStore("attempts", { keyPath: "id" });
        //   console.log("Created 'attempts' object store.");
        // }
        // let sessionsStore = event.target.transaction.objectStore("sessions");
        // console.log("sessionsStore", sessionsStore);
        // if (!sessionsStore.indexNames.contains("by_date")) {
        //   sessionsStore.createIndex("by_date", "Date", { unique: true });
        //   console.log(
        //     "Created 'by_date' index on 'Date' field for sessions store"
        //   );
        // }

        // Delete the old index if it exists
        // if (attemptsStore.indexNames.contains("by_sessionId")) {
        //   attemptsStore.deleteIndex("by_sessionId");
        //   console.log("Deleted old 'by_sessionId' index.");
        // }

        // Create the new index for "SessionID"
        // attemptsStore.createIndex("by_sessionId", "SessionID", {
        //   unique: false,
        // });
        // console.log("Created new 'by_sessionId' index on 'SessionID' field.");
        // if (!store.indexNames.contains("by_sessionId")) {
        //   store.createIndex("by_sessionId", "sessionId", { unique: false });
        // }

        // // Create standard_problems store
        // if (!db.objectStoreNames.contains("standard_problems")) {
        //   store = db.createObjectStore("standard_problems", { keyPath: "id" });
        // } else {
        //   store = event.target.transaction.objectStore("standard_problems");
        // }

        // if (!store.indexNames.contains("by_slug")) {
        //   store.createIndex("by_slug", "slug", { unique: true });
        // }

        // // Create problem_relationships store
        // if (!db.objectStoreNames.contains("problem_relationships")) {
        //   const store = db.createObjectStore("problem_relationships", {
        //     keyPath: ["problemId1", "problemId2"],
        //   });
        //   store.createIndex("by_problemId1", "problemId1");
        //   store.createIndex("by_problemId2", "problemId2");

        // }

        // if (!problemsStore.indexNames.contains("by_nextProblem")) {
        //   problemsStore.createIndex("by_nextProblem", "NextProblem", {
        //     unique: false,
        //   });
        //   console.log("Created index 'by_nextProblem' on 'problems' store.");
        // }
      } catch (error) {
        console.error("Error during onupgradeneeded:", error);
        event.target.transaction.abort(); // Abort the transaction in case of error
      }
    };
  });
}

// Use this function to update all problems after testing
async function updateNextProblemForAllProblems(db) {
  const transaction = db.transaction(
    ["problems", "problem_relationships"],
    "readwrite"
  );
  const problemsStore = transaction.objectStore("problems");
  const relationshipsStore = transaction.objectStore("problem_relationships");

  const problemsRequest = problemsStore.getAll();
  const problems = await new Promise(
    (resolve) =>
      (problemsRequest.onsuccess = () => resolve(problemsRequest.result))
  );
  // loop through problems and update next problem
  for (const problem of problems) {
    const relatedRequest = relationshipsStore
      .index("by_problemId1")
      .getAll(problem.leetCodeID);

    const relatedProblems = await new Promise(
      (resolve) =>
        (relatedRequest.onsuccess = () => resolve(relatedRequest.result))
    );

    const nextProblem = relatedProblems.reduce(
      (max, current) => (current.weight > max.weight ? current : max),
      relatedProblems[0] // Use the first element as the initial value
    );

    if (nextProblem) {
      const updatedProblem = {
        ...problem,
        NextProblem: nextProblem.problemId2,
      };

      await new Promise((resolve, reject) => {
        const updateRequest = problemsStore.put(updatedProblem);
        updateRequest.onsuccess = resolve;
        updateRequest.onerror = () => reject(updateRequest.error);
      });

      console.log("Updated problem:", updatedProblem);
    } else {
      console.log("No next problem found for problem:", problem);
    }
  }

  transaction.oncomplete = () =>
    console.log("NextProblem updated for all problems.");
}

async function skipProblem(problemId) {
  const db = await getDatabase();
  console.log("skipProblem", problemId);

  const transaction = db.transaction(["problems"], "readwrite");
  const problemsStore = transaction.objectStore("problems");
  const problemFound = await new Promise((resolve, reject) => {
    const request = problemsStore.index("by_problem").get(problemId);
    request.onsuccess = () => {
      if (request.result) {
        resolve(true); // Record found
      } else {
        resolve(false); // Record not found
      }
    };
    request.onerror = () => reject(false);
  });

  console.log("problemFound", problemFound);
  // Fetch the latest session
  const sessionStore = db
    .transaction("sessions", "readwrite")
    .objectStore("sessions");

  let latestSession = await new Promise((resolve, reject) => {
    // Assuming you have an index on the "Date" property
    const index = sessionStore.index("by_date");

    // Open cursor in descending order
    const request = index.openCursor(null, "prev");

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        console.log("Most recent session:", cursor.value);
        resolve(cursor.value); // Resolve with the most recent session
      } else {
        console.log("No sessions found.");
        resolve(null); // Resolve with null if no sessions exist
      }
    };

    request.onerror = (e) => {
      console.error("Error fetching the most recent session:", e.target.error);
      reject(e.target.error);
    };
  });

  if (!latestSession) {
    console.error(`No active session found.`);
    return;
  }

  console.log("Latest session:", latestSession.problems);

  console.log("problemId", problemId);

  let problems = latestSession.problems;
  console.log("Initial problems array:", problems);
  const filteredProblems = problems.filter((problem) => {
    console.log("Evaluating problem:", problem);
    const matches = problem.id === 380 || problem.leetCodeID === 380;
    console.log("Matches condition:", matches);
    return !matches; // Keep only problems that don't match
  });
  console.log("Filtered problems array:", filteredProblems);

  console.log(filteredProblems);
  latestSession.problems = filteredProblems;

  // Save the updated session to the database
  try {
    await new Promise((resolve, reject) => {
      const request = sessionStore.put(latestSession);

      request.onsuccess = resolve(console.log("updatedSession", latestSession));
      request.onerror = (event) => {
        console.error("Error saving updated session:", event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error("Error in updating session", error);
  }
  // Save the updated session to Chrome storage
  await saveSessionToStorage(latestSession);
  //check if session is completed
  // await getOrCreateSession();
  console.log(`Removed skipped problem ${problemId} from session.`);

  // if (!problemFound) {
  //   // Fetch problems pointing to `problemId` as their `NextProblem`
  //   const transaction = db.transaction(["problems"], "readwrite");
  //   const problemsStore = transaction.objectStore("problems");
  //   const index = problemsStore.index("by_nextProblem");

  //   const pointingProblems = await new Promise((resolve, reject) => {
  //     const request = index.getAll(problemId);

  //     request.onsuccess = () => resolve(request.result);
  //     request.onerror = () => reject(request.error);
  //   });

  //   console.log("Pointing problems:", pointingProblems);

  //   // Update the `NextProblem` field for each related problem
  //   for (const problem of pointingProblems) {
  //     console.log("problem", problem);
  //     const updatedNextProblem = await updateProblemRelationshipsByLeetCodeID(
  //       db,
  //       problem,
  //       true
  //     );
  //     problem.NextProblem = updatedNextProblem;
  //     console.log("updatedNextProblem", updatedNextProblem);

  //     await new Promise((resolve, reject) => {
  //       const request = problemsStore.put(problem);
  //       request.onsuccess = resolve;
  //       request.onerror = () => reject(request.error);
  //     });

  //     console.log(
  //       `Updated NextProblem for problem ${problem.id} to ${problem.NextProblem}`
  //     );
  //   }
  //   console.log("Updated session saved to the database.");

  //   console.log(
  //     `Problem ${problemId} skipped, session and related problems updated.`
  //   );
  // } else {
  //   // if problem isn't found update schedule and  session  or cool down
  // }
}

// This function updates the problem relationship using LeetCodeID and handles skipping behavior
async function updateProblemRelationshipsByLeetCodeID(
  db,
  problem,
  skipped = false
) {
  console.log("updateProblemRelationshipsByLeetCodeID", problem, skipped);
  const transaction = db.transaction(["problem_relationships"], "readwrite");

  const relationshipsStore = transaction.objectStore("problem_relationships");

  const { leetCodeID: problemId, NextProblem: nextProblemId } = problem;

  // Handle updating the direct relationship only if `skipped`
  if (skipped && nextProblemId) {
    const relationshipKey = [problemId, nextProblemId];
    console.log("relationshipKey", relationshipKey);
    const relationship = await new Promise((resolve, reject) => {
      const request = relationshipsStore.get(relationshipKey);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    console.log("relationship", relationship);
    if (relationship) {
      const updatedWeight = Math.max(0, (relationship.weight || 0) - 1); // Weaken relationship

      const updatedRelationship = {
        ...relationship,
        weight: updatedWeight,
      };

      await new Promise((resolve, reject) => {
        const putRequest = relationshipsStore.put(updatedRelationship);

        putRequest.onsuccess = resolve;
        putRequest.onerror = () => reject(putRequest.error);
      });

      console.log(
        `Updated direct relationship: ${problemId} → ${nextProblemId} | New Weight: ${updatedRelationship.weight}`
      );
    }
  }

  // Update the NextProblem for the current problem
  const updatedNextProblem = await determineNextProblem(db, problemId);
  console.log("updatedNextProblem", updatedNextProblem);
  if (updatedNextProblem && updatedNextProblem !== nextProblemId) {
    problem.NextProblem = updatedNextProblem;

    await new Promise((resolve, reject) => {
      const putRequest = problemsStore.put(problem);
      putRequest.onsuccess = resolve;
      putRequest.onerror = () => reject(putRequest.error);
    });

    console.log(
      `Updated NextProblem for ${problemId} to ${problem.NextProblem}`
    );
  }

  console.log(
    `Problem relationships and NextProblem updated successfully for LeetCodeID ${leetCodeID}.`
  );
}

async function updateProblemRelationships(db, session) {
  const attemptedProblems = new Set(session.attempts.map((a) => a.problemId));
  console.log("attemptedProblems", attemptedProblems);

  for (const attempt of session.attempts) {
    const { problemId, success } = attempt;

    // Create a new transaction for each problem operation
    const transaction = db.transaction(
      ["problem_relationships", "sessions", "problems"],
      "readwrite"
    );
    const relationshipsStore = transaction.objectStore("problem_relationships");
    const problemsStore = transaction.objectStore("problems");

    // Fetch the problem
    const problem = await new Promise((resolve, reject) => {
      const request = problemsStore.get(problemId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (!problem) continue;

    const nextProblemId = problem.NextProblem;

    // === Direct Updates: A → B ===
    if (nextProblemId && attemptedProblems.has(nextProblemId)) {
      const relationshipKey = [problemId, nextProblemId];
      const relationship = await new Promise((resolve, reject) => {
        const request = relationshipsStore.get(relationshipKey);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (relationship) {
        const weightAdjustment = success ? 1 : -0.5;
        const updatedWeight = (relationship.weight || 0) + weightAdjustment;

        const updatedRelationship = {
          problemId1: problemId,
          problemId2: nextProblemId,
          weight: Math.max(0, updatedWeight),
        };

        await new Promise((resolve, reject) => {
          const putRequest = relationshipsStore.put(updatedRelationship);
          putRequest.onsuccess = resolve;
          putRequest.onerror = () => reject(putRequest.error);
        });

        console.log(
          `Updated direct relationship: ${problemId} → ${nextProblemId} | New Weight: ${updatedRelationship.weight}`
        );
      }
    }

    // === Indirect Updates: X → A ===
    const reverseRelationships = await new Promise((resolve, reject) => {
      const indexRequest = relationshipsStore
        .index("by_problemId2")
        .getAll(problemId);
      indexRequest.onsuccess = () => resolve(indexRequest.result);
      indexRequest.onerror = () => reject(indexRequest.error);
    });

    for (const rel of reverseRelationships) {
      const weightAdjustment = success ? 1 : -0.5;
      const updatedWeight = (rel.weight || 0) + weightAdjustment;

      const updatedRelationship = {
        ...rel,
        weight: Math.max(0, updatedWeight),
      };

      await new Promise((resolve, reject) => {
        const putRequest = relationshipsStore.put(updatedRelationship);
        putRequest.onsuccess = resolve;
        putRequest.onerror = () => reject(putRequest.error);
      });

      console.log(
        `Updated reverse relationship: ${rel.problemId1} → ${problemId} | New Weight: ${updatedRelationship.weight}`
      );
    }

    // === Update NextProblem Property ===
    const updatedNextProblem = await determineNextProblem(db, problemId);

    if (updatedNextProblem && updatedNextProblem !== nextProblemId) {
      problem.NextProblem = updatedNextProblem;

      await new Promise((resolve, reject) => {
        const putRequest = problemsStore.put(problem);
        putRequest.onsuccess = resolve;
        putRequest.onerror = () => reject(putRequest.error);
      });

      console.log(
        `Updated NextProblem for ${problemId} to ${problem.NextProblem}`
      );
    }
  }

  console.log("Problem relationships and NextProblem updated successfully.");
}

async function determineNextProblem(db, problemId) {
  // Open a new transaction for problem relationships and problems
  const transaction = db.transaction(
    ["problem_relationships", "problems"],
    "readonly"
  );
  const relationshipsStore = transaction.objectStore("problem_relationships");
  const problemsStore = transaction.objectStore("problems");

  // Fetch all relationships where problemId is the source
  const allRelatedRelationshipsRequest = relationshipsStore
    .index("by_problemId1")
    .getAll(problemId);

  const allRelatedRelationships = await new Promise((resolve, reject) => {
    allRelatedRelationshipsRequest.onsuccess = () =>
      resolve(allRelatedRelationshipsRequest.result);
    allRelatedRelationshipsRequest.onerror = () =>
      reject(allRelatedRelationshipsRequest.error);
  });

  if (allRelatedRelationships.length === 0) {
    console.log(`No relationships found for problem ${problemId}`);
    return null;
  }

  // Sort relationships by weight (highest first)
  const sortedRelationships = allRelatedRelationships.sort(
    (a, b) => b.weight - a.weight
  );

  for (const relationship of sortedRelationships) {
    const nextProblemId = relationship.problemId2;

    // Check if the NextProblem has already been attempted
    const problemRequest = problemsStore.get(nextProblemId);
    const nextProblemExists = await new Promise((resolve) => {
      problemRequest.onsuccess = () => resolve(!!problemRequest.result);
      problemRequest.onerror = () => resolve(false);
    });

    if (!nextProblemExists) {
      // Return the first valid NextProblem that hasn't been attempted
      return nextProblemId;
    }
  }

  console.log(
    `All potential NextProblems for ${problemId} have been attempted.`
  );
  return null; // No valid NextProblem found
}

function checkForDuplicateIds(problems) {
  const ids = problems.map((problem) => problem.id);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  console.log(`Found ${duplicates.length} duplicate IDs:`, duplicates);
}
// function verifyStandardProblems(db) {
//   const transaction = db.transaction("standard_problems", "readonly");
//   const store = transaction.objectStore("standard_problems");

//   const request = store.getAll();
//   request.onsuccess = () => {
//     console.log(`Total problems in store: ${request.result.length}`);
//     console.log(request.result);
//   };
//   request.onerror = (event) => {
//     console.error("Error fetching problems from store:", event.target.error);
//   };
// }

// async function writeChunkToDatabase(db, chunk) {
//   const transaction = db.transaction("standard_problems", "readwrite");
//   const store = transaction.objectStore("standard_problems");

//   return new Promise((resolve, reject) => {
//     transaction.oncomplete = () => {
//       console.log(`Chunk of ${chunk.length} problems written successfully.`);
//       resolve();
//     };

//     transaction.onerror = (event) => {
//       console.error("Transaction error:", event.target.error);
//       reject(event.target.error);
//     };

//     transaction.onabort = (event) => {
//       console.error("Transaction aborted:", event.target.error);
//       reject(event.target.error);
//     };

//     for (const problem of chunk) {
//       const request = store.put(problem);
//       request.onerror = (event) => {
//         console.error("Error writing problem:", event.target.error);
//       };
//     }
//   });
// }

async function buildRelationships(db) {
  const transaction = db.transaction(
    ["standard_problems", "problem_relationships"],
    "readwrite"
  );
  const problemStore = transaction.objectStore("standard_problems");
  const relationshipStore = transaction.objectStore("problem_relationships");

  try {
    // Fetch all problems from the store
    const problems = await new Promise((resolve, reject) => {
      const request = problemStore.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    console.log(`Fetched ${problems.length} problems to build relationships.`);

    // Map difficulty to numeric values
    const difficultyMap = { Easy: 1, Medium: 2, Hard: 3 };

    // Create relationships
    let relationshipCount = 0;
    for (let i = 0; i < problems.length; i++) {
      for (let j = i + 1; j < problems.length; j++) {
        const problem1 = problems[i];
        const problem2 = problems[j];

        // Convert difficulties to numeric values
        const difficulty1 = difficultyMap[problem1.difficulty] || 0;
        const difficulty2 = difficultyMap[problem2.difficulty] || 0;

        // Calculate the weight of the relationship
        const commonTags = problem1.tags.filter((tag) =>
          problem2.tags.includes(tag)
        ).length;
        const difficultyDifference = Math.abs(difficulty1 - difficulty2);
        const weight = commonTags - difficultyDifference;

        if (weight > 0) {
          const relationship = {
            problemId1: problem1.id,
            problemId2: problem2.id,
            weight,
          };

          // Insert the relationship into the store
          const request = relationshipStore.put(relationship);
          request.onsuccess = () =>
            console.log(`Added relationship:`, relationship);
          request.onerror = (event) =>
            console.error("Failed to add relationship:", event.target.error);

          relationshipCount++;
        }
      }
    }

    console.log(`Created ${relationshipCount} relationships.`);
  } catch (error) {
    console.error("Error building relationships:", error);
  }

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => {
      console.log("Relationships built successfully");
      resolve();
    };
    transaction.onerror = (event) => {
      console.error("Transaction error:", event.target.error);
      reject(event.target.error);
    };
    transaction.onabort = (event) => {
      console.error("Transaction aborted:", event.target.error);
      reject(event.target.error);
    };
  });
}

async function inspectCsv(filePath) {
  const response = await fetch(filePath);
  const text = await response.text();

  const rows = text.split("\n");
  console.log(`Total rows in CSV: ${rows.length - 1}`); // Exclude header row

  rows.forEach((line, index) => {
    const columns = line.split(",");
    if (columns.length < 5) {
      console.warn(`Malformed row at line ${index + 1}: ${line}`);
    }
  });
}

// (async () => {
//   const db = await getDatabase();

//   // Build relationships after data is loaded
//   await buildRelationships(db);

//   console.log("Database setup complete");
// })();

let isFetching = false;

// async function fetchTags(probArray) {
//   if (isFetching) return;
//   isFetching = true;
//   console.log(probArray);
//   try {
//     const response = await fetch("http://localhost:3000/fetch-problem-id", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify(probArray),
//     });

//     const data = await response.json();
//     console.log("tags:", data);
//     console.log("results", data.results);
//     console.log("type of results", typeof data.results);
//     if (data && data.results) {
//       const tagsDictionary = data.results.map((item) => ({
//         leetCodeID: item[0],
//         Tags: item[2],
//       }));
//       await updateDatabaseWithTags(tagsDictionary);
//     } else {
//       console.error(
//         "Error: 'results' property is missing in the response",
//         data
//       );
//     }
//   } catch (error) {
//     console.error("Error creating assistant:", error);
//   }
//   isFetching = false;
// }

// async function fetchProblemsFromDB(limit = 5, offset = 0) {
//   const db = await getDatabase(); // Assuming you have a function to open your DB
//   const transaction = db.transaction(["problems"], "readonly");
//   const store = transaction.objectStore("problems");
//   const request = store.openCursor();
//   const problems = [];

//   return new Promise((resolve, reject) => {
//     request.onsuccess = (event) => {
//       let cursor = event.target.result;

//       if (cursor && problems.length < limit) {
//         if (offset-- <= 0) {
//           if (cursor.Tags == undefined)
//             problems.push({
//               LeetCodeID: cursor.value.leetCodeID,
//               Description: cursor.value.ProblemDescription,
//             });
//         }
//         cursor.continue();
//       } else {
//         resolve(problems);
//       }
//     };
//     request.onerror = (event) => {
//       reject(event.target.error);
//     };
//   });
// }

// async function updateAllProblems() {
//   return new Promise(async (resolve, reject) => {
//     let offset = 0;
//     const limit = 5;
//     let continueUpdating = true;

//     while (continueUpdating) {
//       try {
//         const problems = await fetchProblemsFromDB(limit, offset);
//         console.log(
//           `Fetched ${problems.length} problems from DB with offset ${offset}`
//         );

//         if (problems.length > 0) {
//           await fetchTags(problems); // Assuming you have a function to make the API call
//           console.log(`Fetched tags for problems with offset ${offset}`);
//           //running the just the first batch for testing
//           offset += limit; // Move to the next batch
//           // continueUpdating = false;
//         } else {
//           continueUpdating = false; // No more problems to process
//         }
//       } catch (error) {
//         console.error("Error updating problems:", error);
//         reject(error);
//         return;
//       }
//     }

//     console.log("All problems updated successfully");
//     resolve();
//   });
// }

// async function updateDatabaseWithTags(tagsDictionary) {
//   try {
//     const db = await getDatabase();
//     const transaction = db.transaction(["problems"], "readwrite"); // Specify your object store and transaction mode
//     const store = transaction.objectStore("problems");
//     const index = store.index("by_problem");

//     return new Promise((resolve, reject) => {
//       // Update each problem with new tags

//       console.log("tagsDictionary", tagsDictionary);
//       tagsDictionary.forEach((value) => {
//         const leetCodeID = parseInt(value.leetCodeID);
//         const Tags = value.Tags;

//         const getRequest = index.get(leetCodeID);

//         getRequest.onsuccess = function () {
//           const data = getRequest.result;
//           if (data) {
//             delete data.tags;
//             data.Tags = Tags;
//             const putRequest = store.put(data);
//             putRequest.onsuccess = function () {
//               console.log(
//                 `Successfully updated tags for problem ${leetCodeID}`
//               );
//             };
//             putRequest.onerror = function (e) {
//               console.error(
//                 `Error updating problem ${leetCodeID}: `,
//                 e.target.error
//               );
//             };
//           } else {
//             console.log(`Problem with LeetCode ID ${leetCodeID} not found.`);
//           }
//         };

//         getRequest.onerror = function (e) {
//           console.error(
//             `Error fetching problem ${leetCodeID}: `,
//             e.target.error
//           );
//         };
//       });
//     });
//   } catch (error) {
//     console.log("updateDatabaseWithTags", error);
//   }
// }

// // Example usage:
// const tagsArray = {
//   "1619": ["Array", "Math", "Sorting", "Prefix Sum", "Mean"],
//   "1730": ["Graph", "Breadth-First Search", "Shortest Path", "Simulation", "Queue"],
//   "73": ["Array", "Matrix", "Hash Table", "Set Zeroes", "Simulation"],
//   "226": ["Tree", "Binary Tree", "Depth-First Search", "Invert", "Recursion"],
//   "56": ["Array", "Sorting", "Merge Intervals", "Greedy", "Merge"]
// };

// updateDatabaseWithTags(tagsArray);

async function getSession() {
  const db = await getDatabase();
  const transaction = db.transaction("sessions", "readonly");
  const objectStore = transaction.objectStore("sessions");

  return new Promise((resolve, reject) => {
    const request = objectStore.getAll();

    request.onsuccess = (event) => {
      const sessions = event.target.result;
      resolve(sessions);
    };

    request.onerror = (event) => {
      console.error("Error getting sessions:", event.target.error);
      reject(event.target.error);
    };
  });
}

async function getLimits() {
  const db = await getDatabase();
  const transaction = db.transaction("limits", "readonly");
  const objectStore = transaction.objectStore("limits");

  return new Promise((resolve, reject) => {
    const request = objectStore.getAll();

    request.onsuccess = (event) => {
      const limits = event.target.result;
      resolve(limits);
    };

    request.onerror = (event) => {
      console.error("Error getting limits:", event.target.error);
      reject(event.target.error);
    };
  });
}
async function getCurrSession(date) {
  const db = await getDatabase();
  const transaction = db.transaction("sessions", "readonly");
  const objectStore = transaction.objectStore("sessions");
  const index = objectStore.index("by_date");
  const request = index.get(date);

  return new Promise((resolve, reject) => {
    request.onsuccess = (event) => {
      const sessionData = event.target.result;
      resolve(sessionData);
    };

    request.onerror = (event) => {
      console.error("Error getting session data:", event.target.error);
      reject(event.target.error);
    };
  });
}

// async function getLimit() {
//   const db = await getDatabase();
//   const transaction = db.transaction("limits", "readonly");
//   const objectStore = transaction.objectStore("limits");
//   const index = objectStore.index("by_createAt");
//   const request = index.openCursor(null, "prev");

//   return new Promise((resolve, reject) => {
//     request.onsuccess = (event) => {
//       const cursor = event.target.result;
//       if (cursor) {
//         const limit = cursor.value;
//         resolve(limit);
//       } else {
//         resolve(null);
//       }
//     };

//     request.onerror = (event) => {
//       console.error("Error getting most recent limit:", event.target.error);
//       reject(event.target.error);
//     };
//   });
// }

async function countProblemsByBoxLevel() {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["problems"], "readonly");
    const objectStore = transaction.objectStore("problems");
    const cursorRequest = objectStore.openCursor();
    const boxLevelCounts = {};

    cursorRequest.onsuccess = function (event) {
      const cursor = event.target.result;
      if (cursor) {
        const { BoxLevel } = cursor.value;
        boxLevelCounts[BoxLevel] = (boxLevelCounts[BoxLevel] || 0) + 1;
        cursor.continue();
      } else {
        // Finished iterating through all records
        resolve(boxLevelCounts);
      }
    };

    cursorRequest.onerror = function (event) {
      console.log(
        "Error in counting problems by box level: ",
        event.target.errorCode
      );
      reject(event.target.errorCode);
    };
  });
}

async function getAllProblems() {
  const db = await getDatabase();
  return new Promise((resolve, rejected) => {
    const transaction = db.transaction(["problems"], "readonly");
    const objectStore = transaction.objectStore("problems");

    const keyRequest = objectStore.getAll();

    keyRequest.onsuccess = function (event) {
      console.log("GetAllProblems 98 - Got all keys:", event.target.result);
      resolve(keyRequest.result);
    };

    keyRequest.onerror = function (event) {
      console.log(
        "GetAllProblems 98 - Failed to get all keys:",
        event.target.errorCode
      );
      rejected(event.target.errorCode);
    };
  });
}
async function getProblemById(problemId) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const transcation = db.transaction(["problems"], "readonly");
    const objectStore = transcation.objectStore("problems");
    const request = objectStore.index("by_problem").get(problemId);

    request.onsuccess = (event) => {
      resolve(request.result);
    };

    request.onerror = (event) => {
      reject(event.target.errorCode);
    };
  });
}

async function getProblem(problemId) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["problems"], "readonly");
    const problemStore = transaction.objectStore("problems");

    // Use a get request to fetch the problem by its ID:string
    const request = problemStore.get(problemId);

    request.onsuccess = (event) => {
      if (event.target.result) {
        console.log(
          "GetProblems 121 - event.target.result",
          event.target.result
        );
        resolve(event.target.result); // Resolving with the fetched problem object
      } else {
        console.log("GetProblems GetProblems 121 - no problem found");
        resolve(null); // Resolve with null if the problem was not found
      }
    };

    request.onerror = (event) => {
      reject(event.target.error); // Rejecting the promise in case of an error
    };
  });
}

const boxIntervals = [1, 3, 7, 14, 30, 60, 90, 120]; // Box Level intervals

async function fetchProblemsForSession(sessionLength, newProblemsPerSession) {
  const db = await getDatabase();
  let problemsDueForReview = await getDailyReviewSchedule(sessionLength);

  console.log("Problems due for review:", problemsDueForReview.length);
  console.log("Problems due for review:", problemsDueForReview);

  if (problemsDueForReview.length < sessionLength) {
    const additionalProblemsNeeded =
      sessionLength - problemsDueForReview.length;
    const excludeIds = problemsDueForReview.map((p) => p.id);

    const additionalProblems = await fetchAdditionalProblems(
      newProblemsPerSession,
      excludeIds
    );

    console.log("Additional problems fetched:", additionalProblems.length);
    problemsDueForReview = deduplicateById(
      problemsDueForReview.concat(additionalProblems)
    );

    // Fallback: Allow any remaining problems if still underfilled
    if (problemsDueForReview.length < sessionLength) {
      console.log("Filling remaining slots with fallback problems.");
      const allProblems = await fetchAllProblems();

      const fallbackProblems = allProblems.filter(
        (problem) => !excludeIds.includes(problem.id)
      );

      fallbackProblems.sort(problemSortingCriteria);
      problemsDueForReview = deduplicateById(
        problemsDueForReview.concat(
          fallbackProblems.slice(0, sessionLength - problemsDueForReview.length)
        )
      );
    }
  }

  console.log("Final schedule length:", problemsDueForReview.length);
  return problemsDueForReview.slice(0, sessionLength);
}

async function getDailyReviewSchedule(sessionLength) {
  const allProblems = await fetchAllProblems();

  const filteredProblems = allProblems.filter(
    (problem) =>
      isDueForReview(problem.ReviewSchedule) ||
      !isRecentlyAttempted(problem.lastAttemptDate, problem.BoxLevel)
  );

  filteredProblems.sort(problemSortingCriteria);

  const schedule = await buildDailySchedule(filteredProblems, sessionLength);
  return deduplicateById(schedule);
}

async function fetchAllProblems() {
  const db = await getDatabase();
  const transaction = db.transaction("problems", "readonly");
  const objectStore = transaction.objectStore("problems");
  const cursorRequest = objectStore.openCursor();
  const problems = [];

  return new Promise((resolve, reject) => {
    cursorRequest.onsuccess = function (event) {
      const cursor = event.target.result;

      if (cursor) {
        problems.push(cursor.value);
        cursor.continue();
      } else {
        resolve(deduplicateById(problems));
      }
    };

    cursorRequest.onerror = function (event) {
      reject(event.target.errorCode);
    };
  });
}

// async function fetchAdditionalProblems(countNeeded, excludeIds) {
//   const allProblems = await fetchAllProblems();

//   const additionalProblems = allProblems.filter(
//     (problem) =>
//       !excludeIds.includes(problem.id) &&
//       !isRecentlyAttempted(problem.lastAttemptDate, problem.BoxLevel, true)
//   );

//   additionalProblems.sort(problemSortingCriteria);
//   return additionalProblems.slice(0, countNeeded);
// }
// async function fetchAdditionalProblems(countNeeded, excludeIds) {
//   const db = await getDatabase();

//   // Corresponding intervals for 0-based box levels
//   const boxIntervals = [1, 3, 7, 14, 30, 60, 90, 120];
//   const highestBoxLevel = boxIntervals.length - 1; // Index of the highest interval
//   let validatedNextProblems = [];
//   let problemsPulled = 0;

//   // Fetch all problems
//   const allProblems = await fetchAllProblems();

//   // Iterate through box levels in descending order
//   for (let boxLevel = highestBoxLevel; boxLevel >= 0; boxLevel--) {
//     if (problemsPulled >= countNeeded) break;

//     // Filter problems in the current box level with a valid NextProblem
//     const problemsInBox = allProblems
//       .filter(
//         (problem) =>
//           problem.BoxLevel === boxLevel &&
//           problem.NextProblem &&
//           !excludeIds.includes(problem.NextProblem)
//       )
//       .sort(
//         (a, b) => b.AttemptStats.TotalAttempts - a.AttemptStats.TotalAttempts
//       );

//     for (const problem of problemsInBox) {
//       if (problemsPulled >= countNeeded) break;

//       const nextProblemId = problem.NextProblem;

//       // Create a new transaction for each `get` operation
//       const nextProblemExists = await new Promise((resolve) => {
//         const transaction = db.transaction("problems", "readonly");
//         const problemsStore = transaction.objectStore("problems");
//         const index = problemsStore.index("by_problem");
//         const nextProblemRequest = index.get(nextProblemId);

//         nextProblemRequest.onsuccess = () =>
//           resolve(!!nextProblemRequest.result);
//         nextProblemRequest.onerror = () => resolve(false);
//       });
//       console.log("nextProblemExists", nextProblemExists, nextProblemId);
//       // If the NextProblem has not been attempted, add it to validatedNextProblems
//       if (!nextProblemExists) {
//         console.log("nextProblemId", nextProblemId);
//         validatedNextProblems.push(nextProblemId);
//         problemsPulled++;
//       }
//     }
//   }

//   // Fetch validated NextProblems from standard_problems store
//   const nextProblems = await fetchProblemsByIdsWithTransaction(
//     db,
//     validatedNextProblems.slice(0, countNeeded)
//   );

//   // Fill remaining slots with additional problems, if needed
//   const remainingNeeded = countNeeded - nextProblems.length;
//   const additionalProblems = allProblems
//     .filter(
//       (problem) =>
//         !excludeIds.includes(problem.id) &&
//         !validatedNextProblems.includes(problem.id) &&
//         !isRecentlyAttempted(problem.lastAttemptDate, problem.BoxLevel, true)
//     )
//     .sort(problemSortingCriteria)
//     .slice(0, remainingNeeded);

//   // Combine and deduplicate
//   const combinedProblems = deduplicateById([
//     ...nextProblems,
//     ...additionalProblems,
//   ]);

//   console.log(
//     `Pulled ${nextProblems.length} problems from NextProblem.`,
//     nextProblems
//   );
//   console.log(`Pulled ${additionalProblems.length} additional problems.`);

//   return combinedProblems;
// }

async function fetchAdditionalProblems(
  countNeeded,
  excludeIds,
  maxDifficulty = "Medium"
) {
  const db = await getDatabase();

  // Corresponding intervals for 0-based box levels
  const boxIntervals = [1, 3, 7, 14, 30, 60, 90, 120];
  const highestBoxLevel = boxIntervals.length - 1; // Index of the highest interval
  let validatedNextProblemIds = [];
  let problemsPulled = 0;

  while (problemsPulled < countNeeded) {
    let additionalNextProblemIds = [];

    for (let boxLevel = highestBoxLevel; boxLevel >= 0; boxLevel--) {
      if (problemsPulled >= countNeeded) break;

      const allProblems = await fetchAllProblems();
      const problemsInBox = allProblems
        .filter(
          (problem) =>
            problem.BoxLevel === boxLevel &&
            problem.NextProblem &&
            !excludeIds.includes(problem.NextProblem)
        )
        .sort(
          (a, b) => b.AttemptStats.TotalAttempts - a.AttemptStats.TotalAttempts
        );

      for (const problem of problemsInBox) {
        if (problemsPulled >= countNeeded) break;

        const nextProblemId = problem.NextProblem;

        // Check if the NextProblem has already been attempted
        const nextProblemRequest = db
          .transaction("problems", "readonly")
          .objectStore("problems")
          .index("by_problem")
          .get(nextProblemId);

        const nextProblemExists = await new Promise((resolve) => {
          nextProblemRequest.onsuccess = (event) =>
            resolve(!!nextProblemRequest.result);
          nextProblemRequest.onerror = () => resolve(false);
        });

        // If the NextProblem exists in the problems store, skip it
        if (nextProblemExists) {
          console.log(
            `Skipping NextProblem ${nextProblemId} (already attempted).`
          );
          continue;
        }

        // Fetch the NextProblem details from the standard_problems store
        const standardProblemRequest = db
          .transaction("standard_problems", "readonly")
          .objectStore("standard_problems")
          .get(nextProblemId);

        const standardProblem = await new Promise((resolve) => {
          standardProblemRequest.onsuccess = (event) =>
            resolve(event.target.result || null);
          standardProblemRequest.onerror = () => resolve(null);
        });

        if (
          standardProblem &&
          isDifficultyAllowed(standardProblem.difficulty, maxDifficulty) &&
          !excludeIds.includes(standardProblem.id)
        ) {
          validatedNextProblemIds.push(standardProblem.id);
          additionalNextProblemIds.push(standardProblem.id);
          problemsPulled++;
        }
      }
    }

    // If no additional problems are found, break to avoid infinite loops
    if (additionalNextProblemIds.length === 0) {
      console.warn("No additional NextProblems meet the criteria.");
      break;
    }
  }

  // Fetch validated NextProblems from standard_problems store
  const nextProblems = await fetchProblemsByIdsWithTransaction(
    db,
    validatedNextProblemIds.slice(0, countNeeded)
  );

  console.log(
    `Pulled ${nextProblems.length} problems from NextProblem.`,
    nextProblems
  );

  return nextProblems;
}

// Helper function to check if the problem's difficulty is within the allowed range
function isDifficultyAllowed(difficulty, maxDifficulty) {
  const difficultyLevels = ["Easy", "Medium", "Hard"];
  const difficultyIndex = difficultyLevels.indexOf(difficulty);
  const maxIndex = difficultyLevels.indexOf(maxDifficulty);

  return difficultyIndex <= maxIndex;
}

// Fetch details of problems by IDs from standard_problems
async function fetchProblemsByIdsWithTransaction(db, problemIds) {
  const transaction = db.transaction(["standard_problems"], "readonly");
  const standardProblemsStore = transaction.objectStore("standard_problems");

  const problems = await Promise.all(
    problemIds.map(
      (id) =>
        new Promise((resolve) => {
          const request = standardProblemsStore.get(id);
          request.onsuccess = (event) => resolve(event.target.result || null);
          request.onerror = () => resolve(null);
        })
    )
  );

  return problems.filter(Boolean); // Exclude any null results
}

async function buildDailySchedule(problems, sessionLength) {
  const boxLevels = {};
  const maxBoxLevel = 7;

  // Initialize box levels
  for (let i = 1; i <= maxBoxLevel; i++) {
    boxLevels[i] = [];
  }
  boxLevels["others"] = [];

  // Categorize problems
  problems.forEach((problem) => {
    if (problem.BoxLevel >= 1 && problem.BoxLevel <= maxBoxLevel) {
      boxLevels[problem.BoxLevel].push(problem);
    } else {
      boxLevels["others"].push(problem);
    }
  });

  // Sort problems within each box level
  for (let level in boxLevels) {
    boxLevels[level].sort(problemSortingCriteria);
  }

  // Allocate quotas and build schedule
  const baseQuota = Math.floor(sessionLength / (maxBoxLevel + 1));
  const quotas = {};
  for (let i = 1; i <= maxBoxLevel; i++) {
    quotas[i] = baseQuota;
  }
  quotas["others"] = sessionLength - baseQuota * maxBoxLevel;

  let schedule = [];
  for (let i = 1; i <= maxBoxLevel; i++) {
    schedule = schedule.concat(boxLevels[i].slice(0, quotas[i]));
  }

  schedule = schedule.concat(boxLevels["others"].slice(0, quotas["others"]));

  return deduplicateById(schedule);
}

function isDueForReview(reviewDate) {
  const today = new Date();
  return new Date(reviewDate) <= today;
}

function isRecentlyAttempted(
  lastAttemptDate,
  boxLevel,
  allowRelaxation = true
) {
  const today = new Date();
  const lastAttempt = new Date(lastAttemptDate);
  let skipInterval = boxIntervals[boxLevel - 1] || 14;

  if (allowRelaxation) {
    skipInterval /= 2;
  }

  const daysSinceLastAttempt = (today - lastAttempt) / (1000 * 60 * 60 * 24);
  return daysSinceLastAttempt < skipInterval;
}

function deduplicateById(problems) {
  const seen = new Set();
  return problems.filter((problem) => {
    if (seen.has(problem.id)) {
      return false;
    }
    seen.add(problem.id);
    return true;
  });
}

function problemSortingCriteria(a, b) {
  const reviewDateA = new Date(a.ReviewSchedule);
  const reviewDateB = new Date(b.ReviewSchedule);

  if (reviewDateA < reviewDateB) return -1;
  if (reviewDateA > reviewDateB) return 1;

  const totalAttemptsA = a.AttemptStats.TotalAttempts;
  const totalAttemptsB = b.AttemptStats.TotalAttempts;

  if (totalAttemptsA < totalAttemptsB) return -1;
  if (totalAttemptsA > totalAttemptsB) return 1;

  const aScore = calculateDecayScore(
    a.lastAttemptDate,
    a.AttemptStats.SuccessfulAttempts / a.AttemptStats.TotalAttempts
  );
  const bScore = calculateDecayScore(
    b.lastAttemptDate,
    b.AttemptStats.SuccessfulAttempts / b.AttemptStats.TotalAttempts
  );

  return bScore - aScore;
}

function calculateDecayScore(lastAttemptDate, successRate) {
  const today = new Date();
  const lastAttempt = new Date(lastAttemptDate);

  const daysSinceLastAttempt = (today - lastAttempt) / (1000 * 60 * 60 * 24);
  const decayRate = 1 - successRate;

  return decayRate * daysSinceLastAttempt;
}

async function checkDatabaseForProblem(problemId) {
  const db = await getDatabase();
  const transaction = db.transaction(["problems"], "readwrite");
  const store = transaction.objectStore("problems");
  const index = store.index("by_problem");
  const getRequest = index.get(problemId);

  return new Promise((resolve, reject) => {
    getRequest.onsuccess = function () {
      if (getRequest.result) {
        console.log(getRequest.result);
        resolve(getRequest.result.id);
      } else {
        resolve(false);
      }
    };

    getRequest.onerror = function () {
      console.log("Error", getRequest.error);
      reject(getRequest.error);
    };
  });
}

async function checkAndCompleteSession(sessionId) {
  const db = await getDatabase();

  // Start a transaction to access the session and attempts stores
  const transaction = db.transaction(["sessions", "attempts"], "readonly");
  const sessionStore = transaction.objectStore("sessions");
  const attemptsStore = transaction.objectStore("attempts");

  // Fetch the session
  const sessionRequest = sessionStore.get(sessionId);
  const session = await new Promise((resolve, reject) => {
    sessionRequest.onsuccess = () => resolve(sessionRequest.result);
    sessionRequest.onerror = () => reject(sessionRequest.error);
  });

  if (!session) {
    console.error(`Session ${sessionId} not found.`);
    return;
  }

  console.log("Session problems:", session.problems);

  // Fetch all attempts for this session
  const attemptsRequest = attemptsStore.index("by_sessionId").getAll(sessionId);
  const attempts = await new Promise((resolve, reject) => {
    attemptsRequest.onsuccess = () => resolve(attemptsRequest.result);
    attemptsRequest.onerror = () => reject(attemptsRequest.error);
  });

  console.log("Attempts for session:", attempts);

  // Get all problem IDs from attempts
  const attemptedProblemIds = new Set(attempts.map((a) => a.ProblemID));
  console.log("Attempted Problem IDs:", attemptedProblemIds);

  // Extract problem IDs from session
  const sessionProblemIds = session.problems.map((p) => p.id);
  console.log("Session Problem IDs:", sessionProblemIds);

  // Check if all scheduled problems have been attempted
  const allProblemsAttempted = sessionProblemIds.every((id) =>
    attemptedProblemIds.has(id)
  );
  console.log("allProblemsAttempted:", allProblemsAttempted);

  if (allProblemsAttempted) {
    console.log("All problems attempted:", true);

    // Update Problem relationships with attempt data
    await updateProblemRelationships(db, session);

    // Create a new transaction to update the session status
    const updateTransaction = db.transaction(["sessions"], "readwrite");
    const updateSessionStore = updateTransaction.objectStore("sessions");

    // Update the session status to "completed"
    session.status = "completed";

    await new Promise((resolve, reject) => {
      const updateRequest = updateSessionStore.put(session);
      updateRequest.onsuccess = resolve;
      updateRequest.onerror = () => reject(updateRequest.error);
    });

    console.log(`Session ${sessionId} is now marked as completed.`);
    return true;
  } else {
    console.log(`Session ${sessionId} is still in progress.`);
    return false;
  }
}

async function getOrCreateSession(getSession) {
  let settings = await new Promise((resolve) => {
    chrome.storage.local.get("settings", (result) => {
      resolve(result.settings);
    });
  });
  const db = await getDatabase();
  console.log("settings", settings);
  let sessionLength = settings.sessionLength;

  // Transaction for fetching the latest session
  const transaction = db.transaction(["sessions", "attempts"], "readonly");
  const sessionsStore = transaction.objectStore("sessions");
  const attemptsStore = transaction.objectStore("attempts");
  const index = sessionsStore.index("by_date");

  // Fetch the latest session by `by_date` index
  const latestSession = await new Promise((resolve, reject) => {
    const request = index.openCursor(null, "prev"); // Get the latest session
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      resolve(cursor ? cursor.value : null);
    };
    request.onerror = (e) => reject(e.target.error);
  });
  console.log("latestSession", latestSession);

  if (latestSession.status === "in_progress") {
    // Fetch all attempts for the latest session
    const attempts = await new Promise((resolve, reject) => {
      const request = attemptsStore
        .index("by_sessionId")
        .getAll(latestSession.id);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (e) => reject(e.target.error);
    });
    console.log("attempts", attempts);
    // Create a Set of problem IDs with attempts
    const attemptedProblemIds = new Set(attempts.map((a) => a.ProblemID));

    // Filter problems in the session to return only unattempted problems
    const unattemptedProblems = latestSession.problems.filter(
      (problem) => !attemptedProblemIds.has(problem.id)
    );
    console.log("unatttemptedProblems", unattemptedProblems);
    console.log("attemptedProblemIds", attemptedProblemIds);
    let isSessionCompleted = await checkAndCompleteSession(latestSession.id);
    console.log("isSessionCompleted", isSessionCompleted);

    if (!isSessionCompleted) {
      console.log("getSession", getSession);
      if (getSession) {
        console.log("returning latestSession", latestSession);
        return latestSession;
      }
      console.log(
        "Returning ongoing session with unattempted problems:",
        unattemptedProblems
      );
      await saveSessionToStorage(latestSession); // Save to Chrome storage
      return unattemptedProblems;
    }
  }
  console.log("fetching problems");
  // If no session or all problems have been attempted, fetch problems and create a new session
  const problems = await fetchProblemsForSession(
    sessionLength,
    settings.numberofNewProblemsPerSession
  );
  console.log("problems", problems);
  const newSession = {
    id: uuidv4(),
    Date: new Date().toISOString(),
    status: "in_progress",
    problems: problems,
    attempts: [],
  };

  // Save the new session to the database in its own transaction
  await saveNewSessionToDB(newSession);
  await saveSessionToStorage(newSession); // Save the new session to Chrome storage
  console.log("newSession", newSession);
  console.log("Created new session:", newSession);

  return newSession.problems;
}

async function saveNewSessionToDB(newSession) {
  const db = await getDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction("sessions", "readwrite");
    const sessionsStore = transaction.objectStore("sessions");
    const request = sessionsStore.add(newSession);

    request.onsuccess = resolve;
    request.onerror = (e) => reject(e.target.error);
  });
}

async function saveSessionToStorage(session, updateDatabase = false) {
  return new Promise(async (resolve, reject) => {
    try {
      // Save session to Chrome storage
      chrome.storage.local.set({ currentSession: session }, async () => {
        console.log("Session saved to Chrome storage:", session);

        if (updateDatabase) {
          try {
            const db = await getDatabase();
            const transaction = db.transaction("sessions", "readwrite");
            const sessionsStore = transaction.objectStore("sessions");

            // Update or add the session to the sessions store
            await new Promise((resolveDB, rejectDB) => {
              const request = sessionsStore.put(session);
              request.onsuccess = () => {
                console.log("Session saved to sessions store:", session);
                resolveDB();
              };
              request.onerror = (event) => {
                console.error(
                  "Error saving session to sessions store:",
                  event.target.error
                );
                rejectDB(event.target.error);
              };
            });

            transaction.oncomplete = () => {
              console.log("Transaction completed for sessions store.");
            };
            transaction.onerror = (event) => {
              console.error(
                "Transaction error for sessions store:",
                event.target.error
              );
              reject(event.target.error);
            };
          } catch (error) {
            console.error("Error saving session to sessions store:", error);
            reject(error);
          }
        }

        resolve();
      });
    } catch (error) {
      console.error("Error saving session to Chrome storage:", error);
      reject(error);
    }
  });
}

// Helper function to find a problem in the session's problems array
function findProblemInSession(session, problemData) {
  console.log("session", session);
  console.log("problemData", problemData);
  console.log(
    "problem",
    session.problems.find((p) => p.id === problemData.leetCodeID)
  );
  return session.problems.find((p) => p.id === problemData.leetCodeID);
}

// Helper function to add or update a problem in the session
function addOrUpdateProblemInSession(session, problem, attemptId) {
  const existingProblem = findProblemInSession(session, problem);
  if (existingProblem) {
    const updatedproblems = session.problems.map((curr) =>
      curr.id === existingProblem.id ? problem : curr
    );
    session.problems = updatedproblems;
    console.log("updatedSession", session);
  }

  console.log("session", session);

  return session;
}

async function addProblem(problemData, sendResponse) {
  try {
    const db = await getDatabase();

    // Retrieve the active session from Chrome storage
    let session = await new Promise((resolve) => {
      chrome.storage.local.get(["currentSession"], (result) => {
        resolve(result.currentSession || null);
      });
    });

    // If no active session, create or retrieve one
    if (!session) {
      console.log(
        "No active session found. Creating or retrieving a session..."
      );
      session = await getOrCreateSession();
      await saveSessionToStorage(session);
    }

    // Create a transaction for the "problems" store
    const transaction = db.transaction(["problems"], "readwrite");
    const objectStore = transaction.objectStore("problems");

    const problemId = uuidv4();
    const attemptId = uuidv4();
    const leetCodeID = problemData.leetCodeID
      ? Number(problemData.leetCodeID)
      : null;
    const address = problemData.address;

    // Structure the problem object
    const problem = {
      id: problemId,
      ProblemDescription: problemData.title.toLowerCase(),
      ProblemNumberAssoc: [],
      leetCodeID: leetCodeID,
      LeetCodeAddress: address,
      ConsecutiveFailures: 0,
      CooldownStatus: false,
      BoxLevel: 1,
      ReviewSchedule: problemData.reviewSchedule,
      Difficulty: problemData.difficulty || 0,
      AttemptStats: {
        TotalAttempts: 0,
        SuccessfulAttempts: 0,
        UnsuccessfulAttempts: 0,
      },
      Tags: problemData.tags || [],
    };

    console.log("Adding problem:", problem);

    const request = objectStore.add(problem);
    request.onsuccess = async function () {
      console.log("Problem added successfully:", problem);

      const attemptData = {
        id: attemptId,
        ProblemID: problemId,
        Success: problemData.success,
        AttemptDate: problemData.date,
        TimeSpent: Number(problemData.timeSpent),
        Difficulty: problemData.difficulty || 0,
        Comments: problemData.comments || "",
        BoxLevel: 1,
        NextReviewDate: null,
        SessionID: session.id,
      };

      // Add the attempt to the database
      try {
        await addAttempt(attemptData);

        console.log("Attempt and problem added successfully.");
        sendResponse({
          backgroundScriptData: "Problem and attempt added successfully",
        });
      } catch (error) {
        console.error("Error adding attempt:", error);
        sendResponse({
          backgroundScriptData: "Error adding the attempt",
        });
      }
    };

    request.onerror = function (event) {
      console.error(
        "Error adding problem to the database:",
        event.target.error
      );
      sendResponse({
        backgroundScriptData: "Problem not added to the database",
      });
    };
  } catch (error) {
    console.error("Error in addProblem function:", error);
    sendResponse({
      backgroundScriptData: "Unexpected error in addProblem function",
    });
  }
}

async function saveUpdatedProblem(updatedProblem) {
  const db = await getDatabase();
  const transaction = db.transaction(["problems"], "readwrite");
  const objectStore = transaction.objectStore("problems");

  return new Promise((resolve, reject) => {
    const request = objectStore.put(updatedProblem);

    request.onsuccess = () => {
      resolve(updatedProblem);
    };

    request.onerror = (event) => {
      reject(event.target.errorCode);
    };
  });
}

async function getMostRecentLimit() {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["limits"], "readonly");
    const store = transaction.objectStore("limits");
    const request = store.openCursor(null, "prev");

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        console.log(cursor.value);
        resolve(cursor.value); // The most recent limit
      } else {
        resolve(null); // No entries in the store
      }
    };

    request.onerror = () => reject(request.error);
  });
}

async function getAllAttempts() {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["attempts"], "readonly");
    const objectStore = transaction.objectStore("attempts");
    const keyRequest = objectStore.getAll();

    keyRequest.onsuccess = async () => {
      console.log("all attempts", keyRequest.result);
      resolve(keyRequest.result);
    };

    keyRequest.onerror = (event) => reject(event.target.errorCode);
  });
}

async function addLimit(limit) {
  const db = await getDatabase();
  // Check if the limit for the current week already exists
  const existingLimit = await getMostRecentLimit();
  const transaction = db.transaction(["limits"], "readwrite");
  const store = transaction.objectStore("limits");

  return new Promise((resolve, reject) => {
    if (
      existingLimit &&
      new Date(existingLimit.createdAt) > new Date(limit.createdAt)
    ) {
      console.log("Limit for the current week already exists");
      resolve(existingLimit); // Resolve with existing limit if it's already up to date
      return;
    }

    const request = store.put(limit); // Using put to update if it exists, or add if it doesn't

    request.onsuccess = () => resolve(limit);
    request.onerror = (event) => reject(event.target.errorCode);
  });
}

async function getMostRecentSession() {
  const db = await getDatabase(); // Assume openDatabase() opens your IndexedDB
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["limits"], "readonly");
    const objectStore = transaction.objectStore("limits");
    const request = objectStore.openCursor(null, "prev"); // 'prev' for the most recent item
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        resolve(cursor.value); // The most recent value
      } else {
        resolve(null); // No entries in the store
      }
    };
    request.onerror = () => reject(request.error);
  });
}

function determineRating(ratings) {
  const ratingCounts = ratings.reduce((acc, rating) => {
    acc[rating] = (acc[rating] || 0) + 1;
    return acc;
  }, {});

  const maxCount = Math.max(...Object.values(ratingCounts));
  const modes = Object.keys(ratingCounts).filter(
    (rating) => ratingCounts[rating] === maxCount
  );

  if (modes.length === 1) {
    return modes[0];
  }

  // If there's a tie, return the lowest evaluated value
  if (modes.includes("Easy")) return "Easy";
  if (modes.includes("Medium")) return "Medium";
  return "Hard";
}

async function updateProblemsWithRatings() {
  const db = await getDatabase();

  const problems = await fetchAllFromStore(db, "problems");
  const attempts = await fetchAllFromStore(db, "attempts");

  const problemRatings = adjustProblemRatings(attempts);

  const updatedProblems = await Promise.all(
    problems.map(async (problem) => {
      const problemID = problem.id;
      const rating = await determineRating(problemRatings[problemID]);
      return {
        ...problem,
        Rating: rating, // Assuming first rating for simplicity
      };
    })
  );

  await saveAllToStore(db, "problems", updatedProblems);

  const mostRecentLimit = await getMostRecentLimit();
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0); // Normalize current date to start of day
  console.log(
    "old",
    new Date(mostRecentLimit.CreatedAt).getTime(),
    "new",
    currentDate.getTime() - 7 * 24 * 60 * 60 * 1000
  );
  console.log(
    "equality ",
    new Date(mostRecentLimit.CreatedAt).getTime() <
      currentDate.getTime() - 7 * 24 * 60 * 60 * 1000
  );

  if (
    !mostRecentLimit ||
    new Date(mostRecentLimit.CreatedAt).getTime() <
      currentDate.getTime() - 7 * 24 * 60 * 60 * 1000
  ) {
    const newLimits = await calculateLimits(attempts, db);
    await addLimit(newLimits);
    console.log("New limits added:", newLimits);
  } else {
    console.log(
      "Most recent limit is less than one week old. No need to calculate new limits."
    );
  }
}

async function fetchAllFromStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = function (event) {
      resolve(event.target.result);
    };

    request.onerror = function (event) {
      reject("Error fetching from store: " + event.target.errorCode);
    };
  });
}

async function saveAllToStore(db, storeName, items) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);

    items.forEach((item) => {
      const request = store.put(item);
      request.onerror = function (event) {
        reject("Error saving to store: " + event.target.errorCode);
      };
    });

    transaction.oncomplete = function () {
      resolve();
    };

    transaction.onerror = function (event) {
      reject("Transaction error: " + event.target.errorCode);
    };
  });
}

function adjustProblemRatings(attempts) {
  const problemAttempts = {};

  attempts.forEach((attempt) => {
    const { ProblemID, TimeSpent } = attempt;
    if (!problemAttempts[ProblemID]) {
      problemAttempts[ProblemID] = [];
    }
    problemAttempts[ProblemID].push(parseFloat(TimeSpent));
  });

  const problemRatings = {};
  Object.keys(problemAttempts).forEach((ProblemID) => {
    const times = problemAttempts[ProblemID];
    const { mean, stddev } = calculateStatistics(times);

    const ratings = times.map((time) => {
      if (time < mean - stddev) return "Easy";
      if (time > mean + stddev) return "Hard";
      return "Medium";
    });

    problemRatings[ProblemID] = ratings;
  });

  return problemRatings;
}

//// last updated
function calculateStatistics(times) {
  const mean = times.reduce((acc, val) => acc + val, 0) / times.length;
  const variance =
    times.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / times.length;
  const stddev = Math.sqrt(variance);
  return { mean, stddev };
}
function calculateLimit(times, idealLimit) {
  if (times.length === 0) {
    return idealLimit;
  }

  const mode = getMode(times);
  if (mode !== null) {
    return mode;
  }

  const average = times.reduce((acc, val) => acc + val, 0) / times.length;
  return average;
}

function getMode(times) {
  const frequency = {};
  let maxFreq = 0;
  let mode = null;

  times.forEach((time) => {
    frequency[time] = (frequency[time] || 0) + 1;
    if (frequency[time] > maxFreq) {
      maxFreq = frequency[time];
      mode = time;
    }
  });

  // Check if mode is unique
  const modes = Object.keys(frequency).filter(
    (time) => frequency[time] === maxFreq
  );
  if (modes.length === 1) {
    return mode;
  }

  return null;
}
async function calculateLimits(attempts, db) {
  const buffer = 5; // Example buffer, can be adjusted
  const idealLimits = { easy: 15, medium: 20, hard: 30 }; // Ideal times in minutes

  const newLimits = setTimeLimits(
    attempts,
    adjustProblemRatings(attempts),
    idealLimits
  );
  console.log("newLimits", newLimits);
  const limitObject = {
    id: uuidv4(),
    CreatedAt: new Date().toISOString(),
    Easy: Math.max(newLimits.easy + buffer, idealLimits.easy),
    Medium: Math.max(newLimits.medium + buffer, idealLimits.medium),
    Hard: Math.max(newLimits.hard + buffer, idealLimits.hard),
  };

  await saveAllToStore(db, "limits", [limitObject]);

  return limitObject;
}

function setTimeLimits(attempts, ratings, idealLimits) {
  const limits = { easy: [], medium: [], hard: [] };
  const counts = { Easy: 0, Medium: 0, Hard: 0 };

  attempts.forEach((attempt) => {
    const { ProblemID, TimeSpent } = attempt;
    const rating = determineRating(ratings[ProblemID]);
    limits[rating] += parseFloat(TimeSpent);
    counts[rating]++;
  });

  return {
    easy: calculateLimit(limits.easy, idealLimits.easy),
    medium: calculateLimit(limits.medium, idealLimits.medium),
    hard: calculateLimit(limits.hard, idealLimits.hard),
  };
}

function summarizeAttempts(attempts) {
  const problems = attempts.map((a) => a.ProblemID);
  const successCount = attempts.filter((a) => a.Success).length;
  const successRate = (successCount / attempts.length) * 100;
  const totalTime = attempts.reduce(
    (sum, a) => sum + parseInt(a.TimeSpent, 10),
    0
  );

  return {
    id: uuidv4(),
    Date: attempts[0].AttemptDate.slice(0, 10), // Use the date as SessionID
    ProblemIDs: [...new Set(problems)], // Unique Problem IDs
    SuccessRate: successRate,
    TotalTime: totalTime,
    ReviewTime: 0, // Placeholder
    AvgHandleTime: 0, // Placeholder
  };
}

// async function addSession(sessionData) {
//   const db = await getDatabase();
//   const transaction = db.transaction(["sessions"], "readwrite");
//   const objectStore = transaction.objectStore("sessions");
//   const request = objectStore.add(sessionData);

//   return new Promise((resolve, reject) => {
//     request.onsuccess = () => {
//       resolve(sessionData);
//     };

//     request.onerror = (event) => {
//       reject(event.target.errorCode);
//     };
//   });
// }

// async function updateSession() {
//   const db = await getDatabase();
//   const start = new Date(2023, 8, 5);
//   const end = new Date(2024, 2, 25);

//   let currentDate = new Date(start);

//   while (currentDate <= end) {
//     try {
//       const sessionData = await getSessionDataForDate(currentDate);
//       console.log("sessionData2", sessionData);
//     } catch (error) {
//       console.log(
//         "Error getting session data for date",
//         currentDate.toISOString().slice(0, 10),
//         error
//       );
//     }
//     if (sessionData) {
//       try {
//         await addSession(sessionData);
//       } catch (error) {
//         console.error(
//           `Error adding session data for date ${currentDate
//             .toISOString()
//             .slice(0, 10)}`,
//           error
//         );
//       }
//     }
//     currentDate.setDate(currentDate.getDate() + 1);
//   }
// }

async function getSessionDataForDate(date) {
  const db = await getDatabase();
  const transaction = db.transaction(["attempts"], "readonly");
  const attemptStore = transaction.objectStore("attempts");
  const index = attemptStore.index("by_date");

  // Formatting date for keyRange
  let dayStart = new Date(date).setHours(0, 0, 0, 0);
  dayStart = new Date(dayStart).toISOString().slice(0, 10);
  let dayEnd = new Date(date).setHours(23, 59, 59, 999);
  dayEnd = new Date(dayEnd).toISOString().slice(0, 10) + "T23:59:59.999Z";

  const keyRange = IDBKeyRange.bound(dayStart, dayEnd);
  const cursorRequest = index.openCursor(keyRange);
  a;

  const attempts = [];

  return new Promise((resolve, reject) => {
    cursorRequest.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        attempts.push(cursor.value);
        cursor.continue();
      } else {
        // No more entries, summarize attempts for this day
        if (attempts.length > 0) {
          const sessionData = summarizeAttempts(attempts);
          console.log("sessionData", sessionData);
          resolve(sessionData);
        } else {
          resolve(null); // No attempts for this day
        }
      }
    };

    cursorRequest.onerror = (event) => {
      reject(event.target.errorCode);
    };
  });
}
async function getProblemsGroupedByBoxLevel(limit) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["problems"], "readonly");
    const objectStore = transaction.objectStore("problems");
    const cursorRequest = objectStore.openCursor();
    const groupedProblems = {};

    cursorRequest.onsuccess = function (event) {
      const cursor = event.target.result;
      if (cursor) {
        const { BoxLevel } = cursor.value;
        if (
          (limit === "upper" && BoxLevel >= 4) ||
          (limit === "lower" && BoxLevel <= 4)
        ) {
          if (!groupedProblems[BoxLevel]) {
            groupedProblems[BoxLevel] = [];
          }
          groupedProblems[BoxLevel].push(cursor.value);
        }
        cursor.continue();
      } else {
        // Finished iterating through all records
        resolve(groupedProblems);
      }
    };

    cursorRequest.onerror = function (event) {
      console.log(
        "Error in fetching problems by box level: ",
        event.target.errorCode
      );
      reject(event.target.errorCode);
    };
  });
}
async function evaluateAttempts(problem) {
  const db = await getDatabase();
  const problemId = problem.id;
  console.log(
    "evaluateAttempt 459 -problemid and problem ",
    problemId,
    problem
  );

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["attempts"], "readonly");
    const attemptStore = transaction.objectStore("attempts");
    const index = attemptStore.index("by_problem_and_date");
    let startDate = new Date(2022, 0, 1);
    let endDate = new Date();
    console.log("evaluateAttempts 467 - startDate", startDate.toISOString());
    console.log("evaluateAttempts 468 - endDate", endDate.toISOString());
    const range = IDBKeyRange.bound(
      [problemId, startDate.toISOString()],
      [problemId, endDate.toISOString()],
      false,
      false
    );
    const cursorRequest = index.openCursor(range, "prev");
    const attempts = [];
    let LA = null;

    cursorRequest.onsuccess = async (event) => {
      // Marked this callback as async
      const cursor = event.target.result;
      if (cursor) {
        if (!LA) {
          console.log("xxx 484 - cursor.value", cursor.value);
          LA = cursor.value;
        }

        attempts.push(cursor.value);
        cursor.continue();
      } else {
        console.log(
          "evaluateAttempts  484 - attempts",
          attempts,
          attempts.sort(
            (a, b) => new Date(b.AttemptDate) - new Date(a.AttemptDate)
          )
        );
        let tempProblem = reassessBoxLevel(problem, attempts);
        console.log(
          "evaluateAttempts  484 - tempProblem and problem ",
          tempProblem,
          problem
        );
        let updatedProblem = await calculateLeitnerBox(tempProblem, LA);
        console.log("evaluateAttempts  487 - updatedProblem", updatedProblem);
        resolve(updatedProblem);
      }
    };
    cursorRequest.onerror = (event) => {
      console.error(
        "evaluateAttempts  493 - Error in evaluating attempts for problem ID " +
          problemId,
        event.target.errorCode
      );
      reject(event.target.errorCode);
    };
  });
}

function reassessBoxLevel(problem, Attempts) {
  Attempts.sort((a, b) => new Date(a.AttemptDate) - new Date(b.AttemptDate));

  let stats = {
    TotalAttempts: 0,
    SuccessfulAttempts: 0,
    UnsuccessfulAttempts: 0,
  };
  // Define box intervals and thresholds
  const boxIntervals = [1, 3, 7, 14, 30, 60, 90, 120];

  const FAILURE_THRESHOLD = 3;
  const COOLDOWN_REVIEW_INTERVAL = 3;

  // Initialize variables for box level calculation
  let currentBoxLevel = 1; // Starting from the first level
  let consecutiveFailures = 0;

  let avgDifficulty = 0;
  // Loop through individual attempts if needed for detailed assessment
  for (const attempt of Attempts) {
    avgDifficulty += attempt.Difficulty;
    stats.TotalAttempts++;
    attempt.Success ? stats.SuccessfulAttempts++ : stats.UnsuccessfulAttempts++;
    if (attempt.Success) {
      consecutiveFailures = 0; // Reset on success
      currentBoxLevel = Math.min(currentBoxLevel + 1, boxIntervals.length); // Increase box level, capped at array length
    } else {
      consecutiveFailures++; // Increment on failure
      if (consecutiveFailures >= FAILURE_THRESHOLD) {
        currentBoxLevel = Math.max(currentBoxLevel - 1, 1); // Decrease box level, not less than 1
        consecutiveFailures = 0; // Reset failures after box level decrease
      }
    }
  }

  console.log("ReassessBoxLevel 536 - stats", stats);
  console.log("ReassessBoxLevel 537 - currentBoxLevel", currentBoxLevel);
  // Use aggregate stats to update attempts and determine cooldown status
  problem.AttemptStats = {
    TotalAttempts: stats.TotalAttempts,
    SuccessfulAttempts: stats.SuccessfulAttempts,
    UnsuccessfulAttempts: stats.UnsuccessfulAttempts,
  };
  // Determine the cooldown status based on the aggregate stats or other criteria
  problem.CooldownStatus =
    consecutiveFailures >= FAILURE_THRESHOLD ||
    problem.AttemptStats.UnsuccessfulAttempts >= FAILURE_THRESHOLD;
  //console.log("ReassessBoxLevel 515 - consecutiveFailures", consecutiveFailures);
  // Update box level and review schedule
  problem.BoxLevel = currentBoxLevel;
  let nextReviewDays = boxIntervals[currentBoxLevel - 1];
  if (problem.CooldownStatus) {
    nextReviewDays = Math.max(nextReviewDays, COOLDOWN_REVIEW_INTERVAL);
    // console.log("ReassessBoxLevel 521 - nextReviewDays", nextReviewDays);
  }
  const nextReviewDate = new Date(problem.lastAttemptDate);
  console.log(
    "ReassessBoxLevel 557 - nextReviewDate",
    nextReviewDate,
    nextReviewDays,
    nextReviewDate.getDate()
  );
  nextReviewDate.setDate(nextReviewDate.getDate() + nextReviewDays);
  problem.ReviewSchedule = nextReviewDate.toISOString();

  console.log("ConsecutiveFailures", consecutiveFailures);
  problem.ConsecutiveFailures = consecutiveFailures;
  problem.Difficulty = avgDifficulty;

  console.log("ReassessBoxLevel 526 - nextReviewDate", nextReviewDate);
  console.log("ReassessBoxLevel 527 - problem", problem);
  // Return the updated problem object
  return problem;
}

async function calculateLeitnerBox(
  problem,
  attemptData,
  useTimeLimits = false
) {
  console.log("CalculateLeitnerBox 552 - attemptData", attemptData);

  // Conditional time limits
  let exceededTimeLimit = false;
  if (useTimeLimits) {
    const timeLimitsByDifficulty = {
      1: 15, // 15 minutes for difficulty 1
      2: 25, // 25 minutes for difficulty 2
      3: 35, // 35 minutes for difficulty 3
    };
    const allowedTime =
      timeLimitsByDifficulty[
        attemptData.Difficulty / problem.AttemptStats.TotalAttempts
      ];
    exceededTimeLimit = attemptData.TimeSpent > allowedTime;
  }

  // Use the problem ID to get attempt statistics for this specific problem
  const problemId = problem.id; // Replace with the actual property name if different
  // Now awaiting the evaluateAttempts if problem.AttemptStats is not defined
  //let tempproblem = await evaluateAttempts(problem);

  let AttemptStats = problem.AttemptStats;

  console.log("CalculateLeitnerBox 573 - AttemptStats ", AttemptStats);

  const FAILURE_THRESHOLD = 3;
  const COOLDOWN_REVIEW_INTERVAL = 3;
  const TotalAttempts = AttemptStats.TotalAttempts || 0;
  const SuccessRate =
    AttemptStats.SuccessfulAttempts / AttemptStats.TotalAttempts;

  const boxIntervals = [1, 3, 7, 14, 30, 45, 60, 90];
  // Adjust next review date

  // Penalty rate logic here, if needed

  AttemptStats.TotalAttempts++;

  if (attemptData.Success || (problem.CooldownStatus && attemptData.Success)) {
    problem.CooldownStatus = false;
    problem.ConsecutiveFailures = 0;
    AttemptStats.SuccessfulAttempts++;
    problem.BoxLevel = exceededTimeLimit
      ? Math.max(problem.BoxLevel, 1)
      : Math.min(problem.BoxLevel + 1, boxIntervals.length - 1);
  } else {
    problem.ConsecutiveFailures++;
    AttemptStats.UnsuccessfulAttempts++;

    if (problem.ConsecutiveFailures >= FAILURE_THRESHOLD) {
      problem.CooldownStatus = true;
      problem.BoxLevel = Math.max(problem.BoxLevel - 1, 1);
    }
  }
  let nextReviewDays = boxIntervals[problem.BoxLevel];
  console.log("CalculateLeitnerBox 606 - nextReviewDay", nextReviewDays);
  if (problem.CooldownStatus) {
    nextReviewDays = Math.max(nextReviewDays, COOLDOWN_REVIEW_INTERVAL);
  } else {
  }

  problem.Difficulty += attemptData.Difficulty;
  problem.lastAttemptDate = attemptData.AttemptDate;
  problem.AttemptStats = AttemptStats;
  const nextReviewDate = new Date(attemptData.AttemptDate);
  console.log("CalculateLeitnerBox 614 - nextReviewDate", nextReviewDate);
  console.log(
    "CalculateLeitnerBox 615- type of nextReviewDate",
    typeof nextReviewDate,
    nextReviewDate.getDate(),
    attemptData.AttemptDate
  );
  nextReviewDate.setDate(nextReviewDate.getDate() + nextReviewDays);
  console.log(nextReviewDate.getDate(), nextReviewDays);
  // console.log("CalculateLeitnerBox 618 - nextReviewDate", nextReviewDate);
  problem.ReviewSchedule = nextReviewDate.toISOString();
  //console.log("CalculateLeitnerBox 620 - nextReviewDate", nextReviewDate);
  //console.log("CalculateLeitnerBox 621 - nextReviewDays", nextReviewDays);
  console.log("CalculateLeitnerBox 622 - problem", problem);
  console.log(
    "CalculateLeitnerBox 623 - review schedule",
    problem.ReviewSchedule
  );

  return problem;
}

async function updateProblemsWithAttemptStats() {
  const problems = await getAllProblems();
  // console.log("problems 590", problems);
  for (const problem of problems) {
    // Call evaluateAttempts for each problem
    const updatedProblem = await evaluateAttempts(problem);

    //console.log("updateProblemsWithAttemptStats", updatedProblem);
    await saveUpdatedProblem(updatedProblem);
  }
}

// fetching the leetcode ID from the database if not it fetches Id and tags from chatgpt
async function getProblemByDescription(description) {
  try {
    const db = await getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["problems"], "readonly");
      const objectStore = transaction.objectStore("problems");
      const index = objectStore.index("by_ProblemDescription");
      console.log("description", description.toLowerCase());
      const request = index.get(description.toLowerCase());

      request.onsuccess = (event) => {
        const result = event.target.result;
        if (result) {
          resolve(result); // Return the entire problem object
        } else {
          resolve(null); // No match found
        }
      };

      request.onerror = (event) => {
        reject("Failed to retrieve the problem: " + event.target.error);
      };
    });
  } catch (error) {
    console.error("Error in getProblemByDescription:", error);
    throw error;
  }
}

async function getLeetCodeIDAndTags(description, title) {
  try {
    const db = await getDatabase();
    const problem = await new Promise((resolve, reject) => {
      const transaction = db.transaction(["standard_problems"], "readonly");
      const objectStore = transaction.objectStore("standard_problems");
      const index = objectStore.index("by_slug");
      const request = index.get(description);

      request.onsuccess = (event) => {
        const problem = event.target.result;
        if (problem) {
          console.log("Found problem in standard_problems:", problem);
          resolve({
            LeetCodeID: problem.id,
            Description: problem.title.toLowerCase(),
            Tags: problem.tags,
          });
        } else {
          resolve(null); // No match found in standard_problems
        }
      };

      request.onerror = (event) => {
        console.error("Error querying standard_problems:", event.target.error);
        reject("Failed to retrieve the problem: " + event.target.error);
      };
    });

    if (problem) {
      return problem;
    } else {
      console.log(
        "Problem not found in standard_problems, querying ChatGPT..."
      );
      // Call ChatGPT to fetch data if no result is found in the database
      const chatGPTResult = await fetchLeetCodeIDAndTagsFromChatGPT(title);

      if (chatGPTResult) {
        console.log("ChatGPT fetched data:", chatGPTResult);
        return chatGPTResult;
      } else {
        console.warn("No result from ChatGPT for description:", description);
        return null;
      }
    }
  } catch (error) {
    console.error("Error in getLeetCodeIDAndTags:", error);
    throw error;
  }
}

async function fetchLeetCodeIDAndTagsFromChatGPT(title) {
  console.log("fetchLeetCodeIDAndTagsFromChatGPT 1955 - title", title);
  try {
    const response = await fetch("http://localhost:3000/fetch-tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    console.log("response", response);
    if (response.ok) {
      const data = await response.json();

      let values = data.results;
      console.log("data", data);
      Object.keys(values).forEach((key) => {
        console.log(key, values[key]);
      });
      // Extract the LeetCode ID and tagsList directly from the response
      if (values["LeetCodeID"] && values["Tags"] && values["Description"]) {
        return {
          LeetCodeID: values["LeetCodeID"],
          Description: values["Description"],
          Tags: values["Tags"],
        };
      } else {
        throw new Error("Invalid response structure from ChatGPT.");
      }
    } else {
      console.error(
        "Error fetching LeetCode ID and tags from ChatGPT:",
        response.statusText
      );
      return null;
    }
  } catch (error) {
    console.error("Error during ChatGPT API call:", error);
    throw error;
  }
}

async function validateGraph(db) {
  const transaction = db.transaction(
    ["standard_problems", "problem_relationships"],
    "readonly"
  );
  const problemsStore = transaction.objectStore("standard_problems");
  const relationshipsStore = transaction.objectStore("problem_relationships");

  const problemsRequest = problemsStore.getAll();
  const relationshipsRequest = relationshipsStore.getAll();

  const [problems, relationships] = await Promise.all([
    new Promise(
      (resolve) =>
        (problemsRequest.onsuccess = () => resolve(problemsRequest.result))
    ),
    new Promise(
      (resolve) =>
        (relationshipsRequest.onsuccess = () =>
          resolve(relationshipsRequest.result))
    ),
  ]);

  console.log(`Total problems in store: ${problems.length}`);
  console.log(`Total relationships in graph: ${relationships.length}`);

  // Sample validation
  relationships.forEach((rel) => {
    const problem1 = problems.find((p) => p.id === rel.problemId1);
    const problem2 = problems.find((p) => p.id === rel.problemId2);
    if (!problem1 || !problem2) {
      console.error(`Invalid relationship found:`, rel);
    }
  });

  console.log("Graph validation completed.");
}

async function addAttempt(attemptData) {
  try {
    const db = await getDatabase();

    // Retrieve the active session from Chrome storage
    let session = await new Promise((resolve) => {
      chrome.storage.local.get(["currentSession"], (result) => {
        resolve(result.currentSession || null);
      });
    });

    // If no active session, call getOrCreateSession
    if (!session) {
      console.log(
        "No active session found. Creating or retrieving a session..."
      );
      session = await getOrCreateSession(); // Create or fetch a session
      await saveSessionToStorage(session); // Save the session to Chrome storage
    }

    console.log("Active session:", session);

    // Add the session ID to the attempt data
    attemptData.SessionID = session.id;

    // Retrieve the problem
    let problem = await getProblem(attemptData.ProblemID);

    if (!problem) {
      console.error("AddAttempt: Problem not found");
      return { error: "Problem not found." };
    }

    // Update the Leitner box for the problem
    problem = await calculateLeitnerBox(problem, attemptData);
    // Add or update the problem in the session
    let updatedSession = addOrUpdateProblemInSession(
      session,
      problem,
      attemptData.id
    );
    console.log("updatedSession", updatedSession);
    // Save the updated session to Chrome storage
    await saveSessionToStorage(updatedSession, true);

    const transaction = db.transaction(
      ["problems", "attempts", "sessions"],
      "readwrite"
    );
    const problemStore = transaction.objectStore("problems");
    const attemptStore = transaction.objectStore("attempts");
    const sessionStore = transaction.objectStore("sessions");

    // Save the attempt
    const record = createAttemptRecord(attemptData);
    await new Promise((resolve, reject) => {
      const putAttemptRequest = attemptStore.put(record);
      putAttemptRequest.onsuccess = resolve;
      putAttemptRequest.onerror = () => reject(putAttemptRequest.error);
    });

    // Update the problem in the database
    await new Promise((resolve, reject) => {
      const updateProblemRequest = problemStore.put(problem);
      updateProblemRequest.onsuccess = resolve;
      updateProblemRequest.onerror = () => reject(updateProblemRequest.error);
    });

    // Add the attempt to the session's attempts list
    if (!session.attempts) session.attempts = [];
    session.attempts.push({
      attemptId: record.id,
      problemId: attemptData.ProblemID,
      success: record.Success,
      timeSpent: record.TimeSpent,
    });

    // Update the session in the database
    await new Promise((resolve, reject) => {
      const updateSessionRequest = sessionStore.put(session);
      updateSessionRequest.onsuccess = resolve;
      updateSessionRequest.onerror = () => reject(updateSessionRequest.error);
    });

    // Check if the session is completed
    await checkAndCompleteSession(session.id);

    console.log("Attempt added and problem updated successfully");
    return { message: "Attempt added and problem updated successfully" };
  } catch (error) {
    console.error("Error in addAttempt function:", error);
    throw error;
  }
}

function createAttemptRecord(attemptData) {
  return {
    id: attemptData.id,
    SessionID: attemptData.SessionID,
    ProblemID: attemptData.ProblemID,
    Success: attemptData.Success,
    AttemptDate: attemptData.AttemptDate,
    TimeSpent: Number(attemptData.TimeSpent),
    Difficulty: attemptData.Difficulty,
    Comments: attemptData.Comments || "",
  };
}

chrome.action.onClicked.addListener((tab) => {
  // Open your React application in a new tab
  chrome.tabs.create({ url: "app.html" });
});

// let activeRequests = {};
//  chrome.storage.local.set({ "/Timer": false }, () => {
//         console.log("Data set");

//       });
let activeRequests = {};
let requestQueue = [];
let isProcessing = false;

const processNextRequest = () => {
  if (requestQueue.length === 0) {
    isProcessing = false;
    return;
  }

  isProcessing = true;
  const { request, sender, sendResponse } = requestQueue.shift();

  handleRequest(request, sender, sendResponse).finally(() => {
    processNextRequest();
  });
};

const handleRequest = async (request, sender, sendResponse) => {
  const requestId = `${request.type}-${sender.tab?.id || "background"}`;

  if (activeRequests[requestId]) {
    console.log("Request already in progress; waiting for it to finish...");
    return; // Changed from 'return true;' to 'return;' to prevent early termination
  }

  activeRequests[requestId] = true;

  const finishRequest = () => {
    delete activeRequests[requestId];
    processNextRequest();
  };

  try {
    console.log("Processing request:", request);
    switch (request.type) {
      case "navigate":
        if (request.route === "/Timer") {
          console.log("Navigating to /Timer");
          chrome.storage.local.get(request.route, (result) => {
            console.log("result", result);
            chrome.storage.local.set({ "/Timer": !result }, () => {
              console.log("result value ", !result);
              sendResponse({ result: "success" });
              finishRequest();
            });
          });
          return true; // Ensure the async response is returned properly
        }

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (!tabs.length) {
            console.error("No active tab found");
            sendResponse({ result: "error", message: "No active tab found" });
            finishRequest();
            return;
          }

          const tab = tabs[0];
          chrome.tabs.sendMessage(
            tab.id,
            { navigate: true, route: request.route, time: request.time },
            (response) => {
              if (chrome.runtime.lastError) {
                console.error("Message failed:", chrome.runtime.lastError);
                sendResponse({
                  result: "error",
                  message: "Message failed to send",
                });
              } else if (!response || response.result !== "success") {
                console.error("Navigation failed in content script");
                sendResponse({
                  result: "error",
                  message: "Navigation failed in content script",
                });
              } else {
                console.log("Message sent successfully:", response);
                sendResponse({ result: "success" });
              }
              finishRequest(); // Ensure finishRequest is called here
            }
          );
        });
        return true;

      case "countProblemsByBoxLevel":
        const db = await dbHelper.openDB();
        getProblemsGroupedByBoxLevel("lower")
          .then((groupedProblems) => {
            console.log("groupedProblems", groupedProblems);
          })
          .catch((error) => {
            console.log("Error getting problems grouped by box level:", error);
            sendResponse({
              status: "error",
              message: "Failed to get problems grouped by box level",
            });
          });
        getDatabase()
          .then((db) => {
            console.log("Database obtained:", db);
            return countProblemsByBoxLevel();
          })
          .then((boxLevelCounts) => {
            sendResponse({ status: "success", data: boxLevelCounts });
            finishRequest();
          })
          .catch((error) => {
            console.error("Error counting problems by box level:", error);
            sendResponse({
              status: "error",
              message: "Failed to count problems by box level",
            });
            finishRequest();
          });

        return true;

      case "setStorage":
        chrome.storage.local.set(
          { [request.key]: { value: request.value, problem: request.problem } },
          () => {
            sendResponse("Data set");

            finishRequest();
          }
        );
        return true;

      case "getProblemByDescription":
        console.log(
          "Received request to get problem for:",
          request.title.toLowerCase()
        );

        // Ensure database setup and relationships are complete
        (async () => {
          try {
            const db = await getDatabase();

            // // Build relationships after the database is initialized
            // await buildRelationships(db);

            // console.log(
            //   "Database setup complete. Proceeding with the request."
            // );

            // Proceed with retrieving the problem
            getProblemByDescription(request.title.toLowerCase())
              .then((problem) => {
                if (problem) {
                  console.log("Found problem in database:", problem);
                  sendResponse(problem);
                } else {
                  console.log("No problem found in database.");
                  sendResponse({ error: "Failed to retrieve problem" });
                }
              })
              .catch((error) => {
                console.error("Error retrieving problem:", error);
                sendResponse({ error: "Failed to retrieve problem" });
              })
              .finally(finishRequest);
          } catch (error) {
            console.error("Error setting up the database:", error);
            sendResponse({ error: "Database setup failed" });
            finishRequest();
          }
        })();

        // Return true to indicate that the response will be sent asynchronously
        return true;

      case "getFromStandardProblems":
        console.log("Received request to call ChatGPT");
        getLeetCodeIDAndTags(request.description, request.title)
          .then((result) => {
            console.log("Retrieved LeetCode ID and tags from ChatGPT:", result);
            sendResponse(result);
          })
          .catch((error) => {
            console.error(
              "Error retrieving LeetCode ID and tags from ChatGPT:",
              error
            );
            sendResponse({
              error: "Failed to retrieve LeetCode ID and tags from ChatGPT",
            });
          })
          .finally(finishRequest);
        return true;

      case "getStorage":
        if (request.key) {
          chrome.storage.local.get([request.key], (result) => {
            sendResponse(result[request.key] || null);
          });
          finishRequest();
        } else {
          finishRequest();
        }
        return true;

      case "removeStorage":
        if (request.key) {
          chrome.storage.local.remove(request.key, () => {
            sendResponse(`${request.key} removed`);
            finishRequest();
          });
        } else {
          finishRequest();
        }
        return true;
      // User settings getter and setter
      case "setSettings":
        chrome.storage.local.set({ settings: request.message }, () => {
          sendResponse({ status: "success" });
        });
        finishRequest();
        return true; // Keep the messaging channel open for async response

      case "getSettings":
        chrome.storage.local.get(["settings"], (result) => {
          console.log("result", result);
          if (!result.settings) {
            const defaultSettings = {
              theme: "light",
              sessionLength: 5,
              limit: "off",
              reminder: { value: false, label: "6" },
              numberofNewProblemsPerSession: 2,
              // add more default settings as needed
            };
            console.log("defaultSettings", defaultSettings);
            chrome.storage.local.set({ settings: defaultSettings });
          }
          sendResponse(result.settings);
        });
        finishRequest();
        return true;

      case "addProblem":
        checkDatabaseForProblem(Number(request.contentScriptData.leetCodeID))
          .then((result) => {
            if (result) {
              const attemptData = {
                id: uuidv4(),
                ProblemID: result,
                AttemptDate: request.contentScriptData.date,
                Success: request.contentScriptData.success,
                TimeSpent: request.contentScriptData.timeSpent,
                Difficulty: request.contentScriptData.difficulty,
                Comments: request.contentScriptData.comments,
              };
              return addAttempt(attemptData);
            } else {
              return addProblem(request.contentScriptData, sendResponse).then(
                () =>
                  sendResponse({
                    backgroundScriptData:
                      "Attempt and problem added successfully",
                  })
              );
            }
          })
          .then(() =>
            sendResponse({ backgroundScriptData: "Attempt added successfully" })
          )
          .catch((error) => {
            console.error("Error adding problem and attempt:", error);
            sendResponse({
              backgroundScriptData:
                "There was an error adding the problem and attempt",
            });
          });
        finishRequest();
        return true;

      case "getAllProblems":
        getAllProblems()
          .then((problems) => {
            sendResponse({ problems });
          })
          .catch((error) => {
            sendResponse({ error });
          });
        finishRequest();
        return true;
      case "getSession":
        console.log(
          "request.contentScriptData.getSession",
          request.contentScriptData.getSession
        );
        getOrCreateSession(request.contentScriptData.getSession)
          .then((session) => {
            sendResponse({
              backgroundScriptData: "Schedule received from content script",
              session: session,
            });
          })
          .catch((error) => {
            console.error("Error retrieving problems from Schedule:", error);
            sendResponse({
              backgroundScriptData:
                "There was an error retrieving problems from Schedule",
            });
          });
        finishRequest();
        return true;

      case "getDailyReviewSchedule":
        // updateAllProblems()
        //   .then(() => {
        //     sendResponse("update Successfull");
        //   })
        //   .catch((error) => {
        //     sendResponse({ error });
        //   });

        getOrCreateSession()
          .then((schedule) => {
            sendResponse({
              backgroundScriptData: "Schedule received from content script",
              schedule: schedule,
            });
          })
          .catch((error) => {
            console.error("Error retrieving problems from Schedule:", error);
            sendResponse({
              backgroundScriptData:
                "There was an error retrieving problems from Schedule",
            });
          });
        finishRequest();
        return true;

      case "getLimits":
        console.log("id", request.id);
        updateProblemsWithRatings()
          .then(() => getMostRecentLimit())
          .then((limit) =>
            getProblemById(parseInt(request.id)).then((problem) => ({
              problem,
              limit,
            }))
          )
          .then(({ problem, limit }) => {
            const response = {
              problem: problem,
              limit: limit,
            };
            sendResponse(response);
          })
          .catch((error) => {
            console.error("Error retrieving problem or limit:", error);
            sendResponse({
              error: "There was an error retrieving the problem or limit",
            });
          })
          .finally();

        // getProblemById(parseInt(request.id))
        //   .then((problem) => updatelimits().then((limit) => ({ problem, limit })))
        //   .then(({ problem, limit }) => {
        //     const response = {
        //       backgroundScriptData: problem || "Only limit received from content script",
        //       limit: limit,
        //     };
        //     sendResponse(response);
        //   })
        //   .catch((error) => {
        //     console.error("Error retrieving limit or problem:", error);
        //     sendResponse({ backgroundScriptData: "There was an error retrieving the problem or limit" });
        //   })

        return true;

      case "startTimer":
        startTimer();
      case "skipProblem":
        skipProblem(request.consentScriptData.LeetCodeID)
          .then(() => {
            sendResponse({ status: "success" });
          })
          .catch((error) => {
            sendResponse({ status: "error", error: error });
          });
        finishRequest();

      default:
        finishRequest();
        sendResponse({ error: "Unknown request type" });
        return false;
    }
  } catch (error) {
    console.error("Error handling request:", error);
    sendResponse({ error: "Failed to handle request" });
    finishRequest();
  }
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  requestQueue.push({ request, sender, sendResponse });

  if (!isProcessing) {
    processNextRequest();
  }

  return true;
});
