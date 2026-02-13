/**
 * storageHandlers.real.test.js
 *
 * Comprehensive tests for all exported handler functions in storageHandlers.js.
 * All service/DB dependencies are mocked.
 */

// ---------------------------------------------------------------------------
// 1. Mocks (hoisted)
// ---------------------------------------------------------------------------
jest.mock('../../../shared/services/storage/storageService.js', () => ({
  StorageService: {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
    getSettings: jest.fn(),
    setSettings: jest.fn(),
    getSessionState: jest.fn(),
    getDaysSinceLastActivity: jest.fn(),
  },
}));

jest.mock('../../../shared/db/migrations/backupDB.js', () => ({
  backupIndexedDB: jest.fn(),
  getBackupFile: jest.fn(),
}));

jest.mock('../../../shared/services/schedule/recalibrationService.js', () => ({
  getWelcomeBackStrategy: jest.fn(),
  createDiagnosticSession: jest.fn(),
  processDiagnosticResults: jest.fn(),
  createAdaptiveRecalibrationSession: jest.fn(),
  processAdaptiveSessionCompletion: jest.fn(),
}));

jest.mock('../../../shared/services/attempts/adaptiveLimitsService.js', () => ({
  adaptiveLimitsService: {
    clearCache: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// 2. Imports
// ---------------------------------------------------------------------------
import { storageHandlers } from '../storageHandlers.js';

import { StorageService } from '../../../shared/services/storage/storageService.js';
import { backupIndexedDB, getBackupFile } from '../../../shared/db/migrations/backupDB.js';
import {
  getWelcomeBackStrategy,
  createDiagnosticSession,
  processDiagnosticResults,
  createAdaptiveRecalibrationSession,
  processAdaptiveSessionCompletion,
} from '../../../shared/services/schedule/recalibrationService.js';
import { adaptiveLimitsService } from '../../../shared/services/attempts/adaptiveLimitsService.js';

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
describe('storageHandlers', () => {
  afterEach(() => jest.clearAllMocks());

  // -----------------------------------------------------------------------
  // backupIndexedDB
  // -----------------------------------------------------------------------
  describe('backupIndexedDB', () => {
    it('sends success message on backup completion', async () => {
      backupIndexedDB.mockResolvedValue();

      const sendResponse = sr();
      const result = storageHandlers.backupIndexedDB({}, noDeps, sendResponse, fr());
      expect(result).toBe(true);
      await flush();

      expect(backupIndexedDB).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({ message: 'Backup successful' });
    });

    it('sends error on backup failure', async () => {
      backupIndexedDB.mockRejectedValue(new Error('backup fail'));

      const sendResponse = sr();
      storageHandlers.backupIndexedDB({}, noDeps, sendResponse, fr());
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ error: 'backup fail' });
    });
  });

  // -----------------------------------------------------------------------
  // getBackupFile
  // -----------------------------------------------------------------------
  describe('getBackupFile', () => {
    it('returns backup data on success', async () => {
      const backupData = { version: 1, data: {} };
      getBackupFile.mockResolvedValue(backupData);

      const sendResponse = sr();
      storageHandlers.getBackupFile({}, noDeps, sendResponse, fr());
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ backup: backupData });
    });

    it('returns error on failure', async () => {
      getBackupFile.mockRejectedValue(new Error('read fail'));

      const sendResponse = sr();
      storageHandlers.getBackupFile({}, noDeps, sendResponse, fr());
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ error: 'read fail' });
    });
  });

  // -----------------------------------------------------------------------
  // setStorage
  // -----------------------------------------------------------------------
  describe('setStorage', () => {
    it('sets a value in storage', async () => {
      StorageService.set.mockResolvedValue({ status: 'ok' });

      const sendResponse = sr();
      const finishRequest = fr();
      storageHandlers.setStorage(
        { key: 'myKey', value: 'myVal' }, noDeps, sendResponse, finishRequest
      );
      await flush();

      expect(StorageService.set).toHaveBeenCalledWith('myKey', 'myVal');
      expect(sendResponse).toHaveBeenCalledWith({ status: 'ok' });
      expect(finishRequest).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // getStorage
  // -----------------------------------------------------------------------
  describe('getStorage', () => {
    it('gets a value from storage', async () => {
      StorageService.get.mockResolvedValue('storedVal');

      const sendResponse = sr();
      const finishRequest = fr();
      storageHandlers.getStorage({ key: 'myKey' }, noDeps, sendResponse, finishRequest);
      await flush();

      expect(StorageService.get).toHaveBeenCalledWith('myKey');
      expect(sendResponse).toHaveBeenCalledWith('storedVal');
      expect(finishRequest).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // removeStorage
  // -----------------------------------------------------------------------
  describe('removeStorage', () => {
    it('removes a key from storage', async () => {
      StorageService.remove.mockResolvedValue(undefined);

      const sendResponse = sr();
      const finishRequest = fr();
      storageHandlers.removeStorage({ key: 'myKey' }, noDeps, sendResponse, finishRequest);
      await flush();

      expect(StorageService.remove).toHaveBeenCalledWith('myKey');
      expect(finishRequest).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // setSettings
  // -----------------------------------------------------------------------
  describe('setSettings', () => {
    it('saves settings and clears adaptive cache', async () => {
      StorageService.setSettings.mockResolvedValue({ status: 'ok' });

      const sendResponse = sr();
      const finishRequest = fr();
      storageHandlers.setSettings(
        { message: { theme: 'dark' } }, noDeps, sendResponse, finishRequest
      );
      await flush();

      expect(StorageService.setSettings).toHaveBeenCalledWith({ theme: 'dark' });
      expect(adaptiveLimitsService.clearCache).toHaveBeenCalled();
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        { settings: { theme: 'dark' } },
        expect.any(Function)
      );
      expect(sendResponse).toHaveBeenCalledWith({ status: 'ok' });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('updates currentInterviewMode when interviewMode is set', async () => {
      StorageService.setSettings.mockResolvedValue({ status: 'ok' });

      const sendResponse = sr();
      const finishRequest = fr();
      storageHandlers.setSettings(
        { message: { interviewMode: 'behavioral' } }, noDeps, sendResponse, finishRequest
      );
      await flush();

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        { currentInterviewMode: { sessionType: 'behavioral', interviewConfig: null } },
        expect.any(Function)
      );
    });

    it('sets sessionType to standard when interviewMode is disabled', async () => {
      StorageService.setSettings.mockResolvedValue({ status: 'ok' });

      const sendResponse = sr();
      const finishRequest = fr();
      storageHandlers.setSettings(
        { message: { interviewMode: 'disabled' } }, noDeps, sendResponse, finishRequest
      );
      await flush();

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        { currentInterviewMode: { sessionType: 'standard', interviewConfig: null } },
        expect.any(Function)
      );
    });

    it('sends error on failure', async () => {
      StorageService.setSettings.mockRejectedValue(new Error('save fail'));

      const sendResponse = sr();
      const finishRequest = fr();
      storageHandlers.setSettings(
        { message: {} }, noDeps, sendResponse, finishRequest
      );
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ status: 'error', message: 'save fail' });
      expect(finishRequest).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // getSettings
  // -----------------------------------------------------------------------
  describe('getSettings', () => {
    it('returns settings', async () => {
      const settings = { theme: 'dark' };
      StorageService.getSettings.mockResolvedValue(settings);

      const sendResponse = sr();
      const finishRequest = fr();
      storageHandlers.getSettings({}, noDeps, sendResponse, finishRequest);
      await flush();

      expect(sendResponse).toHaveBeenCalledWith(settings);
      expect(finishRequest).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // getSessionState
  // -----------------------------------------------------------------------
  describe('getSessionState', () => {
    it('returns session state', async () => {
      const state = { current_focus_tags: ['Array'] };
      StorageService.getSessionState.mockResolvedValue(state);

      const sendResponse = sr();
      const finishRequest = fr();
      storageHandlers.getSessionState({}, noDeps, sendResponse, finishRequest);
      await flush();

      expect(StorageService.getSessionState).toHaveBeenCalledWith('session_state');
      expect(sendResponse).toHaveBeenCalledWith(state);
      expect(finishRequest).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // getWelcomeBackStrategy
  // -----------------------------------------------------------------------
  describe('getWelcomeBackStrategy', () => {
    it('returns normal type if dismissed today', async () => {
      const today = new Date().toISOString().split('T')[0];
      StorageService.get.mockResolvedValue({ timestamp: today + 'T10:00:00Z' });

      const sendResponse = sr();
      const finishRequest = fr();
      storageHandlers.getWelcomeBackStrategy({}, noDeps, sendResponse, finishRequest);
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ type: 'normal' });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('returns strategy when not dismissed today', async () => {
      StorageService.get.mockResolvedValue(null);
      StorageService.getDaysSinceLastActivity.mockResolvedValue(5);
      getWelcomeBackStrategy.mockReturnValue({ type: 'gentle_refresh', message: 'Welcome!' });

      const sendResponse = sr();
      const finishRequest = fr();
      storageHandlers.getWelcomeBackStrategy({}, noDeps, sendResponse, finishRequest);
      await flush();

      expect(StorageService.getDaysSinceLastActivity).toHaveBeenCalled();
      expect(getWelcomeBackStrategy).toHaveBeenCalledWith(5);
      expect(sendResponse).toHaveBeenCalledWith({ type: 'gentle_refresh', message: 'Welcome!' });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('returns strategy when dismissed on a different day', async () => {
      StorageService.get.mockResolvedValue({ timestamp: '2020-01-01T10:00:00Z' });
      StorageService.getDaysSinceLastActivity.mockResolvedValue(3);
      getWelcomeBackStrategy.mockReturnValue({ type: 'recap' });

      const sendResponse = sr();
      const finishRequest = fr();
      storageHandlers.getWelcomeBackStrategy({}, noDeps, sendResponse, finishRequest);
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ type: 'recap' });
    });

    it('returns normal on error', async () => {
      StorageService.get.mockRejectedValue(new Error('fail'));

      const sendResponse = sr();
      const finishRequest = fr();
      storageHandlers.getWelcomeBackStrategy({}, noDeps, sendResponse, finishRequest);
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ type: 'normal' });
      expect(finishRequest).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // dismissWelcomeBack
  // -----------------------------------------------------------------------
  describe('dismissWelcomeBack', () => {
    it('saves dismissed state on success', async () => {
      StorageService.set.mockResolvedValue();

      const sendResponse = sr();
      const finishRequest = fr();
      storageHandlers.dismissWelcomeBack(
        { timestamp: '2024-01-15T10:00:00Z', daysSinceLastUse: 3 },
        noDeps, sendResponse, finishRequest
      );
      await flush();

      expect(StorageService.set).toHaveBeenCalledWith('welcome_back_dismissed', {
        timestamp: '2024-01-15T10:00:00Z',
        daysSinceLastUse: 3,
      });
      expect(sendResponse).toHaveBeenCalledWith({ status: 'success' });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('returns error on failure', async () => {
      StorageService.set.mockRejectedValue(new Error('set fail'));

      const sendResponse = sr();
      const finishRequest = fr();
      storageHandlers.dismissWelcomeBack(
        { timestamp: 'x', daysSinceLastUse: 1 },
        noDeps, sendResponse, finishRequest
      );
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ status: 'error', message: 'set fail' });
    });
  });

  // -----------------------------------------------------------------------
  // recordRecalibrationChoice
  // -----------------------------------------------------------------------
  describe('recordRecalibrationChoice', () => {
    it('saves recalibration choice', async () => {
      StorageService.set.mockResolvedValue();

      const sendResponse = sr();
      const finishRequest = fr();
      storageHandlers.recordRecalibrationChoice(
        { approach: 'diagnostic', daysSinceLastUse: 7 },
        noDeps, sendResponse, finishRequest
      );
      await flush();

      expect(StorageService.set).toHaveBeenCalledWith(
        'last_recalibration_choice',
        expect.objectContaining({ approach: 'diagnostic', daysSinceLastUse: 7 })
      );
      expect(sendResponse).toHaveBeenCalledWith({ status: 'success' });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('returns error on failure', async () => {
      StorageService.set.mockRejectedValue(new Error('set error'));

      const sendResponse = sr();
      const finishRequest = fr();
      storageHandlers.recordRecalibrationChoice(
        { approach: 'x', daysSinceLastUse: 0 },
        noDeps, sendResponse, finishRequest
      );
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ status: 'error', message: 'set error' });
    });
  });

  // -----------------------------------------------------------------------
  // createDiagnosticSession
  // -----------------------------------------------------------------------
  describe('createDiagnosticSession', () => {
    it('creates diagnostic session and stores pending data', async () => {
      const diagResult = {
        problems: [{ id: 1 }, { id: 2 }],
        metadata: { difficulty: 'mixed' },
      };
      createDiagnosticSession.mockResolvedValue(diagResult);
      StorageService.set.mockResolvedValue();

      const sendResponse = sr();
      const finishRequest = fr();
      storageHandlers.createDiagnosticSession(
        { problemCount: 3, daysSinceLastUse: 10 },
        noDeps, sendResponse, finishRequest
      );
      await flush();

      expect(createDiagnosticSession).toHaveBeenCalledWith({
        problemCount: 3,
        daysSinceLastUse: 10,
      });
      expect(StorageService.set).toHaveBeenCalledWith(
        'pending_diagnostic_session',
        expect.objectContaining({
          problems: diagResult.problems,
          metadata: diagResult.metadata,
        })
      );
      expect(sendResponse).toHaveBeenCalledWith({
        status: 'success',
        problemCount: 2,
        metadata: diagResult.metadata,
      });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('uses defaults when not provided', async () => {
      createDiagnosticSession.mockResolvedValue({ problems: [], metadata: {} });
      StorageService.set.mockResolvedValue();

      const sendResponse = sr();
      const finishRequest = fr();
      storageHandlers.createDiagnosticSession({}, noDeps, sendResponse, finishRequest);
      await flush();

      expect(createDiagnosticSession).toHaveBeenCalledWith({
        problemCount: 5,
        daysSinceLastUse: 0,
      });
    });

    it('returns error on failure', async () => {
      createDiagnosticSession.mockRejectedValue(new Error('diag fail'));

      const sendResponse = sr();
      const finishRequest = fr();
      storageHandlers.createDiagnosticSession({}, noDeps, sendResponse, finishRequest);
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ status: 'error', message: 'diag fail' });
    });
  });

  // -----------------------------------------------------------------------
  // processDiagnosticResults
  // -----------------------------------------------------------------------
  describe('processDiagnosticResults', () => {
    it('processes results and returns summary', async () => {
      const result = {
        recalibrated: true,
        summary: { accuracy: 80 },
      };
      processDiagnosticResults.mockResolvedValue(result);

      const sendResponse = sr();
      const finishRequest = fr();
      storageHandlers.processDiagnosticResults(
        { sessionId: 's1', attempts: [{ correct: true }] },
        noDeps, sendResponse, finishRequest
      );
      await flush();

      expect(processDiagnosticResults).toHaveBeenCalledWith({
        sessionId: 's1',
        attempts: [{ correct: true }],
      });
      expect(sendResponse).toHaveBeenCalledWith({
        status: 'success',
        recalibrated: true,
        summary: { accuracy: 80 },
      });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('returns error on failure', async () => {
      processDiagnosticResults.mockRejectedValue(new Error('process fail'));

      const sendResponse = sr();
      const finishRequest = fr();
      storageHandlers.processDiagnosticResults(
        { sessionId: 's1', attempts: [] },
        noDeps, sendResponse, finishRequest
      );
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ status: 'error', message: 'process fail' });
    });
  });

  // -----------------------------------------------------------------------
  // createAdaptiveRecalibrationSession
  // -----------------------------------------------------------------------
  describe('createAdaptiveRecalibrationSession', () => {
    it('creates adaptive session and returns result', async () => {
      const result = { status: 'success', message: 'Adaptive session enabled' };
      createAdaptiveRecalibrationSession.mockResolvedValue(result);

      const sendResponse = sr();
      const finishRequest = fr();
      storageHandlers.createAdaptiveRecalibrationSession(
        { daysSinceLastUse: 14 },
        noDeps, sendResponse, finishRequest
      );
      await flush();

      expect(createAdaptiveRecalibrationSession).toHaveBeenCalledWith({
        daysSinceLastUse: 14,
      });
      expect(sendResponse).toHaveBeenCalledWith(result);
      expect(finishRequest).toHaveBeenCalled();
    });

    it('defaults daysSinceLastUse to 0', async () => {
      createAdaptiveRecalibrationSession.mockResolvedValue({ status: 'ok' });

      const sendResponse = sr();
      const finishRequest = fr();
      storageHandlers.createAdaptiveRecalibrationSession({}, noDeps, sendResponse, finishRequest);
      await flush();

      expect(createAdaptiveRecalibrationSession).toHaveBeenCalledWith({ daysSinceLastUse: 0 });
    });

    it('returns error on failure', async () => {
      createAdaptiveRecalibrationSession.mockRejectedValue(new Error('adaptive fail'));

      const sendResponse = sr();
      const finishRequest = fr();
      storageHandlers.createAdaptiveRecalibrationSession({}, noDeps, sendResponse, finishRequest);
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ status: 'error', message: 'adaptive fail' });
    });
  });

  // -----------------------------------------------------------------------
  // processAdaptiveSessionCompletion
  // -----------------------------------------------------------------------
  describe('processAdaptiveSessionCompletion', () => {
    it('processes completion and returns result', async () => {
      const result = { action: 'maintain', message: 'Good performance' };
      processAdaptiveSessionCompletion.mockResolvedValue(result);

      const sendResponse = sr();
      const finishRequest = fr();
      storageHandlers.processAdaptiveSessionCompletion(
        { sessionId: 's1', accuracy: 0.85, totalProblems: 5 },
        noDeps, sendResponse, finishRequest
      );
      await flush();

      expect(processAdaptiveSessionCompletion).toHaveBeenCalledWith({
        sessionId: 's1',
        accuracy: 0.85,
        totalProblems: 5,
      });
      expect(sendResponse).toHaveBeenCalledWith(result);
      expect(finishRequest).toHaveBeenCalled();
    });

    it('returns error on failure', async () => {
      processAdaptiveSessionCompletion.mockRejectedValue(new Error('completion fail'));

      const sendResponse = sr();
      const finishRequest = fr();
      storageHandlers.processAdaptiveSessionCompletion(
        { sessionId: 's1', accuracy: 0.5, totalProblems: 3 },
        noDeps, sendResponse, finishRequest
      );
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ status: 'error', message: 'completion fail' });
    });
  });
});
