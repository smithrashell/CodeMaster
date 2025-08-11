/**
 * Mock Configuration
 *
 * Central configuration for mock services, feature flags,
 * and development settings.
 */

// Import USER_SCENARIOS - we'll define them here to avoid circular imports
export const USER_SCENARIOS = {
  NEW_USER: "new",
  BEGINNER_USER: "beginner",
  ACTIVE_USER: "active",
  ADVANCED_USER: "advanced",
};

/**
 * Feature flags for enabling/disabling mock services
 */
export const FEATURE_FLAGS = {
  // Master flag - when true, enables mock services
  USE_MOCK_DATA: true,

  // Specific service flags
  MOCK_DASHBOARD_SERVICE: true,
  MOCK_PROBLEM_SERVICE: false,
  MOCK_SESSION_SERVICE: false,
  MOCK_TAG_SERVICE: false,

  // Development flags
  MOCK_NETWORK_DELAY: true,
  SHOW_MOCK_INDICATORS: true,
  LOG_MOCK_ACTIVITY: true,

  // Testing flags
  ENABLE_ERROR_SIMULATION: false,
  ENABLE_SCENARIO_SWITCHING: true,
};

/**
 * Mock service configuration
 */
export const MOCK_CONFIG = {
  // Default user scenario
  defaultUserType: USER_SCENARIOS.ACTIVE_USER,

  // Network simulation settings
  networkDelay: {
    min: 200,
    max: 800,
    default: 500,
  },

  // Mock data generation settings
  dataGeneration: {
    sessionCount: {
      [USER_SCENARIOS.NEW_USER]: 5,
      [USER_SCENARIOS.BEGINNER_USER]: 20,
      [USER_SCENARIOS.ACTIVE_USER]: 50,
      [USER_SCENARIOS.ADVANCED_USER]: 100,
    },

    timeRange: {
      days: 180, // Generate data for last 6 months
      granularities: ["weekly", "monthly", "yearly"],
    },

    problemDifficulty: {
      [USER_SCENARIOS.NEW_USER]: [0.6, 0.35, 0.05], // Easy, Medium, Hard
      [USER_SCENARIOS.BEGINNER_USER]: [0.5, 0.4, 0.1],
      [USER_SCENARIOS.ACTIVE_USER]: [0.3, 0.55, 0.15],
      [USER_SCENARIOS.ADVANCED_USER]: [0.2, 0.5, 0.3],
    },

    successRates: {
      [USER_SCENARIOS.NEW_USER]: { Easy: 0.4, Medium: 0.2, Hard: 0.1 },
      [USER_SCENARIOS.BEGINNER_USER]: { Easy: 0.7, Medium: 0.4, Hard: 0.2 },
      [USER_SCENARIOS.ACTIVE_USER]: { Easy: 0.85, Medium: 0.65, Hard: 0.4 },
      [USER_SCENARIOS.ADVANCED_USER]: { Easy: 0.95, Medium: 0.8, Hard: 0.6 },
    },
  },

  // UI indicators for mock mode
  indicators: {
    showBadge: true,
    showToast: false,
    showConsoleWarning: true,
    badgeText: "🎭 MOCK",
    badgeColor: "#ff6b35",
    toastDuration: 3000,
  },

  // Error simulation settings
  errorSimulation: {
    probability: 0.1, // 10% chance of errors when enabled
    types: ["network", "database", "timeout", "permissions"],
    delay: 2000, // Delay before throwing error
  },
};

/**
 * Environment detection
 */
export const ENVIRONMENT = {
  isDevelopment: process.env.NODE_ENV === "development",
  isProduction: process.env.NODE_ENV === "production",
  isTest: process.env.NODE_ENV === "test",
  // Allow forcing mock mode even in production (for local testing)
  forceMockMode:
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.protocol === "file:" ||
      window.location.href.includes("app.html")),
};

/**
 * Get effective configuration based on environment and overrides
 */
