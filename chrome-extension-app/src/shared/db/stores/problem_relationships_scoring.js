import { getSessionPerformance } from "./sessions.js";
import {
  getUserRecentAttempts,
  getAllRelationshipStrengths,
  buildRelationshipMap
} from "./problem_relationships.js";

async function detectSimplePlateau() {
  try {
    const recentPerformance = await getSessionPerformance({ recentSessionsLimit: 3 });
    if (!recentPerformance || recentPerformance.accuracy === undefined) {
      return false;
    }
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

function calculateTagMasteryAlignment(problem, userState) {
  if (!problem.tags || !userState.tagMastery) {
    return 1.0;
  }
  let alignmentScore = 1.0;
  let tagCount = 0;
  for (const tag of problem.tags) {
    const mastery = userState.tagMastery[tag];
    if (mastery) {
      tagCount++;
      if (mastery.mastered) {
        alignmentScore *= 0.95;
      } else if (mastery.successRate > 0.7) {
        alignmentScore *= 1.2;
      } else if (mastery.successRate > 0.4) {
        alignmentScore *= 1.3;
      } else if (mastery.attempts < 3) {
        alignmentScore *= 1.4;
        console.log(`🔍 Exploration bonus applied for tag: ${tag} (${mastery.attempts} attempts)`);
      } else {
        alignmentScore *= 0.8;
      }
    } else {
      alignmentScore *= 1.2;
      console.log(`🔍 Unknown tag exploration bonus: ${tag}`);
    }
  }
  if (tagCount > 0) {
    alignmentScore *= 1.1;
  }
  return Math.max(0.5, Math.min(1.5, alignmentScore));
}

function calculateDiversityBonus(problem, recentSuccesses) {
  if (!problem.tags || recentSuccesses.length === 0) {
    return 1.0;
  }
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
  if (overlapRatio <= 0.2) {
    return 1.3;
  } else if (overlapRatio <= 0.5) {
    return 1.1;
  } else if (overlapRatio <= 0.8) {
    return 0.9;
  } else {
    return 0.7;
  }
}

export async function calculateOptimalPathScore(problem, userState = null, cachedData = {}) {
  try {
    let score = 1.0;
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
          totalStrength += 2.0;
          relationshipCount++;
        }
      }
      if (relationshipCount > 0) {
        avgRelationshipStrength = totalStrength / relationshipCount;
        score *= (avgRelationshipStrength / 3.0);
      }
    }
    if (problem.difficulty === 'Hard' && avgRelationshipStrength > 0 && avgRelationshipStrength < 1.5) {
      score *= 0.6;
      console.log(`📉 Hard problem with weak connectivity (avg: ${avgRelationshipStrength.toFixed(2)}) - deprioritized`);
    }
    if (userState && userState.tagMastery) {
      const tagMasteryBonus = calculateTagMasteryAlignment(problem, userState);
      score *= tagMasteryBonus;
    }
    const diversityBonus = calculateDiversityBonus(problem, recentSuccesses);
    score *= diversityBonus;
    const isPlateauing = cachedData.isPlateauing !== undefined ? cachedData.isPlateauing : await detectSimplePlateau();
    if (isPlateauing && problem.difficulty === 'Hard') {
      score *= 1.2;
      console.log(`🚀 Plateau detection: Boosting Hard problem for breakthrough`);
    } else if (isPlateauing && problem.difficulty === 'Easy') {
      score *= 0.8;
    }
    console.log(`🎯 Optimal path score for problem ${problem.id || problem.leetcode_id}: ${score.toFixed(3)} (relationship: ${avgRelationshipStrength.toFixed(2)}, diversity: ${diversityBonus.toFixed(2)}, plateau: ${isPlateauing})`);
    return Math.max(0.1, Math.min(5.0, score));
  } catch (error) {
    console.error("❌ Error calculating optimal path score:", error);
    return 1.0;
  }
}

export async function selectOptimalProblems(candidateProblems, userState = null) {
  try {
    console.log(`🧮 Scoring ${candidateProblems.length} candidate problems for optimal session composition`);
    const [recentSuccesses, relationshipMap, isPlateauing] = await Promise.all([
      getUserRecentAttempts(5),
      getAllRelationshipStrengths(),
      detectSimplePlateau()
    ]);
    const cachedData = { recentSuccesses, relationshipMap, isPlateauing };
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
    const sortedProblems = scoredProblems.sort((a, b) => b.pathScore - a.pathScore);
    console.log(`✅ Problems scored and sorted. Top 3 scores: ${sortedProblems.slice(0, 3).map(p => `${p.id || p.leetcode_id}:${p.pathScore.toFixed(2)}`).join(', ')}`);
    return sortedProblems;
  } catch (error) {
    console.error("❌ Error in selectOptimalProblems:", error);
    return candidateProblems;
  }
}

export async function scoreProblemsWithRelationships(candidateProblems, recentAttempts, maxLookback = 5) {
  try {
    const problemGraph = await buildRelationshipMap();
    const recentProblemIds = recentAttempts
      .slice(-maxLookback)
      .map(attempt => attempt.leetcode_id)
      .filter(id => id != null);
    console.log(`🔗 Scoring ${candidateProblems.length} candidates against ${recentProblemIds.length} recent problems`);
    return candidateProblems.map(candidate => {
      const candidateId = candidate.id || candidate.leetcode_id;
      let relationshipScore = 0;
      let relationshipCount = 0;
      recentProblemIds.forEach(recentId => {
        const relationships = problemGraph.get(recentId);
        if (relationships && relationships[candidateId]) {
          relationshipScore += relationships[candidateId];
          relationshipCount++;
        }
        const candidateRelationships = problemGraph.get(candidateId);
        if (candidateRelationships && candidateRelationships[recentId]) {
          relationshipScore += candidateRelationships[recentId];
          relationshipCount++;
        }
      });
      const avgRelationshipScore = relationshipCount > 0 ? relationshipScore / relationshipCount : 0;
      return {
        ...candidate,
        relationshipScore: avgRelationshipScore,
        relationshipCount: relationshipCount
      };
    });
  } catch (error) {
    console.error("❌ Error scoring problems with relationships:", error);
    return candidateProblems.map(candidate => ({
      ...candidate,
      relationshipScore: 0,
      relationshipCount: 0
    }));
  }
}
