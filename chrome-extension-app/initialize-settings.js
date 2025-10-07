// Quick script to initialize missing user settings
// Run this in the browser console on your extension's dashboard page

(async function initializeSettings() {
  console.log('🔧 Initializing missing user settings...');

  // Check current settings
  const currentSettings = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "getSettings" }, resolve);
  });

  console.log('📋 Current settings:', currentSettings);

  // Default settings that should exist
  const defaultSettings = {
    adaptive: true,
    sessionLength: 5,
    numberofNewProblemsPerSession: 2,
    limit: "off",
    reminder: { value: false, label: "6" },
    theme: "light",
    focusAreas: ["array"], // Start with one focus area
    timerDisplay: "mm:ss",
    breakReminders: { enabled: false, interval: 25 },
    notifications: { sound: false, browser: false, visual: true },
    sessionsPerWeek: 5,
    reviewRatio: 40,
    accessibility: {
      keyboard: {
        enhancedFocus: true,
        skipToContent: true,
        focusTrapping: true
      }
    }
  };

  // Merge with any existing settings
  const mergedSettings = { ...defaultSettings, ...currentSettings };

  // Save the settings
  const response = await new Promise((resolve) => {
    chrome.runtime.sendMessage({
      type: "setSettings",
      message: mergedSettings
    }, resolve);
  });

  if (response?.status === "success") {
    console.log('✅ Settings initialized successfully!');
    console.log('🎯 Focus areas set to:', mergedSettings.focusAreas);
    console.log('🔄 Please refresh the page to see changes.');
  } else {
    console.error('❌ Failed to initialize settings:', response);
  }
})();