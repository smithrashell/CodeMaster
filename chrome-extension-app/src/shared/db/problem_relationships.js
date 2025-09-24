import { getTagMastery } from "./tag_mastery.js";
import { calculateTagSimilarity } from "./tag_mastery.js";
import { fetchAllProblems } from "./problems.js";
import { dbHelper } from "./index.js";
import { calculateSuccessRate } from "../utils/Utils.js";
import { getSessionPerformance } from "../db/sessions.js";

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

  // Load all previously attempted problems from the `problems` store
  const allAttemptedProblems = await fetchAllProblems(); // ✅ Ensures all past attempts are included
  const attemptedProblemIds = new Set([
    ...allAttemptedProblems.map((p) => p.leetcode_id),
    ...session.attempts.map((a) => a.problem_id),
  ]);

  console.log(
    "Attempted Problems (session + past attempts):",
    attemptedProblemIds
  );

  const _tagMastery = await getTagMastery(); // Fetch user's tag mastery state

  for (const attempt of session.attempts) {
    const { problem_id } = attempt;

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
    console.log("problem", problem);
    // === Dynamic Relationship Updates ===
    // Phase 2: Update relationship strengths based on user success patterns
    console.log(`🔄 Processing problem ${problem_id} for dynamic relationship updates`);

    try {
      await updateSuccessPatterns(problem, attempt);
      console.log(`✅ Problem ${problem_id} dynamic relationships updated successfully`);
    } catch (error) {
      console.error(`❌ Error updating success patterns for problem ${problem_id}:`, error);
      // Continue execution - don't fail entire session update for relationship errors
    }
  }

  console.log("Problem relationships updated successfully.");
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

      console.log(`⚡ Loaded ${strengthMap.size} relationship strengths for batch processing`);
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

/**
 * Simple plateau detection using existing performance data
 * @returns {Promise<boolean>} True if user might be plateauing
 */
async function detectSimplePlateau() {
  try {
    const recentPerformance = await getSessionPerformance({ recentSessionsLimit: 3 });
    if (!recentPerformance || recentPerformance.accuracy === undefined) {
      return false; // No data, assume not plateauing
    }

    // Simple plateau detection: low accuracy with recent activity
    const isLowAccuracy = recentPerformance.accuracy < 0.6;
    const hasRecentActivity = recentPerformance.Easy?.attempts > 0 ||
                             recentPerformance.Medium?.attempts > 0 ||
                             recentPerformance.Hard?.attempts > 0;

    return isLowAccuracy && hasRecentActivity;
  } catch (error) {
    console.warn("⚠️ Plateau detection failed, assuming no plateau:", error.message);
    return false;
  }
}

/**
 * Calculate optimal path score for a problem based on user's recent successes
 * Core Phase 3 implementation for personalized session composition
 * @param {Object} problem - Candidate problem to score
 * @param {Object} userState - Current user state (can be null)
 * @param {Object} cachedData - Pre-computed data to avoid repeated database calls
 * @returns {Promise<number>} Optimal path score (higher = better fit)
 */
