/**
 * sessionHandlers.real.test.js
 *
 * Comprehensive tests for all exported handler functions in sessionHandlers.js.
 * All service/DB dependencies are mocked.
 */

// ---------------------------------------------------------------------------
// 1. Mocks (hoisted)
// ---------------------------------------------------------------------------
jest.mock('../../../shared/services/storage/storageService.js', () => ({
  StorageService: {
    getSettings: jest.fn(),
    setSettings: jest.fn(),
  },
}));

jest.mock('../../../shared/services/session/sessionService.js', () => ({
  SessionService: {
    getSession: jest.fn(),
    resumeSession: jest.fn(),
    getOrCreateSession: jest.fn(),
    refreshSession: jest.fn(),
    createInterviewSession: jest.fn(),
    checkAndCompleteInterviewSession: jest.fn(),
    skipProblem: jest.fn(),
  },
}));

jest.mock('../../../app/services/dashboard/dashboardService.js', () => ({
  getSessionMetrics: jest.fn(),
}));

jest.mock('../../../shared/services/session/sessionHabitLearning.js', () => ({
  HabitLearningHelpers: {
    getCurrentStreak: jest.fn(),
    getTypicalCadence: jest.fn(),
    getWeeklyProgress: jest.fn(),
    checkConsistencyAlerts: jest.fn(),
    getStreakRiskTiming: jest.fn(),
    getReEngagementTiming: jest.fn(),
  },
}));

jest.mock('../../../shared/services/session/sessionClassificationHelpers.js', () => ({
  classifySessionState: jest.fn(),
  detectStalledSessions: jest.fn(),
  getAllSessionsFromDB: jest.fn(),
}));

jest.mock('../../../shared/services/session/sessionTrackingHelpers.js', () => ({
  checkAndGenerateFromTracking: jest.fn(),
}));

jest.mock('../../../shared/services/session/sessionInterviewHelpers.js', () => ({
  shouldCreateInterviewSession: jest.fn(),
}));

// ---------------------------------------------------------------------------
// 2. Imports
// ---------------------------------------------------------------------------
import {
  handleGetSession,
  handleGetActiveSession,
  handleGetOrCreateSession,
  handleRefreshSession,
  handleGetCurrentSession,
  handleManualSessionCleanup,
  handleGetSessionAnalytics,
  handleClassifyAllSessions,
  handleGenerateSessionFromTracking,
  handleGetSessionMetrics,
  handleCheckInterviewFrequency,
  handleCompleteInterviewSession,
  handleGetSessionPatterns,
  handleCheckConsistencyAlerts,
  handleGetStreakRiskTiming,
  handleGetReEngagementTiming,
  sessionHandlers,
} from '../sessionHandlers.js';

import { StorageService } from '../../../shared/services/storage/storageService.js';
import { SessionService } from '../../../shared/services/session/sessionService.js';
import { getSessionMetrics } from '../../../app/services/dashboard/dashboardService.js';
import { HabitLearningHelpers } from '../../../shared/services/session/sessionHabitLearning.js';
import {
  classifySessionState,
  detectStalledSessions,
  getAllSessionsFromDB,
} from '../../../shared/services/session/sessionClassificationHelpers.js';
import { checkAndGenerateFromTracking } from '../../../shared/services/session/sessionTrackingHelpers.js';
import { shouldCreateInterviewSession } from '../../../shared/services/session/sessionInterviewHelpers.js';

// ---------------------------------------------------------------------------
// 3. Helpers
// ---------------------------------------------------------------------------
const sr = () => jest.fn();
const fr = () => jest.fn();
const flush = () => new Promise((r) => setTimeout(r, 0));
const noDeps = {};

