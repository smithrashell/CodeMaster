import { getAllStandardProblems } from "./standard_problems.js";
import { getTagRelationships } from "./tag_mastery";
import { getTagMastery } from "./tag_mastery.js";
import { calculateTagSimilarity } from "./tag_mastery.js";
import { TagService } from "../services/tagServices.js";
import { fetchAllProblems } from "./problems.js";
const getCurrentLearningState = TagService.getCurrentLearningState;
import { dbHelper } from "./index.js";
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

    const relationship = { problemId1, problemId2, strength };
    const request = store.add(relationship);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const weakenProblemRelationship = async (problemId1, problemId2) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("problem_relationships", "readwrite");
    const store = transaction.objectStore("problem_relationships");

    const index = store.index("by_problemId1");
    const request = index.get(problemId1);

    request.onsuccess = (event) => {
      const entry = event.target.result;
      if (entry) {
        entry.strength = Math.max(entry.strength - 1, 0);
        store.put(entry);
        resolve(entry);
      } else {
        reject("No relationship found");
      }
    };
    request.onerror = () => reject(request.error);
  });
};

// export async function rebuildProblemRelationships() {
//   const db = await openDB();
//   const tx = db.transaction("problem_relationships", "readwrite");
//   const store = tx.objectStore("problem_relationships");

//   // Fetch necessary data
//   const problems = await getAllStandardProblems();
//   const tagGraph = await getTagRelationships();
//   const tagMastery = await getTagMastery();

//   const problemGraph = new Map();

//   // Compute Relationships
//   problems.forEach((problem1) => {
//     problemGraph.set(problem1.id, []);

//     problems.forEach((problem2) => {
//       if (problem1.id !== problem2.id) {
//         const similarity = calculateTagSimilarity(
//           problem1.tags,
//           problem2.tags,
//           tagGraph,
//           tagMastery,
//           problem1.difficulty,
//           problem2.difficulty
//         );

//         if (similarity > 0) {
//           problemGraph.get(problem1.id).push({
//             problemId1: problem1.id,
//             problemId2: problem2.id,
//             strength: similarity,
//           });
//         }
//       }
//     });
//   });

//   // Keep only the strongest relationships (top 3 per problem)
//   const batchWritePromises = [];

//   for (const [problemId, relationships] of problemGraph.entries()) {
//     relationships.sort((a, b) => b.strength - a.strength);
//     const strongestRelationships = relationships.slice(0, 3);

//     strongestRelationships.forEach((relationship) => {
//       batchWritePromises.push(
//         new Promise((resolve, reject) => {
//           const request = store.put(relationship);
//           request.onsuccess = resolve;
//           request.onerror = () => reject(request.error);
//         })
//       );
//     });
//   }

//   // ✅ Ensure all writes complete before finishing transaction
//   await Promise.all(batchWritePromises);

//   console.log("✅ Problem relationships successfully rebuilt.");
// }
// export async function rebuildProblemRelationships() {
//   const db = await openDB();

//   // Open a transaction to clear previous data
//   const clearTx = db.transaction("problem_relationships", "readwrite");
//   const clearStore = clearTx.objectStore("problem_relationships");
//   await new Promise((resolve, reject) => {
//     const clearRequest = clearStore.clear();
//     clearRequest.onsuccess = resolve;
//     clearRequest.onerror = () => reject(clearRequest.error);
//   });

//   console.log("✅ Cleared old problem relationships.");

//   // Fetch necessary data
//   const problems = await getAllStandardProblems();
//   const tagGraph = await getTagRelationships();
//   const tagMastery = await getTagMastery();

//   const problemGraph = new Map();

//   // Compute Relationships
//   problems.forEach((problem1) => {
//     problemGraph.set(problem1.id, []);

//     problems.forEach((problem2) => {
//       if (problem1.id !== problem2.id) {
//         const similarity = calculateTagSimilarity(
//           problem1.tags,
//           problem2.tags,
//           tagGraph,
//           tagMastery,
//           problem1.difficulty,
//           problem2.difficulty
//         );

//         if (similarity > 0) {
//           problemGraph.get(problem1.id).push({
//             problemId1: problem1.id,
//             problemId2: problem2.id,
//             strength: similarity,
//           });
//         }
//       }
//     });
//   });

