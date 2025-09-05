import { useState, useEffect } from "react";
import { debug, warn } from "../../shared/utils/logger.js";

// Data extraction helper functions
const extractMasteryData = (appState) => {
  return appState.mastery?.masteryData || 
         appState.learningState?.masteryData || 
         appState.progress?.learningState?.masteryData || 
         [];
};

const extractFocusTags = (appState) => {
  return appState.mastery?.focusTags || 
         appState.learningState?.focusTags || 
         appState.progress?.learningState?.focusTags || 
         [];
};

const extractUnmasteredTags = (appState) => {
  return appState.mastery?.unmasteredTags || 
         appState.learningState?.unmasteredTags || 
         appState.progress?.learningState?.unmasteredTags || 
         [];
};

// Data processing helper
const processLearningPathData = (masteryData, focusTags, unmasteredTags) => {
  debug("Learning Path - extracted data", { 
    masteryCount: masteryData.length,
    focusCount: focusTags.length, 
    unmasteredCount: unmasteredTags.length
  });

  if (!masteryData.length) {
    warn("Learning Path - No mastery data available", { appState: "missing masteryData" });
    return [];
  }

  const processedData = masteryData.map((item) => {
    const isFocus = focusTags.includes(item.tag);
    const progress = item.progress || 0;
    
    return {
      ...item,
      isFocus,
      progress: Math.min(progress, 100),
      status: progress >= 90 ? 'mastered' : 
              progress >= 50 ? 'learning' : 
              isFocus ? 'available' : 'locked'
    };
  });

  debug("Learning Path - processed data sample", processedData.slice(0, 3));
  return processedData;
};

const generateRecommendations = (unmasteredTags, focusTags) => {
  const recs = [];
  if (unmasteredTags.length > 0) {
    recs.push(`Focus on ${unmasteredTags.slice(0, 3).join(', ')} for skill advancement`);
  }
  if (focusTags.length > 0) {
    recs.push(`Continue practicing ${focusTags[0]} - you're making progress!`);
  }
  recs.push("Consider reviewing mastered topics to maintain proficiency");
  return recs;
};

export const useLearningPathData = (appState) => {
  const [pathData, setPathData] = useState([]);
  const [recommendations, setRecommendations] = useState([]);

  useEffect(() => {
    if (!appState) return;

    // Extract data using helper functions
    const masteryData = extractMasteryData(appState);
    const focusTags = extractFocusTags(appState);
    const unmasteredTags = extractUnmasteredTags(appState);

    // Debug: Check extracted data
    debug("Learning Path - extracted data", { 
      masteryDataLength: masteryData.length,
      masteryData: masteryData,
      focusTags: focusTags,
      unmasteredTags: unmasteredTags
    });

    // Create progression data for visualization using helper function
    const progressionData = processLearningPathData(masteryData, focusTags, unmasteredTags);

    debug("Learning Path - final progressionData", { progressionData });

    // Set progression data - empty array is valid state for new users
    setPathData(progressionData);

    // Generate recommendations using helper function
    const recs = generateRecommendations(unmasteredTags, focusTags);
    setRecommendations(recs);
  }, [appState]);

  return { pathData, recommendations };
};