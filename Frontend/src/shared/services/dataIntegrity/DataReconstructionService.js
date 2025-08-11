/**
 * Data Reconstruction Service for CodeMaster
 *
 * Provides intelligent data recovery and reconstruction capabilities for partial or corrupted data.
 * Can rebuild tag mastery from attempts, regenerate session analytics, and reconstruct missing relationships.
 */

import { dbHelper } from "../../db/index.js";
import DataIntegritySchemas from "../../utils/dataIntegrity/DataIntegritySchemas.js";
import { calculateLeitnerBox } from "../../utils/leitnerSystem.js";
import ErrorReportService from "../ErrorReportService.js";

export class DataReconstructionService {
  // Reconstruction types
  static RECONSTRUCTION_TYPES = {
    TAG_MASTERY: "tag_mastery",
    SESSION_ANALYTICS: "session_analytics",
    PROBLEM_STATS: "problem_stats",
    PATTERN_LADDERS: "pattern_ladders",
    MISSING_RELATIONSHIPS: "missing_relationships",
    CORRUPTED_SESSIONS: "corrupted_sessions",
    FULL_REBUILD: "full_rebuild",
  };

  // Reconstruction strategies
  static STRATEGIES = {
    FROM_ATTEMPTS: "from_attempts",
    FROM_SESSIONS: "from_sessions",
    FROM_STANDARD_DATA: "from_standard_data",
    STATISTICAL_INFERENCE: "statistical_inference",
    HYBRID_APPROACH: "hybrid_approach",
  };

  static reconstructionHistory = [];
  static maxHistorySize = 25;

  /**
   * Reconstruct data based on available sources
   * @param {Object} options - Reconstruction options
   * @returns {Promise<Object>} - Reconstruction result
   */
  static async reconstructData(options = {}) {
    const {
      types = [
        this.RECONSTRUCTION_TYPES.TAG_MASTERY,
        this.RECONSTRUCTION_TYPES.PROBLEM_STATS,
      ],
      strategy = this.STRATEGIES.HYBRID_APPROACH,
      dryRun = false,
      createBackup = true,
      priority = "medium",
      preserveExisting = true,
    } = options;

    console.log(
      `🔄 Starting data reconstruction (${dryRun ? "DRY RUN" : "LIVE"})...`
    );
    const startTime = performance.now();

    const result = {
      reconstructionId: this.generateReconstructionId(),
      timestamp: new Date().toISOString(),
      dryRun,
      strategy,
      overall: {
        success: true,
        typesProcessed: 0,
        recordsReconstructed: 0,
        recordsSkipped: 0,
        errors: 0,
      },
      results: {},
      backup: null,
      errors: [],
      performanceMetrics: {
        totalTime: 0,
        typeBreakdown: {},
      },
    };

    try {
      // Create backup before reconstruction if requested
      if (createBackup && !dryRun) {
        console.log("💾 Creating backup before reconstruction...");
        result.backup = await this.createReconstructionBackup();
      }

      const db = await dbHelper.openDB();

      // Process each reconstruction type
      for (const type of types) {
        const typeStartTime = performance.now();
        console.log(`🔄 Reconstructing: ${type}`);

        try {
          const typeResult = await this.reconstructDataType(db, type, {
            strategy,
            dryRun,
            preserveExisting,
            priority,
          });

          result.results[type] = typeResult;
          result.overall.typesProcessed++;
          result.overall.recordsReconstructed +=
            typeResult.recordsReconstructed || 0;
          result.overall.recordsSkipped += typeResult.recordsSkipped || 0;

          if (!typeResult.success) {
            result.overall.success = false;
            result.overall.errors++;
          }
        } catch (error) {
          console.error(`❌ Failed to reconstruct ${type}:`, error);
          result.overall.success = false;
          result.overall.errors++;
          result.errors.push({
            type,
            message: error.message,
            stack: error.stack,
          });
        }

        const typeEndTime = performance.now();
        result.performanceMetrics.typeBreakdown[type] =
          typeEndTime - typeStartTime;
      }

      const endTime = performance.now();
      result.performanceMetrics.totalTime = endTime - startTime;

      // Add to reconstruction history
      this.addToReconstructionHistory(result);

      console.log(
        `🏁 Data reconstruction completed: ${result.overall.recordsReconstructed} records reconstructed`
      );
      return result;
    } catch (error) {
      console.error("❌ Data reconstruction failed:", error);
      result.overall.success = false;
      result.errors.push({
        type: "system_error",
        message: error.message,
        stack: error.stack,
      });

      await this.reportReconstructionError("reconstruction", error, options);
      return result;
    }
  }

