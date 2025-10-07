/**
 * Check type validators and logic for data integrity operations
 * Extracted to reduce performIntegrityCheck complexity
 */

/**
 * Determine if schema validation should be performed
 */
export function shouldPerformSchemaValidation(checkType, CHECK_TYPES) {
  return [
    CHECK_TYPES.FULL,
    CHECK_TYPES.SCHEMA,
    CHECK_TYPES.QUICK,
  ].includes(checkType);
}

/**
 * Determine if referential integrity check should be performed
 */
export function shouldPerformReferentialCheck(checkType, CHECK_TYPES) {
  return [CHECK_TYPES.FULL, CHECK_TYPES.REFERENTIAL].includes(checkType);
}

/**
 * Determine if business logic validation should be performed
 */
export function shouldPerformBusinessLogicCheck(checkType, CHECK_TYPES) {
  return [CHECK_TYPES.FULL, CHECK_TYPES.BUSINESS_LOGIC].includes(checkType);
}

/**
 * Validate check options and set defaults
 */
export function validateAndNormalizeOptions(options, defaults) {
  const {
    checkType = defaults.CHECK_TYPES.FULL,
    stores = defaults.getStoreNames(),
    includePerformanceMetrics = true,
    priority = defaults.PRIORITIES.MEDIUM,
    saveToHistory = true,
    generateReport = true,
  } = options;

  return {
    checkType,
    stores,
    includePerformanceMetrics,
    priority,
    saveToHistory,
    generateReport,
  };
}

/**
 * Create check execution context with all required dependencies
 */
export function createCheckExecutionContext(serviceClass, normalizedOptions) {
  return {
    ...normalizedOptions,
    CHECK_TYPES: serviceClass.CHECK_TYPES,
    PRIORITIES: serviceClass.PRIORITIES,
    performSchemaValidation: serviceClass.performSchemaValidation.bind(serviceClass),
    performBusinessLogicValidation: serviceClass.performBusinessLogicValidation.bind(serviceClass),
    calculateOverallScore: serviceClass.calculateOverallScore.bind(serviceClass),
    generateRecommendations: serviceClass.generateRecommendations.bind(serviceClass),
    addToHistory: serviceClass.addToHistory.bind(serviceClass),
    reportCriticalIssues: serviceClass.reportCriticalIssues.bind(serviceClass),
    lastCheck: serviceClass.lastCheck,
  };
}