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
  Box,
} from "@mantine/core";
import {
  IconBulb,
  IconChevronDown,
  IconChevronUp,
  IconInfoCircle,
} from "@tabler/icons-react";
import StrategyService from "../../services/strategyService";

/**
 * CompactHintPanel - Inline hint panel that fits well within timer layout
 * Shows strategy hints without overlapping other controls
 */
const CompactHintPanel = ({ problemTags = [], className = "" }) => {
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

      console.log("🔍 CompactHintPanel loading hints for tags:", problemTags);
      const contextualHints = await StrategyService.getContextualHints(
        problemTags
      );
      console.log("💡 CompactHintPanel received hints:", contextualHints);
      setHints(contextualHints);
    } catch (err) {
      console.error("❌ Error loading hints in CompactHintPanel:", err);
      setError("Failed to load strategy hints");
    } finally {
      setLoading(false);
    }
  }, [problemTags]);

  if (problemTags.length === 0) {
    return null;
  }

  const generalHints = hints.filter(
    (hint) => hint.type === "general" || hint.type === "pattern"
  );
  const contextualHints = hints.filter((hint) => hint.type === "contextual");
  const totalHints = hints.length;

  return (
    <Box className={className} style={{ width: "100%", marginTop: "0.5rem" }}>
      {/* Compact header - always visible */}
      <Card
        shadow="sm"
        padding="xs"
        radius="md"
        withBorder
        style={{
          backgroundColor: "#f8f9fa",
          border: "1px solid #e9ecef",
        }}
      >
        <Group justify="space-between" gap="xs">
          <Group gap="xs">
            <IconBulb size={16} color="#ffd43b" />
            <Text size="sm" fw={500}>
              Strategy Hints
            </Text>
            {totalHints > 0 && (
              <Badge size="xs" variant="filled" color="blue">
                {totalHints}
              </Badge>
            )}
          </Group>

          <Group gap="xs">
            {/* Show tag badges */}
            {problemTags.slice(0, 3).map((tag) => (
              <Badge key={tag} size="xs" variant="light" color="gray">
                {tag}
              </Badge>
            ))}

            <Button
              variant="subtle"
              size="xs"
              onClick={() => setIsExpanded(!isExpanded)}
              rightSection={
                isExpanded ? (
                  <IconChevronUp size={12} />
                ) : (
                  <IconChevronDown size={12} />
                )
              }
              style={{ minWidth: "auto", padding: "4px 8px" }}
            >
              {isExpanded ? "Less" : "More"}
            </Button>
          </Group>
        </Group>

        {/* Expanded content */}
        <Collapse in={isExpanded}>
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
                {/* Contextual hints (higher priority) */}
                {contextualHints.length > 0 && (
                  <>
                    <Text size="xs" fw={600} c="blue" tt="uppercase">
                      Multi-Tag Strategies
                    </Text>
                    {contextualHints.map((hint, index) => (
                      <Box
                        key={`contextual-${index}`}
                        p="xs"
                        style={{
                          backgroundColor: "#e7f5ff",
                          borderRadius: "6px",
                          border: "1px solid #d0ebff",
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
                )}

                {/* General and pattern hints */}
                {generalHints.length > 0 && (
                  <>
                    {contextualHints.length > 0 && (
                      <Box style={{ height: "0.5rem" }} />
                    )}
                    <Text size="xs" fw={600} c="gray" tt="uppercase">
                      General Strategies
                    </Text>
                    {generalHints.map((hint, index) => (
                      <Box
                        key={`general-${index}`}
                        p="xs"
                        style={{
                          backgroundColor: "#f8f9fa",
                          borderRadius: "6px",
                          border: "1px solid #e9ecef",
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
                )}
              </Stack>
            )}
          </Box>
        </Collapse>
      </Card>
    </Box>
  );
};

export default CompactHintPanel;
