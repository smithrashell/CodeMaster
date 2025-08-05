import React, { useState, useEffect, useRef } from "react";
import {
  Tooltip,
  Stack,
  Text,
  Badge,
  Card,
  Group,
  Loader,
  Alert,
  Popover,
} from "@mantine/core";
import { IconBulb, IconInfoCircle } from "@tabler/icons-react";
import StrategyService from "../../services/strategyService";

/**
 * FloatingHintButton - Compact floating button that shows strategy hints in a popover
 * Better UX than inline panel - doesn't take up space until needed
 */
const FloatingHintButton = ({ problemTags = [], onOpen, onClose }) => {
  const [hints, setHints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [opened, setOpened] = useState(false);
  const buttonRef = useRef(null);

  // Load contextual hints when problem tags change
  useEffect(() => {
    if (problemTags.length > 0) {
      loadHints();
    } else {
      setHints([]);
    }
  }, [problemTags]);

  const loadHints = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("🔍 FloatingHintButton loading hints for tags:", problemTags);
      const contextualHints = await StrategyService.getContextualHints(
        problemTags
      );
      console.log("💡 FloatingHintButton received hints:", contextualHints);
      setHints(contextualHints);
    } catch (err) {
      console.error("❌ Error loading hints in FloatingHintButton:", err);
      setError("Failed to load strategy hints");
    } finally {
      setLoading(false);
    }
  };

  if (problemTags.length === 0) {
    return null;
  }

  const generalHints = hints.filter(
    (hint) => hint.type === "general" || hint.type === "pattern"
  );
  const contextualHints = hints.filter((hint) => hint.type === "contextual");
  const totalHints = hints.length;

  return (
    <Popover
      opened={opened}
      onClose={() => {
        setOpened(false);
        if (onClose) {
          onClose({
            problemTags,
            hintsCount: hints.length,
            timestamp: new Date().toISOString(),
          });
        }
      }}
      width={350}
      position="bottom"
      withArrow
      withinPortal
      shadow="md"
      styles={{
        dropdown: {
          maxHeight: "80vh",
          overflowY: "auto",
        },
      }}
    >
      <Popover.Target>
        <Tooltip
          label={`${totalHints} strategy hints available`}
          position="top"
        >
          <button
            ref={buttonRef}
            onClick={() => {
              const newOpened = !opened;
              setOpened(newOpened);
              if (newOpened && onOpen) {
                onOpen({
                  problemTags,
                  hintsCount: hints.length,
                  timestamp: new Date().toISOString(),
                });
              }
            }}
            style={{
              background: "linear-gradient(135deg, #ffd43b, #fd7e14)",
              border: "none",
              borderRadius: "50%",
              width: "30px",
              height: "30px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              position: "relative",
              margin: "0 4px",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = "scale(1.05)";
              e.target.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.2)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "scale(1)";
              e.target.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.15)";
            }}
          >
            <IconBulb size={16} color="white" />
            {totalHints > 0 && (
              <Badge
                size="xs"
                variant="filled"
                color="red"
                style={{
                  position: "absolute",
                  top: -4,
                  right: -4,
                  minWidth: 16,
                  height: 16,
                  padding: 0,
                  fontSize: "9px",
                  lineHeight: "16px",
                }}
              >
                {totalHints}
              </Badge>
            )}
          </button>
        </Tooltip>
      </Popover.Target>

      <Popover.Dropdown>
        <div style={{ padding: "16px" }}>
          {/* Header */}
          <Group justify="space-between" mb="sm">
            <Group gap="xs">
              <IconBulb size={20} color="#ffd43b" />
              <Text fw={600} size="sm">
                Strategy Hints
              </Text>
            </Group>
            <Group gap="xs">
              {problemTags.map((tag) => (
                <Badge key={tag} size="xs" variant="light">
                  {tag}
                </Badge>
              ))}
            </Group>
          </Group>

          {loading && (
            <Group justify="center" p="md">
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
            <Text size="sm" c="dimmed" ta="center" p="md">
              No strategy hints available.
            </Text>
          )}

          {!loading && !error && hints.length > 0 && (
            <Stack gap="sm">
              {/* Contextual hints (higher priority) */}
              {contextualHints.length > 0 && (
                <>
                  <Text size="xs" fw={500} c="blue" tt="uppercase">
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
                        {hint.relationshipScore > 0 && (
                          <Badge size="xs" variant="dot" color="green">
                            {hint.relationshipScore}
                          </Badge>
                        )}
                      </Group>
                      <Text size="sm" lh={1.4}>
                        {hint.tip}
                      </Text>
                    </Card>
                  ))}
                </>
              )}

              {/* General and pattern hints */}
              {generalHints.length > 0 && (
                <>
                  {contextualHints.length > 0 && (
                    <div style={{ marginTop: "0.5rem" }} />
                  )}
                  <Text size="xs" fw={500} c="gray" tt="uppercase">
                    General Strategies
                  </Text>
                  {generalHints.map((hint, index) => (
                    <Card
                      key={`general-${index}`}
                      p="sm"
                      radius="sm"
                      bg="gray.0"
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
                      <Text size="sm" lh={1.4}>
                        {hint.tip}
                      </Text>
                    </Card>
                  ))}
                </>
              )}
            </Stack>
          )}
        </div>
      </Popover.Dropdown>
    </Popover>
  );
};

export default FloatingHintButton;
