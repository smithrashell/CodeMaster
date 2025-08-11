import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  Text,
  MultiSelect,
  Group,
  Badge,
  Button,
  Loader,
  Alert,
  Tooltip,
  Stack,
  Title,
} from "@mantine/core";
import {
  IconTarget,
  IconRefresh,
  IconInfoCircle,
  IconTrophy,
} from "@tabler/icons-react";
import { TagService } from "../../../shared/services/tagServices.js";
import { StorageService } from "../../../shared/services/storageService.js";
import { shouldUseMockDashboard } from "../../config/mockConfig.js";

export function FocusAreasSelector() {
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedFocusAreas, setSelectedFocusAreas] = useState([]);
  const [currentTier, setCurrentTier] = useState("");
  const [masteredTags, setMasteredTags] = useState([]);
  const [masteryData, setMasteryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Use mock data in development mode
      if (shouldUseMockDashboard()) {
        console.log("🎭 FOCUS AREAS: Using mock data");
        
        // Mock learning state with common algorithm tags
        const mockLearningState = {
          allTagsInCurrentTier: [
            "array", "hash-table", "string", "two-pointers", 
            "binary-search", "sliding-window", "dynamic-programming",
            "greedy", "stack", "queue", "heap", "tree", "graph"
          ],
          currentTier: "Core Concept",
          masteredTags: ["array", "hash-table"], // Only 2 mastered, leaving 11 available
          masteryData: [
            { tag: "array", totalAttempts: 10, successfulAttempts: 9 },
            { tag: "hash-table", totalAttempts: 8, successfulAttempts: 7 },
            { tag: "string", totalAttempts: 5, successfulAttempts: 3 },
            { tag: "two-pointers", totalAttempts: 4, successfulAttempts: 2 },
            { tag: "binary-search", totalAttempts: 3, successfulAttempts: 1 },
            { tag: "sliding-window", totalAttempts: 2, successfulAttempts: 1 },
            { tag: "dynamic-programming", totalAttempts: 6, successfulAttempts: 2 },
            { tag: "greedy", totalAttempts: 3, successfulAttempts: 1 },
            { tag: "stack", totalAttempts: 4, successfulAttempts: 3 },
            { tag: "queue", totalAttempts: 2, successfulAttempts: 1 },
            { tag: "heap", totalAttempts: 3, successfulAttempts: 1 },
            { tag: "tree", totalAttempts: 5, successfulAttempts: 2 },
            { tag: "graph", totalAttempts: 4, successfulAttempts: 1 }
          ]
        };
        
        // Mock settings with some pre-selected focus areas
        const mockSettings = {
          focusAreas: ["string", "two-pointers", "dynamic-programming"]
        };
        
        setAvailableTags(mockLearningState.allTagsInCurrentTier);
        setCurrentTier(mockLearningState.currentTier);
        setMasteredTags(mockLearningState.masteredTags);
        setMasteryData(mockLearningState.masteryData);
        setSelectedFocusAreas(mockSettings.focusAreas);
        setHasChanges(false);
      } else {
        // Load current learning state from TagService
        const learningState = await TagService.getCurrentLearningState();
        const settings = await StorageService.getSettings();

        // Set available tags from current tier
        setAvailableTags(learningState.allTagsInCurrentTier || []);
        setCurrentTier(learningState.currentTier || "Unknown");
        setMasteredTags(learningState.masteredTags || []);
        setMasteryData(learningState.masteryData || []);

        // Load saved focus areas from settings
        const savedFocusAreas = settings.focusAreas || [];
        
        // Filter out mastered tags from saved focus areas
        const activeFocusAreas = savedFocusAreas.filter(
          (tag) => !learningState.masteredTags.includes(tag)
        );
        
        setSelectedFocusAreas(activeFocusAreas);
        setHasChanges(false);
      }
    } catch (err) {
      console.error("Error loading focus areas data:", err);
      setError("Failed to load learning data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFocusAreasChange = (values) => {
    // Limit to maximum 3 focus areas
    const limitedValues = values.slice(0, 3);
    setSelectedFocusAreas(limitedValues);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      if (shouldUseMockDashboard()) {
        console.log("🎭 FOCUS AREAS: Mock save - selected:", selectedFocusAreas);
        // Simulate save delay
        await new Promise(resolve => setTimeout(resolve, 500));
        setHasChanges(false);
      } else {
        const currentSettings = await StorageService.getSettings();
        const updatedSettings = {
          ...currentSettings,
          focusAreas: selectedFocusAreas,
        };

        await StorageService.setSettings(updatedSettings);
        setHasChanges(false);
      }
    } catch (err) {
      console.error("Error saving focus areas:", err);
      setError("Failed to save focus areas. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      const currentSettings = await StorageService.getSettings();
      const updatedSettings = {
        ...currentSettings,
        focusAreas: [],
      };

      await StorageService.setSettings(updatedSettings);
      setSelectedFocusAreas([]);
      setHasChanges(false);
    } catch (err) {
      console.error("Error resetting focus areas:", err);
      setError("Failed to reset focus areas. Please try again.");
    }
  };

  const getTagMasteryProgress = (tagName) => {
    const tagData = masteryData.find((tag) => tag.tag === tagName);
    if (!tagData || tagData.totalAttempts === 0) return 0;
    return Math.round((tagData.successfulAttempts / tagData.totalAttempts) * 100);
  };

  const getTagOptions = () => {
    console.log("🔍 getTagOptions DEBUG:", {
      availableTags: availableTags,
      masteredTags: masteredTags,
      availableCount: availableTags.length,
      masteredCount: masteredTags.length
    });
    
    const filtered = availableTags.filter((tag) => !masteredTags.includes(tag));
    const mapped = filtered.map((tag) => ({
      value: tag,
      label: tag.charAt(0).toUpperCase() + tag.slice(1).replace(/[-_]/g, " "),
    }));
    
    console.log("🏷️ Final tag options:", mapped);
    return mapped;
  };

  const renderSelectedTagBadges = () => {
    if (selectedFocusAreas.length === 0) {
      return (
        <Text size="sm" c="dimmed">
          No focus areas selected. System will use adaptive tag selection.
        </Text>
      );
    }

    return (
      <Group gap="xs">
        {selectedFocusAreas.map((tag) => {
          const progress = getTagMasteryProgress(tag);
          const isMastered = masteredTags.includes(tag);
          
          return (
            <Tooltip 
              key={tag} 
              label={`${progress}% mastery (${isMastered ? "Mastered" : "In Progress"})`}
            >
              <Badge
                color={isMastered ? "green" : progress >= 80 ? "yellow" : progress >= 60 ? "blue" : "gray"}
                variant="light"
                leftSection={isMastered ? <IconTrophy size={12} /> : null}
              >
                {tag.charAt(0).toUpperCase() + tag.slice(1).replace(/[-_]/g, " ")}
                {!isMastered && ` (${progress}%)`}
              </Badge>
            </Tooltip>
          );
        })}
      </Group>
    );
  };

  if (loading) {
    console.log("🔄 FocusAreasSelector: Still loading...");
    return (
      <Card withBorder p="md">
        <Group gap="xs" mb="md">
          <IconTarget size={20} />
          <Title order={4}>Focus Areas</Title>
        </Group>
        <Group justify="center" p="xl">
          <Loader size="md" />
        </Group>
      </Card>
    );
  }

  console.log("📋 FocusAreasSelector: About to render, availableTags:", availableTags.length);

  return (
    <Card withBorder p="md">
      <Stack gap="md">
        <Group gap="xs">
          <IconTarget size={20} />
          <Title order={4}>Focus Areas</Title>
          <Tooltip label="Select 1-3 tags to focus your learning. Selected tags will appear more frequently in practice sessions.">
            <IconInfoCircle size={16} style={{ cursor: "help" }} />
          </Tooltip>
        </Group>

        <Text size="sm" c="dimmed">
          Current Learning Tier: <Text component="span" fw={500}>{currentTier}</Text>
        </Text>

        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}

        <MultiSelect
          label="Select Focus Areas (1-3 tags)"
          placeholder="Choose tags to focus on..."
          data={(() => {
            const options = getTagOptions();
            console.log("📋 MultiSelect data prop:", options);
            
            // FALLBACK: Use static data if options are empty
            if (options.length === 0) {
              console.log("🚨 Using fallback static data for testing");
              return [
                { value: "array", label: "Array" },
                { value: "string", label: "String" },
                { value: "dynamic-programming", label: "Dynamic Programming" },
                { value: "two-pointers", label: "Two Pointers" },
                { value: "binary-search", label: "Binary Search" }
              ];
            }
            
            return options;
          })()}
          value={selectedFocusAreas}
          onChange={handleFocusAreasChange}
          maxValues={3}
          searchable
          clearable
          disabled={loading || saving}
          description="These tags will have 1.2x higher weight in session generation"
          styles={{
            dropdown: {
              zIndex: 1000,
              backgroundColor: 'white !important',
              border: '1px solid #ccc !important',
              color: 'black !important',
            },
            item: {
              backgroundColor: 'white !important',
              color: 'black !important',
              '&[data-hovered]': {
                backgroundColor: '#f0f0f0 !important',
                color: 'black !important',
              },
            }
          }}
        />

        <Stack gap="xs">
          <Text size="sm" fw={500}>Current Focus Areas:</Text>
          {renderSelectedTagBadges()}
        </Stack>

        {masteredTags.length > 0 && (
          <Stack gap="xs">
            <Text size="sm" fw={500} c="green">
              Recently Mastered Tags:
            </Text>
            <Group gap="xs">
              {masteredTags.slice(0, 5).map((tag) => (
                <Badge key={tag} color="green" variant="filled" leftSection={<IconTrophy size={12} />}>
                  {tag.charAt(0).toUpperCase() + tag.slice(1).replace(/[-_]/g, " ")}
                </Badge>
              ))}
              {masteredTags.length > 5 && (
                <Text size="sm" c="dimmed">+{masteredTags.length - 5} more</Text>
              )}
            </Group>
          </Stack>
        )}

        <Group justify="space-between">
          <Group gap="xs">
            <Button
              onClick={handleSave}
              loading={saving}
              disabled={!hasChanges || loading}
              size="sm"
            >
              Save Changes
            </Button>
            
            <Button
              variant="light"
              onClick={handleReset}
              disabled={selectedFocusAreas.length === 0 || loading || saving}
              size="sm"
            >
              Clear All
            </Button>
          </Group>

          <Button
            variant="subtle"
            onClick={loadData}
            disabled={loading || saving}
            size="sm"
            leftSection={<IconRefresh size={16} />}
          >
            Refresh
          </Button>
        </Group>

        {selectedFocusAreas.length > 0 && (
          <Alert color="blue" variant="light">
            <Text size="sm">
              <Text component="span" fw={500}>Impact:</Text> Problems with these tags will appear 
              20% more frequently in your practice sessions. The system will still ensure balanced 
              learning across all fundamental concepts.
            </Text>
          </Alert>
        )}
      </Stack>
    </Card>
  );
}