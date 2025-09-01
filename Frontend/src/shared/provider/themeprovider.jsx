import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
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

// Get initial theme - just return default, let Chrome storage be authoritative
const getInitialTheme = () => {
  const initialTheme = DEFAULT_THEME_SETTINGS.colorScheme;
  console.log("🎨 DEBUG: getInitialTheme() returning:", initialTheme);
  return initialTheme;
};

// Helper function to load settings from Chrome storage
const loadChromeSettings = (applySettings, loadFromLocalStorage) => {
  console.log("🎨 DEBUG: Sending getSettings message to background script");
  chrome.runtime.sendMessage({ type: "getSettings" }, (response) => {
    console.log("🎨 DEBUG: Chrome storage response:", response, "error:", chrome.runtime.lastError);
    if (!chrome.runtime.lastError && response) {
      const chromeSettings = {
        ...DEFAULT_THEME_SETTINGS,
        colorScheme: response.theme || DEFAULT_THEME_SETTINGS.colorScheme,
        fontSize: response.fontSize || DEFAULT_THEME_SETTINGS.fontSize,
        layoutDensity: response.layoutDensity || DEFAULT_THEME_SETTINGS.layoutDensity,
        animationsEnabled: response.animationsEnabled !== undefined 
          ? response.animationsEnabled 
          : DEFAULT_THEME_SETTINGS.animationsEnabled,
      };
      console.log("🎨 DEBUG: Parsed Chrome settings:", chromeSettings);
      applySettings(chromeSettings);
    } else {
      loadFromLocalStorage();
    }
  });
};

// Helper function to save Chrome settings
const saveChromeSettings = (settings) => {
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
      }, (_response) => {
        if (chrome.runtime.lastError) {
          console.warn("Theme settings save failed:", chrome.runtime.lastError.message);
        }
      });
    } else {
      localStorage.setItem(STORAGE_KEYS.THEME_SETTINGS, JSON.stringify(settings));
    }
  });
};

// Helper function to handle storage changes
const createStorageChangeHandler = (applySettings) => {
  return (changes, areaName) => {
    if (areaName === "local" && changes.settings) {
      const newSettings = changes.settings.newValue;
      if (newSettings) {
        applySettings({
          colorScheme: newSettings.theme || DEFAULT_THEME_SETTINGS.colorScheme,
          fontSize: newSettings.fontSize || DEFAULT_THEME_SETTINGS.fontSize,
          layoutDensity: newSettings.layoutDensity || DEFAULT_THEME_SETTINGS.layoutDensity,
          animationsEnabled: newSettings.animationsEnabled !== undefined
            ? newSettings.animationsEnabled
            : DEFAULT_THEME_SETTINGS.animationsEnabled,
        });
      }
    }
  };
};


