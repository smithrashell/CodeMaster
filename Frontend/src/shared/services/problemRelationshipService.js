/**
 * Problem Relationship Service
 * Handles problem-to-problem similarity data for enhanced hint selection
 */

// eslint-disable-next-line no-restricted-imports
import { dbHelper } from "../db/index.js";

/**
 * Service for managing problem relationship data
 */
export class ProblemRelationshipService {
  /**
   * Note: Problem relationships are calculated dynamically by the existing system
   * in problem_relationships.js using calculateAndTrimProblemRelationships()
   * and updateProblemRelationships(). No external data loading needed.
   */

  /**
   * Get similar problems for a given problem ID using existing relationship system
   * @param {number} problemId - Target problem ID
   * @param {number} limit - Maximum number of similar problems to return
   * @returns {Array} Array of similar problems with weights
   */
  static async getSimilarProblems(problemId, limit = 10) {
    try {
      // Use existing relationship system through dynamic import to avoid circular dependencies
      const { buildRelationshipMap } = await import(
        "../db/problem_relationships.js"
      );
      const relationshipMap = await buildRelationshipMap();
      const relationships = relationshipMap.get(problemId);

      if (!relationships || Object.keys(relationships).length === 0) {
        return [];
      }

      // Convert to array and sort by weight (highest first)
      const similarProblems = Object.entries(relationships)
        .map(([id, weight]) => ({ problemId: parseInt(id), weight: weight }))
        .sort((a, b) => b.weight - a.weight)
        .slice(0, limit);

      return similarProblems;
    } catch (error) {
      console.error(
        `❌ Error getting similar problems for ${problemId}:`,
        error
      );
      return [];
    }
  }

