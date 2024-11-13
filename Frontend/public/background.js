import { v4 as uuidv4 } from "uuid";

let db; // Ensure this is declared at the top-most scope of your script/module.

async function getDatabase() {
  if (db) return db;

  return new Promise((resolve, reject) => {
    // Assume you're incrementing the version to trigger onupgradeneeded
    const request = indexedDB.open("review", 3);

    request.onsuccess = (event) => {
      db = event.target.result;

      // let problemStore = transaction.objectStore("problems");

      console.log("Database opened successfully");
      resolve(db); // Resolve here after successful opening
    };

    request.onerror = (event) => {
      console.error("Database error:", event.target.error);
      reject(event.target.error); // Reject on error
    };

    request.onupgradeneeded = (event) => {
      console.log("Upgrading database...");
      try {
        const db = event.target.result;

        // Use the transaction provided by the event
        const problemStore = db.objectStoreNames.contains("problems")
          ? event.target.transaction.objectStore("problems")
          : db.createObjectStore("problems", { keyPath: "id" });

        // Create the index if it doesn't already exist
        if (!problemStore.indexNames.contains("by_ProblemDescription")) {
          problemStore.createIndex(
            "by_ProblemDescription",
            "ProblemDescription",
            { unique: false }
          );
          console.log("Index 'by_ProblemDescription' created successfully");
        }

        // const problemStore = db.createObjectStore("problems", { keyPath: "id" });
        // const attemptStore = db.createObjectStore("attempts", { keyPath: "id" });
        // const sessionStore = db.createObjectStore("sessions", { keyPath: "id" });
        // const limitStore = db.createObjectStore("limits", { keyPath: "id" });
        // problemStore.createIndex("by_tag", "Tags", { multiEntry: true });
        // problemStore.createIndex("by_problem", "leetCodeID", { unique: false });
        // problemStore.createIndex("by_review", "ReviewSchedule", { unique: false });

        // attemptStore.createIndex("by_date", "AttemptDate", { unique: false });
        // attemptStore.createIndex("by_problem_and_date", ["ProblemID", "AttemptDate"], { unique: false });

        // sessionStore.createIndex("by_date", "Date", { unique: true });
        // limitStore.createIndex("by_createAt", "CreateAt", { unique: true });
      } catch (error) {
        console.error("Error during onupgradeneeded:", error);
        // Aborting the transaction in case of error can help avoid a partial upgrade state
        event.target.transaction.abort();
      }
    };
  });
}

// function parseAndCorrectJSON(input) {
//   try {
//       // Attempt to parse the JSON string directly
//       return JSON.parse(input);
//   } catch (error) {
//       console.error("Original JSON error:", error.message);

//       // Try to fix common JSON mistakes:
//       // 1. Ensure keys and string values are wrapped in double quotes
//       // 2. Remove trailing commas from arrays and objects
//       let correctedInput = input
//           .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":') // Ensure keys are in double quotes
//           .replace(/,\s*([}\]])/g, '$1'); // Remove trailing commas

//       try {
//           // Try parsing again after correction
//           return JSON.parse(correctedInput);
//       } catch (error) {
//           // If still failing, throw error or handle as needed
//           console.error("Corrected JSON error:", error.message);
//           throw new Error("JSON is incorrectly formatted and couldn't be automatically corrected.");
//       }
//   }
// }

let isFetching = false;

async function fetchTags(probArray) {
  if (isFetching) return;
  isFetching = true;
  console.log(probArray);
  try {
    const response = await fetch("http://localhost:3000/fetch-problem-id", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(probArray),
    });

    const data = await response.json();
    console.log("tags:", data);
    console.log("results", data.results);
    console.log("type of results", typeof data.results);
    if (data && data.results) {
      const tagsDictionary = data.results.map((item) => ({
        leetCodeID: item[0],
        Tags: item[2],
      }));
      await updateDatabaseWithTags(tagsDictionary);
    } else {
      console.error(
        "Error: 'results' property is missing in the response",
        data
      );
    }
  } catch (error) {
    console.error("Error creating assistant:", error);
  }
  isFetching = false;
}

