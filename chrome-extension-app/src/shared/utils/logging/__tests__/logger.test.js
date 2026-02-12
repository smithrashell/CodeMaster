/**
 * Unit tests for logger.js (ProductionLogger)
 * Tests log levels, level filtering, formatting, and helper exports.
 *
 * NOTE: test/setup.js globally mocks logger.js. This test unmocks it to
 * test the real implementation using jest.isolateModules.
 */

// Un-mock the logger so we can test the real implementation
jest.unmock('../../../utils/logging/logger.js');

// Mock ErrorReportService to prevent DB operations during logger tests
jest.mock('../../../services/monitoring/ErrorReportService.js', () => ({
  __esModule: true,
  ErrorReportService: {
    storeErrorReport: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('logger (ProductionLogger)', () => {
  let defaultLogger;
  let logInfo;
  let logError;
  let component;
  let data;
  let system;
  let fallback;
  let consoleDebugSpy;
  let consoleInfoSpy;
  let consoleWarnSpy;
  let consoleErrorSpy;
  let localStorageGetSpy;
  let localStorageSetSpy;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Load the real logger module isolated from global mock
    await jest.isolateModules(async () => {
      const module = await import('../logger.js');
      defaultLogger = module.default;
      logInfo = module.logInfo;
      logError = module.logError;
      component = module.component;
      data = module.data;
      system = module.system;
      fallback = module.fallback;
    });

    // Set up console spies AFTER loading the module
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    localStorageGetSpy = jest.spyOn(Storage.prototype, 'getItem').mockReturnValue('[]');
    localStorageSetSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleDebugSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    localStorageGetSpy.mockRestore();
    localStorageSetSpy.mockRestore();
  });

  // -----------------------------------------------------------------------
  // sessionId
  // -----------------------------------------------------------------------
  describe('sessionId', () => {
    it('has a non-empty sessionId starting with "session_"', () => {
      expect(defaultLogger.sessionId).toMatch(/^session_/);
    });

    it('sessionId is a string', () => {
      expect(typeof defaultLogger.sessionId).toBe('string');
    });
  });

  // -----------------------------------------------------------------------
  // Log level management
  // -----------------------------------------------------------------------
  describe('setLogLevel / getLogLevel', () => {
    it('returns a valid log level name from getLogLevel', () => {
      const level = defaultLogger.getLogLevel();
      expect(['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']).toContain(level);
    });

    it('setLogLevel(3) sets WARN level', () => {
      defaultLogger.setLogLevel(3);
      expect(defaultLogger.getLogLevel()).toBe('WARN');
    });
  });

  // -----------------------------------------------------------------------
  // Level routing
  // -----------------------------------------------------------------------
  describe('log level routing', () => {
    beforeEach(() => {
      // Set log level to TRACE BEFORE clearing mock counts, so the internal
      // info() call from setLogLevel doesn't interfere with test assertions.
      defaultLogger.setLogLevel(0); // TRACE - allow all
      // Reset call counts AFTER setLogLevel (which internally calls info)
      consoleDebugSpy.mockClear();
      consoleInfoSpy.mockClear();
      consoleWarnSpy.mockClear();
      consoleErrorSpy.mockClear();
    });

    it('error() calls console.error', () => {
      defaultLogger.error('error message');
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('fatal() calls console.error', () => {
      defaultLogger.fatal('fatal message');
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('warn() calls console.warn', () => {
      defaultLogger.warn('warn message');
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    });

    it('info() calls console.info', () => {
      defaultLogger.info('info message');
      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
    });

    it('debug() calls console.debug', () => {
      defaultLogger.debug('debug message');
      expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // Level filtering
  // -----------------------------------------------------------------------
  describe('level filtering', () => {
    it('suppresses messages below current log level', () => {
      defaultLogger.setLogLevel(5); // FATAL - suppress everything below
      defaultLogger.debug('suppressed');
      defaultLogger.info('suppressed');
      defaultLogger.warn('suppressed');
      defaultLogger.error('suppressed');
      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('allows messages at or above current log level', () => {
      defaultLogger.setLogLevel(4); // ERROR
      defaultLogger.error('should appear');
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // _storeCriticalLog stores to localStorage for ERROR/FATAL
  // -----------------------------------------------------------------------
  describe('_storeCriticalLog', () => {
    it('stores to localStorage when error is logged', () => {
      defaultLogger.setLogLevel(4); // ERROR level
      defaultLogger.error('critical error message');
      expect(localStorageSetSpy).toHaveBeenCalledWith(
        'codemaster_critical_logs',
        expect.any(String)
      );
    });
  });

  // -----------------------------------------------------------------------
  // Named exports (legacy + helpers) - just verify they are exported functions
  // -----------------------------------------------------------------------
  describe('named exports', () => {
    it('logInfo is a function', () => {
      expect(typeof logInfo).toBe('function');
    });

    it('logError is a function', () => {
      expect(typeof logError).toBe('function');
    });

    it('component is a function', () => {
      expect(typeof component).toBe('function');
    });

    it('data is a function', () => {
      expect(typeof data).toBe('function');
    });

    it('system is a function', () => {
      expect(typeof system).toBe('function');
    });

    it('fallback is a function', () => {
      expect(typeof fallback).toBe('function');
    });
  });
});