export async function calculateOptimalPathScore(problem, userState = null, cachedData = {}) {
  try {
    let score = 1.0; // Base score

    // Factor 1: Relationship strength from recent successes
    const recentSuccesses = cachedData.recentSuccesses || await getUserRecentAttempts(5);
    const relationshipMap = cachedData.relationshipMap || new Map();
    let avgRelationshipStrength = 0;

    if (recentSuccesses.length > 0) {
      let totalStrength = 0;
      let relationshipCount = 0;

      for (const recentProblem of recentSuccesses) {
        const relationshipKey = `${recentProblem.leetcode_id}-${problem.id || problem.leetcode_id}`;
        let strength = relationshipMap.get(relationshipKey);

        if (strength !== undefined) {
          totalStrength += strength;
          relationshipCount++;
        } else {
          // Default neutral strength for new relationships
          totalStrength += 2.0;
          relationshipCount++;
        }
      }

      if (relationshipCount > 0) {
        avgRelationshipStrength = totalStrength / relationshipCount;
        score *= (avgRelationshipStrength / 3.0); // Normalize around 1.0 (3.0 is mid-range)
      }
    }

    // Factor 2: Tag mastery alignment (if userState provided)
    if (userState && userState.tagMastery) {
      const tagMasteryBonus = calculateTagMasteryAlignment(problem, userState);
      score *= tagMasteryBonus;
    }

    // Factor 3: Recent problem diversity bonus (avoid repetition)
    const diversityBonus = calculateDiversityBonus(problem, recentSuccesses);
    score *= diversityBonus;

    // Factor 4: Plateau detection - encourage harder challenges if plateauing
    const isPlateauing = cachedData.isPlateauing !== undefined ? cachedData.isPlateauing : await detectSimplePlateau();
    if (isPlateauing && problem.difficulty === 'Hard') {
      score *= 1.2; // Boost hard problems when plateauing
      console.log(`🚀 Plateau detection: Boosting Hard problem for breakthrough`);
    } else if (isPlateauing && problem.difficulty === 'Easy') {
      score *= 0.8; // Reduce easy problems when plateauing
    }

    console.log(`🎯 Optimal path score for problem ${problem.id || problem.leetcode_id}: ${score.toFixed(3)} (relationship: ${avgRelationshipStrength.toFixed(2)}, diversity: ${diversityBonus.toFixed(2)}, plateau: ${isPlateauing})`);

    return Math.max(0.1, Math.min(5.0, score)); // Bound score between 0.1 and 5.0
  } catch (error) {
    console.error("❌ Error calculating optimal path score:", error);
    return 1.0; // Return neutral score on error
  }
}

/**
 * Calculate tag mastery alignment bonus for optimal path scoring
 * @param {Object} problem - Problem to score
 * @param {Object} userState - User state with tag mastery data
 * @returns {number} Tag mastery alignment bonus (0.5 to 1.5)
 */
function calculateTagMasteryAlignment(problem, userState) {
  if (!problem.tags || !userState.tagMastery) {
    return 1.0; // Neutral if no tag data
  }

  let alignmentScore = 1.0;
  let tagCount = 0;

  for (const tag of problem.tags) {
    const mastery = userState.tagMastery[tag];
    if (mastery) {
      tagCount++;
      if (mastery.mastered) {
        // Mastered tags: slight penalty to encourage exploration
        alignmentScore *= 0.95;
      } else if (mastery.successRate > 0.7) {
        // High success rate: good fit
        alignmentScore *= 1.2;
      } else if (mastery.successRate > 0.4) {
        // Medium success rate: optimal challenge
        alignmentScore *= 1.3;
      } else if (mastery.attempts < 3) {
        // Exploration bonus: uncharted territory with high potential
        alignmentScore *= 1.4;
        console.log(`🔍 Exploration bonus applied for tag: ${tag} (${mastery.attempts} attempts)`);
      } else {
        // Low success rate with multiple attempts: might be too difficult
        alignmentScore *= 0.8;
      }
    } else {
      // Unknown tag - moderate exploration bonus
      alignmentScore *= 1.2;
      console.log(`🔍 Unknown tag exploration bonus: ${tag}`);
    }
  }

  // Boost problems with known tags
  if (tagCount > 0) {
    alignmentScore *= 1.1;
  }

  return Math.max(0.5, Math.min(1.5, alignmentScore));
}

/**
 * Calculate diversity bonus to avoid repetitive problem selection
 * @param {Object} problem - Problem to score
 * @param {Array} recentSuccesses - Recent successful attempts
 * @returns {number} Diversity bonus (0.7 to 1.3)
 */
function calculateDiversityBonus(problem, recentSuccesses) {
  if (!problem.tags || recentSuccesses.length === 0) {
    return 1.0; // Neutral if no comparison data
  }

  // Check tag overlap with recent problems
  const recentTags = new Set();
  recentSuccesses.forEach(recent => {
    if (recent.tags) {
      recent.tags.forEach(tag => recentTags.add(tag));
    }
  });

  const problemTags = new Set(problem.tags);
  const overlap = [...problemTags].filter(tag => recentTags.has(tag)).length;
  const totalUniqueTags = problemTags.size;

  if (totalUniqueTags === 0) {
    return 1.0;
  }

  const overlapRatio = overlap / totalUniqueTags;

  // Diversity scoring: less overlap = higher bonus
  if (overlapRatio <= 0.2) {
    return 1.3; // High diversity bonus
  } else if (overlapRatio <= 0.5) {
    return 1.1; // Medium diversity bonus
  } else if (overlapRatio <= 0.8) {
    return 0.9; // Slight penalty for high overlap
  } else {
    return 0.7; // Penalty for very high overlap
  }
}

