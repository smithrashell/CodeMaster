/**
 * Session Balancing Utilities
 *
 * Provides functions for:
 * 1. Calculating accuracy at specific difficulty levels
 * 2. Applying guard rails to prevent extreme difficulty imbalances
 * 3. Ensuring minimum exposure to new difficulty levels
 */

import logger from "../logging/logger.js";

/**
 * Calculate accuracy at a specific difficulty level
 *
 * @param {string} difficulty - 'Easy', 'Medium', or 'Hard'
 * @param {Object} difficultyTimeStats - difficulty_time_stats from session_state
 * @param {Array} recentAttempts - Optional: recent attempts to calculate from (if available)
 * @returns {number} Accuracy as decimal (0.0 to 1.0)
 */
export function calculateAccuracyAtDifficulty(difficulty, difficultyTimeStats, recentAttempts = null) {
  const difficultyKey = difficulty.toLowerCase();
  const stats = difficultyTimeStats[difficultyKey];

  if (!stats || stats.problems === 0) {
    return 0; // No attempts at this difficulty yet
  }

  // If we have recent attempts data, calculate accuracy from success/attempts
  if (recentAttempts && Array.isArray(recentAttempts)) {
    const attemptsAtDifficulty = recentAttempts.filter(
      attempt => attempt.difficulty === difficulty
    );

    if (attemptsAtDifficulty.length > 0) {
      const successful = attemptsAtDifficulty.filter(a => a.success).length;
      return successful / attemptsAtDifficulty.length;
    }
  }

  // Fallback: Estimate accuracy from average time vs expected time
  // This is approximate - if avg_time is close to expected, assume good accuracy
  // Expected times: Easy ~720s (12min), Medium ~1200s (20min), Hard ~1800s (30min)
  const expectedTimes = {
    easy: 720,
    medium: 1200,
    hard: 1800
  };

  const avgTime = stats.avg_time || 0;
  const expectedTime = expectedTimes[difficultyKey] || 720;

  // If average time is within 1.5x expected, assume high accuracy
  // This is a rough estimate - actual accuracy should come from attempts
  if (avgTime > 0 && avgTime <= expectedTime * 1.5) {
    return 0.85; // Assume 85% accuracy if timing is reasonable
  } else if (avgTime > expectedTime * 1.5 && avgTime <= expectedTime * 2) {
    return 0.70; // Assume 70% if timing is slower
  } else if (avgTime > expectedTime * 2) {
    return 0.50; // Assume 50% if timing is very slow
  }

  // Default to 0 if no data available
  return 0;
}

/**
 * Apply safety guard rails to prevent extreme difficulty imbalances
 *
 * Guard rails ensure:
 * - At Medium cap: At least 2 Medium problems (or 25% if session > 8)
 * - At Hard cap: At least 2 Hard problems (or 20% if session > 10)
 * - First 2 sessions at new difficulty: At least 2 problems at cap difficulty
 *
 * @param {Array} problems - Selected problems for the session
 * @param {string} currentDifficultyCap - Current difficulty cap ('Easy', 'Medium', 'Hard')
 * @param {number} sessionsAtCurrentDifficulty - Number of sessions at current difficulty
 * @returns {Object} { needsRebalance: boolean, target: {difficulty: count}, message: string }
 */
export function applySafetyGuardRails(problems, currentDifficultyCap, sessionsAtCurrentDifficulty) {
  const sessionLength = problems.length;

  // Count current difficulty distribution
  const counts = {
    Easy: problems.filter(p => p.difficulty === 'Easy').length,
    Medium: problems.filter(p => p.difficulty === 'Medium').length,
    Hard: problems.filter(p => p.difficulty === 'Hard').length
  };

  logger.info(`⚖️ Guard rails check: ${counts.Easy} Easy, ${counts.Medium} Medium, ${counts.Hard} Hard (cap: ${currentDifficultyCap}, session ${sessionsAtCurrentDifficulty + 1} at this difficulty)`);

  // Guard Rail 1: At Medium cap, ensure minimum Medium problems
  if (currentDifficultyCap === 'Medium' && sessionLength >= 4) {
    const minMedium = sessionLength <= 8 ? 2 : Math.ceil(sessionLength * 0.25);

    if (counts.Medium > 0 && counts.Medium < minMedium) {
      const message = `Session has only ${counts.Medium} Medium problems, need at least ${minMedium} for Medium cap`;
      logger.warn(`⚖️ Guard rail triggered: ${message}`);
      return {
        needsRebalance: true,
        target: { Medium: minMedium },
        message
      };
    }
  }

  // Guard Rail 2: At Hard cap, ensure minimum Hard problems
  if (currentDifficultyCap === 'Hard' && sessionLength >= 5) {
    const minHard = sessionLength <= 10 ? 2 : Math.ceil(sessionLength * 0.2);

    if (counts.Hard > 0 && counts.Hard < minHard) {
      const message = `Session has only ${counts.Hard} Hard problems, need at least ${minHard} for Hard cap`;
      logger.warn(`⚖️ Guard rail triggered: ${message}`);
      return {
        needsRebalance: true,
        target: { Hard: minHard },
        message
      };
    }
  }

  // Guard Rail 3: First 2 sessions at new difficulty - ensure exposure
  if (sessionsAtCurrentDifficulty < 2 && currentDifficultyCap !== 'Easy') {
    const capDifficultyCount = counts[currentDifficultyCap];
    const minCapDifficulty = Math.min(2, sessionLength); // At least 2 or all problems if session < 2

    if (capDifficultyCount < minCapDifficulty) {
      const message = `First session at ${currentDifficultyCap} cap needs ${minCapDifficulty} ${currentDifficultyCap} problems for introduction (has ${capDifficultyCount})`;
      logger.info(`🎯 ${message}`);
      return {
        needsRebalance: true,
        target: { [currentDifficultyCap]: minCapDifficulty },
        message
      };
    }
  }

  logger.info(`✅ Guard rails passed: Session difficulty distribution is acceptable`);
  return { needsRebalance: false };
}

/**
 * Get next difficulty level in progression
 *
 * @param {string} currentDifficulty - Current difficulty cap
 * @returns {string} Next difficulty level
 */
export function getNextDifficulty(currentDifficulty) {
  const progression = {
    'Easy': 'Medium',
    'Medium': 'Hard',
    'Hard': 'Hard' // Already at max
  };
  return progression[currentDifficulty] || 'Medium';
}

/**
 * Get difficulty level as number for comparison
 *
 * @param {string} difficulty - Difficulty string
 * @returns {number} Difficulty level (1 = Easy, 2 = Medium, 3 = Hard)
 */
export function getDifficultyLevel(difficulty) {
  const levels = {
    'Easy': 1,
    'Medium': 2,
    'Hard': 3
  };
  return levels[difficulty] || 1;
}
