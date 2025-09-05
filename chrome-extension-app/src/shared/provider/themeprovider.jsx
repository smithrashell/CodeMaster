import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { MantineProvider, createTheme } from "@mantine/core";
import { useChromeMessage, clearChromeMessageCache } from "../hooks/useChromeMessage";

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

// Helper function to process settings from Chrome storage response
const processSettings = (response) => {
  return {
    ...DEFAULT_THEME_SETTINGS,
    colorScheme: response?.theme || DEFAULT_THEME_SETTINGS.colorScheme,
    fontSize: response?.fontSize || DEFAULT_THEME_SETTINGS.fontSize,
    layoutDensity: response?.layoutDensity || DEFAULT_THEME_SETTINGS.layoutDensity,
    animationsEnabled: response?.animationsEnabled !== undefined 
      ? response.animationsEnabled 
      : DEFAULT_THEME_SETTINGS.animationsEnabled,
  };
};

// Helper function to save Chrome settings
const saveChromeSettings = async (settings, currentChromeSettings) => {
  try {
    // Use provided current settings or fetch if not available
    let baseSettings = currentChromeSettings || {};
    
    if (!currentChromeSettings) {
      // Fallback to direct Chrome messaging if current settings not available
      baseSettings = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "getSettings" }, (response) => {
          resolve(response || {});
        });
      });
    }

    const updatedSettings = {
      ...baseSettings,
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
      } else {
        // Clear cache after successful save
        clearChromeMessageCache("getSettings");
      }
    });
  } catch (error) {
    console.error("Failed to save Chrome settings:", error);
    // Fallback to localStorage
    localStorage.setItem(STORAGE_KEYS.THEME_SETTINGS, JSON.stringify(settings));
  }
};

// Helper function to handle storage changes
const createStorageChangeHandler = (applySettings) => {
  return (changes, areaName) => {
    if (areaName === "local" && changes.settings) {
      const newSettings = changes.settings.newValue;
      if (newSettings) {
        applySettings(processSettings(newSettings));
      }
    }
  };
};

// Helper function to apply theme to DOM
const useDOMThemeApplier = (colorScheme, fontSize, layoutDensity, animationsEnabled) => {
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
};

// Helper function to listen for Chrome storage changes
const useStorageListener = (applySettings) => {
  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      const handleStorageChange = createStorageChangeHandler(applySettings);
      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      };
    }
  }, [applySettings]);
};

// Helper function to create settings update callbacks
const createSettingsUpdateCallbacks = (settings, setters, saveSettings) => {
  const { colorScheme } = settings;
  const { setColorScheme, setFontSize, setLayoutDensity, setAnimationsEnabled } = setters;
  
  return {
  toggleColorScheme: (value) => {
    const newScheme = value || (colorScheme === "light" ? "dark" : "light");
    setColorScheme(newScheme);
    saveSettings({ colorScheme: newScheme });
  },
  updateFontSize: (newFontSize) => {
    setFontSize(newFontSize);
    saveSettings({ fontSize: newFontSize });
  },
  updateLayoutDensity: (newDensity) => {
    setLayoutDensity(newDensity);
    saveSettings({ layoutDensity: newDensity });
  },
  updateAnimationsEnabled: (enabled) => {
    setAnimationsEnabled(enabled);
    saveSettings({ animationsEnabled: enabled });
  }
  };
};

// Helper function to create context value
const createContextValue = (colorScheme, fontSize, layoutDensity, animationsEnabled, callbacks) => ({
  colorScheme,
  fontSize,
  layoutDensity,
  animationsEnabled,
  toggleColorScheme: callbacks.toggleColorScheme,
  setFontSize: callbacks.updateFontSize,
  setLayoutDensity: callbacks.updateLayoutDensity,
  setAnimationsEnabled: callbacks.updateAnimationsEnabled,
});



function ThemeProviderWrapper({ children }) {
  console.log("🎨 ThemeProviderWrapper RENDER", new Date().toISOString());
  
  const [colorScheme, setColorScheme] = useState(getInitialTheme());
  console.log("🎨 DEBUG: Current colorScheme in render:", colorScheme);
  const [fontSize, setFontSize] = useState(DEFAULT_THEME_SETTINGS.fontSize);
  const [layoutDensity, setLayoutDensity] = useState(DEFAULT_THEME_SETTINGS.layoutDensity);
  const [animationsEnabled, setAnimationsEnabled] = useState(DEFAULT_THEME_SETTINGS.animationsEnabled);
  const [_isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Log provider lifecycle
  React.useEffect(() => {
    console.log("🏗️ ThemeProviderWrapper MOUNTED");
    return () => {
      console.log("🗑️ ThemeProviderWrapper UNMOUNTED");
    };
  }, []);

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

  // Use Chrome message hook to load settings
  const { 
    data: chromeSettings, 
    loading: chromeLoading, 
    error: chromeError 
  } = useChromeMessage(
    { type: "getSettings" },
    [],
    { 
      showNotifications: false,
      onSuccess: (response) => {
        if (response) {
          console.log("🎨 DEBUG: Chrome storage response:", response);
          const processed = processSettings(response);
          console.log("🎨 DEBUG: Processed Chrome settings:", processed);
          applySettings(processed);
        }
      }
    }
  );

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

  // Save settings to storage
  const saveSettings = useCallback((newSettings) => {
    const settings = { colorScheme, fontSize, layoutDensity, animationsEnabled, ...newSettings };
    if (typeof chrome !== "undefined" && chrome.runtime) {
      saveChromeSettings(settings, chromeSettings);
    } else {
      localStorage.setItem(STORAGE_KEYS.THEME_SETTINGS, JSON.stringify(settings));
    }
  }, [colorScheme, fontSize, layoutDensity, animationsEnabled, chromeSettings]);

  // Settings update callbacks
  const callbacks = useMemo(() => 
    createSettingsUpdateCallbacks(
      { colorScheme, fontSize, layoutDensity, animationsEnabled },
      { setColorScheme, setFontSize, setLayoutDensity, setAnimationsEnabled },
      saveSettings
    ), [colorScheme, fontSize, layoutDensity, animationsEnabled, saveSettings]);

  // Use callbacks directly in context value

  // Handle fallback to localStorage if Chrome messaging fails
  useEffect(() => {
    if (chromeError && !chromeLoading) {
      console.log("🎨 DEBUG: Chrome messaging failed, falling back to localStorage");
      loadFromLocalStorage();
    }
  }, [chromeError, chromeLoading, loadFromLocalStorage]);

  // Use helper hooks for side effects
  useDOMThemeApplier(colorScheme, fontSize, layoutDensity, animationsEnabled);
  useStorageListener(applySettings);

  const contextValue = useMemo(() =>
    createContextValue(colorScheme, fontSize, layoutDensity, animationsEnabled, callbacks),
    [colorScheme, fontSize, layoutDensity, animationsEnabled, callbacks]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      <MantineProvider theme={customTheme} defaultColorScheme="auto" forceColorScheme={colorScheme}>
        {isLoading ? null : children}
      </MantineProvider>
    </ThemeContext.Provider>
  );
}

export default ThemeProviderWrapper;
