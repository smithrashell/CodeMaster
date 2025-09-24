/**
 * Session Service Factory
 *
 * Provides conditional access to mock or real session services
 * following the same pattern as dashboard service selection.
 */

// Use console directly to avoid import issues in background script
const logger = {
  info: (...args) => console.log('[SessionFactory]', ...args),
  warn: (...args) => console.warn('[SessionFactory]', ...args),
  error: (...args) => console.error('[SessionFactory]', ...args)
};
import { shouldUseMockSession } from '../../app/config/mockConfig.js';
import { mockSessionService } from './mockSessionService.js';
import { SessionService } from './sessionService.js';
import * as sessionsModule from '../db/sessions.js';
import { StorageService } from './storageService.js';

/**
 * Get session service configuration
 */
async function getSessionConfig() {
  try {
    // Use static imports
    return {
      useMock: shouldUseMockSession(),
      configLoaded: true
    };
  } catch (error) {
    // Fallback if config can't be loaded
    logger.warn('Failed to load session config, using fallback', { error: error.message });
    return {
      useMock: false,
      configLoaded: false
    };
  }
}

/**
 * Get the appropriate SessionService (mock or real)
 * Returns an object with the same interface as SessionService
 */
export async function getSessionService() {
  const config = await getSessionConfig();

  if (config.useMock) {
    logger.info('Using MockSessionService for session operations');
    // Use static imports
    return mockSessionService;
  } else {
    logger.info('Using real SessionService for session operations');
    // Use static imports
    return SessionService;
  }
}

/**
 * Get individual session functions with automatic service selection
 * These can be used as drop-in replacements for direct imports
 */
export async function getOrCreateSession(...args) {
  const service = await getSessionService();
  return service.getOrCreateSession(...args);
}

export async function checkAndCompleteSession(...args) {
  const service = await getSessionService();
  return service.checkAndCompleteSession(...args);
}

/**
 * Get the appropriate sessions database functions (mock or real)
 */
export async function getSessionsDB() {
  const config = await getSessionConfig();

  if (config.useMock) {
    // Return mock versions of sessions.js functions
    // Use static imports
    return {
      evaluateDifficultyProgression: (...args) => mockSessionService.evaluateDifficultyProgression(...args),
      buildAdaptiveSessionSettings: () => mockSessionService.buildAdaptiveSessionSettings(),
      getSessionPerformance: (...args) => mockSessionService.getSessionPerformance(...args),
      _isMock: true
    };
  } else {
    // Return real sessions.js functions
    // Use static imports
    return {
      evaluateDifficultyProgression: sessionsModule.evaluateDifficultyProgression,
      buildAdaptiveSessionSettings: sessionsModule.buildAdaptiveSessionSettings,
      getSessionPerformance: sessionsModule.getSessionPerformance,
      _isMock: false
    };
  }
}

/**
 * Get mock storage service for testing isolation
 */
export async function getStorageService() {
  const config = await getSessionConfig();

  if (config.useMock) {
    // Return mock storage that doesn't touch real database
    // Use static imports
    return {
      getSessionState: (key) => {
        if (key === 'session_state' || !key) {
          return Promise.resolve(mockSessionService.mockState);
        }
        return Promise.resolve(null);
      },
      setSessionState: (key, data) => {
        if (key === 'session_state' || !key) {
          Object.assign(mockSessionService.mockState, data);
        }
        return Promise.resolve();
      },
      _isMock: true
    };
  } else {
    // Return real storage service
    // Use static imports
    return StorageService;
  }
}

/**
 * Utility to check if currently using mock services
 */
export async function isUsingMockServices() {
  const config = await getSessionConfig();
  return config.useMock;
}

/**
 * Enable mock services programmatically (for testing)
 */
export function enableMockServices() {
  if (typeof window !== 'undefined') {
    localStorage.setItem('cm-use-mock-session', 'true');
    logger.info('Mock session services enabled via localStorage');
  }
}

/**
 * Disable mock services programmatically
 */
export function disableMockServices() {
  if (typeof window !== 'undefined') {
    localStorage.setItem('cm-use-mock-session', 'false');
    logger.info('Mock session services disabled via localStorage');
  }
}

/**
 * Reset mock services state (for testing)
 */
export async function resetMockServices() {
  const config = await getSessionConfig();

  if (config.useMock) {
    // Use static imports
    mockSessionService.reset();
    logger.info('Mock session services reset');
  }
}

// Make functions available globally for browser console use
if (typeof window !== 'undefined') {
  window.enableMockSessionServices = enableMockServices;
  window.disableMockSessionServices = disableMockServices;
  window.resetMockSessionServices = resetMockServices;
  window.checkMockSessionServices = isUsingMockServices;
}