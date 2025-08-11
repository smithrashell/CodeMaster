import { createContext, useContext, useState, useEffect } from "react";
import { MantineProvider, createTheme } from "@mantine/core";

const ThemeContext = createContext();
export const useTheme = () => useContext(ThemeContext);

// Create custom Mantine theme that uses CSS variables
const customTheme = createTheme({
  colors: {
    // Define custom colors that will use CSS variables
    brand: [
      "var(--cm-bg)",
      "var(--cm-bg)",
      "var(--cm-bg)",
      "var(--cm-bg)",
      "var(--cm-bg)",
      "var(--cm-bg)",
      "var(--cm-bg)",
      "var(--cm-bg)",
      "var(--cm-bg)",
      "var(--cm-bg)",
    ],
  },
  components: {
    Card: {
      styles: () => ({
        root: {
          backgroundColor: "var(--cm-card-bg)",
          borderColor: "var(--cm-border)",
          boxShadow: `0 1px 3px var(--cm-card-shadow)`,
        },
      }),
    },
    Container: {
      styles: () => ({
        root: {
          backgroundColor: "var(--cm-bg)",
          color: "var(--cm-text)",
        },
      }),
    },
    Text: {
      styles: () => ({
        root: {
          color: "var(--cm-text)",
        },
      }),
    },
    Title: {
      styles: () => ({
        root: {
          color: "var(--cm-text)",
        },
      }),
    },
  },
});

// Default theme settings
const DEFAULT_THEME_SETTINGS = {
  colorScheme: "light",
  fontSize: "medium",
  layoutDensity: "comfortable",
  animationsEnabled: true,
};

// Storage keys
const STORAGE_KEYS = {
  THEME_SETTINGS: "cm-theme-settings",
};