async function fetchProblemsFromDB(limit = 5, offset = 0) {
  const db = await getDatabase(); // Assuming you have a function to open your DB
  const transaction = db.transaction(["problems"], "readonly");
  const store = transaction.objectStore("problems");
  const request = store.openCursor();
  const problems = [];

  return new Promise((resolve, reject) => {
    request.onsuccess = (event) => {
      let cursor = event.target.result;

      if (cursor && problems.length < limit) {
        if (offset-- <= 0) {
          if (cursor.Tags == undefined)
            problems.push({
              LeetCodeID: cursor.value.leetCodeID,
              Description: cursor.value.ProblemDescription,
            });
        }
        cursor.continue();
      } else {
        resolve(problems);
      }
    };
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

async function updateAllProblems() {
  return new Promise(async (resolve, reject) => {
    let offset = 0;
    const limit = 5;
    let continueUpdating = true;

    while (continueUpdating) {
      try {
        const problems = await fetchProblemsFromDB(limit, offset);
        console.log(
          `Fetched ${problems.length} problems from DB with offset ${offset}`
        );

        if (problems.length > 0) {
          await fetchTags(problems); // Assuming you have a function to make the API call
          console.log(`Fetched tags for problems with offset ${offset}`);
          //running the just the first batch for testing
          offset += limit; // Move to the next batch
          // continueUpdating = false;
        } else {
          continueUpdating = false; // No more problems to process
        }
      } catch (error) {
        console.error("Error updating problems:", error);
        reject(error);
        return;
      }
    }

    console.log("All problems updated successfully");
    resolve();
  });
}

async function updateDatabaseWithTags(tagsDictionary) {
  try {
    const db = await getDatabase();
    const transaction = db.transaction(["problems"], "readwrite"); // Specify your object store and transaction mode
    const store = transaction.objectStore("problems");
    const index = store.index("by_problem");

    return new Promise((resolve, reject) => {
      // Update each problem with new tags

      console.log("tagsDictionary", tagsDictionary);
      tagsDictionary.forEach((value) => {
        const leetCodeID = parseInt(value.leetCodeID);
        const Tags = value.Tags;

        const getRequest = index.get(leetCodeID);

        getRequest.onsuccess = function () {
          const data = getRequest.result;
          if (data) {
            delete data.tags;
            data.Tags = Tags;
            const putRequest = store.put(data);
            putRequest.onsuccess = function () {
              console.log(
                `Successfully updated tags for problem ${leetCodeID}`
              );
            };
            putRequest.onerror = function (e) {
              console.error(
                `Error updating problem ${leetCodeID}: `,
                e.target.error
              );
            };
          } else {
            console.log(`Problem with LeetCode ID ${leetCodeID} not found.`);
          }
        };

        getRequest.onerror = function (e) {
          console.error(
            `Error fetching problem ${leetCodeID}: `,
            e.target.error
          );
        };
      });
    });
  } catch (error) {
    console.log("updateDatabaseWithTags", error);
  }
}

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

function problemSortingCriteria(a, b) {
  // Sort by review date (earliest first)
  const reviewDateA = new Date(a.ReviewSchedule).setHours(0, 0, 0, 0);
  const reviewDateB = new Date(b.ReviewSchedule).setHours(0, 0, 0, 0);
  if (reviewDateA !== reviewDateB) {
    return reviewDateA - reviewDateB; // Earliest date first
  }

  // Sort by success rate (ascending: lowest rate first)
  const successRateA =
    a.AttemptStats.SuccessfulAttempts / a.AttemptStats.TotalAttempts;
  const successRateB =
    b.AttemptStats.SuccessfulAttempts / b.AttemptStats.TotalAttempts;
  if (successRateA !== successRateB) {
    return successRateA - successRateB; // Lowest success rate first
  }

  // Sort by the number of attempts (descending: highest number first)
  if (a.AttemptStats.TotalAttempts !== b.AttemptStats.TotalAttempts) {
    return b.AttemptStats.TotalAttempts - a.AttemptStats.TotalAttempts;
  }

  // Sort by box level (ascending: lowest level first)
  return a.BoxLevel - b.BoxLevel; // Lowest box level first
}

async function fetchProblemsForSession(sessionLength = 10) {
  const db = await getDatabase();
  let problemsDueForReview = await getDailyReviewSchedule(sessionLength);
  console.log(
    "FetchProblemsForSession 182 - problemsDueForReview",
    problemsDueForReview
  );
  if (problemsDueForReview.length < sessionLength) {
    const additionalProblemsNeeded =
      sessionLength - problemsDueForReview.length;
    const excludeIds = problemsDueForReview.map((p) => p.id);
    const additionalProblems = await fetchAdditionalProblems(
      additionalProblemsNeeded,
      excludeIds
    );
    problemsDueForReview = problemsDueForReview.concat(additionalProblems);
  }

  return problemsDueForReview.slice(0, sessionLength);
}

function isNotToday(dateString) {
  // Parse the date string
  const inputDate = new Date(dateString);

  // Reset the time to midnight for the input date
  inputDate.setHours(0, 0, 0, 0);

  // Get today's date and reset the time to midnight
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Compare the dates
  return inputDate.getTime() !== today.getTime();
}
//TODO: Pass in session length as a parameter from frontend and use it to limit the schedule length
async function getDailyReviewSchedule(sessionLength) {
  const db = await getDatabase();
  const transaction = db.transaction("problems", "readonly");
  const objectStore = transaction.objectStore("problems");

  return new Promise((resolve, reject) => {
    let index = objectStore.index("by_review");
    console.log("keyRange", new Date().toISOString());

    let keyRange = IDBKeyRange.lowerBound(new Date().toISOString());
    const allProblems = [];
    let cursorRequest = index.openCursor(keyRange);

    cursorRequest.onsuccess = function (event) {
      let cursor = event.target.result;

      if (cursor) {
        if (isNotToday(cursor.value.lastAttemptDate)) {
          allProblems.push(cursor.value);
        }

        cursor.continue();
      } else {
        allProblems.sort(problemSortingCriteria);
        console.log("allProblems", allProblems);
        const schedule = allProblems.filter((problem) => {
          const successRate =
            problem.AttemptStats.SuccessfulAttempts /
            problem.AttemptStats.TotalAttempts;

          if (successRate > 0.9) {
            // Skip the problem with the highest success rate
            return false;
          } else if (successRate <= 0.9 || successRate === 0) {
            // Include the problem in the schedule
            return true;
          }
          return false;
        });

        // Ensure the schedule doesn't exceed the session length
        if (schedule.length > sessionLength) {
          console.log("GetDailyReviewSchedule 239 - schedule ", schedule);
          console.log(
            "GetDailyReviewSchedule 240 - session length",
            sessionLength,
            "schedule length",
            schedule.length
          );
          schedule.length = sessionLength;
        }

        resolve(schedule);
      }
    };

    cursorRequest.onerror = function (event) {
      console.error(
        "GetDailyReviewSchedule 249 - Failed to get daily review schedule:",
        event.target.errorCode
      );
      reject(event.target.errorCode);
    };
  });
}

async function fetchAdditionalProblems(countNeeded, excludeIds) {
  const db = await getDatabase();
  const transaction = db.transaction("problems", "readonly");
  const objectStore = transaction.objectStore("problems");
  const index = objectStore.index("by_review");
  const keyRange = IDBKeyRange.upperBound(new Date().toISOString());
  const cursorRequest = index.openCursor(keyRange);
  const problems = [];
  let count = [];

  return new Promise((resolve, reject) => {
    cursorRequest.onsuccess = function (event) {
      const cursor = event.target.result;
      if (cursor) {
        // Avoid adding problems that are already in the schedule
        if (
          !excludeIds.includes(cursor.value.id) &&
          isNotToday(cursor.value.lastAttemptDate)
        ) {
          problems.push(cursor.value);
          count++;
        }
        cursor.continue();
      } else {
        console.log(
          "FetchAdditionalProblems 276 - problems before sorting",
          problems
        );
        problems.sort(problemSortingCriteria);
        console.log(
          "FetchAdditionalProblems 278 - problem after sorting ",
          problems
        );
        if (problems.length > countNeeded) {
          problems.length = countNeeded;
        }
        resolve(problems);
      }
    };

    cursorRequest.onerror = function (event) {
      console.error(
        "FetchAdditionalProblems 287 - Failed to fetch additional problems:",
        event.target.errorCode
      );
      reject(event.target.errorCode);
    };
  });
}

//TODO simplify both checkDatabaseForProblem and addProblemIfNotExists function to one function
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

//TODO: rewrite function to put to attempt store as well as problem store disregard the problem ID

async function addProblem(problemData, sendResponse) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
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
      ProblemNumberAssoc: [], // Initializing an empty array for this, update as necessary
      leetCodeID: leetCodeID,
      LeetCodeAddress: address,
      ConsecutiveFailures: 0,
      CooldownStatus: false,
      BoxLevel: 1,
      ReviewSchedule: problemData.reviewSchedule,
      Difficulty: 0, // Defaulting difficulty to 1 if not provided
      AttemptStats: {
        TotalAttempts: 0,
        SuccessfulAttempts: 0,
        UnsuccessfulAttempts: 0,
      },
      Tags: problemData.tags,
    };
    console.log(
      "problem from addProblem ",
      problem,
      "problemData",
      problemData
    );

    const request = objectStore.add(problem);
    request.onsuccess = function (event) {
      const attemptData = {
        id: attemptId,
        ProblemID: problemId,
        Success: problemData.success,
        AttemptDate: problemData.date,
        TimeSpent: Number(problemData.timeSpent),
        Difficulty: problemData.difficulty,
        Comments: problemData.comments,
        BoxLevel: 1, // You can update this value based on your logic
        NextReviewDate: null, // This needs to be calculated as per the logic you mentioned
      };

      addAttempt(attemptData)
        .then(() => {
          sendResponse({ backgroundScriptData: "Attempt added successfully" });
          resolve(); // resolve the promise
        })
        .catch((error) => {
          console.error("Error adding attempt: ", error); // Log the actual error
          sendResponse({
            backgroundScriptData: "There was an error adding the attempt",
          });
          reject(); // reject the promise
        });
    };

    request.onerror = function (event) {
      console.log(event.target.error);
      reject("Problem not added to the database", event.target.error);
    };
  });
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