/**
 * Select optimal problems from candidates using relationship scoring
 * Main Phase 3 function for intelligent session composition
 * @param {Array} candidateProblems - Array of candidate problems
 * @param {Object} userState - Current user state
 * @returns {Promise<Array>} Selected problems sorted by optimal path score
 */
export async function selectOptimalProblems(candidateProblems, userState = null) {
  try {
    console.log(`🧮 Scoring ${candidateProblems.length} candidate problems for optimal session composition`);

    // Pre-compute ALL shared data to avoid repeated database calls
    const [recentSuccesses, relationshipMap, isPlateauing] = await Promise.all([
      getUserRecentAttempts(5),
      getAllRelationshipStrengths(),
      detectSimplePlateau()
    ]);

    const cachedData = {
      recentSuccesses,
      relationshipMap,
      isPlateauing
    };

    console.log(`⚡ Cached shared data: ${cachedData.recentSuccesses.length} recent successes, ${cachedData.relationshipMap.size} relationships, plateau: ${cachedData.isPlateauing}`);

    const scoredProblems = [];

    for (const problem of candidateProblems) {
      const score = await calculateOptimalPathScore(problem, userState, cachedData);
      scoredProblems.push({
        ...problem,
        pathScore: score,
        optimalPathData: {
          scoredAt: new Date().toISOString(),
          version: "1.0"
        }
      });
    }

    // Return highest-scoring problems for session
    const sortedProblems = scoredProblems
      .sort((a, b) => b.pathScore - a.pathScore);

    console.log(`✅ Problems scored and sorted. Top 3 scores: ${sortedProblems.slice(0, 3).map(p => `${p.id || p.leetcode_id}:${p.pathScore.toFixed(2)}`).join(', ')}`);

    return sortedProblems;
  } catch (error) {
    console.error("❌ Error in selectOptimalProblems:", error);
    // Fallback: return candidates unsorted
    return candidateProblems;
  }
}

/**
 * Score candidate problems based on their relationships to recently attempted problems
 * Used by pattern ladder system for intelligent problem selection
 */
export async function scoreProblemsWithRelationships(candidateProblems, recentAttempts, maxLookback = 5) {
  try {
    const problemGraph = await buildRelationshipMap();

    // Get recently attempted problem IDs (last N problems)
    const recentProblemIds = recentAttempts
      .slice(-maxLookback)
      .map(attempt => attempt.leetcode_id)
      .filter(id => id != null);

    console.log(`🔗 Scoring ${candidateProblems.length} candidates against ${recentProblemIds.length} recent problems`);

    return candidateProblems.map(candidate => {
      const candidateId = candidate.id || candidate.leetcode_id;
      let relationshipScore = 0;
      let relationshipCount = 0;

      // Calculate relationship strength to recent problems
      recentProblemIds.forEach(recentId => {
        const relationships = problemGraph.get(recentId);
        if (relationships && relationships[candidateId]) {
          relationshipScore += relationships[candidateId];
          relationshipCount++;
        }

        // Also check reverse relationships
        const candidateRelationships = problemGraph.get(candidateId);
        if (candidateRelationships && candidateRelationships[recentId]) {
          relationshipScore += candidateRelationships[recentId];
          relationshipCount++;
        }
      });

      // Average relationship strength
      const avgRelationshipScore = relationshipCount > 0 ? relationshipScore / relationshipCount : 0;

      return {
        ...candidate,
        relationshipScore: avgRelationshipScore,
        relationshipCount: relationshipCount
      };
    });
  } catch (error) {
    console.error("❌ Error scoring problems with relationships:", error);
    // Return candidates without relationship scoring as fallback
    return candidateProblems.map(candidate => ({
      ...candidate,
      relationshipScore: 0,
      relationshipCount: 0
    }));
  }
}

