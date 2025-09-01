/**
 * FloatingHintPopoverContent - Extracted content for FloatingHintButton popover
 */
import React from "react";
import {
  Stack,
  Text,
  Badge,
  Group,
  Loader,
  Alert,
} from "@mantine/core";
import { IconBulb, IconInfoCircle } from "@tabler/icons-react";
import { HintsSection } from './HintsSection.jsx';
import { getAlertMessage, shouldShowAlert } from './floatingHintHelpers.js';

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
  return (
    <div style={{ padding: "16px" }}>
      {/* Header */}
      <Group justify="space-between" mb="sm">
        <Group gap="xs">
          <IconBulb size={20} color="#ffd43b" />
          <Text fw={600} size="sm" c={colors.text}>
            Strategy Hints
          </Text>
          {interviewRestrictions.isInterviewMode && (
            <Badge size="xs" color="orange" variant="light">
              Interview Mode
            </Badge>
          )}
        </Group>
        <Group gap="xs">
          {problemTags.map((tag) => (
            <Badge key={tag} size="xs" variant="light">
              {tag}
            </Badge>
          ))}
        </Group>
      </Group>

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

      {loading && (
        <Group justify="center" p="md">
          <Loader size="sm" />
          <Text size="sm" c={colors.text} style={{ opacity: 0.7 }}>
            Loading...
          </Text>
        </Group>
      )}

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
        <Text size="sm" c={colors.text} ta="center" p="md" style={{ opacity: 0.7 }}>
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