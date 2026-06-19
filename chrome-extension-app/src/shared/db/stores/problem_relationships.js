import { getTagMastery } from "./tag_mastery.js";
import { calculateTagSimilarity } from "./tag_mastery.js";
import { getProblemsWithHighFailures } from "./problems.js";
import { fetchProblemById } from "./standard_problems.js";
import { dbHelper } from "../index.js";
import { calculateSuccessRate } from "../../utils/leitner/Utils.js";

const openDB = dbHelper.openDB;

export const addProblemRelationship = async (
  problemId1,
  problemId2,
  strength
) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("problem_relationships", "readwrite");
    const store = transaction.objectStore("problem_relationships");

    const relationship = { problem_id1: problemId1, problem_id2: problemId2, strength };
    const request = store.add(relationship);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const weakenProblemRelationship = async (problemId1, _problemId2) => {
  // Validate problemId1 before proceeding
  if (!problemId1 || (typeof problemId1 !== 'string' && typeof problemId1 !== 'number')) {
    console.warn(`⚠️ Invalid problemId1 in weakenProblemRelationship: ${problemId1}`);
    return null;
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("problem_relationships", "readwrite");
    const store = transaction.objectStore("problem_relationships");

    let index;
    try {
      index = store.index("by_problem_id1");
    } catch (error) {
      console.error(`❌ PROBLEM RELATIONSHIPS INDEX ERROR: by_problem_id1 index not found in problem_relationships`, {
        error: error.message,
        availableIndexes: Array.from(store.indexNames),
        storeName: "problem_relationships"
      });
      return reject(error);
    }
    const request = index.get(problemId1);

    request.onsuccess = (event) => {
      const entry = event.target.result;
      if (entry) {
        entry.strength = Math.max(entry.strength - 1, 0);
        store.put(entry);
        resolve(entry);
      } else {
        reject(new Error("No relationship found"));
      }
    };
    request.onerror = () => reject(request.error);
  });
};

export async function clearProblemRelationships(db) {
  const tx = db.transaction("problem_relationships", "readwrite");
  const store = tx.objectStore("problem_relationships");

  await new Promise((resolve, reject) => {
    const req = store.clear();
    req.onsuccess = resolve;
    req.onerror = () => reject(req.error);
  });

  console.log("✅ Cleared old problem relationships.");
}

export async function storeRelationships(problemGraph) {
  const db = await openDB();

  for (const [problemId1, relationships] of problemGraph.entries()) {
    for (const relationship of relationships) {
      const { problemId2, strength } = relationship;

      await new Promise((resolve, reject) => {
        const tx = db.transaction("problem_relationships", "readwrite");
        const store = tx.objectStore("problem_relationships");

        const relationshipToStore = {
          problem_id1: problemId1,
          problem_id2: problemId2,  // Convert camelCase to snake_case for database
          strength,
        };

        const request = store.add(relationshipToStore);

        request.onsuccess = resolve;
        request.onerror = () => reject(request.error);
      });
    }
  }

  console.log("✅ Relationships stored in original format.");
}

