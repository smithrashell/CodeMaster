/**
 * Problem Selection Functions
 * Extracted from problems.js
 */

import { dbHelper } from "./index.js";
import { getAllStandardProblems } from "./standard_problems.js";
import { TagService } from "../services/tagServices.js";
import FocusCoordinationService from "../services/focusCoordinationService.js";
import { getDifficultyAllowanceForTag } from "../utils/Utils.js";
import { getPatternLadders } from "../utils/dbUtils/patternLadderUtils.js";
import { scoreProblemsWithRelationships } from "./problem_relationships.js";
import { regenerateCompletedPatternLadder } from "../services/problemladderService.js";
import { calculateCompositeScore, logCompositeScores } from "./problemsHelpers.js";
import { fetchAllProblems } from "./problems.js";
import logger from "../utils/logger.js";

const openDB = () => dbHelper.openDB();

/**
 * Load context for problem selection
 */
export async function loadProblemSelectionContext(currentDifficultyCap) {
  const { masteryData, _focusTags, allTagsInCurrentTier } =
    await TagService.getCurrentLearningState();
  const allProblems = await getAllStandardProblems();
  const ladders = await getPatternLadders();

  const attemptedProblems = await fetchAllProblems();
  const attemptedProblemIds = new Set(
    attemptedProblems.map(p => Number(p.leetcode_id))
  );
  logger.info(`Excluding ${attemptedProblemIds.size} attempted problems from selection`);

  let availableProblems = allProblems.filter(problem => {
    const problemId = Number(problem.id || problem.leetcode_id);
    return !attemptedProblemIds.has(problemId);
  });
  logger.info(`Available problems after filtering attempts: ${availableProblems.length}/${allProblems.length}`);

  if (currentDifficultyCap) {
    availableProblems = filterProblemsByDifficultyCap(availableProblems, currentDifficultyCap);
    logger.info(`Difficulty cap applied: ${currentDifficultyCap} (${availableProblems.length} problems)`);
  }

  const focusDecision = await FocusCoordinationService.getFocusDecision("session_state");
  const enhancedFocusTags = focusDecision.activeFocusTags;

  const db = await openDB();
  const tagRelationshipsRaw = await new Promise((resolve, reject) => {
    const tx = db.transaction("tag_relationships", "readonly");
    const store = tx.objectStore("tag_relationships");
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return {
    masteryData, allTagsInCurrentTier, availableProblems, ladders,
    focusDecision, enhancedFocusTags, tagRelationshipsRaw
  };
}

/**
 * Filter problems by difficulty cap
 */
export function filterProblemsByDifficultyCap(allProblems, currentDifficultyCap) {
  const difficultyMap = { "Easy": 1, "Medium": 2, "Hard": 3 };
  const maxDifficulty = difficultyMap[currentDifficultyCap] || 3;
  return allProblems.filter(problem => {
    const problemDifficultyString = problem.difficulty || "Medium";
    const problemDifficultyNum = difficultyMap[problemDifficultyString] || 2;
    return problemDifficultyNum <= maxDifficulty;
  });
}

/**
 * Log problem selection start
 */
export function logProblemSelectionStart(numNewProblems, context) {
  logger.info("Starting intelligent problem selection...");
  logger.info("Focus Coordination Service decision:", {
    activeFocusTags: context.enhancedFocusTags,
    reasoning: context.focusDecision.algorithmReasoning,
    userPreferences: context.focusDecision.userPreferences,
    systemRecommendation: context.focusDecision.systemRecommendation
  });
  logger.info("Needed problems:", numNewProblems);
  logger.info("Debug data availability:", {
    totalStandardProblems: context.availableProblems.length,
    ladderTags: Object.keys(context.ladders || {}),
    enhancedFocusTagsCount: context.enhancedFocusTags.length
  });
}

/**
 * Calculate tag difficulty allowances
 */
export function calculateTagDifficultyAllowances(enhancedFocusTags, masteryData, tagRelationshipsRaw) {
  const tagDifficultyAllowances = {};
  for (const tag of enhancedFocusTags) {
    const tagMastery = masteryData.find((m) => m.tag === tag) || {
      tag, totalAttempts: 0, successfulAttempts: 0, mastered: false
    };

    const tagRelData = tagRelationshipsRaw.find(tr => tr.id === tag);
    if (tagRelData && tagRelData.difficulty_distribution) {
      tagMastery.difficulty_distribution = tagRelData.difficulty_distribution;
    }

    tagDifficultyAllowances[tag] = getDifficultyAllowanceForTag(tagMastery);
  }
  return tagDifficultyAllowances;
}

/**
 * Select primary and expansion problems
 */
export async function selectPrimaryAndExpansionProblems(numNewProblems, context, tagDifficultyAllowances, currentDifficultyCap, excludeIds = new Set()) {
  const selectedProblems = [];
  const usedProblemIds = new Set(excludeIds);

  const primaryFocusCount = Math.ceil(numNewProblems * 0.6);
  const primaryTag = context.enhancedFocusTags[0];

  logger.info(`Primary focus: ${primaryTag} (${primaryFocusCount} problems)`);
  const primaryProblems = await selectProblemsForTag(primaryTag, primaryFocusCount, {
    difficultyAllowance: tagDifficultyAllowances[primaryTag],
    ladders: context.ladders,
    allProblems: context.availableProblems,
    allTagsInCurrentTier: context.allTagsInCurrentTier,
    usedProblemIds,
    currentDifficultyCap
  });

  selectedProblems.push(...primaryProblems);
  primaryProblems.forEach((p) => usedProblemIds.add(p.id));

  const expansionCount = numNewProblems - selectedProblems.length;
  if (expansionCount > 0 && context.enhancedFocusTags.length > 1) {
    await addExpansionProblems({
      expansionCount, context, selectedProblems, usedProblemIds, currentDifficultyCap
    });
  }

  logSelectedProblems(selectedProblems);

  return { selectedProblems, usedProblemIds };
}

/**
 * Add expansion problems from secondary tags
 */
export async function addExpansionProblems(params) {
  const { expansionCount, context, selectedProblems, usedProblemIds, currentDifficultyCap } = params;
  const expansionTag = context.enhancedFocusTags[1];
  logger.info(`Expanding to next focus tag: ${expansionTag} (${expansionCount} problems)`);

  const tagMastery = context.masteryData.find((m) => m.tag === expansionTag) || {
    tag: expansionTag, totalAttempts: 0, successfulAttempts: 0, mastered: false
  };

  const tagRelData = context.tagRelationshipsRaw.find(tr => tr.id === expansionTag);
  if (tagRelData && tagRelData.difficulty_distribution) {
    tagMastery.difficulty_distribution = tagRelData.difficulty_distribution;
  }

  const allowance = getDifficultyAllowanceForTag(tagMastery);

  const expansionProblems = await selectProblemsForTag(expansionTag, expansionCount, {
    difficultyAllowance: allowance,
    ladders: context.ladders,
    allProblems: context.availableProblems,
    allTagsInCurrentTier: context.allTagsInCurrentTier,
    usedProblemIds,
    currentDifficultyCap
  });

  selectedProblems.push(...expansionProblems);
  expansionProblems.forEach((p) => usedProblemIds.add(p.id));

  logger.info(`Added ${expansionProblems.length} problems from expansion tag: ${expansionTag}`);
}

/**
 * Log selected problems
 */
export function logSelectedProblems(selectedProblems) {
  logger.info(`Selected ${selectedProblems.length} problems for learning`);
  logger.info(`Selected problems by difficulty:`, {
    Easy: selectedProblems.filter(p => p.difficulty === 'Easy').length,
    Medium: selectedProblems.filter(p => p.difficulty === 'Medium').length,
    Hard: selectedProblems.filter(p => p.difficulty === 'Hard').length,
    problems: selectedProblems.map(p => ({id: p.id, difficulty: p.difficulty, title: p.title}))
  });
}

/**
 * Expand with remaining focus tags
 */
export async function expandWithRemainingFocusTags(params) {
  const { numNewProblems, selectedProblems, usedProblemIds, context, currentDifficultyCap } = params;
  const remainingAfterExpansion = numNewProblems - selectedProblems.length;
  if (remainingAfterExpansion <= 0 || context.enhancedFocusTags.length <= 2) {
    return;
  }

  logger.info(`Expanding to all remaining focus tags for ${remainingAfterExpansion} more problems...`);

  for (let i = 2; i < context.enhancedFocusTags.length && selectedProblems.length < numNewProblems; i++) {
    const expansionTag = context.enhancedFocusTags[i];
    const needed = numNewProblems - selectedProblems.length;

    const tagMastery = context.masteryData.find((m) => m.tag === expansionTag) || {
      tag: expansionTag, totalAttempts: 0, successfulAttempts: 0, mastered: false
    };

    const allowance = getDifficultyAllowanceForTag(tagMastery);
    const moreProblems = await selectProblemsForTag(expansionTag, needed, {
      difficultyAllowance: allowance,
      ladders: context.ladders,
      allProblems: context.availableProblems,
      allTagsInCurrentTier: context.allTagsInCurrentTier,
      usedProblemIds,
      currentDifficultyCap
    });

    selectedProblems.push(...moreProblems);
    moreProblems.forEach((p) => usedProblemIds.add(p.id));

    if (moreProblems.length > 0) {
      logger.info(`Added ${moreProblems.length} problems from additional tag: ${expansionTag}`);
    }
  }
}

/**
 * Fill remaining with random problems
 */
export function fillRemainingWithRandomProblems(numNewProblems, selectedProblems, usedProblemIds, availableProblems, _excludeIds) {
  if (selectedProblems.length >= numNewProblems || availableProblems.length === 0) {
    return;
  }

  const remainingNeeded = numNewProblems - selectedProblems.length;
  logger.info(`Tag-based selection found ${selectedProblems.length}/${numNewProblems} problems. Using random selection for final ${remainingNeeded} problems.`);

  const selectedIds = new Set(selectedProblems.map(p => p.id));

  const fallbackProblems = availableProblems
    .filter(p => {
      const pId = p.id;
      const isSelected = selectedIds.has(pId);
      const isUsed = usedProblemIds.has(pId);
      return !isSelected && !isUsed;
    })
    .slice(0, remainingNeeded);

  const beforeCount = selectedProblems.length;
  selectedProblems.push(...fallbackProblems);
  const afterCount = selectedProblems.length;

  logger.warn(`FALLBACK RESULT: Added ${fallbackProblems.length} problems. Before: ${beforeCount}, After: ${afterCount}`);
}

/**
 * Normalize tags to lowercase
 */
function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags.map((tag) => tag.trim().toLowerCase());
}

/**
 * Get a single pattern ladder by tag name
 */
async function getSingleLadder(tag) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("pattern_ladders", "readonly");
    const store = transaction.objectStore("pattern_ladders");
    const request = store.get(tag);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get difficulty score for progressive difficulty ordering
 */
export function getDifficultyScore(difficulty) {
  const scores = { Easy: 1, Medium: 2, Hard: 3 };
  return scores[difficulty] || 2;
}

/**
 * Selects problems for a specific tag with progressive difficulty
 */
export async function selectProblemsForTag(tag, count, config) {
  const { difficultyAllowance, ladders, allProblems, allTagsInCurrentTier, usedProblemIds, recentAttempts = [], currentDifficultyCap = null } = config;
  logger.info(`Selecting ${count} problems for tag: ${tag}`);

  let ladder = ladders?.[tag]?.problems || [];
  const allTagsInCurrentTierSet = new Set(allTagsInCurrentTier);

  const available = ladder.filter(p => !p.attempted && !usedProblemIds.has(p.id));
  const neededThreshold = count * 0.6;

  if (available.length < neededThreshold) {
    logger.info(`Ladder "${tag}" has ${available.length}/${Math.ceil(neededThreshold)} needed. Regenerating...`);

    try {
      await regenerateCompletedPatternLadder(tag);
      const reloadedLadder = await getSingleLadder(tag);
      if (reloadedLadder && reloadedLadder.problems) {
        ladder = reloadedLadder.problems;
        logger.info(`Regenerated ladder "${tag}" now has ${ladder.length} problems`);
      }
    } catch (error) {
      logger.error(`Failed to regenerate ladder "${tag}":`, error);
    }
  }

  const eligibleProblems = ladder
    .filter((problem) => {
      const id = problem.id;
      const rating = problem.difficulty || problem.rating || "Medium";
      const tags = normalizeTags(problem.tags || []);

      if (usedProblemIds.has(id)) return false;
      if (difficultyAllowance[rating] <= 0) return false;
      if (!tags.includes(tag)) return false;

      const tierValid = allTagsInCurrentTierSet.has(tag) || allTagsInCurrentTier.length === 0;
      if (!tierValid) return false;

      return true;
    })
    .map((problem) => ({
      ...problem,
      difficultyScore: getDifficultyScore(problem.difficulty || "Medium"),
      allowanceWeight: difficultyAllowance[problem.difficulty || "Medium"],
    }));

  const problemsWithRelationships = await scoreProblemsWithRelationships(
    eligibleProblems.map(p => ({ id: p.id, ...p })),
    recentAttempts,
    5
  );

  problemsWithRelationships.forEach(problem => {
    problem.compositeScore = calculateCompositeScore(problem, currentDifficultyCap, getDifficultyScore);
  });

  problemsWithRelationships.sort((a, b) => {
    const scoreDiff = b.compositeScore - a.compositeScore;
    if (Math.abs(scoreDiff) > 0.001) {
      return scoreDiff;
    }
    return a.difficultyScore - b.difficultyScore;
  });

  logCompositeScores(problemsWithRelationships, tag);

  logger.info(`Found ${eligibleProblems.length} eligible problems for ${tag}`);

  const selectedProblems = [];
  let selectedCount = 0;

  for (const problem of problemsWithRelationships) {
    if (selectedCount >= count) break;

    const problemId = problem.id;
    const standardProblem = allProblems.find((p) => p.id === problemId);
    if (standardProblem) {
      selectedProblems.push(standardProblem);
      selectedCount++;
    }
  }

  logger.info(`Selected ${selectedProblems.length} problems for ${tag}`);
  return selectedProblems;
}