//   // Keep only the strongest relationships (top 3 per problem)
//   for (const [problemId, relationships] of problemGraph.entries()) {
//     relationships.sort((a, b) => b.strength - a.strength);
//     const strongestRelationships = relationships.slice(0, 3);

//     for (const relationship of strongestRelationships) {
//       await new Promise((resolve, reject) => {
//         const tx = db.transaction("problem_relationships", "readwrite"); // ✅ New transaction for each `.put()`
//         const store = tx.objectStore("problem_relationships");

//         const request = store.put({
//           problemId1: relationship.problemId1,
//           problemId2: relationship.problemId2,
//           strength: relationship.strength,
//         });

//         request.onsuccess = resolve;
//         request.onerror = () => reject(request.error);
//       });
//     }
//   }

//   console.log("✅ Problem relationships successfully rebuilt.");
// }
export async function rebuildProblemRelationships() {
  const db = await openDB();
  const RELATIONSHIP_LIMIT = 10; // 🔹 Adjustable limit

  // Clear previous relationships
  const clearTx = db.transaction("problem_relationships", "readwrite");
  const clearStore = clearTx.objectStore("problem_relationships");
  await new Promise((resolve, reject) => {
    const clearRequest = clearStore.clear();
    clearRequest.onsuccess = resolve;
    clearRequest.onerror = () => reject(clearRequest.error);
  });

  console.log("✅ Cleared old problem relationships.");

  // Fetch all problems and related data

  const removedRelationships = new Map(); // Store removed relationships
  let missingProblems = new Set();

  // Compute problem relationships
  // Fetch all problems
  const problems = await getAllStandardProblems();
  const tagGraph = await getTagRelationships();
  const tagMastery = await getTagMastery();

  const problemGraph = new Map();
  const difficultyMap = { Easy: 1, Medium: 2, Hard: 3 };

  problems.forEach((problem1) => {
    problemGraph.set(problem1.id, []);

    problems.forEach((problem2) => {
      if (problem1.id !== problem2.id) {
        const similarity = calculateTagSimilarity(
          problem1.tags,
          problem2.tags,
          tagGraph,
          tagMastery,
          problem1.difficulty,
          problem2.difficulty
        );

        const d1 = difficultyMap[problem1.difficulty] || 2;
        const d2 = difficultyMap[problem2.difficulty] || 2;

        if (similarity > 0 && d1 <= d2) {
          // ✅ Prevents Hard → Easy relationships
          problemGraph.get(problem1.id).push({
            problemId1: problem1.id,
            problemId2: problem2.id,
            strength: similarity,
          });
        }
      }
    });
  });

  // Keep only the top `RELATIONSHIP_LIMIT` strongest relationships per problem
  for (const [problemId, relationships] of problemGraph.entries()) {
    relationships.sort((a, b) => b.strength - a.strength);

    if (relationships.length > RELATIONSHIP_LIMIT) {
      // Store removed relationships in a Map in case they are needed later
      removedRelationships.set(
        problemId,
        relationships.slice(RELATIONSHIP_LIMIT)
      );
    }

    // Trim to the strongest `N` connections
    problemGraph.set(problemId, relationships.slice(0, RELATIONSHIP_LIMIT));
  }

  // 🔹 Step 2: Ensure every problem appears in `problem_relationships`
  for (const problem of problems) {
    if (
      !problemGraph.has(problem.id) ||
      problemGraph.get(problem.id).length === 0
    ) {
      console.warn(
        `⚠️ Problem ${problem.id} has no relationships after filtering. Checking stored relationships.`
      );
      missingProblems.add(problem.id);

      // Check if any removed relationships can be re-added
      if (removedRelationships.has(problem.id)) {
        console.log(
          `🔄 Restoring relationships for problem ${problem.id} from removed relationships.`
        );
        problemGraph.set(
          problem.id,
          removedRelationships.get(problem.id).slice(0, 1)
        ); // Re-add at least one
      } else {
        // Use fallback connection if no stored relationships exist
        const fallbackProblem = problems.find(
          (p) =>
            p.id !== problem.id &&
            p.tags.some((tag) => problem.tags.includes(tag))
        );

        if (fallbackProblem) {
          console.log(
            `🛠️ Assigning fallback for problem ${problem.id} → ${fallbackProblem.id}`
          );
          problemGraph.set(problem.id, [
            {
              problemId1: problem.id,
              problemId2: fallbackProblem.id,
              strength: 1, // Weakest connection
            },
          ]);
        }
      }
    }
  }

  console.log(
    `🔹 ${missingProblems.size} problems were missing relationships and had them restored or assigned a fallback.`
  );
  console.log(`📝 Missing problems:`, Array.from(missingProblems));

  if (removedRelationships.size > 0) {
    console.warn(
      `⚠️ Some relationships were initially removed but restored as needed.`
    );
    removedRelationships.forEach((removed, problemId) => {
      console.warn(
        `🚨 Problem ${problemId} had ${removed.length} relationships removed, but some were restored.`
      );
    });
  }

  // 🔹 Step 3: Store relationships in IndexedDB
  for (const [problemId, relationships] of problemGraph.entries()) {
    for (const relationship of relationships) {
      await new Promise((resolve, reject) => {
        const tx = db.transaction("problem_relationships", "readwrite");
        const store = tx.objectStore("problem_relationships");

        const request = store.put({
          problemId1: relationship.problemId1,
          problemId2: relationship.problemId2,
          strength: relationship.strength,
        });

        request.onsuccess = resolve;
        request.onerror = () => reject(request.error);
      });
    }
  }

  console.log("✅ Problem relationships successfully rebuilt.");
}

