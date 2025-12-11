import { useState, useEffect, useCallback, useRef } from "react";
import { ChromeAPIErrorHandler } from "../../../shared/services/chrome/chromeAPIErrorHandler.js";
import logger, { debug } from "../../../shared/utils/logging/logger.js";

// Custom hooks for FocusAreasSelector state management
export const useFocusAreasState = () => {
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedFocusAreas, setSelectedFocusAreas] = useState([]);
  const [currentTier, setCurrentTier] = useState("");
  const [masteredTags, setMasteredTags] = useState([]);
  const [masteryData, setMasteryData] = useState([]);
  const [currentSessionTags, setCurrentSessionTags] = useState([]); // Active session tags
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
    currentSessionTags, setCurrentSessionTags, // Add to return
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
    setCurrentSessionTags,
    setHasChanges,
  } = setters;

  debug("🔍 LIFECYCLE: loadData called");
  setLoading(true);
  setError(null);

  try {
    // Fetch current session state to get active focus tags
    const sessionState = await ChromeAPIErrorHandler.sendMessageWithRetry({
      type: "getSessionState",
      key: "session_state"
    });

    const currentSessionTags = sessionState?.current_focus_tags || [];
    setCurrentSessionTags(currentSessionTags);
    debug("🔍 FocusAreasSelector: Current session tags", { currentSessionTags });

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
      console.log("✅ FocusAreasSelector: Setting focusData state", { focusData });
      console.log("🔍 LIFECYCLE: About to call setFocusAvailability", { focusData });
      console.log("🔍 LIFECYCLE: focusData starterCore", { starterCore: focusData.starterCore });
      console.log("🔍 LIFECYCLE: focusData tags", { tags: focusData.tags });
      console.log("🔍 LIFECYCLE: focusData tags array?", Array.isArray(focusData.tags), "length:", focusData.tags?.length);
      setFocusAvailability(focusData);
      setCurrentTier(focusData.currentTier || "Unknown");

      // Set custom mode if user has overrides, otherwise use system selection
      setShowCustomMode(focusData.userOverrideTags && focusData.userOverrideTags.length > 0);
      debug("🔍 FocusAreasSelector: showCustomMode set", { showCustomMode: focusData.userOverrideTags && focusData.userOverrideTags.length > 0 });

      // Extract available tags for backward compatibility
      const selectableTags = focusData.tags.filter(tag => tag.selectable).map(tag => tag.tagId);
      setAvailableTags(selectableTags);
      console.log("🔍 FocusAreasSelector: Available tags set", { selectableTags });
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
    
    const settings = await ChromeAPIErrorHandler.sendMessageWithRetry({
      type: "getSettings"
    }) || { focusAreas: [], focusAreasTier: null };

    // Load saved focus areas from settings
    const savedFocusAreas = settings.focusAreas || [];
    const savedTier = settings.focusAreasTier || null;
    console.log("🔍 LOAD: savedFocusAreas from settings", { savedFocusAreas, savedTier, settings });

    // Filter out mastered tags from saved focus areas
    const masteredTags = focusData?.masteredTags || [];
    const activeFocusAreas = savedFocusAreas.filter(
      (tag) => !masteredTags.includes(tag)
    );

    console.log("🔍 LOAD: activeFocusAreas after filtering", { activeFocusAreas, masteredTags });
    setSelectedFocusAreas(activeFocusAreas);

    // Pass saved tier back to component if needed (would need to add to return value)
    // For now, component will default to current tier if no tier is explicitly selected

    setHasChanges(false);
  } catch (err) {
    logger.error("Error loading focus areas data:", err);
    setError("Failed to load learning data. Please try again.");
  } finally {
    setLoading(false);
  }
};

// Settings operations helpers
export const saveFocusAreasSettings = async (selectedFocusAreas, selectedTier, setters) => {
  const { setSaving, setError, setHasChanges } = setters;

  setSaving(true);
  setError(null);

  try {
    // Save focus areas and selected tier to settings via Chrome messaging
    const currentSettings = await ChromeAPIErrorHandler.sendMessageWithRetry({
      type: "getSettings"
    }) || {};

    const updatedSettings = {
      ...currentSettings,
      focusAreas: selectedFocusAreas,
      focusAreasTier: selectedTier, // Save which tier user selected from
      focusAreasLastChanged: new Date().toISOString(), // Track change for session staleness
    };

    const response = await ChromeAPIErrorHandler.sendMessageWithRetry({
      type: "setSettings",
      message: updatedSettings
    });

    if (response?.status === "success") {
      setHasChanges(false);
    } else {
      setError("Failed to save focus areas. Please try again.");
    }
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
    const currentSettings = await ChromeAPIErrorHandler.sendMessageWithRetry({
      type: "getSettings"
    }) || {};
    
    const updatedSettings = {
      ...currentSettings,
      focusAreas: [],
    };

    const response = await ChromeAPIErrorHandler.sendMessageWithRetry({
      type: "setSettings", 
      message: updatedSettings
    });

    if (response?.status === "success") {
      setSelectedFocusAreas([]);
      setHasChanges(false);
    } else {
      setError("Failed to reset focus areas. Please try again.");
    }
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
    console.log("🔍 getTagOptions called", {
      focusAvailability,
      hasTags: focusAvailability?.tags,
      isArray: Array.isArray(focusAvailability?.tags),
      length: focusAvailability?.tags?.length
    });

    if (!focusAvailability || !focusAvailability.tags || !Array.isArray(focusAvailability.tags)) {
      console.log("🔍 FocusAreasSelector: No focusAvailability tags, using fallback");
      
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
        const tagName = typeof tagInfo === 'string' ? tagInfo : (tagInfo?.tagId || tagInfo?.tag);
        if (!tagName) {
          console.log("⚠️ Skipping tag with no name:", tagInfo);
          return;
        }

        const isSelectable = typeof tagInfo === 'string' || (tagInfo?.selectable !== false);
        const progress = getTagMasteryProgress(tagName, masteryData);

        const option = {
          value: tagName,
          label: tagName.charAt(0).toUpperCase() + tagName.slice(1).replace(/[-_]/g, " "),
          reason: typeof tagInfo === 'object' ? tagInfo.reason : 'available',
          progress,
        };

        console.log("🔍 Processing tag:", { tagName, isSelectable, option });

        if (isSelectable) {
          selectableOptions.push(option);
        } else {
          previewTags.push(option);
        }
      });
    }

    console.log("🔍 Final tag options:", { selectableOptions, previewTags });
    
    return { selectableOptions: Array.isArray(selectableOptions) ? selectableOptions : [], previewTags: Array.isArray(previewTags) ? previewTags : [] };
  } catch (error) {
    logger.error("Error in getTagOptions", error);
    return { selectableOptions: [], previewTags: [] };
  }
};

// Lifecycle hooks for FocusAreasSelector
export const useFocusAreasLifecycle = (focusAvailability, setFocusAvailability, loadFocusAreasData, stateSets) => {
  const hasLoadedRef = useRef(false);

  const loadData = useCallback(async () => {
    if (hasLoadedRef.current) return; // Prevent multiple loads
    hasLoadedRef.current = true;
    await loadFocusAreasData(stateSets);
  }, [loadFocusAreasData, stateSets]);

  // Load data only once on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Listen for attempt updates
  useEffect(() => {
    const cleanup = setupAttemptUpdateListener(focusAvailability, setFocusAvailability);
    return cleanup;
  }, [focusAvailability, setFocusAvailability]); // Include dependencies as required

  return { loadData };
};