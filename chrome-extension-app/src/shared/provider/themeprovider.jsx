import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { MantineProvider, createTheme } from "@mantine/core";
import { useChromeMessage, clearChromeMessageCache } from "../hooks/useChromeMessage";
import { getExecutionContext } from "../db/accessControl.js";

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
  return DEFAULT_THEME_SETTINGS.colorScheme;
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
    document.body.setAttribute("data-theme", colorScheme);
    document.body.setAttribute("data-font-size", fontSize);
    document.body.setAttribute("data-layout-density", layoutDensity);
    document.body.setAttribute(
      "data-animations",
      animationsEnabled ? "enabled" : "disabled"
    );
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

// Helper function for Chrome settings hook configuration
const createChromeSettingsHook = (applySettings) => ({
  type: "getSettings",
  deps: [],
  options: { 
    showNotifications: false,
    onSuccess: (response) => {
      if (response) {
        const processed = processSettings(response);
        applySettings(processed);
      }
    }
  }
});

// Helper function to manage theme state
const useThemeState = () => {
  const [colorScheme, setColorScheme] = useState(getInitialTheme());
  const [fontSize, setFontSize] = useState(DEFAULT_THEME_SETTINGS.fontSize);
  const [layoutDensity, setLayoutDensity] = useState(DEFAULT_THEME_SETTINGS.layoutDensity);
  const [animationsEnabled, setAnimationsEnabled] = useState(DEFAULT_THEME_SETTINGS.animationsEnabled);
  const [_isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  return {
    colorScheme, setColorScheme,
    fontSize, setFontSize,
    layoutDensity, setLayoutDensity,
    animationsEnabled, setAnimationsEnabled,
    _isInitialized, setIsInitialized,
    isLoading, setIsLoading
  };
};

function ThemeProviderWrapper({ children }) {
  const {
    colorScheme, setColorScheme,
    fontSize, setFontSize,
    layoutDensity, setLayoutDensity,
    animationsEnabled, setAnimationsEnabled,
    _isInitialized, setIsInitialized,
    isLoading, setIsLoading
  } = useThemeState();

  // Apply settings to state and DOM
  const applySettings = useCallback((settings) => {
    setColorScheme(settings.colorScheme);
    setFontSize(settings.fontSize);
    setLayoutDensity(settings.layoutDensity);
    setAnimationsEnabled(settings.animationsEnabled);
    setIsInitialized(true);
    setIsLoading(false);
  }, [setColorScheme, setFontSize, setLayoutDensity, setAnimationsEnabled, setIsInitialized, setIsLoading]);

  // Use Chrome message hook to load settings
  const hookConfig = createChromeSettingsHook(applySettings);
  const { 
    data: chromeSettings, 
    loading: chromeLoading, 
    error: chromeError 
  } = useChromeMessage({ type: hookConfig.type }, hookConfig.deps, hookConfig.options);

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
  }, [applySettings, setIsInitialized, setIsLoading]);

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
    ), [colorScheme, fontSize, layoutDensity, animationsEnabled, saveSettings, setColorScheme, setFontSize, setLayoutDensity, setAnimationsEnabled]);

  // Use callbacks directly in context value

  // Handle fallback to localStorage if Chrome messaging fails
  useEffect(() => {
    if (chromeError && !chromeLoading) {
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

  // Detect if we're in content script context to avoid Mantine provider
  const executionContext = useMemo(() => getExecutionContext(), []);
  const isContentScript = executionContext.contextType.includes('content-script-or-web-page') && 
                          !executionContext.contextType.includes('background-script');

  return (
    <ThemeContext.Provider value={contextValue}>
      {isContentScript ? (
        // Content script: Skip MantineProvider to avoid "MantineProvider was not found" errors
        <>
          {isLoading ? null : children}
        </>
      ) : (
        // Extension pages and background: Use MantineProvider normally  
        <MantineProvider theme={customTheme} defaultColorScheme="auto" forceColorScheme={colorScheme}>
          {isLoading ? null : children}
        </MantineProvider>
      )}
    </ThemeContext.Provider>
  );
}

export default ThemeProviderWrapper;