export async function updateProblemRelationships(session) {
  const db = await openDB();

  const _tagMastery = await getTagMastery();

  for (const attempt of session.attempts) {
    const problem_id = attempt.problem_id || attempt.problemId;

    // Skip if problem_id is missing or invalid
    if (!problem_id) {
      console.warn(`Skipping attempt with missing problem_id:`, attempt);
      continue;
    }

    // Create a new transaction for each problem operation
    const transaction = db.transaction(
      ["problem_relationships", "sessions", "problems"],
      "readwrite"
    );
    const _relationshipsStore = transaction.objectStore("problem_relationships");
    const problemsStore = transaction.objectStore("problems");

    // Get database problem for NextProblem field, session problem for tags
    const problems = await new Promise((resolve, reject) => {
      const request = problemsStore.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const dbProblem = problems.find(p => p.leetcode_id === problem_id);
    const sessionProblem = session.problems?.find(p => String(p.id) === String(problem_id));

    // Combine both: use database problem as base, but override tags with session data
    const problem = dbProblem ? {
      ...dbProblem,
      tags: sessionProblem?.tags || dbProblem.tags || []
    } : sessionProblem;

    if (!problem) continue;
    try {
      await updateSuccessPatterns(problem, attempt);
    } catch (error) {
      console.error(`❌ Error updating success patterns for problem ${problem_id}:`, error);
    }
  }
}

/**
 * Get relationship strength between two problems
 * @param {number} problemId1 - First problem ID
 * @param {number} problemId2 - Second problem ID
 * @returns {Promise<number|null>} Relationship strength or null if not found
 */
export async function getRelationshipStrength(problemId1, problemId2) {
  if (!problemId1 || !problemId2) return null;

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("problem_relationships", "readonly");
    const store = transaction.objectStore("problem_relationships");

    // Look for exact match first
    const request = store.getAll();
    request.onsuccess = () => {
      const relationships = request.result || [];
      const match = relationships.find(rel =>
        rel.problem_id1 === problemId1 && rel.problem_id2 === problemId2
      );
      resolve(match ? match.strength : null);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Batch load all relationship strengths for performance optimization
 * @returns {Promise<Map>} Map with keys like "problemId1-problemId2" and strength values
 */
export async function getAllRelationshipStrengths() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("problem_relationships", "readonly");
    const store = transaction.objectStore("problem_relationships");

    const request = store.getAll();
    request.onsuccess = () => {
      const relationships = request.result || [];
      const strengthMap = new Map();

      relationships.forEach(rel => {
        const key = `${rel.problem_id1}-${rel.problem_id2}`;
        strengthMap.set(key, rel.strength);
      });

      resolve(strengthMap);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Update or create relationship strength between two problems
 * @param {number} problemId1 - First problem ID
 * @param {number} problemId2 - Second problem ID
 * @param {number} newStrength - New strength value
 * @returns {Promise<void>}
 */
export async function updateRelationshipStrength(problemId1, problemId2, newStrength) {
  if (!problemId1 || !problemId2 || typeof newStrength !== 'number') return;

  // Keep strength within reasonable bounds
  const boundedStrength = Math.max(0.1, Math.min(10.0, newStrength));

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("problem_relationships", "readwrite");
    const store = transaction.objectStore("problem_relationships");

    // Check if relationship already exists
    const getAllRequest = store.getAll();
    getAllRequest.onsuccess = () => {
      const relationships = getAllRequest.result || [];
      const existingRel = relationships.find(rel =>
        rel.problem_id1 === problemId1 && rel.problem_id2 === problemId2
      );

      if (existingRel) {
        // Update existing relationship
        existingRel.strength = boundedStrength;
        const updateRequest = store.put(existingRel);
        updateRequest.onsuccess = () => resolve();
        updateRequest.onerror = () => reject(updateRequest.error);
      } else {
        // Create new relationship
        const newRelationship = {
          problem_id1: problemId1,
          problem_id2: problemId2,
          strength: boundedStrength,
          id: Date.now() // Simple ID generation
        };
        const addRequest = store.add(newRelationship);
        addRequest.onsuccess = () => resolve();
        addRequest.onerror = () => reject(addRequest.error);
      }
    };
    getAllRequest.onerror = () => reject(getAllRequest.error);
  });
}

// Scoring functions extracted to problem_relationships_scoring.js
export {
  calculateOptimalPathScore,
  selectOptimalProblems,
  scoreProblemsWithRelationships
} from "./problem_relationships_scoring.js";

export async function buildRelationshipMap() {
  const db = await openDB();
  const tx = db.transaction("problem_relationships", "readonly");
  const store = tx.objectStore("problem_relationships");
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const graph = new Map();

      // Handle the case where there are no relationships
      if (!request.result || request.result.length === 0) {
        console.log("✅ Problem relationships loaded: 0 relationships (empty database)");
        resolve(graph); // Return empty Map instead of undefined
        return;
      }

      request.result.forEach((relationship) => {
        // Ensure consistent number types for Map keys
        const problemId1 = Number(relationship.problem_id1);
        const problemId2 = Number(relationship.problem_id2);
        const strength = relationship.strength;

        if (!graph.has(problemId1)) {
          graph.set(problemId1, {});
        }
        graph.get(problemId1)[problemId2] = strength;
      });

      resolve(graph);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get user's recent attempts for relationship learning
 * @param {number} limit - Maximum number of recent attempts to return
 * @returns {Promise<Array>} Array of recent attempt records
 */
export async function getUserRecentAttempts(limit = 5) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("attempts", "readonly");
    const store = transaction.objectStore("attempts");

    const attempts = [];
    const request = store.openCursor(null, 'prev'); // Get newest first

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor && attempts.length < limit) {
        const attempt = cursor.value;
        // Only include successful attempts from the last 7 days for pattern learning
        const attemptDate = new Date(attempt.attempt_date || attempt.date);
        const daysSinceAttempt = (Date.now() - attemptDate.getTime()) / (1000 * 60 * 60 * 24);

        if (attempt.success && daysSinceAttempt <= 7) {
          attempts.push({
            leetcode_id: attempt.leetcode_id,
            problem_id: attempt.problem_id,
            success: attempt.success,
            time_spent: attempt.time_spent,
            attempt_date: attempt.attempt_date || attempt.date
          });
        }
        cursor.continue();
      } else {
        resolve(attempts);
      }
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Update relationship strengths based on user success patterns
 * Core Phase 2 implementation for personalized learning
 * @param {Object} completedProblem - The problem just completed
 * @param {Object} attempt - The attempt record with success/timing data
 */
export async function updateSuccessPatterns(completedProblem, attempt) {
  try {
    const recentProblems = await getUserRecentAttempts(5);
    if (recentProblems.length === 0) return;

    const recommendedTime = getRecommendedTimeForDifficulty(completedProblem.difficulty || 'Medium');
    const completedId = completedProblem.leetcode_id || completedProblem.id;

    for (const recentProblem of recentProblems) {
      if (recentProblem.leetcode_id === completedId) continue;

      const currentStrength = await getRelationshipStrength(recentProblem.leetcode_id, completedId);
      let strengthDelta = 0;
      const timeSpent = attempt.time_spent || 0;

      if (attempt.success && timeSpent <= recommendedTime) {
        strengthDelta = +0.3;
      } else if (attempt.success && timeSpent <= recommendedTime * 1.3) {
        strengthDelta = +0.1;
      } else if (!attempt.success || timeSpent > recommendedTime * 1.5) {
        strengthDelta = -0.4;
      } else {
        strengthDelta = +0.05;
      }

      const recentAttemptCount = Math.min(recentProblems.length, 5);
      const confidence = calculateSuccessRate(recentProblems.length, Math.max(recentAttemptCount, 3));
      strengthDelta *= Math.max(0.3, Math.min(1.0, confidence));

      const baseStrength = currentStrength || 2.0;
      const neutralDecay = (2.0 - baseStrength) * 0.05;
      const newStrength = Math.max(0.5, Math.min(5.0, baseStrength + neutralDecay + strengthDelta));

      await updateRelationshipStrength(recentProblem.leetcode_id, completedId, newStrength);
    }
  } catch (error) {
    console.error("❌ Error in updateSuccessPatterns:", error);
    throw error;
  }
}

/**
 * Get recommended solving time based on difficulty level
 * @param {string} difficulty - Problem difficulty (Easy, Medium, Hard)
 * @returns {number} Recommended time in milliseconds
 */
function getRecommendedTimeForDifficulty(difficulty) {
  const times = {
    'Easy': 15 * 60 * 1000,    // 15 minutes
    'Medium': 25 * 60 * 1000,  // 25 minutes
    'Hard': 35 * 60 * 1000     // 35 minutes
  };
  return times[difficulty] || times['Medium'];
}

export function restoreMissingProblemRelationships({
  problems,
  problemGraph,
  removedRelationships,
}) {
  const problemsArray = Array.isArray(problems)
    ? problems
    : Object.values(problems);
  const missingProblems = new Set();
  // Ensure every problem appears in `problem_relationships`
  for (const problem of problemsArray) {
    const problemId = problem.leetcode_id || problem.id;
    const existing = problemGraph.get(problemId);
    if (!existing || existing.length === 0) {
      console.warn(`⚠️ Problem ${problemId} has no valid relationships.`);

      missingProblems.add(problemId);

      // Try restoring from trimmed
      if (removedRelationships.has(problemId)) {
        console.log(`🔄 Restoring trimmed relationship for ${problemId}`);
        problemGraph.set(
          problemId,
          removedRelationships.get(problemId).slice(0, 1)
        );
      } else {
        // Fallback to same-tag pairing
        const fallback = problemsArray.find(
          (p) => {
            const pId = p.leetcode_id || p.id;
            const pTags = p.tags || [];
            const problemTags = problem.tags || [];
            return pId !== problemId &&
              pTags.some((tag) => problemTags.includes(tag));
          }
        );

        if (fallback) {
          const fallbackId = fallback.leetcode_id || fallback.id;
          const fallbackRelationship = {
            problemId2: fallbackId,  // Use camelCase like the original working version
            strength: 1, // Weakest connection
          };
          problemGraph.set(problemId, [fallbackRelationship]);
        }
      }
    }
  }

  return {
    updatedProblemGraph: problemGraph,
    updatedRemovedRelationships: removedRelationships,
  };
}

export function calculateAndTrimProblemRelationships({
  problems,
  tagGraph,
  tagMastery,
  limit,
}) {
  const problemGraph = new Map();
  const removedRelationships = new Map();
  const difficultyMap = { Easy: 1, Medium: 2, Hard: 3 };
  const problemsArray = Array.isArray(problems)
    ? problems
    : Object.values(problems);

  // Build raw relationships
  problemsArray.forEach((p1) => {
    const p1Id = p1.leetcode_id || p1.id;
    problemGraph.set(p1Id, []);

    problemsArray.forEach((p2) => {
      const p2Id = p2.leetcode_id || p2.id;
      if (p1Id === p2Id) return;

      const similarity = calculateTagSimilarity({
        tags1: p1.tags,
        tags2: p2.tags,
        tagGraph,
        tagMastery,
        difficulty1: p1.difficulty,
        difficulty2: p2.difficulty
      });

      const d1 = difficultyMap[p1.difficulty] || 2;
      const d2 = difficultyMap[p2.difficulty] || 2;


      if (similarity > 0 && d1 <= d2) {
        const relationshipObj = {
          problemId2: p2Id,  // Use camelCase like the original working version
          strength: similarity,
        };
        problemGraph.get(p1Id).push(relationshipObj);
      }
    });
  });

  // Trim to top `limit` connections
  for (const [problemId, relationships] of problemGraph.entries()) {
    relationships.sort((a, b) => b.strength - a.strength);
    if (relationships.length > limit) {
      // Store removed relationships in a Map in case they are needed later
      removedRelationships.set(problemId, relationships.slice(limit));
    }
    // Trim to the strongest `N` connections
    const trimmedRelationships = relationships.slice(0, limit);
    problemGraph.set(problemId, trimmedRelationships);
  }

  return { problemGraph, removedRelationships };
}

/**
 * Weaken relationships for a skipped problem (used when user skips as "too difficult")
 * Applies a penalty similar to failure (-0.4) to relationships with recent successful problems
 * @param {number} problemId - The LeetCode ID of the skipped problem
 * @returns {Promise<{updated: number}>} Number of relationships updated
 */
export async function weakenRelationshipsForSkip(problemId) {
  if (!problemId) {
    console.warn("⚠️ weakenRelationshipsForSkip called without problemId");
    return { updated: 0 };
  }

  try {
    const recentSuccesses = await getUserRecentAttempts(5);
    if (recentSuccesses.length === 0) return { updated: 0 };

    let updatedCount = 0;
    const SKIP_PENALTY = -0.4; // Same as failure penalty

    for (const recent of recentSuccesses) {
      const recentId = recent.leetcode_id;
      if (!recentId || recentId === problemId) continue;

      // Get current strength
      const currentStrength = await getRelationshipStrength(problemId, recentId);
      const newStrength = Math.max(0.5, (currentStrength || 2.0) + SKIP_PENALTY);

      // Update relationship strength
      await updateRelationshipStrength(problemId, recentId, newStrength);
      updatedCount++;

    }
    return { updated: updatedCount };
  } catch (error) {
    console.error("❌ Error weakening relationships for skip:", error);
    return { updated: 0 };
  }
}

/**
 * Weaken ALL relationships for a "not relevant" skip
 * Applies a heavy penalty (-0.8) to all connections, signaling permanent irrelevance
 * @param {number} problemId - The LeetCode ID of the skipped problem
 * @returns {Promise<{updated: number}>} Number of relationships updated
 */
export async function weakenRelationshipsForNotRelevant(problemId) {
  if (!problemId) {
    console.warn("⚠️ weakenRelationshipsForNotRelevant called without problemId");
    return { updated: 0 };
  }

  try {
    const relationships = await getRelationshipsForProblem(problemId);
    const relatedIds = Object.keys(relationships).map(Number);
    if (relatedIds.length === 0) return { updated: 0 };

    let updatedCount = 0;
    const NOT_RELEVANT_PENALTY = -0.8;

    for (const relatedId of relatedIds) {
      if (!relatedId || relatedId === problemId) continue;

      const currentStrength = relationships[relatedId] || 2.0;
      const newStrength = Math.max(0.5, currentStrength + NOT_RELEVANT_PENALTY);

      await updateRelationshipStrength(problemId, relatedId, newStrength);
      updatedCount++;

    }
    return { updated: updatedCount };
  } catch (error) {
    console.error("❌ Error weakening relationships for not-relevant:", error);
    return { updated: 0 };
  }
}

/**
 * Get relationships for a specific problem using indexes (optimized)
 * Instead of loading all 29,840 relationships, only loads relationships for this problem
 * @param {number} problemId - The LeetCode ID to get relationships for
 * @returns {Promise<Object>} Map of related problem IDs to strength values
 */
export async function getRelationshipsForProblem(problemId) {
  const db = await openDB();
  const relationships = {};

  return new Promise((resolve, reject) => {
    const tx = db.transaction("problem_relationships", "readonly");
    const store = tx.objectStore("problem_relationships");

    // Try indexed query first, fall back to getAll + filter for older DBs
    let index1;
    try {
      index1 = store.index("by_problem_id1");
    } catch {
      // Index missing (older DB schema) — fall back to full scan
      const allRequest = store.getAll();
      allRequest.onsuccess = () => {
        const all = allRequest.result || [];
        const numId = Number(problemId);
        all.forEach(r => {
          if (Number(r.problem_id1) === numId) {
            relationships[Number(r.problem_id2)] = r.strength;
          } else if (Number(r.problem_id2) === numId && !(Number(r.problem_id1) in relationships)) {
            relationships[Number(r.problem_id1)] = r.strength;
          }
        });
        resolve(relationships);
      };
      allRequest.onerror = () => reject(allRequest.error);
      return;
    }

    // Query using problem_id1 index
    const request1 = index1.getAll(Number(problemId));

    request1.onsuccess = () => {
      const results = request1.result || [];
      results.forEach(r => {
        relationships[Number(r.problem_id2)] = r.strength;
      });

      // Also query problem_id2 index (bidirectional relationships)
      let index2;
      try {
        index2 = store.index("by_problem_id2");
      } catch {
        // Index missing — resolve with what we have
        resolve(relationships);
        return;
      }
      const request2 = index2.getAll(Number(problemId));

      request2.onsuccess = () => {
        const results2 = request2.result || [];
        results2.forEach(r => {
          // Don't overwrite if already exists from problem_id1
          if (!(Number(r.problem_id1) in relationships)) {
            relationships[Number(r.problem_id1)] = r.strength;
          }
        });
        resolve(relationships);
      };
      request2.onerror = () => reject(request2.error);
    };
    request1.onerror = () => reject(request1.error);
  });
}

/**
 * Check if a problem has any relationships to problems the user has attempted
 * Used to determine if a skip should be "free" (no graph penalty)
 * @param {number} problemId - The LeetCode ID to check
 * @returns {Promise<boolean>} True if the problem has relationships to attempted problems
 */
export async function hasRelationshipsToAttempted(problemId) {
  if (!problemId) return false;

  try {
    // Get only relationships for this specific problem (optimized - uses indexes)
    const problemRelationships = await getRelationshipsForProblem(problemId);
    const relatedIds = Object.keys(problemRelationships).map(Number);

    if (relatedIds.length === 0) return false;

    // Get all attempted problem IDs from problems store
    const db = await openDB();
    const attemptedIds = await new Promise((resolve, reject) => {
      const transaction = db.transaction("problems", "readonly");
      const store = transaction.objectStore("problems");
      const request = store.getAllKeys();  // Optimized: only get keys, not full records

      request.onsuccess = () => {
        const ids = new Set((request.result || []).map(Number));
        resolve(ids);
      };
      request.onerror = () => reject(request.error);
    });

    // Check if any relationships connect to attempted problems
    const hasConnection = relatedIds.some(id => attemptedIds.has(id));

    return hasConnection;
  } catch (error) {
    console.error("❌ Error checking relationships:", error);
    return true; // Default to having relationships (safer)
  }
}

// ============================================================================
// ADAPTIVE LEARNING: TRIGGERED REVIEW SYSTEM
// ============================================================================

/**
 * Get recent attempts from the last N sessions
 * @param {Object} options - Configuration options
 * @param {number} options.sessions - Number of recent sessions to check (default: 2)
 * @returns {Promise<Array>} Array of recent attempt records
 */
export async function getRecentAttempts({ sessions = 2 } = {}) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    // First, get recent session IDs
    const sessionTx = db.transaction("sessions", "readonly");
    const sessionStore = sessionTx.objectStore("sessions");

    let sessionIndex;
    try {
      sessionIndex = sessionStore.index("by_date");
    } catch (error) {
      console.warn("⚠️ by_date index not available, falling back to getAll");
      const allRequest = sessionStore.getAll();
      allRequest.onsuccess = () => {
        const allSessions = allRequest.result || [];
        const sortedSessions = allSessions
          .filter(s => s.status === "completed")
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, sessions);
        processSessionAttempts(sortedSessions.map(s => s.id));
      };
      allRequest.onerror = () => reject(allRequest.error);
      return;
    }

    // Get recent completed sessions using cursor (newest first)
    const recentSessionIds = [];
    const cursorRequest = sessionIndex.openCursor(null, "prev");

    cursorRequest.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor && recentSessionIds.length < sessions) {
        const session = cursor.value;
        if (session.status === "completed") {
          recentSessionIds.push(session.id);
        }
        cursor.continue();
      } else {
        processSessionAttempts(recentSessionIds);
      }
    };

    cursorRequest.onerror = () => reject(cursorRequest.error);

    async function processSessionAttempts(sessionIds) {
      if (sessionIds.length === 0) {
        resolve([]);
        return;
      }

      try {
        const attemptsTx = db.transaction("attempts", "readonly");
        const attemptsStore = attemptsTx.objectStore("attempts");

        let attemptsIndex;
        try {
          attemptsIndex = attemptsStore.index("by_session_id");
        } catch {
          // Fallback: get all attempts and filter
          const allRequest = attemptsStore.getAll();
          allRequest.onsuccess = () => {
            const allAttempts = allRequest.result || [];
            const sessionSet = new Set(sessionIds);
            const filtered = allAttempts.filter(a => sessionSet.has(a.session_id));
            resolve(filtered);
          };
          allRequest.onerror = () => reject(allRequest.error);
          return;
        }

        const attempts = [];
        for (const sessionId of sessionIds) {
          const sessionAttempts = await new Promise((res, rej) => {
            const request = attemptsIndex.getAll(sessionId);
            request.onsuccess = () => res(request.result || []);
            request.onerror = () => rej(request.error);
          });
          attempts.push(...sessionAttempts);
        }

        resolve(attempts);
      } catch (error) {
        reject(error);
      }
    }
  });
}

