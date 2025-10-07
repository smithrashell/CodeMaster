import { useState, useEffect } from "react";
import { debug, warn } from "../../shared/utils/logger.js";
import { tagRelationships } from "../components/learning/TagRelationships.js";

// Data extraction helper functions
const extractMasteryData = (appState) => {
  // getLearningPathData returns the mastery object directly, not wrapped in appState.mastery
  return appState?.masteryData ||
         appState?.mastery?.masteryData ||
         appState?.learningState?.masteryData ||
         appState?.progress?.learningState?.masteryData ||
         [];
};

const extractFocusTags = (appState) => {
  // getLearningPathData returns the mastery object directly, not wrapped in appState.mastery
  return appState?.focusTags ||
         appState?.mastery?.focusTags ||
         appState?.learningState?.focusTags ||
         appState?.progress?.learningState?.focusTags ||
         [];
};

const extractUnmasteredTags = (appState) => {
  // getLearningPathData returns the mastery object directly, not wrapped in appState.mastery
  return appState?.unmasteredTags ||
         appState?.mastery?.unmasteredTags ||
         appState?.learningState?.unmasteredTags ||
         appState?.progress?.learningState?.unmasteredTags ||
         [];
};

// Data processing helper
const processLearningPathData = (masteryData, focusTags, unmasteredTags) => {
  debug("Learning Path - extracted data", {
    masteryCount: masteryData.length,
    focusCount: focusTags.length,
    unmasteredCount: unmasteredTags.length
  });

  // Create a map of mastery data for quick lookup
  const masteryMap = new Map(masteryData.map(item => [item.tag, item]));

  // Step 1: Collect tags with mastery data (tags user has attempted)
  const tagsWithData = new Set(masteryData.map(item => item.tag));

  // Step 2: Find all tags that are directly unlocked by tags with mastery data
  const unlockedTags = new Set();
  tagsWithData.forEach(tag => {
    const relationship = tagRelationships[tag];
    if (relationship?.unlocks) {
      relationship.unlocks.forEach(unlockData => {
        const unlockedTag = typeof unlockData === 'string' ? unlockData : unlockData.tag;
        unlockedTags.add(unlockedTag);
      });
    }
  });

  // Step 3: Combine both sets - tags with data + their immediate unlocks
  const visibleTags = new Set([...tagsWithData, ...unlockedTags]);

  // Step 4: Process only the visible tags
  const processedData = Array.from(visibleTags).map((tag) => {
    const masteryItem = masteryMap.get(tag);
    const isFocus = focusTags.includes(tag);

    if (masteryItem) {
      // Tag has mastery data - process it
      const totalAttempts = masteryItem.total_attempts ?? masteryItem.totalAttempts ?? 0;
      const successfulAttempts = masteryItem.successful_attempts ?? masteryItem.successfulAttempts ?? 0;
      const progress = totalAttempts > 0 ? Math.round((successfulAttempts / totalAttempts) * 100) : 0;

      // Use actual 'mastered' field from database (considers min_attempts_required)
      const status = masteryItem.mastered ? 'mastered' :
                     totalAttempts > 0 ? 'learning' :
                     isFocus ? 'available' : 'not-started';

      return {
        ...masteryItem,
        isFocus,
        progress: Math.min(progress, 100),
        status
      };
    } else {
      // Tag is unlocked but not attempted yet - show as available/locked
      const tagRelationship = tagRelationships[tag];
      const status = isFocus ? 'available' : 'locked';

      return {
        tag,
        total_attempts: 0,
        successful_attempts: 0,
        mastered: false,
        isFocus,
        progress: 0,
        status,
        position: tagRelationship?.position
      };
    }
  });

  debug("Learning Path - visible tags", Array.from(visibleTags));
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
  const [tagRelationships, setTagRelationships] = useState({});

  useEffect(() => {
    if (!appState) return;

    // Extract data using helper functions
    const masteryData = extractMasteryData(appState);
    const focusTags = extractFocusTags(appState);
    const unmasteredTags = extractUnmasteredTags(appState);

    // Extract dynamic tag relationships from appState
    const dynamicRelationships = appState?.tagRelationships || {};
    console.log('🎯 useLearningPathData - extracting relationships:', {
      hasAppState: !!appState,
      hasTagRelationships: !!appState?.tagRelationships,
      relationshipCount: Object.keys(dynamicRelationships).length,
      appStateKeys: appState ? Object.keys(appState) : []
    });
    setTagRelationships(dynamicRelationships);

    // Debug: Check extracted data
    debug("Learning Path - extracted data", {
      masteryDataLength: masteryData.length,
      masteryData: masteryData,
      focusTags: focusTags,
      unmasteredTags: unmasteredTags,
      dynamicRelationships: Object.keys(dynamicRelationships).length
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

  return { pathData, recommendations, tagRelationships };
};