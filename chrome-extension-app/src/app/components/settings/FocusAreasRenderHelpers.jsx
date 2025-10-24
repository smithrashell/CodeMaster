import React from "react";
import {
  Group,
  Badge,
  Button,
  Alert,
  Stack,
  Text,
  Tooltip,
  Loader,
  Title,
  Card,
  Collapse,
} from "@mantine/core";
import { IconTrophy as IconTrophyIcon, IconRefresh, IconTarget, IconInfoCircle } from "@tabler/icons-react";

// Helper render component for selected tag badges
export const SelectedTagBadges = ({ selectedFocusAreas, getTagMasteryProgress }) => {
  if (!Array.isArray(selectedFocusAreas) || selectedFocusAreas.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No focus areas selected
      </Text>
    );
  }

  return (
    <Group gap="xs">
      {selectedFocusAreas.map((tag) => {
        const progress = getTagMasteryProgress(tag);
        return (
          <Tooltip
            key={tag}
            label={`${tag}: ${progress}% mastery`}
            position="top"
          >
            <Badge
              variant="light"
              color={progress >= 70 ? "green" : progress >= 40 ? "blue" : "gray"}
              leftSection={
                progress >= 70 ? <IconTrophyIcon size={12} /> : null
              }
            >
              {tag.charAt(0).toUpperCase() + tag.slice(1).replace(/[-_]/g, " ")}
            </Badge>
          </Tooltip>
        );
      })}
    </Group>
  );
};

// Loading state component
export const LoadingState = () => (
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

// Header section component
export const HeaderSection = ({ currentTier }) => (
  <>
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
  </>
);

// System overview explanation section
export const SystemOverviewSection = ({ showExplanation, onToggle }) => (
  <Alert icon={<IconInfoCircle />} color="blue" variant="light">
    <Group justify="space-between" wrap="nowrap">
      <div>
        <Text size="sm" fw={500}>How Focus Areas Work</Text>
        <Text size="xs" c="dimmed">
          Our algorithm adapts your practice based on performance and learning patterns
        </Text>
      </div>
      <Button variant="subtle" size="xs" onClick={onToggle}>
        {showExplanation ? 'Hide' : 'Learn More'}
      </Button>
    </Group>

    <Collapse in={showExplanation}>
      <Stack gap="xs" mt="sm">
        <Text size="xs">
          <Text component="span" fw={500}>1. Current Focus Areas:</Text> What you&apos;re actively practicing right now.
          These update automatically based on your performance (e.g., if you master a tag, we&apos;ll add a new challenge).
        </Text>
        <Text size="xs">
          <Text component="span" fw={500}>2. System Recommendations:</Text> Tags our algorithm selected using pattern
          recognition, relationship mapping, and your success rates. These are purely algorithmic picks.
        </Text>
        <Text size="xs">
          <Text component="span" fw={500}>3. Your Selections:</Text> Choose 1-3 tags to prioritize. Your selections get
          20% more weight in problem selection, but the algorithm still ensures balanced learning.
        </Text>
        <Text size="xs">
          <Text component="span" fw={500}>4. Next Session Preview:</Text> Shows exactly which tags will be active when
          you generate your next session (combines your preferences with algorithm picks).
        </Text>
      </Stack>
    </Collapse>
  </Alert>
);

// Current focus areas section - Shows what's ACTIVE in current session
export const CurrentFocusAreasSection = ({ currentSessionTags, getTagMasteryProgress }) => (
  <Stack gap="xs">
    <Group gap="xs" align="center">
      <Text size="sm" fw={500}>Current Focus Areas</Text>
      <Badge size="xs" color="green" variant="light">Active Now</Badge>
      <Tooltip
        multiline
        w={280}
        label="This shows what's currently active in your session. It updates automatically based on your performance - you can't directly edit this. When you master tags or show significant progress, the algorithm will adapt your focus areas."
      >
        <IconInfoCircle size={14} style={{ cursor: "help" }} />
      </Tooltip>
    </Group>
    <Text size="xs" c="dimmed">
      Based on your performance and mastery progress. <Text component="span" fw={500}>Updates automatically</Text> when you complete sessions.
    </Text>
    <SelectedTagBadges selectedFocusAreas={currentSessionTags} getTagMasteryProgress={getTagMasteryProgress} />
  </Stack>
);

// System recommendations and tier access badges
export const SystemRecommendationsSection = ({ focusAvailability }) => (
  <>
    {/* System Recommendations - Always Show */}
    <div>
      <Group gap="xs" mb="xs">
        <Text size="sm" fw={500}>System Recommendations</Text>
        <Badge variant="light" color="cyan" size="xs">
          Algorithm Selected
        </Badge>
        <Tooltip
          multiline
          w={320}
          label="These tags were intelligently selected using: (1) Pattern relationships - tags connected to what you've practiced, (2) Your success rates and attempt history, (3) Optimal learning zones - not too easy, not too hard. The algorithm picks these regardless of your manual selections."
        >
          <IconInfoCircle size={14} style={{ cursor: "help" }} />
        </Tooltip>
      </Group>
      <Group gap="xs">
        {(focusAvailability?.systemSelectedTags || []).length > 0 ? (
          focusAvailability.systemSelectedTags.map((tag, index) => (
            <Badge key={index} variant="light" color="cyan" size="sm">
              {tag.charAt(0).toUpperCase() + tag.slice(1).replace(/[-_]/g, " ")}
            </Badge>
          ))
        ) : (
          <Text size="xs" c="dimmed">No system recommendations available</Text>
        )}
      </Group>
      <Text size="xs" c="dimmed" mt="xs">
        Chosen by analyzing your <Text component="span" fw={500}>performance patterns</Text>,{' '}
        <Text component="span" fw={500}>tag relationships</Text>, and{' '}
        <Text component="span" fw={500}>learning velocity</Text>
      </Text>
    </div>

    {focusAvailability?.access && (
      <Group gap="xs">
        <Badge 
          color="green" 
          size="sm"
          variant="filled"
        >
          Core: {focusAvailability.access.core}
        </Badge>
        {focusAvailability.access.fundamental !== "none" && (
          <Badge 
            color={focusAvailability.access.fundamental === "confirmed" ? "blue" : "yellow"} 
            size="sm"
            variant="light"
          >
            Fundamental: {focusAvailability.access.fundamental}
          </Badge>
        )}
        {focusAvailability.access.advanced !== "none" && (
          <Badge 
            color={focusAvailability.access.advanced === "confirmed" ? "purple" : "yellow"} 
            size="sm"
            variant="light"
          >
            Advanced: {focusAvailability.access.advanced}
          </Badge>
        )}
      </Group>
    )}
  </>
);

// Active session tags preview section - REACTIVE to user selections
export const ActiveSessionTagsPreview = ({ selectedFocusAreas, systemSelectedTags }) => {
  // Show selected tags if user has any, otherwise show system recommendations
  const previewTags = selectedFocusAreas.length > 0
    ? selectedFocusAreas
    : systemSelectedTags;

  if (!previewTags || previewTags.length === 0) {
    return null;
  }

  const isUserSelection = selectedFocusAreas.length > 0;

  return (
    <Stack gap="xs">
      <Group gap="xs" align="center">
        <Text size="sm" fw={500}>Your next session will focus on:</Text>
        <Badge
          size="sm"
          color={isUserSelection ? "violet" : "blue"}
          variant="light"
        >
          {isUserSelection ? "Your Preferences" : "System Recommended"}
        </Badge>
      </Group>
      <Group gap="xs">
        {previewTags.map((tag) => (
          <Badge
            key={tag}
            color={isUserSelection ? "violet" : "cyan"}
            variant="filled"
            size="sm"
          >
            {tag.charAt(0).toUpperCase() + tag.slice(1).replace(/[-_]/g, " ")}
          </Badge>
        ))}
      </Group>
      <Text size="xs" c="dimmed">
        {isUserSelection
          ? "Your selections get 20% higher weight in problem selection, but the algorithm ensures you still practice related patterns for complete mastery."
          : "Pure algorithm selection based on your learning efficiency and pattern recognition progress. Select tags above to add your preferences."
        }
      </Text>
    </Stack>
  );
};

// Mastered tags display section
export const MasteredTagsDisplay = ({ masteredTags }) => {
  if (masteredTags.length === 0) {
    return null;
  }

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500} c="green">
        Recently Mastered Tags:
      </Text>
      <Group gap="xs">
        {masteredTags.slice(0, 5).map((tag) => (
          <Badge key={tag} color="green" variant="filled" leftSection={<IconTrophyIcon size={12} />}>
            {tag.charAt(0).toUpperCase() + tag.slice(1).replace(/[-_]/g, " ")}
          </Badge>
        ))}
        {masteredTags.length > 5 && (
          <Text size="sm" c="dimmed">+{masteredTags.length - 5} more</Text>
        )}
      </Group>
    </Stack>
  );
};