/**
 * Get problems that need reinforcement - recent failures + chronic struggles
 * @param {Array} recentAttempts - Attempts from recent sessions
 * @returns {Promise<Array>} Problems needing reinforcement with reason
 */
export async function getProblemsNeedingReinforcement(recentAttempts) {
  const candidates = [];

  // 1. Recently failed problems (from attempts)
  const recentFailures = recentAttempts.filter(a => !a.success);
  for (const failure of recentFailures) {
    const leetcodeId = failure.leetcode_id || failure.problem_id;
    if (leetcodeId && !candidates.some(c => c.leetcode_id === leetcodeId)) {
      candidates.push({
        leetcode_id: leetcodeId,
        reason: 'recent_failure'
      });
    }
  }

  // 2. Problems with high unsuccessful attempts (chronic struggle)
  const strugglingProblems = await getProblemsWithHighFailures({
    minUnsuccessfulAttempts: 3,
    maxBoxLevel: 4
  });

  for (const problem of strugglingProblems) {
    const leetcodeId = problem.leetcode_id;
    if (leetcodeId && !candidates.some(c => c.leetcode_id === leetcodeId)) {
      candidates.push({
        leetcode_id: leetcodeId,
        reason: 'chronic_struggle',
        unsuccessfulAttempts: problem.attempt_stats?.unsuccessful_attempts || 0
      });
    }
  }

  return candidates;
}

