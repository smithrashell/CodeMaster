/**
 * Tests for ErrorRecoveryHelpers.js (80 lines, 0% coverage)
 * Recovery actions, step generation, and report utilities.
 */

import {
  recoveryActions,
  generateRecoverySteps,
  generateReportData,
  handleErrorReport,
} from '../ErrorRecoveryHelpers.js';

describe('ErrorRecoveryHelpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  // -------------------------------------------------------------------
  // recoveryActions
  // -------------------------------------------------------------------
  describe('recoveryActions', () => {
    describe('clearTemp', () => {
      it('removes temp keys from localStorage', () => {
        localStorage.setItem('codemaster_temp_data', 'value');
        localStorage.setItem('temp_session', 'value');
        localStorage.setItem('user_settings', 'keep');

        const setDiagnosticResults = jest.fn();
        recoveryActions.clearTemp(setDiagnosticResults);

        expect(localStorage.getItem('codemaster_temp_data')).toBeNull();
        expect(localStorage.getItem('temp_session')).toBeNull();
        expect(localStorage.getItem('user_settings')).toBe('keep');
        expect(setDiagnosticResults).toHaveBeenCalledWith(expect.any(Function));
      });
    });

    describe('resetTimer', () => {
      it('removes timer state from localStorage and sessionStorage', () => {
        localStorage.setItem('timer_state', '{"running":true}');
        sessionStorage.setItem('current_timer', '30');

        const setDiagnosticResults = jest.fn();
        recoveryActions.resetTimer(setDiagnosticResults);

        expect(localStorage.getItem('timer_state')).toBeNull();
        expect(sessionStorage.getItem('current_timer')).toBeNull();
        expect(setDiagnosticResults).toHaveBeenCalledWith(expect.any(Function));
      });
    });

    describe('refreshDashboard', () => {
      it('sends clearCache message to chrome runtime', () => {
        const setDiagnosticResults = jest.fn();
        recoveryActions.refreshDashboard(setDiagnosticResults);

        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
          { type: 'clearCache' },
          expect.any(Function)
        );
        expect(setDiagnosticResults).toHaveBeenCalledWith(expect.any(Function));
      });

      it('handles missing chrome.runtime gracefully', () => {
        const _savedRuntime = chrome.runtime;
        // Temporarily make chrome undefined
        const savedChrome = global.chrome;
        global.chrome = undefined;

        const setDiagnosticResults = jest.fn();
        recoveryActions.refreshDashboard(setDiagnosticResults);

        // Should set failed state due to error
        expect(setDiagnosticResults).toHaveBeenCalledWith(expect.any(Function));

        global.chrome = savedChrome;
      });
    });
  });

  // -------------------------------------------------------------------
  // generateRecoverySteps
  // -------------------------------------------------------------------
  describe('generateRecoverySteps', () => {
    it('returns base recovery steps for generic section', () => {
      const onRetry = jest.fn();
      const runDiagnosticRecovery = jest.fn();

      const steps = generateRecoverySteps('Generic', onRetry, runDiagnosticRecovery);
      expect(steps.length).toBe(3);
      expect(steps[0].title).toBe('Quick Retry');
      expect(steps[1].title).toBe('Clear Local Data');
      expect(steps[2].title).toBe('Full Page Reload');
    });

    it('includes timer-specific step for Timer section', () => {
      const steps = generateRecoverySteps('Timer', jest.fn(), jest.fn());
      expect(steps.length).toBe(4);
      expect(steps.some(s => s.title === 'Reset Timer State')).toBe(true);
    });

    it('includes dashboard-specific step for Dashboard section', () => {
      const steps = generateRecoverySteps('Dashboard', jest.fn(), jest.fn());
      expect(steps.length).toBe(4);
      expect(steps.some(s => s.title === 'Refresh Dashboard Data')).toBe(true);
    });

    it('recovery steps have correct structure', () => {
      const steps = generateRecoverySteps('Generic', jest.fn(), jest.fn());
      steps.forEach(step => {
        expect(step).toHaveProperty('title');
        expect(step).toHaveProperty('description');
        expect(step).toHaveProperty('action');
        expect(step).toHaveProperty('icon');
        expect(step).toHaveProperty('color');
        expect(typeof step.action).toBe('function');
      });
    });

    it('Quick Retry action calls onRetry', () => {
      const onRetry = jest.fn();
      const steps = generateRecoverySteps('Generic', onRetry, jest.fn());
      steps[0].action();
      expect(onRetry).toHaveBeenCalled();
    });

    it('Clear Local Data action calls runDiagnosticRecovery', () => {
      const runDiagnosticRecovery = jest.fn();
      const steps = generateRecoverySteps('Generic', jest.fn(), runDiagnosticRecovery);
      steps[1].action();
      expect(runDiagnosticRecovery).toHaveBeenCalledWith('clearTemp');
    });
  });

  // -------------------------------------------------------------------
  // generateReportData
  // -------------------------------------------------------------------
  describe('generateReportData', () => {
    it('creates a report data object', () => {
      const report = generateReportData({
        errorId: 'err-123',
        error: new Error('Something broke'),
        errorInfo: { componentStack: 'at MyComponent' },
        section: 'Dashboard',
        reportText: 'User description of the issue',
        diagnosticResults: { localStorage: 'working' },
      });

      expect(report.errorId).toBe('err-123');
      expect(report.error).toBe('Something broke');
      expect(report.stack).toBeDefined();
      expect(report.componentStack).toBe('at MyComponent');
      expect(report.section).toBe('Dashboard');
      expect(report.userDescription).toBe('User description of the issue');
      expect(report.diagnostics).toEqual({ localStorage: 'working' });
      expect(report.url).toBeDefined();
      expect(report.timestamp).toBeDefined();
    });

    it('handles null error and errorInfo', () => {
      const report = generateReportData({
        errorId: 'err-1',
        error: null,
        errorInfo: null,
        section: 'Timer',
        reportText: '',
        diagnosticResults: {},
      });

      expect(report.error).toBeUndefined();
      expect(report.stack).toBeUndefined();
      expect(report.componentStack).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------
  // handleErrorReport
  // -------------------------------------------------------------------
  describe('handleErrorReport', () => {
    it('calls onReportProblem with report data', () => {
      const onReportProblem = jest.fn();
      const onClose = jest.fn();
      const reportData = { errorId: 'err-1', section: 'Dashboard' };

      handleErrorReport(reportData, onReportProblem, onClose);

      expect(onReportProblem).toHaveBeenCalledWith(reportData);
      expect(onClose).toHaveBeenCalled();
    });

    it('stores report in localStorage', () => {
      const onClose = jest.fn();
      const reportData = { errorId: 'err-1' };

      handleErrorReport(reportData, null, onClose);

      const stored = JSON.parse(localStorage.getItem('codemaster_error_reports'));
      expect(stored).toHaveLength(1);
      expect(stored[0].errorId).toBe('err-1');
    });

    it('keeps only last 5 reports in localStorage', () => {
      const existing = Array.from({ length: 6 }, (_, i) => ({ errorId: `e${i}` }));
      localStorage.setItem('codemaster_error_reports', JSON.stringify(existing));

      handleErrorReport({ errorId: 'new' }, null, jest.fn());

      const stored = JSON.parse(localStorage.getItem('codemaster_error_reports'));
      expect(stored).toHaveLength(5);
      expect(stored[stored.length - 1].errorId).toBe('new');
    });

    it('calls onClose even if onReportProblem is null', () => {
      const onClose = jest.fn();
      handleErrorReport({ errorId: 'err-1' }, null, onClose);
      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose even if localStorage fails', () => {
      const origSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = jest.fn(() => { throw new Error('Quota exceeded'); });

      const onClose = jest.fn();
      handleErrorReport({ errorId: 'err-1' }, null, onClose);
      expect(onClose).toHaveBeenCalled();

      Storage.prototype.setItem = origSetItem;
    });
  });
});
