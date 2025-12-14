import React from "react";
import { Alert, Text, Stack, Group, Tabs, Card, Badge } from "@mantine/core";
import CustomMultiSelect from "../shared/CustomMultiSelect";
import logger, { debug } from "../../../shared/utils/logging/logger.js";
import { getCurrentTierTab, getTierDescription } from "./tierHelpers.js";
import { TierTagBadge } from "./TierTagBadge.jsx";
import { TierPanel } from "./TierPanel.jsx";
import { useTierTagGrouping } from "./useTierTagGrouping.js";
import { TierSelectionSummary } from "./TierSelectionSummary.jsx";

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
          <Text size="sm">
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

// Tabbed tier visualization component with selection capability
export const TierTagsVisualization = ({
  focusAvailability,
  currentTier,
  selectedFocusAreas,
  masteryData,
  onFocusAreasChange,
  selectedTier,
  onTierChange,
  activeTab,
  onSelectedTierChange
}) => {
  // Get current tier as tab value
  const currentTierTab = getCurrentTierTab(currentTier);

  // Use activeTab from parent if provided, otherwise default to current tier
  const currentActiveTab = activeTab || currentTierTab;

  // Group tags by tier with mastery data
  const tagsByTier = useTierTagGrouping(focusAvailability, masteryData);

  // Render tag badge using extracted component
  const renderTagBadge = (tag, tierKey) => (
    <TierTagBadge
      key={tag.name}
      tag={tag}
      tierKey={tierKey}
      selectedFocusAreas={selectedFocusAreas}
      currentActiveTab={currentActiveTab}
      selectedTier={selectedTier}
      onFocusAreasChange={onFocusAreasChange}
      onSelectedTierChange={onSelectedTierChange}
      onTierChange={onTierChange}
    />
  );

  const handleTabChange = (newTab) => {
    onTierChange?.(newTab);
  };

  // Check if user is viewing a different tier than their selection
  const hasSelection = selectedFocusAreas.length > 0;
  const isViewingDifferentTier = hasSelection && selectedTier && currentActiveTab !== selectedTier;

  console.log('🔍 TierTagsVisualization state:', {
    hasSelection,
    selectedTier,
    currentActiveTab,
    isViewingDifferentTier,
    selectedFocusAreas
  });

  return (
    <Card withBorder p="md" style={{ backgroundColor: 'var(--cm-card-bg)' }}>
      <Stack gap="sm">
        <Group justify="space-between">
          <Text size="sm" fw={500}>Select Focus Tier</Text>
          <Text size="xs">Click tags to select (max 3 per tier)</Text>
        </Group>

        <Tabs value={currentActiveTab} onChange={handleTabChange}>
          <Tabs.List>
            <Tabs.Tab value="core">
              {getTierDescription('core').icon} Core Concepts
              {currentTierTab === 'core' && <Badge size="xs" ml={4} color="green" variant="dot">System Tier</Badge>}
            </Tabs.Tab>
            <Tabs.Tab value="fundamental">
              {getTierDescription('fundamental').icon} Fundamental
              {currentTierTab === 'fundamental' && <Badge size="xs" ml={4} color="green" variant="dot">System Tier</Badge>}
            </Tabs.Tab>
            <Tabs.Tab value="advanced">
              {getTierDescription('advanced').icon} Advanced
              {currentTierTab === 'advanced' && <Badge size="xs" ml={4} color="green" variant="dot">System Tier</Badge>}
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="core" pt="md">
            <TierPanel
              tierKey="core"
              tagsByTier={tagsByTier}
              isViewingDifferentTier={isViewingDifferentTier}
              currentActiveTab={currentActiveTab}
              selectedFocusAreas={selectedFocusAreas}
              selectedTier={selectedTier}
              renderTagBadge={renderTagBadge}
              backgroundColor="var(--cm-bg-secondary)"
            />
          </Tabs.Panel>

          <Tabs.Panel value="fundamental" pt="md">
            <TierPanel
              tierKey="fundamental"
              tagsByTier={tagsByTier}
              isViewingDifferentTier={isViewingDifferentTier}
              currentActiveTab={currentActiveTab}
              selectedFocusAreas={selectedFocusAreas}
              selectedTier={selectedTier}
              renderTagBadge={renderTagBadge}
              backgroundColor="var(--cm-bg-secondary)"
            />
          </Tabs.Panel>

          <Tabs.Panel value="advanced" pt="md">
            <TierPanel
              tierKey="advanced"
              tagsByTier={tagsByTier}
              isViewingDifferentTier={isViewingDifferentTier}
              currentActiveTab={currentActiveTab}
              selectedFocusAreas={selectedFocusAreas}
              selectedTier={selectedTier}
              renderTagBadge={renderTagBadge}
              backgroundColor="var(--cm-bg-secondary)"
            />
          </Tabs.Panel>
        </Tabs>

        <TierSelectionSummary selectedFocusAreas={selectedFocusAreas} selectedTier={selectedTier} />
      </Stack>
    </Card>
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
  console.log("🔍 RENDER: renderFocusAreasSelector called", { focusAvailability });
  const tagOptionsResult = getTagOptions() || {};
  console.log("🔍 RENDER: tagOptionsResult", { tagOptionsResult, selectableLength: tagOptionsResult.selectableOptions?.length, previewLength: tagOptionsResult.previewTags?.length });
  const { selectableOptions = [], previewTags = [] } = tagOptionsResult;
  console.log("🔍 RENDER: After destructure", { selectableOptions, previewTags });
  debug("🔍 Render: tagOptionsResult", { tagOptionsResult });

  // Safety check - ensure arrays are valid
  if (!Array.isArray(selectableOptions)) {
    logger.error("❌ Render guard: selectableOptions is not an array:", selectableOptions);
    return <Alert color="red">Error loading focus areas. Please reload the page.</Alert>;
  }

  // Handle brand new users with starter pack
  if (focusAvailability?.starterCore?.length > 0) {
    const starterCoreArray = focusAvailability?.starterCore || [];
    console.log("🔍 RENDER: Showing starter pack", { starterCoreArray });
    return renderStarterPackSelector(starterCoreArray, selectedFocusAreas, handleFocusAreasChange);
  }

  console.log("🔍 RENDER: Checking if empty", { selectableLength: selectableOptions.length, previewLength: previewTags.length });
  if (selectableOptions.length === 0 && previewTags.length === 0) {
    console.log("🔍 RENDER: Showing empty state");
    return renderEmptyState();
  }

  console.log("🔍 RENDER: Showing main selector");
  return renderMainSelector(selectableOptions, selectedFocusAreas, handleFocusAreasChange, showCustomMode);
};