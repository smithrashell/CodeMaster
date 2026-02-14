/**
 * Tests for focusAreasHelpers.js
 * Covers: getTagMasteryProgress, getTagOptions, loadFocusAreasData,
 *   saveFocusAreasSettings, resetFocusAreasSettings, setupAttemptUpdateListener
 *
 * React hooks (useFocusAreasState, useFocusAreasLifecycle) are not tested
 * here because they require a React rendering context.
 */

jest.mock('../../../../shared/services/chrome/chromeAPIErrorHandler.js', () => ({
  ChromeAPIErrorHandler: {
    sendMessageWithRetry: jest.fn(),
  },
}));

jest.mock('../../../../shared/utils/logging/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  debug: jest.fn(),
}));

import {
  getTagMasteryProgress,
  getTagOptions,
  loadFocusAreasData,
  saveFocusAreasSettings,
  resetFocusAreasSettings,
  setupAttemptUpdateListener,
} from '../focusAreasHelpers.js';

import { ChromeAPIErrorHandler } from '../../../../shared/services/chrome/chromeAPIErrorHandler.js';

// ---------------------------------------------------------------------------
// getTagMasteryProgress
// ---------------------------------------------------------------------------
describe('getTagMasteryProgress', () => {
  it('returns 0 when masteryData is empty', () => {
    expect(getTagMasteryProgress('array', [])).toBe(0);
  });

  it('returns 0 when tag is not found in masteryData', () => {
    const data = [{ tag: 'hash-table', totalAttempts: 10, successfulAttempts: 5 }];
    expect(getTagMasteryProgress('array', data)).toBe(0);
  });

  it('returns 0 when totalAttempts is 0', () => {
    const data = [{ tag: 'array', totalAttempts: 0, successfulAttempts: 0 }];
    expect(getTagMasteryProgress('array', data)).toBe(0);
  });

  it('calculates correct percentage', () => {
    const data = [{ tag: 'array', totalAttempts: 10, successfulAttempts: 7 }];
    expect(getTagMasteryProgress('array', data)).toBe(70);
  });

  it('rounds result to nearest integer', () => {
    const data = [{ tag: 'array', totalAttempts: 3, successfulAttempts: 1 }];
    expect(getTagMasteryProgress('array', data)).toBe(33);
  });

  it('returns 100 when all attempts are successful', () => {
    const data = [{ tag: 'dp', totalAttempts: 5, successfulAttempts: 5 }];
    expect(getTagMasteryProgress('dp', data)).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// getTagOptions
// ---------------------------------------------------------------------------
describe('getTagOptions', () => {
  it('returns empty arrays when focusAvailability has no tags and no availableTags', () => {
    const result = getTagOptions(null, [], [], []);
    expect(result).toEqual({ selectableOptions: [], previewTags: [] });
  });

  it('falls back to availableTags when focusAvailability.tags is missing', () => {
    const result = getTagOptions({}, ['array', 'hash-table'], [], []);
    expect(result.selectableOptions).toHaveLength(2);
    expect(result.selectableOptions[0].value).toBe('array');
    expect(result.selectableOptions[0].label).toBe('Array');
    expect(result.previewTags).toEqual([]);
  });

  it('filters out mastered tags in fallback mode', () => {
    const result = getTagOptions(undefined, ['array', 'hash-table'], ['array'], []);
    expect(result.selectableOptions).toHaveLength(1);
    expect(result.selectableOptions[0].value).toBe('hash-table');
  });

  it('formats labels - capitalises first char and replaces dashes/underscores', () => {
    const result = getTagOptions(null, ['two-pointer'], [], []);
    expect(result.selectableOptions[0].label).toBe('Two pointer');
  });

  it('processes focusAvailability.tags with tag objects', () => {
    const focus = {
      tags: [
        { tagId: 'array', selectable: true, reason: 'core' },
        { tagId: 'dp', selectable: false, reason: 'preview' },
      ],
    };
    const result = getTagOptions(focus, [], [], []);
    expect(result.selectableOptions).toHaveLength(1);
    expect(result.selectableOptions[0].value).toBe('array');
    expect(result.previewTags).toHaveLength(1);
    expect(result.previewTags[0].value).toBe('dp');
  });

  it('processes string tags inside focusAvailability.tags', () => {
    const focus = { tags: ['array', 'graph'] };
    const result = getTagOptions(focus, [], [], []);
    expect(result.selectableOptions).toHaveLength(2);
  });

  it('skips tags with no name', () => {
    const focus = { tags: [{ selectable: true }] };
    const result = getTagOptions(focus, [], [], []);
    expect(result.selectableOptions).toHaveLength(0);
  });

  it('includes progress from masteryData', () => {
    const focus = { tags: [{ tagId: 'array', selectable: true }] };
    const masteryData = [{ tag: 'array', totalAttempts: 10, successfulAttempts: 8 }];
    const result = getTagOptions(focus, [], [], masteryData);
    expect(result.selectableOptions[0].progress).toBe(80);
  });

  it('handles non-array availableTags gracefully in fallback', () => {
    const result = getTagOptions(null, null, null, []);
    expect(result.selectableOptions).toEqual([]);
  });

  it('returns empty arrays on error', () => {
    // Force an error by making tags.forEach throw
    const badFocus = { tags: 'not-an-array' };
    const result = getTagOptions(badFocus, [], [], []);
    expect(result).toEqual({ selectableOptions: [], previewTags: [] });
  });
});

// ---------------------------------------------------------------------------
// loadFocusAreasData
// ---------------------------------------------------------------------------
describe('loadFocusAreasData', () => {
  let setters;
  beforeEach(() => {
    jest.clearAllMocks();
    setters = {
      setLoading: jest.fn(),
      setError: jest.fn(),
      setFocusAvailability: jest.fn(),
      setCurrentTier: jest.fn(),
      setShowCustomMode: jest.fn(),
      setAvailableTags: jest.fn(),
      setMasteredTags: jest.fn(),
      setMasteryData: jest.fn(),
      setSelectedFocusAreas: jest.fn(),
      setCurrentSessionTags: jest.fn(),
      setHasChanges: jest.fn(),
    };
  });

  it('sets loading true then false', async () => {
    ChromeAPIErrorHandler.sendMessageWithRetry
      .mockResolvedValueOnce({ current_focus_tags: [] }) // getSessionState
      .mockResolvedValueOnce({ focusAreas: [], focusAreasTier: null }); // getSettings

    chrome.runtime.sendMessage.mockImplementation((_msg, cb) => {
      cb({ result: { tags: [], currentTier: 'Core', userOverrideTags: [], starterCore: [], masteredTags: [] } });
    });

    await loadFocusAreasData(setters);

    expect(setters.setLoading).toHaveBeenCalledWith(true);
    expect(setters.setLoading).toHaveBeenCalledWith(false);
  });

  it('sets currentSessionTags from session state', async () => {
    ChromeAPIErrorHandler.sendMessageWithRetry
      .mockResolvedValueOnce({ current_focus_tags: ['array', 'dp'] })
      .mockResolvedValueOnce({ focusAreas: [], focusAreasTier: null });

    chrome.runtime.sendMessage.mockImplementation((_msg, cb) => {
      cb({ result: { tags: [], currentTier: 'Core', userOverrideTags: [], starterCore: [], masteredTags: [] } });
    });

    await loadFocusAreasData(setters);
    expect(setters.setCurrentSessionTags).toHaveBeenCalledWith(['array', 'dp']);
  });

  it('uses focusData when available', async () => {
    const focusResult = {
      tags: [{ tagId: 'array', selectable: true }],
      currentTier: 'Fundamental',
      userOverrideTags: ['array'],
      starterCore: [],
      masteredTags: [],
    };

    ChromeAPIErrorHandler.sendMessageWithRetry
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ focusAreas: ['array'], focusAreasTier: 'Fundamental' });

    chrome.runtime.sendMessage.mockImplementation((_msg, cb) => {
      cb({ result: focusResult });
    });

    await loadFocusAreasData(setters);

    expect(setters.setFocusAvailability).toHaveBeenCalledWith(focusResult);
    expect(setters.setCurrentTier).toHaveBeenCalledWith('Fundamental');
    expect(setters.setShowCustomMode).toHaveBeenCalledWith(true);
    expect(setters.setAvailableTags).toHaveBeenCalledWith(['array']);
  });

  it('falls back to getCurrentLearningState when focusData is null', async () => {
    ChromeAPIErrorHandler.sendMessageWithRetry
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ focusAreas: [] });

    let callCount = 0;
    chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
      callCount++;
      if (callCount === 1) {
        cb({ result: null }); // getAvailableTagsForFocus returns null
      } else {
        cb({ allTagsInCurrentTier: ['graph'], masteredTags: ['dp'], masteryData: [], currentTier: 'Advanced' });
      }
    });

    await loadFocusAreasData(setters);

    expect(setters.setAvailableTags).toHaveBeenCalledWith(['graph']);
    expect(setters.setCurrentTier).toHaveBeenCalledWith('Advanced');
    expect(setters.setMasteredTags).toHaveBeenCalledWith(['dp']);
  });

  it('filters mastered tags from saved focus areas', async () => {
    ChromeAPIErrorHandler.sendMessageWithRetry
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ focusAreas: ['array', 'dp'], focusAreasTier: null });

    chrome.runtime.sendMessage.mockImplementation((_msg, cb) => {
      cb({ result: { tags: [], currentTier: 'Core', userOverrideTags: [], starterCore: [], masteredTags: ['dp'] } });
    });

    await loadFocusAreasData(setters);
    expect(setters.setSelectedFocusAreas).toHaveBeenCalledWith(['array']);
  });

  it('handles errors gracefully', async () => {
    ChromeAPIErrorHandler.sendMessageWithRetry.mockRejectedValueOnce(new Error('fail'));

    await loadFocusAreasData(setters);

    expect(setters.setError).toHaveBeenCalledWith('Failed to load learning data. Please try again.');
    expect(setters.setLoading).toHaveBeenCalledWith(false);
  });
});

