import React from "react";
import { debug as _debug } from "../../../shared/utils/logger.js";
import {
  Card,
  Alert,
  Stack,
} from "@mantine/core";
import {
  loadFocusAreasData,
  saveFocusAreasSettings,
  resetFocusAreasSettings,
  setupAttemptUpdateListener as _setupAttemptUpdateListener,
  getTagMasteryProgress,
  getTagOptions,
  useFocusAreasState,
  useFocusAreasLifecycle,
} from "./focusAreasHelpers.js";
import {
  SystemRecommendationsSection,
  ActiveSessionTagsPreview,
  MasteredTagsDisplay,
  CustomModeControls,
  SelectedTagBadges as _SelectedTagBadges,
  LoadingState,
  HeaderSection,
  CurrentFocusAreasSection,
} from "./FocusAreasRenderHelpers.jsx";
import {
  renderFocusAreasSelector,
} from "./FocusAreasSelectorRenderHelpers.jsx";
// Note: Using Chrome messaging for all service calls to comply with extension architecture
// All database access goes through background script



export function FocusAreasSelector() {
  const {
    availableTags, setAvailableTags,
    selectedFocusAreas, setSelectedFocusAreas,
    currentTier, setCurrentTier,
    masteredTags, setMasteredTags,
    masteryData, setMasteryData,
    focusAvailability, setFocusAvailability,
    showCustomMode, setShowCustomMode,
    loading, setLoading,
    saving, setSaving,
    error, setError,
    hasChanges, setHasChanges
  } = useFocusAreasState();

  // Helper function wrappers for the extracted functions
  const getTagMasteryProgressWrapper = (tagName) => getTagMasteryProgress(tagName, masteryData);
  const getTagOptionsWrapper = () => getTagOptions(focusAvailability, availableTags, masteredTags, masteryData);

  // Lifecycle hooks setup
  const stateSets = {
    setLoading, setError, setFocusAvailability, setCurrentTier, setShowCustomMode,
    setAvailableTags, setMasteredTags, setMasteryData, setSelectedFocusAreas, setHasChanges,
  };
  const { loadData } = useFocusAreasLifecycle(focusAvailability, setFocusAvailability, loadFocusAreasData, stateSets);

  const handleFocusAreasChange = (values) => {
    // Limit to maximum 3 focus areas
    const limitedValues = values.slice(0, 3);
    setSelectedFocusAreas(limitedValues);
    setHasChanges(true);
  };

  const handleSave = async () => {
    const setters = { setSaving, setError, setHasChanges };
    await saveFocusAreasSettings(selectedFocusAreas, setters);
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

        <SystemRecommendationsSection focusAvailability={focusAvailability} />

        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}

        <ActiveSessionTagsPreview focusAvailability={focusAvailability} showCustomMode={showCustomMode} />

        <CustomModeControls
          focusAvailability={focusAvailability}
          showCustomMode={showCustomMode}
          setShowCustomMode={setShowCustomMode}
          setSelectedFocusAreas={setSelectedFocusAreas}
          setHasChanges={setHasChanges}
          handleSave={handleSave}
          handleReset={handleReset}
          loadData={loadData}
          saving={saving}
          hasChanges={hasChanges}
          loading={loading}
          selectedFocusAreas={selectedFocusAreas}
        />

        {renderFocusAreasSelector(
          getTagOptionsWrapper,
          focusAvailability,
          selectedFocusAreas,
          handleFocusAreasChange,
          showCustomMode
        )}

        <CurrentFocusAreasSection 
          selectedFocusAreas={selectedFocusAreas} 
          getTagMasteryProgress={getTagMasteryProgressWrapper} 
        />

        <MasteredTagsDisplay masteredTags={masteredTags} />

      </Stack>
    </Card>
  );
}