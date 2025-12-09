/**
 * Helper functions for goals and learning efficiency data generation
 * Extracted from dashboardService.js to reduce file complexity
 */

import { getAllSessions } from "../../../shared/db/stores/sessions.js";
import { getAllAttempts } from "../../../shared/db/stores/attempts.js";
import { getInitialFocusAreas } from "./dashboardCoreHelpers.js";
import { calculateOutcomeTrends } from "./dashboardMasteryHelpers.js";
import logger from "../../../shared/utils/logging/logger.js";

/**
 * Generate goals/learning plan data structure with enhanced metrics
 */
// eslint-disable-next-line require-await
export async function generateGoalsData(providedData = {}) {
  try {
    // Get consistent focus areas from background script (no direct service calls)
    const initialFocusAreas = getInitialFocusAreas(providedData.focusAreas);

    // Use provided data or fallbacks - no direct service calls
    const settings = providedData.settings || {
      sessionsPerWeek: 5,
      sessionLength: "auto",
      focusAreas: initialFocusAreas,
      difficultyDistribution: { easy: 20, medium: 60, hard: 20 },
      reviewRatio: 40,
      numberofNewProblemsPerSession: 4
    };

    const allAttempts = providedData.allAttempts || [];
    const allSessions = providedData.allSessions || [];
    const _learningState = providedData.learningState || null;
    const hintsUsed = providedData.hintsUsed || { total: 0, contextual: 0, general: 0, primer: 0 };

    // Calculate outcome trends from provided data
    const outcomeTrends = allAttempts.length > 0 && allSessions.length > 0
      ? calculateOutcomeTrends(allAttempts, allSessions, settings, hintsUsed)
      : (() => {
          // Calculate fallback target using same logic as calculateOutcomeTrends
          const fallbackSessionsPerWeek = settings.sessionsPerWeek || 2;
          const fallbackSessionLength = settings.sessionLength;
          const fallbackMaxProblems = fallbackSessionLength === 'auto'
            ? 12
            : (typeof fallbackSessionLength === 'number' ? fallbackSessionLength : 5);
          const fallbackTarget = fallbackSessionsPerWeek * fallbackMaxProblems;

          return {
            weeklyAccuracy: { value: 0, status: "behind", target: 75 },
            problemsPerWeek: { value: 0, status: "behind", target: fallbackTarget, display: "0" },
            hintEfficiency: { value: 0, status: "behind", display: "0 hints/problem" },
            learningVelocity: { value: "Steady", status: "adaptive" }
          };
        })();

    return {
      learningPlan: {
        cadence: {
          sessionsPerWeek: settings.sessionsPerWeek || 5,
          sessionLength: settings.sessionLength ?? "auto",
          flexibleSchedule: settings.flexibleSchedule !== false
        },
        focus: {
          primaryTags: settings.focusAreas || [],
          userFocusAreas: providedData.userFocusAreas || [],
          systemFocusTags: providedData.systemFocusTags || [],
          activeFocusTags: providedData.focusDecision?.activeFocusTags || (settings.focusAreas || []),
          algorithmReasoning: providedData.focusDecision?.algorithmReasoning || null,
          onboarding: providedData.focusDecision?.onboarding || false,
          performanceLevel: providedData.focusDecision?.performanceLevel || null,
          difficultyDistribution: settings.difficultyDistribution || { easy: 20, medium: 60, hard: 20 },
          reviewRatio: settings.reviewRatio || 40
        },
        guardrails: {
          minReviewRatio: 30,
          maxNewProblems: settings.numberofNewProblemsPerSession || 4,
          difficultyCapEnabled: true,
          maxDifficulty: "Medium",
          hintLimitEnabled: false,
          maxHintsPerProblem: 3
        },
        outcomeTrends
      }
    };
  } catch (error) {
    logger.error("Error generating goals data:", error);
    return {
      learningPlan: {
        cadence: { sessionsPerWeek: 5, sessionLength: "auto", flexibleSchedule: true },
        focus: { primaryTags: [], difficultyDistribution: { easy: 20, medium: 60, hard: 20 }, reviewRatio: 40 },
        guardrails: { minReviewRatio: 30, maxNewProblems: 5, difficultyCapEnabled: true, maxDifficulty: "Medium", hintLimitEnabled: false, maxHintsPerProblem: 3 },
        outcomeTrends: {
          weeklyAccuracy: { value: 0, status: "behind", target: 75 },
          problemsPerWeek: { value: 0, status: "behind", target: "25-30", display: "0" },
          hintEfficiency: { value: 0, status: "behind", display: "<0 per problem" },
          learningVelocity: { value: "Steady", status: "adaptive" }
        }
      }
    };
  }
}

