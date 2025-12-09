/**
 * Problem Service Interview Functions
 * Extracted from problemService.js
 */

import { buildAdaptiveSessionSettings } from "../../db/stores/sessions.js";
import { InterviewService } from "./interviewService.js";
import logger from "../../utils/logging/logger.js";
import { normalizeProblems } from "./problemNormalizer.js";

/**
 * Create interview session with specified mode
 */
export async function createInterviewSession(mode, fetchAndAssembleInterviewProblems, createSession) {
  const operationStart = Date.now();
  try {
    logger.info(`Creating interview session in ${mode} mode`);

    logger.info("Calling InterviewService.createInterviewSession");
    const configStart = Date.now();

    const interviewConfig = await InterviewService.createInterviewSession(mode);
    const configDuration = Date.now() - configStart;

    logger.info("InterviewService returned config:", {
      hasConfig: !!interviewConfig,
      sessionLength: interviewConfig?.sessionLength,
      hasCriteria: !!interviewConfig?.selectionCriteria,
      configTime: configDuration + 'ms'
    });

    logger.info("Calling fetchAndAssembleInterviewProblems");
    const problemsStart = Date.now();

    const PROBLEM_FETCH_TIMEOUT = 12000;
    const problemTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`fetchAndAssembleInterviewProblems timed out after ${PROBLEM_FETCH_TIMEOUT}ms`)), PROBLEM_FETCH_TIMEOUT);
    });

    const problems = await Promise.race([
      fetchAndAssembleInterviewProblems(
        interviewConfig.sessionLength,
        interviewConfig.selectionCriteria,
        mode
      ),
      problemTimeout
    ]);
    const problemsDuration = Date.now() - problemsStart;

    logger.info("fetchAndAssembleInterviewProblems returned:", {
      problemCount: problems?.length,
      firstProblem: problems?.[0]?.title,
      problemsTime: problemsDuration + 'ms'
    });

    const result = {
      problems,
      session_type: mode,
      interviewConfig: interviewConfig.config,
      interviewMetrics: interviewConfig.interviewMetrics,
      createdAt: interviewConfig.createdAt
    };

    const totalDuration = Date.now() - operationStart;
    logger.info("Returning interview session data:", {
      problemCount: result.problems?.length,
      session_type: result.session_type,
      hasConfig: !!result.interviewConfig,
      totalTime: totalDuration + 'ms'
    });

    return result;
  } catch (error) {
    const totalDuration = Date.now() - operationStart;
    logger.error("ERROR creating interview session:", error);
    logger.error(`Failed after ${totalDuration}ms`);

    if (error.message.includes('timed out')) {
      logger.error("Interview session creation timed out - likely database or service hang");
      throw new Error(`Interview session creation timed out after ${totalDuration}ms: ${error.message}`);
    }

    logger.info("Falling back to standard session creation");
    try {
      const fallbackProblems = await createSession();
      return {
        problems: fallbackProblems,
        session_type: 'standard',
        error: `Interview session failed: ${error.message}`,
        fallbackUsed: true
      };
    } catch (fallbackError) {
      logger.error("Even fallback session creation failed:", fallbackError);
      throw new Error(`Both interview and fallback session creation failed: ${error.message}`);
    }
  }
}

/**
 * Apply interview problem mix based on selection criteria
 */
