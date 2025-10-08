/**
 * Helper functions for tier tags visualization
 */

// Map tier numbers to names
export function getTierName(tierNum) {
  if (tierNum === 0) return 'core';
  if (tierNum === 1) return 'fundamental';
  if (tierNum === 2) return 'advanced';
  return 'core';
}

// Get current tier as tab value
export function getCurrentTierTab(currentTier) {
  if (currentTier === 'Core Concept') return 'core';
  if (currentTier === 'Fundamental Technique') return 'fundamental';
  if (currentTier === 'Advanced Technique') return 'advanced';
  return 'core';
}

// Get tier difficulty descriptions
export function getTierDescription(tier) {
  const descriptions = {
    core: {
      title: 'Core Concepts',
      subtitle: 'Foundation tags - build fundamental skills',
      difficulty: 'Mostly Easy problems (60-80% Easy, 20-40% Medium)',
      pool: 'Problems use only Core Concept tags',
      icon: '🎯'
    },
    fundamental: {
      title: 'Fundamental Techniques',
      subtitle: 'Intermediate tags - expand problem-solving toolkit',
      difficulty: 'Balanced mix (40-60% Medium, 20-40% Easy, 10-20% Hard)',
      pool: 'Problems use Core + Fundamental tags',
      icon: '🚀'
    },
    advanced: {
      title: 'Advanced Techniques',
      subtitle: 'Expert tags - master complex algorithms',
      difficulty: 'Challenging mix (50-70% Hard, 20-40% Medium, 10% Easy)',
      pool: 'Problems use Core + Fundamental + Advanced tags',
      icon: '⚡'
    }
  };
  return descriptions[tier] || descriptions.core;
}

// Get tags for a specific tier
export function getTagsForTier(focusAvailability, tier) {
  if (!focusAvailability) return [];

  switch (tier) {
    case 'core':
      return focusAvailability.core || [];
    case 'fundamental':
      return focusAvailability.fundamental || [];
    case 'advanced':
      return focusAvailability.advanced || [];
    default:
      return [];
  }
}

// Check if a tag is mastered
export function isTagMastered(tag, masteryData) {
  if (!masteryData || !masteryData[tag]) return false;
  return masteryData[tag].isMastered === true;
}
