import React from "react";
import { Alert, Text, Stack, Group, Badge } from "@mantine/core";
import CustomMultiSelect from "../shared/CustomMultiSelect";
import logger, { debug } from "../../../shared/utils/logger.js";

// Starter pack selector for new users
export const renderStarterPackSelector = (starterCoreArray, selectedFocusAreas, handleFocusAreasChange) => {
  debug("🔍 RENDER: Entering starter pack branch");
  debug("🔍 RENDER: starterCoreArray (after || [])", { starterCoreArray });
  
  let starterMultiSelectData;
  try {
    starterMultiSelectData = starterCoreArray.map(tag => {
      debug("🔍 RENDER: Mapping starter tag", { tag, type: typeof tag });
      return {
        value: tag,
        label: tag.charAt(0).toUpperCase() + tag.slice(1).replace(/[-_]/g, " ")
      };
    });
    debug("🔍 RENDER: Successfully mapped starterMultiSelectData", { starterMultiSelectData });
  } catch (error) {
    logger.error("🔍 RENDER: Error mapping starterCoreArray:", error);
    return <Alert color="red">Error loading starter tags. Please reload the page.</Alert>;
  }

  return (
    <CustomMultiSelect
      label="Choose Your Starting Focus Areas (1-3 tags)"
      data={starterMultiSelectData}
      value={selectedFocusAreas}
      onChange={handleFocusAreasChange}
      maxValues={3}
      searchable={false}
      clearable
      placeholder="Select beginner-friendly tags..."
      description="We've selected beginner-friendly tags for you to start with"
    />
  );
};

// Empty state when no tags are available
export const renderEmptyState = () => (
  <Alert color="yellow" variant="light">
    <Text size="sm">
      No tags available yet. Complete some coding sessions to unlock focus area selection.
    </Text>
  </Alert>
);

// Main selector for experienced users
export const renderMainSelector = (selectableOptions, selectedFocusAreas, handleFocusAreasChange, showCustomMode) => {
  debug("🔍 RENDER: About to render main MultiSelect");
  debug("🔍 RENDER: selectableOptions before main MultiSelect", { selectableOptions });
  
  return (
    <Stack gap="md">
      {showCustomMode && (
        <CustomMultiSelect
          label="Select Focus Areas (1-3 tags)"
          data={selectableOptions}
          value={selectedFocusAreas}
          onChange={handleFocusAreasChange}
          maxValues={3}
          searchable
          clearable
          placeholder="Choose tags to focus on..."
          description="These tags will have 1.2x higher weight in session generation"
        />
      )}
      
      {!showCustomMode && (
        <Stack gap="xs">
          <Text size="sm" c="dimmed">
            System-recommended focus areas (read-only):
          </Text>
          <Group gap="xs">
            {selectedFocusAreas.map((tag) => (
              <Badge key={tag} color="blue" variant="light">
                {tag}
              </Badge>
            ))}
          </Group>
        </Stack>
      )}
    </Stack>
  );
};

// Main render logic for focus areas selector
export const renderFocusAreasSelector = (
  getTagOptions,
  focusAvailability,
  selectedFocusAreas,
  handleFocusAreasChange,
  showCustomMode
) => {
  const tagOptionsResult = getTagOptions() || {};
  const { selectableOptions = [], previewTags = [] } = tagOptionsResult;
  debug("🔍 Render: tagOptionsResult", { tagOptionsResult });
  
  // Safety check - ensure arrays are valid
  if (!Array.isArray(selectableOptions)) {
    logger.error("❌ Render guard: selectableOptions is not an array:", selectableOptions);
    return <Alert color="red">Error loading focus areas. Please reload the page.</Alert>;
  }
  
  // Handle brand new users with starter pack
  if (focusAvailability?.starterCore?.length > 0) {
    const starterCoreArray = focusAvailability?.starterCore || [];
    return renderStarterPackSelector(starterCoreArray, selectedFocusAreas, handleFocusAreasChange);
  }
  
  if (selectableOptions.length === 0 && previewTags.length === 0) {
    return renderEmptyState();
  }
  
  return renderMainSelector(selectableOptions, selectedFocusAreas, handleFocusAreasChange, showCustomMode);
};