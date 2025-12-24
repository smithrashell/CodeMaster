import { useState, useEffect, useCallback, useRef } from "react";
import StrategyService from "../../content/services/strategyService";
import performanceMonitor from "../utils/performance/PerformanceMonitor.js";

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

  // Use ref to track previous tags and prevent unnecessary fetches
  const prevTagsRef = useRef([]);
  const hasFetchedRef = useRef(false);

  // Check if strategy data is loaded in IndexedDB
  useEffect(() => {
    checkStrategyDataLoaded(setIsDataLoaded);
  }, []);

  // Load strategy data function - defined before useEffect that uses it
  // Note: No dependencies to prevent recreating function and causing infinite loops
  const loadStrategyData = useCallback(async (tags) => {
    const queryContext = performanceMonitor.startQuery("useStrategy_loadData", {
      tagCount: tags.length,
    });

    try {
      setLoading(true);
      setError(null);

      // Normalize tags to lowercase to match strategy data
      const normalizedTags = tags.map((tag) => tag.toLowerCase().trim());

      // Load both hints and primers in parallel
      const [contextualHints, tagPrimers] = await Promise.all([
        StrategyService.getContextualHints(normalizedTags),
        StrategyService.getTagPrimers(normalizedTags),
      ]);

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
  }, []); // Empty deps - function is stable

  // Load hints and primers when problem tags change
  // FIX: Compare tags by value, not by reference, to prevent infinite loops
  useEffect(() => {
    const tagsChanged = JSON.stringify(problemTags) !== JSON.stringify(prevTagsRef.current);

    if (problemTags.length > 0 && isDataLoaded && tagsChanged) {
      prevTagsRef.current = problemTags;
      hasFetchedRef.current = true;
      loadStrategyData(problemTags);
    } else if (problemTags.length === 0) {
      setHints([]);
      setPrimers([]);
      prevTagsRef.current = [];
    }
  }, [problemTags, isDataLoaded, loadStrategyData]);

  // Manual refresh function
  const refreshStrategy = useCallback(() => {
    if (problemTags.length > 0 && isDataLoaded) {
      loadStrategyData(problemTags);
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
