// Settings validation schema and utilities
const SETTINGS_SCHEMA = {
  // Core session settings
  adaptive: "boolean",
  sessionLength: "number",
  numberofNewProblemsPerSession: "number", 
  limit: "string",
  reminder: "object",
  
  // Interview settings
  interviewMode: "string",
  interviewReadinessThreshold: "number",
  interviewFrequency: "string",
  
  // Focus areas
  focusAreas: "object",
  
  // Timer settings
  timerDisplay: "string",
  breakReminders: "object",
  notifications: "object",
  
  // Display settings
  display: "object",
  
  // Theme settings
  theme: "string"
};

// Validate imported settings
export function validateSettings(settings) {
  const errors = [];
  const warnings = [];
  
  if (typeof settings !== "object" || settings === null) {
    errors.push("Settings must be a valid JSON object");
    return { isValid: false, errors, warnings };
  }
  
  // Check for required fields
  if (!Object.prototype.hasOwnProperty.call(settings, "adaptive")) {
    warnings.push("Missing adaptive session setting, using default");
  }
  
  // Validate data types
  Object.entries(SETTINGS_SCHEMA).forEach(([key, expectedType]) => {
    if (Object.prototype.hasOwnProperty.call(settings, key)) {
      const actualType = Array.isArray(settings[key]) ? "array" : typeof settings[key];
      if (expectedType === "object" && actualType !== "object") {
        errors.push(`${key} should be an object, got ${actualType}`);
      } else if (expectedType !== "object" && expectedType !== actualType) {
        warnings.push(`${key} should be ${expectedType}, got ${actualType} - will use default`);
      }
    }
  });
  
  // Validate interview mode specific values
  if (Object.prototype.hasOwnProperty.call(settings, "interviewMode")) {
    const validModes = ["disabled", "interview-like", "full-interview"];
    if (!validModes.includes(settings.interviewMode)) {
      errors.push(`Interview mode must be one of: ${validModes.join(", ")}`);
    }
  }
  
  if (Object.prototype.hasOwnProperty.call(settings, "interviewReadinessThreshold")) {
    const threshold = settings.interviewReadinessThreshold;
    if (typeof threshold === "number" && (threshold < 0 || threshold > 1)) {
      warnings.push("Interview readiness threshold should be between 0 and 1");
    }
  }
  
  if (Object.prototype.hasOwnProperty.call(settings, "interviewFrequency")) {
    const validFrequencies = ["manual", "weekly", "after-mastery"];
    if (!validFrequencies.includes(settings.interviewFrequency)) {
      warnings.push(`Interview frequency should be one of: ${validFrequencies.join(", ")}`);
    }
  }
  
  // Check for suspicious properties that might indicate malicious content
  const suspiciousKeys = ["script", "eval", "function", "__proto__", "constructor", "prototype"];
  const checkSuspiciousContent = (obj, path = "") => {
    Object.keys(obj).forEach(key => {
      if (suspiciousKeys.includes(key.toLowerCase())) {
        errors.push(`Suspicious property detected: ${path}${key}`);
      }
      if (typeof obj[key] === "object" && obj[key] !== null) {
        checkSuspiciousContent(obj[key], `${path}${key}.`);
      }
    });
  };
  checkSuspiciousContent(settings);
  
  const isValid = errors.length === 0;
  return { isValid, errors, warnings };
}