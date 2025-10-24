import React from "react";
import { debug as _debug } from "../../../shared/utils/logger.js";
import {
  Card,
  Alert,
  Stack,
  Group,
  Button,
} from "@mantine/core";
import {
  loadFocusAreasData,
  saveFocusAreasSettings,
  resetFocusAreasSettings,
  setupAttemptUpdateListener as _setupAttemptUpdateListener,
  getTagMasteryProgress,
  getTagOptions as _getTagOptions,
  useFocusAreasState,
  useFocusAreasLifecycle,
} from "./focusAreasHelpers.js";
import {
  SystemRecommendationsSection,
  ActiveSessionTagsPreview,
  MasteredTagsDisplay,
  LoadingState,
  HeaderSection,
  CurrentFocusAreasSection,
  SystemOverviewSection,
} from "./FocusAreasRenderHelpers.jsx";
import {
  TierTagsVisualization,
} from "./FocusAreasSelectorRenderHelpers.jsx";
// Note: Using Chrome messaging for all service calls to comply with extension architecture
// All database access goes through background script



export function FocusAreasSelector() {
  const {
    availableTags: _availableTags, setAvailableTags,
    selectedFocusAreas, setSelectedFocusAreas,
    currentTier, setCurrentTier,
    masteredTags, setMasteredTags,
    masteryData, setMasteryData,
    currentSessionTags, setCurrentSessionTags,
    focusAvailability, setFocusAvailability,
    showCustomMode: _showCustomMode, setShowCustomMode,
    loading, setLoading,
    saving, setSaving,
    error, setError,
    hasChanges, setHasChanges
  } = useFocusAreasState();

  // Track which tier the user is selecting from
  const [selectedTier, setSelectedTier] = React.useState(null);

  // Track which tab is currently being viewed (for browsing)
  const [activeTab, setActiveTab] = React.useState(null);

  // Track explanation expand/collapse
  const [showExplanation, setShowExplanation] = React.useState(false);

  // Helper function wrapper for the extracted function
  const getTagMasteryProgressWrapper = (tagName) => getTagMasteryProgress(tagName, masteryData);

  // Memoize stateSets to prevent recreation on every render
  const stateSets = React.useMemo(() => ({
    setLoading, setError, setFocusAvailability, setCurrentTier, setShowCustomMode,
    setAvailableTags, setMasteredTags, setMasteryData, setSelectedFocusAreas, setCurrentSessionTags, setHasChanges,
  }), [setLoading, setError, setFocusAvailability, setCurrentTier, setShowCustomMode,
       setAvailableTags, setMasteredTags, setMasteryData, setSelectedFocusAreas, setCurrentSessionTags, setHasChanges]);

  useFocusAreasLifecycle(focusAvailability, setFocusAvailability, loadFocusAreasData, stateSets);

  const handleFocusAreasChange = (values) => {
    // Limit to maximum 3 focus areas
    const limitedValues = values.slice(0, 3);
    setSelectedFocusAreas(limitedValues);
    setHasChanges(true);
  };

  const handleTierChange = (newTier) => {
    // Just change the active tab for browsing
    setActiveTab(newTier);
  };

  const handleSave = async () => {
    const setters = { setSaving, setError, setHasChanges };
    await saveFocusAreasSettings(selectedFocusAreas, selectedTier, setters);
  };

  const handleReset = async () => {
    const setters = { setError, setSelectedFocusAreas, setHasChanges };
    await resetFocusAreasSettings(setters);
  };


  if (loading) {
    return <LoadingState />;
  }

  return (
    <Card withBorder p="md">
      <Stack gap="md">
        <HeaderSection currentTier={currentTier} />

        {/* System Overview - How Focus Areas Work */}
        <SystemOverviewSection
          showExplanation={showExplanation}
          onToggle={() => setShowExplanation(!showExplanation)}
        />

        {/* Current Focus Areas - MOVED TO TOP for visibility */}
        <CurrentFocusAreasSection
          currentSessionTags={currentSessionTags}
          getTagMasteryProgress={getTagMasteryProgressWrapper}
        />

        <SystemRecommendationsSection focusAvailability={focusAvailability} />

        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}

        {/* Tier Classification Visualization */}
        <TierTagsVisualization
          focusAvailability={focusAvailability}
          currentTier={currentTier}
          selectedFocusAreas={selectedFocusAreas}
          masteryData={masteryData}
          onFocusAreasChange={handleFocusAreasChange}
          selectedTier={selectedTier}
          onTierChange={handleTierChange}
          activeTab={activeTab}
          onSelectedTierChange={setSelectedTier}
        />

        {/* Your Next Session Will Focus - REACTIVE to selectedFocusAreas */}
        <ActiveSessionTagsPreview
          selectedFocusAreas={selectedFocusAreas}
          systemSelectedTags={focusAvailability.systemSelectedTags}
        />

        {/* Save/Reset Controls */}
        <Group justify="flex-end" mt="md">
          {hasChanges && (
            <Button
              variant="subtle"
              color="gray"
              onClick={handleReset}
              disabled={saving}
            >
              Reset
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            loading={saving}
          >
            Save Focus Areas
          </Button>
        </Group>

        <MasteredTagsDisplay masteredTags={masteredTags} />

      </Stack>
    </Card>
  );
}