/**
 * Get mastered problems (box level 6-8) from the problems store
 * @param {Object} options - Options
 * @param {number} options.minBoxLevel - Minimum box level (default: 6)
 * @returns {Promise<Array>} Array of mastered problems
 */
export async function getMasteredProblems({ minBoxLevel = 6 } = {}) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("problems", "readonly");
    const store = tx.objectStore("problems");

    // Use the by_box_level index for efficient querying
    let index;
    try {
      index = store.index("by_box_level");
    } catch (error) {
      // Fallback to full scan
      const allRequest = store.getAll();
      allRequest.onsuccess = () => {
        const problems = (allRequest.result || []).filter(p => p.box_level >= minBoxLevel);
        resolve(problems);
      };
      allRequest.onerror = () => reject(allRequest.error);
      return;
    }

    // Query for each box level 6, 7, 8
    const masteredProblems = [];
    const levels = [6, 7, 8].filter(l => l >= minBoxLevel);
    let completed = 0;

    for (const level of levels) {
      const request = index.getAll(level);
      request.onsuccess = () => {
        masteredProblems.push(...(request.result || []));
        completed++;
        if (completed === levels.length) {
          resolve(masteredProblems);
        }
      };
      request.onerror = () => reject(request.error);
    }

    if (levels.length === 0) {
      resolve([]);
    }
  });
}