//Limit generation functions
// let isUpdatingLimits = false;

// async function updatelimits() {

//     const db = await getDatabase();
//     const mostRecentLimit = await getMostRecentLimit();

//       const currentDate = new Date();
//       currentDate.setHours(0, 0, 0, 0); // Normalize current date to start of day
//       console.log("mostrecentlimit",mostRecentLimit)

//       if (!mostRecentLimit) {
//         console.log("No limit found. Calculating limits for the first time.");
//         const attempts = await getAllAttempts();

//         const limits = await calculateLimits(attempts,db);
//        // await addLimit(limits);
//         console.log("New limits added:", limits);
//         return limits
//       } else {
//         const createdAtDate = new Date(mostRecentLimit.createdAt);
//         const oneWeekAgo = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 7);
//         console.log("oneWeekAgo" , oneWeekAgo, "createdAtDate", createdAtDate)
//         if (createdAtDate < oneWeekAgo) {
//           console.log("Most recent limit is more than one week old. Calculating new limits.");
//           const attempts = await getAllAttempts();
//           const limits = await calculateLimits(attempts);
//           console.log(limits)
//           await addLimit(limits);
//           console.log("New limits added:", limits);
//           return limits
//         } else {

//           console.log("Most recent limit is less than one week old. No need to calculate new limits.");
//           return mostRecentLimit
//         }
//       }

