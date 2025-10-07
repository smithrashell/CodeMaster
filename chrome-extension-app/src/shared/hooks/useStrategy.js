import { useState, useEffect, useCallback } from "react";
import StrategyService from "../../content/services/strategyService";
import performanceMonitor from "../utils/PerformanceMonitor.js";

// Helper function to check if strategy data is loaded
const checkStrategyDataLoaded = async (setIsDataLoaded) => {
  try {
    const loaded = await StrategyService.isStrategyDataLoaded();
    setIsDataLoaded(loaded);
  } catch (err) {
    console.error("Error checking strategy data:", err);
    setIsDataLoaded(false);
  }
};

// Helper function to create computed values for the hook return
const createComputedValues = (hints, primers) => ({
  hasHints: hints.length > 0,
  hasPrimers: primers.length > 0,
  contextualHints: hints.filter((hint) => hint.type === "contextual"),
  generalHints: hints.filter((hint) => hint.type === "general"),
});

/**
 * React hook for managing strategy data and hints
 * Provides easy access to contextual hints and primers
 */
export const useStrategy = (problemTags = []) => {
  const [hints, setHints] = useState([]);
  const [primers, setPrimers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  console.log("🎯 useStrategy: Hook called with problemTags:", problemTags);

  // Check if strategy data is loaded in IndexedDB
  useEffect(() => {
    checkStrategyDataLoaded(setIsDataLoaded);
  }, []);

  // Load hints and primers when problem tags change
  useEffect(() => {
    if (problemTags.length > 0 && isDataLoaded) {
      loadStrategyData();
    } else {
      setHints([]);
      setPrimers([]);
    }
  }, [problemTags, isDataLoaded, loadStrategyData]);

  const loadStrategyData = useCallback(async () => {
    const queryContext = performanceMonitor.startQuery("useStrategy_loadData", {
      tagCount: problemTags.length,
    });

    try {
      console.log("🎯 useStrategy: loadStrategyData starting", {
        problemTags,
        tagCount: problemTags.length
      });
      
      setLoading(true);
      setError(null);

      // Normalize tags to lowercase to match strategy data (CRITICAL FIX)
      const normalizedTags = problemTags.map((tag) => tag.toLowerCase().trim());
      console.log("🎯 useStrategy: Normalized tags:", { 
        original: problemTags, 
        normalized: normalizedTags 
      });

      // Load both hints and primers in parallel (already optimized in StrategyService)
      console.log("🎯 useStrategy: Calling StrategyService.getTagPrimers with normalized tags:", normalizedTags);
      
      const [contextualHints, tagPrimers] = await Promise.all([
        StrategyService.getContextualHints(normalizedTags),
        StrategyService.getTagPrimers(normalizedTags),
      ]);

      console.log("🎯 useStrategy: Got results", {
        contextualHints,
        tagPrimers,
        primersCount: tagPrimers.length
      });

      setHints(contextualHints);
      setPrimers(tagPrimers);

      performanceMonitor.endQuery(
        queryContext,
        true,
        contextualHints.length + tagPrimers.length
      );
    } catch (err) {
      console.error("Error loading strategy data:", err);
      setError(err.message || "Failed to load strategy data");
      performanceMonitor.endQuery(queryContext, false, 0, err);
    } finally {
      setLoading(false);
    }
  }, [problemTags]);

  // Manual refresh function
  const refreshStrategy = useCallback(() => {
    if (problemTags.length > 0 && isDataLoaded) {
      loadStrategyData();
    }
  }, [problemTags, isDataLoaded, loadStrategyData]);

  // Get strategy for specific tag
  const getTagStrategy = useCallback(async (tag) => {
    try {
      return await StrategyService.getStrategyForTag(tag);
    } catch (err) {
      console.error(`Error getting strategy for tag "${tag}":`, err);
      return null;
    }
  }, []);

  // Get primer for specific tag
  const getTagPrimer = useCallback(async (tag) => {
    try {
      return await StrategyService.getTagPrimer(tag);
    } catch (err) {
      console.error(`Error getting primer for tag "${tag}":`, err);
      return null;
    }
  }, []);

  return {
    // Data
    hints,
    primers,

    // State
    loading,
    error,
    isDataLoaded,

    // Computed values
    ...createComputedValues(hints, primers),

    // Functions
    refreshStrategy,
    getTagStrategy,
    getTagPrimer,

    // Utilities
    clearError: () => setError(null),
  };
};

export default useStrategy;
