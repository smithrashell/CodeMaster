/**
 * Tests for IndexedDBRetryService
 *
 * Tests the retry logic, circuit breaker, request deduplication,
 * AbortController cancellation, calculateRetryDelay, and statistics.
 */

// Mock logger first, before all other imports
jest.mock('../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock ErrorReportService before importing the class
jest.mock('../monitoring/ErrorReportService.js', () => ({
  __esModule: true,
  default: { reportError: jest.fn() },
}));

import { IndexedDBRetryService } from '../storage/indexedDBRetryService.js';
import ErrorReportService from '../monitoring/ErrorReportService.js';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

// Ensure navigator.onLine is defined in jsdom
Object.defineProperty(global.navigator, 'onLine', {
  value: true,
  writable: true,
  configurable: true,
});

// Create a fresh service instance for each test
let service;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  service = new IndexedDBRetryService();
  // Ensure the service starts online
  service.isOnline = true;
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// executeWithRetry — success cases
// ---------------------------------------------------------------------------

describe('executeWithRetry — success cases', () => {
  it('resolves with the operation result on first try', async () => {
    const operation = jest.fn().mockResolvedValue('result-value');

    const promise = service.executeWithRetry(operation, { operationName: 'test' });
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('result-value');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('succeeds on second attempt after one failure', async () => {
    const operation = jest.fn()
      .mockRejectedValueOnce(new Error('transient failure'))
      .mockResolvedValueOnce('second-try-success');

    const promise = service.executeWithRetry(operation, {
      operationName: 'flaky-op',
      retries: 2,
    });
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('second-try-success');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('succeeds on third attempt after two failures', async () => {
    const operation = jest.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValueOnce('third-try-success');

    const promise = service.executeWithRetry(operation, {
      operationName: 'multi-retry-op',
      retries: 3,
    });
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('third-try-success');
    expect(operation).toHaveBeenCalledTimes(3);
  });
});

// ---------------------------------------------------------------------------
// executeWithRetry — failure cases
// ---------------------------------------------------------------------------

describe('executeWithRetry — failure cases', () => {
  it('throws after all retries are exhausted', async () => {
    const error = new Error('persistent failure');
    const operation = jest.fn().mockRejectedValue(error);

    const promise = service.executeWithRetry(operation, {
      operationName: 'always-fail',
      retries: 2,
    });
    // Attach rejection handler before running timers to prevent unhandled rejection
    const rejectAssertion = expect(promise).rejects.toThrow('persistent failure');
    await jest.runAllTimersAsync();
    await rejectAssertion;
    expect(operation).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('calls ErrorReportService.reportError after all retries fail', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('db error'));

    const promise = service.executeWithRetry(operation, {
      operationName: 'failing-op',
      retries: 1,
    });
    // Attach catch handler before running timers to prevent unhandled rejection
    const caught = promise.catch(() => {});
    await jest.runAllTimersAsync();
    await caught;

    expect(ErrorReportService.reportError).toHaveBeenCalledTimes(1);
    expect(ErrorReportService.reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ operation: 'failing-op' })
    );
  });

  it('throws immediately when circuit breaker is open', () => {
    service.circuitBreaker.isOpen = true;
    service.circuitBreaker.lastFailureTime = Date.now();

    expect(() =>
      service.executeWithRetry(jest.fn(), { operationName: 'blocked-op' })
    ).toThrow('Circuit breaker is open');
  });

  it('throws immediately when network is offline', () => {
    service.isOnline = false;

    expect(() =>
      service.executeWithRetry(jest.fn(), { operationName: 'offline-op' })
    ).toThrow('Network is offline');
  });
});

// ---------------------------------------------------------------------------
// Non-retryable errors — stops retrying immediately
// ---------------------------------------------------------------------------

describe('executeWithRetry — non-retryable errors', () => {
  it('stops retrying on quota exceeded error', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('QuotaExceededException: quota exceeded'));

    const promise = service.executeWithRetry(operation, {
      operationName: 'quota-op',
      retries: 3,
    });
    // Attach catch handler before running timers to prevent unhandled rejection
    const caught = promise.catch(() => {});
    await jest.runAllTimersAsync();
    await caught;

    // Should stop after first failure (non-retryable)
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('stops retrying on constraint failed error', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('ConstraintError: constraint failed'));

    const promise = service.executeWithRetry(operation, {
      operationName: 'constraint-op',
      retries: 3,
    });
    // Attach catch handler before running timers to prevent unhandled rejection
    const caught = promise.catch(() => {});
    await jest.runAllTimersAsync();
    await caught;

    expect(operation).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Circuit breaker
// ---------------------------------------------------------------------------

describe('circuit breaker', () => {
  it('opens after failureThreshold failures', () => {
    const threshold = service.circuitBreaker.failureThreshold;

    for (let i = 0; i < threshold; i++) {
      service.recordFailure();
    }

    expect(service.isCircuitBreakerOpen()).toBe(true);
  });

  it('does not open before failureThreshold is reached', () => {
    const threshold = service.circuitBreaker.failureThreshold;

    for (let i = 0; i < threshold - 1; i++) {
      service.recordFailure();
    }

    expect(service.isCircuitBreakerOpen()).toBe(false);
  });

  it('resets to closed state on successful operation', () => {
    // Manually open the circuit breaker
    service.circuitBreaker.isOpen = true;
    service.circuitBreaker.failures = 5;

    service.recordSuccess();

    expect(service.isCircuitBreakerOpen()).toBe(false);
    expect(service.circuitBreaker.failures).toBe(0);
  });

  it('resets half-open attempts on success', () => {
    service.circuitBreaker.halfOpenAttempts = 2;
    service.circuitBreaker.isOpen = true;

    service.recordSuccess();

    expect(service.circuitBreaker.halfOpenAttempts).toBe(0);
  });

  it('resets lastFailureTime on resetCircuitBreaker', () => {
    service.circuitBreaker.lastFailureTime = Date.now();

    service.resetCircuitBreaker();

    expect(service.circuitBreaker.lastFailureTime).toBeNull();
  });

  it('automatically enters half-open state after resetTimeout', () => {
    const threshold = service.circuitBreaker.failureThreshold;
    for (let i = 0; i < threshold; i++) {
      service.recordFailure();
    }
    expect(service.isCircuitBreakerOpen()).toBe(true);

    // Advance time past the reset timeout
    jest.advanceTimersByTime(service.circuitBreaker.resetTimeout + 1);

    expect(service.isCircuitBreakerOpen()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// calculateRetryDelay
// ---------------------------------------------------------------------------

describe('calculateRetryDelay', () => {
  it('returns approximately 100ms for attempt 0 (normal priority)', () => {
    // baseRetryDelay * 2^0 * 1.0 * (1 + jitter) where jitter is 0-0.3
    // Expected range: 100 to 130
    const delay = service.calculateRetryDelay(0, 'normal');
    expect(delay).toBeGreaterThanOrEqual(100);
    expect(delay).toBeLessThanOrEqual(130);
  });

  it('returns approximately 200ms for attempt 1 (normal priority)', () => {
    // 100 * 2^1 = 200, with jitter: 200 to 260
    const delay = service.calculateRetryDelay(1, 'normal');
    expect(delay).toBeGreaterThanOrEqual(200);
    expect(delay).toBeLessThanOrEqual(260);
  });

  it('returns approximately 400ms for attempt 2 (normal priority)', () => {
    // 100 * 2^2 = 400, with jitter: 400 to 520
    const delay = service.calculateRetryDelay(2, 'normal');
    expect(delay).toBeGreaterThanOrEqual(400);
    expect(delay).toBeLessThanOrEqual(520);
  });

  it('halves the delay for high priority', () => {
    // baseRetryDelay * 2^1 * 0.5 = 100, with jitter: 100 to 130
    const highDelay = service.calculateRetryDelay(1, 'high');
    const normalDelay = service.calculateRetryDelay(1, 'normal');
    expect(highDelay).toBeLessThan(normalDelay);
  });

  it('doubles the delay for low priority', () => {
    const lowDelay = service.calculateRetryDelay(1, 'low');
    const normalDelay = service.calculateRetryDelay(1, 'normal');
    expect(lowDelay).toBeGreaterThan(normalDelay);
  });

  it('caps the delay at 5000ms', () => {
    // attempt 10 would be 100 * 2^10 = 102400 but capped at 5000
    const delay = service.calculateRetryDelay(10, 'normal');
    expect(delay).toBeLessThanOrEqual(5000);
  });

  it('always returns a positive number', () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      expect(service.calculateRetryDelay(attempt, 'normal')).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// isNonRetryableError
// ---------------------------------------------------------------------------

describe('isNonRetryableError', () => {
  it('returns true for quota exceeded errors', () => {
    expect(service.isNonRetryableError(new Error('quota exceeded'))).toBe(true);
    expect(service.isNonRetryableError(new Error('QuotaExceededException'))).toBe(true);
  });

  it('returns true for constraint failed errors', () => {
    expect(service.isNonRetryableError(new Error('constraint failed'))).toBe(true);
    expect(service.isNonRetryableError(new Error('ConstraintError: constraint failed'))).toBe(true);
  });

  it('returns true for invalid key errors', () => {
    expect(service.isNonRetryableError(new Error('invalid key path'))).toBe(true);
  });

  it('returns true for readonly transaction errors', () => {
    expect(service.isNonRetryableError(new Error('readonly transaction cannot be modified'))).toBe(true);
  });

  it('returns true for cancelled operation errors', () => {
    expect(service.isNonRetryableError(new Error('operation cancelled'))).toBe(true);
  });

  it('returns true for aborted errors', () => {
    expect(service.isNonRetryableError(new Error('transaction aborted'))).toBe(true);
  });

  it('returns false for generic transient errors', () => {
    expect(service.isNonRetryableError(new Error('Network error'))).toBe(false);
    expect(service.isNonRetryableError(new Error('Timeout'))).toBe(false);
    expect(service.isNonRetryableError(new Error('Unknown error'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Request deduplication
// ---------------------------------------------------------------------------

describe('request deduplication', () => {
  it('returns the same promise for the same deduplication key', async () => {
    let resolveOp;
    const operation = jest.fn(() => new Promise((resolve) => { resolveOp = resolve; }));

    const key = 'dedupe-key';
    const promise1 = service.executeWithRetry(operation, {
      operationName: 'dedupe-test',
      deduplicationKey: key,
    });
    const promise2 = service.executeWithRetry(operation, {
      operationName: 'dedupe-test',
      deduplicationKey: key,
    });

    expect(promise1).toBe(promise2);

    // Resolve and clean up
    resolveOp('done');
    await jest.runAllTimersAsync();
    await promise1;
  });

  it('operation is only called once for deduplicated requests', async () => {
    let resolveOp;
    const operation = jest.fn(() => new Promise((resolve) => { resolveOp = resolve; }));

    service.executeWithRetry(operation, {
      operationName: 'dedupe-single-call',
      deduplicationKey: 'same-key',
    });
    service.executeWithRetry(operation, {
      operationName: 'dedupe-single-call',
      deduplicationKey: 'same-key',
    });

    resolveOp('result');
    await jest.runAllTimersAsync();

    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('removes the deduplication key after the operation completes', async () => {
    const operation = jest.fn().mockResolvedValue('result');

    const promise = service.executeWithRetry(operation, {
      operationName: 'cleanup-test',
      deduplicationKey: 'cleanup-key',
    });
    await jest.runAllTimersAsync();
    await promise;

    expect(service.activeRequests.has('cleanup-key')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AbortController cancellation
// ---------------------------------------------------------------------------

describe('AbortController cancellation', () => {
  it('rejects with cancellation error when aborted before operation starts', async () => {
    const abortController = new AbortController();
    abortController.abort();

    const operation = jest.fn().mockResolvedValue('should-not-reach');

    const promise = service.executeWithRetry(operation, {
      operationName: 'cancelled-op',
      abortController,
      retries: 0,
    });
    // Attach rejection handler before running timers to prevent unhandled rejection
    const rejectAssertion = expect(promise).rejects.toThrow(/cancelled/i);
    await jest.runAllTimersAsync();
    await rejectAssertion;
  });
});

// ---------------------------------------------------------------------------
// getStatistics
// ---------------------------------------------------------------------------

describe('getStatistics', () => {
  it('returns an object with circuitBreaker, networkStatus, activeRequests, and config', () => {
    const stats = service.getStatistics();

    expect(stats).toHaveProperty('circuitBreaker');
    expect(stats).toHaveProperty('networkStatus');
    expect(stats).toHaveProperty('activeRequests');
    expect(stats).toHaveProperty('config');
  });

  it('reflects current network status', () => {
    service.isOnline = true;
    expect(service.getStatistics().networkStatus).toBe(true);

    service.isOnline = false;
    expect(service.getStatistics().networkStatus).toBe(false);
  });

  it('includes config with defaultTimeout, maxRetries, and baseRetryDelay', () => {
    const { config } = service.getStatistics();

    expect(config).toHaveProperty('defaultTimeout', 10000);
    expect(config).toHaveProperty('maxRetries', 4);
    expect(config).toHaveProperty('baseRetryDelay', 100);
  });

  it('returns activeRequests count matching activeRequests map size', async () => {
    let resolveOp;
    const operation = jest.fn(() => new Promise((resolve) => { resolveOp = resolve; }));

    service.executeWithRetry(operation, {
      operationName: 'stat-test',
      deduplicationKey: 'stat-key',
    });

    expect(service.getStatistics().activeRequests).toBe(1);

    resolveOp('done');
    await jest.runAllTimersAsync();
  });
});

// ---------------------------------------------------------------------------
// cancelAllRequests
// ---------------------------------------------------------------------------

describe('cancelAllRequests', () => {
  it('clears all active requests', async () => {
    let resolve1, resolve2;
    const op1 = jest.fn(() => new Promise((r) => { resolve1 = r; }));
    const op2 = jest.fn(() => new Promise((r) => { resolve2 = r; }));

    service.executeWithRetry(op1, { operationName: 'req1', deduplicationKey: 'key1' });
    service.executeWithRetry(op2, { operationName: 'req2', deduplicationKey: 'key2' });

    expect(service.getActiveRequestsCount()).toBe(2);

    service.cancelAllRequests();

    expect(service.getActiveRequestsCount()).toBe(0);

    // Clean up pending promises
    resolve1('done');
    resolve2('done');
    await jest.runAllTimersAsync();
  });

  it('returns 0 active requests after cancel', () => {
    service.cancelAllRequests();
    expect(service.getActiveRequestsCount()).toBe(0);
  });
});
