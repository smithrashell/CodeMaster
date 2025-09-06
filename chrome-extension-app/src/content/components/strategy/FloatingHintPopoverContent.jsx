/**
 * FloatingHintPopoverContent - Extracted content for FloatingHintButton popover
 */
import React from "react";
import { Stack, Group } from '../ui/Layout.jsx';
import Text from '../ui/Text.jsx';
import Badge from '../ui/Badge.jsx';
import Alert from '../ui/Alert.jsx';
import Loader from '../ui/Loader.jsx';
import { IconBulb, IconInfoCircle } from "@tabler/icons-react";
import { HintsSection } from './HintsSection.jsx';
import { getAlertMessage, shouldShowAlert } from './floatingHintHelpers.js';

// Helper components for better maintainability and reduced line count
const PopoverHeader = ({ colors, interviewRestrictions, problemTags }) => (
  <Stack gap="xs" mb="lg">
    <Group gap="xs">
      <IconBulb size={20} color="#ffd43b" />
      <Text fw={600} size="sm" c={colors.textColor} style={{ color: colors.textColor + " !important" }}>
        Strategy Hints
      </Text>
      {interviewRestrictions.isInterviewMode && (
        <Badge size="xs" color="orange" variant="light">
          Interview Mode
        </Badge>
      )}
    </Group>
    {problemTags.length > 0 && (
      <Group gap="xs" wrap={true}>
        {problemTags.map((tag) => (
          <Badge key={tag} size="xs" variant="light">
            {tag}
          </Badge>
        ))}
      </Group>
    )}
  </Stack>
);

const LoadingState = ({ colors }) => (
  <Group justify="center" p="md">
    <Loader size="sm" />
    <Text size="sm" c={colors.textColor} style={{ opacity: 0.7, color: colors.textColor + " !important" }}>
      Loading...
    </Text>
  </Group>
);

const FloatingHintPopoverContent = ({
  loading,
  error,
  hints,
  colors,
  problemTags,
  interviewRestrictions,
  generalHints,
  contextualHints,
  expandedHints,
  toggleHintExpansion,
  onHintClick,
  getHintId
}) => {
  console.log("💡 FloatingHintPopoverContent received props:", {
    loading,
    error,
    hintsCount: hints?.length || 0,
    hints,
    generalHintsCount: generalHints?.length || 0,
    generalHints,
    contextualHintsCount: contextualHints?.length || 0,
    contextualHints,
    colors,
    problemTags,
    expandedHints
  });
  
  return (
    <div style={{ 
      padding: "16px",
      backgroundColor: colors.expandedBg || "#ffffff",
      color: colors.textColor || "#000000",
      border: `1px solid ${colors.borderColor || "#cccccc"}`,
      borderRadius: "8px"
    }}>
      {/* Header */}
      <PopoverHeader 
        colors={colors} 
        interviewRestrictions={interviewRestrictions} 
        problemTags={problemTags} 
      />

      {/* Interview restrictions warning */}
      {shouldShowAlert(interviewRestrictions) && (
        <Alert
          color="orange"
          variant="light"
          mb="sm"
          styles={{ body: { fontSize: '12px' } }}
        >
          {getAlertMessage(interviewRestrictions)}
        </Alert>
      )}

      {loading && <LoadingState colors={colors} />}

      {error && (
        <Alert
          icon={<IconInfoCircle size={16} />}
          color="red"
          variant="light"
          mb="sm"
        >
          {error}
        </Alert>
      )}

      {!loading && !error && hints.length === 0 && (
        <Text size="sm" c={colors.textColor} ta="center" p="md" style={{ opacity: 0.7, color: colors.textColor + " !important" }}>
          No strategy hints available.
        </Text>
      )}

      {!loading && !error && hints.length > 0 && (
        <Stack gap="xs">
          <HintsSection
            title="Multi-Tag Strategies"
            hints={contextualHints}
            hintType="contextual"
            themeColors={colors}
            expandedHints={expandedHints}
            onToggleHint={toggleHintExpansion}
            onHintClick={onHintClick}
            getHintId={getHintId}
            interviewRestrictions={interviewRestrictions}
          />
          
          <HintsSection
            title="General Strategies"
            hints={generalHints}
            hintType="general"
            themeColors={colors}
            expandedHints={expandedHints}
            onToggleHint={toggleHintExpansion}
            onHintClick={onHintClick}
            getHintId={getHintId}
            interviewRestrictions={interviewRestrictions}
          />
        </Stack>
      )}
    </div>
  );
};

export default FloatingHintPopoverContent;