function ThemeProviderWrapper({ children }) {
  console.log("🎨 ThemeProviderWrapper RENDER", new Date().toISOString());
  
  const [colorScheme, setColorScheme] = useState(getInitialTheme());
  console.log("🎨 DEBUG: Current colorScheme in render:", colorScheme);
  const [fontSize, setFontSize] = useState(DEFAULT_THEME_SETTINGS.fontSize);
  const [layoutDensity, setLayoutDensity] = useState(
    DEFAULT_THEME_SETTINGS.layoutDensity
  );
  const [animationsEnabled, setAnimationsEnabled] = useState(
    DEFAULT_THEME_SETTINGS.animationsEnabled
  );
  const [_isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Log provider lifecycle
  React.useEffect(() => {
    console.log("🏗️ ThemeProviderWrapper MOUNTED");
    return () => {
      console.log("🗑️ ThemeProviderWrapper UNMOUNTED");
    };
  }, []);

  // Helper function to handle localStorage theme loading
  const loadFromLocalStorage = useCallback(() => {
    if (typeof localStorage === "undefined") {
      setIsInitialized(true);
      setIsLoading(false);
      return;
    }

    const stored = localStorage.getItem(STORAGE_KEYS.THEME_SETTINGS);
    if (stored) {
      const parsedSettings = JSON.parse(stored);
      const fallbackSettings = { ...DEFAULT_THEME_SETTINGS, ...parsedSettings };
      applySettings(fallbackSettings);
    } else {
      setIsInitialized(true);
      setIsLoading(false);
    }
  }, [applySettings]);

  // Load theme settings from Chrome storage as single source of truth
  useEffect(() => {
    console.log("🎨 DEBUG: Chrome storage loading useEffect started");
    const loadThemeSettings = () => {
      try {
        if (typeof chrome !== "undefined" && chrome.runtime) {
          loadChromeSettings(applySettings, loadFromLocalStorage);
        } else {
          try {
            loadFromLocalStorage();
          } catch (error) {
            setIsInitialized(true);
            setIsLoading(false);
          }
        }
      } catch (error) {
        console.error("🎨 Error loading theme settings:", error);
        setIsInitialized(true);
        setIsLoading(false);
      }
    };

    loadThemeSettings();
  }, [applySettings, loadFromLocalStorage]);

  // Apply settings to state and DOM
  const applySettings = useCallback((settings) => {
    console.log("🎨 DEBUG: applySettings called with:", settings);
    console.log("🎨 DEBUG: Current colorScheme before apply:", colorScheme);
    setColorScheme(settings.colorScheme);
    setFontSize(settings.fontSize);
    setLayoutDensity(settings.layoutDensity);
    setAnimationsEnabled(settings.animationsEnabled);
    setIsInitialized(true);
    setIsLoading(false);
    console.log("🎨 DEBUG: applySettings completed, state should update to:", settings.colorScheme);
  }, [setColorScheme, setFontSize, setLayoutDensity, setAnimationsEnabled, setIsInitialized, setIsLoading, colorScheme]);

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
      saveChromeSettings(settings);
    } else {
      localStorage.setItem(STORAGE_KEYS.THEME_SETTINGS, JSON.stringify(settings));
    }
  };

  const toggleColorScheme = useCallback((value) => {
    const newScheme = value || (colorScheme === "light" ? "dark" : "light");
    setColorScheme(newScheme);
    saveSettings({ colorScheme: newScheme });
  }, [colorScheme, saveSettings]);

  const updateFontSize = useCallback((newFontSize) => {
    setFontSize(newFontSize);
    saveSettings({ fontSize: newFontSize });
  }, [saveSettings]);

  const updateLayoutDensity = useCallback((newDensity) => {
    setLayoutDensity(newDensity);
    saveSettings({ layoutDensity: newDensity });
  }, [saveSettings]);

  const updateAnimationsEnabled = useCallback((enabled) => {
    setAnimationsEnabled(enabled);
    saveSettings({ animationsEnabled: enabled });
  }, [saveSettings]);

  // Apply theme to DOM immediately to prevent flash
  React.useLayoutEffect(() => {
    console.log("🎨 DEBUG: useLayoutEffect applying theme to DOM:", colorScheme);
    document.body.setAttribute("data-theme", colorScheme);
    document.body.setAttribute("data-font-size", fontSize);
    document.body.setAttribute("data-layout-density", layoutDensity);
    document.body.setAttribute(
      "data-animations",
      animationsEnabled ? "enabled" : "disabled"
    );
    console.log("🎨 DEBUG: DOM attributes applied, data-theme now:", document.body.getAttribute("data-theme"));
  }, [colorScheme, fontSize, layoutDensity, animationsEnabled]);

  // Listen for Chrome storage changes for real-time sync
  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      const handleStorageChange = createStorageChangeHandler(applySettings);
      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      };
    }
  }, [applySettings]);

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
      <MantineProvider theme={customTheme} defaultColorScheme="auto" forceColorScheme={colorScheme}>
        {isLoading ? null : children}
      </MantineProvider>
    </ThemeContext.Provider>
  );
}

export default ThemeProviderWrapper;
