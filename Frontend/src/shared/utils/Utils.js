/**
 * Helper function to check if a problem's difficulty is allowed
 * @param {string} difficulty - Problem's difficulty (Easy, Medium, Hard)
 * @param {string} maxDifficulty - Max allowed difficulty level
 * @returns {boolean}
 */
export function isDifficultyAllowed(difficulty, maxDifficulty) {
  const difficultyLevels = ["Easy", "Medium", "Hard"];
  return (
    difficultyLevels.indexOf(difficulty) <=
    difficultyLevels.indexOf(maxDifficulty)
  );
}

/**
 * Deduplicates an array of problems based on their ID
 * @param {Array} problems - Array of problem objects
 * @returns {Array} - Deduplicated problems
 */
export function deduplicateById(problems) {
  const seen = new Set();
  return problems.filter((problem) => {
    if (seen.has(problem.id)) return false;
    seen.add(problem.id);
    return true;
  });
}



/**
 * Calculates a problem's decay score based on time since last attempt and success rate
 * @param {Date} lastAttemptDate - Date of last attempt
 * @param {number} successRate - Ratio of successful attempts to total attempts
 * @returns {number} - Decay score
 */
    export function calculateDecayScore(
      lastAttemptDate,
      successRate,
      stability
    ) {
      const today = new Date();
      const lastAttempt = new Date(lastAttemptDate);
      const daysSinceLastAttempt =
        (today - lastAttempt) / (1000 * 60 * 60 * 24);
      const retrievability = Math.exp(-daysSinceLastAttempt / stability);
      return (1 - successRate) * (daysSinceLastAttempt / (1 + retrievability));
    }

export function createAttemptRecord(attemptData) {
  return {
    id: attemptData.id,
    SessionID: attemptData.SessionID,
    ProblemID: attemptData.ProblemID,
    Success: attemptData.Success,
    AttemptDate: attemptData.AttemptDate,
    TimeSpent: Number(attemptData.TimeSpent),
    Difficulty: attemptData.Difficulty,
    Comments: attemptData.Comments || "",
  };
}