export async function updateProblemRelationships(session) {
  const db = await openDB();

  // Load all previously attempted problems from the `problems` store
  const allAttemptedProblems = await fetchAllProblems(); // ✅ Ensures all past attempts are included
  const attemptedProblemIds = new Set([
    ...allAttemptedProblems.map((p) => p.leetCodeID),
    ...session.attempts.map((a) => a.problemId),
  ]);

  console.log(
    "Attempted Problems (session + past attempts):",
    attemptedProblemIds
  );

  const tagMastery = await getTagMastery(); // Fetch user's tag mastery state

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
    console.log("problem", problem);
    const nextProblemId = problem.NextProblem;

    // === Direct Updates: A → B ===
    if (nextProblemId && attemptedProblemIds.has(nextProblemId)) {
      const relationshipKey = [problemId, nextProblemId];
      const relationship = await new Promise((resolve, reject) => {
        const request = relationshipsStore.get(relationshipKey);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (relationship) {
        const weightAdjustment = success ? 1 : -0.5;
        let tagEffect = 0;

        // Adjust weight based on tag mastery
        problem.tags.forEach((tag) => {
          if (tagMastery[tag] && !tagMastery[tag].mastered) {
            tagEffect += tagMastery[tag].decayScore * 0.5;
          } else if (tagMastery[tag] && tagMastery[tag].mastered) {
            tagEffect -= 0.2;
          }
        });

        const updatedWeight = Math.max(
          0,
          (relationship.weight || 0) + weightAdjustment + tagEffect
        );

        const updatedRelationship = {
          problemId1: problemId,
          problemId2: nextProblemId,
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
      let tagEffect = 0;

      // Adjust weight based on tag mastery
      problem.tags.forEach((tag) => {
        if (tagMastery[tag] && !tagMastery[tag].mastered) {
          tagEffect += tagMastery[tag].decayScore * 0.5;
        } else if (tagMastery[tag] && tagMastery[tag].mastered) {
          tagEffect -= 0.2;
        }
      });

      const updatedWeight = Math.max(
        0,
        (rel.weight || 0) + weightAdjustment + tagEffect
      );

      const updatedRelationship = {
        ...rel,
        weight: updatedWeight,
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
    console.log("problem.leetCodeID", problem.leetCodeID);
    // === Update NextProblem Property Based on Relationship Strength ===
    const updatedNextProblem = await determineNextProblem(
      problem.leetCodeID,
      attemptedProblemIds
    );

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

// export async function updateProblemRelationships(session) {
//     const db = await openDB();
//   const attemptedProblems = new Set(session.attempts.map((a) => a.problemId));
//   console.log("attemptedProblems", attemptedProblems);

//   for (const attempt of session.attempts) {
//     const { problemId, success } = attempt;

//     // Create a new transaction for each problem operation
//     const transaction = db.transaction(
//       ["problem_relationships", "sessions", "problems"],
//       "readwrite"
//     );
//     const relationshipsStore = transaction.objectStore("problem_relationships");
//     const problemsStore = transaction.objectStore("problems");

//     // Fetch the problem
//     const problem = await new Promise((resolve, reject) => {
//       const request = problemsStore.get(problemId);
//       request.onsuccess = () => resolve(request.result);
//       request.onerror = () => reject(request.error);
//     });

//     if (!problem) continue;

//     const nextProblemId = problem.NextProblem;

//     // === Direct Updates: A → B ===
//     if (nextProblemId && attemptedProblems.has(nextProblemId)) {
//       const relationshipKey = [problemId, nextProblemId];
//       const relationship = await new Promise((resolve, reject) => {
//         const request = relationshipsStore.get(relationshipKey);
//         request.onsuccess = () => resolve(request.result);
//         request.onerror = () => reject(request.error);
//       });

//       if (relationship) {
//         const weightAdjustment = success ? 1 : -0.5;
//         const updatedWeight = (relationship.weight || 0) + weightAdjustment;

//         const updatedRelationship = {
//           problemId1: problemId,
//           problemId2: nextProblemId,
//           weight: Math.max(0, updatedWeight),
//         };

//         await new Promise((resolve, reject) => {
//           const putRequest = relationshipsStore.put(updatedRelationship);
//           putRequest.onsuccess = resolve;
//           putRequest.onerror = () => reject(putRequest.error);
//         });

//         console.log(
//           `Updated direct relationship: ${problemId} → ${nextProblemId} | New Weight: ${updatedRelationship.weight}`
//         );
//       }
//     }

//     // === Indirect Updates: X → A ===
//     const reverseRelationships = await new Promise((resolve, reject) => {
//       const indexRequest = relationshipsStore
//         .index("by_problemId2")
//         .getAll(problemId);
//       indexRequest.onsuccess = () => resolve(indexRequest.result);
//       indexRequest.onerror = () => reject(indexRequest.error);
//     });

//     for (const rel of reverseRelationships) {
//       const weightAdjustment = success ? 1 : -0.5;
//       const updatedWeight = (rel.weight || 0) + weightAdjustment;

//       const updatedRelationship = {
//         ...rel,
//         weight: Math.max(0, updatedWeight),
//       };

//       await new Promise((resolve, reject) => {
//         const putRequest = relationshipsStore.put(updatedRelationship);
//         putRequest.onsuccess = resolve;
//         putRequest.onerror = () => reject(putRequest.error);
//       });

//       console.log(
//         `Updated reverse relationship: ${rel.problemId1} → ${problemId} | New Weight: ${updatedRelationship.weight}`
//       );
//     }

//     // === Update NextProblem Property ===
//     const updatedNextProblem = await determineNextProblem(problemId, attemptedProblems);

//     if (updatedNextProblem && updatedNextProblem !== nextProblemId) {
//       problem.NextProblem = updatedNextProblem;

//       await new Promise((resolve, reject) => {
//         const putRequest = problemsStore.put(problem);
//         putRequest.onsuccess = resolve;
//         putRequest.onerror = () => reject(putRequest.error);
//       });

//       console.log(
//         `Updated NextProblem for ${problemId} to ${problem.NextProblem}`
//       );
//     }
//   }

//   console.log("Problem relationships and NextProblem updated successfully.");
// }

// export async function findBestNextProblem(attemptedProblems = new Set()) {
//   const db = await openDB();

//   // ✅ Fetch user’s active learning state
//   const { unmasteredTags } = await getCurrentLearningState();
//   console.log(`🎯 Finding problem matching tags:`, unmasteredTags);

//   // ✅ Fetch all problem relationships
//   const relationshipsStore = db
//     .transaction("problem_relationships", "readonly")
//     .objectStore("problem_relationships");
//   const relationships = await new Promise((resolve, reject) => {
//     const request = relationshipsStore.getAll();
//     request.onsuccess = () => resolve(request.result || []);
//     request.onerror = () => reject(request.error);
//   });

//   if (!relationships.length) {
//     console.warn(`❌ No problem relationships found.`);
//     return null;
//   }

//   // ✅ Prioritize problems that match active learning tags
//   relationships.sort((a, b) => {
//     const aTagMatch = (a.tags || []).filter((tag) =>
//       unmasteredTags.includes(tag)
//     ).length;
//     const bTagMatch = (b.tags || []).filter((tag) =>
//       unmasteredTags.includes(tag)
//     ).length;
//     return bTagMatch - aTagMatch || b.strength - a.strength;
//   });

//   for (const relationship of relationships) {
//     const nextProblemId = relationship.problemId2;
//     if (attemptedProblems.has(nextProblemId)) continue;

//     console.log(`🔍 Trying next best problem: ${nextProblemId}`);

//     // ✅ Fetch problem in a fresh transaction
//     const nextProblemExists = await new Promise((resolve) => {
//       const tx = db.transaction("problems", "readonly");
//       const store = tx.objectStore("problems");
//       const request = store.get(nextProblemId);

//       request.onsuccess = () => resolve(!!request.result);
//       request.onerror = () => resolve(false);
//     });

//     if (nextProblemExists) {
//       console.log(`✅ Selected best-fit problem: ${nextProblemId}`);
//       return nextProblemId;
//     }
//   }

//   console.warn(`⚠️ No best-fit problems found. Using fallback.`);

//   // ✅ Step 4: Fall back to `standard_problems` if needed
//   const allProblems = await getAllStandardProblems();
//   const unattemptedProblems = allProblems.filter(
//     (p) => !attemptedProblems.has(p.id)
//   );

//   if (unattemptedProblems.length > 0) {
//     const fallbackProblem =
//       unattemptedProblems[
//         Math.floor(Math.random() * unattemptedProblems.length)
//       ];
//     console.log(`✅ Fallback problem selected: ${fallbackProblem.id}`);
//     return fallbackProblem.id;
//   }

//   console.warn(`❌ No fallback problems available. Returning null.`);
//   return null;
// }
// 🔹 Persistent set to track problems across multiple function calls
export async function findBestNextProblem(
  attemptedProblems,
  updateAttemptedCallback
) {
  const db = await openDB();

  // ✅ Fetch user’s active learning state
  const { unmasteredTags, tagsinTier } = await getCurrentLearningState();
  console.log(`🎯 Finding problem matching focus tags:`, unmasteredTags);
  console.log(`🌍 Including tier-wide tags:`, tagsinTier);
  console.log(`📝 Attempted Problems (Before Selection):`, attemptedProblems);

  // ✅ Fetch all problem relationships
  const relationshipsStore = db
    .transaction("problem_relationships", "readonly")
    .objectStore("problem_relationships");
  const relationships = await new Promise((resolve, reject) => {
    const request = relationshipsStore.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });

  if (!relationships.length) {
    console.warn(`❌ No problem relationships found.`);
    return null;
  }

  // ✅ Prioritize problems that match `unmasteredTags` and `tagsinTier`
  relationships.sort((a, b) => {
    const aFocusMatch = (a.tags || []).filter((tag) =>
      unmasteredTags.includes(tag)
    ).length;
    const bFocusMatch = (b.tags || []).filter((tag) =>
      unmasteredTags.includes(tag)
    ).length;
    const aTierMatch = (a.tags || []).filter((tag) =>
      tagsinTier.includes(tag)
    ).length;
    const bTierMatch = (b.tags || []).filter((tag) =>
      tagsinTier.includes(tag)
    ).length;

    return (
      bFocusMatch * 2 + bTierMatch - (aFocusMatch * 2 + aTierMatch) ||
      b.strength - a.strength
    );
  });

  console.log(
    `✅ Sorted ${relationships.length} relationships. Selecting best match...`
  );

  let selectedProblem = null;
  let maxAttempts = 3; // 🔹 Prevents infinite loops

  for (const relationship of relationships) {
    if (maxAttempts-- <= 0) break;

    const nextProblemId = relationship.problemId2;

    if (attemptedProblems.has(nextProblemId)) {
      console.log(`⏩ Skipping ${nextProblemId}, already attempted.`);
      continue;
    }

    console.log(`✅ Selected best-fit problem: ${nextProblemId}`);

    // ✅ Use callback to update `attemptedProblems`
    updateAttemptedCallback(nextProblemId);
    selectedProblem = nextProblemId;
    break; // ✅ Ensure the loop exits once we select a problem
  }

  if (!selectedProblem) {
    console.warn(`⚠️ No best-fit problems found. Using fallback.`);
  }

  // ✅ Step 4: Fall back to `standard_problems` if needed
  if (!selectedProblem) {
    const allProblems = await getAllStandardProblems();
    const unattemptedProblems = allProblems.filter(
      (p) => !attemptedProblems.has(p.id)
    );

    if (unattemptedProblems.length > 0) {
      selectedProblem =
        unattemptedProblems[
          Math.floor(Math.random() * unattemptedProblems.length)
        ];
      console.log(`✅ Fallback problem selected: ${selectedProblem}`);
      updateAttemptedCallback(selectedProblem);
    } else {
      console.warn(`❌ No fallback problems available. Returning null.`);
      return null;
    }
  }

  console.log(`📝 Attempted Problems (After Selection):`, attemptedProblems);
  return selectedProblem;
}


export async function determineNextProblem(
  problemId,
  attemptedProblems = new Set()
) {
  const db = await openDB();

  // ✅ Create a fresh transaction for each query
  const relationships = await new Promise((resolve, reject) => {
    const tx = db.transaction("problem_relationships", "readonly"); // Fresh transaction
    const store = tx.objectStore("problem_relationships");
    const request = store.index("by_problemId1").getAll(problemId);

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });

  if (!relationships.length) {
    console.warn(`❌ No relationships found for problem ${problemId}`);
    return null;
  }

  console.log(
    `✅ Found ${relationships.length} relationships for problem ${problemId}`
  );

  // Get user learning state
  const { unmasteredTags } = await getCurrentLearningState();

  // Prioritize problems that align with active unmastered tags
  relationships.sort((a, b) => {
    const aTagMatch = (a.tags || []).filter((tag) =>
      unmasteredTags.includes(tag)
    ).length;
    const bTagMatch = (b.tags || []).filter((tag) =>
      unmasteredTags.includes(tag)
    ).length;
    return bTagMatch - aTagMatch || b.strength - a.strength; // Sort by tag match first, then strength
  });

  // ✅ Create a fresh transaction for problems
  const problemsStore = db
    .transaction("problems", "readonly")
    .objectStore("problems");

  for (const relationship of relationships) {
    const nextProblemId = relationship.problemId2;
    if (attemptedProblems.has(nextProblemId)) continue;

    // ✅ Fetch problem in a fresh transaction
    const nextProblemExists = await new Promise((resolve) => {
      const tx = db.transaction("problems", "readonly");
      const store = tx.objectStore("problems");
      const request = store.get(nextProblemId);

      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => resolve(false);
    });

    if (nextProblemExists) {
      console.log(
        `✅ Next problem selected: ${nextProblemId} (Strength: ${relationship.strength})`
      );
      return nextProblemId;
    }
  }

  console.warn(`⚠️ All related problems for ${problemId} have been attempted.`);
  return null;
}

export async function buildProblemGraph() {
  const db = await openDB();
  const tx = db.transaction("problem_relationships", "readwrite");
  const store = tx.objectStore("problem_relationships");

  const problemGraph = new Map();
  const problems = await getAllStandardProblems();
  const tagRelationships = await getTagRelationships();
  const tagMastery = await getTagMastery();

  // Initialize Graph Nodes
  problems.forEach((problem) => {
    problemGraph.set(problem.id, { problem, edges: new Map() });
  });

  // Compute Relationships
  problems.forEach((problem1) => {
    problems.forEach((problem2) => {
      if (problem1.id !== problem2.id) {
        const similarity = calculateTagSimilarity(
          problem1.tags,
          problem2.tags,
          tagRelationships,
          tagMastery,
          problem1.difficulty,
          problem2.difficulty
        );
        if (similarity > 0) {
          problemGraph.get(problem1.id).edges.set(problem2.id, similarity);
        }
      }
    });
  });

  // Clear previous graph & Store new graph
  await store.clear();
  for (const [problemId, data] of problemGraph.entries()) {
    await store.put({
      problemId,
      edges: Array.from(data.edges.entries()), // Convert Map to array for storage
    });
  }

  console.log("✅ Problem Graph stored successfully.");
  return problemGraph;
}

export async function getProblemGraph() {
  const db = await openDB();
  const tx = db.transaction("problem_relationships", "readonly");
  const store = tx.objectStore("problem_relationships");
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const graph = new Map();

      request.result.forEach(({ problemId1, problemId2, strength }) => {
        // Initialize edges if not present
        if (!graph.has(problemId1)) {
          graph.set(problemId1, {
            problem: { id: problemId1 },
            edges: new Map(),
          });
        }

        // Add the edge (problemId2 -> strength)
        graph.get(problemId1).edges.set(problemId2, strength);
      });

      resolve(graph);
    };
    request.onerror = () => reject(request.error);
  });
}

// export async function rebuildProblemRelationships() {
//   const db = await openDB();
//   const problemGraph = await buildProblemGraph();

//   const tx = db.transaction("problems", "readwrite");
//   const store = tx.objectStore("problems");

//   for (let [problemId, data] of problemGraph.entries()) {
//     let sortedNeighbors = [...data.edges.entries()].sort((a, b) => b[1] - a[1]);
//     let nextProblemId =
//       sortedNeighbors.length > 0 ? sortedNeighbors[0][0] : null;

//     if (nextProblemId) {
//       const problem = data.problem;
//       problem.NextProblem = nextProblemId;
//       store.put(problem);
//     }
//   }

//   console.log("Problem relationships and next problems recalculated.");
// }

// export async function determineNextProblem( problemId) {
//   const db = await openDB();
//   // Open a new transaction for problem relationships and problems
//   const transaction = db.transaction(
//     ["problem_relationships", "problems"],
//     "readonly"
//   );
//   const relationshipsStore = transaction.objectStore("problem_relationships");
//   const problemsStore = transaction.objectStore("problems");

//   // Fetch all relationships where problemId is the source
//   const allRelatedRelationshipsRequest = relationshipsStore
//     .index("by_problemId1")
//     .getAll(problemId);

//   const allRelatedRelationships = await new Promise((resolve, reject) => {
//     allRelatedRelationshipsRequest.onsuccess = () =>
//       resolve(allRelatedRelationshipsRequest.result);
//     allRelatedRelationshipsRequest.onerror = () =>
//       reject(allRelatedRelationshipsRequest.error);
//   });

//   if (allRelatedRelationships.length === 0) {
//     console.log(`No relationships found for problem ${problemId}`);
//     return null;
//   }

//   // Sort relationships by weight (highest first)
//   const sortedRelationships = allRelatedRelationships.sort(
//     (a, b) => b.weight - a.weight
//   );

//   for (const relationship of sortedRelationships) {
//     const nextProblemId = relationship.problemId2;

//     // Check if the NextProblem has already been attempted
//     const problemRequest = problemsStore.get(nextProblemId);
//     const nextProblemExists = await new Promise((resolve) => {
//       problemRequest.onsuccess = () => resolve(!!problemRequest.result);
//       problemRequest.onerror = () => resolve(false);
//     });

//     if (!nextProblemExists) {
//       // Return the first valid NextProblem that hasn't been attempted
//       return nextProblemId;
//     }
//   }

//   console.log(
//     `All potential NextProblems for ${problemId} have been attempted.`
//   );
//   return null; // No valid NextProblem found
// }

// export const getAllProblemRelationship = async () => {
//   const db = await openDB();
//   return new Promise((resolve, reject) => {
//     const transaction = db.transaction("problem_relationships", "readonly");
//     const store = transaction.objectStore("problem_relationships");
//     const request = store.getAll();
//     request.onsuccess = () => resolve(request.result);
//     request.onerror = () => reject(request.error);
//   });
// };

// export async function determineNextProblem(problemId) {
//   const db = await openDB();
//   const transaction = db.transaction(
//     ["problem_relationships", "problems", "tag_mastery"],
//     "readonly"
//   );
//   const relationshipsStore = transaction.objectStore("problem_relationships");
//   const problemsStore = transaction.objectStore("problems");
//   const tagMasteryStore = transaction.objectStore("tag_mastery");

//   // Fetch problem relationships
//   const allRelatedRelationships = await relationshipsStore
//     .index("by_problemId1")
//     .getAll(problemId);
//   if (!allRelatedRelationships.length) return null;

//   // Sort by weight (highest first)
//   let sortedRelationships = allRelatedRelationships.sort(
//     (a, b) => b.weight - a.weight
//   );

//   for (const relationship of sortedRelationships) {
//     const nextProblemId = relationship.problemId2;
//     const nextProblem = await problemsStore.get(nextProblemId);
//     if (!nextProblem) continue;

//     // Fetch mastery decay
//     const masteryData = await tagMasteryStore.get(nextProblem.tag);
//     const decayFactor = masteryData ? masteryData.decayScore : 0;

//     // If decay is high, prioritize this problem
//     if (decayFactor > 2) {
//       return nextProblemId;
//     }
//   }

//   return sortedRelationships.length ? sortedRelationships[0].problemId2 : null;
// }