export function applyProblemMix(availableProblems, selectionCriteria, sessionLength, shuffleArray) {
  logger.info("Applying interview problem mix");
  const { problemMix } = selectionCriteria;

  const masteredCount = Math.floor(sessionLength * (problemMix.mastered || 0));
  const nearMasteryCount = Math.floor(sessionLength * (problemMix.nearMastery || 0));
  const challengingCount = sessionLength - masteredCount - nearMasteryCount;

  logger.info(`Problem distribution - Mastered: ${masteredCount}, Near-mastery: ${nearMasteryCount}, Challenging: ${challengingCount}`);

  let selectedProblems = [];

  if (selectionCriteria.masteredTags && selectionCriteria.masteredTags.length > 0) {
    const masteredProblems = availableProblems.filter(problem => {
      const problemTags = problem.Tags || [];
      return problemTags.some(tag =>
        selectionCriteria.masteredTags.includes(tag.toLowerCase())
      );
    });
    selectedProblems.push(...shuffleArray(masteredProblems).slice(0, masteredCount));
    logger.info(`Added ${Math.min(masteredProblems.length, masteredCount)} mastered problems`);
  }

  if (selectionCriteria.nearMasteryTags && selectionCriteria.nearMasteryTags.length > 0) {
    const nearMasteryProblems = availableProblems.filter(problem => {
      const problemTags = problem.Tags || [];
      return problemTags.some(tag =>
        selectionCriteria.nearMasteryTags.includes(tag.toLowerCase())
      ) && !selectedProblems.includes(problem);
    });
    selectedProblems.push(...shuffleArray(nearMasteryProblems).slice(0, nearMasteryCount));
    logger.info(`Added ${Math.min(nearMasteryProblems.length, nearMasteryCount)} near-mastery problems`);
  }

  const remainingProblems = availableProblems.filter(problem =>
    !selectedProblems.includes(problem)
  );
  selectedProblems.push(...shuffleArray(remainingProblems).slice(0, challengingCount));
  logger.info(`Added ${Math.min(remainingProblems.length, challengingCount)} challenging problems`);

  return selectedProblems;
}

/**
 * Filter problems by allowed tags
 */
export function filterProblemsByTags(allProblems, selectionCriteria) {
  if (selectionCriteria && selectionCriteria.allowedTags && selectionCriteria.allowedTags.length > 0) {
    logger.info("Filtering by tags:", selectionCriteria.allowedTags);
    const filteredByTags = allProblems.filter(problem => {
      const problemTags = problem.Tags || [];
      return problemTags.some(tag =>
        selectionCriteria.allowedTags.includes(tag.toLowerCase())
      );
    });

    logger.info(`Problems matching tag criteria: ${filteredByTags.length}`);

    if (filteredByTags.length > 0) {
      return filteredByTags;
    } else {
      logger.warn("No problems found matching interview tag criteria, using all problems");
      return allProblems;
    }
  } else {
    logger.info("No tag filtering criteria provided, using all problems");
    return allProblems;
  }
}

/**
 * Ensure we have sufficient problems for the session
 */
export function ensureSufficientProblems(selectedProblems, availableProblems, sessionLength) {
  const result = [...selectedProblems];
  while (result.length < sessionLength && availableProblems.length > result.length) {
    const remaining = availableProblems.filter(p => !result.includes(p));
    if (remaining.length > 0) {
      result.push(remaining[Math.floor(Math.random() * remaining.length)]);
    } else {
      break;
    }
  }
  return result;
}

/**
 * Handle interview session fallback when creation fails
 */
export async function handleInterviewSessionFallback(error, fetchAndAssembleSessionProblems) {
  logger.error("Error assembling interview problems:", error);
  logger.info("Attempting fallback to standard session");
  try {
    const settings = await buildAdaptiveSessionSettings();
    const fallbackProblems = await fetchAndAssembleSessionProblems(
      settings.sessionLength,
      settings.numberOfNewProblems,
      settings.currentAllowedTags,
      settings.currentDifficultyCap,
      settings.userFocusAreas,
      settings.isOnboarding
    );
    logger.info(`Fallback session created with ${fallbackProblems.length} problems`);
    return fallbackProblems;
  } catch (fallbackError) {
    logger.error("Fallback session creation also failed:", fallbackError);
    throw new Error(`Both interview and fallback session creation failed: ${error.message}`);
  }
}

/**
 * Shuffle array utility function
 */
export function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Add interview metadata to normalized problems
 */
export function addInterviewMetadata(problems, mode) {
  const normalizedProblems = normalizeProblems(problems, 'interview');

  return normalizedProblems.map(problem => ({
    ...problem,
    interviewMode: mode,
    interviewConstraints: InterviewService.getInterviewConfig(mode),
    selectionReason: {
      shortText: `Selected for ${mode} interview practice`,
      context: `Interview mode: ${mode}`,
    }
  }));
}