// ---------------------------------------------------------------------------
// saveFocusAreasSettings
// ---------------------------------------------------------------------------
describe('saveFocusAreasSettings', () => {
  let setters;
  beforeEach(() => {
    jest.clearAllMocks();
    setters = {
      setSaving: jest.fn(),
      setError: jest.fn(),
      setHasChanges: jest.fn(),
    };
  });

  it('saves settings successfully', async () => {
    ChromeAPIErrorHandler.sendMessageWithRetry
      .mockResolvedValueOnce({ theme: 'dark' }) // getSettings
      .mockResolvedValueOnce({ status: 'success' }); // setSettings

    await saveFocusAreasSettings(['array'], 'Core', setters);

    expect(setters.setSaving).toHaveBeenCalledWith(true);
    expect(setters.setSaving).toHaveBeenCalledWith(false);
    expect(setters.setHasChanges).toHaveBeenCalledWith(false);
    expect(setters.setError).toHaveBeenCalledWith(null);
  });

  it('sets error when response is not success', async () => {
    ChromeAPIErrorHandler.sendMessageWithRetry
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ status: 'error' });

    await saveFocusAreasSettings([], 'Core', setters);
    expect(setters.setError).toHaveBeenCalledWith('Failed to save focus areas. Please try again.');
  });

  it('handles exceptions', async () => {
    ChromeAPIErrorHandler.sendMessageWithRetry.mockRejectedValueOnce(new Error('boom'));

    await saveFocusAreasSettings([], null, setters);
    expect(setters.setError).toHaveBeenCalledWith('Failed to save focus areas. Please try again.');
    expect(setters.setSaving).toHaveBeenCalledWith(false);
  });
});