// Custom mode toggle and action buttons
export const CustomModeControls = ({ 
  focusAvailability,
  showCustomMode, 
  setShowCustomMode,
  setSelectedFocusAreas,
  setHasChanges,
  handleSave,
  handleReset,
  loadData,
  saving,
  hasChanges,
  loading,
  selectedFocusAreas 
}) => {
  if (!focusAvailability) {
    return null;
  }

  return (
    <>
      {/* Custom/System Mode Toggle */}
      <Group gap="xs">
        <Button
          size="xs"
          variant={showCustomMode ? "light" : "filled"}
          onClick={() => {
            const newCustomMode = !showCustomMode;
            setShowCustomMode(newCustomMode);
            
            if (!newCustomMode) {
              // Switching to system selection - clear user overrides
              setSelectedFocusAreas([]);
              setHasChanges(true);
            } else {
              // Switching to custom mode - start with current user overrides or empty
              setSelectedFocusAreas(focusAvailability?.userOverrideTags || []);
            }
          }}
        >
          {showCustomMode ? "Use System Selection" : "Customize Focus Areas"}
        </Button>
        {showCustomMode && (
          <Text size="xs" c="dimmed">
            Override system selection with your own choices
          </Text>
        )}
      </Group>

      {/* Action Buttons for Custom Mode */}
      {showCustomMode && (
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
      )}

      {/* Impact Alert for Custom Mode */}
      {showCustomMode && selectedFocusAreas.length > 0 && (
        <Alert color="blue" variant="light">
          <Text size="sm">
            <Text component="span" fw={500}>Impact:</Text> Problems with these tags will appear 
            20% more frequently in your practice sessions. The system will still ensure balanced 
            learning across all fundamental concepts.
          </Text>
        </Alert>
      )}
    </>
  );
};