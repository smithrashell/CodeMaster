import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  Text,
  Badge,
  Button,
  Collapse,
  Stack,
  Group,
  Loader,
  Alert,
} from "@mantine/core";
import {
  IconBulb,
  IconChevronDown,
  IconChevronUp,
  IconInfoCircle,
} from "@tabler/icons-react";
import StrategyService from "../../services/strategyService";
import { HintInteractionService } from "../../../shared/services/hintInteractionService";

// Helper component for rendering panel content
const PanelContent = ({ loading, error, hints, isExpanded }) => (
  <Collapse in={isExpanded}>
    {loading && (
      <Group justify="center" p="md">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">
          Loading strategy hints...
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
      <Text size="sm" c="dimmed" ta="center" p="md">
        No strategy hints available for these tags.
      </Text>
    )}

    {!loading && !error && hints.length > 0 && (
      <HintsSections 
        contextualHints={hints.filter((hint) => hint.type === "contextual")} 
        generalHints={hints.filter((hint) => hint.type === "general")} 
      />
    )}
  </Collapse>
);

/**
 * HintPanel - Real-time context-aware strategy hints during problem solving
 * Shows strategies based on current problem's tags
 */
const HintPanel = ({
  problemTags = [],
  problemId = null,
  isVisible = true,
  className = "",
}) => {
  const [hints, setHints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Load contextual hints when problem tags change
  useEffect(() => {
    if (problemTags.length > 0) {
      loadHints();
    } else {
      setHints([]);
    }
  }, [problemTags, loadHints]);

  const loadHints = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Use optimized cached service with performance monitoring
      const contextualHints = await StrategyService.getContextualHints(
        problemTags
      );
      setHints(contextualHints);
    } catch (err) {
      console.error("Error loading hints:", err);
      setError("Failed to load strategy hints");
    } finally {
      setLoading(false);
    }
  }, [problemTags]);

  // Track panel expand/collapse actions
  const handlePanelToggle = async () => {
    const newExpandedState = !isExpanded;
    setIsExpanded(newExpandedState);

    // Track the panel interaction
    try {
      await HintInteractionService.saveHintInteraction({
        problemId: problemId || "unknown",
        hintId: "hint-panel",
        hintType: "panel",
        primaryTag: problemTags[0] || "unknown",
        relatedTag: problemTags.length > 1 ? problemTags[1] : null,
        content: `Hint panel ${newExpandedState ? "expanded" : "collapsed"}`,
        problemTags: problemTags,
        action: newExpandedState ? "expand" : "collapse",
        sessionContext: {
          panelOpen: newExpandedState,
          totalHints: hints.length,
          componentType: "HintPanel",
        },
      });
    } catch (error) {
      console.warn("Failed to track hint panel interaction:", error);
    }
  };

  if (!isVisible || problemTags.length === 0) {
    return null;
  }

  return (
    <Card
      shadow="sm"
      padding="md"
      radius="md"
      withBorder
      className={className}
      style={{ marginBottom: "1rem" }}
    >
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <IconBulb size={20} color="#ffd43b" />
          <Text weight={500} size="sm">
            Strategy Hints
          </Text>
          {hints.length > 0 && (
            <Badge size="xs" variant="light" color="blue">
              {hints.length}
            </Badge>
          )}
        </Group>

        <Button
          variant="subtle"
          size="xs"
          onClick={handlePanelToggle}
          rightSection={
            isExpanded ? (
              <IconChevronUp size={14} />
            ) : (
              <IconChevronDown size={14} />
            )
          }
        >
          {isExpanded ? "Hide" : "Show"} Hints
        </Button>
      </Group>

      <PanelContent 
        loading={loading}
        error={error}
        hints={hints}
        isExpanded={isExpanded}
      />
    </Card>
  );
};

// Helper component for rendering hints sections
const HintsSections = ({ contextualHints, generalHints }) => (
  <Stack gap="sm">
    {/* Contextual hints (higher priority) */}
    {contextualHints.length > 0 && (
      <>
        <Text size="xs" weight={500} c="blue" tt="uppercase">
          Multi-Tag Strategies
        </Text>
        {contextualHints.map((hint, index) => (
          <Card
            key={`contextual-${index}`}
            p="sm"
            radius="sm"
            bg="blue.0"
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
            </Group>
            <Text size="sm" lh={1.4}>
              {hint.tip}
            </Text>
          </Card>
        ))}
      </>
    )}

    {/* General hints */}
    {generalHints.length > 0 && (
      <>
        {contextualHints.length > 0 && (
          <div style={{ marginTop: "0.5rem" }} />
        )}
        <Text size="xs" weight={500} c="gray" tt="uppercase">
          General Strategies
        </Text>
        {generalHints.map((hint, index) => (
          <Card key={`general-${index}`} p="sm" radius="sm" bg="gray.0">
            <Group gap="xs" mb="xs">
              <Badge size="xs" variant="light" color="gray">
                {hint.primaryTag}
              </Badge>
            </Group>
            <Text size="sm" lh={1.4}>
              {hint.tip}
            </Text>
          </Card>
        ))}
      </>
    )}
  </Stack>
);

export default HintPanel;
