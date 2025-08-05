import { dbHelper } from "../db/index.js";

const openDB = dbHelper.openDB;

export const StorageService = {
  // Generic key-value storage - still uses Chrome storage for session state and temporary data
  async set(key, value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () =>
        resolve({ status: "success" })
      );
    });
  },

  async get(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => resolve(result[key] || null));
    });
  },

  async remove(key) {
    return new Promise((resolve) => {
      chrome.storage.local.remove(key, () => resolve({ status: "success" }));
    });
  },

  // Settings - now uses IndexedDB
  async getSettings() {
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
  },

  async setSettings(settings) {
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
      request.onsuccess = () => resolve({ status: "success" });
      request.onerror = () => reject(request.error);
    });
  },

  // Session State - uses dedicated session_state IndexedDB store
  async getSessionState(key = "session_state") {
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
  },

  async setSessionState(key = "session_state", data) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("session_state", "readwrite");
      const store = transaction.objectStore("session_state");

      const request = store.put({ id: key, ...data });
      request.onsuccess = () => resolve({ status: "success" });
      request.onerror = () => reject(request.error);
    });
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
};
