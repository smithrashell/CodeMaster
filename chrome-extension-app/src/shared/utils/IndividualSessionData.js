import { format } from "date-fns";
import {
  createCacheKey,
  getCachedResult,
  setCachedResult
} from "./DataAdapterHelpers.js";

// --- Individual Session Accuracy (for Session History page) ---
export function getIndividualSessionAccuracyData(sessions) {
  const cacheKey = createCacheKey(sessions, 'individual', 'getIndividualSessionAccuracyData');
  const cachedResult = getCachedResult(cacheKey);
  if (cachedResult) return cachedResult;

  if (!Array.isArray(sessions)) {
    console.warn("Invalid sessions array provided to getIndividualSessionAccuracyData:", sessions);
    return [];
  }

  const now = new Date();

  const sessionDataPoints = sessions
    .map((session) => {
      const sessionDate = session.date;
      if (!session || !sessionDate) return null;

      const date = new Date(sessionDate);
      if (date > now) return null;

      if (!Array.isArray(session.attempts) || session.attempts.length === 0) return null;

      let correct = 0;
      let total = 0;
      session.attempts.forEach((attempt) => {
        if (attempt && typeof attempt.success !== "undefined") {
          total += 1;
          if (attempt.success) correct += 1;
        }
      });

      if (total === 0) return null;

      return {
        name: format(date, "MMM dd, HH:mm"),
        accuracy: Math.round((correct / total) * 100),
        date: date.getTime(),
        sessionId: session.id || sessionDate
      };
    })
    .filter(Boolean);

  const result = sessionDataPoints.sort((a, b) => a.date - b.date);
  setCachedResult(cacheKey, result);
  return result;
}

// --- Individual Session Learning Efficiency ---
export function getIndividualSessionEfficiencyData(sessions) {
  const cacheKey = createCacheKey(sessions, 'individual', 'getIndividualSessionEfficiencyData');
  const cachedResult = getCachedResult(cacheKey);
  if (cachedResult) return cachedResult;

  if (!Array.isArray(sessions)) {
    console.warn("Invalid sessions array provided to getIndividualSessionEfficiencyData:", sessions);
    return [];
  }

  const now = new Date();

  const sessionDataPoints = sessions
    .map((session) => {
      const sessionDate = session.date;
      if (!session || !sessionDate) return null;

      const date = new Date(sessionDate);
      if (date > now) return null;

      if (!Array.isArray(session.attempts) || session.attempts.length === 0) return null;

      const successfulProblems = session.attempts.filter(
        attempt => attempt && attempt.success
      ).length;

      const hintsUsed = session.hintsUsed || 0;
      if (successfulProblems === 0) return null;

      const efficiency = hintsUsed / successfulProblems;

      return {
        name: format(date, "MMM dd, HH:mm"),
        efficiency: Math.round(efficiency * 100) / 100,
        date: date.getTime(),
        sessionId: session.id || sessionDate
      };
    })
    .filter(Boolean);

  const result = sessionDataPoints.sort((a, b) => a.date - b.date);
  setCachedResult(cacheKey, result);
  return result;
}

// --- Individual Session New vs Review Problems Breakdown ---
export function getNewVsReviewProblemsPerSession(sessions) {
  const cacheKey = createCacheKey(sessions, 'individual', 'getNewVsReviewProblemsPerSession');
  const cachedResult = getCachedResult(cacheKey);
  if (cachedResult) return cachedResult;

  if (!Array.isArray(sessions)) {
    console.warn("Invalid sessions array provided to getNewVsReviewProblemsPerSession:", sessions);
    return [];
  }

  const now = new Date();

  const sessionDataPoints = sessions
    .map((session) => {
      const sessionDate = session.date;
      if (!session || !sessionDate) return null;

      const date = new Date(sessionDate);
      if (date > now) return null;

      if (!Array.isArray(session.problems) || session.problems.length === 0) return null;

      let newProblems = 0;
      let reviewProblems = 0;

      session.problems.forEach(problem => {
        if (!problem) return;
        const selectionType = problem?.selectionReason?.type;
        if (selectionType === "review_problem") {
          reviewProblems++;
        } else if (selectionType === "new_problem") {
          newProblems++;
        }
      });

      return {
        name: format(date, "MMM dd, HH:mm"),
        newProblems,
        reviewProblems,
        date: date.getTime(),
        sessionId: session.id || sessionDate
      };
    })
    .filter(Boolean);

  const result = sessionDataPoints.sort((a, b) => a.date - b.date);
  setCachedResult(cacheKey, result);
  return result;
}

// --- Individual Session Activity Data ---
export function getIndividualSessionActivityData(sessions) {
  const cacheKey = createCacheKey(sessions, 'individual', 'getIndividualSessionActivityData');
  const cachedResult = getCachedResult(cacheKey);
  if (cachedResult) return cachedResult;

  if (!Array.isArray(sessions)) {
    console.warn("Invalid sessions array provided to getIndividualSessionActivityData:", sessions);
    return [];
  }

  const now = new Date();

  const sessionDataPoints = sessions
    .map((session) => {
      const sessionDate = session.date;
      if (!session || !sessionDate) return null;

      const date = new Date(sessionDate);
      if (date > now) return null;

      if (!Array.isArray(session.attempts) || session.attempts.length === 0) return null;

      let attempted = 0;
      let passed = 0;
      let failed = 0;

      session.attempts.forEach((attempt) => {
        if (!attempt) return;
        attempted += 1;
        if (attempt.success) {
          passed += 1;
        } else {
          failed += 1;
        }
      });

      return {
        name: format(date, "MMM dd, HH:mm"),
        attempted,
        passed,
        failed,
        date: date.getTime(),
        sessionId: session.id || sessionDate
      };
    })
    .filter(Boolean);

  const result = sessionDataPoints.sort((a, b) => a.date - b.date);
  setCachedResult(cacheKey, result);
  return result;
}
