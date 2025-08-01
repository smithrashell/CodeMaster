import { useState, useEffect, useCallback } from 'react';
import StrategyService from '../services/strategyService';

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

  // Check if strategy data is loaded in IndexedDB
  useEffect(() => {
    const checkDataLoaded = async () => {
      try {
        const loaded = await StrategyService.isStrategyDataLoaded();
        setIsDataLoaded(loaded);
      } catch (err) {
        console.error('Error checking strategy data:', err);
        setIsDataLoaded(false);
      }
    };

    checkDataLoaded();
  }, []);

  // Load hints and primers when problem tags change
  useEffect(() => {
    if (problemTags.length > 0 && isDataLoaded) {
      loadStrategyData();
    } else {
      setHints([]);
      setPrimers([]);
    }
  }, [problemTags, isDataLoaded]);

  const loadStrategyData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load both hints and primers in parallel
      const [contextualHints, tagPrimers] = await Promise.all([
        StrategyService.getContextualHints(problemTags),
        StrategyService.getTagPrimers(problemTags)
      ]);

      setHints(contextualHints);
      setPrimers(tagPrimers);

    } catch (err) {
      console.error('Error loading strategy data:', err);
      setError(err.message || 'Failed to load strategy data');
    } finally {
      setLoading(false);
    }
  };

  // Manual refresh function
  const refreshStrategy = useCallback(() => {
    if (problemTags.length > 0 && isDataLoaded) {
      loadStrategyData();
    }
  }, [problemTags, isDataLoaded]);

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
    hasHints: hints.length > 0,
    hasPrimers: primers.length > 0,
    contextualHints: hints.filter(hint => hint.type === 'contextual'),
    generalHints: hints.filter(hint => hint.type === 'general'),
    
    // Functions
    refreshStrategy,
    getTagStrategy,
    getTagPrimer,
    
    // Utilities
    clearError: () => setError(null),
  };
};

export default useStrategy;