/**
 * Calculate learning efficiency metrics from session data
 * Returns efficiency, retention, and momentum trends over recent sessions
 */
export async function getLearningEfficiencyData() {
  try {
    const [allSessions, allAttempts] = await Promise.all([
      getAllSessions(),
      getAllAttempts()
    ]);

    // Filter to completed sessions with attempts
    const completedSessions = allSessions
      .filter(s => s.status === 'completed' && s.date)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-10); // Last 10 sessions

    if (completedSessions.length === 0) {
      return {
        chartData: [],
        hasData: false,
        message: 'Complete some sessions to see your learning efficiency trends'
      };
    }

    // Calculate metrics for each session
    const chartData = completedSessions.map((session, index) => {
      const sessionAttempts = allAttempts.filter(a => a.session_id === session.id);

      // Learning Efficiency: Based on success rate and speed
      const successfulAttempts = sessionAttempts.filter(a => a.success).length;
      const totalAttempts = sessionAttempts.length;
      const successRate = totalAttempts > 0 ? (successfulAttempts / totalAttempts) * 100 : 0;

      // Calculate average time efficiency (lower time = higher efficiency)
      const avgTime = sessionAttempts.length > 0
        ? sessionAttempts.reduce((sum, a) => sum + (a.time_spent || 0), 0) / sessionAttempts.length
        : 0;
      const timeEfficiency = avgTime > 0 ? Math.max(0, 100 - (avgTime / 60)) : 0;

      const efficiency = Math.round((successRate * 0.7) + (timeEfficiency * 0.3));

      // Knowledge Retention: Based on review problem performance
      const reviewAttempts = sessionAttempts.filter(a => a.box_level > 0);
      const successfulReviews = reviewAttempts.filter(a => a.success).length;
      const retention = reviewAttempts.length > 0
        ? Math.round((successfulReviews / reviewAttempts.length) * 100)
        : successRate;

      // Learning Momentum: Based on cumulative progress and consistency
      const problemsSolved = successfulAttempts;
      const expectedProblems = session.session_length || 5;
      const completionRate = (problemsSolved / expectedProblems) * 100;

      // Check if maintaining or improving from previous session
      let momentumBonus = 0;
      if (index > 0) {
        const prevSession = completedSessions[index - 1];
        const prevAttempts = allAttempts.filter(a => a.session_id === prevSession.session_id);
        const prevSuccessRate = prevAttempts.length > 0
          ? (prevAttempts.filter(a => a.success).length / prevAttempts.length) * 100
          : 0;

        if (successRate >= prevSuccessRate) {
          momentumBonus = 10;
        }
      }

      const momentum = Math.min(100, Math.round((completionRate * 0.6) + (successRate * 0.4) + momentumBonus));

      return {
        session: `S${index + 1}`,
        sessionId: session.id,
        date: new Date(session.date).toLocaleDateString(),
        efficiency: Math.min(100, Math.max(0, efficiency)),
        retention: Math.min(100, Math.max(0, retention)),
        momentum: Math.min(100, Math.max(0, momentum)),
        problemsSolved: problemsSolved,
        totalProblems: totalAttempts
      };
    });

    return {
      chartData,
      hasData: true,
      totalSessions: completedSessions.length,
      averages: {
        efficiency: Math.round(chartData.reduce((sum, d) => sum + d.efficiency, 0) / chartData.length),
        retention: Math.round(chartData.reduce((sum, d) => sum + d.retention, 0) / chartData.length),
        momentum: Math.round(chartData.reduce((sum, d) => sum + d.momentum, 0) / chartData.length)
      }
    };
  } catch (error) {
    logger.error('Error calculating learning efficiency data:', error);
    return {
      chartData: [],
      hasData: false,
      message: 'Error loading efficiency data'
    };
  }
}