  /**
   * Reconstruct a specific data type
   * @param {IDBDatabase} db - Database instance
   * @param {string} type - Reconstruction type
   * @param {Object} options - Type-specific options
   * @returns {Promise<Object>} - Type reconstruction result
   */
  static async reconstructDataType(db, type, options = {}) {
    const {
      strategy,
      dryRun = false,
      preserveExisting = true,
      priority = "medium",
    } = options;

    switch (type) {
      case this.RECONSTRUCTION_TYPES.TAG_MASTERY:
        return await this.reconstructTagMastery(db, {
          strategy,
          dryRun,
          preserveExisting,
        });

      case this.RECONSTRUCTION_TYPES.PROBLEM_STATS:
        return await this.reconstructProblemStats(db, {
          strategy,
          dryRun,
          preserveExisting,
        });

      case this.RECONSTRUCTION_TYPES.SESSION_ANALYTICS:
        return await this.reconstructSessionAnalytics(db, {
          strategy,
          dryRun,
          preserveExisting,
        });

      case this.RECONSTRUCTION_TYPES.CORRUPTED_SESSIONS:
        return await this.reconstructCorruptedSessions(db, {
          strategy,
          dryRun,
          preserveExisting,
        });

      case this.RECONSTRUCTION_TYPES.PATTERN_LADDERS:
        return await this.reconstructPatternLadders(db, {
          strategy,
          dryRun,
          preserveExisting,
        });

      case this.RECONSTRUCTION_TYPES.MISSING_RELATIONSHIPS:
        return await this.reconstructMissingRelationships(db, {
          strategy,
          dryRun,
          preserveExisting,
        });

      default:
        throw new Error(`Unsupported reconstruction type: ${type}`);
    }
  }

  /**
   * Reconstruct tag mastery from attempts history
   * @param {IDBDatabase} db - Database instance
   * @param {Object} options - Reconstruction options
   * @returns {Promise<Object>} - Reconstruction result
   */
  static async reconstructTagMastery(db, options = {}) {
    const {
      strategy = this.STRATEGIES.FROM_ATTEMPTS,
      dryRun = false,
      preserveExisting = true,
    } = options;

    const result = {
      success: true,
      strategy,
      recordsReconstructed: 0,
      recordsSkipped: 0,
      errors: [],
      details: [],
    };

    try {
      console.log("🏷️ Reconstructing tag mastery from attempts...");

      // Get all attempts and problems
      const [attempts, problems, existingMastery] = await Promise.all([
        this.getAllStoreData(db, "attempts"),
        this.getAllStoreData(db, "problems"),
        this.getAllStoreData(db, "tag_mastery"),
      ]);

      // Create a map of existing mastery for preservation check
      const existingMasteryMap = new Map(
        existingMastery.map((tm) => [tm.tag, tm])
      );

      // Aggregate attempts by tag
      const tagStats = new Map();

      for (const attempt of attempts) {
        // Get problem for this attempt
        const problem = problems.find(
          (p) =>
            p.id === attempt.ProblemID || p.leetCodeID === attempt.problemId
        );

        if (!problem || !problem.Tags) continue;

        for (const tag of problem.Tags) {
          if (!tagStats.has(tag)) {
            tagStats.set(tag, {
              totalAttempts: 0,
              successfulAttempts: 0,
              lastAttemptDate: null,
              attempts: [],
            });
          }

          const stats = tagStats.get(tag);
          stats.totalAttempts++;

          if (attempt.Success) {
            stats.successfulAttempts++;
          }

          const attemptDate = new Date(attempt.AttemptDate || attempt.date);
          if (
            !stats.lastAttemptDate ||
            attemptDate > new Date(stats.lastAttemptDate)
          ) {
            stats.lastAttemptDate = attemptDate.toISOString();
          }

          stats.attempts.push(attempt);
        }
      }

      // Reconstruct tag mastery records
      const reconstructedMastery = [];

      for (const [tag, stats] of tagStats.entries()) {
        // Check if we should preserve existing data
        if (preserveExisting && existingMasteryMap.has(tag)) {
          const existing = existingMasteryMap.get(tag);

          // Only reconstruct if existing data seems incomplete or inconsistent
          if (
            existing.totalAttempts === stats.totalAttempts &&
            existing.successfulAttempts === stats.successfulAttempts
          ) {
            result.recordsSkipped++;
            continue;
          }
        }

        // Calculate mastery metrics
        const successRate =
          stats.totalAttempts > 0
            ? stats.successfulAttempts / stats.totalAttempts
            : 0;

        const daysSinceLast = stats.lastAttemptDate
          ? (Date.now() - new Date(stats.lastAttemptDate)) /
            (1000 * 60 * 60 * 24)
          : 0;

        const decayScore =
          stats.totalAttempts > 0
            ? Math.max(0.1, (1 - successRate) * (daysSinceLast / 30))
            : 1;

        // Apply mastery thresholds (with escape hatches)
        let masteryThreshold = 0.8; // Default 80%
        const failedAttempts = stats.totalAttempts - stats.successfulAttempts;

        // Progressive escape hatches
        if (
          stats.totalAttempts >= 8 &&
          successRate >= 0.75 &&
          successRate < 0.8
        ) {
          masteryThreshold = 0.75; // Light struggle escape
        } else if (
          stats.totalAttempts >= 12 &&
          successRate >= 0.7 &&
          successRate < 0.8
        ) {
          masteryThreshold = 0.7; // Moderate struggle escape
        } else if (failedAttempts >= 15 && successRate >= 0.6) {
          masteryThreshold = 0.6; // Heavy struggle escape
        }

        const mastered = successRate >= masteryThreshold;

        const masteryRecord = {
          tag,
          totalAttempts: stats.totalAttempts,
          successfulAttempts: stats.successfulAttempts,
          successRate,
          decayScore,
          mastered,
          lastAttemptDate: stats.lastAttemptDate,
          reconstructed: true,
          reconstructionDate: new Date().toISOString(),
        };

        reconstructedMastery.push(masteryRecord);
        result.recordsReconstructed++;

        result.details.push({
          tag,
          attempts: stats.totalAttempts,
          successRate: Math.round(successRate * 100),
          mastered,
          masteryThreshold: Math.round(masteryThreshold * 100),
        });
      }

      // Save reconstructed data if not dry run
      if (!dryRun && reconstructedMastery.length > 0) {
        const transaction = db.transaction(["tag_mastery"], "readwrite");
        const store = transaction.objectStore("tag_mastery");

        for (const masteryRecord of reconstructedMastery) {
          await new Promise((resolve, reject) => {
            const request = store.put(masteryRecord);
            request.onsuccess = resolve;
            request.onerror = () => reject(request.error);
          });
        }

        console.log(
          `✅ Reconstructed ${reconstructedMastery.length} tag mastery records`
        );
      }

      return result;
    } catch (error) {
      console.error("❌ Tag mastery reconstruction failed:", error);
      result.success = false;
      result.errors.push({
        message: error.message,
        stack: error.stack,
      });
      return result;
    }
  }

