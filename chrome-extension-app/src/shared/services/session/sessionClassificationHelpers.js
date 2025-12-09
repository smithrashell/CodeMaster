/**
 * Session Classification Helpers
 * Extracted from sessionService.js - session state classification and stalled detection
 */

import { openDatabase } from "../db/connectionUtils.js";
import { roundToPrecision } from "../../utils/leitner/Utils.js";
import logger from "../../utils/logging/logger.js";

/**
 * Helper method to classify interview sessions
 */
export function classifyInterviewSession(hoursStale, attemptCount) {
  if (hoursStale > 3) {
    if (attemptCount === 0 && hoursStale > 6) {
      return 'interview_abandoned';
    }
    return 'interview_stale';
  }
  return 'interview_active';
}

/**
 * Helper method to classify tracking sessions
 */
export function classifyTrackingSession(hoursStale) {
  if (hoursStale > 6) {
    return 'tracking_stale';
  }
  return 'tracking_active';
}

/**
 * Helper method to classify generator sessions
 */
export function classifyGeneratorSession(session, metrics) {
  const { hoursStale, attemptCount, progressRatio, sessionProblemsAttempted, outsideSessionAttempts } = metrics;

  if (attemptCount === 0 && hoursStale > 24) {
    return 'abandoned_at_start';
  }

  if (progressRatio >= 0.8 && hoursStale > 12) {
    return 'auto_complete_candidate';
  }

  if (attemptCount > 0 && hoursStale > 48) {
    return 'stalled_with_progress';
  }

  if (outsideSessionAttempts > 0 && sessionProblemsAttempted === 0 && hoursStale > 12) {
    return 'tracking_only_user';
  }

  return null;
}

/**
 * Multi-factor session classification for intelligent cleanup
 * Determines session health and appropriate actions based on multiple factors
 */
export function classifySessionState(session) {
  const now = Date.now();
  const lastActivity = new Date(session.last_activity_time || session.date);
  const hoursStale = (now - lastActivity.getTime()) / (1000 * 60 * 60);

  const attemptCount = session.attempts?.length || 0;
  const totalProblems = session.problems?.length || 0;
  const progressRatio = totalProblems > 0 ? attemptCount / totalProblems : 0;

  const sessionProblemsAttempted = session.attempts?.filter(attempt =>
    session.problems?.some(p =>
      p.id === attempt.problemId ||
      p.leetcode_id === attempt.problemId ||
      p.problem_id === attempt.problemId
    )
  ).length || 0;
  const outsideSessionAttempts = attemptCount - sessionProblemsAttempted;

  logger.info(`🔍 Classifying session ${session.id}:`, {
    origin: session.origin,
    status: session.status,
    hoursStale: Math.round(hoursStale * 10) / 10,
    attemptCount,
    sessionProblemsAttempted,
    outsideSessionAttempts,
    progressRatio: roundToPrecision(progressRatio)
  });

  const activeThreshold = (session.session_type === 'interview-like' || session.session_type === 'full-interview') ? 3 : 6;
  if (hoursStale < activeThreshold || session.status === "completed") {
    return "active";
  }

  if (session.session_type && (session.session_type === 'interview-like' || session.session_type === 'full-interview')) {
    return classifyInterviewSession(hoursStale, attemptCount);
  }

  if (session.origin === 'tracking') {
    return classifyTrackingSession(hoursStale);
  }

  if (session.origin === 'generator') {
    const result = classifyGeneratorSession(session, {
      hoursStale, attemptCount, progressRatio, sessionProblemsAttempted, outsideSessionAttempts
    });
    if (result) {
      return result;
    }
  }

  return 'unclear';
}

/**
 * Get recommended action for each classification
 */
export function getRecommendedAction(classification) {
  const actions = {
    'draft_expired': 'expire',
    'abandoned_at_start': 'expire',
    'auto_complete_candidate': 'auto_complete',
    'stalled_with_progress': 'flag_for_user_choice',
    'tracking_stale': 'create_new_tracking',
    'tracking_only_user': 'refresh_guided_session',
    'interview_stale': 'flag_for_user_choice',
    'interview_abandoned': 'expire'
  };

  return actions[classification] || 'no_action';
}

/**
 * Helper to get all sessions from database
 */
export async function getAllSessionsFromDB() {
  try {
    const db = await openDatabase();
    if (!db) {
      logger.error('❌ Database not initialized');
      return [];
    }

    const transaction = db.transaction(['sessions'], 'readonly');
    const store = transaction.objectStore('sessions');

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => {
        logger.error('❌ Failed to get sessions from DB:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    logger.error('❌ Error accessing sessions DB:', error);
    return [];
  }
}

/**
 * Detect all stalled sessions using classification
 */
export async function detectStalledSessions() {
  logger.info('🔍 Detecting stalled sessions...');

  const allSessions = await getAllSessionsFromDB();
  const stalledSessions = [];

  for (const session of allSessions) {
    if (session.status === 'completed') {
      continue;
    }

    const classification = classifySessionState(session);

    if (!['active', 'unclear'].includes(classification)) {
      stalledSessions.push({
        session,
        classification,
        action: getRecommendedAction(classification)
      });
    }
  }

  logger.info(`Found ${stalledSessions.length} stalled sessions:`,
    stalledSessions.map(s => `${s.session.id.substring(0, 8)}:${s.classification}`)
  );

  return stalledSessions;
}