export const getEffectiveConfig = (overrides = {}) => {
  const baseConfig = {
    ...FEATURE_FLAGS,
    ...MOCK_CONFIG,
  };

  // Apply environment-specific defaults
  if (ENVIRONMENT.isProduction && !ENVIRONMENT.forceMockMode) {
    baseConfig.USE_MOCK_DATA = false;
    baseConfig.SHOW_MOCK_INDICATORS = false;
    baseConfig.LOG_MOCK_ACTIVITY = false;
  }

  if (ENVIRONMENT.isTest) {
    baseConfig.MOCK_NETWORK_DELAY = false;
    baseConfig.networkDelay.default = 0;
  }

  // Apply any runtime overrides
  return {
    ...baseConfig,
    ...overrides,
  };
};

/**
 * Runtime configuration management
 */
class MockConfigManager {
  constructor() {
    this.config = getEffectiveConfig();
    this.subscribers = new Set();
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates) {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...updates };

    // Notify subscribers of changes
    this.subscribers.forEach((callback) => {
      try {
        callback(this.config, oldConfig);
      } catch (error) {
        console.error("Error notifying config subscriber:", error);
      }
    });

    if (this.config.LOG_MOCK_ACTIVITY) {
      console.log("🎭 Mock config updated:", updates);
    }
  }

  /**
   * Subscribe to configuration changes
   */
  subscribe(callback) {
    this.subscribers.add(callback);

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Toggle mock mode on/off
   */
  toggleMockMode() {
    this.updateConfig({ USE_MOCK_DATA: !this.config.USE_MOCK_DATA });
    return this.config.USE_MOCK_DATA;
  }

  /**
   * Set user scenario for testing
   */
  setUserScenario(scenario) {
    if (Object.values(USER_SCENARIOS).includes(scenario)) {
      this.updateConfig({ defaultUserType: scenario });
      return true;
    }
    return false;
  }

  /**
   * Reset to defaults
   */
  reset() {
    this.config = getEffectiveConfig();
    this.subscribers.forEach((callback) => {
      try {
        callback(this.config, {});
      } catch (error) {
        console.error("Error notifying config subscriber:", error);
      }
    });
  }

  /**
   * Check if mock mode is enabled
   */
  isMockMode() {
    return this.config.USE_MOCK_DATA;
  }

  /**
   * Check if specific service should use mock
   */
  shouldUseMock(serviceName) {
    const flagName = `MOCK_${serviceName.toUpperCase()}_SERVICE`;
    return this.config.USE_MOCK_DATA && this.config[flagName];
  }
}

// Create singleton instance
export const mockConfigManager = new MockConfigManager();

/**
 * Convenience functions for common operations
 */
export const isMockMode = () => mockConfigManager.isMockMode();
export const shouldUseMockDashboard = () =>
  mockConfigManager.shouldUseMock("DASHBOARD");
export const getMockConfig = () => mockConfigManager.getConfig();
export const setUserScenario = (scenario) =>
  mockConfigManager.setUserScenario(scenario);
export const toggleMockMode = () => mockConfigManager.toggleMockMode();

/**
 * Initialize mock configuration
 */
export const initializeMockConfig = (initialConfig = {}) => {
  mockConfigManager.updateConfig(initialConfig);

  if (
    mockConfigManager.getConfig().SHOW_MOCK_INDICATORS &&
    mockConfigManager.getConfig().showConsoleWarning
  ) {
    console.warn(
      "🎭 Mock mode is enabled. Dashboard data is simulated for development/testing."
    );
  }
};

// Auto-initialize if in development mode
if (ENVIRONMENT.isDevelopment) {
  initializeMockConfig();
}

// Expose mock functions to global scope for easy console access
if (typeof window !== "undefined") {
  window.mockConfig = {
    setUserScenario,
    toggleMockMode,
    isMockMode,
    getMockConfig,
    manager: mockConfigManager,
    scenarios: USER_SCENARIOS,
  };

  // Also expose individual functions for convenience
  window.setUserScenario = setUserScenario;
  window.toggleMockMode = toggleMockMode;
  window.getMockConfig = getMockConfig;
  window.isMockMode = isMockMode;
}

export default {
  FEATURE_FLAGS,
  MOCK_CONFIG,
  ENVIRONMENT,
  getEffectiveConfig,
  mockConfigManager,
  isMockMode,
  shouldUseMockDashboard,
  getMockConfig,
  setUserScenario,
  toggleMockMode,
  initializeMockConfig,
};