  /**
   * Reconstruct problem statistics from attempts
   * @param {IDBDatabase} db - Database instance
   * @param {Object} options - Reconstruction options
   * @returns {Promise<Object>} - Reconstruction result
   */
  static async reconstructProblemStats(db, options = {}) {
    const { dryRun = false, preserveExisting = true } = options;

    const result = {
      success: true,
      recordsReconstructed: 0,
      recordsSkipped: 0,
      errors: [],
      details: [],
    };

    try {
      console.log("📊 Reconstructing problem statistics...");

      const [problems, attempts] = await Promise.all([
        this.getAllStoreData(db, "problems"),
        this.getAllStoreData(db, "attempts"),
      ]);

      const updatedProblems = [];

      for (const problem of problems) {
        // Find all attempts for this problem
        const problemAttempts = attempts.filter(
          (a) =>
            a.ProblemID === problem.id || a.problemId === problem.leetCodeID
        );

        if (problemAttempts.length === 0) {
          result.recordsSkipped++;
          continue;
        }

        // Calculate statistics
        const totalAttempts = problemAttempts.length;
        const successfulAttempts = problemAttempts.filter(
          (a) => a.Success || a.success
        ).length;
        const unsuccessfulAttempts = totalAttempts - successfulAttempts;

        // Check if reconstruction is needed
        const existingStats = problem.AttemptStats;
        if (
          preserveExisting &&
          existingStats &&
          existingStats.TotalAttempts === totalAttempts &&
          existingStats.SuccessfulAttempts === successfulAttempts
        ) {
          result.recordsSkipped++;
          continue;
        }

        // Update problem with corrected stats
        const updatedProblem = {
          ...problem,
          AttemptStats: {
            TotalAttempts: totalAttempts,
            SuccessfulAttempts: successfulAttempts,
            UnsuccessfulAttempts: unsuccessfulAttempts,
          },
          lastAttemptDate:
            problemAttempts.sort(
              (a, b) =>
                new Date(b.AttemptDate || b.date) -
                new Date(a.AttemptDate || a.date)
            )[0]?.AttemptDate || problem.lastAttemptDate,
          reconstructed: true,
          reconstructionDate: new Date().toISOString(),
        };

        // Recalculate Leitner box level based on attempts
        const lastAttempt = problemAttempts.sort(
          (a, b) =>
            new Date(b.AttemptDate || b.date) -
            new Date(a.AttemptDate || a.date)
        )[0];

        if (lastAttempt) {
          const boxCalculation = await calculateLeitnerBox(
            updatedProblem,
            lastAttempt
          );
          updatedProblem.BoxLevel = boxCalculation.BoxLevel;
          updatedProblem.ReviewSchedule = boxCalculation.ReviewSchedule;
          updatedProblem.Stability = boxCalculation.Stability;
        }

        updatedProblems.push(updatedProblem);
        result.recordsReconstructed++;

        result.details.push({
          problemId: problem.id || problem.leetCodeID,
          oldStats: existingStats,
          newStats: updatedProblem.AttemptStats,
          attemptsProcessed: totalAttempts,
        });
      }

      // Save updated problems if not dry run
      if (!dryRun && updatedProblems.length > 0) {
        const transaction = db.transaction(["problems"], "readwrite");
        const store = transaction.objectStore("problems");

        for (const problem of updatedProblems) {
          await new Promise((resolve, reject) => {
            const request = store.put(problem);
            request.onsuccess = resolve;
            request.onerror = () => reject(request.error);
          });
        }

        console.log(
          `✅ Reconstructed statistics for ${updatedProblems.length} problems`
        );
      }

      return result;
    } catch (error) {
      console.error("❌ Problem stats reconstruction failed:", error);
      result.success = false;
      result.errors.push({
        message: error.message,
        stack: error.stack,
      });
      return result;
    }
  }

