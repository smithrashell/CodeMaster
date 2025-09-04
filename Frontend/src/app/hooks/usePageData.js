import { useState, useEffect } from "react";
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
  getMockMistakeAnalysisData,
} from "../services/mockDashboardService.js";

/**
 * Custom hook for page-specific data fetching
 * Automatically handles mock vs real service selection
 */
export function usePageData(pageType, options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Map page types to mock functions and Chrome message types
  const pageConfig = {
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
    },
    'mistake-analysis': {
      mockFunction: getMockMistakeAnalysisData,
      messageType: 'getMistakeAnalysisData'
    }
  };

  const config = pageConfig[pageType];
  if (!config) {
    throw new Error(`Unknown page type: ${pageType}`);
  }

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
      onSuccess: (response) => {
        if (!shouldUseMockDashboard()) {
          console.info(`📊 ${pageType} data received:`, response.result);
          setData(response.result);
          setLoading(false);
        }
      },
      onError: (error) => {
        console.error(`❌ ${pageType} data error:`, error);
        setError(error);
        setLoading(false);
      },
    }
  );

  // Mock data initialization
  useEffect(() => {
    const initializeMockData = async () => {
      if (shouldUseMockDashboard()) {
        try {
          setLoading(true);
          console.log(`🎭 Using mock data for ${pageType}`);
          const mockData = await config.mockFunction();
          setData(mockData);
          setError(null);
        } catch (error) {
          console.error(`Error loading mock data for ${pageType}:`, error);
          setError(error);
        } finally {
          setLoading(false);
        }
      }
    };

    initializeMockData();
  }, [pageType, config.mockFunction]);

  // Refresh function
  const refresh = async () => {
    if (shouldUseMockDashboard()) {
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
    } else {
      // Use Chrome message refetch
      chromeRefetch();
    }
  };

  return {
    data: shouldUseMockDashboard() ? data : chromeData?.result,
    loading: shouldUseMockDashboard() ? loading : chromeLoading,
    error: shouldUseMockDashboard() ? error : chromeError,
    refresh
  };
}