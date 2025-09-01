import { useState, useEffect, useCallback } from "react";
import logger, { debug } from "../../../shared/utils/logger.js";

// Custom hooks for FocusAreasSelector state management
export const useFocusAreasState = () => {
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedFocusAreas, setSelectedFocusAreas] = useState([]);
  const [currentTier, setCurrentTier] = useState("");
  const [masteredTags, setMasteredTags] = useState([]);
  const [masteryData, setMasteryData] = useState([]);
  const [focusAvailability, setFocusAvailability] = useState({
    access: { core: "confirmed", fundamental: "none", advanced: "none" },
    caps: { core: Infinity, fundamental: 3, advanced: 3 },
    tags: [],
    starterCore: [],
    currentTier: "Unknown",
    systemSelectedTags: [],
    userOverrideTags: [],
    activeSessionTags: []
  });
  const [showCustomMode, setShowCustomMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  return {
    availableTags, setAvailableTags,
    selectedFocusAreas, setSelectedFocusAreas,
    currentTier, setCurrentTier,
    masteredTags, setMasteredTags,
    masteryData, setMasteryData,
    focusAvailability, setFocusAvailability,
    showCustomMode, setShowCustomMode,
    loading, setLoading,
    saving, setSaving,
    error, setError,
    hasChanges, setHasChanges
  };
};

// Chrome messaging and data loading helpers for FocusAreasSelector
export const loadFocusAreasData = async (setters) => {
  const {
    setLoading,
    setError,
    setFocusAvailability,
    setCurrentTier,
    setShowCustomMode,
    setAvailableTags,
    setMasteredTags,
    setMasteryData,
    setSelectedFocusAreas,
    setHasChanges,
  } = setters;

  debug("🔍 LIFECYCLE: loadData called");
  setLoading(true);
  setError(null);
  
  try {
    // Load available tags for focus (current + preview) via new message handler
    debug("🔍 FocusAreasSelector: Calling getAvailableTagsForFocus");
    const focusData = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "getAvailableTagsForFocus", userId: "default" }, (response) => {
        debug("🔍 FocusAreasSelector: Response received", { response });
        if (response?.result) {
          debug("🔍 FocusAreasSelector: Response result", { result: response.result });
          resolve(response.result);
        } else {
          logger.error("❌ Error from getAvailableTagsForFocus:", response?.error);
          resolve(null);
        }
      });
    });

    if (focusData) {
      debug("✅ FocusAreasSelector: Setting focusData state", { focusData });
      debug("🔍 LIFECYCLE: About to call setFocusAvailability", { focusData });
      debug("🔍 LIFECYCLE: focusData starterCore", { starterCore: focusData.starterCore });
      debug("🔍 LIFECYCLE: focusData tags", { tags: focusData.tags });
      setFocusAvailability(focusData);
      setCurrentTier(focusData.currentTier || "Unknown");
      
      // Set custom mode if user has overrides, otherwise use system selection
      setShowCustomMode(focusData.userOverrideTags && focusData.userOverrideTags.length > 0);
      debug("🔍 FocusAreasSelector: showCustomMode set", { showCustomMode: focusData.userOverrideTags && focusData.userOverrideTags.length > 0 });
      
      // Extract available tags for backward compatibility
      const selectableTags = focusData.tags.filter(tag => tag.selectable).map(tag => tag.tagId);
      setAvailableTags(selectableTags);
      debug("🔍 FocusAreasSelector: Available tags set", { selectableTags });
    } else {
      // Fallback to original method
      const learningState = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "getCurrentLearningState" }, (response) => {
          resolve(response || { allTagsInCurrentTier: [], masteredTags: [], masteryData: [], currentTier: "Unknown" });
        });
      });
      
      setAvailableTags(learningState.allTagsInCurrentTier || []);
      setCurrentTier(learningState.currentTier || "Unknown");
      setMasteredTags(learningState.masteredTags || []);
      setMasteryData(learningState.masteryData || []);
    }
    
    const settings = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "getSettings" }, (response) => {
        resolve(response || { focusAreas: [] });
      });
    });

    // Load saved focus areas from settings
    const savedFocusAreas = settings.focusAreas || [];
    
    // Filter out mastered tags from saved focus areas
    const masteredTags = focusData?.masteredTags || [];
    const activeFocusAreas = savedFocusAreas.filter(
      (tag) => !masteredTags.includes(tag)
    );
    
    setSelectedFocusAreas(activeFocusAreas);
    setHasChanges(false);
  } catch (err) {
    logger.error("Error loading focus areas data:", err);
    setError("Failed to load learning data. Please try again.");
  } finally {
    setLoading(false);
  }
};

// Settings operations helpers
export const saveFocusAreasSettings = async (selectedFocusAreas, setters) => {
  const { setSaving, setError, setHasChanges } = setters;
  
  setSaving(true);
  setError(null);

  try {
    // Save focus areas to settings via Chrome messaging
    const currentSettings = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "getSettings" }, (response) => {
        resolve(response || {});
      });
    });
    
    const updatedSettings = {
      ...currentSettings,
      focusAreas: selectedFocusAreas,
    };

    chrome.runtime.sendMessage(
      { type: "setSettings", message: updatedSettings },
      (response) => {
        if (response?.status === "success") {
          setHasChanges(false);
        } else {
          setError("Failed to save focus areas. Please try again.");
        }
      }
    );
  } catch (err) {
    logger.error("Error saving focus areas:", err);
    setError("Failed to save focus areas. Please try again.");
  } finally {
    setSaving(false);
  }
};