  /**
   * Get problem metadata for hint enhancement - optimized to use existing data
   * @param {number} problemId - Problem ID to look up
   * @param {Object} existingProblemData - Optional existing problem data to avoid redundant queries
   * @returns {Object|null} Problem metadata
   */
  static async getProblemMetadata(problemId, existingProblemData = null) {
    try {
      // Use existing problem data if provided to avoid redundant queries
      if (existingProblemData) {
        return existingProblemData;
      }

      const db = await dbHelper.openDB();

      // Try problems store first (user's attempted problems), then standard_problems
      let result = null;
      try {
        const problemsTx = db.transaction(["problems"], "readonly");
        const problemsStore = problemsTx.objectStore("problems");

        result = await new Promise((resolve, reject) => {
          const getRequest = problemsStore.get(problemId);
          getRequest.onsuccess = () => resolve(getRequest.result);
          getRequest.onerror = () => reject(getRequest.error);
        });
      } catch (error) {
        // Fall back to standard_problems if not found in problems store
      }

      // If not found in problems store, check standard_problems
      if (!result) {
        const standardTx = db.transaction(["standard_problems"], "readonly");
        const standardStore = standardTx.objectStore("standard_problems");

        result = await new Promise((resolve, reject) => {
          const getRequest = standardStore.get(problemId);
          getRequest.onsuccess = () => resolve(getRequest.result);
          getRequest.onerror = () => reject(getRequest.error);
        });
      }

      return result ? result.value || result : null;
    } catch (error) {
      console.error(
        `❌ Error getting problem metadata for ${problemId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Analyze problem relationships to enhance hint selection
   * @param {number} currentProblemId - Current problem being solved
   * @param {string[]} problemTags - Tags of current problem
   * @param {number} analysisDepth - How many similar problems to analyze
   * @returns {Object} Enhanced hint context
   */
  static async analyzeProblemContext(
    currentProblemId,
    problemTags,
    analysisDepth = 5
  ) {
    try {
      console.log(
        `🔍 Analyzing problem context for problem ${currentProblemId}`
      );

      // Get similar problems
      const similarProblems = await this.getSimilarProblems(
        currentProblemId,
        analysisDepth
      );

      if (similarProblems.length === 0) {
        console.log("📭 No similar problems found, using tag-based hints only");
        return { useTagBasedHints: true, similarProblems: [] };
      }

      console.log(`📊 Found ${similarProblems.length} similar problems`);

      // Analyze tags of similar problems
      const tagAnalysis = await this.analyzeSimilarProblemTags(similarProblems);

      // Calculate relationship bonuses for hint scoring
      const relationshipBonuses = this.calculateRelationshipBonuses(
        problemTags,
        tagAnalysis,
        similarProblems
      );

      return {
        useTagBasedHints: false,
        similarProblems: similarProblems,
        tagAnalysis: tagAnalysis,
        relationshipBonuses: relationshipBonuses,
        contextStrength: this.calculateContextStrength(similarProblems),
      };
    } catch (error) {
      console.error("❌ Error analyzing problem context:", error);
      return { useTagBasedHints: true, similarProblems: [] };
    }
  }

  /**
   * Analyze tags of similar problems to find patterns
   * @param {Array} similarProblems - Array of similar problems with weights
   * @returns {Object} Tag analysis results
   */
  static async analyzeSimilarProblemTags(similarProblems) {
    const tagFrequency = new Map();
    const tagWeightedScore = new Map();
    let totalWeight = 0;

    for (const { problemId, weight } of similarProblems) {
      const metadata = await this.getProblemMetadata(problemId);
      if (metadata && metadata.tags) {
        totalWeight += weight;

        for (const tag of metadata.tags) {
          const normalizedTag = tag.toLowerCase().trim();

          // Count frequency
          tagFrequency.set(
            normalizedTag,
            (tagFrequency.get(normalizedTag) || 0) + 1
          );

          // Calculate weighted score
          const currentScore = tagWeightedScore.get(normalizedTag) || 0;
          tagWeightedScore.set(normalizedTag, currentScore + weight);
        }
      }
    }

    // Normalize weighted scores
    const normalizedTagScores = new Map();
    for (const [tag, score] of tagWeightedScore) {
      normalizedTagScores.set(tag, score / totalWeight);
    }

    return {
      tagFrequency: Object.fromEntries(tagFrequency),
      tagWeightedScore: Object.fromEntries(normalizedTagScores),
      totalProblemsAnalyzed: similarProblems.length,
    };
  }

  /**
   * Calculate relationship bonuses for hint scoring
   * @param {string[]} currentTags - Tags of current problem
   * @param {Object} tagAnalysis - Analysis of similar problem tags
   * @param {Array} similarProblems - Similar problems data
   * @returns {Object} Bonuses for different tag combinations
   */
  static calculateRelationshipBonuses(
    currentTags,
    tagAnalysis,
    similarProblems
  ) {
    const bonuses = new Map();
    const { tagWeightedScore } = tagAnalysis;

    // Calculate bonus for each tag combination based on similar problem patterns
    for (let i = 0; i < currentTags.length; i++) {
      for (let j = i + 1; j < currentTags.length; j++) {
        const tagA = currentTags[i].toLowerCase().trim();
        const tagB = currentTags[j].toLowerCase().trim();

        const scoreA = tagWeightedScore[tagA] || 0;
        const scoreB = tagWeightedScore[tagB] || 0;

        // Bonus is based on how frequently these tags appear together in similar problems
        const relationshipBonus = Math.min((scoreA + scoreB) * 100, 150); // Cap at 150

        const pairKey = [tagA, tagB].sort().join("+");
        bonuses.set(pairKey, relationshipBonus);
      }
    }

    return Object.fromEntries(bonuses);
  }

  /**
   * Calculate overall context strength based on similar problems
   * @param {Array} similarProblems - Similar problems with weights
   * @returns {number} Context strength score (0-1)
   */
  static calculateContextStrength(similarProblems) {
    if (similarProblems.length === 0) return 0;

    const avgWeight =
      similarProblems.reduce((sum, p) => sum + p.weight, 0) /
      similarProblems.length;
    const maxWeight = Math.max(...similarProblems.map((p) => p.weight));

    // Context strength based on number of similar problems and their weights
    const countFactor = Math.min(similarProblems.length / 10, 1); // Normalize to 0-1
    const weightFactor = avgWeight / maxWeight; // Relative strength

    return countFactor * 0.4 + weightFactor * 0.6; // Weighted combination
  }

  /**
   * Check if problem relationships exist in IndexedDB (created by dynamic system)
   * @returns {boolean} True if relationship data exists
   */
  static async areProblemRelationshipsLoaded() {
    try {
      const { buildRelationshipMap } = await import(
        "../db/problem_relationships.js"
      );
      const relationshipMap = await buildRelationshipMap();
      return relationshipMap && relationshipMap.size > 0;
    } catch (error) {
      console.error("❌ Error checking problem relationships:", error);
      return false;
    }
  }
}

export default ProblemRelationshipService;
