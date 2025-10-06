import {
  clearPatternLadders,
  upsertPatternLadder,
} from "../db/pattern_ladder.js";

import {
  getAllowedClassifications,
  getValidProblems,
  buildLadder,
  getPatternLadders,
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

  // NOTE: Tag mastery initialization removed - tags now added organically on first attempt
  // Pattern ladders can be built regardless of whether tags exist in tag_mastery
  // Tags will be added to tag_mastery when user attempts their first problem

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

/**
 * Updates pattern ladders when a problem is attempted and checks for completion
 * @param {number} problemId - LeetCode problem ID that was attempted
 */
export async function updatePatternLaddersOnAttempt(problemId) {
  try {
    console.log(`🔄 Updating pattern ladders for attempted problem: ${problemId}`);

    // Get all pattern ladders
    const allLadders = await getPatternLadders();
    const updatedLadders = [];

    // Find and update ladders containing this problem
    for (const [tag, ladder] of Object.entries(allLadders)) {
      const problemIndex = ladder.problems.findIndex(p => Number(p.id) === Number(problemId));

      if (problemIndex !== -1 && !ladder.problems[problemIndex].attempted) {
        // Mark problem as attempted
        ladder.problems[problemIndex].attempted = true;

        // Update the ladder in database
        await upsertPatternLadder({
          tag,
          last_updated: new Date().toISOString(),
          problems: ladder.problems,
        });

        updatedLadders.push(tag);
        console.log(`✅ Updated pattern ladder for tag: ${tag}`);

        // Check if ladder is now complete
        const allAttempted = ladder.problems.every(p => p.attempted);
        if (allAttempted) {
          console.log(`🎉 Pattern ladder completed for tag: ${tag}`);

          // Trigger regeneration for completed ladder with error logging
          try {
            await regenerateCompletedPatternLadder(tag);
            console.log(`✅ Successfully regenerated completed pattern ladder: ${tag}`);
          } catch (error) {
            console.error(`❌ Failed to regenerate completed pattern ladder: ${tag}`, error);
            // Continue execution - don't fail the attempt if regeneration fails
          }
        }
      }
    }

    if (updatedLadders.length > 0) {
      console.log(`✅ Updated ${updatedLadders.length} pattern ladders for problem ${problemId}`);
    }

    return updatedLadders;
  } catch (error) {
    console.error(`❌ Error updating pattern ladders for problem ${problemId}:`, error);
    // Don't throw - pattern ladder updates shouldn't fail problem attempts
  }
}

/**
 * Regenerates a specific completed pattern ladder with related tags
 * @param {string} completedTag - The tag whose ladder was completed
 */
export async function regenerateCompletedPatternLadder(completedTag) {
  console.log(`🔄 Regenerating completed pattern ladder: ${completedTag}`);

  // For now, regenerate just this specific ladder
  // TODO: Could be enhanced to regenerate related tags via tag_relationships
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

  // Find the specific tag relationship
  const tagEntry = tagRelationships.find(entry => entry.id === completedTag);
  if (!tagEntry) {
    throw new Error(`Tag relationship not found for: ${completedTag}`);
  }

  const classification = tagEntry.classification || "Advanced Techniques";
  const allowedClassifications = getAllowedClassifications(classification);

  const validProblems = getValidProblems({
    problems: standardProblems,
    userProblemMap,
    tagRelationships,
    allowedClassifications,
    focusTags,
  });

  // Dynamic ladder size based on tag focus and tier
  const ladderSize = focusTagSet.has(completedTag)
    ? 12
    : allTagsInTierSet.has(completedTag)
    ? 9
    : 5;

  const ladder = buildLadder({
    validProblems,
    problemCounts: tagEntry.difficulty_distribution || {},
    userProblemMap,
    relationshipMap,
    ladderSize,
    isOnboarding: false,
  });

  await upsertPatternLadder({
    tag: completedTag,
    last_updated: new Date().toISOString(),
    problems: ladder,
  });

  const existing = tagMasteryRecords.find((t) => t.tag === completedTag) || { tag: completedTag };
  await upsertTagMastery({
    ...existing,
    coreLadder: ladder,
  });

  console.log(`✅ Successfully regenerated pattern ladder: ${completedTag}`);
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
      problems: standardProblems,
      userProblemMap,
      tagRelationships,
      allowedClassifications,
      focusTags,
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
