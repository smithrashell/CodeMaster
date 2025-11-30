/**
 * Custom hook for managing similar problems functionality
 * Extracted from WhyThisProblem to reduce complexity
 */
import { useChromeMessage } from '../../../shared/hooks/useChromeMessage';
import logger from '../../../shared/utils/logging/logger.js';

/**
 * Hook for fetching and managing similar problems
 */
export function useSimilarProblems(currentProblemId, isExpanded) {
  // Use existing useChromeMessage hook instead of duplicating Chrome API logic
  const { data, loading, error: _error } = useChromeMessage(
    {
      type: 'getSimilarProblems',
      problemId: currentProblemId,
      limit: 3
    },
    [currentProblemId, isExpanded], // Dependencies - include isExpanded so it refetches when hover changes
    {
      immediate: isExpanded && !!currentProblemId, // Only fetch when expanded and has problemId
      onSuccess: (response) => {
        logger.info('🔗 Similar problems response:', response);
        if (response?.similarProblems) {
          logger.info('🔗 Set similar problems:', response.similarProblems.length);
        }
      },
      onError: (error) => {
        logger.error('❌ Error fetching similar problems:', error);
      },
      showNotifications: false // Don't show error notifications for this
    }
  );

  return {
    similarProblems: data?.similarProblems || [],
    loadingSimilar: loading
  };
}

export default useSimilarProblems;