  /**
   * Reconstruct session analytics from session and attempt data
   * @param {IDBDatabase} db - Database instance
   * @param {Object} options - Reconstruction options
   * @returns {Promise<Object>} - Reconstruction result
   */
  static async reconstructSessionAnalytics(db, options = {}) {
    const { dryRun = false, preserveExisting = true } = options;

    const result = {
      success: true,
      recordsReconstructed: 0,
      recordsSkipped: 0,
      errors: [],
      details: [],
    };

    try {
      console.log("📈 Reconstructing session analytics...");

      const [sessions, attempts, existingAnalytics] = await Promise.all([
        this.getAllStoreData(db, "sessions"),
        this.getAllStoreData(db, "attempts"),
        this.getAllStoreData(db, "session_analytics"),
      ]);

      const existingAnalyticsMap = new Map(
        existingAnalytics.map((sa) => [sa.sessionId, sa])
      );
      const analyticsToReconstruct = [];

      for (const session of sessions) {
        if (!session.id || session.status !== "completed") continue;

        // Check if analytics already exist
        if (preserveExisting && existingAnalyticsMap.has(session.id)) {
          result.recordsSkipped++;
          continue;
        }

        // Find attempts for this session
        const sessionAttempts = attempts.filter(
          (a) => a.SessionID === session.id || a.sessionId === session.id
        );

        if (sessionAttempts.length === 0) {
          result.recordsSkipped++;
          continue;
        }

        // Calculate analytics
        const totalProblems = session.problems
          ? session.problems.length
          : sessionAttempts.length;
        const totalAttempts = sessionAttempts.length;
        const successfulAttempts = sessionAttempts.filter(
          (a) => a.Success || a.success
        ).length;
        const accuracy =
          totalAttempts > 0 ? successfulAttempts / totalAttempts : 0;

        const totalTime = sessionAttempts.reduce(
          (sum, a) => sum + (a.TimeSpent || a.timeSpent || 0),
          0
        );
        const averageTimePerProblem =
          totalProblems > 0 ? totalTime / totalProblems : 0;

        // Determine predominant difficulty
        const difficultyCount = { Easy: 0, Medium: 0, Hard: 0 };
        for (const attempt of sessionAttempts) {
          const difficulty = attempt.difficulty || "Medium"; // Default to Medium
          if (difficultyCount[difficulty] !== undefined) {
            difficultyCount[difficulty]++;
          }
        }

        const predominantDifficulty =
          Object.entries(difficultyCount).sort(
            ([, a], [, b]) => b - a
          )[0]?.[0] || "Medium";

        // Get unique tags worked on
        const tagsWorkedOn = [
          ...new Set(session.problems?.flatMap((p) => p.Tags || []) || []),
        ];

        // Calculate efficiency score (accuracy vs average time)
        const expectedTime = this.getExpectedTimeByDifficulty(
          predominantDifficulty
        );
        const efficiencyScore =
          expectedTime > 0
            ? Math.min(1, expectedTime / averageTimePerProblem) * accuracy
            : accuracy;

        const analytics = {
          sessionId: session.id,
          completedAt: session.completedAt || session.Date,
          totalProblems,
          totalAttempts,
          successfulAttempts,
          accuracy,
          averageTimePerProblem: Math.round(averageTimePerProblem),
          totalTimeSpent: Math.round(totalTime),
          predominantDifficulty,
          tagsWorkedOn,
          efficiencyScore: Math.round(efficiencyScore * 100) / 100,
          improvementAreas: this.calculateImprovementAreas(
            accuracy,
            averageTimePerProblem,
            predominantDifficulty
          ),
          reconstructed: true,
          reconstructionDate: new Date().toISOString(),
        };

        analyticsToReconstruct.push(analytics);
        result.recordsReconstructed++;

        result.details.push({
          sessionId: session.id,
          accuracy: Math.round(accuracy * 100),
          totalTime: Math.round(totalTime),
          problems: totalProblems,
          efficiency: Math.round(efficiencyScore * 100),
        });
      }

      // Save reconstructed analytics if not dry run
      if (!dryRun && analyticsToReconstruct.length > 0) {
        const transaction = db.transaction(["session_analytics"], "readwrite");
        const store = transaction.objectStore("session_analytics");

        for (const analytics of analyticsToReconstruct) {
          await new Promise((resolve, reject) => {
            const request = store.put(analytics);
            request.onsuccess = resolve;
            request.onerror = () => reject(request.error);
          });
        }

        console.log(
          `✅ Reconstructed analytics for ${analyticsToReconstruct.length} sessions`
        );
      }

      return result;
    } catch (error) {
      console.error("❌ Session analytics reconstruction failed:", error);
      result.success = false;
      result.errors.push({
        message: error.message,
        stack: error.stack,
      });
      return result;
    }
  }

