import {
  getSessionById,
  getLatestSession,
  saveSessionToStorage,
  saveNewSessionToDB,
  updateSessionInDB,
  getSessionPerformance,
} from "../db/sessions.js";
import { updateProblemRelationships } from "../db/problem_relationships.js";
import { ProblemService } from "../services/problemService.js";
import { calculateTagMastery, getTagMastery } from "../db/tag_mastery.js";
import { StorageService } from "./storageService.js";
import { v4 as uuidv4 } from "uuid";


export const SessionService = {
  /**
   * Centralizes session performance analysis and tracking.
   * Orchestrates tag mastery, problem relationships, and session metrics.
   * @param {Object} session - The completed session object
   * @returns {Object} Comprehensive session performance summary
   */
  async summarizeSessionPerformance(session) {
    console.info(`📊 Starting performance summary for session ${session.id}`);
    
    try {
      // 1️⃣ Capture pre-session state for delta calculations
      const preSessionTagMastery = await getTagMastery();
      const preSessionMasteryMap = new Map(preSessionTagMastery.map(tm => [tm.tag, tm]));
      
      // 2️⃣ Update problem relationships based on session attempts
      console.info("🔗 Updating problem relationships...");
      await updateProblemRelationships(session);
      
      // 3️⃣ Recalculate tag mastery with new session data
      console.info("🧠 Recalculating tag mastery...");
      await calculateTagMastery();
      
      // 4️⃣ Get updated tag mastery for delta calculation
      const postSessionTagMastery = await getTagMastery();
      const postSessionMasteryMap = new Map(postSessionTagMastery.map(tm => [tm.tag, tm]));
      
      // 5️⃣ Generate comprehensive session performance metrics
      console.info("📈 Generating session performance metrics...");
      const unmasteredTags = postSessionTagMastery
        .filter(tm => !tm.mastered)
        .map(tm => tm.tag);
      
      const performanceMetrics = await getSessionPerformance({
        recentSessionsLimit: 1, // Focus on current session
        unmasteredTags
      });
      
      // 6️⃣ Calculate mastery progression deltas
      const masteryDeltas = this.calculateMasteryDeltas(preSessionMasteryMap, postSessionMasteryMap);
      
      // 7️⃣ Analyze session difficulty distribution
      const difficultyMix = this.analyzeSessionDifficulty(session);
      
      // 8️⃣ Create comprehensive summary
      const sessionSummary = {
        sessionId: session.id,
        completedAt: new Date().toISOString(),
        performance: performanceMetrics,
        masteryProgression: {
          deltas: masteryDeltas,
          newMasteries: masteryDeltas.filter(d => d.masteredChanged && d.postMastered).length,
          decayedMasteries: masteryDeltas.filter(d => d.masteredChanged && !d.postMastered).length
        },
        difficultyAnalysis: difficultyMix,
        insights: this.generateSessionInsights(performanceMetrics, masteryDeltas, difficultyMix)
      };
      
      // 9️⃣ Log structured analytics for dashboard integration
      this.logSessionAnalytics(sessionSummary);
      
      console.info(`✅ Session performance summary completed for ${session.id}`);
      return sessionSummary;
      
    } catch (error) {
      console.error(`❌ Error summarizing session performance for ${session.id}:`, error);
      throw error;
    }
  },

  /**
   * Checks if all session problems are attempted and marks the session as complete.
   */
  async checkAndCompleteSession(sessionId) {
    const session = await getSessionById(sessionId);
    if (!session) {
      console.error(`❌ Session ${sessionId} not found.`);
        return false;
    }

    // Get all attempts related to this session
    const attemptedProblemIds = new Set(session.attempts.map((a) => a.problemId));

    // Check if all scheduled problems have been attempted
    const unattemptedProblems = session.problems.filter(
        (problem) => !attemptedProblemIds.has(problem.id)
    );

    console.info("📎 Unattempted Problems:", unattemptedProblems);

    if (unattemptedProblems.length === 0) {
        // ✅ Mark session as completed
        session.status = "completed";
        await updateSessionInDB(session);

        console.info(`✅ Session ${sessionId} marked as completed.`);

        // ✅ Run centralized session performance analysis
        await this.summarizeSessionPerformance(session);

    }
    return unattemptedProblems;
  },

  /**
   * Attempts to resume an existing in-progress session.
   * @returns {Promise<Array|null>} - Array of remaining problems or null if no resumable session
   */
  async resumeSession() {
    const latestSession = await getLatestSession();
    console.info("✅ latestSession:", latestSession);

    if (latestSession && latestSession.status === "in_progress") {
      console.info("📌 Found ongoing session. Checking attempts...");

      let problems = await this.checkAndCompleteSession(latestSession.id);
      console.info("✅ Session completion check:", problems);

      if (problems.length > 0) {
        console.info("📌 Returning unattempted problems:", problems);
        await saveSessionToStorage(latestSession);
        return problems;
      }
    }

    return null;
  },

  /**
   * Creates a new session with fresh problems.
   * @returns {Promise<Array|null>} - Array of session problems or null on failure
   */
  async createNewSession() {
    console.info("📌 No ongoing session found, creating a new one...");

    const problems = await ProblemService.createSession();
    console.info("📌 problems for new session:", problems);

    if (!problems || problems.length === 0) {
      console.error("❌ No problems fetched for the new session.");
      return null;
    }

    const newSession = {
      id: uuidv4(),
      date: new Date().toISOString(),
      status: "in_progress",
      problems: problems,
      attempts: [],
    };

    console.info("📌 newSession:", newSession);

    await saveNewSessionToDB(newSession);
    await saveSessionToStorage(newSession);

    console.info("✅ New session created and stored:", newSession);
    return newSession.problems;
  },

  /**
   * Retrieves an existing session or creates a new one if none exists.
   */
  async getOrCreateSession() {
    console.info("📌 getOrCreateSession called");

    const settings = await StorageService.migrateSettingsToIndexedDB();
    if (!settings) {
      console.error("❌ Settings not found.");
      return null;
    }

    const resumedProblems = await this.resumeSession();
    if (resumedProblems) {
      return resumedProblems;
    }

    return await this.createNewSession();
  },
  
  /**
   * Skips a problem from the session.
   */
  async skipProblem(leetCodeID) {
    const session = await getLatestSession();
    if (!session) return null;

    session.problems = session.problems.filter(
      (p) => p.leetCodeID !== leetCodeID
    );
    await saveSessionToStorage(session, true);
    return session;
  },

  /**
   * Calculates mastery progression deltas between pre and post session states.
   * @param {Map} preSessionMap - Tag mastery before session
   * @param {Map} postSessionMap - Tag mastery after session
   * @returns {Array} Array of mastery delta objects
   */
  calculateMasteryDeltas(preSessionMap, postSessionMap) {
    const deltas = [];
    
    // Check all tags that exist in either pre or post session
    const allTags = new Set([...preSessionMap.keys(), ...postSessionMap.keys()]);
    
    for (const tag of allTags) {
      const preData = preSessionMap.get(tag);
      const postData = postSessionMap.get(tag);
      
      if (!preData && postData) {
        // New tag discovered
        deltas.push({
          tag,
          type: 'new',
          preMastered: false,
          postMastered: postData.mastered || false,
          masteredChanged: postData.mastered || false,
          strengthDelta: postData.totalAttempts || 0,
          decayDelta: (postData.decayScore || 1) - 1
        });
      } else if (preData && postData) {
        // Existing tag updated
        const masteredChanged = (preData.mastered || false) !== (postData.mastered || false);
        deltas.push({
          tag,
          type: 'updated',
          preMastered: preData.mastered || false,
          postMastered: postData.mastered || false,
          masteredChanged,
          strengthDelta: (postData.totalAttempts || 0) - (preData.totalAttempts || 0),
          decayDelta: (postData.decayScore || 1) - (preData.decayScore || 1)
        });
      }
    }
    
    return deltas.filter(d => d.strengthDelta > 0 || d.masteredChanged);
  },

  /**
   * Analyzes the difficulty distribution of problems in the session.
   * @param {Object} session - The session object
   * @returns {Object} Difficulty analysis with counts and percentages
   */
  analyzeSessionDifficulty(session) {
    const difficultyCount = { Easy: 0, Medium: 0, Hard: 0 };
    const totalProblems = session.problems.length;
    
    session.problems.forEach(problem => {
      const difficulty = problem.Rating || problem.difficulty || 'Medium';
      if (Object.prototype.hasOwnProperty.call(difficultyCount, difficulty)) {
        difficultyCount[difficulty]++;
      }
    });
    
    return {
      counts: difficultyCount,
      percentages: {
        Easy: totalProblems > 0 ? (difficultyCount.Easy / totalProblems) * 100 : 0,
        Medium: totalProblems > 0 ? (difficultyCount.Medium / totalProblems) * 100 : 0,
        Hard: totalProblems > 0 ? (difficultyCount.Hard / totalProblems) * 100 : 0
      },
      totalProblems,
      predominantDifficulty: Object.entries(difficultyCount)
        .reduce((a, b) => difficultyCount[a[0]] > difficultyCount[b[0]] ? a : b)[0]
    };
  },

  /**
   * Generates actionable insights based on session performance.
   * @param {Object} performance - Session performance metrics
   * @param {Array} masteryDeltas - Mastery progression deltas
   * @param {Object} difficultyMix - Session difficulty analysis
   * @returns {Object} Structured insights for user feedback
   */
  generateSessionInsights(performance, masteryDeltas, difficultyMix) {
    const insights = {
      accuracy: this.getAccuracyInsight(performance.accuracy),
      efficiency: this.getEfficiencyInsight(performance.avgTime, difficultyMix),
      mastery: this.getMasteryInsight(masteryDeltas),
      nextActions: []
    };
    
    // Generate next action recommendations
    if (performance.accuracy < 0.6) {
      insights.nextActions.push("Focus on review problems to solidify fundamentals");
    }
    
    if (performance.weakTags.length > 3) {
      insights.nextActions.push(`Prioritize improvement in: ${performance.weakTags.slice(0, 3).join(', ')}`);
    }
    
    if (masteryDeltas.filter(d => d.masteredChanged && d.postMastered).length > 0) {
      insights.nextActions.push("Great progress! Consider exploring more advanced patterns");
    }
    
    return insights;
  },

  /**
   * Logs structured session analytics for dashboard integration.
   * @param {Object} sessionSummary - Complete session summary
   */
  logSessionAnalytics(sessionSummary) {
    const analyticsEvent = {
      timestamp: sessionSummary.completedAt,
      type: 'session_completed',
      sessionId: sessionSummary.sessionId,
      metrics: {
        accuracy: Math.round(sessionSummary.performance.accuracy * 100) / 100,
        avgTime: Math.round(sessionSummary.performance.avgTime),
        problemsCompleted: sessionSummary.difficultyAnalysis.totalProblems,
        newMasteries: sessionSummary.masteryProgression.newMasteries,
        predominantDifficulty: sessionSummary.difficultyAnalysis.predominantDifficulty
      },
      tags: {
        strong: sessionSummary.performance.strongTags,
        weak: sessionSummary.performance.weakTags
      }
    };
    
    console.info("📊 Session Analytics:", JSON.stringify(analyticsEvent, null, 2));
    
    // Store analytics for future dashboard queries (could be enhanced with IndexedDB storage)
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['sessionAnalytics'], (result) => {
        const analytics = result.sessionAnalytics || [];
        analytics.push(analyticsEvent);
        
        // Keep only last 50 session analytics to prevent storage bloat
        const recentAnalytics = analytics.slice(-50);
        
        chrome.storage.local.set({ sessionAnalytics: recentAnalytics });
      });
    }
  },

  /**
   * Helper methods for generating insights
   */
  getAccuracyInsight(accuracy) {
    if (accuracy >= 0.9) return "Excellent accuracy! Ready for harder challenges.";
    if (accuracy >= 0.7) return "Good accuracy. Keep practicing to reach mastery.";
    if (accuracy >= 0.5) return "Accuracy needs improvement. Focus on fundamentals.";
    return "Consider reviewing concepts before attempting new problems.";
  },

  getEfficiencyInsight(avgTime, difficultyMix) {
    const expectedTimes = { Easy: 750, Medium: 1350, Hard: 1950 };
    const expected = expectedTimes[difficultyMix.predominantDifficulty] || 1350;
    
    if (avgTime < expected * 0.8) return "Very efficient solving! Good time management.";
    if (avgTime < expected * 1.2) return "Good pacing. Well within expected time ranges.";
    if (avgTime < expected * 1.5) return "Taking a bit longer than expected. Practice for speed.";
    return "Focus on time management and pattern recognition for efficiency.";
  },

  getMasteryInsight(masteryDeltas) {
    const newMasteries = masteryDeltas.filter(d => d.masteredChanged && d.postMastered).length;
    const decayed = masteryDeltas.filter(d => d.masteredChanged && !d.postMastered).length;
    
    if (newMasteries > 0 && decayed === 0) return `Excellent! Mastered ${newMasteries} new tag(s).`;
    if (newMasteries > decayed) return `Net positive progress: +${newMasteries - decayed} tag masteries.`;
    if (decayed > 0) return `Some tags need review. ${decayed} mastery level(s) decreased.`;
    return "Maintained current mastery levels. Consistent performance.";
  },
};