// ---------------------------------------------------------------------------
// resetFocusAreasSettings
// ---------------------------------------------------------------------------
describe('resetFocusAreasSettings', () => {
  let setters;
  beforeEach(() => {
    jest.clearAllMocks();
    setters = {
      setError: jest.fn(),
      setSelectedFocusAreas: jest.fn(),
      setHasChanges: jest.fn(),
    };
  });

  it('resets focus areas on success', async () => {
    ChromeAPIErrorHandler.sendMessageWithRetry
      .mockResolvedValueOnce({ theme: 'dark' })
      .mockResolvedValueOnce({ status: 'success' });

    await resetFocusAreasSettings(setters);

    expect(setters.setSelectedFocusAreas).toHaveBeenCalledWith([]);
    expect(setters.setHasChanges).toHaveBeenCalledWith(false);
  });

  it('sets error when response is not success', async () => {
    ChromeAPIErrorHandler.sendMessageWithRetry
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ status: 'error' });

    await resetFocusAreasSettings(setters);
    expect(setters.setError).toHaveBeenCalledWith('Failed to reset focus areas. Please try again.');
  });

  it('handles exceptions', async () => {
    ChromeAPIErrorHandler.sendMessageWithRetry.mockRejectedValueOnce(new Error('fail'));

    await resetFocusAreasSettings(setters);
    expect(setters.setError).toHaveBeenCalledWith('Failed to reset focus areas. Please try again.');
  });
});

// ---------------------------------------------------------------------------
// setupAttemptUpdateListener
// ---------------------------------------------------------------------------
describe('setupAttemptUpdateListener', () => {
  it('adds an event listener and returns a cleanup function', () => {
    const setFocus = jest.fn();
    const addSpy = jest.spyOn(window, 'addEventListener');
    const removeSpy = jest.spyOn(window, 'removeEventListener');

    const cleanup = setupAttemptUpdateListener({}, setFocus);

    expect(addSpy).toHaveBeenCalledWith('cm:attempt-recorded', expect.any(Function));

    cleanup();

    expect(removeSpy).toHaveBeenCalledWith('cm:attempt-recorded', expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('calls setFocusAvailability on response.ok', () => {
    const setFocus = jest.fn();
    const prevAccess = { core: 'confirmed', fundamental: 'none', advanced: 'none' };
    const focusAvail = { access: prevAccess };

    chrome.runtime.sendMessage.mockImplementation((_msg, cb) => {
      cb({ ok: true, payload: { access: { core: 'confirmed', fundamental: 'confirmed', advanced: 'none' } } });
    });

    const cleanup = setupAttemptUpdateListener(focusAvail, setFocus);

    // Dispatch the custom event
    window.dispatchEvent(new Event('cm:attempt-recorded'));

    expect(setFocus).toHaveBeenCalledWith(
      expect.objectContaining({ access: expect.any(Object) })
    );

    cleanup();
  });

  it('does not call setFocusAvailability when response.ok is falsy', () => {
    const setFocus = jest.fn();
    chrome.runtime.sendMessage.mockImplementation((_msg, cb) => {
      cb({ ok: false });
    });

    const cleanup = setupAttemptUpdateListener({}, setFocus);
    window.dispatchEvent(new Event('cm:attempt-recorded'));
    expect(setFocus).not.toHaveBeenCalled();
    cleanup();
  });
});