function ThemeProviderWrapper({ children }) {
  const [colorScheme, setColorScheme] = useState(
    DEFAULT_THEME_SETTINGS.colorScheme
  );
  const [fontSize, setFontSize] = useState(DEFAULT_THEME_SETTINGS.fontSize);
  const [layoutDensity, setLayoutDensity] = useState(
    DEFAULT_THEME_SETTINGS.layoutDensity
  );
  const [animationsEnabled, setAnimationsEnabled] = useState(
    DEFAULT_THEME_SETTINGS.animationsEnabled
  );
  const [isInitialized, setIsInitialized] = useState(false);

  // Load theme settings from storage on initialization
  useEffect(() => {
    const loadThemeSettings = () => {
      try {
        let settings = DEFAULT_THEME_SETTINGS;

        // Use Chrome storage in extension mode, localStorage as fallback
        if (typeof chrome !== "undefined" && chrome.runtime) {
          chrome.runtime.sendMessage({ type: "getSettings" }, (response) => {
            if (!chrome.runtime.lastError && response) {
              settings = {
                ...DEFAULT_THEME_SETTINGS,
                colorScheme:
                  response.theme || DEFAULT_THEME_SETTINGS.colorScheme,
                fontSize: response.fontSize || DEFAULT_THEME_SETTINGS.fontSize,
                layoutDensity:
                  response.layoutDensity ||
                  DEFAULT_THEME_SETTINGS.layoutDensity,
                animationsEnabled:
                  response.animationsEnabled !== undefined
                    ? response.animationsEnabled
                    : DEFAULT_THEME_SETTINGS.animationsEnabled,
              };
              applySettings(settings);
            } else {
              // Fallback to localStorage if Chrome extension not available
              const stored = localStorage.getItem(STORAGE_KEYS.THEME_SETTINGS);
              if (stored) {
                settings = { ...DEFAULT_THEME_SETTINGS, ...JSON.parse(stored) };
              }
              applySettings(settings);
            }
          });
        } else {
          // Use localStorage when Chrome extension not available
          const stored = localStorage.getItem(STORAGE_KEYS.THEME_SETTINGS);
          if (stored) {
            settings = { ...DEFAULT_THEME_SETTINGS, ...JSON.parse(stored) };
          }
          applySettings(settings);
        }
      } catch (error) {
        console.error("Error loading theme settings:", error);
        applySettings(DEFAULT_THEME_SETTINGS);
      }
    };

    loadThemeSettings();
  }, []);

  // Apply settings to state and DOM
  const applySettings = (settings) => {
    setColorScheme(settings.colorScheme);
    setFontSize(settings.fontSize);
    setLayoutDensity(settings.layoutDensity);
    setAnimationsEnabled(settings.animationsEnabled);
    setIsInitialized(true);
  };

  // Save settings to storage
  const saveSettings = (newSettings) => {
    const settings = {
      colorScheme,
      fontSize,
      layoutDensity,
      animationsEnabled,
      ...newSettings,
    };

    // Save to Chrome storage in extension mode, localStorage as fallback
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({ type: "getSettings" }, (response) => {
        if (!chrome.runtime.lastError) {
          const updatedSettings = {
            ...response,
            theme: settings.colorScheme,
            fontSize: settings.fontSize,
            layoutDensity: settings.layoutDensity,
            animationsEnabled: settings.animationsEnabled,
          };
          chrome.runtime.sendMessage({
            type: "setSettings",
            message: updatedSettings,
          });
        } else {
          // Fallback to localStorage if Chrome extension fails
          localStorage.setItem(
            STORAGE_KEYS.THEME_SETTINGS,
            JSON.stringify(settings)
          );
        }
      });
    } else {
      // Use localStorage when Chrome extension not available
      localStorage.setItem(
        STORAGE_KEYS.THEME_SETTINGS,
        JSON.stringify(settings)
      );
    }
  };

  const toggleColorScheme = (value) => {
    const newScheme = value || (colorScheme === "light" ? "dark" : "light");
    setColorScheme(newScheme);
    saveSettings({ colorScheme: newScheme });
  };

  const updateFontSize = (newFontSize) => {
    setFontSize(newFontSize);
    saveSettings({ fontSize: newFontSize });
  };

  const updateLayoutDensity = (newDensity) => {
    setLayoutDensity(newDensity);
    saveSettings({ layoutDensity: newDensity });
  };

  const updateAnimationsEnabled = (enabled) => {
    setAnimationsEnabled(enabled);
    saveSettings({ animationsEnabled: enabled });
  };

  // Apply theme to DOM
  useEffect(() => {
    if (isInitialized) {
      document.body.setAttribute("data-theme", colorScheme);
      document.body.setAttribute("data-font-size", fontSize);
      document.body.setAttribute("data-layout-density", layoutDensity);
      document.body.setAttribute(
        "data-animations",
        animationsEnabled ? "enabled" : "disabled"
      );
    }
  }, [colorScheme, fontSize, layoutDensity, animationsEnabled, isInitialized]);

  // Listen for Chrome storage changes for real-time sync
  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      const handleStorageChange = (changes, areaName) => {
        if (areaName === "local" && changes.settings) {
          const newSettings = changes.settings.newValue;
          if (newSettings) {
            applySettings({
              colorScheme:
                newSettings.theme || DEFAULT_THEME_SETTINGS.colorScheme,
              fontSize: newSettings.fontSize || DEFAULT_THEME_SETTINGS.fontSize,
              layoutDensity:
                newSettings.layoutDensity ||
                DEFAULT_THEME_SETTINGS.layoutDensity,
              animationsEnabled:
                newSettings.animationsEnabled !== undefined
                  ? newSettings.animationsEnabled
                  : DEFAULT_THEME_SETTINGS.animationsEnabled,
            });
          }
        }
      };

      chrome.storage.onChanged.addListener(handleStorageChange);

      return () => {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      };
    }
  }, []);

  const contextValue = {
    colorScheme,
    fontSize,
    layoutDensity,
    animationsEnabled,
    toggleColorScheme,
    setFontSize: updateFontSize,
    setLayoutDensity: updateLayoutDensity,
    setAnimationsEnabled: updateAnimationsEnabled,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      <MantineProvider theme={customTheme} defaultColorScheme={colorScheme}>
        {children}
      </MantineProvider>
    </ThemeContext.Provider>
  );
}

export default ThemeProviderWrapper;
