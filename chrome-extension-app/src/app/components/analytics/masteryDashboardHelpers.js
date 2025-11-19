/**
 * Helper functions for MasteryDashboard component
 *
 * Extracted to reduce component complexity and enable reuse
 */

/**
 * Normalize data with service-based defaults
 */
export const normalizeData = (data) => ({
  currentTier: data?.currentTier || null,
  masteredTags: data?.masteredTags || [],
  allTagsInCurrentTier: data?.allTagsInCurrentTier || [],
  focusTags: data?.focusTags || [],
  masteryData: data?.masteryData || [],
  allTagsData: data?.allTagsData || [], // All known tags for Overall view
  tierTagsData: data?.tierTagsData || [], // Current tier tags for Tier view
  unmasteredTags: data?.unmasteredTags || [],
  tagsinTier: data?.tagsinTier || [],
});

/**
 * Generate pie chart data for mastery visualization
 * Supports both snake_case and PascalCase field names
 */
export const generatePieData = (selectedTag, masteryData, _currentTab) => {
  if (selectedTag) {
    const successfulAttempts = selectedTag.successful_attempts ?? selectedTag.successfulAttempts ?? 0;
    const totalAttempts = selectedTag.total_attempts ?? selectedTag.totalAttempts ?? 0;
    return [
      { name: "Successful", value: successfulAttempts },
      { name: "Failed", value: totalAttempts - successfulAttempts }
    ];
  }

  // Filter data based on current tab context if provided
  const dataToUse = masteryData || [];
  const mastered = dataToUse.filter(tag => tag.mastered).length;
  const unmastered = dataToUse.length - mastered;
  return [
    { name: "Mastered", value: mastered },
    { name: "Learning", value: unmastered }
  ];
};

/**
 * Paginate array data
 */
export const paginateData = (arr, currentPage, pageSize) => {
  const start = currentPage * pageSize;
  return arr.slice(start, start + pageSize);
};

/**
 * Process and filter tag data based on search and focus filters
 */
export const processTagData = (masteryData, unmasteredTags, search, activeFocusFilter) => {
  return masteryData
    .filter((tag) => {
      if (search && tag.tag && !tag.tag.toLowerCase().includes(search.toLowerCase())) return false;
      if (activeFocusFilter && tag.tag !== activeFocusFilter) return false;
      return true;
    })
    .sort((a, b) => {
      const aIsUnmastered = unmasteredTags?.includes(a.tag);
      const bIsUnmastered = unmasteredTags?.includes(b.tag);
      if (aIsUnmastered && !bIsUnmastered) return -1;
      if (!aIsUnmastered && bIsUnmastered) return 1;
      return b.progress - a.progress;
    });
};

/**
 * Get pie chart title based on tab and selection
 */
export const getPieTitle = (selectedTag, tab) => {
  if (selectedTag) return `Mastery: ${selectedTag.tag}`;
  return tab === "tier" ? "Current Tier Mastery Overview" : "Overall Mastery Overview";
};

/**
 * Get data source for all tags view
 */
export const getAllTagsSource = (data) => {
  return (data.allTagsData && data.allTagsData.length > 0) ? data.allTagsData : data.masteryData;
};

/**
 * Get data source for tier tags view
 */
export const getTierTagsSource = (data) => {
  return (data.tierTagsData && data.tierTagsData.length > 0)
    ? data.tierTagsData
    : (data.masteryData || []).filter(t => (data.tagsinTier || []).includes(t.tag));
};
