export const StorageService = {
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

  async getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["settings"], (result) => {
        if (!result.settings) {
          const defaultSettings = {
            theme: "light",
            sessionLength: 5,
            limit: "off",
            reminder: { value: false, label: "6" },
            numberofNewProblemsPerSession: 2,
          };
          chrome.storage.local.set({ settings: defaultSettings });
          resolve(defaultSettings);
        } else {
          resolve(result.settings);
        }
      });
    });
  },

  async setSettings(settings) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ settings }, () =>
        resolve({ status: "success" })
      );
    });
  },
};