export async function buildRelationshipMap() {
  const db = await openDB();
  const tx = db.transaction("problem_relationships", "readonly");
  const store = tx.objectStore("problem_relationships");
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const graph = new Map();

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

      console.log("✅ Problem relationships loaded:", graph.size, "problems with relationships");
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
    console.log(`🧠 Learning from attempt: ${completedProblem.leetcode_id || completedProblem.id} (success: ${attempt.success})`);

    // Get recent successful attempts for pattern analysis
    const recentProblems = await getUserRecentAttempts(5);

    if (recentProblems.length === 0) {
      console.log("📝 No recent successful attempts found for relationship learning");
      return;
    }

    console.log(`🔗 Analyzing relationships between ${recentProblems.length} recent problems and current problem`);

    // Determine timing performance - get recommended time based on difficulty
    const recommendedTime = getRecommendedTimeForDifficulty(completedProblem.difficulty || 'Medium');

    for (const recentProblem of recentProblems) {
      // Skip self-relationships
      if (recentProblem.leetcode_id === (completedProblem.leetcode_id || completedProblem.id)) {
        continue;
      }

      const currentStrength = await getRelationshipStrength(
        recentProblem.leetcode_id,
        completedProblem.leetcode_id || completedProblem.id
      );

      let strengthDelta = 0;
      const timeSpent = attempt.time_spent || 0;

      if (attempt.success && timeSpent <= recommendedTime) {
        // Great transition - strengthen relationship significantly
        strengthDelta = +0.3;
        console.log(`✅ Excellent transition: ${recentProblem.leetcode_id} → ${completedProblem.leetcode_id || completedProblem.id} (+0.3)`);
      } else if (attempt.success && timeSpent <= recommendedTime * 1.3) {
        // Good transition - modest strengthening
        strengthDelta = +0.1;
        console.log(`✅ Good transition: ${recentProblem.leetcode_id} → ${completedProblem.leetcode_id || completedProblem.id} (+0.1)`);
      } else if (!attempt.success || timeSpent > recommendedTime * 1.5) {
        // Difficult transition - weaken relationship
        strengthDelta = -0.4;
        console.log(`❌ Difficult transition: ${recentProblem.leetcode_id} → ${completedProblem.leetcode_id || completedProblem.id} (-0.4)`);
      } else {
        // Neutral transition - small positive adjustment
        strengthDelta = +0.05;
        console.log(`➡️ Neutral transition: ${recentProblem.leetcode_id} → ${completedProblem.leetcode_id || completedProblem.id} (+0.05)`);
      }

      // Apply confidence-based learning using existing calculateSuccessRate
      const recentAttemptCount = Math.min(recentProblems.length, 5);
      const successCount = recentProblems.length; // All recent attempts are successful
      const confidence = calculateSuccessRate(successCount, Math.max(recentAttemptCount, 3));
      const confidenceMultiplier = Math.max(0.3, Math.min(1.0, confidence)); // 30%-100% confidence

      // Reduce volatile updates with low confidence
      strengthDelta *= confidenceMultiplier;

      console.log(`🎯 Confidence adjustment: ${confidenceMultiplier.toFixed(2)} (${successCount}/${recentAttemptCount} recent success rate)`);

      // Calculate new strength with bounds checking and gentle decay toward neutral
      const baseStrength = currentStrength || 2.0; // Default neutral strength

      // Apply gentle decay toward neutral (2.0) to prevent extreme values
      const neutralDecay = (2.0 - baseStrength) * 0.05; // 5% pull toward neutral
      const adjustedStrength = baseStrength + neutralDecay + strengthDelta;

      // Enforce reasonable bounds (0.5 to 5.0)
      const newStrength = Math.max(0.5, Math.min(5.0, adjustedStrength));

      console.log(`📊 Strength update: ${baseStrength.toFixed(2)} → ${newStrength.toFixed(2)} (delta: ${strengthDelta.toFixed(2)}, decay: ${neutralDecay.toFixed(2)})`);

      await updateRelationshipStrength(
        recentProblem.leetcode_id,
        completedProblem.leetcode_id || completedProblem.id,
        newStrength
      );
    }

    console.log(`🎯 Success pattern learning completed for problem ${completedProblem.leetcode_id || completedProblem.id}`);
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
  console.log("problems", problemsArray);
  // 🔹 Step 1: Ensure every problem appears in `problem_relationships`
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