// }

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

  // Assuming 'Review Time' and 'AvgHandleTime' can be calculated here
  // For this example, we're skipping 'Review Time' and 'AvgHandleTime' calculations
  // as they depend on additional details not provided in the example attempt object
  //   new {
  //     SessionID: attempts[0].AttemptDate.slice(0, 10), // Use the date as SessionID
  //     ProblemIDs: [...new Set(problems)], // Unique Problem IDs
  //     SuccessRate: successRate,
  //     TotalTime: totalTime,
  //     ReviewTime: 0, // Placeholder
  //     AvgHandleTime: 0 // Placeholder
  // }

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

async function addSession(sessionData) {
  const db = await getDatabase();
  const transaction = db.transaction(["sessions"], "readwrite");
  const objectStore = transaction.objectStore("sessions");
  const request = objectStore.add(sessionData);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(sessionData);
    };

    request.onerror = (event) => {
      reject(event.target.errorCode);
    };
  });
}

async function updateSession() {
  const db = await getDatabase();
  const start = new Date(2023, 8, 5);
  const end = new Date(2024, 2, 25);

  let currentDate = new Date(start);

  while (currentDate <= end) {
    try {
      const sessionData = await getSessionDataForDate(currentDate);
      console.log("sessionData2", sessionData);
    } catch (error) {
      console.log(
        "Error getting session data for date",
        currentDate.toISOString().slice(0, 10),
        error
      );
    }
    if (sessionData) {
      try {
        await addSession(sessionData);
      } catch (error) {
        console.error(
          `Error adding session data for date ${currentDate
            .toISOString()
            .slice(0, 10)}`,
          error
        );
      }
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
}

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

function findCircularReferences(obj, seen = new WeakSet()) {
  // This function uses a WeakSet to keep track of seen objects without preventing garbage collection
  if (typeof obj !== "object" || obj === null) {
    // Not an object or is null, so no circular reference is possible
    return false;
  }

  if (seen.has(obj)) {
    // The object has been seen before, indicating a circular reference
    obj.AttemptStats = {
      SuccessfulAttempts: 0,
      TotalAttempts: 0,
      UnsuccessfulAttempts: 0,
    };

    saveUpdatedProblem(obj)
      .then((result) => {
        console.log("result", result);
      })
      .catch((error) => {
        console.log("error", error);
      });
    console.log("FindCircularReferences 658 - Circular reference found", obj);
    return true;
  }

  seen.add(obj); // Mark this object as seen

  // Recursively check the properties of the object
  for (const key of Object.keys(obj)) {
    if (findCircularReferences(obj[key], seen)) {
      console.log(
        "FindCircularReferences 667 - Circular reference found at property:",
        key
      );
      return true; // Circular reference detected in a child object
    }
  }

  return false; // No circular reference detected in this branch
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
async function getLeetCodeIDAndTags(description) {
  try {
    // Fetch the LeetCode ID and tags from the server via the ChatGPT API
    const result = await fetchLeetCodeIDAndTagsFromChatGPT(description);

    if (!result) {
      throw new Error("Unable to retrieve LeetCode ID and tags from ChatGPT.");
    }
    console.log("result", result);
    // Return the LeetCode ID, problem description, and related tags
    return {
      LeetCodeID: result["LeetCodeID"],
      Description: description.toLowerCase(),
      Tags: result["Tags"],
    };
  } catch (error) {
    console.error("Error in getLeetCodeIDAndTags:", error);
    throw error;
  }
}

async function fetchLeetCodeIDAndTagsFromChatGPT(description) {
  try {
    const response = await fetch("http://localhost:3000/fetch-tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
    });

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

//TODO: rewrite addattempt to update problem after attempt added
async function addAttempt(attemptData) {
  try {
    const db = await getDatabase();
    let problem = await getProblem(attemptData.ProblemID);

    if (!problem) {
      console.error("AddAttempt: Problem not found");
      return; // Exit if problem not found
    }

    // This is crucial: Ensure calculateLeitnerBox does not create circular references
    problem = await calculateLeitnerBox(problem, attemptData);
    console.log("addAttempt: problem ", problem);

    const transaction = db.transaction(["problems", "attempts"], "readwrite");
    const problemStore = transaction.objectStore("problems");
    const attemptStore = transaction.objectStore("attempts");

    // First, add the attempt
    console.log("AddAttempt : attemptData ", attemptData);
    const record = createAttemptRecord(attemptData);

    await new Promise((resolve, reject) => {
      const putAttemptRequest = attemptStore.put(record);
      putAttemptRequest.onsuccess = resolve;
      putAttemptRequest.onerror = () => reject(putAttemptRequest.error);
    });

    // Then, update the problem

    await new Promise((resolve, reject) => {
      const updateProblemRequest = problemStore.put(problem);
      updateProblemRequest.onsuccess = resolve;
      updateProblemRequest.onerror = () => reject(updateProblemRequest.error);
    });

    console.log(" AddAttempt : Attempt added and problem updated successfully");
    return { message: "Attempt added and problem updated successfully" };
  } catch (error) {
    console.error("AddAttempt : - Error in addAttempt function:", error);
    throw error;
  }
}

function createAttemptRecord(attemptData) {
  return {
    id: attemptData.id,
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

// Initialize default settings if they don't exist
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["settings"], (result) => {
    if (!result.settings) {
      const defaultSettings = {
        theme: "light",
        notificationsEnabled: true,
        // add more default settings as needed
      };
      chrome.storage.local.set({ settings: defaultSettings });
    }
  });
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
        getProblemByDescription(request.title.toLowerCase())
          .then(async (problem) => {
            if (problem) {
              console.log("Found problem in database:", problem);
              sendResponse(problem);
              finishRequest();
            } else {
              console.log("No problem found in database:", problem);
              sendResponse({ error: "Failed to retrieve problem" });
              finishRequest();
            }
          })
          .catch((error) => {
            console.error("Error retrieving problem:", error);
            sendResponse({ error: "Failed to retrieve problem" });
          })
          .finally(finishRequest);
        return true;
      case "callChatGPT":
        console.log("Received request to call ChatGPT");
        getLeetCodeIDAndTags(request.description)
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
        chrome.storage.local.get(["settings"], (result) => {
          const updatedSettings = {
            ...result.settings,
            [message.payload.key]: message.payload.value,
          };
          chrome.storage.local.set({ settings: updatedSettings }, () => {
            sendResponse({ status: "success" });
          });
        });
        return true; // Keep the messaging channel open for async response

      case "getSettings":
        chrome.storage.local.get(["settings"], (result) => {
          sendResponse(result.settings);
        });
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

      case "getDailyReviewSchedule":
        // updateAllProblems()
        //   .then(() => {
        //     sendResponse("update Successfull");
        //   })
        //   .catch((error) => {
        //     sendResponse({ error });
        //   });
        fetchProblemsForSession()
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
