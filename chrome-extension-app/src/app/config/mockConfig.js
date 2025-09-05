/**
 * Mock Configuration - Development Only
 * 
 * Simple dev-only mock service configuration for UI testing.
 * Only active in NODE_ENV=development with zero production overhead.
 */

/**
 * Check if mock dashboard should be used
 * Simplified to prioritize .env configuration with minimal fallbacks
 */
export const shouldUseMockDashboard = () => {
  // Primary control: Environment variable from .env file
  if (process.env.USE_MOCK_SERVICE !== undefined) {
    const useMock = process.env.USE_MOCK_SERVICE === 'true';
    return useMock;
  }
  
  // Developer override: localStorage for debugging (temporary override)
  if (typeof window !== 'undefined' && localStorage.getItem('cm-force-mock') === 'true') {
    return true;
  }
  
  // Fallback: If no .env setting, default to false (real data)
  // This ensures production-like behavior when configuration is missing
  return false;
};

/**
 * User scenarios for testing different data states
 */
export const USER_SCENARIOS = {
  NEW_USER: "new",
  BEGINNER_USER: "beginner", 
  ACTIVE_USER: "active",
  ADVANCED_USER: "advanced",
};

/**
 * Mock data generation configuration
 */
export const MOCK_DATA_CONFIG = {
  // Default scenario
  defaultUserType: USER_SCENARIOS.ACTIVE_USER,
  
  // Data generation settings
  timeRangeDays: 180, // Generate data for last 6 months
  
  sessionCounts: {
    [USER_SCENARIOS.NEW_USER]: 5,
    [USER_SCENARIOS.BEGINNER_USER]: 20,
    [USER_SCENARIOS.ACTIVE_USER]: 50,
    [USER_SCENARIOS.ADVANCED_USER]: 100,
  },
  
  successRates: {
    [USER_SCENARIOS.NEW_USER]: { Easy: 0.4, Medium: 0.2, Hard: 0.1 },
    [USER_SCENARIOS.BEGINNER_USER]: { Easy: 0.7, Medium: 0.4, Hard: 0.2 },
    [USER_SCENARIOS.ACTIVE_USER]: { Easy: 0.85, Medium: 0.65, Hard: 0.4 },
    [USER_SCENARIOS.ADVANCED_USER]: { Easy: 0.95, Medium: 0.8, Hard: 0.6 },
  },
};

/**
 * Helper functions for development
 */
export const enableMockMode = () => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('cm-force-mock', 'true');
  }
};

export const disableMockMode = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('cm-force-mock');
  }
};

// Make functions available globally for easy development access
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  window.enableMockMode = enableMockMode;
  window.disableMockMode = disableMockMode;
}

// Simple dev mode warning
if (process.env.NODE_ENV === 'development') {
  // Development mock service active
  // Mock mode instructions removed
}

export default {
  shouldUseMockDashboard,
  USER_SCENARIOS,
  MOCK_DATA_CONFIG,
};
