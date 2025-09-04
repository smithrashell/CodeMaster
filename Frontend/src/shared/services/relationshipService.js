import { dbHelper } from "../db/index.js";
import { getAllStandardProblems } from "../db/standard_problems.js";
import { getTagRelationships } from "../db/tag_relationships.js";
import { getTagMastery } from "../db/tag_mastery.js";
import { getAllFromStore } from "../db/common.js";
import {
  calculateAndTrimProblemRelationships,
  restoreMissingProblemRelationships,
  storeRelationships,
  clearProblemRelationships,
} from "../db/problem_relationships.js";
let openDB = dbHelper.openDB;
export async function buildProblemRelationships() {
  const db = await openDB();
  const RELATIONSHIP_LIMIT = 10;

  await clearProblemRelationships(db);
  const problems = await getAllFromStore("standard_problems");
  const tagGraph = await getTagRelationships();
  const tagMastery = await getTagMastery();
  console.log("problems", problems);
  const relationshipConfig = {
    problems,
    tagGraph,
    tagMastery,
    limit: RELATIONSHIP_LIMIT,
  };

  let { problemGraph, removedRelationships } =
    calculateAndTrimProblemRelationships(relationshipConfig);
  console.log("problems2", problems);
  let { updatedProblemGraph, updatedRemovedRelationships } =
    restoreMissingProblemRelationships({
      problems,
      problemGraph,
      removedRelationships,
    });

  await storeRelationships(updatedProblemGraph);

  console.log("✅ Problem relationships successfully rebuilt.");
}
