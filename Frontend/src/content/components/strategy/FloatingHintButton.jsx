import React, {
  useEffect,
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
import { useFloatingHintState } from '../../hooks/useFloatingHintState.js';
import { useHintThemeColors } from '../../hooks/useHintThemeColors.js';
import { HintsSection } from './HintsSection.jsx';

// Helper function to calculate interview restrictions
const calculateInterviewRestrictions = (interviewConfig, sessionType, hintsUsed) => {
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
};

// Helper function to get button styles based on UI mode
const getButtonStyles = (uiMode, interviewRestrictions) => {
  const baseStyles = {
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

  switch (uiMode) {
    case 'minimal-clean':
      return {
        ...baseStyles,
        background: "#6b7280",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
      };
    case 'pressure-indicators':
      return {
        ...baseStyles,
        background: !interviewRestrictions.hintsAvailable 
          ? "#ef4444" 
          : "linear-gradient(135deg, #f59e0b, #d97706)",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
      };
    default:
      return {
        ...baseStyles,
        background: "linear-gradient(135deg, #ffd43b, #fd7e14)",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
      };
  }
};

// Helper function to create hint click data
const createHintClickData = (params) => {
  const { problemId, hintId, hintType, hint, problemTags, isCurrentlyExpanded, opened, hints, expandedHints, index } = params;
  
  return {
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
};

// Helper function to get tooltip label
const getTooltipLabel = (interviewRestrictions, totalHints) => {
  return interviewRestrictions.isInterviewMode && interviewRestrictions.maxHints !== null
    ? `${interviewRestrictions.hintsRemaining} of ${interviewRestrictions.maxHints} hints remaining (Interview Mode)`
    : `${totalHints} strategy hints available`;
};

// Helper function to get aria label
const getAriaLabel = (interviewRestrictions, totalHints, problemTags) => {
  return interviewRestrictions.isInterviewMode && interviewRestrictions.maxHints !== null
    ? `${interviewRestrictions.hintsRemaining} of ${interviewRestrictions.maxHints} hints remaining in Interview Mode. Click to view hints for ${problemTags.join(", ")}`
    : `${totalHints} strategy hints available. Click to view hints for ${problemTags.join(", ")}`;
};

// Helper function to get badge color
const getBadgeColor = (interviewRestrictions) => {
  if (!interviewRestrictions.hintsAvailable) return "gray";
  return interviewRestrictions.isInterviewMode ? "orange" : "red";
};

// Helper function to get badge text
const getBadgeText = (interviewRestrictions, totalHints) => {
  return interviewRestrictions.isInterviewMode && interviewRestrictions.maxHints !== null
    ? interviewRestrictions.hintsRemaining
    : totalHints;
};

// Helper function to get alert message
const getAlertMessage = (interviewRestrictions) => {
  return interviewRestrictions.hintsAvailable 
    ? `${interviewRestrictions.hintsRemaining} hints remaining in this interview session`
    : 'No hints remaining in this interview session';
};

// Helper function to check if alert should be shown
const shouldShowAlert = (interviewRestrictions) => {
  return interviewRestrictions.isInterviewMode && interviewRestrictions.maxHints !== null;
};


/**
 * FloatingHintButton - Compact floating button that shows strategy hints in a popover
 * Better UX than inline panel - doesn't take up space until needed
 */
function FloatingHintButton({
  problemTags = [],
  problemId = null,
  onOpen,
  onClose,
  onHintClick,
  interviewConfig = null,
  sessionType = null,
  uiMode = 'full-support',
}) {
  const {
    hints,
    setHints,
    loading,
    setLoading,
    error,
    setError,
    opened,
    setOpened,
    expandedHints,
    setExpandedHints,
    hintsUsed,
    setHintsUsed,
    buttonRef
  } = useFloatingHintState();

  const themeColors = useHintThemeColors();
  const colors = themeColors;

  // Memoize the stringified tags to prevent effect from running on array reference changes
  const tagsString = useMemo(() => JSON.stringify(problemTags), [problemTags]);

  // Memoize interview restrictions to prevent re-renders
  const interviewRestrictions = useMemo(() => 
    calculateInterviewRestrictions(interviewConfig, sessionType, hintsUsed),
    [interviewConfig, sessionType, hintsUsed]
  );

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
  const buttonStyles = useMemo(() => 
    getButtonStyles(uiMode, interviewRestrictions),
    [uiMode, interviewRestrictions.hintsAvailable]
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
  }, [onClose, problemTags, hints.length, setExpandedHints, setOpened]);

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
  }, [opened, onOpen, problemTags, hints.length, setOpened]);

  // Handle hint expand/collapse toggle
  const toggleHintExpansion = useCallback(
    async (hintId, hint, index, hintType) => {
      const isCurrentlyExpanded = expandedHints.has(hintId);

      // Check interview restrictions before expanding hints
      if (!isCurrentlyExpanded && !interviewRestrictions.hintsAvailable) {
        return;
      }

      setExpandedHints((prev) => {
        const newSet = new Set(prev);
        if (isCurrentlyExpanded) {
          newSet.delete(hintId);
        } else {
          newSet.add(hintId);
          if (interviewRestrictions.isInterviewMode) {
            setHintsUsed(prevUsed => prevUsed + 1);
          }
        }
        return newSet;
      });

      // Track the expand/collapse action
      const hintClickData = createHintClickData({
        problemId, hintId, hintType, hint, problemTags, isCurrentlyExpanded, 
        opened, hints, expandedHints, index
      });

      // Save interaction to persistent storage
      try {
        await HintInteractionService.saveHintInteraction(hintClickData, {
          totalHints: hints.length,
        });
      } catch (error) {
        console.warn("Failed to save hint interaction:", error);
      }

      if (onHintClick) {
        onHintClick(hintClickData);
      }
    },
    [expandedHints, onHintClick, problemTags, hints.length, opened, interviewRestrictions, problemId, setExpandedHints, setHintsUsed]
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
          label={getTooltipLabel(interviewRestrictions, totalHints)}
          position="top"
        >
          <button
            ref={buttonRef}
            onClick={handleButtonClick}
            style={buttonStyles}
            aria-label={getAriaLabel(interviewRestrictions, totalHints, problemTags)}
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
                color={getBadgeColor(interviewRestrictions)}
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
                {getBadgeText(interviewRestrictions, totalHints)}
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
      </Popover.Dropdown>
    </Popover>
  );
}

export default FloatingHintButton;
