/**
 * Hook for grouping tags by tier with mastery data
 */
import { useMemo } from "react";
import { getTierName } from "./tierHelpers.js";

export function useTierTagGrouping(focusAvailability, masteryData) {
  return useMemo(() => {
    const tagsByTier = {
      core: [],
      fundamental: [],
      advanced: []
    };

    // Helper to get tag mastery progress
    const getTagProgress = (tagName) => {
      const tagData = masteryData?.find((tag) => tag.tag === tagName);
      if (!tagData || tagData.total_attempts === 0) return 0;
      return Math.round((tagData.successful_attempts / tagData.total_attempts) * 100);
    };

    if (focusAvailability?.tags && Array.isArray(focusAvailability.tags)) {
      focusAvailability.tags.forEach((tagInfo) => {
        const tagName = typeof tagInfo === 'string' ? tagInfo : (tagInfo?.tagId || tagInfo?.tag);
        const tier = typeof tagInfo === 'object' ? tagInfo.tier : 0;
        const tierKey = getTierName(tier);

        if (tagName && tagsByTier[tierKey]) {
          tagsByTier[tierKey].push({
            name: tagName,
            selectable: typeof tagInfo === 'string' || (tagInfo?.selectable !== false),
            mastered: tagInfo?.mastered || false,
            progress: getTagProgress(tagName)
          });
        }
      });
    }

    return tagsByTier;
  }, [focusAvailability, masteryData]);
}
