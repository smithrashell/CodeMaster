import React, { useState } from "react";
import { Card, Stack, Group, Box } from '../ui/Layout.jsx';
import Text from '../ui/Text.jsx';
import Badge from '../ui/Badge.jsx';
import Alert from '../ui/Alert.jsx';
import Loader from '../ui/Loader.jsx';
import Collapse from '../ui/Collapse.jsx';
import {
  IconBulb,
  IconChevronDown,
  IconChevronUp,
  IconInfoCircle,
} from "@tabler/icons-react";
import { useStrategy } from "../../../shared/hooks/useStrategy";

/**
 * Renders the header section with clickable tags
 */
const renderHeader = ({ totalHints, problemTags, isExpanded, setIsExpanded }) => (
  <Group justify="space-between" gap="xs">
    <Group gap="xs">
      <IconBulb size={16} color="#ffd43b" />
      <Text size="sm" fw={500} style={{ color: "var(--cm-text, #000)" }}>
        Strategy Hints
      </Text>
      {totalHints > 0 && (
        <Badge size="xs" variant="filled" color="blue">
          {totalHints}
        </Badge>
      )}
    </Group>
    <Group gap="xs">
      {problemTags.slice(0, 3).map((tag) => (
        <Badge 
          key={tag} 
          size="xs" 
          variant="light" 
          color="blue"
          style={{ 
            cursor: "pointer",
            backgroundColor: "var(--cm-dropdown-bg, #f0f0f0)",
            color: "var(--cm-text, #000)",
            border: "1px solid var(--cm-border, #ddd)"
          }}
          onClick={() => setIsExpanded(!isExpanded)}
          title={`Click to ${isExpanded ? "hide" : "show"} ${tag} strategy hints`}
        >
          {tag}
        </Badge>
      ))}
      {isExpanded ? (
        <IconChevronUp size={12} style={{ color: "var(--cm-text, #666)" }} />
      ) : (
        <IconChevronDown size={12} style={{ color: "var(--cm-text, #666)" }} />
      )}
    </Group>
  </Group>
);

/**
 * Renders contextual hints section
 */
const renderContextualHints = (contextualHints) => (
  <>
    <Text size="xs" fw={600} c="blue" tt="uppercase">
      Multi-Tag Strategies
    </Text>
    {contextualHints.map((hint, index) => (
      <Box
        key={`contextual-${index}`}
        p="xs"
        style={{
          backgroundColor: "var(--cm-hint-bg, #e7f5ff)",
          borderRadius: "6px",
          border: "1px solid var(--cm-hint-border, #d0ebff)",
          color: "var(--cm-text, #000)"
        }}
      >
        <Group gap="xs" mb="xs">
          <Badge size="xs" variant="filled" color="blue">
            {hint.primaryTag}
          </Badge>
          <Text size="xs" c="dimmed">
            +
          </Text>
          <Badge size="xs" variant="outline" color="blue">
            {hint.relatedTag}
          </Badge>
          {hint.relationshipScore > 0 && (
            <Badge size="xs" variant="dot" color="green">
              {hint.relationshipScore}
            </Badge>
          )}
        </Group>
        <Text size="sm" lh={1.4} c="dark">
          {hint.tip}
        </Text>
      </Box>
    ))}
  </>
);

/**
 * Renders general hints section
 */
const renderGeneralHints = (generalHints) => (
  <>
    <Text size="xs" fw={600} c="gray" tt="uppercase">
      General Strategies
    </Text>
    {generalHints.map((hint, index) => (
      <Box
        key={`general-${index}`}
        p="xs"
        style={{
          backgroundColor: "var(--cm-dropdown-bg, #f8f9fa)",
          borderRadius: "6px",
          border: "1px solid var(--cm-border, #e9ecef)",
          color: "var(--cm-text, #000)"
        }}
      >
        <Group gap="xs" mb="xs">
          <Badge size="xs" variant="light" color="gray">
            {hint.primaryTag}
          </Badge>
          {hint.relatedTag && (
            <>
              <Text size="xs" c="dimmed">
                pattern:
              </Text>
              <Badge size="xs" variant="outline" color="orange">
                {hint.relatedTag}
              </Badge>
            </>
          )}
        </Group>
        <Text size="sm" lh={1.4} c="dark">
          {hint.tip}
        </Text>
      </Box>
    ))}
  </>
);

/**
 * Renders the expanded content section
 */
const renderExpandedContent = ({ loading, error, hints, contextualHints, generalHints }) => (
  <Box mt="sm" pt="sm" style={{ borderTop: "1px solid #e9ecef" }}>
    {loading && (
      <Group justify="center" p="sm">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">
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
      <Text size="sm" c="dimmed" ta="center" p="sm">
        No strategy hints available.
      </Text>
    )}
    {!loading && !error && hints.length > 0 && (
      <Stack gap="xs">
        {contextualHints.length > 0 && renderContextualHints(contextualHints)}
        {generalHints.length > 0 && (
          <>
            {contextualHints.length > 0 && (
              <Box style={{ height: "0.5rem" }} />
            )}
            {renderGeneralHints(generalHints)}
          </>
        )}
      </Stack>
    )}
  </Box>
);

/**
 * CompactHintPanel - Inline hint panel that fits well within timer layout
 * Shows strategy hints without overlapping other controls
 */
const CompactHintPanel = ({ problemTags = [], className = "" }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Use existing useStrategy hook instead of duplicating state management
  const { hints, loading, error, contextualHints, generalHints } = useStrategy(problemTags);
  
  console.log("💡 CompactHintPanel render:", {
    problemTags,
    hintsCount: hints.length,
    contextualCount: contextualHints.length,
    generalCount: generalHints.length,
    loading,
    error,
    isExpanded
  });

  if (problemTags.length === 0) {
    return null;
  }

  const totalHints = hints.length;

  return (
    <Box className={className} style={{ width: "100%", marginTop: "0.5rem" }}>
      <Card
        shadow="sm"
        padding="xs"
        radius="md"
        withBorder
        style={{
          backgroundColor: "var(--cm-dropdown-bg, #f8f9fa)",
          border: "1px solid var(--cm-border, #e9ecef)",
          color: "var(--cm-text, #000)"
        }}
      >
        {renderHeader({ totalHints, problemTags, isExpanded, setIsExpanded })}
        <Collapse in={isExpanded}>
          {renderExpandedContent({ loading, error, hints, contextualHints, generalHints })}
        </Collapse>
      </Card>
    </Box>
  );
};

export default CompactHintPanel;
