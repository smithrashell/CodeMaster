import { useState, useEffect, useMemo, useCallback } from "react";
import { useChromeMessage } from "../../shared/hooks/useChromeMessage";
import { shouldUseMockDashboard } from "../config/mockConfig.js";
import {
  getMockLearningProgressData,
  getMockGoalsData,
  getMockStatsData,
  getMockSessionHistoryData,
  getMockProductivityInsightsData,
  getMockTagMasteryData,
  getMockLearningPathData,
} from "../services/mockDashboardService.js";

// Page configuration mapping - moved outside to prevent re-creation on every render
const PAGE_CONFIG = {
  'learning-progress': {
    mockFunction: getMockLearningProgressData,
    messageType: 'getLearningProgressData'
  },
  'goals': {
    mockFunction: getMockGoalsData,
    messageType: 'getGoalsData'
  },
  'stats': {
    mockFunction: getMockStatsData,
    messageType: 'getStatsData'
  },
  'session-history': {
    mockFunction: getMockSessionHistoryData,
    messageType: 'getSessionHistoryData'
  },
  'productivity-insights': {
    mockFunction: getMockProductivityInsightsData,
    messageType: 'getProductivityInsightsData'
  },
  'tag-mastery': {
    mockFunction: getMockTagMasteryData,
    messageType: 'getTagMasteryData'
  },
  'learning-path': {
    mockFunction: getMockLearningPathData,
    messageType: 'getLearningPathData'
  }
};

// Mock data loading helper
const loadMockData = async (config, setData, setLoading, setError) => {
  try {
    setLoading(true);
    const mockData = await config.mockFunction();
    setData(mockData);
    setError(null);
  } catch (error) {
    setError(error);
  } finally {
    setLoading(false);
  }
};

// Chrome message handlers
const createChromeMessageHandlers = (setData, setLoading, setError) => ({
  onSuccess: (response) => {
    if (!shouldUseMockDashboard()) {
      setData(response.result);
      setLoading(false);
    }
  },
  onError: (error) => {
    setError(error);
    setLoading(false);
  }
});

/**
 * Custom hook for page-specific data fetching
 * Automatically handles mock vs real service selection
 */
export function usePageData(pageType, options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const config = PAGE_CONFIG[pageType];
  if (!config) {
    throw new Error(`Unknown page type: ${pageType}`);
  }

  // Memoize chrome message handlers to prevent re-renders
  const chromeHandlers = useMemo(() => createChromeMessageHandlers(setData, setLoading, setError), []);

  // Chrome message hook for production data (conditionally used)
  const {
    data: chromeData,
    loading: chromeLoading,
    error: chromeError,
    refetch: chromeRefetch
  } = useChromeMessage(
    { type: config.messageType, options }, 
    [], 
    {
      immediate: !shouldUseMockDashboard(),
      ...chromeHandlers
    }
  );

  // Mock data initialization
  useEffect(() => {
    const initializeMockData = async () => {
      if (shouldUseMockDashboard()) {
        await loadMockData(config, setData, setLoading, setError);
      }
    };

    initializeMockData();
  }, [config, pageType]); // Include config dependency as required by ESLint

  // Memoize refresh function to prevent re-renders
  const refresh = useCallback(async () => {
    if (shouldUseMockDashboard()) {
      await loadMockData(config, setData, setLoading, setError);
    } else {
      chromeRefetch();
    }
  }, [config, chromeRefetch]);

  return {
    data: shouldUseMockDashboard() ? data : chromeData?.result,
    loading: shouldUseMockDashboard() ? loading : chromeLoading,
    error: shouldUseMockDashboard() ? error : chromeError,
    refresh
  };
}