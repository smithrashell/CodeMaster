import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useTheme } from "../../../shared/provider/themeprovider";
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
  interviewConfig = null,
  sessionType = null,
  uiMode = 'full-support',
}) => {
  const [hints, setHints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [opened, setOpened] = useState(false);
  const [expandedHints, setExpandedHints] = useState(new Set());
  const [hintsUsed, setHintsUsed] = useState(0); // Track hints used in this session
  const buttonRef = useRef(null);

  // Get current theme
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';

  // Theme-aware colors - matching timer component colors exactly
  const themeColors = useMemo(() => ({
    light: {
      buttonBg: {
        collapsed: "#ffffff",  // Match timer background
        expanded: "#ffffff",   // Match timer background
        hover: "#f8f9ff"      // Subtle blue tint on hover
      },
      buttonBorder: "#cccccc", // Match timer border
      expandedBg: "#ffffff",   // Match timer background
      expandedBorder: "#cccccc", // Match timer border
      containerBorder: "#cccccc", // Match timer border
      text: "#000000"         // Match timer text
    },
    dark: {
      buttonBg: {
        collapsed: "#374151",  // Match timer background
        expanded: "#374151",   // Match timer background
        hover: "#4b5563"      // Slightly lighter on hover (matches timer border)
      },
      buttonBorder: "#4b5563", // Match timer border
      expandedBg: "#374151",   // Match timer background
      expandedBorder: "#4b5563", // Match timer border
      containerBorder: "#4b5563", // Match timer border
      text: "#ffffff"         // Match timer text
    }
  }), []);

  const colors = isDark ? themeColors.dark : themeColors.light;

  // Memoize the stringified tags to prevent effect from running on array reference changes
  const tagsString = useMemo(() => JSON.stringify(problemTags), [problemTags]);

  // Memoize interview restrictions to prevent re-renders
  const interviewRestrictions = useMemo(() => {
    if (!interviewConfig || !sessionType || sessionType === 'standard') {
      return { hintsAllowed: true, maxHints: null, hintsAvailable: true };
    }

    const maxHints = interviewConfig.hints?.max ?? null;
    const hintsAllowed = maxHints === null || maxHints > 0;
    const hintsAvailable = hintsAllowed && (maxHints === null || hintsUsed < maxHints);

    return {
      hintsAllowed,
      maxHints,
      hintsAvailable,
      hintsRemaining: maxHints === null ? null : Math.max(0, maxHints - hintsUsed),
      isInterviewMode: true,
      sessionType,
    };
  }, [interviewConfig, sessionType, hintsUsed]);

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
  const buttonStyles = useMemo(() => {
    let baseStyles = {
      border: "none",
      borderRadius: "50%",
      width: "32px",
      height: "32px", 
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      position: "relative",
      margin: "0 4px",
      transition: "all 0.2s ease",
    };

    // Apply UI mode-specific styling
    switch (uiMode) {
      case 'minimal-clean':
        return {
          ...baseStyles,
          background: "#6b7280", // Muted gray
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
        };
      case 'pressure-indicators':
        return {
          ...baseStyles,
          background: !interviewRestrictions.hintsAvailable 
            ? "#ef4444" // Red when no hints left
            : "linear-gradient(135deg, #f59e0b, #d97706)", // Orange gradient
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
        };
      default: // full-support
        return {
          ...baseStyles,
          background: "linear-gradient(135deg, #ffd43b, #fd7e14)",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
        };
    }
  }, [uiMode, interviewRestrictions.hintsAvailable]);

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

      // Check interview restrictions before expanding hints
      if (!isCurrentlyExpanded && !interviewRestrictions.hintsAvailable) {
        // Don't allow expanding if hints are not available in interview mode
        return;
      }

      setExpandedHints((prev) => {
        const newSet = new Set(prev);
        if (isCurrentlyExpanded) {
          newSet.delete(hintId);
        } else {
          newSet.add(hintId);
          // Increment hints used when expanding (viewing) a hint in interview mode
          if (interviewRestrictions.isInterviewMode) {
            setHintsUsed(prevUsed => prevUsed + 1);
          }
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
    [expandedHints, onHintClick, problemTags, hints.length, opened, interviewRestrictions]
  );

  // Generate a unique hint ID
  const getHintId = useCallback((hint, index, hintType) => {
    return `${hintType}-${hint.primaryTag}-${
      hint.relatedTag || "general"
    }-${index}`;
  }, []);

  // Don't render if no tags or if hints are completely disabled in interview mode
  if (problemTags.length === 0 || !interviewRestrictions.hintsAllowed) {
    return null;
  }

  return (
    <Popover
      opened={opened}
      onClose={handlePopoverClose}
      width={uiMode === 'minimal-clean' ? 300 : 350}
      position="bottom"
      withArrow
      withinPortal
      shadow={uiMode === 'minimal-clean' ? "sm" : "md"}
      styles={{
        dropdown: {
          maxHeight: "80vh",
          overflowY: "auto",
          backgroundColor: colors.expandedBg, // Force override Mantine defaults with timer colors
          borderColor: colors.containerBorder, // Match timer border
          border: `1px solid ${colors.containerBorder}`, // Ensure border is applied
          color: colors.text, // Set text color to match timer
        },
      }}
    >
      <Popover.Target>
        <Tooltip
          label={interviewRestrictions.isInterviewMode && interviewRestrictions.maxHints !== null
            ? `${interviewRestrictions.hintsRemaining} of ${interviewRestrictions.maxHints} hints remaining (Interview Mode)`
            : `${totalHints} strategy hints available`}
          position="top"
        >
          <button
            ref={buttonRef}
            onClick={handleButtonClick}
            style={buttonStyles}
            aria-label={interviewRestrictions.isInterviewMode && interviewRestrictions.maxHints !== null
              ? `${interviewRestrictions.hintsRemaining} of ${interviewRestrictions.maxHints} hints remaining in Interview Mode. Click to view hints for ${problemTags.join(", ")}`
              : `${totalHints} strategy hints available. Click to view hints for ${problemTags.join(", ")}`}
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
            {(totalHints > 0 || interviewRestrictions.isInterviewMode) && (
              <Badge
                size="xs"
                variant="filled"
                color={!interviewRestrictions.hintsAvailable ? "gray" : 
                       interviewRestrictions.isInterviewMode ? "orange" : "red"}
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
                {interviewRestrictions.isInterviewMode && interviewRestrictions.maxHints !== null
                  ? interviewRestrictions.hintsRemaining
                  : totalHints}
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
          {interviewRestrictions.isInterviewMode && interviewRestrictions.maxHints !== null && (
            <Alert
              color="orange"
              variant="light"
              mb="sm"
              styles={{ body: { fontSize: '12px' } }}
            >
              {interviewRestrictions.hintsAvailable 
                ? `${interviewRestrictions.hintsRemaining} hints remaining in this interview session`
                : 'No hints remaining in this interview session'}
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
              {/* Contextual hints (higher priority) */}
              {contextualHints.length > 0 && (
                <>
                  <Text size="xs" fw={500} c={colors.text} tt="uppercase" mb="xs" style={{ opacity: 0.8 }}>
                    Multi-Tag Strategies ({contextualHints.length})
                  </Text>
                  {contextualHints.map((hint, index) => {
                    const hintId = getHintId(hint, index, "contextual");
                    const isExpanded = expandedHints.has(hintId);

                    return (
                      <div
                        key={hintId}
                        style={{
                          border: `1px solid ${colors.containerBorder}`,
                          borderRadius: "6px",
                        }}
                      >
                        {/* Collapsed title row */}
                        <div
                          role="button"
                          tabIndex={0}
                          style={{
                            padding: "10px 14px",
                            cursor: interviewRestrictions.hintsAvailable ? "pointer" : "not-allowed",
                            backgroundColor: isExpanded ? colors.buttonBg.expanded : colors.buttonBg.collapsed,
                            borderRadius: "6px",
                            transition: "background-color 0.2s ease",
                            borderBottom: isExpanded
                              ? `1px solid ${colors.buttonBorder}`
                              : "none",
                            opacity: !interviewRestrictions.hintsAvailable ? 0.5 : 1,
                          }}
                          onClick={() => {
                            if (interviewRestrictions.hintsAvailable) {
                              toggleHintExpansion(
                                hintId,
                                hint,
                                index,
                                "contextual"
                              );
                            }
                          }}
                          onKeyDown={(e) => {
                            if ((e.key === "Enter" || e.key === " ") && interviewRestrictions.hintsAvailable) {
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
                            e.currentTarget.style.backgroundColor = colors.buttonBg.hover;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = isExpanded
                              ? colors.buttonBg.expanded
                              : colors.buttonBg.collapsed;
                          }}
                          aria-label={`${isExpanded ? "Collapse" : "Expand"} ${
                            hint.primaryTag
                          } + ${hint.relatedTag} strategy hint`}
                        >
                          <Text
                            size="sm"
                            fw={500}
                            style={{
                              textTransform: "capitalize",
                              letterSpacing: "0.3px",
                              color: colors.text
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
                              backgroundColor: colors.expandedBg,
                              borderRadius: "0 0 6px 6px",
                              borderTop: `1px solid ${colors.expandedBorder}`,
                            }}
                          >
                            <Text
                              size="sm"
                              lh={1.6}
                              style={{ 
                                lineHeight: "1.5",
                                color: colors.text
                              }}
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
                  <Text size="xs" fw={500} c={colors.text} tt="uppercase" mb="xs" style={{ opacity: 0.8 }}>
                    General Strategies ({generalHints.length})
                  </Text>
                  {generalHints.map((hint, index) => {
                    const hintId = getHintId(
                      hint,
                      index + contextualHints.length,
                      "contextual"
                    );
                    const isExpanded = expandedHints.has(hintId);

                    return (
                      <div
                        key={hintId}
                        style={{
                          border: `1px solid ${colors.containerBorder}`,
                          borderRadius: "6px",
                        }}
                      >
                        {/* Collapsed title row */}
                        <div
                          role="button"
                          tabIndex={0}
                          style={{
                            padding: "10px 14px",
                            cursor: interviewRestrictions.hintsAvailable ? "pointer" : "not-allowed",
                            backgroundColor: isExpanded ? colors.buttonBg.expanded : colors.buttonBg.collapsed,
                            borderRadius: "6px",
                            transition: "background-color 0.2s ease",
                            borderBottom: isExpanded
                              ? `1px solid ${colors.buttonBorder}`
                              : "none",
                            opacity: !interviewRestrictions.hintsAvailable ? 0.5 : 1,
                          }}
                          onClick={() => {
                            if (interviewRestrictions.hintsAvailable) {
                              toggleHintExpansion(
                                hintId,
                                hint,
                                index + contextualHints.length,
                                "contextual"
                              );
                            }
                          }}
                          onKeyDown={(e) => {
                            if ((e.key === "Enter" || e.key === " ") && interviewRestrictions.hintsAvailable) {
                              e.preventDefault();
                              toggleHintExpansion(
                                hintId,
                                hint,
                                index + contextualHints.length,
                                "contextual"
                              );
                            }
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = colors.buttonBg.hover;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = isExpanded
                              ? colors.buttonBg.expanded
                              : colors.buttonBg.collapsed;
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
                            style={{
                              textTransform: "capitalize",
                              letterSpacing: "0.3px",
                              color: colors.text
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
                              backgroundColor: colors.expandedBg,
                              borderRadius: "0 0 6px 6px",
                              borderTop: `1px solid ${colors.expandedBorder}`,
                            }}
                          >
                            <Text
                              size="sm"
                              lh={1.6}
                              style={{ 
                                lineHeight: "1.5",
                                color: colors.text
                              }}
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
