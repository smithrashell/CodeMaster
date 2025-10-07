import React from "react";
import { Alert, Text, Stack, Group, Badge, Tabs, Card, Tooltip } from "@mantine/core";
import { IconCheck, IconFocus } from "@tabler/icons-react";
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
  // Map tier numbers to names
  const getTierName = (tierNum) => {
    if (tierNum === 0) return 'core';
    if (tierNum === 1) return 'fundamental';
    if (tierNum === 2) return 'advanced';
    return 'core';
  };

  // Get current tier as tab value
  const currentTierTab = currentTier === 'Core Concept' ? 'core' :
                         currentTier === 'Fundamental Technique' ? 'fundamental' :
                         currentTier === 'Advanced Technique' ? 'advanced' : 'core';

  // Use activeTab from parent if provided, otherwise default to current tier
  const currentActiveTab = activeTab || currentTierTab;

  // Get tier difficulty descriptions
  const getTierDescription = (tier) => {
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
        difficulty: 'Challenging problems (50-70% Hard, 20-40% Medium)',
        pool: 'Problems use ALL tags (Core + Fundamental + Advanced)',
        icon: '⚡'
      }
    };
    return descriptions[tier];
  };

  // Helper to get tag mastery progress
  const getTagProgress = (tagName) => {
    const tagData = masteryData?.find((tag) => tag.tag === tagName);
    if (!tagData || tagData.total_attempts === 0) return 0;
    return Math.round((tagData.successful_attempts / tagData.total_attempts) * 100);
  };

  // Group tags by tier from focusAvailability
  const tagsByTier = {
    core: [],
    fundamental: [],
    advanced: []
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

  // Helper to render clickable tag badge with appropriate styling
  const renderTagBadge = (tag, tierKey) => {
    const isSelected = selectedFocusAreas.includes(tag.name);
    const isActiveTier = tierKey === currentActiveTab;
    const canSelect = isActiveTier && selectedFocusAreas.length < 3;

    let color = 'gray';
    let variant = 'light';
    let icon = null;

    if (tag.mastered) {
      color = 'green';
      icon = <IconCheck size={12} />;
    } else if (isSelected) {
      color = 'blue';
      icon = <IconFocus size={12} />;
    }

    const handleClick = () => {
      console.log('🔍 Tag clicked:', {
        tag: tag.name,
        tierKey,
        selectedTier,
        isSelected,
        isDifferentTier: selectedTier && selectedTier !== tierKey
      });

      // If clicking a tag from a different tier with existing selections, clear and start fresh
      if (selectedTier && selectedTier !== tierKey && !isSelected) {
        console.log('🔍 Clearing previous tier selections and starting fresh');
        // Clear previous selections and select this tag
        onFocusAreasChange?.([tag.name]);
        onSelectedTierChange?.(tierKey);
        // Switch to this tier's tab if not already there
        if (!isActiveTier) {
          onTierChange?.(tierKey);
        }
        return;
      }

      if (!isActiveTier) {
        // Clicking a tag from a different tier switches to that tier
        onTierChange?.(tierKey);
        return;
      }

      // Toggle selection if in active tier
      if (isSelected) {
        onFocusAreasChange?.(selectedFocusAreas.filter(t => t !== tag.name));
        // If all tags deselected, clear the selected tier
        if (selectedFocusAreas.length === 1) {
          onSelectedTierChange?.(null);
        }
      } else if (canSelect || selectedFocusAreas.length === 0) {
        onFocusAreasChange?.([...selectedFocusAreas, tag.name]);
        // Set the selected tier when first tag is selected
        if (selectedFocusAreas.length === 0) {
          onSelectedTierChange?.(tierKey);
        }
      }
    };

    return (
      <Tooltip
        key={tag.name}
        label={
          tag.mastered ? `Mastered (${tag.progress}%)` :
          !isActiveTier ? `Click to switch to ${getTierDescription(tierKey).title}` :
          isSelected ? 'Click to remove from focus' :
          canSelect || selectedFocusAreas.length === 0 ? 'Click to add to focus (max 3)' :
          'Maximum 3 focus areas reached'
        }
        position="top"
      >
        <Badge
          variant={variant}
          color={color}
          leftSection={icon}
          style={{
            cursor: tag.mastered ? 'default' : 'pointer',
            opacity: tag.mastered ? 0.6 : 1
          }}
          onClick={tag.mastered ? undefined : handleClick}
        >
          {tag.name.charAt(0).toUpperCase() + tag.name.slice(1).replace(/[-_]/g, " ")}
        </Badge>
      </Tooltip>
    );
  };

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
    <Card withBorder p="md">
      <Stack gap="sm">
        <Group justify="space-between">
          <Text size="sm" fw={500}>Select Focus Tier</Text>
          <Text size="xs" c="dimmed">Click tags to select (max 3 per tier)</Text>
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
            <Stack gap="sm">
              {isViewingDifferentTier && currentActiveTab === 'core' && (
                <Alert color="yellow" variant="light">
                  <Text size="xs">
                    You have {selectedFocusAreas.length} tag(s) selected from <strong>{getTierDescription(selectedTier).title}</strong>.
                    Selecting a tag here will clear your previous selection.
                  </Text>
                </Alert>
              )}
              <Card withBorder p="xs" style={{ backgroundColor: 'var(--mantine-color-blue-0)' }}>
                <Stack gap={4}>
                  <Text size="xs" fw={500}>{getTierDescription('core').subtitle}</Text>
                  <Text size="xs" c="dimmed">📊 {getTierDescription('core').difficulty}</Text>
                  <Text size="xs" c="dimmed">🎯 {getTierDescription('core').pool}</Text>
                </Stack>
              </Card>
              <Group gap="xs">
                {tagsByTier.core.length > 0 ? (
                  tagsByTier.core.map(tag => renderTagBadge(tag, 'core'))
                ) : (
                  <Text size="sm" c="dimmed">No tags in this tier</Text>
                )}
              </Group>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="fundamental" pt="md">
            <Stack gap="sm">
              {isViewingDifferentTier && currentActiveTab === 'fundamental' && (
                <Alert color="yellow" variant="light">
                  <Text size="xs">
                    You have {selectedFocusAreas.length} tag(s) selected from <strong>{getTierDescription(selectedTier).title}</strong>.
                    Selecting a tag here will clear your previous selection.
                  </Text>
                </Alert>
              )}
              <Card withBorder p="xs" style={{ backgroundColor: 'var(--mantine-color-indigo-0)' }}>
                <Stack gap={4}>
                  <Text size="xs" fw={500}>{getTierDescription('fundamental').subtitle}</Text>
                  <Text size="xs" c="dimmed">📊 {getTierDescription('fundamental').difficulty}</Text>
                  <Text size="xs" c="dimmed">🎯 {getTierDescription('fundamental').pool}</Text>
                </Stack>
              </Card>
              <Group gap="xs">
                {tagsByTier.fundamental.length > 0 ? (
                  tagsByTier.fundamental.map(tag => renderTagBadge(tag, 'fundamental'))
                ) : (
                  <Text size="sm" c="dimmed">No tags in this tier</Text>
                )}
              </Group>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="advanced" pt="md">
            <Stack gap="sm">
              {isViewingDifferentTier && currentActiveTab === 'advanced' && (
                <Alert color="yellow" variant="light">
                  <Text size="xs">
                    You have {selectedFocusAreas.length} tag(s) selected from <strong>{getTierDescription(selectedTier).title}</strong>.
                    Selecting a tag here will clear your previous selection.
                  </Text>
                </Alert>
              )}
              <Card withBorder p="xs" style={{ backgroundColor: 'var(--mantine-color-violet-0)' }}>
                <Stack gap={4}>
                  <Text size="xs" fw={500}>{getTierDescription('advanced').subtitle}</Text>
                  <Text size="xs" c="dimmed">📊 {getTierDescription('advanced').difficulty}</Text>
                  <Text size="xs" c="dimmed">🎯 {getTierDescription('advanced').pool}</Text>
                </Stack>
              </Card>
              <Group gap="xs">
                {tagsByTier.advanced.length > 0 ? (
                  tagsByTier.advanced.map(tag => renderTagBadge(tag, 'advanced'))
                ) : (
                  <Text size="sm" c="dimmed">No tags in this tier</Text>
                )}
              </Group>
            </Stack>
          </Tabs.Panel>
        </Tabs>

        {selectedFocusAreas.length > 0 && selectedTier && (
          <Alert color="blue" variant="light">
            <Stack gap={4}>
              <Text size="xs" fw={500}>Selected: {selectedFocusAreas.length}/3 tags from {getTierDescription(selectedTier).title}</Text>
              <Text size="xs">
                Your sessions will focus on {selectedFocusAreas.join(', ')} with {getTierDescription(selectedTier).difficulty.toLowerCase()}
              </Text>
            </Stack>
          </Alert>
        )}
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