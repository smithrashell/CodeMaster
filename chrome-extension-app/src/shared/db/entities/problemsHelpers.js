/**
 * Helper functions for problems.js
 *
 * Extracted to reduce function complexity
 */

import logger from '../../utils/logger.js';

/**
 * Calculate composite score for a problem
 */
export function calculateCompositeScore(problem, currentDifficultyCap, getDifficultyScore) {
  // Normalize relationship score (0-1 range)
  const normalizedRelationship = Math.min((problem.relationshipScore || 0), 1.0);

  // Calculate cap proximity score (0-1 range)
  let capProximityScore = 0.5; // Default neutral score
  if (currentDifficultyCap) {
    const capScore = getDifficultyScore(currentDifficultyCap);
    const maxDistance = 2; // Max distance is Easy to Hard (3 - 1 = 2)
    const distance = Math.abs(problem.difficultyScore - capScore);
    capProximityScore = 1 - (distance / maxDistance); // Closer to cap = higher score
  }

  // Allowance weight is already normalized (0-1 range)
  const normalizedAllowance = problem.allowanceWeight || 0;

  // Composite score: weighted combination
  // Relationship: 40%, Cap proximity: 40%, Allowance: 20%
  return (normalizedRelationship * 0.4) + (capProximityScore * 0.4) + (normalizedAllowance * 0.2);
}

/**
 * Log composite score distribution for debugging
 */
export function logCompositeScores(problemsWithRelationships, tag) {
  if (problemsWithRelationships.length === 0) return;

  const scoresByDifficulty = {
    Easy: problemsWithRelationships.filter(p => p.difficulty === 'Easy').slice(0, 3),
    Medium: problemsWithRelationships.filter(p => p.difficulty === 'Medium').slice(0, 3),
    Hard: problemsWithRelationships.filter(p => p.difficulty === 'Hard').slice(0, 3)
  };

  logger.info(`🎯 Composite score distribution for "${tag}" (top 3 per difficulty):`, {
    Easy: scoresByDifficulty.Easy.map(p => ({
      id: p.id,
      title: p.title?.substring(0, 30),
      composite: p.compositeScore?.toFixed(3),
      relationship: p.relationshipScore?.toFixed(3),
      allowance: p.allowanceWeight?.toFixed(3)
    })),
    Medium: scoresByDifficulty.Medium.map(p => ({
      id: p.id,
      title: p.title?.substring(0, 30),
      composite: p.compositeScore?.toFixed(3),
      relationship: p.relationshipScore?.toFixed(3),
      allowance: p.allowanceWeight?.toFixed(3)
    })),
    Hard: scoresByDifficulty.Hard.map(p => ({
      id: p.id,
      title: p.title?.substring(0, 30),
      composite: p.compositeScore?.toFixed(3),
      relationship: p.relationshipScore?.toFixed(3),
      allowance: p.allowanceWeight?.toFixed(3)
    }))
  });
}
