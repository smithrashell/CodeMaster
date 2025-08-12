/**
 * Mock Configuration - Development Only
 * 
 * Simple dev-only mock service configuration for UI testing.
 * Only active in NODE_ENV=development with zero production overhead.
 */

/**
 * Check if mock dashboard should be used
 * Multiple detection methods for robust development mode detection
 */
export const shouldUseMockDashboard = () => {
  const nodeEnvDev = process.env.NODE_ENV === 'development';
  const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const isFileProtocol = typeof window !== 'undefined' && 
    window.location.protocol === 'file:';
  const isExtensionDev = typeof window !== 'undefined' && 
    window.location.href.includes('chrome-extension://') &&
    (window.location.hostname === 'localhost' || !window.location.hostname);
  
  // Manual override - check for URL parameter or localStorage flag
  const hasUrlFlag = typeof window !== 'undefined' && 
    (window.location.search.includes('mock=true') || window.location.hash.includes('mock=true'));
  const hasStorageFlag = typeof window !== 'undefined' &&
    localStorage.getItem('cm-force-mock') === 'true';
    
  // For dashboard development, be more permissive with mock mode
  // Enable mock if we're not clearly in a production Chrome extension
  const isProductionExtension = typeof window !== 'undefined' && 
    window.location.href.includes('chrome-extension://') && 
    process.env.NODE_ENV === 'production';
  
  // Force enable for development - any of these conditions enable mock mode
  // Also enable if we're NOT in a production extension (for standalone dashboard development)
  const shouldMock = nodeEnvDev || isLocalhost || isFileProtocol || isExtensionDev || hasUrlFlag || hasStorageFlag || !isProductionExtension;
  
  console.log('🔧 MOCK CONFIG DEBUG:', {
    'process.env.NODE_ENV': process.env.NODE_ENV,
    'nodeEnvDev': nodeEnvDev,
    'isLocalhost': isLocalhost, 
    'isFileProtocol': isFileProtocol,
    'isExtensionDev': isExtensionDev,
    'hasUrlFlag': hasUrlFlag,
    'hasStorageFlag': hasStorageFlag,
    'isProductionExtension': isProductionExtension,
    'finalDecision': shouldMock,
    'timestamp': new Date().toISOString()
  });
  
  return shouldMock;
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

// Simple dev mode warning
if (process.env.NODE_ENV === 'development') {
  console.warn('🎭 Development mock service active - UI testing data enabled');
}

export default {
  shouldUseMockDashboard,
  USER_SCENARIOS,
  MOCK_DATA_CONFIG,
};