/**
 * Find mastered problems with high aggregate relationship to struggling problems
 * Returns "bridge" problems that can reinforce multiple weak concepts at once
 *
 * @param {Array} recentAttempts - Attempts from recent sessions
 * @returns {Promise<Array>} Top 2 triggered review problems with metadata
 */
export async function getFailureTriggeredReviews(recentAttempts) {
  // Get all problems needing reinforcement
  const problemsNeedingHelp = await getProblemsNeedingReinforcement(recentAttempts);

  if (problemsNeedingHelp.length === 0) return [];

  const strugglingIds = problemsNeedingHelp.map(p => Number(p.leetcode_id));

  // Get all mastered problems (box 6-8) that are due for review
  const allMasteredProblems = await getMasteredProblems({ minBoxLevel: 6 });
  const now = new Date();
  const masteredProblems = allMasteredProblems.filter(p => {
    const reviewDate = p.review_schedule || p.ReviewSchedule;
    return !reviewDate || new Date(reviewDate) <= now;
  });

  if (masteredProblems.length === 0) return [];

  // Optional: Get tag mastery for decay boost
  let tagMasteryMap = {};
  try {
    const tagMasteryData = await getTagMastery();
    tagMasteryMap = (tagMasteryData || []).reduce((acc, tm) => {
      acc[tm.tag?.toLowerCase()] = tm;
      return acc;
    }, {});
  } catch (error) {
    console.warn("⚠️ Could not load tag mastery for decay boost:", error.message);
  }

  // Score each mastered problem by aggregate relationship to all struggling problems
  const scoredCandidates = [];
  const RELATIONSHIP_THRESHOLD = 2.0;

  for (const mastered of masteredProblems) {
    const masteredId = Number(mastered.leetcode_id);

    // Get relationships for this specific problem (optimized - uses indexes)
    const relationships = await getRelationshipsForProblem(masteredId);

    // Calculate aggregate score across all struggling problems
    let aggregateStrength = 0;
    let connectedProblems = 0;
    const triggeredBy = [];

    for (const strugglingId of strugglingIds) {
      const strength = relationships[strugglingId] || 0;
      if (strength >= RELATIONSHIP_THRESHOLD) {
        aggregateStrength += strength;
        connectedProblems++;
        triggeredBy.push(strugglingId);
      }
    }

    // Skip if no meaningful connections
    if (connectedProblems === 0) continue;

    // Prioritize problems that connect to MULTIPLE struggling problems
    const coverageBonus = connectedProblems / strugglingIds.length; // 0 to 1
    let finalScore = aggregateStrength * (1 + coverageBonus);

    // Apply tag mastery decay boost: if problem's tags are stale, boost priority
    const problemTags = mastered.tags || mastered.Tags || [];
    for (const tag of problemTags) {
      const tagLower = tag?.toLowerCase();
      const tagData = tagMasteryMap[tagLower];
      if (tagData && tagData.decay_score !== undefined && tagData.decay_score < 0.7) {
        finalScore *= 1.1;
      }
    }

    scoredCandidates.push({
      problem: mastered,
      triggerReason: 'prerequisite_reinforcement',
      connectedProblems,
      aggregateStrength,
      finalScore,
      triggeredBy
    });
  }

  scoredCandidates.sort((a, b) => b.finalScore - a.finalScore);
  return scoredCandidates.slice(0, 2);
}

