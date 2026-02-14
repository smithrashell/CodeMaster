/**
 * Tests for dbHelperAdvanced.js
 * Covers: smartTeardown, createBaseline, restoreFromBaseline,
 *   smartTestIsolation, resetToCleanState
 *
 * All functions accept a "helper" context object and depend on dbHelperMethods.
 * We mock dbHelperMethods and test the orchestration logic.
 */

jest.mock('../dbHelperMethods.js', () => ({
  clear: jest.fn(),
  clearStoreWithLogging: jest.fn(),
  clearConfigStores: jest.fn(),
  handleExpensiveDerivedData: jest.fn(),
  openDB: jest.fn(),
  put: jest.fn(),
}));

import {
  smartTeardown,
  createBaseline,
  restoreFromBaseline,
  smartTestIsolation,
  resetToCleanState,
} from '../dbHelperAdvanced.js';

import {
  clear,
  clearStoreWithLogging,
  clearConfigStores,
  handleExpensiveDerivedData,
  openDB,
  put,
} from '../dbHelperMethods.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeHelper(overrides = {}) {
  return {
    isTestMode: true,
    enableLogging: false,
    dbName: 'CodeMaster_test',
    ...overrides,
  };
}

function _makeMockDb(stores = {}) {
  return {
    transaction: jest.fn((storeName, _mode) => {
      const data = stores[storeName] || [];
      const putFn = jest.fn();
      return {
        objectStore: jest.fn(() => ({
          getAll: jest.fn(() => {
            const req = {};
            setTimeout(() => {
              req.result = data;
              if (req.onsuccess) req.onsuccess();
            }, 0);
            return req;
          }),
          put: putFn,
        })),
        oncomplete: null,
        onerror: null,
        _putFn: putFn,
        // fire oncomplete after microtask
        _resolve() {
          if (this.oncomplete) this.oncomplete();
        },
      };
    }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  delete globalThis._testBaseline;
  delete globalThis._testModifiedStores;
});

// ---------------------------------------------------------------------------
// smartTeardown
// ---------------------------------------------------------------------------
describe('smartTeardown', () => {
  it('throws when not in test mode', async () => {
    await expect(smartTeardown({ isTestMode: false })).rejects.toThrow('SAFETY');
  });

  it('clears test session stores and config by default', async () => {
    const helper = makeHelper();

    clearStoreWithLogging.mockResolvedValue();
    clearConfigStores.mockResolvedValue();
    handleExpensiveDerivedData.mockResolvedValue();

    const result = await smartTeardown(helper);

    // 4 TEST_SESSION stores cleared
    expect(clearStoreWithLogging).toHaveBeenCalledTimes(4);
    // clearUserData = true by default
    expect(clearConfigStores).toHaveBeenCalledTimes(1);
    expect(result.preserved).toEqual(expect.any(Array));
    expect(result.cleared).toEqual(expect.any(Array));
    expect(result.errors).toEqual(expect.any(Array));
  });

  it('skips config clearing when clearUserData is false', async () => {
    const helper = makeHelper();

    clearStoreWithLogging.mockResolvedValue();
    handleExpensiveDerivedData.mockResolvedValue();

    await smartTeardown(helper, { clearUserData: false });
    expect(clearConfigStores).not.toHaveBeenCalled();
  });

  it('clears all stores on full teardown', async () => {
    const helper = makeHelper();

    clearStoreWithLogging.mockResolvedValue();
    clearConfigStores.mockResolvedValue();

    const result = await smartTeardown(helper, { preserveSeededData: false });
    // 4 session + 3 static + 2 expensive = 9
    expect(clearStoreWithLogging).toHaveBeenCalledTimes(9);
    expect(result.preserved).toEqual([]);
  });

  it('preserves static data and calls handleExpensiveDerivedData on smart teardown', async () => {
    const helper = makeHelper();

    clearStoreWithLogging.mockResolvedValue();
    clearConfigStores.mockResolvedValue();
    handleExpensiveDerivedData.mockResolvedValue();

    const result = await smartTeardown(helper, { preserveSeededData: true });
    expect(handleExpensiveDerivedData).toHaveBeenCalledTimes(1);
    expect(result.preserved).toEqual([
      'standard_problems',
      'strategy_data',
      'tag_relationships',
    ]);
  });

  it('rethrows errors', async () => {
    const helper = makeHelper();
    clearStoreWithLogging.mockRejectedValueOnce(new Error('db fail'));

    await expect(smartTeardown(helper)).rejects.toThrow('db fail');
  });

  it('logs when enableLogging is true', async () => {
    const helper = makeHelper({ enableLogging: true });
    const spy = jest.spyOn(console, 'log');

    clearStoreWithLogging.mockResolvedValue();
    clearConfigStores.mockResolvedValue();
    handleExpensiveDerivedData.mockResolvedValue();

    await smartTeardown(helper);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// createBaseline
// ---------------------------------------------------------------------------
describe('createBaseline', () => {
  it('throws when not in test mode', async () => {
    await expect(createBaseline({ isTestMode: false })).rejects.toThrow('SAFETY');
  });

  it('creates a baseline snapshot from expensive derived stores', async () => {
    const helper = makeHelper();
    const records = [{ id: 1 }, { id: 2 }];

    const mockDb = {
      transaction: jest.fn(() => ({
        objectStore: jest.fn(() => ({
          getAll: jest.fn(() => {
            const req = {};
            Promise.resolve().then(() => {
              req.result = records;
              if (req.onsuccess) req.onsuccess();
            });
            return req;
          }),
        })),
      })),
    };

    openDB.mockResolvedValue(mockDb);

    const baseline = await createBaseline(helper);

    expect(baseline.id).toMatch(/^baseline_/);
    expect(baseline.stores).toEqual(['pattern_ladders', 'problem_relationships']);
    expect(baseline.data.pattern_ladders.count).toBe(2);
    expect(baseline.data.problem_relationships.count).toBe(2);
    expect(globalThis._testBaseline).toBe(baseline);
  });

  it('throws when store getAll fails', async () => {
    const helper = makeHelper();
    const mockDb = {
      transaction: jest.fn(() => ({
        objectStore: jest.fn(() => ({
          getAll: jest.fn(() => {
            const req = {};
            Promise.resolve().then(() => {
              req.error = new Error('read fail');
              if (req.onerror) req.onerror();
            });
            return req;
          }),
        })),
      })),
    };

    openDB.mockResolvedValue(mockDb);
    await expect(createBaseline(helper)).rejects.toThrow('read fail');
  });
});

// ---------------------------------------------------------------------------
// restoreFromBaseline
// ---------------------------------------------------------------------------
describe('restoreFromBaseline', () => {
  it('throws when not in test mode', async () => {
    await expect(restoreFromBaseline({ isTestMode: false })).rejects.toThrow('SAFETY');
  });

  it('throws when no baseline exists', async () => {
    globalThis._testBaseline = undefined;
    await expect(restoreFromBaseline(makeHelper())).rejects.toThrow('No baseline snapshot');
  });

  it('restores data from baseline snapshot', async () => {
    const helper = makeHelper();
    const putFn = jest.fn();

    globalThis._testBaseline = {
      id: 'baseline_123',
      data: {
        pattern_ladders: {
          data: [{ id: 1, tag: 'array' }],
          count: 1,
          timestamp: new Date().toISOString(),
        },
      },
      created: new Date().toISOString(),
      stores: ['pattern_ladders'],
    };

    const txn = {
      objectStore: jest.fn(() => ({
        put: putFn,
      })),
      oncomplete: null,
      onerror: null,
    };

    const mockDb = {
      transaction: jest.fn(() => txn),
    };

    openDB.mockResolvedValue(mockDb);
    clear.mockResolvedValue();

    // Make the transaction complete asynchronously
    const originalTransaction = mockDb.transaction;
    mockDb.transaction = jest.fn((...args) => {
      const t = originalTransaction(...args);
      Promise.resolve().then(() => {
        if (t.oncomplete) t.oncomplete();
      });
      return t;
    });

    const result = await restoreFromBaseline(helper);

    expect(clear).toHaveBeenCalledWith(helper, 'pattern_ladders');
    expect(result.restored).toContain('pattern_ladders');
    expect(result.totalRecords).toBe(1);
  });

  it('captures errors per store without throwing', async () => {
    const helper = makeHelper();

    globalThis._testBaseline = {
      id: 'baseline_123',
      data: {
        pattern_ladders: { data: [{ id: 1 }], count: 1, timestamp: '' },
      },
      created: '',
      stores: ['pattern_ladders'],
    };

    clear.mockRejectedValueOnce(new Error('clear fail'));

    const result = await restoreFromBaseline(helper);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].store).toBe('pattern_ladders');
  });
});

// ---------------------------------------------------------------------------
// smartTestIsolation
// ---------------------------------------------------------------------------
describe('smartTestIsolation', () => {
  it('throws when not in test mode', async () => {
    await expect(smartTestIsolation({ isTestMode: false })).rejects.toThrow('SAFETY');
  });

  it('clears session stores by default', async () => {
    const helper = makeHelper();
    clear.mockResolvedValue();

    const result = await smartTestIsolation(helper, { useSnapshots: false });
    // 4 session stores
    expect(clear).toHaveBeenCalledTimes(4);
    expect(result.cleared).toHaveLength(4);
  });

  it('also clears config stores on fullReset', async () => {
    const helper = makeHelper();
    clear.mockResolvedValue();

    const _result = await smartTestIsolation(helper, { useSnapshots: false, fullReset: true });
    // 4 session + 3 config + 3 static + 2 expensive = 12
    expect(clear).toHaveBeenCalledTimes(12);
  });

  it('restores from baseline when useSnapshots and baseline exists', async () => {
    const helper = makeHelper();
    clear.mockResolvedValue();

    globalThis._testBaseline = {
      id: 'baseline_123',
      data: {
        pattern_ladders: { data: [], count: 0, timestamp: '' },
      },
      created: '',
      stores: ['pattern_ladders'],
    };

    // Mock openDB for restoreFromBaseline
    const txn = {
      objectStore: jest.fn(() => ({ put: jest.fn() })),
      oncomplete: null,
      onerror: null,
    };
    const mockDb = {
      transaction: jest.fn(() => {
        Promise.resolve().then(() => {
          if (txn.oncomplete) txn.oncomplete();
        });
        return txn;
      }),
    };
    openDB.mockResolvedValue(mockDb);

    const result = await smartTestIsolation(helper, { useSnapshots: true });
    expect(result.restored).toBeDefined();
  });

  it('captures per-store errors without throwing', async () => {
    const helper = makeHelper();
    clear.mockRejectedValue(new Error('clear err'));

    const result = await smartTestIsolation(helper, { useSnapshots: false });
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('logs when enableLogging is true', async () => {
    const helper = makeHelper({ enableLogging: true });
    clear.mockResolvedValue();
    const spy = jest.spyOn(console, 'log');

    const result = await smartTestIsolation(helper, { useSnapshots: false });
    expect(spy).toHaveBeenCalled();
    expect(result.cleared).toHaveLength(4);
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// resetToCleanState
// ---------------------------------------------------------------------------
describe('resetToCleanState', () => {
  it('throws when not in test mode', async () => {
    await expect(resetToCleanState({ isTestMode: false })).rejects.toThrow('SAFETY');
  });

  it('calls smartTeardown and seeds baseline data', async () => {
    const helper = makeHelper();

    clearStoreWithLogging.mockResolvedValue();
    clearConfigStores.mockResolvedValue();
    handleExpensiveDerivedData.mockResolvedValue();
    put.mockResolvedValue();

    const result = await resetToCleanState(helper);

    // put called for tag_mastery and settings
    expect(put).toHaveBeenCalledTimes(2);
    expect(put).toHaveBeenCalledWith(helper, 'tag_mastery', expect.objectContaining({ id: 'array' }));
    expect(put).toHaveBeenCalledWith(helper, 'settings', expect.objectContaining({ id: 'user_preferences' }));
    expect(result.baselineDataAdded).toBe(true);
  });

  it('returns baselineDataAdded: false when put fails', async () => {
    const helper = makeHelper();

    clearStoreWithLogging.mockResolvedValue();
    clearConfigStores.mockResolvedValue();
    handleExpensiveDerivedData.mockResolvedValue();
    put.mockRejectedValueOnce(new Error('put fail'));

    const result = await resetToCleanState(helper);
    expect(result.baselineDataAdded).toBe(false);
    expect(result.baselineError).toBe('put fail');
  });
});