export const resetFocusAreasSettings = async (setters) => {
  const { setError, setSelectedFocusAreas, setHasChanges } = setters;
  
  try {
    const currentSettings = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "getSettings" }, (response) => {
        resolve(response || {});
      });
    });
    
    const updatedSettings = {
      ...currentSettings,
      focusAreas: [],
    };

    chrome.runtime.sendMessage(
      { type: "setSettings", message: updatedSettings },
      (response) => {
        if (response?.status === "success") {
          setSelectedFocusAreas([]);
          setHasChanges(false);
        } else {
          setError("Failed to reset focus areas. Please try again.");
        }
      }
    );
  } catch (err) {
    logger.error("Error resetting focus areas:", err);
    setError("Failed to reset focus areas. Please try again.");
  }
};

// Event listener setup for attempt updates
export const setupAttemptUpdateListener = (focusAvailability, setFocusAvailability) => {
  const handleAttemptRecorded = () => {
    chrome.runtime.sendMessage({ type: "getAvailableTagsForFocus", userId: "default" }, (response) => {
      if (response?.ok) {
        const prevAccess = focusAvailability?.access;
        setFocusAvailability(response.payload);
        
        // Show toast for tier unlocks
        if (prevAccess && prevAccess.advanced === "none" && response.payload.access.advanced !== "none") {
          // Could add toast notification here if desired
        }
        if (prevAccess && prevAccess.fundamental === "none" && response.payload.access.fundamental !== "none") {
          // Could add toast notification here if desired
        }
      }
    });
  };

  window.addEventListener("cm:attempt-recorded", handleAttemptRecorded);
  return () => window.removeEventListener("cm:attempt-recorded", handleAttemptRecorded);
};

// Tag mastery progress calculation
export const getTagMasteryProgress = (tagName, masteryData) => {
  const tagData = masteryData.find((tag) => tag.tag === tagName);
  if (!tagData || tagData.totalAttempts === 0) return 0;
  return Math.round((tagData.successfulAttempts / tagData.totalAttempts) * 100);
};

// Get selectable tag options for the multi-select
export const getTagOptions = (focusAvailability, availableTags, masteredTags, masteryData) => {
  try {
    debug("🔍 getTagOptions called", { focusAvailability });
    
    if (!focusAvailability || !focusAvailability.tags || !Array.isArray(focusAvailability.tags)) {
      debug("🔍 FocusAreasSelector: No focusAvailability tags, using fallback");
      
      const safeAvailableTags = Array.isArray(availableTags) ? availableTags : [];
      const safeMasteredTags = Array.isArray(masteredTags) ? masteredTags : [];
      
      const filtered = safeAvailableTags.filter((tag) => !safeMasteredTags.includes(tag));
      const mapped = filtered.map((tag) => ({
        value: tag,
        label: tag.charAt(0).toUpperCase() + tag.slice(1).replace(/[-_]/g, " "),
      }));
      
      return { selectableOptions: Array.isArray(mapped) ? mapped : [], previewTags: [] };
    }

    const selectableOptions = [];
    const previewTags = [];
    
    if (Array.isArray(focusAvailability.tags)) {
      focusAvailability.tags.forEach((tagInfo) => {
        const tagName = typeof tagInfo === 'string' ? tagInfo : tagInfo?.tag;
        if (!tagName) return;
        
        const isSelectable = typeof tagInfo === 'string' || (tagInfo?.reason !== 'preview-locked');
        const progress = getTagMasteryProgress(tagName, masteryData);
        
        const option = {
          value: tagName,
          label: tagName.charAt(0).toUpperCase() + tagName.slice(1).replace(/[-_]/g, " "),
          reason: typeof tagInfo === 'object' ? tagInfo.reason : 'available',
          progress,
        };
        
        if (isSelectable) {
          selectableOptions.push(option);
        } else {
          previewTags.push(option);
        }
      });
    }
    
    return { selectableOptions: Array.isArray(selectableOptions) ? selectableOptions : [], previewTags: Array.isArray(previewTags) ? previewTags : [] };
  } catch (error) {
    logger.error("Error in getTagOptions", error);
    return { selectableOptions: [], previewTags: [] };
  }
};

// Lifecycle hooks for FocusAreasSelector
export const useFocusAreasLifecycle = (focusAvailability, setFocusAvailability, loadFocusAreasData, stateSets) => {
  // Log when focusAvailability state changes
  useEffect(() => {
    debug("🔍 LIFECYCLE: focusAvailability state changed", { focusAvailability });
    debug("🔍 LIFECYCLE: focusAvailability starterCore after change", { starterCore: focusAvailability?.starterCore });
    debug("🔍 LIFECYCLE: focusAvailability tags after change", { tags: focusAvailability?.tags });
  }, [focusAvailability]);

  const loadData = useCallback(async () => {
    await loadFocusAreasData(stateSets);
  }, [loadFocusAreasData, stateSets]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Listen for attempt updates to refresh focus area availability
  useEffect(() => {
    return setupAttemptUpdateListener(focusAvailability, setFocusAvailability);
  }, [focusAvailability, setFocusAvailability]);

  return { loadData };
};