export async function findPrerequisiteProblem(problemId, excludeIds = []) {
  if (!problemId) return null;

  try {
    const skippedProblem = await fetchProblemById(Number(problemId));
    if (!skippedProblem) return null;

    const skippedTags = skippedProblem.Tags || skippedProblem.tags || [];
    const skippedDifficulty = skippedProblem.difficulty || 'Medium';
    const difficultyOrder = { 'Easy': 0, 'Medium': 1, 'Hard': 2 };
    const skippedDiffNum = difficultyOrder[skippedDifficulty] ?? 1;

    const problemRelationships = await getRelationshipsForProblem(Number(problemId));
    const relatedIds = Object.keys(problemRelationships).map(Number);

    const excludeSet = new Set(excludeIds.map(Number));
    excludeSet.add(Number(problemId));

    // Look up each related problem from standard_problems and score them
    const candidates = [];

    for (const relId of relatedIds) {
      if (excludeSet.has(relId)) continue;

      const candidate = await fetchProblemById(relId);
      if (!candidate) continue;

      const candDiffNum = difficultyOrder[candidate.difficulty] ?? 1;

      // Must be same or easier difficulty than the skipped problem
      if (candDiffNum > skippedDiffNum) continue;

      const candTags = candidate.Tags || candidate.tags || [];
      const sharedTags = candTags.filter(t => skippedTags.includes(t));
      const relationshipStrength = problemRelationships[relId] || 0;

      // Score: relationship strength (primary), tag overlap, difficulty bonus
      const strengthScore = relationshipStrength / 5.0; // Normalize to 0-1
      const tagScore = sharedTags.length / Math.max(skippedTags.length, 1);
      const difficultyBonus = candDiffNum < skippedDiffNum ? 0.2 : 0;

      candidates.push({
        problem: candidate,
        score: strengthScore * 0.5 + tagScore * 0.3 + difficultyBonus + 0.2
      });
    }

    candidates.sort((a, b) => b.score - a.score);

    if (candidates.length === 0) return null;

    const best = candidates[0];

    // Enrich with user attempt data so the UI shows correct status instead of "NEW"
    try {
      const db = await openDB();
      const tx = db.transaction("problems", "readonly");
      const store = tx.objectStore("problems");
      const index = store.index("by_leetcode_id");
      const userProblem = await new Promise((resolve, reject) => {
        const req = index.get(Number(best.problem.leetcode_id || best.problem.id));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      if (userProblem) return { ...best.problem, ...userProblem };
    } catch (err) {
      console.warn("Could not enrich prerequisite with user data:", err.message);
    }

    return best.problem;
  } catch (error) {
    console.error("❌ Error finding prerequisite:", error);
    return null;
  }
}
