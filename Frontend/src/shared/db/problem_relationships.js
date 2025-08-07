import { getAllStandardProblems } from "./standard_problems.js";
import { getTagRelationships } from "./tag_relationships.js";
import { getTagMastery } from "./tag_mastery.js";
import { calculateTagSimilarity } from "./tag_mastery.js";
import { TagService } from "../services/tagServices";
import { fetchAllProblems } from "./problems.js";
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
  console.log("problemGraph", problemGraph);

  for (const [problemId1, relationships] of problemGraph.entries()) {
    for (const { problemId2, strength } of relationships) {
      await new Promise((resolve, reject) => {
        const tx = db.transaction("problem_relationships", "readwrite");
        const store = tx.objectStore("problem_relationships");

        const request = store.add({
          problemId1,
          problemId2,
          strength, // ✅ Use consistent field name
        });

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

export async function buildRelationshipMap() {
  const db = await openDB();
  const tx = db.transaction("problem_relationships", "readonly");
  const store = tx.objectStore("problem_relationships");
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const graph = new Map();

      request.result.forEach(({ problemId1, problemId2, strength }) => {
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
    const existing = problemGraph.get(problem.id);
    if (!existing || existing.length === 0) {
      console.warn(`⚠️ Problem ${problem.id} has no valid relationships.`);

      missingProblems.add(problem.id);

      // Try restoring from trimmed
      if (removedRelationships.has(problem.id)) {
        console.log(`🔄 Restoring trimmed relationship for ${problem.id}`);
        problemGraph.set(
          problem.id,
          removedRelationships.get(problem.id).slice(0, 1)
        );
      } else {
        // Fallback to same-tag pairing
        const fallback = problemsArray.find(
          (p) =>
            p.id !== problem.id &&
            p.tags.some((tag) => problem.tags.includes(tag))
        );

        if (fallback) {
          console.log(`🛠️ Fallback: ${problem.id} → ${fallback.id}`);
          problemGraph.set(problem.id, [
            {
              problemId1: problem.id,
              problemId2: fallback.id,
              strength: 1, // Weakest connection
            },
          ]);
        }
      }
    }
  }

  console.log(`🔹 Restored ${missingProblems.size} missing relationships.`);
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
    problemGraph.set(p1.id, []);

    problemsArray.forEach((p2) => {
      if (p1.id === p2.id) return;

      const similarity = calculateTagSimilarity(
        p1.tags,
        p2.tags,
        tagGraph,
        tagMastery,
        p1.difficulty,
        p2.difficulty
      );

      const d1 = difficultyMap[p1.difficulty] || 2;
      const d2 = difficultyMap[p2.difficulty] || 2;

      if (similarity > 0 && d1 <= d2) {
        problemGraph.get(p1.id).push({
          problemId1: p1.id,
          problemId2: p2.id,
          strength: similarity,
        });
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
    problemGraph.set(problemId, relationships.slice(0, limit));
  }

  console.log("problemGraph", problemGraph);

  return { problemGraph, removedRelationships };
}
