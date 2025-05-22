import { dbHelper } from "./index.js";
const openDB = dbHelper.openDB;
import { calculateDecayScore } from "../utils/Utils.js";
import { TagService } from "../services/tagServices.js";
const getCurrentLearningState = TagService.getCurrentLearningState;

export async function generatePatternLaddersAndUpdateTagMastery() {
  const db = await openDB();

  const [
    standardProblems,
    userProblems,
    tagMasteryRecords,
    tagRelationships,
    problemRelationships,
  ] = await Promise.all([
    getAllFromStore("standard_problems"),
    getAllFromStore("problems"),
    getAllFromStore("tag_mastery"),
    getAllFromStore("tag_relationships"),
    getAllFromStore("problem_relationships"),
  ]);

  const { tagsinTier, unmasteredTags } = await getCurrentLearningState();

  const tierTagSet = new Set(tagsinTier);
  const unmasteredTagSet = new Set(unmasteredTags);

  const classificationRank = {
    "Core Concepts": 1,
    "Fundamental Techniques": 2,
    "Advanced Techniques": 3,
  };

  const getAllowedClassifications = (currentClassification) => {
    const currentRank =
      classificationRank[currentClassification?.toLowerCase()] || 3;
    return Object.keys(classificationRank).filter(
      (cls) => classificationRank[cls] <= currentRank
    );
  };

  const userProblemMap = new Map();
  userProblems.forEach((p) => userProblemMap.set(p.leetCodeID, p));

  const relationshipMap = new Map();
  problemRelationships.forEach(({ problemId1, problemId2, strength }) => {
    if (!relationshipMap.has(problemId1)) relationshipMap.set(problemId1, {});
    if (!relationshipMap.has(problemId2)) relationshipMap.set(problemId2, {});
    relationshipMap.get(problemId1)[problemId2] = strength;
    relationshipMap.get(problemId2)[problemId1] = strength;
  });

  const tx1 = db.transaction("pattern_ladders", "readwrite");
  const patternLaddersStore = tx1.objectStore("pattern_ladders");

  const tx2 = db.transaction("tag_mastery", "readwrite");
  const tagMasteryStore = tx2.objectStore("tag_mastery");

  // 🧼 Clear old ladders
  await new Promise((resolve, reject) => {
    const clearReq = patternLaddersStore.clear();
    clearReq.onsuccess = resolve;
    clearReq.onerror = () => reject(clearReq.error);
  });

  for (const entry of tagRelationships) {
    const tag = entry.id;
    const { classification = "Advanced Techniques", problemCounts = {} } =
      entry;
    const allowedClassifications = getAllowedClassifications(classification);

    const ladderSize = unmasteredTagSet.has(tag)
      ? 12
      : tierTagSet.has(tag)
      ? 9
      : 5;

    // Filter problems with valid tags (all tags must be in allowed classifications)
    let newProblems = standardProblems.filter((p) => !userProblemMap.has(p.id));
    console.log(`🔍 newProblems: ${newProblems.length} `);
    // Filter problems that include the target tag
    // and do not have *any* tag with classification above the current tier
    const validProblems = newProblems.filter((p) => {
      const tags = p.tags || [];

      if (!tags.includes(tag)) return false;

      // Only apply filtering if not Advanced Techniques
      if (allowedClassifications.length === 3) return true;

      for (const t of tags) {
        const related = tagRelationships.find((r) => r.id === t);
        const cls = related?.classification?.toLowerCase();

        if (cls && !allowedClassifications.includes(cls)) {
          return false;
        }
      }
      console.log(`🔎 Tag: ${tag}`);
      console.log(`  Classification: ${classification}`);
      console.log(`  Allowed: ${allowedClassifications.join(", ")}`);
      console.log(`  Total candidate problems: ${validProblems.length}`);

      return true;
    });

    // Compute problem count ratio
    const totalCount =
      (problemCounts.easy || 0) +
        (problemCounts.medium || 0) +
        (problemCounts.hard || 0) || 1;
    const easyTarget = Math.round(
      ((problemCounts.easy || 0) / totalCount) * ladderSize
    );
    const mediumTarget = Math.round(
      ((problemCounts.medium || 0) / totalCount) * ladderSize
    );
    const hardTarget = ladderSize - easyTarget - mediumTarget;

    const easy = validProblems
      .filter((p) => p.difficulty === "Easy")
      .slice(0, easyTarget);
    const medium = validProblems
      .filter((p) => p.difficulty === "Medium")
      .slice(0, mediumTarget);
    const hard = validProblems
      .filter((p) => p.difficulty === "Hard")
      .slice(0, hardTarget);

    const ladderProblems = [...easy, ...medium, ...hard];

    const ladder = ladderProblems.map((p) => {
      const userData = userProblemMap.get(p.id);
      const stats = userData?.AttemptStats || {};
      const total = stats.TotalAttempts || 0;
      const success = stats.SuccessfulAttempts || 0;
      const successRate = total > 0 ? success / total : 0;

      const lastAttemptDate =
        userData?.lastAttemptDate || new Date().toISOString();
      const stability = userData?.Stability || 6.0;

      const decayScore =
        total > 0
          ? calculateDecayScore(lastAttemptDate, successRate, stability)
          : 1;

      const fullConnections = relationshipMap.get(p.id) || {};
      const sortedConnections = Object.entries(fullConnections)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      return {
        leetCodeID: p.id,
        title: p.title,
        rating: p.difficulty,
        tags: p.tags || [],
        decayScore,
        connections: sortedConnections.map(([id]) => id),
        connectedStrengths: Object.fromEntries(sortedConnections),
      };
    });

    patternLaddersStore.put({
      tag,
      lastUpdated: new Date().toISOString(),
      problems: ladder,
    });

    const existing = tagMasteryRecords.find((t) => t.tag === tag) || { tag };
    const db = await openDB();
    const newTagMasteryStore = db
      .transaction("tag_mastery", "readwrite")
      .objectStore("tag_mastery");
    newTagMasteryStore.put({
      ...existing,
      coreLadder: ladder,
    });
  }

  console.log(
    "✅ Pattern ladders rebuilt with tier filtering, difficulty ratios, and classification gating."
  );
}

async function getAllFromStore(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], "readonly");
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
