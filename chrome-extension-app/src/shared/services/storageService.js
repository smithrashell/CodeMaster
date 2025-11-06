// eslint-disable-next-line no-restricted-imports
import { dbHelper } from "../db/index.js";



/**
 * 🚨 CRITICAL: Detect content script context to prevent database access
 * Content scripts MUST NOT access IndexedDB directly
 */
function isContentScriptContext() {
  try {
    if (typeof window !== "undefined" && window.location) {
      const isWebPage = window.location.protocol === "http:" || window.location.protocol === "https:";
      const isNotExtensionPage = !window.location.href.startsWith("chrome-extension://");
      
      if (isWebPage && isNotExtensionPage) {
        return true;
      }
    }
    
    // Additional check for chrome extension APIs
    if (typeof chrome !== "undefined" && chrome.runtime) {
      const hasTabsAPI = !!(chrome.tabs && chrome.tabs.query);
      if (!hasTabsAPI && typeof window !== "undefined" && 
          (window.location.protocol === "http:" || window.location.protocol === "https:")) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.warn("Error detecting content script context:", error);
    return false;
  }
}

// Content script detection (StorageService not used in content scripts)
const isInContentScript = isContentScriptContext();
if (isInContentScript) {
  console.log("🚫 STORAGE SERVICE: Content script context detected");
}

export const StorageService = {
  // Generic key-value storage using IndexedDB settings store
  async set(key, value) {
    if (isInContentScript) {
      console.warn("StorageService.set() called in content script context");
      return { status: "error", message: "Not available in content scripts" };
    }
    
    try {
      const db = await dbHelper.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(["settings"], "readwrite");
        const store = transaction.objectStore("settings");
        const request = store.put({
          id: key,
          data: value,
          lastUpdated: new Date().toISOString()
        });
        request.onsuccess = () => resolve({ status: "success" });
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("StorageService set failed:", error);
      return { status: "error", message: error.message };
    }
  },

  async get(key) {
    if (isInContentScript) {
      console.warn("StorageService.get() called in content script context");
      return null;
    }
    
    try {
      const db = await dbHelper.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(["settings"], "readonly");
        const store = transaction.objectStore("settings");
        const request = store.get(key);
        request.onsuccess = () => {
          const result = request.result;
          resolve(result ? result.data : null);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("StorageService get failed:", error);
      return null;
    }
  },

  async remove(key) {
    if (isInContentScript) {
      console.warn("StorageService.remove() called in content script context");
      return { status: "error", message: "Not available in content scripts" };
    }
    
    try {
      const db = await dbHelper.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(["settings"], "readwrite");
        const store = transaction.objectStore("settings");
        const request = store.delete(key);
        request.onsuccess = () => resolve({ status: "success" });
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("StorageService remove failed:", error);
      return { status: "error", message: error.message };
    }
  },

  // Helper function to create default settings
  _createDefaultSettings() {
    return {
      theme: "light",
      sessionLength: 'auto', // Auto mode lets algorithm decide (3-12 problems based on performance)
      limit: "off",
      reminder: { value: false, label: "6" },
      numberofNewProblemsPerSession: 2,
      adaptive: true,
      focusAreas: [], // Empty by default - system will recommend based on learning state
      systemFocusPool: null, // Stable system-generated focus pool (created on first session)
      focusAreasLastChanged: null, // Timestamp when user last changed focus areas (for session staleness detection)
      sessionsPerWeek: 5,
      reviewRatio: 40,
      timerDisplay: "mm:ss",
      breakReminders: { enabled: false, interval: 25 },
      notifications: { sound: false, browser: false, visual: true },
      accessibility: {
        screenReader: {
          enabled: false,
          verboseDescriptions: true,
          announceNavigation: true,
          readFormLabels: true
        },
        keyboard: {
          enhancedFocus: false,
          customShortcuts: false,
          focusTrapping: false
        },
        motor: {
          largerTargets: false,
          extendedHover: false,
          reducedMotion: false,
          stickyHover: false
        }
      },
      // TODO: Re-enable for future release when display settings are fully implemented
      // display: {
      //   sidebarWidth: "normal",
      //   cardSpacing: "comfortable",
      //   autoCollapseSidebar: true,
      //   chartStyle: "modern",
      //   chartColorScheme: "blue",
      //   customChartColor: "#3b82f6",
      //   chartAnimations: true,
      //   showGridLines: true,
      //   showChartLegends: true,
      //   defaultTimeRange: "30d",
      //   maxDataPoints: 50,
      //   autoRefreshData: true,
      //   showEmptyDataPoints: false
      // },
    };
  },

  // Settings using IndexedDB settings store
  async getSettings() {
    if (isInContentScript) {
      console.warn("StorageService.getSettings() called in content script context");
      return this._createDefaultSettings();
    }
    
    try {
      const db = await dbHelper.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(["settings"], "readonly");
        const store = transaction.objectStore("settings");
        const request = store.get("user_settings");
        
        request.onsuccess = async () => {
          if (request.result && request.result.data) {
            resolve(request.result.data);
          } else {
            // Create and save default settings if none exist
            const defaultSettings = this._createDefaultSettings();
            // Override some keyboard accessibility defaults
            defaultSettings.accessibility.keyboard.enhancedFocus = true;
            defaultSettings.accessibility.keyboard.skipToContent = true;
            defaultSettings.accessibility.keyboard.focusTrapping = true;

            // Auto-save defaults to persist them
            try {
              await this.setSettings(defaultSettings);
              console.log("✅ Auto-initialized user settings with defaults");
            } catch (saveError) {
              console.warn("⚠️ Failed to auto-save default settings:", saveError);
              // Still return defaults even if save fails
            }

            resolve(defaultSettings);
          }
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("StorageService getSettings failed:", error);
      return this._createDefaultSettings();
    }
  },

  async setSettings(settings) {
    if (isInContentScript) {
      console.warn("StorageService.setSettings() called in content script context");
      return { status: "error", message: "Not available in content scripts" };
    }
    
    try {
      const db = await dbHelper.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(["settings"], "readwrite");
        const store = transaction.objectStore("settings");
        const request = store.put({
          id: "user_settings",
          data: settings,
          lastUpdated: new Date().toISOString()
        });
        
        request.onsuccess = () => {
          this.clearSettingsCache();
          resolve({ status: "success" });
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("StorageService setSettings failed:", error);
      return { status: "error", message: error.message };
    }
  },

  // Clear settings cache (to be implemented by background script)
  clearSettingsCache() {
    // This will be called by the background script to clear its response cache
    // The actual cache clearing happens in the background script's cache management
    console.log("🔄 StorageService: Settings cache clear requested");
  },

  // Session State using IndexedDB session_state store
  async getSessionState(key = "session_state") {
    if (isInContentScript) {
      console.warn("StorageService.getSessionState() called in content script context");
      return null;
    }

    try {
      const db = await dbHelper.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(["session_state"], "readonly");
        const store = transaction.objectStore("session_state");
        const request = store.get(key);

        request.onsuccess = () => {
          const result = request.result;
          if (!result) {
            resolve(null);
            return;
          }

          // Detect malformed data (string spread as indexed object) and treat as null
          // Malformed data looks like: {0: '2', 1: '0', 2: '2', ..., id: 'key'}
          const keys = Object.keys(result);
          const hasNumericKeys = keys.some(k => k !== 'id' && !isNaN(k));
          if (hasNumericKeys && !Object.prototype.hasOwnProperty.call(result, 'value')) {
            console.warn(`⚠️ Detected malformed data for key "${key}", returning null`);
            resolve(null);
            return;
          }

          // Handle primitives stored in value property
          if (Object.prototype.hasOwnProperty.call(result, 'value') && Object.keys(result).length === 2 && result.id === key) {
            resolve(result.value);
          } else {
            // Return full object for complex data
            resolve(result);
          }
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("StorageService getSessionState failed:", error);
      return null;
    }
  },

  async setSessionState(key = "session_state", data) {
    if (isInContentScript) {
      console.warn("StorageService.setSessionState() called in content script context");
      return { status: "error", message: "Not available in content scripts" };
    }

    try {
      const db = await dbHelper.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(["session_state"], "readwrite");
        const store = transaction.objectStore("session_state");
        // Handle both object and primitive values correctly
        const record = typeof data === 'object' && data !== null && !Array.isArray(data)
          ? { ...data, id: key }  // Spread object data
          : { id: key, value: data };  // Wrap primitives in value property
        const request = store.put(record);

        request.onsuccess = () => resolve({ status: "success" });
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("StorageService setSessionState failed:", error);
      return { status: "error", message: error.message };
    }
  },

  // Migration helper - moves settings from Chrome storage to IndexedDB
  async migrateSettingsToIndexedDB() {
    try {
      // Check if settings already exist in IndexedDB
      const existingSettings = await this.getSettings();

      // If we got default settings, try to migrate from Chrome storage
      if (
        existingSettings.theme === "light" &&
        (existingSettings.sessionLength === 'auto' || existingSettings.sessionLength === 5)
      ) {
        const chromeSettings = await new Promise((resolve) => {
          chrome.storage.local.get(["settings"], (result) => {
            resolve(result.settings || null);
          });
        });

        if (chromeSettings) {
          console.log(
            "🔄 Migrating settings from Chrome storage to IndexedDB:",
            chromeSettings
          );
          await this.setSettings(chromeSettings);

          // Remove from Chrome storage after successful migration
          chrome.storage.local.remove(["settings"]);

          return chromeSettings;
        }
      }

      return existingSettings;
    } catch (error) {
      console.error("❌ Error migrating settings:", error);
      return await this.getSettings(); // Return defaults on error
    }
  },

  // Migration helper - moves session state from Chrome storage to IndexedDB
  async migrateSessionStateToIndexedDB() {
    try {
      // Check if session state already exists in IndexedDB
      const existingSessionState = await this.getSessionState("session_state");

      if (!existingSessionState) {
        const chromeSessionState = await new Promise((resolve) => {
          chrome.storage.local.get(["session_state"], (result) => {
            resolve(result.session_state || null);
          });
        });

        if (chromeSessionState) {
          console.log(
            "🔄 Migrating session state from Chrome storage to IndexedDB:",
            chromeSessionState
          );
          await this.setSessionState("session_state", chromeSessionState);

          // Remove from Chrome storage after successful migration
          chrome.storage.local.remove(["session_state"]);

          return chromeSessionState;
        }
      }

      return existingSessionState;
    } catch (error) {
      console.error("❌ Error migrating session state:", error);
      return null;
    }
  },

};