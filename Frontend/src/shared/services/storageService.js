import { dbHelper } from "../db/index.js";
import ResilientStorage from "./ResilientStorage.js";

const openDB = dbHelper.openDB;

// Initialize ResilientStorage on first import
ResilientStorage.initialize().catch(error => {
  console.warn('ResilientStorage initialization failed:', error);
});

export const StorageService = {
  // Generic key-value storage - now uses ResilientStorage for better reliability
  async set(key, value) {
    try {
      await ResilientStorage.set(key, value, ResilientStorage.DATA_TYPE.CRITICAL);
      return { status: "success" };
    } catch (error) {
      console.error('StorageService set failed:', error);
      // Fallback to direct Chrome storage
      return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, () =>
          resolve({ status: "success" })
        );
      });
    }
  },

  async get(key) {
    try {
      const value = await ResilientStorage.get(key, ResilientStorage.DATA_TYPE.CRITICAL);
      return value;
    } catch (error) {
      console.error('StorageService get failed:', error);
      // Fallback to direct Chrome storage
      return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => resolve(result[key] || null));
      });
    }
  },

  async remove(key) {
    try {
      await ResilientStorage.remove(key, ResilientStorage.DATA_TYPE.CRITICAL);
      return { status: "success" };
    } catch (error) {
      console.error('StorageService remove failed:', error);
      // Fallback to direct Chrome storage
      return new Promise((resolve) => {
        chrome.storage.local.remove(key, () => resolve({ status: "success" }));
      });
    }
  },

  // Settings - now uses ResilientStorage with IndexedDB primary and Chrome Storage fallback
  async getSettings() {
    try {
      const settings = await ResilientStorage.get("user_settings", ResilientStorage.DATA_TYPE.CRITICAL);
      if (settings && settings.data) {
        return settings.data;
      }
      
      // Return default settings if none exist
      const defaultSettings = {
        theme: "light",
        sessionLength: 5,
        limit: "off",
        reminder: { value: false, label: "6" },
        numberofNewProblemsPerSession: 2,
        adaptive: true,
      };
      return defaultSettings;
    } catch (error) {
      console.error('Failed to get settings via ResilientStorage, falling back to direct IndexedDB:', error);
      
      // Fallback to direct IndexedDB access
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction("settings", "readonly");
        const store = transaction.objectStore("settings");

        const request = store.get("user_settings");
        request.onsuccess = () => {
          if (request.result) {
            resolve(request.result.data);
          } else {
            // Return default settings if none exist
            const defaultSettings = {
              theme: "light",
              sessionLength: 5,
              limit: "off",
              reminder: { value: false, label: "6" },
              numberofNewProblemsPerSession: 2,
              adaptive: true,
            };
            resolve(defaultSettings);
          }
        };
        request.onerror = () => reject(request.error);
      });
    }
  },

  async setSettings(settings) {
    try {
      const settingsObject = {
        id: "user_settings",
        data: settings,
        lastUpdated: new Date().toISOString(),
      };
      
      await ResilientStorage.set("user_settings", settingsObject, ResilientStorage.DATA_TYPE.CRITICAL);
      
      // Clear any cached settings in other services
      this.clearSettingsCache();
      
      return { status: "success" };
    } catch (error) {
      console.error('Failed to set settings via ResilientStorage, falling back to direct IndexedDB:', error);
      
      // Fallback to direct IndexedDB access
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction("settings", "readwrite");
        const store = transaction.objectStore("settings");

        const settingsObject = {
          id: "user_settings",
          data: settings,
          lastUpdated: new Date().toISOString(),
        };

        const request = store.put(settingsObject);
        request.onsuccess = () => {
          // Clear any cached settings in other services
          this.clearSettingsCache();
          resolve({ status: "success" });
        };
        request.onerror = () => reject(request.error);
      });
    }
  },

  // Session State - now uses ResilientStorage for better reliability
  async getSessionState(key = "session_state") {
    try {
      const sessionState = await ResilientStorage.get(key, ResilientStorage.DATA_TYPE.CRITICAL);
      return sessionState;
    } catch (error) {
      console.error('Failed to get session state via ResilientStorage, falling back to direct IndexedDB:', error);
      
      // Fallback to direct IndexedDB access
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction("session_state", "readonly");
        const store = transaction.objectStore("session_state");

        const request = store.get(key);
        request.onsuccess = () => {
          resolve(request.result || null);
        };
        request.onerror = () => reject(request.error);
      });
    }
  },

  async setSessionState(key = "session_state", data) {
    try {
      const sessionStateObject = { id: key, ...data };
      await ResilientStorage.set(key, sessionStateObject, ResilientStorage.DATA_TYPE.CRITICAL);
      return { status: "success" };
    } catch (error) {
      console.error('Failed to set session state via ResilientStorage, falling back to direct IndexedDB:', error);
      
      // Fallback to direct IndexedDB access
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction("session_state", "readwrite");
        const store = transaction.objectStore("session_state");

        const request = store.put({ id: key, ...data });
        request.onsuccess = () => resolve({ status: "success" });
        request.onerror = () => reject(request.error);
      });
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
        existingSettings.sessionLength === 5
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

          // Optionally remove from Chrome storage after successful migration
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
      const existingSessionState = await this.getSessionState();

      if (!existingSessionState) {
        // Try to get from Chrome storage
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

  // New ResilientStorage Integration Methods
  
  /**
   * Get storage system status and health
   */
  async getStorageStatus() {
    try {
      return await ResilientStorage.getStorageStatus();
    } catch (error) {
      console.error('Failed to get storage status:', error);
      return {
        mode: 'unknown',
        health: { overall: 'unavailable' },
        isIndexedDBAvailable: false,
        isChromeStorageAvailable: false,
        quotaWarning: false
      };
    }
  },

  /**
   * Force switch to Chrome Storage fallback mode
   */
  async switchToFallbackMode() {
    try {
      await ResilientStorage.switchToFallbackMode();
      return { status: "success", mode: "chrome_fallback" };
    } catch (error) {
      console.error('Failed to switch to fallback mode:', error);
      return { status: "error", error: error.message };
    }
  },

  /**
   * Switch back to IndexedDB primary mode
   */
  async switchToPrimaryMode() {
    try {
      await ResilientStorage.switchToPrimaryMode();
      return { status: "success", mode: "indexeddb_primary" };
    } catch (error) {
      console.error('Failed to switch to primary mode:', error);
      return { status: "error", error: error.message };
    }
  },

  /**
   * Perform health check on storage systems
   */
  async performHealthCheck() {
    try {
      return await ResilientStorage.performHealthCheck();
    } catch (error) {
      console.error('Storage health check failed:', error);
      return {
        indexedDB: { available: false, status: 'unavailable' },
        chromeStorage: { available: false, status: 'unavailable' },
        overall: 'unavailable'
      };
    }
  },

  /**
   * Create emergency backup to Chrome Storage
   */
  async createEmergencyBackup() {
    try {
      await ResilientStorage.createEmergencyBackup();
      return { status: "success" };
    } catch (error) {
      console.error('Emergency backup failed:', error);
      return { status: "error", error: error.message };
    }
  },

  /**
   * Sync critical data to fallback storage
   */
  async syncToFallback(options = {}) {
    try {
      const result = await ResilientStorage.syncToFallback(options);
      return { status: "success", result };
    } catch (error) {
      console.error('Sync to fallback failed:', error);
      return { status: "error", error: error.message };
    }
  },

  /**
   * Restore data from fallback storage
   */
  async restoreFromFallback(options = {}) {
    try {
      const result = await ResilientStorage.restoreFromFallback(options);
      return { status: "success", result };
    } catch (error) {
      console.error('Restore from fallback failed:', error);
      return { status: "error", error: error.message };
    }
  },

  /**
   * Get storage system information for debugging
   */
  getStorageInfo() {
    return {
      resilientStorageEnabled: true,
      currentMode: ResilientStorage.currentMode || 'unknown',
      version: '1.0',
      features: [
        'dual_storage_strategy',
        'automatic_fallback',
        'health_monitoring',
        'data_synchronization',
        'quota_management'
      ]
    };
  },

  /**
   * Clear cached settings in dependent services
   */
  clearSettingsCache() {
    try {
      // Clear AdaptiveLimitsService cache
      if (typeof window !== 'undefined' && window.adaptiveLimitsService) {
        window.adaptiveLimitsService.clearCache();
      }
      
      // Try to clear cache via dynamic import to avoid circular dependencies
      import('./adaptiveLimitsService.js').then(({ adaptiveLimitsService }) => {
        if (adaptiveLimitsService && typeof adaptiveLimitsService.clearCache === 'function') {
          adaptiveLimitsService.clearCache();
          console.log('✅ Cleared AdaptiveLimitsService cache');
        }
      }).catch(error => {
        console.warn('Could not clear AdaptiveLimitsService cache:', error);
      });
      
    } catch (error) {
      console.warn('Error clearing settings cache:', error);
    }
  }
};
