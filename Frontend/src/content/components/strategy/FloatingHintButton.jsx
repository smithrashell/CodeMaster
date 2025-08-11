import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import {
  Tooltip,
  Stack,
  Text,
  Badge,
  Group,
  Loader,
  Alert,
  Popover,
} from "@mantine/core";
import { IconBulb, IconInfoCircle } from "@tabler/icons-react";
import StrategyService from "../../services/strategyService";
import { HintInteractionService } from "../../../shared/services/hintInteractionService";

/**
 * FloatingHintButton - Compact floating button that shows strategy hints in a popover
 * Better UX than inline panel - doesn't take up space until needed
 */
const FloatingHintButton = ({
  problemTags = [],
  problemId = null,
  onOpen,
  onClose,
  onHintClick,
}) => {
  const [hints, setHints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [opened, setOpened] = useState(false);
  const [expandedHints, setExpandedHints] = useState(new Set());
  const buttonRef = useRef(null);

  // Memoize the stringified tags to prevent effect from running on array reference changes
  const tagsString = useMemo(() => JSON.stringify(problemTags), [problemTags]);

  // Load contextual hints when problem tags change
  useEffect(() => {
    if (problemTags.length > 0) {
      loadHints();
    } else {
      setHints([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagsString]); // Use string version to prevent unnecessary calls

  const loadHints = async () => {
    try {
      setLoading(true);
      setError(null);

      const contextualHints = await StrategyService.getContextualHints(
        problemTags
      );
      setHints(contextualHints);
    } catch (err) {
      console.error("❌ Error loading hints in FloatingHintButton:", err);
      setError("Failed to load strategy hints");
    } finally {
      setLoading(false);
    }
  };

  // Memoize expensive hint filtering calculations
  const { generalHints, contextualHints, totalHints } = useMemo(() => {
    const general = hints.filter(
      (hint) => hint.type === "general" || hint.type === "pattern"
    );
    const contextual = hints.filter((hint) => hint.type === "contextual");

    return {
      generalHints: general,
      contextualHints: contextual,
      totalHints: hints.length,
    };
  }, [hints]);

  // Memoize button styles to prevent re-creation on every render
  const buttonStyles = useMemo(
    () => ({
      background: "linear-gradient(135deg, #ffd43b, #fd7e14)",
      border: "none",
      borderRadius: "50%",
      width: "32px" /* Reduced to match other toolbar icons */,
      height: "32px" /* Reduced to match other toolbar icons */,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      position: "relative",
      margin: "0 4px",
      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
      transition: "all 0.2s ease",
    }),
    []
  );

  // Memoize callback functions
  const handlePopoverClose = useCallback(() => {
    setOpened(false);
    // Reset expanded hints when popover closes
    setExpandedHints(new Set());
    if (onClose) {
      onClose({
        problemTags,
        hintsCount: hints.length,
        timestamp: new Date().toISOString(),
      });
    }
  }, [onClose, problemTags, hints.length]);

  const handleButtonClick = useCallback(() => {
    const newOpened = !opened;
    setOpened(newOpened);
    if (newOpened && onOpen) {
      onOpen({
        problemTags,
        hintsCount: hints.length,
        timestamp: new Date().toISOString(),
      });
    }
  }, [opened, onOpen, problemTags, hints.length]);

  // Handle hint expand/collapse toggle
  const toggleHintExpansion = useCallback(
    async (hintId, hint, index, hintType) => {
      const isCurrentlyExpanded = expandedHints.has(hintId);

      setExpandedHints((prev) => {
        const newSet = new Set(prev);
        if (isCurrentlyExpanded) {
          newSet.delete(hintId);
        } else {
          newSet.add(hintId);
        }
        return newSet;
      });

      // Track the expand/collapse action
      const hintClickData = {
        problemId: problemId || "unknown",
        hintId,
        hintType,
        primaryTag: hint.primaryTag,
        relatedTag: hint.relatedTag,
        content: hint.tip,
        relationshipScore: hint.relationshipScore || null,
        timestamp: new Date().toISOString(),
        problemTags: problemTags,
        action: isCurrentlyExpanded ? "collapse" : "expand",
        sessionContext: {
          popoverOpen: opened,
          totalHints: hints.length,
          hintPosition: index,
          expandedHintsCount: isCurrentlyExpanded
            ? expandedHints.size - 1
            : expandedHints.size + 1,
        },
      };

      // Save interaction to persistent storage
      try {
        await HintInteractionService.saveHintInteraction(hintClickData, {
          totalHints: hints.length,
        });
      } catch (error) {
        console.warn("Failed to save hint interaction:", error);
      }

      // Also call the callback for any additional handling
      if (onHintClick) {
        onHintClick(hintClickData);
      }
    },
    [expandedHints, onHintClick, problemTags, hints.length, opened]
  );

  // Generate a unique hint ID
  const getHintId = useCallback((hint, index, hintType) => {
    return `${hintType}-${hint.primaryTag}-${
      hint.relatedTag || "general"
    }-${index}`;
  }, []);

  if (problemTags.length === 0) {
    return null;
  }

  return (
    <Popover
      opened={opened}
      onClose={handlePopoverClose}
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
            onClick={handleButtonClick}
            style={buttonStyles}
            aria-label={`${totalHints} strategy hints available. Click to view hints for ${problemTags.join(
              ", "
            )}`}
            aria-expanded={opened}
            aria-haspopup="dialog"
            onMouseEnter={(e) => {
              e.target.style.transform = "scale(1.05)";
              e.target.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.2)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "scale(1)";
              e.target.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.15)";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleButtonClick();
              }
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
            <Stack gap="xs">
              {/* Contextual hints (higher priority) */}
              {contextualHints.length > 0 && (
                <>
                  <Text size="xs" fw={500} c="blue" tt="uppercase" mb="xs">
                    Multi-Tag Strategies ({contextualHints.length})
                  </Text>
                  {contextualHints.map((hint, index) => {
                    const hintId = getHintId(hint, index, "contextual");
                    const isExpanded = expandedHints.has(hintId);

                    return (
                      <div
                        key={hintId}
                        style={{
                          border: "1px solid #e9ecef",
                          borderRadius: "6px",
                        }}
                      >
                        {/* Collapsed title row */}
                        <div
                          role="button"
                          tabIndex={0}
                          style={{
                            padding: "10px 14px",
                            cursor: "pointer",
                            backgroundColor: isExpanded ? "#f8f9ff" : "#fafafa",
                            borderRadius: isExpanded ? "6px 6px 0 0" : "6px",
                            transition: "background-color 0.2s ease",
                            borderBottom: isExpanded
                              ? "1px solid #e6f3ff"
                              : "none",
                          }}
                          onClick={() =>
                            toggleHintExpansion(
                              hintId,
                              hint,
                              index,
                              "contextual"
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleHintExpansion(
                                hintId,
                                hint,
                                index,
                                "contextual"
                              );
                            }
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = isExpanded
                              ? "#f0f6ff"
                              : "#f0f6ff";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = isExpanded
                              ? "#f8f9ff"
                              : "#fafafa";
                          }}
                          aria-label={`${isExpanded ? "Collapse" : "Expand"} ${
                            hint.primaryTag
                          } + ${hint.relatedTag} strategy hint`}
                        >
                          <Text
                            size="sm"
                            fw={500}
                            c="dark"
                            style={{
                              textTransform: "capitalize",
                              letterSpacing: "0.3px",
                            }}
                          >
                            {hint.primaryTag} + {hint.relatedTag}
                          </Text>
                        </div>

                        {/* Expanded content */}
                        {isExpanded && (
                          <div
                            style={{
                              padding: "12px 14px",
                              backgroundColor: "#ffffff",
                              borderRadius: "0 0 6px 6px",
                              borderTop: "1px solid #f0f6ff",
                            }}
                          >
                            <Text
                              size="sm"
                              lh={1.6}
                              c="dark"
                              style={{ lineHeight: "1.5" }}
                            >
                              {hint.tip}
                            </Text>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}

              {/* General and pattern hints */}
              {generalHints.length > 0 && (
                <>
                  {contextualHints.length > 0 && (
                    <div style={{ height: "8px" }} />
                  )}
                  <Text size="xs" fw={500} c="gray" tt="uppercase" mb="xs">
                    General Strategies ({generalHints.length})
                  </Text>
                  {generalHints.map((hint, index) => {
                    const hintId = getHintId(
                      hint,
                      index + contextualHints.length,
                      hint.type || "general"
                    );
                    const isExpanded = expandedHints.has(hintId);

                    return (
                      <div
                        key={hintId}
                        style={{
                          border: "1px solid #e9ecef",
                          borderRadius: "6px",
                        }}
                      >
                        {/* Collapsed title row */}
                        <div
                          role="button"
                          tabIndex={0}
                          style={{
                            padding: "10px 14px",
                            cursor: "pointer",
                            backgroundColor: isExpanded ? "#f9f9f9" : "#fafafa",
                            borderRadius: isExpanded ? "6px 6px 0 0" : "6px",
                            transition: "background-color 0.2s ease",
                            borderBottom: isExpanded
                              ? "1px solid #e9ecef"
                              : "none",
                          }}
                          onClick={() =>
                            toggleHintExpansion(
                              hintId,
                              hint,
                              index + contextualHints.length,
                              hint.type || "general"
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleHintExpansion(
                                hintId,
                                hint,
                                index + contextualHints.length,
                                hint.type || "general"
                              );
                            }
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#f0f0f0";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = isExpanded
                              ? "#f9f9f9"
                              : "#fafafa";
                          }}
                          aria-label={`${isExpanded ? "Collapse" : "Expand"} ${
                            hint.primaryTag
                          }${
                            hint.relatedTag ? ` + ${hint.relatedTag}` : ""
                          } strategy hint`}
                        >
                          <Text
                            size="sm"
                            fw={500}
                            c="dark"
                            style={{
                              textTransform: "capitalize",
                              letterSpacing: "0.3px",
                            }}
                          >
                            {hint.primaryTag}
                            {hint.relatedTag && ` + ${hint.relatedTag}`}
                          </Text>
                        </div>

                        {/* Expanded content */}
                        {isExpanded && (
                          <div
                            style={{
                              padding: "12px 14px",
                              backgroundColor: "#ffffff",
                              borderRadius: "0 0 6px 6px",
                              borderTop: "1px solid #f0f0f0",
                            }}
                          >
                            <Text
                              size="sm"
                              lh={1.6}
                              c="dark"
                              style={{ lineHeight: "1.5" }}
                            >
                              {hint.tip}
                            </Text>
                          </div>
                        )}
                      </div>
                    );
                  })}
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
