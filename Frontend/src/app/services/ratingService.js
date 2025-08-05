import { getDatabase } from "../../shared/db/index.js";
import { addLimit } from "../../shared/db/limit.js";

export const RatingService = {
  updateProblemsWithRatings,
};

/**
 * Determines the most common rating from an array of ratings.
 * Returns the lowest difficulty if there's a tie.
 */
function determineRating(ratings) {
  if (!ratings || ratings.length === 0) return "Medium"; // Default fallback

  const ratingCounts = ratings.reduce((acc, rating) => {
    acc[rating] = (acc[rating] || 0) + 1;
    return acc;
  }, {});

  const maxCount = Math.max(...Object.values(ratingCounts));
  const modes = Object.keys(ratingCounts).filter(
    (rating) => ratingCounts[rating] === maxCount
  );

  if (modes.includes("Easy")) return "Easy";
  if (modes.includes("Medium")) return "Medium";
  return "Hard";
}

/**
 * Updates problem ratings based on attempt data.
 */
async function updateProblemsWithRatings() {
  const db = await getDatabase();
  try {
    const problems = await fetchAllFromStore(db, "problems");
    const attempts = await fetchAllFromStore(db, "attempts");

    const problemRatings = adjustProblemRatings(attempts);

    // Batch update all problem ratings
    const updatedProblems = problems.map((problem) => ({
      ...problem,
      Rating: determineRating(problemRatings[problem.id] || []),
    }));

    await saveAllToStore(db, "problems", updatedProblems);

    // Check if new limits need to be set
    await checkAndUpdateLimits(attempts, db);
  } catch (error) {
    console.error("Error updating problem ratings:", error);
  }
}

/**
 * Fetches all entries from an IndexedDB store.
 */
async function fetchAllFromStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () =>
      reject(new Error(`Error fetching from ${storeName}: ${request.error}`));
  });
}

/**
 * Saves multiple entries to an IndexedDB store in a batch transaction.
 */
async function saveAllToStore(db, storeName, items) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);

    items.forEach((item) => {
      store.put(item).onerror = (event) => {
        console.error(`Error saving to ${storeName}:`, event.target.error);
        reject(event.target.error);
      };
    });

    transaction.oncomplete = () => resolve();
    transaction.onerror = (event) =>
      reject(
        new Error(`Transaction error in ${storeName}: ${event.target.error}`)
      );
  });
}

/**
 * Adjusts problem ratings based on attempt times.
 */
function adjustProblemRatings(attempts) {
  const problemRatings = {};

  attempts.forEach(({ ProblemID, TimeSpent }) => {
    if (!problemRatings[ProblemID]) {
      problemRatings[ProblemID] = [];
    }
    problemRatings[ProblemID].push(parseFloat(TimeSpent) || 0);
  });

  Object.keys(problemRatings).forEach((ProblemID) => {
    const times = problemRatings[ProblemID];
    const { mean, stddev } = calculateStatistics(times);

    problemRatings[ProblemID] = times.map((time) => {
      if (time < mean - stddev) return "Easy";
      if (time > mean + stddev) return "Hard";
      return "Medium";
    });
  });

  return problemRatings;
}

/**
 * Calculates statistical mean and standard deviation.
 */
function calculateStatistics(times) {
  if (times.length === 0) return { mean: 0, stddev: 0 };

  const mean = times.reduce((sum, val) => sum + val, 0) / times.length;
  const variance =
    times.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / times.length;
  return { mean, stddev: Math.sqrt(variance) };
}

/**
 * Ensures that problem limits are updated if a week has passed.
 */
async function checkAndUpdateLimits(attempts, db) {
  const mostRecentLimit = await getMostRecentLimit(db);
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0); // Normalize current date

  if (
    !mostRecentLimit ||
    new Date(mostRecentLimit.CreatedAt).getTime() <
      currentDate.getTime() - 7 * 24 * 60 * 60 * 1000
  ) {
    const newLimits = await calculateLimits(attempts, db);
    await addLimit(newLimits);
    console.log("New limits added:", newLimits);
  } else {
    console.log("Recent limit is still valid; no update needed.");
  }
}

/**
 * Calculates new problem limits based on attempts.
 */
async function calculateLimits(attempts, db) {
  const buffer = 5;
  const idealLimits = { easy: 15, medium: 20, hard: 30 };

  const newLimits = setTimeLimits(
    attempts,
    adjustProblemRatings(attempts),
    idealLimits
  );
  const limitObject = {
    id: crypto.randomUUID(),
    CreatedAt: new Date().toISOString(),
    Easy: Math.max(newLimits.easy + buffer, idealLimits.easy),
    Medium: Math.max(newLimits.medium + buffer, idealLimits.medium),
    Hard: Math.max(newLimits.hard + buffer, idealLimits.hard),
  };

  await saveAllToStore(db, "limits", [limitObject]);
  return limitObject;
}

/**
 * Computes session time limits based on attempt data.
 */
function setTimeLimits(attempts, ratings, idealLimits) {
  const timeSums = { Easy: 0, Medium: 0, Hard: 0 };
  const counts = { Easy: 0, Medium: 0, Hard: 0 };

  attempts.forEach(({ ProblemID, TimeSpent }) => {
    const rating = determineRating(ratings[ProblemID]);
    timeSums[rating] += parseFloat(TimeSpent) || 0;
    counts[rating]++;
  });

  return {
    easy: calculateLimit(timeSums.Easy, idealLimits.easy),
    medium: calculateLimit(timeSums.Medium, idealLimits.medium),
    hard: calculateLimit(timeSums.Hard, idealLimits.hard),
  };
}

/**
 * Calculates an adjusted problem-solving time limit.
 */
function calculateLimit(times, idealLimit) {
  if (times.length === 0) return idealLimit;

  const mode = getMode(times);
  return mode !== null
    ? mode
    : times.reduce((sum, val) => sum + val, 0) / times.length;
}

/**
 * Finds the most frequently occurring time in an array.
 */
function getMode(times) {
  const frequency = times.reduce((acc, time) => {
    acc[time] = (acc[time] || 0) + 1;
    return acc;
  }, {});

  const maxFreq = Math.max(...Object.values(frequency));
  const modes = Object.keys(frequency).filter(
    (time) => frequency[time] === maxFreq
  );

  return modes.length === 1 ? parseFloat(modes[0]) : null;
}
