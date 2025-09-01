/**
 * Custom hook for managing similar problems functionality
 * Extracted from WhyThisProblem to reduce complexity
 */
import { useState, useEffect } from 'react';
import logger from '../../../shared/utils/logger.js';

/**
 * Hook for fetching and managing similar problems
 */
export function useSimilarProblems(currentProblemId, isExpanded) {
  const [similarProblems, setSimilarProblems] = useState([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);

  useEffect(() => {
    const fetchSimilarProblems = () => {
      const shouldFetch = isExpanded && 
                         currentProblemId && 
                         !loadingSimilar && 
                         similarProblems.length === 0;

      if (shouldFetch) {
        logger.info('🔗 Fetching similar problems for:', currentProblemId);
        setLoadingSimilar(true);
        
        try {
          chrome.runtime.sendMessage({
            type: 'getSimilarProblems',
            problemId: currentProblemId,
            limit: 3
          }, (response) => {
            logger.info('🔗 Similar problems response:', response);
            
            if (response?.similarProblems) {
              setSimilarProblems(response.similarProblems);
              logger.info('🔗 Set similar problems:', response.similarProblems.length);
            } else {
              logger.info('🔗 No similar problems found in response');
            }
            
            setLoadingSimilar(false);
          });
        } catch (error) {
          logger.error('❌ Error fetching similar problems:', error);
          setLoadingSimilar(false);
        }
      } else {
        logger.info('🔗 Skipping similar problems fetch:', {
          isExpanded,
          currentProblemId,
          loadingSimilar,
          similarProblemsLength: similarProblems.length
        });
      }
    };

    fetchSimilarProblems();
  }, [isExpanded, currentProblemId, loadingSimilar, similarProblems.length]);

  return {
    similarProblems,
    loadingSimilar
  };
}

export default useSimilarProblems;