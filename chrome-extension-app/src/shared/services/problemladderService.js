import {
  clearPatternLadders,
  upsertPatternLadder,
} from "../db/pattern_ladder.js";

import {
  getAllowedClassifications,
  getValidProblems,
  buildLadder,
} from "../utils/dbUtils/patternLadderUtils.js";

import { buildRelationshipMap } from "../db/problem_relationships.js";

import { TagService } from "../services/tagServices.js";
import { getAllFromStore } from "../db/common.js";
import { getTagMastery, upsertTagMastery } from "../db/tag_mastery.js";
// Remove early binding - use TagService.getCurrentLearningState() directly
export async function initializePatternLaddersForOnboarding() {
  const [
    standardProblems,
    userProblems = [],
    tagRelationships = [],
    problemRelationships = [],
    patternLadders = [],
  ] = await Promise.all([
    getAllFromStore("standard_problems"),
    getAllFromStore("problems"),
    getAllFromStore("tag_relationships"),
    getAllFromStore("problem_relationships"),
    getAllFromStore("pattern_ladders"),
  ]);

  if (patternLadders.length > 0) {
    console.log("🔁 Pattern ladders already exist. Skipping initialization.");
    return;
  }

  const { allTagsInCurrentTier, focusTags } =
    await TagService.getCurrentLearningState();

  const focusTagSet = new Set(focusTags);
  const allTagsInTierSet = new Set(allTagsInCurrentTier);
  const userProblemMap = new Map(userProblems.map((p) => [p.leetcode_id, p]));
  const relationshipMap = await buildRelationshipMap(problemRelationships);

  for (const entry of tagRelationships) {
    const tag = entry.id;
    const classification = entry.classification;
    const allowedClassifications = getAllowedClassifications(classification);
    console.log("tag", tag);
    console.log("classification", classification);
    console.log("allowedClassifications", allowedClassifications);

    const validProblems = getValidProblems({
      problems: standardProblems,
      userProblemMap,
      tagRelationships,
      allowedClassifications,
      focusTags,
    });
    console.log("validProblems", validProblems);
    const ladderSize = focusTagSet.has(tag)
      ? 12
      : allTagsInTierSet.has(tag)
      ? 9
      : 5;

    const ladder = buildLadder({
      validProblems,
      problemCounts: entry.problemCounts || {},
      userProblemMap,
      relationshipMap,
      ladderSize,
      isOnboarding: true, // 🔰 Force Easy-only problems for onboarding
    });
    console.log("ladder", ladder);

    await upsertPatternLadder({
      tag,
      lastUpdated: new Date().toISOString(),
      problems: ladder,
    });
  }

  console.log("🎉 Onboarding complete: pattern ladders initialized.");
}

export async function generatePatternLaddersAndUpdateTagMastery() {
  const [
    standardProblems,
    userProblems = [],
    tagMasteryRecords = [],
    tagRelationships = [],
    problemRelationships = [],
  ] = await Promise.all([
    getAllFromStore("standard_problems"),
    getAllFromStore("problems"),
    getTagMastery(),
    getAllFromStore("tag_relationships"),
    getAllFromStore("problem_relationships"),
  ]);

  const userProblemMap = new Map(userProblems.map((p) => [p.leetcode_id, p]));
  const relationshipMap = buildRelationshipMap(problemRelationships);

  // Get learning state for dynamic ladder sizing
  const { focusTags, allTagsInCurrentTier } = await TagService.getCurrentLearningState();
  const focusTagSet = new Set(focusTags);
  const allTagsInTierSet = new Set(allTagsInCurrentTier);

  await clearPatternLadders();

  for (const entry of tagRelationships) {
    const tag = entry.id;
    const classification = entry.classification || "Advanced Techniques";
    const allowedClassifications = getAllowedClassifications(classification);

    const validProblems = getValidProblems({
      tag,
      problems: standardProblems,
      userProblemMap,
      tagRelationships,
      allowedClassifications,
    });

    // Dynamic ladder size based on tag focus and tier
    const ladderSize = focusTagSet.has(tag)
      ? 12
      : allTagsInTierSet.has(tag)
      ? 9
      : 5;

    const ladder = buildLadder({
      validProblems,
      problemCounts: entry.problemCounts || {},
      userProblemMap,
      relationshipMap,
      ladderSize,
      isOnboarding: false, // Normal proportional distribution for experienced users
    });

    await upsertPatternLadder({
      tag,
      lastUpdated: new Date().toISOString(),
      problems: ladder,
    });

    const existing = tagMasteryRecords.find((t) => t.tag === tag) || { tag };
    await upsertTagMastery({
      ...existing,
      coreLadder: ladder,
    });
  }

  console.log(
    "✅ Pattern ladders rebuilt with updated filtering, ratios, and tag mastery sync."
  );
}