// ---------------------------------------------------------------------------
// 4. Tests
// ---------------------------------------------------------------------------
describe('sessionHandlers', () => {
  afterEach(() => jest.clearAllMocks());

  // -----------------------------------------------------------------------
  // handleGetSession
  // -----------------------------------------------------------------------
  describe('handleGetSession', () => {
    it('returns session on success', async () => {
      const session = { id: 's1', status: 'in_progress' };
      SessionService.getSession.mockResolvedValue(session);

      const sendResponse = sr();
      const finishRequest = fr();
      const result = handleGetSession({}, noDeps, sendResponse, finishRequest);
      expect(result).toBe(true);
      await flush();

      expect(SessionService.getSession).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({ session });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('sends error on failure', async () => {
      SessionService.getSession.mockRejectedValue(new Error('fail'));

      const sendResponse = sr();
      const finishRequest = fr();
      handleGetSession({}, noDeps, sendResponse, finishRequest);
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ error: 'Failed to get session' });
      expect(finishRequest).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // handleGetActiveSession
  // -----------------------------------------------------------------------
  describe('handleGetActiveSession', () => {
    it('returns session on success', async () => {
      const session = { id: 's1' };
      SessionService.resumeSession.mockResolvedValue(session);

      const sendResponse = sr();
      const finishRequest = fr();
      const result = handleGetActiveSession({}, noDeps, sendResponse, finishRequest);
      expect(result).toBe(true);
      await flush();

      expect(SessionService.resumeSession).toHaveBeenCalledWith(null);
      expect(sendResponse).toHaveBeenCalledWith({ session });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('returns null session on failure', async () => {
      SessionService.resumeSession.mockRejectedValue(new Error('fail'));

      const sendResponse = sr();
      const finishRequest = fr();
      handleGetActiveSession({}, noDeps, sendResponse, finishRequest);
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ session: null });
      expect(finishRequest).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // handleGetOrCreateSession
  // -----------------------------------------------------------------------
  describe('handleGetOrCreateSession', () => {
    const makeDeps = () => ({
      withTimeout: jest.fn((promise) => promise),
    });

    it('returns session with staleness check', async () => {
      const session = {
        id: 'abcdefgh-1234',
        status: 'in_progress',
        sessionType: 'standard',
        created_at: '2024-01-01T00:00:00Z',
      };
      const deps = makeDeps();
      deps.withTimeout.mockImplementation((promise) => promise);
      SessionService.getOrCreateSession.mockResolvedValue(session);
      classifySessionState.mockReturnValue('active');
      StorageService.getSettings.mockResolvedValue({});

      const sendResponse = sr();
      const finishRequest = fr();
      await handleGetOrCreateSession(
        { sessionType: 'standard' }, deps, sendResponse, finishRequest
      );
      await flush();

      expect(SessionService.getOrCreateSession).toHaveBeenCalledWith('standard');
      expect(classifySessionState).toHaveBeenCalledWith(session);
      // When focusAreasLastChanged is not set, focusChangeStale is null
      // classificationStale=false || focusChangeStale=null => null
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          session,
          isSessionStale: null,
        })
      );
      expect(finishRequest).toHaveBeenCalled();
    });

    it('marks session as stale when classification is stale', async () => {
      const session = {
        id: 'abcdefgh-1234',
        status: 'in_progress',
        sessionType: 'standard',
        created_at: '2024-01-01T00:00:00Z',
      };
      const deps = makeDeps();
      deps.withTimeout.mockImplementation((promise) => promise);
      SessionService.getOrCreateSession.mockResolvedValue(session);
      classifySessionState.mockReturnValue('stale');
      StorageService.getSettings.mockResolvedValue({});

      const sendResponse = sr();
      await handleGetOrCreateSession(
        { sessionType: 'standard' }, deps, sendResponse, fr()
      );
      await flush();

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ isSessionStale: true })
      );
    });

    it('marks session as stale when focus areas changed after session creation', async () => {
      const session = {
        id: 'abcdefgh-1234',
        status: 'in_progress',
        sessionType: 'standard',
        created_at: '2024-01-01T00:00:00Z',
      };
      const deps = makeDeps();
      deps.withTimeout.mockImplementation((promise) => promise);
      SessionService.getOrCreateSession.mockResolvedValue(session);
      classifySessionState.mockReturnValue('active');
      StorageService.getSettings.mockResolvedValue({
        focusAreasLastChanged: '2024-06-01T00:00:00Z',
      });

      const sendResponse = sr();
      await handleGetOrCreateSession(
        { sessionType: 'standard' }, deps, sendResponse, fr()
      );
      await flush();

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ isSessionStale: true })
      );
    });

    it('handles null session from service', async () => {
      const deps = makeDeps();
      deps.withTimeout.mockImplementation((promise) => promise);
      SessionService.getOrCreateSession.mockResolvedValue(null);

      const sendResponse = sr();
      await handleGetOrCreateSession(
        { sessionType: 'standard' }, deps, sendResponse, fr()
      );
      await flush();

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ session: null, isSessionStale: false })
      );
    });

    it('sends error response on rejection', async () => {
      const deps = makeDeps();
      deps.withTimeout.mockImplementation(() => Promise.reject(new Error('timeout')));
      SessionService.getOrCreateSession.mockResolvedValue({});

      const sendResponse = sr();
      const finishRequest = fr();
      await handleGetOrCreateSession(
        { sessionType: 'standard' }, deps, sendResponse, finishRequest
      );
      await flush();

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          session: null,
          error: expect.stringContaining('timeout'),
          isEmergencyResponse: true,
        })
      );
      expect(finishRequest).toHaveBeenCalled();
    });

    it('uses session_type (snake_case) parameter', async () => {
      const deps = makeDeps();
      deps.withTimeout.mockImplementation((promise) => promise);
      SessionService.getOrCreateSession.mockResolvedValue(null);

      const sendResponse = sr();
      await handleGetOrCreateSession(
        { session_type: 'interview' }, deps, sendResponse, fr()
      );
      await flush();

      expect(SessionService.getOrCreateSession).toHaveBeenCalledWith('interview');
    });

    it('defaults sessionType to standard', async () => {
      const deps = makeDeps();
      deps.withTimeout.mockImplementation((promise) => promise);
      SessionService.getOrCreateSession.mockResolvedValue(null);
      // Need to make settings check pass without triggering interview banner
      StorageService.getSettings.mockResolvedValue({});

      const sendResponse = sr();
      await handleGetOrCreateSession({}, deps, sendResponse, fr());
      await flush();

      expect(SessionService.getOrCreateSession).toHaveBeenCalledWith('standard');
    });

    it('shows interview banner when manual mode and session completed', async () => {
      const deps = makeDeps();
      StorageService.getSettings.mockResolvedValue({
        interviewMode: 'behavioral',
        interviewFrequency: 'manual',
      });
      SessionService.resumeSession.mockResolvedValue(null); // no existing session

      const sendResponse = sr();
      const finishRequest = fr();
      await handleGetOrCreateSession({}, deps, sendResponse, finishRequest);

      expect(sendResponse).toHaveBeenCalledWith({ session: null });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('shows interview banner when session has no attempts', async () => {
      const deps = makeDeps();
      StorageService.getSettings.mockResolvedValue({
        interviewMode: 'behavioral',
        interviewFrequency: 'manual',
      });
      SessionService.resumeSession.mockResolvedValue({
        status: 'in_progress',
        attempts: [],
      });

      const sendResponse = sr();
      const finishRequest = fr();
      await handleGetOrCreateSession({}, deps, sendResponse, finishRequest);

      expect(sendResponse).toHaveBeenCalledWith({ session: null });
    });

    it('skips interview banner when session has attempts', async () => {
      const deps = makeDeps();
      deps.withTimeout.mockImplementation((promise) => promise);
      StorageService.getSettings.mockResolvedValue({
        interviewMode: 'behavioral',
        interviewFrequency: 'manual',
      });
      SessionService.resumeSession.mockResolvedValue({
        status: 'in_progress',
        attempts: [{ id: 'a1' }],
      });
      SessionService.getOrCreateSession.mockResolvedValue(null);

      const sendResponse = sr();
      await handleGetOrCreateSession({}, deps, sendResponse, fr());
      await flush();

      // Should have proceeded to getOrCreateSession
      expect(SessionService.getOrCreateSession).toHaveBeenCalledWith('standard');
    });

    it('skips interview banner when sessionType is explicitly provided', async () => {
      const deps = makeDeps();
      deps.withTimeout.mockImplementation((promise) => promise);
      SessionService.getOrCreateSession.mockResolvedValue(null);

      const sendResponse = sr();
      await handleGetOrCreateSession(
        { sessionType: 'standard' }, deps, sendResponse, fr()
      );
      await flush();

      // Should not have checked settings for banner logic
      expect(SessionService.resumeSession).not.toHaveBeenCalled();
      expect(SessionService.getOrCreateSession).toHaveBeenCalledWith('standard');
    });

    it('continues on settings check error', async () => {
      const deps = makeDeps();
      deps.withTimeout.mockImplementation((promise) => promise);
      StorageService.getSettings
        .mockRejectedValueOnce(new Error('settings fail'))
        .mockResolvedValue({});
      SessionService.getOrCreateSession.mockResolvedValue(null);

      const sendResponse = sr();
      await handleGetOrCreateSession({}, deps, sendResponse, fr());
      await flush();

      // Should have continued and called getOrCreateSession
      expect(SessionService.getOrCreateSession).toHaveBeenCalledWith('standard');
    });
  });

  // -----------------------------------------------------------------------
  // handleRefreshSession
  // -----------------------------------------------------------------------
  describe('handleRefreshSession', () => {
    const makeDeps = () => ({
      withTimeout: jest.fn((promise) => promise),
    });

    it('refreshes session and clears focus area flag', async () => {
      const session = { id: 's1', status: 'in_progress' };
      const deps = makeDeps();
      deps.withTimeout.mockImplementation((promise) => promise);
      SessionService.refreshSession.mockResolvedValue(session);
      StorageService.getSettings.mockResolvedValue({ focusAreasLastChanged: '2024-01-01' });
      StorageService.setSettings.mockResolvedValue();

      const sendResponse = sr();
      const finishRequest = fr();
      const result = handleRefreshSession(
        { sessionType: 'standard' }, deps, sendResponse, finishRequest
      );
      expect(result).toBe(true);
      await flush();

      expect(SessionService.refreshSession).toHaveBeenCalledWith('standard', true);
      expect(StorageService.setSettings).toHaveBeenCalledWith(
        expect.objectContaining({ focusAreasLastChanged: null })
      );
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          session,
          isSessionStale: false,
        })
      );
      expect(finishRequest).toHaveBeenCalled();
    });

    it('handles null session (no session found to regenerate)', async () => {
      const deps = makeDeps();
      deps.withTimeout.mockImplementation((promise) => promise);
      SessionService.refreshSession.mockResolvedValue(null);

      const sendResponse = sr();
      const finishRequest = fr();
      handleRefreshSession({ sessionType: 'standard' }, deps, sendResponse, finishRequest);
      await flush();

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          session: null,
          error: expect.stringContaining('No existing standard session found'),
        })
      );
    });

    it('uses session_type (snake_case) parameter', async () => {
      const deps = makeDeps();
      deps.withTimeout.mockImplementation((promise) => promise);
      SessionService.refreshSession.mockResolvedValue(null);

      const sendResponse = sr();
      handleRefreshSession({ session_type: 'interview' }, deps, sendResponse, fr());
      await flush();

      expect(SessionService.refreshSession).toHaveBeenCalledWith('interview', true);
    });

    it('defaults sessionType to standard', async () => {
      const deps = makeDeps();
      deps.withTimeout.mockImplementation((promise) => promise);
      SessionService.refreshSession.mockResolvedValue(null);

      const sendResponse = sr();
      handleRefreshSession({}, deps, sendResponse, fr());
      await flush();

      expect(SessionService.refreshSession).toHaveBeenCalledWith('standard', true);
    });

    it('sends error on rejection', async () => {
      const deps = makeDeps();
      deps.withTimeout.mockImplementation(() => Promise.reject(new Error('refresh fail')));
      SessionService.refreshSession.mockResolvedValue({});

      const sendResponse = sr();
      const finishRequest = fr();
      handleRefreshSession({ sessionType: 'standard' }, deps, sendResponse, finishRequest);
      await flush();

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          session: null,
          error: expect.stringContaining('refresh fail'),
        })
      );
      expect(finishRequest).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // handleGetCurrentSession (deprecated)
  // -----------------------------------------------------------------------
  describe('handleGetCurrentSession', () => {
    it('creates session based on interview mode settings', async () => {
      StorageService.getSettings.mockResolvedValue({
        interviewMode: 'behavioral',
        interviewFrequency: 'daily',
      });
      const session = { id: 's1' };
      SessionService.getOrCreateSession.mockResolvedValue(session);

      const sendResponse = sr();
      const finishRequest = fr();
      const result = handleGetCurrentSession({}, noDeps, sendResponse, finishRequest);
      expect(result).toBe(true);
      await flush();

      expect(SessionService.getOrCreateSession).toHaveBeenCalledWith('behavioral');
      expect(sendResponse).toHaveBeenCalledWith({ session });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('uses standard when interview mode is disabled', async () => {
      StorageService.getSettings.mockResolvedValue({
        interviewMode: 'disabled',
      });
      SessionService.getOrCreateSession.mockResolvedValue({ id: 's1' });

      const sendResponse = sr();
      handleGetCurrentSession({}, noDeps, sendResponse, fr());
      await flush();

      expect(SessionService.getOrCreateSession).toHaveBeenCalledWith('standard');
    });

    it('uses standard when no interview mode setting', async () => {
      StorageService.getSettings.mockResolvedValue({});
      SessionService.getOrCreateSession.mockResolvedValue({ id: 's1' });

      const sendResponse = sr();
      handleGetCurrentSession({}, noDeps, sendResponse, fr());
      await flush();

      expect(SessionService.getOrCreateSession).toHaveBeenCalledWith('standard');
    });

    it('sends error on failure', async () => {
      StorageService.getSettings.mockRejectedValue(new Error('settings fail'));

      const sendResponse = sr();
      const finishRequest = fr();
      handleGetCurrentSession({}, noDeps, sendResponse, finishRequest);
      await flush();

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Failed to get current session' })
      );
      expect(finishRequest).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // handleManualSessionCleanup
  // -----------------------------------------------------------------------
  describe('handleManualSessionCleanup', () => {
    it('runs cleanup and returns result', async () => {
      const cleanupResult = { cleaned: 3 };
      const deps = { cleanupStalledSessions: jest.fn().mockResolvedValue(cleanupResult) };

      const sendResponse = sr();
      const finishRequest = fr();
      handleManualSessionCleanup({}, deps, sendResponse, finishRequest);
      await flush();

      expect(deps.cleanupStalledSessions).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({ result: cleanupResult });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('sends error on failure', async () => {
      const deps = { cleanupStalledSessions: jest.fn().mockRejectedValue(new Error('clean fail')) };

      const sendResponse = sr();
      handleManualSessionCleanup({}, deps, sendResponse, fr());
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ error: 'clean fail' });
    });
  });

  // -----------------------------------------------------------------------
  // handleGetSessionAnalytics
  // -----------------------------------------------------------------------
  describe('handleGetSessionAnalytics', () => {
    it('returns analytics with stalled sessions', async () => {
      detectStalledSessions.mockResolvedValue([
        { classification: 'abandoned' },
        { classification: 'abandoned' },
        { classification: 'stuck' },
      ]);
      chrome.storage.local.get.mockImplementation((keys, cb) => {
        cb({ sessionCleanupAnalytics: [{ id: 1 }, { id: 2 }] });
      });

      const sendResponse = sr();
      const finishRequest = fr();
      const result = handleGetSessionAnalytics({}, noDeps, sendResponse, finishRequest);
      expect(result).toBe(true);
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({
        stalledSessions: 3,
        stalledByType: { abandoned: 2, stuck: 1 },
        recentCleanups: [{ id: 1 }, { id: 2 }],
      });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('returns empty cleanup analytics when not set', async () => {
      detectStalledSessions.mockResolvedValue([]);
      chrome.storage.local.get.mockImplementation((keys, cb) => {
        cb({});
      });

      const sendResponse = sr();
      handleGetSessionAnalytics({}, noDeps, sendResponse, fr());
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({
        stalledSessions: 0,
        stalledByType: {},
        recentCleanups: [],
      });
    });

    it('sends error on failure', async () => {
      detectStalledSessions.mockRejectedValue(new Error('detect fail'));

      const sendResponse = sr();
      handleGetSessionAnalytics({}, noDeps, sendResponse, fr());
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ error: 'detect fail' });
    });
  });

  // -----------------------------------------------------------------------
  // handleClassifyAllSessions
  // -----------------------------------------------------------------------
  describe('handleClassifyAllSessions', () => {
    it('classifies all sessions', async () => {
      getAllSessionsFromDB.mockResolvedValue([
        { id: 'abcdefgh-1234', origin: 'auto', status: 'in_progress', lastActivityTime: '2024-01-01', date: '2024-01-01' },
        { id: 'ijklmnop-5678', origin: 'manual', status: 'completed', date: '2024-01-02' },
      ]);
      classifySessionState
        .mockReturnValueOnce('active')
        .mockReturnValueOnce('completed');

      const sendResponse = sr();
      const finishRequest = fr();
      handleClassifyAllSessions({}, noDeps, sendResponse, finishRequest);
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({
        classifications: [
          {
            id: 'abcdefgh',
            origin: 'auto',
            status: 'in_progress',
            classification: 'active',
            lastActivity: '2024-01-01',
          },
          {
            id: 'ijklmnop',
            origin: 'manual',
            status: 'completed',
            classification: 'completed',
            lastActivity: '2024-01-02',
          },
        ],
      });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('sends error on failure', async () => {
      getAllSessionsFromDB.mockRejectedValue(new Error('db fail'));

      const sendResponse = sr();
      handleClassifyAllSessions({}, noDeps, sendResponse, fr());
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ error: 'db fail' });
    });
  });

  // -----------------------------------------------------------------------
  // handleGenerateSessionFromTracking
  // -----------------------------------------------------------------------
  describe('handleGenerateSessionFromTracking', () => {
    it('generates session from tracking', async () => {
      const session = { id: 's1' };
      checkAndGenerateFromTracking.mockResolvedValue(session);

      const sendResponse = sr();
      const finishRequest = fr();
      handleGenerateSessionFromTracking({}, noDeps, sendResponse, finishRequest);
      await flush();

      expect(checkAndGenerateFromTracking).toHaveBeenCalledWith(expect.any(Function));
      expect(sendResponse).toHaveBeenCalledWith({ session });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('returns null session when nothing generated', async () => {
      checkAndGenerateFromTracking.mockResolvedValue(null);

      const sendResponse = sr();
      handleGenerateSessionFromTracking({}, noDeps, sendResponse, fr());
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ session: null });
    });

    it('sends error on failure', async () => {
      checkAndGenerateFromTracking.mockRejectedValue(new Error('tracking fail'));

      const sendResponse = sr();
      handleGenerateSessionFromTracking({}, noDeps, sendResponse, fr());
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ error: 'tracking fail' });
    });
  });

  // -----------------------------------------------------------------------
  // handleGetSessionMetrics
  // -----------------------------------------------------------------------
  describe('handleGetSessionMetrics', () => {
    it('returns session metrics with options', async () => {
      const metrics = { total: 10 };
      getSessionMetrics.mockResolvedValue(metrics);

      const sendResponse = sr();
      const finishRequest = fr();
      handleGetSessionMetrics(
        { options: { period: 'week' } }, noDeps, sendResponse, finishRequest
      );
      await flush();

      expect(getSessionMetrics).toHaveBeenCalledWith({ period: 'week' });
      expect(sendResponse).toHaveBeenCalledWith({ result: metrics });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('uses empty options when none provided', async () => {
      getSessionMetrics.mockResolvedValue({});

      const sendResponse = sr();
      handleGetSessionMetrics({}, noDeps, sendResponse, fr());
      await flush();

      expect(getSessionMetrics).toHaveBeenCalledWith({});
    });

    it('sends error on failure', async () => {
      getSessionMetrics.mockRejectedValue(new Error('metrics fail'));

      const sendResponse = sr();
      handleGetSessionMetrics({}, noDeps, sendResponse, fr());
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ error: 'metrics fail' });
    });
  });

  // -----------------------------------------------------------------------
  // handleCheckInterviewFrequency
  // -----------------------------------------------------------------------
  describe('handleCheckInterviewFrequency', () => {
    it('creates interview session when frequency check passes', async () => {
      StorageService.getSettings.mockResolvedValue({
        interviewFrequency: 'daily',
        interviewMode: 'behavioral',
      });
      shouldCreateInterviewSession.mockResolvedValue(true);
      const session = { id: 's1', sessionType: 'behavioral' };
      SessionService.createInterviewSession.mockResolvedValue(session);

      const sendResponse = sr();
      const finishRequest = fr();
      handleCheckInterviewFrequency({}, noDeps, sendResponse, finishRequest);
      await flush();

      expect(shouldCreateInterviewSession).toHaveBeenCalledWith('daily', 'behavioral');
      expect(SessionService.createInterviewSession).toHaveBeenCalledWith('behavioral');
      expect(sendResponse).toHaveBeenCalledWith({
        session,
        backgroundScriptData: 'Frequency-based interview session created',
      });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('returns null session when frequency check fails', async () => {
      StorageService.getSettings.mockResolvedValue({
        interviewFrequency: 'weekly',
        interviewMode: 'technical',
      });
      shouldCreateInterviewSession.mockResolvedValue(false);

      const sendResponse = sr();
      handleCheckInterviewFrequency({}, noDeps, sendResponse, fr());
      await flush();

      expect(SessionService.createInterviewSession).not.toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({
        session: null,
        backgroundScriptData: 'No interview session needed',
      });
    });

    it('returns null when interview mode is disabled', async () => {
      StorageService.getSettings.mockResolvedValue({
        interviewFrequency: 'daily',
        interviewMode: 'disabled',
      });
      shouldCreateInterviewSession.mockResolvedValue(true);

      const sendResponse = sr();
      handleCheckInterviewFrequency({}, noDeps, sendResponse, fr());
      await flush();

      expect(SessionService.createInterviewSession).not.toHaveBeenCalled();
    });

    it('sends error on failure', async () => {
      StorageService.getSettings.mockRejectedValue(new Error('settings fail'));

      const sendResponse = sr();
      handleCheckInterviewFrequency({}, noDeps, sendResponse, fr());
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({
        error: 'Failed to check interview frequency',
        session: null,
      });
    });
  });

  // -----------------------------------------------------------------------
  // handleCompleteInterviewSession
  // -----------------------------------------------------------------------
  describe('handleCompleteInterviewSession', () => {
    it('returns completed=true when result is true', async () => {
      SessionService.checkAndCompleteInterviewSession.mockResolvedValue(true);

      const sendResponse = sr();
      const finishRequest = fr();
      handleCompleteInterviewSession(
        { sessionId: 's1' }, noDeps, sendResponse, finishRequest
      );
      await flush();

      expect(SessionService.checkAndCompleteInterviewSession).toHaveBeenCalledWith('s1');
      expect(sendResponse).toHaveBeenCalledWith({
        completed: true,
        unattemptedProblems: [],
        backgroundScriptData: 'Interview session completion handled',
      });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('returns unattempted problems when result is array', async () => {
      const unattempted = [{ id: 1 }, { id: 2 }];
      SessionService.checkAndCompleteInterviewSession.mockResolvedValue(unattempted);

      const sendResponse = sr();
      handleCompleteInterviewSession(
        { sessionId: 's1' }, noDeps, sendResponse, fr()
      );
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({
        completed: false,
        unattemptedProblems: unattempted,
        backgroundScriptData: 'Interview session completion handled',
      });
    });

    it('sends error on failure', async () => {
      SessionService.checkAndCompleteInterviewSession.mockRejectedValue(
        new Error('complete fail')
      );

      const sendResponse = sr();
      handleCompleteInterviewSession({ sessionId: 's1' }, noDeps, sendResponse, fr());
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({
        error: 'Failed to complete interview session',
        completed: false,
      });
    });
  });

  // -----------------------------------------------------------------------
  // handleGetSessionPatterns
  // -----------------------------------------------------------------------
  describe('handleGetSessionPatterns', () => {
    it('returns session patterns with all three metrics', async () => {
      HabitLearningHelpers.getCurrentStreak.mockResolvedValue(5);
      HabitLearningHelpers.getTypicalCadence.mockResolvedValue({ frequency: 'daily' });
      HabitLearningHelpers.getWeeklyProgress.mockResolvedValue({ completed: 3, goal: 5 });

      const sendResponse = sr();
      const finishRequest = fr();
      handleGetSessionPatterns({}, noDeps, sendResponse, finishRequest);
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({
        result: expect.objectContaining({
          currentStreak: 5,
          cadence: { frequency: 'daily' },
          weeklyProgress: { completed: 3, goal: 5 },
          lastUpdated: expect.any(String),
        }),
      });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('sends error on failure', async () => {
      HabitLearningHelpers.getCurrentStreak.mockRejectedValue(new Error('streak fail'));

      const sendResponse = sr();
      handleGetSessionPatterns({}, noDeps, sendResponse, fr());
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ error: 'streak fail' });
    });
  });

  // -----------------------------------------------------------------------
  // handleCheckConsistencyAlerts
  // -----------------------------------------------------------------------
  describe('handleCheckConsistencyAlerts', () => {
    it('returns consistency check results', async () => {
      StorageService.getSettings.mockResolvedValue({
        reminder: { enabled: true, time: '09:00' },
      });
      const checkResult = { hasAlerts: true, alerts: [{ type: 'streak_warning' }] };
      HabitLearningHelpers.checkConsistencyAlerts.mockResolvedValue(checkResult);

      const sendResponse = sr();
      const finishRequest = fr();
      handleCheckConsistencyAlerts({}, noDeps, sendResponse, finishRequest);
      await flush();

      expect(HabitLearningHelpers.checkConsistencyAlerts).toHaveBeenCalledWith({
        enabled: true,
        time: '09:00',
      });
      expect(sendResponse).toHaveBeenCalledWith({ result: checkResult });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('uses disabled reminder when settings has no reminder', async () => {
      StorageService.getSettings.mockResolvedValue({});
      HabitLearningHelpers.checkConsistencyAlerts.mockResolvedValue({ hasAlerts: false });

      const sendResponse = sr();
      handleCheckConsistencyAlerts({}, noDeps, sendResponse, fr());
      await flush();

      expect(HabitLearningHelpers.checkConsistencyAlerts).toHaveBeenCalledWith({
        enabled: false,
      });
    });

    it('returns fallback on error', async () => {
      StorageService.getSettings.mockRejectedValue(new Error('settings fail'));

      const sendResponse = sr();
      handleCheckConsistencyAlerts({}, noDeps, sendResponse, fr());
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({
        result: {
          hasAlerts: false,
          reason: 'check_failed',
          alerts: [],
          error: 'settings fail',
        },
      });
    });
  });

  // -----------------------------------------------------------------------
  // handleGetStreakRiskTiming
  // -----------------------------------------------------------------------
  describe('handleGetStreakRiskTiming', () => {
    it('returns streak risk timing', async () => {
      const timing = { riskLevel: 'high', hoursRemaining: 2 };
      HabitLearningHelpers.getStreakRiskTiming.mockResolvedValue(timing);

      const sendResponse = sr();
      const finishRequest = fr();
      handleGetStreakRiskTiming({}, noDeps, sendResponse, finishRequest);
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ result: timing });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('sends error on failure', async () => {
      HabitLearningHelpers.getStreakRiskTiming.mockRejectedValue(new Error('timing fail'));

      const sendResponse = sr();
      handleGetStreakRiskTiming({}, noDeps, sendResponse, fr());
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ error: 'timing fail' });
    });
  });

  // -----------------------------------------------------------------------
  // handleGetReEngagementTiming
  // -----------------------------------------------------------------------
  describe('handleGetReEngagementTiming', () => {
    it('returns re-engagement timing', async () => {
      const timing = { daysSinceLastSession: 5, suggestedAction: 'gentle_nudge' };
      HabitLearningHelpers.getReEngagementTiming.mockResolvedValue(timing);

      const sendResponse = sr();
      const finishRequest = fr();
      handleGetReEngagementTiming({}, noDeps, sendResponse, finishRequest);
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ result: timing });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('sends error on failure', async () => {
      HabitLearningHelpers.getReEngagementTiming.mockRejectedValue(new Error('re-engage fail'));

      const sendResponse = sr();
      handleGetReEngagementTiming({}, noDeps, sendResponse, fr());
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ error: 're-engage fail' });
    });
  });

  // -----------------------------------------------------------------------
  // sessionHandlers registry
  // -----------------------------------------------------------------------
  describe('sessionHandlers registry', () => {
    it('maps all handler names to functions', () => {
      const expected = [
        'getSession',
        'getActiveSession',
        'getOrCreateSession',
        'refreshSession',
        'getCurrentSession',
        'manualSessionCleanup',
        'getSessionAnalytics',
        'classifyAllSessions',
        'generateSessionFromTracking',
        'getSessionMetrics',
        'checkInterviewFrequency',
        'completeInterviewSession',
        'getSessionPatterns',
        'checkConsistencyAlerts',
        'getStreakRiskTiming',
        'getReEngagementTiming',
      ];

      expect(Object.keys(sessionHandlers)).toEqual(expected);
      Object.values(sessionHandlers).forEach((fn) => {
        expect(typeof fn).toBe('function');
      });
    });
  });
});
