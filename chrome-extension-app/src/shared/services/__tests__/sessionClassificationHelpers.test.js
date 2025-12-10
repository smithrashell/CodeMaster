/**
 * Unit tests for sessionClassificationHelpers.js
 * Tests pure functions extracted during Issue #214 refactor
 */

// Mock logger first to prevent initialization errors
jest.mock("../../utils/logging/logger.js", () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  };
  return {
    __esModule: true,
    default: mockLogger,
    ...mockLogger
  };
});

import {
  classifyInterviewSession,
  classifyTrackingSession,
  classifyGeneratorSession,
  classifySessionState,
  getRecommendedAction
} from "../session/sessionClassificationHelpers";

describe("sessionClassificationHelpers", () => {
  describe("classifyInterviewSession", () => {
    it("returns interview_active when stale < 3 hours", () => {
      expect(classifyInterviewSession(2, 0)).toBe("interview_active");
      expect(classifyInterviewSession(2.9, 5)).toBe("interview_active");
    });

    it("returns interview_stale when stale > 3 hours with attempts", () => {
      expect(classifyInterviewSession(4, 1)).toBe("interview_stale");
      expect(classifyInterviewSession(5, 3)).toBe("interview_stale");
    });

    it("returns interview_stale when stale > 3 but < 6 hours with no attempts", () => {
      expect(classifyInterviewSession(4, 0)).toBe("interview_stale");
      expect(classifyInterviewSession(5.9, 0)).toBe("interview_stale");
    });

    it("returns interview_abandoned when stale > 6 hours with no attempts", () => {
      expect(classifyInterviewSession(7, 0)).toBe("interview_abandoned");
      expect(classifyInterviewSession(24, 0)).toBe("interview_abandoned");
    });

    it("returns interview_stale when stale > 6 hours but has attempts", () => {
      expect(classifyInterviewSession(10, 1)).toBe("interview_stale");
    });
  });

  describe("classifyTrackingSession", () => {
    it("returns tracking_active when stale < 6 hours", () => {
      expect(classifyTrackingSession(0)).toBe("tracking_active");
      expect(classifyTrackingSession(5.9)).toBe("tracking_active");
    });

    it("returns tracking_stale when stale > 6 hours", () => {
      expect(classifyTrackingSession(7)).toBe("tracking_stale");
      expect(classifyTrackingSession(24)).toBe("tracking_stale");
    });

    it("handles edge case at exactly 6 hours", () => {
      expect(classifyTrackingSession(6)).toBe("tracking_active");
    });
  });

  describe("classifyGeneratorSession", () => {
    it("returns abandoned_at_start for no attempts and > 24 hours stale", () => {
      const session = {};
      const metrics = {
        hoursStale: 25,
        attemptCount: 0,
        progressRatio: 0,
        sessionProblemsAttempted: 0,
        outsideSessionAttempts: 0
      };

      expect(classifyGeneratorSession(session, metrics)).toBe("abandoned_at_start");
    });

    it("returns null for no attempts but < 24 hours stale", () => {
      const session = {};
      const metrics = {
        hoursStale: 20,
        attemptCount: 0,
        progressRatio: 0,
        sessionProblemsAttempted: 0,
        outsideSessionAttempts: 0
      };

      expect(classifyGeneratorSession(session, metrics)).toBeNull();
    });

    it("returns auto_complete_candidate for high progress and > 12 hours stale", () => {
      const session = {};
      const metrics = {
        hoursStale: 13,
        attemptCount: 4,
        progressRatio: 0.8,
        sessionProblemsAttempted: 4,
        outsideSessionAttempts: 0
      };

      expect(classifyGeneratorSession(session, metrics)).toBe("auto_complete_candidate");
    });

    it("returns null for high progress but < 12 hours stale", () => {
      const session = {};
      const metrics = {
        hoursStale: 10,
        attemptCount: 4,
        progressRatio: 0.8,
        sessionProblemsAttempted: 4,
        outsideSessionAttempts: 0
      };

      expect(classifyGeneratorSession(session, metrics)).toBeNull();
    });

    it("returns stalled_with_progress for some attempts and > 48 hours stale", () => {
      const session = {};
      const metrics = {
        hoursStale: 50,
        attemptCount: 2,
        progressRatio: 0.4,
        sessionProblemsAttempted: 2,
        outsideSessionAttempts: 0
      };

      expect(classifyGeneratorSession(session, metrics)).toBe("stalled_with_progress");
    });

    it("returns tracking_only_user for outside attempts only and > 12 hours stale", () => {
      const session = {};
      const metrics = {
        hoursStale: 13,
        attemptCount: 3,
        progressRatio: 0,
        sessionProblemsAttempted: 0,
        outsideSessionAttempts: 3
      };

      expect(classifyGeneratorSession(session, metrics)).toBe("tracking_only_user");
    });

    it("returns null for outside attempts but < 12 hours stale", () => {
      const session = {};
      const metrics = {
        hoursStale: 10,
        attemptCount: 3,
        progressRatio: 0,
        sessionProblemsAttempted: 0,
        outsideSessionAttempts: 3
      };

      expect(classifyGeneratorSession(session, metrics)).toBeNull();
    });

    it("returns null for active session with normal progress", () => {
      const session = {};
      const metrics = {
        hoursStale: 2,
        attemptCount: 2,
        progressRatio: 0.4,
        sessionProblemsAttempted: 2,
        outsideSessionAttempts: 0
      };

      expect(classifyGeneratorSession(session, metrics)).toBeNull();
    });

    it("prioritizes abandoned_at_start over other classifications", () => {
      const session = {};
      const metrics = {
        hoursStale: 100, // Would trigger multiple conditions
        attemptCount: 0,
        progressRatio: 0,
        sessionProblemsAttempted: 0,
        outsideSessionAttempts: 0
      };

      expect(classifyGeneratorSession(session, metrics)).toBe("abandoned_at_start");
    });
  });

  describe("classifySessionState", () => {
    const now = Date.now();

    it("returns active for completed sessions", () => {
      const session = {
        id: "test-session",
        status: "completed",
        date: new Date(now - 100 * 60 * 60 * 1000).toISOString() // 100 hours ago
      };

      expect(classifySessionState(session)).toBe("active");
    });

    it("returns active for recently active sessions", () => {
      const session = {
        id: "test-session",
        status: "in_progress",
        last_activity_time: new Date(now - 1 * 60 * 60 * 1000).toISOString() // 1 hour ago
      };

      expect(classifySessionState(session)).toBe("active");
    });

    it("uses shorter threshold for interview sessions", () => {
      // Interview sessions have 3-hour threshold instead of 6
      const interviewSession = {
        id: "test-session",
        session_type: "interview-like",
        status: "in_progress",
        last_activity_time: new Date(now - 4 * 60 * 60 * 1000).toISOString() // 4 hours ago
      };

      const result = classifySessionState(interviewSession);

      expect(result).not.toBe("active");
      expect(result).toContain("interview");
    });

    it("classifies interview-like sessions correctly", () => {
      const session = {
        id: "test-session",
        session_type: "interview-like",
        status: "in_progress",
        last_activity_time: new Date(now - 10 * 60 * 60 * 1000).toISOString(),
        attempts: []
      };

      expect(classifySessionState(session)).toBe("interview_abandoned");
    });

    it("classifies full-interview sessions correctly", () => {
      const session = {
        id: "test-session",
        session_type: "full-interview",
        status: "in_progress",
        last_activity_time: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
        attempts: [{}]
      };

      expect(classifySessionState(session)).toBe("interview_stale");
    });

    it("classifies tracking origin sessions", () => {
      const session = {
        id: "test-session",
        origin: "tracking",
        status: "in_progress",
        last_activity_time: new Date(now - 10 * 60 * 60 * 1000).toISOString()
      };

      expect(classifySessionState(session)).toBe("tracking_stale");
    });

    it("classifies generator origin sessions", () => {
      const session = {
        id: "test-session",
        origin: "generator",
        status: "in_progress",
        last_activity_time: new Date(now - 30 * 60 * 60 * 1000).toISOString(),
        attempts: [],
        problems: []
      };

      expect(classifySessionState(session)).toBe("abandoned_at_start");
    });

    it("returns unclear for unclassifiable sessions", () => {
      const session = {
        id: "test-session",
        origin: "unknown",
        status: "in_progress",
        last_activity_time: new Date(now - 10 * 60 * 60 * 1000).toISOString()
      };

      expect(classifySessionState(session)).toBe("unclear");
    });

    it("calculates progress ratio from attempts and problems", () => {
      const session = {
        id: "test-session",
        origin: "generator",
        status: "in_progress",
        last_activity_time: new Date(now - 15 * 60 * 60 * 1000).toISOString(),
        attempts: [
          { problemId: 1 },
          { problemId: 2 },
          { problemId: 3 },
          { problemId: 4 }
        ],
        problems: [
          { id: 1 },
          { id: 2 },
          { id: 3 },
          { id: 4 },
          { id: 5 }
        ]
      };

      // 4/5 = 0.8 progress ratio, should be auto_complete_candidate
      expect(classifySessionState(session)).toBe("auto_complete_candidate");
    });

    it("falls back to session.date when last_activity_time is missing", () => {
      const session = {
        id: "test-session",
        status: "in_progress",
        date: new Date(now - 1 * 60 * 60 * 1000).toISOString() // 1 hour ago
      };

      expect(classifySessionState(session)).toBe("active");
    });
  });

  describe("getRecommendedAction", () => {
    it("returns expire for draft_expired", () => {
      expect(getRecommendedAction("draft_expired")).toBe("expire");
    });

    it("returns expire for abandoned_at_start", () => {
      expect(getRecommendedAction("abandoned_at_start")).toBe("expire");
    });

    it("returns auto_complete for auto_complete_candidate", () => {
      expect(getRecommendedAction("auto_complete_candidate")).toBe("auto_complete");
    });

    it("returns flag_for_user_choice for stalled_with_progress", () => {
      expect(getRecommendedAction("stalled_with_progress")).toBe("flag_for_user_choice");
    });

    it("returns create_new_tracking for tracking_stale", () => {
      expect(getRecommendedAction("tracking_stale")).toBe("create_new_tracking");
    });

    it("returns refresh_guided_session for tracking_only_user", () => {
      expect(getRecommendedAction("tracking_only_user")).toBe("refresh_guided_session");
    });

    it("returns flag_for_user_choice for interview_stale", () => {
      expect(getRecommendedAction("interview_stale")).toBe("flag_for_user_choice");
    });

    it("returns expire for interview_abandoned", () => {
      expect(getRecommendedAction("interview_abandoned")).toBe("expire");
    });

    it("returns no_action for unknown classification", () => {
      expect(getRecommendedAction("unknown_classification")).toBe("no_action");
    });

    it("returns no_action for active classification", () => {
      expect(getRecommendedAction("active")).toBe("no_action");
    });

    it("returns no_action for unclear classification", () => {
      expect(getRecommendedAction("unclear")).toBe("no_action");
    });
  });
});