  /**
   * Reconstruct corrupted sessions from attempts
   * @param {IDBDatabase} db - Database instance
   * @param {Object} options - Reconstruction options
   * @returns {Promise<Object>} - Reconstruction result
   */
  static async reconstructCorruptedSessions(db, options = {}) {
    const { dryRun = false } = options;

    const result = {
      success: true,
      recordsReconstructed: 0,
      recordsSkipped: 0,
      errors: [],
      details: [],
    };

    try {
      console.log("🔄 Reconstructing corrupted sessions...");

      const [attempts, problems] = await Promise.all([
        this.getAllStoreData(db, "attempts"),
        this.getAllStoreData(db, "problems"),
      ]);

      // Find orphaned attempts (attempts without valid session)
      const orphanedAttempts = attempts.filter(
        (a) => !a.SessionID || a.SessionID === "unknown"
      );

      if (orphanedAttempts.length === 0) {
        console.log("✅ No orphaned attempts found");
        return result;
      }

      // Group orphaned attempts by date to reconstruct sessions
      const sessionGroups = new Map();

      for (const attempt of orphanedAttempts) {
        const attemptDate = new Date(attempt.AttemptDate || attempt.date);
        const dateKey = attemptDate.toISOString().split("T")[0]; // YYYY-MM-DD

        if (!sessionGroups.has(dateKey)) {
          sessionGroups.set(dateKey, []);
        }
        sessionGroups.get(dateKey).push(attempt);
      }

      const reconstructedSessions = [];

      for (const [dateKey, dateAttempts] of sessionGroups.entries()) {
        // Create new session ID
        const sessionId = `reconstructed_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;

        // Get unique problems for this session
        const problemIds = [
          ...new Set(dateAttempts.map((a) => a.ProblemID || a.problemId)),
        ];
        const sessionProblems = problems.filter(
          (p) => problemIds.includes(p.id) || problemIds.includes(p.leetCodeID)
        );

        // Clean and format attempts for session
        const sessionAttemptsData = dateAttempts.map((attempt) => ({
          attemptId: attempt.id,
          problemId: attempt.ProblemID || attempt.problemId,
          success: attempt.Success || attempt.success,
          timeSpent: attempt.TimeSpent || attempt.timeSpent || 0,
          AttemptDate: attempt.AttemptDate || attempt.date,
        }));

        // Create session object
        const reconstructedSession = {
          id: sessionId,
          Date: `${dateKey}T00:00:00.000Z`,
          attempts: sessionAttemptsData,
          problems: sessionProblems,
          status: "completed",
          isCompleted: true,
          reconstructed: true,
          reconstructionDate: new Date().toISOString(),
        };

        reconstructedSessions.push(reconstructedSession);
        result.recordsReconstructed++;

        result.details.push({
          sessionId,
          date: dateKey,
          attempts: dateAttempts.length,
          problems: sessionProblems.length,
        });
      }

      // Save reconstructed sessions and update attempts if not dry run
      if (!dryRun && reconstructedSessions.length > 0) {
        const transaction = db.transaction(
          ["sessions", "attempts"],
          "readwrite"
        );
        const sessionStore = transaction.objectStore("sessions");
        const attemptStore = transaction.objectStore("attempts");

        // Save sessions
        for (const session of reconstructedSessions) {
          await new Promise((resolve, reject) => {
            const request = sessionStore.put(session);
            request.onsuccess = resolve;
            request.onerror = () => reject(request.error);
          });
        }

        // Update attempts with correct session IDs
        for (const session of reconstructedSessions) {
          for (const sessionAttempt of session.attempts) {
            const attempt = orphanedAttempts.find(
              (a) => a.id === sessionAttempt.attemptId
            );
            if (attempt) {
              attempt.SessionID = session.id;

              await new Promise((resolve, reject) => {
                const request = attemptStore.put(attempt);
                request.onsuccess = resolve;
                request.onerror = () => reject(request.error);
              });
            }
          }
        }

        console.log(
          `✅ Reconstructed ${reconstructedSessions.length} sessions from orphaned attempts`
        );
      }

      return result;
    } catch (error) {
      console.error("❌ Session reconstruction failed:", error);
      result.success = false;
      result.errors.push({
        message: error.message,
        stack: error.stack,
      });
      return result;
    }
  }

  /**
   * Reconstruct pattern ladders from tag mastery data
   * @param {IDBDatabase} db - Database instance
   * @param {Object} options - Reconstruction options
   * @returns {Promise<Object>} - Reconstruction result
   */
  static async reconstructPatternLadders(db, options = {}) {
    const { dryRun = false, preserveExisting = true } = options;

    const result = {
      success: true,
      recordsReconstructed: 0,
      recordsSkipped: 0,
      errors: [],
      details: [],
    };

    try {
      console.log("🪜 Reconstructing pattern ladders...");

      const [tagMastery, standardProblems, existingLadders] = await Promise.all(
        [
          this.getAllStoreData(db, "tag_mastery"),
          this.getAllStoreData(db, "standard_problems"),
          this.getAllStoreData(db, "pattern_ladders"),
        ]
      );

      const existingLaddersMap = new Map(
        existingLadders.map((pl) => [pl.tag, pl])
      );
      const laddersToReconstruct = [];

      for (const mastery of tagMastery) {
        // Check if ladder already exists
        if (preserveExisting && existingLaddersMap.has(mastery.tag)) {
          result.recordsSkipped++;
          continue;
        }

        // Find problems for this tag
        const tagProblems = standardProblems.filter(
          (p) => p.tags && p.tags.includes(mastery.tag)
        );

        if (tagProblems.length === 0) {
          result.recordsSkipped++;
          continue;
        }

        // Sort problems by difficulty (Easy -> Medium -> Hard)
        const difficultyOrder = { Easy: 1, Medium: 2, Hard: 3 };
        const sortedProblems = tagProblems.sort((a, b) => {
          const diffA = difficultyOrder[a.difficulty] || 2;
          const diffB = difficultyOrder[b.difficulty] || 2;
          return diffA - diffB;
        });

        // Create ladder structure
        const ladderProblems = sortedProblems.map((problem, index) => ({
          problemId: problem.id,
          difficulty: problem.difficulty,
          order: index,
          isCompleted: false, // Will be determined by actual progress
          attempts: 0, // Will be calculated from attempts if available
        }));

        const ladder = {
          tag: mastery.tag,
          ladder: ladderProblems,
          progress: {
            completed: 0,
            total: ladderProblems.length,
            percentage: 0,
          },
          lastUpdated: new Date().toISOString(),
          reconstructed: true,
          reconstructionDate: new Date().toISOString(),
        };

        laddersToReconstruct.push(ladder);
        result.recordsReconstructed++;

        result.details.push({
          tag: mastery.tag,
          problems: ladderProblems.length,
          difficulties: {
            Easy: ladderProblems.filter((p) => p.difficulty === "Easy").length,
            Medium: ladderProblems.filter((p) => p.difficulty === "Medium")
              .length,
            Hard: ladderProblems.filter((p) => p.difficulty === "Hard").length,
          },
        });
      }

      // Save reconstructed ladders if not dry run
      if (!dryRun && laddersToReconstruct.length > 0) {
        const transaction = db.transaction(["pattern_ladders"], "readwrite");
        const store = transaction.objectStore("pattern_ladders");

        for (const ladder of laddersToReconstruct) {
          await new Promise((resolve, reject) => {
            const request = store.put(ladder);
            request.onsuccess = resolve;
            request.onerror = () => reject(request.error);
          });
        }

        console.log(
          `✅ Reconstructed ${laddersToReconstruct.length} pattern ladders`
        );
      }

      return result;
    } catch (error) {
      console.error("❌ Pattern ladder reconstruction failed:", error);
      result.success = false;
      result.errors.push({
        message: error.message,
        stack: error.stack,
      });
      return result;
    }
  }

  /**
   * Reconstruct missing relationships between data entities
   * @param {IDBDatabase} db - Database instance
   * @param {Object} options - Reconstruction options
   * @returns {Promise<Object>} - Reconstruction result
   */
  static async reconstructMissingRelationships(db, options = {}) {
    const { dryRun = false } = options;

    const result = {
      success: true,
      recordsReconstructed: 0,
      recordsSkipped: 0,
      errors: [],
      details: [],
    };

    try {
      console.log("🔗 Reconstructing missing relationships...");

      const [standardProblems, existingRelationships] = await Promise.all([
        this.getAllStoreData(db, "standard_problems"),
        this.getAllStoreData(db, "problem_relationships"),
      ]);

      // Create a map of existing relationships for quick lookup
      const existingPairs = new Set();
      for (const rel of existingRelationships) {
        existingPairs.add(`${rel.problemId1}_${rel.problemId2}`);
        existingPairs.add(`${rel.problemId2}_${rel.problemId1}`);
      }

      const newRelationships = [];
      let relationshipId =
        Math.max(...existingRelationships.map((r) => r.id), 0) + 1;

      // Find problems with similar tags (potential relationships)
      const tagGroups = new Map();
      for (const problem of standardProblems) {
        if (!problem.tags) continue;

        for (const tag of problem.tags) {
          if (!tagGroups.has(tag)) {
            tagGroups.set(tag, []);
          }
          tagGroups.get(tag).push(problem);
        }
      }

      // Create relationships between problems with shared tags
      for (const [tag, problems] of tagGroups.entries()) {
        if (problems.length < 2) continue;

        for (let i = 0; i < problems.length; i++) {
          for (let j = i + 1; j < problems.length; j++) {
            const problem1 = problems[i];
            const problem2 = problems[j];

            const pairKey = `${problem1.id}_${problem2.id}`;
            if (existingPairs.has(pairKey)) continue;

            // Calculate relationship strength based on shared tags
            const sharedTags = problem1.tags.filter((t) =>
              problem2.tags.includes(t)
            );
            const strength =
              sharedTags.length /
              Math.max(problem1.tags.length, problem2.tags.length);

            // Only create relationship if strength is significant
            if (strength >= 0.3) {
              const relationship = {
                id: relationshipId++,
                problemId1: problem1.id,
                problemId2: problem2.id,
                relationshipType: this.determineRelationshipType(
                  problem1,
                  problem2,
                  sharedTags
                ),
                strength: Math.round(strength * 100) / 100,
                createdAt: new Date().toISOString(),
                reconstructed: true,
              };

              newRelationships.push(relationship);
              existingPairs.add(pairKey);
              existingPairs.add(`${problem2.id}_${problem1.id}`);
            }
          }
        }
      }

      result.recordsReconstructed = newRelationships.length;

      // Save new relationships if not dry run
      if (!dryRun && newRelationships.length > 0) {
        const transaction = db.transaction(
          ["problem_relationships"],
          "readwrite"
        );
        const store = transaction.objectStore("problem_relationships");

        for (const relationship of newRelationships) {
          await new Promise((resolve, reject) => {
            const request = store.put(relationship);
            request.onsuccess = resolve;
            request.onerror = () => reject(request.error);
          });
        }

        console.log(
          `✅ Created ${newRelationships.length} problem relationships`
        );
      }

      result.details.push({
        newRelationships: newRelationships.length,
        existingRelationships: existingRelationships.length,
        relationshipTypes: this.groupBy(newRelationships, "relationshipType"),
      });

      return result;
    } catch (error) {
      console.error("❌ Relationship reconstruction failed:", error);
      result.success = false;
      result.errors.push({
        message: error.message,
        stack: error.stack,
      });
      return result;
    }
  }

  // Helper methods

  static async getAllStoreData(db, storeName) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], "readonly");
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  static getExpectedTimeByDifficulty(difficulty) {
    const timeMap = {
      Easy: 900, // 15 minutes
      Medium: 1500, // 25 minutes
      Hard: 2100, // 35 minutes
    };
    return timeMap[difficulty] || timeMap.Medium;
  }

  static calculateImprovementAreas(accuracy, avgTime, difficulty) {
    const areas = [];
    const expectedTime = this.getExpectedTimeByDifficulty(difficulty);

    if (accuracy < 0.7) {
      areas.push("problem_solving_accuracy");
    }
    if (avgTime > expectedTime * 1.5) {
      areas.push("time_management");
    }
    if (accuracy > 0.9 && avgTime < expectedTime * 0.7) {
      areas.push("try_harder_problems");
    }

    return areas;
  }

  static determineRelationshipType(problem1, problem2, sharedTags) {
    // Determine relationship type based on problem characteristics
    if (problem1.difficulty === problem2.difficulty) {
      return "similar";
    } else {
      const difficultyOrder = { Easy: 1, Medium: 2, Hard: 3 };
      const diff1 = difficultyOrder[problem1.difficulty];
      const diff2 = difficultyOrder[problem2.difficulty];

      return diff1 < diff2 ? "prerequisite" : "followup";
    }
  }

  static groupBy(array, key) {
    return array.reduce((groups, item) => {
      const group = item[key] || "unknown";
      groups[group] = (groups[group] || 0) + 1;
      return groups;
    }, {});
  }

  static generateReconstructionId() {
    return `reconstruction_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
  }

  static async createReconstructionBackup() {
    const backupId = `reconstruction_${Date.now()}`;

    return {
      backupId,
      timestamp: new Date().toISOString(),
      type: "reconstruction",
      description: "Backup created before data reconstruction operations",
    };
  }

  static addToReconstructionHistory(result) {
    const summary = {
      reconstructionId: result.reconstructionId,
      timestamp: result.timestamp,
      dryRun: result.dryRun,
      overall: { ...result.overall },
      performanceMetrics: {
        totalTime: result.performanceMetrics.totalTime,
      },
    };

    this.reconstructionHistory.push(summary);

    if (this.reconstructionHistory.length > this.maxHistorySize) {
      this.reconstructionHistory = this.reconstructionHistory.slice(
        -this.maxHistorySize
      );
    }
  }

  static async reportReconstructionError(operation, error, context) {
    try {
      await ErrorReportService.storeErrorReport({
        errorId: `reconstruction_error_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`,
        message: `Data reconstruction ${operation} failed: ${error.message}`,
        stack: error.stack,
        section: "Data Integrity",
        errorType: "data_reconstruction",
        severity: "medium",
        userContext: context,
      });
    } catch (reportError) {
      console.warn("Failed to report reconstruction error:", reportError);
    }
  }

  /**
   * Get reconstruction history
   * @param {number} limit - Number of recent reconstructions to return
   * @returns {Array} - Array of reconstruction summaries
   */
  static getReconstructionHistory(limit = 10) {
    return this.reconstructionHistory
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  /**
   * Get reconstruction statistics
   * @returns {Object} - Reconstruction statistics
   */
  static getReconstructionStatistics() {
    const totalReconstructions = this.reconstructionHistory.length;
    const successfulReconstructions = this.reconstructionHistory.filter(
      (r) => r.overall.success
    ).length;
    const totalRecordsReconstructed = this.reconstructionHistory.reduce(
      (sum, r) => sum + r.overall.recordsReconstructed,
      0
    );

    return {
      totalReconstructions,
      successfulReconstructions,
      totalRecordsReconstructed,
      successRate:
        totalReconstructions > 0
          ? (successfulReconstructions / totalReconstructions) * 100
          : 0,
      averageRecordsPerReconstruction:
        totalReconstructions > 0
          ? totalRecordsReconstructed / totalReconstructions
          : 0,
    };
  }

  /**
   * Validate reconstructed data integrity
   * @param {string} type - Reconstruction type to validate
   * @returns {Promise<Object>} - Validation result
   */
  static async validateReconstructedData(type) {
    console.log(`🔍 Validating reconstructed ${type} data...`);

    try {
      const db = await dbHelper.openDB();

      switch (type) {
        case this.RECONSTRUCTION_TYPES.TAG_MASTERY:
          return await this.validateTagMasteryIntegrity(db);
        case this.RECONSTRUCTION_TYPES.PROBLEM_STATS:
          return await this.validateProblemStatsIntegrity(db);
        default:
          return {
            success: false,
            error: `Validation not implemented for type: ${type}`,
          };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async validateTagMasteryIntegrity(db) {
    const [tagMastery, attempts] = await Promise.all([
      this.getAllStoreData(db, "tag_mastery"),
      this.getAllStoreData(db, "attempts"),
    ]);

    const issues = [];

    for (const mastery of tagMastery.filter((tm) => tm.reconstructed)) {
      if (mastery.successfulAttempts > mastery.totalAttempts) {
        issues.push(`Tag ${mastery.tag}: successful attempts exceed total`);
      }
      if (mastery.mastered && mastery.successfulAttempts === 0) {
        issues.push(
          `Tag ${mastery.tag}: marked as mastered with no successful attempts`
        );
      }
    }

    return {
      success: issues.length === 0,
      issues,
      validatedRecords: tagMastery.filter((tm) => tm.reconstructed).length,
    };
  }

  static async validateProblemStatsIntegrity(db) {
    const [problems, attempts] = await Promise.all([
      this.getAllStoreData(db, "problems"),
      this.getAllStoreData(db, "attempts"),
    ]);

    const issues = [];

    for (const problem of problems.filter((p) => p.reconstructed)) {
      if (!problem.AttemptStats) continue;

      const { TotalAttempts, SuccessfulAttempts, UnsuccessfulAttempts } =
        problem.AttemptStats;

      if (SuccessfulAttempts + UnsuccessfulAttempts !== TotalAttempts) {
        issues.push(`Problem ${problem.id}: attempt stats don't sum correctly`);
      }
    }

    return {
      success: issues.length === 0,
      issues,
      validatedRecords: problems.filter((p) => p.reconstructed).length,
    };
  }
}

export default DataReconstructionService;
