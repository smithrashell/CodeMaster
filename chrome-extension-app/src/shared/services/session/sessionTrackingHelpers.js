/**
 * Session Tracking Helpers
 * Extracted from sessionService.js - tracking activity analysis and session generation
 */

import { saveNewSessionToDB } from "../../db/stores/sessions.js";
import { ProblemService } from "../problem/problemService.js";
import { openDatabase } from "../../db/core/connectionUtils.js";
import { v4 as uuidv4 } from "uuid";
import logger from "../../utils/logging/logger.js";

/**
 * Generate adaptive session from recent tracking attempts
 * Used to create personalized guided sessions based on actual usage patterns
 */
export async function generateSessionFromTrackingActivity(recentAttempts) {
  logger.info(`🎯 Generating session from ${recentAttempts.length} recent tracking attempts`);

  const problemIds = [...new Set(recentAttempts.map(a => a.problemId))];
  const difficulties = recentAttempts.map(a => a.difficulty || 'Medium');
  const tags = recentAttempts.flatMap(a => a.tags || []);

  const difficultyCount = difficulties.reduce((acc, d) => {
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {});

  const tagFrequency = tags.reduce((acc, tag) => {
    acc[tag] = (acc[tag] || 0) + 1;
    return acc;
  }, {});

  const topTags = Object.entries(tagFrequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([tag]) => tag);

  logger.info('Tracking activity analysis:', {
    uniqueProblems: problemIds.length,
    topDifficulty: Object.keys(difficultyCount).reduce((a, b) =>
      difficultyCount[a] > difficultyCount[b] ? a : b
    ),
    topTags
  });

  const adaptiveConfig = {
    sessionLength: Math.min(Math.max(5, problemIds.length), 12),
    difficultyDistribution: difficultyCount,
    focusAreas: topTags,
    seedFromAttempts: problemIds
  };

  const sessionProblems = await ProblemService.createSessionWithConfig(adaptiveConfig);

  const baseSessionId = uuidv4();
  const sessionId = (globalThis._testDatabaseActive && globalThis._testDatabaseHelper?.testSessionUID)
    ? `${globalThis._testDatabaseHelper.testSessionUID}_${baseSessionId}`
    : baseSessionId;

  const generatedSession = {
    id: sessionId,
    date: new Date().toISOString(),
    ...sessionProblems,
    status: 'in_progress',
    origin: 'generator',
    last_activity_time: new Date().toISOString(),
    attempts: [],
    current_problem_index: 0,
    session_type: 'standard',
    metadata: {
      generatedFromTracking: true,
      sourceAttempts: problemIds,
      analysisData: {
        attemptCount: recentAttempts.length,
        uniqueProblems: problemIds.length,
        topDifficulty: Object.keys(difficultyCount).reduce((a, b) =>
          difficultyCount[a] > difficultyCount[b] ? a : b
        ),
        topTags
      }
    }
  };

  await saveNewSessionToDB(generatedSession);
  logger.info(`🆕 Generated in_progress session from tracking: ${generatedSession.id}`);

  return generatedSession;
}

/**
 * Get recent attempts from tracking sessions within specified hours
 */
export async function getRecentTrackingAttempts(withinHours = 48) {
  const cutoffTime = new Date(Date.now() - (withinHours * 60 * 60 * 1000));

  const db = await openDatabase();
  const transaction = db.transaction(['attempts', 'sessions'], 'readonly');
  const attemptStore = transaction.objectStore('attempts');
  const sessionStore = transaction.objectStore('sessions');

  const allAttempts = await new Promise((resolve, reject) => {
    const request = attemptStore.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const allSessions = await new Promise((resolve, reject) => {
    const request = sessionStore.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const trackingSessionIds = new Set(
    allSessions
      .filter(s => s.origin === 'tracking')
      .map(s => s.id)
  );

  const recentTrackingAttempts = allAttempts.filter(attempt => {
    const attemptDate = new Date(attempt.date);
    return attemptDate >= cutoffTime &&
      trackingSessionIds.has(attempt.SessionID);
  });

  logger.info(`Found ${recentTrackingAttempts.length} recent tracking attempts`);
  return recentTrackingAttempts;
}

/**
 * Check if we should generate a session from recent tracking activity
 * @param {Function} resumeSessionFn - Function to check for existing sessions
 */
export async function checkAndGenerateFromTracking(resumeSessionFn) {
  logger.info('🔍 Checking for session generation opportunities from tracking activity');

  try {
    const recentAttempts = await getRecentTrackingAttempts(48);

    if (recentAttempts.length < 4) {
      logger.info(`Not enough tracking activity: ${recentAttempts.length} attempts (need ≥4)`);
      return null;
    }

    const existingSession = await resumeSessionFn('standard');
    if (existingSession) {
      logger.info('Active session already exists, skipping auto-generation');
      return null;
    }

    const generatedSession = await generateSessionFromTrackingActivity(recentAttempts);

    logger.info('✅ Auto-generated guided session from tracking activity');
    return generatedSession;

  } catch (error) {
    logger.error('❌ Failed to check/generate session from tracking:', error);
    return null;
  }
}
